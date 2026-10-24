import type {
  Announcement,
  AppUser,
  Club,
  ClubDeletionRequest,
  ClubEvent,
  ClubCategory,
  Membership,
  ModerationReport,
  OfficerInvitation,
  ClubJoinRequest,
  AnnouncementReaction,
  EventRsvp,
} from './types'

export interface DemoStore {
  seededAt: number
  users: AppUser[]
  clubs: Club[]
  memberships: Membership[]
  announcements: Announcement[]
  events: ClubEvent[]
  reports: ModerationReport[]
  sponsorRequests: import('./types').ClubSponsorRequest[]
  officerInvitations: OfficerInvitation[]
  joinRequests: ClubJoinRequest[]
  announcementReactions: AnnouncementReaction[]
  eventRsvps: EventRsvp[]
  deletionRequests: ClubDeletionRequest[]
  currentUid: string | null
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

/** A timestamp `days` from today at a local time. */
function at(days: number, hour: number, minute = 0): number {
  const date = startOfToday()
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

export const DEMO_PASSWORD = 'clubstack'

export const DEMO_USERS: AppUser[] = [
  {
    id: 'u-ava',
    displayName: 'Ava Chen',
    email: 'ava@student.northgate.edu',
    role: 'student',
    grade: '10th grade',
    createdAt: Date.now() - 200 * DAY,
  },
  {
    id: 'u-marcus',
    displayName: 'Marcus Reed',
    email: 'marcus@student.northgate.edu',
    role: 'student',
    grade: '11th grade',
    createdAt: Date.now() - 220 * DAY,
  },
  {
    id: 'u-diaz',
    displayName: 'Dr. Elena Diaz',
    email: 'ediaz@northgate.edu',
    role: 'admin',
    createdAt: Date.now() - 400 * DAY,
  },
  {
    id: 'u-teacher',
    displayName: 'Jordan Taylor',
    email: 'jtaylor@northgate.edu',
    role: 'teacher',
    createdAt: Date.now() - 90 * DAY,
  },
]

interface SeedClub {
  id: string
  name: string
  description: string
  category: ClubCategory
  meetingDay: string
  meetingTime: string
  location: string
  emoji: string
  color: string
  leaderId: string
  leaderName: string
  memberCount: number
  status?: Club['status']
  createdAt: number
}

const seedClubs: SeedClub[] = [
  {
    id: 'robotics',
    name: 'Robotics Collective',
    description:
      'Design, build, and compete with robots. No experience needed — we teach machining, CAD, wiring, and programming from scratch in small teams.',
    category: 'STEM',
    meetingDay: 'Tuesday',
    meetingTime: '3:30 – 5:00 PM',
    location: 'Room B-204 (Maker Lab)',
    emoji: '🤖',
    color: '#8b7cff',
    leaderId: 'u-marcus',
    leaderName: 'Marcus Reed',
    memberCount: 48,
    createdAt: Date.now() - 180 * DAY,
  },
  {
    id: 'debate',
    name: 'Debate & Public Speaking',
    description:
      'Practice argumentation, compete in regional tournaments, and get comfortable speaking in front of a room. Novices are paired with a mentor.',
    category: 'Academic',
    meetingDay: 'Monday',
    meetingTime: '4:00 – 5:30 PM',
    location: 'Library Commons',
    emoji: '🗣️',
    color: '#91bff0',
    leaderId: 'leader-priya',
    leaderName: 'Priya Nair',
    memberCount: 36,
    createdAt: Date.now() - 300 * DAY,
  },
  {
    id: 'film',
    name: 'Film Society',
    description:
      'A weekly screening club for students who love movies. We watch a film, talk about how it was made, and run a short student film festival in spring.',
    category: 'Arts',
    meetingDay: 'Thursday',
    meetingTime: '3:45 – 6:00 PM',
    location: 'Media Lab',
    emoji: '🎬',
    color: '#f0a6a0',
    leaderId: 'leader-sofia',
    leaderName: 'Sofia Alvarez',
    memberCount: 62,
    createdAt: Date.now() - 250 * DAY,
  },
  {
    id: 'jazz',
    name: 'Jazz Ensemble',
    description:
      'The school jazz band, open to saxophones, brass, bass, drums, guitar, and piano. Auditions are relaxed and happen at the start of each semester.',
    category: 'Music',
    meetingDay: 'Wednesday',
    meetingTime: '3:30 – 5:00 PM',
    location: 'Band Room',
    emoji: '🎷',
    color: '#f2c56b',
    leaderId: 'leader-coleman',
    leaderName: 'Mr. Coleman',
    memberCount: 29,
    createdAt: Date.now() - 340 * DAY,
  },
  {
    id: 'girls-who-code',
    name: 'Girls Who Code',
    description:
      'A supportive space for students of all genders to build web apps, learn Python, and hear from women working in tech. Bring a laptop if you have one.',
    category: 'STEM',
    meetingDay: 'Friday',
    meetingTime: '3:30 – 4:45 PM',
    location: 'Computer Lab 2',
    emoji: '💻',
    color: '#d7a7e8',
    leaderId: 'leader-nia',
    leaderName: 'Nia Okafor',
    memberCount: 41,
    createdAt: Date.now() - 160 * DAY,
  },
  {
    id: 'environmental',
    name: 'Environmental Action',
    description:
      'Run campus cleanups, tend the school garden, and plan sustainability projects with facilities. Volunteer hours count toward the service seal.',
    category: 'Community Service',
    meetingDay: 'Tuesday',
    meetingTime: '4:15 – 5:15 PM',
    location: 'Room C-110',
    emoji: '🌱',
    color: '#8fd4b2',
    leaderId: 'leader-leo',
    leaderName: 'Leo Park',
    memberCount: 77,
    createdAt: Date.now() - 280 * DAY,
  },
  {
    id: 'model-un',
    name: 'Model United Nations',
    description:
      'Research global issues, draft resolutions, and represent countries at two regional conferences a year. Great for students interested in law, policy, or debate.',
    category: 'Academic',
    meetingDay: 'Wednesday',
    meetingTime: '4:00 – 5:15 PM',
    location: 'Room A-301',
    emoji: '🌍',
    color: '#91bff0',
    leaderId: 'leader-hana',
    leaderName: 'Hana Kim',
    memberCount: 33,
    createdAt: Date.now() - 210 * DAY,
  },
  {
    id: 'esports',
    name: 'Varsity Esports',
    description:
      'Competitive Rocket League and Super Smash Bros teams with a casual night for everyone. We practice together and stream our home matches.',
    category: 'Athletics',
    meetingDay: 'Friday',
    meetingTime: '4:00 – 6:00 PM',
    location: 'Esports Lounge',
    emoji: '🎮',
    color: '#a9c66a',
    leaderId: 'leader-diego',
    leaderName: 'Diego Ramos',
    memberCount: 55,
    createdAt: Date.now() - 130 * DAY,
  },
  {
    id: 'baking',
    name: 'Baking Club',
    description:
      'Bake something new every other week and take it home. We cover bread, cookies, and celebration cakes, with a bake sale each semester to fund ingredients.',
    category: 'Other',
    meetingDay: 'Thursday',
    meetingTime: '4:30 – 6:00 PM',
    location: 'Culinary Room',
    emoji: '🧁',
    color: '#f4a96b',
    leaderId: 'leader-ella',
    leaderName: 'Ella Nguyen',
    memberCount: 38,
    createdAt: Date.now() - 100 * DAY,
  },
  {
    id: 'key-club',
    name: 'Key Club',
    description:
      'The largest service organization at Northgate. We volunteer at food banks, elementary schools, and community events, and we track every service hour.',
    category: 'Community Service',
    meetingDay: 'Monday',
    meetingTime: '3:30 – 4:15 PM',
    location: 'Room D-105',
    emoji: '🤝',
    color: '#f0a6a0',
    leaderId: 'leader-grace',
    leaderName: 'Grace Liu',
    memberCount: 92,
    createdAt: Date.now() - 360 * DAY,
  },
  {
    id: 'newspaper',
    name: 'The Northgate Ledger',
    description:
      'Write, photograph, and design the student newspaper. We publish online every two weeks and print a full issue each quarter.',
    category: 'Media',
    meetingDay: 'Tuesday',
    meetingTime: '3:30 – 5:00 PM',
    location: 'Newsroom (A-118)',
    emoji: '📰',
    color: '#91bff0',
    leaderId: 'leader-owen',
    leaderName: 'Owen Brooks',
    memberCount: 24,
    createdAt: Date.now() - 190 * DAY,
  },
  {
    id: 'bollywood',
    name: 'Bollywood Dance Crew',
    description:
      'Learn high-energy Bollywood choreography and perform at the winter showcase and cultural night. Beginners welcome, no audition required.',
    category: 'Culture',
    meetingDay: 'Friday',
    meetingTime: '5:00 – 6:30 PM',
    location: 'Dance Studio',
    emoji: '💃',
    color: '#f2c56b',
    leaderId: 'leader-anika',
    leaderName: 'Anika Shah',
    memberCount: 45,
    createdAt: Date.now() - 150 * DAY,
  },
  {
    id: 'chess',
    name: 'Chess Club',
    description:
      'Casual games, blitz tournaments, and a ladder for the competitive team. All skill levels welcome — we have boards and clocks.',
    category: 'Academic',
    meetingDay: 'Thursday',
    meetingTime: '3:30 – 4:30 PM',
    location: 'Library Quiet Room',
    emoji: '♟️',
    color: '#8fd4b2',
    leaderId: 'leader-sam',
    leaderName: 'Sam Patel',
    memberCount: 27,
    createdAt: Date.now() - 320 * DAY,
  },
  {
    id: 'outdoor',
    name: 'Outdoor Adventure',
    description:
      'Day hikes, camping trips, and trail cleanups around the county. Gear can be borrowed from the club closet, and costs are kept low.',
    category: 'Wellness',
    meetingDay: 'Saturday',
    meetingTime: '9:00 AM (trip days)',
    location: 'Meet at North Gate',
    emoji: '🥾',
    color: '#a9c66a',
    leaderId: 'leader-riley',
    leaderName: 'Riley Bennett',
    memberCount: 31,
    createdAt: Date.now() - 120 * DAY,
  },
  {
    id: 'crochet',
    name: 'Crochet for a Cause',
    description:
      'We crochet blankets and hats to donate to the local family shelter. Open to total beginners — yarn and hooks are provided at your first meeting.',
    category: 'Community Service',
    meetingDay: 'Wednesday',
    meetingTime: '3:45 – 4:45 PM',
    location: 'Room D-102',
    emoji: '🧶',
    color: '#d7a7e8',
    leaderId: 'u-ava',
    leaderName: 'Ava Chen',
    memberCount: 1,
    status: 'pending',
    createdAt: Date.now() - 2 * DAY,
  },
]

const seedMemberships: Membership[] = [
  { id: 'u-ava_robotics', uid: 'u-ava', clubId: 'robotics', joinedAt: Date.now() - 60 * DAY },
  { id: 'u-ava_film', uid: 'u-ava', clubId: 'film', joinedAt: Date.now() - 45 * DAY },
  { id: 'u-ava_environmental', uid: 'u-ava', clubId: 'environmental', joinedAt: Date.now() - 30 * DAY },
  { id: 'u-ava_crochet', uid: 'u-ava', clubId: 'crochet', joinedAt: Date.now() - 2 * DAY },
  { id: 'u-marcus_robotics', uid: 'u-marcus', clubId: 'robotics', joinedAt: Date.now() - 150 * DAY },
  { id: 'u-marcus_chess', uid: 'u-marcus', clubId: 'chess', joinedAt: Date.now() - 90 * DAY },
]

interface SeedAnnouncement {
  id: string
  clubId: string
  title: string
  body: string
  authorId: string
  authorName: string
  hoursAgo: number
}

const seedAnnouncements: SeedAnnouncement[] = [
  {
    id: 'a-robotics-1',
    clubId: 'robotics',
    title: 'Build night moved to the maker lab',
    body: "Thursday's build night is in B-204 instead of the science wing. Bring closed-toe shoes and your safety glasses if you have them — we're finishing the chassis for the regional bot.",
    authorId: 'u-marcus',
    authorName: 'Marcus Reed',
    hoursAgo: 4,
  },
  {
    id: 'a-robotics-2',
    clubId: 'robotics',
    title: 'Regional scrimmage sign-ups are open',
    body: 'We have room for 12 students on the bus to the regional scrimmage on Saturday. Sign up on the clipboard at the next meeting. Drivers are also needed.',
    authorId: 'u-marcus',
    authorName: 'Marcus Reed',
    hoursAgo: 32,
  },
  {
    id: 'a-film-1',
    clubId: 'film',
    title: 'This week: Spirited Away 🎬',
    body: 'Vote for next month’s theme at the start of the meeting. Snacks are first come, first served, and cleanup volunteers get priority on the couch.',
    authorId: 'leader-sofia',
    authorName: 'Sofia Alvarez',
    hoursAgo: 9,
  },
  {
    id: 'a-env-1',
    clubId: 'environmental',
    title: 'Campus cleanup Saturday — bring a friend',
    body: 'Meet at the north gate at 9:00 AM. Gloves and bags are provided, and we are tracking service hours. We will wrap by 11:00.',
    authorId: 'leader-leo',
    authorName: 'Leo Park',
    hoursAgo: 20,
  },
  {
    id: 'a-key-1',
    clubId: 'key-club',
    title: 'Service hour forms are due Friday',
    body: 'Drop completed forms in the Key Club folder outside D-105. Anything submitted after Friday will count toward next semester.',
    authorId: 'leader-grace',
    authorName: 'Grace Liu',
    hoursAgo: 51,
  },
  {
    id: 'a-gwc-1',
    clubId: 'girls-who-code',
    title: 'Intro to React workshop 🧑‍💻',
    body: 'We are building a personal site together this Friday. No setup needed — we will use the lab machines, but bringing your own laptop is welcome.',
    authorId: 'leader-nia',
    authorName: 'Nia Okafor',
    hoursAgo: 60,
  },
  {
    id: 'a-debate-1',
    clubId: 'debate',
    title: 'Novice practice round Wednesday',
    body: 'New members should come 10 minutes early so we can pair you with a mentor. The topic is released at the meeting.',
    authorId: 'leader-priya',
    authorName: 'Priya Nair',
    hoursAgo: 76,
  },
  {
    id: 'a-newspaper-1',
    clubId: 'newspaper',
    title: 'Pitch your story by Tuesday',
    body: 'We are looking for coverage of the fall play, the new lunch schedule, and the playoff run. Bring a short pitch to the newsroom or send it to the editors.',
    authorId: 'leader-owen',
    authorName: 'Owen Brooks',
    hoursAgo: 98,
  },
]

interface SeedEvent {
  id: string
  clubId: string
  title: string
  description: string
  location: string
  days: number
  hour: number
  minute?: number
  durationMinutes?: number
  createdBy: string
}

const seedEvents: SeedEvent[] = [
  {
    id: 'e-robotics-build',
    clubId: 'robotics',
    title: 'Build Night: Chassis Assembly',
    description: 'Finishing the drive train for the regional bot. Tools and pizza provided.',
    location: 'Maker Lab (B-204)',
    days: 2,
    hour: 15,
    minute: 30,
    durationMinutes: 150,
    createdBy: 'u-marcus',
  },
  {
    id: 'e-robotics-scrimmage',
    clubId: 'robotics',
    title: 'Regional Scrimmage',
    description: 'Bus leaves the north gate at 8:00 AM sharp. Packed lunch recommended.',
    location: 'Fairview High School',
    days: 4,
    hour: 9,
    minute: 0,
    durationMinutes: 360,
    createdBy: 'u-marcus',
  },
  {
    id: 'e-film-screening',
    clubId: 'film',
    title: 'October Screening: Spirited Away',
    description: 'Doors at 3:30, film at 3:45. Discussion after — bring a friend.',
    location: 'Media Lab',
    days: 3,
    hour: 15,
    minute: 45,
    durationMinutes: 150,
    createdBy: 'leader-sofia',
  },
  {
    id: 'e-env-cleanup',
    clubId: 'environmental',
    title: 'Campus Cleanup',
    description: 'Gloves and bags provided. Two service hours, rain or shine.',
    location: 'North Gate',
    days: 4,
    hour: 9,
    minute: 0,
    durationMinutes: 120,
    createdBy: 'leader-leo',
  },
  {
    id: 'e-key-planning',
    clubId: 'key-club',
    title: 'Service Hour Planning',
    description: 'Bring your volunteer hours and ideas for the winter drive.',
    location: 'Room D-105',
    days: 6,
    hour: 15,
    minute: 30,
    durationMinutes: 45,
    createdBy: 'leader-grace',
  },
  {
    id: 'e-debate-practice',
    clubId: 'debate',
    title: 'Novice Practice Round',
    description: 'Arrive 10 minutes early for mentor pairings.',
    location: 'Library Commons',
    days: 1,
    hour: 16,
    minute: 0,
    durationMinutes: 90,
    createdBy: 'leader-priya',
  },
  {
    id: 'e-gwc-workshop',
    clubId: 'girls-who-code',
    title: 'Intro to React Workshop',
    description: 'Build your first personal website with the club.',
    location: 'Computer Lab 2',
    days: 5,
    hour: 15,
    minute: 30,
    durationMinutes: 75,
    createdBy: 'leader-nia',
  },
  {
    id: 'e-jazz-rehearsal',
    clubId: 'jazz',
    title: 'Full Ensemble Rehearsal',
    description: 'Running the winter showcase set list from top to bottom.',
    location: 'Band Room',
    days: 8,
    hour: 15,
    minute: 30,
    durationMinutes: 90,
    createdBy: 'leader-coleman',
  },
  {
    id: 'e-modelun-prep',
    clubId: 'model-un',
    title: 'Conference Prep: Position Papers',
    description: 'Bring a draft of your position paper for peer review.',
    location: 'Room A-301',
    days: 7,
    hour: 16,
    minute: 0,
    durationMinutes: 75,
    createdBy: 'leader-hana',
  },
  {
    id: 'e-baking',
    clubId: 'baking',
    title: 'Bake Sale Prep',
    description: 'Testing the cookie recipes for the fall bake sale.',
    location: 'Culinary Room',
    days: 10,
    hour: 16,
    minute: 30,
    durationMinutes: 90,
    createdBy: 'leader-ella',
  },
  {
    id: 'e-outdoor-hike',
    clubId: 'outdoor',
    title: 'Day Hike: Cedar Ridge',
    description: 'Moderate 4-mile loop. Sign up by Thursday for a spot in the van.',
    location: 'Meet at North Gate',
    days: 12,
    hour: 8,
    minute: 30,
    durationMinutes: 300,
    createdBy: 'leader-riley',
  },
  {
    id: 'e-film-past',
    clubId: 'film',
    title: 'September Screening: Paddington 2',
    description: 'Our monthly community screening.',
    location: 'Media Lab',
    days: -6,
    hour: 15,
    minute: 45,
    durationMinutes: 120,
    createdBy: 'leader-sofia',
  },
]

export function createDemoStore(): DemoStore {
  const now = Date.now()
  const clubs: Club[] = seedClubs.map((club) => ({
    ...club,
    status: club.status ?? 'approved',
    meetingFrequency: club.meetingDay === 'Flexible' ? 'custom' : 'weekly',
    meetingOrdinal: 'first',
    customMeetingSchedule: '',
    prerequisites: '',
    dues: '',
    instagramHandle: '',
    contactEmail: `${club.name.toLowerCase().replace(/[^a-z]+/g, '.')}@northgate.edu`,
    leaderTitle: 'President',
    officers: [],
    officerIds: [],
    sponsorId: '',
    sponsorName: '',
    sponsorStatus: 'none',
    requiresApproval: false,
    membersVisible: true,
    createdAt: club.createdAt,
  }))

  const announcements: Announcement[] = seedAnnouncements.map((item) => ({
    id: item.id,
    clubId: item.clubId,
    title: item.title,
    body: item.body,
    authorId: item.authorId,
    authorName: item.authorName,
    createdAt: now - item.hoursAgo * HOUR,
  }))

  const events: ClubEvent[] = seedEvents.map((item) => {
    const startAt = at(item.days, item.hour, item.minute ?? 0)
    return {
      id: item.id,
      clubId: item.clubId,
      title: item.title,
      description: item.description,
      location: item.location,
      startAt,
      endAt: item.durationMinutes ? startAt + item.durationMinutes * 60 * 1000 : null,
      createdBy: item.createdBy,
      createdAt: now - DAY,
    }
  })

  return {
    seededAt: now,
    users: [...DEMO_USERS],
    clubs,
    memberships: [...seedMemberships],
    announcements,
    events,
    reports: [],
    sponsorRequests: [],
    officerInvitations: [],
    joinRequests: [],
    announcementReactions: [],
    eventRsvps: [],
    deletionRequests: [],
    currentUid: null,
  }
}
