import React from 'react'
import { X } from 'lucide-react'
import type { LearningBlockId } from '@/services/learningSpace'

const BLOCK_LABELS: Record<LearningBlockId, string> = {
  digest: '今日摘要',
  continue: '继续练习',
  quiz: '每日一题',
  review: '复盘队列',
  knowledge: '知识地图',
  plan: '本周计划',
  insight: 'Agent 洞察',
}

export function BlockCard({ id, children, className = '', onRemove }: { id: LearningBlockId; children: React.ReactNode; className?: string; onRemove?: () => void }) {
  return <section className={`flex flex-col rounded-card border border-border bg-surface p-5 sm:p-6 ${className}`} aria-labelledby={`learning-block-${id}`}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={`learning-block-${id}`} className="text-[15px] font-semibold tracking-title text-text-primary">{BLOCK_LABELS[id]}</h2>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`移除${BLOCK_LABELS[id]}`}
          className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-muted hover:text-text-primary"
        >
          <X size={15} />
        </button>
      )}
    </div>
    {children}
  </section>
}
