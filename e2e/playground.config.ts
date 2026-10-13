import { defineConfig } from '@playwright/test';

/** Seeds a running emulator and nothing else — no app server, no browsers.
 *  Used by `npm run playground` (e2e/scripts/playground.mjs). */
export default defineConfig({
  testDir: './tests',
  testMatch: /seed\.setup\.ts/,
  reporter: 'line',
  workers: 1,
});
