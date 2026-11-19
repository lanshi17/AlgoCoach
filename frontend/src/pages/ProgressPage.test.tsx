import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProgressPage from './ProgressPage'
import { LOCAL_PRACTICE_PROBLEMS } from '@/services/localPractice'
import { saveReviewEntry } from '@/services/reviewQueue'
import { agentService } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'

let root: Root
let element: HTMLDivElement
const initialState = useAppStore.getState()
const problem = LOCAL_PRACTICE_PROBLEMS[0]
const key = `${problem.platform}:${problem.platformId}`
const record = { id: 'record', problemId: key, title: problem.title, topics: problem.topics, durationSec: 10, codeLength: 12, endedAt: '2026-01-01' }
function Destination() { return <span>{JSON.stringify(useLocation().state)}</span> }

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useAppStore.setState(initialState, true)
  vi.spyOn(agentService, 'getProfile').mockRejectedValue(new Error('offline'))
  element = document.createElement('div')
  document.body.appendChild(element)
  root = createRoot(element)
})
afterEach(() => {
  act(() => root.unmount())
  element.remove()
  useAppStore.setState(initialState, true)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function renderPage() {
  await act(async () => root.render(<MemoryRouter initialEntries={['/progress']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/progress" element={<ProgressPage />} /><Route path="/workspace" element={<Destination />} /></Routes></MemoryRouter>))
}
function discussionButton() { return Array.from(element.querySelectorAll('button')).find(button => button.textContent === '带笔记问 Agent')! }

it('keeps a saved review usable after the practice record is evicted and preserves an existing chat draft', async () => {
  saveReviewEntry(record.id, '复杂度为 O(n)', record)
  const saved = JSON.parse(localStorage.getItem('algocoach.localReviewEntries')!)
  saved[0].schedule.due = '2020-01-02T00:00:00.000Z'
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify(saved))
  useAppStore.setState({ activeProblem: LOCAL_PRACTICE_PROBLEMS[1], mode: 'PREP', localPracticeRecords: [], chatDrafts: { [key]: '已有草稿' } })
  await renderPage()
  expect(element.textContent).not.toContain('复杂度为 O(n)')
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '显示笔记')!.click())
  expect(element.textContent).toContain('复杂度为 O(n)')
  act(() => discussionButton().click())
  expect(useAppStore.getState().activeProblem?.platformId).toBe(problem.platformId)
  expect(useAppStore.getState().chatDrafts[key]).toContain('已有草稿')
  expect(useAppStore.getState().chatDrafts[key]).toContain('复杂度为 O(n)')
  expect(element.textContent).toContain('chat')
})

it('shows legacy notes offline and prevents changing problems while focusing', async () => {
  saveReviewEntry(record.id, '旧笔记')
  useAppStore.setState({ activeProblem: LOCAL_PRACTICE_PROBLEMS[1], mode: 'FOCUS', localPracticeRecords: [record] })
  await renderPage()
  expect(element.textContent).toContain('旧笔记')
  expect(element.textContent).toContain('之后再复习')
  expect(element.textContent).toContain('旧笔记')
})

it('retains orphaned legacy notes without associating them with the wrong problem', async () => {
  saveReviewEntry('old-record', '孤立笔记')
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await renderPage()
  expect(element.textContent).toContain('孤立笔记')
  expect(element.textContent).toContain('之后再复习')
})

it('shows due reviews without exposing their notes, then schedules after self-rating', async () => {
  saveReviewEntry(record.id, '检查数组边界', record)
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ ...JSON.parse(localStorage.getItem('algocoach.localReviewEntries')!)[0], schedule: { difficulty: 5, stability: 0, reps: 0, lapses: 0, lastReview: null, due: '2020-01-02T00:00:00.000Z', state: 'new' } }]))
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [record] })
  await renderPage()
  expect(element.textContent).toContain('今日回想 · 1')
  expect(element.textContent).not.toContain('检查数组边界')
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '显示笔记')!.click())
  expect(element.textContent).toContain('检查数组边界')
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '想起来了')!.click())
  expect(element.textContent).toContain('之后再复习 · 1')
  const entry = JSON.parse(localStorage.getItem('algocoach.localReviewEntries')!)[0]
  expect(entry.schedule.reps).toBe(1)
  expect(Date.parse(entry.schedule.due)).toBeGreaterThan(Date.now())
})
