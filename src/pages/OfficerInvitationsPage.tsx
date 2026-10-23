import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, MailCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { relativeTime } from '../lib/dates'
import type { OfficerInvitation } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, ClubMark, Spinner } from '../components/ui'

export function OfficerInvitationsPage() {
  const { user } = useAuth()
  const { clubs, refresh } = useClubs()
  const { notify } = useToast()
  const [items, setItems] = useState<OfficerInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    void api.officerInvitations.listForUser(user.id).then(result => {
      if (active) setItems(result)
    }).catch(caught => {
      if (active) notify(friendlyError(caught), 'error')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [user?.id, notify])

  async function respond(item: OfficerInvitation, status: 'accepted' | 'declined') {
    setWorkingId(item.id)
    try {
      await api.officerInvitations.respond(item.id, status)
      setItems(current => current.map(invitation => invitation.id === item.id ? { ...invitation, status } : invitation))
      await refresh()
      notify(status === 'accepted' ? `You accepted the officer invitation for ${item.clubName}.` : 'Invitation declined.')
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  const clubMap = new Map(clubs.map(club => [club.id, club]))
  return <div className="fade-in">
    <PageHeader eyebrow="Your requests" title="Officer invitations." description="Accept an invitation to become a listed club officer. You can review the club and its upcoming meetings before deciding." />
    {loading ? <Spinner label="Loading invitations"/> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-9 text-center"><MailCheck size={24} className="mx-auto text-muted"/><p className="mt-3 text-[14px] font-bold">No officer invitations</p><p className="mt-1 text-[12.5px] text-muted">When a club leader invites you, the request will show up here.</p></div> : <div className="space-y-3">{items.map(item => {
      const club = clubMap.get(item.clubId)
      return <section key={item.id} className="card flex flex-wrap items-start gap-3 p-4 sm:p-5"><ClubMark club={club ?? {id:item.clubId,name:item.clubName,emoji:'🎒',color:'#8b7cff'}} size={44}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[14px] font-bold">{item.clubName}</h2><Badge tone={item.status==='accepted'?'lime':item.status==='pending'?'warn':'muted'}>{item.status}</Badge></div><p className="mt-1 text-[12px] text-muted">Invited by {item.invitedByName} · {item.title} · {relativeTime(item.createdAt)}</p>{club&&<Link to={`/clubs/${item.clubId}`} className="mt-2 inline-block text-[12px] font-semibold text-brand-600 hover:underline">View club details</Link>}{item.status==='pending'&&<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="lime" loading={workingId===item.id} onClick={()=>void respond(item,'accepted')}><Check size={14}/> Accept invitation</Button><Button size="sm" variant="secondary" disabled={workingId===item.id} onClick={()=>void respond(item,'declined')}><X size={14}/> Decline</Button></div>}</div></section>
    })}</div>}
  </div>
}
