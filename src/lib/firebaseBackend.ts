import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
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
  ClubJoinRequest,
  JoinRequestStatus,
  EventRsvpStatus,
  RsvpSummary,
  SponsorRequestStatus,
  Membership,
  ModerationReport,
  OfficerInvitation,
  OfficerInvitationStatus,
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

function toDirectoryData(data: Record<string, unknown>): Record<string, unknown> {
  return {
    name: stringOr(data.name, 'Untitled club'),
    description: stringOr(data.description, ''),
    category: stringOr(data.category, 'Other'),
    emoji: stringOr(data.emoji, '🎒'),
    color: stringOr(data.color, '#8b7cff'),
    status: (['pending', 'approved', 'rejected'].includes(String(data.status)) ? data.status : 'pending') as ClubStatus,
    leaderName: stringOr(data.leaderName, ''),
    requiresApproval: data.requiresApproval === true,
    membersVisible: data.membersVisible !== false,
    createdAt: numberOr(data.createdAt),
  }
}

function mergeClubData(id: string, privateData: Record<string, unknown>, directoryData?: Record<string, unknown>, memberCount = 0): Club {
  const merged = directoryData ? { ...privateData, ...directoryData } : privateData
  return toClub(id, { ...merged, memberCount, requiresApproval: directoryData?.requiresApproval === true, membersVisible: directoryData?.membersVisible !== false })
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
    requiresApproval: data.requiresApproval === true,
    membersVisible: data.membersVisible !== false,
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
              nameLower: profile.displayName.toLocaleLowerCase(),
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
          nameLower: name.toLocaleLowerCase(),
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
      const db = requireDb()
      const uid = requireAuth().currentUser?.uid
      if (!uid) return []
      const profile = await getDoc(doc(db, 'users', uid))
      const role = profile.exists() ? profile.data().role : 'student'

      if (role === 'admin') {
        const [privateSnapshot, directorySnapshot] = await Promise.all([
          getDocs(collection(db, 'clubs')),
          getDocs(collection(db, 'clubDirectory')),
        ])
        const directories = new Map(directorySnapshot.docs.map((item) => [item.id, item.data()]))
        const missing = privateSnapshot.docs.filter((item) => !directories.has(item.id))
        for (let i = 0; i < missing.length; i += 400) {
          const batch = writeBatch(db)
          for (const item of missing.slice(i, i + 400)) {
            const directory = toDirectoryData(item.data())
            batch.set(doc(db, 'clubDirectory', item.id), directory)
            directories.set(item.id, directory)
          }
          await batch.commit()
        }
        const clubs = await Promise.all(privateSnapshot.docs.map(async (item) => {
          const members = await getDocs(query(collection(db, 'memberships'), where('clubId', '==', item.id)))
          return mergeClubData(item.id, item.data(), directories.get(item.id), members.size)
        }))
        return clubs.sort((a, b) => b.createdAt - a.createdAt)
      }

      const [directorySnapshot, membershipSnapshot, leaderSnapshot, officerSnapshot, sponsorSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'clubDirectory'), where('status', '==', 'approved'))),
        getDocs(query(collection(db, 'memberships'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'clubs'), where('leaderId', '==', uid))),
        getDocs(query(collection(db, 'clubs'), where('officerIds', 'array-contains', uid))),
        getDocs(query(collection(db, 'clubs'), where('sponsorId', '==', uid), where('sponsorStatus', '==', 'accepted'))),
      ])
      const directories = new Map(directorySnapshot.docs.map((item) => [item.id, item.data()]))
      const privateClubs = new Map<string, Record<string, unknown>>()
      for (const snapshot of [leaderSnapshot, officerSnapshot, sponsorSnapshot]) snapshot.docs.forEach((item) => privateClubs.set(item.id, item.data()))

      const memberIds = membershipSnapshot.docs.map((item) => stringOr(item.data().clubId, '')).filter(Boolean)
      await Promise.all(memberIds.filter((id) => !privateClubs.has(id)).map(async (id) => {
        try {
          const snapshot = await getDoc(doc(db, 'clubs', id))
          if (snapshot.exists()) privateClubs.set(id, snapshot.data())
        } catch {
          // A stale membership cannot block the rest of the directory.
        }
      }))
      await Promise.all([...privateClubs.keys()].filter((id) => !directories.has(id)).map(async (id) => {
        try {
          const snapshot = await getDoc(doc(db, 'clubDirectory', id))
          if (snapshot.exists()) directories.set(id, snapshot.data())
        } catch {
          // Legacy private records remain viewable to their authorized members.
        }
      }))

      const ids = new Set([...directories.keys(), ...privateClubs.keys()])
      return Promise.all([...ids].map(async (id) => {
        const privateData = privateClubs.get(id)
        const directory = directories.get(id)
        let count = 0
        if (privateData && (directory?.membersVisible !== false || role === 'admin' || privateData.leaderId === uid || (Array.isArray(privateData.officerIds) && privateData.officerIds.includes(uid)) || privateData.sponsorId === uid)) {
          try { count = (await getDocs(query(collection(db, 'memberships'), where('clubId', '==', id)))).size } catch { count = 0 }
        }
        return mergeClubData(id, privateData ?? {}, directory, count)
      })).then((clubs) => clubs.sort((a, b) => b.createdAt - a.createdAt))
    },

    async get(id) {
      const db = requireDb()
      let directory: Record<string, unknown> | undefined
      try {
        const directorySnapshot = await getDoc(doc(db, 'clubDirectory', id))
        if (directorySnapshot.exists()) directory = directorySnapshot.data()
      } catch {
        // Pending previews are available to their owners and managers only.
      }
      try {
        const privateSnapshot = await getDoc(doc(db, 'clubs', id))
        if (privateSnapshot.exists()) {
          let count = 0
          try {
            const members = await getDocs(query(collection(db, 'memberships'), where('clubId', '==', id)))
            count = members.size
          } catch {
            // If the membership list is hidden, the count is hidden too.
          }
          return mergeClubData(id, privateSnapshot.data(), directory, count)
        }
      } catch {
        // Public previews intentionally contain no private club details.
      }
      return directory ? mergeClubData(id, {}, directory, 0) : null
    },

    async create(input: ClubInput, leader: AppUser) {
      const db = requireDb()
      const clubRef = doc(collection(db, 'clubs'))
      const createdAt = Date.now()
      const privateData = {
        ...input,
        status: 'pending' satisfies ClubStatus,
        leaderId: leader.id,
        leaderName: leader.displayName,
        leaderTitle: input.leaderTitle || 'President',
        officers: [],
        officerIds: [],
        sponsorId: input.sponsorId ?? '',
        sponsorName: input.sponsorName ?? '',
        sponsorStatus: input.sponsorId ? 'pending' : 'none',
        createdAt,
      }
      await setDoc(clubRef, privateData)
      await setDoc(doc(db, 'clubDirectory', clubRef.id), toDirectoryData(privateData))
      const batch = writeBatch(db)
      batch.set(doc(db, 'memberships', `${leader.id}_${clubRef.id}`), { uid: leader.id, clubId: clubRef.id, joinedAt: createdAt })
      await batch.commit()

      if (input.sponsorId) {
        await addDoc(collection(db, 'clubSponsorRequests'), {
          clubId: clubRef.id, clubName: input.name, teacherId: input.sponsorId, teacherName: input.sponsorName,
          requestedById: leader.id, requestedByName: leader.displayName,
          status: 'pending' satisfies SponsorRequestStatus, createdAt,
        })
      }
      return clubRef.id
    },

    async update(id, patch: Partial<Club>) {
      const db = requireDb()
      const clubRef = doc(db, 'clubs', id)
      const directoryRef = doc(db, 'clubDirectory', id)
      const current = await getDoc(clubRef)
      if (!current.exists()) throw new Error('That club no longer exists.')
      const directory = await getDoc(directoryRef)
      if (!directory.exists()) await setDoc(directoryRef, toDirectoryData(current.data()))
      const directoryKeys = ['name', 'description', 'category', 'emoji', 'color', 'status', 'leaderName'] as const
      const privatePatch: Record<string, unknown> = {}
      const directoryPatch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'memberCount') continue
        if (key === 'requiresApproval' || key === 'membersVisible') directoryPatch[key] = value
        else if ((directoryKeys as readonly string[]).includes(key)) {
          privatePatch[key] = value
          directoryPatch[key] = value
        } else privatePatch[key] = value
      }
      const batch = writeBatch(db)
      if (Object.keys(privatePatch).length) batch.update(clubRef, privatePatch)
      if (Object.keys(directoryPatch).length) batch.update(directoryRef, directoryPatch)
      await batch.commit()
    },

    async setStatus(id, status) {
      const db = requireDb()
      const batch = writeBatch(db)
      batch.update(doc(db, 'clubs', id), { status })
      batch.update(doc(db, 'clubDirectory', id), { status })
      await batch.commit()
    },

    async delete(id) {
      const db = requireDb()
      const related = await Promise.all([
        getDocs(query(collection(db, 'memberships'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'announcements'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'events'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'clubSponsorRequests'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'moderationReports'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'officerInvitations'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'clubJoinRequests'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'announcementReactions'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'eventRsvps'), where('clubId', '==', id))),
      ])
      const batch = writeBatch(db)
      related.flatMap((snapshot) => snapshot.docs).forEach((item) => batch.delete(item.ref))
      batch.delete(doc(db, 'clubs', id))
      batch.delete(doc(db, 'clubDirectory', id))
      await batch.commit()
    },
  },

  memberships: {
    async listMine(uid) {
      const snapshot = await getDocs(query(collection(requireDb(), 'memberships'), where('uid', '==', uid)))
      return snapshot.docs.map((item) => (item.data() as Membership).clubId)
    },

    async listMembers(clubId) {
      const snapshot = await getDocs(query(collection(requireDb(), 'memberships'), where('clubId', '==', clubId)))
      return snapshot.docs.map((item) => stringOr(item.data().uid, '')).filter(Boolean)
    },

    async listRequestsForClub(clubId) {
      const snapshot = await getDocs(query(collection(requireDb(), 'clubJoinRequests'), where('clubId', '==', clubId)))
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ClubJoinRequest).sort(byNewest)
    },

    async listRequestsForUser(uid) {
      const snapshot = await getDocs(query(collection(requireDb(), 'clubJoinRequests'), where('uid', '==', uid)))
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ClubJoinRequest).sort(byNewest)
    },

    async respondToRequest(requestId, status) {
      const db = requireDb()
      const requestRef = doc(db, 'clubJoinRequests', requestId)
      const snapshot = await getDoc(requestRef)
      if (!snapshot.exists()) throw new Error('This membership request no longer exists.')
      const data = snapshot.data()
      if (data.status !== 'pending') throw new Error('This request has already been answered.')
      if (status === 'declined') {
        await updateDoc(requestRef, { status })
        return
      }
      const uid = stringOr(data.uid, '')
      const clubId = stringOr(data.clubId, '')
      if (!uid || !clubId) throw new Error('This request is missing a student or club.')
      await runTransaction(db, async (transaction) => {
        const [latest, membership] = await Promise.all([
          transaction.get(requestRef),
          transaction.get(doc(db, 'memberships', `${uid}_${clubId}`)),
        ])
        if (!latest.exists() || latest.data().status !== 'pending') throw new Error('This request has already been answered.')
        transaction.update(requestRef, { status: 'approved' })
        if (!membership.exists()) transaction.set(doc(db, 'memberships', `${uid}_${clubId}`), { uid, clubId, joinedAt: Date.now() })
      })
    },

    async join(clubId) {
      const db = requireDb()
      const uid = requireAuth().currentUser?.uid
      if (!uid) throw new Error('You must be signed in to join a club.')
      const profile = await getDoc(doc(db, 'users', uid))
      if (profile.data()?.role !== 'student') throw new Error('Only student accounts can join clubs.')
      const directoryRef = doc(db, 'clubDirectory', clubId)
      const directory = await getDoc(directoryRef)
      if (!directory.exists() || directory.data().status !== 'approved') throw new Error('This club is not open for joining yet.')
      const membershipRef = doc(db, 'memberships', `${uid}_${clubId}`)
      if ((await getDoc(membershipRef)).exists()) return

      if (directory.data().requiresApproval === true) {
        const requestRef = doc(db, 'clubJoinRequests', `${clubId}_${uid}`)
        const oldRequest = await getDoc(requestRef)
        if (oldRequest.exists() && oldRequest.data().status === 'pending') return
        if (oldRequest.exists() && oldRequest.data().status === 'declined') {
          await updateDoc(requestRef, { status: 'pending', createdAt: Date.now() })
          return
        }
        await setDoc(requestRef, {
          clubId, clubName: stringOr(directory.data().name, 'Club'), uid,
          displayName: stringOr(profile.data()?.displayName, 'Student'),
          status: 'pending' satisfies JoinRequestStatus, createdAt: Date.now(),
        })
        return
      }

      await runTransaction(db, async (transaction) => {
        const latest = await transaction.get(directoryRef)
        const membership = await transaction.get(membershipRef)
        if (!latest.exists() || latest.data().status !== 'approved') throw new Error('This club is not open for joining.')
        if (membership.exists()) return
        if (latest.data().requiresApproval === true) throw new Error('This club now requires approval. Refresh and request to join.')
        transaction.set(membershipRef, { uid, clubId, joinedAt: Date.now() })
      })
    },

    async leave(clubId) {
      const db = requireDb()
      const uid = requireAuth().currentUser?.uid
      if (!uid) throw new Error('You must be signed in to leave a club.')
      const membershipRef = doc(db, 'memberships', `${uid}_${clubId}`)
      await runTransaction(db, async (transaction) => {
        const membership = await transaction.get(membershipRef)
        if (membership.exists()) transaction.delete(membershipRef)
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

    async getReactionSummary(announcementId, uid) {
      const snapshot = await getDocs(query(collection(requireDb(), 'announcementReactions'), where('announcementId', '==', announcementId)))
      const counts: Record<string, number> = {}
      let mine: string | null = null
      for (const item of snapshot.docs) {
        const data = item.data()
        const emoji = stringOr(data.emoji, '')
        if (emoji) counts[emoji] = (counts[emoji] ?? 0) + 1
        if (data.uid === uid) mine = emoji || null
      }
      return { counts, mine }
    },

    async setReaction(announcementId, clubId, uid, emoji) {
      const ref = doc(requireDb(), 'announcementReactions', `${announcementId}_${uid}`)
      if (!emoji) { await deleteDoc(ref); return }
      await setDoc(ref, { announcementId, clubId, uid, emoji, createdAt: Date.now() })
    },

    async remove(id) {
      await deleteDoc(doc(requireDb(), 'announcements', id))
    },
  },

  events: {
    async listAll() {
      const db = requireDb()
      const ids = await readablePrivateClubIds()
      if (!ids.length) return []
      const groups = await Promise.all(chunk(ids).map((group) => getDocs(query(collection(db, 'events'), where('clubId', 'in', group)))))
      return groups.flatMap((snapshot) => snapshot.docs.map((item) => toEvent(item.id, item.data()))).sort(byStart)
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

    async getRsvpSummary(eventId, uid) {
      const snapshot = await getDocs(query(collection(requireDb(), 'eventRsvps'), where('eventId', '==', eventId)))
      const summary: RsvpSummary = { going: 0, maybe: 0, notGoing: 0, mine: null }
      for (const item of snapshot.docs) {
        const data = item.data()
        if (data.status === 'going') summary.going += 1
        if (data.status === 'maybe') summary.maybe += 1
        if (data.status === 'notGoing') summary.notGoing += 1
        if (data.uid === uid) summary.mine = data.status as EventRsvpStatus
      }
      return summary
    },

    async setRsvp(eventId, clubId, uid, status) {
      await setDoc(doc(requireDb(), 'eventRsvps', `${eventId}_${uid}`), { eventId, clubId, uid, status, updatedAt: Date.now() })
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

    async listMine(uid) {
      const snapshot = await getDocs(query(collection(requireDb(), 'moderationReports'), where('reporterId', '==', uid)))
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

  officerInvitations: {
    async listForUser(uid) {
      const snapshot = await getDocs(query(collection(requireDb(), 'officerInvitations'), where('invitedUserId', '==', uid)))
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as OfficerInvitation)).sort(byNewest)
    },

    async listForClub(clubId) {
      const snapshot = await getDocs(query(collection(requireDb(), 'officerInvitations'), where('clubId', '==', clubId)))
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as OfficerInvitation)).sort(byNewest)
    },

    async create(clubId, clubName, officer, inviter) {
      const id = `${clubId}_${officer.uid}`
      await setDoc(doc(requireDb(), 'officerInvitations', id), {
        clubId, clubName, invitedUserId: officer.uid, invitedUserName: officer.displayName,
        invitedById: inviter.id, invitedByName: inviter.displayName, title: officer.title,
        status: 'pending' satisfies OfficerInvitationStatus, createdAt: Date.now(),
      })
    },

    async respond(invitationId, status) {
      const db = requireDb()
      const auth = requireAuth()
      const invitationRef = doc(db, 'officerInvitations', invitationId)
      const invitationSnapshot = await getDoc(invitationRef)
      if (!invitationSnapshot.exists()) throw new Error('This officer invitation no longer exists.')
      const invitation = { id: invitationSnapshot.id, ...invitationSnapshot.data() } as OfficerInvitation
      if (invitation.invitedUserId !== auth.currentUser?.uid) throw new Error('This invitation belongs to another account.')
      if (invitation.status !== 'pending') throw new Error('This invitation has already been answered.')
      if (status === 'declined') {
        await updateDoc(invitationRef, { status })
        return
      }
      const uid = auth.currentUser?.uid
      if (!uid) throw new Error('You must be signed in to accept an officer invitation.')
      const clubRef = doc(db, 'clubs', invitation.clubId)
      const clubSnapshot = await getDoc(clubRef)
      if (!clubSnapshot.exists()) throw new Error('The club no longer exists.')
      const clubData = clubSnapshot.data()
      const officers = Array.isArray(clubData.officers) ? clubData.officers as Club['officers'] : []
      const officer = { uid: invitation.invitedUserId, displayName: invitation.invitedUserName, email: '', title: invitation.title }
      const nextOfficers = [...officers.filter((item) => item.uid !== officer.uid), officer]
      const nextIds = [...new Set([...(Array.isArray(clubData.officerIds) ? clubData.officerIds as string[] : []), officer.uid])]
      const membershipsSnapshot = await getDocs(query(
        collection(db, 'memberships'),
        where('uid', '==', uid),
      ))
      const alreadyMember = membershipsSnapshot.docs.some(item => item.data().clubId === invitation.clubId)
      const batch = writeBatch(db)
      batch.update(invitationRef, { status })
      batch.update(clubRef, { officers: nextOfficers, officerIds: nextIds })
      if (!alreadyMember) {
        batch.set(doc(db, 'memberships', `${uid}_${invitation.clubId}`), {
          uid,
          clubId: invitation.clubId,
          joinedAt: Date.now(),
        })
      }
      await batch.commit()
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

    async searchDirectory(prefix, role, maxResults = 15) {
      const needle = prefix.trim().toLocaleLowerCase()
      if (needle.length < 2) return []
      const resultLimit = Math.max(1, Math.min(100, Math.floor(maxResults)))
      const db = requireDb()
      const lowerQuery = query(collection(db, 'userDirectory'), where('role', '==', role), where('nameLower', '>=', needle), where('nameLower', '<=', needle + '\uf8ff'), limit(resultLimit))
      const legacyPrefix = needle.charAt(0).toLocaleUpperCase() + needle.slice(1)
      const legacyQuery = query(collection(db, 'userDirectory'), where('role', '==', role), where('displayName', '>=', legacyPrefix), where('displayName', '<=', legacyPrefix + '\uf8ff'), limit(resultLimit))
      const [lowerResult, legacyResult] = await Promise.allSettled([getDocs(lowerQuery), getDocs(legacyQuery)])
      if (lowerResult.status === 'rejected' && legacyResult.status === 'rejected') {
        throw lowerResult.reason
      }
      const byId = new Map<string, AppUser>()
      const snapshots = [
        ...(lowerResult.status === 'fulfilled' ? [lowerResult.value] : []),
        ...(legacyResult.status === 'fulfilled' ? [legacyResult.value] : []),
      ]
      for (const snapshot of snapshots) {
        for (const item of snapshot.docs) {
          const person = toUser(item.id, item.data())
          if (person.role === role && person.displayName.toLocaleLowerCase().startsWith(needle)) byId.set(person.id, person)
        }
      }
      return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)).slice(0, resultLimit)
    },

    async setRole(uid, role) {
      const db = requireDb()
      await updateDoc(doc(db, 'users', uid), { role })
      const profile = await getDoc(doc(db, 'users', uid))
      if (profile.exists()) await setDoc(doc(db, 'userDirectory', uid), {
        displayName: stringOr(profile.data().displayName, 'Student'), role,
        createdAt: numberOr(profile.data().createdAt),
        nameLower: stringOr(profile.data().displayName, 'Student').toLocaleLowerCase(),
      }, { merge: true })
    },
  },
}

async function readablePrivateClubIds(): Promise<string[]> {
  const db = requireDb()
  const uid = requireAuth().currentUser?.uid
  if (!uid) return []
  const profile = await getDoc(doc(db, 'users', uid))
  if (profile.data()?.role === 'admin') {
    const snapshot = await getDocs(collection(db, 'clubs'))
    return snapshot.docs.map((item) => item.id)
  }
  const [memberships, leaders, officers, sponsors] = await Promise.all([
    getDocs(query(collection(db, 'memberships'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'clubs'), where('leaderId', '==', uid))),
    getDocs(query(collection(db, 'clubs'), where('officerIds', 'array-contains', uid))),
    getDocs(query(collection(db, 'clubs'), where('sponsorId', '==', uid), where('sponsorStatus', '==', 'accepted'))),
  ])
  const ids = new Set<string>()
  memberships.docs.forEach((item) => ids.add(stringOr(item.data().clubId, '')))
  for (const snapshot of [leaders, officers, sponsors]) snapshot.docs.forEach((item) => ids.add(item.id))
  ids.delete('')
  return [...ids]
}

function byStart(a: ClubEvent, b: ClubEvent): number {
  return a.startAt - b.startAt
}
