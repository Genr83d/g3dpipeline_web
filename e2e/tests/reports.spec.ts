import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, newAppContext, storageStatePath, waitForWorkspace } from '../support/fixtures';

/** P1. Operations reports: who can reach them, and that a chosen period
 *  downloads as a real PDF named after it. The report's figures are covered
 *  by the unit suite against a fixed fixture; here the seeded September 2024
 *  completion gives the download a non-empty period to render. */

async function openReports(page: Page) {
  await page.goto('/reports');
  await waitForWorkspace(page);
  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
}

async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
}

test.describe('as a manager', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('reaches Reports from the account menu and the summary', async ({ page }) => {
    await page.goto('/summary');
    await waitForWorkspace(page);
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/\/reports$/);

    await page.goto('/');
    await waitForWorkspace(page);
    await openAccountMenu(page);
    await page.getByRole('menuitem', { name: 'Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
  });

  test('downloads the chosen month as a PDF named after it', async ({ page }) => {
    await openReports(page);
    await page.getByLabel('Year').selectOption('2024');
    await page.getByLabel('Month').selectOption({ label: 'September' });
    await expect(page.getByText('September 2024', { exact: true })).toBeVisible();
    await expect(page.getByText(/The shop completed \d+ jobs?/)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByTestId('download-report').click(),
    ]);
    expect(download.suggestedFilename()).toBe('G3D-Operations-Report-2024-09.pdf');
    const bytes = await readFile(await download.path());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(20_000);
    await expect(page.getByText('September 2024 report downloaded.')).toBeVisible();
  });

  test('refuses a backwards custom range', async ({ page }) => {
    await openReports(page);
    await page.getByRole('radio', { name: 'Custom' }).click();
    await page.getByLabel('From').fill('2024-09-20');
    await page.getByLabel('To').fill('2024-09-10');
    await expect(page.getByRole('alert')).toContainText('start date must be on or before the end date');
    await expect(page.getByTestId('download-report')).toBeDisabled();
  });
});

for (const role of ['staff', 'awf'] as const) {
  test(`${role} cannot reach Reports`, async ({ browser }) => {
    const context = await newAppContext(browser, role);
    const page = await context.newPage();
    try {
      await page.goto('/reports');
      await waitForWorkspace(page);
      await expect(page).not.toHaveURL(/\/reports/);
      await openAccountMenu(page);
      await expect(page.getByRole('menuitem', { name: 'Reports' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
