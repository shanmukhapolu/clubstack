import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Clock,
  Mail,
  MapPin,
  Megaphone,
  Plus,
  ShieldCheck,
  Users,
  Pencil,
  Trash2,
  Flag,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { useClubFeed } from '../hooks/useClubFeed'
import { api } from '../lib/backend'
import { toDateTimeInput, defaultEventStart, fromDateTimeInput, upcoming } from '../lib/dates'
import { friendlyError } from '../lib/helpers'
import type { Announcement, Club, ClubEvent } from '../lib/types'
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

export function ClubPage() {
  const { clubId = '' } = useParams()
  const { user } = useAuth()
  const { clubs, isJoined, join, leave, refresh, loading: clubsLoading } = useClubs()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [club, setClub] = useState<Club | null>(() => clubs.find((item) => item.id === clubId) ?? null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Safety concern')
  const [reportDetails, setReportDetails] = useState('')
  const { announcements, events, loading: feedLoading, refresh: refreshFeed } = useClubFeed(
    clubId ? [clubId] : [],
  )

  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventStart, setEventStart] = useState(() => toDateTimeInput(defaultEventStart()))
  const [eventEnd, setEventEnd] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  const upcomingEvents = useMemo(() => upcoming(events), [events])
  const joined = isJoined(clubId)

  if (!user) return null

  const canView =
    club && (club.status === 'approved' || club.leaderId === user.id || user.role === 'admin' || (club.sponsorId === user.id && club.sponsorStatus === 'accepted') || (club.officerIds ?? []).includes(user.id))

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
            : 'This club is still waiting for admin approval, so only its leader and admins can see it.'}
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
        notify(`You left ${club.name}.`)
      } else {
        await join(club.id)
        notify(`You joined ${club.name}!`)
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
      await api.announcements.create(
        club.id,
        { title: title.trim(), body: body.trim() },
        user!,
      )
      setTitle('')
      setBody('')
      setAnnouncementOpen(false)
      refreshFeed()
      notify('Announcement posted.')
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
      await api.events.create(
        club.id,
        {
          title: eventTitle.trim(),
          description: eventDescription.trim(),
          location: eventLocation.trim() || club.location,
          startAt,
          endAt: eventEnd ? fromDateTimeInput(eventEnd) : null,
        },
        user!,
      )
      setEventTitle('')
      setEventDescription('')
      setEventLocation('')
      setEventStart(toDateTimeInput(defaultEventStart()))
      setEventEnd('')
      setEventOpen(false)
      refreshFeed()
      notify('Meeting added to the calendar.')
    } catch (caught) {
      setFormError(friendlyError(caught))
    } finally {
      setSaving(false)
    }
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

  async function handleDeleteEvent(item: ClubEvent) {
    if (!window.confirm(`Delete “${item.title}”?`)) return
    try {
      await api.events.remove(item.id)
      refreshFeed()
      notify('Meeting removed.')
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

  async function handleAdminStatus(status: Club['status']) {
    if (!club) return
    try {
      await api.clubs.setStatus(club.id, status)
      setClub({ ...club, status })
      await refresh()
      notify(status === 'approved' ? 'Club approved.' : 'Club rejected.')
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
                  ) : (
                    <>
                      <Plus size={16} /> Join club
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
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Users size={14} /> {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                {club.meetingDay === 'Flexible'
                  ? 'Flexible meeting time'
                  : `${club.meetingDay}s · ${club.meetingTime}`}
              </span>
              {club.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} /> {club.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Megaphone size={14} /> Led by {club.leaderName}{club.leaderTitle ? ` · ${club.leaderTitle}` : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="Club pages" className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-1.5">
        <Link to={`/clubs/${club.id}`} className="rounded-xl bg-ink px-3.5 py-2 text-[12px] font-semibold text-white">Overview</Link>
        <Link to={`/clubs/${club.id}/meetings`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Meetings</Link>
        {canManage && <Link to={`/clubs/${club.id}/settings`} className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-soft hover:bg-canvas">Settings</Link>}
      </nav>

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/clubs/${club.id}/settings`)}><Pencil size={15} /> Club settings</Button>
          {isAdmin && <Button variant="danger" size="sm" onClick={() => void handleDeleteClub()}><Trash2 size={15} /> Delete club</Button>}
          <Button variant="brand" size="sm" onClick={() => setAnnouncementOpen(true)}>
            <Megaphone size={15} /> Post announcement
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEventOpen(true)}>
            <CalendarPlus size={15} /> Add meeting
          </Button>
          {isAdmin && club.status !== 'approved' && (
            <Button variant="lime" size="sm" onClick={() => void handleAdminStatus('approved')}>
              <Check size={15} /> Approve club
            </Button>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
          <Flag size={14} /> Report a concern
        </Button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_1fr] lg:gap-6">
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
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  canManage={canManage}
                  onDelete={handleDeleteAnnouncement}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">Upcoming meetings</h2>
              <Link
                to={`/clubs/${club.id}/meetings`}
                className="text-[12px] font-semibold text-brand-600 hover:underline"
              >
                Calendar
              </Link>
            </div>
            {feedLoading ? (
              <Spinner label="Loading meetings" />
            ) : upcomingEvents.length === 0 ? (
              <p className="rounded-xl bg-canvas px-3 py-4 text-[12.5px] leading-relaxed text-muted">
                No meetings scheduled yet.
                {canManage ? ' Add one so members can plan ahead.' : ''}
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 5).map((item) => (
                  <EventRow key={item.id} event={item} canManage={canManage} onDelete={handleDeleteEvent} />
                ))}
              </div>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full justify-start"
                onClick={() => setEventOpen(true)}
              >
                <CalendarPlus size={15} /> Add a meeting
              </Button>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-[15px] font-extrabold">About</h2>
            <dl className="mt-3 space-y-3 text-[12.5px]">
              <div className="flex gap-2.5">
                <Clock size={15} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <dt className="font-semibold">Meets</dt>
                  <dd className="text-muted">
                    {club.meetingDay === 'Flexible'
                      ? 'Flexible schedule'
                      : `${club.meetingDay}s, ${club.meetingTime}`}
                  </dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <MapPin size={15} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <dt className="font-semibold">Location</dt>
                  <dd className="text-muted">{club.location || 'Ask the club leader'}</dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Users size={15} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <dt className="font-semibold">Club leader</dt>
                  <dd className="text-muted">{club.leaderName}</dd>
                </div>
              </div>
              {club.sponsorName && (
                <div className="flex gap-2.5">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-muted" />
                  <div><dt className="font-semibold">Teacher sponsor</dt><dd className="text-muted">{club.sponsorName}</dd></div>
                </div>
              )}
              {(club.officers ?? []).length > 0 && (
                <div className="flex gap-2.5">
                  <Users size={15} className="mt-0.5 shrink-0 text-muted" />
                  <div><dt className="font-semibold">Student officers</dt><dd className="text-muted">{club.officers.map((officer) => `${officer.displayName} · ${officer.title}`).join(', ')}</dd></div>
                </div>
              )}
              {club.contactEmail && (
                <div className="flex gap-2.5">
                  <Mail size={15} className="mt-0.5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <dt className="font-semibold">Contact</dt>
                    <dd className="truncate">
                      <a href={`mailto:${club.contactEmail}`} className="text-brand-600 hover:underline">
                        {club.contactEmail}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </section>

          {isAdmin && (
            <section className="card p-4">
              <h2 className="text-[15px] font-extrabold">Admin actions</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Status: <span className="font-semibold text-ink">{club.status}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="lime"
                  size="sm"
                  onClick={() => void handleAdminStatus('approved')}
                  disabled={club.status === 'approved'}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleAdminStatus('rejected')}
                  disabled={club.status === 'rejected'}
                >
                  Reject
                </Button>
              </div>
            </section>
          )}
        </aside>
      </div>

      <Modal
        open={announcementOpen}
        onClose={() => setAnnouncementOpen(false)}
        title="New announcement"
        description={`Post an update to everyone following ${club.name}.`}
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
            <Button type="button" variant="secondary" onClick={() => setAnnouncementOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Post update
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
            <Button type="button" variant="secondary" onClick={() => setEventOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add meeting
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
