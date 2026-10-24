import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Building2, CalendarDays, Check, Clock, Flag, MailCheck, Megaphone, ShieldCheck, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { relativeTime } from '../lib/dates'
import type { ClubJoinRequest, ClubSponsorRequest, OfficerInvitation } from '../lib/types'
import {
  emptyInbox,
  fetchInboxItems,
  getReadNotificationIds,
  markAllNotificationsRead,
  markNotificationRead,
  notificationIds,
  syncKnownNotificationIds,
  type InboxState,
} from '../lib/notificationState'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Spinner } from '../components/ui'

export function NotificationsPage() {
  const { user } = useAuth()
  const { clubs, joinedIds, refresh } = useClubs()
  const { notify } = useToast()
  const [items, setItems] = useState<InboxState>(emptyInbox)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const nextItems = await fetchInboxItems(user, clubs, joinedIds)
      setItems(nextItems)
      syncKnownNotificationIds(user.id, notificationIds(nextItems))
      setReadIds(getReadNotificationIds(user.id))
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setLoading(false)
    }
  }, [user, clubs, joinedIds, notify])

  useEffect(() => { void load() }, [load])

  function markAsRead(id: string) {
    if (!user) return
    markNotificationRead(user.id, id)
    setReadIds(getReadNotificationIds(user.id))
  }

  function markAllAsRead() {
    if (!user) return
    markAllNotificationsRead(user.id)
    setReadIds(getReadNotificationIds(user.id))
  }

  function cardClass(id: string, base: string) {
    return `card relative after:content-[''] after:absolute after:right-3 after:top-3 after:h-2 after:w-2 after:rounded-full after:bg-red-500 ${readIds.has(id) ? 'after:hidden' : ''} ${base}`
  }

  async function respondInvitation(item: OfficerInvitation, status: 'accepted' | 'declined') {
    setWorkingId(item.id)
    markAsRead(`invitation:${item.id}`)
    try {
      await api.officerInvitations.respond(item.id, status)
      notify(status === 'accepted' ? 'Officer invitation accepted.' : 'Invitation declined.')
      await refresh()
      await load()
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setWorkingId(null)
    }
  }

  async function respondJoin(item: ClubJoinRequest, status: 'approved' | 'declined') {
    setWorkingId(item.id)
    markAsRead(`join:${item.id}`)
    try {
      await api.memberships.respondToRequest(item.id, status)
      notify(status === 'approved' ? `${item.displayName} was added to the club.` : 'Membership request declined.')
      await refresh()
      await load()
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setWorkingId(null)
    }
  }

  async function respondSponsor(item: ClubSponsorRequest, status: 'accepted' | 'declined') {
    setWorkingId(item.id)
    markAsRead(`sponsor:${item.id}`)
    try {
      await api.sponsorRequests.respond(item.id, status)
      notify(status === 'accepted' ? `You are now advisor for ${item.clubName}.` : 'Advisor request declined.')
      await refresh()
      await load()
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setWorkingId(null)
    }
  }

  if (!user) return null
  if (loading) return <Spinner label="Loading notifications" />

  const activeNotificationIds = notificationIds(items)
  const unreadCount = activeNotificationIds.filter((id) => !readIds.has(id)).length

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Your inbox"
        title="Notifications."
        description="Invitations, membership and advisor requests, announcements, upcoming events, and school-level alerts in one place."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted"><span className="font-semibold text-ink">{unreadCount}</span> unread</p>
        <Button size="sm" variant="secondary" disabled={unreadCount === 0} onClick={markAllAsRead}>
          <Check size={14} /> Mark all as read
        </Button>
      </div>

      {activeNotificationIds.length === 0 ? (
        <section className="card px-5 py-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-canvas text-ink-soft"><Bell size={20} /></div>
          <h2 className="mt-3 text-[15px] font-bold">You’re all caught up</h2>
          <p className="mt-1 text-[12.5px] text-muted">New requests and club updates will appear here.</p>
        </section>
      ) : (
        <div className="space-y-8">
          {items.invitations.some((item) => item.status === 'pending') && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><MailCheck size={17} /> Officer invitations</h2>
              <div className="space-y-2">
                {items.invitations.filter((item) => item.status === 'pending').map((item) => {
                  const id = `invitation:${item.id}`
                  return (
                    <article key={item.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex flex-wrap items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><Users size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13.5px] font-bold">{item.clubName}</h3>
                        <p className="mt-1 text-[12px] text-muted">Invited by {item.invitedByName} · {item.title} · {relativeTime(item.createdAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="lime" loading={workingId === item.id} onClick={() => void respondInvitation(item, 'accepted')}><Check size={14} /> Accept</Button>
                          <Button size="sm" variant="secondary" disabled={workingId === item.id} onClick={() => void respondInvitation(item, 'declined')}><X size={14} /> Decline</Button>
                          <Link to={`/clubs/${item.clubId}`} className="inline-flex items-center px-2 text-[12px] font-semibold text-ink-soft hover:underline">View club</Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {items.ownJoinRequests.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><Clock size={17} /> Your membership requests</h2>
              <div className="space-y-2">
                {items.ownJoinRequests.map((item) => {
                  const id = `own-join:${item.id}`
                  return (
                    <article key={item.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><Users size={18} /></div>
                      <div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{item.clubName}</h3><p className="mt-1 text-[12px] text-muted">Requested {relativeTime(item.createdAt)}</p></div>
                      <Badge tone={item.status === 'approved' ? 'lime' : item.status === 'pending' ? 'warn' : 'muted'}>{item.status === 'approved' ? 'Approved' : item.status === 'pending' ? 'Pending' : 'Declined'}</Badge>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {items.sponsorRequests.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><ShieldCheck size={17} /> Advisor requests</h2>
              <div className="space-y-2">
                {items.sponsorRequests.map((item) => {
                  const id = `sponsor:${item.id}`
                  return (
                    <article key={item.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex flex-wrap items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><ShieldCheck size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13.5px] font-bold">{item.clubName}</h3>
                        <p className="mt-1 text-[12px] text-muted">Requested by {item.requestedByName} · {relativeTime(item.createdAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="lime" loading={workingId === item.id} onClick={() => void respondSponsor(item, 'accepted')}><Check size={14} /> Accept</Button>
                          <Button size="sm" variant="secondary" disabled={workingId === item.id} onClick={() => void respondSponsor(item, 'declined')}><X size={14} /> Decline</Button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {items.joinRequests.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><Users size={17} /> Membership requests</h2>
              <div className="space-y-2">
                {items.joinRequests.map((item) => {
                  const id = `join:${item.id}`
                  return (
                    <article key={item.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex flex-wrap items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><Users size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13.5px] font-bold">{item.displayName} wants to join {item.clubName}</h3>
                        <p className="mt-1 text-[12px] text-muted">Requested {relativeTime(item.createdAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="lime" loading={workingId === item.id} onClick={() => void respondJoin(item, 'approved')}><Check size={14} /> Approve member</Button>
                          <Button size="sm" variant="secondary" disabled={workingId === item.id} onClick={() => void respondJoin(item, 'declined')}><X size={14} /> Decline</Button>
                          <Link to={`/clubs/${item.clubId}/members`} className="inline-flex items-center px-2 text-[12px] font-semibold text-ink-soft hover:underline">View members</Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {(items.announcements.length > 0 || items.events.length > 0) && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><Bell size={17} /> Recent club activity</h2>
              <div className="space-y-2">
                {items.announcements.map((item) => {
                  const id = `announcement:${item.id}`
                  return (
                    <article key={item.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><Megaphone size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13.5px] font-bold">{item.title}</h3>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">{item.body}</p>
                        <p className="mt-1 text-[11px] text-muted">{relativeTime(item.createdAt)}</p>
                        <Link to={`/clubs/${item.clubId}`} className="mt-2 inline-flex text-[12px] font-semibold text-ink-soft hover:underline">Open announcement</Link>
                      </div>
                    </article>
                  )
                })}
                {items.events.map((item) => {
                  const id = `event:${item.id}`
                  return (
                    <article key={item.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><CalendarDays size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13.5px] font-bold">{item.title}</h3>
                        <p className="mt-1 text-[12px] text-muted">{new Date(item.startAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {item.location}</p>
                        <Link to={`/clubs/${item.clubId}/meetings`} className="mt-2 inline-flex text-[12px] font-semibold text-ink-soft hover:underline">View meeting and RSVP</Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {(items.pendingClubs.length > 0 || items.reports.length > 0) && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><ShieldCheck size={17} /> School alerts</h2>
              <div className="space-y-2">
                {items.pendingClubs.map((club) => {
                  const id = `pending-club:${club.id}`
                  return (
                    <article key={club.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><Building2 size={18} /></div>
                      <div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">Club awaiting approval: {club.name}</h3><p className="mt-1 text-[12px] text-muted">Created {relativeTime(club.createdAt)}</p><Link to="/admin/clubs" className="mt-2 inline-flex text-[12px] font-semibold text-ink-soft hover:underline">Review clubs</Link></div>
                      <Badge tone="warn">Pending</Badge>
                    </article>
                  )
                })}
                {items.reports.map((report) => {
                  const id = `report:${report.id}`
                  return (
                    <article key={report.id} data-unread={!readIds.has(id)} onClick={() => markAsRead(id)} className={cardClass(id, 'flex items-start gap-3 p-4')}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink-soft"><Flag size={18} /></div>
                      <div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{report.reason}: {report.clubName}</h3><p className="mt-1 text-[12px] text-muted">{relativeTime(report.createdAt)}</p><Link to="/admin/security" className="mt-2 inline-flex text-[12px] font-semibold text-ink-soft hover:underline">Review safety report</Link></div>
                      <Badge tone="warn">Open</Badge>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
      <p className="mt-6 text-[11px] leading-relaxed text-muted">Activity cards reflect updates and upcoming events from clubs you can access. Request actions are rechecked against Firebase security rules.</p>
    </div>
  )
}
