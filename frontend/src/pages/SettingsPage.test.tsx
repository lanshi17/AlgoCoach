import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import { agentService } from '@/services/agentService'
import { leetcodeService } from '@/services/leetcodeService'
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

    const apiKey = element.querySelector<HTMLInputElement>('input[aria-label="Provider API key"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(apiKey, 'test-session-key')
      apiKey.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.includes('保存 Provider'))!.click())

    expect(element.querySelector('[data-testid="return-target"]')?.textContent).toBe('chat')
    expect(useAppStore.getState().provider.apiKey).toBe('test-session-key')
    expect(sessionStorage.getItem('algocoach.provider.apiKey')).toBe('test-session-key')
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

    const apiKey = element.querySelector<HTMLInputElement>('input[aria-label="Provider API key"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(apiKey, 'anthropic-key')
      apiKey.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.includes('保存 Provider'))?.click()
    })

    const preset = element.querySelector<HTMLSelectElement>('select[aria-label="模型 Provider 预设"]')!
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
})
