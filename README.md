# GENR8 Pipeline — Web client

React 19 + TypeScript + Vite + Tailwind web client for the GENR8 3D print
shop's job pipeline. It connects to the **existing** Firebase project used by
the Flutter app (Email/Password Auth + Cloud Firestore) — no backend of its
own, no Cloud Functions, and every write matches the exact field sets the
Firestore security rules require.

## Setup

```bash
npm install
cp .env.example .env.local   # paste your Firebase web-app config values
npm run dev
```

The six `VITE_FIREBASE_*` values come from the Firebase Console
(Project settings → Your apps → Web app).

## Scripts

| command | what it does |
| --- | --- |
| `npm run dev` | Vite dev server against the real Firebase project |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run typecheck` | typecheck the app **and** the E2E suite |
| `npm test` | unit + component tests (Vitest, jsdom) |
| `npm run test:watch` | the same, in watch mode |
| `npm run test:e2e` | full Playwright suite (starts emulators + app for you) |
| `npm run test:e2e:ui` | Playwright's interactive UI mode |
| `npm run test:e2e:headed` | run with visible browser windows |
| `npm run test:e2e:debug` | step through a test in the inspector |
| `npm run test:e2e:chromium` | one engine (`:firefox`, `:webkit` likewise) |
| `npm run test:e2e:responsive` | tablet + phone viewport suites |
| `npm run test:e2e:visual` | screenshot comparisons |
| `npm run test:e2e:update-snapshots` | accept new screenshot baselines |
| `npm run test:e2e:report` | open the last HTML report |
| `npm run emulators` | start the Firebase emulators on their own |

## Brand assets

The supplied GENR8 artwork is preserved at `public/brand/g3d-logo.png`. Product
surfaces use a tightly cropped derivative through the shared `BrandMark`
component; browser, Apple touch, and installable-app icons are generated from
the same source so the identity stays consistent.

## How it works

- **Auth** — sign up / sign in / forgot password via Firebase Auth. New
  accounts are written to `users/{uid}` as pending staff; the AuthGate shows
  a "pending approval" screen until an admin activates them, and an
  "account inactive" screen for disabled/removed accounts. All live via
  `onSnapshot` — approval flips the screen with no refresh.
- **Jobs** — one live pipeline (`jobs` collection). Anyone active can create
  and claim jobs; claiming runs in a Firestore transaction so two people
  can't start the same job. Only the claimer can complete it. Managers and
  admins can edit and restore; only admins can delete. The UI hides any
  action the rules would reject.
- **Order numbers** — every job carries a permanent `orderNumber` such as
  `G3D-ABC123XY`, derived from the first eight characters of its document ID
  when the job is created and never rewritten by a later update. Jobs written
  before the field existed derive the same number at read time, so no
  migration is needed.
- **Job sections** — every job, whatever its category, is broken into
  sections stored in the `repairProcesses` array as
  `{ name, progress, collaboratorUid? }`. Repair jobs label them "repair
  processes" (Cleaning, Welding, …); everything else calls them "job sections"
  (Design, Routing, Metalworking). Each section tracks its own 0–100
  percentage and belongs to one collaborator on the job; one collaborator may
  own several. The card shows a bar per section with their rounded average.
  Managers and admins may move any section; a collaborator may move only the
  sections assigned to them, enforced in `jobService` as well as in the UI.
  Completing a job sets every section to 100%; restoring one resets them to 0%
  and unassigns them along with the team. Sections written before ownership
  existed read `collaboratorUid` as `''`.
- **Tabs** — Jobs (live board with sorting and overdue flags), Summary
  (live stats plus the most urgent jobs), Archive (completed, newest first,
  with restore).
- **Settings** — profile, personal info (self-updatable fields), security
  (change password / reset email), appearance (light/dark/system theme,
  high contrast, reduced motion, text size — persisted to localStorage),
  and admin-only user management.

## Testing

Two layers, both runnable from a clean `npm install`:

**Unit and component tests** (`npm test`) — Vitest + Testing Library over the
pure logic and the React components, with Firestore mocked. Fast, and where
most edge cases live.

**End-to-end tests** (`npm run test:e2e`) — Playwright drives the real
application against the **Firebase Emulator Suite**, across Chromium, Firefox,
and WebKit, plus tablet and phone viewports. `npm run test:e2e` starts
everything it needs (emulators, a production build, a preview server), seeds a
fixed set of accounts and records, and tears the emulators down afterwards.

Requirements beyond `npm install`:

- **Java 17+** — the Firestore emulator runs on the JVM.
- **Playwright browsers** — `npx playwright install --with-deps`. The
  `--with-deps` part matters: WebKit needs system libraries (on Ubuntu,
  `libevent-2.1-7t64` and `libgstreamer-plugins-bad1.0-0`) and will not launch
  without them. On a machine where you cannot install them, run with
  `E2E_SKIP_WEBKIT=1` and say so in your PR rather than reporting a green run.

### How the E2E environment is kept safe

- The app only talks to an emulator when `VITE_FIREBASE_EMULATORS=true`, which
  is set exclusively in `.env.e2e`. An unset flag behaves exactly like
  production, so no ordinary build can be pointed at a test backend by
  accident.
- `.env.e2e` holds placeholder credentials only; the E2E project id
  (`g3d-pipeline-e2e`) does not exist in Firebase.
- Seeding refuses to run unless both emulators answer on localhost **and** the
  project id looks like a test id, so a misconfigured run aborts before its
  first delete rather than wiping real data.
- Tests create records with unique names and delete exactly those records
  afterwards. Nothing sweeps by name prefix, because cleanup hooks run per
  worker and a prefix sweep would delete another worker's in-flight data.
- `firebase.json` exists here only to run the emulators. A `predeploy` hook
  aborts any `firebase deploy` from this repository, so the permissive
  emulator ruleset can never reach a real project.

### What the E2E suite does not cover

- **Firestore security rules.** Production rules are owned and deployed by the
  Flutter repository (`GENR8-Pipeline / g3d_jobs_list`) and are deliberately not
  duplicated here. The emulator runs `e2e/firestore.emulator.rules`, which
  allows any signed-in user, so the suite verifies the app's own routing, role
  gating, and service-layer enforcement — not the deployed ruleset. A
  regression that only the real rules would reject will not be caught here.
- **Real devices and real browsers.** "All browsers" means the three engines
  Playwright ships. Safari on an actual iPhone, or Chrome on an actual Android
  device, is still its own test pass.
- **Email delivery.** Password-reset emails are captured by the Auth emulator
  and never sent, so the suite asserts the app's confirmation, not the mail.
- **Visual baselines** are machine-specific. The app resolves `Inter` /
  `G3DSans` from the system rather than bundling them, so a machine with a
  different font set renders differently. The committed baselines come from
  Linux + Chromium, and for that reason the `visual` project is **not** part of
  CI — run `npm run test:e2e:visual` locally, and
  `npm run test:e2e:update-snapshots` when a visual change is intended.

### What is covered

- **Smoke** — every route a signed-in user can reach renders real content.
- **Authentication** — sign in/out/up, invalid credentials, required fields,
  forgot password, pending and disabled accounts, session persistence across
  reloads and tabs, a cleared session, and protected-route redirects.
- **Role gating** — AWF's reduced tab set, admin-only user management, and the
  controls staff never see.
- **Jobs** — the create → read → update → delete lifecycle, confirmation
  dialogs and their cancel paths, form validation and quantity boundaries,
  filters, sorting, and per-type empty states.
- **Job sections** — reading them on a card, assigning every section to a
  collaborator, unassigning a removed collaborator, and who may move which
  section's progress.
- **Inventory and maintenance** — CRUD, search and its empty state, the
  low-stock threshold, procedure checklists, and the maintenance log.
- **Settings** — personal information, appearance persistence, password
  validation, and the admin user-management actions.
- **Network behaviour** — 403/500 and dropped requests on sign-in, an
  unreachable database, going offline mid-session, and the loading state.
- **Accessibility and keyboard** — landmarks, accessible names, label
  associations, dialog semantics, and mouse-free flows.
- **User journeys** — a manager and a member of staff working the same job
  through to completion and restore, in two live sessions.
- **Responsive** — layout, navigation, dialogs, and touch targets on tablet
  and phone.

The app has no file uploads, downloads, clipboard use, tables, or pagination,
so there is nothing for the suite to cover there.

### Layout

```
e2e/
  tests/                 specs, grouped by area (auth, jobs, journeys, …)
    responsive/          viewport-sensitive specs (tablet + phone projects)
    visual/              screenshot baselines (Chromium only)
  support/               fixtures, emulator REST client, seed data, cleanup
  scripts/emulators.mjs  emulator lifecycle wrapper used by Playwright
  firestore.emulator.rules
```

## Structure

```
src/
  lib/firebase.ts        Firebase init from env
  services/              authService, jobService (exact rule-safe writes), userService
  context/               AuthProvider, AppearanceProvider
  hooks/                 useJobs, useUsers
  routes/                AuthGate, Workspace shell
  pages/                 auth screens, Jobs/Summary/Archive, settings/*
  components/            JobCard, JobForm, StatusPill, StatCard, Modal, Toast, …
  types.ts               Job / AppUser types + tolerant Firestore parsing
  test/                  Vitest unit and component tests
```
