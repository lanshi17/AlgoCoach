import { describe, expect, it } from 'vitest'
import { newReviewCard, reviewCard } from './openTutorScheduler'

const start = new Date('2026-01-01T00:00:00.000Z')
describe('OpenTutor review scheduling', () => {
  it('waits one day before the first recall', () => {
    expect(newReviewCard(start).due).toBe('2026-01-02T00:00:00.000Z')
  })
  it('matches OpenTutor first review and later recall calculations', () => {
    const first = reviewCard(newReviewCard(start), 3, start)
    expect(first).toMatchObject({ difficulty: 1, stability: 2.4, reps: 1, lapses: 0, state: 'review', due: '2026-01-03T00:00:00.000Z' })
    const next = reviewCard(first, 2, new Date('2026-01-06T00:00:00.000Z'))
    expect(next.difficulty).toBeCloseTo(1.8514, 6)
    expect(next.stability).toBeCloseTo(7.67992294, 6)
    expect(next.due).toBe('2026-01-14T00:00:00.000Z')
  })
  it('reschedules a lapse for the next day and preserves same-day stability', () => {
    const first = reviewCard(newReviewCard(start), 4, start)
    const next = reviewCard(first, 1, new Date('2026-01-01T12:00:00.000Z'))
    expect(next.stability).toBe(5.8)
    expect(next.lapses).toBe(1)
    expect(next.state).toBe('relearning')
    expect(next.due).toBe('2026-01-02T12:00:00.000Z')
  })
  it('rejects invalid ratings', () => {
    expect(() => reviewCard(newReviewCard(start), 5 as 1, start)).toThrow()
  })
})
