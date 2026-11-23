import { afterEach, describe, expect, it } from 'vitest'
import { deleteNotebookEntry, readNotebookEntries, saveNotebookEntry } from './learningNotebook'

afterEach(() => localStorage.clear())

describe('learning notebook', () => {
  it('preserves authorship when an AI note is edited alongside a user note', () => {
    const own = saveNotebookEntry({ title: '我的笔记', body: '内容', tags: [] })[0]
    const ai = saveNotebookEntry({ title: 'AI 笔记', body: '讲解', tags: [], author: 'ai' })[0]
    saveNotebookEntry({ id: ai.id, title: '修改', body: '补充', tags: [], author: 'user' })
    expect(readNotebookEntries().find(entry => entry.id === own.id)?.author).toBe('user')
    expect(readNotebookEntries().find(entry => entry.id === ai.id)?.author).toBe('ai')
  })
  it('creates and updates a tagged note', () => {
    const created = saveNotebookEntry({ title: '单调栈', body: '维护一个递减栈。', tags: ['栈', '栈'] })[0]
    expect(created).toMatchObject({ title: '单调栈', body: '维护一个递减栈。', tags: ['栈'] })
    const updated = saveNotebookEntry({ id: created.id, title: '单调栈边界', body: '先处理空栈。', tags: ['边界'] })[0]
    expect(updated.id).toBe(created.id)
    expect(readNotebookEntries()[0].body).toBe('先处理空栈。')
  })

  it('deletes only the requested note and ignores malformed entries', () => {
    const first = saveNotebookEntry({ title: '第一条', body: '内容', tags: [] })[0]
    const second = saveNotebookEntry({ title: '第二条', body: '内容', tags: [] })[0]
    expect(deleteNotebookEntry(first.id).map(entry => entry.id)).toEqual([second.id])
    localStorage.setItem('algocoach.learningNotebook', JSON.stringify([{ id: 'bad' }]))
    expect(readNotebookEntries()).toEqual([])
  })
})
