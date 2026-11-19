import { afterEach, describe, expect, it } from 'vitest'
import { createLearningTask, readLearningTasks, removeLearningTask, toggleLearningTask } from './learningTasks'

afterEach(() => localStorage.clear())

describe('learning task board', () => {
  it('persists a practice task with a stable local id', () => {
    const tasks = createLearningTask({ title: '练习二分查找', kind: 'practice', dueDate: '2026-11-20', problemId: 'LOCAL:binary-search' })
    expect(tasks[0]).toMatchObject({ title: '练习二分查找', kind: 'practice', dueDate: '2026-11-20', completed: false })
    expect(readLearningTasks()).toEqual(tasks)
  })

  it('toggles and removes tasks without affecting other tasks', () => {
    const first = createLearningTask({ title: '复盘数组边界', kind: 'review', dueDate: '2026-11-20' })[0]
    const second = createLearningTask({ title: '自定义任务', kind: 'custom', dueDate: '2026-11-21' })[1]
    expect(toggleLearningTask(first.id).find(task => task.id === first.id)?.completed).toBe(true)
    expect(removeLearningTask(first.id)).toEqual([second])
  })

  it('ignores malformed persisted tasks', () => {
    localStorage.setItem('algocoach.learningTasks', JSON.stringify([{ id: 'bad' }, { id: 'ok', title: '合法', kind: 'custom', dueDate: '2026-11-20', completed: false, createdAt: '2026-11-19' }]))
    expect(readLearningTasks()).toHaveLength(1)
    expect(readLearningTasks()[0].id).toBe('ok')
  })
})
