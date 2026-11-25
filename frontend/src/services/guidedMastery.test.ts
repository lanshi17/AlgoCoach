import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushGuidedMasteryQueue, GUIDED_MASTERY_STATUS, queueGuidedMastery, readGuidedMasteryQueue } from './guidedMastery'

const key = 'algocoach.guidedMasteryQueue'
const input = { topic: '二分查找', stageId: 'stage-1', conversationId: 'conversation-1', lang: 'unknown', durationSec: 75 }

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('guided mastery sync', () => {
  it('queues one event per conversation and stage', () => {
    queueGuidedMastery(input)
    queueGuidedMastery(input)
    expect(readGuidedMasteryQueue()).toHaveLength(1)
    expect(readGuidedMasteryQueue()[0]).toMatchObject({ topic: '二分查找', stageId: 'stage-1', durationSec: 75 })
    queueGuidedMastery({ ...input, conversationId: 'conversation-2' })
    expect(readGuidedMasteryQueue()).toHaveLength(2)
  })

  it('posts the guided status and clears the queue on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    queueGuidedMastery(input)
    expect(await flushGuidedMasteryQueue()).toBe('synced')
    expect(readGuidedMasteryQueue()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/agent/memory/record')
    expect(JSON.parse(options.body)).toMatchObject({
      problem_id: 'guided:二分查找',
      platform: 'GUIDED',
      status: GUIDED_MASTERY_STATUS,
      lang: 'unknown',
      duration_sec: 75,
      topics: ['二分查找'],
      workspaceId: 'local-default',
    })
    expect(JSON.parse(options.body).client_id).toMatch(/^guided:[a-z0-9]+$/)
  })

  it('keeps failed events for the next flush and drops them after a retry', async () => {
    queueGuidedMastery(input)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    expect(await flushGuidedMasteryQueue()).toBe('queued')
    expect(readGuidedMasteryQueue()).toHaveLength(1)
    expect(await flushGuidedMasteryQueue()).toBe('synced')
    expect(readGuidedMasteryQueue()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps malformed queue entries out without dropping the valid ones', () => {
    localStorage.setItem(key, JSON.stringify([
      { clientId: 'ok', topic: '数组', stageId: 's1', lang: 'unknown', durationSec: 10, createdAt: '2026-01-01T00:00:00.000Z' },
      { clientId: 'bad', topic: '数组', stageId: 's2', durationSec: -1 },
    ]))
    expect(readGuidedMasteryQueue().map(event => event.clientId)).toEqual(['ok'])
  })
})
