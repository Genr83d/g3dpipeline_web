import type { Page } from '@playwright/test';
import { test, expect, jobCard, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { SEEDED, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';
import { addDocument } from '../support/emulator';

/** P1. The archive's completion-month filter, over the seeded completions:
 *  January 2024, September 2023, September 2024, and one record with no
 *  completion timestamp at all.
 *
 *  Assertions read option *values* (`2024-09`), never their rendered labels,
 *  because the label is formatted in the browser's own locale. The one label
 *  assertion derives its expectation from that same browser. Month membership
 *  is asserted, never the exact option list: other suites complete and restore
 *  their own jobs in the current month while these run. */
test.use({ storageState: storageStatePath('manager') });

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

/** Every seeded completion, by the month key the filter builds from it. */
const SEPTEMBER_2024 = '2024-09';
const JANUARY_2024 = '2024-01';
const SEPTEMBER_2023 = '2023-09';
const UNKNOWN = 'unknown';

function monthFilter(page: Page) {
  return page.getByLabel('Filter by completion month');
}

async function openArchive(page: Page) {
  await page.goto('/archive');
  await waitForWorkspace(page);
  await expect(page.getByRole('heading', { name: 'Archive', level: 1 })).toBeVisible();
  await expect(monthFilter(page)).toBeVisible();
}

async function monthValues(page: Page): Promise<string[]> {
  return monthFilter(page).locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  );
}

test('offers only the months that hold completed jobs, newest first', async ({ page }) => {
  await openArchive(page);

  await expect(monthFilter(page)).toHaveValue('all');
  const values = await monthValues(page);

  expect(values[0], 'All months leads the list').toBe('all');
  expect(values).toContain(SEPTEMBER_2024);
  expect(values).toContain(JANUARY_2024);
  expect(values).toContain(SEPTEMBER_2023);
  // Newest first, checked over the seeded months alone: other suites complete
  // their own jobs into the current month while this one runs.
  const seeded = values.filter((value) =>
    [SEPTEMBER_2024, JANUARY_2024, SEPTEMBER_2023].includes(value),
  );
  expect(seeded).toEqual([SEPTEMBER_2024, JANUARY_2024, SEPTEMBER_2023]);
  // No completed job shipped in August 2023, only one that was *due* then.
  expect(values).not.toContain('2023-08');
  // The undated seeded job puts Unknown month on the end.
  expect(values.at(-1)).toBe(UNKNOWN);
});

test('labels a month with its full name and year', async ({ page }) => {
  await openArchive(page);

  // Formatted by the browser under test, in its own locale — the same call the
  // app makes, so this asserts the month-and-year shape without pinning a
  // language into the suite.
  const expected = await page.evaluate(() =>
    new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
      new Date(2023, 8, 1),
    ),
  );

  const option = monthFilter(page).locator(`option[value="${SEPTEMBER_2023}"]`);
  await expect(option).toHaveText(expected);
  await expect(option).toContainText('2023');
  await expect(monthFilter(page).locator('option[value="all"]')).toHaveText('All months');
  await expect(monthFilter(page).locator(`option[value="${UNKNOWN}"]`)).toHaveText(
    'Unknown month',
  );
});

test('separates the same month in two different years', async ({ page }) => {
  await openArchive(page);

  await monthFilter(page).selectOption(SEPTEMBER_2024);
  await expect(jobCard(page, SEEDED.completedSeptember2024Job)).toBeVisible();
  await expect(jobCard(page, SEEDED.completedSeptember2023Job)).toHaveCount(0);
  await expect(jobCard(page, SEEDED.completedJob)).toHaveCount(0);

  await monthFilter(page).selectOption(SEPTEMBER_2023);
  await expect(jobCard(page, SEEDED.completedSeptember2023Job)).toBeVisible();
  await expect(jobCard(page, SEEDED.completedSeptember2024Job)).toHaveCount(0);
});

test('files a job by the month it shipped, not the month it was due', async ({ page }) => {
  await openArchive(page);

  // Seed Autumn Plaques was due in August 2023 and completed in September 2023.
  await monthFilter(page).selectOption(SEPTEMBER_2023);
  const card = jobCard(page, SEEDED.completedSeptember2023Job);
  await expect(card).toBeVisible();
  await expect(card.getByText('Completed on')).toBeVisible();
});

test('keeps a completion with no timestamp reachable', async ({ page }) => {
  await openArchive(page);

  // Present under All months...
  await expect(jobCard(page, SEEDED.completedUndatedJob)).toBeVisible();

  // ...and under Unknown month, which holds nothing that has a date.
  await monthFilter(page).selectOption(UNKNOWN);
  await expect(jobCard(page, SEEDED.completedUndatedJob)).toBeVisible();
  await expect(jobCard(page, SEEDED.completedJob)).toHaveCount(0);
  await expect(jobCard(page, SEEDED.completedSeptember2023Job)).toHaveCount(0);
});

test('never lists pending or in-progress work, under any month', async ({ page }) => {
  await openArchive(page);

  for (const month of ['all', SEPTEMBER_2024, JANUARY_2024, SEPTEMBER_2023, UNKNOWN]) {
    await monthFilter(page).selectOption(month);
    await expect(jobCard(page, SEEDED.pendingJob)).toHaveCount(0);
    await expect(jobCard(page, SEEDED.startedRepairJob)).toHaveCount(0);
    await expect(jobCard(page, SEEDED.overdueJob)).toHaveCount(0);
  }
});

test('falls back to All months when the last job of the month in view is restored', async ({
  page,
}) => {
  // A completion in a month nothing else occupies, written straight to the
  // emulator: the app can only stamp `completedAt` with the server's own
  // clock, and this test needs a month it is the sole occupant of.
  const name = uniqueName('E2E Archive Month');
  cleanup.track('jobs', name);
  const lonelyMonth = '2021-05';
  await addDocument('jobs', {
    orderNumber: 'G3D-E2EMNTH',
    name,
    customer: 'E2E Customer',
    quantity: 1,
    completedQuantity: 1,
    dueDate: new Date('2021-05-10T12:00:00.000Z'),
    status: 'completed',
    category: 'manufacturing',
    repairProcesses: [{ name: 'Build', progress: 100 }],
    isAwf: false,
    createdByUid: 'e2e',
    createdByName: 'E2E',
    createdByEmail: 'e2e@e2e.test',
    assignedToUid: '',
    assignedToName: '',
    assignedToRole: '',
    collaborators: [],
    collaboratorUids: [],
    createdAt: new Date('2021-05-01T12:00:00.000Z'),
    updatedAt: new Date('2021-05-01T12:00:00.000Z'),
    updatedByUid: 'e2e',
    updatedByName: 'E2E',
    startedAt: new Date('2021-05-02T12:00:00.000Z'),
    completedAt: new Date('2021-05-12T12:00:00.000Z'),
    completedByUid: 'e2e',
    completedByName: 'E2E',
  });

  await openArchive(page);
  await expect(monthFilter(page).locator(`option[value="${lonelyMonth}"]`)).toHaveCount(1);

  await monthFilter(page).selectOption(lonelyMonth);
  const card = jobCard(page, name);
  await expect(card).toBeVisible();
  await expect(jobCard(page, SEEDED.completedJob)).toHaveCount(0);

  // Restoring it empties the month while it is on screen.
  await card.getByRole('button', { name: 'Restore' }).click();
  await expect(monthFilter(page)).toHaveValue('all');
  await expect(monthFilter(page).locator(`option[value="${lonelyMonth}"]`)).toHaveCount(0);
  // Back on All months, with the rest of the archive intact and no crash.
  await expect(jobCard(page, SEEDED.completedJob)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Archive', level: 1 })).toBeVisible();

  // The restored job is back in the pipeline, and no longer in the archive.
  await expect(jobCard(page, name)).toHaveCount(0);
});

test.describe('restore permissions', () => {
  test.use({ storageState: storageStatePath('staff') });

  test('staff still see the archive and its filter, but no restore', async ({ page }) => {
    await openArchive(page);

    await monthFilter(page).selectOption(SEPTEMBER_2023);
    const card = jobCard(page, SEEDED.completedSeptember2023Job);
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Restore' })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Delete job' })).toHaveCount(0);
  });
});

test.describe('an archive with nothing in it', () => {
  test.use({ storageState: storageStatePath('awf') });

  test('AWF staff see only their own jobs, and the empty state when none shipped', async ({
    page,
  }) => {
    // In-app navigation, not a deep link: the workspace sends an AWF account
    // to Jobs once on entry, so /archive would redirect straight off itself.
    await page.goto('/');
    await waitForWorkspace(page);
    await page
      .getByRole('navigation', { name: 'Workspace tabs' })
      .getByRole('link', { name: 'Archive' })
      .click();
    await expect(page.getByRole('heading', { name: 'Archive', level: 1 })).toBeVisible();

    // AWF accounts see only `isAwf` jobs. The one seeded AWF job is pending
    // and no suite creates another, so this archive is reliably empty: nothing
    // to filter, and the empty state stands alone.
    await expect(page.getByRole('heading', { name: 'Nothing shipped yet' })).toBeVisible();
    await expect(monthFilter(page)).toHaveCount(0);
  });
});
