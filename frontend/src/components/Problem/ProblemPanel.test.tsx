import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { leetcodeService } from '@/services/leetcodeService'
import { hduService } from '@/services/hduService'
import { useAppStore } from '@/stores/useAppStore'
import type { Problem } from '@/types'
import ProblemPanel from './ProblemPanel'

const first: Problem = {
  id: '1', platform: 'LEETCODE', platformId: 'one', title: 'First problem', difficulty: 'EASY',
  contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('ignores an old detail response after the user changes platforms', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [first], total: 1, pageSize: 50 })
  vi.spyOn(hduService, 'listProblems').mockResolvedValue({ problems: [], total: 0, pageSize: 100 })
  let resolveDetail!: (problem: Problem) => void
  vi.spyOn(leetcodeService, 'getProblem').mockReturnValue(new Promise(resolve => { resolveDetail = resolve }))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => { root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProblemPanel /></MemoryRouter>) })
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('First problem'))!.click())
  const select = element.querySelector<HTMLSelectElement>('select[aria-label="选择题库平台"]')!
  await act(async () => { select.value = 'HDU'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  await act(async () => resolveDetail(first))
  expect(useAppStore.getState().activeProblem).toBeNull()
  expect(select.value).toBe('HDU')
  expect(element.textContent).not.toContain('First problem')
  act(() => root.unmount())
  element.remove()
})

it('renders safe inline and display math in the sanitized statement', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [], total: 0, pageSize: 50 })
  const problem: Problem = {
    ...first,
    contentHtml: '<p>Constraint: $0 \\le A \\le 10^8$.</p><p>$$x^2 + y^2 = z^2$$</p><code>$not math$</code><script>window.problemXss = true</script>',
  }
  useAppStore.setState({ ...useAppStore.getInitialState(), activeProblem: problem, mode: 'PREP' }, true)
  vi.spyOn(leetcodeService, 'getProblem').mockResolvedValue(problem)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProblemPanel /></MemoryRouter>)
  })
  expect(element.querySelectorAll('.katex')).toHaveLength(2)
  expect(element.querySelector('.katex-display')).not.toBeNull()
  expect(element.textContent).toContain('not math')
  expect(element.querySelector('code')?.textContent).toBe('$not math$')
  expect(element.querySelector('script')).toBeNull()
  expect((window as Window & { problemXss?: boolean }).problemXss).toBeUndefined()
  await act(async () => root.unmount())
  element.remove()
})

it('refreshes a restored cached problem without resetting the active work state', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const cached: Problem = { ...first, contentHtml: '<p>Cached statement</p>' }
  const fresh: Problem = { ...first, title: 'Fresh problem', contentHtml: '<p>Fresh statement</p>' }
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    activeProblem: cached,
    mode: 'FOCUS',
    focusStartTs: 123,
    focusElapsedSec: 45,
    code: 'draft in progress',
  }, true)
  vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [], total: 0, pageSize: 50 })
  let resolveDetail!: (problem: Problem) => void
  const getProblem = vi.spyOn(leetcodeService, 'getProblem')
    .mockReturnValue(new Promise(resolve => { resolveDetail = resolve }))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)

  await act(async () => {
    root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProblemPanel /></MemoryRouter>)
  })
  expect(element.textContent).toContain('Cached statement')
  expect(getProblem).toHaveBeenCalledWith('one')

  await act(async () => resolveDetail(fresh))
  expect(element.textContent).toContain('Fresh statement')
  expect(useAppStore.getState()).toMatchObject({
    mode: 'FOCUS', focusStartTs: 123, focusElapsedSec: 45, code: 'draft in progress',
  })

  await act(async () => root.unmount())
  element.remove()
})

it('keeps the cached statement available when refreshing a restored problem fails', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const cached: Problem = { ...first, contentHtml: '<p>Cached statement remains</p>' }
  useAppStore.setState({ ...useAppStore.getInitialState(), activeProblem: cached, mode: 'PREP' }, true)
  vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [], total: 0, pageSize: 50 })
  vi.spyOn(leetcodeService, 'getProblem').mockImplementation(async () => { throw new Error('offline') })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)

  await act(async () => {
    root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProblemPanel /></MemoryRouter>)
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(element.textContent).toContain('Cached statement remains')
  expect(element.textContent).toContain('继续显示已缓存内容')
  expect(useAppStore.getState().activeProblem).toEqual(cached)
  await act(async () => root.unmount())
  element.remove()
})

it('does not apply a restored detail response after another problem is selected', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const cached: Problem = { ...first, contentHtml: '<p>Old cached statement</p>' }
  const next: Problem = { ...first, platformId: 'two', title: 'Selected problem', contentHtml: '<p>Selected statement</p>' }
  useAppStore.setState({ ...useAppStore.getInitialState(), activeProblem: cached, mode: 'PREP' }, true)
  vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [], total: 0, pageSize: 50 })
  let resolveDetail!: (problem: Problem) => void
  vi.spyOn(leetcodeService, 'getProblem').mockReturnValue(new Promise(resolve => { resolveDetail = resolve }))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)

  await act(async () => {
    root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProblemPanel /></MemoryRouter>)
  })
  await act(async () => useAppStore.getState().setActiveProblem(next))
  await act(async () => resolveDetail({ ...cached, title: 'Late old response' }))

  expect(useAppStore.getState().activeProblem).toEqual(next)
  expect(element.textContent).toContain('Selected statement')
  expect(element.textContent).not.toContain('Late old response')
  await act(async () => root.unmount())
  element.remove()
})

it('lets the user retry a failed background refresh without leaving the cached problem', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const cached: Problem = { ...first, contentHtml: '<p>Cached statement</p>' }
  const fresh: Problem = { ...first, title: 'Updated problem', contentHtml: '<p>Updated statement</p>' }
  useAppStore.setState({ ...useAppStore.getInitialState(), activeProblem: cached, mode: 'PREP' }, true)
  vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [], total: 0, pageSize: 50 })
  const getProblem = vi.spyOn(leetcodeService, 'getProblem')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(fresh)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)

  await act(async () => {
    root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProblemPanel /></MemoryRouter>)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(element.textContent).toContain('继续显示已缓存内容')

  await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="重试更新题面"]')!.click())

  expect(getProblem).toHaveBeenCalledTimes(2)
  expect(element.textContent).toContain('Updated statement')
  expect(useAppStore.getState().activeProblem?.title).toBe('Updated problem')
  await act(async () => root.unmount())
  element.remove()
})
