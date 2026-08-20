import { test, expect, storageStatePath, waitForWorkspace } from '../support/fixtures';

/** P2. The guided tour. Every other suite suppresses it, so this is the one
 *  place it actually runs — which also proves the suppression is hiding a real
 *  feature rather than a broken one. */
test.use({ storageState: storageStatePath('staff'), suppressOnboarding: false });

test('the walkthrough starts itself, steps forward, and remembers being skipped', async ({
  page,
}) => {
  await page.goto('/');
  await waitForWorkspace(page);

  const tour = page.getByTestId('onboarding-tooltip');
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('Step 1 of');

  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Step 2 of');

  await tour.getByRole('button', { name: 'Back' }).click();
  await expect(tour).toContainText('Step 1 of');

  await tour.getByRole('button', { name: 'Skip tutorial' }).click();
  await expect(page.getByTestId('onboarding-tooltip')).toBeHidden();

  // Skipping is remembered, so it does not ambush the user on the next visit.
  await page.reload();
  await waitForWorkspace(page);
  await expect(page.getByTestId('onboarding-tooltip')).toBeHidden();
});

test('the tour can be closed with its exit control', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await waitForWorkspace(page);
  // Start from a clean slate: the previous test may have stored progress.
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('g3d-onboarding:')) window.localStorage.removeItem(key);
    }
  });
  await page.reload();
  await waitForWorkspace(page);

  const tour = page.getByTestId('onboarding-tooltip');
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Exit tutorial' }).click();
  await expect(page.getByTestId('onboarding-tooltip')).toBeHidden();
});

test('the help page lists role-appropriate walkthroughs and can launch one', async ({ page }) => {
  await page.goto('/settings/help');

  // The tour auto-starts here too, and its tooltip sits over the page. Close
  // it first: this test is about launching a guide deliberately, not about
  // the one that starts itself.
  const autoTour = page.getByTestId('onboarding-tooltip');
  await expect(autoTour).toBeVisible();
  await autoTour.getByRole('button', { name: 'Exit tutorial' }).click();
  await expect(page.getByTestId('onboarding-tooltip')).toBeHidden();

  await expect(page.getByRole('heading', { name: 'Application walkthrough' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create a job/ })).toBeVisible();
  // Staff never see the manager-only guides.
  await expect(page.getByRole('button', { name: /Assign a team/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Create a job/ }).click();
  await expect(page.getByTestId('onboarding-tooltip')).toBeVisible();
  await page.getByTestId('onboarding-tooltip').getByRole('button', { name: 'Exit tutorial' }).click();
});
