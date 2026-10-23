import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/backend'
import { DEMO_PASSWORD } from '../lib/demoSeed'
import { friendlyError, isEmail } from '../lib/helpers'
import { Avatar, Button } from '../components/ui'
import type { Role } from '../lib/types'

type Mode = 'signin' | 'signup'

function LogoMark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 flex-col justify-center gap-[3px] rounded-xl bg-ink px-2">
        <span className="h-[3px] w-5 rounded-full bg-lime" />
        <span className="h-[3px] w-3.5 rounded-full bg-brand-300" />
        <span className="h-[3px] w-[18px] rounded-full bg-white/90" />
      </span>
      <span className={`text-[18px] font-extrabold tracking-tight ${light ? 'text-white' : ''}`}>
        ClubStack
      </span>
    </span>
  )
}

const previewClubs = [
  { emoji: '🤖', name: 'Robotics Collective', meta: '48 members · Tuesdays', color: '#8b7cff' },
  { emoji: '🎬', name: 'Film Society', meta: '62 members · Thursdays', color: '#f0a6a0' },
  { emoji: '🌱', name: 'Environmental Action', meta: '77 members · Tuesdays', color: '#8fd4b2' },
]

export function LoginPage() {
  const { user, mode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [formMode, setFormMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      const destination = from === '/' ? user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/' : from
      navigate(destination, { replace: true })
    }
  }, [user, from, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (formMode === 'signup' && name.trim().length < 2) {
      setError('Tell us your name so club leaders know who joined.')
      return
    }
    if (!isEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Passwords need at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      if (formMode === 'signup') {
        await api.auth.signUp(name.trim(), email.trim(), password, role)
      } else {
        await api.auth.signIn(email.trim(), password)
      }
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-30 blur-2xl"
          style={{ background: 'radial-gradient(circle, #8b7cff, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full opacity-25 blur-2xl"
          style={{ background: 'radial-gradient(circle, #c8f169, transparent 70%)' }}
        />
        <LogoMark light />

        <div className="relative my-auto max-w-lg py-12">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80">
            <Sparkles size={14} className="text-lime" /> Built for Northgate High School
          </p>
          <h1 className="text-[46px] font-extrabold leading-[1.02] tracking-[-0.035em]">
            Every club.
            <br />
            <span className="text-lime">One place.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
            200+ clubs, scattered across five apps. ClubStack brings announcements, meetings, and
            sign-ups together so you never miss a thing.
          </p>

          <div className="mt-9 space-y-2.5">
            {previewClubs.map((club) => (
              <div
                key={club.name}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  style={{ backgroundColor: `${club.color}33` }}
                >
                  {club.emoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold">{club.name}</p>
                  <p className="text-[11.5px] text-white/55">{club.meta}</p>
                </div>
                <span className="ml-auto rounded-full bg-lime/15 px-2.5 py-1 text-[10.5px] font-bold text-lime">
                  Joined
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[12px] text-white/45">
          <ShieldCheck size={15} /> Role-based access protected by Firebase Security Rules
        </div>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:px-14">
        <div className="lg:hidden">
          <LogoMark />
        </div>

        <div className="my-auto w-full max-w-[420px] self-center py-10">
          <h2 className="text-[28px] font-extrabold tracking-tight">
            {formMode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1.5 text-[14px] text-muted">
            {formMode === 'signin'
              ? 'Sign in to see what your clubs are up to.'
              : 'Join ClubStack with your school email to get started.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {formMode === 'signup' && (
              <>
              <div>
                <label htmlFor="name" className="label">
                  Full name
                </label>
                <input
                  id="name"
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ava Chen"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label htmlFor="account-role" className="label">Account type</label>
                <select id="account-role" className="field" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher / Advisor</option>
                  <option value="admin">Platform Admin</option>
                </select>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">All account types are open during testing.</p>
              </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="label">
                School email
              </label>
              <input
                id="email"
                type="email"
                className="field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@student.northgate.edu"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="field"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={formMode === 'signup' ? 'At least 6 characters' : '••••••••'}
                autoComplete={formMode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-[#fff0eb] px-3.5 py-2.5 text-[13px] font-medium text-[#9c2f18]">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {formMode === 'signin' ? 'Sign in' : 'Create account'}
              {!submitting && <ArrowRight size={17} />}
            </Button>
          </form>

          {mode === 'firebase' && formMode === 'signin' && (
            <>
              <div className="my-5 flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={async () => {
                  setError(null)
                  try {
                    await api.auth.signInWithGoogle()
                  } catch (caught) {
                    setError(friendlyError(caught))
                  }
                }}
              >
                <span className="text-[15px] font-bold">G</span> Continue with Google
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-[13.5px] text-muted">
            {formMode === 'signin' ? "Don't have an account yet?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setFormMode(formMode === 'signin' ? 'signup' : 'signin')
                setError(null)
              }}
              className="font-bold text-ink underline decoration-brand-300 decoration-2 underline-offset-2"
            >
              {formMode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {mode === 'demo' && api.demo && (
            <div className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-5 items-center rounded-full bg-brand-500 px-2 text-[10px] font-bold uppercase tracking-wider text-white">
                  Demo
                </span>
                <p className="text-[12.5px] font-semibold text-brand-900">
                  Firebase keys aren’t set — explore with sample data
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {api.demo.accounts.map((account) => (
                  <button
                    key={account.user.id}
                    type="button"
                    onClick={() => void api.demo?.signInAs(account.user.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white bg-white p-2.5 text-left transition-colors hover:border-brand-300"
                  >
                    <Avatar name={account.user.displayName} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-bold">
                        {account.user.displayName}
                        <span className="rounded-full bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                          {account.label}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                        {account.description}
                      </span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-brand-500" />
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-brand-800/70">
                Or sign in with a demo email above using password{' '}
                <code className="rounded bg-white px-1 py-0.5 font-semibold">{DEMO_PASSWORD}</code>.
              </p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-brand-800/60">
                Demo changes are saved in this browser only. Add Firebase values in{' '}
                <code className="font-semibold">.env.local</code> to use a real deployment.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-[11.5px] leading-relaxed text-muted">
          {mode === 'firebase'
            ? 'Protected by Firebase Authentication.'
            : 'Demo preview · no account required.'}
        </p>
      </main>
    </div>
  )
}
