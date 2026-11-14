import React, { useRef, useEffect, useState } from 'react'
import { Lock, Send, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import ChatMessage from './ChatMessage'
import AnimationCard from '../Animation/AnimationCard'
import type { ChatMessage as Msg } from '@/types'
import { agentService, type TrainingPhase } from '@/services/agentService'
import { usePollAnimation } from '@/hooks/usePollAnimation'
import { nanoid } from 'nanoid'

const TRAINING_PHASES: ReadonlyArray<{ value: TrainingPhase; label: string }> = [
  { value: 'auto', label: 'auto' },
  { value: 'virtual_contest', label: '模拟赛' },
  { value: 'topic_drill', label: '专题训练' },
  { value: 'attempt', label: '独立作答' },
  { value: 'hint', label: '逐级提示' },
  { value: 'review', label: '赛后复盘' },
  { value: 'upsolve', label: 'upsolve' },
]

/** Minutes typed by the user (empty = omit), converted to a safe second count. */
function toRemainingSeconds(raw: string): number | undefined {
  if (raw === '') return undefined
  const minutes = Number(raw)
  return Number.isSafeInteger(minutes) ? minutes * 60 : undefined
}

/**
 * Right panel — Agent conversation area.
 *
 * FOCUS mode: entire panel is locked with an overlay.
 * Any other mode: fully interactive.
 */
export default function ChatPanel() {
  const { mode, messages, addMessage, activeAnimation, activeProblem, goal, provider } = useAppStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>('auto')
  const [timeInput, setTimeInput] = useState('')
  const [animationId, setAnimationId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const animation = usePollAnimation(animationId)

  const isFocus = mode === 'FOCUS'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const lastAnimationId = [...messages].reverse().find(message => message.animationId)?.animationId ?? null
    setAnimationId(lastAnimationId)
    setTrainingPhase('auto')
    setTimeInput('')
  }, [activeProblem?.platformId])

  const send = async () => {
    if (!input.trim() || isFocus || loading) return
    const userMsg: Msg = {
      id: nanoid(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      mode,
    }
    addMessage(userMsg)
    setInput('')
    setLoading(true)

    try {
      const timeRemainingSec = toRemainingSeconds(timeInput)
      const reply = await agentService.chat(userMsg.content, {
        mode,
        problemId: activeProblem?.platformId,
        goal,
        provider,
        trainingPhase,
        ...(timeRemainingSec !== undefined ? { timeRemainingSec } : {}),
      })
      addMessage({
        id: nanoid(),
        role: 'agent',
        content: reply.content,
        timestamp: new Date().toISOString(),
        mode,
        animationId: reply.animationId,
      })
      if (reply.animationId) {
        setAnimationId(reply.animationId)
        addMessage({
          id: nanoid(), role: 'system', content: '动画已经排队，稍后会出现在对话里。',
          timestamp: new Date().toISOString(), mode,
        })
      }
    } catch (e) {
      addMessage({
        id: nanoid(),
        role: 'system',
        content: '网络错误，请重试',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col h-full bg-surface dark:bg-surface-dark">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 h-[48px] border-b border-border
                      dark:border-border-dark flex-shrink-0">
        <Sparkles size={16} className="text-accent" />
        <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
          AI 教练
        </span>
        {isFocus && (
          <div className="ml-auto flex items-center gap-1 text-xs text-focus">
            <Lock size={12} /> 专注模式
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isFocus && (
          <EmptyState mode={mode} />
        )}
        {messages.map(m => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-text-muted dark:text-text-dark-muted">
            <span className="inline-flex gap-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            思考中…
          </div>
        )}

        {/* Active animation card */}
        {(animation ?? activeAnimation) && <AnimationCard
          job={(animation ?? activeAnimation)!}
          onRetry={activeProblem ? () => {
            setAnimationId(null)
            void agentService.requestAnimation(
              'PRE_EXPLAIN', activeProblem.topics[0] ?? '算法',
              animation?.title ?? activeProblem.title, activeProblem.platformId,
            ).then(setAnimationId).catch(() => {
              addMessage({
                id: nanoid(), role: 'system', content: '动画服务暂时不可用，请稍后再试。',
                timestamp: new Date().toISOString(), mode,
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
                  onChange={e => setTrainingPhase(e.target.value as TrainingPhase)}
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
                  剩余时间（分钟）
                </label>
                <input
                  id="chat-time-remaining"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={timeInput}
                  onChange={e => {
                    const next = e.target.value
                    if (/^\d*$/.test(next)) setTimeInput(next)
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
                  留空则不发送剩余时间；0 表示没有剩余时间
                </span>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="问 AI 教练…（Shift+Enter 换行）"
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

function EmptyState({ mode }: { mode: string }) {
  const hints: Record<string, string> = {
    IDLE:   '选择一道题目，AI 教练会为你分析考点并准备讲解',
    PREP:   '题目已加载。你可以问 AI 任何关于这道题的问题，或者请求知识点动画讲解',
    REVIEW: '提交完成！AI 正在分析你的解法，可以追问任何疑问',
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center pt-8">
      <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
        <Sparkles size={24} className="text-accent" />
      </div>
      <p className="text-sm text-text-secondary dark:text-text-dark-secondary max-w-[220px]">
        {hints[mode] ?? ''}
      </p>
    </div>
  )
}
