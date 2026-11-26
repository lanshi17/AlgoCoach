import { mergeLearningTasks } from './learningTasks'
import { mergeNotebookEntries } from './learningNotebook'
import { mergeLocalPracticeRecords } from './localProgress'
import { mergeReviewEntries, mergeReviewEvents } from './reviewQueue'

export const WORKSPACE_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const WORKSPACE_BUNDLE_FORMAT = 'algocoach-workspace-v1'

const COLLECTION_LIMITS = {
  tasks: 5000,
  notebook: 2000,
  practiceRecords: 5000,
  reviews: 5000,
  reviewEvents: 10000,
} as const

type Collection = keyof typeof COLLECTION_LIMITS

export interface WorkspaceSnapshot {
  format: typeof WORKSPACE_BUNDLE_FORMAT
  exportedAt: string
  workspaceId: string
  notebook: unknown[]
  tasks: unknown[]
  practiceRecords: unknown[]
  reviews: unknown[]
  reviewEvents: unknown[]
}

export interface CollectionMerge {
  added: number
  skipped: number
  total: number
}

export interface WorkspaceImportResult {
  sourceWorkspaceId: string
  tasks: CollectionMerge
  notebook: CollectionMerge
  practiceRecords: CollectionMerge
  reviews: CollectionMerge
  reviewEvents: CollectionMerge
}

/** Validate the backup envelope before touching any local storage. */
export function parseWorkspaceSnapshot(text: string): WorkspaceSnapshot {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON。')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('工作区备份格式无效。')
  const snapshot = value as Partial<WorkspaceSnapshot>
  if (snapshot.format !== WORKSPACE_BUNDLE_FORMAT) throw new Error('这不是 AlgoCoach 工作区备份。')
  if (typeof snapshot.exportedAt !== 'string' || typeof snapshot.workspaceId !== 'string') {
    throw new Error('工作区备份缺少导出时间或 workspace。')
  }
  const notebook = readCollection(snapshot, 'notebook')
  const tasks = readCollection(snapshot, 'tasks')
  const practiceRecords = readCollection(snapshot, 'practiceRecords')
  const reviews = readCollection(snapshot, 'reviews')
  const reviewEvents = readCollection(snapshot, 'reviewEvents')
  return {
    format: WORKSPACE_BUNDLE_FORMAT,
    exportedAt: snapshot.exportedAt,
    workspaceId: snapshot.workspaceId,
    notebook,
    tasks,
    practiceRecords,
    reviews,
    reviewEvents,
  }
}

function readCollection(snapshot: Partial<WorkspaceSnapshot>, collection: Collection): unknown[] {
  const items = snapshot[collection]
  if (!Array.isArray(items)) throw new Error(`工作区备份的 ${collection} 不是列表。`)
  if (items.length > COLLECTION_LIMITS[collection]) {
    throw new Error(`工作区备份的 ${collection} 超过 ${COLLECTION_LIMITS[collection]} 条上限。`)
  }
  return items
}

/**
 * Merge browser-managed data into the current workspace. Local records always
 * win; only missing ids are added. Layout, chat, code, credentials, and Agent
 * memory are intentionally out of scope.
 */
export function importWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceImportResult {
  return {
    sourceWorkspaceId: snapshot.workspaceId,
    tasks: mergeLearningTasks(snapshot.tasks),
    notebook: mergeNotebookEntries(snapshot.notebook),
    practiceRecords: mergeLocalPracticeRecords(snapshot.practiceRecords),
    reviews: mergeReviewEntries(snapshot.reviews),
    reviewEvents: mergeReviewEvents(snapshot.reviewEvents),
  }
}
