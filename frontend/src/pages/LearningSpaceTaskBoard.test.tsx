import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LearningSpacePage from './LearningSpacePage'
import { agentService } from '@/services/agentService'
import { createLearningTask, readLearningTasks } from '@/services/learningTasks'
import { readReviewEntries, saveReviewEntry } from '@/services/reviewQueue'
import { useAppStore } from '@/stores/useAppStore'

let root: Root
let element: HTMLDivElement
const initialState = useAppStore.getState()

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

function button(label: string) {
  return Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
}

it('moves a task across the board, archives it once done and restores it from the archive', async () => {
  createLearningTask({ title: '复盘二分边界', kind: 'review', dueDate: '2026-11-23' })
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await act(async () => root.render(<MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LearningSpacePage />} /></Routes></MemoryRouter>))
  expect(element.textContent).toContain('任务板 · 1 未完成')

  await act(async () => button('待办').click())
  expect(readLearningTasks()[0].status).toBe('doing')
  await act(async () => button('进行中').click())
  expect(readLearningTasks()[0].status).toBe('done')
  expect(element.textContent).toContain('任务板 · 0 未完成')

  await act(async () => button('归档').click())
  expect(readLearningTasks()[0].archived).toBe(true)
  expect(element.textContent).toContain('已归档 · 1')

  await act(async () => button('恢复').click())
  expect(readLearningTasks()[0]).toMatchObject({ archived: false, status: 'done' })
  expect(element.textContent).toContain('复盘二分边界')
})

it('rates a due review through the shared self-assessment labels', async () => {
  saveReviewEntry('record', '先写清左右边界', { id: 'record', problemId: 'LOCAL:binary-search', title: '二分边界', topics: ['二分'], durationSec: 12, codeLength: 24, endedAt: '2026-01-01' })
  const saved = JSON.parse(localStorage.getItem('algocoach.localReviewEntries')!)
  saved[0].schedule.due = '2020-01-02T00:00:00.000Z'
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify(saved))
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await act(async () => root.render(<MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LearningSpacePage />} /></Routes></MemoryRouter>))
  expect(element.textContent).toContain('到期复习 · 1')
  await act(async () => button('显示笔记').click())
  for (const label of ['没想起', '很费力', '想起来了', '很轻松']) expect(button(label)).toBeTruthy()
  await act(async () => button('想起来了').click())
  expect(readReviewEntries()[0].schedule?.reviewCount).toBe(1)
  expect(element.textContent).toContain('到期复习 · 0')
})
