import { test, expect, jobCard, storageStatePath, waitForWorkspace } from '../../support/fixtures';
import { SEEDED } from '../../support/seed';

/** P2. A deliberately small set of pixel baselines for the surfaces whose
 *  layout is worth pinning.
 *
 *  Scope is narrow on purpose:
 *   - one engine (Chromium), because baselines are rendering-specific;
 *   - elements and static pages, never dashboards whose numbers move as other
 *     tests create and delete records;
 *   - only records no test mutates, so a snapshot cannot race a fixture.
 *
 *  Baselines are committed per platform. Regenerate with
 *  `npm run test:e2e:update-snapshots` after an intended visual change, and
 *  expect to regenerate them on a different OS. */

/** Animations are already disabled through the app's reduced-motion path; this
 *  also freezes anything CSS-driven so a frame cannot be caught mid-transition. */
const FREEZE_ANIMATIONS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the sign-in page', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.addStyleTag({ content: FREEZE_ANIMATIONS });

    await expect(page).toHaveScreenshot('sign-in.png', { maxDiffPixelRatio: 0.02 });
  });
});

test.describe('signed in', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('an overdue job card', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    // Filter to Design first: cards stretch to the tallest in their grid row,
    // so a board shared with other tests' jobs has no stable card height. The
    // seeded overdue job is the only Design job, and no test creates another.
    await page.getByLabel('Filter by job type').selectOption('design');
    const card = jobCard(page, SEEDED.overdueJob);
    await expect(card).toBeVisible();
    await expect(page.locator('[data-tour="job-card"]')).toHaveCount(1);
    await page.addStyleTag({ content: FREEZE_ANIMATIONS });

    await expect(card).toHaveScreenshot('job-card-overdue.png', { maxDiffPixelRatio: 0.02 });
  });

  test('the add-job form', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    await page.getByRole('button', { name: 'Add job', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Job Name')).toBeVisible();
    await page.addStyleTag({ content: FREEZE_ANIMATIONS });

    // An empty form: no data of any kind, so nothing here can drift.
    await expect(dialog).toHaveScreenshot('add-job-form.png', { maxDiffPixelRatio: 0.02 });
  });

  test('the appearance settings page', async ({ page }) => {
    await page.goto('/settings/appearance');
    await expect(page.getByRole('heading', { name: 'Appearance', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await page.addStyleTag({ content: FREEZE_ANIMATIONS });

    await expect(page).toHaveScreenshot('settings-appearance.png', { maxDiffPixelRatio: 0.02 });
  });
});
