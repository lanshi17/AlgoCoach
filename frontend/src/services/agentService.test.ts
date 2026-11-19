import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentService, canCommitChatReply, getAgentErrorAction, getAgentErrorMessage } from './agentService'

afterEach(() => { vi.restoreAllMocks() })

describe('getAgentErrorMessage', () => {
  it('uses the gateway message for timeout responses', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 504,
        data: { message: '上游服务响应超时，请稍后重试' },
      },
    }

    expect(getAgentErrorMessage(error)).toBe('模型回复超时了，请稍后重试。')
  })

  it('keeps actionable Agent details from the transparent proxy', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 502,
        data: { detail: '模型或 Responses API 路径不存在，请检查 Base URL。' },
      },
    }

    expect(getAgentErrorMessage(error)).toBe('模型或 Responses API 路径不存在，请检查 Base URL。')
  })
})

describe('getAgentErrorAction', () => {
  it('links missing provider credentials directly to model settings', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: {
          code: 'provider_api_key_required',
          message: '当前 Provider 需要 API key，请在设置页配置',
        } },
      },
    }

    expect(getAgentErrorMessage(error)).toBe('当前 Provider 需要 API key，请在设置页配置')
    expect(getAgentErrorAction(error)).toEqual({
      href: '/settings',
      label: '配置模型 Provider',
    })
  })

  it('does not offer a provider settings action for unrelated errors', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 502,
        data: { detail: '模型服务暂时不可用，请稍后重试。' },
      },
    }

    expect(getAgentErrorAction(error)).toBeNull()
  })

  it('offers provider settings for authentication and endpoint errors', () => {
    const authError = {
      isAxiosError: true,
      response: { status: 401, data: { detail: '模型服务认证失败，请检查 Provider API Key。' } },
    }
    const endpointError = {
      isAxiosError: true,
      response: { status: 404, data: { detail: '模型或 Responses API 路径不存在。' } },
    }

    expect(getAgentErrorAction(authError)).toEqual({ href: '/settings', label: '检查模型 Provider' })
    expect(getAgentErrorAction(endpointError)).toEqual({ href: '/settings', label: '检查模型 Provider' })
  })
})

describe('focus chat guard', () => {
  it('discards a pending reply when focus starts or the request is aborted', () => {
    expect(canCommitChatReply('PREP', 'FOCUS', false)).toBe(false)
    expect(canCommitChatReply('PREP', 'PREP', true)).toBe(false)
    expect(canCommitChatReply('FOCUS', 'FOCUS', false)).toBe(false)
    expect(canCommitChatReply('PREP', 'PREP', false)).toBe(true)
  })

  it('parses streamed thinking and answer deltas', async () => {
    const nativeFetch = window.fetch
    const nativeReadableStream = (window as unknown as { ReadableStream?: typeof ReadableStream }).ReadableStream
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Chrome' })
    Object.defineProperty(window, 'ReadableStream', { configurable: true, value: ReadableStream })
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'data: {"type":"thinking","delta":"先看约束。"}\n\n'
          + 'data: {"type":"text","delta":"复杂度是 O(n)。"}\n\n'
          + 'data: {"type":"done","content":"复杂度是 O(n)。","animation_id":null}\n\n',
        ))
        controller.close()
      },
    })
    const fetch = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch })
    const thinking: string[] = []
    const text: string[] = []
    const reply = await agentService.chatStream('hello', { mode: 'PREP' }, {
      onThinking: delta => thinking.push(delta),
      onText: delta => text.push(delta),
    })

    expect(reply).toMatchObject({ content: '复杂度是 O(n)。', turnId: expect.any(String) })
    expect(thinking).toEqual(['先看约束。'])
    expect(text).toEqual(['复杂度是 O(n)。'])
    expect(fetch).toHaveBeenCalledWith('/api/agent/chat/stream', expect.objectContaining({ method: 'POST' }))
    const requestBody = JSON.parse(fetch.mock.calls[0][1].body as string) as { capability: string; workspaceId: string }
    expect(requestBody).toMatchObject({ capability: 'chat', workspaceId: 'local-default' })
    Object.defineProperty(window, 'fetch', { configurable: true, value: nativeFetch })
    Object.defineProperty(window, 'ReadableStream', { configurable: true, value: nativeReadableStream })
  })

  it('uses a stable conversation identifier for requests in this page', async () => {
    const nativeFetch = window.fetch
    const fetch = vi.fn().mockImplementation(() => new Response(
      'data: {"type":"done","content":"ok","animation_id":null}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ))
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch })
    await agentService.chatStream('first', { mode: 'IDLE' })
    await agentService.chatStream('second', { mode: 'IDLE' })
    const first = JSON.parse(fetch.mock.calls[0][1].body as string) as { conversationId: string }
    const second = JSON.parse(fetch.mock.calls[1][1].body as string) as { conversationId: string }
    expect(first.conversationId).toEqual(expect.any(String))
    expect(second.conversationId).toBe(first.conversationId)
    Object.defineProperty(window, 'fetch', { configurable: true, value: nativeFetch })
  })

  it('replays a persisted turn from the gateway without opening a model stream', async () => {
    const nativeFetch = window.fetch
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      turnId: 'turn-1', workspaceId: 'local-default', conversationId: 'page-1',
      capability: 'chat', state: 'completed', events: [{ type: 'done', event_id: 2 }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch })

    await expect(agentService.replayTurn('turn-1', 1)).resolves.toMatchObject({
      turnId: 'turn-1', state: 'completed',
    })
    expect(fetch).toHaveBeenCalledWith('/api/agent/chat/replay', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ turnId: 'turn-1', afterSequence: 1 }),
    }))
    Object.defineProperty(window, 'fetch', { configurable: true, value: nativeFetch })
  })

  it('recovers a completed turn when the SSE closes before its done event', async () => {
    const nativeFetch = window.fetch
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('data: {"type":"text","delta":"半截"}\n\n', {
        status: 200, headers: { 'Content-Type': 'text/event-stream' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        turnId: 'recovered-turn', workspaceId: 'local-default', conversationId: 'page-1',
        capability: 'chat', state: 'completed',
        events: [{ type: 'done', content: '完整回答', turn_id: 'recovered-turn', event_id: 2 }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch })

    const reply = await agentService.chatStream('hello', { mode: 'PREP' })
    expect(reply).toMatchObject({ content: '完整回答', turnId: 'recovered-turn' })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toBe('/api/agent/chat/replay')
    Object.defineProperty(window, 'fetch', { configurable: true, value: nativeFetch })
  })

  it('deduplicates concurrent profile reads and releases the request after failure', async () => {
    let rejectProfile!: (error: Error) => void
    const get = vi.spyOn(axios, 'get')
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectProfile = reject }) as never)
      .mockResolvedValueOnce({ data: { topics: [], edges: [], recentProblems: [], dailyAttempts: [], stats: {} } })

    const first = agentService.getProfile()
    const second = agentService.getProfile()
    expect(get).toHaveBeenCalledTimes(1)
    rejectProfile(new Error('offline'))
    await expect(first).rejects.toThrow('offline')
    await expect(second).rejects.toThrow('offline')

    await agentService.getProfile()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('sends the active workspace when reading profile data', async () => {
    localStorage.setItem('algocoach.workspaceId', 'team-a')
    const get = vi.spyOn(axios, 'get').mockResolvedValue({
      data: { topics: [], edges: [], recentProblems: [], dailyAttempts: [], stats: {} },
    })

    await agentService.getProfile()

    expect(get).toHaveBeenCalledWith(
      '/api/agent/memory/profile?workspaceId=team-a',
      { timeout: 6000 },
    )
    localStorage.clear()
  })

  it('reads a bounded mastery path in the active workspace', async () => {
    localStorage.setItem('algocoach.workspaceId', 'team-a')
    const get = vi.spyOn(axios, 'get').mockResolvedValue({
      data: { workspaceId: 'team-a', generatedAt: '', steps: [], emptyReason: null, sourceSummary: { topics: 0, dueReviews: 0 } },
    })

    await agentService.getMasteryPath(99)

    expect(get).toHaveBeenCalledWith('/api/agent/memory/mastery-path?limit=12&workspaceId=team-a')
    localStorage.clear()
  })
})
