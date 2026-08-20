import {
  test,
  expect,
  jobCard,
  newAppContext,
  signOut,
  storageStatePath,
  waitForWorkspace,
} from '../support/fixtures';
import { ACCOUNTS, PASSWORD, SEEDED, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';
import { listDocuments } from '../support/emulator';

/** P0. The journeys that matter most — several features chained the way a
 *  real shift uses them. If these pass, the product works end to end; if one
 *  fails, something a user does every day is broken. */

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

const CREATED_PREFIX = 'E2E Journey';

// Journeys that build their own contexts override this per browser.newContext.
test.use({ storageState: storageStatePath('manager') });

test('manager plans a job, staff works it to completion, manager restores it', async ({
  browser,
}) => {
  const jobName = uniqueName(CREATED_PREFIX);
  cleanup.track('jobs', jobName);

  // ---- Manager: create the job and staff it ----------------------------
  const managerContext = await newAppContext(browser, 'manager');
  const manager = await managerContext.newPage();

  await manager.goto('/');
  await waitForWorkspace(manager);
  await manager.getByRole('button', { name: 'Add job', exact: true }).click();
  const form = manager.getByRole('dialog');
  await form.getByLabel('Job Name').fill(jobName);
  await form.getByLabel('Name of Receiver').fill('Journey Customer');
  await form.getByRole('spinbutton', { name: 'Quantity' }).fill('4');
  await form.getByLabel('Job sections').fill('Cutting\nAssembly');
  await form.getByLabel('Deadline').fill('2099-08-08');
  await manager.getByRole('button', { name: 'Add job', exact: true }).last().click();

  const managerCard = jobCard(manager, jobName);
  await expect(managerCard).toBeVisible();

  await managerCard.getByRole('button', { name: /Add Team|Team/ }).click();
  const sheet = manager.getByRole('dialog');
  await sheet.getByLabel('Active User').selectOption({ label: ACCOUNTS.staff.name });
  await sheet.getByRole('button', { name: 'Add Collaborator' }).click();
  await sheet.getByLabel('Cutting').selectOption({ label: ACCOUNTS.staff.name });
  await sheet.getByLabel('Assembly').selectOption({ label: ACCOUNTS.staff.name });
  await sheet.getByRole('button', { name: 'Save Collaborators' }).click();
  await expect(manager.getByRole('dialog')).toBeHidden();

  // ---- Staff: start it, record progress, finish it ---------------------
  const staffContext = await newAppContext(browser, 'staff');
  const staff = await staffContext.newPage();

  await staff.goto('/');
  await waitForWorkspace(staff);
  const staffCard = jobCard(staff, jobName);
  // A longer wait on purpose: this is the one assertion that depends on the
  // emulator pushing another session's write down a second live listener, and
  // that propagation is measurably slower than production Firestore when
  // several workers share one emulator.
  await expect(staffCard).toBeVisible({ timeout: 25_000 });

  await staffCard.getByRole('button', { name: 'Start' }).click();
  await expect(staff.getByRole('heading', { name: 'Start Job?' })).toBeVisible();
  await staff.getByRole('button', { name: 'Start Job', exact: true }).click();
  await expect(staffCard.getByText('IN PROGRESS', { exact: true })).toBeVisible();

  // Quantity progress.
  await staffCard.getByRole('button', { name: 'Update job progress' }).click();
  const progress = staff.getByRole('dialog');
  await progress.getByRole('spinbutton').fill('2');
  await progress.getByRole('button', { name: /Save/ }).click();
  await expect(staff.getByRole('dialog')).toBeHidden();
  await expect(staffCard).toContainText('2/4 units');

  // Section progress on a section this user owns.
  await staffCard.getByRole('button', { name: 'Update section progress' }).click();
  const sections = staff.getByRole('dialog');
  await sections.getByLabel('Cutting').fill('100');
  await sections.getByRole('button', { name: 'Save Progress' }).click();
  await expect(staff.getByRole('dialog')).toBeHidden();
  await expect(staffCard.getByText('50% overall')).toBeVisible();

  await staffCard.getByRole('button', { name: 'Complete' }).click();
  await expect(staff.getByRole('heading', { name: 'Complete Job?' })).toBeVisible();
  await staff.getByRole('button', { name: 'Mark as Completed' }).click();

  // Completed work leaves the board and lands in the archive.
  await expect(jobCard(staff, jobName)).toHaveCount(0);
  await staff.getByRole('link', { name: 'Archive' }).click();
  const archived = jobCard(staff, jobName);
  await expect(archived).toBeVisible();
  await expect(archived.getByText('COMPLETED', { exact: true })).toBeVisible();
  // Completing a job finishes every section.
  await expect(archived.getByText('100% overall')).toBeVisible();

  // ---- Manager: restore it from the archive ----------------------------
  await manager.goto('/archive');
  await manager.getByRole('link', { name: 'Archive' }).click();
  const managerArchived = jobCard(manager, jobName);
  await expect(managerArchived).toBeVisible();
  await managerArchived.getByRole('button', { name: 'Restore' }).click();

  await expect(
    manager.getByRole('status').filter({ hasText: 'back in the pipeline' }),
  ).toBeVisible();
  await manager.getByRole('link', { name: 'Jobs' }).click();
  const restored = jobCard(manager, jobName);
  await expect(restored).toBeVisible();
  await expect(restored.getByText('PENDING', { exact: true })).toBeVisible();
  // Restoring resets the sections and clears the team.
  await expect(restored.getByText('0% overall')).toBeVisible();
  await expect(restored).toContainText('0/4 units');

  const stored = (await listDocuments('jobs')).find((job) => job.data.name === jobName);
  expect(stored?.data.status).toBe('pending');

  await managerContext.close();
  await staffContext.close();
});

test('a new starter signs in, finds their work, and updates only their own section', async ({
  browser,
}) => {
  const context = await newAppContext(browser, null);
  const page = await context.newPage();

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(ACCOUNTS.staffTwo.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await waitForWorkspace(page);

  // Narrow to their kind of work through the filter, then pick the job by
  // name. This job belongs to this test alone — the section-permission suite
  // moves progress on a different seeded repair job, so the two can run at the
  // same time without fighting over one record.
  await page.getByLabel('Filter by job type').selectOption('repair');
  const card = jobCard(page, SEEDED.starterRepairJob);
  await expect(card).toBeVisible();
  await expect(card.getByText('10% overall')).toBeVisible();

  await card.getByRole('button', { name: 'Update section progress' }).click();
  const dialog = page.getByRole('dialog');
  // Sasha owns Refit only.
  await expect(dialog.getByLabel('Refit')).toBeEnabled();
  await expect(dialog.getByLabel('Inspection')).toBeDisabled();
  await expect(dialog.getByText(`Assigned to ${ACCOUNTS.staff.name}`).first()).toBeVisible();

  await dialog.getByLabel('Refit').fill('60');
  await dialog.getByRole('button', { name: 'Save Progress' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(card.getByText('30% overall')).toBeVisible();

  // Restore the fixture value so the suite stays re-runnable.
  await card.getByRole('button', { name: 'Update section progress' }).click();
  await dialog.getByLabel('Refit').fill('20');
  await dialog.getByRole('button', { name: 'Save Progress' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(card.getByText('10% overall')).toBeVisible();

  await signOut(page);
  await context.close();
});

test('a manager checks stock, books a material, and reviews the summary', async ({ page }) => {
  const material = uniqueName('E2E Material');
  cleanup.track('inventory', material);

  await page.goto('/inventory');
  await page.getByRole('button', { name: 'Add material', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Material Name').fill(material);
  await dialog.getByLabel('Unit').fill('rolls');
  await dialog.getByLabel('Current Stock').fill('5');
  await dialog.getByLabel('Full Stock Quantity').fill('100');
  await dialog.getByRole('button', { name: 'Add Material' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  // 5% of full stock, so it must be flagged and counted as an alert.
  const card = page.locator('div.surface').filter({ hasText: material }).last();
  await expect(card.getByText('Low stock - below 30%')).toBeVisible();

  await page.getByRole('link', { name: 'Summary' }).click();
  await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();
  await expect(page.getByText(material)).toBeVisible();

});
