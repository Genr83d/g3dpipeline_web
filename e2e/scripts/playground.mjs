#!/usr/bin/env node
/**
 * A local copy of the app you can click through by hand, safe to break.
 *
 * Starts the Firebase emulators enforcing the PRODUCTION Firestore rules (from
 * the Flutter repository), seeds the same fixture world the E2E suite uses,
 * then serves the app on http://127.0.0.1:5175 against them. Nothing here can
 * reach the real project: the app only talks to an emulator when
 * VITE_FIREBASE_EMULATORS is "true", which .env.e2e sets.
 *
 * Ctrl-C stops everything.
 *
 *   npm run playground
 *   E2E_REAL_RULES_PATH=/path/to/firestore.rules npm run playground
 */
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';

const AUTH_PORT = Number(process.env.E2E_AUTH_PORT ?? 9099);
const APP_PORT = Number(process.env.PLAYGROUND_PORT ?? 5175);

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

async function waitForPort(port, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  if (await portOpen(AUTH_PORT)) {
    console.error(
      `[playground] port ${AUTH_PORT} is already in use. Stop any running emulators first ` +
        '(a leftover one would be using the permissive test rules, not the production ones).',
    );
    process.exit(1);
  }

  // The wrapper owns the emulator's process group and tears it down on exit.
  const emulators = spawn('node', ['e2e/scripts/emulators.mjs'], {
    env: { ...process.env, E2E_REAL_RULES: '1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  emulators.on('exit', (code) => {
    console.error(`[playground] the emulators stopped (code ${code ?? 'unknown'})`);
    process.exit(code ?? 1);
  });

  let app = null;
  const stop = () => {
    app?.kill('SIGTERM');
    emulators.kill('SIGTERM');
    setTimeout(() => process.exit(0), 6000).unref();
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);

  if (!(await waitForPort(AUTH_PORT, 120_000))) {
    console.error('[playground] the emulators did not start; see e2e/.logs/emulators.log');
    stop();
    return;
  }
  // Firestore opens first, but give Auth a moment so the seed never races it.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log('[playground] seeding test data...');
  const seed = spawnSync('npx', ['playwright', 'test', '-c', 'e2e/playground.config.ts'], {
    stdio: 'inherit',
  });
  if (seed.status !== 0) {
    console.error('[playground] seeding failed');
    stop();
    return;
  }

  console.log(
    [
      '',
      `[playground] ready: http://127.0.0.1:${APP_PORT}`,
      '[playground] production Firestore rules are being enforced',
      '[playground] password for every account: e2e-Passw0rd!',
      '  admin@e2e.test     Ada Admin       admin',
      '  manager@e2e.test   Morgan Manager  manager',
      '  staff@e2e.test     Sam Staff       staff',
      '  staff2@e2e.test    Sasha Second    staff',
      '  awf@e2e.test       Avery Awf       awf (no machine access)',
      '',
    ].join('\n'),
  );

  app = spawn('npx', ['vite', '--mode', 'e2e', '--host', '127.0.0.1', '--port', String(APP_PORT), '--strictPort'], {
    stdio: 'inherit',
  });
  app.on('exit', stop);
}

void main();
