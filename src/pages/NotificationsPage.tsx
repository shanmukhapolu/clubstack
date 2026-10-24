import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Building2, CalendarDays, Check, Clock, Flag, MailCheck, Megaphone, ShieldCheck, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { relativeTime } from '../lib/dates'
import type { Announcement, Club, ClubEvent, ClubJoinRequest, ClubSponsorRequest, ModerationReport, OfficerInvitation } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Spinner } from '../components/ui'

interface InboxState {
  invitations: OfficerInvitation[]
  ownJoinRequests: ClubJoinRequest[]
  joinRequests: ClubJoinRequest[]
  sponsorRequests: ClubSponsorRequest[]
  announcements: Announcement[]
  events: ClubEvent[]
  pendingClubs: Club[]
  reports: ModerationReport[]
}
const emptyInbox: InboxState = { invitations: [], ownJoinRequests: [], joinRequests: [], sponsorRequests: [], announcements: [], events: [], pendingClubs: [], reports: [] }

export function NotificationsPage() {
  const { user } = useAuth()
  const { clubs, joinedIds, refresh } = useClubs()
  const { notify } = useToast()
  const [items, setItems] = useState<InboxState>(emptyInbox)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const isAdmin = user.role === 'admin'
      const managerClubs = clubs.filter(club => isAdmin || club.leaderId === user.id || (club.officerIds ?? []).includes(user.id) || (club.sponsorId === user.id && club.sponsorStatus === 'accepted'))
      const readableClubs = clubs.filter(club => isAdmin || joinedIds.has(club.id) || club.leaderId === user.id || (club.officerIds ?? []).includes(user.id) || (club.sponsorId === user.id && club.sponsorStatus === 'accepted'))
      const feedIds = [...new Set(readableClubs.map(club => club.id))]
      const [invitations, ownJoinRequests, sponsorRequests, nestedRequests, feed, reports] = await Promise.all([
        user.role === 'student' ? api.officerInvitations.listForUser(user.id) : Promise.resolve([]),
        user.role === 'student' ? api.memberships.listRequestsForUser(user.id) : Promise.resolve([]),
        user.role === 'teacher' ? api.sponsorRequests.listForTeacher(user.id) : Promise.resolve([]),
        Promise.all(managerClubs.map(club => api.memberships.listRequestsForClub(club.id))),
        Promise.all(feedIds.length ? [api.announcements.listForClubs(feedIds), api.events.listForClubs(feedIds)] : [Promise.resolve([]), Promise.resolve([])]),
        isAdmin ? api.moderation.list() : Promise.resolve([]),
      ]) as [OfficerInvitation[], ClubJoinRequest[], ClubSponsorRequest[], ClubJoinRequest[][], [Announcement[], ClubEvent[]], ModerationReport[]]
      setItems({
        invitations,
        ownJoinRequests,
        sponsorRequests: sponsorRequests.filter(item => item.status === 'pending'),
        joinRequests: nestedRequests.flat().filter(item => item.status === 'pending'),
        announcements: feed[0].filter(item => Date.now() - item.createdAt < 30 * 24 * 60 * 60 * 1000),
        events: feed[1].filter(item => item.startAt >= Date.now() && item.startAt - Date.now() < 30 * 24 * 60 * 60 * 1000),
        pendingClubs: isAdmin ? clubs.filter(club => club.status === 'pending') : [],
        reports: reports.filter(report => report.status === 'open'),
      })
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setLoading(false) }
  }, [user, clubs, joinedIds, notify])

  useEffect(() => { void load() }, [load])

  async function respondInvitation(item: OfficerInvitation, status: 'accepted' | 'declined') {
    setWorkingId(item.id)
    try { await api.officerInvitations.respond(item.id, status); notify(status === 'accepted' ? 'Officer invitation accepted.' : 'Invitation declined.'); await refresh(); await load() }
    catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }
  async function respondJoin(item: ClubJoinRequest, status: 'approved' | 'declined') {
    setWorkingId(item.id)
    try { await api.memberships.respondToRequest(item.id, status); notify(status === 'approved' ? `${item.displayName} was added to the club.` : 'Membership request declined.'); await refresh(); await load() }
    catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }
  async function respondSponsor(item: ClubSponsorRequest, status: 'accepted' | 'declined') {
    setWorkingId(item.id)
    try { await api.sponsorRequests.respond(item.id, status); notify(status === 'accepted' ? `You are now advisor for ${item.clubName}.` : 'Advisor request declined.'); await refresh(); await load() }
    catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  if (!user) return null
  if (loading) return <Spinner label="Loading notifications"/>
  const count = items.invitations.filter(item => item.status === 'pending').length + items.ownJoinRequests.filter(item => item.status === 'pending').length + items.joinRequests.length + items.sponsorRequests.length + items.announcements.length + items.events.length + items.pendingClubs.length + items.reports.length

  return <div className="fade-in">
    <PageHeader eyebrow="Your inbox" title="Notifications." description="Invitations, membership and advisor requests, announcements, upcoming events, and school-level alerts in one place."/>
    {count === 0 ? <section className="card px-5 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Bell size={20}/></div><h2 className="mt-3 text-[15px] font-extrabold">You’re all caught up</h2><p className="mt-1 text-[12.5px] text-muted">New requests and club updates will appear here.</p></section> : <div className="space-y-8">
      {items.invitations.some(item=>item.status==='pending') && <section><h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold"><MailCheck size={17}/> Officer invitations</h2><div className="space-y-2">{items.invitations.filter(item=>item.status==='pending').map(item=><article key={item.id} className="card flex flex-wrap items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Users size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{item.clubName}</h3><p className="mt-1 text-[12px] text-muted">Invited by {item.invitedByName} · {item.title} · {relativeTime(item.createdAt)}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="lime" loading={workingId===item.id} onClick={()=>void respondInvitation(item,'accepted')}><Check size={14}/> Accept</Button><Button size="sm" variant="secondary" disabled={workingId===item.id} onClick={()=>void respondInvitation(item,'declined')}><X size={14}/> Decline</Button><Link to={`/clubs/${item.clubId}`} className="inline-flex items-center px-2 text-[12px] font-semibold text-brand-600 hover:underline">View club</Link></div></div></article>)}</div></section>}
      {items.ownJoinRequests.length>0 && <section><h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold"><Clock size={17}/> Your membership requests</h2><div className="space-y-2">{items.ownJoinRequests.map(item=><article key={item.id} className="card flex items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-muted"><Users size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{item.clubName}</h3><p className="mt-1 text-[12px] text-muted">Requested {relativeTime(item.createdAt)}</p></div><Badge tone={item.status==='approved'?'lime':item.status==='pending'?'warn':'muted'}>{item.status==='approved'?'Approved':item.status==='pending'?'Pending':'Declined'}</Badge></article>)}</div></section>}
      {items.sponsorRequests.length>0 && <section><h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold"><ShieldCheck size={17}/> Advisor requests</h2><div className="space-y-2">{items.sponsorRequests.map(item=><article key={item.id} className="card flex flex-wrap items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f7e9] text-[#4b6a20]"><ShieldCheck size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{item.clubName}</h3><p className="mt-1 text-[12px] text-muted">Requested by {item.requestedByName} · {relativeTime(item.createdAt)}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="lime" loading={workingId===item.id} onClick={()=>void respondSponsor(item,'accepted')}><Check size={14}/> Accept</Button><Button size="sm" variant="secondary" disabled={workingId===item.id} onClick={()=>void respondSponsor(item,'declined')}><X size={14}/> Decline</Button></div></div></article>)}</div></section>}
      {items.joinRequests.length>0 && <section><h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold"><Users size={17}/> Membership requests</h2><div className="space-y-2">{items.joinRequests.map(item=><article key={item.id} className="card flex flex-wrap items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Users size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{item.displayName} wants to join {item.clubName}</h3><p className="mt-1 text-[12px] text-muted">Requested {relativeTime(item.createdAt)}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="lime" loading={workingId===item.id} onClick={()=>void respondJoin(item,'approved')}><Check size={14}/> Approve member</Button><Button size="sm" variant="secondary" disabled={workingId===item.id} onClick={()=>void respondJoin(item,'declined')}><X size={14}/> Decline</Button><Link to={`/clubs/${item.clubId}/members`} className="inline-flex items-center px-2 text-[12px] font-semibold text-brand-600 hover:underline">View members</Link></div></div></article>)}</div></section>}
      {(items.announcements.length>0 || items.events.length>0) && <section><h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold"><Bell size={17}/> Recent club activity</h2><div className="space-y-2">{items.announcements.map(item=><article key={`a-${item.id}`} className="card flex items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Megaphone size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{item.title}</h3><p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">{item.body}</p><p className="mt-1 text-[11px] text-muted">{relativeTime(item.createdAt)}</p><Link to={`/clubs/${item.clubId}`} className="mt-2 inline-flex text-[12px] font-semibold text-brand-600 hover:underline">Open announcement</Link></div></article>)}{items.events.map(item=><article key={`e-${item.id}`} className="card flex items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f7e9] text-[#4b6a20]"><CalendarDays size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{item.title}</h3><p className="mt-1 text-[12px] text-muted">{new Date(item.startAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})} · {item.location}</p><Link to={`/clubs/${item.clubId}/meetings`} className="mt-2 inline-flex text-[12px] font-semibold text-brand-600 hover:underline">View meeting and RSVP</Link></div></article>)}</div></section>}
      {(items.pendingClubs.length>0 || items.reports.length>0) && <section><h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold"><ShieldCheck size={17}/> School alerts</h2><div className="space-y-2">{items.pendingClubs.map(club=><article key={club.id} className="card flex items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Building2 size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">Club awaiting approval: {club.name}</h3><p className="mt-1 text-[12px] text-muted">Created {relativeTime(club.createdAt)}</p><Link to="/admin/clubs" className="mt-2 inline-flex text-[12px] font-semibold text-brand-600 hover:underline">Review clubs</Link></div><Badge tone="warn">Pending</Badge></article>)}{items.reports.map(report=><article key={report.id} className="card flex items-start gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0eb] text-[#9c2f18]"><Flag size={18}/></div><div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-bold">{report.reason}: {report.clubName}</h3><p className="mt-1 text-[12px] text-muted">{relativeTime(report.createdAt)}</p><Link to="/admin/security" className="mt-2 inline-flex text-[12px] font-semibold text-brand-600 hover:underline">Review safety report</Link></div><Badge tone="warn">Open</Badge></article>)}</div></section>}
    </div>}
    <p className="mt-6 text-[11px] leading-relaxed text-muted">Activity cards reflect updates and upcoming events from clubs you can access. Request actions are rechecked against Firebase security rules.</p>
  </div>
}
