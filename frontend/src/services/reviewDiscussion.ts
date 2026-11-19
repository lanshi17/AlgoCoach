import { LOCAL_PRACTICE_PROBLEMS } from './localPractice'
import { useAppStore } from '@/stores/useAppStore'
import type { AgentMode, Problem } from '@/types'

export function reviewUnavailableReason(problemKey: string | undefined, activeProblem: Problem | null, mode: AgentMode): string {
  if (!problemKey) return '原练习记录已不存在，无法自动关联题目。'
  if (activeProblem && `${activeProblem.platform}:${activeProblem.platformId}` === problemKey) return ''
  if (mode === 'FOCUS') return '结束当前专注后可切换题目。'
  if (!LOCAL_PRACTICE_PROBLEMS.some(item => `${item.platform}:${item.platformId}` === problemKey)) return '请先打开对应题目，再与 Agent 讨论。'
  return ''
}

/** Switch only when safe and preserve any unsent draft for the target problem. */
export function prepareReviewDiscussion(problemKey: string | undefined, title: string, note: string): boolean {
  const state = useAppStore.getState()
  if (reviewUnavailableReason(problemKey, state.activeProblem, state.mode) || !problemKey) return false
  const same = state.activeProblem && `${state.activeProblem.platform}:${state.activeProblem.platformId}` === problemKey
  if (!same) {
    const problem = LOCAL_PRACTICE_PROBLEMS.find(item => `${item.platform}:${item.platformId}` === problemKey)
    if (!problem) return false
    state.setActiveProblem(problem)
  }
  const current = useAppStore.getState()
  const draft = current.chatDrafts[problemKey] ?? ''
  const prompt = `我正在复盘「${title}」。以下是我的笔记，请结合这些信息帮我检查思路、复杂度和边界条件：\n\n${note}`
  current.setChatDraft(draft.trim() ? `${draft}\n\n${prompt}` : prompt)
  return true
}
