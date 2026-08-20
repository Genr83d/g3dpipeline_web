import { test, expect, jobCard, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { ACCOUNTS, SEEDED, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';
import { listDocuments } from '../support/emulator';

/** P0. Collaborator job sections: every job splits into sections, each owned
 *  by one collaborator, and a collaborator may only move their own. The
 *  permission model is enforced in both the UI and the service layer, so this
 *  exercises both sides through the browser. */

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

const CREATED_PREFIX = 'E2E Sections';

test.describe('reading sections on a card', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('lists each section with its owner, percentage, and bar', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, SEEDED.startedRepairJob);

    await expect(card.getByText('Repair processes')).toBeVisible();
    // (100 + 50 + 25 + 0) / 4 = 43.75 → 44%.
    await expect(card.getByText('44% overall')).toBeVisible();

    const sections = card.getByTestId(/^job-sections-/);
    await expect(sections.getByText('Cleaning')).toBeVisible();
    await expect(sections.getByText(ACCOUNTS.staff.name).first()).toBeVisible();
    await expect(sections.getByText(ACCOUNTS.staffTwo.name)).toBeVisible();
    await expect(sections.getByText('Unassigned')).toBeVisible();

    await expect(card.getByRole('progressbar', { name: 'Welding progress' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
  });

  test('a manufacturing job calls them job sections', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, SEEDED.pendingJob);

    await expect(card.getByText('Job sections')).toBeVisible();
    await expect(card.getByRole('progressbar', { name: 'Design progress' })).toBeVisible();
  });
});

test.describe('assigning collaborators to sections', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('requires every section to have an owner before saving', async ({ page }) => {
    const name = uniqueName(CREATED_PREFIX);
    cleanup.track('jobs', name);

    await page.goto('/');
    await waitForWorkspace(page);
    await page.getByRole('button', { name: 'Add job', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Job Name').fill(name);
    await form.getByLabel('Name of Receiver').fill('E2E Customer');
    await form.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
    await form.getByLabel('Job sections').fill('Cutting\nPolishing');
    await form.getByLabel('Deadline').fill('2099-05-05');
    await page.getByRole('button', { name: 'Add job', exact: true }).last().click();

    const card = jobCard(page, name);
    await expect(card).toBeVisible();
    await expect(card.getByText('Unassigned').first()).toBeVisible();

    await card.getByRole('button', { name: /Add Team|Team/ }).click();
    const sheet = page.getByRole('dialog');
    // By role: the placeholder option "Add collaborators first" also matches
    // this text, and Playwright's text matching is substring + case-insensitive.
    await expect(sheet.getByRole('heading', { name: 'ADD COLLABORATORS' })).toBeVisible();

    // Add one collaborator, then try to save with a section still unowned.
    await sheet.getByLabel('Active User').selectOption({ label: ACCOUNTS.staff.name });
    await sheet.getByRole('button', { name: 'Add Collaborator' }).click();
    await sheet.getByLabel('Cutting').selectOption({ label: ACCOUNTS.staff.name });
    await sheet.getByRole('button', { name: 'Save Collaborators' }).click();
    await expect(sheet.getByRole('alert')).toContainText(
      'Assign every section to one of this job’s collaborators.',
    );

    // One collaborator can own several sections.
    await sheet.getByLabel('Polishing').selectOption({ label: ACCOUNTS.staff.name });
    await sheet.getByRole('button', { name: 'Save Collaborators' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(card.getByText('Unassigned')).toHaveCount(0);
    await expect(card.getByTestId(/^job-sections-/).getByText(ACCOUNTS.staff.name).first()).toBeVisible();

    const stored = (await listDocuments('jobs')).find((job) => job.data.name === name);
    expect(stored?.data.repairProcesses).toMatchObject([
      { name: 'Cutting', collaboratorUid: expect.any(String) },
      { name: 'Polishing', collaboratorUid: expect.any(String) },
    ]);
  });

  test('removing a collaborator unassigns their sections', async ({ page }) => {
    const name = uniqueName(CREATED_PREFIX);
    cleanup.track('jobs', name);

    await page.goto('/');
    await waitForWorkspace(page);
    await page.getByRole('button', { name: 'Add job', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Job Name').fill(name);
    await form.getByLabel('Name of Receiver').fill('E2E Customer');
    await form.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
    await form.getByLabel('Job sections').fill('Alpha\nBeta');
    await form.getByLabel('Deadline').fill('2099-05-05');
    await page.getByRole('button', { name: 'Add job', exact: true }).last().click();

    const card = jobCard(page, name);
    await card.getByRole('button', { name: /Add Team|Team/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Active User').selectOption({ label: ACCOUNTS.staff.name });
    await sheet.getByRole('button', { name: 'Add Collaborator' }).click();
    await sheet.getByLabel('Active User').selectOption({ label: ACCOUNTS.staffTwo.name });
    await sheet.getByRole('button', { name: 'Add Collaborator' }).click();
    await sheet.getByLabel('Alpha').selectOption({ label: ACCOUNTS.staff.name });
    await sheet.getByLabel('Beta').selectOption({ label: ACCOUNTS.staffTwo.name });
    await sheet.getByRole('button', { name: 'Save Collaborators' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Drop the second collaborator: their section must fall back to unassigned
    // and block the save until it is handed to someone still on the job.
    await card.getByRole('button', { name: /Team/ }).click();
    await sheet.getByRole('button', { name: `Remove ${ACCOUNTS.staffTwo.name}` }).click();
    await expect(sheet.getByLabel('Beta')).toHaveValue('');
    await sheet.getByRole('button', { name: 'Save Collaborators' }).click();
    await expect(sheet.getByRole('alert')).toContainText('Assign every section');

    await sheet.getByLabel('Beta').selectOption({ label: ACCOUNTS.staff.name });
    await sheet.getByRole('button', { name: 'Save Collaborators' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('updating section progress', () => {
  test('a collaborator may move only their own sections', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, SEEDED.startedRepairJob);

    await card.getByRole('button', { name: 'Update section progress' }).click();
    const dialog = page.getByRole('dialog');

    // Sam owns Cleaning and Welding; Machining belongs to Sasha and Spraying
    // to nobody, so both are visible but locked.
    await expect(dialog.getByLabel('Cleaning')).toBeEnabled();
    await expect(dialog.getByLabel('Welding')).toBeEnabled();
    await expect(dialog.getByLabel('Machining')).toBeDisabled();
    await expect(dialog.getByLabel('Spraying')).toBeDisabled();
    await expect(dialog.getByText(`Assigned to ${ACCOUNTS.staffTwo.name}`)).toBeVisible();
    await expect(dialog.getByText('Unassigned')).toBeVisible();

    await dialog.getByLabel('Welding').fill('75');
    await expect(dialog.getByText('50% overall')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save Progress' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(card.getByText('50% overall')).toBeVisible();

    // Put the fixture back so the suite stays re-runnable.
    await card.getByRole('button', { name: 'Update section progress' }).click();
    await dialog.getByLabel('Welding').fill('50');
    await dialog.getByRole('button', { name: 'Save Progress' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(card.getByText('44% overall')).toBeVisible();
  });
  test.use({ storageState: storageStatePath('staff') });
});

test.describe('section progress permissions', () => {
  test('a manager may move every section', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, SEEDED.pendingJob);

    await card.getByRole('button', { name: 'Update section progress' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Design')).toBeEnabled();
    await expect(dialog.getByLabel('Routing')).toBeEnabled();
    await expect(dialog.getByLabel('Finishing')).toBeEnabled();
    await expect(dialog.getByText(/^Assigned to /)).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
  test.use({ storageState: storageStatePath('manager') });
});

test.describe('section progress for an outsider', () => {
  test('a collaborator-less staff member gets no update control', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    // staffTwo owns a section on the repair job but none on the pending job.
    await expect(
      jobCard(page, SEEDED.startedRepairJob).getByRole('button', {
        name: 'Update section progress',
      }),
    ).toBeVisible();
    await expect(
      jobCard(page, SEEDED.pendingJob).getByRole('button', { name: 'Update section progress' }),
    ).toHaveCount(0);
  });
  test.use({ storageState: storageStatePath('staffTwo') });
});

test.describe('completed jobs are locked', () => {
  test('the archive shows sections but offers no progress control', async ({ page }) => {
    await page.goto('/archive');
    const card = jobCard(page, SEEDED.completedJob);

    await expect(card.getByTestId(/^job-sections-/)).toBeVisible();
    await expect(card.getByText('100% overall')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Update section progress' })).toHaveCount(0);
  });
  test.use({ storageState: storageStatePath('staff') });
});
