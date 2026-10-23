import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock3, Plus, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClubs } from '../context/ClubsContext'
import { filterClubs } from '../lib/helpers'
import { CATEGORIES } from '../lib/types'
import { buttonStyles, EmptyState, Spinner } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { ClubCard } from '../components/ClubCard'

export function DiscoverPage() {
  const { user } = useAuth()
  const { clubs, joinedIds, loading } = useClubs()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const approved = useMemo(() => clubs.filter((club) => club.status === 'approved'), [clubs])

  const results = useMemo(
    () =>
      filterClubs(approved, { query, category }).sort((a, b) => {
        if (a.name === b.name) return 0
        return a.name.localeCompare(b.name)
      }),
    [approved, query, category],
  )

  const pendingMine = clubs.filter(
    (club) => club.status === 'pending' && club.leaderId === user?.id,
  )

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Club directory"
        title="Find your people."
        description={`Browse ${approved.length} clubs at Northgate. Search by name, interest, or meeting day — then join in one tap.`}
        action={
          <Link to="/clubs/new" className={buttonStyles('primary', 'md')}>
            <Plus size={17} /> Create a club
          </Link>
        }
      />

      {pendingMine.length > 0 && (
        <div className="mb-5 space-y-2">
          {pendingMine.map((club) => (
            <Link
              key={club.id}
              to={`/clubs/${club.id}`}
              className="flex items-center gap-3 rounded-2xl border border-[#f0dcb0] bg-[#fff8e9] px-4 py-3 text-[13px]"
            >
              <Clock3 size={17} className="shrink-0 text-[#8a5a00]" />
              <span className="min-w-0 flex-1">
                <strong className="font-bold">{club.name}</strong> is waiting for admin approval.
                Only you and admins can see it right now.
              </span>
              <span className="hidden shrink-0 font-semibold text-[#8a5a00] sm:inline">
                View page →
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="sticky top-[61px] z-30 -mx-4 mb-5 bg-canvas/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clubs, activities, meeting days…"
            aria-label="Search clubs"
            className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-10 text-[14.5px] placeholder:text-muted/70 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-canvas"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            category === null
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-surface text-ink-soft hover:border-ink/30'
          }`}
        >
          All clubs
        </button>
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(category === item ? null : item)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              category === item
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-ink-soft hover:border-ink/30'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading clubs" />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search size={20} />}
          title="No clubs match that search"
          description="Try a different keyword or clear the filters. If a club is missing, you can create its page."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setCategory(null)
              }}
              className={buttonStyles('secondary', 'sm')}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <p className="mb-3 text-[12.5px] font-medium text-muted">
            {results.length} club{results.length === 1 ? '' : 's'}
            {category ? ` in ${category}` : ''}
          </p>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {results.map((club) => (
              <ClubCard key={club.id} club={club} joined={joinedIds.has(club.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
