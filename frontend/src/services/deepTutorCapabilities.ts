/** DeepTutor-inspired capability names used as request context. */
export type DeepTutorCapability = 'chat' | 'deep_solve' | 'practice' | 'mastery_path' | 'review'

/** The current desktop MVP has one local workspace. */
export const LOCAL_WORKSPACE_ID = 'local-default'

export function capabilityForMode(mode: string): DeepTutorCapability {
  if (mode === 'FOCUS') return 'practice'
  if (mode === 'REVIEW') return 'review'
  return 'chat'
}
