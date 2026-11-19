/** DeepTutor-inspired capability names used as request context. */
export type DeepTutorCapability = 'chat' | 'deep_solve' | 'practice' | 'mastery_path' | 'review'

/** The current desktop MVP has one local workspace. */
export const LOCAL_WORKSPACE_ID = 'local-default'
const WORKSPACE_ID_KEY = 'algocoach.workspaceId'

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

export function capabilityForMode(mode: string): DeepTutorCapability {
  if (mode === 'FOCUS') return 'practice'
  if (mode === 'REVIEW') return 'review'
  return 'chat'
}
