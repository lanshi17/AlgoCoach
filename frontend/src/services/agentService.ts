import axios from 'axios'
import { nanoid } from 'nanoid'
import type { AgentProfile, AnimationJob, CoachStyle, KnowledgeEmbeddingConfig, KnowledgeSource, KnowledgeStatus, MasteryPath, ModelProviderConfig, TrainingGoal, TrainingPhase } from '@/types'
import { capabilityForMode, getWorkspaceId, type DeepTutorCapability } from './deepTutorCapabilities'

interface ChatReply {
  content: string
  animationId?: string
  turnId?: string
}

export interface TurnReplayEvent {
  type: 'thinking' | 'text' | 'done' | 'error'
  delta?: string
  content?: string
  animation_id?: string | null
  status?: number
  detail?: unknown
  turn_id?: string
  event_id?: number
}

export interface TurnReplay {
  turnId: string
  workspaceId: string
  conversationId: string
  capability: DeepTutorCapability
  state: 'running' | 'completed' | 'failed'
  events: TurnReplayEvent[]
}

export interface ChatStreamHandlers {
  onThinking?: (delta: string) => void
  onText?: (delta: string) => void
}

async function replayPersistedTurn(turnId: string, afterSequence = 0): Promise<TurnReplay> {
  const response = await window.fetch('/api/agent/chat/replay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ turnId, afterSequence }),
  })
  if (!response.ok) throw new Error(`turn replay failed: ${response.status}`)
  return await response.json() as TurnReplay
}

function completedReplay(replay: TurnReplay, fallbackTurnId: string): ChatReply | null {
  const done = [...replay.events].reverse().find(event => event.type === 'done')
  if (!done) return null
  const streamedContent = replay.events
    .filter(event => event.type === 'text')
    .map(event => event.delta ?? event.content ?? '')
    .join('')
  return {
    content: done.content?.trim() ? done.content : streamedContent,
    animationId: done.animation_id ?? undefined,
    turnId: done.turn_id ?? fallbackTurnId,
  }
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
  if (error instanceof Error && error.message.trim()) {
    if (error.message.includes('教练没有返回内容')) return error.message
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
  conversationId?: string
  capability?: DeepTutorCapability
  workspaceId?: string
  turnId?: string
  afterSequence?: number
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
const profileRequests = new Map<string, Promise<AgentProfile>>()

function workspaceScopedPath(path: string): string {
  const workspaceId = getWorkspaceId()
  return workspaceId === 'local-default'
    ? path
    : `${path}?workspaceId=${encodeURIComponent(workspaceId)}`
}

/**
 * Python FastAPI agent through the Java gateway at /api/agent/*
 */
export const agentService = {
  async getMemoryPatterns(): Promise<Array<{ id: number; description: string; frequency: number; lastSeen: string }>> {
    const { data } = await axios.get(workspaceScopedPath('/api/agent/memory/patterns'))
    return data
  },

  async deleteMemoryPattern(id: number): Promise<void> {
    await axios.delete(workspaceScopedPath(`/api/agent/memory/patterns/${id}`))
  },
  async getProfile(): Promise<AgentProfile> {
    const workspaceId = getWorkspaceId()
    const existing = profileRequests.get(workspaceId)
    if (existing) return existing
    const request = axios.get<AgentProfile>(workspaceScopedPath('/api/agent/memory/profile'), { timeout: 6000 })
      .then(({ data }) => data)
      .finally(() => { profileRequests.delete(workspaceId) })
    profileRequests.set(workspaceId, request)
    return request
  },

  async getMasteryPath(limit = 6): Promise<MasteryPath> {
    const workspaceId = getWorkspaceId()
    const query = new URLSearchParams({ limit: String(Math.max(1, Math.min(12, Math.trunc(limit)))) })
    if (workspaceId !== 'local-default') query.set('workspaceId', workspaceId)
    const { data } = await axios.get<MasteryPath>(`/api/agent/memory/mastery-path?${query.toString()}`)
    return data
  },

  async exportMemory(): Promise<Blob> {
    const { data } = await axios.get<Blob>(workspaceScopedPath('/api/agent/memory/export'), { responseType: 'blob' })
    return data
  },

  async getKnowledgeStatus(): Promise<KnowledgeStatus> {
    const { data } = await axios.get<KnowledgeStatus>(workspaceScopedPath('/api/agent/knowledge/status'))
    return data
  },

  async updateKnowledgeConfig(config: { provider: KnowledgeEmbeddingConfig['provider']; model: string; baseUrl?: string; apiKey?: string; dimensions?: number | null }): Promise<KnowledgeEmbeddingConfig> {
    const { data } = await axios.put<KnowledgeEmbeddingConfig>('/api/agent/knowledge/config', config)
    return data
  },

  async uploadKnowledgeSources(files: File[]): Promise<KnowledgeSource[]> {
    const body = new FormData()
    files.forEach(file => body.append('files', file))
    const { data } = await axios.post<{ sources: KnowledgeSource[] }>(workspaceScopedPath('/api/agent/knowledge/sources'), body)
    return data.sources
  },

  async deleteKnowledgeSource(sourceId: string): Promise<void> {
    await axios.delete(workspaceScopedPath(`/api/agent/knowledge/sources/${encodeURIComponent(sourceId)}`))
  },

  async reindexKnowledge(): Promise<{ files: number; chunks: number }> {
    const { data } = await axios.post<{ files: number; chunks: number }>(workspaceScopedPath('/api/agent/knowledge/reindex'))
    return data
  },

  async chatStream(
    message: string,
    ctx: ChatCtx,
    handlers: ChatStreamHandlers = {},
    signal?: AbortSignal,
  ): Promise<ChatReply> {
    const { provider, ...rest } = ctx
    const turnId = ctx.turnId ?? nanoid()
    const shouldSendProvider = Boolean(provider?.apiKey) || provider?.protocol === 'ollama'
    let response: Response
    try {
      response = await window.fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          message,
          ...rest,
          capability: ctx.capability ?? capabilityForMode(ctx.mode),
          workspaceId: ctx.workspaceId ?? getWorkspaceId(),
          turnId,
          afterSequence: ctx.afterSequence ?? 0,
          conversationId: ctx.conversationId ?? conversationId,
          ...(shouldSendProvider ? { provider } : {}),
        }),
        signal,
      })
    } catch (error) {
      if (!signal?.aborted) {
        const replay = await replayPersistedTurn(turnId).catch(() => null)
        const recovered = replay ? completedReplay(replay, turnId) : null
        if (recovered) return recovered
      }
      throw error
    }
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
    // Keep a private copy even when the caller does not need live streaming
    // callbacks (the automatic post-submit review is one such caller).
    let streamedContent = ''
    const consume = (frame: string) => {
      const line = frame.split(/\r?\n/).find(item => item.startsWith('data:'))
      if (!line) return
      const event = JSON.parse(line.slice(5).trim()) as {
        type: 'thinking' | 'text' | 'done' | 'error'
        delta?: string
        content?: string
        animation_id?: string | null
        turn_id?: string
        status?: number
        detail?: unknown
      }
      if (event.type === 'thinking' && event.delta) handlers.onThinking?.(event.delta)
      if (event.type === 'text' && event.delta) {
        streamedContent += event.delta
        handlers.onText?.(event.delta)
      }
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
        reply = {
          content: event.content?.trim() ? event.content : streamedContent,
          animationId: event.animation_id ?? undefined,
          turnId: event.turn_id ?? turnId,
        }
      }
    }
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      let boundary = /\r?\n\r?\n/.exec(buffer)
      while (boundary && boundary.index !== undefined) {
        const frame = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        consume(frame)
        boundary = /\r?\n\r?\n/.exec(buffer)
      }
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
    if (!reply && !signal?.aborted) {
      const replay = await replayPersistedTurn(turnId).catch(() => null)
      const recovered = replay ? completedReplay(replay, turnId) : null
      if (recovered) return recovered
    }
    const finalReply = reply as ChatReply | null
    if (finalReply === null) throw new Error('聊天流提前结束')
    if (!finalReply.content.trim()) throw new Error('教练没有返回内容，请重试。')
    return finalReply
  },

  async replayTurn(turnId: string, afterSequence = 0): Promise<TurnReplay> {
    return replayPersistedTurn(turnId, afterSequence)
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
