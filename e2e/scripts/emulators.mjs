#!/usr/bin/env node
/**
 * Starts the Firebase emulators for the E2E suite and — the reason this
 * wrapper exists — guarantees they are gone afterwards.
 *
 * `firebase emulators:start` runs the Firestore emulator as a detached Java
 * child. When a supervisor (Playwright's webServer, or Ctrl-C) kills the CLI,
 * that Java process survives and keeps port 8080. The next run then finds the
 * port taken, fails to start Auth, and seeds against a half-running suite.
 *
 * So: run the CLI in its own process group, tear the whole group down on any
 * exit signal, and sweep up an orphan from a previous run before starting.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { createConnection } from 'node:net';

const PROJECT = process.env.E2E_FIREBASE_PROJECT ?? 'g3d-pipeline-e2e';
const PORTS = [
  Number(process.env.E2E_AUTH_PORT ?? 9099),
  Number(process.env.E2E_FIRESTORE_PORT ?? 8080),
];

/** Matches only this emulator's jar, never an unrelated Java process. */
const ORPHAN_PATTERN = 'cloud-firestore-emulator';

/** The CLI is an external requirement, like Java — see the README. Without
 *  this check its absence surfaces as `npx` exiting 1 into a log file nobody
 *  reads, and Playwright reporting only that config.webServer would not
 *  start. */
function requireFirebaseCli() {
  const probe = spawnSync('npx', ['--no-install', 'firebase', '--version'], {
    encoding: 'utf8',
  });
  if (probe.status === 0) return;
  console.error(
    [
      '[emulators] the Firebase CLI is not available.',
      '',
      'The E2E suite drives the Firebase Emulator Suite through it. Install it with:',
      '',
      '  npm install -g firebase-tools',
      '',
      'See the Testing section of the README for the full list of requirements.',
    ].join('\n'),
  );
  process.exit(1);
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const settle = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
    socket.setTimeout(1000, () => settle(false));
  });
}

function sweepOrphans() {
  const found = spawnSync('pgrep', ['-f', ORPHAN_PATTERN], { encoding: 'utf8' });
  const pids = (found.stdout ?? '')
    .split('\n')
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  for (const pid of pids) {
    console.log(`[emulators] stopping orphaned Firestore emulator (pid ${pid})`);
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone — nothing to do.
    }
  }
  return pids.length > 0;
}

async function main() {
  // Order matters: probe before sweeping. Sweeping first would SIGTERM a
  // perfectly healthy emulator that another run is using, which shows up in
  // tests as mid-run ERR_CONNECTION_REFUSED rather than as a startup failure.
  const open = [];
  for (const port of PORTS) {
    if (await portOpen(port)) open.push(port);
  }

  if (open.length === PORTS.length) {
    console.log('[emulators] already running, reusing them');
    // Stay alive so a supervisor that owns this process keeps waiting on the
    // emulators it is reusing rather than treating the exit as a crash.
    await new Promise(() => {});
    return;
  }

  if (open.length > 0) {
    // Exactly the orphan signature: Firestore's JVM survived a previous run
    // while the CLI (and Auth with it) went away.
    if (sweepOrphans()) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const stillOpen = [];
    for (const port of PORTS) {
      if (await portOpen(port)) stillOpen.push(port);
    }
    if (stillOpen.length > 0) {
      console.error(
        `[emulators] port(s) ${stillOpen.join(', ')} are in use but the emulator suite is ` +
          `not fully up. Stop whatever holds them and retry.`,
      );
      process.exit(1);
    }
  }

  // The emulator logs a line for every auth operation, and a hundred tests
  // produce a lot of them. Inheriting stdio sends all of it up through
  // Playwright's webServer pipes; once nothing drains those, the writer blocks
  // or takes an EPIPE and this wrapper dies — which Playwright answers by
  // tearing down the *app* server too, leaving every remaining test failing
  // with ERR_CONNECTION_REFUSED. Writing to a file keeps it off the pipe.
  requireFirebaseCli();

  mkdirSync('e2e/.logs', { recursive: true });
  const logFd = openSync('e2e/.logs/emulators.log', 'a');
  console.log('[emulators] starting; output in e2e/.logs/emulators.log');

  const child = spawn(
    'npx',
    ['firebase', 'emulators:start', '--project', PROJECT, '--only', 'auth,firestore'],
    { stdio: ['ignore', logFd, logFd], detached: true },
  );

  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    try {
      // Negative pid: signal the whole group, Java child included.
      process.kill(-child.pid, signal);
    } catch {
      // The group is already gone.
    }
    setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // Nothing left to kill.
      }
      process.exit(0);
    }, 5000).unref();
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => stop(signal));
  }
  process.on('exit', () => stop('SIGTERM'));

  child.on('exit', (code) => process.exit(code ?? 0));
}

void main();
