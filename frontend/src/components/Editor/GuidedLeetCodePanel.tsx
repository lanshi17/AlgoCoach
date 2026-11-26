import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Play, Send, Trophy } from 'lucide-react'
import { leetcodeService, type SubmissionResultDto } from '@/services/leetcodeService'
import { TRAINING_TOPICS } from '@/services/trainingTopics'
import { isGuidedCodeTemplate } from '@/services/guidedCodeTemplates'
import type { CodeLanguage, Problem, RunResult } from '@/types'

const MAX_VISIBLE_PROBLEMS = 80

interface GuidedLeetCodePanelProps {
  stageId: string
  topic: string
  language: CodeLanguage
  code: string
  startedAt: number
  disabled?: boolean
  onReplaceCode: (code: string) => void
  onAccepted: (problem: Problem) => void
}

/**
 * Optional LeetCode practice inside a guided code stage. The learner chooses a
 * real problem; run and submit go through the Gateway, which owns the cookie.
 * A LeetCode AC can pass the stage as deterministic judge evidence.
 */
export default function GuidedLeetCodePanel({
  stageId, topic, language, code, startedAt, disabled = false, onReplaceCode, onAccepted,
}: GuidedLeetCodePanelProps) {
  const [open, setOpen] = useState(false)
  const [problems, setProblems] = useState<Problem[]>([])
  const [filter, setFilter] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [selected, setSelected] = useState<Problem | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState('')
  const [running, setRunning] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmissionResultDto | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loadedTopic = useRef<string | null>(null)
  const lastSnippet = useRef('')
  const codeRef = useRef(code)
  codeRef.current = code

  useEffect(() => {
    setSelected(null)
    setRunResult(null)
    setSubmitResult(null)
    setListError('')
    setRunError('')
    setSubmitError('')
    lastSnippet.current = ''
  }, [stageId])

  const loadProblems = useCallback(async () => {
    loadedTopic.current = topic
    setListLoading(true)
    setListError('')
    try {
      const result = await leetcodeService.listProblems({ page: 1, topicSlugs: topicSlugsFor(topic) })
      setProblems(result.problems.slice(0, MAX_VISIBLE_PROBLEMS))
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

  useEffect(() => {
    if (!selected) return
    const snippet = snippetFor(selected, language)
    if (!snippet) return
    if (isGuidedCodeTemplate(codeRef.current) || codeRef.current === lastSnippet.current) {
      lastSnippet.current = snippet
      onReplaceCode(snippet)
    }
  }, [language, selected, onReplaceCode])

  async function bindProblem(slug: string) {
    if (!slug || selecting || disabled) return
    setSelecting(true)
    setListError('')
    try {
      const detail = await leetcodeService.getProblem(slug)
      const snippet = snippetFor(detail, language)
      if (snippet && codeRef.current.trim() && !isGuidedCodeTemplate(codeRef.current)
        && codeRef.current !== lastSnippet.current
        && !window.confirm('绑定 LeetCode 题目会替换当前代码，继续？')) {
        return
      }
      setSelected(detail)
      setOpen(false)
      setRunResult(null)
      setSubmitResult(null)
      setRunError('')
      setSubmitError('')
      if (snippet) {
        lastSnippet.current = snippet
        onReplaceCode(snippet)
      }
    } catch {
      setListError('读取题目详情失败。请检查 LeetCode Cookie 或网络。')
    } finally {
      setSelecting(false)
    }
  }

  async function runSample() {
    if (!selected || !snippetFor(selected, language) || running || submitting || disabled) return
    setRunning(true)
    setRunError('')
    setRunResult(null)
    try {
      const result = await leetcodeService.runTests(selected.platformId, code, language, selected.sampleTestCases)
      setRunResult(result)
    } catch {
      setRunError('运行失败。请检查 LeetCode Cookie、当前语言和样例输入。')
    } finally {
      setRunning(false)
    }
  }

  async function submitToLeetCode() {
    if (!selected || !snippetFor(selected, language) || running || submitting || disabled) return
    setSubmitting(true)
    setSubmitError('')
    setSubmitResult(null)
    try {
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      const result = await leetcodeService.submit(selected.platformId, code, language, durationSec)
      setSubmitResult(result)
      if (result.status === 'ACCEPTED') onAccepted(selected)
    } catch {
      setSubmitError('提交失败。请检查 LeetCode Cookie、网络和当前语言。')
    } finally {
      setSubmitting(false)
    }
  }

  const visible = problems.filter(problem => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return true
    return `${problem.title} ${problem.titleCn ?? ''} ${problem.platformId}`.toLowerCase().includes(needle)
  })
  const selectedTitle = selected ? selected.titleCn ?? selected.title : ''
  const selectedSnippet = selected ? snippetFor(selected, language) : null
  const actionsDisabled = disabled || selecting

  return (
    <div className="code-workbench shrink-0 border-b px-3 py-2 text-xs" style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel-raised)', color: 'var(--code-ink)' }}>
      <div className="flex min-w-0 items-center gap-2">
        <Trophy size={13} className="shrink-0 text-accent" />
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-label="LeetCode 实战"
          className="shrink-0 font-medium hover:underline"
        >
          LeetCode 实战
        </button>
        {selected ? (
          <>
            <span className="min-w-0 truncate" title={selectedTitle}>· {selectedTitle}</span>
            <a
              href={`https://leetcode.cn/problems/${selected.platformId}/`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-accent hover:underline"
            >
              打开 <ExternalLink size={11} />
            </a>
            <button type="button" onClick={() => setOpen(value => !value)} className="shrink-0 text-accent hover:underline">
              {open ? '收起' : '更换'}
            </button>
          </>
        ) : (
          <span className="min-w-0 truncate text-[11px]" style={{ color: 'var(--code-muted)' }}>可选：绑定真题后直接运行/提交</span>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2" aria-label="LeetCode 题目选择">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="筛选 LeetCode 题目"
              value={filter}
              onChange={event => setFilter(event.target.value)}
              placeholder="按题名筛选已加载题目"
              className="h-8 min-w-0 flex-1 rounded border px-2 outline-none"
              style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel)' }}
            />
            <button type="button" onClick={() => void loadProblems()} disabled={listLoading}
              className="rounded border px-2 py-1 disabled:opacity-50"
              style={{ borderColor: 'var(--code-rule)' }}>
              {listLoading ? '加载中…' : '刷新题库'}
            </button>
          </div>
          {listError && (
            <p role="alert" className="text-[11px]" style={{ color: 'var(--code-error, #d33)' }}>
              {listError} <a href="/settings/platforms" className="underline">去配置</a>
            </p>
          )}
          {!listError && !listLoading && problems.length === 0 && <p style={{ color: 'var(--code-muted)' }}>没有加载到题目。</p>}
          {problems.length > 0 && (
            <select
              aria-label="选择 LeetCode 题目"
              value={selected?.platformId ?? ''}
              disabled={actionsDisabled || listLoading}
              onChange={event => void bindProblem(event.target.value)}
              className="h-8 w-full rounded border px-2 outline-none disabled:opacity-50"
              style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel)', color: 'var(--code-ink)' }}
            >
              <option value="">{selecting ? '正在读取题目…' : '选择一道题以载入模板'}</option>
              {visible.map(problem => (
                <option key={problem.platformId} value={problem.platformId}>
                  {problem.titleCn ?? problem.title} · {problem.difficulty}
                </option>
              ))}
            </select>
          )}
          {visible.length === 0 && problems.length > 0 && <p style={{ color: 'var(--code-muted)' }}>没有匹配的题目。</p>}
        </div>
      )}

      {selected && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void runSample()} disabled={disabled || !selectedSnippet || running || submitting}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 disabled:opacity-50"
            style={{ background: 'var(--code-panel)', border: '1px solid var(--code-rule)' }}>
            <Play size={11} />{running ? '运行中…' : '运行样例'}
          </button>
          <button type="button" onClick={() => void submitToLeetCode()} disabled={disabled || !selectedSnippet || running || submitting}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--code-focus)' }}>
            <Send size={11} />{submitting ? '提交中…' : '提交 LeetCode'}
          </button>
          {selected && !selectedSnippet && <span role="status" className="text-[11px] text-warning">该题没有当前语言的模板，请换语言或题目。</span>}
          {runResult && <span role="status" className="text-[11px]">运行：{runSummary(runResult)}</span>}
          {runError && <span role="alert" className="text-[11px] text-danger">{runError}</span>}
          {submitResult && (
            <span role="status" className={`text-[11px] ${submitResult.status === 'ACCEPTED' ? 'text-success' : 'text-danger'}`}>
              {submitResult.status}
              {submitResult.passedTests != null && submitResult.totalTests != null
                ? ` · ${submitResult.passedTests}/${submitResult.totalTests} 测试点`
                : ''}
            </span>
          )}
          {submitError && <span role="alert" className="text-[11px] text-danger">{submitError}</span>}
        </div>
      )}
    </div>
  )
}

function topicSlugsFor(topic: string): string[] {
  const value = topic.trim().toLowerCase()
  if (!value) return []
  const match = TRAINING_TOPICS.find(item => (
    value.includes(item.name.toLowerCase())
    || item.name.toLowerCase().includes(value)
    || item.slugs.some(slug => value.includes(slug))
  ))
  return match?.slugs ?? []
}

function snippetFor(problem: Problem, language: CodeLanguage): string | null {
  return problem.codeSnippets.find(snippet => snippet.lang === language)?.code ?? null
}

function runSummary(result: RunResult): string {
  if (result.compile_error) return '编译错误'
  if (result.runtime_error) return '运行错误'
  if (result.total_testcases != null) return `${result.total_correct ?? 0}/${result.total_testcases} 样例通过`
  return result.status_msg ?? result.state ?? '已返回'
}
