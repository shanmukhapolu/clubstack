import type { Club } from './types'

export interface ClubFilters {
  query: string
  category: string | null
}

export function filterClubs(clubs: Club[], { query, category }: ClubFilters): Club[] {
  const needle = query.trim().toLowerCase()

  return clubs.filter((club) => {
    if (category && club.category !== category) return false
    if (!needle) return true
    const haystack = [
      club.name,
      club.description,
      club.category,
      club.meetingDay,
      club.leaderName,
      club.location,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name
}

export function friendlyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.'
  const code = (error as { code?: string }).code ?? ''

  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.'
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was closed before it finished.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.'
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled for this Firebase project yet. Enable it in Firebase Authentication.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase sign-in. Add it under Authentication → Settings → Authorized domains.'
    case 'permission-denied':
      return 'You do not have permission to do that.'
    case 'unavailable':
      return 'Could not reach the server. Check your connection and try again.'
    default:
      return error.message
  }
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Firestore supports at most 30 values in an `in` query. */
export function chunk<T>(items: T[], size = 30): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}
