import { nanoid } from 'nanoid'

const LOCAL_PROGRESS_KEY = 'algocoach.localPracticeRecords'

export interface LocalPracticeRecord {
  id: string
  problemId: string
  title: string
  topics: string[]
  durationSec: number
  codeLength: number
  endedAt: string
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
}
