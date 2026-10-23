import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Megaphone, Plus, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useClubFeed } from '../hooks/useClubFeed'
import { firstName } from '../lib/helpers'
import { formatTimeRange, isToday, upcoming } from '../lib/dates'
import { AnnouncementCard } from '../components/AnnouncementCard'
import { ClubMark, EmptyState, Spinner, buttonStyles } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { EventRow } from '../components/EventRow'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: ReactNode
  tone: string
}) {
  return (
    <div className="card flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:gap-3.5 sm:p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${tone}`}>{icon}</span>
      <div>
        <p className="text-[22px] font-extrabold leading-none">{value}</p>
        <p className="mt-1 text-[11px] font-medium leading-tight text-muted sm:text-[12px]">{label}</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { clubs, joinedIds, loading: clubsLoading } = useClubs()
  const joinedIdsArray = [...joinedIds]
  const { announcements, events, loading: feedLoading } = useClubFeed(joinedIdsArray)

  if (!user) return null

  const myClubs = clubs
    .filter((club) => joinedIds.has(club.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const ledClubs = clubs.filter((club) => club.leaderId === user.id)
  const pendingCount = clubs.filter((club) => club.status === 'pending').length

  const nextEvents = upcoming(events).slice(0, 4)
  const twoWeeks = Date.now() + 14 * 24 * 60 * 60 * 1000
  const upcomingTwoWeeks = upcoming(events).filter((event) => event.startAt <= twoWeeks).length
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const freshUpdates = announcements.filter((item) => item.createdAt >= weekAgo).length
  const clubById = new Map(clubs.map((club) => [club.id, club]))

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        title={`${greeting()}, ${firstName(user.displayName)}.`}
        description={
          myClubs.length > 0
            ? "Here's everything happening across the clubs you're part of."
            : 'Join a club to start seeing announcements and meetings in one place.'
        }
        action={
          <Link to="/discover" className={buttonStyles('secondary', 'md')}>
            <Sparkles size={16} /> Discover clubs
          </Link>
        }
      />

      {user.role === 'admin' && pendingCount > 0 && (
        <Link
          to="/admin"
          className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] font-medium text-brand-900 transition-colors hover:border-brand-300"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70">
            <Megaphone size={16} className="text-brand-600" />
          </span>
          <span className="flex-1">
            <strong className="font-bold">
              {pendingCount} club{pendingCount === 1 ? '' : 's'}
            </strong>{' '}
            waiting for approval in the admin console.
          </span>
          <ArrowRight size={16} className="shrink-0 text-brand-600" />
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        <StatCard
          label="Clubs joined"
          value={myClubs.length}
          icon={<Users size={18} />}
          tone="bg-brand-100 text-brand-700"
        />
        <StatCard
          label="Events in 2 weeks"
          value={upcomingTwoWeeks}
          icon={<CalendarDays size={18} />}
          tone="bg-[#eaf7c9] text-[#4c6410]"
        />
        <StatCard
          label="Updates this week"
          value={freshUpdates}
          icon={<Megaphone size={18} />}
          tone="bg-[#ffe0d6] text-[#a84b2b]"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_1fr] lg:gap-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-extrabold">Latest updates</h2>
            {myClubs.length > 0 && (
              <Link
                to="/calendar"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 hover:underline"
              >
                Calendar <ArrowRight size={13} />
              </Link>
            )}
          </div>

          {clubsLoading || feedLoading ? (
            <Spinner label="Loading your feed" />
          ) : myClubs.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={20} />}
              title="Your feed is waiting"
              description="Join your first club and its announcements, meetings, and updates will show up right here."
              action={
                <Link to="/discover" className={buttonStyles('primary', 'sm')}>
                  Browse clubs <ArrowRight size={15} />
                </Link>
              }
            />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone size={20} />}
              title="No announcements yet"
              description="Once a club leader posts an update, it will appear here. In the meantime, check your upcoming meetings."
            />
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 5).map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  club={clubById.get(announcement.clubId)}
                />
              ))}
            </div>
          )}

          {ledClubs.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                Clubs you lead
              </p>
              <div className="mt-3 space-y-2">
                {ledClubs.map((club) => (
                  <Link
                    key={club.id}
                    to={`/clubs/${club.id}`}
                    className="flex items-center gap-3 rounded-xl bg-canvas p-2.5 transition-colors hover:bg-brand-50"
                  >
                    <ClubMark club={club} size={32} className="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{club.name}</p>
                      <p className="text-[11.5px] text-muted">
                        {club.status === 'approved' ? 'Live in the directory' : 'Pending approval'}
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-muted" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">Up next</h2>
              <Link
                to="/calendar"
                className="text-[12px] font-semibold text-brand-600 hover:underline"
              >
                View all
              </Link>
            </div>
            {nextEvents.length === 0 ? (
              <p className="rounded-xl bg-canvas px-3 py-4 text-[12.5px] leading-relaxed text-muted">
                Nothing scheduled yet. Meetings added by your club leaders will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {nextEvents.map((event) => {
                  const club = clubById.get(event.clubId)
                  return (
                    <Link
                      key={event.id}
                      to={`/clubs/${event.clubId}`}
                      className="flex items-start gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-canvas"
                    >
                      <div className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-canvas py-1.5">
                        <span className="text-[9px] font-bold uppercase text-muted">
                          {new Date(event.startAt).toLocaleDateString(undefined, {
                            month: 'short',
                          })}
                        </span>
                        <span className="text-[15px] font-extrabold leading-none">
                          {new Date(event.startAt).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-[12.5px] font-bold leading-snug">
                          {event.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted">
                          {isToday(event.startAt) ? 'Today' : club?.name ?? 'Club'} ·{' '}
                          {formatTimeRange(event.startAt, event.endAt)}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">Your clubs</h2>
              <Link
                to="/clubs/new"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600 hover:underline"
              >
                <Plus size={13} /> New
              </Link>
            </div>
            {myClubs.length === 0 ? (
              <Link
                to="/discover"
                className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-3 text-[12.5px] font-semibold text-brand-700"
              >
                <Sparkles size={15} /> Find your first club
              </Link>
            ) : (
              <div className="space-y-1">
                {myClubs.slice(0, 6).map((club) => (
                  <Link
                    key={club.id}
                    to={`/clubs/${club.id}`}
                    className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-canvas"
                  >
                    <ClubMark club={club} size={28} className="rounded-lg" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                      {club.name}
                    </span>
                    <ArrowRight size={13} className="shrink-0 text-muted" />
                  </Link>
                ))}
                {myClubs.length > 6 && (
                  <p className="px-1.5 pt-1 text-[11.5px] text-muted">
                    +{myClubs.length - 6} more in Discover
                  </p>
                )}
              </div>
            )}
          </section>

          {nextEvents.length > 0 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[15px] font-extrabold">Next meeting</h2>
              <EventRow event={nextEvents[0]} club={clubById.get(nextEvents[0].clubId)} />
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
