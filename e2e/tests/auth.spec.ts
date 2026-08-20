import { test, expect, signOut, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { ACCOUNTS, PASSWORD, uniqueName } from '../support/seed';
import { deleteDocument, listDocuments } from '../support/emulator';

/** P0. Authentication is the gate in front of every other feature, so it is
 *  tested from both sides: a valid session reaching the app, and every way of
 *  failing to get one. */

const PROTECTED_ROUTES = [
  '/',
  '/inventory',
  '/maintenance',
  '/summary',
  '/archive',
  '/settings/profile',
  '/settings/users',
];

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });


  test('every protected route redirects to sign-in', async ({ page }) => {
    for (const route of PROTECTED_ROUTES) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    }
  });

  test('signs in and lands on the jobs board', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(ACCOUNTS.staff.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await waitForWorkspace(page);
    await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  });

  // Rejected credentials come back as HTTP 400 from the Identity Toolkit and
  // the browser logs every 4xx to the console. That is the request failing as
  // designed, so these tests tolerate exactly that line — anything else still
  // fails them.
  test.describe('with rejected credentials', () => {
    test.use({ allowedErrors: /Failed to load resource.*status of 400/i });

  test('rejects a wrong password without leaking which part was wrong', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(ACCOUNTS.staff.email);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
    await expect(page).toHaveURL(/\/sign-in$/);
    // The button must come back so the user can retry.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('rejects an unknown account', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('nobody@e2e.test');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText(/Incorrect email or password|No account exists/);
  });

  test('required fields block submission and an invalid email is refused', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Native validation keeps the form on the page with nothing submitted.
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('alert')).toBeHidden();
    await expect(page.getByLabel('Email')).toHaveJSProperty('validity.valueMissing', true);

    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill(PASSWORD);
    await expect(page.getByLabel('Email')).toHaveJSProperty('validity.typeMismatch', true);
  });

  test('signs up, lands on pending approval, and cannot reach the workspace', async ({ page }) => {
    const email = `${uniqueName('signup').replace(/[^a-z0-9]/gi, '')}@e2e.test`;
    const name = 'New Signup';

    await page.goto('/sign-up');
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page.getByRole('heading', { name: 'Account pending' })).toBeVisible();
    await expect(page.getByText(/waiting for an administrator to approve/i)).toBeVisible();

    // Wait for the profile write before doing anything that could interrupt
    // it. The pending screen renders as soon as the auth account exists, which
    // is *before* setDoc resolves — navigating or signing out inside that
    // window kills the write. See the "signing up" note in README.
    await expect
      .poll(
        async () => (await listDocuments('users')).find((user) => user.data.email === email)?.data,
        { message: 'sign-up writes the profile document' },
      )
      .toMatchObject({ name, email, role: 'staff', status: 'pending' });

    // A pending account stays gated even when it asks for a route directly.
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Account pending' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    const created = (await listDocuments('users')).find((user) => user.data.email === email);
    if (created) await deleteDocument(`users/${created.id}`);
  });

  test('refuses a name-less sign-up and a too-short password', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill('whoever@e2e.test');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByLabel('Name').fill('   ');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByRole('alert')).toHaveText('Your name is required.');

    await page.getByLabel('Name').fill('Someone');
    await page.getByLabel('Password').fill('12345');
    await expect(page.getByLabel('Password')).toHaveJSProperty('validity.tooShort', true);
  });

  test('refuses a duplicate email', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel('Name').fill('Duplicate Person');
    await page.getByLabel('Email').fill(ACCOUNTS.staff.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page.getByRole('alert')).toHaveText('An account already exists with that email.');
  });
  });

  test('forgot password confirms the reset email and offers a way back', async ({ page }) => {
    // Uses a real account: the Auth emulator rejects unknown addresses with
    // EMAIL_NOT_FOUND, while production has email-enumeration protection on
    // and accepts them silently. Asserting the shared path keeps this honest
    // rather than encoding emulator-only behaviour.
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(ACCOUNTS.staff.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText(/a password reset link is on its way/i)).toBeVisible();
    await expect(page.getByText(ACCOUNTS.staff.email)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('a disabled account is told, and gets no workspace', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(ACCOUNTS.disabled.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Account inactive' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Workspace tabs' })).toBeHidden();
  });
});

test.describe('signed in', () => {
  test.use({ storageState: storageStatePath('staff') });

  test('session survives a reload and a fresh tab', async ({ page, context }) => {
    await page.goto('/summary');
    await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();

    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByRole('navigation', { name: 'Workspace tabs' })).toBeVisible();
    await second.close();
  });

  test('signing out clears the session for later navigation', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    await signOut(page);

    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('a wiped auth store drops the user back to sign-in', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    // Modelling an expired/cleared session: Firebase keeps its session in
    // localStorage, so removing it is what a lost session looks like.
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('firebase:authUser:')) window.localStorage.removeItem(key);
      }
    });
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

test.describe('role gating', () => {
  test('AWF users get a reduced set of tabs and are kept out of other pages', async ({ page }) => {
    await page.goto('/');
    await waitForWorkspace(page);

    const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
    await expect(tabs.getByRole('link', { name: 'Jobs' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Summary' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Archive' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Inventory' })).toBeHidden();
    await expect(tabs.getByRole('link', { name: 'Maintenance' })).toBeHidden();

    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
  test.use({ storageState: storageStatePath('awf') });
});

test.describe('admin-only settings', () => {
  test('a non-admin asking for user management is redirected home', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  });
  test.use({ storageState: storageStatePath('staff') });
});

test.describe('admin reaches user management', () => {
  test.use({ storageState: storageStatePath('admin') });

  test('admin sees the user list', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
    await expect(page.getByText(ACCOUNTS.staff.email)).toBeVisible();
  });
});
