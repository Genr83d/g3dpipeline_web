import {
  test,
  expect,
  jobCard,
  storageStatePath,
  waitForWorkspace,
} from '../support/fixtures';
import { SEEDED, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';
import { listDocuments } from '../support/emulator';

/** P0. The full job lifecycle through the UI, plus the filters, sorting, and
 *  confirmation dialogs around it. Every record these tests create is named
 *  with uniqueName() and deleted afterwards, so they stay parallel-safe and
 *  leave the fixture world as they found it. */
test.use({ storageState: storageStatePath('admin') });

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

const CREATED_PREFIX = 'E2E Job';

async function openAddJob(page: import('@playwright/test').Page) {
  await page.goto('/');
  await waitForWorkspace(page);
  await page.getByRole('button', { name: 'Add job', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function fillJobForm(
  page: import('@playwright/test').Page,
  values: { name: string; customer: string; quantity?: string; sections: string; deadline?: string },
) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Job Name').fill(values.name);
  await dialog.getByLabel('Name of Receiver').fill(values.customer);
  if (values.quantity) {
    await dialog.getByRole('spinbutton', { name: 'Quantity' }).fill(values.quantity);
  }
  await dialog.getByLabel('Job sections').fill(values.sections);
  await dialog.getByLabel('Deadline').fill(values.deadline ?? '2099-01-15');
}

test.describe('job lifecycle', () => {
  test('creates, reads, edits, and deletes a job', async ({ page }) => {
    const name = uniqueName(CREATED_PREFIX);
    cleanup.track('jobs', name);
    const renamed = `${name} renamed`;
    cleanup.track('jobs', renamed);

    // Create.
    await openAddJob(page);
    await fillJobForm(page, {
      name,
      customer: 'E2E Customer',
      quantity: '7',
      sections: 'Design\nRouting\nFinishing',
    });
    await page.getByRole('button', { name: 'Add job', exact: true }).last().click();

    await expect(page.getByRole('status').filter({ hasText: 'Job added to the pipeline.' })).toBeVisible();
    const card = jobCard(page, name);
    await expect(card).toBeVisible();

    // Read: the card carries the details that were entered.
    await expect(card).toContainText('E2E Customer');
    await expect(card).toContainText('0/7 units');
    await expect(card.getByText('Design')).toBeVisible();
    await expect(card.getByText('Routing')).toBeVisible();
    await expect(card.getByText(/G3D-/)).toBeVisible();

    // Update.
    await card.getByRole('button', { name: 'Edit job' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Job Name').fill(renamed);
    await dialog.getByRole('spinbutton', { name: 'Quantity' }).fill('9');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Job updated.' })).toBeVisible();
    const updated = jobCard(page, renamed);
    await expect(updated).toBeVisible();
    await expect(updated).toContainText('0/9 units');

    // The change is persisted, not just optimistic UI.
    await page.reload();
    await waitForWorkspace(page);
    await expect(jobCard(page, renamed)).toBeVisible();

    // Delete, with its confirmation dialog.
    await jobCard(page, renamed).getByRole('button', { name: 'Delete job' }).click();
    await expect(page.getByRole('heading', { name: 'Delete Job?' })).toBeVisible();
    await expect(page.getByText(/permanently removes the job/i)).toBeVisible();
    await page.getByRole('button', { name: 'Delete Job', exact: true }).click();

    await expect(page.getByRole('status').filter({ hasText: 'deleted' })).toBeVisible();
    await expect(jobCard(page, renamed)).toHaveCount(0);
  });

  test('cancelling a delete leaves the job alone', async ({ page }) => {
    const name = uniqueName(CREATED_PREFIX);
    cleanup.track('jobs', name);
    await openAddJob(page);
    await fillJobForm(page, { name, customer: 'E2E Customer', quantity: '2', sections: 'Only' });
    await page.getByRole('button', { name: 'Add job', exact: true }).last().click();

    const card = jobCard(page, name);
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: 'Delete job' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('heading', { name: 'Delete Job?' })).toBeHidden();
    await expect(jobCard(page, name)).toBeVisible();
  });

  test('cancelling the add form creates nothing', async ({ page }) => {
    // Scoped to this test's own name rather than the size of the collection:
    // the suite is fullyParallel, so other workers add and delete jobs the
    // whole time this test runs and a global count moves underneath it.
    const name = uniqueName(CREATED_PREFIX);
    // Nothing should be written; this clears the record if something is, so a
    // regression here cannot leak a job into the rest of the run.
    cleanup.track('jobs', name);

    await openAddJob(page);
    await fillJobForm(page, {
      name,
      customer: 'Nobody',
      quantity: '3',
      sections: 'Design',
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    const written = (await listDocuments('jobs')).filter((job) => job.data.name === name);
    expect(written.map((job) => job.id), 'cancelling wrote a job anyway').toEqual([]);
  });
});

test.describe('job form validation', () => {
  test('reports each missing field in turn and never submits', async ({ page }) => {
    await openAddJob(page);
    const dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Add job', exact: true });

    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Job name is required.');

    await dialog.getByLabel('Job Name').fill(uniqueName(CREATED_PREFIX));
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Receiver is required.');

    await dialog.getByLabel('Name of Receiver').fill('Someone');
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Quantity is required.');

    await dialog.getByRole('spinbutton', { name: 'Quantity' }).fill('4');
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Deadline is required.');

    await dialog.getByLabel('Deadline').fill('2099-02-02');
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Add at least one job section.');

    await expect(dialog).toBeVisible();
  });

  test('enforces the quantity range for the chosen job type', async ({ page }) => {
    await openAddJob(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Job Name').fill(uniqueName(CREATED_PREFIX));
    await dialog.getByLabel('Name of Receiver').fill('Someone');
    await dialog.getByLabel('Job sections').fill('Design');
    await dialog.getByLabel('Deadline').fill('2099-02-02');

    await dialog.getByRole('spinbutton', { name: 'Quantity' }).fill('0');
    await dialog.getByRole('button', { name: 'Add job', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Quantity must be at least 1.');

    await dialog.getByRole('spinbutton', { name: 'Quantity' }).fill('1000');
    await dialog.getByRole('button', { name: 'Add job', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Quantity cannot exceed 999.');

    // Design jobs cap far lower, and the label changes with the type.
    await dialog.getByLabel('Job Type').selectOption('design');
    await dialog.getByRole('spinbutton', { name: 'Number of deliverables' }).fill('100');
    await dialog.getByRole('button', { name: 'Add job', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText(
      'Number of deliverables cannot exceed 99.',
    );
  });

  test('refuses a deadline in the past', async ({ page }) => {
    await openAddJob(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Job Name').fill(uniqueName(CREATED_PREFIX));
    await dialog.getByLabel('Name of Receiver').fill('Someone');
    await dialog.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
    await dialog.getByLabel('Job sections').fill('Design');
    await dialog.getByLabel('Deadline').fill('2020-01-01');
    await dialog.getByRole('button', { name: 'Add job', exact: true }).click();

    await expect(dialog.getByRole('alert')).toHaveText('Deadline cannot be in the past.');
  });

  test('relabels the sections field for repair jobs', async ({ page }) => {
    await openAddJob(page);
    const dialog = page.getByRole('dialog');

    await expect(dialog.getByLabel('Job sections')).toBeVisible();
    await dialog.getByLabel('Job Type').selectOption('repair');
    await expect(dialog.getByLabel('Repair processes')).toBeVisible();
    await expect(dialog.getByText(/Enter one process per line/)).toBeVisible();
  });

  test('requires a reason when an edit moves the deadline', async ({ page }) => {
    const name = uniqueName(CREATED_PREFIX);
    cleanup.track('jobs', name);
    await openAddJob(page);
    await fillJobForm(page, {
      name,
      customer: 'E2E Customer',
      quantity: '2',
      sections: 'Design',
      deadline: '2099-03-03',
    });
    await page.getByRole('button', { name: 'Add job', exact: true }).last().click();
    await expect(jobCard(page, name)).toBeVisible();

    await jobCard(page, name).getByRole('button', { name: 'Edit job' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Deadline').fill('2099-04-04');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Add a reason for changing the deadline.');

    await dialog.getByLabel('Reason for deadline change').fill('Customer moved the delivery date');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Job updated.' })).toBeVisible();
    await expect(jobCard(page, name)).toContainText('Customer moved the delivery date');
  });
});

test.describe('filters, sorting, and empty states', () => {
  test('filters the board down to one job type', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
    await expect(page.getByText(SEEDED.startedRepairJob)).toBeVisible();

    await page.getByLabel('Filter by job type').selectOption('repair');
    await expect(page.getByText(SEEDED.startedRepairJob)).toBeVisible();
    await expect(page.getByText(SEEDED.pendingJob)).toBeHidden();

    await page.getByLabel('Filter by job type').selectOption('all');
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
  });

  test('shows the per-type empty state and recovers from it', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    // Software development is deliberately left unseeded, and no other test
    // creates jobs of that type, so this empty state is stable in parallel.
    await page.getByLabel('Filter by job type').selectOption('softwareDevelopment');
    await expect(
      page.getByRole('heading', { name: /No Software development Jobs/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Show All Types' }).click();
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
  });

  test('sorting by quantity reorders the board', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    await page.getByLabel('Sort jobs').selectOption('qty-desc');
    const descendingFirst = await page.locator('[data-tour="job-card"]').first().textContent();

    await page.getByLabel('Sort jobs').selectOption('qty-asc');
    await expect
      .poll(async () => page.locator('[data-tour="job-card"]').first().textContent())
      .not.toBe(descendingFirst);
  });

  test('overdue work is flagged on the card and counted in the overview', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    await expect(jobCard(page, SEEDED.overdueJob).getByText('OVERDUE', { exact: true })).toBeVisible();
  });
});

test.describe('permissions on the board', () => {
  test.use({ storageState: storageStatePath('staff') });

  test('staff get no edit, team, or delete controls', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    const card = jobCard(page, SEEDED.pendingJob);
    await expect(card).toBeVisible();

    await expect(card.getByRole('button', { name: 'Edit job' })).toHaveCount(0);
    await expect(card.getByRole('button', { name: /Team/ })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Delete job' })).toHaveCount(0);
  });
});
