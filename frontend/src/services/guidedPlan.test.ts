import { expect, it } from 'vitest'
import { DEFAULT_GUIDED_STAGES, parseGuidedPlan, sanitizeGuidedStages, stageNeedsAnswer } from './guidedPlan'

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
