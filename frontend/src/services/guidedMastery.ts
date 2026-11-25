import { getWorkspaceId, workspaceStorageKey } from './deepTutorCapabilities'

/**
 * Guided stage passes are coach-reviewed evidence, not judge results. They are
 * recorded with their own status so the Agent can move mastery less than a
 * local-run acceptance and the self-improvement replay can reproduce the step.
 */
export const GUIDED_MASTERY_STATUS = 'GUIDED_ACCEPTED'

const QUEUE_KEY = workspaceStorageKey('algocoach.guidedMasteryQueue')
const ENDPOINT = '/api/agent/memory/record'
const REQUEST_TIMEOUT_MS = 5000

export interface GuidedMasteryEvent {
  clientId: string
  topic: string
  stageId: string
  lang: string
  durationSec: number
  createdAt: string
}

export type GuidedMasterySyncResult = 'synced' | 'queued'

export interface QueueGuidedMasteryInput {
  topic: string
  stageId: string
  conversationId: string
  lang: string
  durationSec: number
}

export function readGuidedMasteryQueue(): GuidedMasteryEvent[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(isGuidedMasteryEvent)
  } catch {
    return []
  }
}

/** Queues one pass per conversation+stage; the server dedupes by client_id too. */
export function queueGuidedMastery(input: QueueGuidedMasteryInput): GuidedMasteryEvent[] {
  const queue = readGuidedMasteryQueue()
  const clientId = clientIdFor(input)
  if (queue.some(event => event.clientId === clientId)) return queue
  const next = [...queue, {
    clientId,
    topic: input.topic,
    stageId: input.stageId,
    lang: input.lang,
    durationSec: Math.max(0, Math.round(input.durationSec)),
    createdAt: new Date().toISOString(),
  }]
  persist(next)
  return next
}

let flushTail: Promise<void> = Promise.resolve()

/** Serialized flush; a concurrent caller waits for the current pass. */
export function flushGuidedMasteryQueue(): Promise<GuidedMasterySyncResult> {
  const run = flushTail.then(flushOnce)
  flushTail = run.then(() => undefined, () => undefined)
  return run
}

async function flushOnce(): Promise<GuidedMasterySyncResult> {
  const queue = readGuidedMasteryQueue()
  if (!queue.length) return 'synced'
  const remaining: GuidedMasteryEvent[] = []
  for (const event of queue) {
    if (!await postEvent(event)) remaining.push(event)
  }
  persist(remaining)
  return remaining.length ? 'queued' : 'synced'
}

async function postEvent(event: GuidedMasteryEvent): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await window.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        problem_id: `guided:${event.topic}`,
        platform: 'GUIDED',
        status: GUIDED_MASTERY_STATUS,
        lang: event.lang,
        duration_sec: event.durationSec,
        topics: [event.topic],
        client_id: event.clientId,
        workspaceId: getWorkspaceId(),
      }),
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function persist(events: GuidedMasteryEvent[]) {
  try { window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events)) } catch { /* local storage is optional */ }
}

function clientIdFor(input: QueueGuidedMasteryInput): string {
  return `guided:${stableHash(`${getWorkspaceId()}:${input.conversationId}:${input.stageId}`)}`
}

/** Short, deterministic key that fits the Agent's 128-character client_id limit. */
function stableHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function isGuidedMasteryEvent(value: unknown): value is GuidedMasteryEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as Partial<GuidedMasteryEvent>
  return typeof event.clientId === 'string' && typeof event.topic === 'string'
    && typeof event.stageId === 'string' && typeof event.lang === 'string'
    && typeof event.createdAt === 'string' && typeof event.durationSec === 'number'
    && Number.isFinite(event.durationSec) && event.durationSec >= 0
}
