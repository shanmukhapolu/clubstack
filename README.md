# ClubStack

ClubStack is a lightweight, mobile-friendly school club directory built with HTML, CSS, JavaScript modules, Firebase Authentication, and Cloud Firestore.

## Features

- Search and filter approved clubs.
- Student accounts can join and leave clubs, see memberships, and read announcements and upcoming events.
- Club leaders can create club submissions, edit their club page, publish announcements, and add events.
- Admins can approve or reject submissions, delete club listings, assign roles, and suspend accounts.
- Responsive layouts, keyboard-friendly controls, and Lucide icons.

## Run locally

Serve the project over HTTP because it uses JavaScript modules:

```bash
python -m http.server 8000
```

Open http://localhost:8000.

## Firebase setup

1. In Firebase Console, enable **Authentication → Email/Password**.
2. Create a Cloud Firestore database.
3. Confirm the values in `firebase-config.js` match your Firebase web app.
4. Publish the repository's Firestore rules:
   ```powershell
   firebase deploy --only hosting,firestore:rules
   ```
5. Add your deployed domain under Authentication → Settings → Authorized domains.

## Roles and moderation

New signups are always students. Club leaders and admins must be granted by an existing admin in Firestore under `users/{uid}`; set `role` to `leader` or `admin`. Do not restore public role selection. The client must never be the authority for elevation to admin.

Admin access is enforced by Firestore rules, not only by the interface. To bootstrap the first admin, create a normal account, then update that user's profile document in the Firebase Console to `role: "admin"`. After that, use the in-app admin tools to grant leader roles and suspend accounts.

## Firestore data model

- `users/{uid}`: `name`, `email`, `role` (`student`, `leader`, `admin`), optional `suspended`.
- `clubs/{clubId}`: `name`, `category`, `description`, `meetingInfo`, `status` (`pending`, `approved`), `createdBy`, `leaderIds`, `glyph`.
- `memberships/{clubId_uid}`: `clubId`, `userId`, `joinedAt`.
- `clubs/{clubId}/announcements/{announcementId}`: `title`, `body`, `createdBy`, `createdAt`.
- `clubs/{clubId}/events/{eventId}`: `title`, `description`, `date`, `location`, `createdBy`, `createdAt`.

## Before a school-wide launch

Review school account requirements, permissions, privacy expectations, data retention, and moderation policy with a school administrator. Test student, leader, admin, and suspended-user paths with the Firebase Emulator Suite before inviting students.
