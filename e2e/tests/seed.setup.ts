import { test as setup } from '@playwright/test';
import { assertEmulatorsReachable, E2E_PROJECT_ID } from '../support/emulator';
import { seedEmulators } from '../support/seed';

/** Wipes and rebuilds the emulator fixture world once per run.
 *
 *  This is a setup *project* rather than globalSetup because Playwright starts
 *  globalSetup before the webServer entries, and the emulator it needs is one
 *  of those servers.
 *
 *  The guard below is the environment safety net required before anything
 *  destructive happens: this only ever runs against emulators on localhost,
 *  targeting a test-only project id that does not exist in Firebase. If either
 *  check fails, the run aborts before the first delete. */
setup('seed the emulator fixture world', async () => {
  if (!/e2e|test|demo|local/i.test(E2E_PROJECT_ID)) {
    throw new Error(
      `Refusing to seed project "${E2E_PROJECT_ID}": the E2E project id must be ` +
        `an obviously non-production id. Nothing was modified.`,
    );
  }

  await assertEmulatorsReachable();
  await seedEmulators();
});
