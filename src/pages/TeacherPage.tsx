import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Flag, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { formatTimeRange } from '../lib/dates'
import type { ClubEvent } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, ClubMark, Spinner } from '../components/ui'

export function TeacherPage() {
  const { user } = useAuth()
  const { clubs, loading: clubsLoading } = useClubs()
  const { notify } = useToast()
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [reportingId, setReportingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void api.events.listAll()
      .then((items) => {
        if (active) setEvents(items)
      })
      .catch((caught) => notify(friendlyError(caught), 'error'))
      .finally(() => {
        if (active) setEventsLoading(false)
      })
    return () => { active = false }
  }, [notify])

  const clubById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs])
  const upcomingEvents = useMemo(
    () => events.filter((event) => event.startAt >= Date.now()).slice(0, 8),
    [events],
  )
  const pendingClubs = clubs.filter((club) => club.status === 'pending')

  async function reportConcern(clubId: string, clubName: string) {
    if (!user) return
    const reason = window.prompt(
      `What kind of concern are you reporting about ${clubName}? (Policy, safety, inaccurate information, or other)`,
    )
    if (!reason?.trim()) return
    const details = window.prompt('Add details for the platform administrators (optional).') ?? ''
    setReportingId(clubId)
    try {
      await api.moderation.create({
        clubId,
        clubName,
        reason: reason.trim().slice(0, 120),
        details: details.trim().slice(0, 2000),
      }, user)
      notify('Your concern was sent to the platform administrators.')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setReportingId(null)
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Teacher / advisor"
        title="School-wide club overview."
        description="Review club activity, coordinate around upcoming meetings, and flag concerns for platform administrators. Routine club content remains with student officers."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none">{clubs.length}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Club pages</p>
        </div>
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none text-[#8a5a00]">{pendingClubs.length}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Pending review</p>
        </div>
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none">{clubs.filter((club) => club.status === 'approved').length}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Approved clubs</p>
        </div>
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none">{events.filter((event) => event.startAt >= Date.now()).length}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Upcoming meetings</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold">
            <Users size={17} /> Club directory
          </h2>
          {clubsLoading ? (
            <Spinner label="Loading clubs" />
          ) : (
            <div className="space-y-2.5">
              {clubs.map((club) => (
                <div key={club.id} className="card flex flex-wrap items-center gap-3 p-3.5">
                  <ClubMark club={club} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/clubs/${club.id}`} className="text-[13.5px] font-bold hover:underline">{club.name}</Link>
                    <p className="mt-0.5 text-[11.5px] text-muted">{club.category} · {club.leaderName} · {club.memberCount} members</p>
                  </div>
                  <Badge tone={club.status === 'approved' ? 'lime' : club.status === 'pending' ? 'warn' : 'muted'}>{club.status}</Badge>
                  <Button size="sm" variant="secondary" loading={reportingId === club.id} onClick={() => void reportConcern(club.id, club.name)}>
                    <Flag size={14} /> Report
                  </Button>
                </div>
              ))}
              {clubs.length === 0 && <div className="rounded-2xl border border-line bg-surface px-4 py-5 text-[13px] text-muted">No clubs are available yet.</div>}
            </div>
          )}
        </section>

        <aside>
          <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold">
            <CalendarClock size={17} /> Upcoming meetings
          </h2>
          {eventsLoading ? (
            <Spinner label="Loading meetings" />
          ) : upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-4 py-5 text-[13px] text-muted">No upcoming meetings have been scheduled.</div>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map((event) => {
                const club = clubById.get(event.clubId)
                return (
                  <Link key={event.id} to={`/clubs/${event.clubId}`} className="card block p-3.5 transition-colors hover:border-brand-300">
                    <p className="text-[13px] font-bold">{event.title}</p>
                    <p className="mt-1 text-[11.5px] text-muted">{club?.name ?? 'Club'} · {new Date(event.startAt).toLocaleString()}</p>
                    <p className="mt-1 text-[12px] text-ink-soft">{event.location || 'Location not set'}</p>
                    {event.endAt && <p className="mt-0.5 text-[11px] text-muted">{formatTimeRange(event.startAt, event.endAt)}</p>}
                  </Link>
                )
              })}
            </div>
          )}
          <div className="mt-5 rounded-2xl bg-brand-50 px-4 py-3.5 text-[12.5px] leading-relaxed text-brand-900">
            Use reports for concerns that need platform-wide attention. Student officers continue to manage routine announcements and club updates.
          </div>
        </aside>
      </div>
    </div>
  )
}
