import { afterEach, expect, it, vi } from 'vitest'
import { dueReviewEntries, rateReviewEntry, readReviewEntries, readReviewEvents, saveReviewEntry, setReviewMastered } from './reviewQueue'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

it('persists one review entry per problem', () => {
  saveReviewEntry('local-two-sum', '先写暴力，再换哈希表')
  saveReviewEntry('local-two-sum', '复杂度 O(n)，注意重复值')
  const entries = readReviewEntries()
  expect(entries).toHaveLength(1)
  expect(entries[0].note).toContain('复杂度')
})

it('ignores malformed review entries', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'x' }, { problemId: 'y', note: '', reviewedAt: 'now' }]))
  expect(readReviewEntries()).toEqual([{ problemId: 'y', note: '', reviewedAt: 'now' }])
})

it('schedules saved notes and preserves legacy notes without claiming they were reviewed', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'legacy', note: '旧笔记', reviewedAt: now.toISOString() }]))
  expect(dueReviewEntries(readReviewEntries(), now)).toHaveLength(0)
  const due = new Date('2026-01-02T00:00:00.000Z')
  expect(dueReviewEntries(readReviewEntries(), due).map(entry => entry.problemId)).toEqual(['legacy'])
  rateReviewEntry('legacy', 3, due)
  expect(readReviewEntries()[0].note).toBe('旧笔记')
  expect(dueReviewEntries(readReviewEntries(), due)).toHaveLength(0)
})

it('keeps a legacy scheduler due date while upgrading its card on rating', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{
    problemId: 'legacy-card', note: '旧调度字段', reviewedAt: '2026-01-01T00:00:00.000Z',
    schedule: { difficulty: 5, stability: 0, reps: 0, lapses: 0, lastReview: null, due: '2020-01-02T00:00:00.000Z', state: 'new' },
  }]))
  expect(dueReviewEntries(readReviewEntries(), new Date('2026-01-01T00:00:00.000Z')).map(entry => entry.problemId)).toEqual(['legacy-card'])
  rateReviewEntry('legacy-card', 3, new Date('2026-01-01T00:00:00.000Z'))
  expect(readReviewEntries()[0].schedule).toMatchObject({ intervalDays: 3, reviewCount: 1, reps: 1 })
})

it('keeps every saved note instead of silently dropping the oldest after 100', () => {
  for (let index = 0; index < 101; index += 1) saveReviewEntry(`problem-${index}`, `笔记 ${index}`)
  const entries = readReviewEntries()
  expect(entries).toHaveLength(101)
  expect(entries[0].problemId).toBe('problem-0')
})

it('records every rating as a replayable event and keeps earlier events intact', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'two-sum', note: '先写暴力', reviewedAt: '2026-01-01T00:00:00.000Z' }]))
  rateReviewEntry('two-sum', 3, new Date('2026-01-02T00:00:00.000Z'))
  rateReviewEntry('two-sum', 2, new Date('2026-01-05T00:00:00.000Z'))
  const events = readReviewEvents()
  expect(events.map(event => event.rating)).toEqual([3, 2])
  expect(events[0]).toMatchObject({ problemId: 'two-sum', reviewedAt: '2026-01-02T00:00:00.000Z' })
  expect(events[1].dueBefore).toBe(events[0].dueAfter)
})

it('records one rating when two tabs rate the same due note', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'two-sum', note: '先写暴力', reviewedAt: '2026-01-01T00:00:00.000Z' }]))
  rateReviewEntry('two-sum', 3, new Date('2026-01-02T00:00:00.000Z'))
  const afterFirstTab = readReviewEntries()[0].schedule
  rateReviewEntry('two-sum', 3, new Date('2026-01-02T00:05:00.000Z'))
  expect(readReviewEntries()[0].schedule).toEqual(afterFirstTab)
  expect(readReviewEvents()).toHaveLength(1)
})

it('rolls back the evidence when the schedule write fails so a retry records the review once', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'two-sum', note: '先写暴力', reviewedAt: '2026-01-01T00:00:00.000Z' }]))
  const scheduleBefore = localStorage.getItem('algocoach.localReviewEntries')
  const setItem = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    if (key === 'algocoach.localReviewEntries') throw new Error('quota exceeded')
    setItem.call(localStorage, key, value)
  })
  expect(() => rateReviewEntry('two-sum', 3, new Date('2026-01-02T00:00:00.000Z'))).toThrow('quota exceeded')
  vi.restoreAllMocks()
  expect(localStorage.getItem('algocoach.localReviewEntries')).toBe(scheduleBefore)
  expect(readReviewEvents()).toHaveLength(0)
})

it('pauses a mastered note until it is unmarked, even after its due date has passed', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'two-sum', note: '先写暴力', reviewedAt: '2026-01-01T00:00:00.000Z' }]))
  const overdue = new Date('2026-01-05T00:00:00.000Z')
  setReviewMastered('two-sum', true)
  expect(dueReviewEntries(readReviewEntries(), overdue)).toHaveLength(0)
  setReviewMastered('two-sum', false)
  expect(dueReviewEntries(readReviewEntries(), overdue).map(entry => entry.problemId)).toEqual(['two-sum'])
})

it('ignores a rating for a mastered note so neither its schedule nor its evidence changes', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'two-sum', note: '先写暴力', reviewedAt: '2026-01-01T00:00:00.000Z' }]))
  setReviewMastered('two-sum', true)
  rateReviewEntry('two-sum', 3, new Date('2026-01-05T00:00:00.000Z'))
  expect(readReviewEvents()).toHaveLength(0)
  expect(readReviewEntries()[0].schedule).toBeUndefined()
})

it('keeps the mastered flag when a mastered note is edited', () => {
  saveReviewEntry('two-sum', '先写暴力')
  setReviewMastered('two-sum', true)
  saveReviewEntry('two-sum', '先写暴力，再换哈希表')
  expect(readReviewEntries()[0]).toMatchObject({ note: '先写暴力，再换哈希表', mastered: true })
})
