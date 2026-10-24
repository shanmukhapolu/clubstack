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
  ReactionSummary,
  EventRsvpStatus,
  RsvpSummary,
  OfficerInvitation,
  OfficerInvitationStatus,
  SponsorRequestStatus,
  ModerationReport,
  ReportStatus,
  Role,
} from './types'
import { isDemoMode } from './firebase'
import { firebaseApi } from './firebaseBackend'
import { demoApi } from './demoBackend'

export interface AuthApi {
  /** Subscribes to the signed-in profile. Returns an unsubscribe function. */
  subscribe(callback: (user: AppUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(name: string, email: string, password: string, role: Role): Promise<void>
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
}

export interface ClubsApi {
  list(): Promise<Club[]>
  get(id: string): Promise<Club | null>
  create(input: ClubInput, leader: AppUser): Promise<string>
  update(id: string, patch: Partial<Club>): Promise<void>
  removeOfficer(id: string, officerId: string): Promise<void>
  setStatus(id: string, status: ClubStatus): Promise<void>
  transferOwnership(id: string, newLeaderId: string, currentLeader: AppUser): Promise<void>
  respondToOwnershipTransfer(id: string, accept: boolean, currentUser: AppUser): Promise<void>
  getDeletionRequest(id: string): Promise<ClubDeletionRequest | null>
  requestDeletion(id: string, currentLeader: AppUser): Promise<void>
  respondToDeletionRequest(id: string, status: Extract<ClubDeletionStatus, 'approved' | 'declined'>, advisor: AppUser): Promise<void>
  delete(id: string): Promise<void>
}

export interface MembershipsApi {
  listMine(uid: string): Promise<string[]>
  listMembers(clubId: string): Promise<string[]>
  removeMember(clubId: string, uid: string): Promise<void>
  listRequestsForClub(clubId: string): Promise<ClubJoinRequest[]>
  listRequestsForUser(uid: string): Promise<ClubJoinRequest[]>
  respondToRequest(requestId: string, status: Extract<JoinRequestStatus, 'approved' | 'declined'>): Promise<void>
  join(clubId: string): Promise<void>
  leave(clubId: string): Promise<void>
}

export interface AnnouncementsApi {
  listForClubs(clubIds: string[]): Promise<Announcement[]>
  create(clubId: string, input: { title: string; body: string }, author: AppUser): Promise<void>
  update(id: string, input: { title: string; body: string }): Promise<void>
  setPinned(id: string, pinned: boolean): Promise<void>
  getReactionSummary(announcementId: string, clubId: string, uid: string): Promise<ReactionSummary>
  setReaction(announcementId: string, clubId: string, uid: string, emoji: string | null): Promise<void>
  remove(id: string): Promise<void>
}

export interface EventsApi {
  listAll(): Promise<ClubEvent[]>
  listForClubs(clubIds: string[]): Promise<ClubEvent[]>
  create(
    clubId: string,
    input: { title: string; description: string; location: string; startAt: number; endAt: number | null; type?: ClubEvent['type']; attendance?: ClubEvent['attendance'] },
    author: AppUser,
  ): Promise<void>
  update(id: string, input: { title: string; description: string; location: string; startAt: number; endAt: number | null; type?: ClubEvent['type']; attendance?: ClubEvent['attendance'] }): Promise<void>
  getRsvpSummary(eventId: string, clubId: string, uid: string): Promise<RsvpSummary>
  setRsvp(eventId: string, clubId: string, uid: string, status: EventRsvpStatus): Promise<void>
  remove(id: string): Promise<void>
}

export interface ModerationApi {
  list(): Promise<ModerationReport[]>
  listMine(uid: string): Promise<ModerationReport[]>
  create(input: { clubId: string; clubName: string; reason: string; details: string }, reporter: AppUser): Promise<void>
  setStatus(id: string, status: ReportStatus): Promise<void>
}

export interface SponsorRequestsApi {
  listForTeacher(teacherId: string): Promise<ClubSponsorRequest[]>
  create(club: Club, teacher: AppUser, requester: AppUser): Promise<void>
  requestChange(club: Club, teacher: AppUser, requester: AppUser): Promise<void>
  respond(requestId: string, status: Extract<SponsorRequestStatus, 'accepted' | 'declined'>): Promise<void>
}

export interface UsersApi {
  list(): Promise<AppUser[]>
  listDirectory(): Promise<AppUser[]>
  searchDirectory(prefix: string, role: Role, maxResults?: number): Promise<AppUser[]>
  setRole(uid: string, role: Role): Promise<void>
  updateProfile(uid: string, input: { displayName: string; email: string; role: Role; grade: string }): Promise<void>
  deleteAccount(uid: string): Promise<void>
}

export interface OfficerInvitationsApi {
  listForUser(uid: string): Promise<OfficerInvitation[]>
  listForClub(clubId: string): Promise<OfficerInvitation[]>
  create(clubId: string, clubName: string, officer: { uid: string; displayName: string; email: string; title: string }, inviter: AppUser): Promise<void>
  respond(invitationId: string, status: Extract<OfficerInvitationStatus, 'accepted' | 'declined'>): Promise<void>
}

export interface DemoApi {
  accounts: { user: AppUser; label: string; description: string }[]
  signInAs(uid: string): Promise<void>
}

export interface ClubStackApi {
  mode: 'firebase' | 'demo'
  auth: AuthApi
  clubs: ClubsApi
  memberships: MembershipsApi
  announcements: AnnouncementsApi
  events: EventsApi
  users: UsersApi
  moderation: ModerationApi
  sponsorRequests: SponsorRequestsApi
  officerInvitations: OfficerInvitationsApi
  demo?: DemoApi
}

export const api: ClubStackApi = isDemoMode ? demoApi : firebaseApi
