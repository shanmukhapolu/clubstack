export type Role = 'student' | 'teacher' | 'admin'

export type ClubStatus = 'pending' | 'approved' | 'rejected'

export type ReportStatus = 'open' | 'reviewed' | 'resolved'

export interface ModerationReport {
  id: string
  reporterId: string
  reporterName: string
  clubId: string
  clubName: string
  reason: string
  details: string
  status: ReportStatus
  createdAt: number
}

export interface AppUser {
  id: string
  displayName: string
  email: string
  role: Role
  grade?: string
  createdAt: number
}

export interface ClubOfficer {
  uid: string
  displayName: string
  email: string
  title: string
}

export type SponsorRequestStatus = 'pending' | 'accepted' | 'declined'

export type OfficerInvitationStatus = 'pending' | 'accepted' | 'declined'

export type JoinRequestStatus = 'pending' | 'approved' | 'declined'

export interface ClubJoinRequest {
  id: string
  clubId: string
  clubName: string
  uid: string
  displayName: string
  status: JoinRequestStatus
  createdAt: number
}

export interface AnnouncementReaction {
  id: string
  announcementId: string
  clubId: string
  uid: string
  emoji: string
  createdAt: number
}

export interface ReactionSummary {
  counts: Record<string, number>
  mine: string | null
}

export type EventRsvpStatus = 'going' | 'maybe' | 'notGoing'

export interface RsvpSummary {
  going: number
  maybe: number
  notGoing: number
  mine: EventRsvpStatus | null
}

export interface OfficerInvitation {
  id: string
  clubId: string
  clubName: string
  invitedUserId: string
  invitedUserName: string
  invitedById: string
  invitedByName: string
  title: string
  status: OfficerInvitationStatus
  createdAt: number
}

export interface ClubSponsorRequest {
  id: string
  clubId: string
  clubName: string
  teacherId: string
  teacherName: string
  requestedById: string
  requestedByName: string
  status: SponsorRequestStatus
  createdAt: number
}

export interface Club {
  id: string
  name: string
  description: string
  category: ClubCategory
  meetingDay: string
  meetingTime: string
  location: string
  emoji: string
  color: string
  status: ClubStatus
  leaderId: string
  leaderName: string
  leaderTitle: string
  officers: ClubOfficer[]
  officerIds: string[]
  sponsorId: string
  sponsorName: string
  sponsorStatus: SponsorRequestStatus | 'none'
  contactEmail: string
  memberCount: number
  requiresApproval: boolean
  membersVisible: boolean
  createdAt: number
}

export interface Announcement {
  id: string
  clubId: string
  title: string
  body: string
  authorId: string
  authorName: string
  createdAt: number
}

export interface ClubEvent {
  id: string
  clubId: string
  title: string
  description: string
  location: string
  startAt: number
  endAt: number | null
  createdBy: string
  createdAt: number
}

export interface Membership {
  id: string
  uid: string
  clubId: string
  joinedAt: number
}

export interface ClubInput {
  name: string
  description: string
  category: ClubCategory
  meetingDay: string
  meetingTime: string
  location: string
  emoji: string
  color: string
  contactEmail: string
  leaderTitle: string
  officers: ClubOfficer[]
  sponsorId: string
  sponsorName: string
}

export const CATEGORIES = [
  'Academic',
  'Arts',
  'Athletics',
  'Business',
  'Community Service',
  'Culture',
  'Media',
  'Music',
  'STEM',
  'Wellness',
  'Other',
] as const

export type ClubCategory = (typeof CATEGORIES)[number]

export const CLUB_COLORS = [
  '#8b7cff',
  '#f0a6a0',
  '#8fd4b2',
  '#f2c56b',
  '#91bff0',
  '#d7a7e8',
  '#f4a96b',
  '#a9c66a',
] as const

export const CATEGORY_TINTS: Record<ClubCategory, string> = {
  Academic: '#e7e3ff',
  Arts: '#ffe0d6',
  Athletics: '#dcf0d9',
  Business: '#fbe9c6',
  'Community Service': '#ffe3ea',
  Culture: '#efe4d7',
  Media: '#dfeaff',
  Music: '#f3e2ff',
  STEM: '#dcefee',
  Wellness: '#e4f2dc',
  Other: '#ecece7',
}

export const MEETING_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Flexible',
] as const
