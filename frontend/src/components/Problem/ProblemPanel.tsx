import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/stores/useAppStore'
import { Badge } from '@/components/Common/Badge'
import { AlertCircle, Loader2, Play, RefreshCw } from 'lucide-react'
import { leetcodeService } from '@/services/leetcodeService'
import { acwingService } from '@/services/acwingService'
import { hduService } from '@/services/hduService'
import { ACWING_TOPICS, findAcWingTopic, TRAINING_TOPICS, findTrainingTopic } from '@/services/trainingTopics'
import type { Problem } from '@/types'
import DOMPurify from 'dompurify'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'

type PickerPlatform = 'LEETCODE' | 'ACWING' | 'HDU'

const PLATFORM_LABELS: Record<PickerPlatform, string> = {
  LEETCODE: 'LeetCode',
  ACWING: 'AcWing',
  HDU: '杭电 HDU',
}

/**
 * Left panel — problem description (HTML rendered).
 * Includes title, tags, difficulty, rendered statement, and a "start solving" CTA.
 */
export default function ProblemPanel() {
  const { activeProblem, mode, enterFocus, setActiveProblem, refreshActiveProblem } = useAppStore(useShallow(state => ({
    activeProblem: state.activeProblem,
    mode: state.mode,
    enterFocus: state.enterFocus,
    setActiveProblem: state.setActiveProblem,
    refreshActiveProblem: state.refreshActiveProblem,
  })))
  const [problems, setProblems] = useState<Problem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null)
  const [restoredStatementStatus, setRestoredStatementStatus] = useState<'idle' | 'refreshing' | 'offline'>('idle')
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(!activeProblem)
  const [platform, setPlatform] = useState<PickerPlatform>('LEETCODE')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [difficulty, setDifficulty] = useState('')
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const selectedTopic = useMemo(() => findTrainingTopic(topic), [topic])
  const selectedAcWingTopic = useMemo(() => findAcWingTopic(topic), [topic])
  const topicSlugs = useMemo(() => selectedTopic?.slugs ?? [], [selectedTopic])
  const requestSeq = useRef(0)
  const problemListRequestRef = useRef<{ key: string; promise: Promise<void> } | null>(null)
  const detailSeq = useRef(0)
  const activeProblemRef = useRef(activeProblem)
  activeProblemRef.current = activeProblem
  const restoredProblemKey = useRef(activeProblem
    ? `${activeProblem.platform}:${activeProblem.platformId}`
    : null)
  const restoredRequestRef = useRef<{ key: string; promise: Promise<Problem> } | null>(null)
  const statementRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    const statement = statementRef.current
    if (!statement || !activeProblem || showPicker) return
    renderMathInElement(statement, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ],
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
      throwOnError: false,
    })
  }, [activeProblem, activeProblem?.platform, activeProblem?.platformId, safeContent, showPicker])

  const loadProblems = useCallback((
    nextPlatform: PickerPlatform,
    nextPage: number,
    nextDifficulty: string,
    nextTopicSlugs: string[],
    nextAcWingTag: string,
  ): Promise<void> => {
    const key = JSON.stringify([nextPlatform, nextPage, nextDifficulty, nextTopicSlugs, nextAcWingTag])
    const inFlight = problemListRequestRef.current
    if (inFlight?.key === key) return inFlight.promise

    const seq = ++requestSeq.current
    setLoadingList(true)
    setError('')
    const request = Promise.resolve().then(async () => {
      const result = nextPlatform === 'ACWING'
        ? await acwingService.listProblems({
            page: nextPage,
            tag: nextAcWingTag || undefined,
          })
        : nextPlatform === 'HDU'
          ? await hduService.listProblems({ volume: nextPage })
          : await leetcodeService.listProblems({
              page: nextPage,
              difficulty: nextDifficulty || undefined,
              topicSlugs: nextTopicSlugs.length ? nextTopicSlugs : undefined,
            })
      if (seq !== requestSeq.current) return
      setProblems(result.problems)
      setTotal(result.total)
      setPageSize(result.pageSize)
    }).catch(cause => {
      if (seq === requestSeq.current) setError(getErrorMessage(cause))
    }).finally(() => {
      if (seq === requestSeq.current) setLoadingList(false)
      if (problemListRequestRef.current?.promise === request) problemListRequestRef.current = null
    })
    problemListRequestRef.current = { key, promise: request }
    return request
  }, [])

  const refreshRestoredProblem = useCallback((problem: Problem, seq: number, isCurrent: () => boolean) => {
    const key = `${problem.platform}:${problem.platformId}`
    setRestoredStatementStatus('refreshing')
    const promise = restoredRequestRef.current?.key === key
      ? restoredRequestRef.current.promise
      : (problem.platform === 'LEETCODE'
          ? leetcodeService.getProblem(problem.platformId)
          : problem.platform === 'ACWING'
            ? acwingService.getProblem(problem.platformId)
            : hduService.getProblem(problem.platformId))
    restoredRequestRef.current = { key, promise }
    void promise.then(detail => {
      const current = useAppStore.getState().activeProblem
      if (!isCurrent() || seq !== detailSeq.current || !current
        || current.platform !== problem.platform
        || current.platformId !== problem.platformId) return
      restoredProblemKey.current = null
      refreshActiveProblem(detail)
      setRestoredStatementStatus('idle')
      if (restoredRequestRef.current?.promise === promise) restoredRequestRef.current = null
    }).catch(() => {
      if (!isCurrent() || seq !== detailSeq.current) return
      setRestoredStatementStatus('offline')
      if (restoredRequestRef.current?.promise === promise) restoredRequestRef.current = null
    })
  }, [refreshActiveProblem])

  useEffect(() => {
    // The detail view already has the selected problem. Avoid an unrelated
    // list request (and its auth error) until the user explicitly opens the
    // picker.
    if (!showPicker) return
    const acWingTag = platform === 'ACWING' ? selectedAcWingTopic?.tag ?? '' : ''
    void loadProblems(platform, page, difficulty, topicSlugs, acWingTag)
  }, [showPicker, loadProblems, platform, page, difficulty, topicSlugs, selectedAcWingTopic])

  useEffect(() => {
    return () => {
      // A pending detail response must not select a problem after this panel
      // leaves the workspace. The list request has its own de-duplication and
      // is intentionally allowed to settle across StrictMode effect replay.
      detailSeq.current += 1
    }
  }, [])

  useEffect(() => {
    const problem = activeProblemRef.current
    if (!problem || showPicker || !restoredProblemKey.current) return
    const key = `${problem.platform}:${problem.platformId}`
    if (key !== restoredProblemKey.current) {
      restoredProblemKey.current = null
      return
    }
    const seq = ++detailSeq.current
    let cancelled = false
    refreshRestoredProblem(problem, seq, () => !cancelled)
    return () => {
      cancelled = true
    }
  }, [activeProblem?.platform, activeProblem?.platformId, showPicker, refreshRestoredProblem])

  const visibleProblems = problems.filter(problem =>
    `${problem.title} ${problem.platformId}`.toLowerCase().includes(search.trim().toLowerCase()))

  const choosePlatform = (next: PickerPlatform) => {
    if (next === platform) return
    requestSeq.current += 1
    detailSeq.current += 1
    setLoadingSlug(null)
    setProblems([])
    setTotal(0)
    setPlatform(next)
    setTopic('')
    setPage(1)
    setSearch('')
    setError('')
    if (next !== 'LEETCODE') {
      setDifficulty('')
    }
  }

  const openProblem = async (problem: Problem) => {
    const seq = ++detailSeq.current
    setLoadingSlug(problem.platformId)
    setError('')
    try {
      const detail = problem.platform === 'LEETCODE'
        ? await leetcodeService.getProblem(problem.platformId)
        : problem.platform === 'ACWING'
          ? await acwingService.getProblem(problem.platformId)
          : await hduService.getProblem(problem.platformId)
      if (seq !== detailSeq.current) return
      restoredProblemKey.current = null
      setRestoredStatementStatus('idle')
      setActiveProblem(detail)
      setShowPicker(false)
    } catch (cause) {
      if (seq === detailSeq.current) setError(getErrorMessage(cause))
    } finally {
      if (seq === detailSeq.current) setLoadingSlug(null)
    }
  }

  if (!activeProblem || showPicker) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-5 py-4 border-b border-border dark:border-border-dark">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">选择一道题目</h2>
            </div>
            {activeProblem && <button onClick={() => { detailSeq.current += 1; setLoadingSlug(null); setError(''); setShowPicker(false) }} className="text-xs text-accent hover:underline">返回当前题</button>}
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <select aria-label="选择题库平台" value={platform}
                onChange={event => choosePlatform(event.target.value as PickerPlatform)}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface-soft px-2 py-1.5 text-xs outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft">
                <option value="LEETCODE">LeetCode</option>
                <option value="ACWING">AcWing</option>
                <option value="HDU">杭电 HDU</option>
              </select>
              {platform === 'LEETCODE' && (
                <select aria-label="按难度筛选" value={difficulty} onChange={event => { setPage(1); setDifficulty(event.target.value) }}
                  className="rounded-md border border-border bg-surface-soft px-2 py-1.5 text-xs outline-none dark:border-border-dark dark:bg-surface-dark-soft">
                  <option value="">全部难度</option><option value="EASY">简单</option><option value="MEDIUM">中等</option><option value="HARD">困难</option>
                </select>
              )}
            </div>
            {platform === 'LEETCODE' && (
              <select aria-label="按专项训练筛选" value={topic}
                onChange={event => { setPage(1); setTopic(event.target.value) }}
                className="w-full rounded-md border border-border bg-surface-soft px-2 py-1.5 text-xs outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft">
                <option value="">全部题库</option>
                {TRAINING_TOPICS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            )}
            {platform === 'ACWING' && (
              <select aria-label="按专项训练筛选" value={topic}
                onChange={event => { setPage(1); setTopic(event.target.value) }}
                className="w-full rounded-md border border-border bg-surface-soft px-2 py-1.5 text-xs outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft">
                <option value="">全部题库</option>
                {ACWING_TOPICS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            )}
            <input value={search} onChange={event => setSearch(event.target.value)}
              aria-label="搜索当前页题目" placeholder="搜索当前页题名或题号"
              className="w-full rounded-md border border-border bg-surface-soft px-2 py-1.5 text-xs outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft" />
          </div>
        </div>
        {error && visibleProblems.length > 0 && <div role="alert" className="mx-4 mt-3 rounded-md bg-red-50 p-3 text-xs text-danger dark:bg-red-900/10">{error}</div>}
        {loadingList ? (
          <div role="status" aria-live="polite" aria-busy="true" className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
            <Loader2 size={16} className="animate-spin" /> 正在取回题目列表…
          </div>
        ) : visibleProblems.length ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <div className="mb-2 px-1 text-[11px] text-text-muted dark:text-text-dark-muted">
              {PLATFORM_LABELS[platform]} · {topicLabel(platform, topic)}
              {difficulty ? ` · ${difficulty === 'EASY' ? '简单' : difficulty === 'MEDIUM' ? '中等' : '困难'}` : ''} · 共 {total} 题
            </div>
            <div className="space-y-1">
              {visibleProblems.map(problem => (
                <button key={problem.platformId} onClick={() => void openProblem(problem)}
                  disabled={loadingSlug !== null}
                  aria-busy={loadingSlug === problem.platformId}
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
              <span className="text-text-muted dark:text-text-dark-muted">{page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
              <button onClick={() => setPage(value => value + 1)} disabled={page >= Math.ceil(total / pageSize)}
                className="text-text-secondary hover:text-accent disabled:opacity-40 dark:text-text-dark-secondary">下一页</button>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-text-muted dark:text-text-dark-muted">
            <AlertCircle size={24} className="text-danger" />
            <p role="alert" className="text-danger">{error}</p>
            <button type="button" aria-label="重新加载题目列表"
              onClick={() => void loadProblems(platform, page, difficulty, platform === 'ACWING' ? [] : topicSlugs, platform === 'ACWING' ? selectedAcWingTopic?.tag ?? '' : '')}
              className="inline-flex items-center gap-2 text-accent hover:underline">
              <RefreshCw size={14} /> 重新加载
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-text-muted dark:text-text-dark-muted">
            <AlertCircle size={24} />
            <p>{search.trim()
              ? '当前页没有匹配的题目。可以换个关键词，或切换到其他页面继续搜索。'
              : platform === 'LEETCODE'
                ? '暂时没有题目可显示。请检查 LeetCode Cookie 和网关连接。'
                : '暂时没有题目可显示。请检查平台 Cookie（设置页）和网关连接。'}</p>
            <button type="button" aria-label="重新加载题目列表" onClick={() => void loadProblems(platform, page, difficulty, platform === 'ACWING' ? [] : topicSlugs, platform === 'ACWING' ? selectedAcWingTopic?.tag ?? '' : '')} className="inline-flex items-center gap-2 text-accent hover:underline">
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
        {restoredStatementStatus !== 'idle' && (
          <div className="mb-2 flex items-center gap-2 text-[11px] text-text-muted dark:text-text-dark-muted">
            <p role="status">
              {restoredStatementStatus === 'refreshing'
                ? '正在确认题面是否有更新…'
                : '暂时无法更新题面，继续显示已缓存内容。'}
            </p>
            {restoredStatementStatus === 'offline' && (
              <button type="button" aria-label="重试更新题面"
                onClick={() => {
                  const problem = activeProblemRef.current
                  if (!problem) return
                  restoredProblemKey.current = `${problem.platform}:${problem.platformId}`
                  const seq = ++detailSeq.current
                  refreshRestoredProblem(problem, seq, () => true)
                }}
                className="shrink-0 text-accent hover:underline">
                重试
              </button>
            )}
          </div>
        )}
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
        ref={statementRef}
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
            <Play size={14} /> 开始做题
          </button>
        </div>
      )}
    </div>
  )
}

function topicLabel(platform: PickerPlatform, topicId: string): string {
  if (!topicId) return '全部题库'
  return platform === 'LEETCODE'
    ? `${findTrainingTopic(topicId)?.name ?? topicId}专项`
    : platform === 'ACWING'
      ? `${findAcWingTopic(topicId)?.name ?? topicId}专项`
      : topicId
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  if (error instanceof Error) return error.message
  return '请求失败，请检查网关和平台 Cookie 后重试'
}
