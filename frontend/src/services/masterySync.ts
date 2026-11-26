import type { MasteryBundle, MasteryBundleTopic } from '@/types'

export const MASTERY_BUNDLE_FORMAT = 'algocoach-mastery-v1'
export const MAX_MASTERY_BUNDLE_TOPICS = 5000

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
  if (bundle.format !== MASTERY_BUNDLE_FORMAT) throw new Error('这不是 AlgoCoach 掌握度文件。')
  if (!Array.isArray(bundle.topics)) throw new Error('掌握度文件缺少知识点列表。')
  if (bundle.topics.length > MAX_MASTERY_BUNDLE_TOPICS) throw new Error(`一次最多导入 ${MAX_MASTERY_BUNDLE_TOPICS} 个知识点。`)
  return {
    format: MASTERY_BUNDLE_FORMAT,
    exportedAt: typeof bundle.exportedAt === 'string' ? bundle.exportedAt : '',
    workspaceId: typeof bundle.workspaceId === 'string' ? bundle.workspaceId : '',
    topics: bundle.topics.map(normalizeTopic),
  }
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
