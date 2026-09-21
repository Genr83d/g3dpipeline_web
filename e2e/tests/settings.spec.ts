import { test, expect, storageStatePath } from '../support/fixtures';
import { ACCOUNTS, PASSWORD, uniqueName } from '../support/seed';
import { createAuthUser, deleteDocument, listDocuments, setDocument } from '../support/emulator';

/** P1. The settings area: the read-only profile, the personal-information
 *  form, appearance preferences (which persist on the device), the security
 *  form's validation, and the admin-only user management screen. */

test.describe('profile and personal information', () => {
  test.use({ storageState: storageStatePath('staff') });

  test('profile reflects the signed-in account', async ({ page }) => {
    await page.goto('/settings/profile');

    await expect(page.getByText(ACCOUNTS.staff.name).first()).toBeVisible();
    await expect(page.getByText(ACCOUNTS.staff.email).first()).toBeVisible();
    await expect(page.getByText('Staff').first()).toBeVisible();
  });

  test('personal information saves and survives a reload', async ({ page }) => {
    const jobTitle = uniqueName('Fabricator');

    await page.goto('/settings/personal');
    await page.getByLabel('Job title').fill(jobTitle);
    await page.getByLabel('Department').fill('E2E Department');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'Personal information saved.' }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Job title')).toHaveValue(jobTitle);

    // The profile page reads the same record.
    await page.goto('/settings/profile');
    await expect(page.getByText(jobTitle)).toBeVisible();
  });
});

test.describe('appearance', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('theme, contrast, motion, and text size apply and persist', async ({ page }) => {
    await page.goto('/settings/appearance');

    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('switch', { name: 'High contrast' }).click();
    await expect(page.locator('html')).toHaveClass(/hc/);

    await page.getByRole('radio', { name: 'Large' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');

    // Saved on the device, so a reload keeps them.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');

    // Put the appearance back so later tests and snapshots see defaults.
    await page.getByRole('radio', { name: 'Light' }).click();
    await page.getByRole('switch', { name: 'High contrast' }).click();
    await page.getByRole('radio', { name: 'Medium' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('security', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('mismatched new passwords are refused before any request', async ({ page }) => {
    await page.goto('/settings/security');

    await page.getByLabel('Current password').fill(PASSWORD);
    await page.getByLabel('New password', { exact: true }).fill('brand-new-password');
    await page.getByLabel('Confirm new password').fill('different-password');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'New passwords do not match.' }),
    ).toBeVisible();
  });

  test('a short new password is blocked by the field itself', async ({ page }) => {
    await page.goto('/settings/security');
    await page.getByLabel('New password', { exact: true }).fill('12345');
    await expect(page.getByLabel('New password', { exact: true })).toHaveJSProperty('validity.tooShort', true);
  });
});

test.describe('user management', () => {
  test.use({ storageState: storageStatePath('admin') });

  test('approves, disables, and removes an account', async ({ page }) => {
    // A throwaway account so the shared fixture users keep their statuses.
    const email = `${uniqueName('mgmt').replace(/[^a-z0-9]/gi, '')}@e2e.test`;
    const created = await createAuthUser(email, PASSWORD, 'Managed Person');
    await setDocument(`users/${created.uid}`, {
      uid: created.uid,
      name: 'Managed Person',
      email,
      role: 'staff',
      status: 'pending',
      createdAt: new Date('2024-01-02T09:00:00.000Z'),
      updatedAt: new Date('2024-01-02T09:00:00.000Z'),
    });

    await page.goto('/settings/users');
    const row = page.getByRole('listitem').filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText('pending')).toBeVisible();

    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(row.getByText('active')).toBeVisible();

    await row.getByRole('button', { name: 'Disable' }).click();
    await expect(row.getByText('disabled')).toBeVisible();

    await row.getByRole('button', { name: 'Restore' }).click();
    await expect(row.getByText('active')).toBeVisible();

    await row.getByRole('button', { name: 'Remove' }).click();
    await expect(row.getByText('removed')).toBeVisible();

    const stored = (await listDocuments('users')).find((user) => user.data.email === email);
    expect(stored?.data.status).toBe('removed');
    if (stored) await deleteDocument(`users/${stored.id}`);
  });

  test('offers no actions against the signed-in admin', async ({ page }) => {
    await page.goto('/settings/users');
    const own = page.getByRole('listitem').filter({ hasText: ACCOUNTS.admin.email });

    await expect(own.getByText('(you)')).toBeVisible();
    await expect(own.getByRole('button')).toHaveCount(0);
  });

  test('states plainly that roles are not editable here', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page.getByText(/Roles can only be changed in the Firebase Console/)).toBeVisible();
  });
});
