import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError } from '../lib/helpers'
import { relativeTime } from '../lib/dates'
import type { AppUser, Club, ClubStatus, Role } from '../lib/types'
import { PageHeader } from '../components/PageHeader'
import { Avatar, Badge, Button, ClubMark, Spinner } from '../components/ui'

type Tab = 'clubs' | 'people'

export function AdminPage() {
  const { user } = useAuth()
  const { clubs, loading: clubsLoading, refresh } = useClubs()
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('clubs')
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)

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

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

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

  async function setUserRole(target: AppUser, role: Role) {
    setWorkingId(target.id)
    try {
      await api.users.setRole(target.id, role)
      setUsers((current) =>
        current.map((candidate) =>
          candidate.id === target.id ? { ...candidate, role } : candidate,
        ),
      )
      notify(`${target.displayName} is now ${role === 'admin' ? 'an admin' : 'a student'}.`)
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
                    {club.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => void setClubStatus(club, 'approved')}
                        disabled={workingId === club.id}
                        className="rounded-full p-1.5 text-[#5c7a16] transition-colors hover:bg-[#eaf7c9]"
                        title="Approve club"
                        aria-label={`Approve ${club.name}`}
                      >
                        <Check size={15} />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="mt-5">
          <h2 className="mb-2.5 text-[15px] font-extrabold">People</h2>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
            Admins can approve clubs and manage platform access. Club leader tools are granted
            automatically to whoever created a club page.
          </p>

          {usersLoading ? (
            <Spinner label="Loading people" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="hidden grid-cols-[1fr_160px_140px] gap-3 border-b border-line bg-canvas/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted sm:grid">
                <span>Person</span>
                <span>Role</span>
                <span>Joined</span>
              </div>
              {users.map((person) => {
                const isSelf = person.id === user.id
                return (
                  <div
                    key={person.id}
                    className="grid grid-cols-1 gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_160px_140px] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={person.displayName} size={34} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold">
                          {person.displayName}
                          {isSelf && <span className="ml-1.5 text-[11px] font-medium text-muted">(you)</span>}
                        </p>
                        <p className="truncate text-[11.5px] text-muted">{person.email}</p>
                      </div>
                    </div>
                    <div>
                      <select
                        value={person.role}
                        disabled={isSelf || workingId === person.id}
                        onChange={(event) => void setUserRole(person, event.target.value as Role)}
                        className="field h-9 py-0 text-[12.5px] disabled:opacity-60"
                        aria-label={`Role for ${person.displayName}`}
                        title={isSelf ? 'You cannot change your own role' : undefined}
                      >
                        <option value="student">Student</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <p className="text-[11.5px] text-muted">{relativeTime(person.createdAt)}</p>
                  </div>
                )
              })}
              {users.length === 0 && (
                <div className="flex items-center gap-3 px-4 py-6 text-[13px] text-muted">
                  <Users size={18} /> No people have signed up yet.
                </div>
              )}
            </div>
          )}
        </section>
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
