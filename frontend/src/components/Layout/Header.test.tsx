import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { leetcodeService } from '@/services/leetcodeService'
import { agentService } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'
import type { RunResult } from '@/types'
import Header, { formatDuration } from './Header'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('formats focus duration compactly, including long sessions', () => {
  expect(formatDuration(0)).toBe('00:00')
  expect(formatDuration(62)).toBe('01:02')
  expect(formatDuration(3_661)).toBe('1:01:01')
  expect(formatDuration(-3)).toBe('00:00')
})

it('leaves the theme control to the shell sidebar', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))

  expect(element.querySelector('button[aria-label="切换主题"]')).toBeNull()
  act(() => root.unmount())
  element.remove()
})

it('only renders judge actions when they can be used', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))

  expect(element.querySelector('button[aria-label="提交"]')).toBeNull()
  expect(element.querySelector('button[aria-label="运行"]')).toBeNull()

  act(() => useAppStore.getState().setActiveProblem({
    id: 'one', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  }))
  // PREP has its own single entry: the problem panel's 开始做题 button.
  expect(element.querySelector('button[aria-label="提交"]')).toBeNull()
  expect(element.querySelector('button[aria-label="运行"]')).toBeNull()
  expect(element.querySelector('#judge-capability-note')).toBeNull()

  act(() => root.unmount())
  element.remove()
})

it('explains unsupported in-app judging for AcWing and HDU without relying on hover', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: 'acwing-1', platform: 'ACWING', platformId: '1', title: 'A + B', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().enterFocus()
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))

  const note = element.querySelector<HTMLElement>('#judge-capability-note')
  expect(note?.textContent).toContain('AcWing')
  expect(note?.textContent).toContain('回对应平台完成判题')
  expect(note?.className).toContain('text-[11px]')
  const submit = element.querySelector<HTMLButtonElement>('button[aria-label="提交"]')!
  expect(submit.disabled).toBe(true)
  expect(submit.className).toContain('disabled:bg-surface-muted')
  expect(element.querySelector('button[aria-label="运行"]')?.getAttribute('aria-describedby')).toBe('judge-capability-note')
  expect(submit.getAttribute('aria-describedby')).toBe('judge-capability-note')

  act(() => root.unmount())
  element.remove()
})

it('does not show the unsupported-platform judging note for LeetCode', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: 'lc-1', platform: 'LEETCODE', platformId: 'two-sum', title: 'Two Sum', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))

  expect(element.querySelector('#judge-capability-note')).toBeNull()

  act(() => root.unmount())
  element.remove()
})

it('clears a run error when moving to another problem', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  const first = {
    id: '1', platform: 'LEETCODE' as const, platformId: 'one', title: 'One', difficulty: 'EASY' as const,
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  }
  useAppStore.getState().setActiveProblem(first)
  useAppStore.getState().enterFocus()
  vi.spyOn(leetcodeService, 'runTests').mockRejectedValue(new Error('旧题运行失败'))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))
  await act(async () => {
    Array.from(element.querySelectorAll('button')).find(button => button.textContent === '运行')!.click()
    await Promise.resolve()
  })
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('旧题运行失败')

  act(() => useAppStore.getState().setActiveProblem({ ...first, id: '2', platformId: 'two' }))
  expect(element.querySelector('[role="alert"]')).toBeNull()
  act(() => root.unmount())
  element.remove()
})

it('shows a live focus timer and keeps accumulated time after resuming', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'))
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'ACWING', platformId: '1', title: 'A + B', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().setProblemTimeLimitMinutes('10')
  useAppStore.getState().enterFocus()
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))
  expect(element.querySelector('[role="timer"]')?.textContent).toBe('00:00· 剩余 10:00')
  act(() => vi.advanceTimersByTime(2_000))
  expect(element.querySelector('[role="timer"]')?.textContent).toBe('00:02· 剩余 09:58')
  act(() => useAppStore.getState().exitFocus())
  expect(element.querySelector('[role="timer"]')).toBeNull()
  act(() => useAppStore.getState().enterFocus())
  expect(element.querySelector('[role="timer"]')?.textContent).toBe('00:02· 剩余 09:58')
  act(() => root.unmount())
  element.remove()
})

it('does not show a run result for code edited while the request was pending', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().enterFocus()
  useAppStore.getState().setCode('old code')
  let resolveRun!: (result: RunResult) => void
  vi.spyOn(leetcodeService, 'runTests').mockReturnValue(new Promise(resolve => { resolveRun = resolve }))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '运行')!.click())
  act(() => useAppStore.getState().setCode('new code'))
  await act(async () => resolveRun({ status_msg: 'Accepted' }))
  expect(useAppStore.getState().runResult).toBeNull()
  expect(element.textContent).toContain('代码或测试输入已更改，请重新运行')
  act(() => root.unmount())
  element.remove()
})

it('keeps a submission pending across navigation and shows a later failure', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: [], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().enterFocus()
  let rejectSubmit!: (error: Error) => void
  const submit = vi.spyOn(leetcodeService, 'submit').mockReturnValue(new Promise((_resolve, reject) => { rejectSubmit = reject }))
  const element = document.createElement('div')
  document.body.appendChild(element)
  let root = createRoot(element)
  act(() => root.render(<Header />))
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '提交')!.click())
  act(() => root.unmount())
  root = createRoot(element)
  act(() => root.render(<Header />))
  const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent === '提交中')!
  expect(button.disabled).toBe(true)
  expect(button.getAttribute('aria-busy')).toBe('true')
  act(() => button.click())
  expect(submit).toHaveBeenCalledTimes(1)
  await act(async () => rejectSubmit(new Error('连接失败')))
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('连接失败')
  expect(useAppStore.getState().submitLoading).toBe(false)
  act(() => root.unmount())
  element.remove()
})

it('skips the automatic review when the preference is off', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setCoachPrefs({ autoReview: false })
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: ['Array'], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().enterFocus()
  vi.spyOn(leetcodeService, 'submit').mockResolvedValue({
    id: 'submission-1', status: 'ACCEPTED', runtimeMs: 2, memoryMb: 3,
    passedTests: 1, totalTests: 1, errorMessage: null, durationSec: 1,
  })
  const chat = vi.spyOn(agentService, 'chatStream').mockResolvedValue({ content: '不应发送' })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))
  await act(async () => {
    Array.from(element.querySelectorAll('button')).find(button => button.textContent === '提交')!.click()
    await Promise.resolve()
  })
  expect(useAppStore.getState().mode).toBe('REVIEW')
  expect(chat).not.toHaveBeenCalled()
  expect(useAppStore.getState().messages.some(message => message.content === '提交已记录。可在输入框继续发起复盘。')).toBe(true)
  act(() => root.unmount())
  element.remove()
})

it('sends the post-submit review after leaving focus mode', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: ['Array'], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().setLang('cpp')
  useAppStore.getState().setCode('int answer = 42;')
  useAppStore.getState().enterFocus()
  vi.spyOn(leetcodeService, 'submit').mockResolvedValue({
    id: 'submission-1', status: 'ACCEPTED', runtimeMs: 2, memoryMb: 3,
    passedTests: 1, totalTests: 1, errorMessage: null, durationSec: 1,
  })
  const chat = vi.spyOn(agentService, 'chatStream').mockResolvedValue({ content: '赛后复盘已完成。' })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))
  await act(async () => {
    Array.from(element.querySelectorAll('button')).find(button => button.textContent === '提交')!.click()
    await Promise.resolve()
  })
  expect(useAppStore.getState().mode).toBe('REVIEW')
  expect(chat).toHaveBeenCalledTimes(1)
  expect(chat.mock.calls[0][1]).toMatchObject({
    mode: 'REVIEW', problemId: 'one', platform: 'LEETCODE', trainingPhase: 'review',
    code: 'int answer = 42;', codeLanguage: 'cpp',
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(useAppStore.getState().messages.some(message => message.content === '赛后复盘已完成。')).toBe(true)
  act(() => root.unmount())
  element.remove()
})

it('marks an automatic post-submit review as retryable when the coach fails', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem({
    id: '1', platform: 'LEETCODE', platformId: 'one', title: 'One', difficulty: 'EASY',
    contentHtml: '', topics: ['Array'], sampleTestCases: '', codeSnippets: [],
  })
  useAppStore.getState().enterFocus()
  vi.spyOn(leetcodeService, 'submit').mockResolvedValue({
    id: 'submission-1', status: 'WRONG_ANSWER', runtimeMs: 2, memoryMb: 3,
    passedTests: 0, totalTests: 1, errorMessage: 'wrong answer', durationSec: 1,
  })
  vi.spyOn(agentService, 'chatStream').mockRejectedValue({
    isAxiosError: true,
    response: { data: { detail: {
      code: 'provider_api_key_required',
      message: '当前 Provider 需要 API key，请在设置页配置',
    } } },
  })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))
  await act(async () => {
    Array.from(element.querySelectorAll('button')).find(button => button.textContent === '提交')!.click()
    await Promise.resolve()
    await Promise.resolve()
  })

  const messages = useAppStore.getState().messages
  const userMessage = messages.find(message => message.role === 'user')
  const failure = messages.find(message => message.role === 'system' && message.retryMessageId)
  expect(userMessage?.trainingPhase).toBe('review')
  expect(failure?.retryMessageId).toBe(userMessage?.id)
  expect(failure?.content).toContain('当前 Provider 需要 API key，请在设置页配置')
  expect(failure?.action).toEqual({ href: '/settings', label: '配置模型 Provider' })
  act(() => root.unmount())
  element.remove()
})

it('runs a Python local practice sample without enabling online submission', async () => {
  const { LOCAL_PRACTICE_PROBLEMS } = await import('@/services/localPractice')
  const runner = await import('@/services/localPythonRunner')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveProblem(LOCAL_PRACTICE_PROBLEMS[0])
  useAppStore.getState().setLang('python3')
  useAppStore.getState().enterFocus()
  useAppStore.getState().setCode('def two_sum(nums, target): return [0, 1]')
  useAppStore.getState().setTestInput('2 7 11 15\n9')
  const run = vi.spyOn(runner, 'runLocalPython').mockResolvedValue({ status_msg: '样例通过', code_answer: ['[0, 1]'] })
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(<Header />))
  expect(element.querySelector<HTMLButtonElement>('button[aria-label="运行"]')!.disabled).toBe(false)
  expect(element.querySelector<HTMLButtonElement>('button[aria-label="提交"]')!.disabled).toBe(true)
  await act(async () => element.querySelector<HTMLButtonElement>('button[aria-label="运行"]')!.click())
  expect(run).toHaveBeenCalledWith('local-two-sum', 'def two_sum(nums, target): return [0, 1]', '2 7 11 15\n9')
  expect(useAppStore.getState().runResult?.status_msg).toBe('样例通过')
  act(() => root.unmount())
  element.remove()
})
