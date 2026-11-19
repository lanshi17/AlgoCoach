import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushLocalPracticeRecords, queueLocalPracticeRecord, readLocalPracticeSyncQueue } from './localProgress'

const syncRecord = { id: 'sync-1', problemId: 'LEETCODE:local-two-sum', title: '两数之和', topics: ['数组'], durationSec: 12, codeLength: 20, endedAt: '2026-01-01T00:00:00.000Z' }

describe('local practice Agent sync', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })
  it('queues records and removes them after the Agent acknowledges them', async () => {
    queueLocalPracticeRecord(syncRecord)
    expect(readLocalPracticeSyncQueue()).toEqual(['sync-1'])
    const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    await flushLocalPracticeRecords([syncRecord])
    expect(fetch).toHaveBeenCalledWith('/api/agent/memory/record', expect.objectContaining({ method: 'POST' }))
    expect(readLocalPracticeSyncQueue()).toEqual([])
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ problem_id: 'local-two-sum', platform: 'LOCAL', status: 'LOCAL_PRACTICE', lang: 'unknown', duration_sec: 12, topics: ['数组'] })
  })
  it('keeps a queued record when the Agent is offline', async () => {
    queueLocalPracticeRecord(syncRecord)
    vi.spyOn(window, 'fetch').mockRejectedValue(new Error('offline'))
    await flushLocalPracticeRecords([syncRecord])
    expect(readLocalPracticeSyncQueue()).toEqual(['sync-1'])
  })
})

it('maps a passing local sample to a mastery update status', async () => {
  const record = { ...syncRecord, outcome: 'SAMPLE_PASSED' as const }
  queueLocalPracticeRecord(record)
  const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  await flushLocalPracticeRecords([record])
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ status: 'LOCAL_ACCEPTED', lang: 'python3' })
})

it('labels local outcomes and unassessed records for the ledger', async () => {
  const { localPracticeOutcomeLabel } = await import('./localProgress')
  expect(localPracticeOutcomeLabel({ ...syncRecord, outcome: 'SAMPLE_PASSED' })).toBe('样例通过')
  expect(localPracticeOutcomeLabel({ ...syncRecord, outcome: 'SAMPLE_FAILED' })).toBe('样例未通过')
  expect(localPracticeOutcomeLabel(syncRecord)).toBe('未运行样例')
})

it('retains the full record so an evicted practice can sync later', async () => {
  queueLocalPracticeRecord(syncRecord)
  const fetch = vi.spyOn(window, 'fetch').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('{}', { status: 200 }))
  await flushLocalPracticeRecords([])
  expect(readLocalPracticeSyncQueue()).toEqual(['sync-1'])
  await flushLocalPracticeRecords([])
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(readLocalPracticeSyncQueue()).toEqual([])
})
