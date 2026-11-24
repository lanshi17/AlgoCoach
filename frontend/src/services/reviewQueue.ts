import type { LocalPracticeRecord } from './localProgress'
import { isReviewCard, newReviewCard, reviewCard, type ReviewCard, type ReviewRating } from './deepTutorScheduler'
import { workspaceStorageKey } from './deepTutorCapabilities'

const REVIEW_KEY = workspaceStorageKey('algocoach.localReviewEntries')
const REVIEW_EVENTS_KEY = workspaceStorageKey('algocoach.localReviewEvents')

/** Due notes shown per review round; the rest stay due and appear as earlier ones are rated. */
export const REVIEW_ROUND_LIMIT = 20

export interface LocalReviewEntry {
  problemId: string
  note: string
  reviewedAt: string
  problemKey?: string
  title?: string
  schedule?: ReviewCard
  /** Paused by the learner: no daily schedule while set. The schedule and evidence are kept. */
  mastered?: boolean
}

/** One self-assessment, kept as evidence so a later scheduler can be replayed or evaluated. */
export interface LocalReviewEvent {
  problemId: string
  rating: ReviewRating
  reviewedAt: string
  dueBefore: string
  dueAfter: string
}

export function readReviewEntries(): LocalReviewEntry[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(REVIEW_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(isReviewEntry)
  } catch {
    return []
  }
}

export function readReviewEvents(): LocalReviewEvent[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(REVIEW_EVENTS_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(isReviewEvent)
  } catch {
    return []
  }
}

export function saveReviewEntry(problemId: string, note: string, record?: LocalPracticeRecord): LocalReviewEntry[] {
  const entries = readReviewEntries()
  const previous = entries.find(entry => entry.problemId === problemId)
  const current = entries.filter(entry => entry.problemId !== problemId)
  // No cap: dropping the oldest note would silently drop its review schedule too.
  const next = [...current, { problemId, note: note.trim(), reviewedAt: new Date().toISOString(),
    problemKey: record?.problemId ?? previous?.problemKey, title: record?.title ?? previous?.title,
    mastered: previous?.mastered, schedule: scheduleFor(previous) ?? newReviewCard(new Date()) }]
  window.localStorage.setItem(REVIEW_KEY, JSON.stringify(next))
  return next
}

/** Pauses or resumes a note's daily schedule; its schedule and evidence stay as they are. */
export function setReviewMastered(problemId: string, mastered: boolean): LocalReviewEntry[] {
  const entries = readReviewEntries()
  if (!entries.some(entry => entry.problemId === problemId)) throw new Error('找不到可复习的笔记。')
  const next = entries.map(entry => entry.problemId === problemId ? { ...entry, mastered } : entry)
  window.localStorage.setItem(REVIEW_KEY, JSON.stringify(next))
  return next
}

function isReviewEntry(value: unknown): value is LocalReviewEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<LocalReviewEntry>
  return typeof item.problemId === 'string' && typeof item.note === 'string' && typeof item.reviewedAt === 'string'
    && (item.problemKey === undefined || typeof item.problemKey === 'string')
    && (item.title === undefined || typeof item.title === 'string')
    && (item.mastered === undefined || typeof item.mastered === 'boolean')
}

function isReviewEvent(value: unknown): value is LocalReviewEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<LocalReviewEvent>
  return typeof item.problemId === 'string' && [1, 2, 3, 4].includes(item.rating as number)
    && [item.reviewedAt, item.dueBefore, item.dueAfter].every(time => typeof time === 'string' && Number.isFinite(Date.parse(time)))
}

function scheduleFor(entry: LocalReviewEntry | undefined): ReviewCard | null {
  if (!entry) return null
  if (isReviewCard(entry.schedule)) return entry.schedule
  // Entries written by the pre-DeepTutor scheduler used different fields but
  // still carried a trustworthy due timestamp. Preserve that timestamp while
  // upgrading the rest of the card to the new replayable shape.
  const legacy = entry.schedule as { due?: unknown; lastReview?: unknown; reps?: unknown } | undefined
  if (legacy && typeof legacy.due === 'string' && Number.isFinite(Date.parse(legacy.due))) {
    const reviewedAt = Date.parse(entry.reviewedAt)
    const card = newReviewCard(new Date(Number.isFinite(reviewedAt) ? reviewedAt : Date.parse(legacy.due)))
    const reps = typeof legacy.reps === 'number' && Number.isSafeInteger(legacy.reps) && legacy.reps >= 0 ? legacy.reps : 0
    return {
      ...card,
      due: legacy.due,
      lastReview: typeof legacy.lastReview === 'string' && Number.isFinite(Date.parse(legacy.lastReview)) ? legacy.lastReview : card.lastReview,
      reviewCount: reps,
      reps,
      state: reps > 0 ? 'review' : 'new',
    }
  }
  const time = Date.parse(entry.reviewedAt)
  return Number.isFinite(time) ? newReviewCard(new Date(time)) : null
}

export function dueReviewEntries(entries: LocalReviewEntry[], now = new Date()): LocalReviewEntry[] {
  return entries.filter(entry => {
    if (entry.mastered) return false
    const schedule = scheduleFor(entry)
    return schedule !== null && Date.parse(schedule.due) <= now.getTime()
  }).sort((a, b) => Date.parse(scheduleFor(a)!.due) - Date.parse(scheduleFor(b)!.due))
}

export function rateReviewEntry(problemId: string, rating: ReviewRating, now = new Date()): LocalReviewEntry[] {
  const entries = readReviewEntries()
  const current = entries.find(entry => entry.problemId === problemId)
  const schedule = scheduleFor(current)
  if (!current || !schedule) throw new Error('找不到可复习的笔记。')
  // A paused note is outside the daily queue, so a rating for it changes nothing.
  if (current.mastered) return entries
  // A rating only advances a note that is due at the moment it is rated. If another
  // tab already rated it and pushed the due date forward, this rating is ignored, so one
  // review never advances the schedule or adds evidence twice.
  if (Date.parse(schedule.due) > now.getTime()) return entries
  const nextSchedule = reviewCard(schedule, rating, now)
  const next = entries.map(entry => entry.problemId === problemId ? { ...entry, schedule: nextSchedule } : entry)
  const reviewEvent: LocalReviewEvent = { problemId, rating, reviewedAt: now.toISOString(), dueBefore: schedule.due, dueAfter: nextSchedule.due }
  const previousEvents = window.localStorage.getItem(REVIEW_EVENTS_KEY)
  window.localStorage.setItem(REVIEW_EVENTS_KEY, JSON.stringify([...readReviewEvents(), reviewEvent]))
  try {
    window.localStorage.setItem(REVIEW_KEY, JSON.stringify(next))
  } catch (cause) {
    // Evidence and schedule move together: if the schedule write fails, the event is rolled
    // back too, so a retry of the same rating is recorded once instead of twice.
    if (previousEvents === null) window.localStorage.removeItem(REVIEW_EVENTS_KEY)
    else window.localStorage.setItem(REVIEW_EVENTS_KEY, previousEvents)
    throw cause
  }
  return next
}
