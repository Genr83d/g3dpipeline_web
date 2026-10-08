import { readFile } from 'node:fs/promises';
import { test, expect, storageStatePath, waitForWorkspace } from '../../support/fixtures';

/** P1. Reports on tablet and phone: the picker fits, and the PDF downloads
 *  under its period filename. */
test.use({ storageState: storageStatePath('manager') });

test('the report picker fits and hands the PDF to the device', async ({ page }) => {
  await page.goto('/reports');
  await waitForWorkspace(page);
  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();

  for (const kind of ['Month', 'Quarter', 'Year', 'Custom']) {
    await page.getByRole('radio', { name: kind }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${kind} picker scrolls sideways`).toBeLessThanOrEqual(1);
  }

  await page.getByRole('radio', { name: 'Year' }).click();
  await page.getByLabel('Year').selectOption('2024');
  const button = page.getByTestId('download-report');
  await button.scrollIntoViewIfNeeded();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    button.click(),
  ]);
  expect(download.suggestedFilename()).toBe('G3D-Operations-Report-2024.pdf');
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByText('2024 report downloaded.')).toBeVisible();
});
