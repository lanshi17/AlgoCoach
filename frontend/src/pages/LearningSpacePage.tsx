import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, Code2, LayoutDashboard, Map as MapIcon, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import { LOCAL_PRACTICE_PROBLEMS } from '@/services/localPractice'
import { buildModeLayout, dailyQuizForProblem, getWeekActivity, LEARNING_MODE_OPTIONS, readLearningSpaceLayout, type LearningBlockId, type LearningMode, type LearningSpaceLayout, writeLearningSpaceLayout } from '@/services/learningSpace'
import { BlockCard } from '@/components/Learning/BlockCard'
import { Badge } from '@/components/Common/Badge'
import PageHeader from '@/components/Common/PageHeader'
import Button from '@/components/Common/Button'
import { agentService } from '@/services/agentService'
import type { AgentProfile } from '@/types'
import { dueReviewEntries, rateReviewEntry, readReviewEntries, saveReviewEntry, type LocalReviewEntry } from '@/services/reviewQueue'
import { REVIEW_RATING_OPTIONS, type ReviewRating } from '@/services/deepTutorScheduler'
import { recommendLearningMode } from '@/services/modeRecommendation'
import { prepareReviewDiscussion, reviewUnavailableReason } from '@/services/reviewDiscussion'
import { createLearningTask, moveLearningTask, NEXT_TASK_STATUS, readLearningTasks, setLearningTaskArchived, TASK_STATUS_LABEL, type LearningTask, type LearningTaskKind, type LearningTaskStatus } from '@/services/learningTasks'

export default function LearningSpacePage() {
  const navigate = useNavigate()
  const { records, activeProblem, mode } = useAppStore(state => ({ records: state.localPracticeRecords, activeProblem: state.activeProblem, mode: state.mode }))
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [reviewEntries, setReviewEntries] = useState<LocalReviewEntry[]>(() => readReviewEntries())
  const [reviewNow, setReviewNow] = useState(() => Date.now())
  const [layout, setLayout] = useState<LearningSpaceLayout>(() => readLearningSpaceLayout())
  const [tasks, setTasks] = useState<LearningTask[]>(() => readLearningTasks())
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    let mounted = true
    void agentService.getProfile().then(next => { if (mounted) setProfile(next) }).catch(() => { /* use local ledger while services are offline */ })
    return () => { mounted = false }
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setReviewNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const topicCounts = useMemo(() => {
    const topics = Array.isArray(profile?.topics) ? profile.topics : []
    if (topics.length) return topics.slice().sort((a, b) => b.mastery - a.mastery).slice(0, 4).map(topic => [topic.topic, topic.attempts] as [string, number])
    const counts = new Map<string, number>()
    records.forEach(record => record.topics.forEach(topic => counts.set(topic, (counts.get(topic) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [profile, records])
  const nextProblem = activeProblem ?? LOCAL_PRACTICE_PROBLEMS[0]
  const pendingRecords = useMemo(() => records.filter(record => !reviewEntries.some(entry => entry.problemId === record.id)), [records, reviewEntries])
  const dueReviews = useMemo(() => dueReviewEntries(reviewEntries, new Date(reviewNow)), [reviewEntries, reviewNow])
  const weekActivity = useMemo(() => getWeekActivity(records, reviewEntries), [records, reviewEntries])
  const suggestion = useMemo(() => recommendLearningMode({ currentMode: layout.mode, profile, localAttempts: records.length }), [layout.mode, profile, records.length])

  const saveLayout = (next: LearningSpaceLayout) => {
    setLayout(next)
    writeLearningSpaceLayout(next)
  }

  const setMode = (nextMode: LearningMode) => saveLayout(buildModeLayout(nextMode))
  const removeBlock = (id: LearningBlockId) => saveLayout({ ...layout, blocks: layout.blocks.map(block => block.id === id ? { ...block, visible: false } : block) })
  const restoreBlocks = () => saveLayout({ ...layout, blocks: layout.blocks.map(block => ({ ...block, visible: true })) })
  const addTask = (task: { title: string; kind: LearningTaskKind; dueDate: string; problemId?: string }) => setTasks(createLearningTask(task))
  const visibleBlocks = layout.blocks.filter(block => block.visible)
  const taskDate = new Date().toISOString().slice(0, 10)

  return <main className="min-h-0 flex-1 overflow-y-auto bg-canvas px-6 py-7 dark:bg-[#0B0C0F]">
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="学习空间"
        icon={<LayoutDashboard size={20} />}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditing(value => !value)} aria-pressed={editing}>
            {editing ? <Check size={15} /> : <Plus size={15} />}
            {editing ? '完成整理' : '整理模块'}
          </Button>
        }
      />

      <section className="mb-3 rounded-panel bg-surface p-7 dark:bg-surface-dark">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-balance text-xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">今天，从一小段代码开始</h2>
            <p className="mt-2 text-sm leading-5 tracking-cn text-text-secondary dark:text-text-dark-secondary">先理解，再编码，最后让 Agent 根据你的过程安排下一次练习。</p>
          </div>
          <div className="grid w-full grid-cols-3 gap-0.5 rounded-full bg-surface-muted p-0.5 sm:flex sm:w-auto dark:bg-surface-dark-muted" role="tablist" aria-label="学习模式">
            {LEARNING_MODE_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={layout.mode === option.id}
                onClick={() => setMode(option.id)}
                className={`h-8 min-w-0 whitespace-nowrap rounded-full px-1.5 text-[13px] leading-5 tracking-cn transition-[background-color,color,font-weight] duration-150 sm:px-3 sm:text-sm
                  ${layout.mode === option.id
                    ? 'bg-surface font-medium text-accent dark:bg-surface-dark'
                    : 'text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 border-t border-border pt-4 text-xs leading-5 tracking-cn text-text-secondary dark:border-border-dark dark:text-text-dark-secondary">
          {LEARNING_MODE_OPTIONS.find(option => option.id === layout.mode)?.description}
        </p>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-5 py-4 dark:bg-surface-dark">
        <span className="text-sm text-text-secondary dark:text-text-dark-secondary">导入课程资料和笔记，让教练在相关问题中检索参考。</span>
        <button type="button" onClick={() => navigate('/knowledge/library')} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"><BookOpen size={16} />管理学习资料 <ArrowRight size={15} /></button>
      </div>
      {dueReviews.length > 0 && !visibleBlocks.some(block => block.id === 'review') && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/30 bg-surface px-4 py-3 text-sm dark:bg-surface-dark"><span className="text-text-secondary dark:text-text-dark-secondary">有 {dueReviews.length} 条笔记到期复习。</span><button type="button" onClick={() => saveLayout({ ...layout, blocks: layout.blocks.map(block => block.id === 'review' ? { ...block, visible: true } : block) })} className="font-medium text-accent hover:underline">查看到期复习</button></div>}
      {editing && <div className="mb-3 flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-sm dark:border-border-dark dark:bg-surface-dark"><span className="text-text-secondary dark:text-text-dark-secondary">隐藏的模块不会删除数据，可以随时恢复。</span><button type="button" onClick={restoreBlocks} className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"><RotateCcw size={14} />恢复全部模块</button></div>}
      {suggestion && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/30 bg-surface px-4 py-3 text-sm dark:bg-surface-dark"><span className="text-text-secondary dark:text-text-dark-secondary"><span className="font-medium text-text-primary dark:text-text-dark-primary">模式建议（基于练习记录）：</span>{suggestion.reason}</span><button type="button" onClick={() => saveLayout(buildModeLayout(suggestion.suggestedMode))} className="inline-flex h-8 items-center rounded-full bg-[#111317] px-3 text-xs font-medium tracking-cn text-white transition-opacity hover:opacity-90">切换模式</button></div>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visibleBlocks.map(block => <React.Fragment key={block.id}>{renderBlock(block.id, { navigate, records, pendingRecords, dueReviews, weekActivity, nextProblem, activeProblem, topicCounts, mode, editing, removeBlock, profile, onReviewSaved: setReviewEntries, tasks, onTaskCreate: addTask, onTaskMove: (taskId, status) => setTasks(moveLearningTask(taskId, status)), onTaskArchive: (taskId, archived) => setTasks(setLearningTaskArchived(taskId, archived)), taskDate })}</React.Fragment>)}
      </div>
      {!visibleBlocks.length && <section className="rounded-panel bg-surface p-10 text-center dark:bg-surface-dark"><p className="text-sm text-text-secondary dark:text-text-dark-secondary">学习空间是空的。</p><button type="button" onClick={restoreBlocks} className="mt-3 font-medium text-accent hover:underline">恢复默认模块</button></section>}
    </div>
  </main>
}

type RenderContext = {
  navigate: ReturnType<typeof useNavigate>
  records: ReturnType<typeof useAppStore.getState>['localPracticeRecords']
  pendingRecords: ReturnType<typeof useAppStore.getState>['localPracticeRecords']
  dueReviews: LocalReviewEntry[]
  weekActivity: ReturnType<typeof getWeekActivity>
  nextProblem: typeof LOCAL_PRACTICE_PROBLEMS[number]
  activeProblem: ReturnType<typeof useAppStore.getState>['activeProblem']
  topicCounts: Array<[string, number]>
  mode: ReturnType<typeof useAppStore.getState>['mode']
  editing: boolean
  removeBlock: (id: LearningBlockId) => void
  profile: AgentProfile | null
  onReviewSaved: (entries: LocalReviewEntry[]) => void
  tasks: LearningTask[]
  onTaskCreate: (task: { title: string; kind: LearningTaskKind; dueDate: string; problemId?: string }) => void
  onTaskMove: (taskId: string, status: LearningTaskStatus) => void
  onTaskArchive: (taskId: string, archived: boolean) => void
  taskDate: string
}

function renderBlock(id: LearningBlockId, context: RenderContext) {
  const { navigate, records, pendingRecords, dueReviews, weekActivity, nextProblem, activeProblem, topicCounts, mode, editing, removeBlock, profile, onReviewSaved, tasks, onTaskCreate, onTaskMove, onTaskArchive, taskDate } = context
  const remove = editing ? () => removeBlock(id) : undefined

  if (id === 'digest') return (
    <BlockCard id="digest" onRemove={remove} className="lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-3">
        <DigestItem icon={<Code2 size={17} />} label="最近练习" value={records[records.length - 1]?.title ?? profile?.recentProblems?.[0]?.problemId ?? '还没有练习'} />
        <DigestItem icon={<Clock3 size={17} />} label="专注时间" value={`${Math.round(records.reduce((sum, record) => sum + record.durationSec, 0) / 60)} 分钟`} />
        <DigestItem icon={<Check size={17} />} label="当前状态" value={mode === 'FOCUS' ? '正在专注' : mode === 'REVIEW' ? '等待复盘' : '准备开始'} />
      </div>
    </BlockCard>
  )

  if (id === 'continue') return (
    <BlockCard id="continue" onRemove={remove}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm tracking-cn text-text-secondary dark:text-text-dark-secondary">下一页练习</p>
          <h3 className="mt-2 truncate text-lg font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{nextProblem.titleCn ?? nextProblem.title}</h3>
          <p className="mt-2 text-sm tracking-cn text-text-secondary dark:text-text-dark-secondary">{nextProblem.topics.join(' · ')}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary">
          <Code2 size={19} />
        </span>
      </div>
      <div className="mt-auto pt-6">
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4 dark:border-border-dark">
          <Button variant="primary" onClick={() => {
            if (!useAppStore.getState().activeProblem) useAppStore.getState().setActiveProblem(nextProblem)
            navigate('/workspace', { state: { openPanel: 'problem' } })
          }}>
            打开编码练习 <ArrowRight size={16} />
          </Button>
          <Badge difficulty={nextProblem.difficulty} />
        </div>
      </div>
    </BlockCard>
  )

  if (id === 'quiz') return <DailyQuizBlock problem={nextProblem} onRemove={remove} />

  if (id === 'review') return <ReviewBlock records={pendingRecords} dueReviews={dueReviews} allRecords={records} activeProblem={activeProblem} mode={mode} onRate={(entry, rating) => onReviewSaved(rateReviewEntry(entry.problemId, rating))} onDiscussReview={(problemKey, title, note) => { if (prepareReviewDiscussion(problemKey, title, note)) navigate('/workspace', { state: { openPanel: 'chat' } }) }} onSave={(record, note) => onReviewSaved(saveReviewEntry(record.id, note, record))} onDiscuss={(note, record) => {
    if (prepareReviewDiscussion(record.problemId, record.title, note)) navigate('/workspace', { state: { openPanel: 'chat' } })
  }} onOpenProgress={() => navigate('/progress')} onRemove={remove} />

  if (id === 'knowledge') return (
    <BlockCard id="knowledge" onRemove={remove}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary">
          <MapIcon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm tracking-cn text-text-secondary dark:text-text-dark-secondary">近期反复出现</p>
          <p className="mt-1 truncate text-lg font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{topicCounts.length ? topicCounts.map(([topic]) => topic).join(' · ') : '从数组开始建立地图'}</p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {(topicCounts.length ? topicCounts : [['数组', 0], ['二分', 0]]).map(([topic, count]) => (
          <div key={topic} className="flex items-center gap-3 text-sm">
            <span className="w-16 shrink-0 text-text-secondary dark:text-text-dark-secondary">{topic}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted dark:bg-surface-dark-muted">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Number(count) / Math.max(1, ...topicCounts.map(([, value]) => value)) * 100}%` }} />
            </span>
            <span className="w-6 text-right font-mono text-xs tabular-nums text-text-secondary dark:text-text-dark-secondary">{count}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => navigate('/knowledge')} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
        打开知识图谱 <ArrowRight size={15} />
      </button>
    </BlockCard>
  )

  if (id === 'plan') return (
    <BlockCard id="plan" onRemove={remove}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary">
          <CalendarDays size={18} />
        </span>
        <div>
          <p className="text-sm tracking-cn text-text-secondary dark:text-text-dark-secondary">本周节奏</p>
          <p className="mt-1 text-lg font-semibold tracking-title text-text-primary dark:text-text-dark-primary">已练习 {weekActivity.practiceTotal} 页 · 已复盘 {weekActivity.reviewTotal} 次</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-2">
        {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => {
          const practiced = weekActivity.practice[index] > 0
          const reviewed = weekActivity.reviews[index] > 0
          return (
          <div key={day} className="text-center">
            <div aria-label={`周${day}：${practiced ? '有练习' : '无练习'}${reviewed ? '，有复盘' : ''}`} className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${practiced ? 'bg-accent text-white' : reviewed ? 'border border-accent text-accent' : 'bg-surface-muted text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary'}`}>
              {practiced ? <Check size={14} /> : reviewed ? <RotateCcw size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-line-300 dark:bg-border-dark" />}
            </div>
            <span className="mt-2 block text-[11px] text-text-secondary dark:text-text-dark-secondary">{day}</span>
          </div>
        )})}
      </div>
      <p className="mt-3 text-xs text-text-secondary dark:text-text-dark-secondary">实心标记练习，空心标记复盘</p>
      <div className="mt-5 border-t border-border pt-4 dark:border-border-dark">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">任务板 · {tasks.filter(task => !task.archived && task.status !== 'done').length} 未完成</p>
          <span className="text-[11px] text-text-muted dark:text-text-dark-muted">本地保存</span>
        </div>
        <div className="mt-3 space-y-2">
          {tasks.filter(task => !task.archived).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4).map(task => (
            <div key={task.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <button type="button" aria-label={`${task.title}：${TASK_STATUS_LABEL[task.status]}，切换为${TASK_STATUS_LABEL[NEXT_TASK_STATUS[task.status]]}`} onClick={() => onTaskMove(task.id, NEXT_TASK_STATUS[task.status])} className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary hover:bg-surface-muted dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">{TASK_STATUS_LABEL[task.status]}</button>
              <span className={`min-w-0 flex-1 truncate ${task.status === 'done' ? 'text-text-muted line-through dark:text-text-dark-muted' : 'text-text-secondary dark:text-text-dark-secondary'}`}>{task.title}</span>
              <span className="shrink-0 text-[10px] text-text-muted dark:text-text-dark-muted">{task.dueDate}</span>
              {task.status === 'done' && <button type="button" onClick={() => onTaskArchive(task.id, true)} className="shrink-0 text-[11px] font-medium text-accent hover:underline">归档</button>}
            </div>
          ))}
          {!tasks.some(task => !task.archived) && <p className="text-xs text-text-muted dark:text-text-dark-muted">还没有任务。把下一页练习或到期复盘加入计划。</p>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onTaskCreate({ title: `练习：${nextProblem.titleCn ?? nextProblem.title}`, kind: 'practice', dueDate: taskDate, problemId: `${nextProblem.platform}:${nextProblem.platformId}` })} className="text-xs font-medium text-accent hover:underline">+ 安排下一页练习</button>
          {dueReviews[0] && <button type="button" onClick={() => onTaskCreate({ title: `复盘：${dueReviews[0].title ?? '到期笔记'}`, kind: 'review', dueDate: taskDate, problemId: dueReviews[0].problemKey })} className="text-xs font-medium text-accent hover:underline">+ 安排到期复盘</button>}
        </div>
        {tasks.some(task => task.archived) && <details className="mt-3 text-xs text-text-secondary dark:text-text-dark-secondary">
          <summary className="cursor-pointer">已归档 · {tasks.filter(task => task.archived).length}</summary>
          <div className="mt-2 space-y-2">{tasks.filter(task => task.archived).map(task => <div key={task.id} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{task.title}</span><button type="button" onClick={() => onTaskArchive(task.id, false)} className="shrink-0 font-medium text-accent hover:underline">恢复</button></div>)}</div>
        </details>}
      </div>
    </BlockCard>
  )

  return (
    <BlockCard id="insight" onRemove={remove}>
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary">
          <Sparkles size={18} />
        </span>
        <div>
          <p className="text-sm leading-6 tracking-cn text-text-secondary dark:text-text-dark-secondary">{records.length ? `你已经留下 ${records.length} 页练习。下一次可以在 ${topicCounts[0]?.[0] ?? '数组'} 上做一次不看提示的完整推导，再把复杂度写进复盘。` : '先打开一页本地练习。写代码之前，先用一句话写清楚输入、输出和约束，Agent 会在复盘时沿着这条线检查。'}</p>
          <button type="button" onClick={() => navigate('/workspace', { state: { openPanel: 'chat' } })} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            和算法 Agent 讨论 <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </BlockCard>
  )
}

function DigestItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-4 last:border-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4 dark:border-border-dark">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs tracking-cn text-text-secondary dark:text-text-dark-secondary">{label}</p>
        <p className="mt-1 truncate text-sm font-medium tracking-cn text-text-primary dark:text-text-dark-primary">{value}</p>
      </div>
    </div>
  )
}

function ReviewBlock({ records, dueReviews, allRecords, activeProblem, mode, onSave, onDiscuss, onRate, onDiscussReview, onOpenProgress, onRemove }: {
  records: ReturnType<typeof useAppStore.getState>['localPracticeRecords']
  dueReviews: LocalReviewEntry[]
  allRecords: ReturnType<typeof useAppStore.getState>['localPracticeRecords']
  activeProblem: ReturnType<typeof useAppStore.getState>['activeProblem']
  mode: ReturnType<typeof useAppStore.getState>['mode']
  onRate: (entry: LocalReviewEntry, rating: ReviewRating) => void
  onDiscussReview: (problemKey: string | undefined, title: string, note: string) => void
  onSave: (record: ReturnType<typeof useAppStore.getState>['localPracticeRecords'][number], note: string) => void
  onDiscuss: (note: string, record: ReturnType<typeof useAppStore.getState>['localPracticeRecords'][number]) => void
  onOpenProgress: () => void
  onRemove?: () => void
}) {
  const current = records[records.length - 1]
  const [note, setNote] = useState('')
  const [saveError, setSaveError] = useState('')
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const due = dueReviews[0]
  const original = due && allRecords.find(record => record.id === due.problemId)
  const dueTitle = due?.title ?? original?.title ?? '原练习记录已过期'
  const dueProblemKey = due?.problemKey ?? original?.problemId
  const dueReason = due ? reviewUnavailableReason(dueProblemKey, activeProblem, mode) : ''
  const unavailableReason = current ? reviewUnavailableReason(current.problemId, activeProblem, mode) : ''
  return <BlockCard id="review" onRemove={onRemove}>
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary"><RotateCcw size={18} /></span>
      <div><p className="text-2xl font-semibold tracking-num text-text-primary dark:text-text-dark-primary">{records.length}</p><p className="text-sm tracking-cn text-text-secondary dark:text-text-dark-secondary">待复盘练习页</p></div>
    </div>
    {current ? <>
      <p className="mt-5 text-sm font-medium tracking-cn text-text-primary dark:text-text-dark-primary">{current.title}</p>
      <p className="mt-1 text-xs tracking-cn text-text-secondary dark:text-text-dark-secondary">{current.topics.join(' · ') || '自由练习'} · {current.codeLength} 字符</p>
      <textarea value={note} onChange={event => setNote(event.target.value)} rows={3} placeholder="写下思路、复杂度和一个边界条件" className="mt-4 w-full resize-none rounded-card border border-border bg-surface px-3 py-2 text-sm tracking-cn text-text-primary outline-none transition-colors focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-primary" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><button type="button" disabled={!note.trim()} onClick={() => { try { onSave(current, note); setNote(''); setSaveError('') } catch { setSaveError('保存失败，请检查本地存储空间。') } }} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#111317] px-4 text-sm font-medium tracking-cn text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">保存复盘 <Check size={15} /></button><button type="button" disabled={!note.trim() || !!unavailableReason} onClick={() => onDiscuss(note, current)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium tracking-cn text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">问 Agent <Sparkles size={14} /></button></div><span className="text-xs text-text-secondary dark:text-text-dark-secondary">保存后移出队列</span></div>
      {saveError && <p role="alert" className="mt-2 text-xs text-danger">{saveError}</p>}
      {unavailableReason && <p className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">{unavailableReason}</p>}
    </> : <p className="mt-5 text-sm leading-5 tracking-cn text-text-secondary dark:text-text-dark-secondary">每次结束专注都会留下记录。你可以填写复盘笔记，并在需要时主动发给教练。</p>}
    <div className="mt-5 border-t border-border pt-4 dark:border-border-dark">
      <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">到期复习 · {dueReviews.length}</p>
      {due ? <>
        <p className="mt-2 text-sm text-text-secondary dark:text-text-dark-secondary">{dueTitle}：先尝试回忆思路，再查看笔记。</p>
        {revealedId === due.problemId ? <>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text-primary dark:text-text-dark-primary">{due.note}</p>
          <p className="mt-3 text-xs text-text-secondary dark:text-text-dark-secondary">刚才回忆得怎么样？根据你的自评安排下次复习。</p>
          <div className="mt-2 flex flex-wrap gap-2">{REVIEW_RATING_OPTIONS.map(({ value, label }) => <button key={value} type="button" onClick={() => { try { onRate(due, value); setRevealedId(null); setSaveError('') } catch { setSaveError('复习记录保存失败，请检查本地存储空间。') } }} className="rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-muted dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">{label}</button>)}</div>
          <button type="button" disabled={!!dueReason} onClick={() => onDiscussReview(dueProblemKey, dueTitle, due.note)} className="mt-3 text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-40">带笔记问 Agent</button>
          {dueReason && <p className="mt-1 text-xs text-text-secondary dark:text-text-dark-secondary">{dueReason}</p>}
        </> : <button type="button" onClick={() => setRevealedId(due.problemId)} className="mt-3 text-sm font-medium text-accent hover:underline">显示笔记</button>}
      </> : <p className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">暂无到期笔记。保存复盘后，首次复习安排在一天后。</p>}
      {saveError && !current && <p role="alert" className="mt-2 text-xs text-danger">{saveError}</p>}
    </div>
    <button type="button" onClick={onOpenProgress} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">查看训练记录 <ArrowRight size={15} /></button>
  </BlockCard>
}

function DailyQuizBlock({ problem, onRemove }: { problem: typeof LOCAL_PRACTICE_PROBLEMS[number]; onRemove?: () => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  const quiz = dailyQuizForProblem(problem)
  return (
    <BlockCard id="quiz" onRemove={onRemove}>
      <p className="text-sm leading-5 tracking-cn text-text-secondary dark:text-text-dark-secondary">{quiz.question}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {quiz.options.map((option, index) => {
          const chosen = selected === index
          const correct = index === quiz.answer
          return <button key={option} type="button" aria-pressed={chosen} onClick={() => setSelected(index)} className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 text-left text-sm tracking-cn transition-[background-color,border-color,color] duration-150 ${selected === null ? 'border-border text-text-secondary hover:bg-surface-muted dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted' : chosen ? correct ? 'border-success bg-surface-muted text-success dark:bg-surface-dark-muted' : 'border-danger text-danger' : 'border-border text-text-secondary dark:border-border-dark dark:text-text-dark-secondary'}`}><span>{option}</span>{chosen && (correct ? <Check size={16} className="shrink-0" /> : <X size={16} className="shrink-0" />)}</button>
        })}
      </div>
      {selected !== null && <p role="status" className="mt-4 text-sm leading-5 tracking-cn text-text-secondary dark:text-text-dark-secondary">{selected === quiz.answer ? quiz.explanation : quiz.retry}</p>}
    </BlockCard>
  )
}
