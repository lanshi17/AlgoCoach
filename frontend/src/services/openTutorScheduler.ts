/**
 * Adapted from OpenTutor's services/spaced_repetition/fsrs.py, commit
 * 30ca4f445046a22fb9e3b69728428a0abf00bd04, Copyright (c) 2026 Zijin Zhang,
 * MIT license; see /licenses/OpenTutor-MIT.txt. This is its default-parameter
 * scheduling logic, not a claim of personalised or clinically validated recall.
 */
export type ReviewRating = 1 | 2 | 3 | 4
export interface ReviewCard {
  difficulty: number
  stability: number
  reps: number
  lapses: number
  lastReview: string | null
  due: string
  state: 'new' | 'learning' | 'review' | 'relearning'
}
const DAY_MS = 86400000
const W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const initialDifficulty = (rating: ReviewRating) => clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1, 10)
// Python's round uses ties-to-even; preserve OpenTutor's day intervals.
function roundEven(value: number): number {
  const lower = Math.floor(value)
  return value - lower === 0.5 ? lower + (lower % 2) : Math.round(value)
}

export function newReviewCard(now: Date): ReviewCard {
  return { difficulty: 5, stability: 0, reps: 0, lapses: 0, lastReview: null, due: new Date(now.getTime() + DAY_MS).toISOString(), state: 'new' }
}

export function reviewCard(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('复习评分无效。')
  const elapsed = card.lastReview ? Math.max((now.getTime() - Date.parse(card.lastReview)) / DAY_MS, 0) : 0
  let { difficulty, stability, lapses, state } = card
  if (state === 'new' || card.reps === 0) {
    difficulty = initialDifficulty(rating)
    stability = Math.max(W[rating - 1], 0.1)
    state = rating < 3 ? 'learning' : 'review'
  } else {
    const recall = stability <= 0 ? 0 : Math.pow(1 + elapsed / (9 * stability), -1)
    const nextDifficulty = clamp(W[7] * initialDifficulty(4) + (1 - W[7]) * (difficulty - W[6] * (rating - 3) * (10 - difficulty) / 9), 1, 10)
    let nextStability = stability
    // OpenTutor's default same-day parameters are zero, so stability is unchanged.
    if (elapsed >= 1) {
      nextStability = rating === 1
        ? Math.max(W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp((1 - recall) * W[14]), 0.1)
        : Math.max(stability * (1 + Math.exp(W[8]) * (11 - difficulty) * Math.pow(stability, -W[9]) * (Math.exp((1 - recall) * W[10]) - 1) * (rating === 2 ? W[15] : 1) * (rating === 4 ? W[16] : 1)), 0.1)
    }
    difficulty = nextDifficulty
    stability = nextStability
    if (rating === 1) { lapses++; state = 'relearning' } else state = 'review'
  }
  const interval = rating === 1 || state === 'learning' ? 1 : Math.max(1, roundEven(stability))
  return { difficulty, stability, reps: card.reps + 1, lapses, lastReview: now.toISOString(), due: new Date(now.getTime() + interval * DAY_MS).toISOString(), state }
}

export function isReviewCard(value: unknown): value is ReviewCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const card = value as Partial<ReviewCard>
  return typeof card.difficulty === 'number' && card.difficulty >= 1 && card.difficulty <= 10
    && typeof card.stability === 'number' && Number.isFinite(card.stability) && card.stability >= 0
    && Number.isSafeInteger(card.reps) && (card.reps ?? -1) >= 0
    && Number.isSafeInteger(card.lapses) && (card.lapses ?? -1) >= 0
    && (card.reps === 0 || card.stability > 0)
    && (card.lastReview === null || (typeof card.lastReview === 'string' && Number.isFinite(Date.parse(card.lastReview))))
    && typeof card.due === 'string' && Number.isFinite(Date.parse(card.due))
    && ['new', 'learning', 'review', 'relearning'].includes(card.state ?? '')
}
