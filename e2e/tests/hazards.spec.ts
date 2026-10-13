import type { Page } from '@playwright/test';
import {
  test,
  expect,
  newAppContext,
  storageStatePath,
  waitForWorkspace,
} from '../support/fixtures';
import { ACCOUNTS, SEEDED, uniqueName } from '../support/seed';
import { createCleanup } from '../support/cleanup';
import { listDocuments } from '../support/emulator';

/** P0. Hazard reporting: anyone on the floor reports, management assigns the
 *  person who sorts it out, that person resolves it with a note. */

const cleanup = createCleanup();

test.afterEach(async () => {
  await cleanup.run();
});

test.use({ storageState: storageStatePath('staff') });

function hazardCard(page: Page, title: string) {
  return page.getByRole('article', { name: title });
}

async function openHazards(page: Page) {
  await page.goto('/hazards');
  await waitForWorkspace(page);
  await expect(page.getByRole('heading', { name: 'Hazards', level: 1 })).toBeVisible();
}

async function storedHazard(title: string) {
  return (await listDocuments('hazards')).find((hazard) => hazard.data.title === title);
}

test('staff report, a manager assigns, the assignee resolves, a manager reopens, an admin deletes', async ({
  browser,
}) => {
  test.slow();
  const title = uniqueName('E2E Hazard');
  cleanup.track('hazards', title);

  // ---- Staff: report a critical hazard ---------------------------------
  const staffContext = await newAppContext(browser, 'staff');
  const staff = await staffContext.newPage();
  await openHazards(staff);
  await staff.getByRole('button', { name: 'Report hazard' }).first().click();
  const form = staff.getByRole('dialog');
  // A title is required.
  await form.getByRole('button', { name: 'Report Hazard' }).click();
  await expect(form.getByRole('alert')).toHaveText('Describe the hazard in a few words.');
  await form.getByLabel('What is the hazard?').fill(title);
  await form.getByLabel(/Where is it/).fill('Loading dock');
  await form.getByText('Critical', { exact: true }).click();
  await expect(form.getByTestId('hazard-severity-guidance')).toHaveText(
    'Stop work in the area until fixed',
  );
  await form.getByLabel(/Details/).fill('Pallets stacked against the fire exit.');
  await form.getByRole('button', { name: 'Report Hazard' }).click();
  await expect(staff.getByRole('dialog')).toBeHidden();

  const staffCard = hazardCard(staff, title);
  await expect(staffCard).toBeVisible();
  await expect(staffCard).toContainText('Critical');
  await expect(staffCard).toContainText('Unassigned');
  // An unresolved critical hazard lights the tab for everyone.
  await expect(
    staff.getByRole('navigation', { name: 'Workspace tabs' }).getByRole('link', { name: /^Hazards, \d+ urgent$/ }),
  ).toBeVisible();
  await expect(staff.getByTestId('nav-hazard-alert')).toBeVisible();
  // Staff can't assign or delete.
  await expect(staffCard.getByRole('button', { name: 'Assign' })).toHaveCount(0);
  await expect(staffCard.getByRole('button', { name: 'Delete hazard report' })).toHaveCount(0);

  const reported = await storedHazard(title);
  expect(reported?.data).toMatchObject({
    status: 'open',
    severity: 'critical',
    location: 'Loading dock',
    reportedByName: ACCOUNTS.staff.name,
    assignedToUid: '',
  });

  // ---- Manager: assign it to Sam Staff ---------------------------------
  const managerContext = await newAppContext(browser, 'manager');
  const manager = await managerContext.newPage();
  await openHazards(manager);
  const managerCard = hazardCard(manager, title);
  await expect(managerCard).toBeVisible({ timeout: 25_000 });
  await managerCard.getByRole('button', { name: 'Assign' }).click();
  const picker = manager.getByRole('dialog');
  await picker.getByRole('button', { name: new RegExp(`^${ACCOUNTS.staff.name}`) }).click();
  await expect(manager.getByRole('dialog')).toBeHidden();
  await expect(managerCard).toContainText(ACCOUNTS.staff.name);
  await expect(managerCard.getByRole('button', { name: 'Reassign' })).toBeVisible();

  // ---- Staff: the assignee works it ------------------------------------
  await expect(staffCard).toContainText('You', { timeout: 25_000 });
  await staffCard.getByRole('button', { name: 'Start' }).click();
  await expect(staffCard).toContainText('In progress');
  await staffCard.getByRole('button', { name: 'Resolve' }).click();
  const resolve = staff.getByRole('dialog');
  await resolve.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(resolve.getByRole('alert')).toHaveText('Say what was done to make it safe.');
  await resolve.getByLabel('What was done to make it safe?').fill('Cleared the pallets and taped the exit zone.');
  await resolve.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(staff.getByRole('dialog')).toBeHidden();
  // Resolved hazards leave the active list.
  await expect(hazardCard(staff, title)).toHaveCount(0);
  await staff.getByRole('button', { name: /^Resolved \(/ }).click();
  const resolvedCard = hazardCard(staff, title);
  await expect(resolvedCard).toContainText('Cleared the pallets and taped the exit zone.');
  await expect(resolvedCard).toContainText(`Resolved by${ACCOUNTS.staff.name}`);

  const stored = await storedHazard(title);
  expect(stored?.data).toMatchObject({
    status: 'resolved',
    resolutionNote: 'Cleared the pallets and taped the exit zone.',
    resolvedByName: ACCOUNTS.staff.name,
    assignedToName: ACCOUNTS.staff.name,
    assignedByName: ACCOUNTS.manager.name,
  });

  // ---- Manager: reopen it ----------------------------------------------
  await manager.getByRole('button', { name: /^Resolved \(/ }).click();
  await hazardCard(manager, title).getByRole('button', { name: 'Reopen' }).click();
  await expect(manager.getByRole('status').filter({ hasText: 'Hazard reopened.' })).toBeVisible();
  await manager.getByRole('button', { name: /^Active \(/ }).click();
  await expect(hazardCard(manager, title)).toContainText('Open');
  const reopened = await storedHazard(title);
  expect(reopened?.data.status).toBe('open');
  expect(reopened?.data.resolutionNote).toBeUndefined();

  // ---- Admin: delete it -------------------------------------------------
  const adminContext = await newAppContext(browser, 'admin');
  const admin = await adminContext.newPage();
  await openHazards(admin);
  const adminCard = hazardCard(admin, title);
  await expect(adminCard).toBeVisible({ timeout: 25_000 });
  await adminCard.getByRole('button', { name: 'Delete hazard report' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(hazardCard(admin, title)).toHaveCount(0);
  expect(await storedHazard(title)).toBeUndefined();

  await staffContext.close();
  await managerContext.close();
  await adminContext.close();
});

test('only the assignee and management see Resolve; the reporter edits until it is assigned', async ({
  page,
  browser,
}) => {
  // Seeded: reported by Sam Staff, assigned to Sasha Second.
  await openHazards(page);
  const asReporter = hazardCard(page, SEEDED.openHazard);
  await expect(asReporter).toBeVisible();
  await expect(asReporter.getByRole('button', { name: 'Resolve' })).toHaveCount(0);
  await expect(asReporter.getByRole('button', { name: 'Edit hazard report' })).toHaveCount(0);

  const assigneeContext = await newAppContext(browser, 'staffTwo');
  const assignee = await assigneeContext.newPage();
  await openHazards(assignee);
  const asAssignee = hazardCard(assignee, SEEDED.openHazard);
  await expect(asAssignee).toContainText('You');
  await expect(asAssignee.getByRole('button', { name: 'Resolve' })).toBeVisible();
  await expect(asAssignee.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(asAssignee.getByRole('button', { name: 'Assign' })).toHaveCount(0);
  await assigneeContext.close();
});

test('the reporter can correct a report nobody has picked up yet', async ({ page }) => {
  const title = uniqueName('E2E Hazard Edit');
  const corrected = `${title} (corrected)`;
  cleanup.track('hazards', title);
  cleanup.track('hazards', corrected);

  await openHazards(page);
  await page.getByRole('button', { name: 'Report hazard' }).first().click();
  await page.getByRole('dialog').getByLabel('What is the hazard?').fill(title);
  await page.getByRole('dialog').getByRole('button', { name: 'Report Hazard' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await hazardCard(page, title).getByRole('button', { name: 'Edit hazard report' }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByLabel('What is the hazard?')).toHaveValue(title);
  await form.getByLabel('What is the hazard?').fill(corrected);
  await form.getByText('High', { exact: true }).click();
  await form.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(hazardCard(page, corrected)).toContainText('High');
  expect((await storedHazard(corrected))?.data.severity).toBe('high');
});

test.describe('AWF staff', () => {
  test.use({ storageState: storageStatePath('awf') });

  test('see the Hazards tab and can report', async ({ page }) => {
    const title = uniqueName('E2E AWF Hazard');
    cleanup.track('hazards', title);

    await page.goto('/');
    await waitForWorkspace(page);
    await page
      .getByRole('navigation', { name: 'Workspace tabs' })
      .getByRole('link', { name: /^Hazards/ })
      .click();
    await expect(page.getByRole('heading', { name: 'Hazards', level: 1 })).toBeVisible();
    await expect(hazardCard(page, SEEDED.openHazard)).toBeVisible();

    await page.getByRole('button', { name: 'Report hazard' }).first().click();
    await page.getByRole('dialog').getByLabel('What is the hazard?').fill(title);
    await page.getByRole('dialog').getByRole('button', { name: 'Report Hazard' }).click();
    await expect(hazardCard(page, title)).toBeVisible();
    expect((await storedHazard(title))?.data.reportedByName).toBe(ACCOUNTS.awf.name);
  });
});
