import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import type { Announcement, Club } from '../lib/types'
import { relativeTime } from '../lib/dates'
import { Avatar, ClubMark } from './ui'

export function AnnouncementCard({
  announcement,
  club,
  canManage = false,
  onDelete,
}: {
  announcement: Announcement
  club?: Club
  canManage?: boolean
  onDelete?: (announcement: Announcement) => void
}) {
  return (
    <article className="card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        {club ? (
          <Link to={`/clubs/${club.id}`} aria-label={club.name}>
            <ClubMark club={club} size={34} className="rounded-xl" />
          </Link>
        ) : (
          <Avatar name={announcement.authorName} size={34} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] font-semibold">
            {club && (
              <Link to={`/clubs/${club.id}`} className="truncate hover:underline">
                {club.name}
              </Link>
            )}
            {club && <span className="text-muted/60">·</span>}
            <span className="truncate font-medium text-muted">{announcement.authorName}</span>
          </div>
          <p className="text-[11.5px] text-muted">{relativeTime(announcement.createdAt)}</p>
        </div>
        {canManage && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(announcement)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-[#ffe9e2] hover:text-[#9c2f18]"
            aria-label={`Delete announcement ${announcement.title}`}
            title="Delete announcement"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <h3 className="mt-3 text-[15.5px] font-bold leading-snug">{announcement.title}</h3>
      <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">
        {announcement.body}
      </p>
    </article>
  )
}
