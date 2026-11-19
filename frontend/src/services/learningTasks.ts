import { nanoid } from 'nanoid'
import { workspaceStorageKey } from './deepTutorCapabilities'

const TASKS_KEY = workspaceStorageKey('algocoach.learningTasks')

export type LearningTaskKind = 'practice' | 'review' | 'custom'

export interface LearningTask {
  id: string
  title: string
  kind: LearningTaskKind
  dueDate: string
  completed: boolean
  createdAt: string
  problemId?: string
}

export function readLearningTasks(): LearningTask[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(TASKS_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(isLearningTask).slice(-100) : []
  } catch {
    return []
  }
}

export function createLearningTask(input: Omit<LearningTask, 'id' | 'completed' | 'createdAt'>): LearningTask[] {
  const next = [...readLearningTasks(), {
    ...input,
    id: nanoid(10),
    completed: false,
    createdAt: new Date().toISOString(),
  }].slice(-100)
  persist(next)
  return next
}

export function toggleLearningTask(taskId: string): LearningTask[] {
  const next = readLearningTasks().map(task => task.id === taskId ? { ...task, completed: !task.completed } : task)
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

function isLearningTask(value: unknown): value is LearningTask {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const task = value as Partial<LearningTask>
  return typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim().length > 0
    && (task.kind === 'practice' || task.kind === 'review' || task.kind === 'custom')
    && typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
    && typeof task.completed === 'boolean' && typeof task.createdAt === 'string'
    && (task.problemId === undefined || typeof task.problemId === 'string')
}
