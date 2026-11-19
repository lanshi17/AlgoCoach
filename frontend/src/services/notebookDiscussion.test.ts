import { afterEach, expect, it } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import { prepareNotebookDiscussion } from './notebookDiscussion'

afterEach(() => {
  useAppStore.setState({ activeProblem: null, chatDrafts: {} })
})

it('places a notebook discussion prompt in the global coach draft', () => {
  useAppStore.setState({ activeProblem: null, chatDrafts: {} })
  prepareNotebookDiscussion('二分边界', '我总是漏掉右端点。', ['二分'])
  const draft = useAppStore.getState().chatDrafts.__global__
  expect(draft).toContain('学习笔记「二分边界」')
  expect(draft).toContain('标签：二分')
  expect(draft).toContain('右端点')
})
