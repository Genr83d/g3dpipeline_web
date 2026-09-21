import { test, expect, storageStatePath, waitForWorkspace } from '../support/fixtures';

/** P0/P1. Navigation is how every other feature is reached, so this covers the
 *  tab bar, the account menu, deep links, reloads, and the browser's own
 *  history buttons. */
test.use({ storageState: storageStatePath('manager') });

const TABS = [
  { label: 'Jobs', url: '/', heading: 'Jobs' },
  { label: 'Inventory', url: '/inventory', heading: 'Inventory' },
  { label: 'Maintenance', url: '/maintenance', heading: 'Maintenance' },
  { label: 'Summary', url: '/summary', heading: 'Summary' },
  { label: 'Archive', url: '/archive', heading: 'Archive' },
];

test('every workspace tab navigates and marks itself current', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });

  for (const tab of TABS) {
    await tabs.getByRole('link', { name: tab.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${tab.url === '/' ? '/$' : tab.url}`));
    await expect(page.getByRole('heading', { name: tab.heading, level: 1 })).toBeVisible();
  }
});

test('browser back and forward retrace the tab history', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });

  await tabs.getByRole('link', { name: 'Inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
  await tabs.getByRole('link', { name: 'Summary' }).click();
  await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();

  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
});

test('a nested route survives a hard reload', async ({ page }) => {
  await page.goto('/settings/appearance');
  await expect(page.getByRole('heading', { name: 'Appearance', level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Appearance', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/appearance$/);
});

test('an unknown route falls back to the jobs board', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('an unknown settings route falls back to profile', async ({ page }) => {
  await page.goto('/settings/nope');
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/profile$/);
});

test('the account menu opens, links out, and closes on Escape', async ({ page }) => {
  await page.goto('/');
  await waitForWorkspace(page);

  const trigger = page.getByRole('button', { name: 'Account menu' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Profile' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();

  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Security' }).click();
  await expect(page.getByRole('heading', { name: 'Security', level: 1 })).toBeVisible();
});

test('the header logo and settings back link return to jobs', async ({ page }) => {
  await page.goto('/settings/profile');
  await page.getByRole('link', { name: 'Back to jobs' }).click();
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();

  await page.goto('/summary');
  await page.getByRole('link', { name: 'GENR8 Pipeline home' }).click();
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
});

test('the persistent help link reaches the walkthrough page from anywhere', async ({ page }) => {
  await page.goto('/inventory');
  await page.getByRole('link', { name: 'Help and walkthroughs' }).click();
  await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible();
});
