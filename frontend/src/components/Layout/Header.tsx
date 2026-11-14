import React, { useState } from 'react'
import { Play, Send, Lock, Sun, Moon, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { Badge } from '@/components/Common/Badge'
import { leetcodeService } from '@/services/leetcodeService'
import { agentService } from '@/services/agentService'
import { nanoid } from 'nanoid'

const MODE_LABEL: Record<string, string> = {
  IDLE: '空闲', PREP: '预习', FOCUS: '专注解题', REVIEW: '复盘',
}

export default function Header() {
  const {
    activeProblem, mode, lang, setLang, goal, theme, toggleTheme,
    code, testInput, enterFocus, exitFocus,
    getFocusDurationSec, setRunResult, setRunError, setRunLoading, provider,
    setLastSubmission, addMessage,
  } = useAppStore()
  const [runBusy, setRunBusy] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const onRun = async () => {
    if (!activeProblem || runBusy || submitBusy) return
    setRunBusy(true)
    setActionError('')
    setRunError(null)
    setRunResult(null)
    setRunLoading(true)
    try {
      const result = await leetcodeService.runTests(activeProblem.platformId, code, lang, testInput)
      setRunResult(result)
    } catch (error) {
      const message = getErrorMessage(error)
      setRunError(message)
      setActionError(message)
    } finally {
      setRunLoading(false)
      setRunBusy(false)
    }
  }

  const onSubmit = async () => {
    if (!activeProblem || submitBusy || runBusy) return
    setSubmitBusy(true)
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
      addMessage({ id: nanoid(), role: 'user', content: reviewText, timestamp: reviewTimestamp, mode: 'REVIEW' })
      addMessage({
        id: nanoid(), role: 'system', content: '判题结果已同步，教练正在开始赛后复盘。',
        timestamp: reviewTimestamp, mode: 'REVIEW',
      })
      void agentService.chat(reviewText, {
        mode: 'REVIEW',
        problemId: activeProblem.platformId,
        goal,
        trainingPhase: 'review',
        provider,
      }).then(reply => {
        addMessage({
          id: nanoid(), role: 'agent', content: reply.content,
          timestamp: new Date().toISOString(), mode: 'REVIEW', animationId: reply.animationId,
        })
      }).catch(() => {
        addMessage({
          id: nanoid(), role: 'system', content: '教练暂时无法连接。你仍可在输入框中继续复盘，或稍后重试。',
          timestamp: new Date().toISOString(), mode: 'REVIEW',
        })
      })
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setSubmitBusy(false)
    }
  }

  const isBusy = runBusy || submitBusy

  return (
    <header className="flex items-center gap-3 px-4 h-[48px] border-b border-border
                       dark:border-border-dark bg-surface dark:bg-surface-dark flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <h1 className="text-sm font-medium truncate text-text-primary dark:text-text-dark-primary">
          {activeProblem ? activeProblem.title : 'AlgoCoach — 选择一道题目开始'}
        </h1>
        {activeProblem && <Badge difficulty={activeProblem.difficulty} />}
      </div>

      <select
        aria-label="编程语言"
        value={lang}
        onChange={event => setLang(event.target.value as 'rust' | 'cpp' | 'python3')}
        disabled={mode === 'FOCUS'}
        className="text-xs bg-surface-soft dark:bg-surface-dark-soft border border-border
                   dark:border-border-dark rounded-md px-2 py-1 text-text-secondary
                   dark:text-text-dark-secondary outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="rust">Rust</option>
        <option value="cpp">C++</option>
        <option value="python3">Python3</option>
      </select>

      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-muted
                      dark:bg-surface-dark-muted text-xs">
        {mode === 'FOCUS' && <Lock size={12} className="text-focus" />}
        <span className={mode === 'FOCUS' ? 'text-focus font-medium' : mode === 'REVIEW' ? 'text-success font-medium' : 'text-text-secondary dark:text-text-dark-secondary'}>
          {MODE_LABEL[mode]}
        </span>
      </div>

      {mode === 'REVIEW' && (
        <button onClick={enterFocus}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-border
                     dark:border-border-dark text-text-secondary hover:bg-surface-muted
                     dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">
          继续做题
        </button>
      )}

      <button onClick={onRun} disabled={!activeProblem || mode !== 'FOCUS' || isBusy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                   border border-border dark:border-border-dark text-text-secondary
                   dark:text-text-dark-secondary hover:bg-surface-muted
                   dark:hover:bg-surface-dark-muted disabled:opacity-40 transition-colors">
        {runBusy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        {runBusy ? '运行中' : '运行'}
      </button>
      <button onClick={onSubmit} disabled={!activeProblem || mode !== 'FOCUS' || isBusy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                   bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors">
        {submitBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {submitBusy ? '提交中' : '提交'}
      </button>

      <button onClick={toggleTheme} className="sidebar-btn !w-8 !h-8" title="切换主题">
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      {actionError && <span role="alert" title={actionError}
        className="max-w-40 truncate text-[11px] text-danger">{actionError}</span>}
    </header>
  )
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  if (error instanceof Error) return error.message
  return '请求失败，请检查网关和 LeetCode Cookie 后重试'
}
