#!/usr/bin/env node
/**
 * Wired into firebase.json as a Firestore `predeploy` hook, so it runs before
 * any `firebase deploy` from this repository and stops it.
 *
 * The rules file this repo points the emulator at is deliberately permissive
 * (see e2e/firestore.emulator.rules). Deploying it to a real project would
 * grant every signed-in user full read/write access to production data. The
 * real rules live in, and deploy from, the Flutter repository.
 */
console.error(`
  Refusing to deploy from the web repository.

  firebase.json here exists only to run the Firebase emulators for the E2E
  suite, and it points at e2e/firestore.emulator.rules — an E2E-only ruleset
  that allows any signed-in user full access. Deploying it would open up
  production data.

  Firestore rules for this project are owned by the Flutter repository
  (GENR8-Pipeline / g3d_jobs_list). Deploy them from there.
`);
process.exit(1);
