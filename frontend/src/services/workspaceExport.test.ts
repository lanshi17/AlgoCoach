import { afterEach, expect, it } from 'vitest'
import { saveNotebookEntry } from './learningNotebook'
import { createLearningTask } from './learningTasks'
import { rateReviewEntry } from './reviewQueue'
import { createWorkspaceExport } from './workspaceExport'

afterEach(() => localStorage.clear())

it('exports the active workspace learning data without provider credentials', () => {
  saveNotebookEntry({ title: '循环不变量', body: '边界需要检查', tags: ['二分'] })
  createLearningTask({ title: '复习二分', kind: 'review', dueDate: '2026-11-20' })
  sessionStorage.setItem('algocoach.provider.apiKey.custom', 'private-test-key')
  const snapshot = createWorkspaceExport()

  expect(snapshot.workspaceId).toBe('local-default')
  expect(snapshot.notebook[0]).toMatchObject({ title: '循环不变量', body: '边界需要检查' })
  expect(snapshot.tasks[0]).toMatchObject({ title: '复习二分', kind: 'review' })
  expect(JSON.stringify(snapshot)).not.toContain('private-test-key')
  sessionStorage.clear()
})

it('exports review evidence next to the schedule it produced', () => {
  localStorage.setItem('algocoach.localReviewEntries', JSON.stringify([{ problemId: 'two-sum', note: '先写暴力', reviewedAt: '2026-01-01T00:00:00.000Z' }]))
  rateReviewEntry('two-sum', 3, new Date('2026-01-02T00:00:00.000Z'))
  const snapshot = createWorkspaceExport()

  expect(snapshot.reviews[0]).toMatchObject({ problemId: 'two-sum', note: '先写暴力' })
  expect(snapshot.reviewEvents).toHaveLength(1)
  expect(snapshot.reviewEvents[0]).toMatchObject({ problemId: 'two-sum', rating: 3, reviewedAt: '2026-01-02T00:00:00.000Z' })
})
