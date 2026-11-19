import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LearningSpacePage from './LearningSpacePage'
import { LOCAL_PRACTICE_PROBLEMS } from '@/services/localPractice'
import { useAppStore } from '@/stores/useAppStore'
import { agentService } from '@/services/agentService'

let root: Root
let element: HTMLDivElement
const initialState = useAppStore.getState()
const problem = LOCAL_PRACTICE_PROBLEMS[0]
const record = { id: 'record-1', problemId: `${problem.platform}:${problem.platformId}`, title: problem.title, topics: problem.topics, durationSec: 30, codeLength: 20, endedAt: '2026-01-01' }

function Destination() {
  const location = useLocation()
  return <div data-testid="destination">{JSON.stringify(location.state)}</div>
}

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
  await act(async () => root.render(<MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LearningSpacePage />} /><Route path="/workspace" element={<Destination />} /></Routes></MemoryRouter>))
}
function writeNote() {
  const textarea = element.querySelector('textarea')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '检查空数组')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function discussButton() { return Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('问 Agent'))! }

it('opens the recorded local problem before attaching the review to its chat draft', async () => {
  useAppStore.setState({ activeProblem: LOCAL_PRACTICE_PROBLEMS[1], mode: 'REVIEW', localPracticeRecords: [record] })
  await renderPage()
  writeNote()
  act(() => discussButton().click())
  expect(useAppStore.getState().activeProblem?.platformId).toBe(problem.platformId)
  expect(Object.values(useAppStore.getState().chatDrafts).join(' ')).toContain('检查空数组')
  expect(element.querySelector('[data-testid="destination"]')?.textContent).toContain('chat')
})

it('does not switch away from a different problem during focus', async () => {
  useAppStore.setState({ activeProblem: LOCAL_PRACTICE_PROBLEMS[1], mode: 'FOCUS', localPracticeRecords: [record] })
  await renderPage()
  writeNote()
  expect(discussButton().disabled).toBe(true)
  expect(element.textContent).toContain('结束当前专注后可切换题目')
  expect(useAppStore.getState().activeProblem?.platformId).toBe(LOCAL_PRACTICE_PROBLEMS[1].platformId)
})

it('requires the original problem for unknown history', async () => {
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [{ ...record, problemId: 'LEETCODE:unknown' }] })
  await renderPage()
  writeNote()
  expect(discussButton().disabled).toBe(true)
  expect(element.textContent).toContain('请先打开对应题目')
})


it('marks only actual practice days in the current week', async () => {
  const today = new Date()
  const yesterdayWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14)
  useAppStore.setState({ localPracticeRecords: [
    { ...record, id: 'today', endedAt: today.toISOString() },
    { ...record, id: 'old', endedAt: yesterdayWeek.toISOString() },
  ] })
  await renderPage()
  expect(element.querySelectorAll('[aria-label*="：有练习"]')).toHaveLength(1)
  expect(element.querySelectorAll('[aria-label*="：无练习"]')).toHaveLength(6)
})

it('preserves the note and pending record when local storage cannot save the review', async () => {
  useAppStore.setState({ activeProblem: problem, mode: 'REVIEW', localPracticeRecords: [record] })
  await renderPage()
  writeNote()
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'algocoach.localReviewEntries') throw new Error('quota')
    original.call(this, key, value)
  })
  const save = Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('保存复盘'))!
  act(() => save.click())
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('保存失败')
  expect(element.querySelector('textarea')?.value).toBe('检查空数组')
  expect(element.textContent).toContain(record.title)
})

it('asks the learner to recall a due note before revealing it and scheduling the next review', async () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: record.id, note: '双指针先检查边界', reviewedAt: '2020-01-01T00:00:00.000Z', problemKey: record.problemId, title: record.title }]))
  useAppStore.setState({ activeProblem: null, mode: 'PREP', localPracticeRecords: [record] })
  await renderPage()
  expect(element.textContent).toContain('到期复习')
  expect(element.textContent).not.toContain('双指针先检查边界')
  const reveal = Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('显示笔记'))!
  act(() => reveal.click())
  expect(element.textContent).toContain('双指针先检查边界')
  const rate = Array.from(element.querySelectorAll('button')).find(button => button.textContent === '想起来了')!
  act(() => rate.click())
  expect(element.textContent).not.toContain('双指针先检查边界')
  expect(JSON.parse(localStorage.getItem('algocoach.localReviewEntries')!)[0].schedule.reps).toBe(1)
})

it('keeps due reviews discoverable when the review block is hidden', async () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: record.id, note: '复习内容', reviewedAt: '2020-01-01T00:00:00.000Z', title: record.title, problemKey: record.problemId }]))
  localStorage.setItem('algocoach.learningSpaceLayout', JSON.stringify({ mode: 'self_paced', blocks: [{ id: 'review', visible: false }] }))
  await renderPage()
  const show = Array.from(element.querySelectorAll('button')).find(button => button.textContent === '查看到期复习')!
  expect(show).toBeDefined()
  act(() => show.click())
  expect(element.textContent).toContain('到期复习 · 1')
})
