export type LearningMode = 'self_paced' | 'contest' | 'maintenance'
export type LearningBlockId = 'digest' | 'continue' | 'review' | 'knowledge' | 'plan' | 'insight'

export interface LearningBlock {
  id: LearningBlockId
  visible: boolean
}

export interface LearningSpaceLayout {
  mode: LearningMode
  blocks: LearningBlock[]
}

export const LEARNING_MODE_OPTIONS: Array<{ id: LearningMode; label: string; description: string }> = [
  { id: 'self_paced', label: '自学模式', description: '按自己的节奏，把概念写成代码。' },
  { id: 'contest', label: '竞赛冲刺', description: '限时训练，提交后马上复盘。' },
  { id: 'maintenance', label: '维护复习', description: '用短练习保持已经掌握的知识。' },
]

const DEFAULT_BLOCKS: LearningBlock[] = [
  { id: 'digest', visible: true },
  { id: 'continue', visible: true },
  { id: 'review', visible: true },
  { id: 'knowledge', visible: true },
  { id: 'plan', visible: true },
  { id: 'insight', visible: true },
]

const LAYOUT_KEY = 'algocoach.learningSpaceLayout'

export function readLearningSpaceLayout(): LearningSpaceLayout {
  try {
    const value = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? 'null') as Partial<LearningSpaceLayout> | null
    const mode = value?.mode === 'contest' || value?.mode === 'maintenance' ? value.mode : 'self_paced'
    const known = new Set<LearningBlockId>(DEFAULT_BLOCKS.map(block => block.id))
    const blocks = Array.isArray(value?.blocks)
      ? value.blocks.filter(block => block && known.has(block.id as LearningBlockId)).map(block => ({
          id: block.id as LearningBlockId,
          visible: block.visible !== false,
        }))
      : DEFAULT_BLOCKS
    const existing = new Set(blocks.map(block => block.id))
    return { mode, blocks: [...blocks, ...DEFAULT_BLOCKS.filter(block => !existing.has(block.id))] }
  } catch {
    return { mode: 'self_paced', blocks: DEFAULT_BLOCKS }
  }
}

export function writeLearningSpaceLayout(layout: LearningSpaceLayout) {
  try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch { /* optional preference storage */ }
}

export function buildModeLayout(mode: LearningMode): LearningSpaceLayout {
  const visibleByMode: Record<LearningMode, LearningBlockId[]> = {
    self_paced: ['digest', 'continue', 'knowledge', 'plan', 'insight'],
    contest: ['digest', 'continue', 'review', 'plan', 'insight'],
    maintenance: ['digest', 'review', 'knowledge', 'insight'],
  }
  const visible = new Set(visibleByMode[mode])
  return { mode, blocks: DEFAULT_BLOCKS.map(block => ({ ...block, visible: visible.has(block.id) })) }
}
