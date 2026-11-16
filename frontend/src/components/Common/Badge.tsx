import React from 'react'
import type { Difficulty } from '@/types'

const LABEL: Record<Difficulty, string> = {
  EASY: '简单', MEDIUM: '中等', HARD: '困难',
}

export function Badge({ difficulty }: { difficulty: Difficulty }) {
  const cls = {
    EASY:   'badge-easy',
    MEDIUM: 'badge-medium',
    HARD:   'badge-hard',
  }[difficulty]
  return <span className={`badge ${cls} whitespace-nowrap`}>{LABEL[difficulty]}</span>
}
