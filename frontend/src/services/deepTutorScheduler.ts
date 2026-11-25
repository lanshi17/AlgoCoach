/**
 * DeepTutor-aligned daily review scheduler.
 *
 * This is the explainable SM-2-style cold-start policy documented by
 * DeepTutor's practice service. It is deliberately not presented as a
 * fitted personal model: every review event remains replayable so a later scheduler can
 * be evaluated without losing evidence.
 */
export type ReviewRating = 1 | 2 | 3 | 4

/** Self-assessment choices shared by every review surface, ordered from weakest to strongest recall. */
export const REVIEW_RATING_OPTIONS: ReadonlyArray<{ value: ReviewRating; label: string }> = [
  { value: 1, label: '没想起' },
  { value: 2, label: '很费力' },
  { value: 3, label: '想起来了' },
  { value: 4, label: '很轻松' },
]

export interface ReviewCard {
  intervalDays: number
  ease: number
  streak: number
  lapses: number
  reviewCount: number
  /** Compatibility alias used by the existing progress UI. */
  reps: number
  lastReview: string | null
  due: string
  state: 'new' | 'learning' | 'review' | 'relearning'
}

const DAY_MS = 86400000
const MAX_INTERVAL_DAYS = 365

export function newReviewCard(now: Date): ReviewCard {
  return {
    intervalDays: 1,
    ease: 2.5,
    streak: 0,
    lapses: 0,
    reviewCount: 0,
    reps: 0,
    lastReview: null,
    due: new Date(now.getTime() + DAY_MS).toISOString(),
    state: 'new',
  }
}

export function reviewCard(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('复习评分无效。')
  let intervalDays = finitePositive(card.intervalDays, 1)
  let ease = clamp(finitePositive(card.ease, 2.5), 1.3, 3)
  let streak = Math.max(0, Math.trunc(card.streak ?? 0))
  const lapses = Math.max(0, Math.trunc(card.lapses ?? 0)) + (rating === 1 ? 1 : 0)

  if (rating === 1) {
    intervalDays = 10 / 1440
    ease = Math.max(1.3, ease - 0.2)
    streak = 0
  } else if (rating === 2) {
    intervalDays = Math.max(1, intervalDays * 1.2)
    ease = Math.max(1.3, ease - 0.15)
    streak = 0
  } else {
    intervalDays = intervalDays <= 1 || card.reviewCount === 0 ? 3 : intervalDays * ease
    if (rating === 4) {
      intervalDays *= 1.3
      ease = Math.min(3, ease + 0.15)
    }
    streak += 1
  }

  intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.round(intervalDays * 1000) / 1000)
  const reviewCount = Math.max(0, Math.trunc(card.reviewCount ?? card.reps ?? 0)) + 1
  const state = rating === 1 ? 'relearning' : rating === 2 ? 'learning' : 'review'
  return {
    intervalDays,
    ease,
    streak,
    lapses,
    reviewCount,
    reps: reviewCount,
    lastReview: now.toISOString(),
    due: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    state,
  }
}

export function isReviewCard(value: unknown): value is ReviewCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const card = value as Partial<ReviewCard>
  const reviewCount = card.reviewCount ?? card.reps
  return typeof card.intervalDays === 'number' && card.intervalDays > 0 && card.intervalDays <= MAX_INTERVAL_DAYS
    && typeof card.ease === 'number' && Number.isFinite(card.ease) && card.ease >= 1.3 && card.ease <= 3
    && Number.isSafeInteger(card.streak) && (card.streak ?? -1) >= 0
    && Number.isSafeInteger(card.lapses) && (card.lapses ?? -1) >= 0
    && Number.isSafeInteger(reviewCount) && (reviewCount ?? -1) >= 0
    && (card.lastReview === null || (typeof card.lastReview === 'string' && Number.isFinite(Date.parse(card.lastReview))))
    && typeof card.due === 'string' && Number.isFinite(Date.parse(card.due))
    && ['new', 'learning', 'review', 'relearning'].includes(card.state ?? '')
}

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
