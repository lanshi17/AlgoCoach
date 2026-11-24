/** DeepTutor-inspired capability names used as request context. */
export type DeepTutorCapability = 'chat' | 'deep_solve' | 'practice' | 'mastery_path' | 'review'

/** Local workspace identities used by the desktop MVP; no account is required. */
export const LOCAL_WORKSPACE_ID = 'local-default'
const WORKSPACE_ID_KEY = 'algocoach.workspaceId'
const WORKSPACES_KEY = 'algocoach.workspaces'

export interface WorkspaceManifest {
  id: string
  name: string
  createdAt: string
}

/** Read the local workspace identity without requiring a server account. */
export function getWorkspaceId(): string {
  try {
    const value = window.localStorage.getItem(WORKSPACE_ID_KEY)?.trim()
    return value && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value) ? value : LOCAL_WORKSPACE_ID
  } catch {
    return LOCAL_WORKSPACE_ID
  }
}

/**
 * Keep the original keys for the default workspace so existing local data is
 * readable. Additional workspaces get an isolated suffix.
 */
export function workspaceStorageKey(baseKey: string, workspaceId = getWorkspaceId()): string {
  return workspaceId === LOCAL_WORKSPACE_ID ? baseKey : `${baseKey}.${encodeURIComponent(workspaceId)}`
}

export function readWorkspaceManifests(): WorkspaceManifest[] {
  const fallback: WorkspaceManifest = { id: LOCAL_WORKSPACE_ID, name: '本机学习空间', createdAt: new Date(0).toISOString() }
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(WORKSPACES_KEY) ?? '[]')
    const manifests = Array.isArray(value) ? value.filter(isWorkspaceManifest) : []
    return manifests.some(item => item.id === LOCAL_WORKSPACE_ID) ? manifests : [fallback, ...manifests]
  } catch {
    return [fallback]
  }
}

export function createWorkspace(name: string): WorkspaceManifest[] {
  const cleanName = name.trim().slice(0, 80)
  if (!cleanName) throw new Error('workspace 名称不能为空')
  const existing = readWorkspaceManifests()
  const baseId = slugifyWorkspace(cleanName)
  let id = baseId
  let suffix = 2
  while (existing.some(item => item.id === id)) id = `${baseId}-${suffix++}`
  const next = [...existing, { id, name: cleanName, createdAt: new Date().toISOString() }]
  try { window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify(next)) } catch { /* optional local metadata */ }
  return next
}

export function switchWorkspace(workspaceId: string): void {
  if (!readWorkspaceManifests().some(item => item.id === workspaceId)) throw new Error('找不到该 workspace')
  try { window.localStorage.setItem(WORKSPACE_ID_KEY, workspaceId) } catch { /* keep current workspace */ }
}

function isWorkspaceManifest(value: unknown): value is WorkspaceManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<WorkspaceManifest>
  return typeof item.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(item.id)
    && typeof item.name === 'string' && item.name.trim().length > 0
    && typeof item.createdAt === 'string'
}

function slugifyWorkspace(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  return slug || `workspace-${Date.now()}`
}

export function capabilityForMode(mode: string): DeepTutorCapability {
  if (mode === 'FOCUS') return 'practice'
  if (mode === 'REVIEW') return 'review'
  return 'chat'
}

const CAPABILITY_HANDOFF_KEY = 'algocoach.capabilityHandoff'
const CAPABILITIES: readonly DeepTutorCapability[] = ['chat', 'deep_solve', 'practice', 'mastery_path', 'review']

/** Asks the next PREP or IDLE turn to run under `capability`, e.g. from the knowledge graph's guide entry. */
export function queueCapabilityHandoff(capability: DeepTutorCapability): void {
  try { window.sessionStorage.setItem(CAPABILITY_HANDOFF_KEY, capability) } catch { /* keep the mode's default capability */ }
}

/** Picks the capability for one chat turn. FOCUS and REVIEW keep their own; a queued handoff is consumed once. */
export function takeTurnCapability(mode: string): DeepTutorCapability {
  if (mode === 'FOCUS' || mode === 'REVIEW') return capabilityForMode(mode)
  let queued: string | null = null
  try {
    queued = window.sessionStorage.getItem(CAPABILITY_HANDOFF_KEY)
    window.sessionStorage.removeItem(CAPABILITY_HANDOFF_KEY)
  } catch { /* storage is optional; fall back to the mode's capability */ }
  return isCapability(queued) ? queued : capabilityForMode(mode)
}

function isCapability(value: string | null): value is DeepTutorCapability {
  return CAPABILITIES.some(capability => capability === value)
}
