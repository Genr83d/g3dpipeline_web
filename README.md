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

## Typography

Inter is loaded from **Fontsource via jsDelivr**, declared as an `@font-face`
in `src/index.css` and pinned to an exact version:

```
https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@5.3.0/latin-wght-normal.woff2
```

Worth knowing:

- **The version is pinned on purpose.** A floating tag would let the
  typography — and every visual baseline — change without a commit. Bumping it
  is a deliberate edit plus `npm run test:e2e:update-snapshots`.
- **It is the variable font**, so weights 100–900 come from that one file. The
  app uses no italics, so only the normal style is fetched.
- **The `@font-face` is declared locally** rather than importing Fontsource's
  remote stylesheet: one external request instead of two, and the declaration
  stays under our control.
- **System fonts are fallbacks only.** `system-ui`, `-apple-system`,
  `BlinkMacSystemFont`, `Segoe UI` and the generic `sans-serif` are what the
  browser uses while Inter loads, or if it never arrives.
- **Internet access is required for Inter itself.** If jsDelivr is unreachable
  the app renders in the fallback stack — different letterforms, everything
  still legible and functional. `font-display: swap` means text is never
  invisible while waiting.
- The app has **no Content Security Policy** today (`vercel.json` only carries
  SPA rewrites). If one is added later it needs `font-src` to include
  `https://cdn.jsdelivr.net`; no `style-src` entry is needed, because no remote
  stylesheet is loaded.

The E2E suite guards this: a request to the previously used `rsms.me` fails a
test, a failed font request fails a test, and `smoke.spec.ts` asserts the
pinned Fontsource URL is the one actually fetched.

The suite does not fetch it from jsDelivr, though. `e2e/support/fonts.ts`
intercepts that one exact URL and answers it with
`e2e/assets/inter-vf-5.3.0-latin-wght-normal.woff2`, a byte-for-byte copy of
the pinned file. The browser still *makes* the request, so all three guards
above still see it; what goes away is the CDN's ability to fail a run — a slow
jsDelivr used to fail every test in the run at once, because Firefox logs
`downloadable font: download failed` as a console error. Only the pinned URL
is served locally, so a bumped version or a different host is still fetched
for real and still fails. **Bumping the version means three edits**:
`src/index.css`, `PINNED_INTER_URL` in `e2e/support/fonts.ts`, and a
re-download of the committed `.woff2` (the file name carries the version),
followed by `npm run test:e2e:update-snapshots`.

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
- **Job tags and stock** — a job carries a `tags` array chosen from a closed
  list (`src/lib/jobTags.ts`), and tags are what drive inventory deduction.
  Completing a job tagged `pins` takes one **Pin Backs** per unit, plus one
  **Lamina** each time the shop's running completed pin total crosses a
  multiple of 50 — 58 pins take one sheet, a later 42 take the next. Every
  material is read and checked before any is written, inside the same
  transaction that completes the job, so a job short of one material spends
  none of the others and stays In Progress with the reason on screen. If a
  material named in a rule is missing from `inventory`, completion refuses and
  names it. Materials are matched on their name, trimmed and case-insensitive.
  Adding a tag, or changing what one consumes, is an edit to `jobTags.ts`
  alone.

  Restoring a completed job returns what its completion consumed, so a job that
  is restored and completed again is paid for once rather than twice. The
  refund is recomputed from the same rule table rather than recorded on the
  job, which keeps the books true to "one Lamina per 50 pins completed" however
  many other jobs were completed in between, and keeps the stored document free
  of a field the security rules would have to learn. A restore that cannot
  return everything — because a material was deleted from `inventory` — refuses
  and names it, leaving the job completed rather than half-corrected.

  This used to key off a regex over the job *name*, which is why a job called
  "Pinbacks" or "100pins" completed cleanly and moved no stock at all, with no
  error anywhere. Documents that have no `tags` field — written before this
  existed, or by a client that has not adopted it yet — still fall back to that
  name match, so their completions behave as they always did and their history
  still counts toward the next Lamina sheet. A document that *has* a `tags`
  array is taken at its word, empty included: unticking every tag is how
  someone turns a deduction off, and it beats whatever the job is called.
  Saving a job through this app always writes the array, so each save retires
  one more document from the fallback.
- **Tabs** — Jobs (live board with sorting and overdue flags), Summary
  (live stats plus the most urgent jobs), Archive (completed, newest first,
  filtered by completion month, with restore).
- **Archive months** — the archive filters by the month a job was *completed*,
  read from `completedAt` in the reader's own timezone, never from its
  deadline: a job due in August and shipped in September files under
  September. The dropdown lists only months that hold completed jobs, newest
  first, labelled with the full month and year so two Septembers a year apart
  stay apart. Completed jobs with no `completedAt` — records written before
  the field existed — gather under "Unknown month" and, under "All months",
  sort last by deadline. The list is live: a month appears as soon as a job
  completes into it, and selecting a month that later empties (a restore, a
  delete) falls back to All months on its own.
- **Settings** — profile, personal info (self-updatable fields), security
  (change password / reset email), appearance (light/dark/system theme,
  high contrast, reduced motion, text size — persisted to localStorage),
  and admin-only user management.

## Testing

Unit tests run from a clean `npm install`. The E2E suite needs the three
external tools listed under *Requirements beyond `npm install`* below.

**Unit and component tests** (`npm test`) — Vitest + Testing Library over the
pure logic and the React components, with Firestore mocked. Fast, and where
most edge cases live.

**End-to-end tests** (`npm run test:e2e`) — Playwright drives the real
application against the **Firebase Emulator Suite**, across Chromium, Firefox,
and WebKit, plus tablet and phone viewports. `npm run test:e2e` starts
everything it needs (emulators, a production build, a preview server), seeds a
fixed set of accounts and records, and tears the emulators down afterwards.

WebKit is the heaviest engine here. If processes disappear mid-run (Playwright
reporting `Killed`, or the app server vanishing), the machine is out of memory —
run it with `E2E_WORKERS=1 npm run test:e2e:webkit`.

If a run appears to stop making progress, check that the preview server on
:5174 is still up (`curl -sI http://127.0.0.1:5174/`). Playwright waits on its
webServer rather than failing when one dies mid-run, so a dead app server looks
exactly like a very slow test.

Run **one project at a time** — `npm run test:e2e:chromium`, then `:firefox`,
then `:webkit`, then `:responsive`. All projects share a single Firestore
emulator, and running every engine at once saturates it: listeners take longer
to deliver their first snapshot than any sensible timeout allows, and tests
fail on a slow emulator rather than on the change under review. CI does the
same thing, one engine per job. `npm run test:e2e` with no arguments runs
everything and is best kept for a machine with cores to spare.

Requirements beyond `npm install`:

- **The Firebase CLI** — `npm install -g firebase-tools`. The suite drives the
  Emulator Suite through it; `npm run emulators` stops with an explanation if
  it is missing.
- **Java 21+** — the Firestore emulator runs on the JVM, and the Firebase
  CLI refuses to start it on anything older.
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
- **Visual baselines** are still machine-specific. Inter itself is pinned (see
  Typography), but the rest of the stack — the display face, the fallbacks, and
  the platform's rasterisation — is not, so a different OS renders differently.
  The committed baselines come from Linux + Chromium, and for that reason the
  `visual` project is **not** part of CI. Run `npm run test:e2e:visual` locally,
  and `npm run test:e2e:update-snapshots` when a visual change is intended.

### What is covered

- **Smoke** — every route a signed-in user can reach renders real content.
- **Authentication** — sign in/out/up, invalid credentials, required fields,
  forgot password, pending and disabled accounts, session persistence across
  reloads and tabs, a cleared session, and protected-route redirects.
- **Role gating** — AWF's reduced tab set, admin-only user management, and the
  controls staff never see.
- **Jobs** — the create → read → update → delete lifecycle, confirmation
  dialogs and their cancel paths, form validation and quantity boundaries,
  filters, sorting, per-type empty states, and choosing a tag on the form and
  seeing it on the card. The stock *deduction* a tag triggers is covered by
  unit tests instead: it moves one shared "Pin Backs" document, which two
  parallel workers cannot safely touch at once.
- **Archive** — the completion-month filter: which months it offers and in
  what order, a job filed by its completion rather than its deadline, two
  Septembers a year apart kept separate, undated completions under "Unknown
  month", pending and in-progress work never appearing, and the fallback to
  All months when the month in view is emptied by a restore.
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
