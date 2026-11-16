import React, { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, Lock, Send, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import ChatMessage from './ChatMessage'
import AnimationCard from '../Animation/AnimationCard'
import type { ChatMessage as Msg, TrainingPhase } from '@/types'
import { agentService, canCommitChatReply, getAgentErrorAction, getAgentErrorMessage } from '@/services/agentService'
import { usePollAnimation } from '@/hooks/usePollAnimation'
import { nanoid } from 'nanoid'

const TRAINING_PHASES: ReadonlyArray<{ value: TrainingPhase; label: string }> = [
  { value: 'auto', label: '自动判断' },
  { value: 'virtual_contest', label: '模拟赛' },
  { value: 'topic_drill', label: '专题训练' },
  { value: 'attempt', label: '独立作答' },
  { value: 'hint', label: '逐级提示' },
  { value: 'review', label: '赛后复盘' },
  { value: 'upsolve', label: '赛后补题' },
]

/** Convert the problem's total time budget to the remaining seconds at chat time. */
export function toRemainingSeconds(raw: string, elapsedFocusSec = 0): number | undefined {
  if (raw === '') return undefined
  const minutes = Number(raw)
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > Math.floor(Number.MAX_SAFE_INTEGER / 60)) {
    return undefined
  }
  return Math.max(0, minutes * 60 - Math.max(0, Math.floor(elapsedFocusSec)))
}

/**
 * Right panel — Agent conversation area.
 *
 * FOCUS mode: entire panel is locked with an overlay.
 * Any other mode: fully interactive.
 */
export default function ChatPanel() {
  const {
    mode, messages, addMessage, activeProblem, goal, provider, getFocusDurationSec,
    problemTimeLimits, setProblemTimeLimitMinutes, chatDrafts, setChatDraft,
    chatPhases, setChatPhase,
  } = useAppStore(useShallow(state => ({
    mode: state.mode,
    messages: state.messages,
    addMessage: state.addMessage,
    activeProblem: state.activeProblem,
    goal: state.goal,
    provider: state.provider,
    getFocusDurationSec: state.getFocusDurationSec,
    problemTimeLimits: state.problemTimeLimits,
    setProblemTimeLimitMinutes: state.setProblemTimeLimitMinutes,
    chatDrafts: state.chatDrafts,
    setChatDraft: state.setChatDraft,
    chatPhases: state.chatPhases,
    setChatPhase: state.setChatPhase,
  })))
  const inputKey = activeProblem ? `${activeProblem.platform}:${activeProblem.platformId}` : '__global__'
  const input = chatDrafts[inputKey] ?? ''
  const setInput = setChatDraft
  const [loading, setLoading] = useState(false)
  const [thinkingText, setThinkingText] = useState('')
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [streamedReply, setStreamedReply] = useState('')
  const [errorAction, setErrorAction] = useState<ReturnType<typeof getAgentErrorAction>>(null)
  const [retryMessage, setRetryMessage] = useState<Msg | null>(null)
  const trainingPhase = chatPhases[inputKey] ?? 'auto'
  const timeLimitKey = activeProblem ? `${activeProblem.platform}:${activeProblem.platformId}` : '__global__'
  const timeLimitSec = problemTimeLimits[timeLimitKey]
  const timeInput = timeLimitSec === undefined ? '' : String(timeLimitSec / 60)
  const [animationId, setAnimationId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRequestRef = useRef<AbortController | null>(null)
  const contextVersionRef = useRef(0)
  const animation = usePollAnimation(animationId)

  const isFocus = mode === 'FOCUS'

  useEffect(() => {
    contextVersionRef.current += 1
    setLoading(false)
    setThinkingText('')
    setThinkingExpanded(false)
    setStreamedReply('')
    setErrorAction(null)
    return () => {
      chatRequestRef.current?.abort()
      chatRequestRef.current = null
    }
  }, [isFocus, activeProblem?.platform, activeProblem?.platformId])

  useEffect(() => {
    // Only the latest message can expose a retry action. An older failed turn
    // must not reappear as retryable after a later successful conversation.
    const retryMarker = messages[messages.length - 1]
    const retryable = retryMarker?.retryMessageId
      ? messages.find(message => message.id === retryMarker.retryMessageId)
      : undefined
    const canRetry = retryable?.role === 'user'
      && (input === retryable.content || (input === '' && retryable.mode === 'REVIEW'))
    setRetryMessage(canRetry ? retryable : null)
  }, [input, inputKey, messages])

  useEffect(() => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'
    bottomRef.current?.scrollIntoView({ behavior })
  }, [messages])

  useEffect(() => {
    const lastAnimationId = [...messages].reverse().find(message => message.animationId)?.animationId ?? null
    setAnimationId(lastAnimationId)
  }, [messages])

  const requestReply = async (userMsg: Msg, isRetry = false) => {
    if (isFocus || loading) return
    const requestMode = mode
    setErrorAction(null)
    setLoading(true)
    setThinkingText('')
    setThinkingExpanded(false)
    setStreamedReply('')
    const controller = new AbortController()
    chatRequestRef.current = controller

    try {
      const timeRemainingSec = toRemainingSeconds(timeInput, getFocusDurationSec())
      const reply = await agentService.chatStream(userMsg.content, {
        mode: requestMode,
        problemId: activeProblem?.platformId,
        platform: activeProblem?.platform,
        goal,
        provider,
        trainingPhase: userMsg.trainingPhase ?? trainingPhase,
        ...(timeRemainingSec !== undefined ? { timeRemainingSec } : {}),
      }, {
        onThinking: delta => setThinkingText(current => current + delta),
        onText: delta => setStreamedReply(current => current + delta),
      }, controller.signal)
      const current = useAppStore.getState()
      if (!canCommitChatReply(requestMode, current.mode, controller.signal.aborted)
        || current.activeProblem?.platform !== activeProblem?.platform
        || current.activeProblem?.platformId !== activeProblem?.platformId) return
      addMessage({
        id: nanoid(),
        role: 'agent',
        content: reply.content,
        timestamp: new Date().toISOString(),
        mode: requestMode,
        animationId: reply.animationId,
      })
      if (reply.animationId) {
        setAnimationId(reply.animationId)
        addMessage({
          id: nanoid(), role: 'system', content: '动画已经排队，稍后会出现在对话里。',
          timestamp: new Date().toISOString(), mode: requestMode,
        })
      }
      setStreamedReply('')
      setThinkingText('')
      setRetryMessage(null)
      if (isRetry) setInput('')
    } catch (e) {
      const current = useAppStore.getState()
      if (controller.signal.aborted || current.mode === 'FOCUS'
        || current.activeProblem?.platform !== activeProblem?.platform
        || current.activeProblem?.platformId !== activeProblem?.platformId) return
      if (!useAppStore.getState().chatDrafts[inputKey]) setInput(userMsg.content)
      setErrorAction(getAgentErrorAction(e))
      setRetryMessage(userMsg)
      setStreamedReply('')
      setThinkingText('')
      addMessage({
        id: nanoid(),
        role: 'system',
        content: getAgentErrorMessage(e),
        timestamp: new Date().toISOString(),
        retryMessageId: userMsg.id,
      })
    } finally {
      if (chatRequestRef.current === controller) {
        chatRequestRef.current = null
        setLoading(false)
      }
    }
  }

  const send = async () => {
    if (!input.trim() || isFocus || loading) return
    const userMsg: Msg = {
      id: nanoid(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      mode,
      trainingPhase,
    }
    addMessage(userMsg)
    setInput('')
    setRetryMessage(null)
    await requestReply(userMsg)
  }

  const retry = async () => {
    if (!retryMessage || isFocus || loading) return
    await requestReply(retryMessage, true)
  }

  return (
    <div className="relative flex flex-col h-full bg-surface dark:bg-surface-dark">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 h-[48px] border-b border-border
                      dark:border-border-dark flex-shrink-0">
        <Sparkles size={16} className="text-accent" />
        <span className="shrink-0 text-sm font-medium text-text-primary dark:text-text-dark-primary">
          AI 教练
        </span>
        <span
          className="ml-auto max-w-[48%] truncate text-[11px] text-text-muted dark:text-text-dark-muted"
          title={`${provider.name} · ${provider.model || '未配置模型'}`}
        >
          {provider.name} · {provider.model || '未配置模型'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!isFocus && messages.map(m => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {!isFocus && loading && (
          <div role="status" aria-live="polite" aria-atomic="true" className="space-y-2 text-xs text-text-muted dark:text-text-dark-muted">
            <button type="button" aria-expanded={thinkingExpanded} aria-controls="chat-thinking-details"
              onClick={() => setThinkingExpanded(value => !value)}
              className="flex w-full min-w-0 items-center gap-2 text-left hover:text-text-secondary dark:hover:text-text-dark-secondary">
              <span className="inline-flex shrink-0 gap-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {thinkingText ? `正在思考：${lastThinkingLine(thinkingText)}` : '正在思考…'}
              </span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${thinkingExpanded ? 'rotate-180' : ''}`} />
            </button>
            {thinkingExpanded && <div id="chat-thinking-details" className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface-soft px-3 py-2 text-[11px] leading-relaxed dark:border-border-dark dark:bg-surface-dark-soft">
              {thinkingText || '模型尚未返回可展开的思考内容。'}
            </div>}
          </div>
        )}
        {!isFocus && streamedReply && <ChatMessage message={{
          id: 'streaming-reply', role: 'agent', content: streamedReply,
          timestamp: new Date().toISOString(), mode,
        }} />}

        {/* Active animation card */}
        {!isFocus && animation && <AnimationCard
          job={animation}
          onRetry={activeProblem ? () => {
            const contextVersion = contextVersionRef.current
            setAnimationId(null)
            void agentService.requestAnimation(
              'PRE_EXPLAIN', activeProblem.topics[0] ?? '算法',
              animation?.title ?? activeProblem.title, activeProblem.platformId,
            ).then(id => {
              const current = useAppStore.getState()
              if (contextVersion !== contextVersionRef.current || current.mode === 'FOCUS' || current.activeProblem?.platform !== activeProblem.platform
                || current.activeProblem?.platformId !== activeProblem.platformId) return
              setAnimationId(id)
              addMessage({
                id: nanoid(), role: 'system', content: '动画已重新排队。',
                timestamp: new Date().toISOString(), mode: current.mode, animationId: id,
              })
            }).catch(() => {
              const current = useAppStore.getState()
              if (contextVersion !== contextVersionRef.current || current.mode === 'FOCUS' || current.activeProblem?.platform !== activeProblem.platform
                || current.activeProblem?.platformId !== activeProblem.platformId) return
              addMessage({
                id: nanoid(), role: 'system', content: '动画服务暂时不可用，请稍后再试。',
                timestamp: new Date().toISOString(), mode: current.mode,
              })
            })
          } : undefined}
        />}

        <div ref={bottomRef} />
      </div>

      {/* Input box */}
      <div className="flex-shrink-0 border-t border-border dark:border-border-dark p-3">
        {isFocus ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-text-muted
                          dark:text-text-dark-muted bg-focus/5 rounded-lg border border-focus/20">
            <Lock size={13} className="text-focus" />
            专注解题中，AI 已静默
          </div>
        ) : (
          <div className="space-y-2">
            {errorAction && (
              <div role="group" aria-label="模型配置帮助" className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-soft px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark-soft">
                <span className="text-text-secondary dark:text-text-dark-secondary">
                  {errorAction.label === '检查模型 Provider'
                    ? '检查模型名、Base URL 或 API key 后即可继续对话。'
                    : '完善模型 Provider 配置后即可继续对话。'}
                </span>
                <Link to={errorAction.href} state={{ returnToChat: true }} className="shrink-0 font-medium text-accent hover:underline">
                  {errorAction.label}
                </Link>
              </div>
            )}
            {retryMessage && !loading && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs">
                <span className="text-text-secondary dark:text-text-dark-secondary">
                  这条消息没有送达，输入内容已保留。
                </span>
                <button type="button" onClick={() => void retry()} aria-label="重试发送消息"
                  className="shrink-0 font-medium text-accent hover:underline">
                  重试
                </button>
              </div>
            )}
            <div
              role="group"
              aria-label="竞赛训练设置"
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs
                         text-text-secondary dark:text-text-dark-secondary"
            >
              <div className="flex items-center gap-1.5">
                <label htmlFor="chat-training-phase" className="cursor-pointer select-none">
                  训练阶段
                </label>
                <select
                  id="chat-training-phase"
                  value={trainingPhase}
                  onChange={e => setChatPhase(e.target.value as TrainingPhase)}
                  className="rounded-md border border-border dark:border-border-dark
                             bg-surface-soft dark:bg-surface-dark-soft px-2 py-1 text-xs
                             text-text-primary dark:text-text-dark-primary outline-none
                             transition-colors focus:border-accent dark:focus:border-accent"
                >
                  {TRAINING_PHASES.map(phase => (
                    <option key={phase.value} value={phase.value}>{phase.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="chat-time-remaining" className="cursor-pointer select-none">
                  本题总时限（分钟）
                </label>
                <input
                  id="chat-time-remaining"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={timeInput}
                  onChange={e => {
                    const next = e.target.value
                    if (/^\d*$/.test(next)) setProblemTimeLimitMinutes(next)
                  }}
                  placeholder="不限"
                  aria-describedby="chat-time-remaining-help"
                  className="w-16 rounded-md border border-border dark:border-border-dark
                             bg-surface-soft dark:bg-surface-dark-soft px-2 py-1 text-xs
                             text-text-primary dark:text-text-dark-primary outline-none
                             transition-colors focus:border-accent dark:focus:border-accent
                             placeholder:text-text-muted dark:placeholder:text-text-dark-muted"
                />
                <span id="chat-time-remaining-help" className="sr-only">
                  留空表示不限时；教练收到的剩余时间会扣除累计专注用时
                </span>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => {
                  const next = e.target.value
                  setInput(next)
                  if (retryMessage && next !== retryMessage.content) setRetryMessage(null)
                }}
                onKeyDown={e => {
                  // Enter confirms a Chinese/Japanese IME composition before
                  // it should submit the chat. Let the composition finish.
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
                }}
                placeholder="问 AI 教练…（Shift+Enter 换行）"
                aria-label="发送给 AI 教练的消息"
                rows={2}
                className="flex-1 resize-none text-sm px-3 py-2 rounded-lg bg-surface-soft
                           dark:bg-surface-dark-soft border border-border dark:border-border-dark
                           text-text-primary dark:text-text-dark-primary outline-none
                           focus:border-accent dark:focus:border-accent transition-colors
                           placeholder:text-text-muted dark:placeholder:text-text-dark-muted"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                aria-busy={loading}
                title={loading ? '正在等待教练回复' : '发送消息（Enter）'}
                aria-label={loading ? '正在等待教练回复' : '发送消息'}
                className="p-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white
                           disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function lastThinkingLine(value: string): string {
  const lines = value.split(/\r?\n/).filter(Boolean)
  return lines[lines.length - 1] ?? ''
}
