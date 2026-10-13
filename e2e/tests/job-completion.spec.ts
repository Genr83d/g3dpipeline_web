import { test, expect, jobCard, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { ACCOUNTS, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';
import { addDocument, listDocuments, type FirestoreValue } from '../support/emulator';

/** P0. A job only completes once every unit is recorded and every section is
 *  at 100%. Until then Complete is disabled and the card says what is left. */

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

test.use({ storageState: storageStatePath('staff') });

async function seedStartedJob(name: string, overrides: Record<string, FirestoreValue> = {}) {
  const users = await listDocuments('users');
  const staff = users.find((user) => user.data.email === ACCOUNTS.staff.email)!;
  const manager = users.find((user) => user.data.email === ACCOUNTS.manager.email)!;
  const now = new Date();
  await addDocument('jobs', {
    orderNumber: 'G3D-E2EGATE',
    name,
    customer: 'Gate Customer',
    quantity: 3,
    completedQuantity: 1,
    dueDate: new Date('2099-06-15T23:59:59.000Z'),
    status: 'started',
    category: 'manufacturing',
    tags: [],
    repairProcesses: [
      { name: 'Printing', progress: 100, collaboratorUid: staff.id },
      { name: 'Finishing', progress: 40, collaboratorUid: staff.id },
    ],
    isAwf: false,
    createdByUid: manager.id,
    createdByName: ACCOUNTS.manager.name,
    createdByEmail: ACCOUNTS.manager.email,
    assignedToUid: staff.id,
    assignedToName: ACCOUNTS.staff.name,
    assignedToRole: 'staff',
    collaborators: [{ uid: staff.id, name: ACCOUNTS.staff.name, role: 'staff' }],
    collaboratorUids: [staff.id],
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    updatedByUid: manager.id,
    updatedByName: ACCOUNTS.manager.name,
    ...overrides,
  });
}

test('Complete stays disabled until every unit and section is done', async ({ page }) => {
  const name = uniqueName('E2E Gate');
  cleanup.track('jobs', name);
  await seedStartedJob(name);

  await page.goto('/');
  await waitForWorkspace(page);
  const card = jobCard(page, name);
  await expect(card).toBeVisible();

  const complete = card.getByRole('button', { name: 'Complete' });
  const blockers = card.getByTestId(/^job-completion-blockers-/);
  await expect(complete).toBeDisabled();
  await expect(blockers).toContainText('Finish the work to complete this job');
  await expect(blockers).toContainText('2 of 3 units still to finish');
  await expect(blockers).toContainText('Finishing is at 40%');
  await expect(blockers).not.toContainText('Printing');
  // The disabled button points screen readers at the reason.
  await expect(complete).toHaveAccessibleDescription(/2 of 3 units still to finish/);

  // All units, but a section still short: still blocked.
  await card.getByRole('button', { name: 'Update job progress' }).click();
  await page.getByRole('dialog').getByRole('spinbutton').fill('3');
  await page.getByRole('dialog').getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(card).toContainText('3/3 units');
  await expect(complete).toBeDisabled();
  await expect(blockers).toHaveText(/Finishing is at 40%/);

  await card.getByRole('button', { name: 'Update section progress' }).click();
  await page.getByRole('dialog').getByLabel('Finishing').fill('100');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Progress' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await expect(blockers).toHaveCount(0);
  await expect(complete).toBeEnabled();
  await complete.click();
  await page.getByRole('button', { name: 'Mark as Completed' }).click();
  await expect(jobCard(page, name)).toHaveCount(0);

  const stored = (await listDocuments('jobs')).find((job) => job.data.name === name);
  expect(stored?.data).toMatchObject({ status: 'completed', completedQuantity: 3 });
  expect(stored?.data.repairProcesses).toEqual([
    expect.objectContaining({ name: 'Printing', progress: 100 }),
    expect.objectContaining({ name: 'Finishing', progress: 100 }),
  ]);
});

test('a single-unit job records its unit before it can complete', async ({ page }) => {
  const name = uniqueName('E2E Single Unit');
  cleanup.track('jobs', name);
  await seedStartedJob(name, {
    quantity: 1,
    completedQuantity: 0,
    repairProcesses: [{ name: 'Printing', progress: 100 }],
  });

  await page.goto('/');
  await waitForWorkspace(page);
  const card = jobCard(page, name);
  await expect(card).toContainText('0/1 units');
  await expect(card.getByRole('button', { name: 'Complete' })).toBeDisabled();
  await expect(card.getByTestId(/^job-completion-blockers-/)).toContainText('1 of 1 unit still to finish');

  await card.getByRole('button', { name: 'Update job progress' }).click();
  await page.getByRole('dialog').getByRole('spinbutton').fill('1');
  await page.getByRole('dialog').getByRole('button', { name: /Save/ }).click();
  await expect(card).toContainText('1/1 units');
  await expect(card.getByRole('button', { name: 'Complete' })).toBeEnabled();
});
