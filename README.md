# ClubStack

A lightweight, mobile-friendly school club directory built with plain HTML, CSS, JavaScript modules, Firebase Authentication, and Cloud Firestore. No framework or build step is required.

## What's included

- Searchable club directory with category filters and individual club pages.
- Email/password account creation and sign-in.
- Student memberships and a dashboard for joined clubs.
- Club announcements and a shared upcoming-events view.
- Club submissions with admin approval.
- Leader/admin controls and Firestore Security Rules.
- A sample directory preview when Firebase credentials have not been added.

## Run locally

Because the app uses JavaScript modules, serve it over HTTP rather than opening `index.html` directly from the filesystem.

```bash
# From this folder, with Python installed:
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Configure Firebase

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project for ClubStack.
2. In **Project settings → General → Your apps**, register a Web app and copy its Firebase configuration.
3. Replace the placeholder values in `firebase-config.js` with the actual `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId` values.
4. In **Authentication → Sign-in method**, enable **Email/Password**.
5. In **Firestore Database**, create a database.
6. Open **Firestore → Rules**, paste the contents of `firestore.rules`, and publish the rules.
7. In **Authentication → Settings → Authorized domains**, ensure your local and deployed domains are listed.
8. Start the app using a local HTTP server or deploy it with Firebase Hosting.

The Firebase web config is intended to be included in a client app. Firestore Security Rules protect data access; never put service-account private keys or Admin SDK credentials in browser code.

## First admin and club leaders

**Temporary testing mode:** the signup form currently lets you select `student`, `leader`, or `admin`. The current Firestore rules also allow a user to assign themselves one of these roles so you can test all interfaces. This is intentionally insecure and must not be used with real students or public signups. Before launch, restore the user-create rule to `request.resource.data.role == 'student'` and remove the signup role selector from `index.html`/`app.js`.

1. Create an account and select the role needed for your test.
2. To test leader features, create or approve a club and ensure the test leader UID appears in its `leaderIds` array. Club creators are also stored in `createdBy`.
3. To test admin features, select `admin` at signup. This works only while the temporary testing rules are deployed.

**Important:** Restrict Firebase Console access to trusted administrators. The first admin must be assigned manually in the console; there is no public admin signup flow.

## Firestore data model

- `users/{uid}`: `name`, `email`, `role` (`student`, `leader`, or `admin`), `createdAt`.
- `clubs/{clubId}`: `name`, `category`, `description`, `meetingInfo`, `status` (`pending` or `approved`), `createdBy`, `leaderIds` (array of UIDs), `glyph`, `createdAt`.
- `memberships/{clubId_uid}`: `clubId`, `userId`, `joinedAt`.
- `clubs/{clubId}/announcements/{announcementId}`: `title`, `body`, `createdBy`, `createdAt`.
- `clubs/{clubId}/events/{eventId}`: `title`, `description`, `date`, `location`, `createdBy`, `createdAt`.

Approved club pages and their public announcements/events can be read without signing in. Joining clubs and managing content requires authentication. A user can create only their own student profile, and only admins can approve or delete club submissions or change roles in Firestore.

## Deploy with Firebase Hosting

Install the Firebase CLI and select the existing `clubstackapp2` project from this repository directory. The repository already includes `firebase.json`; do not run `firebase init` unless you intentionally want to reconfigure it.

PowerShell commands (run from the folder containing `firebase.json`):

```powershell
npm install -g firebase-tools
firebase login
firebase projects:list
firebase use --add
# Select clubstackapp2 when prompted and choose an alias such as default.
firebase deploy --only firestore:rules,hosting
```

Before deploying, enable **Authentication → Sign-in method → Email/Password** and create the Cloud Firestore database in the Firebase Console. The deployment command publishes the repository's `firestore.rules` and the static site. This app has no build step. Add the deployed Hosting domain to Authentication → Settings → Authorized domains. If `firebase use --add` has already configured the project, you can deploy directly with `firebase deploy --only firestore:rules,hosting`.

## Before using it school-wide

- Replace the sample preview clubs with approved, accurate school club records.
- Have a school administrator review privacy, retention, student account, and moderation expectations.
- Consider restricting registration to the school's email domain if appropriate. Client-side email checks are not security controls; enforce any domain policy with trusted backend logic or suitable Firebase configuration.
- Test rules in the Firebase Emulator Suite with student, leader, admin, and signed-out accounts before inviting students.
