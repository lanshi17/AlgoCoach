import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentService } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'
import type { Problem } from '@/types'
import ChatPanel, { toRemainingSeconds } from './ChatPanel'

vi.mock('./ChatMessage', () => ({ default: ({ message }: { message: { content: string } }) => <p>{message.content}</p> }))
vi.mock('../Animation/AnimationCard', () => ({ default: () => null }))
vi.mock('@/hooks/usePollAnimation', () => ({ usePollAnimation: () => null }))

const problem: Problem = {
  id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
  contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
}

function renderChatPanel(root: Root) {
  root.render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ChatPanel />
    </MemoryRouter>,
  )
}

describe('chat when changing training context', () => {
  let element: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    sessionStorage.clear()
    useAppStore.setState(useAppStore.getInitialState(), true)
    Element.prototype.scrollIntoView = vi.fn()
    element = document.createElement('div')
    document.body.appendChild(element)
    root = createRoot(element)
  })

  afterEach(() => {
    act(() => root.unmount())
    element.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('converts a time budget to non-negative remaining seconds', () => {
    expect(toRemainingSeconds('', 120)).toBeUndefined()
    expect(toRemainingSeconds('10', 125)).toBe(475)
    expect(toRemainingSeconds('10', 700)).toBe(0)
    expect(toRemainingSeconds('-1')).toBeUndefined()
    expect(toRemainingSeconds('9007199254740991')).toBeUndefined()
  })

  it('keeps a global chat time limit when no problem is selected', () => {
    act(() => renderChatPanel(root))
    const timeInput = element.querySelector<HTMLInputElement>('#chat-time-remaining')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(timeInput, '25')
      timeInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useAppStore.getState().problemTimeLimits.__global__).toBe(1500)
    expect(element.querySelector<HTMLInputElement>('#chat-time-remaining')!.value).toBe('25')
  })

  it('uses immediate scrolling when the system requests reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    act(() => renderChatPanel(root))
    act(() => useAppStore.getState().addMessage({
      id: 'reduced-motion', role: 'agent', content: '回复', timestamp: 'now',
    }))

    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto' })
  })

  it('unlocks the new conversation even if the old request never settles', async () => {
    let signal: AbortSignal | undefined
    vi.spyOn(agentService, 'chat').mockImplementation((_message, _ctx, requestSignal) => {
      signal = requestSignal
      return new Promise(() => {})
    })
    act(() => {
      useAppStore.getState().setActiveProblem(problem)
      renderChatPanel(root)
    })
    const textarea = element.querySelector('textarea')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '你好')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())
    expect(element.textContent).toContain('正在思考')
    act(() => useAppStore.getState().setActiveProblem({ ...problem, id: '2', platformId: 'two' }))
    expect(signal?.aborted).toBe(true)
    expect(element.textContent).not.toContain('正在思考')
    expect(element.querySelector('button[aria-label="发送消息"]')).not.toBeNull()
  })

  it('does not claim a submission occurred after ending focus manually', () => {
    act(() => {
      useAppStore.getState().setActiveProblem(problem)
      useAppStore.getState().enterFocus()
      useAppStore.getState().exitFocus()
      renderChatPanel(root)
    })
    expect(element.textContent).toContain('复盘思路')
    expect(element.textContent).not.toContain('提交完成')
  })

  it('keeps an unsent message with its original problem', () => {
    act(() => {
      useAppStore.getState().setActiveProblem(problem)
      renderChatPanel(root)
    })
    const textarea = element.querySelector('textarea')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '我的思路')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => useAppStore.getState().setActiveProblem({ ...problem, id: '2', platformId: 'two' }))
    expect(element.querySelector('textarea')!.value).toBe('')
    act(() => useAppStore.getState().setActiveProblem(problem))
    expect(element.querySelector('textarea')!.value).toBe('我的思路')
  })

  it('restores the selected training phase after leaving and returning to chat', () => {
    useAppStore.getState().setActiveProblem(problem)
    act(() => renderChatPanel(root))
    const phase = element.querySelector<HTMLSelectElement>('#chat-training-phase')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(phase, 'hint')
      phase.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(useAppStore.getState().chatPhases['LEETCODE:one']).toBe('hint')

    act(() => root.render(null))
    act(() => renderChatPanel(root))
    expect(element.querySelector<HTMLSelectElement>('#chat-training-phase')!.value).toBe('hint')
  })

  it('sends the time budget after subtracting elapsed focus time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'))
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().enterFocus()
    vi.advanceTimersByTime(5 * 60_000)
    useAppStore.getState().exitFocus()
    const chat = vi.spyOn(agentService, 'chat').mockResolvedValue({ content: '还剩五分钟。' })
    act(() => renderChatPanel(root))

    const timeInput = element.querySelector<HTMLInputElement>('#chat-time-remaining')!
    const inputArea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(timeInput, '10')
      timeInput.dispatchEvent(new Event('input', { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(inputArea, '还剩多少时间？')
      inputArea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())

    expect(chat).toHaveBeenCalledWith(
      '还剩多少时间？', expect.objectContaining({ timeRemainingSec: 300 }), expect.any(AbortSignal),
    )
  })

  it('offers a direct settings link when the provider has no API key', async () => {
    useAppStore.getState().setActiveProblem(problem)
    vi.spyOn(agentService, 'chat').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: {
          code: 'provider_api_key_required',
          message: '当前 Provider 需要 API key，请在设置页配置',
        } },
      },
    })
    act(() => renderChatPanel(root))

    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '你好')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())

    const settingsLink = element.querySelector<HTMLAnchorElement>('a[href="/settings"]')
    expect(settingsLink?.textContent).toBe('配置模型 Provider')
    expect(element.textContent).toContain('完善模型 Provider 配置后即可继续对话。')
    expect(textarea.value).toBe('你好')
  })
})
