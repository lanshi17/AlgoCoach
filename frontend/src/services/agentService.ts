import axios from 'axios'
import { nanoid } from 'nanoid'
import type { AgentProfile, AnimationJob, ModelProviderConfig, TrainingGoal, TrainingPhase } from '@/types'

interface ChatReply {
  content: string
  animationId?: string
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
  problemId?: string
  platform?: string
  goal?: TrainingGoal
  trainingPhase?: TrainingPhase
  timeRemainingSec?: number
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
      profileRequest = axios.get<AgentProfile>('/api/agent/memory/profile')
        .then(({ data }) => data)
        .finally(() => { profileRequest = null })
    }
    return profileRequest
  },

  async exportMemory(): Promise<Blob> {
    const { data } = await axios.get<Blob>('/api/agent/memory/export', { responseType: 'blob' })
    return data
  },

  async chat(message: string, ctx: ChatCtx, signal?: AbortSignal): Promise<ChatReply> {
    const { provider, ...rest } = ctx
    const shouldSendProvider = Boolean(provider?.apiKey) || provider?.protocol === 'ollama'
    const { data } = await axios.post<ChatReply>('/api/agent/chat', {
      message,
      ...rest,
      conversationId,
      ...(shouldSendProvider ? { provider } : {}),
    }, { signal })
    return data
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
