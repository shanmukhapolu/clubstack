import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Save, UserPlus, UserMinus, Settings2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { CATEGORIES, MEETING_DAYS } from '../lib/types'
import type { AppUser, Club, ClubCategory, ClubOfficer, OfficerInvitation } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Spinner } from '../components/ui'

export function ClubSettingsPage() {
  const { clubId = '' } = useParams()
  const { user } = useAuth()
  const { clubs, refresh } = useClubs()
  const { notify } = useToast()
  const [club, setClub] = useState<Club | null>(clubs.find(item => item.id === clubId) ?? null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState<AppUser[]>([])
  const [selectedMember, setSelectedMember] = useState<AppUser | null>(null)
  const [officerTitle, setOfficerTitle] = useState('Officer')
  const [invitations, setInvitations] = useState<OfficerInvitation[]>([])
  const [inviting, setInviting] = useState(false)
  const [form, setForm] = useState({ name:'', description:'', category:'Academic' as ClubCategory, meetingDay:'Flexible', meetingTime:'', location:'', contactEmail:'', leaderTitle:'President' })

  useEffect(() => {
    if (!clubId) return
    let active = true
    void api.clubs.get(clubId).then(async found => {
      if (!active) return
      setClub(found)
      if (found) setForm({ name:found.name, description:found.description, category:found.category, meetingDay:found.meetingDay, meetingTime:found.meetingTime, location:found.location, contactEmail:found.contactEmail, leaderTitle:found.leaderTitle || 'President' })
      setLoading(false)
    }).catch(caught => {
      if (active) { notify(friendlyError(caught), 'error'); setLoading(false) }
    })
    return () => { active = false }
  }, [clubId, notify])

  const canManage = !!(user && club && (user.role === 'admin' || club.leaderId === user.id || (club.sponsorId === user.id && club.sponsorStatus === 'accepted') || club.officerIds.includes(user.id)))

  useEffect(() => {
    if (!club || !canManage) return
    let active = true
    void Promise.all([api.memberships.listMembers(club.id), api.officerInvitations.listForClub(club.id)]).then(([ids, pending]) => {
      if (!active) return
      setMemberIds(ids)
      setInvitations(pending)
    }).catch(caught => notify(friendlyError(caught), 'error'))
    return () => { active = false }
  }, [club?.id, canManage, notify])

  useEffect(() => {
    const prefix = memberSearch.trim()
    if (prefix.length < 4 || !canManage) { setMemberResults([]); return }
    let active = true
    void api.users.searchDirectory(prefix, 'student').then(results => {
      if (active) setMemberResults(results.filter(person => memberIds.includes(person.id) && !club?.officerIds.includes(person.id) && person.id !== club?.leaderId))
    }).catch(caught => {
      if (active) { setMemberResults([]); notify(friendlyError(caught), 'error') }
    })
    return () => { active = false }
  }, [memberSearch, memberIds, club?.officerIds, club?.leaderId, canManage, notify])

  async function saveDetails(event: FormEvent) {
    event.preventDefault()
    if (!club) return
    if (form.name.trim().length < 3 || form.description.trim().length < 20) {
      notify('Club name must have 3 characters and description at least 20.', 'error')
      return
    }
    setSaving(true)
    try {
      await api.clubs.update(club.id, { name:form.name.trim(), description:form.description.trim(), category:form.category, meetingDay:form.meetingDay, meetingTime:form.meetingTime.trim(), location:form.location.trim(), contactEmail:form.contactEmail.trim(), leaderTitle:form.leaderTitle })
      setClub(current => current ? { ...current, ...form, name:form.name.trim(), description:form.description.trim(), meetingTime:form.meetingTime.trim(), location:form.location.trim(), contactEmail:form.contactEmail.trim() } : current)
      await refresh()
      notify('Club settings saved.')
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setSaving(false) }
  }

  async function sendInvitation() {
    if (!club || !user || !selectedMember) return
    setInviting(true)
    try {
      const officer: ClubOfficer = { uid:selectedMember.id, displayName:selectedMember.displayName, email:selectedMember.email, title:officerTitle }
      await api.officerInvitations.create(club.id, club.name, officer, user)
      setInvitations(await api.officerInvitations.listForClub(club.id))
      setMemberSearch('')
      setMemberResults([])
      setSelectedMember(null)
      notify(`Officer invitation sent to ${officer.displayName}.`)
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setInviting(false) }
  }

  async function removeOfficer(officer: ClubOfficer) {
    if (!club || !window.confirm(`Remove ${officer.displayName} from the officer list?`)) return
    try {
      const officers = club.officers.filter(item => item.uid !== officer.uid)
      const officerIds = club.officerIds.filter(id => id !== officer.uid)
      await api.clubs.update(club.id, { officers, officerIds })
      setClub({ ...club, officers, officerIds })
      await refresh()
      notify(`${officer.displayName} removed from officers.`)
    } catch (caught) { notify(friendlyError(caught), 'error') }
  }

  if (loading) return <Spinner label="Loading club settings"/>
  if (!club || !user) return <div className="rounded-2xl border border-line bg-surface p-6 text-center text-[13px] text-muted">This club could not be found.</div>
  if (!canManage) return <div className="rounded-2xl border border-line bg-surface p-6 text-center"><Settings2 size={24} className="mx-auto text-muted"/><p className="mt-2 text-[14px] font-bold">Settings are limited to club managers</p><p className="mt-1 text-[12px] text-muted">You can view the club’s overview and meetings, but only its leader, officers, accepted advisor, or admins can edit settings.</p><Link to={`/clubs/${club.id}`} className="mt-3 inline-block text-[12px] font-semibold text-brand-600 hover:underline">Back to club</Link></div>

  return <div className="fade-in">
    <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]"><Link to={`/clubs/${club.id}`} className="font-semibold text-muted hover:text-ink">{club.name}</Link><span className="text-muted">/</span><span className="font-semibold text-ink">Settings</span></div>
    <PageHeader eyebrow="Club settings" title="Club information." description="Update the details shown to students and manage student officer invitations. Officers added later must already be club members." />
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_0.9fr]">
      <form onSubmit={saveDetails} className="card space-y-4 p-4 sm:p-6">
        <h2 className="text-[15px] font-extrabold">Public club details</h2>
        <div><label className="label" htmlFor="settings-name">Club name</label><input id="settings-name" className="field" value={form.name} maxLength={80} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
        <div><label className="label" htmlFor="settings-description">Description</label><textarea id="settings-description" className="field min-h-28 resize-y" value={form.description} maxLength={600} onChange={e=>setForm({...form,description:e.target.value})} required/><p className="mt-1 text-right text-[11px] text-muted">{form.description.length}/600</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="settings-category">Category</label><select id="settings-category" className="field" value={form.category} onChange={e=>setForm({...form,category:e.target.value as ClubCategory})}>{CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></div><div><label className="label" htmlFor="settings-title">Your role</label><select id="settings-title" className="field" value={form.leaderTitle} onChange={e=>setForm({...form,leaderTitle:e.target.value})}>{['President','Vice President','Officer','Treasurer','Secretary','Other'].map(title=><option key={title}>{title}</option>)}</select></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="settings-day">Meeting day</label><select id="settings-day" className="field" value={form.meetingDay} onChange={e=>setForm({...form,meetingDay:e.target.value})}>{MEETING_DAYS.map(day=><option key={day}>{day}</option>)}</select></div><div><label className="label" htmlFor="settings-time">Usual meeting time</label><input id="settings-time" className="field" value={form.meetingTime} maxLength={60} onChange={e=>setForm({...form,meetingTime:e.target.value})}/></div></div>
        <div><label className="label" htmlFor="settings-location">Location</label><input id="settings-location" className="field" value={form.location} maxLength={80} onChange={e=>setForm({...form,location:e.target.value})}/></div>
        <div><label className="label" htmlFor="settings-email">Contact email</label><input id="settings-email" type="email" className="field" value={form.contactEmail} onChange={e=>setForm({...form,contactEmail:e.target.value})} required/></div>
        <div className="flex justify-end"><Button type="submit" loading={saving}><Save size={15}/> Save changes</Button></div>
      </form>
      <div className="space-y-5">
        <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-[15px] font-extrabold">Student officers</h2><Badge>{club.officers.length}</Badge></div>
          {club.officers.length===0?<p className="rounded-xl bg-canvas px-3 py-4 text-[12.5px] text-muted">No officers have accepted invitations yet.</p>:<div className="space-y-2">{club.officers.map(officer=><div key={officer.uid} className="flex items-center gap-3 rounded-xl border border-line p-3"><div className="min-w-0 flex-1"><p className="text-[13px] font-bold">{officer.displayName}</p><p className="mt-0.5 text-[11.5px] text-muted">{officer.title}</p></div><button type="button" onClick={()=>void removeOfficer(officer)} className="rounded-lg p-2 text-muted hover:bg-[#fff0eb] hover:text-[#9c2f18]" aria-label={`Remove ${officer.displayName} as officer`} title="Remove officer"><UserMinus size={16}/></button></div>)}</div>}
        </section>
        <section className="card p-4 sm:p-5"><h2 className="text-[15px] font-extrabold">Invite a club member</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Search at least four letters. Only existing student members appear. They must accept before being added as an officer.</p>
          <div className="mt-3"><label className="label" htmlFor="member-search">Member name</label><input id="member-search" className="field" value={memberSearch} autoComplete="off" placeholder="Type at least 4 letters…" onChange={e=>{setMemberSearch(e.target.value);setSelectedMember(null)}}/><div aria-live="polite" className="mt-2 space-y-1">{memberSearch.trim().length<4?<p className="px-1 py-2 text-[11.5px] text-muted">Search starts after 4 characters.</p>:memberResults.length===0?<p className="px-1 py-2 text-[11.5px] text-muted">No matching club members found.</p>:memberResults.map(person=><button key={person.id} type="button" onClick={()=>{setSelectedMember(person);setMemberSearch(person.displayName);setMemberResults([])}} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12.5px] ${selectedMember?.id===person.id?'border-brand-300 bg-brand-50':'border-line hover:bg-canvas'}`}><span className="min-w-0 flex-1 font-semibold">{person.displayName}</span><span className="text-[11px] text-muted">Member</span></button>)}</div></div>
          <div className="mt-3"><label className="label" htmlFor="officer-title">Officer title</label><select id="officer-title" className="field" value={officerTitle} onChange={e=>setOfficerTitle(e.target.value)}>{['Vice President','Officer','Treasurer','Secretary','Event Coordinator','Other'].map(title=><option key={title}>{title}</option>)}</select></div>
          <Button className="mt-3 w-full" disabled={!selectedMember} loading={inviting} onClick={()=>void sendInvitation()}><UserPlus size={15}/> Send officer invitation</Button>
          {invitations.filter(item=>item.status==='pending').length>0&&<div className="mt-4 border-t border-line pt-3"><p className="mb-2 text-[12px] font-bold">Pending invitations</p><div className="space-y-2">{invitations.filter(item=>item.status==='pending').map(item=><div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2"><span className="min-w-0 truncate text-[12px]">{item.invitedUserName} <span className="text-muted">· {item.title}</span></span><Badge tone="warn">Pending</Badge></div>)}</div></div>}
        </section>
        <section className="rounded-2xl bg-brand-50 p-4 text-[12px] leading-relaxed text-brand-900">Teacher advisor: <strong>{club.sponsorName || 'Not assigned'}</strong>. Advisor requests are handled from the teacher workspace.</section>
      </div>
    </div>
  </div>
}
