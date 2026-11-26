import { nanoid } from 'nanoid'
import { workspaceStorageKey } from './deepTutorCapabilities'

const TASKS_KEY = workspaceStorageKey('algocoach.learningTasks')

export type LearningTaskKind = 'practice' | 'review' | 'custom'

/** Board columns, following DeepTutor's Task Board: To do, In progress, Done. */
export type LearningTaskStatus = 'todo' | 'doing' | 'done'

export const TASK_STATUS_LABEL: Record<LearningTaskStatus, string> = { todo: '待办', doing: '进行中', done: '完成' }

/** Status reached when a task's chip is pressed: To do → In progress → Done → To do. */
export const NEXT_TASK_STATUS: Record<LearningTaskStatus, LearningTaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' }

export const MAX_LEARNING_TASK_NOTE_LENGTH = 500

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
  /** Optional free-form note shown under the title; trimmed and capped on write. */
  note?: string
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

/**
 * Add imported tasks that the current workspace does not already have.
 * Local tasks always win on an id collision; nothing is updated or deleted.
 */
export function mergeLearningTasks(values: unknown[]): { added: number; skipped: number; total: number } {
  const existing = readLearningTasks()
  const ids = new Set(existing.map(task => task.id))
  const added: LearningTask[] = []
  for (const value of values) {
    const task = normalizeLearningTask(value)
    if (!task || ids.has(task.id)) continue
    ids.add(task.id)
    added.push(task)
  }
  if (added.length) persist([...existing, ...added])
  return { added: added.length, skipped: values.length - added.length, total: values.length }
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

/**
 * Moves a task to another task's slot. Dragging downward lands after the target,
 * dragging upward lands before it; the stored array order is the board order.
 */
export function reorderLearningTask(taskId: string, targetId: string): LearningTask[] {
  const tasks = readLearningTasks()
  const from = tasks.findIndex(task => task.id === taskId)
  const to = tasks.findIndex(task => task.id === targetId)
  if (from < 0 || to < 0 || from === to) return tasks
  const next = [...tasks]
  const [moved] = next.splice(from, 1)
  const targetIndex = next.findIndex(task => task.id === targetId)
  next.splice(from < to ? targetIndex + 1 : targetIndex, 0, moved)
  persist(next)
  return next
}

/** Saves a trimmed, length-capped note; an empty note removes the field. */
export function setLearningTaskNote(taskId: string, note: string): LearningTask[] {
  const next = readLearningTasks().map(task => {
    if (task.id !== taskId) return task
    const clean = note.trim().slice(0, MAX_LEARNING_TASK_NOTE_LENGTH)
    if (clean) return { ...task, note: clean }
    const withoutNote = { ...task }
    delete withoutNote.note
    return withoutNote
  })
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
  const note = typeof task.note === 'string' ? task.note.trim().slice(0, MAX_LEARNING_TASK_NOTE_LENGTH) : ''
  return {
    id: task.id,
    title: task.title,
    kind: task.kind,
    dueDate: task.dueDate,
    status: isTaskStatus(task.status) ? task.status : task.completed === true ? 'done' : 'todo',
    archived: task.archived === true,
    createdAt: task.createdAt,
    ...(task.problemId === undefined ? {} : { problemId: task.problemId }),
    ...(note ? { note } : {}),
  }
}

function isTaskStatus(value: unknown): value is LearningTaskStatus {
  return value === 'todo' || value === 'doing' || value === 'done'
}
