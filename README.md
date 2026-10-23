# ClubStack

One place for every school club. ClubStack replaces the tangle of Remind, Discord, Slack,
GroupMe, and Band links with a searchable club directory, club pages, announcements, and a shared
calendar — backed by Firebase Authentication and Cloud Firestore.

> **Backend:** ClubStack is wired to the `clubstackapp2` Firebase project — Authentication for
> sign-in and Cloud Firestore for data. The browser config lives in `src/lib/firebaseConfig.ts`;
> publish `firestore.rules` before using it (step 3 below). To explore the app offline instead, set
> `VITE_DEMO_MODE=true` in `.env.local`.

## What's included

**Students**
- Searchable club directory with categories, meeting details, announcements, and upcoming events
- Join or leave approved clubs and see joined clubs from the dashboard and sidebar
- View club-specific meeting calendars and list agendas
- Receive and accept or decline student-officer invitations

**Club leaders and officers**
- Submit club proposals for administrator review
- Edit club information from a dedicated settings page
- Invite existing club members to officer roles; invitees must accept before permissions are granted
- Post announcements and add or remove meetings and events

**Teachers / advisors**
- Review and accept or decline requests to sponsor a club
- Use a dedicated home dashboard, calendar, My Clubs page, and report history
- Edit clubs they advise after accepting sponsorship and report concerns

**Admins**
- View platform statistics, recent submissions, upcoming meetings, and open reports
- Search the user directory and manage student, teacher, and admin roles
- Browse active clubs, review proposals in a separate queue, and approve or reject them
- View all club events on a color-coded calendar and review reports from students and teachers

**Platform**
- Firebase Authentication (email/password + Google)
- Firestore Security Rules enforce roles, club management, and invitation acceptance
- Responsive layout with role-specific navigation and club-specific overview, settings, and meeting pages
- Accessible forms, empty states, loading states, and toast feedback

Out of scope for this MVP (intentionally): direct messaging, external platform integrations,
push notifications, and image uploads.
---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app uses the `clubstackapp2` Firebase project by default: create an
account with email or Google, then promote yourself to admin (step 4 below).

### Demo accounts

Demo mode is opt-in. Start the server with `VITE_DEMO_MODE=true` in `.env.local` to use the sample
data below instead of Firebase.

Click any account on the sign-in screen, or use the demo role switcher in the sidebar.

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Student | Ava Chen | `ava@student.northgate.edu` | `clubstack` |
| Club leader | Marcus Reed | `marcus@student.northgate.edu` | `clubstack` |
| Admin | Dr. Elena Diaz | `ediaz@northgate.edu` | `clubstack` |

Demo data is stored in `localStorage` under `clubstack.demo.v1`. It is created with meetings dated
relative to today and reseeded automatically after two weeks. Clear the key (or site data) to reset.
Sign-ups in demo mode create a local student account.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on `0.0.0.0:3000` |
| `npm run build` | Typecheck and produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript project build without emitting |
| `npm test` | Vitest unit tests (filtering, date helpers) |

---

## Firebase setup

### 1. Enable services in the Firebase console

The `clubstackapp2` project exists and its web config is committed, so the app already points at
it. In [console.firebase.google.com](https://console.firebase.google.com) confirm that:

1. **Authentication → Get started → Sign-in method**
   - **Email/Password** is enabled (already verified for this project).
   - **Google** is still disabled; enable it (with a support email) before using the
     “Continue with Google” button. Until then that button returns a “sign-in method not enabled”
     message.
2. **Firestore Database** exists (already verified for this project)
   - Production mode and a region near your school are recommended; rules are published in step 3.

For a different project, register a Web (`</>`) app under **Project settings → General → Your apps**
and update `src/lib/firebaseConfig.ts` (or set the env overrides below).

### 2. Configuration

`src/lib/firebaseConfig.ts` holds the web config for `clubstackapp2`, so there is nothing to fill in
to run locally. Env vars are optional overrides for pointing a build at another project: copy
`.env.example` to `.env.local` (git-ignored) and values there take precedence over the defaults.

| `.env.local` variable | Firebase config field |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `measurementId` (unused until Analytics is added) |

These identifiers are public client configuration, not secrets. Access is controlled by Firebase
Security Rules, so never add a service account key or admin SDK credential to this app. Optionally
restrict the API key to your domains in **Google Cloud console → APIs & Services → Credentials**.

Restart the dev server after editing `.env.local`. To force demo mode while Firebase is configured,
set `VITE_DEMO_MODE=true`.

### 3. Deploy the security rules

Rules must be published before the app can read or write data. `.firebaserc` pins the CLI to
`clubstackapp2`. Either paste [`firestore.rules`](firestore.rules) into **Firestore → Rules** in the
console and publish, or use the Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

Re-run that deploy after any rules edit. For a different project, run `npx firebase-tools use --add`
once and pass `--project <id>`.

[`firestore.indexes.json`](firestore.indexes.json) contains no composite indexes: every query uses
single-field filters and sorts client-side, so no index prompts appear. If the directory grows well
past a few hundred clubs, add pagination and composite indexes for server-side sorting.

### 4. Make yourself an admin

1. Start the app with your Firebase config and create an account (or sign in with Google).
2. In **Authentication → Users**, copy your user UID.
3. In **Firestore → Data → `users` → your UID**, set `role` to `"admin"` and publish the change.

The profile document is created automatically on first sign-in with `role: "student"`, so the
`users/{uid}` document will already exist. Reload the app; the Admin tab appears. All role checks are
enforced by security rules, not just hidden UI.

### 5. Optional: deploy hosting

```bash
npm run build
npx firebase-tools deploy --only hosting
```

`firebase.json` serves `dist/` and rewrites all paths to `index.html` for client-side routing.
Firebase Hosting domains are authorized for sign-in automatically; add any custom domain under
**Authentication → Settings → Authorized domains**.

---

## Data model

All timestamps are stored as millisecond numbers. Collections are top-level to keep queries simple
and avoid collections-group indexes.

### `users/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `displayName` | string | From sign-up or Google profile |
| `email` | string | Account email |
| `role` | `"student"` \| `"admin"` | Never self-assigned; admins are set in the console |
| `grade` | string (optional) | Reserved for a future profile screen |
| `createdAt` | number | |

### `clubs/{clubId}`

| Field | Type | Notes |
| --- | --- | --- |
| `name`, `description` | string | |
| `category` | string | One of the categories in `src/lib/types.ts` |
| `meetingDay`, `meetingTime`, `location` | string | Free-form display fields |
| `emoji`, `color` | string | Visual identity, no image uploads in the MVP |
| `leaderId`, `leaderName` | string | Creator is the leader; leadership is derived from this |
| `contactEmail` | string | |
| `status` | `"pending"` \| `"approved"` \| `"rejected"` | New clubs always start pending |
| `memberCount` | number | Kept in sync with memberships via transactions; the leader is auto-joined at creation |
| `createdAt` | number | |

### `memberships/{uid_clubId}`

| Field | Type |
| --- | --- |
| `uid`, `clubId` | string |
| `joinedAt` | number |

### `announcements/{announcementId}`

| Field | Type |
| --- | --- |
| `clubId` | string |
| `title`, `body` | string |
| `authorId`, `authorName` | string |
| `createdAt` | number |

### `events/{eventId}`

| Field | Type |
| --- | --- |
| `clubId` | string |
| `title`, `description`, `location` | string |
| `startAt` | number |
| `endAt` | number \| null |
| `createdBy` | string (uid) |
| `createdAt` | number |

### Importing your existing clubs

The MVP has no bulk-import UI. To bring over 200 clubs, write documents into `clubs` with
`status: "approved"`, a valid `leaderId` (a real user UID, or a placeholder until that leader signs
up), and `memberCount: 0`. Or point the directory at existing data with a one-off script using the
Firebase Admin SDK — kept outside this client app.

---

## Roles and permissions

| Action | Student | Club leader | Admin |
| --- | --- | --- | --- |
| Browse directory and approved clubs | ✅ | ✅ | ✅ |
| Join/leave an approved club | ✅ | ✅ | ✅ |
| Read announcements and events | ✅ | ✅ | ✅ |
| Create a club page (pending) | ✅ | ✅ | ✅ |
| Post announcements / add meetings | ❌ | ✅ own club | ✅ any club |
| Delete own club's announcements/events | ❌ | ✅ own club | ✅ any club |
| See pending club pages | ❌ | ✅ own | ✅ all |
| Approve/reject clubs | ❌ | ❌ | ✅ |
| Promote/demote users | ❌ | ❌ | ✅ |

Key rules in [`firestore.rules`](firestore.rules):

- Profiles can only be created by their owner and only with `role: "student"`.
- Clubs can only be created as `pending` with the creator as leader and `memberCount: 0`;
  the creator is then added as the first member. Leaders cannot change `leaderId`, `status`, or
  `createdAt`; only admins change status.
- Memberships can only be created for yourself, and only for an approved club (or your own pending
  club at creation). `memberCount` may only move by exactly ±1 and never below zero.
- Announcement/event creation requires your uid as author and leadership of that club.
- Admins are recognized by the `users/{uid}.role` document read inside the rules, so changing role UI
  alone grants nothing.

### Suggested Firestore dashboard habits

- Keep `users` and `clubs` collections as the source of truth; don't edit `memberCount` by hand.
- When approving a club in the console, set `status` to `"approved"`; this is equivalent to the
  admin console action.
- Deleting a club document does not cascade to its announcements/events. Use the admin UI (or a
  future cleanup job) rather than deleting documents manually.

---

## Project structure

```
src/
  App.tsx                  Routes and auth/admin guards
  components/              App shell, cards, event rows, UI primitives
  context/                 Auth, clubs/memberships, toasts
  hooks/useClubFeed.ts     Announcements + events for a set of clubs
  lib/
    backend.ts             Backend interface + mode selection
    firebaseConfig.ts      Public clubstackapp2 web config (env-overridable)
    firebase.ts            Firebase initialization
    firebaseBackend.ts     Auth + Firestore implementation
    demoBackend.ts         localStorage demo implementation
    demoSeed.ts            Sample clubs, users, announcements, events
    types.ts               Domain types, categories, palette
    dates.ts / helpers.ts  Date, search, and error helpers
  pages/                   Login, Dashboard, Discover, Club, Calendar, Admin, Create, 404
firestore.rules            Server-side security rules
firestore.indexes.json     Composite indexes (none required for the MVP)
firebase.json              Rules + Hosting + emulator configuration
.firebaserc                Firebase CLI project (`clubstackapp2`)
```

The UI talks only to the `ClubStackApi` interface in `src/lib/backend.ts`. The Firebase and demo
implementations share that contract, which keeps pages backend-agnostic and makes it straightforward
to swap or extend the data layer later.

### Adding a feature

1. Add domain types and any fields to `src/lib/types.ts`.
2. Add methods to `ClubStackApi` and implement them in both backends (or remove demo support if it is
   no longer needed).
3. Update `firestore.rules` to enforce the corresponding permission.
4. Build the UI against the interface; refetch after mutations (`refresh()` from `useClubs` or
   `useClubFeed`).

---

## Testing and known limitations

```bash
npm run typecheck
npm test
npm run build
```

Unit tests cover club search/filtering, email/initial helpers, friendly error mapping, calendar grid
math, timezone-safe datetime inputs, and event ordering.

Known limitations for the MVP:

- Announcements/events are loaded per club set and sorted in the browser; add pagination before
  scaling to very large announcement histories.
- No image/logo uploads; clubs use an emoji + accent color instead of Firebase Storage.
- No password reset screen (Firebase supports it; add `sendPasswordResetEmail` when needed).
- No club editing screen beyond status changes; leaders can manage announcements and events.
- Google sign-in requires enabling the provider and an authorized domain.
- Firestore rules allow any signed-in user to read all club, announcement, and event documents;
  content is not sensitive, but tighten reads to memberships if that changes.
