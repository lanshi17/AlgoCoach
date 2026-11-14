import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from './useAppStore'
import type { Problem } from '@/types'

const problem: Problem = {
  id: '1', platform: 'LEETCODE', platformId: 'two-sum', title: 'Two Sum', difficulty: 'EASY',
  contentHtml: '', topics: ['Array'], sampleTestCases: '2\n7 2\n9',
  codeSnippets: [
    { lang: 'rust', code: 'fn two_sum() {}' },
    { lang: 'python3', code: 'def two_sum():\n    pass' },
  ],
}

describe('training preferences and focus state', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState(useAppStore.getInitialState(), true)
  })

  it('persists the selected language, goal, and theme without persisting solution code', () => {
    useAppStore.getState().setLang('python3')
    useAppStore.getState().setGoal('contest')
    useAppStore.getState().toggleTheme()
    useAppStore.getState().setCode('def two_sum(nums, target): return [0, 1]')

    expect(localStorage.getItem('algocoach.language')).toBe('python3')
    expect(localStorage.getItem('algocoach.goal')).toBe('contest')
    expect(localStorage.getItem('algocoach.theme')).toBe('dark')
    expect(localStorage.getItem('code')).toBeNull()
    useAppStore.getState().toggleTheme()
    expect(localStorage.getItem('algocoach.theme')).toBe('light')
  })

  it('resets focus timing and uses the preferred language template when changing problems', () => {
    useAppStore.getState().setLang('python3')
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().enterFocus()

    expect(useAppStore.getState().mode).toBe('FOCUS')
    expect(useAppStore.getState().code).toContain('def two_sum')
    expect(useAppStore.getState().testInput).toBe('2\n7 2\n9')
  })

  it('does not replace an edited solution when the language changes', () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setCode('my attempt')
    useAppStore.getState().setLang('python3')

    expect(useAppStore.getState().code).toBe('my attempt')
    expect(useAppStore.getState().codeEdited).toBe(true)
  })

  it('keeps chat history separated by problem and clears only the active problem', () => {
    const store = useAppStore.getState()
    store.setActiveProblem(problem)
    store.addMessage({ id: 'a', role: 'user', content: 'first', timestamp: 'now' })
    store.setActiveProblem({ ...problem, id: '2', platformId: 'another-problem' })
    useAppStore.getState().addMessage({ id: 'b', role: 'user', content: 'second', timestamp: 'now' })
    useAppStore.getState().clearMessages()
    useAppStore.getState().setActiveProblem(problem)

    expect(useAppStore.getState().messages.map(message => message.content)).toEqual(['first'])
    expect(useAppStore.getState().messagesByProblem['another-problem']).toEqual([])
  })

  it('updates animation, sidebar, and run state through their public actions', () => {
    const animation = { id: 'job-1', title: 'BFS', status: 'READY' as const }
    useAppStore.getState().pushAnimation(animation)
    useAppStore.getState().setActiveAnimation(animation)
    useAppStore.getState().toggleSidebar()
    useAppStore.getState().setRunLoading(true)
    useAppStore.getState().setRunError('offline')
    useAppStore.getState().setRunResult({ status_msg: 'Accepted' })

    expect(useAppStore.getState().animations).toEqual([animation])
    expect(useAppStore.getState().activeAnimation).toEqual(animation)
    expect(useAppStore.getState().sidebarExpanded).toBe(true)
    expect(useAppStore.getState().runLoading).toBe(true)
    expect(useAppStore.getState().runError).toBe('offline')
    expect(useAppStore.getState().runResult?.status_msg).toBe('Accepted')
    useAppStore.getState().toggleSidebar()
    useAppStore.getState().setTestInput('custom input')
    useAppStore.getState().setLastSubmission({
      id: 'sub-1', problemId: 'two-sum', code: 'fn main() {}', lang: 'rust',
      status: 'ACCEPTED', passedTests: 1, totalTests: 1, submittedAt: 'now', durationSec: 1,
    })
    expect(useAppStore.getState().sidebarExpanded).toBe(false)
    expect(useAppStore.getState().testInput).toBe('custom input')
    expect(useAppStore.getState().lastSubmission?.id).toBe('sub-1')
  })

  it('handles no active focus and returns to the empty workspace', () => {
    useAppStore.getState().exitFocus()
    expect(useAppStore.getState().getFocusDurationSec()).toBe(0)
    useAppStore.getState().addMessage({ id: 'g', role: 'user', content: 'hello', timestamp: 'now' })
    useAppStore.getState().clearMessages()
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setActiveProblem(null)
    expect(useAppStore.getState().mode).toBe('IDLE')
    expect(useAppStore.getState().activeProblem).toBeNull()
  })

  it('loads valid preferences when the store is initialized again', async () => {
    localStorage.setItem('algocoach.language', 'cpp')
    localStorage.setItem('algocoach.goal', 'interview_prep')
    localStorage.setItem('algocoach.theme', 'dark')
    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')
    expect(restoredStore.getState().lang).toBe('cpp')
    expect(restoredStore.getState().goal).toBe('interview_prep')
    expect(restoredStore.getState().theme).toBe('dark')
  })

  it('keeps working when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage disabled') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled') })
    vi.resetModules()
    const { useAppStore: memoryOnlyStore } = await import('./useAppStore')
    memoryOnlyStore.getState().setLang('cpp')
    memoryOnlyStore.getState().setGoal('casual')
    memoryOnlyStore.getState().toggleTheme()
    expect(memoryOnlyStore.getState().lang).toBe('cpp')
    expect(memoryOnlyStore.getState().goal).toBe('casual')
    vi.restoreAllMocks()
  })

  it('accumulates focus duration across a retry and returns to REVIEW', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T00:00:00.000Z'))
    useAppStore.getState().enterFocus()
    vi.advanceTimersByTime(5_000)
    useAppStore.getState().exitFocus()
    expect(useAppStore.getState().mode).toBe('REVIEW')
    expect(useAppStore.getState().getFocusDurationSec()).toBe(5)
    useAppStore.getState().enterFocus()
    vi.advanceTimersByTime(2_000)
    expect(useAppStore.getState().getFocusDurationSec()).toBe(7)
    vi.useRealTimers()
  })
})
