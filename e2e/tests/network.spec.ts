import { test, expect, storageStatePath, waitForWorkspace } from '../support/fixtures';
import { ACCOUNTS, PASSWORD, SEEDED } from '../support/seed';

/** P1. How the app behaves when the network does not cooperate.
 *
 *  Interception is used only for the failure paths, which cannot be provoked
 *  reliably against a healthy emulator. Every other suite runs against the
 *  real backend, so these mocks never stand in for real coverage. */

/** The Firestore SDK streams over this long-polling channel; interfering with
 *  it is what a database problem looks like to the app. */
const FIRESTORE_CHANNEL = '**/google.firestore.v1.Firestore/**';
const SIGN_IN_ENDPOINT = '**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword*';

/** These tests break the network on purpose, so the browser complains. Each
 *  alternative is a transport-level message, never an application one:
 *  `Beacon API cannot load` is WebKit failing to send Firestore's terminate
 *  beacon once the context is offline. */
const NETWORK_NOISE =
  /(Failed to load resource|net::ERR_FAILED|WebChannelConnection|Beacon API cannot load)/i;

test.describe('failed sign-in requests', () => {
  test.use({ storageState: { cookies: [], origins: [] }, allowedErrors: NETWORK_NOISE });

  test('a 500 from the auth service is reported without leaking internals', async ({ page }) => {
    await page.route(SIGN_IN_ENDPOINT, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'INTERNAL', code: 500 } }),
      }),
    );

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(ACCOUNTS.staff.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/INTERNAL|firebase|http/i);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('a 403 is surfaced as a plain message', async ({ page }) => {
    await page.route(SIGN_IN_ENDPOINT, (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'PERMISSION_DENIED', code: 403 } }),
      }),
    );

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(ACCOUNTS.staff.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).not.toContainText('PERMISSION_DENIED');
  });

  test('a dropped connection leaves the form usable', async ({ page }) => {
    await page.route(SIGN_IN_ENDPOINT, (route) => route.abort('failed'));

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(ACCOUNTS.staff.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe('unreachable database', () => {
  test.use({ storageState: storageStatePath('manager'), allowedErrors: NETWORK_NOISE });

  /** Regression: when the backend is unreachable the Firestore SDK answers a
   *  listener from its (empty) cache, which the app read as "this account has
   *  no profile document" and reported as "waiting on admin approval" — telling
   *  an approved manager to chase an administrator who had nothing to approve.
   *  A connection problem must never be presented as an account problem. */
  test('a rejected profile read never claims the account is pending approval', async ({ page }) => {
    await page.route(FIRESTORE_CHANNEL, (route) =>
      route.fulfill({ status: 403, contentType: 'text/plain', body: 'Forbidden' }),
    );

    await page.goto('/');

    await expect(page.getByLabel('Loading account')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Account pending' })).toHaveCount(0);
    await expect(page.getByText(/waiting for an administrator/i)).toHaveCount(0);

    // Recovering the connection resolves the account without a manual reload.
    await page.unroute(FIRESTORE_CHANNEL);
    await waitForWorkspace(page);
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
  });

  test('a blocked connection holds the loading state instead of crashing', async ({ page }) => {
    await page.route(FIRESTORE_CHANNEL, (route) => route.abort('failed'));

    await page.goto('/');

    // Firestore retries a transport failure rather than reporting it, so the
    // honest observable behaviour is that the app waits — and keeps waiting
    // without throwing or rendering a broken shell.
    await expect(page.getByLabel('Loading account')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Account pending' })).toHaveCount(0);

    await page.unroute(FIRESTORE_CHANNEL);
    await waitForWorkspace(page);
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
  });

  test('going offline mid-session keeps the shell and cached data usable', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForWorkspace(page);
    // Visit Summary once while online so its route chunk is cached; the app is
    // code-split, so a route never loaded cannot be reached offline at all.
    await page.getByRole('link', { name: 'Summary' }).click();
    await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Jobs' }).click();
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();

    await context.setOffline(true);

    // Firestore serves its cache, so the board must not blank out or crash.
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Workspace tabs' })).toBeVisible();
    await page.getByRole('link', { name: 'Summary' }).click();
    await expect(page.getByRole('heading', { name: 'Summary', level: 1 })).toBeVisible();

    await context.setOffline(false);
    await page.getByRole('link', { name: 'Jobs' }).click();
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
  });
});

test.describe('slow responses', () => {
  test.use({ storageState: storageStatePath('manager'), allowedErrors: NETWORK_NOISE });

  test('the jobs board shows its loading state while data is in flight', async ({ page }) => {
    // Delay every Firestore round trip; the account resolves first, then the
    // board sits in its loading state until the jobs snapshot lands. The flag
    // is flipped rather than unrouting, because unrouting while a handler is
    // still sleeping leaves that request unhandled.
    let slow = true;
    await page.route(FIRESTORE_CHANNEL, async (route) => {
      if (slow) await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.goto('/');

    await expect(
      page.getByRole('status').filter({ hasText: 'Loading shared jobs...' }),
    ).toBeVisible();

    slow = false;
    await expect(page.getByText(SEEDED.pendingJob)).toBeVisible();
    await expect(page.getByText('Loading shared jobs...')).toBeHidden();
  });
});
