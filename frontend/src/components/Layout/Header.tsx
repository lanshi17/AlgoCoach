import React, { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Play, Send, Lock, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { Badge } from '@/components/Common/Badge'
import { leetcodeService } from '@/services/leetcodeService'
import { agentService, canCommitChatReply, getAgentErrorAction, getAgentErrorMessage } from '@/services/agentService'
import { LANGUAGE_OPTIONS } from '@/services/languages'
import { isLocalPracticeProblem } from '@/services/localPractice'
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
  const judgeRunnable = activeProblem?.platform === 'LEETCODE' && !isLocalPracticeProblem(activeProblem)
  const localRunnable = isLocalPracticeProblem(activeProblem) && lang === 'python3' && ['local-two-sum', 'local-binary-search'].includes(activeProblem?.platformId ?? '')
  const canRun = judgeRunnable || localRunnable

  const onRun = async () => {
    if (!activeProblem || !canRun || useAppStore.getState().runLoading || useAppStore.getState().submitLoading) return
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
      const result = localRunnable
        ? await (await import('@/services/localPythonRunner')).runLocalPython(activeProblem.platformId, code, testInput)
        : await leetcodeService.runTests(activeProblem.platformId, code, lang, testInput)
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
        '请按 OI/xCPC 的赛后复盘流程，结合题目、判题事实、训练记录和本轮附带的提交代码，分析建模、正确性、边界条件、复杂度及下一步。指出代码中能从实现直接验证的问题，并解释原因；区分确定的 bug 与需要更多测试确认的风险。',
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
      const replyId = nanoid()
      let streamed = ''
      const stillCurrent = () => {
        const current = useAppStore.getState()
        return canCommitChatReply('REVIEW', current.mode, reviewController.signal.aborted)
          && current.activeProblem?.platform === activeProblem.platform
          && current.activeProblem?.platformId === activeProblem.platformId
      }
      void agentService.chatStream(reviewText, {
        mode: 'REVIEW',
        problemId: activeProblem.platformId,
        platform: activeProblem.platform,
        code,
        codeLanguage: lang,
        goal,
        trainingPhase: 'review',
        provider,
      }, { onText: delta => {
        if (!stillCurrent()) return
        streamed += delta
        if (!useAppStore.getState().messages.some(message => message.id === replyId)) {
          addMessage({ id: replyId, role: 'agent', content: streamed, timestamp: new Date().toISOString(), mode: 'REVIEW' })
        } else useAppStore.getState().updateMessage(replyId, { content: streamed })
      } }, reviewController.signal).then(reply => {
        if (!stillCurrent()) return
        if (streamed) useAppStore.getState().updateMessage(replyId, { content: reply.content, animationId: reply.animationId })
        else addMessage({ id: replyId, role: 'agent', content: reply.content,
          timestamp: new Date().toISOString(), mode: 'REVIEW', animationId: reply.animationId })
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
    ? isLocalPracticeProblem(activeProblem)
      ? localRunnable ? 'Python 可本地运行样例；暂不支持提交判题。' : '本地题目前仅支持 Python 运行样例，暂不支持提交判题。'
      : `${activeProblem.platform === 'ACWING' ? 'AcWing' : 'HDU'} 暂不支持站内运行和提交，请回对应平台完成判题。`
    : ''

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border bg-surface px-4 py-2.5 xl:h-[60px] xl:flex-nowrap xl:px-5 xl:py-0">
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2.5 xl:basis-auto xl:min-w-[160px]">
        <h1 className="truncate text-[15px] font-semibold tracking-title text-text-primary">
          {activeProblem ? (activeProblem.titleCn ?? activeProblem.title) : '选择一页练习'}
        </h1>
        {activeProblem && <Badge difficulty={activeProblem.difficulty} />}
      </div>

      <div className="flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface-soft px-2 text-meta tracking-cn">
        <span className={`h-1.5 w-1.5 rounded-full ${mode === 'FOCUS' ? 'bg-focus' : mode === 'REVIEW' ? 'bg-success' : 'bg-text-muted'}`} />
        <span className={mode === 'FOCUS' ? 'font-medium text-focus' : mode === 'REVIEW' ? 'font-medium text-success' : 'text-text-secondary'}>
          {MODE_LABEL[mode]}
        </span>
        {mode === 'FOCUS' && <Lock size={11} className="text-focus" aria-hidden="true" />}
      </div>

      {mode === 'FOCUS' && (
        <span role="timer" aria-label={remainingTimeSec === undefined
          ? `专注用时 ${formatDuration(focusDurationSec)}`
          : `专注用时 ${formatDuration(focusDurationSec)}，剩余 ${formatDuration(remainingTimeSec)}`}
          className="shrink-0 whitespace-nowrap rounded-md border border-border px-2 py-1 font-mono text-[11px] tabular-nums text-text-secondary">
          {formatDuration(focusDurationSec)}
          {remainingTimeSec !== undefined && <span className="ml-1.5 text-accent">· 剩余 {formatDuration(remainingTimeSec)}</span>}
        </span>
      )}

      <select
        aria-label="编程语言"
        value={lang}
        onChange={event => setLang(event.target.value as CodeLanguage)}
        disabled={mode === 'FOCUS'}
        className="h-8 shrink-0 rounded-md border border-line-300 bg-surface px-2 text-meta tracking-cn text-text-secondary
                   outline-none transition-colors hover:border-ink-450 focus:border-accent
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        {LANGUAGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>

      <div className="ml-auto flex items-center gap-1.5">
        {mode === 'REVIEW' && (
          <button onClick={enterFocus}
            className="h-8 shrink-0 whitespace-nowrap rounded-md border border-line-300 px-3 text-meta font-medium tracking-cn
                       text-text-secondary transition-colors hover:border-ink-450 hover:text-text-primary">
            继续做题
          </button>
        )}

        {mode === 'FOCUS' && (
          <button onClick={() => { setLastSubmission(null); exitFocus() }} disabled={isBusy}
            className="h-8 shrink-0 whitespace-nowrap rounded-md border border-line-300 px-3 text-meta font-medium tracking-cn
                       text-text-secondary transition-colors hover:border-ink-450 hover:text-text-primary disabled:opacity-40">
            结束专注
          </button>
        )}

        {activeProblem && mode === 'FOCUS' && <>
          <button onClick={onRun} disabled={!canRun || isBusy}
            aria-label="运行"
            aria-busy={runLoading}
            aria-describedby={judgeCapabilityNote ? 'judge-capability-note' : undefined}
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line-300 px-3 text-meta font-medium tracking-cn
                       text-text-secondary transition-colors hover:border-ink-450 hover:text-text-primary disabled:opacity-40">
            {runLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {runLoading ? '运行中' : '运行'}
          </button>
          <button onClick={onSubmit} disabled={!judgeRunnable || isBusy}
            aria-label="提交"
            aria-busy={submitLoading}
            aria-describedby={judgeCapabilityNote ? 'judge-capability-note' : undefined}
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-ink-950 px-3.5 text-meta font-medium tracking-cn text-canvas transition-colors hover:bg-accent
                       disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted">
            {submitLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {submitLoading ? '提交中' : '提交'}
          </button>
        </>}
      </div>

      {judgeCapabilityNote && <span id="judge-capability-note" role="status"
        className="basis-full truncate text-[11px] text-warning xl:basis-auto xl:max-w-[280px]"
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
