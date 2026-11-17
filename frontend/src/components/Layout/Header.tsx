import React, { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Play, Send, Lock, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { Badge } from '@/components/Common/Badge'
import { leetcodeService } from '@/services/leetcodeService'
import { agentService, canCommitChatReply, getAgentErrorAction, getAgentErrorMessage } from '@/services/agentService'
import { LANGUAGE_OPTIONS } from '@/services/languages'
import type { CodeLanguage } from '@/types'
import { nanoid } from 'nanoid'

const MODE_LABEL: Record<string, string> = {
  IDLE: '空闲', PREP: '预习', FOCUS: '专注解题', REVIEW: '复盘',
}

export default function Header() {
  const {
    activeProblem, mode, lang, setLang, goal, focusStartTs,
    problemTimeLimits,
    code, testInput, enterFocus, exitFocus,
    getFocusDurationSec, setRunResult, setRunError, setRunLoading, runLoading, provider,
    setLastSubmission, addMessage, submitLoading, setSubmitLoading, submitError, setSubmitError,
  } = useAppStore(useShallow(state => ({
    activeProblem: state.activeProblem,
    mode: state.mode,
    lang: state.lang,
    setLang: state.setLang,
    goal: state.goal,
    focusStartTs: state.focusStartTs,
    problemTimeLimits: state.problemTimeLimits,
    code: state.code,
    testInput: state.testInput,
    enterFocus: state.enterFocus,
    exitFocus: state.exitFocus,
    getFocusDurationSec: state.getFocusDurationSec,
    setRunResult: state.setRunResult,
    setRunError: state.setRunError,
    setRunLoading: state.setRunLoading,
    runLoading: state.runLoading,
    provider: state.provider,
    setLastSubmission: state.setLastSubmission,
    addMessage: state.addMessage,
    submitLoading: state.submitLoading,
    setSubmitLoading: state.setSubmitLoading,
    submitError: state.submitError,
    setSubmitError: state.setSubmitError,
  })))
  const [actionError, setActionError] = useState('')
  const [focusNow, setFocusNow] = useState(() => Date.now())
  const reviewRequestRef = useRef<AbortController | null>(null)
  const reviewProblemKeyRef = useRef(activeProblem ? `${activeProblem.platform}:${activeProblem.platformId}` : null)

  useEffect(() => {
    if (mode !== 'FOCUS' || focusStartTs === null) return
    setFocusNow(Date.now())
    const timer = window.setInterval(() => setFocusNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [mode, focusStartTs])

  useEffect(() => {
    const problemKey = activeProblem ? `${activeProblem.platform}:${activeProblem.platformId}` : null
    if (mode === 'FOCUS') {
      reviewRequestRef.current?.abort()
      reviewRequestRef.current = null
    }
    if (reviewProblemKeyRef.current !== problemKey) {
      reviewRequestRef.current?.abort()
      reviewRequestRef.current = null
      reviewProblemKeyRef.current = problemKey
      // Run/submit errors belong to the old problem. Keeping them visible
      // after a switch makes the next training attempt look broken.
      setActionError('')
      setSubmitError(null)
    }
  }, [mode, activeProblem, activeProblem?.platform, activeProblem?.platformId, setSubmitError])

  useEffect(() => () => {
    reviewRequestRef.current?.abort()
    reviewRequestRef.current = null
  }, [])

  // Only LeetCode exposes run/submit through the gateway.
  const judgeRunnable = activeProblem?.platform === 'LEETCODE'

  const onRun = async () => {
    if (!activeProblem || !judgeRunnable || useAppStore.getState().runLoading || useAppStore.getState().submitLoading) return
    setActionError('')
    setRunError(null)
    setRunResult(null)
    setRunLoading(true)
    const isCurrentRun = () => {
      const current = useAppStore.getState()
      return current.activeProblem?.platform === activeProblem.platform
        && current.activeProblem?.platformId === activeProblem.platformId
        && current.code === code && current.lang === lang && current.testInput === testInput
    }
    try {
      const result = await leetcodeService.runTests(activeProblem.platformId, code, lang, testInput)
      if (isCurrentRun()) setRunResult(result)
      else setActionError('代码或测试输入已更改，请重新运行')
    } catch (error) {
      if (isCurrentRun()) {
        const message = getErrorMessage(error)
        setRunError(message)
        setActionError(message)
      }
    } finally {
      setRunLoading(false)
    }
  }

  const onSubmit = async () => {
    if (!activeProblem || !judgeRunnable || useAppStore.getState().submitLoading || useAppStore.getState().runLoading) return
    setSubmitLoading(true)
    setSubmitError(null)
    setActionError('')
    try {
      const durationSec = getFocusDurationSec()
      const result = await leetcodeService.submit(activeProblem.platformId, code, lang, durationSec)
      setLastSubmission({
        ...result,
        problemId: activeProblem.id,
        code,
        lang,
        runtimeMs: result.runtimeMs ?? undefined,
        memoryMb: result.memoryMb ?? undefined,
        errorMessage: result.errorMessage ?? undefined,
        passedTests: result.passedTests ?? 0,
        totalTests: result.totalTests ?? 0,
        submittedAt: new Date().toISOString(),
      })
      exitFocus()
      if (!useAppStore.getState().coachPrefs.autoReview) {
        addMessage({
          id: nanoid(), role: 'system', content: '提交已记录。可在输入框继续发起复盘。',
          timestamp: new Date().toISOString(), mode: 'REVIEW',
        })
        return
      }
      const topicSummary = activeProblem.topics.length ? activeProblem.topics.join('、') : '暂无标签数据'
      const passedSummary = result.passedTests == null || result.totalTests == null
        ? '判题未返回通过用例数量'
        : `通过 ${result.passedTests}/${result.totalTests} 个测试点`
      const reviewText = [
        `我刚完成「${activeProblem.titleCn ?? activeProblem.title}」的提交。`,
        `判题结果：${result.status}；${passedSummary}。`,
        `FOCUS 用时：${formatDuration(result.durationSec)}。知识点：${topicSummary}。`,
        result.errorMessage ? `判题信息：${result.errorMessage}` : '',
        '请按 OI/xCPC 的赛后复盘流程，先根据题目、判题事实与我的训练记录复盘建模、正确性、复杂度和下一步。你看不到我的提交代码；若要定位实现层面的具体错误，请先让我贴出相关代码片段并说明自己的判断，不要假装检查过代码。',
      ].filter(Boolean).join('\n')
      const reviewTimestamp = new Date().toISOString()
      const reviewMessageId = nanoid()
      addMessage({
        id: reviewMessageId, role: 'user', content: reviewText, timestamp: reviewTimestamp,
        mode: 'REVIEW', trainingPhase: 'review',
      })
      addMessage({
        id: nanoid(), role: 'system', content: '判题结果已同步，教练正在开始赛后复盘。',
        timestamp: reviewTimestamp, mode: 'REVIEW',
      })
      const reviewController = new AbortController()
      reviewRequestRef.current = reviewController
      void agentService.chatStream(reviewText, {
        mode: 'REVIEW',
        problemId: activeProblem.platformId,
        platform: activeProblem.platform,
        goal,
        trainingPhase: 'review',
        provider,
      }, {}, reviewController.signal).then(reply => {
        const current = useAppStore.getState()
        if (!canCommitChatReply('REVIEW', current.mode, reviewController.signal.aborted)
          || current.activeProblem?.platform !== activeProblem.platform
          || current.activeProblem?.platformId !== activeProblem.platformId) return
        addMessage({
          id: nanoid(), role: 'agent', content: reply.content,
          timestamp: new Date().toISOString(), mode: 'REVIEW', animationId: reply.animationId,
        })
      }).catch(error => {
        const current = useAppStore.getState()
        if (reviewController.signal.aborted || current.mode === 'FOCUS'
          || current.activeProblem?.platform !== activeProblem.platform
          || current.activeProblem?.platformId !== activeProblem.platformId) return
        const action = getAgentErrorAction(error)
        addMessage({
          id: nanoid(), role: 'system',
          content: `${getAgentErrorMessage(error)} 你仍可在输入框中继续复盘，或稍后重试。`,
          timestamp: new Date().toISOString(), mode: 'REVIEW', retryMessageId: reviewMessageId,
          ...(action ? { action } : {}),
        })
      }).finally(() => {
        if (reviewRequestRef.current === reviewController) reviewRequestRef.current = null
      })
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitLoading(false)
    }
  }

  const isBusy = runLoading || submitLoading
  const focusDurationSec = mode === 'FOCUS' ? getFocusDurationSec(focusNow) : 0
  const problemTimeLimitSec = activeProblem
    ? problemTimeLimits[`${activeProblem.platform}:${activeProblem.platformId}`]
    : undefined
  const remainingTimeSec = problemTimeLimitSec === undefined
    ? undefined
    : Math.max(0, problemTimeLimitSec - focusDurationSec)
  const judgeCapabilityNote = activeProblem && mode === 'FOCUS' && !judgeRunnable
    ? `${activeProblem.platform === 'ACWING' ? 'AcWing' : 'HDU'} 暂不支持站内运行和提交，请回对应平台完成判题。`
    : ''

  return (
    <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 min-h-[48px] border-b border-border
                       dark:border-border-dark bg-surface dark:bg-surface-dark flex-shrink-0
                       xl:h-[48px] xl:flex-nowrap xl:gap-3 xl:px-4 xl:py-0">
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 xl:basis-auto xl:min-w-[120px]">
        <h1 className="truncate font-editorial text-[15px] font-medium tracking-wide text-text-primary dark:text-text-dark-primary">
          {activeProblem ? activeProblem.title : '工作区'}
        </h1>
        {activeProblem && <Badge difficulty={activeProblem.difficulty} />}
      </div>

      <select
        aria-label="编程语言"
        value={lang}
        onChange={event => setLang(event.target.value as CodeLanguage)}
        disabled={mode === 'FOCUS'}
        className="shrink-0 text-xs bg-surface-soft dark:bg-surface-dark-soft border border-border
                   dark:border-border-dark rounded-md px-2 py-1 text-text-secondary
                   dark:text-text-dark-secondary outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {LANGUAGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>

      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-md bg-surface-muted
                      dark:bg-surface-dark-muted text-xs">
        {mode === 'FOCUS' && <Lock size={12} className="text-focus" />}
        <span className={mode === 'FOCUS' ? 'text-focus font-medium' : mode === 'REVIEW' ? 'text-success font-medium' : 'text-text-secondary dark:text-text-dark-secondary'}>
          {MODE_LABEL[mode]}
        </span>
      </div>

      {mode === 'FOCUS' && (
        <span role="timer" aria-label={remainingTimeSec === undefined
          ? `专注用时 ${formatDuration(focusDurationSec)}`
          : `专注用时 ${formatDuration(focusDurationSec)}，剩余 ${formatDuration(remainingTimeSec)}`}
          className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-text-secondary dark:text-text-dark-secondary">
          {formatDuration(focusDurationSec)}
          {remainingTimeSec !== undefined && <span className="ml-1.5 text-accent">· 剩余 {formatDuration(remainingTimeSec)}</span>}
        </span>
      )}

      {mode === 'REVIEW' && (
        <button onClick={enterFocus}
          className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium border border-border
                     dark:border-border-dark text-text-secondary hover:bg-surface-muted
                     dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">
          继续做题
        </button>
      )}

      {mode === 'FOCUS' && (
        <button onClick={() => { setLastSubmission(null); exitFocus() }} disabled={isBusy}
          className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium border border-border
                     dark:border-border-dark text-text-secondary hover:bg-surface-muted
                     dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted disabled:opacity-40">
          结束专注
        </button>
      )}

      {activeProblem && mode === 'FOCUS' && <>
        <button onClick={onRun} disabled={!judgeRunnable || isBusy}
          aria-label="运行"
          aria-busy={runLoading}
          aria-describedby={judgeCapabilityNote ? 'judge-capability-note' : undefined}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium
                     border border-border dark:border-border-dark text-text-secondary
                     dark:text-text-dark-secondary hover:bg-surface-muted
                     dark:hover:bg-surface-dark-muted disabled:opacity-40 transition-colors">
          {runLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {runLoading ? '运行中' : '运行'}
        </button>
        <button onClick={onSubmit} disabled={!judgeRunnable || isBusy}
          aria-label="提交"
          aria-busy={submitLoading}
          aria-describedby={judgeCapabilityNote ? 'judge-capability-note' : undefined}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium
                     bg-accent hover:bg-accent-hover text-white
                     disabled:bg-surface-muted disabled:text-text-muted
                     dark:disabled:bg-surface-dark-muted dark:disabled:text-text-dark-muted
                     disabled:cursor-not-allowed disabled:opacity-100 transition-colors">
          {submitLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {submitLoading ? '提交中' : '提交'}
        </button>
      </>}

      {judgeCapabilityNote && <span id="judge-capability-note" role="status"
        className="basis-full truncate text-[11px] text-warning dark:text-amber-300 xl:basis-auto xl:max-w-[280px]"
        title={judgeCapabilityNote}>
        {judgeCapabilityNote}
      </span>}

      {(submitError || actionError) && <span role="alert" title={submitError || actionError}
        className="max-w-40 truncate text-[11px] text-danger">{submitError || actionError}</span>}
    </header>
  )
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainder = safeSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  if (error instanceof Error) return error.message
  return '请求失败，请检查网关和 LeetCode Cookie 后重试'
}
