import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Compass,
  Plus,
  House,
  LogOut,
  ShieldCheck,
  Bell,
  Users,
  Building2,
  Flag,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { api } from '../lib/backend'
import { Avatar, ClubMark } from './ui'
import { fetchInboxItems, getUnreadNotificationCount, notificationChangeEvent, notificationIds, syncKnownNotificationIds } from '../lib/notificationState'

const navItems = [
  { to: '/home', label: 'Home', icon: House, end: true },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/notifications', label: 'Notifications', icon: Bell },
]

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 flex-col justify-center gap-[3px] rounded-xl bg-ink px-2">
        <span className="h-[3px] w-5 rounded-full bg-lime" />
        <span className="h-[3px] w-3.5 rounded-full bg-brand-300" />
        <span className="h-[3px] w-[18px] rounded-full bg-white/90" />
      </span>
      <span className="hidden text-[17px] font-extrabold tracking-tight sm:inline">ClubStack</span>
    </span>
  )
}

function DemoSwitcher({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  if (!api.demo) return null

  return (
    <label className={`flex items-center gap-2 ${compact ? '' : 'w-full'}`}>
      <span className="sr-only">Switch demo account</span>
      <select
        value={user?.id ?? ''}
        onChange={(event) => void api.demo?.signInAs(event.target.value)}
        className={`rounded-full border border-line bg-canvas text-[12px] font-semibold text-ink-soft ${
          compact ? 'h-8 max-w-[104px] px-2' : 'h-9 w-full px-3'
        }`}
        aria-label="Switch demo account"
      >
        {api.demo.accounts.map((account) => (
          <option key={account.user.id} value={account.user.id}>
            {compact ? account.label : `${account.label} · ${account.user.displayName}`}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AppShell() {
  const { user, mode, signOut } = useAuth()
  const { clubs, joinedIds } = useClubs()
  const navigate = useNavigate()
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0)
      return
    }
    let active = true
    const syncCount = () => {
      if (active) setUnreadNotifications(getUnreadNotificationCount(user.id))
    }
    const load = async () => {
      try {
        const inbox = await fetchInboxItems(user, clubs, joinedIds)
        if (!active) return
        syncKnownNotificationIds(user.id, notificationIds(inbox))
        syncCount()
      } catch {
        // Keep previously known notification state if a role-scoped query is temporarily unavailable.
        syncCount()
      }
    }
    window.addEventListener(notificationChangeEvent, syncCount)
    void load()
    return () => {
      active = false
      window.removeEventListener(notificationChangeEvent, syncCount)
    }
  }, [user, clubs, joinedIds])

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const isTeacher = user.role === 'teacher'
  const myClubs = clubs
    .filter((club) => isTeacher
      ? club.sponsorId === user.id && club.sponsorStatus === 'accepted'
      : joinedIds.has(club.id) || club.leaderId === user.id || (club.officerIds ?? []).includes(user.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const links = isAdmin
    ? [
        { to: '/admin', label: 'Home', icon: House, end: true },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/clubs', label: 'Clubs', icon: Building2 },
        { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
        { to: '/admin/security', label: 'Safety', icon: ShieldCheck },
        { to: '/discover', label: 'Discover clubs', icon: Compass },
        { to: '/clubs/new', label: 'Create a club', icon: Plus },
        { to: '/notifications', label: 'Notifications', icon: Bell },
      ]
    : isTeacher
      ? [
          { to: '/teacher', label: 'Home', icon: House, end: true },
          { to: '/teacher/calendar', label: 'Calendar', icon: CalendarDays },
          { to: '/teacher/clubs', label: 'My clubs', icon: Building2 },
          { to: '/teacher/reports', label: 'Reports', icon: Flag },
          { to: '/notifications', label: 'Notifications', icon: Bell },
        ]
      : navItems

  return (
    <div className="min-h-screen lg:pl-[268px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-canvas'
                }`
              }
            >
              <Icon size={18} strokeWidth={2.2} />
              {label}
              {to === '/notifications' && unreadNotifications > 0 && <span aria-label={`${unreadNotifications} unread notifications`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
            </NavLink>
          ))}
        </nav>

        {!isAdmin && <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">My clubs</p>
            <span className="text-[11px] font-semibold text-muted">{myClubs.length}</span>
          </div>
          <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto scrollbar-none">
            {myClubs.slice(0, 6).map((club) => (
              <NavLink
                key={club.id}
                to={`/clubs/${club.id}`}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-canvas"
              >
                <ClubMark club={club} size={24} className="rounded-md" />
                <span className="truncate">{club.name}</span>
              </NavLink>
            ))}
            {myClubs.length === 0 && user.role === 'student' && (
              <NavLink
                to="/discover"
                className="mx-3 mt-2 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[12.5px] font-semibold text-brand-700"
              >
                <Compass size={15} /> Find your first club
              </NavLink>
            )}
            {myClubs.length === 0 && user.role === 'teacher' && (
              <p className="mx-3 mt-2 rounded-xl bg-canvas px-3 py-2.5 text-[12px] leading-relaxed text-muted">Accepted advisor clubs appear here.</p>
            )}
            {myClubs.length > 6 && (
              <p className="px-3 pt-1 text-[12px] text-muted">+{myClubs.length - 6} more</p>
            )}
          </div>
        </div>}

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          {mode === 'demo' && <DemoSwitcher />}
          <div className="flex items-center gap-2.5 rounded-2xl bg-canvas p-2.5">
            <Avatar name={user.displayName} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight">{user.displayName}</p>
              <p className="truncate text-[11.5px] text-muted">
                {isAdmin ? 'Administrator' : user.role === 'teacher' ? 'Teacher / Advisor' : 'Student'}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut()
                navigate('/login')
              }}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
          {mode === 'demo' && (
            <p className="px-1 text-[10.5px] leading-snug text-muted">
              Demo mode · add Firebase keys to use a real database.
            </p>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          {mode === 'demo' && <DemoSwitcher compact />}
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/login')
            }}
            className="rounded-full p-2 text-muted"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
          <Avatar name={user.displayName} size={32} />
        </div>
      </header>

      <main className="w-full min-w-0 px-4 pb-28 pt-5 sm:px-6 md:px-8 lg:px-8 xl:px-10 2xl:px-12 lg:pb-16 lg:pt-10">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Mobile"
      >
        <div className="flex items-stretch justify-around px-2">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors ${
                  isActive ? 'text-brand-600' : 'text-muted'
                }`
              }
            >
              <span className="relative inline-flex"><Icon size={20} strokeWidth={2.1} />{to === '/notifications' && unreadNotifications > 0 && <span aria-label={`${unreadNotifications} unread notifications`} className="absolute -right-2 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-4 text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</span>
              {label}
            </NavLink>
          ))}
          {user.role === 'student' && (
            <NavLink
              to="/clubs/new"
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold text-muted"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white">
                <Plus size={13} strokeWidth={3} />
              </span>
              Create
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  )
}
