import { describe, expect, it } from 'vitest'
import { filterClubs, friendlyError, initials, isEmail } from './helpers'
import type { Club } from './types'

function club(overrides: Partial<Club>): Club {
  return {
    id: 'club',
    name: 'Chess Club',
    description: 'Casual games and tournaments for every level.',
    category: 'Academic',
    meetingDay: 'Thursday',
    meetingTime: '3:30 PM',
    location: 'Library',
    emoji: '♟️',
    color: '#8b7cff',
    status: 'approved',
    leaderId: 'leader',
    leaderName: 'Sam Patel',
    contactEmail: 'chess@school.edu',
    memberCount: 12,
    createdAt: 1,
    ...overrides,
  }
}

const clubs = [
  club({ id: 'chess' }),
  club({
    id: 'robotics',
    name: 'Robotics Collective',
    category: 'STEM',
    meetingDay: 'Tuesday',
    description: 'Build and compete with robots in the maker lab.',
    leaderName: 'Marcus Reed',
  }),
  club({
    id: 'film',
    name: 'Film Society',
    category: 'Arts',
    meetingDay: 'Thursday',
    description: 'A weekly screening club for movie lovers.',
  }),
]

describe('filterClubs', () => {
  it('returns every club when there is no query or category', () => {
    expect(filterClubs(clubs, { query: '', category: null })).toHaveLength(3)
  })

  it('matches names case-insensitively', () => {
    const result = filterClubs(clubs, { query: 'ROBOT', category: null })
    expect(result.map((item) => item.id)).toEqual(['robotics'])
  })

  it('matches descriptions and leader names', () => {
    expect(filterClubs(clubs, { query: 'screening', category: null })).toHaveLength(1)
    expect(filterClubs(clubs, { query: 'marcus', category: null })).toHaveLength(1)
  })

  it('searches across all categories but respects the category filter', () => {
    const result = filterClubs(clubs, { query: 'club', category: 'Arts' })
    expect(result.map((item) => item.id)).toEqual(['film'])
  })

  it('finds clubs by meeting day', () => {
    expect(filterClubs(clubs, { query: 'thursday', category: null })).toHaveLength(2)
  })

  it('returns nothing for a missing term', () => {
    expect(filterClubs(clubs, { query: 'zzz', category: null })).toEqual([])
  })
})

describe('small helpers', () => {
  it('formats initials from one or two names', () => {
    expect(initials('Ava Chen')).toBe('AC')
    expect(initials('Diaz')).toBe('D')
  })

  it('validates email addresses', () => {
    expect(isEmail('ava@student.school.edu')).toBe(true)
    expect(isEmail('ava@')).toBe(false)
    expect(isEmail('not an email')).toBe(false)
  })

  it('turns Firebase error codes into friendly copy', () => {
    expect(friendlyError(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }))).toBe(
      'Email or password is incorrect.',
    )
    expect(friendlyError(Object.assign(new Error('x'), { code: 'permission-denied' }))).toBe(
      'You do not have permission to do that.',
    )
  })
})
