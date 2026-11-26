import type { MasteryImportResult } from '@/types'
import { agentService } from './agentService'
import { getWorkspaceId } from './deepTutorCapabilities'
import { parseMasteryBundle } from './masterySync'

export interface AutoSyncSettings {
  enabled: boolean
  hubUrl: string
  token: string
}

export interface AutoSyncResult {
  status: 'disabled' | 'synced'
  at?: string
  counts?: MasteryImportResult
}

const SETTINGS_KEY = 'algocoach.autoSync'
const LAST_SYNC_KEY = 'algocoach.autoSyncLast'
const REQUEST_TIMEOUT_MS = 12000

export function readAutoSyncSettings(): AutoSyncSettings {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { enabled: false, hubUrl: '', token: '' }
    const settings = value as Partial<AutoSyncSettings>
    return {
      enabled: settings.enabled === true,
      hubUrl: typeof settings.hubUrl === 'string' ? settings.hubUrl : '',
      token: typeof settings.token === 'string' ? settings.token : '',
    }
  } catch {
    return { enabled: false, hubUrl: '', token: '' }
  }
}

export function normalizeHubUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return /^https?:\/\/[^/\s]+/i.test(trimmed) ? trimmed : ''
}

export function saveAutoSyncSettings(settings: AutoSyncSettings): AutoSyncSettings {
  const next = {
    enabled: settings.enabled === true,
    hubUrl: normalizeHubUrl(settings.hubUrl),
    token: settings.token.trim(),
  }
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* local storage is optional */ }
  return next
}

export function readLastAutoSync(): string | null {
  try { return window.localStorage.getItem(LAST_SYNC_KEY) } catch { return null }
}

let inFlight: Promise<AutoSyncResult> | null = null

/** Push the local bundle to the hub, then import the merged hub bundle. */
export function runAutoSync(): Promise<AutoSyncResult> {
  if (inFlight) return inFlight
  inFlight = syncOnce().finally(() => { inFlight = null })
  return inFlight
}

async function syncOnce(): Promise<AutoSyncResult> {
  const settings = readAutoSyncSettings()
  if (!settings.enabled || !settings.hubUrl || !settings.token) return { status: 'disabled' }

  const local = await agentService.exportMastery()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const workspace = encodeURIComponent(getWorkspaceId())
    const response = await window.fetch(`${settings.hubUrl}/api/agent/memory/sync?workspaceId=${workspace}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AlgoCoach-Sync-Token': settings.token,
      },
      body: JSON.stringify(local),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`同步服务返回 ${response.status}`)
    const payload = await response.json() as { bundle?: unknown }
    if (!payload.bundle) throw new Error('同步服务没有返回合并数据。')
    const bundle = parseMasteryBundle(JSON.stringify(payload.bundle))
    const counts = await agentService.importMastery(bundle)
    const at = new Date().toISOString()
    try { window.localStorage.setItem(LAST_SYNC_KEY, at) } catch { /* local storage is optional */ }
    const result: AutoSyncResult = { status: 'synced', at, counts }
    window.dispatchEvent(new CustomEvent('algocoach:auto-sync', { detail: result }))
    return result
  } finally {
    clearTimeout(timer)
  }
}
