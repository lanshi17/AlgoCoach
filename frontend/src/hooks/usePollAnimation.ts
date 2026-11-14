import { useEffect, useState } from 'react'
import { agentService } from '@/services/agentService'
import type { AnimationJob } from '@/types'

const POLL_INTERVAL_MS = 1500

/** Poll one local Remotion task until it becomes terminal or the component unmounts. */
export function usePollAnimation(jobId: string | null) {
  const [job, setJob] = useState<AnimationJob | null>(null)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      return
    }

    let cancelled = false
    let timeoutId: number | undefined
    setJob({ id: jobId, title: '算法动画', status: 'QUEUED' })

    const poll = async () => {
      try {
        const next = await agentService.pollAnimation(jobId)
        if (cancelled) return
        setJob(next)
        if (next.status === 'QUEUED' || next.status === 'RENDERING') {
          timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch {
        if (cancelled) return
        setJob(current => current ? {
          ...current,
          status: 'FAILED',
          error: '暂时无法读取动画状态，请重试。',
        } : null)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [jobId])

  return job
}
