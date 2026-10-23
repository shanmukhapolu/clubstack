import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/backend'
import type { Club } from '../lib/types'
import { useAuth } from './AuthContext'

interface ClubsContextValue {
  clubs: Club[]
  joinedIds: Set<string>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  join: (clubId: string) => Promise<void>
  leave: (clubId: string) => Promise<void>
  isJoined: (clubId: string) => boolean
}

const ClubsContext = createContext<ClubsContextValue | null>(null)

export function ClubsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [allClubs, setAllClubs] = useState<Club[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setAllClubs([])
      setJoinedIds(new Set())
      setLoading(false)
      return
    }

    try {
      const [clubs, memberships] = await Promise.all([
        api.clubs.list(),
        api.memberships.listMine(user.id),
      ])
      setAllClubs(clubs)
      setJoinedIds(new Set(memberships))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load clubs.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const clubs = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return allClubs
    return allClubs.filter((club) => club.status === 'approved' || club.leaderId === user.id)
  }, [allClubs, user])

  const join = useCallback(
    async (clubId: string) => {
      await api.memberships.join(clubId)
      await load()
    },
    [load],
  )

  const leave = useCallback(
    async (clubId: string) => {
      await api.memberships.leave(clubId)
      await load()
    },
    [load],
  )

  const value = useMemo<ClubsContextValue>(
    () => ({
      clubs,
      joinedIds,
      loading,
      error,
      refresh: load,
      join,
      leave,
      isJoined: (clubId: string) => joinedIds.has(clubId),
    }),
    [clubs, joinedIds, loading, error, load, join, leave],
  )

  return <ClubsContext.Provider value={value}>{children}</ClubsContext.Provider>
}

export function useClubs(): ClubsContextValue {
  const context = useContext(ClubsContext)
  if (!context) throw new Error('useClubs must be used inside ClubsProvider')
  return context
}
