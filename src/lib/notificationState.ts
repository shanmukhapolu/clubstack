import type {
  Announcement,
  AppUser,
  Club,
  ClubDeletionRequest,
  ClubEvent,
  ClubJoinRequest,
  ClubSponsorRequest,
  ModerationReport,
  OfficerInvitation,
} from './types'
import { api } from './backend'

export interface InboxState {
  invitations: OfficerInvitation[]
  ownJoinRequests: ClubJoinRequest[]
  joinRequests: ClubJoinRequest[]
  sponsorRequests: ClubSponsorRequest[]
  deletionRequests: ClubDeletionRequest[]
  announcements: Announcement[]
  events: ClubEvent[]
  pendingClubs: Club[]
  reports: ModerationReport[]
}

export const emptyInbox: InboxState = {
  invitations: [],
  ownJoinRequests: [],
  joinRequests: [],
  sponsorRequests: [],
  deletionRequests: [],
  announcements: [],
  events: [],
  pendingClubs: [],
  reports: [],
}

const READ_PREFIX = 'clubstack.notifications.read.v1.'
const KNOWN_PREFIX = 'clubstack.notifications.known.v1.'
const CHANGE_EVENT = 'clubstack:notifications-changed'

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeSet(key: string, values: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify([...values]))
  } catch {
    // Keep the inbox usable if browser storage is disabled or full.
  }
}

function notifyChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function getReadNotificationIds(uid: string): Set<string> {
  return readSet(READ_PREFIX + uid)
}

export function getKnownNotificationIds(uid: string): Set<string> {
  return readSet(KNOWN_PREFIX + uid)
}

export function getUnreadNotificationCount(uid: string): number {
  const known = getKnownNotificationIds(uid)
  const read = getReadNotificationIds(uid)
  return [...known].filter((id) => !read.has(id)).length
}

export function syncKnownNotificationIds(uid: string, ids: string[]): void {
  // Keep notification history across temporary empty loads (for example while the
  // clubs context is refreshing). Replacing this set or pruning read IDs here caused
  // read notifications to become unread again after a reload.
  const known = getKnownNotificationIds(uid)
  ids.forEach((id) => known.add(id))
  writeSet(KNOWN_PREFIX + uid, known)
  notifyChange()
}

export function markNotificationRead(uid: string, id: string): void {
  const read = getReadNotificationIds(uid)
  read.add(id)
  writeSet(READ_PREFIX + uid, read)
  notifyChange()
}

export function markAllNotificationsRead(uid: string): void {
  writeSet(READ_PREFIX + uid, getKnownNotificationIds(uid))
  notifyChange()
}

export function notificationIds(items: InboxState): string[] {
  return [
    ...items.invitations.filter((item) => item.status === 'pending').map((item) => `invitation:${item.id}`),
    ...items.ownJoinRequests.map((item) => `own-join:${item.id}:${item.status}`),
    ...items.sponsorRequests.filter((item) => item.status === 'pending').map((item) => `sponsor:${item.id}`),
    ...items.deletionRequests.filter((item) => item.status === 'pending').map((item) => `deletion:${item.id}`),
    ...items.joinRequests.filter((item) => item.status === 'pending').map((item) => `join:${item.id}`),
    ...items.announcements.map((item) => `announcement:${item.id}`),
    ...items.events.map((item) => `event:${item.id}`),
    ...items.pendingClubs.map((item) => `pending-club:${item.id}`),
    ...items.reports.map((item) => `report:${item.id}`),
  ]
}

export async function fetchInboxItems(user: AppUser, clubs: Club[], joinedIds: Set<string>): Promise<InboxState> {
  const isAdmin = user.role === 'admin'
  const managerClubs = clubs.filter((club) => isAdmin || club.leaderId === user.id
    || (club.officerIds ?? []).includes(user.id)
    || (club.sponsorId === user.id && club.sponsorStatus === 'accepted'))
  const readableClubs = clubs.filter((club) => isAdmin || joinedIds.has(club.id)
    || club.leaderId === user.id
    || (club.officerIds ?? []).includes(user.id)
    || (club.sponsorId === user.id && club.sponsorStatus === 'accepted'))
  const feedIds = [...new Set(readableClubs.map((club) => club.id))]

  const [invitations, ownJoinRequests, sponsorRequests, deletionRequestGroups, nestedRequests, feed, reports] = await Promise.all([
    user.role === 'student' ? api.officerInvitations.listForUser(user.id) : Promise.resolve([]),
    user.role === 'student' ? api.memberships.listRequestsForUser(user.id) : Promise.resolve([]),
    user.role === 'teacher' ? api.sponsorRequests.listForTeacher(user.id) : Promise.resolve([]),
    Promise.all(managerClubs.filter((club) => isAdmin || (club.sponsorId === user.id && club.sponsorStatus === 'accepted')).map((club) => api.clubs.getDeletionRequest(club.id))),
    Promise.all(managerClubs.map((club) => api.memberships.listRequestsForClub(club.id))),
    Promise.all(feedIds.length
      ? [api.announcements.listForClubs(feedIds), api.events.listForClubs(feedIds)]
      : [Promise.resolve([]), Promise.resolve([])]),
    isAdmin ? api.moderation.list() : Promise.resolve([]),
  ]) as [OfficerInvitation[], ClubJoinRequest[], ClubSponsorRequest[], (ClubDeletionRequest | null)[], ClubJoinRequest[][], [Announcement[], ClubEvent[]], ModerationReport[]]

  const now = Date.now()
  const month = 30 * 24 * 60 * 60 * 1000
  return {
    invitations,
    ownJoinRequests,
    sponsorRequests: sponsorRequests.filter((item) => item.status === 'pending'),
    deletionRequests: deletionRequestGroups.filter((item): item is ClubDeletionRequest => !!item && item.status === 'pending'),
    joinRequests: nestedRequests.flat().filter((item) => item.status === 'pending'),
    announcements: feed[0].filter((item) => now - item.createdAt < month),
    events: feed[1].filter((item) => item.startAt >= now && item.startAt - now < month),
    pendingClubs: isAdmin ? clubs.filter((club) => club.status === 'pending') : [],
    reports: reports.filter((report) => report.status === 'open'),
  }
}

export function isNotificationUnread(uid: string, id: string): boolean {
  return getKnownNotificationIds(uid).has(id) && !getReadNotificationIds(uid).has(id)
}

export const notificationChangeEvent = CHANGE_EVENT
