import React, { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Badge } from '@/components/Common/Badge'
import { AlertCircle, Loader2, Play, RefreshCw } from 'lucide-react'
import { leetcodeService } from '@/services/leetcodeService'
import type { Problem } from '@/types'
import DOMPurify from 'dompurify'

/**
 * Left panel — problem description (HTML rendered).
 * Includes title, tags, difficulty, rendered statement, and a "start solving" CTA.
 */
export default function ProblemPanel() {
  const { activeProblem, mode, enterFocus, setActiveProblem } = useAppStore()
  const [problems, setProblems] = useState<Problem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(!activeProblem)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [difficulty, setDifficulty] = useState('')
  const [search, setSearch] = useState('')
  const safeContent = DOMPurify.sanitize(activeProblem?.contentHtml ?? '', {
    ALLOWED_TAGS: [
      'a', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'div', 'dl', 'dt', 'em',
      'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'small',
      'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
    ],
    ALLOWED_ATTR: ['alt', 'class', 'colspan', 'height', 'href', 'rel', 'rowspan', 'src', 'target', 'title', 'width'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#)/i,
  })

  const loadProblems = useCallback(async (nextPage: number, nextDifficulty: string) => {
    setLoadingList(true)
    setError('')
    try {
      const result = await leetcodeService.listProblems({ page: nextPage, difficulty: nextDifficulty || undefined })
      setProblems(result.problems)
      setTotal(result.total)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { void loadProblems(page, difficulty) }, [loadProblems, page, difficulty])

  const visibleProblems = problems.filter(problem =>
    `${problem.title} ${problem.platformId}`.toLowerCase().includes(search.trim().toLowerCase()))

  const openProblem = async (problem: Problem) => {
    setLoadingSlug(problem.platformId)
    setError('')
    try {
      setActiveProblem(await leetcodeService.getProblem(problem.platformId))
      setShowPicker(false)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setLoadingSlug(null)
    }
  }

  if (!activeProblem || showPicker) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-5 py-4 border-b border-border dark:border-border-dark">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">选择一道题目</h2>
              <p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">从 LeetCode 题库开始训练</p>
            </div>
            {activeProblem && <button onClick={() => setShowPicker(false)} className="text-xs text-accent hover:underline">返回当前题</button>}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={search} onChange={event => setSearch(event.target.value)}
              aria-label="搜索当前页题目" placeholder="搜索题名或 slug"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-soft px-2 py-1.5 text-xs outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft" />
            <select aria-label="按难度筛选" value={difficulty} onChange={event => { setPage(1); setDifficulty(event.target.value) }}
              className="rounded-md border border-border bg-surface-soft px-2 py-1.5 text-xs outline-none dark:border-border-dark dark:bg-surface-dark-soft">
              <option value="">全部难度</option><option value="EASY">简单</option><option value="MEDIUM">中等</option><option value="HARD">困难</option>
            </select>
          </div>
        </div>
        {error && <div role="alert" className="mx-4 mt-3 rounded-md bg-red-50 p-3 text-xs text-danger dark:bg-red-900/10">{error}</div>}
        {loadingList ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
            <Loader2 size={16} className="animate-spin" /> 正在取回题目列表…
          </div>
        ) : visibleProblems.length ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <div className="space-y-1">
              {visibleProblems.map(problem => (
                <button key={problem.platformId} onClick={() => void openProblem(problem)}
                  disabled={loadingSlug !== null}
                  className="w-full rounded-md px-3 py-2 text-left hover:bg-surface-muted disabled:opacity-50
                             dark:hover:bg-surface-dark-muted">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-text-primary dark:text-text-dark-primary">{problem.title}</span>
                    {loadingSlug === problem.platformId
                      ? <Loader2 size={14} className="shrink-0 animate-spin" />
                      : <Badge difficulty={problem.difficulty} />}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-text-muted dark:text-text-dark-muted">
                    {problem.platformId}{problem.topics.length ? ` · ${problem.topics.join('、')}` : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3 text-xs dark:border-border-dark">
              <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1}
                className="text-text-secondary hover:text-accent disabled:opacity-40 dark:text-text-dark-secondary">上一页</button>
              <span className="text-text-muted dark:text-text-dark-muted">{page} / {Math.max(1, Math.ceil(total / 50))}</span>
              <button onClick={() => setPage(value => value + 1)} disabled={page >= Math.ceil(total / 50)}
                className="text-text-secondary hover:text-accent disabled:opacity-40 dark:text-text-dark-secondary">下一页</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-text-muted dark:text-text-dark-muted">
            <AlertCircle size={24} />
            <p>{search.trim() ? '当前页没有匹配的题目。可以换个关键词，或切换到其他页面继续搜索。' : '暂时没有题目可显示。请检查 LeetCode Cookie 和网关连接。'}</p>
            <button onClick={() => void loadProblems(page, difficulty)} className="inline-flex items-center gap-2 text-accent hover:underline">
              <RefreshCw size={14} /> 重新加载
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Title block */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-border dark:border-border-dark">
        <div className="flex justify-end mb-2">
          <button onClick={() => setShowPicker(true)} disabled={mode === 'FOCUS'}
            title={mode === 'FOCUS' ? '专注解题时不能切换题目' : '更换题目'}
            className="text-xs text-text-muted hover:text-accent disabled:opacity-40">
            更换题目
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge difficulty={activeProblem.difficulty} />
          {activeProblem.dailyQuestion && (
            <span className="badge bg-accent/10 text-accent">每日一题</span>
          )}
        </div>
        <h1 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-2">
          {activeProblem.titleCn ?? activeProblem.title}
        </h1>
        <div className="flex flex-wrap gap-1">
          {activeProblem.topics.map(t => (
            <span key={t} className="badge bg-surface-muted dark:bg-surface-dark-muted
                                     text-text-secondary dark:text-text-dark-secondary">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Statement body */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed
                   text-text-primary dark:text-text-dark-primary prose prose-sm
                   dark:prose-invert max-w-none
                   [&_pre]:bg-surface-muted [&_pre]:dark:bg-surface-dark-muted
                   [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:font-mono"
        dangerouslySetInnerHTML={{ __html: safeContent }}
      />

      {/* Start CTA — only in PREP */}
      {mode === 'PREP' && (
        <div className="flex-shrink-0 p-4 border-t border-border dark:border-border-dark
                        bg-surface-soft dark:bg-surface-dark-soft">
          <button
            onClick={enterFocus}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                       bg-accent hover:bg-accent-hover text-white text-sm font-medium
                       transition-colors"
          >
            <Play size={14} /> 开始做题（AI 将静默）
          </button>
          <p className="text-xs text-text-muted dark:text-text-dark-muted mt-2 text-center">
            做题期间 AI 完全禁言，编辑器只保留本地语法辅助
          </p>
        </div>
      )}
    </div>
  )
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  if (error instanceof Error) return error.message
  return '请求失败，请检查网关和 LeetCode Cookie 后重试'
}
