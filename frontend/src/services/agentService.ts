import axios from 'axios'
import type { AgentProfile, AnimationJob, TrainingGoal } from '@/types'

interface ChatReply {
  content: string
  animationId?: string
}

/** OI / xCPC training stance understood by the backend chat route. */
export type TrainingPhase =
  | 'auto'
  | 'virtual_contest'
  | 'topic_drill'
  | 'attempt'
  | 'hint'
  | 'review'
  | 'upsolve'

interface ChatCtx {
  mode: string
  problemId?: string
  goal?: TrainingGoal
  trainingPhase?: TrainingPhase
  timeRemainingSec?: number
}

/**
 * Python FastAPI agent through the Java gateway at /api/agent/*
 */
export const agentService = {
  async getProfile(): Promise<AgentProfile> {
    const { data } = await axios.get<AgentProfile>('/api/agent/memory/profile')
    return data
  },

  async exportMemory(): Promise<Blob> {
    const { data } = await axios.get<Blob>('/api/agent/memory/export', { responseType: 'blob' })
    return data
  },

  async chat(message: string, ctx: ChatCtx): Promise<ChatReply> {
    const { data } = await axios.post<ChatReply>('/api/agent/chat', { message, ...ctx })
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
