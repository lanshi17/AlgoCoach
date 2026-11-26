import { describe, expect, it } from 'vitest'
import { MAX_MASTERY_BUNDLE_SCHEDULES, MAX_MASTERY_BUNDLE_TOPICS, parseMasteryBundle } from './masterySync'

const schedule = {
  problemId: 'two-sum', dueAt: '2026-02-10T00:00:00', intervalDays: 5,
  mastery: 0.6, attempts: 5, topics: ['Array'], updatedAt: '2026-02-05T00:00:00',
}
const valid = {
  format: 'algocoach-mastery-v2',
  exportedAt: '2026-01-01T00:00:00',
  workspaceId: 'local-default',
  topics: [{ topic: '二分查找', mastery: 0.55, attempts: 3, lastSeen: '2026-01-01T00:00:00' }],
  reviewSchedules: [schedule],
}

describe('mastery bundle parser', () => {
  it('accepts a valid v2 bundle and trims topic names', () => {
    const parsed = parseMasteryBundle(JSON.stringify({
      ...valid,
      topics: [{ ...valid.topics[0], topic: '  二分查找  ', lastSeen: undefined }],
    }))
    expect(parsed.topics).toEqual([{ topic: '二分查找', mastery: 0.55, attempts: 3, lastSeen: '' }])
    expect(parsed.reviewSchedules).toEqual([schedule])
    expect(parsed.workspaceId).toBe('local-default')
  })

  it('accepts a v1 bundle and treats the schedule list as empty', () => {
    const parsed = parseMasteryBundle(JSON.stringify({ ...valid, format: 'algocoach-mastery-v1', reviewSchedules: undefined }))
    expect(parsed.format).toBe('algocoach-mastery-v1')
    expect(parsed.reviewSchedules).toEqual([])
  })

  it('rejects malformed JSON and another format', () => {
    expect(() => parseMasteryBundle('{broken')).toThrow('JSON')
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, format: 'other' }))).toThrow('AlgoCoach')
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, topics: 'none' }))).toThrow('知识点列表')
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, reviewSchedules: 'none' }))).toThrow('复习计划列表')
  })

  it('rejects invalid topic and schedule fields', () => {
    const badTopics = [
      { topic: '  ', mastery: 0.5, attempts: 1, lastSeen: '' },
      { topic: 'x', mastery: 1.2, attempts: 1, lastSeen: '' },
      { topic: 'x', mastery: 0.5, attempts: -1, lastSeen: '' },
      { topic: 'x', mastery: 0.5, attempts: 1.5, lastSeen: '' },
      { topic: 'x', mastery: 0.5, attempts: 1, lastSeen: 42 },
      { topic: 'x'.repeat(201), mastery: 0.5, attempts: 1, lastSeen: '' },
    ]
    for (const topic of badTopics) {
      expect(() => parseMasteryBundle(JSON.stringify({ ...valid, topics: [topic] }))).toThrow('无效')
    }
    const badSchedules = [
      { ...schedule, problemId: ' ' },
      { ...schedule, dueAt: 'not-a-date' },
      { ...schedule, updatedAt: 'not-a-date' },
      { ...schedule, intervalDays: 0 },
      { ...schedule, mastery: 1.2 },
      { ...schedule, attempts: 1.5 },
      { ...schedule, topics: [''] },
    ]
    for (const item of badSchedules) {
      expect(() => parseMasteryBundle(JSON.stringify({ ...valid, reviewSchedules: [item] }))).toThrow('复习计划')
    }
  })

  it('bounds the number of topics and schedules in one file', () => {
    const topics = Array.from({ length: MAX_MASTERY_BUNDLE_TOPICS + 1 }, (_, index) => ({ topic: `t${index}`, mastery: 0.5, attempts: 1, lastSeen: '' }))
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, topics }))).toThrow('最多')
    const schedules = Array.from({ length: MAX_MASTERY_BUNDLE_SCHEDULES + 1 }, (_, index) => ({ ...schedule, problemId: `p${index}` }))
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, reviewSchedules: schedules }))).toThrow('复习计划')
  })
})
