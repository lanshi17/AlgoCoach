import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import { agentService } from '@/services/agentService'
import { leetcodeService } from '@/services/leetcodeService'
import { readLearningTasks } from '@/services/learningTasks'
import SettingsPage from './SettingsPage'

function ReturnTarget() {
  const location = useLocation()
  const state = location.state as { openPanel?: string } | null
  return <div data-testid="return-target">{state?.openPanel ?? 'missing-panel'}</div>
}

describe('provider setup return path', () => {
  let element: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    sessionStorage.clear()
    useAppStore.setState(useAppStore.getInitialState(), true)
    element = document.createElement('div')
    document.body.appendChild(element)
    root = createRoot(element)
  })

  afterEach(() => {
    act(() => root.unmount())
    element.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns to the coach panel after saving and keeps the API key session-only', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[{ pathname: '/settings', state: { returnToChat: true } }]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/workspace" element={<ReturnTarget />} />
          </Routes>
        </MemoryRouter>,
      )
    })

    const preset = element.querySelector<HTMLSelectElement>('select[aria-label="模型 Provider 预设"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(preset, 'anthropic')
      preset.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const apiKey = element.querySelector<HTMLInputElement>('input[aria-label="Provider API key"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(apiKey, 'test-session-key')
      apiKey.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.includes('保存 Provider'))!.click())

    expect(element.querySelector('[data-testid="return-target"]')?.textContent).toBe('chat')
    expect(useAppStore.getState().provider.apiKey).toBe('test-session-key')
    expect(sessionStorage.getItem('algocoach.provider.apiKey.anthropic')).toBe('test-session-key')
    expect(localStorage.getItem('algocoach.provider')).not.toContain('test-session-key')
  })

  it('keeps provider keys isolated when switching presets', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SettingsPage />
        </MemoryRouter>,
      )
    })

    const preset = element.querySelector<HTMLSelectElement>('select[aria-label="模型 Provider 预设"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(preset, 'anthropic')
      preset.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const apiKey = element.querySelector<HTMLInputElement>('input[aria-label="Provider API key"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(apiKey, 'anthropic-key')
      apiKey.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('保存 Provider'))?.click()
    })

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(preset, 'openai')
      preset.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(element.querySelector<HTMLInputElement>('input[aria-label="Provider API key"]')?.value).toBe('')

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(preset, 'anthropic')
      preset.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(element.querySelector<HTMLInputElement>('input[aria-label="Provider API key"]')?.value).toBe('anthropic-key')
  })

  it('persists the AI coach switches and style', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SettingsPage />
        </MemoryRouter>,
      )
    })

    act(() => element.querySelector<HTMLButtonElement>('button[aria-label="自动赛后复盘"]')!.click())
    act(() => element.querySelector<HTMLButtonElement>('button[aria-label="动画讲解"]')!.click())
    const style = element.querySelector<HTMLSelectElement>('select[aria-label="教练风格"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(style, 'socratic')
      style.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(useAppStore.getState().coachPrefs).toMatchObject({
      autoReview: false, animations: false, coachStyle: 'socratic',
    })
    expect(JSON.parse(localStorage.getItem('algocoach.coachPrefs')!)).toMatchObject({
      autoReview: false, animations: false, coachStyle: 'socratic',
    })
    expect(element.querySelector<HTMLButtonElement>('button[aria-label="自动赛后复盘"]')?.getAttribute('aria-checked')).toBe('false')
  })

  it('exports local memory even when LeetCode submission history is unavailable', async () => {
    const memory = vi.spyOn(agentService, 'exportMemory').mockResolvedValue(new Blob(['memory']))
    vi.spyOn(leetcodeService, 'submissionHistory').mockRejectedValue(new Error('cookie missing'))
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SettingsPage />
        </MemoryRouter>,
      )
    })

    await act(async () => element.querySelector<HTMLButtonElement>('button')
      && Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('导出数据'))?.click())

    expect(memory).toHaveBeenCalledTimes(1)
    expect(element.querySelector('[role="status"]')?.textContent).toContain('训练记忆已导出')
    expect(element.querySelector('[role="status"]')?.textContent).toContain('提交历史暂未导出')
  })

  it('exports workspace data even when the agent is unavailable', async () => {
    vi.spyOn(agentService, 'exportMemory').mockRejectedValue(new Error('offline'))
    vi.spyOn(leetcodeService, 'submissionHistory').mockRejectedValue(new Error('offline'))
    const createObjectURL = vi.fn(() => 'blob:mock')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await act(async () => {
      root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SettingsPage /></MemoryRouter>)
    })
    await act(async () => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('导出数据'))!.click()
    })
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(element.querySelector('[role="status"]')?.textContent).toContain('工作空间数据已导出')
  })

  it('imports a mastery bundle and reports merged counts', async () => {
    const importMastery = vi.spyOn(agentService, 'importMastery').mockResolvedValue({
      ok: true, workspaceId: 'local-default', imported: 1, updated: 2, unchanged: 3,
      schedulesImported: 1, schedulesUpdated: 2, schedulesUnchanged: 3,
    })
    await act(async () => {
      root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SettingsPage /></MemoryRouter>)
    })
    const bundle = {
      format: 'algocoach-mastery-v2',
      exportedAt: '2026-01-01T00:00:00',
      workspaceId: 'remote-device',
      topics: [{ topic: '二分查找', mastery: 0.5, attempts: 1, lastSeen: '' }],
      reviewSchedules: [{
        problemId: 'two-sum', dueAt: '2026-02-10T00:00:00', intervalDays: 5,
        mastery: 0.5, attempts: 1, topics: ['二分查找'], updatedAt: '2026-02-05T00:00:00',
      }],
    }
    const file = new File([JSON.stringify(bundle)], 'mastery.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(bundle) })
    const input = element.querySelector<HTMLInputElement>('input[aria-label="选择掌握度文件"]')!
    Object.defineProperty(input, 'files', { value: [file] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })

    expect(importMastery).toHaveBeenCalledWith(expect.objectContaining({ format: 'algocoach-mastery-v2' }))
    const messages = Array.from(element.querySelectorAll('[role="status"]')).map(node => node.textContent ?? '')
    expect(messages.some(text => text.includes('已合并 1 个新知识点'))).toBe(true)
    expect(messages.some(text => text.includes('复习计划新增 1 条、更新 2 条'))).toBe(true)
    expect(messages.some(text => text.includes('来源 workspace：remote-device'))).toBe(true)
  })

  it('requires a hub URL and token before automatic sync', async () => {
    await act(async () => {
      root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SettingsPage /></MemoryRouter>)
    })
    act(() => element.querySelector<HTMLButtonElement>('button[aria-label="自动跨设备同步"]')!.click())
    await act(async () => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('保存并同步'))!.click()
    })
    const messages = Array.from(element.querySelectorAll('[role="status"]')).map(node => node.textContent ?? '')
    expect(messages.some(text => text.includes('启用自动同步需要填写同步服务地址和令牌'))).toBe(true)
  })

  it('restores a background failure and clears it after a successful sync', async () => {
    localStorage.setItem('algocoach.autoSync', JSON.stringify({ enabled: true, hubUrl: 'http://hub', token: 'secret' }))
    localStorage.setItem('algocoach.autoSyncFailure', JSON.stringify({
      at: '2026-02-05T00:00:00Z',
      message: '同步服务返回 403',
    }))
    await act(async () => {
      root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SettingsPage /></MemoryRouter>)
    })
    const statuses = () => Array.from(element.querySelectorAll('[role="status"]')).map(node => node.textContent ?? '')
    expect(statuses().some(text => text.includes('上次自动同步失败'))).toBe(true)

    act(() => window.dispatchEvent(new CustomEvent('algocoach:auto-sync', {
      detail: { status: 'failed', at: '2026-02-05T00:01:00Z', message: '同步服务返回 503' },
    })))
    expect(statuses().some(text => text.includes('后台同步失败：同步服务返回 503'))).toBe(true)

    act(() => window.dispatchEvent(new CustomEvent('algocoach:auto-sync', {
      detail: { status: 'synced', at: '2026-02-05T00:02:00Z', counts: {} },
    })))
    expect(statuses().some(text => text.includes('后台同步完成'))).toBe(true)
    expect(statuses().some(text => text.includes('失败'))).toBe(false)
  })

  it('imports a workspace backup and reports the source workspace', async () => {
    await act(async () => {
      root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SettingsPage /></MemoryRouter>)
    })
    const snapshot = {
      format: 'algocoach-workspace-v1',
      exportedAt: '2026-02-01T00:00:00.000Z',
      workspaceId: 'remote-device',
      notebook: [],
      tasks: [{
        id: 'imported-task', title: '导入任务', kind: 'custom', dueDate: '2026-02-03',
        status: 'todo', archived: false, createdAt: '2026-02-01T00:00:00.000Z',
      }],
      practiceRecords: [],
      reviews: [],
      reviewEvents: [],
      layout: { mode: 'self_paced', blocks: [] },
    }
    const file = new File([JSON.stringify(snapshot)], 'workspace.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(snapshot) })
    const input = element.querySelector<HTMLInputElement>('input[aria-label="选择工作区备份文件"]')!
    Object.defineProperty(input, 'files', { value: [file] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })

    expect(readLearningTasks().map(task => task.id)).toContain('imported-task')
    const messages = Array.from(element.querySelectorAll('[role="status"]')).map(node => node.textContent ?? '')
    expect(messages.some(text => text.includes('已补充 任务 1 条'))).toBe(true)
    expect(messages.some(text => text.includes('来源 workspace：remote-device'))).toBe(true)
  })
})
