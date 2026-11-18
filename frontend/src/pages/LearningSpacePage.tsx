import React, { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, Code2, LayoutDashboard, Map as MapIcon, Plus, RotateCcw, Sparkles, Target, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import { LOCAL_PRACTICE_PROBLEMS } from '@/services/localPractice'
import { buildModeLayout, LEARNING_MODE_OPTIONS, readLearningSpaceLayout, type LearningBlockId, type LearningMode, type LearningSpaceLayout, writeLearningSpaceLayout } from '@/services/learningSpace'
import { BlockCard } from '@/components/Learning/BlockCard'
import PageHeader from '@/components/Common/PageHeader'
import Button from '@/components/Common/Button'

export default function LearningSpacePage() {
  const navigate = useNavigate()
  const { records, activeProblem, mode } = useAppStore(state => ({ records: state.localPracticeRecords, activeProblem: state.activeProblem, mode: state.mode }))
  const [layout, setLayout] = useState<LearningSpaceLayout>(() => readLearningSpaceLayout())
  const [editing, setEditing] = useState(false)
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>()
    records.forEach(record => record.topics.forEach(topic => counts.set(topic, (counts.get(topic) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [records])
  const totalMinutes = Math.round(records.reduce((sum, record) => sum + record.durationSec, 0) / 60)
  const activeDays = new Set(records.map(record => record.endedAt.slice(0, 10))).size
  const nextProblem = activeProblem ?? LOCAL_PRACTICE_PROBLEMS[0]

  const saveLayout = (next: LearningSpaceLayout) => {
    setLayout(next)
    writeLearningSpaceLayout(next)
  }

  const setMode = (nextMode: LearningMode) => saveLayout(buildModeLayout(nextMode))
  const removeBlock = (id: LearningBlockId) => saveLayout({ ...layout, blocks: layout.blocks.map(block => block.id === id ? { ...block, visible: false } : block) })
  const restoreBlocks = () => saveLayout({ ...layout, blocks: layout.blocks.map(block => ({ ...block, visible: true })) })
  const visibleBlocks = layout.blocks.filter(block => block.visible)

  return <main className="min-h-0 flex-1 overflow-y-auto bg-canvas px-6 py-7 dark:bg-[#0B0C0F]">
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="学习空间" icon={<LayoutDashboard size={20} />} actions={<Button size="sm" variant="secondary" onClick={() => setEditing(value => !value)}><Plus size={15} />{editing ? '完成整理' : '整理模块'}</Button>} />

      <section className="mb-3 rounded-panel bg-surface p-7 dark:bg-surface-dark">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-2xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">今天，从一小段代码开始</h1>
            <p className="mt-2 text-sm leading-5 tracking-cn text-text-secondary dark:text-text-dark-secondary">OpenTutor 的自适应流程被改写成算法训练：先理解，再编码，最后让 Agent 根据你的过程安排下一次练习。</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-surface-muted p-1 dark:bg-surface-dark-muted" role="tablist" aria-label="学习模式">
            {LEARNING_MODE_OPTIONS.map(option => <button key={option.id} type="button" role="tab" aria-selected={layout.mode === option.id} onClick={() => setMode(option.id)} className={`rounded-full px-3 py-2 text-sm tracking-cn transition-[background-color,color,font-weight] duration-150 ${layout.mode === option.id ? 'bg-surface font-medium text-accent dark:bg-surface-dark' : 'text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary'}`}>{option.label}</button>)}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-sm text-text-secondary dark:border-border-dark dark:text-text-dark-secondary">
          <span className="inline-flex items-center gap-2"><Clock3 size={15} className="text-accent" />{totalMinutes} 分钟专注</span>
          <span className="inline-flex items-center gap-2"><Trophy size={15} className="text-accent" />{records.length} 页练习</span>
          <span className="inline-flex items-center gap-2"><Target size={15} className="text-accent" />{activeDays} 个练习日</span>
          <span className="ml-auto hidden text-xs text-text-muted dark:text-text-dark-muted lg:inline">{LEARNING_MODE_OPTIONS.find(option => option.id === layout.mode)?.description}</span>
        </div>
      </section>

      {editing && <div className="mb-3 flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-sm dark:border-border-dark dark:bg-surface-dark"><span className="text-text-secondary dark:text-text-dark-secondary">隐藏的模块不会删除数据，可以随时恢复。</span><button type="button" onClick={restoreBlocks} className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"><RotateCcw size={14} />恢复全部模块</button></div>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visibleBlocks.map(block => <React.Fragment key={block.id}>{renderBlock(block.id, { navigate, records, nextProblem, topicCounts, mode, editing, removeBlock, activeProblem, layout })}</React.Fragment>)}
      </div>
      {!visibleBlocks.length && <section className="rounded-panel bg-surface p-10 text-center dark:bg-surface-dark"><p className="text-sm text-text-secondary dark:text-text-dark-secondary">学习空间是空的。</p><button type="button" onClick={restoreBlocks} className="mt-3 font-medium text-accent hover:underline">恢复默认模块</button></section>}
    </div>
  </main>
}

type RenderContext = {
  navigate: ReturnType<typeof useNavigate>
  records: ReturnType<typeof useAppStore.getState>['localPracticeRecords']
  nextProblem: typeof LOCAL_PRACTICE_PROBLEMS[number]
  topicCounts: Array<[string, number]>
  mode: ReturnType<typeof useAppStore.getState>['mode']
  editing: boolean
  removeBlock: (id: LearningBlockId) => void
  activeProblem: ReturnType<typeof useAppStore.getState>['activeProblem']
  layout: LearningSpaceLayout
}

function renderBlock(id: LearningBlockId, context: RenderContext) {
  const { navigate, records, nextProblem, topicCounts, mode, editing, removeBlock } = context
  const remove = editing ? () => removeBlock(id) : undefined
  if (id === 'digest') return <BlockCard id="digest" onRemove={remove} className="lg:col-span-2"><div className="grid gap-4 sm:grid-cols-3"><DigestItem icon={<Code2 size={17} />} label="最近练习" value={records[records.length - 1]?.title ?? '还没有练习'} /><DigestItem icon={<Clock3 size={17} />} label="专注时间" value={`${Math.round(records.reduce((sum, record) => sum + record.durationSec, 0) / 60)} 分钟`} /><DigestItem icon={<Check size={17} />} label="当前状态" value={mode === 'FOCUS' ? '正在专注' : mode === 'REVIEW' ? '等待复盘' : '准备开始'} /></div></BlockCard>
  if (id === 'continue') return <BlockCard id="continue" onRemove={remove}><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-text-muted dark:text-text-dark-muted">下一页练习</p><h3 className="mt-2 text-lg font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{nextProblem.titleCn ?? nextProblem.title}</h3><p className="mt-2 text-sm tracking-cn text-text-secondary dark:text-text-dark-secondary">{nextProblem.topics.join(' · ')}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-accent dark:bg-surface-dark-muted"><Code2 size={19} /></span></div><button type="button" onClick={() => navigate('/workspace', { state: { openPanel: 'problem' } })} className="mt-6 inline-flex h-9 items-center gap-2 rounded-full bg-[#111317] px-[18px] text-sm font-medium tracking-cn text-white transition-opacity hover:opacity-90">打开编码练习 <ArrowRight size={16} /></button></BlockCard>
  if (id === 'review') return <BlockCard id="review" onRemove={remove}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-accent dark:bg-surface-dark-muted"><RotateCcw size={18} /></span><div><p className="text-2xl font-semibold tracking-num text-text-primary dark:text-text-dark-primary">{Math.max(0, Math.min(9, records.length))}</p><p className="text-sm tracking-cn text-text-secondary dark:text-text-dark-secondary">待复盘练习页</p></div></div><p className="mt-5 text-sm leading-5 tracking-cn text-text-secondary dark:text-text-dark-secondary">每次结束专注都会留下记录。提交题目后，算法 Agent 会把判题结果、边界和复杂度整理成下一轮复盘。</p><button type="button" onClick={() => navigate('/progress')} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">查看训练记录 <ArrowRight size={15} /></button></BlockCard>
  if (id === 'knowledge') return <BlockCard id="knowledge" onRemove={remove}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-accent dark:bg-surface-dark-muted"><MapIcon size={18} /></span><div><p className="text-sm text-text-muted dark:text-text-dark-muted">近期反复出现</p><p className="mt-1 text-lg font-semibold tracking-title text-text-primary dark:text-text-dark-primary">{topicCounts.length ? topicCounts.map(([topic]) => topic).join(' · ') : '从数组开始建立地图'}</p></div></div><div className="mt-6 space-y-3">{(topicCounts.length ? topicCounts : [['数组', 0], ['二分', 0]]).map(([topic, count]) => <div key={topic} className="flex items-center gap-3 text-sm"><span className="w-16 shrink-0 text-text-secondary dark:text-text-dark-secondary">{topic}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted dark:bg-surface-dark-muted"><span className="block h-full rounded-full bg-accent" style={{ width: `${Number(count) ? Math.min(100, Number(count) * 30 + 20) : 8}%` }} /></span><span className="w-6 text-right font-mono text-xs tabular-nums text-text-muted">{count}</span></div>)}</div><button type="button" onClick={() => navigate('/knowledge')} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">打开知识图谱 <ArrowRight size={15} /></button></BlockCard>
  if (id === 'plan') return <BlockCard id="plan" onRemove={remove}><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-accent dark:bg-surface-dark-muted"><CalendarDays size={18} /></span><div><p className="text-sm text-text-muted dark:text-text-dark-muted">本周节奏</p><p className="mt-1 text-lg font-semibold tracking-title text-text-primary dark:text-text-dark-primary">写 3 页，复盘 1 次</p></div></div><div className="mt-6 grid grid-cols-7 gap-2">{['一', '二', '三', '四', '五', '六', '日'].map((day, index) => <div key={day} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${index < Math.min(records.length, 3) ? 'bg-accent text-white' : 'bg-surface-muted text-text-muted dark:bg-surface-dark-muted'}`}>{index < Math.min(records.length, 3) ? <Check size={14} /> : day}</div><span className="mt-2 block text-[11px] text-text-muted">{day}</span></div>)}</div></BlockCard>
  return <BlockCard id="insight" onRemove={remove} className="lg:col-span-2"><div className="flex items-start gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-accent dark:bg-surface-dark-muted"><Sparkles size={18} /></span><div><p className="text-sm leading-6 tracking-cn text-text-secondary dark:text-text-dark-secondary">{records.length ? `你已经留下 ${records.length} 页练习。下一次可以在 ${topicCounts[0]?.[0] ?? '数组'} 上做一次不看提示的完整推导，再把复杂度写进复盘。` : '先打开一页本地练习。写代码之前，先用一句话写清楚输入、输出和约束，Agent 会在复盘时沿着这条线检查。'}</p><button type="button" onClick={() => navigate('/workspace', { state: { openPanel: 'chat' } })} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">和算法 Agent 讨论 <ArrowRight size={15} /></button></div></div></BlockCard>
}

function DigestItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 border-b border-border pb-4 dark:border-border-dark sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4 last:border-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-accent dark:bg-surface-dark-muted">{icon}</span><div className="min-w-0"><p className="text-xs tracking-cn text-text-muted">{label}</p><p className="mt-1 truncate text-sm font-medium tracking-cn text-text-primary dark:text-text-dark-primary">{value}</p></div></div>
}
