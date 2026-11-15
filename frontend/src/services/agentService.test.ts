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
})

describe('focus chat guard', () => {
  it('discards a pending reply when focus starts or the request is aborted', () => {
    expect(canCommitChatReply('PREP', 'FOCUS', false)).toBe(false)
    expect(canCommitChatReply('PREP', 'PREP', true)).toBe(false)
    expect(canCommitChatReply('FOCUS', 'FOCUS', false)).toBe(false)
    expect(canCommitChatReply('PREP', 'PREP', false)).toBe(true)
  })

  it('passes an AbortSignal to the chat request', async () => {
    const controller = new AbortController()
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { content: 'ok' } })

    await agentService.chat('hello', { mode: 'PREP' }, controller.signal)

    expect(post).toHaveBeenCalledWith(
      '/api/agent/chat',
      expect.objectContaining({ message: 'hello', mode: 'PREP' }),
      { signal: controller.signal },
    )
  })

  it('uses a stable conversation identifier for requests in this page', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { content: 'ok' } })
    await agentService.chat('first', { mode: 'IDLE' })
    await agentService.chat('second', { mode: 'IDLE' })
    const first = post.mock.calls[0][1] as { conversationId: string }
    const second = post.mock.calls[1][1] as { conversationId: string }
    expect(first.conversationId).toEqual(expect.any(String))
    expect(second.conversationId).toBe(first.conversationId)
  })
})
