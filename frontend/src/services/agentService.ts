import axios from 'axios'
import { nanoid } from 'nanoid'
import type { AgentProfile, AnimationJob, CoachStyle, KnowledgeEmbeddingConfig, KnowledgeSource, KnowledgeStatus, ModelProviderConfig, TrainingGoal, TrainingPhase } from '@/types'
import { capabilityForMode, LOCAL_WORKSPACE_ID, type DeepTutorCapability } from './deepTutorCapabilities'

interface ChatReply {
  content: string
  animationId?: string
}

export interface ChatStreamHandlers {
  onThinking?: (delta: string) => void
  onText?: (delta: string) => void
}

/** Keep provider/API errors visible in the conversation without raw network details. */
export function getAgentErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ detail?: unknown; message?: unknown }>(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (detail && typeof detail === 'object' && 'message' in detail
      && typeof detail.message === 'string' && detail.message.trim()) return detail.message
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.trim()) {
      if (error.response?.status === 504) return '模型回复超时了，请稍后重试。'
      return message
    }
  }
  return '教练暂时无法连接。请检查模型 Provider 设置后重试。'
}

export function getAgentErrorAction(error: unknown): { href: string; label: string } | null {
  if (!axios.isAxiosError<{ detail?: unknown }>(error)) return null
  const status = error.response?.status
  const detail = error.response?.data?.detail
  if (detail === '当前 Provider 需要 API key，请在设置页配置') {
    return { href: '/settings', label: '配置模型 Provider' }
  }
  if (detail && typeof detail === 'object' && 'code' in detail
    && (detail.code === 'provider_api_key_required' || detail.code === 'provider_model_required')) {
    return { href: '/settings', label: '配置模型 Provider' }
  }
  // Authentication, permission and endpoint errors are usually a bad key,
  // model name or Base URL. Give the user a repair path instead of a dead-end
  // retry button; transient 429/5xx failures remain retry-only.
  if (status === 401 || status === 403 || status === 404) {
    return { href: '/settings', label: '检查模型 Provider' }
  }
  if (typeof detail === 'string' && /API key|Provider|Base URL|Responses API|模型名称/.test(detail)) {
    return { href: '/settings', label: '检查模型 Provider' }
  }
  return null
}

/** Prevent a reply from a pending request from appearing after focus has begun. */
export function canCommitChatReply(
  requestMode: string,
  currentMode: string,
  requestAborted: boolean,
): boolean {
  return requestMode !== 'FOCUS' && currentMode !== 'FOCUS' && !requestAborted
}

interface ChatCtx {
  mode: string
  capability?: DeepTutorCapability
  workspaceId?: string
  problemId?: string
  platform?: string
  code?: string
  codeLanguage?: string
  goal?: TrainingGoal
  trainingPhase?: TrainingPhase
  timeRemainingSec?: number
  animations?: boolean
  coachStyle?: CoachStyle
  provider?: ModelProviderConfig
}

// One in-memory conversation namespace per page lifetime. A refresh clears the
// visible chat, so it must also start fresh short-term model context.
const conversationId = nanoid()
let profileRequest: Promise<AgentProfile> | null = null

/**
 * Python FastAPI agent through the Java gateway at /api/agent/*
 */
export const agentService = {
  async getProfile(): Promise<AgentProfile> {
    if (!profileRequest) {
      profileRequest = axios.get<AgentProfile>('/api/agent/memory/profile', { timeout: 6000 })
        .then(({ data }) => data)
        .finally(() => { profileRequest = null })
    }
    return profileRequest
  },

  async exportMemory(): Promise<Blob> {
    const { data } = await axios.get<Blob>('/api/agent/memory/export', { responseType: 'blob' })
    return data
  },

  async getKnowledgeStatus(): Promise<KnowledgeStatus> {
    const { data } = await axios.get<KnowledgeStatus>('/api/agent/knowledge/status')
    return data
  },

  async updateKnowledgeConfig(config: { provider: KnowledgeEmbeddingConfig['provider']; model: string; baseUrl?: string; apiKey?: string; dimensions?: number | null }): Promise<KnowledgeEmbeddingConfig> {
    const { data } = await axios.put<KnowledgeEmbeddingConfig>('/api/agent/knowledge/config', config)
    return data
  },

  async uploadKnowledgeSources(files: File[]): Promise<KnowledgeSource[]> {
    const body = new FormData()
    files.forEach(file => body.append('files', file))
    const { data } = await axios.post<{ sources: KnowledgeSource[] }>('/api/agent/knowledge/sources', body)
    return data.sources
  },

  async deleteKnowledgeSource(sourceId: string): Promise<void> {
    await axios.delete(`/api/agent/knowledge/sources/${encodeURIComponent(sourceId)}`)
  },

  async reindexKnowledge(): Promise<{ files: number; chunks: number }> {
    const { data } = await axios.post<{ files: number; chunks: number }>('/api/agent/knowledge/reindex')
    return data
  },

  async chatStream(
    message: string,
    ctx: ChatCtx,
    handlers: ChatStreamHandlers = {},
    signal?: AbortSignal,
  ): Promise<ChatReply> {
    const { provider, ...rest } = ctx
    const shouldSendProvider = Boolean(provider?.apiKey) || provider?.protocol === 'ollama'
    const response = await window.fetch('/api/agent/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        message,
        ...rest,
        capability: ctx.capability ?? capabilityForMode(ctx.mode),
        workspaceId: ctx.workspaceId ?? LOCAL_WORKSPACE_ID,
        conversationId,
        ...(shouldSendProvider ? { provider } : {}),
      }),
      signal,
    })
    if (!response.ok) {
      let data: { detail?: unknown; message?: unknown } = {}
      try { data = await response.json() as typeof data } catch { /* use status fallback */ }
      const error = new Error(`chat stream failed: ${response.status}`) as Error & {
        isAxiosError: boolean
        response: { status: number; data: typeof data }
      }
      error.isAxiosError = true
      error.response = { status: response.status, data }
      throw error
    }
    if (!response.body) throw new Error('聊天流没有返回响应体')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let reply: ChatReply | null = null
    const consume = (frame: string) => {
      const line = frame.split(/\r?\n/).find(item => item.startsWith('data:'))
      if (!line) return
      const event = JSON.parse(line.slice(5).trim()) as {
        type: 'thinking' | 'text' | 'done' | 'error'
        delta?: string
        content?: string
        animation_id?: string | null
        status?: number
        detail?: unknown
      }
      if (event.type === 'thinking' && event.delta) handlers.onThinking?.(event.delta)
      if (event.type === 'text' && event.delta) handlers.onText?.(event.delta)
      if (event.type === 'error') {
        const error = new Error('chat stream failed') as Error & {
          isAxiosError: boolean
          response: { status: number; data: { detail?: unknown } }
        }
        error.isAxiosError = true
        error.response = { status: event.status ?? 502, data: { detail: event.detail } }
        throw error
      }
      if (event.type === 'done') {
        reply = { content: event.content ?? '', animationId: event.animation_id ?? undefined }
      }
    }
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        consume(frame)
        boundary = buffer.indexOf('\n\n')
      }
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
    if (!reply) throw new Error('聊天流提前结束')
    return reply
  },

  async requestAnimation(type: string, topic: string, title: string, problemId?: string) {
    const { data } = await axios.post<{ job_id?: string; jobId?: string }>('/api/agent/animate', {
      type, topic, title, problemId,
    })
    const id = data.job_id ?? data.jobId
    if (!id) throw new Error('动画任务没有返回编号')
    return id
  },

  async pollAnimation(jobId: string): Promise<AnimationJob> {
    const { data } = await axios.get<AnimationJob>(`/api/agent/animate/${jobId}`)
    return data
  },
}
