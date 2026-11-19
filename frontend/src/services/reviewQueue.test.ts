import { afterEach, expect, it } from 'vitest'
import { readReviewEntries, saveReviewEntry } from './reviewQueue'

afterEach(() => localStorage.clear())

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

it('schedules saved notes and preserves legacy notes without claiming they were reviewed', async () => {
  const { dueReviewEntries, rateReviewEntry } = await import('./reviewQueue')
  const now = new Date('2026-01-01T00:00:00.000Z')
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'legacy', note: '旧笔记', reviewedAt: now.toISOString() }]))
  expect(dueReviewEntries(readReviewEntries(), now)).toHaveLength(0)
  const due = new Date('2026-01-02T00:00:00.000Z')
  expect(dueReviewEntries(readReviewEntries(), due).map(entry => entry.problemId)).toEqual(['legacy'])
  rateReviewEntry('legacy', 3, due)
  expect(readReviewEntries()[0].note).toBe('旧笔记')
  expect(dueReviewEntries(readReviewEntries(), due)).toHaveLength(0)
})
