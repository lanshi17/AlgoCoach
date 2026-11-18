import React from 'react'
import { MoreHorizontal, X } from 'lucide-react'
import type { LearningBlockId } from '@/services/learningSpace'

const BLOCK_LABELS: Record<LearningBlockId, string> = {
  digest: '今日摘要',
  continue: '继续练习',
  review: '复盘队列',
  knowledge: '知识地图',
  plan: '本周计划',
  insight: 'Agent 洞察',
}

export function BlockCard({ id, children, className = '', onRemove }: { id: LearningBlockId; children: React.ReactNode; className?: string; onRemove?: () => void }) {
  return <section className={`group rounded-panel bg-surface p-6 dark:bg-surface-dark ${className}`} aria-labelledby={`learning-block-${id}`}>
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 id={`learning-block-${id}`} className="text-xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{BLOCK_LABELS[id]}</h2>
      {onRemove ? <button type="button" onClick={onRemove} aria-label={`移除${BLOCK_LABELS[id]}`} className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted opacity-0 transition-[background-color,color,opacity] group-hover:opacity-100 hover:bg-surface-muted hover:text-text-primary dark:hover:bg-surface-dark-muted dark:hover:text-text-dark-primary"><X size={16} /></button> : <MoreHorizontal size={18} className="text-text-muted" />}
    </div>
    {children}
  </section>
}
