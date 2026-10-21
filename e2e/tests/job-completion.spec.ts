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

  const stored = async () =>
    (await listDocuments('jobs')).find((job) => job.data.name === name)?.data;
  await expect.poll(stored).toMatchObject({ status: 'completed', completedQuantity: 3 });
  expect((await stored())?.repairProcesses).toEqual([
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

/** End-of-day auto-completion: a started job whose work was all finished on an
 *  earlier day completes on its own the next time the shop opens the app,
 *  dated to the end of that day and credited to whoever finished it. */
test.describe('end-of-day auto-completion', () => {
  function yesterdayAt(hours: number): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, hours);
  }

  test('a job finished yesterday completes when the app opens', async ({ page }) => {
    const name = uniqueName('E2E Auto Complete');
    cleanup.track('jobs', name);
    const finishedAt = yesterdayAt(15);
    const users = await listDocuments('users');
    const manager = users.find((user) => user.data.email === ACCOUNTS.manager.email)!;
    await seedStartedJob(name, {
      completedQuantity: 3,
      repairProcesses: [
        { name: 'Printing', progress: 100 },
        { name: 'Finishing', progress: 100 },
      ],
      updatedAt: finishedAt,
      // The manager recorded the last of the work; the staff member's open
      // app is what sweeps it.
      updatedByUid: manager.id,
      updatedByName: ACCOUNTS.manager.name,
    });

    await page.goto('/');
    await waitForWorkspace(page);
    // Any signed-in client sweeps, and the other worker's pages share this
    // emulator, so which tab gets there first (and shows the toast) is a
    // race. What must hold is the stored outcome and an empty card slot.
    await expect(jobCard(page, name)).toHaveCount(0);

    const stored = async () =>
      (await listDocuments('jobs')).find((job) => job.data.name === name)?.data;
    await expect.poll(stored).toMatchObject({
      status: 'completed',
      completedQuantity: 3,
      autoCompleted: true,
      completedByUid: manager.id,
      completedByName: ACCOUNTS.manager.name,
    });
    const endOfThatDay = new Date(finishedAt);
    endOfThatDay.setHours(23, 59, 59, 999);
    expect((await stored())?.completedAt).toEqual(endOfThatDay);
  });

  test('a job finished today stays open until the day ends', async ({ page }) => {
    const name = uniqueName('E2E Finished Today');
    cleanup.track('jobs', name);
    await seedStartedJob(name, {
      completedQuantity: 3,
      repairProcesses: [{ name: 'Printing', progress: 100 }],
    });

    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, name);
    await expect(card.getByRole('button', { name: 'Complete' })).toBeEnabled();
    // Long enough for a sweep to have run and written.
    await page.waitForTimeout(1500);
    await expect(card).toBeVisible();
    expect((await listDocuments('jobs')).find((job) => job.data.name === name)?.data).toMatchObject({
      status: 'started',
    });
  });

  test('an unfinished job from yesterday is left open', async ({ page }) => {
    const name = uniqueName('E2E Unfinished Yesterday');
    cleanup.track('jobs', name);
    await seedStartedJob(name, { updatedAt: yesterdayAt(15) });

    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, name);
    await expect(card).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Complete' })).toBeDisabled();
  });
});

/** AWF accounts cannot read inventory or other shops' completed jobs, so
 *  completing must not depend on either unless the job consumes stock. */
test.describe('AWF completion', () => {
  test.use({ storageState: storageStatePath('awf') });

  test('an AWF collaborator completes a finished job', async ({ page }) => {
    const name = uniqueName('E2E AWF Complete');
    cleanup.track('jobs', name);
    const users = await listDocuments('users');
    const awf = users.find((user) => user.data.email === ACCOUNTS.awf.email)!;
    await seedStartedJob(name, {
      isAwf: true,
      completedQuantity: 3,
      repairProcesses: [{ name: 'Assembly', progress: 100, collaboratorUid: awf.id }],
      assignedToUid: awf.id,
      assignedToName: ACCOUNTS.awf.name,
      assignedToRole: 'awf',
      collaborators: [{ uid: awf.id, name: ACCOUNTS.awf.name, role: 'awf' }],
      collaboratorUids: [awf.id],
    });

    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, name);
    await card.getByRole('button', { name: 'Complete' }).click();
    await page.getByRole('button', { name: 'Mark as Completed' }).click();
    await expect(jobCard(page, name)).toHaveCount(0);

    await expect
      .poll(async () => (await listDocuments('jobs')).find((job) => job.data.name === name)?.data)
      .toMatchObject({ status: 'completed', completedByUid: awf.id });
  });
});
