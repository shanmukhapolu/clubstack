import { Link } from 'react-router-dom'
import { ArrowRight, Bell, CalendarDays, Compass, ShieldCheck, Users, Search, Megaphone } from 'lucide-react'

const features = [
  { icon: Compass, title: 'Discover clubs', body: 'Browse school groups by interest and get the details you need before joining.' },
  { icon: CalendarDays, title: 'Keep plans clear', body: 'Find meeting dates, callouts, workshops, and locations without digging through messages.' },
  { icon: Bell, title: 'Stay up to date', body: 'See announcements and important changes in one place.' },
  { icon: ShieldCheck, title: 'Run clubs together', body: 'Give students, officers, and advisors the tools they need to keep things organized.' },
]

export function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-canvas">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-[12px] font-black text-white">CS</span>ClubStack</Link>
          <nav className="flex items-center gap-4"><a href="#features" className="hidden text-[13px] font-semibold text-ink-soft hover:text-ink sm:inline">Explore</a><Link to="/login" className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] font-bold transition-colors hover:bg-canvas">Sign in</Link></nav>
        </div>
      </header>
      <main>
        <section className="border-b border-line bg-canvas px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="reveal max-w-3xl">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted">A home for school clubs</p>
              <h1 className="mt-5 text-[43px] font-extrabold leading-[1.06] tracking-[-0.045em] sm:text-[62px]">School life happens<br className="hidden sm:block"/> <span className="text-brand-600">outside the classroom.</span></h1>
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-ink-soft sm:text-[17px]">ClubStack makes it easier to find your people, follow what your clubs are doing, and keep the details in one place.</p>
              <div className="mt-8 flex flex-wrap gap-3"><Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-[13px] font-bold text-white transition-colors hover:bg-ink/85">Explore clubs <ArrowRight size={15}/></Link><a href="#how-it-works" className="rounded-xl border border-line bg-surface px-5 py-3.5 text-[13px] font-bold text-ink-soft transition-colors hover:bg-canvas">How it works</a></div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-5 text-[12px] font-medium text-muted"><span className="inline-flex items-center gap-2"><Search size={15} className="text-brand-600"/> Find groups</span><span className="inline-flex items-center gap-2"><CalendarDays size={15} className="text-[#52785d]"/> Track meetings</span><span className="inline-flex items-center gap-2"><Megaphone size={15} className="text-[#b47738]"/> Follow updates</span></div>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.8fr_1.2fr]">
          <div className="reveal max-w-md"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">One place to start</p><h2 className="mt-3 text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px]">Less searching.<br/>More doing.</h2><p className="mt-4 text-[13.5px] leading-7 text-muted">Club details, schedules, and updates should be easy to find. ClubStack brings the everyday parts of club life together without getting in the way.</p></div>
          <div className="reveal grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-line bg-surface p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8edf5] text-[#425c7c]"><Compass size={19}/></span><h3 className="mt-4 text-[15px] font-bold">Start with an interest</h3><p className="mt-2 text-[12.5px] leading-6 text-muted">Explore approved clubs, read their descriptions, and learn how to get involved.</p></article>
            <article className="rounded-2xl border border-line bg-surface p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7efe8] text-[#52785d]"><CalendarDays size={19}/></span><h3 className="mt-4 text-[15px] font-bold">Know when to show up</h3><p className="mt-2 text-[12.5px] leading-6 text-muted">Keep meeting times, locations, and event changes easy to check.</p></article>
            <article className="rounded-2xl border border-line bg-surface p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5eadb] text-[#a16c2e]"><Bell size={19}/></span><h3 className="mt-4 text-[15px] font-bold">Catch the important updates</h3><p className="mt-2 text-[12.5px] leading-6 text-muted">Announcements help members keep up with plans and changes.</p></article>
            <article className="rounded-2xl border border-line bg-surface p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eee8f5] text-[#74588d]"><Users size={19}/></span><h3 className="mt-4 text-[15px] font-bold">Keep the club moving</h3><p className="mt-2 text-[12.5px] leading-6 text-muted">Leaders and advisors can coordinate membership, information, and activities.</p></article>
          </div>
        </section>
        <section id="features" className="border-y border-line bg-canvas px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="reveal max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Built around real club needs</p><h2 className="mt-3 text-[29px] font-extrabold tracking-tight sm:text-[38px]">The essentials, without the clutter.</h2></div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,title,body},index)=><article key={title} className={`reveal rounded-2xl border border-line bg-surface p-5 ${index%2?'reveal-delay':''}`}><Icon size={19} className={index===0?'text-brand-600':index===1?'text-[#52785d]':index===2?'text-[#b47738]':'text-[#74588d]'}/><h3 className="mt-4 text-[14px] font-bold">{title}</h3><p className="mt-2 text-[12.5px] leading-6 text-muted">{body}</p></article>)}</div>
          </div>
        </section>
        <section className="bg-canvas px-5 py-16 sm:px-8 sm:py-20"><div className="reveal mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:p-9"><div className="max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Ready when you are</p><h2 className="mt-3 text-[27px] font-extrabold tracking-tight sm:text-[34px]">Find out what your school has going on.</h2><p className="mt-3 text-[13px] leading-6 text-muted">Sign in to browse clubs, join groups, and keep up with the next meeting.</p></div><Link to="/login" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-[13px] font-bold text-white transition-colors hover:bg-ink/85">Get started <ArrowRight size={15}/></Link></div></section>
      </main>
      <footer className="border-t border-line bg-canvas"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[11.5px] text-muted sm:px-8"><span className="font-extrabold text-ink">ClubStack</span><span>School clubs, organized.</span><Link to="/login" className="font-semibold text-ink-soft hover:text-ink">Sign in <ArrowRight size={12} className="inline"/></Link></div></footer>
    </div>
  )
}
