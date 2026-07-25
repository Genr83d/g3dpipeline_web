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
| `npm run dev` | Vite dev server |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run preview` | serve the production build locally |

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
- **Repair processes** — a repair job stores a `repairProcesses` array of
  `{ name, progress }` steps (for example Cleaning, Welding, Machining,
  Spraying), each tracking its own 0–100 percentage. The card shows a bar per
  process with their rounded average; a collaborator, manager, or admin can
  update them while the job is pending or started. Completing a job sets every
  process to 100%, restoring one resets them to 0% and keeps the names, and
  every other category stores an empty array.
- **Tabs** — Jobs (live board with sorting and overdue flags), Summary
  (live stats plus the most urgent jobs), Archive (completed, newest first,
  with restore).
- **Settings** — profile, personal info (self-updatable fields), security
  (change password / reset email), appearance (light/dark/system theme,
  high contrast, reduced motion, text size — persisted to localStorage),
  and admin-only user management.

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
```
