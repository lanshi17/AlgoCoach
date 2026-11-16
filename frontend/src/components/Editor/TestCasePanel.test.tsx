import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import TestCasePanel from './TestCasePanel'

afterEach(() => { vi.unstubAllGlobals() })

it('shows an empty state instead of an editable test input before selection', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<TestCasePanel />))

  expect(element.querySelector('[role="status"]')?.textContent).toContain('选择题目后可编辑测试用例')
  expect(element.querySelector('textarea')).toBeNull()
  act(() => root.unmount())
  element.remove()
})

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

it('marks the active sample case for keyboard and assistive navigation', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: 'first\n---\nsecond', codeSnippets: [],
  })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<TestCasePanel />))

  const cases = Array.from(element.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'))
  expect(cases.map(button => button.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
  act(() => cases[1].click())
  expect(cases[0].getAttribute('aria-pressed')).toBe('false')
  expect(cases[1].getAttribute('aria-pressed')).toBe('true')

  act(() => root.unmount())
  element.remove()
})
