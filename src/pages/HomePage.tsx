import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function HomePage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/" className="text-[17px] font-extrabold tracking-tight">ClubStack</Link>
          <Link to="/login" className="text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink">Sign in</Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Club management for your school</p>
          <h1 className="mt-5 max-w-2xl text-[42px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[58px]">
            School clubs, in one place.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-soft sm:text-[16px]">
            Find clubs, keep up with announcements, and organize meetings without chasing information across different places.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-ink-soft">
              Open ClubStack <ArrowRight size={15} />
            </Link>
            <a href="#features" className="rounded-lg border border-line px-4 py-3 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-canvas">
              Learn more
            </a>
          </div>
        </section>

        <section id="features" className="border-y border-line bg-canvas/50">
          <div className="mx-auto grid max-w-5xl gap-0 px-5 sm:grid-cols-3 sm:px-8">
            <article className="border-b border-line py-6 sm:border-b-0 sm:border-r sm:pr-6">
              <h2 className="text-[14px] font-semibold">Discover clubs</h2>
              <p className="mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted">Browse school groups and find the details you need to get involved.</p>
            </article>
            <article className="border-b border-line py-6 sm:border-b-0 sm:px-6 sm:last:border-r">
              <h2 className="text-[14px] font-semibold">Keep everything together</h2>
              <p className="mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted">See announcements, meeting information, and attendance in one workspace.</p>
            </article>
            <article className="py-6 sm:pl-6">
              <h2 className="text-[14px] font-semibold">Make club work easier</h2>
              <p className="mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted">Give students, officers, advisors, and school administrators tools that fit their roles.</p>
            </article>
          </div>
        </section>

        <section className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-12 sm:px-8">
          <div>
            <h2 className="text-[19px] font-bold tracking-tight">Ready to get organized?</h2>
            <p className="mt-1 text-[12.5px] text-muted">Sign in to see your clubs and updates.</p>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink hover:underline">
            Get started <ArrowRight size={15} />
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[11.5px] text-muted sm:px-8">
          <span className="font-semibold text-ink-soft">ClubStack</span>
          <span>School clubs, organized.</span>
        </div>
      </footer>
    </div>
  )
}
