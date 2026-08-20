import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ACCOUNTS, PASSWORD, type AccountKey } from '../support/seed';
import { storageStatePath } from '../support/fixtures';

/** Signs in through the real form once per role and saves the session, so the
 *  suites that follow start signed in without repeating the login flow.
 *
 *  This deliberately drives the UI rather than forging a token: if sign-in
 *  itself breaks, every dependent project fails loudly at setup. */
const ROLES: AccountKey[] = ['admin', 'manager', 'staff', 'staffTwo', 'awf'];

setup.beforeAll(() => {
  mkdirSync('e2e/.auth', { recursive: true });
});

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const account = ACCOUNTS[role];

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('navigation', { name: 'Workspace tabs' })).toBeVisible({
      timeout: 30_000,
    });
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
