import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, List, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { useClubFeed } from '../hooks/useClubFeed'
import { api } from '../lib/backend'
import { defaultEventStart, fromDateTimeInput, toDateTimeInput } from '../lib/dates'
import { addMonths, buildMonthGrid, formatDateLong, isSameDay, monthLabel, startOfDay } from '../lib/dates'
import { friendlyError } from '../lib/helpers'
import type { Club, ClubEvent } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Button, ClubMark, Modal, Spinner } from '../components/ui'
import { EventRow } from '../components/EventRow'

function keyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export function ClubMeetingsPage() {
  const { clubId='' }=useParams()
  const { user }=useAuth()
  const { clubs, isJoined }=useClubs()
  const { notify }=useToast()
  const fromContext=clubs.find(item=>item.id===clubId) ?? null
  const [club,setClub]=useState<Club|null>(fromContext)
  const [clubLoading,setClubLoading]=useState(!fromContext)
  const [hasPendingOfficerInvite,setHasPendingOfficerInvite]=useState(false)
  const hasPrivateAccess = !!(user && club && (isJoined(club.id) || user.role === 'admin' || club.leaderId === user.id || (club.sponsorId === user.id && club.sponsorStatus === 'accepted') || (club.officerIds ?? []).includes(user.id)))
  const { events,loading,refresh:refreshFeed }=useClubFeed(clubId && hasPrivateAccess ? [clubId] : [])
  const [view,setView]=useState<'calendar'|'list'>('calendar')
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1))
  const [selectedDate,setSelectedDate]=useState(()=>startOfDay(new Date()))
  const [addOpen,setAddOpen]=useState(false)
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [location,setLocation]=useState('')
  const [start,setStart]=useState(()=>toDateTimeInput(defaultEventStart()))
  const [end,setEnd]=useState('')
  const [saving,setSaving]=useState(false)
  const [meetingType,setMeetingType]=useState<ClubEvent['type']>('General Meeting')
  const [attendance,setAttendance]=useState<ClubEvent['attendance']>('optional')
  const [editingEvent,setEditingEvent]=useState<ClubEvent|null>(null)

  useEffect(() => {
    if (fromContext) {
      setClub(fromContext)
      setClubLoading(false)
      return
    }
    let active = true
    void api.clubs.get(clubId).then(found => {
      if (!active) return
      setClub(found)
      setClubLoading(false)
    }).catch(() => {
      if (active) setClubLoading(false)
    })
    return () => { active = false }
  }, [clubId, fromContext])

  useEffect(() => {
    if (!user || user.role !== 'student' || !clubId) {
      setHasPendingOfficerInvite(false)
      return
    }
    let active = true
    void api.officerInvitations.listForUser(user.id).then(invitations => {
      if (active) setHasPendingOfficerInvite(invitations.some(item => item.clubId === clubId && item.status === 'pending'))
    }).catch(() => {
      if (active) setHasPendingOfficerInvite(false)
    })
    return () => { active = false }
  }, [clubId, user?.id, user?.role])

  const canManage=!!(user&&club&&(user.role==='admin'||club.leaderId===user.id||(club.sponsorId===user.id&&club.sponsorStatus==='accepted')||(club.officerIds ?? []).includes(user.id)))
  const canView=!!(user&&club&&(club.status==='approved'||canManage||isJoined(club.id)||hasPendingOfficerInvite))
  const grid=useMemo(()=>buildMonthGrid(month),[month])
  const byDay=useMemo(()=>{
    const result=new Map<string,ClubEvent[]>()
    for(const event of events){if(event.deletedAt)continue;const key=keyFor(new Date(event.startAt));result.set(key,[...(result.get(key)??[]),event].sort((a,b)=>a.startAt-b.startAt))}
    return result
  },[events])
  const visibleEvents=events.filter((event)=>!event.deletedAt)
  const selected=byDay.get(keyFor(selectedDate))??[]
  const today=startOfDay(new Date())

  async function createEvent(event:FormEvent){
    event.preventDefault()
    if(!club||!user)return
    if(title.trim().length<3){notify('Give the meeting a title of at least 3 characters.','error');return}
    const startAt=fromDateTimeInput(start)
    if(!Number.isFinite(startAt)){notify('Choose a valid start date and time.','error');return}
    setSaving(true)
    try{
      const input={title:title.trim(),description:description.trim(),location:location.trim()||club.location,startAt,endAt:end?fromDateTimeInput(end):null,type:meetingType,attendance}
      if(editingEvent) await api.events.update(editingEvent.id,input)
      else await api.events.create(club.id,input,user)
      setTitle('');setDescription('');setLocation('');setStart(toDateTimeInput(defaultEventStart()));setEnd('');setMeetingType('General Meeting');setAttendance('optional');setEditingEvent(null);setAddOpen(false)
      await refreshFeed();notify(editingEvent?'Meeting updated. Members will see the update in Notifications.':'Meeting added to the club calendar.')
    }catch(caught){notify(friendlyError(caught),'error')}
    finally{setSaving(false)}
  }

  function editEvent(item:ClubEvent){setEditingEvent(item);setTitle(item.title);setDescription(item.description);setLocation(item.location);setStart(toDateTimeInput(item.startAt));setEnd(item.endAt?toDateTimeInput(item.endAt):'');setMeetingType(item.type??'General Meeting');setAttendance(item.attendance??'optional');setAddOpen(true)}

  async function deleteEvent(item:ClubEvent){
    if(!window.confirm(`Delete “${item.title}”? This cannot be undone.`))return
    try{await api.events.remove(item.id);await refreshFeed();notify('Meeting deleted. Members will see the cancellation in Notifications.')}
    catch(caught){notify(friendlyError(caught),'error')}
  }

  if(!user||clubLoading)return <Spinner label="Loading club meetings"/>
  if(!club||!canView)return <div className="rounded-2xl border border-line bg-surface p-6 text-center"><p className="text-[14px] font-bold">Club meetings unavailable</p><p className="mt-1 text-[12px] text-muted">This club may not be public yet, or the link may be out of date.</p><Link to="/discover" className="mt-3 inline-block text-[12px] font-semibold text-brand-600 hover:underline">Browse clubs</Link></div>
  if (!hasPrivateAccess) return <div className="fade-in"><div className="mb-3 flex items-center gap-2 text-[12px]"><Link to={`/clubs/${club.id}`} className="font-semibold text-muted">{club.name}</Link><span className="text-muted">/</span><span className="font-semibold">Meetings</span></div><PageHeader eyebrow="Club meetings" title="Members-only schedule." description="Meeting times, locations, and event details are available after you join this club."/><section className="card p-5 sm:p-6"><div aria-hidden="true" className="space-y-3" style={{filter:"blur(5px)",opacity:0.45}}><div className="h-5 w-1/3 rounded-lg bg-canvas"/><div className="h-28 rounded-2xl bg-canvas"/><div className="h-20 rounded-2xl bg-canvas"/></div><p className="mt-4 text-[13px] leading-relaxed text-muted">Join the club to see its upcoming meetings and RSVP. Actual event records remain protected by database rules.</p><Link to={`/clubs/${club.id}`} className="mt-3 inline-flex text-[12px] font-bold text-brand-600 hover:underline">Return to club overview</Link></section></div>

  return <div className="fade-in">
    <div className="mb-4 flex flex-wrap items-center gap-3"><ClubMark club={club} size={42}/><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">Club meetings</p><h1 className="text-[25px] font-extrabold">{club.name}</h1></div>{canManage&&<Button size="sm" onClick={()=>{setEditingEvent(null);setTitle('');setDescription('');setLocation('');setStart(toDateTimeInput(defaultEventStart()));setEnd('');setMeetingType('General Meeting');setAttendance('optional');setAddOpen(true)}}><CalendarPlus size={15}/>{editingEvent?'Edit meeting':'Add meeting'}</Button>}</div>
    <nav aria-label="Club pages" className="mb-5 flex flex-wrap gap-2"><Link to={`/clubs/${club.id}`} className={`rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold ${window.location.pathname===`/clubs/${club.id}`?'border-ink bg-ink text-white':'text-ink-soft hover:bg-canvas'}`}>Overview</Link><Link to={`/clubs/${club.id}/meetings`} aria-current="page" className="rounded-full border border-ink bg-ink px-3.5 py-2 text-[12px] font-semibold text-white">Meetings</Link><Link to={`/clubs/${club.id}/members`} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Members</Link>{canManage&&<Link to={`/clubs/${club.id}/settings`} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Settings</Link>}</nav>
    <PageHeader eyebrow="Calendar & agenda" title="Meetings and events." description="Create and manage events, callouts, general meetings, and workshops. Meeting changes are sent to members in Notifications."/>
    
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-full border border-line bg-surface p-1"><button type="button" onClick={()=>setView('calendar')} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${view==='calendar'?'bg-ink text-white':'text-ink-soft'}`}><CalendarDays size={14}/> Calendar</button><button type="button" onClick={()=>setView('list')} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${view==='list'?'bg-ink text-white':'text-ink-soft'}`}><List size={14}/> List</button></div>{view==='calendar'&&<div className="flex items-center gap-1.5"><button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface" onClick={()=>setMonth(date=>addMonths(date,-1))} aria-label="Previous month"><ChevronLeft size={16}/></button><span className="min-w-[126px] text-center text-[12.5px] font-bold">{monthLabel(month)}</span><button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface" onClick={()=>setMonth(date=>addMonths(date,1))} aria-label="Next month"><ChevronRight size={16}/></button><Button size="sm" variant="ghost" onClick={()=>{const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1));setSelectedDate(startOfDay(now))}}>Today</Button></div>}</div>
    {loading?<Spinner label="Loading meetings"/>:view==='calendar'?<><div className="overflow-hidden rounded-2xl border border-line bg-surface"><div className="grid grid-cols-7 border-b border-line bg-canvas/70">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div key={day} className="py-2 text-center text-[10px] font-bold uppercase text-muted">{day}</div>)}</div><div className="grid grid-cols-7">{grid.map(date=>{const dayEvents=byDay.get(keyFor(date))??[];const current=date.getMonth()===month.getMonth();return <button key={keyFor(date)} type="button" onClick={()=>setSelectedDate(startOfDay(date))} className={`min-h-[90px] min-w-0 border-b border-r border-line p-1 text-left sm:min-h-[112px] sm:p-1.5 ${current?'bg-surface hover:bg-canvas':'bg-canvas/40'} ${isSameDay(date,selectedDate)?'ring-2 ring-inset ring-brand-300':''}`}><span className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isSameDay(date,today)?'bg-ink text-white':current?'text-ink':'text-muted'}`}>{date.getDate()}</span><span className="block space-y-1">{dayEvents.slice(0,3).map(item=><span key={item.id} className="block truncate rounded px-1 py-1 text-[9px] font-semibold leading-tight" style={{backgroundColor:`${club.color}2a`,borderLeft:`2px solid ${club.color}`}} title={item.title}>{item.title}</span>)}{dayEvents.length>3&&<span className="block px-1 text-[9px] font-bold text-muted">+{dayEvents.length-3} more</span>}</span></button>})}</div></div><section className="mt-5"><div className="mb-3 flex items-baseline justify-between"><h2 className="text-[15px] font-extrabold">{isSameDay(selectedDate,today)?'Today':formatDateLong(selectedDate.getTime())}</h2><span className="text-[12px] text-muted">{selected.length} meeting(s)</span></div>{selected.length===0?<div className="rounded-2xl border border-dashed border-line px-4 py-7 text-center text-[13px] text-muted">Nothing scheduled for this day.</div>:<div className="grid gap-2.5 lg:grid-cols-2">{selected.map(item=><EventRow key={item.id} event={item} club={club} canManage={canManage} onDelete={item=>void deleteEvent(item)} onEdit={editEvent}/>)}</div>}</section></>:visibleEvents.length===0?<div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-muted">No meetings or events have been added yet.</div>:<div className="space-y-2.5">{[...visibleEvents].sort((a,b)=>a.startAt-b.startAt).map(item=><EventRow key={item.id} event={item} club={club} canManage={canManage} onDelete={item=>void deleteEvent(item)} onEdit={editEvent}/>)}</div>}
    {addOpen&&canManage&&<Modal open={addOpen} onClose={()=>{setAddOpen(false);setEditingEvent(null)}} title={editingEvent?'Edit meeting':'Add a meeting'} description={editingEvent?'Update the details. Members will see the change in Notifications.':'Meetings appear on the club page and the school calendar.'}>
      <form onSubmit={createEvent} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="meeting-title">Meeting title</label><input id="meeting-title" className="field" value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} required/></div>
        <div><label className="label" htmlFor="meeting-type">Type</label><select id="meeting-type" className="field" value={meetingType} onChange={e=>setMeetingType(e.target.value as ClubEvent['type'])}>{['Event','Callout','General Meeting','Workshop'].map(type=><option key={type}>{type}</option>)}</select></div>
        <div><label className="label" htmlFor="meeting-attendance">Attendance</label><select id="meeting-attendance" className="field" value={attendance} onChange={e=>setAttendance(e.target.value as ClubEvent['attendance'])}><option value="optional">Optional</option><option value="mandatory">Mandatory</option></select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="meeting-description">Details</label><textarea id="meeting-description" className="field min-h-20 resize-y" value={description} onChange={e=>setDescription(e.target.value)} maxLength={500}/></div>
        <div><label className="label" htmlFor="meeting-start">Starts</label><input id="meeting-start" type="datetime-local" className="field" value={start} onChange={e=>setStart(e.target.value)} required/></div>
        <div><label className="label" htmlFor="meeting-end">Ends (optional)</label><input id="meeting-end" type="datetime-local" className="field" value={end} onChange={e=>setEnd(e.target.value)}/></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="meeting-location">Location</label><input id="meeting-location" className="field" value={location} onChange={e=>setLocation(e.target.value)} placeholder={club.location||'Add a location'}/></div>
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={()=>{setAddOpen(false);setEditingEvent(null)}}>Cancel</Button><Button type="submit" loading={saving}><Plus size={15}/>{editingEvent?'Save changes':'Save meeting'}</Button></div>
      </form>
    </Modal>}
  </div>
}
