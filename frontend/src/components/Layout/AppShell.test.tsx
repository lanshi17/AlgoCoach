import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import AppShell from './AppShell'

vi.mock('./Sidebar', () => ({ default: () => <div>侧边栏</div> }))
vi.mock('./Header', () => ({ default: () => <div>工作区</div> }))
vi.mock('@/components/Problem/ProblemPanel', () => ({ default: () => <div>题目面板</div> }))
vi.mock('@/components/Editor/EditorPanel', () => ({ default: () => <div>编辑器</div> }))
vi.mock('@/components/Chat/ChatPanel', () => ({ default: () => <div>教练</div> }))

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
  act(() => window.dispatchEvent(new Event('algocoach:cookie-invalid')))
  expect(element.textContent).toContain('工作区')
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
