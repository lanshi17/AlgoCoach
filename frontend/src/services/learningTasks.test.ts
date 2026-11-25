import { afterEach, describe, expect, it } from 'vitest'
import { createLearningTask, MAX_LEARNING_TASK_NOTE_LENGTH, moveLearningTask, readLearningTasks, removeLearningTask, reorderLearningTask, setLearningTaskArchived, setLearningTaskNote } from './learningTasks'

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

  it('reorders by stored order, landing after a lower target and before a higher one', () => {
    const first = createLearningTask({ title: '任务 A', kind: 'custom', dueDate: '2026-11-20' })[0]
    createLearningTask({ title: '任务 B', kind: 'custom', dueDate: '2026-11-21' })
    createLearningTask({ title: '任务 C', kind: 'custom', dueDate: '2026-11-22' })
    expect(reorderLearningTask(first.id, readLearningTasks()[2].id).map(task => task.title)).toEqual(['任务 B', '任务 C', '任务 A'])
    const third = readLearningTasks()[1]
    const second = readLearningTasks()[0]
    expect(reorderLearningTask(third.id, second.id).map(task => task.title)).toEqual(['任务 C', '任务 B', '任务 A'])
    expect(readLearningTasks().map(task => task.title)).toEqual(['任务 C', '任务 B', '任务 A'])
  })

  it('keeps the order unchanged when a drag target is missing or the same task', () => {
    const first = createLearningTask({ title: '任务 A', kind: 'custom', dueDate: '2026-11-20' })[0]
    createLearningTask({ title: '任务 B', kind: 'custom', dueDate: '2026-11-21' })
    const before = readLearningTasks()
    expect(reorderLearningTask('missing', first.id)).toEqual(before)
    expect(reorderLearningTask(first.id, first.id)).toEqual(before)
    expect(readLearningTasks()).toEqual(before)
  })

  it('saves trimmed notes, caps their length and clears them when empty', () => {
    const task = createLearningTask({ title: '任务 A', kind: 'custom', dueDate: '2026-11-20' })[0]
    expect(setLearningTaskNote(task.id, '  先写边界  ')[0].note).toBe('先写边界')
    expect(setLearningTaskNote(task.id, 'x'.repeat(MAX_LEARNING_TASK_NOTE_LENGTH + 10))[0].note).toHaveLength(MAX_LEARNING_TASK_NOTE_LENGTH)
    expect(readLearningTasks()[0].note).toHaveLength(MAX_LEARNING_TASK_NOTE_LENGTH)
    expect(setLearningTaskNote(task.id, '   ')[0]).not.toHaveProperty('note')
    expect(readLearningTasks()[0]).not.toHaveProperty('note')
  })

  it('keeps a note when the task is archived and restored', () => {
    const task = createLearningTask({ title: '任务 A', kind: 'custom', dueDate: '2026-11-20' })[0]
    setLearningTaskNote(task.id, '归档后还要看')
    setLearningTaskArchived(task.id, true)
    expect(readLearningTasks()[0].note).toBe('归档后还要看')
    setLearningTaskArchived(task.id, false)
    expect(readLearningTasks()[0].note).toBe('归档后还要看')
  })

  it('normalizes stored notes instead of dropping the task', () => {
    localStorage.setItem('algocoach.learningTasks', JSON.stringify([
      { id: 'trimmed', title: '旧备注', kind: 'custom', dueDate: '2026-11-20', completed: false, createdAt: '2026-11-19', note: '  旧内容  ' },
      { id: 'wrong-type', title: '错误备注', kind: 'custom', dueDate: '2026-11-20', completed: false, createdAt: '2026-11-19', note: 42 },
    ]))
    const tasks = readLearningTasks()
    expect(tasks.map(task => task.id)).toEqual(['trimmed', 'wrong-type'])
    expect(tasks[0].note).toBe('旧内容')
    expect(tasks[1]).not.toHaveProperty('note')
  })
})
