const DAY_MS = 24 * 60 * 60 * 1000

export function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(timestamp: number): boolean {
  return isSameDay(new Date(timestamp), new Date())
}

/** Long form date used on cards, e.g. "Fri, Oct 24". */
export function formatEventDate(timestamp: number): string {
  const date = new Date(timestamp)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  return `${weekday}, ${month} ${date.getDate()}`
}

export function formatDateLong(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTimeRange(startAt: number, endAt: number | null): string {
  if (!endAt) return formatTime(startAt)
  return `${formatTime(startAt)} – ${formatTime(endAt)}`
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Six-week grid starting on Sunday, including days from adjacent months. */
export function buildMonthGrid(viewDate: Date): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'Just now'
  if (diff < 60 * 60_000) {
    const minutes = Math.floor(diff / 60_000)
    return `${minutes}m ago`
  }
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / (60 * 60_000))
    return `${hours}h ago`
  }
  if (diff < 2 * DAY_MS) return 'Yesterday'
  if (diff < 7 * DAY_MS) {
    const days = Math.floor(diff / DAY_MS)
    return `${days}d ago`
  }
  return formatEventDate(timestamp)
}

export function upcoming<T extends { startAt: number }>(events: T[]): T[] {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  return events
    .filter((event) => event.startAt >= cutoff)
    .sort((a, b) => a.startAt - b.startAt)
}

export function toDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function fromDateTimeInput(value: string): number {
  return new Date(value).getTime()
}

/** Default start time for a new event: tomorrow at 3:30 PM. */
export function defaultEventStart(): number {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(15, 30, 0, 0)
  return date.getTime()
}
