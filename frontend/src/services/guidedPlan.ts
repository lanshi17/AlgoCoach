import type { TrainingGoal } from '@/types'

export type GuidedStageType = 'concept' | 'choice' | 'short' | 'code' | 'review'

export interface GuidedStage {
  id: string
  name: string
  type: GuidedStageType
  instruction: string
}

export const MAX_GUIDED_INSTRUCTION_LENGTH = 600

const GOAL_LABELS: Record<TrainingGoal, string> = {
  interview_prep: '面试准备',
  contest: '竞赛训练',
  casual: '兴趣学习',
}

const STAGE_INSTRUCTIONS: Record<GuidedStageType, string> = {
  concept: '讲解这个知识点的核心概念、适用场景和一个简单例子。不要提前出题，等待学生理解。',
  choice: '根据刚才的知识点出一道单选题。先写题干，再逐行给出 A. 到 D. 四个选项。最后单独一行写 [[答案:A]]（将 A 替换为正确选项字母）。正文不要透露答案或解析。',
  short: '出一道需要解释思路的简答题，不要提前给答案，等待学生回答。',
  code: '给出一道循序渐进的编程练习，包括题意、输入输出、约束和样例，不要给完整答案，等待学生提交代码。',
  review: '根据本次对话中实际给出的回答和代码进行复盘，区分已验证事实与待验证风险，指出下一步。没有提交代码时明确说明。',
}

const STAGE_TYPES: readonly GuidedStageType[] = ['concept', 'choice', 'short', 'code', 'review']

const TYPE_ALIASES: Record<string, GuidedStageType> = {
  concept: 'concept',
  knowledge: 'concept',
  learn: 'concept',
  概念: 'concept',
  知识点: 'concept',
  讲解: 'concept',
  choice: 'choice',
  quiz: 'choice',
  single_choice: 'choice',
  选择: 'choice',
  选择题: 'choice',
  short: 'short',
  answer: 'short',
  short_answer: 'short',
  问答: 'short',
  问答题: 'short',
  简答: 'short',
  简答题: 'short',
  code: 'code',
  coding: 'code',
  programming: 'code',
  exercise: 'code',
  编程: 'code',
  编程题: 'code',
  代码: 'code',
  编码: 'code',
  review: 'review',
  summary: 'review',
  recap: 'review',
  复盘: 'review',
  总结: 'review',
  回顾: 'review',
}

const MAX_STAGES = 8

export const MAX_GUIDED_STAGES = MAX_STAGES

export const GUIDED_STAGE_TYPE_LABEL: Record<GuidedStageType, string> = {
  concept: '概念',
  choice: '选择',
  short: '问答',
  code: '编程',
  review: '复盘',
}

/** The coach instruction used when a type is created or switched without custom text. */
export function defaultGuidedInstruction(type: GuidedStageType): string {
  return STAGE_INSTRUCTIONS[type]
}

/** Creates a stage with the default coach instruction for its type. */
export function newGuidedStage(type: GuidedStageType, name: string, id: string): GuidedStage {
  return { id, name, type, instruction: defaultGuidedInstruction(type) }
}

/**
 * Checks a learner-edited outline. The page requires a final review and a code
 * stage; names double as restore markers, so they must be unique and non-empty.
 */
export function validateGuidedOutline(stages: GuidedStage[]): string | null {
  if (stages.length > MAX_STAGES) return `最多保留 ${MAX_STAGES} 个阶段。`
  if (stages.length < 2) return '至少保留两个阶段。'
  const names = stages.map(stage => stage.name.trim())
  if (names.some(name => !name)) return '阶段名称不能为空。'
  if (new Set(names).size !== names.length) return '阶段名称不能重复。'
  const instructions = stages.map(stage => stage.instruction.trim())
  if (instructions.some(instruction => !instruction)) return '教练指令不能为空。'
  if (instructions.some(instruction => instruction.length > MAX_GUIDED_INSTRUCTION_LENGTH)) return `教练指令最多 ${MAX_GUIDED_INSTRUCTION_LENGTH} 个字符。`
  if (stages.filter(stage => stage.type === 'review').length !== 1) return '只能保留一个复盘阶段。'
  if (stages[stages.length - 1].type !== 'review') return '最后一个阶段必须是复盘。'
  if (!stages.some(stage => stage.type === 'code')) return '至少保留一个编程阶段。'
  return null
}

export const DEFAULT_GUIDED_STAGES: GuidedStage[] = [
  { id: 'default-concept', name: '学习知识点', type: 'concept', instruction: STAGE_INSTRUCTIONS.concept },
  { id: 'default-choice', name: '选择题', type: 'choice', instruction: STAGE_INSTRUCTIONS.choice },
  { id: 'default-short', name: '问答题', type: 'short', instruction: STAGE_INSTRUCTIONS.short },
  { id: 'default-code', name: '编程题', type: 'code', instruction: STAGE_INSTRUCTIONS.code },
  { id: 'default-review', name: '复盘', type: 'review', instruction: STAGE_INSTRUCTIONS.review },
]

export function stageNeedsAnswer(stage: GuidedStage | undefined): boolean {
  return stage?.type === 'choice' || stage?.type === 'short' || stage?.type === 'code'
}

export function buildGuidedPlanPrompt(topic: string, goal?: TrainingGoal): string {
  return `你是 AlgoCoach 的学习规划师。请为学习主题「${topic}」规划本次学习的阶段大纲。
训练目标：${goal ? GOAL_LABELS[goal] : '算法能力提升'}。
要求：
1. 规划 4 到 7 个阶段，从该主题的概念理解开始，逐步过渡到选择题、问答题和编程练习，最后必须是复盘阶段。
2. 阶段 type 只能使用 concept（概念讲解）、choice（单选题）、short（简答题）、code（编程题）、review（复盘）。
3. 至少包含一个 code 阶段，名称和 instruction 要具体到该主题，不要只写“编程题”。
4. instruction 是给教练的执行指令，要说明该阶段讲什么、问什么或练什么；不要提前给出答案。
5. 只输出 JSON，不要 Markdown 代码块，不要解释。
输出格式：
{"stages":[{"name":"阶段名称","type":"concept","instruction":"给教练的指令"}]}`
}

function normalizeType(value: unknown): GuidedStageType | null {
  if (typeof value !== 'string') return null
  const key = value.trim().toLowerCase()
  if ((STAGE_TYPES as readonly string[]).includes(key)) return key as GuidedStageType
  return TYPE_ALIASES[key] ?? TYPE_ALIASES[value.trim()] ?? null
}

function textField(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

function readStageArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['stages', 'outline', 'plan', 'steps']) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  return null
}

function normalizePlan(value: unknown): GuidedStage[] | null {
  const items = readStageArray(value)
  if (!items) return null
  const stages: GuidedStage[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const name = textField(record.name ?? record.title ?? record.label, 40)
    const type = normalizeType(record.type ?? record.kind ?? record.stageType)
    if (!name || !type) continue
    const instruction = textField(
      record.instruction ?? record.prompt ?? record.description ?? record.goal,
      MAX_GUIDED_INSTRUCTION_LENGTH,
    ) || STAGE_INSTRUCTIONS[type]
    stages.push({ id: `plan-stage-${stages.length + 1}`, name, type, instruction })
  }
  if (!stages.length) return null

  // Keep exactly one final review and guarantee a programming stage. The
  // learning page relies on a code stage to open the dedicated editor.
  const reviews = stages.filter(stage => stage.type === 'review')
  const core = stages.filter(stage => stage.type !== 'review').slice(0, MAX_STAGES - 1)
  if (!core.some(stage => stage.type === 'code')) {
    core.push({
      id: 'plan-stage-code',
      name: '编程练习',
      type: 'code',
      instruction: STAGE_INSTRUCTIONS.code,
    })
  }
  const review = reviews[reviews.length - 1] ?? {
    id: 'plan-stage-review',
    name: '复盘',
    type: 'review' as const,
    instruction: STAGE_INSTRUCTIONS.review,
  }
  return [...core.slice(0, MAX_STAGES - 1), review].map((stage, index) => ({
    ...stage,
    id: `plan-stage-${index + 1}`,
  }))
}

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const source = fenced?.[1] ?? text
  const objectStart = source.indexOf('{')
  const objectEnd = source.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) {
    try { return JSON.parse(source.slice(objectStart, objectEnd + 1)) } catch { /* try an array next */ }
  }
  const arrayStart = source.indexOf('[')
  const arrayEnd = source.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try { return JSON.parse(source.slice(arrayStart, arrayEnd + 1)) } catch { /* invalid outline */ }
  }
  return null
}

/** Parse the model's outline response. Null means the response had no usable stages. */
export function parseGuidedPlan(text: string): GuidedStage[] | null {
  return normalizePlan(extractJson(text))
}

/** Validate an outline restored from session storage. */
export function sanitizeGuidedStages(value: unknown): GuidedStage[] | null {
  return normalizePlan(value)
}
