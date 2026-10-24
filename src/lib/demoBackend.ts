import type { ClubStackApi } from './backend'
import { createDemoStore, DEMO_PASSWORD, DEMO_USERS, type DemoStore } from './demoSeed'
import type { AppUser, Club, ClubSponsorRequest, ModerationReport, ReportStatus, Role, SponsorRequestStatus, RsvpSummary } from './types'

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
        for (const club of parsed.clubs) { if (typeof club.requiresApproval !== 'boolean') club.requiresApproval = false; if (typeof club.membersVisible !== 'boolean') club.membersVisible = true }
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
      return [...read().clubs].sort((a, b) => b.createdAt - a.createdAt)
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

    async update(id, patch) {
      await wait()
      mutate((store) => updateClub(store, id, patch))
    },

    async setStatus(id, status) {
      await wait()
      mutate((store) => updateClub(store, id, { status }))
    },

    async delete(id) {
      await wait()
      mutate((store) => {
        store.clubs = store.clubs.filter((club) => club.id !== id)
        store.memberships = store.memberships.filter((item) => item.clubId !== id)
        store.announcements = store.announcements.filter((item) => item.clubId !== id)
        store.events = store.events.filter((item) => item.clubId !== id)
        store.sponsorRequests = store.sponsorRequests.filter((item) => item.clubId !== id)
        store.officerInvitations = store.officerInvitations.filter((item) => item.clubId !== id)
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

    async getReactionSummary(announcementId, clubId, uid) {
      await wait()
      const reactions = read().announcementReactions.filter((item) => item.announcementId === announcementId && item.clubId === clubId)
      const counts: Record<string, number> = {}
      let mine: string | null = null
      for (const reaction of reactions) { counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1; if (reaction.uid === uid) mine = reaction.emoji }
      return { counts, mine }
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
          createdBy: author.id,
          createdAt: Date.now(),
        })
      })
    },

    async getRsvpSummary(eventId, clubId, uid) {
      await wait()
      const rsvps = read().eventRsvps.filter((item) => item.eventId === eventId && item.clubId === clubId)
      const summary: RsvpSummary = { going: 0, maybe: 0, notGoing: 0, mine: null }
      for (const item of rsvps) { if (item.status === 'going') summary.going++; else if (item.status === 'maybe') summary.maybe++; else summary.notGoing++; if (item.uid === uid) summary.mine = item.status }
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
      mutate((store) => {
        store.events = store.events.filter((event) => event.id !== id)
        store.eventRsvps = store.eventRsvps.filter((rsvp) => rsvp.eventId !== id)
      })
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

    async respond(requestId, status: Extract<SponsorRequestStatus, 'accepted' | 'declined'>) {
      await wait()
      mutate((store) => {
        const request = store.sponsorRequests.find((item) => item.id === requestId)
        if (!request) throw new Error('This sponsor request no longer exists.')
        request.status = status
        updateClub(store, request.clubId, {
          sponsorId: status === 'accepted' ? request.teacherId : '',
          sponsorName: status === 'accepted' ? request.teacherName : '',
          sponsorStatus: status,
        })
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

