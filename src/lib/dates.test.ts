import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  fromDateTimeInput,
  isSameDay,
  isToday,
  monthLabel,
  toDateTimeInput,
  upcoming,
} from './dates'

describe('buildMonthGrid', () => {
  it('always returns six full weeks starting on Sunday', () => {
    const grid = buildMonthGrid(new Date(2026, 9, 1))
    expect(grid).toHaveLength(42)
    expect(grid[0].getDay()).toBe(0)
    expect(grid[41].getDay()).toBe(6)
  })

  it('includes the first and last day of the month', () => {
    const grid = buildMonthGrid(new Date(2026, 1, 1))
    const days = grid.map((date) => date.getDate())
    expect(days).toContain(1)
    expect(days).toContain(28)
    expect(grid[0].getMonth()).toBe(1)
  })

  it('handles months that start on a Sunday', () => {
    const grid = buildMonthGrid(new Date(2026, 2, 1))
    expect(grid[0].getMonth()).toBe(2)
    expect(grid[0].getDate()).toBe(1)
  })
})

describe('date helpers', () => {
  it('compares days without time', () => {
    expect(isSameDay(new Date(2026, 4, 4, 8), new Date(2026, 4, 4, 20))).toBe(true)
    expect(isSameDay(new Date(2026, 4, 4), new Date(2026, 4, 5))).toBe(false)
  })

  it('detects today', () => {
    expect(isToday(Date.now())).toBe(true)
    expect(isToday(Date.now() - 48 * 60 * 60 * 1000)).toBe(false)
  })

  it('formats the month label with the year', () => {
    expect(monthLabel(new Date(2026, 9, 1))).toContain('2026')
  })

  it('round-trips datetime-local values', () => {
    const date = new Date(2026, 4, 4, 15, 30)
    const value = toDateTimeInput(date.getTime())
    expect(value).toBe('2026-05-04T15:30')
    expect(fromDateTimeInput(value)).toBe(date.getTime())
  })
})

describe('upcoming', () => {
  it('drops long-past events and sorts the rest', () => {
    const now = Date.now()
    const result = upcoming([
      { startAt: now + 4 * 60 * 60 * 1000, title: 'later' },
      { startAt: now - 72 * 60 * 60 * 1000, title: 'past' },
      { startAt: now + 60 * 60 * 1000, title: 'soon' },
    ])
    expect(result.map((item) => item.title)).toEqual(['soon', 'later'])
  })
})
