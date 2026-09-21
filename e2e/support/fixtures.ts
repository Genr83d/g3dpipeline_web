import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { INTER_ABORTED_BY_NAVIGATION, serveInterFromDisk } from './fonts';

/** Where the sign-in setup project parks each role's storage state. */
export function storageStatePath(role: string): string {
  return `e2e/.auth/${role}.json`;
}

/** The app auto-starts its onboarding tour 650ms after a profile loads, and
 *  the tour's spotlight overlay swallows clicks. Rather than racing it, tests
 *  make the stored "already finished" answer the default for every tour key.
 *  A real value written later (by the app, or by the onboarding test) still
 *  wins, so this hides nothing that a test actually asserts on. */
const SUPPRESS_ONBOARDING = () => {
  // Patch the prototype, not the instance: a Storage object treats instance
  // property assignment as a storage write in WebKit, so `storage.getItem = fn`
  // silently stored a value called "getItem" there and left the tour running.
  const nativeGetItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function patchedGetItem(this: Storage, key: string) {
    const stored = nativeGetItem.call(this, key);
    if (stored === null && key.startsWith('g3d-onboarding:')) {
      return JSON.stringify({ step: 0, complete: true });
    }
    return stored;
  };
};

/** Console noise that is understood and harmless.
 *
 *  Anything not listed here fails the test that produced it, including
 *  uncaught exceptions and unhandled rejections. Each entry below names a
 *  specific emulator-only URL or SDK prefix, so an equivalent message from
 *  production code still fails. Tests that provoke a failure on purpose add
 *  their own pattern with `test.use({ allowedErrors })`. */
const DEFAULT_ALLOWED_ERRORS: RegExp[] = [
  // The Firestore SDK logs its own reconnect chatter whenever a listener is
  // torn down mid-flight (navigation, sign-out); it is not an app failure and
  // the UI it produces is asserted directly where it matters.
  /@firebase\/firestore:/i,
  // WebKit reports an aborted cross-origin request to the emulator's streaming
  // channel this way when a page navigates away mid-poll. Scoped to that one
  // URL so a genuine app error still fails the test.
  /google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel.*access control checks/i,
  // Firefox logs the Auth emulator's token-lookup call as a CORS failure when
  // it is cut short by a navigation. Pinned to the emulator's own host and
  // port, so the same message from a production endpoint would still fail.
  /Cross-Origin Request Blocked.*127\.0\.0\.1:9099/i,
  // Firefox logs a font fetch that a navigation cancelled as a download
  // failure. Pinned to NS_BINDING_ABORTED and to the pinned font URL, so a
  // font that genuinely fails to load still fails the test — see
  // e2e/support/fonts.ts, which explains why the request is repeated at all.
  INTER_ABORTED_BY_NAVIGATION,
];

/** The font host this app deliberately no longer uses. */
const RETIRED_FONT_HOST = /rsms\.me/i;

export interface AppFixtures {
  /** One pattern of console-error noise this test tolerates, e.g. the 4xx a
   *  rejected-credentials test provokes on purpose. Use alternation for
   *  several: `/(a|b)/`. A single pattern (rather than an array) keeps
   *  `test.use()` unambiguous — Playwright reads a two-element array there as
   *  its own [value, options] tuple. */
  allowedErrors: RegExp | null;
  /** Set false in the onboarding test, which needs the real tour to start. */
  suppressOnboarding: boolean;
  /** Everything the page logged as an error, plus uncaught exceptions. */
  pageProblems: string[];
}

export const test = base.extend<AppFixtures>({
  allowedErrors: [null, { option: true }],
  suppressOnboarding: [true, { option: true }],

  // `auto` so every test gets the guard without asking for the fixture, which
  // also keeps `page` out of a dependency cycle.
  pageProblems: [
    async ({ page, suppressOnboarding, allowedErrors }, use, testInfo) => {
      const problems: string[] = [];
      if (suppressOnboarding) await page.addInitScript(SUPPRESS_ONBOARDING);

      // Inter comes from the committed copy rather than jsDelivr. The request
      // is still made with the pinned URL, so the guards below and in
      // smoke.spec.ts are unchanged; what goes away is a whole run's worth of
      // tests failing because a CDN was slow. See e2e/support/fonts.ts.
      await serveInterFromDisk(page.context());

      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        problems.push(`console.error: ${message.text()}`);
      });

      // The app used to pull Inter from rsms.me, which failed CORS and left the
      // page on fallback fonts. Inter now comes from a pinned Fontsource build
      // on jsDelivr, so any request back to the old host means the change was
      // partly reverted — that is a failure, not noise to tolerate.
      page.on('request', (request) => {
        if (RETIRED_FONT_HOST.test(request.url())) {
          problems.push(`retired font host requested: ${request.url()}`);
        }
      });

      await use(problems);

      // A React crash or an unhandled rejection is a genuine defect even when
      // the assertions above happened to pass, so it fails the test here.
      const allow = allowedErrors
        ? [...DEFAULT_ALLOWED_ERRORS, allowedErrors]
        : DEFAULT_ALLOWED_ERRORS;
      const unexpected = problems.filter(
        (problem) => !allow.some((pattern) => pattern.test(problem)),
      );
      if (unexpected.length > 0 && testInfo.status === testInfo.expectedStatus) {
        throw new Error(
          `Unexpected browser errors during "${testInfo.title}":\n  ${unexpected.join('\n  ')}`,
        );
      }
    },
    { auto: true },
  ],
});

export { expect };

/** A context for a second (or third) signed-in user in the same test, with the
 *  same onboarding suppression the `page` fixture applies. Journeys that model
 *  two people working the same job need this; `browser.newContext()` on its
 *  own would let the tour overlay reappear and swallow clicks. */
export async function newAppContext(
  browser: Browser,
  role: string | null,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    storageState: role ? storageStatePath(role) : { cookies: [], origins: [] },
    // Matches the config's contextOptions; a hand-built context does not
    // inherit them.
    reducedMotion: 'reduce',
  });
  await context.addInitScript(SUPPRESS_ONBOARDING);
  await serveInterFromDisk(context);
  return context;
}

/** Resolves once the signed-in shell is on screen and its first data load has
 *  settled — the app's own "ready" signal, so no test needs a sleep.
 *
 *  The generous timeout is deliberate and specific: this waits on the first
 *  Firestore sync of a brand-new browser context, and several WebKit contexts
 *  opening listeners against one emulator are measurably slower than the
 *  default action timeout allows. Every later assertion keeps the normal
 *  timeout, so a genuinely slow app still fails the suite. */
export async function waitForWorkspace(page: Page, timeout = 30_000): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Workspace tabs' })).toBeVisible({ timeout });
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading shared jobs...' }),
  ).toBeHidden({ timeout });
}

/** Opens the account menu and signs out. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
}

/** The card for one job, located by its visible name. */
export function jobCard(page: Page, name: string) {
  return page.locator('[data-tour="job-card"]').filter({ hasText: name });
}
