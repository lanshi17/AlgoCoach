import { describe, expect, it } from 'vitest'
import { MAX_MASTERY_BUNDLE_TOPICS, parseMasteryBundle } from './masterySync'

const valid = {
  format: 'algocoach-mastery-v1',
  exportedAt: '2026-01-01T00:00:00',
  workspaceId: 'local-default',
  topics: [{ topic: '二分查找', mastery: 0.55, attempts: 3, lastSeen: '2026-01-01T00:00:00' }],
}

describe('mastery bundle parser', () => {
  it('accepts a valid bundle and trims topic names', () => {
    const parsed = parseMasteryBundle(JSON.stringify({
      ...valid,
      topics: [{ ...valid.topics[0], topic: '  二分查找  ', lastSeen: undefined }],
    }))
    expect(parsed.topics).toEqual([{ topic: '二分查找', mastery: 0.55, attempts: 3, lastSeen: '' }])
    expect(parsed.workspaceId).toBe('local-default')
  })

  it('rejects malformed JSON and another format', () => {
    expect(() => parseMasteryBundle('{broken')).toThrow('JSON')
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, format: 'other' }))).toThrow('AlgoCoach')
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, topics: 'none' }))).toThrow('知识点列表')
  })

  it('rejects invalid topic fields', () => {
    const bad = [
      { topic: '  ', mastery: 0.5, attempts: 1, lastSeen: '' },
      { topic: 'x', mastery: 1.2, attempts: 1, lastSeen: '' },
      { topic: 'x', mastery: 0.5, attempts: -1, lastSeen: '' },
      { topic: 'x', mastery: 0.5, attempts: 1.5, lastSeen: '' },
      { topic: 'x', mastery: 0.5, attempts: 1, lastSeen: 42 },
      { topic: 'x'.repeat(201), mastery: 0.5, attempts: 1, lastSeen: '' },
    ]
    for (const topic of bad) {
      expect(() => parseMasteryBundle(JSON.stringify({ ...valid, topics: [topic] }))).toThrow('无效')
    }
  })

  it('bounds the number of topics in one file', () => {
    const topics = Array.from({ length: MAX_MASTERY_BUNDLE_TOPICS + 1 }, (_, index) => ({ topic: `t${index}`, mastery: 0.5, attempts: 1, lastSeen: '' }))
    expect(() => parseMasteryBundle(JSON.stringify({ ...valid, topics }))).toThrow('最多')
  })
})
