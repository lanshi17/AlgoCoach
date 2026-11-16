import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import EditorPanel from './EditorPanel'

const editorRenderCount = vi.hoisted(() => ({ value: 0 }))

vi.mock('./MonacoCodeEditor', () => ({
  default: () => {
    editorRenderCount.value += 1
    return <div data-testid="monaco-editor" />
  },
}))
vi.mock('./TestCasePanel', () => ({ default: () => <div data-testid="test-cases" /> }))
vi.mock('./SubmissionResult', () => ({ default: () => <div data-testid="submission-result" /> }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('stays silent when no problem is selected', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root: Root = createRoot(element)
  await act(async () => root.render(<EditorPanel />))

  // The problem picker owns the "choose a problem" instruction; the editor stays silent.
  expect(element.textContent).not.toContain('先选择一道题目')
  expect(element.textContent).not.toContain('选题后')

  act(() => root.unmount())
  element.remove()
})

it('does not rerender Monaco for unrelated store updates', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  editorRenderCount.value = 0
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root: Root = createRoot(element)
  await act(async () => root.render(<EditorPanel />))
  const initialRenders = editorRenderCount.value

  act(() => useAppStore.getState().setChatDraft('unrelated chat draft'))
  expect(editorRenderCount.value).toBe(initialRenders)

  act(() => root.unmount())
  element.remove()
})
