const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

const db = getFirestore()
const auth = getAuth()

async function requireAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in as an administrator to manage accounts.')
  const actor = await db.collection('users').doc(request.auth.uid).get()
  if (!actor.exists || actor.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only administrators can manage user accounts.')
  }
  return request.auth.uid
}

async function deleteMatchingDocuments(collectionName, field, uid) {
  const snapshot = await db.collection(collectionName).where(field, '==', uid).get()
  for (let start = 0; start < snapshot.docs.length; start += 400) {
    const batch = db.batch()
    snapshot.docs.slice(start, start + 400).forEach((item) => batch.delete(item.ref))
    await batch.commit()
  }
}

exports.adminManageUser = onCall({ region: 'us-central1' }, async (request) => {
  const actorUid = await requireAdmin(request)
  const data = request.data || {}
  const uid = typeof data.uid === 'string' ? data.uid.trim() : ''
  const action = data.action

  if (!uid) throw new HttpsError('invalid-argument', 'A user ID is required.')
  if (action === 'update') {
    const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : ''
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
    const role = data.role
    const grade = typeof data.grade === 'string' ? data.grade.trim().slice(0, 30) : ''
    if (displayName.length < 2 || displayName.length > 80) {
      throw new HttpsError('invalid-argument', 'Display name must contain 2 to 80 characters.')
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      throw new HttpsError('invalid-argument', 'Enter a valid email address.')
    }
    if (!['student', 'teacher', 'admin'].includes(role)) {
      throw new HttpsError('invalid-argument', 'Choose a valid account role.')
    }
    if (uid === actorUid && role !== 'admin') {
      throw new HttpsError('failed-precondition', 'You cannot remove your own administrator access.')
    }

    const profileRef = db.collection('users').doc(uid)
    const profile = await profileRef.get()
    if (!profile.exists) throw new HttpsError('not-found', 'This user profile no longer exists.')
    try {
      await auth.updateUser(uid, { displayName, email })
    } catch (error) {
      if (error.code === 'auth/user-not-found') throw new HttpsError('not-found', 'The sign-in account could not be found.')
      if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'That email address is already used by another account.')
      throw new HttpsError('internal', 'The sign-in account could not be updated.')
    }
    const profilePatch = { displayName, email, role, grade: grade || FieldValue.delete() }
    await profileRef.update(profilePatch)
    await db.collection('userDirectory').doc(uid).set({
      displayName, role, createdAt: profile.data().createdAt || 0, nameLower: displayName.toLocaleLowerCase(),
    }, { merge: true })
    return { success: true }
  }

  if (action === 'delete') {
    if (uid === actorUid) throw new HttpsError('failed-precondition', 'You cannot delete your own administrator account.')
    const profileRef = db.collection('users').doc(uid)
    const profile = await profileRef.get()
    if (!profile.exists) throw new HttpsError('not-found', 'This user profile no longer exists.')

    const [ownedClubs, sponsoredClubs] = await Promise.all([
      db.collection('clubs').where('leaderId', '==', uid).limit(1).get(),
      db.collection('clubs').where('sponsorId', '==', uid).limit(1).get(),
    ])
    if (!ownedClubs.empty || !sponsoredClubs.empty) {
      throw new HttpsError('failed-precondition', 'This user owns or sponsors a club. Transfer club ownership or assign a new teacher sponsor before deleting the account.')
    }

    const officerClubs = await db.collection('clubs').where('officerIds', 'array-contains', uid).get()
    for (let start = 0; start < officerClubs.docs.length; start += 400) {
      const batch = db.batch()
      officerClubs.docs.slice(start, start + 400).forEach((item) => {
        const club = item.data()
        batch.update(item.ref, {
          officerIds: (club.officerIds || []).filter((id) => id !== uid),
          officers: (club.officers || []).filter((officer) => officer.uid !== uid),
        })
      })
      await batch.commit()
    }

    const cleanupQueries = [
      ['memberships', 'uid'],
      ['clubJoinRequests', 'uid'],
      ['officerInvitations', 'invitedUserId'],
      ['officerInvitations', 'invitedById'],
      ['moderationReports', 'reporterId'],
      ['announcementReactions', 'uid'],
      ['eventRsvps', 'uid'],
      ['clubSponsorRequests', 'requestedById'],
      ['clubSponsorRequests', 'teacherId'],
      ['clubSponsorRequests', 'previousSponsorId'],
      ['clubDeletionRequests', 'requestedById'],
    ]
    await Promise.all(cleanupQueries.map(([collectionName, field]) => deleteMatchingDocuments(collectionName, field, uid)))
    await Promise.all([
      db.collection('userDirectory').doc(uid).delete(),
      profileRef.delete(),
    ])
    try {
      await auth.deleteUser(uid)
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw new HttpsError('internal', 'Profile data was removed, but the sign-in account could not be deleted. Retry account deletion or remove the account in Firebase Authentication.')
      }
    }
    return { success: true }
  }

  throw new HttpsError('invalid-argument', 'Choose update or delete as the account action.')
})
