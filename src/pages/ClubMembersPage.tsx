import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Search, ShieldCheck, Users, UserMinus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import type { AppUser, Club } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Avatar, Badge, Spinner } from '../components/ui'

export function ClubMembersPage() {
  const { clubId = '' } = useParams()
  const { user } = useAuth()
  const { clubs, isJoined } = useClubs()
  const { notify } = useToast()
  const [club, setClub] = useState<Club | null>(clubs.find(item => item.id === clubId) ?? null)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<AppUser[]>([])
  const [search, setSearch] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const joined = isJoined(clubId)
  const canManage = !!(user && club && (user.role === 'admin' || club.leaderId === user.id || (club.officerIds ?? []).includes(user.id) || (club.sponsorId === user.id && club.sponsorStatus === 'accepted')))
  const canReadMembers = joined || canManage
  const listVisible = !!club && (club.membersVisible || canManage)

  useEffect(() => {
    if (!clubId) return
    let active = true
    void api.clubs.get(clubId).then(found => {
      if (active) { setClub(found); setLoading(false) }
    }).catch(caught => {
      if (active) { notify(friendlyError(caught), 'error'); setLoading(false) }
    })
    return () => { active = false }
  }, [clubId, notify])

  useEffect(() => {
    if (!club || !user || !canReadMembers || !listVisible) {
      setMembers([])
      return
    }
    let active = true
    void Promise.all([api.memberships.listMembers(club.id), api.users.listDirectory()]).then(([ids, directory]) => {
      if (!active) return
      const byId = new Map(directory.map(person => [person.id, person]))
      setMembers(ids.map(id => byId.get(id)).filter((person): person is AppUser => !!person).sort((a, b) => a.displayName.localeCompare(b.displayName)))
    }).catch(caught => { if (active) notify(friendlyError(caught), 'error') })
    return () => { active = false }
  }, [club?.id, user?.id, canReadMembers, listVisible, notify])

  async function removeMember(member: AppUser) {
    if (!club || !canManage || member.id === club.leaderId) return
    if (!window.confirm(`Remove ${member.displayName} from ${club.name}?`)) return
    setRemovingId(member.id)
    try {
      await api.memberships.removeMember(club.id, member.id)
      setMembers(current => current.filter(person => person.id !== member.id))
      notify(`${member.displayName} was removed from the club.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setRemovingId(null)
    }
  }

  const filtered = useMemo(() => members.filter(member => member.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [members, search])

  if (loading) return <Spinner label="Loading club members" />
  if (!club || !user) return <section className="card p-6 text-center"><h1 className="text-[16px] font-extrabold">Club not found</h1><Link to="/discover" className="mt-3 inline-flex text-[12px] font-bold text-brand-600 hover:underline">Browse clubs</Link></section>
  if (!canReadMembers) return <section className="card p-6 text-center"><ShieldCheck size={22} className="mx-auto text-muted"/><h1 className="mt-2 text-[16px] font-extrabold">Members-only page</h1><p className="mt-1 text-[12.5px] text-muted">Join this club to access its member list.</p><Link to={`/clubs/${clubId}`} className="mt-3 inline-flex text-[12px] font-bold text-brand-600 hover:underline">Back to club</Link></section>

  return <div className="fade-in">
    <div className="mb-3 flex items-center gap-2 text-[12px]"><Link to={`/clubs/${club.id}`} className="font-semibold text-muted hover:text-ink">{club.name}</Link><span className="text-muted">/</span><span className="font-semibold text-ink">Members</span></div>
    <nav aria-label="Club pages" className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-1.5"><Link to={`/clubs/${club.id}`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Overview</Link><Link to={`/clubs/${club.id}/meetings`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Meetings</Link><span aria-current="page" className="rounded-xl bg-ink px-3.5 py-2 text-[12px] font-semibold text-white">Members</span>{canManage&&<Link to={`/clubs/${club.id}/settings`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Settings</Link>}</nav>
    <PageHeader eyebrow="Club directory" title="The people behind the club." description={canManage ? "View members and their school directory profiles." : "See fellow members of this club."}/>
    {!listVisible ? <section className="card p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-muted"><Users size={18}/></div><div><h2 className="text-[14px] font-bold">Member list is hidden</h2><p className="mt-1 text-[12.5px] leading-relaxed text-muted">Club managers turned off member-list visibility. You can still see the club overview and its member-only information.</p></div></div></section> : <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4"><div className="relative min-w-[180px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input className="field pl-9" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search members" aria-label="Search members"/></div><Badge>{members.length} members</Badge></div>
      {filtered.length===0 ? <div className="px-4 py-9 text-center text-[12.5px] text-muted">{members.length===0?'No members are listed yet.':'No members match your search.'}</div> : <div className="divide-y divide-line">{filtered.map(member=><div key={member.id} className="flex items-center gap-3 px-4 py-3.5"><Avatar name={member.displayName} size={38}/><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold">{member.displayName}</p><p className="mt-0.5 text-[11px] text-muted">{member.role==='teacher'?'Teacher / Advisor':member.role==='admin'?'Administrator':'Student'}{member.grade? ` · ${member.grade}`:''}</p></div>{club.leaderId===member.id?<Badge tone="brand">Club leader</Badge>:(club.officerIds??[]).includes(member.id)?<Badge>Officer</Badge>:null}{canManage && member.id !== club.leaderId && member.id !== user.id && <button type="button" onClick={() => void removeMember(member)} disabled={removingId===member.id} title="Remove member" aria-label={`Remove ${member.displayName} from club`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{removingId===member.id?<span className="text-xs">…</span>:<UserMinus size={15}/>}</button>}</div>)}</div>}
    </section>}
  </div>
}
