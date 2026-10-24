import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, Trash2 } from 'lucide-react'
import type { Club, ClubEvent, EventRsvpStatus, RsvpSummary } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { api } from '../lib/backend'
import { formatTimeRange, isToday } from '../lib/dates'
import { friendlyError } from '../lib/helpers'
import { useToast } from '../context/ToastContext'
import { ClubMark } from './ui'

export function EventRow({
  event,
  club,
  canManage = false,
  onDelete,
}: {
  event: ClubEvent
  club?: Club
  canManage?: boolean
  onDelete?: (event: ClubEvent) => void
}) {
  const { user } = useAuth()
  const { notify } = useToast()
  const { isJoined, clubs } = useClubs()
  const associatedClub = club ?? clubs.find((item) => item.id === event.clubId)
  const isManager = !!(canManage || (user && associatedClub && (user.role === 'admin' || associatedClub.leaderId === user.id || (associatedClub.officerIds ?? []).includes(user.id) || (associatedClub.sponsorId === user.id && associatedClub.sponsorStatus === 'accepted'))))
  const [rsvp, setRsvp] = useState<RsvpSummary>({ going: 0, maybe: 0, notGoing: 0, mine: null, participants: [] })
  const [rsvpBusy, setRsvpBusy] = useState(false)
  const date = new Date(event.startAt)
  const past = event.startAt < Date.now()
  const canRsvp = !!(user && user.role === 'student' && isJoined(event.clubId) && !isManager && !past)

  useEffect(() => {
    if (!user) return
    let active = true
    void api.events.getRsvpSummary(event.id, event.clubId, user.id).then(summary => { if (active) setRsvp(summary) }).catch(() => undefined)
    return () => { active = false }
  }, [event.id, user?.id])

  async function updateRsvp(status: EventRsvpStatus) {
    if (!user || rsvpBusy) return
    setRsvpBusy(true)
    try { await api.events.setRsvp(event.id, event.clubId, user.id, status); setRsvp(await api.events.getRsvpSummary(event.id, event.clubId, user.id)) }
    catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setRsvpBusy(false) }
  }

  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 ${past ? 'opacity-55' : ''}`} style={club ? { borderLeft: `4px solid ${club.color}` } : undefined}>
      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl py-2" style={club ? { backgroundColor: `${club.color}30`, color: "#293044" } : { backgroundColor: "#e7e3ff", color: "#5b4ec7" }}>
        <span className="text-[10px] font-bold uppercase tracking-wide">
          {date.toLocaleDateString(undefined, { month: 'short' })}
        </span>
        <span className="text-lg font-extrabold leading-tight">{date.getDate()}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-snug">{event.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {formatTimeRange(event.startAt, event.endAt)}
                {isToday(event.startAt) && (
                  <span className="ml-0.5 font-semibold text-brand-600">Today</span>
                )}
              </span>
              {event.location && (
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin size={12} /> {event.location}
                </span>
              )}
            </div>
          </div>
          {canManage && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(event)}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[#ffe9e2] hover:text-[#9c2f18]"
              aria-label={`Delete event ${event.title}`}
              title="Delete event"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {(user && (isJoined(event.clubId) || user.role === 'admin' || isManager)) && <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted"><span className="font-semibold">Estimated attendance</span><span>{rsvp.going} going</span><span>· {rsvp.maybe} maybe</span>{isManager && <span>· {rsvp.notGoing} can’t</span>}</div>}
        {isManager && (rsvp.participants?.length ?? 0) > 0 && <details className="mt-2 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-[11.5px]"><summary className="cursor-pointer font-semibold text-ink-soft">View member responses</summary><div className="mt-2 space-y-2">{([['going', 'Going'], ['maybe', 'Maybe'], ['notGoing', 'Can’t go']] as [EventRsvpStatus, string][]).map(([status, label]) => { const people = (rsvp.participants ?? []).filter((person) => person.status === status); return people.length ? <div key={status}><p className="font-semibold text-ink-soft">{label} ({people.length})</p><p className="mt-0.5 leading-relaxed text-muted">{people.map((person) => person.displayName).join(', ')}</p></div> : null })}</div></details>}
        {canRsvp && <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`RSVP for ${event.title}`}>{([['going','Going'],['maybe','Maybe'],['notGoing','Can’t go']] as [EventRsvpStatus,string][]).map(([status,label])=><button key={status} type="button" disabled={rsvpBusy} onClick={() => void updateRsvp(status)} aria-pressed={rsvp.mine === status} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${rsvp.mine === status ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-line text-ink-soft hover:bg-canvas'}`}>{label}</button>)}</div>}
        {club && (
          <Link
            to={`/clubs/${club.id}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-canvas py-0.5 pl-0.5 pr-2 text-[11.5px] font-semibold text-ink-soft transition-colors hover:bg-brand-50"
          >
            <ClubMark club={club} size={18} className="rounded-md" />
            {club.name}
          </Link>
        )}
      </div>
    </div>
  )
}
