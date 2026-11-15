import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import TestCasePanel from './TestCasePanel'

afterEach(() => { vi.unstubAllGlobals() })

it('preserves a saved custom test input when the panel mounts again', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: 'sample', codeSnippets: [],
  })
  useAppStore.getState().setTestInput('my input')
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<TestCasePanel />))
  expect(element.querySelector('textarea')?.value).toBe('my input')
  expect(element.textContent).toContain('自定义 1')
  act(() => root.unmount())
  element.remove()
})
