import type {
  Announcement,
  AppUser,
  Club,
  ClubEvent,
  ClubInput,
  ClubStatus,
  ClubSponsorRequest,
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
  update(id: string, patch: Partial<ClubInput>): Promise<void>
  setStatus(id: string, status: ClubStatus): Promise<void>
  delete(id: string): Promise<void>
}

export interface MembershipsApi {
  listMine(uid: string): Promise<string[]>
  join(clubId: string): Promise<void>
  leave(clubId: string): Promise<void>
}

export interface AnnouncementsApi {
  listForClubs(clubIds: string[]): Promise<Announcement[]>
  create(clubId: string, input: { title: string; body: string }, author: AppUser): Promise<void>
  remove(id: string): Promise<void>
}

export interface EventsApi {
  listAll(): Promise<ClubEvent[]>
  listForClubs(clubIds: string[]): Promise<ClubEvent[]>
  create(
    clubId: string,
    input: { title: string; description: string; location: string; startAt: number; endAt: number | null },
    author: AppUser,
  ): Promise<void>
  remove(id: string): Promise<void>
}

export interface ModerationApi {
  list(): Promise<ModerationReport[]>
  create(input: { clubId: string; clubName: string; reason: string; details: string }, reporter: AppUser): Promise<void>
  setStatus(id: string, status: ReportStatus): Promise<void>
}

export interface SponsorRequestsApi {
  listForTeacher(teacherId: string): Promise<ClubSponsorRequest[]>
  create(club: Club, teacher: AppUser, requester: AppUser): Promise<void>
  respond(requestId: string, status: Extract<SponsorRequestStatus, 'accepted' | 'declined'>): Promise<void>
}

export interface UsersApi {
  list(): Promise<AppUser[]>
  setRole(uid: string, role: Role): Promise<void>
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
  demo?: DemoApi
}

export const api: ClubStackApi = isDemoMode ? demoApi : firebaseApi
