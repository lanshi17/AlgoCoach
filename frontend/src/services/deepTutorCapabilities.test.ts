import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspace, getWorkspaceId, LOCAL_WORKSPACE_ID, queueCapabilityHandoff, readWorkspaceManifests, switchWorkspace, takeTurnCapability, workspaceStorageKey } from './deepTutorCapabilities'

afterEach(() => localStorage.clear())

describe('workspace identity', () => {
  it('keeps the default workspace compatible with existing local keys', () => {
    expect(getWorkspaceId()).toBe(LOCAL_WORKSPACE_ID)
    expect(workspaceStorageKey('algocoach.localPracticeRecords')).toBe('algocoach.localPracticeRecords')
  })

  it('isolates an explicitly selected workspace with a safe suffix', () => {
    localStorage.setItem('algocoach.workspaceId', 'team-a')
    expect(getWorkspaceId()).toBe('team-a')
    expect(workspaceStorageKey('algocoach.localPracticeRecords')).toBe('algocoach.localPracticeRecords.team-a')
  })

  it('falls back when a workspace id is malformed', () => {
    localStorage.setItem('algocoach.workspaceId', '../secrets')
    expect(getWorkspaceId()).toBe(LOCAL_WORKSPACE_ID)
  })

  it('creates and switches a named local workspace', () => {
    const manifests = createWorkspace('竞赛训练')
    expect(manifests.some(item => item.name === '竞赛训练')).toBe(true)
    const created = manifests.find(item => item.name === '竞赛训练')!
    switchWorkspace(created.id)
    expect(getWorkspaceId()).toBe(created.id)
    expect(readWorkspaceManifests()).toContainEqual(created)
  })
})

describe('turn capability handoff', () => {
  beforeEach(() => sessionStorage.clear())

  it('applies a queued capability once, to the next chat turn', () => {
    queueCapabilityHandoff('mastery_path')
    expect(takeTurnCapability('PREP')).toBe('mastery_path')
    expect(takeTurnCapability('PREP')).toBe('chat')
  })

  it('keeps FOCUS and REVIEW on their own capability and leaves the handoff queued', () => {
    queueCapabilityHandoff('mastery_path')
    expect(takeTurnCapability('REVIEW')).toBe('review')
    expect(takeTurnCapability('FOCUS')).toBe('practice')
    expect(takeTurnCapability('IDLE')).toBe('mastery_path')
  })

  it('ignores a stored value that is not a registered capability', () => {
    sessionStorage.setItem('algocoach.capabilityHandoff', 'not_a_capability')
    expect(takeTurnCapability('PREP')).toBe('chat')
  })
})
