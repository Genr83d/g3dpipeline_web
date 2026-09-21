import { test, expect, storageStatePath } from '../support/fixtures';
import { SEEDED, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';
import { listDocuments } from '../support/emulator';

/** P1. Materials CRUD, the search box and its empty state, the low-stock
 *  threshold, and the form's validation boundaries. */
test.use({ storageState: storageStatePath('manager') });

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

const CREATED_PREFIX = 'E2E Material';

function materialCard(page: import('@playwright/test').Page, name: string) {
  return page.locator('div.surface').filter({ hasText: name }).last();
}

test('creates a material, edits it, and persists both', async ({ page }) => {
  const name = uniqueName(CREATED_PREFIX);
  cleanup.track('inventory', name);

  await page.goto('/inventory');
  await page.getByRole('button', { name: 'Add material', exact: true }).first().click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Material Name').fill(name);
  await dialog.getByLabel('Unit').fill('sheets');
  await dialog.getByLabel('Current Stock').fill('40');
  await dialog.getByLabel('Full Stock Quantity').fill('100');
  await dialog.getByRole('button', { name: 'Add Material' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  const card = materialCard(page, name);
  await expect(card).toBeVisible();
  await expect(card).toContainText('40 of 100 sheets');
  await expect(card.getByRole('progressbar', { name: `${name} stock level` })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );

  await card.getByRole('button', { name: 'Edit material' }).click();
  await dialog.getByLabel('Current Stock').fill('90');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(materialCard(page, name)).toContainText('90 of 100 sheets');

  await page.reload();
  await expect(materialCard(page, name)).toContainText('90 of 100 sheets');
});

test('flags stock below 30% and counts it in the alerts tile', async ({ page }) => {
  await page.goto('/inventory');

  const low = materialCard(page, SEEDED.lowMaterial);
  await expect(low.getByText('Low stock - below 30%')).toBeVisible();

  const healthy = materialCard(page, SEEDED.healthyMaterial);
  await expect(healthy.getByText('Low stock - below 30%')).toHaveCount(0);
});

test('search narrows the list and offers a way out of the empty result', async ({ page }) => {
  await page.goto('/inventory');
  const search = page.getByRole('searchbox', { name: 'Search materials' });

  await search.fill(SEEDED.lowMaterial);
  await expect(page.getByText(SEEDED.lowMaterial).first()).toBeVisible();
  await expect(page.getByText(SEEDED.healthyMaterial)).toHaveCount(0);

  await search.fill('zzz-nothing-matches-this');
  await expect(page.getByRole('heading', { name: 'No Matching Materials' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear search' }).first().click();
  await expect(page.getByText(SEEDED.healthyMaterial)).toBeVisible();
});

test.describe('material form validation', () => {
  test('keeps submit disabled until the form is complete and consistent', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('button', { name: 'Add material', exact: true }).first().click();

    const dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Add Material' });
    await expect(submit).toBeDisabled();

    await dialog.getByLabel('Material Name').fill(uniqueName(CREATED_PREFIX));
    await dialog.getByLabel('Unit').fill('kg');
    await dialog.getByLabel('Current Stock').fill('10');
    await expect(submit).toBeDisabled();

    // Stock above the full quantity is refused rather than silently clamped.
    await dialog.getByLabel('Full Stock Quantity').fill('5');
    await expect(submit).toBeDisabled();

    await dialog.getByLabel('Full Stock Quantity').fill('20');
    await expect(submit).toBeEnabled();

    // Zero stock is a legitimate boundary; a zero total is not.
    await dialog.getByLabel('Current Stock').fill('0');
    await expect(submit).toBeEnabled();
    await dialog.getByLabel('Full Stock Quantity').fill('0');
    await expect(submit).toBeDisabled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('cancelling writes nothing', async ({ page }) => {
    // This test's own name, not the size of the collection: the suite is
    // fullyParallel, and other workers create and clean up materials while
    // this one runs.
    const name = uniqueName(CREATED_PREFIX);
    // Nothing should be written; this clears the record if something is.
    cleanup.track('inventory', name);

    await page.goto('/inventory');
    await page.getByRole('button', { name: 'Add material', exact: true }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Material Name').fill(name);
    await dialog.getByLabel('Unit').fill('kg');
    await dialog.getByLabel('Current Stock').fill('1');
    await dialog.getByLabel('Full Stock Quantity').fill('2');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    const written = (await listDocuments('inventory')).filter(
      (material) => material.data.name === name,
    );
    expect(written.map((material) => material.id), 'cancelling wrote a material anyway').toEqual([]);
  });
});
