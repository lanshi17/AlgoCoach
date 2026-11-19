import { describe, expect, it } from 'vitest'
import { newReviewCard, reviewCard } from './deepTutorScheduler'

const start = new Date('2026-01-01T00:00:00.000Z')

describe('DeepTutor practice scheduler', () => {
  it('starts a new review on the next day', () => {
    expect(newReviewCard(start).due).toBe('2026-01-02T00:00:00.000Z')
  })

  it('uses the documented three-day good interval and ease growth', () => {
    const next = reviewCard(newReviewCard(start), 3, start)
    expect(next).toMatchObject({ intervalDays: 3, ease: 2.5, streak: 1, reviewCount: 1, reps: 1, state: 'review' })
    expect(next.due).toBe('2026-01-04T00:00:00.000Z')
  })

  it('slows hard reviews and resets the streak', () => {
    const first = reviewCard(newReviewCard(start), 3, start)
    const next = reviewCard(first, 2, new Date('2026-01-04T00:00:00.000Z'))
    expect(next.intervalDays).toBe(3.6)
    expect(next.ease).toBe(2.35)
    expect(next.streak).toBe(0)
  })

  it('schedules a lapse within the same day and records it', () => {
    const first = reviewCard(newReviewCard(start), 3, start)
    const next = reviewCard(first, 1, new Date('2026-01-04T00:00:00.000Z'))
    expect(next.intervalDays).toBe(0.007)
    expect(next.lapses).toBe(1)
    expect(next.state).toBe('relearning')
  })

  it('rejects invalid ratings', () => {
    expect(() => reviewCard(newReviewCard(start), 5 as 1, start)).toThrow()
  })
})
