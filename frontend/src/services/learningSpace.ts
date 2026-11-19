import { workspaceStorageKey } from './deepTutorCapabilities'

export type LearningMode = 'self_paced' | 'contest' | 'maintenance'
export type LearningBlockId = 'digest' | 'continue' | 'quiz' | 'review' | 'knowledge' | 'plan' | 'insight'

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
  { id: 'quiz', visible: true },
  { id: 'knowledge', visible: true },
  { id: 'plan', visible: true },
  { id: 'insight', visible: true },
]

const LAYOUT_KEY = workspaceStorageKey('algocoach.learningSpaceLayout')

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
    const order = new Map(DEFAULT_BLOCKS.map((block, index) => [block.id, index]))
    return {
      mode,
      blocks: [...blocks, ...DEFAULT_BLOCKS.filter(block => !existing.has(block.id))]
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
    }
  } catch {
    return { mode: 'self_paced', blocks: DEFAULT_BLOCKS }
  }
}

export function writeLearningSpaceLayout(layout: LearningSpaceLayout) {
  try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch { /* optional preference storage */ }
}

export function buildModeLayout(mode: LearningMode): LearningSpaceLayout {
  const visibleByMode: Record<LearningMode, LearningBlockId[]> = {
    self_paced: ['digest', 'continue', 'review', 'quiz', 'knowledge', 'plan', 'insight'],
    contest: ['digest', 'continue', 'quiz', 'review', 'plan', 'insight'],
    maintenance: ['digest', 'review', 'knowledge', 'insight'],
  }
  const visible = new Set(visibleByMode[mode])
  return { mode, blocks: DEFAULT_BLOCKS.map(block => ({ ...block, visible: visible.has(block.id) })) }
}

export interface WeekActivity {
  practice: number[]
  reviews: number[]
  practiceTotal: number
  reviewTotal: number
}

export function getWeekActivity(
  records: Array<{ endedAt: string }>,
  reviews: Array<{ reviewedAt: string }>,
  now = new Date(),
): WeekActivity {
  const mondayOffset = (now.getDay() + 6) % 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)
  const practice = Array(7).fill(0) as number[]
  const reviewCounts = Array(7).fill(0) as number[]
  const indexFor = (value: string) => {
    const date = new Date(value)
    const offset = Math.floor((date.getTime() - monday.getTime()) / 86400000)
    return offset >= 0 && offset < 7 && date >= monday ? offset : -1
  }
  records.forEach(record => { const index = indexFor(record.endedAt); if (index >= 0) practice[index] += 1 })
  reviews.forEach(review => { const index = indexFor(review.reviewedAt); if (index >= 0) reviewCounts[index] += 1 })
  return { practice, reviews: reviewCounts, practiceTotal: practice.reduce((sum, value) => sum + value, 0), reviewTotal: reviewCounts.reduce((sum, value) => sum + value, 0) }
}

export interface DailyQuizContent {
  question: string
  options: string[]
  answer: number
  explanation: string
  retry: string
}

export function dailyQuizForProblem(problem: { topics: string[] }): DailyQuizContent {
  if (problem.topics.some(topic => topic.includes('二分'))) {
    return { question: '二分查找里，为什么常写成 left + (right - left) / 2？', options: ['避免数组下标从 0 开始', '避免 left + right 可能溢出', '让循环自动排序', '让编译器生成更快的代码'], answer: 1, explanation: '答对了。先保证中间值不会溢出，再谈边界条件。', retry: '再想一下：当两个下标都很大时，哪一步可能先出问题？' }
  }
  if (problem.topics.some(topic => topic.includes('哈希'))) {
    return { question: '两数之和用哈希表时，为什么查找的是 target - 当前值？', options: ['它是当前值的补数，和当前值相加才等于 target', '哈希表只能存负数', '这样可以自动排序', '为了让数组变长'], answer: 0, explanation: '答对了。补数关系把两层枚举变成一次查找。', retry: '再想一下：当前值已经固定，还缺多少才能达到 target？' }
  }
  return { question: '开始一道新题前，哪一步最能减少无效编码？', options: ['先复述输入、输出和约束', '直接套用最长的模板', '先改变量名', '跳过样例'], answer: 0, explanation: '答对了。先确认约束，才能判断模型和复杂度。', retry: '再想一下：没有输入输出和约束，怎么判断解法是否适用？' }
}
