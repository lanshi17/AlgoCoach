import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { agentService, getAgentErrorAction, getAgentErrorMessage } from '@/services/agentService'
import { saveNotebookEntry } from '@/services/learningNotebook'
import { useAppStore } from '@/stores/useAppStore'
import ChatMessage from '@/components/Chat/ChatMessage'
import GuidedCodeEditor from '@/components/Editor/GuidedCodeEditor'
import ColumnResizer from '@/components/Layout/ColumnResizer'
import FloatingPanelChrome from '@/components/Layout/FloatingPanelChrome'
import FloatingPanelResizeHandle from '@/components/Layout/FloatingPanelResizeHandle'
import { clampFloatRect, readFloatRect, type FloatRect } from '@/components/Layout/floatingPanel'
import { packLayout, unpackLayout } from '@/components/Layout/layoutStorage'
import { useLayoutStorageSync } from '@/components/Layout/useLayoutStorageSync'
import type { ChatMessage as Message, CodeLanguage } from '@/types'
import { workspaceStorageKey } from '@/services/deepTutorCapabilities'
import {
  DEFAULT_GUIDED_STAGES, buildGuidedPlanPrompt, parseGuidedPlan, sanitizeGuidedStages,
  stageNeedsAnswer, type GuidedStage,
} from '@/services/guidedPlan'
import { LANGUAGE_OPTIONS } from '@/services/languages'
import { guidedCodeTemplate, isGuidedCodeTemplate } from '@/services/guidedCodeTemplates'
import { optionLine, parseChoiceAnswer, parseChoices, visibleReply } from '@/services/guidedChoice'
import { clearGuidedSession, readGuidedSession, saveGuidedSession, type GuidedChoiceQuestion } from '@/services/guidedSession'
import { ArrowRight, BookOpen, Check, Circle, Code2, ExternalLink, MessageCircle, PanelLeft, PanelTop, Plus, RotateCcw, Send, Sparkles } from 'lucide-react'

type PlanSource = 'ai' | 'default'

type GuidedLayout = {
  leftWidth: number
  rightWidth: number
  leftOpen: boolean
  rightOpen: boolean
  codeFloating: boolean
  codeMaximized: boolean
  codeFloat: FloatRect
}

const GUIDED_LAYOUT_KEY = 'algocoach.guidedLayout'
const LEFT_MIN = 180
const LEFT_MAX = 380
const RIGHT_MIN = 320
const RIGHT_MAX = 640
const CHAT_MIN = 320
const GUIDED_GAP = 12
const DEFAULT_CODE_FLOAT: FloatRect = { x: 700, y: 80, width: 560, height: 600 }
const DEFAULT_GUIDED_LAYOUT: GuidedLayout = { leftWidth: 230, rightWidth: 420, leftOpen: true, rightOpen: true, codeFloating: false, codeMaximized: false, codeFloat: DEFAULT_CODE_FLOAT }

function defaultGuidedLayout(): GuidedLayout {
  return { ...DEFAULT_GUIDED_LAYOUT, codeFloat: { ...DEFAULT_CODE_FLOAT } }
}

function readGuidedLayout(): GuidedLayout {
  try {
    const saved = unpackLayout(localStorage.getItem(workspaceStorageKey(GUIDED_LAYOUT_KEY))) as Partial<GuidedLayout> | null
    if (!saved || typeof saved !== 'object') return DEFAULT_GUIDED_LAYOUT
    return {
      leftWidth: typeof saved.leftWidth === 'number' && Number.isFinite(saved.leftWidth)
        ? Math.min(LEFT_MAX, Math.max(LEFT_MIN, Math.round(saved.leftWidth)))
        : DEFAULT_GUIDED_LAYOUT.leftWidth,
      rightWidth: typeof saved.rightWidth === 'number' && Number.isFinite(saved.rightWidth)
        ? Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, Math.round(saved.rightWidth)))
        : DEFAULT_GUIDED_LAYOUT.rightWidth,
      leftOpen: typeof saved.leftOpen === 'boolean' ? saved.leftOpen : DEFAULT_GUIDED_LAYOUT.leftOpen,
      rightOpen: typeof saved.rightOpen === 'boolean' ? saved.rightOpen : DEFAULT_GUIDED_LAYOUT.rightOpen,
      codeFloating: typeof saved.codeFloating === 'boolean' ? saved.codeFloating : DEFAULT_GUIDED_LAYOUT.codeFloating,
      codeMaximized: typeof saved.codeMaximized === 'boolean' ? saved.codeMaximized : DEFAULT_GUIDED_LAYOUT.codeMaximized,
      codeFloat: readFloatRect(saved.codeFloat, DEFAULT_CODE_FLOAT),
    }
  } catch {
    return DEFAULT_GUIDED_LAYOUT
  }
}

export default function GuidedLearningPage() {
  const navigate = useNavigate()
  const { provider, goal, coachPrefs, mode } = useAppStore(state => ({ provider: state.provider, goal: state.goal, coachPrefs: state.coachPrefs, mode: state.mode }))
  const [topic, setTopic] = useState('')
  const [activeTopic, setActiveTopic] = useState('')
  const [stages, setStages] = useState<GuidedStage[]>(DEFAULT_GUIDED_STAGES)
  const [planSource, setPlanSource] = useState<PlanSource>('default')
  const [planning, setPlanning] = useState(false)
  const [stage, setStage] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errorAction, setErrorAction] = useState<{ href: string; label: string } | null>(null)
  const [noteStatus, setNoteStatus] = useState('')
  const [answered, setAnswered] = useState(false)
  const [questionId, setQuestionId] = useState<string | null>(null)
  const [choiceQuestions, setChoiceQuestions] = useState<Record<string, GuidedChoiceQuestion>>({})
  const [picked, setPicked] = useState('')
  const [feedback, setFeedback] = useState('')
  const [streamedReply, setStreamedReply] = useState('')
  const [code, setCode] = useState('')
  const [codeLang, setCodeLang] = useState<CodeLanguage>('python3')
  const [conversationId, setConversationId] = useState(() => nanoid())
  const controller = useRef<AbortController | null>(null)
  const cancelled = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const followReply = useRef(true)
  const currentStage = stages[stage]
  const isCodeStage = currentStage?.type === 'code'
  const [layout, setLayout] = useState<GuidedLayout>(readGuidedLayout)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [workspaceWidth, setWorkspaceWidth] = useState(0)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const { leftWidth, rightWidth, leftOpen, rightOpen, codeFloating, codeMaximized, codeFloat } = layout
  const layoutStorageKey = workspaceStorageKey(GUIDED_LAYOUT_KEY)
  const codeFloatingActive = codeFloating && viewportWidth >= 1024
  const codeDocked = Boolean(isCodeStage && rightOpen && !codeFloatingActive)
  const codeVisible = Boolean(isCodeStage && (rightOpen || codeFloatingActive))

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(layoutStorageKey, packLayout(layout)) }
      catch { /* keep the layout usable when storage is blocked */ }
    }, 120)
    return () => window.clearTimeout(timer)
  }, [layout, layoutStorageKey])

  useLayoutStorageSync(layoutStorageKey, newValue => {
    const next = newValue === null ? defaultGuidedLayout() : readGuidedLayout()
    setLayout(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
  })

  useEffect(() => {
    if (isCodeStage) setLayout(current => current.rightOpen ? current : { ...current, rightOpen: true })
  }, [isCodeStage])

  useEffect(() => {
    const updateViewport = () => {
      setViewportWidth(window.innerWidth)
      setLayout(current => {
        const next = clampFloatRect(current.codeFloat)
        return JSON.stringify(next) === JSON.stringify(current.codeFloat) ? current : { ...current, codeFloat: next }
      })
    }
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    const element = workspaceRef.current
    if (!element) return
    const measure = () => setWorkspaceWidth(element.clientWidth || window.innerWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Reserve a readable chat column. Limits are based on the workspace itself,
  // not the browser viewport: the icon sidebar and page padding are not part of
  // the three-column grid.
  const availableWidth = workspaceWidth || viewportWidth
  const visibleColumnCount = 1 + (leftOpen ? 1 : 0) + (codeDocked ? 1 : 0)
  const usableWidth = Math.max(LEFT_MIN + RIGHT_MIN, availableWidth - GUIDED_GAP * (visibleColumnCount - 1))
  const resizeSpace = Math.max(LEFT_MIN + RIGHT_MIN, usableWidth - CHAT_MIN)

  useEffect(() => {
    setLayout(current => {
      const rightMax = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, resizeSpace - (current.leftOpen ? current.leftWidth : 0)))
      const leftMax = Math.max(LEFT_MIN, Math.min(LEFT_MAX, resizeSpace - (isCodeStage && rightOpen && !codeFloatingActive ? rightWidth : 0)))
      const nextLeft = Math.min(current.leftWidth, leftMax)
      const nextRight = isCodeStage && rightOpen && !codeFloatingActive ? Math.min(current.rightWidth, rightMax) : current.rightWidth
      return nextLeft === current.leftWidth && nextRight === current.rightWidth
        ? current
        : { ...current, leftWidth: nextLeft, rightWidth: nextRight }
    })
  }, [isCodeStage, leftOpen, rightOpen, codeFloatingActive, resizeSpace, rightWidth])

  const leftLimit = Math.max(LEFT_MIN, Math.min(LEFT_MAX, resizeSpace - (codeDocked ? rightWidth : 0)))
  const rightLimit = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, resizeSpace - (leftOpen ? leftWidth : 0)))
  const guidedColumns = [
    leftOpen ? `${leftWidth}px` : '',
    'minmax(0,1fr)',
    codeDocked ? `${rightWidth}px` : '',
  ].filter(Boolean).join(' ')

  useEffect(() => { if (followReply.current) bottomRef.current?.scrollIntoView?.({ block: 'end' }) }, [messages, streamedReply, error, feedback])
  useEffect(() => {
    if (mode === 'FOCUS') controller.current?.abort()
  }, [mode])

  const [restored] = useState(() => readGuidedSession())
  useEffect(() => {
    if (!restored) return
    const restoredStages = sanitizeGuidedStages(restored.stages) ?? DEFAULT_GUIDED_STAGES
    const restoredStage = Number.isInteger(restored.stage) && restored.stage >= 0 && restored.stage < restoredStages.length
      ? restored.stage
      : 0
    let previousStageStart = -1
    restored.messages.forEach((message, index) => {
      if (message.role === 'user' && message.content === `进入${restoredStages[restoredStage].name}`) previousStageStart = index
    })
    const previousQuestion = previousStageStart >= 0
      ? restored.messages.slice(previousStageStart + 1).find(message => message.role === 'agent')
      : undefined
    setChoiceQuestions(restored.choiceQuestions ?? {})
    setStages(restoredStages)
    setPlanSource(restored.planSource === 'ai' ? 'ai' : 'default')
    setTopic(restored.topic)
    setActiveTopic(restored.topic)
    setStage(restoredStage)
    setMessages(restored.messages)
    setAnswered(restored.passed === true)
    setQuestionId(restored.questionId ?? previousQuestion?.id ?? null)
    if (restored.conversationId) setConversationId(restored.conversationId)
    const restoredLang = LANGUAGE_OPTIONS.some(option => option.value === restored.codeLang) ? restored.codeLang! : 'python3'
    setCodeLang(restoredLang)
    setCode(typeof restored.code === 'string' && restored.code.trim() ? restored.code : guidedCodeTemplate(restoredLang))
  }, [restored])

  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    try {
      if (activeTopic) saveGuidedSession({
        topic: activeTopic, stage, messages, passed: answered, questionId, conversationId,
        choiceQuestions, stages, planSource, code, codeLang,
      })
      else clearGuidedSession()
    } catch { /* keep the current session usable in memory */ }
  }, [activeTopic, stage, messages, answered, questionId, conversationId, choiceQuestions, stages, planSource, code, codeLang])
  useEffect(() => () => { controller.current?.abort() }, [])

  const ask = async (message: string, display = message, kind?: 'assessment' | 'choice') => {
    if (controller.current || mode === 'FOCUS') return null
    const marker = kind === 'choice' ? '[[答案:' : kind === 'assessment' ? '[[评价:' : ''
    const visible = (text: string) => marker ? visibleReply(text, marker) : text
    const request = new AbortController()
    controller.current = request
    cancelled.current = false
    followReply.current = true
    setBusy(true); setError(''); setErrorAction(null); setStreamedReply('')
    setMessages(current => [...current, { id: nanoid(), role: 'user', content: display, timestamp: new Date().toISOString() }])
    let partial = ''
    try {
      const response = await agentService.chatStream(message, {
        mode: 'PREP', capability: 'chat', conversationId, goal, provider,
        animations: coachPrefs.animations, coachStyle: coachPrefs.coachStyle,
      }, { onText: delta => {
        if (request.signal.aborted) return
        partial += delta
        setStreamedReply(visible(partial))
      } }, request.signal)
      if (request.signal.aborted) return null
      const content = visible(response.content)
      const correct = kind === 'choice' ? parseChoiceAnswer(response.content) : undefined
      if (kind === 'choice' && (!correct || parseChoices(content).length !== 4 || !content.replace(optionLine, '').trim())) {
        setError('这次未能生成完整的选择题，请重新出题。')
        return null
      }
      const id = nanoid()
      setMessages(current => [...current, { id, role: 'agent', content, timestamp: new Date().toISOString() }])
      return { content: response.content, id, correct }
    } catch (cause) {
      if (!request.signal.aborted || cancelled.current) {
        if (partial && kind !== 'choice') setMessages(current => [...current, { id: nanoid(), role: 'agent', content: visible(partial), timestamp: new Date().toISOString() }])
        setError(cancelled.current ? '已停止生成，可以继续追问或重试。' : getAgentErrorMessage(cause))
        setErrorAction(cancelled.current ? null : getAgentErrorAction(cause))
      }
      return null
    } finally {
      if (controller.current === request) {
        controller.current = null
        setBusy(false)
        setStreamedReply('')
      }
    }
  }

  const planOutline = async (value: string): Promise<{ stages: GuidedStage[]; source: PlanSource } | null> => {
    if (controller.current || mode === 'FOCUS') return null
    const request = new AbortController()
    controller.current = request
    cancelled.current = false
    setBusy(true); setPlanning(true); setError(''); setErrorAction(null); setStreamedReply('')
    try {
      const response = await agentService.chatStream(buildGuidedPlanPrompt(value, goal), {
        mode: 'PREP', capability: 'chat', conversationId, goal, provider,
        animations: coachPrefs.animations, coachStyle: coachPrefs.coachStyle,
      }, {}, request.signal)
      if (request.signal.aborted) return null
      const planned = parseGuidedPlan(response.content)
      return planned
        ? { stages: planned, source: 'ai' }
        : { stages: DEFAULT_GUIDED_STAGES, source: 'default' }
    } catch (cause) {
      if (!request.signal.aborted || cancelled.current) {
        setError(cancelled.current ? '已停止生成，可以重新规划。' : getAgentErrorMessage(cause))
        setErrorAction(cancelled.current ? null : getAgentErrorAction(cause))
      }
      return null
    } finally {
      if (controller.current === request) {
        controller.current = null
        setBusy(false)
        setPlanning(false)
        setStreamedReply('')
      }
    }
  }

  const start = async () => {
    const value = topic.trim()
    if (!value || busy) return
    const plan = await planOutline(value)
    if (!plan) return
    const first = plan.stages[0]
    const question = await ask(`当前学习主题：${value}。${first.instruction}`, `进入${first.name}`, first.type === 'choice' ? 'choice' : undefined)
    if (!question) return
    setActiveTopic(value)
    setStages(plan.stages)
    setPlanSource(plan.source)
    setStage(0)
    setAnswered(false)
    setQuestionId(question.id)
    setPicked('')
    setFeedback('')
    setNoteStatus('')
    if (question.correct) setChoiceQuestions(current => ({ ...current, [question.id]: { correct: question.correct!, attempts: [] } }))
    if (first.type === 'code') setCode(guidedCodeTemplate(codeLang))
  }

  const enterStage = async (nextStage: number, nextStages: GuidedStage[] = stages, topicValue = activeTopic || topic.trim()) => {
    const next = nextStages[nextStage]
    if (!next || busy) return
    const question = await ask(`当前学习主题：${topicValue}。${next.instruction}`, `进入${next.name}`, next.type === 'choice' ? 'choice' : undefined)
    if (!question) return
    if (question.correct) setChoiceQuestions(current => ({ ...current, [question.id]: { correct: question.correct!, attempts: [] } }))
    if (next.type === 'code') setCode(guidedCodeTemplate(codeLang))
    setStage(nextStage)
    setAnswered(false)
    setQuestionId(question.id)
    setPicked('')
    setFeedback('')
  }

  const send = async () => {
    const value = draft.trim()
    if (!value || busy) return
    setDraft('')
    if (!await ask(`当前阶段：${stages[stage].name}。这是学生的追问，不是提交答案。请回答问题或给提示，不要透露题目完整答案，也不要进入下一阶段。\n${value}`, value)) setDraft(value)
  }

  const applyAssessment = (content: string) => {
    const verdict = content.match(/\[\[评价:(通过|再练|未评分)\]\]\s*$/)?.[1]
    setAnswered(verdict === '通过')
    if (verdict === '通过') setFeedback('教练认为本题已掌握，可以进入下一阶段。')
    else if (verdict === '再练') setFeedback('还需要再练习，可以根据反馈修改答案后重新提交。')
    else setFeedback('教练未能给出明确评价，请补充答案后重试。')
  }

  const submitAnswer = async (value: string) => {
    if (!value.trim() || controller.current || mode === 'FOCUS' || answered || currentStage?.type !== 'short') return
    const question = messages.find(item => item.id === questionId)?.content
    if (!question) { setError('找不到当前题目，请重新开始这个主题。'); return }
    const result = await ask(`请评估学生对下面题目的作答。明确解释正确之处、错误和下一步。题目：\n${question}\n\n学生作答：\n${value}\n\n只有作答充分正确时才判通过；不完整、错误或只是提问判再练；证据不足无法判断判未评分。最后单独一行严格输出 [[评价:通过]]、[[评价:再练]] 或 [[评价:未评分]]，不要提前输出该标记。`, `我的作答：${value}`, 'assessment')
    if (!result) return
    applyAssessment(result.content)
    setDraft('')
  }

  const changeCodeLanguage = (next: CodeLanguage) => {
    setCode(current => !current.trim() || isGuidedCodeTemplate(current) ? guidedCodeTemplate(next) : current)
    setCodeLang(next)
  }

  const submitCode = async () => {
    const value = code.trim()
    if (!value || controller.current || mode === 'FOCUS' || answered || currentStage?.type !== 'code') return
    if (isGuidedCodeTemplate(code)) { setError('请先在模板基础上实现解法，再提交代码。'); return }
    const question = messages.find(item => item.id === questionId)?.content
    if (!question) { setError('找不到当前题目，请重新开始这个主题。'); return }
    const languageLabel = LANGUAGE_OPTIONS.find(option => option.value === codeLang)?.label ?? codeLang
    const fencedLanguage = codeLang === 'python3' ? 'python' : codeLang === 'golang' ? 'go' : codeLang
    const result = await ask(`请评估学生对下面编程题的代码作答。题目：\n${question}\n\n学生代码（${languageLabel}）：\n\`\`\`${fencedLanguage}\n${value}\n\`\`\`\n\n请检查代码是否完整、是否覆盖边界条件，并说明时间与空间复杂度。只有代码完整且思路正确时才判通过；存在错误、遗漏或只是描述思路判再练；没有收到代码时判未评分。未实际运行代码时不要声称已通过测试。最后单独一行严格输出 [[评价:通过]]、[[评价:再练]] 或 [[评价:未评分]]，不要提前输出该标记。`, `提交代码（${languageLabel}，${value.split('\n').length} 行）`, 'assessment')
    if (!result) return
    applyAssessment(result.content)
  }

  const submitChoice = async () => {
    if (!questionId || !picked || controller.current || mode === 'FOCUS' || answered) return
    const question = messages.find(message => message.id === questionId)
    const choice = choiceQuestions[questionId]
    if (!question || !choice || !parseChoices(question.content).some(option => option.label === picked)) return
    const passed = picked === choice.correct
    setChoiceQuestions(current => ({
      ...current,
      [questionId]: { ...choice, attempts: [...choice.attempts, picked] },
    }))
    setAnswered(passed)
    setFeedback(passed
      ? '教练认为本题已掌握，可以进入下一阶段。'
      : '还需要再练习，可以重新选择后再提交。')
    setPicked('')
    await ask(
      `题目：\n${question.content}\n学生选了 ${picked}，正确选项为 ${choice.correct}。判分已完成。\n${passed ? '解释这个选项为什么正确。' : '针对所选选项给一个提示，鼓励再试一次，不要公布正确选项。'}`,
      `我的选择：${picked}`,
    )
  }

  const resetTopic = () => {
    setActiveTopic(''); setTopic(''); setMessages([]); setStages(DEFAULT_GUIDED_STAGES); setPlanSource('default')
    setStage(0); setAnswered(false); setQuestionId(null); setChoiceQuestions({}); setPicked(''); setFeedback('')
    setConversationId(nanoid()); setError(''); setErrorAction(null); setCode(guidedCodeTemplate('python3')); setCodeLang('python3'); setNoteStatus(''); setDraft('')
  }

  const resetLayout = () => {
    setLayout(defaultGuidedLayout())
  }

  const saveNote = (content: string) => {
    saveNotebookEntry({ title: `${activeTopic || '学习'} · AI 笔记`, body: content, tags: activeTopic ? [activeTopic] : [], author: 'ai' })
    setNoteStatus('已保存到 AI 笔记。')
  }

  return <main className="flex min-h-0 flex-1 flex-col bg-canvas px-3 py-4 dark:bg-[#0B0C0F] sm:px-6 sm:py-6">
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-medium tracking-wide text-accent">学习工作区</p><h1 className="mt-1 text-2xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{activeTopic || '和教练一起学习'}</h1></div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary dark:text-text-dark-secondary">
          <button type="button" aria-pressed={leftOpen} aria-label={leftOpen ? '收起大纲' : '展开大纲'} onClick={() => setLayout(current => ({ ...current, leftOpen: !current.leftOpen }))} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${leftOpen ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary'}`}><PanelLeft size={15} /><span className="hidden sm:inline">大纲</span></button>
          {isCodeStage && <button type="button" aria-pressed={rightOpen || codeFloatingActive} aria-label={rightOpen || codeFloatingActive ? '收起代码区' : '展开代码区'} onClick={() => setLayout(current => { const visible = current.rightOpen || current.codeFloating; return { ...current, rightOpen: !visible, codeFloating: false, codeMaximized: false } })} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${rightOpen || codeFloatingActive ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary'}`}><Code2 size={15} /><span className="hidden sm:inline">代码区</span></button>}
          {isCodeStage && (rightOpen || codeFloatingActive) && <button type="button" aria-pressed={codeFloatingActive} aria-label={codeFloatingActive ? '嵌入代码区布局' : '独立代码区为浮窗'} onClick={() => setLayout(current => ({ ...current, rightOpen: true, codeFloating: !current.codeFloating, codeMaximized: false, codeFloat: current.codeFloating ? current.codeFloat : clampFloatRect(current.codeFloat) }))} className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors lg:inline-flex ${codeFloatingActive ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary'}`}>{codeFloatingActive ? <PanelTop size={15} /> : <ExternalLink size={15} />}<span className="hidden sm:inline">{codeFloatingActive ? '嵌入' : '独立'}</span></button>}
          <button type="button" aria-label="重置学习页布局" title="重置分栏宽度和代码浮窗" onClick={resetLayout} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary"><RotateCcw size={15} /><span className="hidden sm:inline">重置</span></button>
          {activeTopic && <button disabled={busy} onClick={resetTopic} className="inline-flex items-center gap-1.5 hover:text-accent disabled:opacity-50"><Plus size={15} />新主题</button>}
          <button onClick={() => navigate('/knowledge')} className="inline-flex items-center gap-1.5 hover:text-accent"><BookOpen size={15} />知识库</button>
          <button onClick={() => navigate('/learning/dashboard')} className="hover:text-accent">学习记录</button>
        </div>
      </header>
      <div ref={workspaceRef} className="guided-workspace min-h-0 flex-1" style={{ '--guided-cols': guidedColumns } as CSSProperties}>
        {leftOpen && <aside className="relative min-w-0 rounded-panel border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark" aria-label="学习大纲">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary dark:text-text-dark-primary"><Sparkles size={16} className="text-accent" />学习路径<span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">{planning ? '规划中' : activeTopic ? (planSource === 'ai' ? 'AI 规划' : '默认路径') : '待规划'}</span></div>
          <p className="mt-1 text-xs leading-5 text-text-muted dark:text-text-dark-muted">{planning ? 'AI 正在根据主题规划学习阶段…' : '由 AI 教练根据主题自动规划，理解概念、逐步练习，再回顾思路。'}</p>
          <ol aria-label="学习阶段" className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-1">
            {stages.map((item, index) => <li key={item.id} aria-current={activeTopic && index === stage ? 'step' : undefined} className={`flex items-center gap-2 rounded-card px-2.5 py-2.5 text-xs ${activeTopic && index === stage ? 'bg-accent/10 font-medium text-accent' : 'text-text-secondary dark:text-text-dark-secondary'}`}>
              {activeTopic && index < stage ? <Check size={15} className="shrink-0 text-accent" /> : index === stage && activeTopic ? <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-accent text-[9px] text-white">{index + 1}</span> : <Circle size={15} className="shrink-0 opacity-40" />}
              <span>{item.name}</span>
            </li>)}
          </ol>
          <div className="mt-4 hidden border-t border-border pt-4 text-xs leading-5 text-text-muted dark:border-border-dark dark:text-text-dark-muted lg:block">{activeTopic ? '可以随时向教练追问。准备好后，再进入下一阶段。' : '选择一个想掌握的知识点，开始这次学习。'}</div>
          <ColumnResizer side="right" width={leftWidth} min={LEFT_MIN} max={leftLimit} defaultWidth={DEFAULT_GUIDED_LAYOUT.leftWidth} label="调整大纲宽度" onResize={width => setLayout(current => ({ ...current, leftWidth: width }))} />
        </aside>}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3 dark:border-border-dark">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><MessageCircle size={18} /></span>
            <div className="min-w-0"><h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">AI 教练</h2><p className="truncate text-xs text-text-muted dark:text-text-dark-muted">{planning ? '正在规划学习大纲…' : activeTopic ? `正在学习 · ${currentStage?.name ?? ''}` : '输入主题，开始学习'}</p></div>
            {busy && <div className="ml-auto flex items-center gap-3 text-xs text-text-muted"><span role="status">{planning ? '正在规划…' : '正在生成…'}</span><button type="button" onClick={() => { cancelled.current = true; controller.current?.abort() }} className="text-accent hover:underline">停止生成</button></div>}
          </div>
          <div ref={scrollRef} onScroll={() => { const box = scrollRef.current; if (box) followReply.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80 }} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-label="学习对话">
            {!messages.length && !planning && <div className="mx-auto flex h-full min-h-48 max-w-lg flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Sparkles size={22} /></div><h3 className="mt-4 text-lg font-semibold text-text-primary dark:text-text-dark-primary">今天想学什么？</h3><p className="mt-2 text-sm leading-6 text-text-secondary dark:text-text-dark-secondary">从一个知识点开始。AI 会先规划学习大纲，再带你完成概念讲解、选择题、问答题和编程练习。</p><div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="学习主题建议">{['二分查找', '动态规划', '图的遍历'].map(suggestion => <button key={suggestion} type="button" onClick={() => setTopic(suggestion)} className="rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent dark:border-border-dark dark:text-text-dark-secondary">{suggestion}</button>)}</div></div>}
            {messages.map(message => {
              const question = choiceQuestions[message.id]
              const choices = question ? parseChoices(message.content) : []
              const lastPick = question && question.attempts.length
                ? question.attempts[question.attempts.length - 1]
                : undefined
              const isCorrect = !!lastPick && lastPick === question?.correct
              const canAnswer = currentStage?.type === 'choice' && message.id === questionId && !answered
              const stem = choices.length ? message.content.replace(optionLine, '').trim() : message.content
              return <div key={message.id}><ChatMessage message={{ ...message, content: stem }} />
                {choices.length > 0 && <fieldset aria-label="选择题选项" className="ml-8 mt-3 border-l-2 border-border pl-4 dark:border-border-dark">
                  <legend className="sr-only">选择题选项</legend>
                  <div className="space-y-2">
                    {choices.map(choice => {
                      const selected = (canAnswer ? picked || lastPick : lastPick) === choice.label
                      return <button key={choice.label} type="button" aria-pressed={selected}
                        disabled={!canAnswer || busy || mode === 'FOCUS'} onClick={() => setPicked(choice.label)}
                        className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${selected ? 'border-accent bg-accent/10 text-text-primary dark:text-text-dark-primary' : 'border-border hover:border-accent/60 dark:border-border-dark'} disabled:cursor-not-allowed disabled:opacity-60`}>
                        <strong className="shrink-0">{choice.label}</strong><span>{choice.body}</span>
                      </button>
                    })}
                  </div>
                  {lastPick && <p role="status" className="mt-2 text-sm">{isCorrect ? '回答正确。' : '这次选错了，可以再试一次。'}</p>}
                  {canAnswer && <button type="button" disabled={!picked || busy || mode === 'FOCUS'} onClick={() => void submitChoice()} className="mt-2 text-sm font-medium text-accent disabled:opacity-40">提交选择</button>}
                </fieldset>}
                {message.role === 'agent' && <button type="button" onClick={() => saveNote(message.content)} className="ml-8 mt-1 text-xs text-accent hover:underline">保存为 AI 笔记</button>}</div>
            })}
            {streamedReply && <ChatMessage message={{ id: 'learning-stream', role: 'agent', content: streamedReply, timestamp: new Date().toISOString() }} />}
            {busy && !streamedReply && <p className="ml-8 text-sm text-text-muted">{planning ? 'AI 正在规划学习大纲…' : '教练正在思考…'}</p>}
            {error && <p role="alert" className="text-sm text-danger">{error}{errorAction && <Link to={errorAction.href} className="ml-2 font-medium underline">{errorAction.label}</Link>}</p>}
            {feedback && <p role="status" className="ml-8 text-sm text-text-secondary dark:text-text-dark-secondary">{feedback}</p>}
            {noteStatus && <p role="status" className="text-xs text-accent">{noteStatus}</p>}
            <div ref={bottomRef} />
          </div>
          <div className="shrink-0 border-t border-border p-3 dark:border-border-dark sm:p-4">
            {!activeTopic ? <div className="flex gap-2"><input aria-label="学习知识点" value={topic} onChange={event => setTopic(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) void start() }} placeholder="输入知识点，例如二分查找" className="min-w-0 flex-1 rounded-card border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft" /><button disabled={!topic.trim() || busy || mode === 'FOCUS'} onClick={() => void start()} className="inline-flex items-center gap-1.5 rounded-card bg-accent px-4 text-sm text-white disabled:opacity-50">开始学习 <ArrowRight size={15} /></button></div> : <div className="space-y-2"><textarea aria-label="回复教练" value={draft} onChange={event => setDraft(event.target.value)} placeholder={isCodeStage ? '对题目有疑问？在这里追问教练…' : '输入回答、问题或代码…'} className="w-full resize-y rounded-card border border-border bg-surface p-3 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft" rows={2} /><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-text-muted dark:text-text-dark-muted">{currentStage?.type === 'choice' && !answered ? '从题卡中选择一项。' : currentStage?.type === 'short' && !answered ? '提交答案后，教练会给出反馈。' : isCodeStage && !answered ? <>在代码区完成实现，然后提交代码。{!rightOpen && <button type="button" onClick={() => setLayout(current => ({ ...current, rightOpen: true }))} className="ml-1 text-accent hover:underline">打开代码区</button>}</> : ''}</span><div className="flex gap-2">{stage < stages.length - 1 && <button disabled={busy || mode === 'FOCUS' || (stageNeedsAnswer(currentStage) && !answered)} onClick={() => void enterStage(stage + 1)} className="rounded-card border border-border px-3 py-2 text-sm disabled:opacity-40 dark:border-border-dark">下一步：{stages[stage + 1].name}</button>}{currentStage?.type === 'choice' && !answered && (!questionId || !choiceQuestions[questionId]) && <button disabled={busy || mode === 'FOCUS'} onClick={() => void enterStage(stage)} className="rounded-card border border-border px-3 py-2 text-sm disabled:opacity-50">重新出选择题</button>}{currentStage?.type === 'short' && !answered && <button disabled={busy || !draft.trim() || mode === 'FOCUS'} onClick={() => void submitAnswer(draft)} className="rounded-card bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">提交答案</button>}<button disabled={busy || !draft.trim() || mode === 'FOCUS'} onClick={() => void send()} className="inline-flex items-center gap-1.5 rounded-card border border-border px-4 py-2 text-sm text-text-primary disabled:opacity-50 dark:border-border-dark dark:text-text-dark-primary">追问 <Send size={14} /></button></div></div></div>}
            {mode === 'FOCUS' && <p className="mt-2 text-sm text-text-muted">专注解题期间教练已静默，结束专注后继续学习。</p>}
          </div>
        </section>
        {codeVisible && <div
          data-guided-code-panel
          role={codeFloatingActive ? 'dialog' : undefined}
          aria-label={codeFloatingActive ? '编程题代码浮窗' : undefined}
          className={codeFloatingActive
            ? 'fixed flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-2xl dark:border-border-dark dark:bg-surface-dark'
            : 'relative flex h-[420px] min-h-0 min-w-0 flex-col lg:h-full'}
          style={codeFloatingActive
            ? (codeMaximized
              ? { left: 8, top: 8, right: 8, bottom: 8, width: 'auto', height: 'auto', zIndex: 92 }
              : { left: codeFloat.x, top: codeFloat.y, width: codeFloat.width, height: codeFloat.height, zIndex: 92 })
            : undefined}
        >
          <section className={codeFloatingActive
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-border bg-surface dark:border-border-dark dark:bg-surface-dark'}
            aria-label="编程题代码区">
            <GuidedCodeEditor
              code={code}
              language={codeLang}
              disabled={busy || !questionId}
              busy={busy}
              submitted={answered}
              focusQuiet={mode === 'FOCUS'}
              onChange={setCode}
              onLanguageChange={changeCodeLanguage}
              onResetTemplate={() => setCode(guidedCodeTemplate(codeLang))}
              onSubmit={() => void submitCode()}
            />
          </section>
          {codeFloatingActive && <div className="order-first shrink-0">
            <FloatingPanelChrome
              title="代码区"
              rect={codeFloat}
              onRectChange={rect => setLayout(current => ({ ...current, codeFloat: clampFloatRect(rect) }))}
              onDock={() => setLayout(current => ({ ...current, codeFloating: false, codeMaximized: false, rightOpen: true }))}
              maximized={codeMaximized}
              onToggleMaximize={() => setLayout(current => ({ ...current, codeMaximized: !current.codeMaximized }))}
            />
          </div>}
          {codeFloatingActive && !codeMaximized && <FloatingPanelResizeHandle label="调整代码区浮窗大小" rect={codeFloat} onResize={rect => setLayout(current => ({ ...current, codeFloat: clampFloatRect(rect) }))} />}
          {!codeFloatingActive && <ColumnResizer variant="guided" side="left" width={rightWidth} min={RIGHT_MIN} max={rightLimit} defaultWidth={DEFAULT_GUIDED_LAYOUT.rightWidth} label="调整代码区宽度" onResize={width => setLayout(current => ({ ...current, rightWidth: width }))} />}
        </div>}
      </div>
    </div>
  </main>
}
