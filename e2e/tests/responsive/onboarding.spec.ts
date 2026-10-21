import { test, expect, storageStatePath, waitForWorkspace } from '../../support/fixtures';
import { createCleanup } from '../../support/cleanup';
import { uniqueName } from '../../support/seed';

/** P1. The Create a job guide on tablet and phone, where the Add job form
 *  fills most of the screen: the guide must stay on screen and never sit on
 *  the control it is asking for. */
test.use({ storageState: storageStatePath('staff'), suppressOnboarding: false });

const cleanup = createCleanup();
test.afterEach(async () => {
  await cleanup.run();
});

async function expectOnScreen(page: import('@playwright/test').Page, box: { x: number; y: number; width: number; height: number }) {
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

test('the Create a job guide stays on screen and out of the way', async ({ page }) => {
  const name = uniqueName('E2E Tour Phone Job');
  cleanup.track('jobs', name);
  await page.goto('/');
  await waitForWorkspace(page);
  const tour = page.getByTestId('onboarding-tooltip');
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Exit tutorial' }).click();
  await page.getByRole('link', { name: 'Help and walkthroughs' }).click();
  await page.getByRole('button', { name: /Create a job/ }).click();

  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Choose Add job');
  // Tapped for real: the guide does not cover the button it asks for.
  await page.getByRole('button', { name: 'Add job', exact: true }).click();

  const form = page.getByRole('dialog', { name: 'Add job', exact: true });
  await expect(tour).toContainText('Describe the job');
  await expectOnScreen(page, (await tour.boundingBox())!);
  await form.getByLabel('Job Name').fill(name);
  await form.getByLabel('Name of Receiver').fill('E2E Customer');
  await form.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
  await form.getByLabel('Deadline').fill('2099-05-05');

  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Split it into sections');
  await expectOnScreen(page, (await tour.boundingBox())!);
  await form.getByLabel('Job sections').fill('Cutting');

  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Tag what it uses');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Save the job');
  await expectOnScreen(page, (await tour.boundingBox())!);

  // The save button is reachable with the guide open.
  await form.getByRole('button', { name: 'Add job', exact: true }).click();
  await expect(tour).toContainText('Find it on the board');
  await expect(page.locator('article').filter({ hasText: name })).toBeVisible();
});
