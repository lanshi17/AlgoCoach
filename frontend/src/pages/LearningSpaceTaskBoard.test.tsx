import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LearningSpacePage from './LearningSpacePage'
import { agentService } from '@/services/agentService'
import { createLearningTask, readLearningTasks } from '@/services/learningTasks'
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
