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
  status: 'disabled' | 'synced' | 'failed'
  at?: string
  counts?: MasteryImportResult
  message?: string
}

export interface AutoSyncFailure {
  at: string
  message: string
}

const SETTINGS_KEY = 'algocoach.autoSync'
const LAST_SYNC_KEY = 'algocoach.autoSyncLast'
const LAST_FAILURE_KEY = 'algocoach.autoSyncFailure'
const REQUEST_TIMEOUT_MS = 12000
const MAX_FAILURE_MESSAGE = 200

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

export function readLastAutoSyncFailure(): AutoSyncFailure | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LAST_FAILURE_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const failure = value as Partial<AutoSyncFailure>
    if (typeof failure.at !== 'string' || !Number.isFinite(Date.parse(failure.at))) return null
    if (typeof failure.message !== 'string' || !failure.message.trim()) return null
    return { at: failure.at, message: failure.message.slice(0, MAX_FAILURE_MESSAGE) }
  } catch {
    return null
  }
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

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const local = await agentService.exportMastery()
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
    try {
      window.localStorage.setItem(LAST_SYNC_KEY, at)
      window.localStorage.removeItem(LAST_FAILURE_KEY)
    } catch { /* local storage is optional */ }
    const result: AutoSyncResult = { status: 'synced', at, counts }
    window.dispatchEvent(new CustomEvent('algocoach:auto-sync', { detail: result }))
    return result
  } catch (cause) {
    const failure: AutoSyncFailure = {
      at: new Date().toISOString(),
      message: describeAutoSyncError(cause),
    }
    try { window.localStorage.setItem(LAST_FAILURE_KEY, JSON.stringify(failure)) } catch { /* local storage is optional */ }
    const result: AutoSyncResult = { status: 'failed', ...failure }
    window.dispatchEvent(new CustomEvent('algocoach:auto-sync', { detail: result }))
    throw cause
  } finally {
    clearTimeout(timer)
  }
}

function describeAutoSyncError(cause: unknown): string {
  if (isAbortError(cause)) return '同步请求超时。'
  if (cause instanceof TypeError) return '无法连接同步服务，请检查地址、网络和 CORS。'
  const message = cause instanceof Error ? cause.message.trim() : ''
  if (message === 'Network Error') return '无法连接本地 Agent，请确认服务正在运行。'
  const localStatus = /^Request failed with status code (\d{3})$/.exec(message)
  if (localStatus) return `本地 Agent 请求失败（${localStatus[1]}），请确认服务正在运行。`
  return (message || '自动同步失败。').slice(0, MAX_FAILURE_MESSAGE)
}

function isAbortError(cause: unknown): boolean {
  return typeof cause === 'object'
    && cause !== null
    && 'name' in cause
    && cause.name === 'AbortError'
}
