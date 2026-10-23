import type { ClubStackApi } from './backend'
import { createDemoStore, DEMO_PASSWORD, DEMO_USERS, type DemoStore } from './demoSeed'
import type { AppUser, Club } from './types'

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

    async signUp(name, email) {
      await wait()
      const id = `u-${Math.random().toString(36).slice(2, 10)}`
      const user: AppUser = {
        id,
        displayName: name.trim() || 'New Student',
        email: email.trim() || `${id}@student.northgate.edu`,
        role: 'student',
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
        memberCount: 1,
        createdAt: Date.now(),
      }
      mutate((store) => {
        store.clubs.unshift(club)
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
  },

  memberships: {
    async listMine(uid) {
      await wait()
      return read()
        .memberships.filter((membership) => membership.uid === uid)
        .map((membership) => membership.clubId)
    },

    async join(clubId) {
      await wait()
      const store = read()
      const user = requireUser(store)
      const club = store.clubs.find((candidate) => candidate.id === clubId)
      if (!club) throw new Error('That club no longer exists.')
      if (club.status !== 'approved') throw new Error('This club is not open for joining yet.')
      if (store.memberships.some((m) => m.uid === user.id && m.clubId === clubId)) return

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

    async remove(id) {
      await wait()
      mutate((store) => {
        store.announcements = store.announcements.filter((item) => item.id !== id)
      })
    },
  },

  events: {
    async listAll() {
      await wait()
      return [...read().events].sort(sortByStart)
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

    async remove(id) {
      await wait()
      mutate((store) => {
        store.events = store.events.filter((event) => event.id !== id)
      })
    },
  },

  users: {
    async list() {
      await wait()
      return [...read().users].sort((a, b) => a.displayName.localeCompare(b.displayName))
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
        user.role === 'admin' ? 'Admin' : user.id === 'u-marcus' ? 'Club leader' : 'Student',
      description:
        user.role === 'admin'
          ? 'Approve clubs, manage roles, oversee the platform.'
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

