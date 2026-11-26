import type { MasteryBundle, MasteryBundleTopic, ReviewScheduleBundle } from '@/types'

export const MASTERY_BUNDLE_FORMAT_V1 = 'algocoach-mastery-v1'
export const MASTERY_BUNDLE_FORMAT = 'algocoach-mastery-v2'
export const MAX_MASTERY_BUNDLE_TOPICS = 5000
export const MAX_MASTERY_BUNDLE_SCHEDULES = 5000

/** Validate a file the learner picked before it reaches the Agent. */
export function parseMasteryBundle(text: string): MasteryBundle {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON。')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('掌握度文件格式无效。')
  const bundle = value as Partial<MasteryBundle>
  if (bundle.format !== MASTERY_BUNDLE_FORMAT && bundle.format !== MASTERY_BUNDLE_FORMAT_V1) {
    throw new Error('这不是 AlgoCoach 掌握度文件。')
  }
  if (!Array.isArray(bundle.topics)) throw new Error('掌握度文件缺少知识点列表。')
  if (bundle.topics.length > MAX_MASTERY_BUNDLE_TOPICS) throw new Error(`一次最多导入 ${MAX_MASTERY_BUNDLE_TOPICS} 个知识点。`)
  if (bundle.reviewSchedules !== undefined && !Array.isArray(bundle.reviewSchedules)) throw new Error('复习计划列表格式无效。')
  if ((bundle.reviewSchedules?.length ?? 0) > MAX_MASTERY_BUNDLE_SCHEDULES) {
    throw new Error(`一次最多导入 ${MAX_MASTERY_BUNDLE_SCHEDULES} 条复习计划。`)
  }
  return {
    format: bundle.format,
    exportedAt: typeof bundle.exportedAt === 'string' ? bundle.exportedAt : '',
    workspaceId: typeof bundle.workspaceId === 'string' ? bundle.workspaceId : '',
    topics: bundle.topics.map(normalizeTopic),
    reviewSchedules: (bundle.reviewSchedules ?? []).map(normalizeSchedule),
  }
}

function normalizeSchedule(value: unknown): ReviewScheduleBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidSchedule()
  const schedule = value as Partial<ReviewScheduleBundle>
  if (typeof schedule.problemId !== 'string' || !schedule.problemId.trim() || schedule.problemId.trim().length > 64) throw invalidSchedule()
  if (!isTimestamp(schedule.dueAt) || !isTimestamp(schedule.updatedAt)) throw invalidSchedule()
  if (typeof schedule.intervalDays !== 'number' || !Number.isSafeInteger(schedule.intervalDays) || schedule.intervalDays < 1 || schedule.intervalDays > 3650) throw invalidSchedule()
  if (typeof schedule.mastery !== 'number' || !Number.isFinite(schedule.mastery) || schedule.mastery < 0 || schedule.mastery > 1) throw invalidSchedule()
  if (typeof schedule.attempts !== 'number' || !Number.isSafeInteger(schedule.attempts) || schedule.attempts < 0 || schedule.attempts > 1_000_000) throw invalidSchedule()
  if (!Array.isArray(schedule.topics) || schedule.topics.length > 50 || schedule.topics.some(topic => typeof topic !== 'string' || !topic.trim())) throw invalidSchedule()
  return {
    problemId: schedule.problemId.trim(),
    dueAt: schedule.dueAt,
    intervalDays: schedule.intervalDays,
    mastery: schedule.mastery,
    attempts: schedule.attempts,
    topics: schedule.topics.map(topic => topic.trim()),
    updatedAt: schedule.updatedAt,
  }
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 32 && Number.isFinite(Date.parse(value))
}

function invalidSchedule() {
  return new Error('掌握度文件包含无效的复习计划条目。')
}

function normalizeTopic(value: unknown): MasteryBundleTopic {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidTopic()
  const topic = value as Partial<MasteryBundleTopic>
  if (typeof topic.topic !== 'string' || !topic.topic.trim() || topic.topic.trim().length > 200) throw invalidTopic()
  if (typeof topic.mastery !== 'number' || !Number.isFinite(topic.mastery) || topic.mastery < 0 || topic.mastery > 1) throw invalidTopic()
  if (typeof topic.attempts !== 'number' || !Number.isSafeInteger(topic.attempts) || topic.attempts < 0 || topic.attempts > 1_000_000) throw invalidTopic()
  if (topic.lastSeen !== undefined && (typeof topic.lastSeen !== 'string' || topic.lastSeen.length > 64)) throw invalidTopic()
  return {
    topic: topic.topic.trim(),
    mastery: topic.mastery,
    attempts: topic.attempts,
    lastSeen: topic.lastSeen ?? '',
  }
}

function invalidTopic() {
  return new Error('掌握度文件包含无效的知识点条目。')
}
