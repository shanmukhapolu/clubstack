import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { api } from '../lib/backend'
import {
  addMonths,
  buildMonthGrid,
  formatDateLong,
  isSameDay,
  monthLabel,
  startOfDay,
} from '../lib/dates'
import type { ClubEvent } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { EventRow } from '../components/EventRow'
import { EmptyState, Spinner, buttonStyles } from '../components/ui'

type Scope = 'mine' | 'all'

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function CalendarPage() {
  const { user } = useAuth()
  const { clubs, joinedIds } = useClubs()
  const [scope, setScope] = useState<Scope>(() => user?.role === 'admin' ? 'all' : 'mine')
  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const joinedKey = [...joinedIds].sort().join('|')

  useEffect(() => {
    let active = true
    setLoading(true)

    const request =
      scope === 'all'
        ? api.events.listAll()
        : api.events.listForClubs(joinedKey ? joinedKey.split('|') : [])

    request
      .then((result) => {
        if (!active) return
        setEvents(result)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'Could not load the calendar.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [scope, joinedKey])

  const clubById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ClubEvent[]>()
    for (const event of events) {
      const key = dayKey(new Date(event.startAt))
      const list = map.get(key)
      if (list) list.push(event)
      else map.set(key, [event])
    }
    return map
  }, [events])

  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate])
  const selectedEvents = eventsByDay.get(dayKey(selectedDate)) ?? []
  const today = startOfDay(new Date())

  const mobileAgenda = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000
    const upcomingEvents = events
      .filter((event) => event.startAt >= cutoff)
      .sort((a, b) => a.startAt - b.startAt)
    const groups: { key: string; date: Date; events: ClubEvent[] }[] = []

    for (const event of upcomingEvents) {
      const date = new Date(event.startAt)
      const key = dayKey(date)
      const existing = groups.find((group) => group.key === key)
      if (existing) existing.events.push(event)
      else groups.push({ key, date, events: [event] })
    }
    return groups
  }, [events])

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Calendar"
        title="Meetings & events."
        description="Every club meeting and event in one calendar. Switch between your clubs and the whole school."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {(['mine', 'all'] as Scope[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setScope(option)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                scope === option ? 'bg-ink text-white' : 'text-ink-soft hover:bg-canvas'
              }`}
            >
              {option === 'mine' ? 'My clubs' : 'All clubs'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewDate((date) => addMonths(date, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition-colors hover:bg-canvas"
            aria-label="Previous month"
          >
            <ChevronLeft size={17} />
          </button>
          <p className="min-w-[132px] text-center text-[13.5px] font-bold">{monthLabel(viewDate)}</p>
          <button
            type="button"
            onClick={() => setViewDate((date) => addMonths(date, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition-colors hover:bg-canvas"
            aria-label="Next month"
          >
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))
              setSelectedDate(startOfDay(now))
            }}
            className={`${buttonStyles('ghost', 'sm', 'ml-1')}`}
          >
            Today
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl bg-[#fff1ec] px-4 py-3 text-[13px] text-[#9c2f18]">{error}</div>
      ) : loading ? (
        <Spinner label="Loading the calendar" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-line bg-surface md:block">
            <div className="grid grid-cols-7 border-b border-line bg-canvas/60">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((date, index) => {
                const key = dayKey(date)
                const dayEvents = eventsByDay.get(key) ?? []
                const inMonth = date.getMonth() === viewDate.getMonth()
                const isToday = isSameDay(date, today)
                const isSelected = isSameDay(date, selectedDate)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(startOfDay(date))}
                    className={`min-h-[92px] border-b border-r border-line p-1.5 text-left align-top transition-colors last:border-r-0 ${
                      inMonth ? 'bg-surface hover:bg-canvas/70' : 'bg-canvas/40 text-muted'
                    } ${isSelected ? 'ring-2 ring-inset ring-brand-300' : ''} ${
                      (index + 1) % 7 === 0 ? 'border-r-0' : ''
                    }`}
                  >
                    <span
                      className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-bold ${
                        isToday
                          ? 'bg-ink text-white'
                          : isSelected
                            ? 'bg-brand-100 text-brand-700'
                            : inMonth
                              ? 'text-ink'
                              : 'text-muted'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <span className="block space-y-1">
                      {dayEvents.slice(0, 2).map((event) => {
                        const club = clubById.get(event.clubId)
                        return (
                          <span
                            key={event.id}
                            className="block truncate rounded-md px-1.5 py-1 text-[10.5px] font-semibold leading-tight"
                            style={{ backgroundColor: `${club?.color ?? '#8b7cff'}26` }}
                          >
                            {event.title}
                          </span>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <span className="block px-1 text-[10px] font-semibold text-muted">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="md:hidden">
            {mobileAgenda.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={20} />}
                title="No events coming up"
                description="Club meetings and events will show up here once leaders add them."
                action={
                  scope === 'mine' ? (
                    <Link to="/discover" className={buttonStyles('primary', 'sm')}>
                      Find clubs to join
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-5">
                {mobileAgenda.slice(0, 12).map((group) => (
                  <section key={group.key}>
                    <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">
                      {isSameDay(group.date, today) ? 'Today · ' : ''}
                      {formatDateLong(group.date.getTime())}
                    </h2>
                    <div className="space-y-2">
                      {group.events.map((event) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          club={clubById.get(event.clubId)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <section className="mt-5 hidden md:block">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold">
                {isSameDay(selectedDate, today) ? 'Today' : formatDateLong(selectedDate.getTime())}
              </h2>
              <span className="text-[12px] text-muted">
                {selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}
              </span>
            </div>
            {selectedEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-6 text-center text-[13px] text-muted">
                Nothing scheduled for this day.
              </div>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {selectedEvents
                  .sort((a, b) => a.startAt - b.startAt)
                  .map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      club={clubById.get(event.clubId)}
                    />
                  ))}
              </div>
            )}
          </section>

          {scope === 'mine' && joinedIds.size === 0 && (
            <p className="mt-4 hidden text-center text-[12.5px] text-muted md:block">
              You haven’t joined any clubs yet — switch to{' '}
              <button
                type="button"
                className="font-semibold text-brand-600 underline"
                onClick={() => setScope('all')}
              >
                All clubs
              </button>{' '}
              to see everything happening at school.
            </p>
          )}
        </>
      )}
    </div>
  )
}
