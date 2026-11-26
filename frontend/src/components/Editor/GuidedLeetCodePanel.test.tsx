import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { leetcodeService } from '@/services/leetcodeService'
import { GUIDED_CODE_TEMPLATES } from '@/services/guidedCodeTemplates'
import type { Problem } from '@/types'
import GuidedLeetCodePanel from './GuidedLeetCodePanel'

const problem: Problem = {
  id: '704', platform: 'LEETCODE', platformId: 'binary-search', title: 'Binary Search',
  titleCn: '二分查找', difficulty: 'EASY', contentHtml: '', topics: ['二分查找'], sampleTestCases: 'nums = [-1,0,3,5,9,12]\ntarget = 9',
  codeSnippets: [{ lang: 'python3', code: 'def search(nums, target):\n    pass\n' }],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('guided LeetCode practice', () => {
  it('loads problems only after opening, binds a snippet, then runs and submits', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const listProblems = vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [problem], total: 1, pageSize: 50 })
    const getProblem = vi.spyOn(leetcodeService, 'getProblem').mockResolvedValue(problem)
    const runTests = vi.spyOn(leetcodeService, 'runTests').mockResolvedValue({
      total_correct: 1, total_testcases: 1, status_msg: 'Accepted',
    })
    const submit = vi.spyOn(leetcodeService, 'submit').mockResolvedValue({
      id: '1', status: 'ACCEPTED', runtimeMs: 12, memoryMb: 8, passedTests: 1, totalTests: 1,
      errorMessage: null, durationSec: 5,
    })
    const onReplaceCode = vi.fn()
    const onAccepted = vi.fn()

    const element = document.createElement('div')
    document.body.appendChild(element)
    const root = createRoot(element)
    await act(async () => {
      root.render(
        <GuidedLeetCodePanel stageId="code" topic="二分查找" language="python3"
          code={GUIDED_CODE_TEMPLATES.python3} startedAt={Date.now() - 5000}
          onReplaceCode={onReplaceCode} onAccepted={onAccepted} />,
      )
    })
    expect(listProblems).not.toHaveBeenCalled()

    await act(async () => {
      element.querySelector<HTMLButtonElement>('button[aria-label="LeetCode 实战"]')!.click()
      await Promise.resolve()
    })
    expect(listProblems).toHaveBeenCalledWith(expect.objectContaining({ topicSlugs: ['binary-search'] }))

    const select = element.querySelector<HTMLSelectElement>('select[aria-label="选择 LeetCode 题目"]')!
    await act(async () => {
      select.value = 'binary-search'
      select.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })
    expect(getProblem).toHaveBeenCalledWith('binary-search')
    expect(onReplaceCode).toHaveBeenCalledWith('def search(nums, target):\n    pass\n')

    await act(async () => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
        .find(button => button.textContent?.includes('运行样例'))!.click()
      await Promise.resolve()
    })
    expect(runTests).toHaveBeenCalledWith('binary-search', GUIDED_CODE_TEMPLATES.python3, 'python3', problem.sampleTestCases)
    expect(element.textContent).toContain('1/1 样例通过')

    await act(async () => {
      Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
        .find(button => button.textContent?.includes('提交 LeetCode'))!.click()
      await Promise.resolve()
    })
    expect(submit).toHaveBeenCalledWith(
      'binary-search', GUIDED_CODE_TEMPLATES.python3, 'python3', expect.any(Number),
    )
    expect(onAccepted).toHaveBeenCalledWith(problem)
    expect(element.textContent).toContain('ACCEPTED')

    await act(async () => root.unmount())
    element.remove()
  })

  it('keeps a custom draft when the replacement confirmation is cancelled', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.spyOn(leetcodeService, 'listProblems').mockResolvedValue({ problems: [problem], total: 1, pageSize: 50 })
    vi.spyOn(leetcodeService, 'getProblem').mockResolvedValue(problem)
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const onReplaceCode = vi.fn()
    const element = document.createElement('div')
    document.body.appendChild(element)
    const root = createRoot(element)
    await act(async () => {
      root.render(
        <GuidedLeetCodePanel stageId="code" topic="二分查找" language="python3"
          code="print('custom')" startedAt={Date.now()}
          onReplaceCode={onReplaceCode} onAccepted={vi.fn()} />,
      )
    })
    await act(async () => {
      element.querySelector<HTMLButtonElement>('button[aria-label="LeetCode 实战"]')!.click()
      await Promise.resolve()
    })
    const select = element.querySelector<HTMLSelectElement>('select[aria-label="选择 LeetCode 题目"]')!
    await act(async () => {
      select.value = 'binary-search'
      select.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })
    expect(confirm).toHaveBeenCalled()
    expect(onReplaceCode).not.toHaveBeenCalled()
    expect(element.querySelector('a[href*="leetcode.cn/problems/"]')).toBeNull()
    await act(async () => root.unmount())
    element.remove()
  })

  it('shows a configuration hint when the problem list cannot be read', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.spyOn(leetcodeService, 'listProblems').mockRejectedValue(new Error('401'))
    const element = document.createElement('div')
    document.body.appendChild(element)
    const root = createRoot(element)
    await act(async () => {
      root.render(
        <GuidedLeetCodePanel stageId="code" topic="二分查找" language="python3"
          code={GUIDED_CODE_TEMPLATES.python3} startedAt={Date.now()}
          onReplaceCode={vi.fn()} onAccepted={vi.fn()} />,
      )
    })
    await act(async () => {
      element.querySelector<HTMLButtonElement>('button[aria-label="LeetCode 实战"]')!.click()
      await Promise.resolve()
    })
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('LeetCode Cookie')
    expect(element.querySelector('a[href="/settings/platforms"]')).not.toBeNull()
    await act(async () => root.unmount())
    element.remove()
  })
})
