import type { ChatMessage, CodeLanguage } from '@/types'
import { workspaceStorageKey } from './deepTutorCapabilities'

/** One choice question the page generated for a stage; kept so a reload can score a retry. */
export interface GuidedChoiceQuestion {
  correct: string
  attempts: string[]
}

/** Everything needed to continue a guided lesson after the tab or browser closes. */
export interface GuidedSessionSnapshot {
  topic: string
  stage: number
  messages: ChatMessage[]
  passed?: boolean
  questionId?: string | null
  conversationId?: string
  choiceQuestions?: Record<string, GuidedChoiceQuestion>
  /** Outline candidates; the page re-validates them with `sanitizeGuidedStages`. */
  stages?: unknown
  planSource?: 'ai' | 'edited' | 'default'
  code?: string
  codeLang?: CodeLanguage
}

export const GUIDED_SESSION_VERSION = 1

const GUIDED_SESSION_KEY = 'algocoach.guidedLearning'

/**
 * Reads the lesson snapshot for the current workspace. The pre-persistence
 * version wrote the same payload to sessionStorage; it is migrated to
 * localStorage on first read so a tab close no longer loses the outline.
 */
export function readGuidedSession(): GuidedSessionSnapshot | null {
  const key = workspaceStorageKey(GUIDED_SESSION_KEY)
  const stored = readJson(localStorage, key)
  if (stored !== null) {
    const session = unwrapEnvelope(stored)
    return isSnapshot(session) ? session : null
  }
  const legacy = unwrapEnvelope(readJson(sessionStorage, key))
  if (!isSnapshot(legacy)) return null
  try {
    localStorage.setItem(key, JSON.stringify({ version: GUIDED_SESSION_VERSION, session: legacy }))
    sessionStorage.removeItem(key)
  } catch {
    // Quota or a disabled store: keep using the legacy tab copy.
  }
  return legacy
}

/** Throws when the browser refuses the write; the page keeps the in-memory lesson. */
export function saveGuidedSession(snapshot: GuidedSessionSnapshot): void {
  const key = workspaceStorageKey(GUIDED_SESSION_KEY)
  localStorage.setItem(key, JSON.stringify({ version: GUIDED_SESSION_VERSION, session: snapshot }))
  try { sessionStorage.removeItem(key) } catch { /* no legacy copy to clear */ }
}

export function clearGuidedSession(): void {
  const key = workspaceStorageKey(GUIDED_SESSION_KEY)
  try { localStorage.removeItem(key) } catch { /* keep the page usable */ }
  try { sessionStorage.removeItem(key) } catch { /* keep the page usable */ }
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

/** Accepts the versioned envelope and the direct legacy payload. */
function unwrapEnvelope(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const envelope = value as { version?: unknown; session?: unknown }
  if (envelope.version === undefined) return value
  return envelope.version === GUIDED_SESSION_VERSION ? envelope.session : null
}

function isSnapshot(value: unknown): value is GuidedSessionSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const session = value as Partial<GuidedSessionSnapshot>
  return typeof session.topic === 'string' && Array.isArray(session.messages) && Number.isInteger(session.stage)
}
