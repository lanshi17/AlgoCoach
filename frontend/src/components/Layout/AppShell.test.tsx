import React, { act } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import AppShell from './AppShell'
import { packLayout } from './layoutStorage'

const editorRenders = vi.hoisted(() => ({ value: 0 }))

vi.mock('./Sidebar', () => ({ default: () => <div>侧边栏</div> }))
vi.mock('./MobileTabBar', () => ({ default: () => <nav aria-label="移动导航" /> }))
vi.mock('./Header', () => ({ default: () => <div>工作区</div> }))
vi.mock('@/components/Problem/ProblemPanel', () => ({ default: () => <div>题目面板</div> }))
vi.mock('@/components/Editor/EditorPanel', () => ({
  default: () => {
    editorRenders.value += 1
    return <div data-testid="editor-panel">编辑器</div>
  },
}))
vi.mock('@/components/Chat/ChatPanel', () => ({ default: () => <div data-testid="chat-panel">教练</div> }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

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
  expect(element.querySelector('[data-testid="chat-panel"]')?.closest('[data-workspace-panel="chat"]')?.className).toContain('hidden')
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
  expect(element.querySelector('[data-testid="chat-panel"]')?.closest('[data-workspace-panel="chat"]')?.className).toContain('hidden')
  expect(element.querySelector('[data-testid="chat-panel"]')?.closest('[data-workspace-panel="chat"]')?.className).not.toContain('xl:flex')
  expect(Array.from(element.querySelectorAll('nav[aria-label="工作区面板"] button')).some(button => button.textContent === 'AI 教练')).toBe(false)
  act(() => root.unmount()); element.remove()
})

it('hides a detached coach during focus and restores its float afterwards', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({ id: 'focus', platform: 'LEETCODE', platformId: 'focus', title: 'Focus', difficulty: 'EASY', contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [] })
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query.includes('(min-width: 1280px)'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }))
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter initialEntries={['/workspace']}><AppShell /></MemoryRouter>))
  const chatPanel = () => element.querySelector<HTMLElement>('[data-workspace-panel="chat"]')!

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="AI 教练：独立为浮窗"]')!.click() })
  expect(chatPanel().className).toContain('fixed')
  expect(element.querySelector('[aria-label="AI 教练浮窗"]')).not.toBeNull()

  act(() => useAppStore.getState().enterFocus())
  expect(chatPanel().classList.contains('hidden')).toBe(true)
  expect(chatPanel().className).not.toContain('fixed')
  expect(element.querySelector('[aria-label="AI 教练浮窗"]')).toBeNull()
  expect(element.querySelector('[aria-label="AI 教练已独立为浮窗"]')).toBeNull()
  expect(element.querySelector('[aria-label="面板布局"]')?.textContent).not.toContain('AI 教练')

  act(() => useAppStore.getState().exitFocus())
  expect(chatPanel().className).toContain('fixed')
  expect(chatPanel().classList.contains('hidden')).toBe(false)
  act(() => root.unmount()); element.remove()
})

it('resizes the wide workspace and detaches a panel into a floating window', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query.includes('(min-width: 1280px)'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }))
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  editorRenders.value = 0
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter initialEntries={['/workspace']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppShell /></MemoryRouter>))
  const rendersAfterMount = editorRenders.value

  expect(element.querySelector('[aria-label="面板布局"]')).not.toBeNull()
  const preset = element.querySelector<HTMLSelectElement>('select[aria-label="布局预设"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(preset, 'editor')
    preset.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const resizer = element.querySelector<HTMLElement>('[role="separator"][aria-label="调整题目宽度"]')!
  const chatResizer = element.querySelector<HTMLElement>('[role="separator"][aria-label="调整对话宽度"]')!
  expect(Number(resizer.getAttribute('aria-valuenow'))).toBe(300)
  expect(Number(chatResizer.getAttribute('aria-valuenow'))).toBe(300)
  expect(preset.value).toBe('editor')
  const width = Number(resizer.getAttribute('aria-valuenow'))
  await act(async () => { resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })) })
  expect(Number(resizer.getAttribute('aria-valuenow'))).toBe(width - 16)
  expect(preset.value).toBe('custom')

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="保存当前布局为我的布局"]')!.click() })
  expect(preset.value).toBe('saved')
  expect(preset.querySelector('option[value="saved"]')?.textContent).toBe('我的布局')

  const choosePreset = async (value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(preset, value)
      preset.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }
  await choosePreset('balanced')
  expect(Number(resizer.getAttribute('aria-valuenow'))).toBe(420)
  await choosePreset('saved')
  expect(Number(resizer.getAttribute('aria-valuenow'))).toBe(width - 16)

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="编辑器：独立为浮窗"]')!.click() })
  const editor = element.querySelector<HTMLElement>('[data-workspace-panel="editor"]')!
  const editorContent = element.querySelector('[data-testid="editor-panel"]')
  expect(editor.className).toContain('fixed')
  expect(element.querySelector('[aria-label="编辑器已独立为浮窗"]')).not.toBeNull()
  expect(element.querySelector('button[aria-label="编辑器：嵌入布局"]')).not.toBeNull()
  expect(element.querySelector('[aria-label="调整编辑器浮窗大小"]')).not.toBeNull()

  const chrome = element.querySelector<HTMLElement>('[aria-label="编辑器浮窗拖动条"]')!
  const left = Number.parseFloat(editor.style.left)
  await act(async () => { chrome.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
  expect(Number.parseFloat(editor.style.left)).toBe(left + 16)

  const resizeHandle = element.querySelector<HTMLElement>('[aria-label="调整编辑器浮窗大小"]')!
  const widthBeforeResize = Number.parseFloat(editor.style.width)
  await act(async () => { resizeHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
  expect(Number.parseFloat(editor.style.width)).toBe(widthBeforeResize + 16)

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="最大化编辑器浮窗"]')!.click() })
  expect(editor.style.left).toBe('8px')
  expect(editor.style.width).toBe('auto')
  expect(element.querySelector('[aria-label="调整编辑器浮窗大小"]')).toBeNull()
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="还原编辑器浮窗"]')!.click() })
  expect(Number.parseFloat(editor.style.width)).toBe(widthBeforeResize + 16)
  expect(element.querySelector('[aria-label="调整编辑器浮窗大小"]')).not.toBeNull()

  vi.stubGlobal('innerWidth', 700)
  await act(async () => { window.dispatchEvent(new Event('resize')) })
  expect(Number.parseFloat(editor.style.width)).toBeLessThanOrEqual(700 - 16)
  expect(Number.parseFloat(editor.style.left)).toBeLessThanOrEqual(700 - Number.parseFloat(editor.style.width) - 8)

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="编辑器：嵌入布局"]')!.click() })
  expect(editor.className).not.toContain('fixed')
  expect(element.querySelector('[aria-label="编辑器已独立为浮窗"]')).toBeNull()
  expect(element.querySelector('[data-testid="editor-panel"]')).toBe(editorContent)
  expect(editorRenders.value).toBe(rendersAfterMount)

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="编辑器：独立为浮窗"]')!.click() })
  expect(editor.className).toContain('fixed')
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="重置面板布局"]')!.click() })
  expect(editor.className).not.toContain('fixed')
  expect(element.querySelector('[aria-label="编辑器已独立为浮窗"]')).toBeNull()
  expect(Array.from(element.querySelectorAll('[aria-label="面板布局"] button[aria-pressed]')).every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true)
  expect(element.querySelector('select[aria-label="布局预设"] option[value="saved"]')).not.toBeNull()

  act(() => root.unmount()); element.remove()
})

it('applies a layout written by another tab', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query.includes('(min-width: 1280px)'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }))
  vi.spyOn(axios, 'get').mockResolvedValue({ data: { authenticated: false } })
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter initialEntries={['/workspace']}><AppShell /></MemoryRouter>))

  const key = 'algocoach.workspaceLayout'
  const external = {
    problemWidth: 460,
    chatWidth: 340,
    modes: { problem: 'docked', editor: 'floating', chat: 'docked' },
    floats: {
      problem: { x: 140, y: 120, width: 480, height: 560 },
      editor: { x: 400, y: 90, width: 600, height: 600 },
      chat: { x: 760, y: 120, width: 420, height: 560 },
    },
  }
  localStorage.setItem(key, packLayout(external))
  await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key, newValue: packLayout(external) })) })

  expect(element.querySelector<HTMLElement>('[data-workspace-panel="editor"]')?.className).toContain('fixed')
  expect(element.querySelector('[aria-label="编辑器已独立为浮窗"]')).not.toBeNull()
  act(() => root.unmount()); element.remove()
})
