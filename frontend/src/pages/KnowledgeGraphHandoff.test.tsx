import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import KnowledgeGraphPage from './KnowledgeGraphPage'
import { agentService } from '@/services/agentService'
import type { AgentProfile, MasteryPath } from '@/types'

let root: Root
let element: HTMLDivElement

const profile: AgentProfile = {
  topics: [{ topic: '二分', mastery: 0.3, attempts: 2, lastSeen: '2026-11-20', weakSubtopics: ['边界'], relatedTopics: [] }],
  edges: [],
  recentProblems: [],
  dailyAttempts: [],
  stats: { totalAttempts: 2, accepted: 1, averageDurationSec: 60, streakDays: 1 },
}

const path: MasteryPath = {
  workspaceId: 'local-default',
  generatedAt: '2026-11-23T00:00:00.000Z',
  steps: [{
    position: 1, topic: '二分', mastery: 0.3, attempts: 2, lastSeen: '2026-11-20', weakSubtopics: ['边界'],
    relatedTopics: [], recommendedAction: 'reinforce', reason: '边界掌握不稳', dueReviews: [],
  }],
  emptyReason: null,
  sourceSummary: { topics: 1, dueReviews: 0 },
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.clear()
  vi.spyOn(agentService, 'getProfile').mockResolvedValue(profile)
  vi.spyOn(agentService, 'getMasteryPath').mockResolvedValue(path)
  element = document.createElement('div')
  document.body.appendChild(element)
  root = createRoot(element)
})

afterEach(() => {
  act(() => root.unmount())
  element.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('queues the mastery path capability when the learner asks the coach to guide the next step', async () => {
  await act(async () => root.render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <KnowledgeGraphPage />
    </MemoryRouter>,
  ))
  await act(async () => {
    await vi.waitFor(() => {
      expect(Array.from(element.querySelectorAll('button')).some(button => button.textContent?.includes('让导师带我走'))).toBe(true)
    })
  })
  const guide = Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('让导师带我走'))!
  act(() => guide.click())
  expect(sessionStorage.getItem('algocoach.capabilityHandoff')).toBe('mastery_path')
})
