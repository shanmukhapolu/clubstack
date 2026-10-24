import type { ClubStackApi } from './backend'
import { createDemoStore, DEMO_PASSWORD, DEMO_USERS, type DemoStore } from './demoSeed'
import type { AppUser, Club, ClubDeletionRequest, ClubDeletionStatus, ClubSponsorRequest, ModerationReport, ReportStatus, Role, SponsorRequestStatus, RsvpSummary } from './types'

const STORAGE_KEY = 'clubstack.demo.v1'
const RESEED_AFTER_MS = 1000 * 60 * 60 * 24 * 14

let memoryStore: DemoStore | null = null
let listeners = new Set<(user: AppUser | null) => void>()

function load(): DemoStore {
  if (typeof window === 'undefined') {
    memoryStore ??= createDemoStore()
    return memoryStore
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore
      if (
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.clubs) &&
        Date.now() - parsed.seededAt < RESEED_AFTER_MS
      ) {
        if (!Array.isArray(parsed.reports)) parsed.reports = []
        if (!Array.isArray(parsed.sponsorRequests)) parsed.sponsorRequests = []
        if (!Array.isArray(parsed.officerInvitations)) parsed.officerInvitations = []
        if (!Array.isArray(parsed.joinRequests)) parsed.joinRequests = []
        if (!Array.isArray(parsed.announcementReactions)) parsed.announcementReactions = []
        if (!Array.isArray(parsed.eventRsvps)) parsed.eventRsvps = []
        if (!Array.isArray(parsed.deletionRequests)) parsed.deletionRequests = []
        for (const club of parsed.clubs) {
          if (typeof club.requiresApproval !== 'boolean') club.requiresApproval = false
          if (typeof club.membersVisible !== 'boolean') club.membersVisible = true
          if (!club.meetingFrequency) club.meetingFrequency = club.meetingDay === 'Flexible' ? 'custom' : 'weekly'
          if (!club.meetingOrdinal) club.meetingOrdinal = 'first'
          if (typeof club.customMeetingSchedule !== 'string') club.customMeetingSchedule = ''
          if (typeof club.prerequisites !== 'string') club.prerequisites = ''
          if (typeof club.dues !== 'string') club.dues = ''
          if (typeof club.instagramHandle !== 'string') club.instagramHandle = ''
        }
        return parsed
      }
    }
  } catch {
    // Fall through to a fresh store.
  }

  const fresh = createDemoStore()
  save(fresh)
  return fresh
}

function save(store: DemoStore): void {
  memoryStore = store
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Demo data is disposable; keep it in memory when storage is unavailable.
  }
}

function read(): DemoStore {
  return memoryStore ?? load()
}

function mutate(updater: (store: DemoStore) => void): DemoStore {
  const store = read()
  updater(store)
  save(store)
  return store
}

function currentUser(store: DemoStore): AppUser | null {
  return store.users.find((user) => user.id === store.currentUid) ?? null
}

function emit(): void {
  const user = currentUser(read())
  listeners.forEach((listener) => listener(user))
}

function requireUser(store: DemoStore): AppUser {
  const user = currentUser(store)
  if (!user) throw new Error('You must be signed in for that.')
  return user
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 120))
}

function sortByStart(a: { startAt: number }, b: { startAt: number }): number {
  return a.startAt - b.startAt
}

function updateClub(store: DemoStore, clubId: string, patch: Partial<Club>): void {
  store.clubs = store.clubs.map((club) => (club.id === clubId ? { ...club, ...patch } : club))
}

export const demoApi: ClubStackApi = {
  mode: 'demo',

  auth: {
    subscribe(callback) {
      listeners.add(callback)
      callback(currentUser(read()))
      return () => {
        listeners.delete(callback)
      }
    },

    async signIn(email, password) {
      await wait()
      if (password !== DEMO_PASSWORD) {
        throw new Error(`The demo password is “${DEMO_PASSWORD}”.`)
      }
      const store = read()
      const user = store.users.find(
        (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
      )
      if (!user) {
        throw new Error(
          'That email is not part of the demo. Use one of the demo accounts listed on this page.',
        )
      }
      mutate((draft) => {
        draft.currentUid = user.id
      })
      emit()
    },

    async signUp(name, email, _password, role: Role) {
      await wait()
      const id = `u-${Math.random().toString(36).slice(2, 10)}`
      const user: AppUser = {
        id,
        displayName: name.trim() || 'New Student',
        email: email.trim() || `${id}@student.northgate.edu`,
        role,
        createdAt: Date.now(),
      }
      mutate((draft) => {
        draft.users.push(user)
        draft.currentUid = id
      })
      emit()
    },

    async signInWithGoogle() {
      throw new Error('Google sign-in needs a real Firebase project. Use a demo account below.')
    },

    async signOut() {
      mutate((draft) => {
        draft.currentUid = null
      })
      emit()
    },
  },

  clubs: {
    async list() {
      await wait()
      const store = read()
      const user = currentUser(store)
      if (!user) return []
      const memberIds = new Set(store.memberships.filter((membership) => membership.uid === user.id).map((membership) => membership.clubId))
      return [...store.clubs.filter((club) => user.role === 'admin' || !club.hidden || memberIds.has(club.id) || club.leaderId === user.id || (club.officerIds ?? []).includes(user.id) || club.sponsorId === user.id)].sort((a, b) => b.createdAt - a.createdAt)
    },

    async get(id) {
      await wait()
      return read().clubs.find((club) => club.id === id) ?? null
    },

    async create(input, leader) {
      await wait()
      const id = `${input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 6)}`
      const club: Club = {
        ...input,
        id,
        status: 'pending',
        leaderId: leader.id,
        leaderName: leader.displayName,
        leaderTitle: input.leaderTitle || 'President',
        officers: [],
        officerIds: [],
        sponsorId: input.sponsorId ?? '',
        sponsorName: input.sponsorName ?? '',
        sponsorStatus: input.sponsorId ? 'pending' : 'none',
        meetingFrequency: input.meetingFrequency ?? (input.meetingDay === 'Flexible' ? 'custom' : 'weekly'),
        meetingOrdinal: input.meetingOrdinal ?? 'first',
        customMeetingSchedule: input.customMeetingSchedule ?? '',
        prerequisites: input.prerequisites ?? '',
        dues: input.dues ?? '',
        instagramHandle: (input.instagramHandle ?? '').replace(/^@+/, '').trim(),
        memberCount: 1,
        requiresApproval: false,
        membersVisible: true,
        createdAt: Date.now(),
      }
      mutate((store) => {
        store.clubs.unshift(club)
        if (input.sponsorId) {
          store.sponsorRequests.unshift({
            id: `sr-${Math.random().toString(36).slice(2, 10)}`,
            clubId: id, clubName: club.name, teacherId: input.sponsorId,
            teacherName: input.sponsorName, requestedById: leader.id,
            requestedByName: leader.displayName, status: 'pending', createdAt: Date.now(),
          })
        }
        store.memberships.push({
          id: `${leader.id}_${id}`,
          uid: leader.id,
          clubId: id,
          joinedAt: Date.now(),
        })
      })
      return id
    },

    async removeOfficer(id, officerId) {
      await wait()
      const store = read()
      const actor = requireUser(store)
      const club = store.clubs.find((item) => item.id === id)
      if (!club || !(actor.role === 'admin' || club.leaderId === actor.id)) throw new Error('Only the club leader or an administrator can remove officers.')
      mutate((draft) => updateClub(draft, id, {
        officers: club.officers.filter((item) => item.uid !== officerId),
        officerIds: club.officerIds.filter((uid) => uid !== officerId),
      }))
    },

    async update(id, patch) {
      await wait()
      mutate((store) => updateClub(store, id, patch))
    },

    async setStatus(id, status) {
      await wait()
      mutate((store) => updateClub(store, id, { status }))
    },

    async transferOwnership(id, newLeaderId, currentLeader) {
      await wait()
      const store = read()
      const club = store.clubs.find((item) => item.id === id)
      if (!club || club.leaderId !== currentLeader.id) throw new Error('Only the current club leader can request an ownership transfer.')
      const target = club.officers.find((officer) => officer.uid === newLeaderId)
      if (!target || store.users.find((person) => person.id === newLeaderId)?.role !== 'student') throw new Error('Choose an existing student officer to become the new leader.')
      if (club.pendingLeaderTransfer) throw new Error('An ownership transfer is already awaiting a response.')
      mutate((draft) => updateClub(draft, id, { pendingLeaderTransfer: { fromId: currentLeader.id, fromName: currentLeader.displayName, toId: target.uid, toName: target.displayName, createdAt: Date.now() } }))
    },

    async respondToOwnershipTransfer(id, accept, currentUser) {
      await wait()
      const store = read()
      const club = store.clubs.find((item) => item.id === id)
      const transfer = club?.pendingLeaderTransfer
      if (!club || !transfer || transfer.toId !== currentUser.id) throw new Error('This ownership transfer is not addressed to your account.')
      if (!accept) {
        mutate((draft) => updateClub(draft, id, { pendingLeaderTransfer: null }))
        return
      }
      const target = club.officers.find((officer) => officer.uid === currentUser.id)
      if (club.leaderId !== transfer.fromId || !target) throw new Error('The club leadership changed before this transfer could be accepted.')
      mutate((draft) => updateClub(draft, id, {
        leaderId: currentUser.id,
        leaderName: currentUser.displayName,
        leaderTitle: 'President',
        officers: [...club.officers.filter((officer) => officer.uid !== currentUser.id && officer.uid !== transfer.fromId), { uid: transfer.fromId, displayName: transfer.fromName, email: '', title: 'Former President' }],
        officerIds: [...new Set(club.officerIds.filter((uid) => uid !== currentUser.id).concat(transfer.fromId))],
        pendingLeaderTransfer: null,
      }))
    },

    async getDeletionRequest(id) {
      await wait()
      return read().deletionRequests.find((item) => item.clubId === id) ?? null
    },

    async requestDeletion(id, currentLeader) {
      await wait()
      const store = read()
      const club = store.clubs.find((item) => item.id === id)
      if (!club || club.leaderId !== currentLeader.id) throw new Error('Only the club leader can request deletion.')
      if (!club.sponsorId || club.sponsorStatus !== 'accepted') throw new Error('Confirm a teacher advisor before requesting deletion approval.')
      const existing = store.deletionRequests.find((item) => item.clubId === id)
      if (existing?.status === 'pending') throw new Error('A deletion request is already awaiting the teacher advisor.')
      if (existing?.status === 'approved') throw new Error('The advisor approved deletion. Use the permanent delete action instead.')
      const request: ClubDeletionRequest = {
        id,
        clubId: id,
        clubName: club.name,
        requestedById: currentLeader.id,
        requestedByName: currentLeader.displayName,
        status: 'pending',
        createdAt: Date.now(),
      }
      mutate((draft) => {
        draft.deletionRequests = draft.deletionRequests.filter((item) => item.clubId !== id)
        draft.deletionRequests.push(request)
      })
    },

    async respondToDeletionRequest(id, status: Extract<ClubDeletionStatus, 'approved' | 'declined'>, advisor) {
      await wait()
      if (advisor.role !== 'teacher') throw new Error('Only a teacher advisor can approve club deletion.')
      mutate((store) => {
        const club = store.clubs.find((item) => item.id === id)
        const request = store.deletionRequests.find((item) => item.clubId === id)
        if (!club || club.sponsorId !== advisor.id || club.sponsorStatus !== 'accepted') throw new Error('Only the accepted teacher advisor can review this request.')
        if (!request || request.status !== 'pending') throw new Error('This deletion request has already been reviewed or does not exist.')
        request.status = status
        request.reviewedAt = Date.now()
        request.reviewedById = advisor.id
      })
    },

    async delete(id) {
      await wait()
      const store = read()
      const user = requireUser(store)
      const club = store.clubs.find((item) => item.id === id)
      if (!club) return
      if (user.role !== 'admin' && store.deletionRequests.find((item) => item.clubId === id)?.status !== 'approved') {
        throw new Error('The teacher advisor must approve deletion before this club can be deleted.')
      }
      mutate((draft) => {
        draft.clubs = draft.clubs.filter((item) => item.id !== id)
        draft.memberships = draft.memberships.filter((item) => item.clubId !== id)
        draft.announcements = draft.announcements.filter((item) => item.clubId !== id)
        draft.events = draft.events.filter((item) => item.clubId !== id)
        draft.sponsorRequests = draft.sponsorRequests.filter((item) => item.clubId !== id)
        draft.officerInvitations = draft.officerInvitations.filter((item) => item.clubId !== id)
        draft.joinRequests = draft.joinRequests.filter((item) => item.clubId !== id)
        draft.announcementReactions = draft.announcementReactions.filter((item) => item.clubId !== id)
        draft.eventRsvps = draft.eventRsvps.filter((item) => item.clubId !== id)
        draft.deletionRequests = draft.deletionRequests.filter((item) => item.clubId !== id)
      })
    },
  },

  memberships: {
    async listMine(uid) {
      await wait()
      return read()
        .memberships.filter((membership) => membership.uid === uid)
        .map((membership) => membership.clubId)
    },

    async listMembers(clubId) {
      await wait()
      return read().memberships.filter((membership) => membership.clubId === clubId).map((membership) => membership.uid)
    },

    async removeMember(clubId, uid) {
      await wait()
      const current = read()
      const actor = requireUser(current)
      const club = current.clubs.find((item) => item.id === clubId)
      if (!club) throw new Error('This club no longer exists.')
      if (!(actor.role === 'admin' || club.leaderId === actor.id || (club.officerIds ?? []).includes(actor.id) || (club.sponsorId === actor.id && club.sponsorStatus === 'accepted'))) throw new Error('Only club managers can remove members.')
      if (actor.id === uid) throw new Error('Use Leave club to remove yourself.')
      mutate((draft) => {
        draft.memberships = draft.memberships.filter((membership) => !(membership.clubId === clubId && membership.uid === uid))
        draft.clubs = draft.clubs.map((item) => item.id === clubId ? { ...item, memberCount: Math.max(0, item.memberCount - 1) } : item)
      })
    },

    async listRequestsForClub(clubId) {
      await wait()
      return read().joinRequests.filter((request) => request.clubId === clubId).sort((a, b) => b.createdAt - a.createdAt)
    },

    async listRequestsForUser(uid) {
      await wait()
      return read().joinRequests.filter((request) => request.uid === uid).sort((a, b) => b.createdAt - a.createdAt)
    },

    async respondToRequest(requestId, status) {
      await wait()
      const current = read()
      const request = current.joinRequests.find((item) => item.id === requestId)
      const actor = requireUser(current)
      if (!request || request.status !== 'pending') throw new Error('This membership request is no longer pending.')
      const club = current.clubs.find((item) => item.id === request.clubId)
      if (!club) throw new Error('This club no longer exists.')
      if (!(actor.role === 'admin' || club.leaderId === actor.id || (club.sponsorId === actor.id && club.sponsorStatus === 'accepted') || (club.officerIds ?? []).includes(actor.id))) throw new Error('Only club managers can review membership requests.')
      mutate((store) => {
        const target = store.joinRequests.find((item) => item.id === requestId)
        if (!target || target.status !== 'pending') throw new Error('This request is no longer pending.')
        target.status = status
        if (status === 'approved' && !store.memberships.some((m) => m.uid === target.uid && m.clubId === target.clubId)) {
          store.memberships.push({ id: `${target.uid}_${target.clubId}`, uid: target.uid, clubId: target.clubId, joinedAt: Date.now() })
          const targetClub = store.clubs.find((item) => item.id === target.clubId)
          if (targetClub) targetClub.memberCount += 1
        }
      })
    },

    async join(clubId) {
      await wait()
      const store = read()
      const user = requireUser(store)
      const club = store.clubs.find((candidate) => candidate.id === clubId)
      if (!club) throw new Error('That club no longer exists.')
      if (club.status !== 'approved') throw new Error('This club is not open for joining yet.')
      if (store.memberships.some((m) => m.uid === user.id && m.clubId === clubId)) return
      if (club.requiresApproval) {
        if (store.joinRequests.some((r) => r.uid === user.id && r.clubId === clubId && r.status === 'pending')) return
        mutate((draft) => {
          draft.joinRequests = draft.joinRequests.filter((r) => !(r.uid === user.id && r.clubId === clubId))
          draft.joinRequests.unshift({ id: `${clubId}_${user.id}`, clubId, clubName: club.name, uid: user.id, displayName: user.displayName, status: 'pending', createdAt: Date.now() })
        })
        return
      }

      mutate((draft) => {
        draft.memberships.push({
          id: `${user.id}_${clubId}`,
          uid: user.id,
          clubId,
          joinedAt: Date.now(),
        })
        draft.clubs = draft.clubs.map((candidate) =>
          candidate.id === clubId
            ? { ...candidate, memberCount: candidate.memberCount + 1 }
            : candidate,
        )
      })
    },

    async leave(clubId) {
      await wait()
      const store = read()
      const user = requireUser(store)
      if (!store.memberships.some((m) => m.uid === user.id && m.clubId === clubId)) return

      mutate((draft) => {
        draft.memberships = draft.memberships.filter(
          (membership) => !(membership.uid === user.id && membership.clubId === clubId),
        )
        draft.clubs = draft.clubs.map((candidate) =>
          candidate.id === clubId
            ? { ...candidate, memberCount: Math.max(0, candidate.memberCount - 1) }
            : candidate,
        )
      })
    },
  },

  announcements: {
    async listForClubs(clubIds) {
      await wait()
      if (clubIds.length === 0) return []
      const wanted = new Set(clubIds)
      return read()
        .announcements.filter((announcement) => wanted.has(announcement.clubId))
        .sort((a, b) => b.createdAt - a.createdAt)
    },

    async create(clubId, input, author) {
      await wait()
      mutate((store) => {
        store.announcements.unshift({
          id: `a-${Math.random().toString(36).slice(2, 10)}`,
          clubId,
          title: input.title,
          body: input.body,
          authorId: author.id,
          authorName: author.displayName,
          createdAt: Date.now(),
        })
      })
    },

    async setPinned(id, pinned) {
      await wait()
      mutate((store) => { store.announcements = store.announcements.map((item) => item.id === id ? { ...item, pinned, updatedAt: Date.now() } : item) })
    },

    async getReactionSummary(announcementId, clubId, uid) {
      await wait()
      const store = read()
      const reactions = store.announcementReactions.filter((item) => item.announcementId === announcementId && item.clubId === clubId)
      const counts: Record<string, number> = {}
      const peopleByEmoji: Record<string, string[]> = {}
      let mine: string | null = null
      for (const reaction of reactions) {
        counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1
        const name = store.users.find((person) => person.id === reaction.uid)?.displayName ?? 'Member'
        ;(peopleByEmoji[reaction.emoji] ??= []).push(name)
        if (reaction.uid === uid) mine = reaction.emoji
      }
      for (const names of Object.values(peopleByEmoji)) names.sort((a, b) => a.localeCompare(b))
      return { counts, mine, peopleByEmoji }
    },

    async setReaction(announcementId, clubId, uid, emoji) {
      await wait()
      mutate((store) => {
        store.announcementReactions = store.announcementReactions.filter((item) => !(item.announcementId === announcementId && item.uid === uid))
        if (emoji) store.announcementReactions.push({ id: `${announcementId}_${uid}`, announcementId, clubId, uid, emoji, createdAt: Date.now() })
      })
    },

    async remove(id) {
      await wait()
      mutate((store) => {
        store.announcements = store.announcements.filter((item) => item.id !== id)
        store.announcementReactions = store.announcementReactions.filter((item) => item.announcementId !== id)
      })
    },
  },

  events: {
    async listAll() {
      await wait()
      const store = read()
      const user = currentUser(store)
      if (!user) return []
      const visible = user.role === 'admin' ? new Set(store.clubs.map((club) => club.id)) : new Set([
        ...store.memberships.filter((membership) => membership.uid === user.id).map((membership) => membership.clubId),
        ...store.clubs.filter((club) => club.leaderId === user.id || (club.officerIds ?? []).includes(user.id) || (club.sponsorId === user.id && club.sponsorStatus === 'accepted')).map((club) => club.id),
      ])
      return store.events.filter((event) => visible.has(event.clubId)).sort(sortByStart)
    },

    async listForClubs(clubIds) {
      await wait()
      if (clubIds.length === 0) return []
      const wanted = new Set(clubIds)
      return read()
        .events.filter((event) => wanted.has(event.clubId))
        .sort(sortByStart)
    },

    async create(clubId, input, author) {
      await wait()
      mutate((store) => {
        store.events.push({
          id: `e-${Math.random().toString(36).slice(2, 10)}`,
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
      })
    },

    async update(id, input) {
      await wait()
      mutate((store) => { store.events = store.events.map((item) => item.id === id ? { ...item, ...input, updatedAt: Date.now() } : item) })
    },

    async getRsvpSummary(eventId, clubId, uid) {
      await wait()
      const store = read()
      const rsvps = store.eventRsvps.filter((item) => item.eventId === eventId && item.clubId === clubId)
      const participants = rsvps.map((item) => ({
        uid: item.uid,
        displayName: store.users.find((person) => person.id === item.uid)?.displayName ?? 'Member',
        status: item.status,
      })).sort((a, b) => a.displayName.localeCompare(b.displayName))
      const summary: RsvpSummary = { going: 0, maybe: 0, notGoing: 0, mine: null, participants }
      for (const item of rsvps) {
        if (item.status === 'going') summary.going++
        else if (item.status === 'maybe') summary.maybe++
        else summary.notGoing++
        if (item.uid === uid) summary.mine = item.status
      }
      return summary
    },

    async setRsvp(eventId, clubId, uid, status) {
      await wait()
      mutate((store) => {
        store.eventRsvps = store.eventRsvps.filter((item) => !(item.eventId === eventId && item.uid === uid))
        store.eventRsvps.push({ id: `${eventId}_${uid}`, eventId, clubId, uid, status, updatedAt: Date.now() })
      })
    },

    async remove(id) {
      await wait()
      mutate((store) => { store.events = store.events.map((event) => event.id === id ? { ...event, deletedAt: Date.now(), updatedAt: Date.now() } : event) })
    },
  },

  moderation: {
    async list() {
      await wait()
      return [...read().reports].sort((a, b) => b.createdAt - a.createdAt)
    },

    async listMine(uid) {
      await wait()
      return [...read().reports].filter((report) => report.reporterId === uid).sort((a, b) => b.createdAt - a.createdAt)
    },

    async create(input, reporter) {
      await wait()
      mutate((store) => {
        const report: ModerationReport = {
          id: `r-${Math.random().toString(36).slice(2, 10)}`,
          ...input,
          reporterId: reporter.id,
          reporterName: reporter.displayName,
          status: 'open',
          createdAt: Date.now(),
        }
        store.reports.unshift(report)
      })
    },

    async setStatus(id, status: ReportStatus) {
      await wait()
      mutate((store) => {
        store.reports = store.reports.map((report) => report.id === id ? { ...report, status } : report)
      })
    },
  },

  sponsorRequests: {
    async listForTeacher(teacherId) {
      await wait()
      return read().sponsorRequests.filter((request) => request.teacherId === teacherId).sort((a, b) => b.createdAt - a.createdAt)
    },

    async create(club, teacher, requester) {
      await wait()
      const request: ClubSponsorRequest = {
        id: `sr-${Math.random().toString(36).slice(2, 10)}`,
        clubId: club.id, clubName: club.name, teacherId: teacher.id,
        teacherName: teacher.displayName, requestedById: requester.id,
        requestedByName: requester.displayName, status: 'pending', createdAt: Date.now(),
      }
      mutate((store) => {
        store.sponsorRequests.unshift(request)
        updateClub(store, club.id, { sponsorId: teacher.id, sponsorName: teacher.displayName, sponsorStatus: 'pending' })
      })
    },

    async requestChange(club, teacher, requester) {
      await wait()
      if (!club.sponsorId || club.sponsorStatus !== 'accepted') throw new Error('This club does not have an accepted sponsor to approve the change.')
      if (teacher.id === club.sponsorId) throw new Error('Choose a different teacher.')
      const request: ClubSponsorRequest = { id: `sr-${Math.random().toString(36).slice(2, 10)}`, clubId: club.id, clubName: club.name, teacherId: teacher.id, teacherName: teacher.displayName, requestedById: requester.id, requestedByName: requester.displayName, previousSponsorId: club.sponsorId, previousSponsorName: club.sponsorName, stage: 'currentSponsorApproval', status: 'pending', createdAt: Date.now() }
      mutate((store) => { store.sponsorRequests.unshift(request) })
    },

    async respond(requestId, status: Extract<SponsorRequestStatus, 'accepted' | 'declined'>) {
      await wait()
      mutate((store) => {
        const request = store.sponsorRequests.find((item) => item.id === requestId)
        if (!request) throw new Error('This sponsor request no longer exists.')
        if (request.stage === 'currentSponsorApproval') {
          if (currentUser(store).id !== request.previousSponsorId) throw new Error('Only the current sponsor can approve this change.')
          if (status === 'declined') { request.status = 'declined'; return }
          request.stage = 'newSponsorApproval'
          return
        }
        request.status = status
        if (request.previousSponsorId) {
          if (status === 'accepted') updateClub(store, request.clubId, { sponsorId: request.teacherId, sponsorName: request.teacherName, sponsorStatus: 'accepted' })
        } else {
          updateClub(store, request.clubId, { sponsorId: status === 'accepted' ? request.teacherId : '', sponsorName: status === 'accepted' ? request.teacherName : '', sponsorStatus: status })
        }
      })
    },
  },

  officerInvitations: {
    async listForUser(uid) {
      await wait()
      return [...read().officerInvitations].filter((item) => item.invitedUserId === uid).sort((a, b) => b.createdAt - a.createdAt)
    },
    async listForClub(clubId) {
      await wait()
      return [...read().officerInvitations].filter((item) => item.clubId === clubId).sort((a, b) => b.createdAt - a.createdAt)
    },
    async create(clubId, clubName, officer, inviter) {
      await wait()
      const id = `${clubId}_${officer.uid}`
      mutate((store) => {
        store.officerInvitations = store.officerInvitations.filter((item) => item.id !== id)
        store.officerInvitations.unshift({ id, clubId, clubName, invitedUserId: officer.uid, invitedUserName: officer.displayName, invitedById: inviter.id, invitedByName: inviter.displayName, title: officer.title, status: 'pending', createdAt: Date.now() })
      })
    },
    async respond(invitationId, status) {
      await wait()
      const store = read()
      const invitation = store.officerInvitations.find((item) => item.id === invitationId)
      const user = requireUser(store)
      if (!invitation || invitation.invitedUserId !== user.id) throw new Error('This invitation is not available to your account.')
      if (invitation.status !== 'pending') throw new Error('This invitation has already been answered.')
      mutate((draft) => {
        const current = draft.officerInvitations.find((item) => item.id === invitationId)
        if (!current) return
        current.status = status
        if (status === 'accepted') {
          const club = draft.clubs.find((item) => item.id === current.clubId)
          if (!club) throw new Error('The club no longer exists.')
          const alreadyMember = draft.memberships.some(item => item.uid === current.invitedUserId && item.clubId === current.clubId)
          if (!alreadyMember) {
            draft.memberships.push({
              id: `${current.invitedUserId}_${current.clubId}`,
              uid: current.invitedUserId,
              clubId: current.clubId,
              joinedAt: Date.now(),
            })
          }
          updateClub(draft, current.clubId, {
            officers: [...(club.officers ?? []).filter((item) => item.uid !== current.invitedUserId), { uid: current.invitedUserId, displayName: current.invitedUserName, email: '', title: current.title }],
            officerIds: [...new Set([...(club.officerIds ?? []), current.invitedUserId])],
            memberCount: club.memberCount + (alreadyMember ? 0 : 1),
          })
        }
      })
    },
  },

  users: {
    async list() {
      await wait()
      return [...read().users].sort((a, b) => a.displayName.localeCompare(b.displayName))
    },

    async listDirectory() {
      await wait()
      return [...read().users].sort((a, b) => a.displayName.localeCompare(b.displayName))
    },

    async searchDirectory(prefix, role, maxResults = 15) {
      await wait()
      const needle = prefix.trim().toLocaleLowerCase()
      if (needle.length < 2) return []
      const resultLimit = Math.max(1, Math.min(100, Math.floor(maxResults)))
      return [...read().users].filter((person) => person.role === role && person.displayName.toLocaleLowerCase().startsWith(needle)).sort((a, b) => a.displayName.localeCompare(b.displayName)).slice(0, resultLimit)
    },

    async setRole(uid, role) {
      await wait()
      mutate((store) => {
        store.users = store.users.map((user) => (user.id === uid ? { ...user, role } : user))
      })
      emit()
    },
  },

  demo: {
    accounts: DEMO_USERS.map((user) => ({
      user,
      label:
        user.role === 'admin' ? 'Admin' : user.role === 'teacher' ? 'Teacher' : user.id === 'u-marcus' ? 'Club leader' : 'Student',
      description:
        user.role === 'admin'
          ? 'Approve clubs, moderate reports, manage roles.'
          : user.role === 'teacher'
            ? 'Review school-wide club activity and report concerns.'
            : user.id === 'u-marcus'
            ? 'Runs the Robotics Collective; can post updates and events.'
            : 'Member of 3 clubs; can discover and join more.',
    })),
    async signInAs(uid) {
      await wait()
      mutate((store) => {
        store.currentUid = uid
      })
      emit()
    },
  },
}

