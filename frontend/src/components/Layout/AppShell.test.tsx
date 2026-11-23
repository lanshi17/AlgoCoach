import React, { act } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import AppShell from './AppShell'

vi.mock('./Sidebar', () => ({ default: () => <div>侧边栏</div> }))
vi.mock('./MobileTabBar', () => ({ default: () => <nav aria-label="移动导航" /> }))
vi.mock('./Header', () => ({ default: () => <div>工作区</div> }))
vi.mock('@/components/Problem/ProblemPanel', () => ({ default: () => <div>题目面板</div> }))
vi.mock('@/components/Editor/EditorPanel', () => ({ default: () => <div>编辑器</div> }))
vi.mock('@/components/Chat/ChatPanel', () => ({ default: () => <div data-testid="chat-panel">教练</div> }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('allows the workspace without LeetCode credentials and after a cookie error', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/workspace']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>)
  })
  expect(element.textContent).toContain('工作区')
  expect(vi.mocked(axios.get)).toHaveBeenCalledWith('/api/auth/status', { timeout: 8000 })
  act(() => window.dispatchEvent(new Event('algocoach:cookie-invalid')))
  expect(element.textContent).toContain('工作区')
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('LeetCode 登录态已失效')
  expect(element.querySelector('a[href="/settings/platforms"]')?.textContent).toBe('重新配置')
  act(() => element.querySelector<HTMLButtonElement>('button[aria-label="关闭 Cookie 失效提示"]')!.click())
  expect(element.querySelector('[role="alert"]')).toBeNull()
  act(() => root.unmount())
  element.remove()
})

it('clears the cookie warning when a valid cookie is saved elsewhere', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/workspace']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>)
  })
  act(() => window.dispatchEvent(new Event('algocoach:cookie-invalid')))
  expect(element.querySelector('[role="alert"]')).not.toBeNull()
  act(() => window.dispatchEvent(new Event('algocoach:cookie-valid')))
  expect(element.querySelector('[role="alert"]')).toBeNull()
  act(() => root.unmount())
  element.remove()
})

it('restores the last mobile workspace panel after returning from settings', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.setItem('algocoach.workspacePanel', 'chat')
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/workspace']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>)
  })
  expect(element.querySelector('nav[aria-label="工作区面板"] button[aria-pressed="true"]')?.textContent).toBe('AI 教练')
  act(() => root.unmount())
  element.remove()
  sessionStorage.clear()
})

it('honors an explicit problem panel even when another panel was saved', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.setItem('algocoach.workspacePanel', 'chat')
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[{ pathname: '/workspace', state: { openPanel: 'problem' } }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>)
  })
  expect(element.querySelector('nav[aria-label="工作区面板"] button[aria-pressed="true"]')?.textContent).toBe('题目')
  act(() => root.unmount())
  element.remove()
  sessionStorage.clear()
})

it('keeps the coach mounted while switching mobile workspace panels', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sessionStorage.setItem('algocoach.workspacePanel', 'chat')
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/workspace']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>)
  })

  expect(element.querySelector('[data-testid="chat-panel"]')).not.toBeNull()
  const editorTab = Array.from(element.querySelectorAll('nav[aria-label="工作区面板"] button'))
    .find(button => button.textContent === '编辑器') as HTMLButtonElement
  act(() => editorTab.click())

  expect(element.querySelector('[data-testid="chat-panel"]')).not.toBeNull()
  expect(element.querySelector('[data-testid="chat-panel"]')?.parentElement?.className).toContain('hidden')
  act(() => root.unmount())
  element.remove()
  sessionStorage.clear()
})

it('deduplicates auth status checks under React StrictMode', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(
      <React.StrictMode>
        <MemoryRouter initialEntries={['/workspace']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>
      </React.StrictMode>,
    )
    await Promise.resolve()
  })

  expect(get).toHaveBeenCalledTimes(1)
  act(() => root.unmount())
  element.remove()
})

it('starts a fresh auth check when the user retries after a gateway failure', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const get = vi.spyOn(axios, 'get')
    .mockRejectedValueOnce(new Error('gateway offline'))
    .mockResolvedValueOnce({ data: { authenticated: false } })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/workspace']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>)
    await Promise.resolve()
  })

  expect(element.textContent).toContain('无法连接 Java 网关')
  await act(async () => {
    element.querySelector<HTMLButtonElement>('button')!.click()
    await Promise.resolve()
  })
  expect(get).toHaveBeenCalledTimes(2)
  expect(element.textContent).toContain('工作区')
  act(() => root.unmount())
  element.remove()
})

it('closes the coach sidebar and removes its tab during focus', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({ id: 'focus', platform: 'LEETCODE', platformId: 'focus', title: 'Focus', difficulty: 'EASY', contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [] })
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter initialEntries={['/workspace']}><AppShell /></MemoryRouter>))
  act(() => useAppStore.getState().enterFocus())
  expect(element.querySelector('[data-testid="chat-panel"]')?.parentElement?.className).toMatch(/^hidden /)
  expect(Array.from(element.querySelectorAll('nav[aria-label="工作区面板"] button')).some(button => button.textContent === 'AI 教练')).toBe(false)
  act(() => root.unmount()); element.remove()
})
