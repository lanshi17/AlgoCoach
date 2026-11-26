import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MasteryBundle, MasteryImportResult } from '@/types'
import { agentService } from './agentService'
import { normalizeHubUrl, readAutoSyncSettings, readLastAutoSync, runAutoSync, saveAutoSyncSettings } from './autoSync'

const localBundle: MasteryBundle = {
  format: 'algocoach-mastery-v2', exportedAt: '2026-01-01T00:00:00', workspaceId: 'local-default',
  topics: [{ topic: '二分查找', mastery: 0.5, attempts: 1, lastSeen: '' }],
  reviewSchedules: [],
}
const hubBundle: MasteryBundle = {
  ...localBundle,
  topics: [{ topic: '二分查找', mastery: 0.6, attempts: 2, lastSeen: '2026-02-01T00:00:00' }],
}
const counts: MasteryImportResult = {
  ok: true, workspaceId: 'local-default', imported: 0, updated: 1, unchanged: 0,
  schedulesImported: 0, schedulesUpdated: 0, schedulesUnchanged: 0,
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('automatic device sync', () => {
  it('normalizes a hub URL and rejects non-http values', () => {
    expect(normalizeHubUrl(' http://192.168.1.10:8080/ ')).toBe('http://192.168.1.10:8080')
    expect(normalizeHubUrl('https://sync.example.com///')).toBe('https://sync.example.com')
    expect(normalizeHubUrl('192.168.1.10:8080')).toBe('')
    expect(normalizeHubUrl('ftp://example.com')).toBe('')
  })

  it('stays disabled until enabled with a hub and token', async () => {
    expect(await runAutoSync()).toEqual({ status: 'disabled' })
    saveAutoSyncSettings({ enabled: true, hubUrl: '', token: '' })
    expect(await runAutoSync()).toEqual({ status: 'disabled' })
    expect(readAutoSyncSettings()).toMatchObject({ enabled: true, hubUrl: '', token: '' })
  })

  it('posts the local bundle and imports the merged hub bundle', async () => {
    const exportMastery = vi.spyOn(agentService, 'exportMastery').mockResolvedValue(localBundle)
    const importMastery = vi.spyOn(agentService, 'importMastery').mockResolvedValue(counts)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ bundle: hubBundle }),
    })
    vi.stubGlobal('fetch', fetchMock)
    saveAutoSyncSettings({ enabled: true, hubUrl: 'http://192.168.1.10:8080/', token: 'secret' })

    const result = await runAutoSync()

    expect(exportMastery).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://192.168.1.10:8080/api/agent/memory/sync?workspaceId=local-default')
    expect(options.headers['X-AlgoCoach-Sync-Token']).toBe('secret')
    expect(JSON.parse(options.body)).toEqual(localBundle)
    expect(importMastery).toHaveBeenCalledWith(expect.objectContaining({ format: 'algocoach-mastery-v2' }))
    expect(result.status).toBe('synced')
    expect(result.counts).toEqual(counts)
    expect(readLastAutoSync()).toBe(result.at)
  })

  it('leaves the last-sync timestamp alone when the hub rejects the request', async () => {
    vi.spyOn(agentService, 'exportMastery').mockResolvedValue(localBundle)
    const importMastery = vi.spyOn(agentService, 'importMastery')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    saveAutoSyncSettings({ enabled: true, hubUrl: 'http://hub', token: 'secret' })

    await expect(runAutoSync()).rejects.toThrow('503')
    expect(importMastery).not.toHaveBeenCalled()
    expect(readLastAutoSync()).toBeNull()
  })
})
