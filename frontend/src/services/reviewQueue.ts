import type { LocalPracticeRecord } from './localProgress'
import { isReviewCard, newReviewCard, reviewCard, type ReviewCard, type ReviewRating } from './openTutorScheduler'

const REVIEW_KEY = 'algocoach.localReviewEntries'

export interface LocalReviewEntry {
  problemId: string
  note: string
  reviewedAt: string
  problemKey?: string
  title?: string
  schedule?: ReviewCard
}

export function readReviewEntries(): LocalReviewEntry[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(REVIEW_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(isReviewEntry)
  } catch {
    return []
  }
}

export function saveReviewEntry(problemId: string, note: string, record?: LocalPracticeRecord): LocalReviewEntry[] {
  const entries = readReviewEntries()
  const previous = entries.find(entry => entry.problemId === problemId)
  const current = entries.filter(entry => entry.problemId !== problemId)
  const next = [...current, { problemId, note: note.trim(), reviewedAt: new Date().toISOString(),
    problemKey: record?.problemId ?? previous?.problemKey, title: record?.title ?? previous?.title,
    schedule: scheduleFor(previous) ?? newReviewCard(new Date()) }].slice(-100)
  window.localStorage.setItem(REVIEW_KEY, JSON.stringify(next))
  return next
}

function isReviewEntry(value: unknown): value is LocalReviewEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<LocalReviewEntry>
  return typeof item.problemId === 'string' && typeof item.note === 'string' && typeof item.reviewedAt === 'string'
    && (item.problemKey === undefined || typeof item.problemKey === 'string')
    && (item.title === undefined || typeof item.title === 'string')
}


function scheduleFor(entry: LocalReviewEntry | undefined): ReviewCard | null {
  if (!entry) return null
  if (isReviewCard(entry.schedule)) return entry.schedule
  const time = Date.parse(entry.reviewedAt)
  return Number.isFinite(time) ? newReviewCard(new Date(time)) : null
}

export function dueReviewEntries(entries: LocalReviewEntry[], now = new Date()): LocalReviewEntry[] {
  return entries.filter(entry => {
    const schedule = scheduleFor(entry)
    return schedule !== null && Date.parse(schedule.due) <= now.getTime()
  }).sort((a, b) => Date.parse(scheduleFor(a)!.due) - Date.parse(scheduleFor(b)!.due))
}

export function rateReviewEntry(problemId: string, rating: ReviewRating, now = new Date()): LocalReviewEntry[] {
  const entries = readReviewEntries()
  const current = entries.find(entry => entry.problemId === problemId)
  const schedule = scheduleFor(current)
  if (!current || !schedule) throw new Error('找不到可复习的笔记。')
  const next = entries.map(entry => entry.problemId === problemId ? { ...entry, schedule: reviewCard(schedule, rating, now) } : entry)
  window.localStorage.setItem(REVIEW_KEY, JSON.stringify(next))
  return next
}
