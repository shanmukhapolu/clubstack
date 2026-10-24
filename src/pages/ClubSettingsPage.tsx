import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Check, Crown, Settings2, ShieldCheck, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import type { AppUser, Club, ClubDeletionRequest, ClubOfficer, OfficerInvitation } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Spinner } from '../components/ui'

export function ClubSettingsPage() {
  const { clubId = '' } = useParams()
  const { user } = useAuth()
  const { clubs, refresh } = useClubs()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [club, setClub] = useState<Club | null>(clubs.find((item) => item.id === clubId) ?? null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [membersVisible, setMembersVisible] = useState(true)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults, setMemberResults] = useState<AppUser[]>([])
  const [selectedMember, setSelectedMember] = useState<AppUser | null>(null)
  const [officerTitle, setOfficerTitle] = useState('Officer')
  const [invitations, setInvitations] = useState<OfficerInvitation[]>([])
  const [inviting, setInviting] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [deletionRequest, setDeletionRequest] = useState<ClubDeletionRequest | null>(null)

  useEffect(() => {
    let active = true
    void api.clubs.get(clubId).then(async (found) => {
      if (!active) return
      setClub(found)
      if (found) {
        setRequiresApproval(found.requiresApproval)
        setMembersVisible(found.membersVisible)
        const canReadRequest = !!(user && (
          user.role === 'admin'
          || found.leaderId === user.id
          || (found.officerIds ?? []).includes(user.id)
          || (found.sponsorId === user.id && found.sponsorStatus === 'accepted')
        ))
        const request = canReadRequest ? await api.clubs.getDeletionRequest(found.id).catch(() => null) : null
        if (active) setDeletionRequest(request)
      }
      setLoading(false)
    }).catch((caught) => {
      if (active) {
        notify(friendlyError(caught), 'error')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [clubId, notify, user?.id, user?.role])

  const isAdmin = user?.role === 'admin'
  const isLeader = !!(user && club && club.leaderId === user.id)
  const isAcceptedAdvisor = !!(user && club && user.role === 'teacher' && club.sponsorId === user.id && club.sponsorStatus === 'accepted')
  const canManage = !!(user && club && (isAdmin || isLeader || isAcceptedAdvisor || (club.officerIds ?? []).includes(user.id)))

  useEffect(() => {
    if (!club || !canManage) return
    let active = true
    void Promise.all([api.memberships.listMembers(club.id), api.officerInvitations.listForClub(club.id)]).then(([ids, pending]) => {
      if (!active) return
      setMemberIds(ids)
      setInvitations(pending)
      if (!transferTargetId) setTransferTargetId((club.officers ?? [])[0]?.uid ?? '')
    }).catch((caught) => {
      if (active) notify(friendlyError(caught), 'error')
    })
    return () => { active = false }
  }, [club?.id, club?.officers, canManage, notify])

  useEffect(() => {
    const prefix = memberSearch.trim()
    if (prefix.length < 4 || !canManage) { setMemberResults([]); return }
    let active = true
    void api.users.searchDirectory(prefix, 'student', 100).then((results) => {
      if (active) setMemberResults(results.filter((person) =>
        !(club?.officerIds ?? []).includes(person.id) && person.id !== club?.leaderId,
      ))
    }).catch((caught) => {
      if (active) {
        setMemberResults([])
        notify(friendlyError(caught), 'error')
      }
    })
    return () => { active = false }
  }, [memberSearch, memberIds, club?.officerIds, club?.leaderId, canManage, notify])

  async function savePrivacy(patch: { requiresApproval?: boolean; membersVisible?: boolean }) {
    if (!club || privacySaving) return
    setPrivacySaving(true)
    const nextApproval = patch.requiresApproval ?? requiresApproval
    const nextVisibility = patch.membersVisible ?? membersVisible
    try {
      await api.clubs.update(club.id, { requiresApproval: nextApproval, membersVisible: nextVisibility })
      setRequiresApproval(nextApproval)
      setMembersVisible(nextVisibility)
      setClub((current) => current ? { ...current, requiresApproval: nextApproval, membersVisible: nextVisibility } : current)
      await refresh()
      notify('Membership settings saved.')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setPrivacySaving(false)
    }
  }

  async function sendInvitation() {
    if (!club || !user || !selectedMember) return
    setInviting(true)
    try {
      const officer: ClubOfficer = {
        uid: selectedMember.id,
        displayName: selectedMember.displayName,
        email: selectedMember.email,
        title: officerTitle,
      }
      await api.officerInvitations.create(club.id, club.name, officer, user)
      setInvitations(await api.officerInvitations.listForClub(club.id))
      setMemberSearch('')
      setMemberResults([])
      setSelectedMember(null)
      notify(`Officer invitation sent to ${officer.displayName}.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setInviting(false)
    }
  }

  async function removeOfficer(officer: ClubOfficer) {
    if (!club || !window.confirm(`Remove ${officer.displayName} from the officer list?`)) return
    try {
      const officers = (club.officers ?? []).filter((item) => item.uid !== officer.uid)
      const officerIds = (club.officerIds ?? []).filter((id) => id !== officer.uid)
      await api.clubs.update(club.id, { officers, officerIds })
      setClub({ ...club, officers, officerIds })
      await refresh()
      notify(`${officer.displayName} removed from officers.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    }
  }

  async function transferOwnership() {
    if (!club || !user || !isLeader || !transferTargetId) return
    const target = club.officers.find((officer) => officer.uid === transferTargetId)
    if (!target) return
    const confirmed = window.confirm(`Transfer ownership of ${club.name} to ${target.displayName}? You will no longer be the club leader.`)
    if (!confirmed) return
    setBusy(true)
    try {
      await api.clubs.transferOwnership(club.id, target.uid, user)
      const updated = await api.clubs.get(club.id)
      setClub(updated)
      await refresh()
      notify(`Ownership transfer request sent to ${target.displayName}. They must accept it before ownership changes.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function requestDeletion() {
    if (!club || !user || !isLeader) return
    if (!window.confirm(`Request the teacher advisor's approval to delete ${club.name}? This does not delete the club yet.`)) return
    setBusy(true)
    try {
      await api.clubs.requestDeletion(club.id, user)
      setDeletionRequest(await api.clubs.getDeletionRequest(club.id))
      notify('Deletion request sent to the teacher advisor.')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function reviewDeletion(status: 'approved' | 'declined') {
    if (!club || !user || !isAcceptedAdvisor || !deletionRequest) return
    const message = status === 'approved'
      ? `Approve permanent deletion of ${club.name}? The club leader will then be able to delete it.`
      : `Decline the deletion request for ${club.name}?`
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      await api.clubs.respondToDeletionRequest(club.id, status, user)
      setDeletionRequest(await api.clubs.getDeletionRequest(club.id))
      notify(status === 'approved' ? 'Deletion approved. The club leader may now delete the club.' : 'Deletion request declined.')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function permanentlyDelete() {
    if (!club || !window.confirm(`Permanently delete ${club.name} and its club data? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.clubs.delete(club.id)
      await refresh()
      notify(`${club.name} deleted.`)
      navigate('/discover')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading club settings" />
  if (!club || !user) return <div className="rounded-2xl border border-line bg-surface p-6 text-center text-[13px] text-muted">This club could not be found.</div>
  if (!canManage) return <div className="rounded-2xl border border-line bg-surface p-6 text-center"><Settings2 size={24} className="mx-auto text-muted"/><p className="mt-2 text-[14px] font-bold">Settings are limited to club managers</p><p className="mt-1 text-[12px] text-muted">Only the leader, officers, accepted advisor, or admins can manage club settings.</p><Link to={`/clubs/${club.id}`} className="mt-3 inline-block text-[12px] font-semibold text-brand-600 hover:underline">Back to club</Link></div>

  return (
    <div className="fade-in">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]"><Link to={`/clubs/${club.id}`} className="font-semibold text-muted hover:text-ink">{club.name}</Link><span className="text-muted">/</span><span className="font-semibold text-ink">Settings</span></div>
      <nav aria-label="Club pages" className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-1.5">
        <Link to={`/clubs/${club.id}`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Overview</Link>
        <Link to={`/clubs/${club.id}/meetings`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Meetings</Link>
        <Link to={`/clubs/${club.id}/members`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Members</Link>
        <span aria-current="page" className="rounded-xl bg-ink px-3.5 py-2 text-[12px] font-semibold text-white">Settings</span>
      </nav>

      <PageHeader eyebrow="Club controls" title="Settings." description="Manage member access, student officers, ownership, and club deletion. Public club information is edited from the overview page." />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="card space-y-4 p-4 sm:p-5">
          <div><h2 className="text-[15px] font-bold">Membership & privacy</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">These controls take effect as soon as you change them.</p></div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={requiresApproval} disabled={privacySaving} onChange={(event) => void savePrivacy({ requiresApproval: event.target.checked })}/>
            <span><span className="block text-[13px] font-semibold">Approve new members</span><span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">Students must request to join. They cannot access private club details until approved.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={membersVisible} disabled={privacySaving} onChange={(event) => void savePrivacy({ membersVisible: event.target.checked })}/>
            <span><span className="block text-[13px] font-semibold">Let members see the member list</span><span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">Managers can always view the member list. Regular members cannot read it while this is off.</span></span>
          </label>
          {privacySaving && <p className="text-[11.5px] text-muted">Saving…</p>}
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-[15px] font-bold">Student officers</h2><Badge>{(club.officers ?? []).length}</Badge></div>
          {(club.officers ?? []).length === 0 ? <p className="rounded-xl bg-canvas px-3 py-4 text-[12.5px] text-muted">No officers have accepted invitations yet.</p> : (
            <div className="space-y-2">
              {(club.officers ?? []).map((officer) => <div key={officer.uid} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{officer.displayName}</p><p className="mt-0.5 text-[11.5px] text-muted">{officer.title}</p></div>
                {isLeader && <button type="button" onClick={() => void removeOfficer(officer)} className="rounded-lg p-2 text-muted hover:bg-[#fff0eb] hover:text-[#9c2f18]" aria-label={`Remove ${officer.displayName} as officer`} title="Remove officer"><UserMinus size={16}/></button>}
              </div>)}
            </div>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="text-[13px] font-semibold">Invite a student as an officer</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">Search at least four characters. Students can hold officer roles in more than one club.</p>
            <div className="mt-3"><label className="label" htmlFor="member-search">Student name</label><input id="member-search" className="field" value={memberSearch} autoComplete="off" placeholder="Type at least 4 letters…" onChange={(event) => { setMemberSearch(event.target.value); setSelectedMember(null) }}/><div aria-live="polite" className="mt-2 space-y-1">{memberSearch.trim().length < 4 ? <p className="px-1 py-2 text-[11.5px] text-muted">Search starts after 4 characters.</p> : memberResults.length === 0 ? <p className="px-1 py-2 text-[11.5px] text-muted">No matching students found.</p> : memberResults.map((person) => <button key={person.id} type="button" onClick={() => { setSelectedMember(person); setMemberSearch(person.displayName); setMemberResults([]) }} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12.5px] ${selectedMember?.id === person.id ? 'border-brand-300 bg-brand-50' : 'border-line hover:bg-canvas'}`}><span className="min-w-0 flex-1 font-semibold">{person.displayName}</span><span className="text-[11px] text-muted">{memberIds.includes(person.id) ? 'Member' : 'Joins on acceptance'}</span></button>)}</div></div>
            <div className="mt-3"><label className="label" htmlFor="officer-title">Officer title</label><select id="officer-title" className="field" value={officerTitle} onChange={(event) => setOfficerTitle(event.target.value)}>{['Vice President','Officer','Treasurer','Secretary','Event Coordinator','Other'].map((title) => <option key={title}>{title}</option>)}</select></div>
            <Button className="mt-3 w-full" disabled={!selectedMember || !isLeader} loading={inviting} onClick={() => void sendInvitation()}><UserPlus size={15}/> Send officer invitation</Button>
            {!isLeader && <p className="mt-2 text-[11px] text-muted">Only the club leader can add or remove officers.</p>}
            {invitations.filter((item) => item.status === 'pending').length > 0 && <div className="mt-4 border-t border-line pt-3"><p className="mb-2 text-[12px] font-semibold">Pending invitations</p><div className="space-y-2">{invitations.filter((item) => item.status === 'pending').map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2"><span className="min-w-0 truncate text-[12px]">{item.invitedUserName} <span className="text-muted">· {item.title}</span></span><Badge tone="warn">Pending</Badge></div>)}</div></div>}
          </div>
        </section>

        <section className="card space-y-3 p-4 sm:p-5">
          <div><h2 className="text-[15px] font-bold">Transfer club ownership</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Request an ownership transfer to an existing student officer. Ownership changes only after they accept.</p></div>
          {club.pendingLeaderTransfer && <div className="rounded-xl border border-line bg-canvas p-3"><p className="text-[12.5px] font-semibold">Ownership transfer pending</p><p className="mt-1 text-[11.5px] text-muted">Waiting for {club.pendingLeaderTransfer.toName} to accept or decline.</p></div>}
          {isLeader ? (club.officers.length > 0 ? <>
            <div><label className="label" htmlFor="ownership-target">New club leader</label><select id="ownership-target" className="field" value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)}><option value="">Select an officer…</option>{club.officers.map((officer) => <option key={officer.uid} value={officer.uid}>{officer.displayName} · {officer.title}</option>)}</select></div>
            <Button variant="secondary" disabled={!transferTargetId || busy || !!club.pendingLeaderTransfer} loading={busy} onClick={() => void transferOwnership()}><Crown size={15}/> Request ownership transfer</Button>
          </> : <p className="rounded-xl bg-canvas p-3 text-[12px] text-muted">Invite a student officer and have them accept the invitation before transferring ownership.</p>) : <p className="rounded-xl bg-canvas p-3 text-[12px] text-muted">Only the current club leader can transfer ownership.</p>}
        </section>

        <section className="card space-y-3 p-4 sm:p-5">
          <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0eb] text-[#9c2f18]"><AlertTriangle size={17}/></div><div><h2 className="text-[15px] font-bold">Delete this club</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Permanent deletion removes the club and its membership, announcement, meeting, RSVP, and invitation data. The accepted teacher advisor must approve the request first.</p></div></div>
          {isAcceptedAdvisor && deletionRequest?.status === 'pending' && <div className="rounded-xl border border-line p-3"><p className="text-[12.5px] font-semibold">Deletion requested by {deletionRequest.requestedByName}</p><p className="mt-1 text-[11.5px] text-muted">Requested {new Date(deletionRequest.createdAt).toLocaleDateString()}.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="danger" loading={busy} onClick={() => void reviewDeletion('approved')}><Check size={14}/> Approve deletion</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void reviewDeletion('declined')}>Decline request</Button></div></div>}
          {isLeader && (!deletionRequest || deletionRequest.status === 'declined') && <><p className="text-[12px] text-muted">{deletionRequest?.status === 'declined' ? 'The advisor declined the previous request. You may submit a new one.' : 'Request approval from the accepted teacher advisor.'}</p><Button variant="secondary" disabled={!club.sponsorId || club.sponsorStatus !== 'accepted' || busy} loading={busy} onClick={() => void requestDeletion()}>Request deletion approval</Button>{(!club.sponsorId || club.sponsorStatus !== 'accepted') && <p className="text-[11px] text-muted">This club needs an accepted teacher advisor before deletion can be requested.</p>}</>}
          {isLeader && deletionRequest?.status === 'pending' && <p className="rounded-xl bg-canvas p-3 text-[12px] text-muted">Waiting for {club.sponsorName || 'the teacher advisor'} to review your request.</p>}
          {isLeader && deletionRequest?.status === 'approved' && <div className="rounded-xl border border-[#f0c7ba] bg-[#fff7f4] p-3"><p className="text-[12.5px] font-semibold text-[#8b2d18]">Advisor approval received</p><p className="mt-1 text-[11.5px] leading-relaxed text-[#8b2d18]">The club will not be deleted until you confirm the permanent action.</p><Button className="mt-3" variant="danger" loading={busy} onClick={() => void permanentlyDelete()}><Trash2 size={14}/> Permanently delete club</Button></div>}
          {isAdmin && <Button variant="danger" loading={busy} onClick={() => void permanentlyDelete()}><Trash2 size={14}/> Delete as administrator</Button>}
          {isAcceptedAdvisor && deletionRequest?.status === 'approved' && <p className="rounded-xl bg-canvas p-3 text-[12px] text-muted">You approved the request. The club leader can now complete the deletion.</p>}
          {deletionRequest?.status === 'declined' && isAcceptedAdvisor && <p className="rounded-xl bg-canvas p-3 text-[12px] text-muted">The last deletion request was declined. The club leader can revise and resubmit.</p>}
        </section>
      </div>
      <div className="mt-5 flex items-center gap-2 text-[11.5px] text-muted"><ShieldCheck size={14}/> Changes to membership, officers, ownership, and deletion are checked against Firestore security rules.</div>
    </div>
  )
}
