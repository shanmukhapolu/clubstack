import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { buttonStyles } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="text-6xl">🧭</p>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight">This page is off campus.</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        The page you were looking for doesn’t exist or may have moved. Head back to the club
        directory to keep exploring.
      </p>
      <Link to="/" className={buttonStyles('primary', 'md', 'mt-6')}>
        Back to ClubStack <ArrowRight size={16} />
      </Link>
    </div>
  )
}
