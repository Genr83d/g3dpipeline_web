import { readFileSync } from 'node:fs';
import type { BrowserContext, Page } from '@playwright/test';

/** Inter, served to the browser from a committed copy of the pinned file.
 *
 *  The app fetches Inter from jsDelivr (see README "Typography"), and the
 *  suite treats a failed font request as a failure rather than noise: Firefox
 *  logs `downloadable font: download failed` as a console error, which the
 *  `pageProblems` fixture turns into a failed test. That guard is worth
 *  keeping, but it made every test in the run depend on a third-party CDN
 *  being fast and reachable — one slow jsDelivr moment failed seven unrelated
 *  tests locally while the same commit was green on CI.
 *
 *  So the request is intercepted and fulfilled from disk. The browser still
 *  *makes* the request, with the pinned URL, so both guards still hold:
 *  smoke.spec.ts asserts on the requested URL, and the fixtures' rsms.me
 *  check watches the same event. Only the exact pinned URL is served locally
 *  — anything else (a bumped version, a different host) is left to the
 *  network, where the existing assertions catch it. */

/** The exact URL src/index.css asks for. Declared here so the stub and
 *  smoke.spec.ts's assertion cannot drift apart; bumping the version is an
 *  edit here, in src/index.css, and a re-download of the file below. */
export const PINNED_INTER_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@5.3.0/latin-wght-normal.woff2';

/** Byte-for-byte the file at PINNED_INTER_URL. Relative to the repo root,
 *  like the storage-state paths — Playwright runs from the config's
 *  directory. */
const INTER_WOFF2 = 'e2e/assets/inter-vf-5.3.0-latin-wght-normal.woff2';

let cached: Buffer | undefined;

function interWoff2(): Buffer {
  if (!cached) {
    try {
      cached = readFileSync(INTER_WOFF2);
    } catch (error) {
      throw new Error(
        `Cannot read ${INTER_WOFF2}, which the E2E suite serves in place of ` +
          `${PINNED_INTER_URL}. Re-download it with:\n` +
          `  curl -o ${INTER_WOFF2} "${PINNED_INTER_URL}"\n` +
          `Cause: ${String(error)}`,
      );
    }
  }
  return cached;
}

/** Fulfils the pinned Inter request from disk for everything in `target`.
 *
 *  Registered on the context rather than the page so a popup or a second page
 *  is covered too.
 *
 *  The URL is passed as a string, not a `(url) => boolean` predicate: a
 *  predicate cannot be pushed down to the browser, so Playwright would have
 *  to pause *every* request in *every* test and ask this process about it.
 *  A literal pattern intercepts only this one URL and leaves the rest of the
 *  suite's traffic untouched. It contains no glob metacharacters, so it
 *  matches exactly and nothing else.
 *
 *  The headers are jsDelivr's own. `Access-Control-Allow-Origin` is required
 *  — the font is cross-origin and fetched in CORS mode, and a fulfilled
 *  response carries no CORS headers of its own. The `immutable` lifetime
 *  matters as much: without it Firefox re-fetches the font on every
 *  navigation, and a test that navigates in a loop cancels one of those
 *  fetches mid-flight, which it logs as `downloadable font: download failed
 *  ... status=2152398850` (NS_BINDING_ABORTED) — the same console error this
 *  stub exists to prevent. A fresh context still fetches it once, so the URL
 *  assertions still see the request. */
export async function serveInterFromDisk(target: BrowserContext | Page): Promise<void> {
  await target.route(
    PINNED_INTER_URL,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'font/woff2',
        headers: {
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=31536000, immutable',
        },
        body: interWoff2(),
      }),
  );
}

/** The one font console error that is not a font problem.
 *
 *  Playwright's request interception bypasses the browser's HTTP cache, so
 *  the stub above is consulted on every navigation rather than once per
 *  context. A test that navigates in a loop (auth.spec walks seven protected
 *  routes) therefore has an in-flight font request to cancel each time, and
 *  Firefox logs a cancelled font fetch as a download failure:
 *
 *    downloadable font: download failed (font-family: "Inter Variable" ...):
 *    status=2152398850 source: <the pinned URL>
 *
 *  2152398850 is 0x804B0002, NS_BINDING_ABORTED — "this request was
 *  cancelled", which is what a navigation does to its document's pending
 *  subresources. It is the same class of noise as the two navigation-aborted
 *  entries already in DEFAULT_ALLOWED_ERRORS, and it is pinned to both that
 *  status code and this exact URL: a font that genuinely fails to load
 *  reports a different status (a CORS failure, a timeout, a 404), and still
 *  fails the test that saw it. */
const NS_BINDING_ABORTED = 2152398850;

export const INTER_ABORTED_BY_NAVIGATION = new RegExp(
  `downloadable font: download failed.*status=${NS_BINDING_ABORTED}.*` +
    PINNED_INTER_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  'i',
);
