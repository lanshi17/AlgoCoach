import { useState } from 'react'
import { ExternalLink, Play, Send, Trophy } from 'lucide-react'
import { describeRunResult } from '@/services/guidedLeetCode'
import { useGuidedProblemBinding, useGuidedProblemList, useLeetCodeAttempt, type LeetCodeAttemptState } from '@/hooks/useGuidedLeetCode'
import type { CodeLanguage, Problem } from '@/types'

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
  const list = useGuidedProblemList(topic, open)
  const binding = useGuidedProblemBinding({ stageId, language, code, disabled, onReplaceCode })
  const attempt = useLeetCodeAttempt({
    problem: binding.selected,
    code,
    language,
    startedAt,
    disabled,
    snippetAvailable: Boolean(binding.selectedSnippet),
    onAccepted,
  })

  const chooseProblem = async (slug: string) => {
    if (await binding.bindProblem(slug)) setOpen(false)
  }

  return (
    <div className="code-workbench shrink-0 border-b px-3 py-2 text-xs" style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel-raised)', color: 'var(--code-ink)' }}>
      <PanelHeader open={open} onToggle={() => setOpen(value => !value)} selected={binding.selected} />
      {open && (
        <ProblemPicker
          problems={list.problems}
          visibleProblems={list.visibleProblems}
          filter={list.filter}
          onFilter={list.setFilter}
          loading={list.listLoading}
          error={list.listError || binding.selectionError}
          selecting={binding.selecting}
          selected={binding.selected}
          disabled={disabled}
          onRefresh={() => void list.loadProblems()}
          onSelect={chooseProblem}
        />
      )}
      {binding.selected && (
        <AttemptActions
          problem={binding.selected}
          snippetAvailable={Boolean(binding.selectedSnippet)}
          attempt={attempt}
        />
      )}
    </div>
  )
}

interface PanelHeaderProps {
  open: boolean
  selected: Problem | null
  onToggle: () => void
}

function PanelHeader({ open, selected, onToggle }: PanelHeaderProps) {
  const title = selected ? selected.titleCn ?? selected.title : ''
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Trophy size={13} className="shrink-0 text-accent" />
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label="LeetCode 实战"
        className="shrink-0 font-medium hover:underline">
        LeetCode 实战
      </button>
      {selected ? (
        <>
          <span className="min-w-0 truncate" title={title}>· {title}</span>
          <a href={`https://leetcode.cn/problems/${selected.platformId}/`} target="_blank" rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-accent hover:underline">
            打开 <ExternalLink size={11} />
          </a>
          <button type="button" onClick={onToggle} className="shrink-0 text-accent hover:underline">
            {open ? '收起' : '更换'}
          </button>
        </>
      ) : (
        <span className="min-w-0 truncate text-[11px]" style={{ color: 'var(--code-muted)' }}>
          可选：绑定真题后直接运行/提交
        </span>
      )}
    </div>
  )
}

interface ProblemPickerProps {
  problems: Problem[]
  visibleProblems: Problem[]
  filter: string
  onFilter: (value: string) => void
  loading: boolean
  error: string
  selecting: boolean
  selected: Problem | null
  disabled: boolean
  onRefresh: () => void
  onSelect: (slug: string) => void
}

function ProblemPicker(input: ProblemPickerProps) {
  const { problems, visibleProblems, filter, onFilter, loading, error, selecting, selected, disabled, onRefresh, onSelect } = input
  return (
    <div className="mt-2 space-y-2" aria-label="LeetCode 题目选择">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="筛选 LeetCode 题目" value={filter} onChange={event => onFilter(event.target.value)}
          placeholder="按题名筛选已加载题目"
          className="h-8 min-w-0 flex-1 rounded border px-2 outline-none"
          style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel)' }} />
        <button type="button" onClick={onRefresh} disabled={loading}
          className="rounded border px-2 py-1 disabled:opacity-50" style={{ borderColor: 'var(--code-rule)' }}>
          {loading ? '加载中…' : '刷新题库'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[11px]" style={{ color: 'var(--code-error, #d33)' }}>
          {error} <a href="/settings/platforms" className="underline">去配置</a>
        </p>
      )}
      {!error && !loading && problems.length === 0 && <p style={{ color: 'var(--code-muted)' }}>没有加载到题目。</p>}
      {problems.length > 0 && (
        <select aria-label="选择 LeetCode 题目" value={selected?.platformId ?? ''}
          disabled={disabled || selecting || loading}
          onChange={event => onSelect(event.target.value)}
          className="h-8 w-full rounded border px-2 outline-none disabled:opacity-50"
          style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel)', color: 'var(--code-ink)' }}>
          <option value="">{selecting ? '正在读取题目…' : '选择一道题以载入模板'}</option>
          {visibleProblems.map(problem => (
            <option key={problem.platformId} value={problem.platformId}>
              {problem.titleCn ?? problem.title} · {problem.difficulty}
            </option>
          ))}
        </select>
      )}
      {visibleProblems.length === 0 && problems.length > 0 && <p style={{ color: 'var(--code-muted)' }}>没有匹配的题目。</p>}
    </div>
  )
}

interface AttemptActionsProps {
  problem: Problem
  snippetAvailable: boolean
  attempt: LeetCodeAttemptState
}

function AttemptActions({ problem, snippetAvailable, attempt }: AttemptActionsProps) {
  const { runResult, runError, running, submitResult, submitError, submitting, canAttempt, runSample, submitToLeetCode } = attempt
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void runSample()} disabled={!canAttempt || running || submitting}
        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 disabled:opacity-50"
        style={{ background: 'var(--code-panel)', border: '1px solid var(--code-rule)' }}>
        <Play size={11} />{running ? '运行中…' : '运行样例'}
      </button>
      <button type="button" onClick={() => void submitToLeetCode()} disabled={!canAttempt || running || submitting}
        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 font-medium text-white disabled:opacity-50"
        style={{ background: 'var(--code-focus)' }}>
        <Send size={11} />{submitting ? '提交中…' : '提交 LeetCode'}
      </button>
      {!snippetAvailable && <span role="status" className="text-[11px] text-warning">该题没有当前语言的模板，请换语言或题目。</span>}
      {runResult && <span role="status" className="text-[11px]">运行：{describeRunResult(runResult)}</span>}
      {runError && <span role="alert" className="text-[11px] text-danger">{runError}</span>}
      {submitResult && (
        <span role="status" className={`text-[11px] ${submitResult.status === 'ACCEPTED' ? 'text-success' : 'text-danger'}`}>
          {problem.platformId} · {submitResult.status}
          {submitResult.passedTests != null && submitResult.totalTests != null
            ? ` · ${submitResult.passedTests}/${submitResult.totalTests} 测试点`
            : ''}
        </span>
      )}
      {submitError && <span role="alert" className="text-[11px] text-danger">{submitError}</span>}
    </div>
  )
}
