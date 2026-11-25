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

async function renderPage() {
  await act(async () => root.render(<MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LearningSpacePage />} /></Routes></MemoryRouter>))
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

it('reorders tasks by dragging a handle onto another row', async () => {
  const first = createLearningTask({ title: '任务 A', kind: 'custom', dueDate: '2026-11-20' })[0]
  createLearningTask({ title: '任务 B', kind: 'custom', dueDate: '2026-11-21' })
  const third = createLearningTask({ title: '任务 C', kind: 'custom', dueDate: '2026-11-22' })[2]
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await renderPage()
  expect(element.querySelectorAll('[data-task-id]')).toHaveLength(3)
  const row = element.querySelector(`[data-task-id="${first.id}"]`)!
  const target = element.querySelector(`[data-task-id="${third.id}"]`)!
  await act(async () => {
    row.querySelector('[data-drag-handle]')!.dispatchEvent(new Event('dragstart', { bubbles: true }))
    target.dispatchEvent(new Event('dragover', { bubbles: true }))
    target.dispatchEvent(new Event('drop', { bubbles: true }))
  })
  expect(readLearningTasks().map(task => task.title)).toEqual(['任务 B', '任务 C', '任务 A'])
})

it('shows every active task in stored order instead of sorting by due date', async () => {
  for (let index = 0; index < 6; index += 1) createLearningTask({ title: `任务 ${index}`, kind: 'custom', dueDate: `2026-11-${20 + index}` })
  const created = readLearningTasks()
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await renderPage()
  const titles = Array.from(element.querySelectorAll('[data-task-id]')).map(row => row.querySelector('p')?.textContent)
  expect(titles).toEqual(created.map(task => task.title))
})

it('moves a focused task with the arrow keys', async () => {
  const first = createLearningTask({ title: '任务 A', kind: 'custom', dueDate: '2026-11-20' })[0]
  createLearningTask({ title: '任务 B', kind: 'custom', dueDate: '2026-11-21' })
  createLearningTask({ title: '任务 C', kind: 'custom', dueDate: '2026-11-22' })
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await renderPage()
  const handle = element.querySelector(`[data-task-id="${first.id}"] [data-drag-handle]`)!
  await act(async () => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
  expect(readLearningTasks().map(task => task.title)).toEqual(['任务 B', '任务 A', '任务 C'])
})

it('saves a task note, shows it on the card, and clears it when emptied', async () => {
  const task = createLearningTask({ title: '任务 A', kind: 'custom', dueDate: '2026-11-20' })[0]
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [] })
  await renderPage()
  await act(async () => (element.querySelector('[aria-label="添加备注：任务 A"]') as HTMLButtonElement).click())
  const textarea = element.querySelector('textarea')! as HTMLTextAreaElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '先写边界再写循环')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => button('保存备注').click())
  expect(readLearningTasks().find(item => item.id === task.id)?.note).toBe('先写边界再写循环')
  expect(element.textContent).toContain('先写边界再写循环')
  await act(async () => (element.querySelector('[aria-label="编辑备注：任务 A"]') as HTMLButtonElement).click())
  const reopened = element.querySelector('textarea')! as HTMLTextAreaElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reopened, '   ')
    reopened.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => button('保存备注').click())
  expect(readLearningTasks().find(item => item.id === task.id)).not.toHaveProperty('note')
  expect(element.textContent).not.toContain('先写边界再写循环')
})
