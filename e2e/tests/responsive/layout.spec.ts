import { test, expect, jobCard, storageStatePath, waitForWorkspace } from '../../support/fixtures';
import { SEEDED } from '../../support/seed';

/** P1. Layout-sensitive behaviour on tablet and phone viewports. These run
 *  only on the responsive projects, so viewport coverage does not multiply the
 *  rest of the suite.
 *
 *  Each test deliberately covers several screens in one browser context: a
 *  cold context pays for a full sign-in and Firestore sync (slowest on
 *  WebKit), while navigations inside a warm one are nearly free. */
test.use({ storageState: storageStatePath('manager') });

/** Nothing may push the page sideways — the usual symptom of a card, table, or
 *  dialog that does not fit a phone. */
async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, where: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // One pixel of slack for sub-pixel rounding.
  expect(
    overflow.scrollWidth,
    `${where} scrolls horizontally: ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test('the jobs board fits, its tabs navigate, and its card actions stay tappable', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await waitForWorkspace(page);

  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  const card = jobCard(page, SEEDED.pendingJob);
  await expect(card).toBeVisible();
  await expectNoHorizontalOverflow(page, 'jobs board');

  // Every action needs a touch target with real area behind it.
  const actions = card.getByTestId(/^job-actions-/);
  await expect(actions).toBeVisible();
  for (const button of await actions.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height, 'touch target height').toBeGreaterThanOrEqual(28);
      expect(box.width, 'touch target width').toBeGreaterThanOrEqual(28);
    }
  }

  // The tab strip scrolls inside itself rather than widening the page, so the
  // furthest destination is still reachable on a phone.
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
  await tabs.getByRole('link', { name: 'Archive' }).scrollIntoViewIfNeeded();
  await tabs.getByRole('link', { name: 'Archive' }).click();
  await expect(page.getByRole('heading', { name: 'Archive', level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'archive');

  // The completion-month filter sits above the list and has to stay usable at
  // this width: a real touch target, and no sideways push from its own width.
  const monthFilter = page.getByLabel('Filter by completion month');
  await expect(monthFilter).toBeVisible();
  const filterBox = await monthFilter.boundingBox();
  expect(filterBox, 'the month filter has a layout box').not.toBeNull();
  if (filterBox) {
    expect(filterBox.height, 'month filter touch target').toBeGreaterThanOrEqual(28);
    expect(filterBox.width).toBeLessThanOrEqual(testInfo.project.use.viewport!.width);
  }
  await monthFilter.selectOption('2023-09');
  await expect(jobCard(page, SEEDED.completedSeptember2023Job)).toBeVisible();
  await expect(jobCard(page, SEEDED.completedJob)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'archive with a month selected');

  await tabs.getByRole('link', { name: 'Summary' }).click();
  await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();
  await expect(page.getByText('Units in pipeline')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'summary');
});

test('dialogs fit the viewport and can be completed', async ({ page }, testInfo) => {
  const viewport = testInfo.project.use.viewport!;

  await page.goto('/');
  await waitForWorkspace(page);
  await page.getByRole('button', { name: 'Add job', exact: true }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box, 'the dialog has a layout box').not.toBeNull();
  if (box) {
    expect(box.height, 'the dialog fits within the viewport').toBeLessThanOrEqual(viewport.height);
    expect(box.width).toBeLessThanOrEqual(viewport.width);
  }

  // The submit button at the bottom of this long form must still be reachable.
  const submit = dialog.getByRole('button', { name: 'Add job', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expectNoHorizontalOverflow(page, 'jobs board with dialog closed');
});

test('inventory offers a floating add action on phones and fits everywhere', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await waitForWorkspace(page);
  // In-app navigation, not page.goto: every goto is a full SPA reload that
  // re-restores the session and re-opens the Firestore listeners, which is
  // slow enough on mobile WebKit to dominate the test.
  await page.getByRole('navigation', { name: 'Workspace tabs' })
    .getByRole('link', { name: 'Inventory' })
    .click();
  await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();

  const isPhone = testInfo.project.use.viewport!.width < 640;
  const addButtons = page.getByRole('button', { name: 'Add material' });
  // Tailwind hides the floating button from `sm` upwards, so a phone sees two
  // controls (header + floating) and a tablet only the header one.
  await expect(addButtons).toHaveCount(isPhone ? 2 : 1);

  await addButtons.last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expectNoHorizontalOverflow(page, 'inventory');

  await page.getByRole('navigation', { name: 'Workspace tabs' })
    .getByRole('link', { name: 'Maintenance' })
    .click();
  await expect(page.getByRole('heading', { name: 'Maintenance', level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'maintenance');
});

test('settings pages stay within the viewport', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);

  // Reached the way a user reaches them — through the account menu — which
  // also keeps this to a single page load.
  for (const [item, heading] of [
    ['Profile', 'Profile'],
    ['Personal information', 'Personal information'],
    ['Appearance', 'Appearance'],
    ['Security', 'Security'],
  ] as const) {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: item }).click();
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page, heading);
  }
});
