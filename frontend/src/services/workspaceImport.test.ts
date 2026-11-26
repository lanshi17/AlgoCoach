import { afterEach, describe, expect, it } from 'vitest'
import { createLearningTask, readLearningTasks } from './learningTasks'
import { readNotebookEntries, saveNotebookEntry } from './learningNotebook'
import { appendLocalPracticeRecord, readLocalPracticeRecords } from './localProgress'
import { readReviewEntries, readReviewEvents, saveReviewEntry } from './reviewQueue'
import { importWorkspaceSnapshot, parseWorkspaceSnapshot, WORKSPACE_BUNDLE_FORMAT } from './workspaceImport'

const base = {
  format: WORKSPACE_BUNDLE_FORMAT,
  exportedAt: '2026-02-01T00:00:00.000Z',
  workspaceId: 'remote-device',
  notebook: [] as unknown[],
  tasks: [] as unknown[],
  practiceRecords: [] as unknown[],
  reviews: [] as unknown[],
  reviewEvents: [] as unknown[],
}

function importPatch(patch: Partial<typeof base>) {
  return importWorkspaceSnapshot(parseWorkspaceSnapshot(JSON.stringify({ ...base, ...patch })))
}

afterEach(() => localStorage.clear())

describe('workspace backup import', () => {
  it('adds missing records, keeps local conflicts, and is idempotent', () => {
    const [localTask] = createLearningTask({ title: '本机任务', kind: 'practice', dueDate: '2026-02-02' })
    const [localNote] = saveNotebookEntry({ title: '本机笔记', body: '本机内容', tags: ['二分'] })
    const localRecord = appendLocalPracticeRecord({
      problemId: 'LOCAL:two-sum', title: '本机记录', topics: ['哈希'], durationSec: 60,
      codeLength: 20, endedAt: '2026-02-01T10:00:00.000Z', outcome: 'SAMPLE_PASSED',
    })[0]
    saveReviewEntry('LOCAL:two-sum', '本机复盘', localRecord)
    const localReview = readReviewEntries()[0]

    const remoteTask = {
      id: 'remote-task', title: '远端任务', kind: 'custom', dueDate: '2026-02-03',
      status: 'todo', archived: false, createdAt: '2026-02-01T00:00:00.000Z',
    }
    const remoteNote = {
      id: 'remote-note', title: '远端笔记', body: '远端内容', tags: ['图'],
      createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z',
    }
    const remoteRecord = {
      id: 'remote-record', problemId: 'LOCAL:binary-search', title: '远端记录', topics: ['二分'],
      durationSec: 120, codeLength: 30, endedAt: '2026-02-01T11:00:00.000Z', outcome: 'UNASSESSED',
    }
    const remoteReview = { problemId: 'LOCAL:binary-search', note: '远端复盘', reviewedAt: '2026-02-01T11:00:00.000Z' }
    const remoteEvent = {
      problemId: 'LOCAL:two-sum', rating: 3, reviewedAt: '2026-02-01T12:00:00.000Z',
      dueBefore: '2026-02-01T00:00:00.000Z', dueAfter: '2026-02-05T00:00:00.000Z',
    }

    const first = importPatch({
      tasks: [{ ...localTask, title: '远端覆盖' }, remoteTask],
      notebook: [{ ...localNote, title: '远端覆盖' }, remoteNote],
      practiceRecords: [{ ...localRecord, title: '远端覆盖' }, remoteRecord],
      reviews: [{ ...localReview, note: '远端覆盖' }, remoteReview],
      reviewEvents: [remoteEvent],
    })

    expect(first.sourceWorkspaceId).toBe('remote-device')
    expect(first.tasks).toEqual({ added: 1, skipped: 1, total: 2 })
    expect(first.notebook).toEqual({ added: 1, skipped: 1, total: 2 })
    expect(first.practiceRecords).toEqual({ added: 1, skipped: 1, total: 2 })
    expect(first.reviews).toEqual({ added: 1, skipped: 1, total: 2 })
    expect(first.reviewEvents).toEqual({ added: 1, skipped: 0, total: 1 })
    expect(readLearningTasks().find(task => task.id === localTask.id)?.title).toBe('本机任务')
    expect(readLearningTasks().some(task => task.id === 'remote-task')).toBe(true)
    expect(readNotebookEntries().find(entry => entry.id === localNote.id)?.title).toBe('本机笔记')
    expect(readReviewEntries().find(entry => entry.problemId === 'LOCAL:two-sum')?.note).toBe('本机复盘')
    expect(readLocalPracticeRecords().find(record => record.id === localRecord.id)?.title).toBe('本机记录')

    const second = importPatch({
      tasks: [{ ...localTask, title: '远端覆盖' }, remoteTask],
      notebook: [{ ...localNote, title: '远端覆盖' }, remoteNote],
      practiceRecords: [{ ...localRecord, title: '远端覆盖' }, remoteRecord],
      reviews: [{ ...localReview, note: '远端覆盖' }, remoteReview],
      reviewEvents: [remoteEvent],
    })
    expect(second.tasks.added).toBe(0)
    expect(second.notebook.added).toBe(0)
    expect(second.practiceRecords.added).toBe(0)
    expect(second.reviews.added).toBe(0)
    expect(second.reviewEvents.added).toBe(0)
  })

  it('does not displace local practice records when the 80-record cap is full', () => {
    localStorage.setItem('algocoach.localPracticeRecords', JSON.stringify(Array.from({ length: 80 }, (_, index) => ({
      id: `local-${index}`,
      problemId: `LOCAL:${index}`,
      title: `本机 ${index}`,
      topics: [],
      durationSec: 1,
      codeLength: 1,
      endedAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    }))))
    const before = readLocalPracticeRecords()
    const result = importPatch({
      practiceRecords: [{
        id: 'incoming', problemId: 'LOCAL:incoming', title: '导入', topics: [],
        durationSec: 1, codeLength: 1, endedAt: '2026-03-01T00:00:00.000Z',
      }],
    })

    expect(result.practiceRecords).toEqual({ added: 0, skipped: 1, total: 1 })
    expect(readLocalPracticeRecords()).toEqual(before)
  })

  it('normalizes legacy task records and skips malformed individual entries', () => {
    const result = importPatch({
      tasks: [
        { id: 'legacy', title: '旧任务', kind: 'custom', dueDate: '2026-02-01', completed: true, createdAt: '2026-01-01' },
        { id: '', title: '坏任务', kind: 'custom', dueDate: '2026-02-01' },
      ],
    })

    expect(result.tasks).toEqual({ added: 1, skipped: 1, total: 2 })
    expect(readLearningTasks()).toMatchObject([{ id: 'legacy', status: 'done' }])
  })

  it('rejects a malformed envelope without writing storage', () => {
    expect(() => parseWorkspaceSnapshot('{')).toThrow('JSON')
    expect(() => parseWorkspaceSnapshot(JSON.stringify({ ...base, format: 'other' }))).toThrow('不是 AlgoCoach')
    expect(() => parseWorkspaceSnapshot(JSON.stringify({ ...base, tasks: {} }))).toThrow('不是列表')
    expect(() => parseWorkspaceSnapshot(JSON.stringify({ ...base, tasks: Array(5001).fill(null) }))).toThrow('上限')
    expect(readLearningTasks()).toEqual([])
    expect(readNotebookEntries()).toEqual([])
    expect(readReviewEvents()).toEqual([])
  })
})
