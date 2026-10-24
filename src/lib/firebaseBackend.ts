import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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
  ClubDeletionRequest,
  ClubDeletionStatus,
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

function normalizeMeetingFrequency(value: unknown, meetingDay: string): Club['meetingFrequency'] {
  return value === 'weekly' || value === 'everyOtherWeek' || value === 'monthly' || value === 'custom'
    ? value
    : meetingDay === 'Flexible' ? 'custom' : 'weekly'
}

function normalizeMeetingOrdinal(value: unknown): Club['meetingOrdinal'] {
  return value === 'second' || value === 'third' || value === 'fourth' || value === 'last'
    ? value
    : 'first'
}

function normalizeInstagramHandle(value: string): string {
  const trimmed = value.trim()
  const withoutUrl = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/?[?#].*$/, '')
  return withoutUrl.replace(/^@+/, '').replace(/\/$/, '').trim()
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
    sponsorName: stringOr(data.sponsorName, ''),
    meetingDay: stringOr(data.meetingDay, 'Flexible'),
    meetingFrequency: normalizeMeetingFrequency(data.meetingFrequency, stringOr(data.meetingDay, 'Flexible')),
    meetingOrdinal: normalizeMeetingOrdinal(data.meetingOrdinal),
    customMeetingSchedule: stringOr(data.customMeetingSchedule, ''),
    meetingTime: stringOr(data.meetingTime, ''),
    location: stringOr(data.location, ''),
    contactEmail: stringOr(data.contactEmail, ''),
    prerequisites: stringOr(data.prerequisites, ''),
    dues: stringOr(data.dues, ''),
    instagramHandle: normalizeInstagramHandle(stringOr(data.instagramHandle, '')),
    requiresApproval: data.requiresApproval === true,
    membersVisible: data.membersVisible !== false,
    hidden: data.hidden === true,
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
    meetingFrequency: normalizeMeetingFrequency(data.meetingFrequency, stringOr(data.meetingDay, 'Flexible')),
    meetingOrdinal: normalizeMeetingOrdinal(data.meetingOrdinal),
    customMeetingSchedule: stringOr(data.customMeetingSchedule, ''),
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
    prerequisites: stringOr(data.prerequisites, ''),
    dues: stringOr(data.dues, ''),
    instagramHandle: normalizeInstagramHandle(stringOr(data.instagramHandle, '')),
    memberCount: numberOr(data.memberCount),
    requiresApproval: data.requiresApproval === true,
    membersVisible: data.membersVisible !== false,
    pendingLeaderTransfer: data.pendingLeaderTransfer && typeof data.pendingLeaderTransfer === 'object' ? data.pendingLeaderTransfer as Club['pendingLeaderTransfer'] : null,
    hidden: data.hidden === true,
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
    pinned: data.pinned === true,
    updatedAt: numberOr(data.updatedAt, numberOr(data.createdAt)),
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
    previousSponsorId: stringOr(data.previousSponsorId, '') || undefined,
    previousSponsorName: stringOr(data.previousSponsorName, '') || undefined,
    stage: data.stage === 'currentSponsorApproval' || data.stage === 'newSponsorApproval' ? data.stage : undefined,
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
    type: (['Event', 'Callout', 'General Meeting', 'Workshop'].includes(String(data.type)) ? data.type : 'General Meeting') as ClubEvent['type'],
    attendance: data.attendance === 'mandatory' ? 'mandatory' : 'optional',
    updatedAt: numberOr(data.updatedAt, numberOr(data.createdAt)),
    deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : null,
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
        const disabledRef = doc(db, 'disabledUsers', firebaseUser.uid)
        const profileCreationBelongsToSignup = accountCreationInProgress
        void (async () => {
          try {
            const disabled = await getDoc(disabledRef)
            if (disabled.exists()) {
              await firebaseSignOut(auth)
              if (!cancelled) callback(null)
              return
            }
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
            if (!snapshot.exists()) {
              void getDoc(disabledRef).then(async disabled => {
                if (disabled.exists()) await firebaseSignOut(auth)
                if (!cancelled) callback(null)
              }).catch(error => console.error('Could not verify account status.', error))
              return
            }
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
        // Keep the public-safe summary in sync for older clubs too, not only brand-new records.
        const needsSync = privateSnapshot.docs.filter((item) => {
          const existing = directories.get(item.id)
          const expected = toDirectoryData(item.data())
          return !existing || ['sponsorName', 'meetingDay', 'meetingFrequency', 'meetingOrdinal', 'customMeetingSchedule', 'meetingTime', 'location', 'contactEmail', 'prerequisites', 'dues', 'instagramHandle', 'requiresApproval', 'membersVisible', 'hidden']
            .some((key) => existing[key] !== expected[key])
        })
        for (let i = 0; i < needsSync.length; i += 400) {
          const batch = writeBatch(db)
          for (const item of needsSync.slice(i, i + 400)) {
            const directory = toDirectoryData(item.data())
            batch.set(doc(db, 'clubDirectory', item.id), directory, { merge: true })
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
      })).then((clubs) => clubs.filter((club) => role === 'admin' || !club.hidden || privateClubs.has(club.id)).sort((a, b) => b.createdAt - a.createdAt))
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
        meetingFrequency: input.meetingFrequency ?? (input.meetingDay === 'Flexible' ? 'custom' : 'weekly'),
        meetingOrdinal: input.meetingOrdinal ?? 'first',
        customMeetingSchedule: input.customMeetingSchedule ?? '',
        prerequisites: input.prerequisites ?? '',
        dues: input.dues ?? '',
        instagramHandle: normalizeInstagramHandle(input.instagramHandle ?? ''),
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

    async removeOfficer(id, officerId) {
      const db = requireDb()
      const clubRef = doc(db, 'clubs', id)
      const snapshot = await getDoc(clubRef)
      if (!snapshot.exists()) throw new Error('That club no longer exists.')
      const data = snapshot.data()
      const actorId = requireAuth().currentUser?.uid
      if (!actorId) throw new Error('You must be signed in to manage officers.')
      const officers = Array.isArray(data.officers) ? data.officers.filter((item) => (item as Record<string, unknown>).uid !== officerId) : []
      const officerIds = Array.isArray(data.officerIds) ? data.officerIds.filter((uid) => uid !== officerId) : []
      await updateDoc(clubRef, { officers, officerIds })
    },

    async update(id, patch: Partial<Club>) {
      const db = requireDb()
      const clubRef = doc(db, 'clubs', id)
      const directoryRef = doc(db, 'clubDirectory', id)
      const current = await getDoc(clubRef)
      if (!current.exists()) throw new Error('That club no longer exists.')
      const currentData = current.data()
      const directorySnapshot = await getDoc(directoryRef)
      const directoryData = directorySnapshot.exists() ? directorySnapshot.data() : {}
      const privatePatch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'memberCount' || key === 'requiresApproval' || key === 'membersVisible') continue
        if (key === 'instagramHandle') privatePatch[key] = normalizeInstagramHandle(stringOr(value, ''))
        else privatePatch[key] = value
      }

      // Migrate older club documents in the same atomic write so directory mirror rules
      // compare fully populated records, not missing legacy fields.
      const defaults: Record<string, unknown> = {
        meetingFrequency: normalizeMeetingFrequency(currentData.meetingFrequency, stringOr(currentData.meetingDay, 'Flexible')),
        meetingOrdinal: normalizeMeetingOrdinal(currentData.meetingOrdinal),
        customMeetingSchedule: stringOr(currentData.customMeetingSchedule, ''),
        prerequisites: stringOr(currentData.prerequisites, ''),
        dues: stringOr(currentData.dues, ''),
        instagramHandle: normalizeInstagramHandle(stringOr(currentData.instagramHandle, '')),
      }
      const aboutFieldsChanged = [
        'name', 'description', 'category', 'meetingDay', 'meetingFrequency',
        'meetingOrdinal', 'customMeetingSchedule', 'meetingTime', 'location',
        'contactEmail', 'prerequisites', 'dues', 'instagramHandle',
      ].some((key) => Object.prototype.hasOwnProperty.call(patch, key))
      // A control-only change should not alter legacy private fields: doing so
      // would make the narrow officer/privacy update rule reject the save.
      if (aboutFieldsChanged) {
        for (const [key, value] of Object.entries(defaults)) {
          if (currentData[key] === undefined && privatePatch[key] === undefined) privatePatch[key] = value
        }
      }
      const projectedPrivate = { ...currentData, ...privatePatch }
      const directoryPatch = {
        ...toDirectoryData(projectedPrivate),
        requiresApproval: typeof patch.requiresApproval === 'boolean' ? patch.requiresApproval : directoryData.requiresApproval === true,
        membersVisible: typeof patch.membersVisible === 'boolean' ? patch.membersVisible : directoryData.membersVisible !== false,
      }
      const batch = writeBatch(db)
      if (Object.keys(privatePatch).length) batch.update(clubRef, privatePatch)
      if (directorySnapshot.exists()) batch.set(directoryRef, directoryPatch, { merge: true })
      else batch.set(directoryRef, directoryPatch)
      await batch.commit()
    },

    async setStatus(id, status) {
      const db = requireDb()
      const clubRef = doc(db, 'clubs', id)
      const directoryRef = doc(db, 'clubDirectory', id)
      const snapshot = await getDoc(clubRef)
      if (!snapshot.exists()) throw new Error('That club no longer exists.')
      const projectedPrivate = { ...snapshot.data(), status }
      const directorySnapshot = await getDoc(directoryRef)
      const existingDirectory = directorySnapshot.exists() ? directorySnapshot.data() : {}
      const completeDirectory = {
        ...toDirectoryData(projectedPrivate),
        requiresApproval: existingDirectory.requiresApproval === true,
        membersVisible: existingDirectory.membersVisible !== false,
      }
      const batch = writeBatch(db)
      batch.update(clubRef, { status })
      batch.set(directoryRef, completeDirectory, { merge: true })
      await batch.commit()
    },

    async transferOwnership(id, newLeaderId, currentLeader) {
      const db = requireDb()
      const clubRef = doc(db, 'clubs', id)
      const current = await getDoc(clubRef)
      if (!current.exists()) throw new Error('That club no longer exists.')
      const data = current.data()
      if (data.leaderId !== currentLeader.id) throw new Error('Only the current club leader can request an ownership transfer.')
      if (newLeaderId === currentLeader.id || !Array.isArray(data.officerIds) || !data.officerIds.includes(newLeaderId)) {
        throw new Error('Choose an existing club officer to become the new leader.')
      }
      if (data.pendingLeaderTransfer && typeof data.pendingLeaderTransfer === 'object') throw new Error('An ownership transfer is already awaiting a response.')
      const target = (Array.isArray(data.officers) ? data.officers : []).find((officer) => officer && typeof officer === 'object' && (officer as Record<string, unknown>).uid === newLeaderId) as Record<string, unknown> | undefined
      if (!target) throw new Error('The selected officer record could not be found.')
      await updateDoc(clubRef, { pendingLeaderTransfer: { fromId: currentLeader.id, fromName: currentLeader.displayName, toId: newLeaderId, toName: stringOr(target.displayName, 'Club officer'), createdAt: Date.now() } })
    },

    async respondToOwnershipTransfer(id, accept, currentUser) {
      const db = requireDb()
      const clubRef = doc(db, 'clubs', id)
      const current = await getDoc(clubRef)
      if (!current.exists()) throw new Error('That club no longer exists.')
      const data = current.data()
      const transfer = data.pendingLeaderTransfer as Record<string, unknown> | undefined
      if (!transfer || transfer.toId !== currentUser.id) throw new Error('This ownership transfer is not addressed to your account.')
      if (!accept) {
        await updateDoc(clubRef, { pendingLeaderTransfer: null })
        return
      }
      if (data.leaderId !== transfer.fromId || !Array.isArray(data.officerIds) || !data.officerIds.includes(currentUser.id)) {
        throw new Error('The club leadership changed before this transfer could be accepted.')
      }
      const target = (Array.isArray(data.officers) ? data.officers : []).find((officer) => officer && typeof officer === 'object' && (officer as Record<string, unknown>).uid === currentUser.id) as Record<string, unknown> | undefined
      if (!target) throw new Error('Your officer record could not be found.')
      const officers = (Array.isArray(data.officers) ? data.officers : []).filter((officer) => {
        const person = officer as Record<string, unknown>
        return person.uid !== currentUser.id && person.uid !== transfer.fromId
      })
      officers.push({ uid: stringOr(transfer.fromId, ''), displayName: stringOr(transfer.fromName, 'Former leader'), email: '', title: 'Former President' })
      const officerIds = [...new Set((data.officerIds as string[]).filter((uid) => uid !== currentUser.id).concat(stringOr(transfer.fromId, '')))]
      const batch = writeBatch(db)
      batch.update(clubRef, { leaderId: currentUser.id, leaderName: currentUser.displayName, leaderTitle: 'President', officers, officerIds, pendingLeaderTransfer: null })
      batch.update(doc(db, 'clubDirectory', id), { leaderName: currentUser.displayName })
      await batch.commit()
    },

    async getDeletionRequest(id) {
      const snapshot = await getDoc(doc(requireDb(), 'clubDeletionRequests', id))
      return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as ClubDeletionRequest) : null
    },

    async requestDeletion(id, currentLeader) {
      const db = requireDb()
      const clubSnapshot = await getDoc(doc(db, 'clubs', id))
      if (!clubSnapshot.exists()) throw new Error('That club no longer exists.')
      if (clubSnapshot.data().leaderId !== currentLeader.id) throw new Error('Only the club leader can request deletion.')
      if (!clubSnapshot.data().sponsorId || clubSnapshot.data().sponsorStatus !== 'accepted') {
        throw new Error('Assign and confirm a teacher advisor before requesting deletion approval.')
      }
      const requestRef = doc(db, 'clubDeletionRequests', id)
      const existing = await getDoc(requestRef)
      if (existing.exists() && existing.data().status === 'pending') throw new Error('A deletion request is already awaiting the teacher advisor.')
      if (existing.exists() && existing.data().status === 'approved') throw new Error('The advisor approved deletion. Use the permanent delete action instead.')
      const createdAt = Date.now()
      const data = {
        clubId: id,
        clubName: stringOr(clubSnapshot.data().name, 'Club'),
        requestedById: currentLeader.id,
        requestedByName: currentLeader.displayName,
        status: 'pending' satisfies ClubDeletionStatus,
        createdAt,
      }
      if (existing.exists()) await updateDoc(requestRef, data)
      else await setDoc(requestRef, data)
    },

    async respondToDeletionRequest(id, status, advisor) {
      if (advisor.role !== 'teacher') throw new Error('Only the teacher advisor can review a club deletion request.')
      const db = requireDb()
      const requestRef = doc(db, 'clubDeletionRequests', id)
      const snapshot = await getDoc(requestRef)
      if (!snapshot.exists()) throw new Error('This deletion request no longer exists.')
      if (snapshot.data().status !== 'pending') throw new Error('This deletion request has already been reviewed.')
      await updateDoc(requestRef, { status, reviewedAt: Date.now(), reviewedById: advisor.id })
    },

    async delete(id) {
      const db = requireDb()
      const authUid = requireAuth().currentUser?.uid
      if (!authUid) throw new Error('You must be signed in to delete a club.')
      const profile = await getDoc(doc(db, 'users', authUid))
      const isAdministrator = profile.data()?.role === 'admin'
      if (!isAdministrator) {
        const clubSnapshot = await getDoc(doc(db, 'clubs', id))
        if (!clubSnapshot.exists()) throw new Error('That club no longer exists.')
        if (clubSnapshot.data().leaderId !== authUid) {
          throw new Error('Only the club leader can complete an advisor-approved deletion.')
        }
        const approval = await getDoc(doc(db, 'clubDeletionRequests', id))
        if (!approval.exists() || approval.data().status !== 'approved') {
          throw new Error('The teacher advisor must approve deletion before this club can be deleted.')
        }
      }
      const related = await Promise.all([
        getDocs(query(collection(db, 'memberships'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'announcements'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'events'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'clubSponsorRequests'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'officerInvitations'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'clubJoinRequests'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'announcementReactions'), where('clubId', '==', id))),
        getDocs(query(collection(db, 'eventRsvps'), where('clubId', '==', id))),
      ])
      const refs = related.flatMap((snapshot) => snapshot.docs.map((item) => item.ref))
      for (let offset = 0; offset < refs.length; offset += 400) {
        const batch = writeBatch(db)
        refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref))
        await batch.commit()
      }
      const finalBatch = writeBatch(db)
      finalBatch.delete(doc(db, 'clubs', id))
      finalBatch.delete(doc(db, 'clubDirectory', id))
      const request = await getDoc(doc(db, 'clubDeletionRequests', id))
      if (request.exists()) finalBatch.delete(request.ref)
      await finalBatch.commit()
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

    async removeMember(clubId, uid) {
      const db = requireDb()
      const actor = requireAuth().currentUser?.uid
      if (!actor) throw new Error('You must be signed in to manage club members.')
      const actorProfile = await getDoc(doc(db, 'users', actor))
      if (actor === uid && actorProfile.data()?.role !== 'admin') throw new Error('Use Leave club to remove yourself.')
      await deleteDoc(doc(db, 'memberships', `${uid}_${clubId}`))
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
        // Do not read the target student's membership document here. Firestore rules
        // intentionally restrict reads of other students' memberships, and a read of
        // a missing membership document can fail before the approval can be committed.
        const latest = await transaction.get(requestRef)
        if (!latest.exists() || latest.data().status !== 'pending') throw new Error('This request has already been answered.')
        transaction.update(requestRef, { status: 'approved' })
        transaction.set(doc(db, 'memberships', `${uid}_${clubId}`), { uid, clubId, joinedAt: Date.now() })
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
        pinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    },

    async update(id, input) {
      await updateDoc(doc(requireDb(), 'announcements', id), { title: input.title, body: input.body, updatedAt: Date.now() })
    },

    async setPinned(id, pinned) {
      await updateDoc(doc(requireDb(), 'announcements', id), { pinned, updatedAt: Date.now() })
    },

    async getReactionSummary(announcementId, clubId, uid) {
      const db = requireDb()
      const snapshot = await getDocs(query(collection(db, 'announcementReactions'), where('announcementId', '==', announcementId), where('clubId', '==', clubId)))
      const counts: Record<string, number> = {}
      const peopleByEmoji: Record<string, string[]> = {}
      let mine: string | null = null
      await Promise.all(snapshot.docs.map(async (item) => {
        const data = item.data()
        const emoji = stringOr(data.emoji, '')
        const responderId = stringOr(data.uid, '')
        if (!emoji || !responderId) return
        counts[emoji] = (counts[emoji] ?? 0) + 1
        const profile = await getDoc(doc(db, 'userDirectory', responderId))
        const name = stringOr(profile.data()?.displayName, 'Member')
        ;(peopleByEmoji[emoji] ??= []).push(name)
        if (responderId === uid) mine = emoji
      }))
      for (const names of Object.values(peopleByEmoji)) names.sort((a, b) => a.localeCompare(b))
      return { counts, mine, peopleByEmoji }
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
        type: input.type ?? 'General Meeting',
        attendance: input.attendance ?? 'optional',
        createdBy: author.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      })
    },

    async update(id, input) {
      await updateDoc(doc(requireDb(), 'events', id), { ...input, updatedAt: Date.now() })
    },

    async getRsvpSummary(eventId, clubId, uid) {
      const db = requireDb()
      const snapshot = await getDocs(query(collection(db, 'eventRsvps'), where('eventId', '==', eventId), where('clubId', '==', clubId)))
      const summary: RsvpSummary = { going: 0, maybe: 0, notGoing: 0, mine: null, participants: [] }
      await Promise.all(snapshot.docs.map(async (item) => {
        const data = item.data()
        const status = data.status as EventRsvpStatus
        if (status === 'going') summary.going += 1
        if (status === 'maybe') summary.maybe += 1
        if (status === 'notGoing') summary.notGoing += 1
        const responderId = stringOr(data.uid, '')
        if (responderId === uid) summary.mine = status
        if (!responderId || !['going', 'maybe', 'notGoing'].includes(status)) return
        const profile = await getDoc(doc(db, 'userDirectory', responderId))
        summary.participants!.push({
          uid: responderId,
          displayName: stringOr(profile.data()?.displayName, 'Member'),
          status,
        })
      }))
      summary.participants!.sort((a, b) => a.displayName.localeCompare(b.displayName))
      return summary
    },

    async setRsvp(eventId, clubId, uid, status) {
      await setDoc(doc(requireDb(), 'eventRsvps', `${eventId}_${uid}`), { eventId, clubId, uid, status, updatedAt: Date.now() })
    },

    async remove(id) {
      await updateDoc(doc(requireDb(), 'events', id), { deletedAt: Date.now(), updatedAt: Date.now() })
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
      const db = requireDb()
      const [targetSnapshot, currentSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'clubSponsorRequests'), where('teacherId', '==', teacherId))),
        getDocs(query(collection(db, 'clubSponsorRequests'), where('previousSponsorId', '==', teacherId))),
      ])
      const requests = new Map([...targetSnapshot.docs, ...currentSnapshot.docs].map((item) => [item.id, toSponsorRequest(item.id, item.data())]))
      return [...requests.values()].sort(byNewest)
    },

    async create(club, teacher, requester) {
      const db = requireDb()
      const createdAt = Date.now()
      const requestRef = doc(collection(db, 'clubSponsorRequests'))
      const batch = writeBatch(db)
      batch.update(doc(db, 'clubs', club.id), {
        sponsorId: teacher.id, sponsorName: teacher.displayName, sponsorStatus: 'pending',
      })
      batch.update(doc(db, 'clubDirectory', club.id), { sponsorName: teacher.displayName })
      batch.set(requestRef, {
        clubId: club.id,
        clubName: club.name,
        teacherId: teacher.id,
        teacherName: teacher.displayName,
        requestedById: requester.id,
        requestedByName: requester.displayName,
        status: 'pending' satisfies SponsorRequestStatus,
        createdAt,
      })
      await batch.commit()
    },

    async requestChange(club, teacher, requester) {
      if (!club.sponsorId || club.sponsorStatus !== 'accepted') throw new Error('This club does not have an accepted sponsor to approve the change.')
      if (teacher.id === club.sponsorId) throw new Error('Choose a different teacher.')
      const db = requireDb()
      const requestRef = doc(db, 'clubSponsorRequests', `${club.id}_sponsor_change`)
      const existing = await getDoc(requestRef)
      if (existing.exists() && existing.data().status === 'pending') throw new Error('A sponsor change request is already pending.')
      await setDoc(requestRef, {
        clubId: club.id, clubName: club.name, teacherId: teacher.id, teacherName: teacher.displayName,
        requestedById: requester.id, requestedByName: requester.displayName,
        previousSponsorId: club.sponsorId, previousSponsorName: club.sponsorName,
        stage: 'currentSponsorApproval', status: 'pending', createdAt: Date.now(),
      })
    },

    async respond(requestId, status) {
      const db = requireDb()
      const requestRef = doc(db, 'clubSponsorRequests', requestId)
      const requestSnapshot = await getDoc(requestRef)
      if (!requestSnapshot.exists()) throw new Error('This sponsor request no longer exists.')
      const request = toSponsorRequest(requestSnapshot.id, requestSnapshot.data())
      if (request.stage === 'currentSponsorApproval') {
        const actorId = requireAuth().currentUser?.uid
        if (actorId !== request.previousSponsorId) throw new Error('Only the current sponsor can approve this change.')
        if (status === 'declined') {
          await updateDoc(requestRef, { status: 'declined' })
          return
        }
        await updateDoc(requestRef, { stage: 'newSponsorApproval' })
        return
      }
      const batch = writeBatch(db)
      batch.update(requestRef, { status })
      if (request.previousSponsorId) {
        if (status === 'accepted') {
          batch.update(doc(db, 'clubs', request.clubId), { sponsorId: request.teacherId, sponsorName: request.teacherName, sponsorStatus: 'accepted' })
          batch.update(doc(db, 'clubDirectory', request.clubId), { sponsorName: request.teacherName })
        }
      } else {
        batch.update(doc(db, 'clubs', request.clubId), {
          sponsorId: status === 'accepted' ? request.teacherId : '',
          sponsorName: status === 'accepted' ? request.teacherName : '',
          sponsorStatus: status,
        })
        batch.update(doc(db, 'clubDirectory', request.clubId), {
          sponsorName: status === 'accepted' ? request.teacherName : '',
        })
      }
      await batch.commit()
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

    async updateProfile(uid, input) {
      const db = requireDb()
      const profileRef = doc(db, 'users', uid)
      const directoryRef = doc(db, 'userDirectory', uid)
      const profile = await getDoc(profileRef)
      if (!profile.exists()) throw new Error('This user profile no longer exists.')
      const batch = writeBatch(db)
      batch.update(profileRef, {
        displayName: input.displayName.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        ...(input.grade.trim() ? { grade: input.grade.trim() } : { grade: deleteField() }),
      })
      batch.set(directoryRef, {
        displayName: input.displayName.trim(),
        role: input.role,
        createdAt: numberOr(profile.data().createdAt),
        nameLower: input.displayName.trim().toLocaleLowerCase(),
      }, { merge: true })
      await batch.commit()
      // The Firebase client SDK cannot change another user's Auth email. This updates
      // the ClubStack profile email only; the user's sign-in email remains unchanged.
    },

    async deleteAccount(uid) {
      const db = requireDb()
      const actorUid = requireAuth().currentUser?.uid
      if (!actorUid) throw new Error('You must be signed in to manage user accounts.')
      if (actorUid === uid) throw new Error('You cannot delete your own administrator account.')
      const profileRef = doc(db, 'users', uid)
      const profile = await getDoc(profileRef)
      if (!profile.exists()) throw new Error('This user profile no longer exists.')

      const [memberships, joinRequests, invited, sentInvites, reports, reactions, rsvps, sponsorRequests, sponsorRequestsAsTeacher, sponsorRequestsAsPreviousSponsor, deletionRequests, deletionReviews, authoredAnnouncements, authoredEvents, clubsAsLeader, clubsAsSponsor, clubsAsOfficer] = await Promise.all([
        getDocs(query(collection(db, 'memberships'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'clubJoinRequests'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'officerInvitations'), where('invitedUserId', '==', uid))),
        getDocs(query(collection(db, 'officerInvitations'), where('invitedById', '==', uid))),
        getDocs(query(collection(db, 'moderationReports'), where('reporterId', '==', uid))),
        getDocs(query(collection(db, 'announcementReactions'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'eventRsvps'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'clubSponsorRequests'), where('requestedById', '==', uid))),
        getDocs(query(collection(db, 'clubSponsorRequests'), where('teacherId', '==', uid))),
        getDocs(query(collection(db, 'clubSponsorRequests'), where('previousSponsorId', '==', uid))),
        getDocs(query(collection(db, 'clubDeletionRequests'), where('requestedById', '==', uid))),
        getDocs(query(collection(db, 'clubDeletionRequests'), where('reviewedById', '==', uid))),
        getDocs(query(collection(db, 'announcements'), where('authorId', '==', uid))),
        getDocs(query(collection(db, 'events'), where('createdBy', '==', uid))),
        getDocs(query(collection(db, 'clubs'), where('leaderId', '==', uid))),
        getDocs(query(collection(db, 'clubs'), where('sponsorId', '==', uid))),
        getDocs(query(collection(db, 'clubs'), where('officerIds', 'array-contains', uid))),
      ])

      const authoredAnnouncementReactions = (await Promise.all(authoredAnnouncements.docs.map(item =>
        getDocs(query(collection(db, 'announcementReactions'), where('announcementId', '==', item.id)))
      ))).flatMap(snapshot => snapshot.docs)
      const authoredEventRsvps = (await Promise.all(authoredEvents.docs.map(item =>
        getDocs(query(collection(db, 'eventRsvps'), where('eventId', '==', item.id)))
      ))).flatMap(snapshot => snapshot.docs)
      const related = [...new Map([
        ...memberships.docs, ...joinRequests.docs, ...invited.docs, ...sentInvites.docs,
        ...reports.docs, ...reactions.docs, ...rsvps.docs, ...sponsorRequests.docs,
        ...sponsorRequestsAsTeacher.docs, ...sponsorRequestsAsPreviousSponsor.docs,
        ...deletionRequests.docs, ...deletionReviews.docs, ...authoredAnnouncements.docs,
        ...authoredEvents.docs, ...authoredAnnouncementReactions, ...authoredEventRsvps,
      ].map(item => [item.ref.path, item])).values()]
      for (let offset = 0; offset < related.length; offset += 400) {
        const batch = writeBatch(db)
        related.slice(offset, offset + 400).forEach(item => batch.delete(item.ref))
        await batch.commit()
      }

      const affectedClubs = new Map<string, { ref: typeof clubsAsLeader.docs[number]['ref']; data: Record<string, unknown> }>()
      for (const snapshot of [clubsAsLeader, clubsAsSponsor, clubsAsOfficer]) {
        for (const item of snapshot.docs) affectedClubs.set(item.id, { ref: item.ref, data: item.data() })
      }
      const clubEntries = [...affectedClubs.entries()]
      for (let offset = 0; offset < clubEntries.length; offset += 200) {
        const batch = writeBatch(db)
        for (const [clubId, entry] of clubEntries.slice(offset, offset + 200)) {
          const wasLeader = entry.data.leaderId === uid
          const wasSponsor = entry.data.sponsorId === uid
          const officers = Array.isArray(entry.data.officers)
            ? entry.data.officers.filter(item => !!item && typeof item === 'object' && (item as Record<string, unknown>).uid !== uid)
            : []
          const officerIds = Array.isArray(entry.data.officerIds)
            ? entry.data.officerIds.filter(id => id !== uid)
            : []
          const patch: Record<string, unknown> = { officers, officerIds }
          if (wasLeader) Object.assign(patch, { leaderId: '', leaderName: 'Unassigned', leaderTitle: 'Club Owner', pendingLeaderTransfer: null })
          if (wasSponsor) Object.assign(patch, { sponsorId: '', sponsorName: '', sponsorStatus: 'none' })
          batch.update(entry.ref, patch)
          const directoryRef = doc(db, 'clubDirectory', clubId)
          const directory = await getDoc(directoryRef)
          if (directory.exists()) {
            batch.set(directoryRef, {
              ...(wasLeader ? { leaderName: 'Unassigned' } : {}),
              ...(wasSponsor ? { sponsorName: '' } : {}),
            }, { merge: true })
          }
        }
        await batch.commit()
      }

      const batch = writeBatch(db)
      batch.set(doc(db, 'disabledUsers', uid), { uid, disabledAt: Date.now(), disabledBy: actorUid })
      batch.delete(doc(db, 'userDirectory', uid))
      batch.delete(profileRef)
      await batch.commit()
      // The minimal disabledUsers tombstone blocks profile recreation. Firebase's client
      // SDK cannot delete another user's Authentication record.
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
