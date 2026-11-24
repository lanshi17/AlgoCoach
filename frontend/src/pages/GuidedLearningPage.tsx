import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { agentService, getAgentErrorMessage } from '@/services/agentService'
import { saveNotebookEntry } from '@/services/learningNotebook'
import { useAppStore } from '@/stores/useAppStore'
import ChatMessage from '@/components/Chat/ChatMessage'
import type { ChatMessage as Message } from '@/types'
import { workspaceStorageKey } from '@/services/deepTutorCapabilities'
import { optionLine, parseChoiceAnswer, parseChoices, visibleReply } from '@/services/guidedChoice'
import { ArrowRight, BookOpen, Check, Circle, MessageCircle, Plus, Send, Sparkles } from 'lucide-react'

const stages = [
  { name: '学习知识点', instruction: '讲解这个知识点的核心概念、适用场景和一个简单例子。不要提前出题，等待学生理解。' },
  { name: '选择题', instruction: '根据刚才的知识点出一道单选题。先写题干，再逐行给出 A. 到 D. 四个选项。最后单独一行写 [[答案:A]]（将 A 替换为正确选项字母）。正文不要透露答案或解析。' },
  { name: '问答题', instruction: '出一道需要解释思路的简答题，不要提前给答案，等待学生回答。' },
  { name: '编程题', instruction: '给出一道循序渐进的编程练习，包括题意、输入输出、约束和样例，不要给完整答案，等待学生提交思路或代码。' },
  { name: '复盘', instruction: '根据本次对话中实际给出的回答和代码进行复盘，区分已验证事实与待验证风险，指出下一步。没有提交代码时明确说明。' },
] as const

type ChoiceQuestion = { correct: string; attempts: string[] }

export default function GuidedLearningPage() {
  const navigate = useNavigate()
  const { provider, goal, coachPrefs, mode } = useAppStore(state => ({ provider: state.provider, goal: state.goal, coachPrefs: state.coachPrefs, mode: state.mode }))
  const [topic, setTopic] = useState('')
  const [activeTopic, setActiveTopic] = useState('')
  const [stage, setStage] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [noteStatus, setNoteStatus] = useState('')
  const [answered, setAnswered] = useState(false)
  const [questionId, setQuestionId] = useState<string | null>(null)
  const [choiceQuestions, setChoiceQuestions] = useState<Record<string, ChoiceQuestion>>({})
  const [picked, setPicked] = useState('')
  const [feedback, setFeedback] = useState('')
  const [streamedReply, setStreamedReply] = useState('')
  const [conversationId, setConversationId] = useState(() => nanoid())
  const controller = useRef<AbortController | null>(null)
  const cancelled = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const followReply = useRef(true)
  useEffect(() => { if (followReply.current) bottomRef.current?.scrollIntoView?.({ block: 'end' }) }, [messages, streamedReply])
  useEffect(() => {
    if (mode === 'FOCUS') controller.current?.abort()
  }, [mode])
  const [restored] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(workspaceStorageKey('algocoach.guidedLearning')) ?? 'null') as { topic: string; stage: number; messages: Message[]; passed?: boolean; questionId?: string | null; conversationId?: string; choiceQuestions?: Record<string, ChoiceQuestion> } | null }
    catch { return null }
  })
  useEffect(() => {
    if (restored && typeof restored.topic === 'string' && Number.isInteger(restored.stage) && restored.stage >= 0 && restored.stage < stages.length && Array.isArray(restored.messages)) {
      let previousStageStart = -1
      restored.messages.forEach((message, index) => { if (message.role === 'user' && message.content === `进入${stages[restored.stage].name}`) previousStageStart = index })
      const previousQuestion = previousStageStart >= 0 ? restored.messages.slice(previousStageStart + 1).find(message => message.role === 'agent') : undefined
      setChoiceQuestions(restored.choiceQuestions ?? {})
      setTopic(restored.topic); setActiveTopic(restored.topic); setStage(restored.stage); setMessages(restored.messages); setAnswered(restored.passed === true); setQuestionId(restored.questionId ?? previousQuestion?.id ?? null); if (restored.conversationId) setConversationId(restored.conversationId)
    }
  }, [restored])
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    try {
      if (activeTopic) sessionStorage.setItem(workspaceStorageKey('algocoach.guidedLearning'), JSON.stringify({ topic: activeTopic, stage, messages, passed: answered, questionId, conversationId, choiceQuestions }))
      else sessionStorage.removeItem(workspaceStorageKey('algocoach.guidedLearning'))
    } catch { /* keep the current session usable in memory */ }
  }, [activeTopic, stage, messages, answered, questionId, conversationId, choiceQuestions])
  useEffect(() => () => { controller.current?.abort() }, [])

  const ask = async (message: string, display = message, kind?: 'assessment' | 'choice') => {
    if (controller.current || mode === 'FOCUS') return null
    const marker = kind === 'choice' ? '[[答案:' : kind === 'assessment' ? '[[评价:' : ''
    const visible = (text: string) => marker ? visibleReply(text, marker) : text
    const request = new AbortController()
    controller.current = request
    cancelled.current = false
    followReply.current = true
    setBusy(true); setError(''); setStreamedReply('')
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
  const start = async () => {
    const value = topic.trim()
    if (!value || busy) return
    if (await ask(`我想学习「${value}」。${stages[0].instruction}`, `开始学习：${value}`)) { setActiveTopic(value); setStage(0) }
  }
  const enterStage = async (nextStage: number) => {
    const question = await ask(`当前学习主题：${activeTopic}。${stages[nextStage].instruction}`, `进入${stages[nextStage].name}`, nextStage === 1 ? 'choice' : undefined)
    if (!question) return
    if (question.correct) {
      const correct = question.correct
      setChoiceQuestions(current => ({ ...current, [question.id]: { correct, attempts: [] } }))
    }
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
  const submitAnswer = async (value: string) => {
    if (!value.trim() || controller.current || mode === 'FOCUS' || answered || stage < 2 || stage > 3) return
    const question = messages.find(item => item.id === questionId)?.content
    if (!question) { setError('找不到当前题目，请重新开始这个主题。'); return }
    const result = await ask(`请评估学生对下面题目的作答。明确解释正确之处、错误和下一步。题目：\n${question}\n\n学生作答：\n${value}\n\n只有作答充分正确时才判通过；不完整、错误或只是提问判再练；证据不足无法判断判未评分。编程题只有收到具体代码才能判通过，未运行代码时不要声称已通过测试。最后单独一行严格输出 [[评价:通过]]、[[评价:再练]] 或 [[评价:未评分]]，不要提前输出该标记。`, `我的作答：${value}`, 'assessment')
    if (!result) return
    const verdict = result.content.match(/\[\[评价:(通过|再练|未评分)\]\]\s*$/)?.[1]
    setAnswered(verdict === '通过')
    if (verdict === '通过') setFeedback('教练认为本题已掌握，可以进入下一阶段。')
    else if (verdict === '再练') setFeedback('还需要再练习，可以根据反馈修改答案后重新提交。')
    else setFeedback('教练未能给出明确评价，请补充答案后重试。')
    setDraft('')
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
  const saveNote = (content: string) => {
    saveNotebookEntry({ title: `${activeTopic || '学习'} · AI 笔记`, body: content, tags: activeTopic ? [activeTopic] : [], author: 'ai' })
    setNoteStatus('已保存到 AI 笔记。')
  }

  return <main className="flex min-h-0 flex-1 flex-col bg-canvas px-3 py-4 dark:bg-[#0B0C0F] sm:px-6 sm:py-6">
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-medium tracking-wide text-accent">学习工作区</p><h1 className="mt-1 text-2xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{activeTopic || '和教练一起学习'}</h1></div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary dark:text-text-dark-secondary">
          {activeTopic && <button disabled={busy} onClick={() => { setActiveTopic(''); setTopic(''); setMessages([]); setStage(0); setAnswered(false); setQuestionId(null); setChoiceQuestions({}); setPicked(''); setFeedback(''); setConversationId(nanoid()); setError('') }} className="inline-flex items-center gap-1.5 hover:text-accent disabled:opacity-50"><Plus size={15} />新主题</button>}
          <button onClick={() => navigate('/knowledge')} className="inline-flex items-center gap-1.5 hover:text-accent"><BookOpen size={15} />知识库</button>
          <button onClick={() => navigate('/learning/dashboard')} className="hover:text-accent">学习记录</button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-panel border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark" aria-label="学习路径">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary dark:text-text-dark-primary"><Sparkles size={16} className="text-accent" />学习路径</div>
          <p className="mt-1 text-xs leading-5 text-text-muted dark:text-text-dark-muted">理解概念，逐步练习，再回顾思路。</p>
          <ol aria-label="学习阶段" className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-1">
            {stages.map((item, index) => <li key={item.name} aria-current={activeTopic && index === stage ? 'step' : undefined} className={`flex items-center gap-2 rounded-card px-2.5 py-2.5 text-xs ${activeTopic && index === stage ? 'bg-accent/10 font-medium text-accent' : 'text-text-secondary dark:text-text-dark-secondary'}`}>
              {activeTopic && index < stage ? <Check size={15} className="shrink-0 text-accent" /> : index === stage && activeTopic ? <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-accent text-[9px] text-white">{index + 1}</span> : <Circle size={15} className="shrink-0 opacity-40" />}
              <span>{item.name}</span>
            </li>)}
          </ol>
          <div className="mt-4 hidden border-t border-border pt-4 text-xs leading-5 text-text-muted dark:border-border-dark dark:text-text-dark-muted lg:block">{activeTopic ? '可以随时向教练追问。准备好后，再进入下一阶段。' : '选择一个想掌握的知识点，开始这次学习。'}</div>
        </aside>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3 dark:border-border-dark">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><MessageCircle size={18} /></span>
            <div className="min-w-0"><h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">AI 教练</h2><p className="truncate text-xs text-text-muted dark:text-text-dark-muted">{activeTopic ? `正在学习 · ${stages[stage].name}` : '输入主题，开始学习'}</p></div>
            {busy && <div className="ml-auto flex items-center gap-3 text-xs text-text-muted"><span role="status">正在生成…</span><button type="button" onClick={() => { cancelled.current = true; controller.current?.abort() }} className="text-accent hover:underline">停止生成</button></div>}
          </div>
          <div ref={scrollRef} onScroll={() => { const box = scrollRef.current; if (box) followReply.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80 }} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-label="学习对话">
            {!messages.length && <div className="mx-auto flex h-full min-h-48 max-w-lg flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Sparkles size={22} /></div><h3 className="mt-4 text-lg font-semibold text-text-primary dark:text-text-dark-primary">今天想学什么？</h3><p className="mt-2 text-sm leading-6 text-text-secondary dark:text-text-dark-secondary">从一个知识点开始。教练会先讲解，再带你完成选择题、问答题和编程练习。</p><div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="学习主题建议">{['二分查找', '动态规划', '图的遍历'].map(suggestion => <button key={suggestion} type="button" onClick={() => setTopic(suggestion)} className="rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary hover:border-accent hover:text-accent dark:border-border-dark dark:text-text-dark-secondary">{suggestion}</button>)}</div></div>}
            {messages.map(message => {
              const question = choiceQuestions[message.id]
              const choices = question ? parseChoices(message.content) : []
              const lastPick = question && question.attempts.length
                ? question.attempts[question.attempts.length - 1]
                : undefined
              const isCorrect = !!lastPick && lastPick === question?.correct
              const canAnswer = stage === 1 && message.id === questionId && !answered
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
            {busy && !streamedReply && <p className="ml-8 text-sm text-text-muted">教练正在思考…</p>}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            {feedback && <p role="status" className="ml-8 text-sm text-text-secondary dark:text-text-dark-secondary">{feedback}</p>}
            {noteStatus && <p role="status" className="text-xs text-accent">{noteStatus}</p>}
            <div ref={bottomRef} />
          </div>
          <div className="shrink-0 border-t border-border p-3 dark:border-border-dark sm:p-4">
            {!activeTopic ? <div className="flex gap-2"><input aria-label="学习知识点" value={topic} onChange={event => setTopic(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) void start() }} placeholder="输入知识点，例如二分查找" className="min-w-0 flex-1 rounded-card border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft" /><button disabled={!topic.trim() || busy || mode === 'FOCUS'} onClick={() => void start()} className="inline-flex items-center gap-1.5 rounded-card bg-accent px-4 text-sm text-white disabled:opacity-50">开始学习 <ArrowRight size={15} /></button></div> : <div className="space-y-2"><textarea aria-label="回复教练" value={draft} onChange={event => setDraft(event.target.value)} placeholder="输入回答、问题或代码…" className="w-full resize-y rounded-card border border-border bg-surface p-3 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft" rows={2} /><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-text-muted dark:text-text-dark-muted">{stage === 1 && !answered ? '从题卡中选择一项。' : stage >= 2 && stage < 4 && !answered ? '提交答案后，教练会给出反馈。' : ''}</span><div className="flex gap-2">{stage < stages.length - 1 && <button disabled={busy || mode === 'FOCUS' || (stage > 0 && !answered)} onClick={() => void enterStage(stage + 1)} className="rounded-card border border-border px-3 py-2 text-sm disabled:opacity-40 dark:border-border-dark">下一步：{stages[stage + 1].name}</button>}{stage === 1 && !answered && (!questionId || !choiceQuestions[questionId]) && <button disabled={busy || mode === 'FOCUS'} onClick={() => void enterStage(1)} className="rounded-card border border-border px-3 py-2 text-sm disabled:opacity-50">重新出选择题</button>}{stage >= 2 && stage < 4 && !answered && <button disabled={busy || !draft.trim() || mode === 'FOCUS'} onClick={() => void submitAnswer(draft)} className="rounded-card bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">提交答案</button>}<button disabled={busy || !draft.trim() || mode === 'FOCUS'} onClick={() => void send()} className="inline-flex items-center gap-1.5 rounded-card border border-border px-4 py-2 text-sm text-text-primary disabled:opacity-50 dark:border-border-dark dark:text-text-dark-primary">追问 <Send size={14} /></button></div></div></div>}
            {mode === 'FOCUS' && <p className="mt-2 text-sm text-text-muted">专注解题期间教练已静默，结束专注后继续学习。</p>}
          </div>
        </section>
      </div>
    </div>
  </main>
}
