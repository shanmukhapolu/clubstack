import { Link } from 'react-router-dom'
import { Clock, MapPin, Trash2 } from 'lucide-react'
import type { Club, ClubEvent } from '../lib/types'
import { formatTimeRange, isToday } from '../lib/dates'
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
  const date = new Date(event.startAt)
  const past = event.startAt < Date.now()

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
