import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProgressPage from './ProgressPage'
import { LOCAL_PRACTICE_PROBLEMS } from '@/services/localPractice'
import { readReviewEntries, readReviewEvents, REVIEW_ROUND_LIMIT, saveReviewEntry } from '@/services/reviewQueue'
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
  expect(readReviewEvents()).toHaveLength(1)
  expect(readReviewEvents()[0]).toMatchObject({ problemId: record.id, rating: 3 })
  expect(element.textContent).toContain('复习评分记录 · 1')
  const history = element.querySelector('table')!
  expect(history.textContent).toContain(problem.title)
  expect(history.textContent).toContain('想起来了')
  expect(history.textContent).toContain('3 天')
})

it('shows only the newest 20 rating events while keeping the recorded total', async () => {
  const events = Array.from({ length: 22 }, (_, index) => ({
    problemId: 'record',
    rating: 3 as const,
    reviewedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    dueBefore: '2026-01-01T00:00:00.000Z',
    dueAfter: new Date(Date.UTC(2026, 0, 4, 0, index)).toISOString(),
  }))
  localStorage.setItem('algocoach.localReviewEvents', JSON.stringify(events))
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await renderPage()
  expect(element.textContent).toContain('复习评分记录 · 22 次')
  const rows = element.querySelectorAll('tbody tr')
  expect(rows).toHaveLength(20)
  expect(rows[0].textContent).toContain('想起来了')
  expect(rows[0].textContent).toContain('3 天')
  expect(rows[0].querySelector('time')?.getAttribute('datetime')).toBe(events[21].reviewedAt)
})

it('shows one review round at a time and keeps the rest due until earlier ones are rated', async () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify(Array.from({ length: 25 }, (_, index) => ({ problemId: `note-${index}`, note: `笔记 ${index}`, reviewedAt: '2020-01-01T00:00:00.000Z' }))))
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await renderPage()
  expect(element.textContent).toContain('今日回想 · 25')
  expect(element.textContent?.split('先试着回忆解法')).toHaveLength(REVIEW_ROUND_LIMIT + 1)
  expect(element.textContent).toContain('其余 5 条')
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '显示笔记')!.click())
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '想起来了')!.click())
  expect(element.textContent).toContain('今日回想 · 24')
  expect(element.textContent?.split('先试着回忆解法')).toHaveLength(REVIEW_ROUND_LIMIT + 1)
})

it('pauses a pending note once it is marked mastered and resumes when the mark is cleared', async () => {
  saveReviewEntry(record.id, '能独立写出来', record)
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [record] })
  await renderPage()
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '标记已掌握')!.click())
  expect(readReviewEntries()[0].mastered).toBe(true)
  expect(element.textContent).toContain('已掌握 · ')
  expect(element.textContent).toContain('已暂停每日安排')
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '取消已掌握')!.click())
  expect(readReviewEntries()[0].mastered).toBe(false)
  expect(element.textContent).toContain('下次复习')
})
