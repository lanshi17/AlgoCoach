import { nanoid } from 'nanoid'
import { workspaceStorageKey } from './deepTutorCapabilities'

const TASKS_KEY = workspaceStorageKey('algocoach.learningTasks')

export type LearningTaskKind = 'practice' | 'review' | 'custom'

/** Board columns, following DeepTutor's Task Board: To do, In progress, Done. */
export type LearningTaskStatus = 'todo' | 'doing' | 'done'

export const TASK_STATUS_LABEL: Record<LearningTaskStatus, string> = { todo: '待办', doing: '进行中', done: '完成' }

/** Status reached when a task's chip is pressed: To do → In progress → Done → To do. */
export const NEXT_TASK_STATUS: Record<LearningTaskStatus, LearningTaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' }

export interface LearningTask {
  id: string
  title: string
  kind: LearningTaskKind
  dueDate: string
  status: LearningTaskStatus
  /** Archived tasks leave the board but stay in storage, so they can be restored. */
  archived: boolean
  createdAt: string
  problemId?: string
}

export type CreateLearningTaskInput = Pick<LearningTask, 'title' | 'kind' | 'dueDate'> & { problemId?: string }

export function readLearningTasks(): LearningTask[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(TASKS_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.map(normalizeLearningTask).filter((task): task is LearningTask => task !== null)
  } catch {
    return []
  }
}

export function createLearningTask(input: CreateLearningTaskInput): LearningTask[] {
  const task: LearningTask = {
    ...input,
    id: nanoid(10),
    status: 'todo',
    archived: false,
    createdAt: new Date().toISOString(),
  }
  // No cap: silently dropping the oldest task would also drop its archived history.
  const next = [...readLearningTasks(), task]
  persist(next)
  return next
}

export function moveLearningTask(taskId: string, status: LearningTaskStatus): LearningTask[] {
  const next = readLearningTasks().map(task => task.id === taskId ? { ...task, status } : task)
  persist(next)
  return next
}

export function setLearningTaskArchived(taskId: string, archived: boolean): LearningTask[] {
  const next = readLearningTasks().map(task => task.id === taskId ? { ...task, archived } : task)
  persist(next)
  return next
}

export function removeLearningTask(taskId: string): LearningTask[] {
  const next = readLearningTasks().filter(task => task.id !== taskId)
  persist(next)
  return next
}

function persist(tasks: LearningTask[]) {
  try { window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)) } catch { /* local storage is optional */ }
}

/** Accepts the board shape and the older `completed` flag; anything else is dropped. */
function normalizeLearningTask(value: unknown): LearningTask | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const task = value as Partial<LearningTask> & { completed?: unknown }
  const hasState = isTaskStatus(task.status) || typeof task.completed === 'boolean'
  if (!hasState || typeof task.id !== 'string' || typeof task.title !== 'string' || task.title.trim().length === 0) return null
  if (task.kind !== 'practice' && task.kind !== 'review' && task.kind !== 'custom') return null
  if (typeof task.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) return null
  if (typeof task.createdAt !== 'string' || (task.problemId !== undefined && typeof task.problemId !== 'string')) return null
  return {
    id: task.id,
    title: task.title,
    kind: task.kind,
    dueDate: task.dueDate,
    status: isTaskStatus(task.status) ? task.status : task.completed === true ? 'done' : 'todo',
    archived: task.archived === true,
    createdAt: task.createdAt,
    ...(task.problemId === undefined ? {} : { problemId: task.problemId }),
  }
}

function isTaskStatus(value: unknown): value is LearningTaskStatus {
  return value === 'todo' || value === 'doing' || value === 'done'
}
