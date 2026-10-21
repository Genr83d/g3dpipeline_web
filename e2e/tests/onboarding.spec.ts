import { test, expect, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { createCleanup } from '../support/cleanup';
import { uniqueName } from '../support/seed';

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

/** Opens Help with the self-starting tour closed, ready to launch a guide. */
async function openHelp(page: import('@playwright/test').Page) {
  await page.goto('/settings/help');
  const autoTour = page.getByTestId('onboarding-tooltip');
  await expect(autoTour).toBeVisible();
  await autoTour.getByRole('button', { name: 'Exit tutorial' }).click();
  await expect(autoTour).toBeHidden();
}

test.describe('the Create a job guide follows the real Add job form', () => {
  const cleanup = createCleanup();
  test.afterEach(async () => {
    await cleanup.run();
  });

  test('waits for Add job, points into the form, and finishes once the job is saved', async ({
    page,
  }) => {
    const name = uniqueName('E2E Tour Job');
    cleanup.track('jobs', name);
    await openHelp(page);
    await page.getByRole('button', { name: /Create a job/ }).click();

    const tour = page.getByTestId('onboarding-tooltip');
    await expect(tour).toContainText('Step 1 of 7');
    await tour.getByRole('button', { name: 'Next' }).click();

    // The guide asks for the real click rather than offering Next.
    await expect(tour).toContainText('Choose Add job');
    await expect(tour.getByTestId('onboarding-waiting')).toHaveText('Click Add job to continue');
    await expect(tour.getByRole('button', { name: 'Next' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add job', exact: true }).click();

    const form = page.getByRole('dialog', { name: 'Add job', exact: true });
    await expect(form).toBeVisible();
    await expect(tour).toContainText('Describe the job');
    await expect(tour).toContainText('Step 3 of 7');

    // The spotlight settles on the form, not on the button behind it, and the
    // tooltip sits clear of it. Polled: the spotlight glides between targets
    // while the form springs open.
    await expect
      .poll(async () => {
        const highlight = await page.getByTestId('onboarding-highlight').boundingBox();
        const dialog = await form.boundingBox();
        const tip = await tour.boundingBox();
        if (!highlight || !dialog || !tip) return 'not laid out';
        const insideForm =
          highlight.y >= dialog.y - 10 &&
          highlight.y + highlight.height <= dialog.y + dialog.height + 10 &&
          highlight.x >= dialog.x - 10 &&
          highlight.x + highlight.width <= dialog.x + dialog.width + 10;
        const overlaps =
          tip.x < highlight.x + highlight.width &&
          highlight.x < tip.x + tip.width &&
          tip.y < highlight.y + highlight.height &&
          highlight.y < tip.y + tip.height;
        return insideForm && !overlaps ? 'in the form, clear of the tooltip' : 'moving';
      })
      .toBe('in the form, clear of the tooltip');

    // The form stays usable, and arrow keys in a field move the cursor, not
    // the tour.
    const jobName = form.getByLabel('Job Name');
    await jobName.fill(name);
    await jobName.press('ArrowLeft');
    await jobName.press('ArrowRight');
    await expect(tour).toContainText('Step 3 of 7');
    await form.getByLabel('Name of Receiver').fill('E2E Customer');
    await form.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
    await form.getByLabel('Deadline').fill('2099-05-05');

    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('Split it into sections');
    await form.getByLabel('Job sections').fill('Cutting\nPolishing');
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('Tag what it uses');
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('Save the job');
    await expect(tour.getByTestId('onboarding-waiting')).toHaveText('Save or cancel to continue');

    await form.getByRole('button', { name: 'Add job', exact: true }).click();
    await expect(form).toBeHidden();
    await expect(tour).toContainText('Find it on the board');
    await expect(page.locator('article').filter({ hasText: name })).toBeVisible();

    await tour.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByTestId('onboarding-tooltip')).toBeHidden();
  });

  test('closing the form part-way goes back to Choose Add job', async ({ page }) => {
    await openHelp(page);
    await page.getByRole('button', { name: /Create a job/ }).click();
    const tour = page.getByTestId('onboarding-tooltip');
    await tour.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Add job', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Add job', exact: true });
    await expect(tour).toContainText('Describe the job');

    // Escape belongs to the form: it closes the form, not the tour.
    await form.getByLabel('Job Name').press('Escape');
    await expect(form).toBeHidden();
    await expect(tour).toContainText('Choose Add job');

    await page.getByRole('button', { name: 'Add job', exact: true }).click();
    await expect(tour).toContainText('Describe the job');
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('Split it into sections');
    await form.getByRole('button', { name: 'Cancel' }).click();
    await expect(tour).toContainText('Choose Add job');
  });

  test('Tab reaches the guide from inside the form', async ({ page }) => {
    await openHelp(page);
    await page.getByRole('button', { name: /Create a job/ }).click();
    const tour = page.getByTestId('onboarding-tooltip');
    await tour.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Add job', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Add job', exact: true });
    await expect(tour).toContainText('Describe the job');

    // After the form's last control comes the guide, then back to the form.
    await form.getByRole('button', { name: 'Add job', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(tour.getByRole('button', { name: 'Exit tutorial' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(form.getByRole('button', { name: 'Add job', exact: true })).toBeFocused();
  });
});

test('a dialog the step is not about pauses the tour until it closes', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('g3d-onboarding:')) window.localStorage.removeItem(key);
    }
  });
  await page.reload();
  await waitForWorkspace(page);

  const tour = page.getByTestId('onboarding-tooltip');
  await expect(tour).toContainText('Step 1 of');
  while (!(await tour.textContent())?.includes('Create a job')) {
    await tour.getByRole('button', { name: 'Next' }).click();
  }

  // The overview only mentions Add job; opening the form sets the tour aside
  // so the form is not shaded over.
  await page.getByRole('button', { name: 'Add job', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add job', exact: true });
  await expect(page.getByTestId('onboarding-paused')).toBeVisible();
  await expect(page.getByTestId('onboarding-tooltip')).toBeHidden();
  await form.getByLabel('Job Name').fill('Only looking');
  await form.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByTestId('onboarding-paused')).toBeHidden();
  await expect(tour).toContainText('Create a job');
});
