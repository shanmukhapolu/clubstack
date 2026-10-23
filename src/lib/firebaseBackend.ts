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
  Membership,
  Role,
} from './types'

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
    role: data.role === 'admin' ? 'admin' : 'student',
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
        void (async () => {
          try {
            const existing = await getDoc(profileRef)
            if (!existing.exists()) {
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
            callback(toUser(snapshot.id, snapshot.data()))
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

    async signUp(name, email, password) {
      const auth = requireAuth()
      const db = requireDb()
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await firebaseUpdateProfile(credential.user, { displayName: name })
      await setDoc(doc(db, 'users', credential.user.uid), {
        displayName: name,
        email,
        role: 'student' satisfies Role,
        createdAt: Date.now(),
      })
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

      return clubRef.id
    },

    async update(id, patch) {
      await updateDoc(doc(requireDb(), 'clubs', id), { ...patch })
    },

    async setStatus(id, status) {
      await updateDoc(doc(requireDb(), 'clubs', id), { status })
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

  users: {
    async list() {
      const snapshot = await getDocs(collection(requireDb(), 'users'))
      return snapshot.docs.map((item) => toUser(item.id, item.data()))
    },

    async setRole(uid, role) {
      await updateDoc(doc(requireDb(), 'users', uid), { role })
    },
  },
}

function byStart(a: ClubEvent, b: ClubEvent): number {
  return a.startAt - b.startAt
}
