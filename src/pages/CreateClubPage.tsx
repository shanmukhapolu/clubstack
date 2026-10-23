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
  const [users, setUsers] = useState<AppUser[]>([])
  const [sponsorSearch, setSponsorSearch] = useState('')
  const [selectedOfficerId, setSelectedOfficerId] = useState('')
  const [selectedOfficerTitle, setSelectedOfficerTitle] = useState('Vice President')

  useEffect(() => {
    let active = true
    void api.users.listDirectory().then((items) => {
      if (active) setUsers(items)
    }).catch(() => {
      if (active) setUsers([])
    })
    return () => { active = false }
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null
  const currentUser = user
  const teachers = users.filter((person) => person.role === 'teacher')
  const students = users.filter((person) => person.role === 'student' && person.id !== currentUser.id)

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
    if (!form.sponsorId || !teachers.some((teacher) => teacher.id === form.sponsorId)) {
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
      await refresh()
      notify('Club page submitted. Your teacher sponsor has been notified in ClubStack.')
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
              {['President', 'Founder', 'Vice President', 'Officer', 'Treasurer', 'Secretary', 'Other'].map((title) => <option key={title}>{title}</option>)}
            </select>
          </div>

          <div className="mt-4">
            <label htmlFor="club-sponsor" className="label">Teacher sponsor (required)</label>
            <input
              id="club-sponsor"
              className="field"
              list="club-teacher-options"
              value={sponsorSearch}
              onChange={(event) => {
                const value = event.target.value
                setSponsorSearch(value)
                const match = teachers.find((teacher) => value === `${teacher.displayName} · ${teacher.email}`)
                update('sponsorId', match?.id ?? '')
                update('sponsorName', match?.displayName ?? '')
              }}
              placeholder="Type a teacher name to search"
              autoComplete="off"
              required
            />
            <datalist id="club-teacher-options">
              {teachers.map((teacher) => <option key={teacher.id} value={`${teacher.displayName} · ${teacher.email}`} />)}
            </datalist>
            <p className="mt-1 text-[11px] text-muted">The selected teacher will receive a sponsor request and can edit the club after accepting.</p>
            {teachers.length === 0 && <p className="mt-1 text-[11px] text-muted">No teacher accounts are registered yet. A teacher must create an account with the Teacher / Advisor role first.</p>}
          </div>

          <div className="mt-4">
            <label className="label">Other student officers (optional)</label>
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
              <select className="field" value={selectedOfficerId} onChange={(event) => setSelectedOfficerId(event.target.value)} aria-label="Select student officer">
                <option value="">Select a student</option>
                {students.filter((student) => !form.officers.some((officer) => officer.uid === student.id)).map((student) => <option key={student.id} value={student.id}>{student.displayName} · {student.email}</option>)}
              </select>
              <select className="field" value={selectedOfficerTitle} onChange={(event) => setSelectedOfficerTitle(event.target.value)} aria-label="Officer title">
                {['Vice President', 'Officer', 'Treasurer', 'Secretary', 'Event Coordinator', 'Other'].map((title) => <option key={title}>{title}</option>)}
              </select>
              <Button type="button" variant="secondary" disabled={!selectedOfficerId} onClick={() => {
                const student = students.find((item) => item.id === selectedOfficerId)
                if (!student) return
                const officer: ClubOfficer = { uid: student.id, displayName: student.displayName, email: student.email, title: selectedOfficerTitle }
                update('officers', [...form.officers, officer])
                setSelectedOfficerId('')
              }}>Add</Button>
            </div>
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
            <p className="mt-1 text-[11px] text-muted">Officers are listed on the club record. Fine-grained officer permissions can be added later.</p>
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
