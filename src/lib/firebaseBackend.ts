import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { chunk } from './helpers'
import { firebaseAuth, firestore } from './firebase'
import type { ClubStackApi } from './backend'
import type {
  Announcement,
  AppUser,
  Club,
  ClubEvent,
  ClubInput,
  ClubStatus,
  ClubSponsorRequest,
  SponsorRequestStatus,
  Membership,
  ModerationReport,
  ReportStatus,
  Role,
} from './types'

let accountCreationInProgress = false

function requireDb(): Firestore {
  if (!firestore) throw new Error('Firebase is not configured.')
  return firestore
}

function requireAuth(): Auth {
  if (!firebaseAuth) throw new Error('Firebase is not configured.')
  return firebaseAuth
}

function toUser(id: string, data: Record<string, unknown>): AppUser {
  return {
    id,
    displayName: stringOr(data.displayName, 'Student'),
    email: stringOr(data.email, ''),
    role: data.role === 'admin' || data.role === 'teacher' ? data.role : 'student',
    grade: typeof data.grade === 'string' ? data.grade : undefined,
    createdAt: numberOr(data.createdAt),
  }
}

function toClub(id: string, data: Record<string, unknown>): Club {
  return {
    id,
    name: stringOr(data.name, 'Untitled club'),
    description: stringOr(data.description, ''),
    category: (data.category as Club['category']) ?? 'Other',
    meetingDay: stringOr(data.meetingDay, 'Flexible'),
    meetingTime: stringOr(data.meetingTime, ''),
    location: stringOr(data.location, ''),
    emoji: stringOr(data.emoji, '🎒'),
    color: stringOr(data.color, '#8b7cff'),
    status: (['pending', 'approved', 'rejected'].includes(String(data.status))
      ? data.status
      : 'pending') as ClubStatus,
    leaderId: stringOr(data.leaderId, ''),
    leaderName: stringOr(data.leaderName, ''),
    leaderTitle: stringOr(data.leaderTitle, 'President'),
    officers: Array.isArray(data.officers) ? data.officers as Club['officers'] : [],
    officerIds: Array.isArray(data.officerIds) ? data.officerIds.filter((id): id is string => typeof id === 'string') : [],
    sponsorId: stringOr(data.sponsorId, ''),
    sponsorName: stringOr(data.sponsorName, ''),
    sponsorStatus: (['pending', 'accepted', 'declined', 'none'].includes(String(data.sponsorStatus)) ? data.sponsorStatus : 'none') as Club['sponsorStatus'],
    contactEmail: stringOr(data.contactEmail, ''),
    memberCount: numberOr(data.memberCount),
    createdAt: numberOr(data.createdAt),
  }
}

function toAnnouncement(id: string, data: Record<string, unknown>): Announcement {
  return {
    id,
    clubId: stringOr(data.clubId, ''),
    title: stringOr(data.title, ''),
    body: stringOr(data.body, ''),
    authorId: stringOr(data.authorId, ''),
    authorName: stringOr(data.authorName, 'Club leader'),
    createdAt: numberOr(data.createdAt),
  }
}

function toModerationReport(id: string, data: Record<string, unknown>): ModerationReport {
  return {
    id,
    reporterId: stringOr(data.reporterId, ''),
    reporterName: stringOr(data.reporterName, 'User'),
    clubId: stringOr(data.clubId, ''),
    clubName: stringOr(data.clubName, 'Unknown club'),
    reason: stringOr(data.reason, 'Other'),
    details: stringOr(data.details, ''),
    status: (['open', 'reviewed', 'resolved'].includes(String(data.status)) ? data.status : 'open') as ReportStatus,
    createdAt: numberOr(data.createdAt),
  }
}

function toSponsorRequest(id: string, data: Record<string, unknown>): ClubSponsorRequest {
  return {
    id,
    clubId: stringOr(data.clubId, ''),
    clubName: stringOr(data.clubName, ''),
    teacherId: stringOr(data.teacherId, ''),
    teacherName: stringOr(data.teacherName, ''),
    requestedById: stringOr(data.requestedById, ''),
    requestedByName: stringOr(data.requestedByName, ''),
    status: (['pending', 'accepted', 'declined'].includes(String(data.status)) ? data.status : 'pending') as SponsorRequestStatus,
    createdAt: numberOr(data.createdAt),
  }
}

function toEvent(id: string, data: Record<string, unknown>): ClubEvent {
  return {
    id,
    clubId: stringOr(data.clubId, ''),
    title: stringOr(data.title, ''),
    description: stringOr(data.description, ''),
    location: stringOr(data.location, ''),
    startAt: numberOr(data.startAt),
    endAt: typeof data.endAt === 'number' ? data.endAt : null,
    createdBy: stringOr(data.createdBy, ''),
    createdAt: numberOr(data.createdAt),
  }
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function byNewest<T extends { createdAt: number }>(a: T, b: T): number {
  return b.createdAt - a.createdAt
}

export const firebaseApi: ClubStackApi = {
  mode: 'firebase',

  auth: {
    subscribe(callback) {
      const auth = requireAuth()
      const db = requireDb()
      let unsubscribeProfile: (() => void) | undefined
      let cancelled = false

      const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        unsubscribeProfile?.()
        unsubscribeProfile = undefined

        if (!firebaseUser) {
          if (!cancelled) callback(null)
          return
        }

        const profileRef = doc(db, 'users', firebaseUser.uid)
        const profileCreationBelongsToSignup = accountCreationInProgress
        void (async () => {
          try {
            const existing = await getDoc(profileRef)
            if (!existing.exists() && !profileCreationBelongsToSignup) {
              await setDoc(profileRef, {
                displayName:
                  firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Student',
                email: firebaseUser.email ?? '',
                role: 'student' satisfies Role,
                createdAt: Date.now(),
              })
            }
          } catch (error) {
            console.error('Could not prepare the user profile.', error)
          }
          if (cancelled) return
          unsubscribeProfile = onSnapshot(profileRef, (snapshot) => {
            if (!snapshot.exists()) return
            const profile = toUser(snapshot.id, snapshot.data())
            void setDoc(doc(db, 'userDirectory', snapshot.id), {
              displayName: profile.displayName,
              role: profile.role,
              createdAt: profile.createdAt,
            }, { merge: true }).catch((error) => console.error('Could not sync the user directory.', error))
            callback(profile)
          })
        })()
      })

      return () => {
        cancelled = true
        unsubscribeProfile?.()
        unsubscribeAuth()
      }
    },

    async signIn(email, password) {
      await signInWithEmailAndPassword(requireAuth(), email, password)
    },

    async signUp(name, email, password, role) {
      const auth = requireAuth()
      const db = requireDb()
      accountCreationInProgress = true
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        await firebaseUpdateProfile(credential.user, { displayName: name })
        const createdAt = Date.now()
        await setDoc(doc(db, 'users', credential.user.uid), {
          displayName: name, email, role, createdAt,
        })
        await setDoc(doc(db, 'userDirectory', credential.user.uid), {
          displayName: name, role, createdAt,
        })
      } finally {
        accountCreationInProgress = false
      }
    },

    async signInWithGoogle() {
      await signInWithPopup(requireAuth(), new GoogleAuthProvider())
    },

    async signOut() {
      await firebaseSignOut(requireAuth())
    },
  },

  clubs: {
    async list() {
      const snapshot = await getDocs(collection(requireDb(), 'clubs'))
      return snapshot.docs.map((item) => toClub(item.id, item.data()))
    },

    async get(id) {
      const snapshot = await getDoc(doc(requireDb(), 'clubs', id))
      return snapshot.exists() ? toClub(snapshot.id, snapshot.data()) : null
    },

    async create(input: ClubInput, leader: AppUser) {
      const db = requireDb()
      const clubRef = doc(collection(db, 'clubs'))
      const createdAt = Date.now()

      // The club is written first so the membership rule can read it.
      await setDoc(clubRef, {
        ...input,
        status: 'pending' satisfies ClubStatus,
        leaderId: leader.id,
        leaderName: leader.displayName,
        leaderTitle: input.leaderTitle || 'President',
        officers: input.officers ?? [],
        officerIds: (input.officers ?? []).map((officer) => officer.uid),
        sponsorId: input.sponsorId ?? '',
        sponsorName: input.sponsorName ?? '',
        sponsorStatus: input.sponsorId ? 'pending' : 'none',
        memberCount: 0,
        createdAt,
      })

      // The leader automatically becomes the first member.
      const batch = writeBatch(db)
      batch.set(doc(db, 'memberships', `${leader.id}_${clubRef.id}`), {
        uid: leader.id,
        clubId: clubRef.id,
        joinedAt: createdAt,
      })
      batch.update(clubRef, { memberCount: 1 })
      await batch.commit()

      if (input.sponsorId) {
        await addDoc(collection(db, 'clubSponsorRequests'), {
          clubId: clubRef.id,
          clubName: input.name,
          teacherId: input.sponsorId,
          teacherName: input.sponsorName,
          requestedById: leader.id,
          requestedByName: leader.displayName,
          status: 'pending' satisfies SponsorRequestStatus,
          createdAt,
        })
      }

      return clubRef.id
    },

    async update(id, patch) {
      await updateDoc(doc(requireDb(), 'clubs', id), { ...patch })
    },

    async setStatus(id, status) {
      await updateDoc(doc(requireDb(), 'clubs', id), { status })
    },

    async delete(id) {
      const db = requireDb()
      const related = await Promise.all([
        getDocs(query(collection(db, 'memberships'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'announcements'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'events'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'clubSponsorRequests'), where('clubId', '==', id))),
      ])
      const batch = writeBatch(db)
      related.flatMap((snapshot) => snapshot.docs).forEach((item) => batch.delete(item.ref))
      batch.delete(doc(db, 'clubs', id))
      await batch.commit()
    },
  },

  memberships: {
    async listMine(uid) {
      const snapshot = await getDocs(
        query(collection(requireDb(), 'memberships'), where('uid', '==', uid)),
      )
      return snapshot.docs.map((item) => (item.data() as Membership).clubId)
    },

    async join(clubId) {
      const db = requireDb()
      const uid = requireAuth().currentUser?.uid
      if (!uid) throw new Error('You must be signed in to join a club.')

      await runTransaction(db, async (transaction) => {
        const clubRef = doc(db, 'clubs', clubId)
        const clubSnapshot = await transaction.get(clubRef)
        if (!clubSnapshot.exists()) throw new Error('That club no longer exists.')
        if (clubSnapshot.data().status !== 'approved') {
          throw new Error('This club is waiting for approval, so you cannot join yet.')
        }

        const membershipRef = doc(db, 'memberships', `${uid}_${clubId}`)
        const membership = await transaction.get(membershipRef)
        if (membership.exists()) return

        transaction.set(membershipRef, { uid, clubId, joinedAt: Date.now() })
        transaction.update(clubRef, { memberCount: increment(1) })
      })
    },

    async leave(clubId) {
      const db = requireDb()
      const uid = requireAuth().currentUser?.uid
      if (!uid) throw new Error('You must be signed in to leave a club.')

      await runTransaction(db, async (transaction) => {
        const membershipRef = doc(db, 'memberships', `${uid}_${clubId}`)
        const membership = await transaction.get(membershipRef)
        if (!membership.exists()) return

        const clubRef = doc(db, 'clubs', clubId)
        const clubSnapshot = await transaction.get(clubRef)
        transaction.delete(membershipRef)
        if (clubSnapshot.exists()) {
          transaction.update(clubRef, {
            memberCount: Math.max(0, numberOr(clubSnapshot.data().memberCount) - 1),
          })
        }
      })
    },
  },

  announcements: {
    async listForClubs(clubIds) {
      const db = requireDb()
      if (clubIds.length === 0) return []
      const groups = await Promise.all(
        chunk(clubIds).map((ids) =>
          getDocs(query(collection(db, 'announcements'), where('clubId', 'in', ids))),
        ),
      )
      return groups
        .flatMap((snapshot) => snapshot.docs.map((item) => toAnnouncement(item.id, item.data())))
        .sort(byNewest)
    },

    async create(clubId, input, author) {
      await addDoc(collection(requireDb(), 'announcements'), {
        clubId,
        title: input.title,
        body: input.body,
        authorId: author.id,
        authorName: author.displayName,
        createdAt: Date.now(),
      })
    },

    async remove(id) {
      await deleteDoc(doc(requireDb(), 'announcements', id))
    },
  },

  events: {
    async listAll() {
      const snapshot = await getDocs(collection(requireDb(), 'events'))
      return snapshot.docs.map((item) => toEvent(item.id, item.data())).sort(byStart)
    },

    async listForClubs(clubIds) {
      const db = requireDb()
      if (clubIds.length === 0) return []
      const groups = await Promise.all(
        chunk(clubIds).map((ids) =>
          getDocs(query(collection(db, 'events'), where('clubId', 'in', ids))),
        ),
      )
      return groups
        .flatMap((snapshot) => snapshot.docs.map((item) => toEvent(item.id, item.data())))
        .sort(byStart)
    },

    async create(clubId, input, author) {
      await addDoc(collection(requireDb(), 'events'), {
        clubId,
        title: input.title,
        description: input.description,
        location: input.location,
        startAt: input.startAt,
        endAt: input.endAt,
        createdBy: author.id,
        createdAt: Date.now(),
      })
    },

    async remove(id) {
      await deleteDoc(doc(requireDb(), 'events', id))
    },
  },

  moderation: {
    async list() {
      const snapshot = await getDocs(collection(requireDb(), 'moderationReports'))
      return snapshot.docs.map((item) => toModerationReport(item.id, item.data())).sort(byNewest)
    },

    async create(input, reporter) {
      await addDoc(collection(requireDb(), 'moderationReports'), {
        ...input,
        reporterId: reporter.id,
        reporterName: reporter.displayName,
        status: 'open' satisfies ReportStatus,
        createdAt: Date.now(),
      })
    },

    async setStatus(id, status) {
      await updateDoc(doc(requireDb(), 'moderationReports', id), { status })
    },
  },

  sponsorRequests: {
    async listForTeacher(teacherId) {
      const snapshot = await getDocs(query(collection(requireDb(), 'clubSponsorRequests'), where('teacherId', '==', teacherId)))
      return snapshot.docs.map((item) => toSponsorRequest(item.id, item.data())).sort(byNewest)
    },

    async create(club, teacher, requester) {
      await updateDoc(doc(requireDb(), 'clubs', club.id), {
        sponsorId: teacher.id, sponsorName: teacher.displayName, sponsorStatus: 'pending',
      })
      await addDoc(collection(requireDb(), 'clubSponsorRequests'), {
        clubId: club.id,
        clubName: club.name,
        teacherId: teacher.id,
        teacherName: teacher.displayName,
        requestedById: requester.id,
        requestedByName: requester.displayName,
        status: 'pending' satisfies SponsorRequestStatus,
        createdAt: Date.now(),
      })
    },

    async respond(requestId, status) {
      const db = requireDb()
      const requestRef = doc(db, 'clubSponsorRequests', requestId)
      const requestSnapshot = await getDoc(requestRef)
      if (!requestSnapshot.exists()) throw new Error('This sponsor request no longer exists.')
      const request = toSponsorRequest(requestSnapshot.id, requestSnapshot.data())
      await updateDoc(requestRef, { status })
      await updateDoc(doc(db, 'clubs', request.clubId), {
        sponsorId: status === 'accepted' ? request.teacherId : '',
        sponsorName: status === 'accepted' ? request.teacherName : '',
        sponsorStatus: status,
      })
    },
  },

  users: {
    async list() {
      const snapshot = await getDocs(collection(requireDb(), 'users'))
      return snapshot.docs.map((item) => toUser(item.id, item.data()))
    },

    async listDirectory() {
      const snapshot = await getDocs(collection(requireDb(), 'userDirectory'))
      return snapshot.docs.map((item) => toUser(item.id, item.data())).sort((a, b) => a.displayName.localeCompare(b.displayName))
    },

    async setRole(uid, role) {
      const db = requireDb()
      await updateDoc(doc(db, 'users', uid), { role })
      const profile = await getDoc(doc(db, 'users', uid))
      if (profile.exists()) await setDoc(doc(db, 'userDirectory', uid), {
        displayName: stringOr(profile.data().displayName, 'Student'), role,
        createdAt: numberOr(profile.data().createdAt),
      }, { merge: true })
    },
  },
}

function byStart(a: ClubEvent, b: ClubEvent): number {
  return a.startAt - b.startAt
}
