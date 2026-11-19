import { afterEach, describe, expect, it } from 'vitest'
import { getWorkspaceId, LOCAL_WORKSPACE_ID, workspaceStorageKey } from './deepTutorCapabilities'

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
})
