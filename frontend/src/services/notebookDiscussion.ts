import { useAppStore } from '@/stores/useAppStore'

/** Put a notebook note into the current coach draft without requiring a problem. */
export function prepareNotebookDiscussion(title: string, body: string, tags: string[]): void {
  const state = useAppStore.getState()
  const key = state.activeProblem
    ? `${state.activeProblem.platform}:${state.activeProblem.platformId}`
    : '__global__'
  const existing = state.chatDrafts[key] ?? ''
  const tagLine = tags.length ? `标签：${tags.join('、')}\n` : ''
  const prompt = `我想讨论学习笔记「${title}」。\n${tagLine}\n${body.trim()}\n\n请用提问和验证的方式，帮我检查其中的直觉、证明、复杂度和边界条件。`
  state.setChatDraft(existing.trim() ? `${existing}\n\n${prompt}` : prompt)
}
