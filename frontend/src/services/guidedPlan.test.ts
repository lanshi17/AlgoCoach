import { expect, it } from 'vitest'
import { DEFAULT_GUIDED_STAGES, MAX_GUIDED_STAGES, newGuidedStage, parseGuidedPlan, sanitizeGuidedStages, stageNeedsAnswer, validateGuidedOutline } from './guidedPlan'

it('parses a fenced outline and adds the programming stage the page needs', () => {
  const plan = parseGuidedPlan('```json\n{"stages":[\n  {"name":"概念热身","type":"concept","instruction":"讲解区间收缩。"},\n  {"name":"选择检查","type":"choice","instruction":"出一道单选题。"},\n  {"name":"复盘","type":"review","instruction":"总结本次学习。"}\n]}\n```')
  expect(plan?.map(stage => stage.name)).toEqual(['概念热身', '选择检查', '编程练习', '复盘'])
  expect(plan?.[2].type).toBe('code')
  expect(plan?.[plan.length - 1]?.type).toBe('review')
  expect(plan?.every(stage => stage.id && stage.instruction)).toBe(true)
})

it('normalizes Chinese stage types and rejects a response without usable stages', () => {
  const plan = sanitizeGuidedStages([
    { name: '先讲概念', type: '知识点' },
    { name: '动手编码', type: '编程题', instruction: '实现二分查找。' },
  ])
  expect(plan?.map(stage => stage.type)).toEqual(['concept', 'code', 'review'])
  expect(parseGuidedPlan('这不是大纲')).toBeNull()
  expect(parseGuidedPlan('{"stages": [{"name": "", "type": "concept"}]}')).toBeNull()
})

it('only locks progression for stages that require a submitted answer', () => {
  expect(DEFAULT_GUIDED_STAGES.map(stageNeedsAnswer)).toEqual([false, true, true, true, false])
})

it('validates learner-edited outlines and names the blocking invariant', () => {
  expect(validateGuidedOutline(DEFAULT_GUIDED_STAGES)).toBeNull()
  expect(validateGuidedOutline(DEFAULT_GUIDED_STAGES.filter(stage => stage.type !== 'code'))).toContain('编程')
  expect(validateGuidedOutline([DEFAULT_GUIDED_STAGES[4], ...DEFAULT_GUIDED_STAGES.slice(0, 4)])).toContain('复盘')
  expect(validateGuidedOutline([DEFAULT_GUIDED_STAGES[0]])).toContain('两个')
  const emptyName = DEFAULT_GUIDED_STAGES.map((stage, index) => index === 0 ? { ...stage, name: '  ' } : stage)
  expect(validateGuidedOutline(emptyName)).toContain('不能为空')
  const duplicateName = DEFAULT_GUIDED_STAGES.map((stage, index) => index === 1 ? { ...stage, name: DEFAULT_GUIDED_STAGES[0].name } : stage)
  expect(validateGuidedOutline(duplicateName)).toContain('重复')
  expect(validateGuidedOutline([...DEFAULT_GUIDED_STAGES, newGuidedStage('concept', '额外', 'extra')])).toContain('复盘')
  const tooMany = Array.from({ length: MAX_GUIDED_STAGES + 1 }, (_, index) => ({ ...DEFAULT_GUIDED_STAGES[0], id: `s-${index}` }))
  expect(validateGuidedOutline(tooMany)).toContain(`最多保留 ${MAX_GUIDED_STAGES}`)
})

it('creates a stage with the default instruction for its type', () => {
  const stage = newGuidedStage('code', '自定义编程', 'custom-stage')
  expect(stage).toMatchObject({ id: 'custom-stage', name: '自定义编程', type: 'code' })
  expect(stage.instruction).toContain('编程练习')
})
