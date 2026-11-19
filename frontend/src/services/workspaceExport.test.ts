import { afterEach, expect, it } from 'vitest'
import { saveNotebookEntry } from './learningNotebook'
import { createLearningTask } from './learningTasks'
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
