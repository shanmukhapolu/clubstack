import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/backend'
import type { Announcement, Club } from '../lib/types'
import { relativeTime } from '../lib/dates'
import { Pin } from 'lucide-react'
import { friendlyError } from '../lib/helpers'
import { useToast } from '../context/ToastContext'
import { Avatar, ClubMark } from './ui'

export function AnnouncementCard({
  announcement,
  club,
  canManage = false,
  onDelete,
  onTogglePin,
}: {
  announcement: Announcement
  club?: Club
  canManage?: boolean
  onDelete?: (announcement: Announcement) => void
  onTogglePin?: (announcement: Announcement) => void
}) {
  const { user } = useAuth()
  const { notify } = useToast()
  const [peopleByEmoji, setPeopleByEmoji] = useState<Record<string, string[]>>({})
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [myReaction, setMyReaction] = useState<string | null>(null)
  const [reacting, setReacting] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    void api.announcements.getReactionSummary(announcement.id, announcement.clubId, user.id).then(summary => {
      if (active) { setReactionCounts(summary.counts); setMyReaction(summary.mine); setPeopleByEmoji(summary.peopleByEmoji ?? {}) }
    }).catch(() => undefined)
    return () => { active = false }
  }, [announcement.id, user?.id])

  async function react(emoji: string) {
    if (!user || reacting) return
    setReacting(true)
    try {
      const next = myReaction === emoji ? null : emoji
      await api.announcements.setReaction(announcement.id, announcement.clubId, user.id, next)
      setMyReaction(next)
      const summary = await api.announcements.getReactionSummary(announcement.id, announcement.clubId, user.id)
      setReactionCounts(summary.counts)
      setPeopleByEmoji(summary.peopleByEmoji ?? {})
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally { setReacting(false) }
  }

  return (
    <article className={`card p-4 sm:p-5 ${announcement.pinned ? 'border-brand-300 bg-brand-50/30' : ''}`}>
      <div className="flex items-center gap-2.5">
        {club ? (
          <Link to={`/clubs/${club.id}`} aria-label={club.name}>
            <ClubMark club={club} size={34} className="rounded-xl" />
          </Link>
        ) : (
          <Avatar name={announcement.authorName} size={34} />
        )}
        <div className="min-w-0 flex-1">
          {announcement.pinned && <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-700"><Pin size={11}/> Pinned</span>}
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
        {canManage && onTogglePin && <button type="button" onClick={() => onTogglePin(announcement)} className="rounded-lg p-1.5 text-muted hover:bg-canvas" title={announcement.pinned ? 'Unpin announcement' : 'Pin announcement'} aria-label={announcement.pinned ? 'Unpin announcement' : 'Pin announcement'}><Pin size={14} className={announcement.pinned ? 'fill-current text-brand-600' : ''}/></button>}
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
      <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">{announcement.body}</p>
      {user && <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-line pt-3" aria-label="Announcement reactions">{['👍','❤️','🎉','😂','👏'].map(emoji => <div key={emoji} className="flex max-w-full flex-col gap-1"><button key={emoji} type="button" disabled={reacting} title={canManage ? (peopleByEmoji[emoji]?.join(', ') || 'No reactions yet') : undefined} onClick={() => void react(emoji)} aria-pressed={myReaction === emoji} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${myReaction === emoji ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-line bg-surface text-ink-soft hover:bg-canvas'}`}>{emoji}<span>{reactionCounts[emoji] ?? 0}</span></button>{canManage && (peopleByEmoji[emoji]?.length ?? 0) > 0 && <p className="max-w-40 text-[10.5px] leading-snug text-muted">{peopleByEmoji[emoji].join(', ')}</p>}</div>)}</div>}
    </article>
  )
}
