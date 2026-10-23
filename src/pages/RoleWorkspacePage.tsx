import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  CalendarDays, ChevronLeft, ChevronRight, Check, X, ShieldAlert,
  Building2, Flag, Trash2, ClipboardList,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { addMonths, buildMonthGrid, formatDateLong, isSameDay, monthLabel, relativeTime, startOfDay } from '../lib/dates'
import type { AppUser, Club, ClubEvent, ClubStatus, ModerationReport, ReportStatus, Role, ClubSponsorRequest } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Avatar, Badge, Button, ClubMark, Spinner, buttonStyles } from '../components/ui'
import { EventRow } from '../components/EventRow'

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function Stat({ label, value, tone = 'normal' }: { label: string; value: number | string; tone?: 'normal' | 'warn' }) {
  return <div className="card min-w-0 p-4"><p className={`text-[23px] font-extrabold leading-none ${tone === 'warn' ? 'text-[#8a5a00]' : ''}`}>{value}</p><p className="mt-1.5 text-[12px] font-medium text-muted">{label}</p></div>
}

function WorkspaceCalendar({ events, clubs }: { events: ClubEvent[]; clubs: Club[] }) {
  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate])
  const today = startOfDay(new Date())
  const clubById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs])
  const eventsByDay = useMemo(() => {
    const map = new Map<string, ClubEvent[]>()
    for (const event of events) {
      const key = dayKey(new Date(event.startAt))
      map.set(key, [...(map.get(key) ?? []), event].sort((a, b) => a.startAt - b.startAt))
    }
    return map
  }, [events])
  const selected = eventsByDay.get(dayKey(selectedDate)) ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setViewDate((date) => addMonths(date, -1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface hover:bg-canvas" aria-label="Previous month"><ChevronLeft size={17} /></button>
          <p className="min-w-[148px] text-center text-[14px] font-bold">{monthLabel(viewDate)}</p>
          <button type="button" onClick={() => setViewDate((date) => addMonths(date, 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface hover:bg-canvas" aria-label="Next month"><ChevronRight size={17} /></button>
        </div>
        <Button size="sm" variant="secondary" onClick={() => { const now = new Date(); setViewDate(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(startOfDay(now)) }}>Today</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line bg-canvas/70">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted sm:text-[11px]">{day}</div>)}</div>
        <div className="grid grid-cols-7">
          {grid.map((date) => {
            const key = dayKey(date)
            const items = eventsByDay.get(key) ?? []
            const inMonth = date.getMonth() === viewDate.getMonth()
            const isSelected = isSameDay(date, selectedDate)
            const isToday = isSameDay(date, today)
            return <button key={key} type="button" onClick={() => setSelectedDate(startOfDay(date))} className={`min-h-[100px] min-w-0 border-b border-r border-line p-1 text-left align-top transition-colors sm:min-h-[122px] sm:p-1.5 ${inMonth ? 'bg-surface hover:bg-canvas/70' : 'bg-canvas/40'} ${isSelected ? 'ring-2 ring-inset ring-brand-300' : ''}`}>
              <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10.5px] font-bold sm:text-[11.5px] ${isToday ? 'bg-ink text-white' : isSelected ? 'bg-brand-100 text-brand-700' : inMonth ? 'text-ink' : 'text-muted'}`}>{date.getDate()}</span>
              <span className="block space-y-1">
                {items.slice(0, 3).map(item => {
                  const club = clubById.get(item.clubId)
                  const color = club?.color ?? '#8b7cff'
                  return <span key={item.id} title={`${item.title} · ${club?.name ?? 'Club'}`} className="block truncate rounded px-1 py-1 text-[9px] font-semibold leading-tight sm:text-[10px]" style={{ backgroundColor: `${color}27`, borderLeft: `2px solid ${color}` }}>{item.title}</span>
                })}
                {items.length > 3 && <span className="block px-1 text-[9px] font-bold text-muted sm:text-[10px]">+{items.length - 3} more</span>}
              </span>
            </button>
          })}
        </div>
      </div>
      <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-[15px] font-extrabold">{isSameDay(selectedDate, today) ? 'Today' : formatDateLong(selectedDate.getTime())}</h2><span className="text-[12px] text-muted">{selected.length} event{selected.length === 1 ? '' : 's'}</span></div>
        {selected.length === 0 ? <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-7 text-center text-[13px] text-muted">Nothing scheduled for this day.</div> : <div className="grid gap-2.5 lg:grid-cols-2">{selected.map(event => <EventRow key={event.id} event={event} club={clubById.get(event.clubId)} />)}</div>}
      </section>
    </div>
  )
}

export function RoleWorkspacePage() {
  const { user } = useAuth()
  const { clubs, loading: clubsLoading, refresh: refreshClubs } = useClubs()
  const { notify } = useToast()
  const { pathname } = useLocation()
  const isAdmin = user?.role === 'admin'
  const section = pathname.split('/')[2] || 'home'
  const [users, setUsers] = useState<AppUser[]>([])
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [requests, setRequests] = useState<ClubSponsorRequest[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [userTab, setUserTab] = useState<'student' | 'teacher' | 'admin'>('student')
  const [clubTab, setClubTab] = useState<'active' | 'proposals' | 'other'>('active')

  useEffect(() => {
    if (!user) return
    let active = true
    setLoadingData(true)
    void (async () => {
      try {
        if (user.role === 'admin') {
          const [allUsers, allEvents, allReports] = await Promise.all([api.users.list(), api.events.listAll(), api.moderation.list()])
          if (active) { setUsers(allUsers); setEvents(allEvents); setReports(allReports) }
        } else if (user.role === 'teacher') {
          const [allEvents, ownReports, teacherRequests] = await Promise.all([api.events.listAll(), api.moderation.listMine(user.id), api.sponsorRequests.listForTeacher(user.id)])
          if (active) {
            setEvents(allEvents)
            setReports(ownReports)
            setRequests(teacherRequests)
          }
        }
      } catch (caught) {
        if (active) notify(friendlyError(caught), 'error')
      } finally {
        if (active) setLoadingData(false)
      }
    })()
    return () => { active = false }
  }, [user?.id, user?.role, notify])

  const teacherClubs = useMemo(() => user?.role === 'teacher'
    ? clubs.filter((club) => club.sponsorId === user.id && club.sponsorStatus === 'accepted').sort((a, b) => a.name.localeCompare(b.name))
    : [], [clubs, user])
  const activeClubs = clubs.filter((club) => club.status === 'approved')
  const pendingClubs = clubs.filter((club) => club.status === 'pending').sort((a, b) => a.createdAt - b.createdAt)
  const rejectedClubs = clubs.filter((club) => club.status === 'rejected')
  const upcomingEvents = useMemo(() => events.filter((event) => event.startAt >= Date.now()).sort((a, b) => a.startAt - b.startAt), [events])
  const clubById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs])
  const students = users.filter((person) => person.role === 'student')
  const teachers = users.filter((person) => person.role === 'teacher')
  const admins = users.filter((person) => person.role === 'admin')
  const ownPendingRequests = requests.filter((request) => request.status === 'pending')

  if (!user) return null

  async function respondToSponsorRequest(request: ClubSponsorRequest, status: 'accepted' | 'declined') {
    setWorkingId(request.id)
    try {
      await api.sponsorRequests.respond(request.id, status)
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item))
      await refreshClubs()
      notify(status === 'accepted' ? `You are now the advisor for ${request.clubName}.` : `Request for ${request.clubName} declined.`)
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  async function reportClub(club: Club) {
    const reason = window.prompt(`What concern are you reporting about ${club.name}? (Safety, policy, inaccurate information, or other)`)
    if (!reason?.trim()) return
    const details = window.prompt('Add details for the platform administrators (optional).') ?? ''
    setWorkingId(club.id)
    try {
      await api.moderation.create({ clubId: club.id, clubName: club.name, reason: reason.trim().slice(0, 120), details: details.trim().slice(0, 2000) }, user)
      if (user.role === 'teacher') setReports((current) => [{ id: `local-${Date.now()}`, reporterId: user.id, reporterName: user.displayName, clubId: club.id, clubName: club.name, reason: reason.trim().slice(0, 120), details: details.trim().slice(0, 2000), status: 'open', createdAt: Date.now() }, ...current])
      notify('Report sent to platform administrators.')
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  async function setClubStatus(club: Club, status: ClubStatus) {
    if (status === 'rejected' && !window.confirm(`Reject “${club.name}”? The leader can revise it.`)) return
    setWorkingId(club.id)
    try {
      await api.clubs.setStatus(club.id, status)
      await refreshClubs()
      notify(status === 'approved' ? `${club.name} approved.` : `${club.name} rejected.`)
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  async function deleteClub(club: Club) {
    if (!window.confirm(`Permanently delete ${club.name} and its related club data? This cannot be undone.`)) return
    setWorkingId(club.id)
    try { await api.clubs.delete(club.id); await refreshClubs(); notify(`${club.name} deleted.`) }
    catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  async function setUserRole(person: AppUser, role: Role) {
    setWorkingId(person.id)
    try {
      await api.users.setRole(person.id, role)
      setUsers(current => current.map(item => item.id === person.id ? { ...item, role } : item))
      notify(`${person.displayName} is now ${role === 'admin' ? 'an admin' : role === 'teacher' ? 'a teacher' : 'a student'}.`)
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  async function setReportStatus(report: ModerationReport, status: ReportStatus) {
    setWorkingId(report.id)
    try {
      await api.moderation.setStatus(report.id, status)
      setReports(current => current.map(item => item.id === report.id ? { ...item, status } : item))
      notify(`Report marked ${status}.`)
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  const adminHome = (
    <>
      <PageHeader eyebrow="Platform overview" title="ClubStack at a glance." description="A current view of clubs, people, proposals, and what is coming up next." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total clubs" value={clubs.length} />
        <Stat label="Students" value={students.length} />
        <Stat label="Pending proposals" value={pendingClubs.length} tone="warn" />
        <Stat label="Upcoming meetings" value={upcomingEvents.length} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-[15px] font-extrabold">Club proposals</h2><Link to="/admin/clubs" className="text-[12px] font-semibold text-brand-600 hover:underline">Review all</Link></div>
          {clubsLoading ? <Spinner label="Loading proposals" /> : pendingClubs.length === 0 ? <p className="rounded-xl bg-canvas px-3.5 py-4 text-[13px] text-muted">No proposals are waiting for review.</p> : <div className="space-y-2.5">{pendingClubs.slice(0, 5).map(club => <div key={club.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3"><ClubMark club={club} size={38} /><div className="min-w-0 flex-1"><Link to={`/clubs/${club.id}`} className="text-[13px] font-bold hover:underline">{club.name}</Link><p className="mt-0.5 text-[11.5px] text-muted">By {club.leaderName} · {relativeTime(club.createdAt)}</p></div><Badge tone="warn">Pending</Badge></div>)}</div>}
        </section>
        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-[15px] font-extrabold">Upcoming meetings</h2><Link to="/admin/calendar" className="text-[12px] font-semibold text-brand-600 hover:underline">Full calendar</Link></div>
          {loadingData ? <Spinner label="Loading events" /> : upcomingEvents.length === 0 ? <p className="rounded-xl bg-canvas px-3.5 py-4 text-[13px] text-muted">No upcoming events are scheduled.</p> : <div className="space-y-2">{upcomingEvents.slice(0, 6).map(event => <EventRow key={event.id} event={event} club={clubById.get(event.clubId)} />)}</div>}
        </section>
        <section className="card p-4 sm:p-5"><h2 className="text-[15px] font-extrabold">Latest activity</h2><div className="mt-3 space-y-3 text-[12.5px] text-ink-soft">{[...clubs].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4).map(club=><div key={club.id} className="flex items-start gap-2.5"><ClubMark club={club} size={30}/><p className="min-w-0 flex-1"><Link to={`/clubs/${club.id}`} className="font-bold hover:underline">{club.name}</Link><span className="block text-[11.5px] text-muted">Submitted {relativeTime(club.createdAt)} · {club.status}</span></p></div>)}</div></section>
        <section className="card p-4 sm:p-5"><h2 className="text-[15px] font-extrabold">Safety queue</h2><p className="mt-1 text-[12px] text-muted">{reports.filter(r=>r.status==='open').length} open report(s) need review.</p><Link to="/admin/security" className={buttonStyles('secondary','sm','mt-3')}>Open safety & security</Link></section>
      </div>
    </>
  )

  if (isAdmin && section === 'home') return <div className="fade-in">{adminHome}</div>

  if (isAdmin && section === 'users') return <div className="fade-in">
    <PageHeader eyebrow="Administration" title="Users." description="Review student and teacher accounts and manage platform roles." />
    <div className="mb-4 flex flex-wrap gap-2">{([{id:'student',label:`Students · ${students.length}`},{id:'teacher',label:`Teachers · ${teachers.length}`},{id:'admin',label:`Admins · ${admins.length}`}] as {id:'student'|'teacher'|'admin';label:string}[]).map(item=><button key={item.id} type="button" onClick={()=>setUserTab(item.id)} className={`rounded-full px-4 py-2 text-[12.5px] font-semibold ${userTab===item.id?'bg-ink text-white':'border border-line bg-surface text-ink-soft hover:bg-canvas'}`}>{item.label}</button>)}</div>
    {loadingData ? <Spinner label="Loading users" /> : <div className="overflow-hidden rounded-2xl border border-line bg-surface"><div className="hidden grid-cols-[1fr_170px_130px] gap-3 border-b border-line bg-canvas/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted sm:grid"><span>Person</span><span>Role</span><span>Joined</span></div>{users.filter(person=>person.role===userTab).map(person=><div key={person.id} className="grid grid-cols-1 gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[1fr_170px_130px] sm:items-center"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={person.displayName} size={34}/><div className="min-w-0"><p className="truncate text-[13px] font-bold">{person.displayName}{person.id===user.id&&<span className="ml-1.5 text-[11px] font-medium text-muted">(you)</span>}</p><p className="truncate text-[11.5px] text-muted">{person.email}</p></div></div><select value={person.role} disabled={person.id===user.id||workingId===person.id} onChange={event=>void setUserRole(person,event.target.value as Role)} className="field h-9 py-0 text-[12px]" aria-label={`Role for ${person.displayName}`}><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select><p className="text-[11.5px] text-muted">{relativeTime(person.createdAt)}</p></div>)}{users.filter(person=>person.role===userTab).length===0&&<p className="px-4 py-7 text-center text-[13px] text-muted">No accounts in this group yet.</p>}</div>}
  </div>

  if (isAdmin && section === 'clubs') return <div className="fade-in">
    <PageHeader eyebrow="Club management" title="Clubs." description="Browse active clubs or review newly submitted proposals." />
    <div className="mb-4 flex flex-wrap gap-2">{([{id:'active',label:`Active clubs · ${activeClubs.length}`},{id:'proposals',label:`Proposals · ${pendingClubs.length}`},{id:'other',label:`Rejected · ${rejectedClubs.length}`}] as {id:'active'|'proposals'|'other';label:string}[]).map(item=><button key={item.id} type="button" onClick={()=>setClubTab(item.id)} className={`rounded-full px-4 py-2 text-[12.5px] font-semibold ${clubTab===item.id?'bg-ink text-white':'border border-line bg-surface text-ink-soft hover:bg-canvas'}`}>{item.label}</button>)}</div>
    {clubsLoading ? <Spinner label="Loading clubs" /> : (clubTab==='active'?activeClubs:clubTab==='proposals'?pendingClubs:rejectedClubs).length===0 ? <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-[13px] text-muted">No clubs in this view.</div> : <div className="space-y-3">{(clubTab==='active'?activeClubs:clubTab==='proposals'?pendingClubs:rejectedClubs).map(club=><div key={club.id} className="card flex flex-wrap items-start gap-3 p-4"><ClubMark club={club} size={44}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link to={`/clubs/${club.id}`} className="text-[14px] font-bold hover:underline">{club.name}</Link><Badge tone={club.status==='approved'?'lime':club.status==='pending'?'warn':'muted'}>{club.status}</Badge></div><p className="mt-0.5 text-[11.5px] text-muted">{club.category} · {club.leaderName} · {club.memberCount} members · {relativeTime(club.createdAt)}</p><p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{club.description}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto">{club.status!=='approved'&&<Button size="sm" variant="lime" loading={workingId===club.id} onClick={()=>void setClubStatus(club,'approved')}><Check size={14}/> Approve</Button>}{club.status==='pending'&&<Button size="sm" variant="danger" disabled={workingId===club.id} onClick={()=>void setClubStatus(club,'rejected')}><X size={14}/> Reject</Button>}<Button size="sm" variant="secondary" disabled={workingId===club.id} onClick={()=>void deleteClub(club)}><Trash2 size={14}/> Delete</Button></div></div>)}</div>}
  </div>

  if (isAdmin && section === 'calendar') return <div className="fade-in"><PageHeader eyebrow="School calendar" title="Every club, one calendar." description="All published and pending club meetings are shown by date. Each club has its own accent color; select a day to see every event, including busy days." />{loadingData? <Spinner label="Loading school calendar" /> : <WorkspaceCalendar events={events} clubs={clubs} />}</div>

  if (isAdmin && section === 'security') return <div className="fade-in">
    <PageHeader eyebrow="Safety & security" title="Reports and follow-up." description="Review reports from students and teachers, track their status, and open the related club page for context." />
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Total reports" value={reports.length}/><Stat label="Open" value={reports.filter(r=>r.status==='open').length} tone="warn"/><Stat label="Resolved" value={reports.filter(r=>r.status==='resolved').length}/></div>
    {loadingData?<Spinner label="Loading reports"/>:reports.length===0?<div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-[13px] text-muted"><ShieldAlert size={22} className="mx-auto mb-2"/>No reports have been submitted.</div>:<div className="space-y-3">{[...reports].sort((a,b)=>b.createdAt-a.createdAt).map(report=><div key={report.id} className="card flex flex-wrap items-start gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link to={`/clubs/${report.clubId}`} className="text-[14px] font-bold hover:underline">{report.clubName}</Link><Badge tone={report.status==='resolved'?'lime':report.status==='open'?'warn':'muted'}>{report.status}</Badge></div><p className="mt-1 text-[12px] text-muted">{report.reason} · Reported by {report.reporterName} · {relativeTime(report.createdAt)}</p>{report.details&&<p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{report.details}</p>}</div><select value={report.status} disabled={workingId===report.id} onChange={event=>void setReportStatus(report,event.target.value as ReportStatus)} className="field h-9 w-auto min-w-[130px] py-0 text-[12px]" aria-label={`Status for report about ${report.clubName}`}><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option></select></div>)}</div>}
  </div>

  if (!isAdmin && section === 'home') return <div className="fade-in">
    <PageHeader eyebrow="Teacher workspace" title="Your clubs, at a glance." description="Respond to sponsorship requests, keep up with meetings for the clubs you advise, and flag concerns when something needs attention." />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Clubs you advise" value={teacherClubs.length}/><Stat label="Sponsor requests" value={ownPendingRequests.length} tone="warn"/><Stat label="Upcoming club meetings" value={upcomingEvents.filter(event=>teacherClubs.some(club=>club.id===event.clubId)).length}/><Stat label="Reports you filed" value={reports.length}/></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[15px] font-extrabold">Sponsor requests</h2><span className="text-[11.5px] text-muted">{ownPendingRequests.length} pending</span></div>
        {loadingData?<Spinner label="Loading sponsor requests"/>:ownPendingRequests.length===0?<p className="rounded-xl bg-canvas px-3.5 py-4 text-[13px] text-muted">No sponsor requests need your attention.</p>:<div className="space-y-3">{ownPendingRequests.map(request=><div key={request.id} className="rounded-2xl border border-line p-3.5"><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><Link to={`/clubs/${request.clubId}`} className="text-[13.5px] font-bold hover:underline">{request.clubName}</Link><p className="mt-1 text-[11.5px] text-muted">Requested by {request.requestedByName}</p></div><Badge tone="warn">Pending</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="lime" loading={workingId===request.id} onClick={()=>void respondToSponsorRequest(request,'accepted')}><Check size={14}/> Accept</Button><Button size="sm" variant="secondary" disabled={workingId===request.id} onClick={()=>void respondToSponsorRequest(request,'declined')}><X size={14}/> Decline</Button></div></div>)}</div>}
      </section>
      <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[15px] font-extrabold">Upcoming meetings</h2><Link to="/teacher/calendar" className="text-[12px] font-semibold text-brand-600 hover:underline">Calendar</Link></div>
        {loadingData?<Spinner label="Loading meetings"/>:upcomingEvents.filter(event=>teacherClubs.some(club=>club.id===event.clubId)).slice(0,6).length===0?<p className="rounded-xl bg-canvas px-3.5 py-4 text-[13px] text-muted">Meetings from clubs you advise will appear here.</p>:<div className="space-y-2.5">{upcomingEvents.filter(event=>teacherClubs.some(club=>club.id===event.clubId)).slice(0,6).map(event=><EventRow key={event.id} event={event} club={clubById.get(event.clubId)}/>)}</div>}
      </section>
    </div>
  </div>

  if (!isAdmin && section === 'clubs') return <div className="fade-in">
    <PageHeader eyebrow="Teacher workspace" title="My clubs." description="Clubs appear here after you accept their sponsorship request. Open a club to see its details and meetings." />
    {clubsLoading?<Spinner label="Loading your clubs"/>:teacherClubs.length===0?<div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-9 text-center"><Building2 size={24} className="mx-auto text-muted"/><p className="mt-3 text-[14px] font-bold">No advised clubs yet</p><p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">When a student asks you to sponsor a club, the request will appear on your home page. Accepted clubs will be listed here.</p><Link to="/teacher" className={buttonStyles('secondary','sm','mt-4')}>Review requests</Link></div>:<div className="grid gap-3 md:grid-cols-2">{teacherClubs.map(club=><div key={club.id} className="card p-4"><div className="flex items-start gap-3"><ClubMark club={club} size={44}/><div className="min-w-0 flex-1"><Link to={`/clubs/${club.id}`} className="text-[14px] font-bold hover:underline">{club.name}</Link><p className="mt-1 text-[11.5px] text-muted">{club.category} · {club.memberCount} members</p><p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">{club.description}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Link to={`/clubs/${club.id}`} className={buttonStyles('secondary','sm')}>Open club</Link><Link to={`/clubs/${club.id}/meetings`} className={buttonStyles('ghost','sm')}>Meetings</Link><Button size="sm" variant="ghost" loading={workingId===club.id} onClick={()=>void reportClub(club)}><Flag size={14}/> Report concern</Button></div></div>)}</div>}
  </div>

  if (!isAdmin && section === 'calendar') {
    const allowedIds = new Set(teacherClubs.map(club=>club.id))
    const teacherEvents = events.filter(event=>allowedIds.has(event.clubId))
    return <div className="fade-in"><PageHeader eyebrow="Advisor calendar" title="Meetings for your clubs." description="A date-based view of the meetings and events for clubs you advise. Busy days show a count, and selecting a day lists every event." />{loadingData?<Spinner label="Loading advisor calendar"/>:<WorkspaceCalendar events={teacherEvents} clubs={teacherClubs}/>}</div>
  }

  if (!isAdmin && section === 'reports') return <div className="fade-in">
    <PageHeader eyebrow="Teacher workspace" title="Your reports." description="Reports you have sent to platform administrators and their current status." />
    {loadingData?<Spinner label="Loading your reports"/>:reports.length===0?<div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center"><ClipboardList size={22} className="mx-auto text-muted"/><p className="mt-2 text-[13px] font-semibold">No reports filed yet</p><p className="mt-1 text-[12px] text-muted">Use “Report concern” from My Clubs if an issue needs administrator attention.</p></div>:<div className="space-y-3">{reports.map(report=><div key={report.id} className="card p-4"><div className="flex flex-wrap items-center gap-2"><Link to={`/clubs/${report.clubId}`} className="text-[14px] font-bold hover:underline">{report.clubName}</Link><Badge tone={report.status==='resolved'?'lime':report.status==='open'?'warn':'muted'}>{report.status}</Badge></div><p className="mt-1 text-[12px] text-muted">{report.reason} · {relativeTime(report.createdAt)}</p>{report.details&&<p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{report.details}</p>}</div>)}</div>}
  </div>

  return <div className="fade-in"><PageHeader eyebrow={isAdmin?'Administration':'Teacher workspace'} title="Nothing here yet." description="Use the navigation to open a workspace page." /><Link to={isAdmin?'/admin':'/teacher'} className={buttonStyles('secondary','sm')}>Go to home</Link></div>
}
