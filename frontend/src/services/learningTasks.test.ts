import { afterEach, describe, expect, it } from 'vitest'
import { createLearningTask, moveLearningTask, readLearningTasks, removeLearningTask, setLearningTaskArchived } from './learningTasks'

afterEach(() => localStorage.clear())

describe('learning task board', () => {
  it('persists a practice task in the To do column with a stable local id', () => {
    const tasks = createLearningTask({ title: '练习二分查找', kind: 'practice', dueDate: '2026-11-20', problemId: 'LOCAL:binary-search' })
    expect(tasks[0]).toMatchObject({ title: '练习二分查找', kind: 'practice', dueDate: '2026-11-20', status: 'todo', archived: false })
    expect(readLearningTasks()).toEqual(tasks)
  })

  it('moves one task through the columns without touching the others', () => {
    const first = createLearningTask({ title: '复盘数组边界', kind: 'review', dueDate: '2026-11-20' })[0]
    const second = createLearningTask({ title: '自定义任务', kind: 'custom', dueDate: '2026-11-21' })[1]
    expect(moveLearningTask(first.id, 'doing').find(task => task.id === first.id)?.status).toBe('doing')
    expect(moveLearningTask(first.id, 'done').find(task => task.id === first.id)?.status).toBe('done')
    expect(readLearningTasks().find(task => task.id === second.id)?.status).toBe('todo')
  })

  it('archives a task without deleting it and restores it on request', () => {
    const task = createLearningTask({ title: '复习二分', kind: 'review', dueDate: '2026-11-20' })[0]
    expect(setLearningTaskArchived(task.id, true)).toEqual([{ ...task, archived: true }])
    expect(setLearningTaskArchived(task.id, false)).toEqual([task])
  })

  it('removes only the chosen task', () => {
    const first = createLearningTask({ title: '复盘数组边界', kind: 'review', dueDate: '2026-11-20' })[0]
    const second = createLearningTask({ title: '自定义任务', kind: 'custom', dueDate: '2026-11-21' })[1]
    expect(removeLearningTask(first.id)).toEqual([second])
  })

  it('ignores malformed persisted tasks', () => {
    localStorage.setItem('algocoach.learningTasks', JSON.stringify([{ id: 'bad' }, { id: 'ok', title: '合法', kind: 'custom', dueDate: '2026-11-20', completed: false, createdAt: '2026-11-19' }]))
    expect(readLearningTasks().map(task => task.id)).toEqual(['ok'])
  })

  it('reads tasks saved before the board had columns from their completed flag', () => {
    localStorage.setItem('algocoach.learningTasks', JSON.stringify([
      { id: 'old-done', title: '旧任务已完成', kind: 'custom', dueDate: '2026-11-20', completed: true, createdAt: '2026-11-19' },
      { id: 'old-open', title: '旧任务未完成', kind: 'custom', dueDate: '2026-11-20', completed: false, createdAt: '2026-11-19' },
    ]))
    expect(readLearningTasks().map(task => [task.id, task.status, task.archived])).toEqual([
      ['old-done', 'done', false],
      ['old-open', 'todo', false],
    ])
  })

  it('keeps every task instead of silently dropping the oldest after 100', () => {
    for (let index = 0; index < 101; index += 1) createLearningTask({ title: `任务 ${index}`, kind: 'custom', dueDate: '2026-11-20' })
    const tasks = readLearningTasks()
    expect(tasks).toHaveLength(101)
    expect(tasks[0].title).toBe('任务 0')
  })
})
