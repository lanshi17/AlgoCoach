import { useCallback, useEffect, useRef, useState } from 'react'
import { leetcodeService, type SubmissionResultDto } from '@/services/leetcodeService'
import { isGuidedCodeTemplate } from '@/services/guidedCodeTemplates'
import { problemSnippet, topicSlugsFor } from '@/services/guidedLeetCode'
import type { CodeLanguage, Problem, RunResult } from '@/types'

export function useGuidedProblemList(topic: string, open: boolean) {
  const [problems, setProblems] = useState<Problem[]>([])
  const [filter, setFilter] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const loadedTopic = useRef<string | null>(null)

  const loadProblems = useCallback(async () => {
    loadedTopic.current = topic
    setListLoading(true)
    setListError('')
    try {
      const result = await leetcodeService.listProblems({ page: 1, topicSlugs: topicSlugsFor(topic) })
      setProblems(result.problems)
    } catch {
      setListError('无法读取 LeetCode 题库。请先在设置页配置 LeetCode Cookie，并确认网关可访问。')
      setProblems([])
    } finally {
      setListLoading(false)
    }
  }, [topic])

  useEffect(() => {
    if (!open || loadedTopic.current === topic) return
    void loadProblems()
  }, [open, topic, loadProblems])

  const visibleProblems = problems.filter(problem => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return true
    return `${problem.title} ${problem.titleCn ?? ''} ${problem.platformId}`.toLowerCase().includes(needle)
  })

  return { problems, visibleProblems, filter, setFilter, listLoading, listError, loadProblems }
}

interface ProblemBindingInput {
  stageId: string
  language: CodeLanguage
  code: string
  disabled: boolean
  onReplaceCode: (code: string) => void
}

export function useGuidedProblemBinding(input: ProblemBindingInput) {
  const { stageId, language, code, disabled, onReplaceCode } = input
  const [selected, setSelected] = useState<Problem | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const lastSnippet = useRef('')
  const codeRef = useRef(code)
  codeRef.current = code

  useEffect(() => {
    setSelected(null)
    setSelectionError('')
    lastSnippet.current = ''
  }, [stageId])

  useEffect(() => {
    if (!selected) return
    const snippet = problemSnippet(selected, language)
    if (!snippet) return
    if (isGuidedCodeTemplate(codeRef.current) || codeRef.current === lastSnippet.current) {
      lastSnippet.current = snippet
      onReplaceCode(snippet)
    }
  }, [language, selected, onReplaceCode])

  async function bindProblem(slug: string): Promise<boolean> {
    if (!slug || selecting || disabled) return false
    setSelecting(true)
    setSelectionError('')
    try {
      const detail = await leetcodeService.getProblem(slug)
      const snippet = problemSnippet(detail, language)
      const wouldReplaceCustomCode = snippet
        && codeRef.current.trim()
        && !isGuidedCodeTemplate(codeRef.current)
        && codeRef.current !== lastSnippet.current
      if (wouldReplaceCustomCode && !window.confirm('绑定 LeetCode 题目会替换当前代码，继续？')) return false
      setSelected(detail)
      if (snippet) {
        lastSnippet.current = snippet
        onReplaceCode(snippet)
      }
      return true
    } catch {
      setSelectionError('读取题目详情失败。请检查 LeetCode Cookie 或网络。')
      return false
    } finally {
      setSelecting(false)
    }
  }

  return {
    selected,
    selectedSnippet: selected ? problemSnippet(selected, language) : null,
    selecting,
    selectionError,
    bindProblem,
  }
}

interface LeetCodeAttemptInput {
  problem: Problem | null
  code: string
  language: CodeLanguage
  startedAt: number
  disabled: boolean
  snippetAvailable: boolean
  onAccepted: (problem: Problem) => void
}

export interface LeetCodeAttemptState {
  runResult: RunResult | null
  runError: string
  running: boolean
  submitResult: SubmissionResultDto | null
  submitError: string
  submitting: boolean
  canAttempt: boolean
  runSample: () => Promise<void>
  submitToLeetCode: () => Promise<void>
}

export function useLeetCodeAttempt(input: LeetCodeAttemptInput): LeetCodeAttemptState {
  const { problem, code, language, startedAt, disabled, snippetAvailable, onAccepted } = input
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState('')
  const [running, setRunning] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmissionResultDto | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setRunResult(null)
    setRunError('')
    setSubmitResult(null)
    setSubmitError('')
  }, [problem?.platformId])

  const canAttempt = Boolean(problem) && snippetAvailable && !disabled

  async function runSample() {
    if (!problem || !canAttempt || running || submitting) return
    setRunning(true)
    setRunError('')
    setRunResult(null)
    try {
      setRunResult(await leetcodeService.runTests(problem.platformId, code, language, problem.sampleTestCases))
    } catch {
      setRunError('运行失败。请检查 LeetCode Cookie、当前语言和样例输入。')
    } finally {
      setRunning(false)
    }
  }

  async function submitToLeetCode() {
    if (!problem || !canAttempt || running || submitting) return
    setSubmitting(true)
    setSubmitError('')
    setSubmitResult(null)
    try {
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      const result = await leetcodeService.submit(problem.platformId, code, language, durationSec)
      setSubmitResult(result)
      if (result.status === 'ACCEPTED') onAccepted(problem)
    } catch {
      setSubmitError('提交失败。请检查 LeetCode Cookie、网络和当前语言。')
    } finally {
      setSubmitting(false)
    }
  }

  return { runResult, runError, running, submitResult, submitError, submitting, canAttempt, runSample, submitToLeetCode }
}
