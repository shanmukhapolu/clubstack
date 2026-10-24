import { ArrowRight, Bell, CalendarDays, Compass, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

function BrandMark() {
  return <span className="flex h-9 w-9 flex-col justify-center gap-[3px] rounded-xl bg-ink px-2"><span className="h-[3px] w-5 rounded-full bg-lime"/><span className="h-[3px] w-3.5 rounded-full bg-brand-300"/><span className="h-[3px] w-[18px] rounded-full bg-white/90"/></span>
}

const features = [
  { icon: Compass, title: 'Discover clubs', description: 'Find student groups by interest and category.' },
  { icon: CalendarDays, title: 'Keep plans together', description: 'View meetings, events, and estimated attendance.' },
  { icon: Bell, title: 'Stay in the loop', description: 'See invitations, membership requests, and club updates.' },
  { icon: Users, title: 'Run clubs with less friction', description: 'Give students, officers, advisors, and administrators the tools they need.' },
]

export function HomePage() {
  return <div className="min-h-screen overflow-hidden bg-canvas">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/" className="flex items-center gap-2.5"><BrandMark/><span className="text-[17px] font-extrabold tracking-tight">ClubStack</span></Link>
      <div className="flex items-center gap-3"><Link to="/login" className="hidden rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-surface sm:inline-flex">Sign in</Link><Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[12.5px] font-bold text-white hover:bg-ink-soft">Get started <ArrowRight size={15}/></Link></div>
    </header>
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="fade-in">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] font-bold text-ink-soft"><span className="h-2 w-2 rounded-full bg-lime-deep"/><span>A better home for student life</span></div>
          <h1 className="max-w-2xl text-[42px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[58px]">All your clubs.<br/><span className="text-brand-600">One place.</span></h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-[16px]">Discover groups, keep up with announcements, and bring meetings and membership into one clear workspace.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3"><Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-[13px] font-bold text-white hover:bg-ink-soft">Open ClubStack <ArrowRight size={16}/></Link><a href="#features" className="rounded-xl border border-line bg-surface px-5 py-3 text-[13px] font-bold text-ink-soft hover:bg-white">See what it does</a></div>
          <p className="mt-4 text-[11.5px] text-muted">For students, club officers, advisors, and school administrators.</p>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -right-8 -top-6 h-32 w-32 rounded-full bg-brand-100 blur-2xl"/>
          <div className="absolute -bottom-7 -left-4 h-32 w-32 rounded-full bg-[#e6f3bc] blur-2xl"/>
          <div className="relative rounded-[28px] border border-line bg-surface p-3 shadow-card sm:p-4">
            <div className="flex items-center justify-between border-b border-line px-2 pb-3"><div><p className="text-[11px] font-semibold text-muted">YOUR WORKSPACE</p><p className="mt-0.5 text-[14px] font-extrabold">Club dashboard</p></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck size={17}/></div></div>
            <div className="grid grid-cols-2 gap-3 p-2 pt-4">
              <div className="rounded-2xl bg-canvas p-3.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Compass size={17}/></div><p className="mt-4 text-[12px] font-bold">Club discovery</p><p className="mt-1 text-[11px] leading-relaxed text-muted">Groups that fit your interests</p></div>
              <div className="rounded-2xl bg-[#f2f7e9] p-3.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#4b6a20]"><CalendarDays size={17}/></div><p className="mt-4 text-[12px] font-bold">Meetings</p><p className="mt-1 text-[11px] leading-relaxed text-muted">Dates, details, and RSVPs</p></div>
              <div className="col-span-2 rounded-2xl border border-line p-3.5"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fce8e2] text-[#914733]"><Bell size={16}/></span><div className="min-w-0 flex-1"><p className="text-[12px] font-bold">Your notifications</p><p className="mt-0.5 text-[11px] text-muted">Invitations, requests, and new updates</p></div><span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">Inbox</span></div></div>
            </div>
            <p className="px-2 pb-2 pt-1 text-[10.5px] text-muted">A clean, role-aware space to keep school clubs moving.</p>
          </div>
        </div>
      </section>
      <section id="features" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="max-w-xl"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Everything in one place</p><h2 className="mt-3 text-[28px] font-extrabold leading-tight sm:text-[34px]">Less chasing. More doing.</h2><p className="mt-3 text-[13.5px] leading-relaxed text-muted">The things your club needs, organized around how you use them.</p></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,title,description})=><article key={title} className="rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-card"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18}/></div><h3 className="mt-4 text-[14px] font-extrabold">{title}</h3><p className="mt-2 text-[12.5px] leading-relaxed text-muted">{description}</p></article>)}</div>
        </div>
      </section>
      <section className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-14 sm:px-8 sm:py-16 md:flex-row md:items-center md:justify-between"><div><h2 className="text-[24px] font-extrabold">Your next club starts here.</h2><p className="mt-2 text-[13px] text-muted">Sign in to explore clubs and keep up with the ones you’re part of.</p></div><Link to="/login" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-[13px] font-bold text-white hover:bg-ink-soft">Get started <ArrowRight size={16}/></Link></section>
    </main>
    <footer className="border-t border-line px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><Link to="/" className="flex items-center gap-2 text-[12px] font-extrabold"><BrandMark/> ClubStack</Link><p className="text-[11.5px] text-muted">School clubs, organized.</p><Link to="/login" className="text-[11.5px] font-semibold text-ink-soft hover:underline">Sign in</Link></div></footer>
  </div>
}
