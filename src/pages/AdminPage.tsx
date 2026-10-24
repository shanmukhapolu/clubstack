import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Check,
  CheckCircle2,
  ShieldCheck,
  Users,
  X,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Save,
  Mail,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { relativeTime } from '../lib/dates'
import type { AppUser, Club, ClubStatus, ModerationReport, ReportStatus, Role } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Avatar, Badge, Button, ClubMark, Spinner } from '../components/ui'

type Tab = 'clubs' | 'people' | 'reports'

export function AdminPage() {
  const { user } = useAuth()
  const { clubs, loading: clubsLoading, refresh } = useClubs()
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('clubs')
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [userForm, setUserForm] = useState({ displayName: '', email: '', role: 'student' as Role, grade: '' })

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      setUsers(await api.users.list())
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setUsersLoading(false)
    }
  }, [notify])

  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    try {
      setReports(await api.moderation.list())
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setReportsLoading(false)
    }
  }, [notify])

  useEffect(() => {
    void loadUsers()
    void loadReports()
  }, [loadUsers, loadReports])

  const pendingClubs = useMemo(
    () =>
      clubs
        .filter((club) => club.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt),
    [clubs],
  )
  const approvedCount = clubs.filter((club) => club.status === 'approved').length
  const leaderCount = new Set(clubs.map((club) => club.leaderId)).size

  if (!user) return null

  async function deleteClub(club: Club) {
    if (!window.confirm(`Permanently delete ${club.name} and its club data? This cannot be undone.`)) return
    setWorkingId(club.id)
    try {
      await api.clubs.delete(club.id)
      await refresh()
      notify(`${club.name} deleted.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setWorkingId(null)
    }
  }

  async function toggleClubVisibility(club: Club) {
    setWorkingId(club.id)
    try {
      await api.clubs.update(club.id, { hidden: !club.hidden })
      await refresh()
      notify(club.hidden ? `${club.name} is visible in Discover again.` : `${club.name} is hidden from public discovery.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setWorkingId(null)
    }
  }

  async function setClubStatus(club: Club, status: ClubStatus) {
    if (status === 'rejected' && !window.confirm(`Reject “${club.name}”? The leader can revise it.`)) {
      return
    }
    setWorkingId(club.id)
    try {
      await api.clubs.setStatus(club.id, status)
      await refresh()
      notify(status === 'approved' ? `${club.name} approved.` : `${club.name} rejected.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setWorkingId(null)
    }
  }

  function openUserEditor(target: AppUser) {
    setEditingUser(target)
    setUserForm({ displayName: target.displayName, email: target.email, role: target.role, grade: target.grade ?? '' })
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault()
    if (!editingUser) return
    const displayName = userForm.displayName.trim()
    const email = userForm.email.trim().toLowerCase()
    if (displayName.length < 2) { notify('Name must contain at least 2 characters.', 'error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { notify('Enter a valid email address.', 'error'); return }
    if (editingUser.id === user?.id && userForm.role !== editingUser.role) { notify('You cannot change your own administrator role.', 'error'); return }
    setWorkingId(editingUser.id)
    try {
      await api.users.updateProfile(editingUser.id, { ...userForm, displayName, email, grade: userForm.grade.trim() })
      setUsers(current => current.map(person => person.id === editingUser.id ? { ...person, displayName, email, role: userForm.role, grade: userForm.grade.trim() || undefined } : person))
      notify('User profile updated.')
      setEditingUser(null)
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  async function deleteUser(target: AppUser) {
    if (target.id === user?.id) { notify('You cannot delete your own administrator account.', 'error'); return }
    if (!window.confirm(`Permanently delete ${target.displayName}’s account? This cannot be undone.`)) return
    setWorkingId(target.id)
    try {
      await api.users.deleteAccount(target.id)
      setUsers(current => current.filter(person => person.id !== target.id))
      setEditingUser(null)
      notify(`${target.displayName}’s account was deleted.`)
    } catch (caught) { notify(friendlyError(caught), 'error') }
    finally { setWorkingId(null) }
  }

  async function setReportStatus(report: ModerationReport, status: ReportStatus) {
    setWorkingId(report.id)
    try {
      await api.moderation.setStatus(report.id, status)
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status } : item))
      notify(`Report marked ${status}.`)
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Admin console"
        title="Keep ClubStack healthy."
        description="Approve new club pages, manage who can administer the platform, and keep an eye on the directory."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none">{clubs.length}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Club pages</p>
        </div>
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none text-[#8a5a00]">{pendingClubs.length}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Awaiting approval</p>
        </div>
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none">{approvedCount}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Live in directory</p>
        </div>
        <div className="card p-4">
          <p className="text-[22px] font-extrabold leading-none">{leaderCount}</p>
          <p className="mt-1 text-[12px] font-medium text-muted">Club leaders</p>
        </div>
      </div>

      <div className="mt-6 inline-flex w-full max-w-xs rounded-full border border-line bg-surface p-1">
        {([
          { key: 'clubs', label: 'Club approvals' },
          { key: 'people', label: 'People' },
          { key: 'reports', label: 'Reports' },
        ] as { key: Tab; label: string }[]).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              tab === item.key ? 'bg-ink text-white' : 'text-ink-soft hover:bg-canvas'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'clubs' ? (
        <div className="mt-5 space-y-6">
          <section>
            <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold">
              Pending review
              {pendingClubs.length > 0 && <Badge tone="warn">{pendingClubs.length}</Badge>}
            </h2>

            {clubsLoading ? (
              <Spinner label="Loading clubs" />
            ) : pendingClubs.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
                <CheckCircle2 size={20} className="text-[#6f9325]" />
                <p className="text-[13px] text-muted">
                  You’re all caught up. New club pages will appear here for review.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingClubs.map((club) => (
                  <div key={club.id} className="card p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <ClubMark club={club} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/clubs/${club.id}`}
                            className="text-[15px] font-bold hover:underline"
                          >
                            {club.name}
                          </Link>
                          <Badge tone="warn">Pending</Badge>
                        </div>
                        <p className="mt-0.5 text-[12px] text-muted">
                          {club.category} · Led by {club.leaderName} · submitted{' '}
                          {relativeTime(club.createdAt)}
                        </p>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
                          {club.description}
                        </p>
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Button
                          size="sm"
                          variant="lime"
                          loading={workingId === club.id}
                          onClick={() => void setClubStatus(club, 'approved')}
                          className="flex-1 sm:flex-none"
                        >
                          <Check size={15} /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={workingId === club.id}
                          onClick={() => void setClubStatus(club, 'rejected')}
                          className="flex-1 sm:flex-none"
                        >
                          <X size={15} /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2.5 text-[15px] font-extrabold">All club pages</h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {clubs
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((club) => (
                  <div
                    key={club.id}
                    className="flex flex-wrap items-center gap-2.5 border-b border-line px-3.5 py-2.5 last:border-b-0"
                  >
                    <ClubMark club={club} size={28} className="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/clubs/${club.id}`}
                        className="block truncate text-[13px] font-bold hover:underline"
                      >
                        {club.name}
                      </Link>
                      <p className="truncate text-[11px] text-muted">
                        {club.leaderName} · {club.memberCount} member
                        {club.memberCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <StatusBadge status={club.status} />
                    {club.hidden && <Badge tone="warn">Hidden</Badge>}
                    <button type="button" onClick={() => void toggleClubVisibility(club)} disabled={workingId === club.id} className="rounded-full p-1.5 text-muted hover:bg-canvas disabled:opacity-50" title={club.hidden ? 'Make club publicly visible' : 'Hide club from public discovery'} aria-label={club.hidden ? `Show ${club.name} publicly` : `Hide ${club.name} from public discovery`}>
                      {club.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <Link to={`/clubs/${club.id}`} className="rounded-full p-1.5 text-muted hover:bg-canvas" title="Edit club details" aria-label={`Edit ${club.name}`}>
                      <ShieldCheck size={15} />
                    </Link>
                    <button type="button" onClick={() => void deleteClub(club)} disabled={workingId === club.id} className="rounded-full p-1.5 text-muted hover:bg-[#fff0eb] hover:text-[#9c2f18] disabled:opacity-50" title="Delete club" aria-label={`Delete ${club.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
            </div>
          </section>
        </div>
      ) : tab === 'people' ? (
        <section className="mt-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-[15px] font-extrabold">People</h2><p className="mt-1 text-[12.5px] leading-relaxed text-muted">Edit account details, adjust access levels, or remove accounts from ClubStack.</p></div><Badge>{users.length} users</Badge></div>
          {usersLoading ? <Spinner label="Loading people" /> : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="hidden grid-cols-[minmax(0,1fr)_130px_120px_90px] gap-3 border-b border-line bg-canvas/60 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted sm:grid"><span>Person</span><span>Role</span><span>Joined</span><span className="text-right">Manage</span></div>
              {users.map(person => {
                const isSelf = person.id === user.id
                return <div key={person.id} className="grid grid-cols-1 gap-2.5 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_130px_120px_90px] sm:items-center">
                  <div className="flex min-w-0 items-center gap-2.5"><Avatar name={person.displayName} size={36}/><div className="min-w-0"><p className="truncate text-[13px] font-bold">{person.displayName}{isSelf && <span className="ml-1.5 text-[11px] font-medium text-muted">(you)</span>}</p><p className="truncate text-[11.5px] text-muted">{person.email}</p></div></div>
                  <div><Badge tone={person.role === 'admin' ? 'brand' : person.role === 'teacher' ? 'muted' : 'lime'}>{person.role === 'teacher' ? 'Teacher / Advisor' : person.role === 'admin' ? 'Admin' : 'Student'}</Badge></div>
                  <p className="text-[11.5px] text-muted">{relativeTime(person.createdAt)}</p>
                  <div className="flex items-center gap-2 sm:justify-end"><button type="button" onClick={() => openUserEditor(person)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[11.5px] font-semibold text-ink-soft transition hover:border-slate-300 hover:bg-slate-50 hover:text-ink" aria-label={`Edit ${person.displayName}`}><Pencil size={13}/> Edit</button>{!isSelf && <button type="button" onClick={() => void deleteUser(person)} disabled={workingId === person.id} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" title={`Delete ${person.displayName}`} aria-label={`Delete ${person.displayName}`}><Trash2 size={14}/></button>}</div>
                </div>
              })}
              {users.length === 0 && <div className="flex items-center gap-3 px-4 py-6 text-[13px] text-muted"><Users size={18}/> No people have signed up yet.</div>}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-5">
          <h2 className="mb-2.5 text-[15px] font-extrabold">Moderation reports</h2>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted">Review concerns submitted by teachers and take action when needed.</p>
          {reportsLoading ? (
            <Spinner label="Loading reports" />
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-4 py-5 text-[13px] text-muted">No reports have been submitted.</div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="card p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/clubs/${report.clubId}`} className="text-[14px] font-bold hover:underline">{report.clubName}</Link>
                        <Badge tone={report.status === 'resolved' ? 'lime' : report.status === 'open' ? 'warn' : 'muted'}>{report.status}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">{report.reason} · Reported by {report.reporterName} · {relativeTime(report.createdAt)}</p>
                      {report.details && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{report.details}</p>}
                    </div>
                    <select value={report.status} disabled={workingId === report.id} onChange={(event) => void setReportStatus(report, event.target.value as ReportStatus)} className="field h-9 py-0 text-[12.5px] disabled:opacity-60" aria-label={`Status for report about ${report.clubName}`}>
                      <option value="open">Open</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {editingUser && createPortal(
        <div className="fixed inset-0 z-[120] flex justify-end">
          <button type="button" aria-label="Close user editor" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={() => setEditingUser(null)}/>
          <aside role="dialog" aria-modal="true" aria-labelledby="user-editor-title" className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Platform administration</p><h2 id="user-editor-title" className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">Edit user</h2><p className="mt-1 text-[12px] text-slate-500">Update account details and permissions.</p></div><button type="button" onClick={() => setEditingUser(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900" aria-label="Close sidebar"><X size={17}/></button></div>
            <form onSubmit={event => void saveUser(event)} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><Avatar name={editingUser.displayName} size={46}/><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{editingUser.displayName}</p><p className="truncate text-xs text-slate-500">User ID · {editingUser.id}</p></div></div>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Display name</span><input autoFocus required minLength={2} maxLength={80} value={userForm.displayName} onChange={event => setUserForm(current => ({...current, displayName: event.target.value}))} className="field h-11 w-full rounded-xl border-slate-200 focus:border-slate-400 focus:ring-slate-200"/></label>
                <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Mail size={13}/> Email address</span><input required type="email" value={userForm.email} onChange={event => setUserForm(current => ({...current, email: event.target.value}))} className="field h-11 w-full rounded-xl border-slate-200 focus:border-slate-400 focus:ring-slate-200"/><span className="mt-1.5 block text-[11px] leading-relaxed text-slate-500">This updates the sign-in email on the account.</span></label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Account role</span><select value={userForm.role} disabled={editingUser.id === user.id} onChange={event => setUserForm(current => ({...current, role: event.target.value as Role}))} className="field h-11 w-full rounded-xl border-slate-200 focus:border-slate-400 focus:ring-slate-200 disabled:opacity-60"><option value="student">Student</option><option value="teacher">Teacher / Advisor</option><option value="admin">Administrator</option></select>{editingUser.id === user.id && <span className="mt-1.5 block text-[11px] text-slate-500">You cannot change your own administrator role.</span>}</label>
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Grade (optional)</span><input maxLength={30} value={userForm.grade} onChange={event => setUserForm(current => ({...current, grade: event.target.value}))} placeholder="e.g. 11" className="field h-11 w-full rounded-xl border-slate-200 focus:border-slate-400 focus:ring-slate-200"/></label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11.5px] leading-relaxed text-slate-600"><UserRound size={14} className="mr-1.5 inline-block"/> Changes to roles affect what this account can access throughout ClubStack.</div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-7">{editingUser.id !== user.id ? <button type="button" onClick={() => void deleteUser(editingUser)} disabled={workingId === editingUser.id} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Trash2 size={14}/> Delete user</button> : <span className="text-[11px] text-slate-500">Your account is protected.</span>}<div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button><Button type="submit" loading={workingId === editingUser.id}><Save size={14}/> Save changes</Button></div></div>
            </form>
          </aside>
        </div>,
        document.body,
      )}
      <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-brand-50 px-4 py-3.5 text-[12.5px] leading-relaxed text-brand-900">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <p>
          Admins are assigned in the Firestore <code className="font-semibold">users</code>{' '}
          collection. Role checks are enforced by security rules, not just the interface.
        </p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ClubStatus }) {
  if (status === 'approved') return <Badge tone="lime">Approved</Badge>
  if (status === 'pending') return <Badge tone="warn">Pending</Badge>
  return <Badge tone="muted">Rejected</Badge>
}
