import { nanoid } from 'nanoid'
import { workspaceStorageKey } from './deepTutorCapabilities'

const NOTEBOOK_KEY = workspaceStorageKey('algocoach.learningNotebook')

export interface NotebookEntry {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
  author?: 'user' | 'ai'
}

export function readNotebookEntries(): NotebookEntry[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(NOTEBOOK_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(isNotebookEntry).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : []
  } catch {
    return []
  }
}

export function saveNotebookEntry(input: { id?: string; title: string; body: string; tags: string[]; author?: 'user' | 'ai' }): NotebookEntry[] {
  const entries = readNotebookEntries()
  const now = new Date().toISOString()
  const current = input.id ? entries.find(entry => entry.id === input.id) : undefined
  const nextEntry: NotebookEntry = {
    id: current?.id ?? nanoid(10),
    title: input.title.trim() || '未命名笔记',
    body: input.body,
    tags: [...new Set(input.tags.map(tag => tag.trim()).filter(Boolean))].slice(0, 12),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    author: current?.author ?? input.author ?? 'user',
  }
  const next = [nextEntry, ...entries.filter(entry => entry.id !== nextEntry.id)].slice(0, 200)
  persist(next)
  return next
}

export function deleteNotebookEntry(id: string): NotebookEntry[] {
  const next = readNotebookEntries().filter(entry => entry.id !== id)
  persist(next)
  return next
}

function persist(entries: NotebookEntry[]) {
  try { window.localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(entries)) } catch { /* local storage is optional */ }
}

function isNotebookEntry(value: unknown): value is NotebookEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Partial<NotebookEntry>
  return typeof entry.id === 'string' && typeof entry.title === 'string' && entry.title.trim().length > 0
    && typeof entry.body === 'string' && Array.isArray(entry.tags) && entry.tags.every(tag => typeof tag === 'string')
    && typeof entry.createdAt === 'string' && typeof entry.updatedAt === 'string'
}
