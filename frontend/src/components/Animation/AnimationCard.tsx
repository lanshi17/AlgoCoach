import React from 'react'
import { Loader2, Film, RefreshCw } from 'lucide-react'
import type { AnimationJob } from '@/types'

/**
 * Renders a Remotion animation inline in the chat panel.
 * When the video URL is ready, shows an <video> player.
 * While rendering, shows a progress skeleton.
 */
export default function AnimationCard({ job, onRetry }: { job: AnimationJob; onRetry?: () => void }) {
  if (job.status === 'RENDERING' || job.status === 'QUEUED') {
    return (
      <div className="rounded-xl border border-border dark:border-border-dark overflow-hidden
                      bg-surface-soft dark:bg-surface-dark-soft">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border dark:border-border-dark">
          <Loader2 size={14} className="text-accent animate-spin" />
          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
            正在生成动画：{job.title}
          </span>
        </div>
        <div className="aspect-video bg-surface-muted dark:bg-surface-dark-muted animate-pulse" />
      </div>
    )
  }

  if (job.status === 'READY' && job.videoUrl) {
    return (
      <div className="rounded-xl border border-border dark:border-border-dark overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-soft dark:bg-surface-dark-soft
                        border-b border-border dark:border-border-dark">
          <Film size={14} className="text-accent" />
          <span className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
            {job.title}
          </span>
        </div>
        <video
          src={job.videoUrl}
          controls
          autoPlay
          loop
          className="w-full"
          style={{ maxHeight: '300px' }}
        />
      </div>
    )
  }

  if (job.status === 'FAILED') {
    return (
      <div role="alert" className="rounded-lg border border-border p-4 dark:border-border-dark">
        <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{job.error ?? `动画「${job.title}」没有生成成功。`}</p>
        {onRetry && <button type="button" onClick={onRetry} aria-label="再次生成动画"
          className="mt-3 inline-flex items-center gap-2 text-xs text-accent hover:underline">
          <RefreshCw size={13} /> 再试一次
        </button>}
      </div>
    )
  }

  return null
}
