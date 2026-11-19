import { nanoid } from 'nanoid'

const LOCAL_PROGRESS_KEY = 'algocoach.localPracticeRecords'

export type LocalPracticeOutcome = 'SAMPLE_PASSED' | 'SAMPLE_FAILED' | 'UNASSESSED'

export interface LocalPracticeRecord {
  id: string
  problemId: string
  title: string
  topics: string[]
  durationSec: number
  codeLength: number
  endedAt: string
  outcome?: LocalPracticeOutcome
}

export function readLocalPracticeRecords(): LocalPracticeRecord[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LOCAL_PROGRESS_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(isLocalPracticeRecord).slice(-80)
  } catch {
    return []
  }
}

export function appendLocalPracticeRecord(record: Omit<LocalPracticeRecord, 'id'>): LocalPracticeRecord[] {
  const next = [...readLocalPracticeRecords(), { ...record, id: nanoid(10) }].slice(-80)
  try { window.localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(next)) } catch { /* local storage is optional */ }
  return next
}

function isLocalPracticeRecord(value: unknown): value is LocalPracticeRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<LocalPracticeRecord>
  return typeof item.id === 'string' && typeof item.problemId === 'string'
    && typeof item.title === 'string' && Array.isArray(item.topics)
    && item.topics.every(topic => typeof topic === 'string')
    && Number.isFinite(item.durationSec) && Number.isFinite(item.codeLength)
    && typeof item.endedAt === 'string'
    && (item.outcome === undefined || item.outcome === 'SAMPLE_PASSED' || item.outcome === 'SAMPLE_FAILED' || item.outcome === 'UNASSESSED')
}

const LOCAL_SYNC_QUEUE_KEY = 'algocoach.localPracticeSyncQueue'
type SyncQueueItem = LocalPracticeRecord | string

function readRawSyncQueue(): SyncQueueItem[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LOCAL_SYNC_QUEUE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(item => typeof item === 'string' || isLocalPracticeRecord(item))
  } catch { return [] }
}

export function readLocalPracticeSyncQueue(): string[] {
  return readRawSyncQueue().map(item => typeof item === 'string' ? item : item.id)
}

export function queueLocalPracticeRecord(record: LocalPracticeRecord): void {
  const queue = readRawSyncQueue().filter(item => (typeof item === 'string' ? item : item.id) !== record.id)
  queue.push(record)
  try { window.localStorage.setItem(LOCAL_SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-80))) } catch { /* optional local queue */ }
}

export async function flushLocalPracticeRecords(records: LocalPracticeRecord[]): Promise<void> {
  const byId = new Map(records.map(record => [record.id, record]))
  const queue = readRawSyncQueue()
  const remaining: SyncQueueItem[] = []
  for (const item of queue) {
    const record = typeof item === 'string' ? byId.get(item) : item
    if (!record) { remaining.push(item); continue }
    try {
      const response = await window.fetch('/api/agent/memory/record', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: record.problemId.split(':').slice(1).join(':') || record.problemId, platform: 'LOCAL', status: record.outcome === 'SAMPLE_PASSED' ? 'LOCAL_ACCEPTED' : record.outcome === 'SAMPLE_FAILED' ? 'LOCAL_FAILED' : 'LOCAL_PRACTICE', lang: record.outcome === 'SAMPLE_PASSED' || record.outcome === 'SAMPLE_FAILED' ? 'python3' : 'unknown', duration_sec: record.durationSec, topics: record.topics, client_id: record.id }),
      })
      if (!response.ok) throw new Error(`Agent sync failed: ${response.status}`)
    } catch { remaining.push(record) }
  }
  try { window.localStorage.setItem(LOCAL_SYNC_QUEUE_KEY, JSON.stringify(remaining)) } catch { /* optional local queue */ }
}

export function localPracticeOutcomeLabel(record: LocalPracticeRecord): string {
  if (record.outcome === 'SAMPLE_PASSED') return '样例通过'
  if (record.outcome === 'SAMPLE_FAILED') return '样例未通过'
  return '未运行样例'
}
