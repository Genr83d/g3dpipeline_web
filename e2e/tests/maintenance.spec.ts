import { test, expect, storageStatePath } from '../support/fixtures';
import { SEEDED, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';

/** P1. Machines CRUD plus the procedure checklist and the maintenance log
 *  that depends on it. */
test.use({ storageState: storageStatePath('admin') });

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

const CREATED_PREFIX = 'E2E Machine';

function machineCard(page: import('@playwright/test').Page, name: string) {
  return page.locator('article').filter({ hasText: name });
}

async function addMachine(page: import('@playwright/test').Page, name: string) {
  await page.goto('/maintenance');
  await page.getByRole('button', { name: 'Add machine', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Machine Name').fill(name);
  await dialog.getByLabel('Location').fill('E2E Bay');
  await dialog.getByRole('button', { name: /Add Machine|Save Changes/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('creates, edits, and deletes a machine', async ({ page }) => {
  const name = uniqueName(CREATED_PREFIX);
  cleanup.track('machines', name);
  await addMachine(page, name);

  const card = machineCard(page, name);
  await expect(card).toBeVisible();
  await expect(card).toContainText('E2E Bay');

  await card.getByRole('button', { name: 'Edit machine' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Location').fill('E2E Bay 2');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(machineCard(page, name)).toContainText('E2E Bay 2');

  await machineCard(page, name).getByRole('button', { name: 'Delete machine' }).click();
  await expect(page.getByRole('heading', { name: 'Delete machine?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).click();

  await expect(machineCard(page, name)).toHaveCount(0);
});

test('adds procedures, checks them, and logs the maintenance', async ({ page }) => {
  const name = uniqueName(CREATED_PREFIX);
  cleanup.track('machines', name);
  await addMachine(page, name);
  const card = machineCard(page, name);

  await expect(card.getByText('No procedures yet.')).toBeVisible();
  const logButton = card.getByRole('button', { name: /Log Checked Maintenance/ });
  await expect(logButton).toBeDisabled();

  await card.getByLabel('Add procedure').fill('Grease the rails');
  await card.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(card.getByText('Grease the rails')).toBeVisible();

  // Logging stays disabled until something is actually checked.
  await expect(logButton).toBeDisabled();
  // click(), not check(): the checkbox is controlled by the Firestore
  // snapshot, so its state flips only after the write round-trips and
  // check()'s immediate re-read would race that.
  const procedure = card.getByRole('checkbox').first();
  await procedure.click();
  await expect(procedure).toBeChecked();
  await expect(card.getByText('1 ready')).toBeVisible();
  await expect(logButton).toBeEnabled();

  await logButton.click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByRole('heading', { name: 'Confirm Maintenance' })).toBeVisible();
  await confirm.getByLabel(/notes/i).fill('Checked during the E2E run');
  await confirm.getByRole('button', { name: /Log Maintenance|Confirm/ }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(machineCard(page, name)).toContainText('Checked during the E2E run');
  // Completing a log clears the checklist for the next round.
  await expect(machineCard(page, name).getByText('0 ready')).toBeVisible();
});

test('removes a procedure', async ({ page }) => {
  const name = uniqueName(CREATED_PREFIX);
  cleanup.track('machines', name);
  await addMachine(page, name);
  const card = machineCard(page, name);

  await card.getByLabel('Add procedure').fill('Temporary check');
  await card.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(card.getByText('Temporary check')).toBeVisible();

  // Removing is a management task, so it lives in the machine panel rather
  // than on every row of the card's checklist.
  await card.getByRole('button', { name: 'Manage procedures' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByRole('tab', { name: /Procedures/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await panel.getByRole('button', { name: 'Remove Temporary check' }).click();
  await expect(panel.getByText('Temporary check')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await expect(card.getByText('Temporary check')).toHaveCount(0);
  await expect(card.getByText('No procedures yet.')).toBeVisible();
});

test('keeps only the latest log on the card and the full history in the panel', async ({
  page,
}) => {
  const name = uniqueName(CREATED_PREFIX);
  cleanup.track('machines', name);
  await addMachine(page, name);
  const card = machineCard(page, name);

  await card.getByLabel('Add procedure').fill('Oil the rails');
  await card.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(card.getByText('Oil the rails')).toBeVisible();

  for (const note of ['First E2E service', 'Second E2E service']) {
    const procedure = card.getByRole('checkbox').first();
    await procedure.click();
    await expect(procedure).toBeChecked();
    await card.getByRole('button', { name: /Log Checked Maintenance/ }).click();
    const confirm = page.getByRole('dialog');
    await confirm.getByLabel(/notes/i).fill(note);
    await confirm.getByRole('button', { name: /Log Maintenance|Confirm/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(card).toContainText(note);
  }

  // The card carries the newest entry only; the older one is a click away.
  await expect(card).not.toContainText('First E2E service');

  await card.getByRole('button', { name: /History/ }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByText('Second E2E service')).toBeVisible();
  await expect(panel.getByText('First E2E service')).toBeVisible();
});

test('search filters machines and reports no matches', async ({ page }) => {
  await page.goto('/maintenance');
  const search = page.getByRole('searchbox', { name: 'Search machines' });

  await search.fill(SEEDED.machine);
  await expect(machineCard(page, SEEDED.machine)).toBeVisible();

  await search.fill('zzz-no-such-machine');
  await expect(page.getByRole('heading', { name: 'No Matching Machines' })).toBeVisible();
});

test.describe('non-admin machine permissions', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('a manager can edit but not delete machines', async ({ page }) => {
    await page.goto('/maintenance');
    const card = machineCard(page, SEEDED.machine);

    await expect(card.getByRole('button', { name: 'Edit machine' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Delete machine' })).toHaveCount(0);
  });
});
