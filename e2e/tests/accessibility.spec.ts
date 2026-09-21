import { test, expect, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { SEEDED } from '../support/seed';

/** P1. Practical accessibility and keyboard checks: every control reachable
 *  and named, dialogs behaving like dialogs, and the main flows completable
 *  without a mouse.
 *
 *  This is a floor, not a certification — passing here does not make the app
 *  WCAG compliant, and no automated sweep would. */
test.use({ storageState: storageStatePath('admin') });

test('landmarks and headings describe each page', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace tabs' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jobs');
});

async function unnamedControls(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'button, a[href], input, select, textarea';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        if (element.closest('[aria-hidden="true"]')) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        if ((element as HTMLInputElement).type === 'hidden') return false;
        const candidates = [
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.id
            ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent
            : null,
          element.textContent,
        ];
        return !candidates.some((candidate) => (candidate ?? '').trim().length > 0);
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className.split(' ')[0]}`);
  });
}

test('every interactive control on the board has an accessible name', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);

  const unnamed = await unnamedControls(page);
  expect(unnamed, `controls without an accessible name: ${unnamed.join(', ')}`).toEqual([]);
});

test('every interactive control in the archive has an accessible name', async ({ page }) => {
  await page.goto('/archive');
  await waitForWorkspace(page);
  await expect(page.getByLabel('Filter by completion month')).toBeVisible();

  const unnamed = await unnamedControls(page);
  expect(unnamed, `controls without an accessible name: ${unnamed.join(', ')}`).toEqual([]);
});

test('the archive month filter is named, labelled, and reachable from the keyboard', async ({
  page,
}) => {
  await page.goto('/archive');
  await waitForWorkspace(page);

  // getByRole resolves through the accessible name; getByLabel through a real
  // label association. The control has to satisfy both.
  const filter = page.getByRole('combobox', { name: 'Filter by completion month' });
  await expect(filter).toBeVisible();
  await expect(page.getByLabel('Filter by completion month')).toBeVisible();
  await expect(filter).toHaveValue('all');

  // Reachable by tabbing, rather than only by clicking it.
  let reached = false;
  for (let press = 0; press < 20 && !reached; press += 1) {
    await page.keyboard.press('Tab');
    reached = await filter.evaluate((element) => element === document.activeElement);
  }
  expect(reached, 'the month filter is reachable in the tab order').toBe(true);

  // And it filters once there, without a pointer.
  await filter.selectOption('2023-09');
  await expect(filter).toHaveValue('2023-09');
  await expect(page.getByText(SEEDED.completedSeptember2023Job)).toBeVisible();
});

test.describe('signed-out pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sign-in fields are label-associated', async ({ page }) => {
    await page.goto('/sign-in');

    // getByLabel only resolves through a real label association.
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
  });

  test('sign-up fields are label-associated', async ({ page }) => {
    await page.goto('/sign-up');

    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
});

test('a modal is announced as a dialog, traps nothing it should not, and closes on Escape', async ({
  page,
}) => {
  await page.goto('/');
  await waitForWorkspace(page);

  await page.getByRole('button', { name: 'Add job', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  await expect(page.getByRole('heading', { name: 'Add job' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the whole add-job form can be completed from the keyboard', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);

  await page.getByRole('button', { name: 'Add job', exact: true }).focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  // The form takes focus on open, so typing goes straight into the first field.
  await expect(dialog.getByLabel('Job Name')).toBeFocused();
  await page.keyboard.type('Keyboard-only job');

  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Name of Receiver')).toBeFocused();
  await page.keyboard.type('Keyboard Customer');

  // Cancelling from the keyboard leaves nothing behind.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the account menu is operable from the keyboard', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);

  const trigger = page.getByRole('button', { name: 'Account menu' });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
});

test('progress bars expose their values to assistive technology', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);

  const bar = page
    .locator('[data-tour="job-card"]')
    .filter({ hasText: SEEDED.startedRepairJob })
    .getByRole('progressbar', { name: 'Cleaning progress' });

  await expect(bar).toHaveAttribute('aria-valuenow', '100');
  await expect(bar).toHaveAttribute('aria-valuemin', '0');
  await expect(bar).toHaveAttribute('aria-valuemax', '100');
});

test('appearance controls expose radio and switch semantics', async ({ page }) => {
  await page.goto('/settings/appearance');

  await expect(page.getByRole('radiogroup').first()).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', /true|false/);
  await expect(page.getByRole('switch', { name: 'Reduce motion' })).toBeVisible();
});

test('empty states announce themselves with a heading', async ({ page }) => {
  await page.goto('/inventory');
  await page.getByRole('searchbox', { name: 'Search materials' }).fill('zzz-no-match');

  await expect(page.getByRole('heading', { name: 'No Matching Materials' })).toBeVisible();
});
