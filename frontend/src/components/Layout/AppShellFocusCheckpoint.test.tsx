import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import axios from 'axios'
import { useAppStore } from '@/stores/useAppStore'
import AppShell from './AppShell'

vi.mock('./Sidebar', () => ({ default: () => <div>侧边栏</div> }))
vi.mock('./Header', () => ({ default: () => <div>工作区</div> }))
vi.mock('@/components/Problem/ProblemPanel', () => ({ default: () => <div>题目面板</div> }))
vi.mock('@/components/Editor/EditorPanel', () => ({ default: () => <div>编辑器</div> }))
vi.mock('@/components/Chat/ChatPanel', () => ({ default: () => <div>教练</div> }))
vi.mock('@/pages/ProgressPage', () => ({ default: () => <div>进度</div> }))
vi.mock('@/pages/KnowledgeGraphPage', () => ({ default: () => <div>知识图谱</div> }))
vi.mock('@/pages/SettingsPage', () => ({ default: () => <div>设置</div> }))
vi.mock('@/pages/PlatformLoginPage', () => ({ default: () => <div>题库登录</div> }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('checkpoints the focused problem periodically, on pagehide, and when hidden', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'))
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().enterFocus()
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>,
  ))
  await act(async () => vi.advanceTimersByTime(3_000))
  expect(sessionStorage.getItem('algocoach.problemFocusElapsed')).toContain('"LEETCODE:one":3')
  await act(async () => {
    vi.setSystemTime(new Date(Date.now() + 2_000))
    window.dispatchEvent(new Event('pagehide'))
  })
  expect(sessionStorage.getItem('algocoach.problemFocusElapsed')).toContain('"LEETCODE:one":5')
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  await act(async () => {
    vi.setSystemTime(new Date(Date.now() + 1_000))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(sessionStorage.getItem('algocoach.problemFocusElapsed')).toContain('"LEETCODE:one":6')
  expect(sessionStorage.getItem('algocoach.problemFocusElapsed')).toContain('"LEETCODE:one":6')
  await act(async () => root.unmount())
  element.remove()
})
