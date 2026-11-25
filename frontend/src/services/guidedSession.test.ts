import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearGuidedSession, GUIDED_SESSION_VERSION, readGuidedSession, saveGuidedSession, type GuidedSessionSnapshot } from './guidedSession'

const key = 'algocoach.guidedLearning'
const snapshot: GuidedSessionSnapshot = {
  topic: '二分查找',
  stage: 1,
  messages: [{ id: 'm1', role: 'agent', content: '进入选择题', timestamp: '2026-01-01T00:00:00.000Z' }],
  passed: false,
  questionId: 'm1',
  conversationId: 'conversation-1',
  choiceQuestions: { m1: { correct: 'A', attempts: ['B'] } },
  stages: [{ id: 'concept', name: '学习知识点', type: 'concept', instruction: '讲解概念。' }],
  planSource: 'ai',
  code: 'print(1)',
  codeLang: 'python3',
}

afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks() })

describe('guided session storage', () => {
  it('round-trips a snapshot through the versioned localStorage envelope', () => {
    saveGuidedSession(snapshot)
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ version: GUIDED_SESSION_VERSION, session: snapshot })
    expect(readGuidedSession()).toEqual(snapshot)
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  it('migrates a legacy sessionStorage lesson into localStorage on first read', () => {
    sessionStorage.setItem(key, JSON.stringify(snapshot))
    expect(readGuidedSession()).toEqual(snapshot)
    expect(sessionStorage.getItem(key)).toBeNull()
    expect(JSON.parse(localStorage.getItem(key)!).version).toBe(GUIDED_SESSION_VERSION)
    expect(JSON.parse(localStorage.getItem(key)!).session.topic).toBe('二分查找')
  })

  it('keeps the legacy tab copy when localStorage refuses the migration', () => {
    sessionStorage.setItem(key, JSON.stringify(snapshot))
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((storageKey: string, value: string) => {
      if (storageKey === key) throw new Error('quota exceeded')
      setItem.call(localStorage, storageKey, value)
    })
    expect(readGuidedSession()).toEqual(snapshot)
    expect(sessionStorage.getItem(key)).not.toBeNull()
  })

  it('rejects malformed payloads and unknown future versions', () => {
    localStorage.setItem(key, '{broken')
    expect(readGuidedSession()).toBeNull()
    localStorage.setItem(key, JSON.stringify({ version: GUIDED_SESSION_VERSION + 1, session: snapshot }))
    expect(readGuidedSession()).toBeNull()
    localStorage.setItem(key, JSON.stringify({ topic: '缺少阶段和消息' }))
    expect(readGuidedSession()).toBeNull()
    localStorage.setItem(key, JSON.stringify({ version: GUIDED_SESSION_VERSION, session: { topic: 'x', stage: 0 } }))
    expect(readGuidedSession()).toBeNull()
  })

  it('clears both the durable and legacy copies', () => {
    saveGuidedSession(snapshot)
    sessionStorage.setItem(key, JSON.stringify(snapshot))
    clearGuidedSession()
    expect(localStorage.getItem(key)).toBeNull()
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  it('keeps each workspace on its own session', () => {
    localStorage.setItem('algocoach.workspaceId', 'contest')
    saveGuidedSession({ ...snapshot, topic: '图论' })
    localStorage.setItem('algocoach.workspaceId', 'local-default')
    expect(readGuidedSession()).toBeNull()
    localStorage.setItem('algocoach.workspaceId', 'contest')
    expect(readGuidedSession()?.topic).toBe('图论')
  })
})
