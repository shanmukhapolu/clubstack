import { readFile } from 'node:fs/promises'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

const projectId = 'demo-clubstack'
const rules = await readFile('firestore.rules', 'utf8')
const environment = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8080, rules },
})

const profile = (role, displayName) => ({
  role,
  displayName,
  email: `${displayName.toLowerCase().replaceAll(' ', '.')}@example.test`,
  createdAt: 1,
})

const clubData = ({ id, leaderId = 'leader', sponsorId = '', sponsorStatus = 'none' }) => ({
  name: id.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  description: 'A student club with enough detail for the public directory preview.',
  category: 'Academic',
  meetingDay: 'Tuesday',
  meetingTime: '3:30 PM',
  location: 'Private Room 101',
  emoji: '🎒',
  color: '#4567ab',
  contactEmail: 'private-contact@example.test',
  leaderId,
  leaderName: 'Club Leader',
  leaderTitle: 'President',
  officers: [],
  officerIds: [],
  sponsorId,
  sponsorName: sponsorId ? 'Club Advisor' : '',
  sponsorStatus,
  status: 'approved',
  createdAt: 1,
})

const directoryData = ({ id, requiresApproval = false, membersVisible = true }) => ({
  name: id.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  description: 'A student club with enough detail for the public directory preview.',
  category: 'Academic',
  emoji: '🎒',
  color: '#4567ab',
  status: 'approved',
  leaderName: 'Club Leader',
  requiresApproval,
  membersVisible,
  createdAt: 1,
})

const failures = []
let passed = 0

async function check(name, task) {
  try {
    await task()
    passed += 1
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.error(`FAIL ${name}`, error)
  }
}

async function seed() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const users = [
      ['leader', 'student', 'Club Leader'],
      ['member-visible', 'student', 'Visible Club Member'],
      ['member-hidden', 'student', 'Hidden Club Member'],
      ['student-outsider', 'student', 'Student Outsider'],
      ['student-unaffiliated', 'student', 'Unaffiliated Student'],
      ['student-applying', 'student', 'Applicant Student'],
      ['teacher-pending', 'teacher', 'Pending Advisor'],
      ['teacher-accepted', 'teacher', 'Accepted Advisor'],
      ['admin', 'admin', 'Test Administrator'],
    ]
    for (const [uid, role, displayName] of users) {
      await setDoc(doc(db, 'users', uid), profile(role, displayName))
    }

    const clubs = [
      { id: 'club-visible', requiresApproval: false, membersVisible: true, sponsorId: '', sponsorStatus: 'none' },
      { id: 'club-hidden', requiresApproval: false, membersVisible: false, sponsorId: '', sponsorStatus: 'none' },
      { id: 'club-approval', requiresApproval: true, membersVisible: true, sponsorId: '', sponsorStatus: 'none' },
      { id: 'club-pending-sponsor', requiresApproval: false, membersVisible: true, sponsorId: 'teacher-pending', sponsorStatus: 'pending' },
      { id: 'club-accepted-sponsor-one', requiresApproval: false, membersVisible: true, sponsorId: 'teacher-accepted', sponsorStatus: 'accepted' },
      { id: 'club-accepted-sponsor-two', requiresApproval: false, membersVisible: true, sponsorId: 'teacher-accepted', sponsorStatus: 'accepted' },
    ]

    for (const club of clubs) {
      await setDoc(doc(db, 'clubs', club.id), clubData(club))
      await setDoc(doc(db, 'clubDirectory', club.id), directoryData(club))
      await setDoc(doc(db, 'memberships', `leader_${club.id}`), { uid: 'leader', clubId: club.id, joinedAt: 1 })
    }

    await setDoc(doc(db, 'memberships', 'member-visible_club-visible'), {
      uid: 'member-visible', clubId: 'club-visible', joinedAt: 2,
    })
    await setDoc(doc(db, 'memberships', 'member-hidden_club-hidden'), {
      uid: 'member-hidden', clubId: 'club-hidden', joinedAt: 2,
    })
    await setDoc(doc(db, 'clubJoinRequests', 'club-approval_student-applying'), {
      clubId: 'club-approval',
      clubName: 'Club Approval',
      uid: 'student-applying',
      displayName: 'Applicant Student',
      status: 'pending',
      createdAt: 2,
    })
    await setDoc(doc(db, 'announcements', 'announcement-visible'), {
      clubId: 'club-visible',
      title: 'Welcome',
      body: 'Welcome to the club.',
      authorId: 'leader',
      createdAt: 3,
    })
    await setDoc(doc(db, 'events', 'event-visible'), {
      clubId: 'club-visible',
      title: 'Next meeting',
      description: 'Weekly meeting',
      location: 'Private Room 101',
      createdBy: 'leader',
      startAt: Date.now() + 86_400_000,
      endAt: Date.now() + 90_000_000,
      createdAt: 3,
    })
  })
}

try {
  await seed()

  const outsider = environment.authenticatedContext('student-unaffiliated').firestore()
  const member = environment.authenticatedContext('member-visible').firestore()
  const hiddenMember = environment.authenticatedContext('member-hidden').firestore()
  const leader = environment.authenticatedContext('leader').firestore()
  const pendingAdvisor = environment.authenticatedContext('teacher-pending').firestore()
  const acceptedAdvisor = environment.authenticatedContext('teacher-accepted').firestore()
  const applicant = environment.authenticatedContext('student-applying').firestore()

  await check('approved club directory preview is readable without membership', () =>
    assertSucceeds(getDoc(doc(outsider, 'clubDirectory', 'club-visible'))))
  await check('private club document is denied to nonmembers', () =>
    assertFails(getDoc(doc(outsider, 'clubs', 'club-visible'))))
  await check('members can read private club details', () =>
    assertSucceeds(getDoc(doc(member, 'clubs', 'club-visible'))))
  await check('pending advisors cannot read private club documents', () =>
    assertFails(getDoc(doc(pendingAdvisor, 'clubs', 'club-pending-sponsor'))))
  await check('accepted advisors can sponsor multiple clubs', async () => {
    await assertSucceeds(getDoc(doc(acceptedAdvisor, 'clubs', 'club-accepted-sponsor-one')))
    await assertSucceeds(getDoc(doc(acceptedAdvisor, 'clubs', 'club-accepted-sponsor-two')))
  })

  await check('visible member directory can be queried by a club member', () =>
    assertSucceeds(getDocs(query(collection(member, 'memberships'), where('clubId', '==', 'club-visible')))))
  await check('hidden member directory cannot be queried by a regular member', () =>
    assertFails(getDocs(query(collection(hiddenMember, 'memberships'), where('clubId', '==', 'club-hidden')))))

  await check('nonmembers cannot read club announcements', () =>
    assertFails(getDoc(doc(outsider, 'announcements', 'announcement-visible'))))
  await check('nonmembers cannot read club events', () =>
    assertFails(getDoc(doc(outsider, 'events', 'event-visible'))))
  await check('a member cannot manipulate a stored member-count field', () =>
    assertFails(updateDoc(doc(leader, 'clubs', 'club-visible'), { memberCount: 9999 })))
  await check('a member cannot add a count field to the public directory', () =>
    assertFails(updateDoc(doc(leader, 'clubDirectory', 'club-visible'), { memberCount: 9999 })))

  await check('direct join works when approval is disabled', () =>
    assertSucceeds(setDoc(doc(environment.authenticatedContext('student-outsider').firestore(), 'memberships', 'student-outsider_club-visible'), {
      uid: 'student-outsider', clubId: 'club-visible', joinedAt: 5,
    })))
  await check('direct join is denied while approval is enabled', () =>
    assertFails(setDoc(doc(environment.authenticatedContext('student-outsider').firestore(), 'memberships', 'student-outsider_club-approval'), {
      uid: 'student-outsider', clubId: 'club-approval', joinedAt: 6,
    })))

  await check('club managers can disable approval without stranding existing requests', async () => {
    await assertSucceeds(updateDoc(doc(leader, 'clubDirectory', 'club-approval'), { requiresApproval: false }))
    const batch = writeBatch(leader)
    batch.update(doc(leader, 'clubJoinRequests', 'club-approval_student-applying'), { status: 'approved' })
    batch.set(doc(leader, 'memberships', 'student-applying_club-approval'), {
      uid: 'student-applying', clubId: 'club-approval', joinedAt: 7,
    })
    await assertSucceeds(batch.commit())
    await assertSucceeds(getDoc(doc(applicant, 'clubs', 'club-approval')))
  })

  await check('members can react to announcements', () =>
    assertSucceeds(setDoc(doc(member, 'announcementReactions', 'announcement-visible_member-visible'), {
      announcementId: 'announcement-visible',
      clubId: 'club-visible',
      uid: 'member-visible',
      emoji: '❤️',
      createdAt: 8,
    })))
  await check('only members can RSVP for a meeting', async () => {
    await assertSucceeds(setDoc(doc(member, 'eventRsvps', 'event-visible_member-visible'), {
      eventId: 'event-visible',
      clubId: 'club-visible',
      uid: 'member-visible',
      status: 'going',
      updatedAt: 9,
    }))
    await assertFails(setDoc(doc(outsider, 'eventRsvps', 'event-visible_student-unaffiliated'), {
      eventId: 'event-visible',
      clubId: 'club-visible',
      uid: 'student-unaffiliated',
      status: 'going',
      updatedAt: 10,
    }))
  })

  const maliciousClub = {
    ...clubData({ id: 'fraud-club', leaderId: 'student-outsider' }),
    status: 'pending',
    officers: [],
    officerIds: ['teacher-accepted'],
  }
  await check('new club creation cannot preassign an officer without acceptance', () =>
    assertFails(setDoc(doc(environment.authenticatedContext('student-outsider').firestore(), 'clubs', 'fraud-club'), maliciousClub)))
} finally {
  await environment.cleanup()
}

console.log(`Firestore security tests: ${passed} passed, ${failures.length} failed.`)
if (failures.length) process.exitCode = 1
