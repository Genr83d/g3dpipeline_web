import { test, expect, waitForWorkspace } from '../support/fixtures';
import { storageStatePath } from '../support/fixtures';
import { SEEDED } from '../support/seed';

/** P0: the application starts, the shell renders, and every route a signed-in
 *  user can reach loads real content rather than a crash or a spinner. */
test.describe('signed-out smoke', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sign-in page renders its form', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('sign-up and forgot-password pages render', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();

    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });
});

test.describe('signed-in smoke', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('jobs board loads with seeded work', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add job' })).toBeVisible();
  });

  test('inventory loads with seeded materials', async ({ page }) => {
    await page.goto('/inventory');

    await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
    await expect(page.getByText(SEEDED.healthyMaterial)).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search materials' })).toBeVisible();
  });

  test('maintenance loads with seeded machines', async ({ page }) => {
    await page.goto('/maintenance');

    await expect(page.getByRole('heading', { name: 'Maintenance', level: 1 })).toBeVisible();
    await expect(page.getByText(SEEDED.machine)).toBeVisible();
  });

  test('summary loads its statistics', async ({ page }) => {
    await page.goto('/summary');

    await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();
    await expect(page.getByText('Units in pipeline')).toBeVisible();
    await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
  });

  test('archive lists completed work', async ({ page }) => {
    await page.goto('/archive');

    await expect(page.getByRole('heading', { name: 'Archive', level: 1 })).toBeVisible();
    await expect(page.getByText(SEEDED.completedJob)).toBeVisible();
  });

  test('settings pages render', async ({ page }) => {
    // One page load, then in-app navigation: each page.goto is a full SPA
    // reload that re-restores the session and re-opens the Firestore
    // listeners. Deep-linking straight to a route is covered separately, in
    // auth.spec (every protected route) and navigation.spec (reload on a
    // nested route).
    await page.goto('/settings/profile');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Profile');

    for (const [item, heading] of [
      ['Personal information', 'Personal information'],
      ['Security', 'Security'],
      ['Appearance', 'Appearance'],
      ['About & privacy', 'About'],
    ] as const) {
      await page.getByRole('button', { name: 'Account menu' }).click();
      await page.getByRole('menuitem', { name: item }).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    }

    await page.getByRole('link', { name: 'Help and walkthroughs' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Help');
  });
});
