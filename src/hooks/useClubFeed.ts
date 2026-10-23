import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/backend'
import type { Announcement, ClubEvent } from '../lib/types'

interface FeedState {
  announcements: Announcement[]
  events: ClubEvent[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useClubFeed(clubIds: string[]): FeedState {
  const key = clubIds.join('|')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)

    const ids = key ? key.split('|') : []
    Promise.all([api.announcements.listForClubs(ids), api.events.listForClubs(ids)])
      .then(([nextAnnouncements, nextEvents]) => {
        if (!active) return
        setAnnouncements(nextAnnouncements)
        setEvents(nextEvents)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'Could not load club updates.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [key, nonce])

  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  return { announcements, events, loading, error, refresh }
}
