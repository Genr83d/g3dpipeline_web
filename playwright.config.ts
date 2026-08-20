import { defineConfig, devices, type Project } from '@playwright/test';

/** The E2E app runs on its own port so a running `npm run dev` (5173) is never
 *  mistaken for the emulator-backed build. */
const PORT = Number(process.env.E2E_PORT ?? 5174);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);

/** WebKit needs two system libraries that `npx playwright install --with-deps`
 *  installs. Set E2E_SKIP_WEBKIT=1 on a host where they are missing and cannot
 *  be installed; CI always runs the full set. */
const skipWebKit = process.env.E2E_SKIP_WEBKIT === '1';

const desktopProjects: Project[] = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
  },
  ...(skipWebKit
    ? []
    : [{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } }]),
];

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/.artifacts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',

  // Files run in parallel; the seeded records every test keys off are never
  // mutated, and record-creating tests use uniqueName().
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Two workers, everywhere. All of them share one Firestore emulator, and
  // past two concurrent browser contexts its first-sync latency (WebKit worst)
  // grows past any sensible assertion timeout.
  //
  // Override with E2E_WORKERS on a memory-constrained machine: two WebKit
  // workers plus the emulator's JVM is enough to get the run OOM-killed, which
  // surfaces as processes vanishing mid-run rather than as a test failure.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  timeout: 60_000,
  // Covers the first assertion after a cold navigation, which waits on that
  // first sync. Later assertions in a warm page resolve immediately.
  expect: { timeout: 20_000 },

  reporter: isCI
    ? [['html', { outputFolder: 'e2e/.report', open: 'never' }], ['github'], ['list']]
    : [['html', { outputFolder: 'e2e/.report', open: 'never' }], ['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    // Makes framer-motion resolve instantly through the app's own
    // motionReduced path, so assertions never wait on a spring. It belongs
    // under contextOptions — set directly on `use` it is silently ignored.
    contextOptions: { reducedMotion: 'reduce' },
  },

  projects: [
    // Wipes and rebuilds the emulator fixture world. Runs as a project (not
    // globalSetup) because globalSetup fires before the webServer entries.
    { name: 'seed', testMatch: /seed\.setup\.ts/ },

    // Signs in once per role and saves the storage state the suites reuse.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['seed'],
    },

    ...desktopProjects.map((project) => ({
      ...project,
      testIgnore: [/responsive\//, /visual\//],
      dependencies: ['setup'],
    })),

    // Layout-sensitive flows only, so viewports do not multiply the whole suite.
    {
      name: 'tablet',
      testMatch: /responsive\//,
      use: { ...devices['iPad (gen 7)'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      testMatch: /responsive\//,
      use: { ...devices['iPhone 14'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      testMatch: /responsive\//,
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
    },

    // Snapshots are rendering-sensitive, so one engine owns them.
    {
      name: 'visual',
      testMatch: /visual\//,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      // Wrapper, not the CLI directly: it tears down the detached Firestore
      // JVM that would otherwise keep port 8080 after the run.
      command: 'node e2e/scripts/emulators.mjs',
      // Probe Auth, not Firestore: Firestore opens its port first, so waiting
      // on 8080 lets seeding start against a half-ready emulator.
      url: 'http://127.0.0.1:9099/',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // The built bundle, not the dev server: Vite compiles routes on demand,
      // and a cold chunk can outlast an action timeout when several workers
      // navigate at once. Building first also means the suite exercises what
      // actually ships. `npm run dev:e2e` remains for interactive debugging.
      //
      // Served by e2e/scripts/serve.mjs rather than `vite preview`, which did
      // not survive a full WebKit run — and Playwright hangs on a webServer
      // that dies rather than failing the run.
      command: 'npm run build:e2e && npm run preview:e2e',
      url: baseURL,
      // Never reuse: a preview server left over from an earlier run serves the
      // bundle built from the *old* source, so a suite could pass against code
      // that no longer exists. Rebuilding costs a couple of seconds.
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
