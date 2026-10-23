import { Link } from 'react-router-dom'
import { Check, Users } from 'lucide-react'
import type { Club } from '../lib/types'
import { Badge, CategoryTag, ClubMark } from './ui'

export function ClubCard({ club, joined = false }: { club: Club; joined?: boolean }) {
  return (
    <Link
      to={`/clubs/${club.id}`}
      className="group card flex h-full flex-col p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <ClubMark club={club} size={50} />
        {club.status !== 'approved' ? (
          <Badge tone="warn">{club.status === 'pending' ? 'Pending review' : 'Not approved'}</Badge>
        ) : joined ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf7d6] px-2.5 py-1 text-[11.5px] font-bold text-[#4c6410]">
            <Check size={12} strokeWidth={3} /> Joined
          </span>
        ) : null}
      </div>

      <div className="mt-3.5">
        <CategoryTag category={club.category} />
        <h3 className="mt-2 text-[16.5px] font-bold leading-snug group-hover:text-brand-700">
          {club.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
          {club.description}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Users size={14} /> {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
        </span>
        <span className="truncate font-medium">
          {club.meetingDay === 'Flexible' ? 'Flexible schedule' : club.meetingDay + 's'}
        </span>
      </div>
    </Link>
  )
}
