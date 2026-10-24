import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Clock,
  Save,
  Mail,
  MapPin,
  Megaphone,
  Plus,
  ShieldCheck,
  Users,
  Pencil,
  Trash2,
  Flag,
  Link2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { useClubFeed } from '../hooks/useClubFeed'
import { api } from '../lib/backend'
import { toDateTimeInput, defaultEventStart, fromDateTimeInput, upcoming } from '../lib/dates'
import { friendlyError } from '../lib/helpers'
import { CATEGORIES, MEETING_DAYS } from '../lib/types'
import type { Announcement, Club, ClubCategory, ClubEvent } from '../lib/types'
import { AnnouncementCard } from '../components/AnnouncementCard'
import { EventRow } from '../components/EventRow'
import {
  Badge,
  Button,
  CategoryTag,
  ClubMark,
  EmptyState,
  Modal,
  Spinner,
  buttonStyles,
} from '../components/ui'

const ordinalLabels: Record<NonNullable<Club['meetingOrdinal']>, string> = {
  first: 'First',
  second: 'Second',
  third: 'Third',
  fourth: 'Fourth',
  last: 'Last',
}

function describeClubSchedule(club: Club): string {
  const frequency = club.meetingFrequency ?? (club.meetingDay === 'Flexible' ? 'custom' : 'weekly')
  const ordinal = club.meetingOrdinal ?? 'first'
  let schedule: string
  if (frequency === 'custom') schedule = club.customMeetingSchedule || 'Flexible schedule'
  else if (frequency === 'everyOtherWeek') schedule = `Every other ${club.meetingDay}`
  else if (frequency === 'monthly') schedule = `${ordinalLabels[ordinal]} ${club.meetingDay} of every month`
  else schedule = `Every ${club.meetingDay}`
  return club.meetingTime ? `${schedule} · ${club.meetingTime}` : schedule
}

function cleanInstagramHandle(value: string): string {
  return value.trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/?[?#].*$/, '')
    .replace(/^@+/, '')
    .replace(/\/$/, '')
    .trim()
}

export function ClubPage() {
  const { clubId = '' } = useParams()
  const { user } = useAuth()
  const { clubs, isJoined, join, leave, refresh, loading: clubsLoading } = useClubs()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [club, setClub] = useState<Club | null>(() => clubs.find((item) => item.id === clubId) ?? null)
  const joined = isJoined(clubId)
  const hasPrivateAccess = !!(user && (joined || user.role === 'admin' || (club && (club.leaderId === user.id || (club.sponsorId === user.id && club.sponsorStatus === 'accepted') || (club.officerIds ?? []).includes(user.id)))))
  const [missing, setMissing] = useState(false)
  const [hasPendingOfficerInvite, setHasPendingOfficerInvite] = useState(false)
  const [joinRequestStatus, setJoinRequestStatus] = useState<'pending' | 'approved' | 'declined' | null>(null)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Safety concern')
  const [reportDetails, setReportDetails] = useState('')
  const { announcements, events, loading: feedLoading, refresh: refreshFeed } = useClubFeed(
    clubId && hasPrivateAccess ? [clubId] : [],
  )

  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventStart, setEventStart] = useState(() => toDateTimeInput(defaultEventStart()))
  const [eventEnd, setEventEnd] = useState('')
  const [eventType, setEventType] = useState<ClubEvent['type']>('General Meeting')
  const [eventAttendance, setEventAttendance] = useState<ClubEvent['attendance']>('optional')
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [aboutSaving, setAboutSaving] = useState(false)
  const [aboutForm, setAboutForm] = useState({
    name: '',
    description: '',
    category: 'Academic' as ClubCategory,
    meetingFrequency: 'weekly' as Club['meetingFrequency'],
    meetingOrdinal: 'first' as Club['meetingOrdinal'],
    meetingDay: 'Monday',
    customMeetingSchedule: '',
    meetingTime: '',
    location: '',
    contactEmail: '',
    prerequisites: '',
    dues: '',
    instagramHandle: '',
  })

  useEffect(() => {
    if (!clubId) return
    const fromStore = clubs.find((item) => item.id === clubId)
    if (fromStore) {
      setClub(fromStore)
      setMissing(false)
      return
    }
    if (clubsLoading) return

    let active = true
    api.clubs
      .get(clubId)
      .then((found) => {
        if (!active) return
        setClub(found)
        setMissing(!found)
      })
      .catch(() => {
        if (active) setMissing(true)
      })
    return () => {
      active = false
    }
  }, [clubId, clubs, clubsLoading])

  useEffect(() => {
    if (!user || user.role !== 'student' || !clubId) {
      setHasPendingOfficerInvite(false)
      return
    }
    let active = true
    void Promise.all([api.officerInvitations.listForUser(user.id), api.memberships.listRequestsForUser(user.id)]).then(([invitations, requests]) => {
      if (!active) return
      setHasPendingOfficerInvite(invitations.some(item => item.clubId === clubId && item.status === 'pending'))
      const latest = requests.filter(item => item.clubId === clubId).sort((a, b) => b.createdAt - a.createdAt)[0]
      setJoinRequestStatus(latest?.status ?? null)
    }).catch(() => {
      if (active) { setHasPendingOfficerInvite(false); setJoinRequestStatus(null) }
    })
    return () => { active = false }
  }, [clubId, user?.id, user?.role])

  const upcomingEvents = useMemo(() => upcoming(events.filter((event) => !event.deletedAt)), [events])

  if (!user) return null

  const canView =
    club && ((club.status === 'approved' && (!club.hidden || hasPrivateAccess)) || club.leaderId === user.id || user.role === 'admin' || (club.sponsorId === user.id && club.sponsorStatus === 'accepted') || (club.officerIds ?? []).includes(user.id) || hasPendingOfficerInvite)

  if (!club || !canView) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-5xl">🧭</p>
        <h1 className="mt-4 text-2xl font-extrabold">
          {missing || !club ? 'Club not found' : 'This club is not available'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {missing || !club
            ? 'The link may be out of date, or the club page may have been removed.'
            : 'This club is awaiting administrator approval. Its leader, administrators, accepted advisors, current officers, and invited officers can also view it.'}
        </p>
        <Link to="/discover" className={buttonStyles('primary', 'md', 'mt-6')}>
          Browse the directory
        </Link>
      </div>
    )
  }

  const isLeader = club.leaderId === user.id
  const isAdmin = user.role === 'admin'
  const isAcceptedSponsor = club.sponsorId === user.id && club.sponsorStatus === 'accepted'
  const isOfficer = (club.officerIds ?? []).includes(user.id)
  const canManage = isLeader || isAdmin || isAcceptedSponsor || isOfficer

  async function handleReportConcern(event: FormEvent) {
    event.preventDefault()
    if (!club || !user || !reportReason.trim()) return
    setReporting(true)
    try {
      await api.moderation.create({
        clubId: club.id,
        clubName: club.name,
        reason: reportReason.trim().slice(0, 120),
        details: reportDetails.trim().slice(0, 2000),
      }, user)
      setReportReason('Safety concern')
      setReportDetails('')
      setReportOpen(false)
      notify('Your report was sent to platform administrators.')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setReporting(false)
    }
  }

  function openAboutEditor() {
    if (!club) return
    setAboutForm({
      name: club.name,
      description: club.description,
      category: club.category,
      meetingFrequency: club.meetingFrequency ?? (club.meetingDay === 'Flexible' ? 'custom' : 'weekly'),
      meetingOrdinal: club.meetingOrdinal ?? 'first',
      meetingDay: club.meetingDay === 'Flexible' ? 'Monday' : club.meetingDay,
      customMeetingSchedule: club.customMeetingSchedule ?? '',
      meetingTime: club.meetingTime,
      location: club.location,
      contactEmail: club.contactEmail,
      prerequisites: club.prerequisites ?? '',
      dues: club.dues ?? '',
      instagramHandle: club.instagramHandle ?? '',
    })
    setFormError(null)
    setAboutOpen(true)
  }

  async function saveAbout(event: FormEvent) {
    event.preventDefault()
    if (!club) return
    const name = aboutForm.name.trim()
    const description = aboutForm.description.trim()
    const contactEmail = aboutForm.contactEmail.trim()
    const instagramHandle = cleanInstagramHandle(aboutForm.instagramHandle)
    if (name.length < 3 || description.length < 20) {
      setFormError('Club name must have at least 3 characters and the description at least 20.')
      return
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setFormError('Enter a valid club email address.')
      return
    }
    if (instagramHandle && !/^[A-Za-z0-9._]{1,30}$/.test(instagramHandle)) {
      setFormError('Enter an Instagram username, such as @roboticsclub.')
      return
    }
    if (aboutForm.meetingFrequency === 'custom' && !aboutForm.customMeetingSchedule.trim()) {
      setFormError('Describe the usual meeting schedule when Custom is selected.')
      return
    }
    setAboutSaving(true)
    setFormError(null)
    try {
      const patch = {
        name,
        description,
        category: aboutForm.category,
        meetingDay: aboutForm.meetingFrequency === 'custom' ? 'Flexible' : aboutForm.meetingDay,
        meetingFrequency: aboutForm.meetingFrequency,
        meetingOrdinal: aboutForm.meetingOrdinal,
        customMeetingSchedule: aboutForm.customMeetingSchedule.trim(),
        meetingTime: aboutForm.meetingTime.trim(),
        location: aboutForm.location.trim(),
        contactEmail,
        prerequisites: aboutForm.prerequisites.trim(),
        dues: aboutForm.dues.trim(),
        instagramHandle,
      }
      await api.clubs.update(club.id, patch)
      setClub((current) => current ? { ...current, ...patch } : current)
      await refresh()
      setAboutOpen(false)
      notify('Club information saved.')
    } catch (caught) {
      setFormError(friendlyError(caught))
    } finally {
      setAboutSaving(false)
    }
  }

  async function handleMembership() {
    if (!club) return
    if (joined) {
      const confirmed = window.confirm(`Leave ${club.name}? You can rejoin at any time.`)
      if (!confirmed) return
    }
    setBusy(true)
    try {
      if (joined) {
        await leave(club.id)
        setJoinRequestStatus(null)
        notify(`You left ${club.name}.`)
      } else {
        await join(club.id)
        if (club.requiresApproval) {
          setJoinRequestStatus('pending')
          notify(`Your request to join ${club.name} was sent for approval.`)
        } else {
          notify(`You joined ${club.name}.`)
        }
      }
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleAnnouncement(event: FormEvent) {
    event.preventDefault()
    if (!club) return
    if (title.trim().length < 3 || body.trim().length < 3) {
      setFormError('Add a short title and a message.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editingAnnouncement) {
        await api.announcements.update(editingAnnouncement.id, { title: title.trim(), body: body.trim() })
      } else {
        await api.announcements.create(club.id, { title: title.trim(), body: body.trim() }, user!)
      }
      setTitle('')
      setBody('')
      setAnnouncementOpen(false)
      setEditingAnnouncement(null)
      refreshFeed()
      notify(editingAnnouncement ? 'Announcement updated.' : 'Announcement posted.')
    } catch (caught) {
      setFormError(friendlyError(caught))
    } finally {
      setSaving(false)
    }
  }

  async function handleEvent(event: FormEvent) {
    event.preventDefault()
    if (!club) return
    if (eventTitle.trim().length < 3) {
      setFormError('Give the meeting a title.')
      return
    }
    const startAt = fromDateTimeInput(eventStart)
    if (!Number.isFinite(startAt)) {
      setFormError('Choose a valid date and time.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const eventInput = {
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        location: eventLocation.trim() || club.location,
        startAt,
        endAt: eventEnd ? fromDateTimeInput(eventEnd) : null,
        type: eventType,
        attendance: eventAttendance,
      }
      if (editingEvent) await api.events.update(editingEvent.id, eventInput)
      else await api.events.create(club.id, eventInput, user!)
      setEventTitle('')
      setEventDescription('')
      setEventLocation('')
      setEventStart(toDateTimeInput(defaultEventStart()))
      setEventEnd('')
      setEventType('General Meeting')
      setEventAttendance('optional')
      setEditingEvent(null)
      setEventOpen(false)
      refreshFeed()
      notify(editingEvent ? 'Meeting updated. Members will see the update in Notifications.' : 'Meeting added to the calendar.')
    } catch (caught) {
      setFormError(friendlyError(caught))
    } finally {
      setSaving(false)
    }
  }

  function handleEditAnnouncement(announcement: Announcement) {
    setEditingAnnouncement(announcement)
    setTitle(announcement.title)
    setBody(announcement.body)
    setFormError(null)
    setAnnouncementOpen(true)
  }

  async function handleDeleteAnnouncement(announcement: Announcement) {
    if (!window.confirm('Delete this announcement? This cannot be undone.')) return
    try {
      await api.announcements.remove(announcement.id)
      refreshFeed()
      notify('Announcement deleted.')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    }
  }

  function handleEditEvent(item: ClubEvent) {
    setEditingEvent(item)
    setEventTitle(item.title)
    setEventDescription(item.description)
    setEventLocation(item.location)
    setEventStart(toDateTimeInput(item.startAt))
    setEventEnd(item.endAt ? toDateTimeInput(item.endAt) : '')
    setEventType(item.type ?? 'General Meeting')
    setEventAttendance(item.attendance ?? 'optional')
    setEventOpen(true)
  }

  async function handleDeleteEvent(item: ClubEvent) {
    if (!window.confirm(`Delete “${item.title}”?`)) return
    try {
      await api.events.remove(item.id)
      refreshFeed()
      notify('Meeting deleted. Members will see the cancellation in Notifications.')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    }
  }

  async function handleDeleteClub() {
    if (!club || !window.confirm(`Permanently delete ${club.name} and its club data? This cannot be undone.`)) return
    try {
      await api.clubs.delete(club.id)
      await refresh()
      notify(`${club.name} deleted.`)
      navigate(isAdmin ? '/admin' : '/')
    } catch (caught) {
      notify(friendlyError(caught), 'error')
    }
  }


  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={() => navigate('/discover')}
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} /> All clubs
      </button>

      {club.status !== 'approved' && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] ${
            club.status === 'pending'
              ? 'border-[#f0dcb0] bg-[#fff8e9] text-[#7a5100]'
              : 'border-[#f3c9be] bg-[#fff1ec] text-[#9c2f18]'
          }`}
        >
          <ShieldCheck size={17} className="mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            {club.status === 'pending' ? (
              <>
                <strong className="font-bold">Pending approval.</strong> This page is only visible to the club owner, listed officers, accepted sponsor, and admins until it is approved. You can still post updates to get
                ready.
              </>
            ) : (
              <>
                <strong className="font-bold">Not approved.</strong> An admin did not approve this
                club page. Reach out to student activities if you think this is a mistake.
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
      <section className="card overflow-hidden">
        <div
          className="h-24 sm:h-28"
          style={{
            background: `linear-gradient(115deg, ${club.color}59, ${club.color}14 60%, #ffffff00)`,
          }}
        />
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <ClubMark club={club} size={78} className="rounded-[22px] ring-4 ring-surface" />
            <div className="flex items-center gap-2 pb-1">
              {canManage ? (
                <Badge tone="brand">
                  <ShieldCheck size={12} /> {isAdmin ? 'Admin access' : isLeader ? 'You lead this club' : isAcceptedSponsor ? 'Advisor access' : 'Officer access'}
                </Badge>
              ) : (
                <Button
                  variant={joined ? 'secondary' : 'primary'}
                  onClick={handleMembership}
                  loading={busy}
                  className={joined ? 'group' : ''}
                >
                  {joined ? (
                    <>
                      <Check size={16} className="group-hover:hidden" />
                      <span className="group-hover:hidden">Joined</span>
                      <span className="hidden group-hover:inline">Leave club</span>
                    </>
                  ) : club.requiresApproval && joinRequestStatus === 'pending' ? (
                    <>Request pending</>
                  ) : (
                    <>
                      <Plus size={16} /> {club.requiresApproval ? 'Request to join' : 'Join club'}
                    </>
                  )}
                </Button>
              )}

            </div>
          </div>

          <div className="mt-3">
            <CategoryTag category={club.category} />
            <h1 className="mt-2 text-[28px] font-extrabold leading-tight sm:text-[32px]">
              {club.name}
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
              {club.description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
              {hasPrivateAccess && (club.membersVisible || canManage) && club.memberCount > 0 && <span className="inline-flex items-center gap-1.5 font-medium"><Users size={14} /> {club.memberCount} member{club.memberCount === 1 ? '' : 's'}</span>}
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                {describeClubSchedule(club)}
              </span>
              {club.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {club.location}</span>}
              {hasPrivateAccess && <span className="inline-flex items-center gap-1.5"><Megaphone size={14} /> Led by {club.leaderName}{club.leaderTitle ? ` · ${club.leaderTitle}` : ''}</span>}
            </div>
          </div>
        </div>
      </section>
      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold">About</h2>
          {canManage && <Button variant="secondary" size="sm" onClick={openAboutEditor}><Pencil size={14}/> Edit information</Button>}
        </div>
        <dl className="grid gap-y-4 text-[12.5px]">
          <div className="flex gap-2.5"><Clock size={15} className="mt-0.5 shrink-0 text-muted"/><div><dt className="font-semibold">Usual meetings</dt><dd className="mt-0.5 text-muted">{describeClubSchedule(club)}</dd></div></div>
          <div className="flex gap-2.5"><MapPin size={15} className="mt-0.5 shrink-0 text-muted"/><div><dt className="font-semibold">Usual room</dt><dd className="mt-0.5 text-muted">{club.location || 'Ask the club leader'}</dd></div></div>
          {club.sponsorName && <div className="flex gap-2.5"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-muted"/><div><dt className="font-semibold">Teacher sponsor</dt><dd className="mt-0.5 text-muted">{club.sponsorName}</dd></div></div>}
          {club.contactEmail && <div className="flex gap-2.5"><Mail size={15} className="mt-0.5 shrink-0 text-muted"/><div className="min-w-0"><dt className="font-semibold">Club email</dt><dd className="mt-0.5 break-words"><a href={`mailto:${club.contactEmail}`} className="text-brand-600 hover:underline">{club.contactEmail}</a></dd></div></div>}
          {club.prerequisites && <div className="flex gap-2.5 sm:col-span-2"><Check size={15} className="mt-0.5 shrink-0 text-muted"/><div><dt className="font-semibold">Prerequisites</dt><dd className="mt-0.5 whitespace-pre-line text-muted">{club.prerequisites}</dd></div></div>}
          {club.dues && <div className="flex gap-2.5 sm:col-span-2"><Users size={15} className="mt-0.5 shrink-0 text-muted"/><div><dt className="font-semibold">Club dues</dt><dd className="mt-0.5 whitespace-pre-line text-muted">{club.dues}</dd></div></div>}
          {hasPrivateAccess && <div className="flex gap-2.5"><Users size={15} className="mt-0.5 shrink-0 text-muted"/><div><dt className="font-semibold">Club leader</dt><dd className="mt-0.5 text-muted">{club.leaderName}{club.leaderTitle ? ` · ${club.leaderTitle}` : ''}</dd></div></div>}
          {hasPrivateAccess && (club.officers ?? []).length > 0 && <div className="flex gap-2.5"><Users size={15} className="mt-0.5 shrink-0 text-muted"/><div><dt className="font-semibold">Student officers</dt><dd className="mt-0.5 text-muted">{club.officers.map((officer) => `${officer.displayName} · ${officer.title}`).join(', ')}</dd></div></div>}
          {club.instagramHandle && <div className="flex gap-2.5 sm:col-span-2"><Link2 size={15} className="mt-0.5 shrink-0 text-muted" /><div><dt className="font-semibold">Instagram</dt><dd className="mt-0.5"><a href={`https://www.instagram.com/${cleanInstagramHandle(club.instagramHandle)}/`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">@{cleanInstagramHandle(club.instagramHandle)}</a></dd></div></div>}
        </dl>
      </section>
      </div>

      {hasPrivateAccess && <div className="mt-4 flex flex-wrap items-center gap-2">
        <nav aria-label="Club pages" className="flex flex-wrap items-center gap-2">
          <Link to={`/clubs/${club.id}`} aria-current="page" className="rounded-xl border border-ink bg-ink px-3.5 py-2 text-[12px] font-semibold text-white">Overview</Link>
          <Link to={`/clubs/${club.id}/meetings`} className="rounded-xl border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-canvas">Meetings</Link>
          <Link to={`/clubs/${club.id}/members`} className="rounded-xl border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-canvas">Members</Link>
          {canManage && <Link to={`/clubs/${club.id}/settings`} className="rounded-xl border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-canvas">Settings</Link>}
        </nav>
        {canManage && <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAnnouncementOpen(true)}><Megaphone size={15} /> Post announcement</Button>
          <Button variant="brand" size="sm" onClick={() => { setEditingEvent(null); setEventTitle(''); setEventDescription(''); setEventLocation(''); setEventStart(toDateTimeInput(defaultEventStart())); setEventEnd(''); setEventType('General Meeting'); setEventAttendance('optional'); setEventOpen(true) }}><CalendarPlus size={15} /> Add meeting</Button>
        </div>}
      </div>}
      {user && <div className={`mt-3 flex ${hasPrivateAccess ? 'justify-end' : 'justify-start'}`}>
        <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}><Flag size={14} /> Report a concern</Button>
      </div>}

      {hasPrivateAccess && (
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] xl:gap-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-extrabold">Announcements</h2>
            {announcements.length > 0 && (
              <span className="text-[12px] font-medium text-muted">{announcements.length} total</span>
            )}
          </div>

          {feedLoading ? (
            <Spinner label="Loading announcements" />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone size={20} />}
              title="No announcements yet"
              description={
                canManage
                  ? 'Post the first update to tell members what is coming up.'
                  : 'When the club leader posts an update, it will show up here.'
              }
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setAnnouncementOpen(true)}>
                    <Megaphone size={15} /> Post announcement
                  </Button>
                ) : undefined
              }
            />
    
      {aboutOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button type="button" aria-label="Close edit club information" className="absolute inset-0 bg-ink/40" onClick={() => setAboutOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-labelledby="about-sidebar-title" className="relative flex h-full w-full max-w-xl flex-col border-l border-line bg-surface shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-line p-5">
              <div><h2 id="about-sidebar-title" className="text-[18px] font-extrabold">Edit club information</h2><p className="mt-1 text-[12.5px] text-muted">These details appear on the club overview and in the public directory.</p></div>
              <button type="button" aria-label="Close sidebar" onClick={() => setAboutOpen(false)} className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"><X size={18}/></button>
            </header>
                    <form onSubmit={(event) => void saveAbout(event)} className="flex-1 space-y-4 overflow-y-auto p-5">
          <div><label className="label" htmlFor="about-name">Club name</label><input id="about-name" className="field" value={aboutForm.name} maxLength={80} onChange={(event) => setAboutForm({ ...aboutForm, name: event.target.value })} required/></div>
          <div><label className="label" htmlFor="about-description">Description</label><textarea id="about-description" className="field min-h-24 resize-y" value={aboutForm.description} maxLength={600} onChange={(event) => setAboutForm({ ...aboutForm, description: event.target.value })} required/><p className="mt-1 text-right text-[11px] text-muted">{aboutForm.description.length}/600</p></div>
          <div><label className="label" htmlFor="about-category">Category</label><select id="about-category" className="field" value={aboutForm.category} onChange={(event) => setAboutForm({ ...aboutForm, category: event.target.value as ClubCategory })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
          <div className="rounded-xl border border-line p-3.5">
            <h3 className="mb-3 text-[13px] font-semibold">Usual meeting schedule</h3>
            <div><label className="label" htmlFor="about-frequency">How often do you meet?</label><select id="about-frequency" className="field" value={aboutForm.meetingFrequency} onChange={(event) => setAboutForm({ ...aboutForm, meetingFrequency: event.target.value as Club['meetingFrequency'] })}><option value="weekly">Every week</option><option value="everyOtherWeek">Every other week</option><option value="monthly">Once a month</option><option value="custom">Custom schedule</option></select></div>
            {aboutForm.meetingFrequency !== 'custom' && <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {aboutForm.meetingFrequency === 'monthly' && <div><label className="label" htmlFor="about-ordinal">Which week?</label><select id="about-ordinal" className="field" value={aboutForm.meetingOrdinal} onChange={(event) => setAboutForm({ ...aboutForm, meetingOrdinal: event.target.value as Club['meetingOrdinal'] })}>{(['first','second','third','fourth','last'] as const).map((ordinal) => <option key={ordinal} value={ordinal}>{ordinal[0].toUpperCase()+ordinal.slice(1)}</option>)}</select></div>}
              <div><label className="label" htmlFor="about-weekday">Weekday</label><select id="about-weekday" className="field" value={aboutForm.meetingDay} onChange={(event) => setAboutForm({ ...aboutForm, meetingDay: event.target.value })}>{MEETING_DAYS.filter((day) => day !== 'Flexible').map((day) => <option key={day}>{day}</option>)}</select></div>
            </div>}
            {aboutForm.meetingFrequency === 'custom' && <div className="mt-3"><label className="label" htmlFor="about-custom-schedule">Describe your usual schedule</label><input id="about-custom-schedule" className="field" value={aboutForm.customMeetingSchedule} maxLength={120} placeholder="e.g. Varies around competition dates" onChange={(event) => setAboutForm({ ...aboutForm, customMeetingSchedule: event.target.value })} required/></div>}
            <div className="mt-3"><label className="label" htmlFor="about-time">Usual meeting time</label><input id="about-time" className="field" value={aboutForm.meetingTime} maxLength={60} placeholder="e.g. 3:30–4:30 PM" onChange={(event) => setAboutForm({ ...aboutForm, meetingTime: event.target.value })}/></div>
          </div>
          <div><label className="label" htmlFor="about-location">Usual room or location</label><input id="about-location" className="field" value={aboutForm.location} maxLength={100} onChange={(event) => setAboutForm({ ...aboutForm, location: event.target.value })}/></div>
          <div><label className="label" htmlFor="about-email">Club email</label><input id="about-email" type="email" className="field" value={aboutForm.contactEmail} maxLength={180} onChange={(event) => setAboutForm({ ...aboutForm, contactEmail: event.target.value })}/></div>
          <div><label className="label" htmlFor="about-prerequisites">Club prerequisites <span className="font-normal text-muted">(optional)</span></label><textarea id="about-prerequisites" className="field min-h-20 resize-y" value={aboutForm.prerequisites} maxLength={1000} placeholder="e.g. No experience required; students must attend the safety orientation." onChange={(event) => setAboutForm({ ...aboutForm, prerequisites: event.target.value })}/></div>
          <div><label className="label" htmlFor="about-dues">Club dues <span className="font-normal text-muted">(optional)</span></label><textarea id="about-dues" className="field min-h-20 resize-y" value={aboutForm.dues} maxLength={1000} placeholder="e.g. $15 annual dues; fee waivers available." onChange={(event) => setAboutForm({ ...aboutForm, dues: event.target.value })}/></div>
          <div><label className="label" htmlFor="about-instagram">Instagram handle <span className="font-normal text-muted">(optional)</span></label><input id="about-instagram" className="field" value={aboutForm.instagramHandle} maxLength={100} placeholder="@yourclub" onChange={(event) => setAboutForm({ ...aboutForm, instagramHandle: event.target.value })}/></div>
          {formError && <p role="alert" className="text-[12.5px] font-medium text-[#9c2f18]">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-3"><Button type="button" variant="secondary" onClick={() => setAboutOpen(false)}>Cancel</Button><Button type="submit" loading={aboutSaving}><Save size={14}/> Save information</Button></div>
        </form>
          </aside>
        </div>,
        document.body,
      )}

      <Modal
        open={announcementOpen}
        onClose={() => { setAnnouncementOpen(false); setEditingAnnouncement(null); setFormError(null) }}
        title={editingAnnouncement ? 'Edit announcement' : 'New announcement'}
        description={editingAnnouncement ? 'Update the title or message for club members.' : `Post an update to everyone following ${club.name}.`}
      >
        <form onSubmit={handleAnnouncement} className="space-y-4">
          <div>
            <label htmlFor="announcement-title" className="label">
              Title
            </label>
            <input
              id="announcement-title"
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Friday meeting moved to Room C-110"
              maxLength={120}
              required
            />
          </div>
          <div>
            <label htmlFor="announcement-body" className="label">
              Message
            </label>
            <textarea
              id="announcement-body"
              className="field min-h-32 resize-y"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share the details members need to know."
              maxLength={2000}
              required
            />
          </div>
          {formError && <p className="text-[13px] font-medium text-[#9c2f18]">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => { setAnnouncementOpen(false); setEditingAnnouncement(null); setFormError(null) }}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingAnnouncement ? 'Save changes' : 'Post update'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        title="Add a meeting"
        description="Meetings appear on the club page and the school calendar."
      >
        <form onSubmit={handleEvent} className="space-y-4">
          <div>
            <label htmlFor="event-title" className="label">
              Title
            </label>
            <input
              id="event-title"
              className="field"
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="Build night: chassis assembly"
              maxLength={120}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="event-type" className="label">Type</label>
              <select id="event-type" className="field" value={eventType} onChange={(event) => setEventType(event.target.value as ClubEvent['type'])}>{['Event', 'Callout', 'General Meeting', 'Workshop'].map((type) => <option key={type}>{type}</option>)}</select>
            </div>
            <div>
              <label htmlFor="event-attendance" className="label">Attendance</label>
              <select id="event-attendance" className="field" value={eventAttendance} onChange={(event) => setEventAttendance(event.target.value as ClubEvent['attendance'])}><option value="optional">Optional</option><option value="mandatory">Mandatory</option></select>
            </div>
            <div>
              <label htmlFor="event-start" className="label">
                Starts
              </label>
              <input
                id="event-start"
                type="datetime-local"
                className="field"
                value={eventStart}
                onChange={(event) => setEventStart(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="event-end" className="label">
                Ends <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="event-end"
                type="datetime-local"
                className="field"
                value={eventEnd}
                onChange={(event) => setEventEnd(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="event-location" className="label">
              Location
            </label>
            <input
              id="event-location"
              className="field"
              value={eventLocation}
              onChange={(event) => setEventLocation(event.target.value)}
              placeholder={club.location || 'Room B-204'}
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="event-description" className="label">
              Details <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="event-description"
              className="field min-h-24 resize-y"
              value={eventDescription}
              onChange={(event) => setEventDescription(event.target.value)}
              placeholder="What should members bring or prepare?"
              maxLength={1000}
            />
          </div>
          {formError && <p className="text-[13px] font-medium text-[#9c2f18]">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => { setEventOpen(false); setEditingEvent(null) }}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingEvent ? 'Save changes' : 'Add meeting'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report a concern"
        description={`Send a private report about ${club.name} to the ClubStack administrators.`}
      >
        <form onSubmit={(event) => void handleReportConcern(event)} className="space-y-4">
          <div>
            <label htmlFor="report-reason" className="label">Reason</label>
            <select id="report-reason" className="field" value={reportReason} onChange={(event) => setReportReason(event.target.value)} required>
              {['Safety concern', 'Policy violation', 'Inaccurate club information', 'Inappropriate content', 'Other'].map(reason => <option key={reason}>{reason}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="report-details" className="label">Details <span className="font-normal text-muted">(optional)</span></label>
            <textarea id="report-details" className="field min-h-28 resize-y" value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={2000} placeholder="Describe what happened and any context the administrators should know." />
            <p className="mt-1 text-right text-[11px] text-muted">{reportDetails.length}/2000</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button type="submit" loading={reporting}><Flag size={14}/> Submit report</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
