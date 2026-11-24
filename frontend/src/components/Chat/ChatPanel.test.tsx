import React, { act, Profiler } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentService } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'
import { queueCapabilityHandoff } from '@/services/deepTutorCapabilities'
import type { ChatMessage as Msg, Problem } from '@/types'
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

  it('does not send while an IME composition is being confirmed', async () => {
    useAppStore.getState().setActiveProblem(problem)
    const chat = vi.spyOn(agentService, 'chatStream').mockResolvedValue({ content: '已收到。' })
    act(() => renderChatPanel(root))
    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '你好')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const composingEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    Object.defineProperty(composingEnter, 'isComposing', { value: true })
    act(() => textarea.dispatchEvent(composingEnter))
    expect(chat).not.toHaveBeenCalled()
    expect(textarea.value).toBe('你好')

    await act(async () => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(chat).toHaveBeenCalledTimes(1)
  })

  it('uses immediate scrolling when the system requests reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    act(() => renderChatPanel(root))
    act(() => useAppStore.getState().addMessage({
      id: 'reduced-motion', role: 'agent', content: '回复', timestamp: 'now',
    }))

    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto' })
  })

  it('does not rerender the chat or its math messages for editor keystrokes', () => {
    useAppStore.getState().setActiveProblem(problem)
    let commits = 0
    act(() => root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Profiler id="chat" onRender={() => { commits += 1 }}><ChatPanel /></Profiler>
      </MemoryRouter>,
    ))
    const initialCommits = commits

    act(() => useAppStore.getState().setCode('draft while typing'))

    expect(commits).toBe(initialCommits)
  })

  it('unlocks the new conversation even if the old request never settles', async () => {
    let signal: AbortSignal | undefined
    vi.spyOn(agentService, 'chatStream').mockImplementation((_message, _ctx, _handlers, requestSignal) => {
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
    expect(element.querySelector<HTMLButtonElement>('button[aria-label="正在等待教练回复"]')?.getAttribute('aria-busy')).toBe('true')
    act(() => useAppStore.getState().setActiveProblem({ ...problem, id: '2', platformId: 'two' }))
    expect(signal?.aborted).toBe(true)
    expect(element.textContent).not.toContain('正在思考')
    expect(element.querySelector('button[aria-label="发送消息"]')).not.toBeNull()
  })

  it('shows one-line thinking and expands streamed thinking details', async () => {
    let finish!: (reply: { content: string }) => void
    vi.spyOn(agentService, 'chatStream').mockImplementation(async (_message, _ctx, handlers) => {
      handlers?.onThinking?.('先确认约束。\n再选择不变量。')
      return await new Promise(resolve => { finish = resolve })
    })
    useAppStore.getState().setActiveProblem(problem)
    act(() => renderChatPanel(root))
    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '怎么建模？')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())

    const thinking = element.querySelector<HTMLButtonElement>('button[aria-controls="chat-thinking-details"]')!
    expect(thinking.textContent).toContain('正在思考：再选择不变量。')
    expect(thinking.getAttribute('aria-expanded')).toBe('false')
    act(() => thinking.click())
    expect(element.querySelector('#chat-thinking-details')?.textContent).toContain('先确认约束。')
    expect(thinking.getAttribute('aria-expanded')).toBe('true')
    await act(async () => finish({ content: '答案流式完成。' }))
    expect(element.textContent).toContain('答案流式完成。')
  })

  it('sends the coach preferences and hides thinking when requested', async () => {
    let finish!: (reply: { content: string }) => void
    const chatStream = vi.spyOn(agentService, 'chatStream').mockImplementation(async (_message, _ctx, handlers) => {
      handlers?.onThinking?.('内部推理')
      return await new Promise(resolve => { finish = resolve })
    })
    useAppStore.getState().setCoachPrefs({ animations: false, coachStyle: 'direct', showThinking: false })
    useAppStore.getState().setActiveProblem(problem)
    act(() => renderChatPanel(root))
    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '怎么建模？')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())

    expect(chatStream.mock.calls[0][1]).toMatchObject({ animations: false, coachStyle: 'direct' })
    expect(element.querySelector('button[aria-controls="chat-thinking-details"]')).toBeNull()
    expect(element.textContent).toContain('正在思考')
    await act(async () => finish({ content: '完成' }))
  })

  it('does not claim a submission occurred after ending focus manually', () => {
    act(() => {
      useAppStore.getState().setActiveProblem(problem)
      useAppStore.getState().enterFocus()
      useAppStore.getState().exitFocus()
      renderChatPanel(root)
    })
    expect(element.textContent).not.toContain('提交完成')
    expect(element.querySelectorAll('[role="article"], [data-message]')).toHaveLength(0)
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
    const chat = vi.spyOn(agentService, 'chatStream').mockResolvedValue({ content: '还剩五分钟。' })
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
      '还剩多少时间？', expect.objectContaining({ timeRemainingSec: 300 }),
      expect.any(Object), expect.any(AbortSignal),
    )
  })

  it('offers a direct settings link when the provider has no API key', async () => {
    useAppStore.getState().setActiveProblem(problem)
    vi.spyOn(agentService, 'chatStream').mockRejectedValue({
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

  it('explains endpoint and credential errors before linking to provider settings', async () => {
    useAppStore.getState().setActiveProblem(problem)
    vi.spyOn(agentService, 'chatStream').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
        data: { detail: '模型服务认证失败，请检查 Provider API Key。' },
      },
    })
    act(() => renderChatPanel(root))

    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '检查配置')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())

    expect(element.textContent).toContain('检查模型名、Base URL 或 API key 后即可继续对话。')
    expect(element.querySelector<HTMLAnchorElement>('a[href="/settings"]')?.textContent).toBe('检查模型 Provider')
  })

  it('retries a failed message without duplicating the user turn', async () => {
    useAppStore.getState().setActiveProblem(problem)
    const chat = vi.spyOn(agentService, 'chatStream')
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ content: '重试成功。' })
    act(() => renderChatPanel(root))

    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '请给我一个提示')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())

    expect(element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')).not.toBeNull()
    expect(textarea.value).toBe('请给我一个提示')
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')!.click())

    expect(chat).toHaveBeenCalledTimes(2)
    expect(useAppStore.getState().messages.filter(message => message.role === 'user')).toHaveLength(1)
    expect(element.textContent).toContain('重试成功。')
    expect(element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')).toBeNull()
  })

  it('clears a failed retry from the previous problem when the problem changes', async () => {
    useAppStore.getState().setActiveProblem(problem)
    vi.spyOn(agentService, 'chatStream').mockRejectedValue(new Error('temporary failure'))
    act(() => renderChatPanel(root))
    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '旧题消息')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())
    expect(element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')).not.toBeNull()

    act(() => useAppStore.getState().setActiveProblem({ ...problem, id: '2', platformId: 'two' }))
    expect(element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')).toBeNull()
  })

  it('restores the retry action after returning from provider settings', async () => {
    useAppStore.getState().setActiveProblem(problem)
    const chat = vi.spyOn(agentService, 'chatStream')
      .mockRejectedValueOnce(new Error('missing API key'))
      .mockResolvedValueOnce({ content: '设置后重试成功。' })
    act(() => renderChatPanel(root))
    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '用竞赛方式分析')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="发送消息"]')!.click())

    act(() => root.render(null))
    act(() => renderChatPanel(root))
    expect(element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')).not.toBeNull()
    await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')!.click())

    expect(chat).toHaveBeenCalledTimes(2)
    expect(useAppStore.getState().messages.filter(message => message.role === 'user')).toHaveLength(1)
    expect(element.textContent).toContain('设置后重试成功。')
  })

  it('offers retry for an automatic post-submit review without copying its prompt', async () => {
    const review: Msg = {
      id: 'review-user', role: 'user', mode: 'REVIEW', trainingPhase: 'review',
      content: '我刚完成题目，请按 OI/xCPC 复盘。', timestamp: 'now',
    }
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setMode('REVIEW')
    useAppStore.getState().addMessage(review)
    useAppStore.getState().addMessage({
      id: 'review-error', role: 'system', content: '教练暂时无法连接。', timestamp: 'now',
      retryMessageId: review.id,
    })
    const chat = vi.spyOn(agentService, 'chatStream').mockResolvedValue({ content: '自动复盘重试成功。' })
    act(() => renderChatPanel(root))

    const retry = element.querySelector<HTMLButtonElement>('button[aria-label="重试发送消息"]')
    expect(retry).not.toBeNull()
    expect(element.querySelector('textarea')?.value).toBe('')
    await act(async () => retry!.click())

    expect(chat).toHaveBeenCalledWith(
      review.content, expect.objectContaining({ mode: 'REVIEW', trainingPhase: 'review' }),
      expect.any(Object), expect.any(AbortSignal),
    )
    expect(useAppStore.getState().messages.filter(message => message.role === 'user')).toHaveLength(1)
    expect(element.textContent).toContain('自动复盘重试成功。')
  })

  it('runs the next coach turn under the queued mastery path capability', async () => {
    queueCapabilityHandoff('mastery_path')
    useAppStore.getState().setActiveProblem(problem)
    const chat = vi.spyOn(agentService, 'chatStream').mockResolvedValue({ content: '好的，按路径来。' })
    act(() => renderChatPanel(root))
    const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送给 AI 教练的消息"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '带我走下一步')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(chat).toHaveBeenCalledWith('带我走下一步', expect.objectContaining({ capability: 'mastery_path' }), expect.any(Object), expect.any(AbortSignal))
    expect(sessionStorage.getItem('algocoach.capabilityHandoff')).toBeNull()
  })
})
