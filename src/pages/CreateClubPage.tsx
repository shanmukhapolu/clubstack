import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/backend'
import { friendlyError, isEmail } from '../lib/helpers'
import { CATEGORIES, CLUB_COLORS, MEETING_DAYS } from '../lib/types'
import type { AppUser, Club, ClubCategory, ClubInput, ClubOfficer } from '../lib/types'
import { ClubCard } from '../components/ClubCard'
import { Button, buttonStyles } from '../components/ui'

const EMOJI_CHOICES = [
  '🤖',
  '🎬',
  '🎷',
  '🌱',
  '💻',
  '🌍',
  '🎮',
  '🧁',
  '🤝',
  '📰',
  '💃',
  '♟️',
  '🥾',
  '🧶',
  '🎨',
  '🔬',
  '🏀',
  '📚',
]

export function CreateClubPage() {
  const { user } = useAuth()
  const { refresh } = useClubs()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState<ClubInput>({
    name: '',
    description: '',
    category: 'Academic',
    meetingDay: 'Monday',
    meetingTime: '',
    location: '',
    emoji: '🎒',
    color: CLUB_COLORS[0],
    contactEmail: user?.email ?? '',
    leaderTitle: 'President',
    officers: [],
    sponsorId: '',
    sponsorName: '',
  })
  const [sponsorSearch, setSponsorSearch] = useState('')
  const [teacherResults, setTeacherResults] = useState<AppUser[]>([])
  const [teacherSearching, setTeacherSearching] = useState(false)
  const [officerSearch, setOfficerSearch] = useState('')
  const [studentResults, setStudentResults] = useState<AppUser[]>([])
  const [studentSearching, setStudentSearching] = useState(false)
  const [selectedOfficer, setSelectedOfficer] = useState<AppUser | null>(null)
  const [selectedOfficerTitle, setSelectedOfficerTitle] = useState('Vice President')

  useEffect(() => {
    const prefix = sponsorSearch.trim()
    if (prefix.length < 2 || form.sponsorName === prefix) {
      setTeacherResults([])
      setTeacherSearching(false)
      return
    }
    let active = true
    setTeacherSearching(true)
    void api.users.searchDirectory(prefix, 'teacher').then(items => {
      if (active) setTeacherResults(items)
    }).catch(() => {
      if (active) setTeacherResults([])
    }).finally(() => {
      if (active) setTeacherSearching(false)
    })
    return () => { active = false }
  }, [sponsorSearch, form.sponsorName])

  useEffect(() => {
    const prefix = officerSearch.trim()
    if (prefix.length < 4) {
      setStudentResults([])
      setStudentSearching(false)
      return
    }
    let active = true
    setStudentSearching(true)
    void api.users.searchDirectory(prefix, 'student').then(items => {
      if (active) setStudentResults(items.filter(person => person.id !== user?.id && !form.officers.some(officer => officer.uid === person.id)))
    }).catch(() => {
      if (active) setStudentResults([])
    }).finally(() => {
      if (active) setStudentSearching(false)
    })
    return () => { active = false }
  }, [officerSearch, form.officers, user?.id])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null
  const currentUser = user

  function update<K extends keyof ClubInput>(key: K, value: ClubInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (form.name.trim().length < 3) {
      setError('Give your club a name with at least 3 characters.')
      return
    }
    if (form.description.trim().length < 20) {
      setError('Write a description of at least 20 characters so students know what to expect.')
      return
    }
    if (!form.meetingTime.trim()) {
      setError('Add a meeting time, or write “Flexible” if it changes week to week.')
      return
    }
    if (!form.leaderTitle.trim()) {
      setError('Choose your role in the club.')
      return
    }
    if (!form.sponsorId || !form.sponsorName) {
      setError('Select a teacher sponsor from the list.')
      return
    }
    if (!isEmail(form.contactEmail)) {
      setError('Add a contact email students can reach you at.')
      return
    }

    setSubmitting(true)
    try {
      const id = await api.clubs.create(
        {
          ...form,
          name: form.name.trim(),
          description: form.description.trim(),
          meetingTime: form.meetingTime.trim(),
          location: form.location.trim(),
          contactEmail: form.contactEmail.trim(),
        },
        currentUser,
      )
      const invitations = await Promise.allSettled(form.officers.map(officer =>
        api.officerInvitations.create(id, form.name.trim(), officer, currentUser),
      ))
      await refresh()
      const failedInvitations = invitations.filter(result => result.status === 'rejected').length
      notify(failedInvitations === 0
        ? 'Club page submitted. Your teacher sponsor was notified, and officer invitations were sent.'
        : `Club page submitted, but ${failedInvitations} officer invitation(s) could not be sent. You can retry from club settings.`)
      navigate(`/clubs/${id}`)
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const preview: Club = {
    ...form,
    id: 'preview',
    status: 'pending',
    leaderId: currentUser.id,
    leaderName: currentUser.displayName,
    leaderTitle: form.leaderTitle,
    officers: form.officers,
    officerIds: form.officers.map((officer) => officer.uid),
    sponsorId: form.sponsorId,
    sponsorName: form.sponsorName,
    sponsorStatus: form.sponsorId ? 'pending' : 'none',
    memberCount: 1,
    createdAt: Date.now(),
  }

  return (
    <div className="fade-in">
      <Link
        to="/discover"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to directory
      </Link>

      <div className="mb-6">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
          Club leaders
        </p>
        <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">
          Bring your club to ClubStack.
        </h1>
        <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted">
          Create a page for your club, then post announcements and meetings. An admin reviews new
          pages before they appear in the directory.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:gap-7">
        <form onSubmit={handleSubmit} className="card p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="club-name" className="label">
                Club name
              </label>
              <input
                id="club-name"
                className="field"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Robotics Collective"
                maxLength={80}
                required
              />
            </div>
            <div>
              <span className="label">Icon</span>
              <div className="flex h-[46px] items-center gap-1 rounded-xl border border-line px-2">
                <span className="text-xl" aria-hidden>
                  {form.emoji}
                </span>
                <span className="text-[11px] font-medium text-muted">Choose below</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => update('emoji', emoji)}
                aria-label={`Use ${emoji} as the club icon`}
                aria-pressed={form.emoji === emoji}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-colors ${
                  form.emoji === emoji
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-line bg-surface hover:bg-canvas'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label htmlFor="club-category" className="label">
              Category
            </label>
            <select
              id="club-category"
              className="field"
              value={form.category}
              onChange={(event) => update('category', event.target.value as ClubCategory)}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label htmlFor="club-description" className="label">
              Description
            </label>
            <textarea
              id="club-description"
              className="field min-h-28 resize-y"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="What does your club do, who is it for, and what happens at a meeting?"
              maxLength={600}
              required
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              {form.description.length}/600
            </p>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="club-day" className="label">
                Meeting day
              </label>
              <select
                id="club-day"
                className="field"
                value={form.meetingDay}
                onChange={(event) => update('meetingDay', event.target.value)}
              >
                {MEETING_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="club-time" className="label">
                Meeting time
              </label>
              <input
                id="club-time"
                className="field"
                value={form.meetingTime}
                onChange={(event) => update('meetingTime', event.target.value)}
                placeholder="3:30 – 5:00 PM"
                maxLength={60}
                required
              />
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="club-location" className="label">
              Usual meeting spot
            </label>
            <input
              id="club-location"
              className="field"
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
              placeholder="Room B-204 (Maker Lab)"
              maxLength={80}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="club-leader-title" className="label">Your role in the club</label>
            <select id="club-leader-title" className="field" value={form.leaderTitle} onChange={(event) => update('leaderTitle', event.target.value)}>
              {['President', 'Vice President', 'Officer', 'Treasurer', 'Secretary', 'Other'].map((title) => <option key={title}>{title}</option>)}
            </select>
          </div>

          <div className="mt-4">
            <label htmlFor="club-sponsor" className="label">Teacher sponsor (required)</label>
            <input
              id="club-sponsor"
              className="field"
              value={sponsorSearch}
              onChange={(event) => {
                const value = event.target.value
                setSponsorSearch(value)
                const match = teacherResults.find((teacher) => value === teacher.displayName)
                update('sponsorId', match?.id ?? '')
                update('sponsorName', match?.displayName ?? '')
              }}
              placeholder="Type at least 2 letters to search teachers"
              autoComplete="off"
              required
            />
            {form.sponsorId && <p className="mt-1 text-[11.5px] font-semibold text-brand-700">Selected: {form.sponsorName}</p>}
            {!form.sponsorId && sponsorSearch.trim().length >= 2 && (
              <div className="mt-2 space-y-1 rounded-xl border border-line bg-surface p-1.5">
                {teacherSearching ? <p className="px-2.5 py-2 text-[12px] text-muted">Searching teachers…</p> : teacherResults.length === 0 ? <p className="px-2.5 py-2 text-[12px] text-muted">No matching teacher accounts found.</p> : teacherResults.map(teacher => <button key={teacher.id} type="button" onClick={() => { setSponsorSearch(teacher.displayName); update('sponsorId', teacher.id); update('sponsorName', teacher.displayName); setTeacherResults([]) }} className="block w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold hover:bg-canvas">{teacher.displayName}</button>)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted">The selected teacher receives a sponsor request and can edit the club after accepting.</p>
          </div>

          <div className="mt-4">
            <label className="label">Other student officers (optional)</label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
              <div className="min-w-0">
                <input className="field" value={officerSearch} autoComplete="off" placeholder="Type at least 4 letters…" onChange={event => { setOfficerSearch(event.target.value); setSelectedOfficer(null) }} aria-label="Search student officers" />
                {officerSearch.trim().length < 4 ? <p className="px-1 pt-1.5 text-[11px] text-muted">Search starts after 4 characters to keep the directory fast.</p> : (
                  <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-line bg-surface p-1.5">
                    {studentSearching ? <p className="px-2.5 py-2 text-[12px] text-muted">Searching students…</p> : studentResults.length === 0 ? <p className="px-2.5 py-2 text-[12px] text-muted">No matching students found.</p> : studentResults.map(student => <button key={student.id} type="button" onClick={() => { setSelectedOfficer(student); setOfficerSearch(student.displayName); setStudentResults([]) }} className={`block w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold hover:bg-canvas ${selectedOfficer?.id === student.id ? 'bg-brand-50' : ''}`}>{student.displayName}</button>)}
                  </div>
                )}
              </div>
              <select className="field" value={selectedOfficerTitle} onChange={(event) => setSelectedOfficerTitle(event.target.value)} aria-label="Officer title">
                {['Vice President', 'Officer', 'Treasurer', 'Secretary', 'Event Coordinator', 'Other'].map((title) => <option key={title}>{title}</option>)}
              </select>
              <Button type="button" variant="secondary" disabled={!selectedOfficer} onClick={() => {
                if (!selectedOfficer) return
                const officer: ClubOfficer = { uid: selectedOfficer.id, displayName: selectedOfficer.displayName, email: selectedOfficer.email, title: selectedOfficerTitle }
                update('officers', [...form.officers, officer])
                setSelectedOfficer(null)
                setOfficerSearch('')
                setStudentResults([])
              }}>Add</Button>
            </div>
            {selectedOfficer && <p className="mt-1 text-[11.5px] font-semibold text-brand-700">Selected: {selectedOfficer.displayName}</p>}
            {form.officers.length > 0 && (
              <div className="mt-2 space-y-2">
                {form.officers.map((officer) => (
                  <div key={officer.uid} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[12px]">
                    <span className="min-w-0 flex-1"><strong>{officer.displayName}</strong><span className="text-muted"> · {officer.title}</span></span>
                    <button type="button" className="text-muted hover:text-ink" onClick={() => update('officers', form.officers.filter((item) => item.uid !== officer.uid))} aria-label={`Remove ${officer.displayName}`}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted">Each selected student receives an invitation and becomes an officer only after accepting.</p>
          </div>

          <div className="mt-3">
            <label htmlFor="club-email" className="label">
              Club contact email
            </label>
            <input
              id="club-email"
              type="email"
              className="field"
              value={form.contactEmail}
              onChange={(event) => update('contactEmail', event.target.value)}
              placeholder="club@northgate.edu"
              required
            />
          </div>

          <div className="mt-4">
            <span className="label">Accent color</span>
            <div className="flex flex-wrap gap-2">
              {CLUB_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update('color', color)}
                  aria-label={`Use accent color ${color}`}
                  aria-pressed={form.color === color}
                  className={`h-8 w-8 rounded-full ring-offset-2 transition-all ${
                    form.color === color ? 'ring-2 ring-ink' : 'ring-1 ring-black/5'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-[#fff0eb] px-3.5 py-2.5 text-[13px] font-medium text-[#9c2f18]"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link to="/discover" className={buttonStyles('secondary', 'md')}>
              Cancel
            </Link>
            <Button type="submit" loading={submitting}>
              Submit for approval
            </Button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Live preview
            </p>
            <ClubCard club={preview} />
          </div>

          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-[14px] font-bold">
              <Info size={16} className="text-brand-500" /> What happens next
            </h2>
            <ol className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-muted">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-[10.5px] font-bold text-ink">
                  1
                </span>
                Your page is created right away. Only you and admins can see it until it’s approved.
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-[10.5px] font-bold text-ink">
                  2
                </span>
                Post your first announcement and add a meeting while you wait.
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-[10.5px] font-bold text-ink">
                  3
                </span>
                Once approved, every student can find and join your club.
              </li>
            </ol>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-[#eef6dd] px-4 py-3 text-[12px] leading-relaxed text-[#47600f]">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <p>
              You’ll be listed as the club owner. Your selected teacher can edit the club after accepting the sponsor request.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
