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
    sessionStorage.clear()
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

  it('keeps independent solutions for each language when switching', () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setLang('rust')
    useAppStore.getState().setCode('rust attempt')
    useAppStore.getState().setLang('python3')
    expect(useAppStore.getState().code).toContain('def two_sum')
    useAppStore.getState().setCode('python attempt')
    useAppStore.getState().setLang('rust')
    expect(useAppStore.getState().code).toBe('rust attempt')
    expect(useAppStore.getState().codeEdited).toBe(true)
    useAppStore.getState().setLang('python3')
    expect(useAppStore.getState().code).toBe('python attempt')
  })

  it('does not change the active language or solution during focus', () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setLang('rust')
    useAppStore.getState().enterFocus()
    useAppStore.getState().setCode('rust attempt')
    useAppStore.getState().setLang('python3')
    expect(useAppStore.getState()).toMatchObject({ lang: 'rust', code: 'rust attempt' })
    expect(localStorage.getItem('algocoach.language')).toBe('rust')
  })

  it('clears old run results when the code or test input changes', () => {
    useAppStore.getState().setRunResult({ status_msg: 'Accepted' })
    useAppStore.getState().setCode('new code')
    expect(useAppStore.getState().runResult).toBeNull()
    useAppStore.getState().setRunResult({ status_msg: 'Accepted' })
    useAppStore.getState().setTestInput('new input')
    expect(useAppStore.getState().runResult).toBeNull()
  })

  it('restores language-specific drafts after reloading', async () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setLang('rust')
    useAppStore.getState().setCode('rust draft')
    useAppStore.getState().setLang('python3')
    useAppStore.getState().setCode('python draft')
    vi.resetModules()
    const { useAppStore: restored } = await import('./useAppStore')
    restored.getState().setActiveProblem(problem)
    expect(restored.getState().code).toBe('python draft')
    restored.getState().setLang('rust')
    expect(restored.getState().code).toBe('rust draft')
  })

  it('restores the code, language and test input after changing problems', () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setLang('python3')
    useAppStore.getState().setCode('my solution')
    useAppStore.getState().setTestInput('custom test')
    useAppStore.getState().setActiveProblem({ ...problem, id: '2', platformId: 'other' })
    useAppStore.getState().setLang('rust')
    useAppStore.getState().setActiveProblem(problem)

    expect(useAppStore.getState()).toMatchObject({
      code: 'my solution', codeEdited: true, testInput: 'custom test', lang: 'python3', mode: 'PREP',
    })
  })

  it('keeps total time limits scoped to a problem and restores them after reload', async () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setProblemTimeLimitMinutes('45')
    useAppStore.getState().setActiveProblem({ ...problem, platform: 'HDU', platformId: '1' })
    useAppStore.getState().setProblemTimeLimitMinutes('30')
    useAppStore.getState().setActiveProblem(problem)
    expect(useAppStore.getState().problemTimeLimits).toMatchObject({
      'LEETCODE:two-sum': 2700, 'HDU:1': 1800,
    })
    vi.resetModules()
    const { useAppStore: restored } = await import('./useAppStore')
    restored.getState().setActiveProblem(problem)
    expect(restored.getState().problemTimeLimits['LEETCODE:two-sum']).toBe(2700)
    restored.getState().setProblemTimeLimitMinutes('')
    expect(restored.getState().problemTimeLimits['LEETCODE:two-sum']).toBeUndefined()
  })

  it('stores a global chat time limit separately when no problem is selected', () => {
    useAppStore.getState().setProblemTimeLimitMinutes('25')
    expect(useAppStore.getState().problemTimeLimits).toEqual({ __global__: 1500 })
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setProblemTimeLimitMinutes('10')
    expect(useAppStore.getState().problemTimeLimits).toEqual({
      __global__: 1500,
      'LEETCODE:two-sum': 600,
    })
  })

  it('keeps drafts separate for identical problem ids on different platforms', () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setCode('leetcode solution')
    useAppStore.getState().setActiveProblem({ ...problem, platform: 'CODEFORCES' })
    expect(useAppStore.getState().code).not.toBe('leetcode solution')
    useAppStore.getState().setActiveProblem(problem)
    expect(useAppStore.getState().code).toBe('leetcode solution')
  })

  it('restores the active draft after a page reload', async () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setLang('python3')
    useAppStore.getState().setCode('solution before refresh')
    useAppStore.getState().setTestInput('input before refresh')
    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')
    restoredStore.getState().setActiveProblem(problem)

    expect(restoredStore.getState()).toMatchObject({
      code: 'solution before refresh', codeEdited: true,
      testInput: 'input before refresh', lang: 'python3',
    })
    expect(localStorage.getItem('algocoach.problemDrafts')).toBeNull()
  })

  it('restores the selected problem detail after a page reload', async () => {
    useAppStore.getState().setActiveProblem(problem)
    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')

    expect(restoredStore.getState().activeProblem).toMatchObject({
      platform: 'LEETCODE', platformId: 'two-sum', title: 'Two Sum',
    })
    expect(restoredStore.getState().mode).toBe('PREP')
    expect(restoredStore.getState().code).toContain('fn two_sum')
  })

  it('ignores corrupted stored drafts', async () => {
    sessionStorage.setItem('algocoach.problemDrafts', '{broken')
    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')
    restoredStore.getState().setActiveProblem(problem)
    expect(restoredStore.getState().code).toBeTruthy()
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
    expect(useAppStore.getState().messagesByProblem['LEETCODE:another-problem']).toEqual([])
  })

  it('keeps unsent coach drafts separate per problem and restores them after reload', async () => {
    const secondProblem = { ...problem, id: '2', platformId: 'other' }
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setChatDraft('请帮我检查思路')
    useAppStore.getState().setActiveProblem(secondProblem)
    useAppStore.getState().setChatDraft('为什么会超时？')
    useAppStore.getState().setActiveProblem(problem)

    expect(useAppStore.getState().chatDrafts['LEETCODE:two-sum']).toBe('请帮我检查思路')
    expect(useAppStore.getState().chatDrafts['LEETCODE:other']).toBe('为什么会超时？')

    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')
    restoredStore.getState().setActiveProblem(problem)
    expect(restoredStore.getState().chatDrafts['LEETCODE:two-sum']).toBe('请帮我检查思路')
  })

  it('keeps OI/xCPC training phases per problem and restores them after reload', async () => {
    const secondProblem = { ...problem, id: '2', platformId: 'other' }
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().setChatPhase('hint')
    useAppStore.getState().setActiveProblem(secondProblem)
    useAppStore.getState().setChatPhase('attempt')
    useAppStore.getState().setActiveProblem(problem)

    expect(useAppStore.getState().chatPhases['LEETCODE:two-sum']).toBe('hint')
    expect(useAppStore.getState().chatPhases['LEETCODE:other']).toBe('attempt')

    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')
    restoredStore.getState().setActiveProblem(problem)
    expect(restoredStore.getState().chatPhases['LEETCODE:two-sum']).toBe('hint')
  })

  it('keeps chat histories separate when platforms share a problem id', () => {
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().addMessage({ id: 'lc', role: 'user', content: 'leetcode', timestamp: 'now' })
    useAppStore.getState().setActiveProblem({ ...problem, platform: 'CODEFORCES' })
    expect(useAppStore.getState().messages).toEqual([])
    useAppStore.getState().addMessage({ id: 'cf', role: 'user', content: 'codeforces', timestamp: 'now' })
    useAppStore.getState().setActiveProblem(problem)
    expect(useAppStore.getState().messages.map(message => message.content)).toEqual(['leetcode'])
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

  it('migrates an existing Command Code GOAT Responses preset to Chat Completions', async () => {
    localStorage.setItem('algocoach.provider', JSON.stringify({
      id: 'commandcode-goat',
      name: 'Command Code GOAT',
      protocol: 'openai-response',
      baseUrl: 'https://api.commandcode.ai/provider/v1',
      model: 'deepseek/deepseek-v4.1-flash',
    }))
    sessionStorage.setItem('algocoach.provider.apiKey', 'session-only-key')
    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')

    expect(restoredStore.getState().provider.protocol).toBe('openai')
    expect(restoredStore.getState().provider.apiKey).toBe('session-only-key')
    expect(JSON.parse(localStorage.getItem('algocoach.provider')!).protocol).toBe('openai')
    expect(localStorage.getItem('algocoach.provider.apiKey')).toBeNull()
  })

  it('marks the migration on a fresh profile so a later Responses choice survives', async () => {
    vi.resetModules()
    await import('./useAppStore')
    expect(localStorage.getItem('algocoach.provider.commandcode-protocol-migrated')).toBe('true')

    localStorage.setItem('algocoach.provider', JSON.stringify({
      id: 'commandcode-goat',
      name: 'Command Code GOAT',
      protocol: 'openai-response',
      baseUrl: 'https://api.commandcode.ai/provider/v1',
      model: 'deepseek/deepseek-v4.1-flash',
    }))
    vi.resetModules()
    const { useAppStore: restoredStore } = await import('./useAppStore')

    expect(restoredStore.getState().provider.protocol).toBe('openai-response')
    expect(JSON.parse(localStorage.getItem('algocoach.provider')!).protocol).toBe('openai-response')
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

  it('keeps elapsed focus time isolated per problem and restores it after reload', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T00:00:00.000Z'))
    const secondProblem = { ...problem, platform: 'HDU' as const, platformId: '1000' }
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().enterFocus()
    vi.advanceTimersByTime(5_000)
    useAppStore.getState().exitFocus()
    useAppStore.getState().setActiveProblem(secondProblem)
    expect(useAppStore.getState().getFocusDurationSec()).toBe(0)
    useAppStore.getState().enterFocus()
    vi.advanceTimersByTime(3_000)
    useAppStore.getState().exitFocus()
    useAppStore.getState().setActiveProblem(problem)
    expect(useAppStore.getState().getFocusDurationSec()).toBe(5)
    expect(useAppStore.getState().problemFocusElapsed).toEqual({
      'LEETCODE:two-sum': 5,
      'HDU:1000': 3,
    })

    vi.resetModules()
    const { useAppStore: restored } = await import('./useAppStore')
    restored.getState().setActiveProblem(problem)
    expect(restored.getState().getFocusDurationSec()).toBe(5)
    vi.useRealTimers()
  })

  it('restores the focused problem and accumulated time on first store initialization after reload', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'))
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().enterFocus()
    const start = useAppStore.getState().focusStartTs!
    useAppStore.getState().checkpointFocusDuration(start + 12_000)
    expect(useAppStore.getState().problemFocusElapsed['LEETCODE:two-sum']).toBeUndefined()
    expect(sessionStorage.getItem('algocoach.problemFocusElapsed')).toContain('"LEETCODE:two-sum":12')
    vi.resetModules()
    const { useAppStore: restored } = await import('./useAppStore')
    expect(restored.getState()).toMatchObject({
      activeProblem: problem,
      mode: 'PREP',
      focusStartTs: null,
      focusElapsedSec: 12,
    })
    expect(restored.getState().getFocusDurationSec()).toBe(12)
    vi.useRealTimers()
  })

  it('persists focus checkpoints without broadcasting a Store update each second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'))
    useAppStore.getState().setActiveProblem(problem)
    useAppStore.getState().enterFocus()
    let notifications = 0
    const unsubscribe = useAppStore.subscribe(() => { notifications += 1 })

    const start = useAppStore.getState().focusStartTs!
    useAppStore.getState().checkpointFocusDuration(start + 1_000)

    expect(sessionStorage.getItem('algocoach.problemFocusElapsed')).toContain('"LEETCODE:two-sum":1')
    expect(useAppStore.getState().problemFocusElapsed['LEETCODE:two-sum']).toBeUndefined()
    expect(notifications).toBe(0)
    unsubscribe()
    vi.useRealTimers()
  })

  it('calculates live focus duration against an explicit clock value', () => {
    useAppStore.getState().enterFocus()
    const startedAt = useAppStore.getState().focusStartTs!
    expect(useAppStore.getState().getFocusDurationSec(startedAt - 1_000)).toBe(0)
    expect(useAppStore.getState().getFocusDurationSec(startedAt + 4_999)).toBe(4)
    expect(useAppStore.getState().getFocusDurationSec(startedAt + 5_000)).toBe(5)
  })
})
