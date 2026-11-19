import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, BarChart3, BookOpen, Clock3, Loader2, RefreshCw, Route } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { agentService } from '@/services/agentService'
import Button from '@/components/Common/Button'
import PageHeader from '@/components/Common/PageHeader'
import Segmented from '@/components/Common/Segmented'
import { makeGraph } from './graphLayout'
import type { AgentProfile, MasteryPath } from '@/types'

export default function KnowledgeGraphPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [masteryPath, setMasteryPath] = useState<MasteryPath | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [listView, setListView] = useState(false)
  const [draggingTopic, setDraggingTopic] = useState<string | null>(null)
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const svgRef = useRef<SVGSVGElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSeq = useRef(0)

  const load = async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    try {
      const next = await agentService.getProfile()
      if (seq !== requestSeq.current) return
      setProfile(next)
      setSelectedTopic(current => current && next.topics.some(topic => topic.topic === current)
        ? current
        : next.topics[0]?.topic ?? null)
      // The graph remains useful if an older/offline Agent does not expose the
      // path endpoint yet; path failures are intentionally non-blocking.
      const nextPath = await agentService.getMasteryPath().catch(() => null)
      if (seq !== requestSeq.current) return
      setMasteryPath(nextPath)
    } catch {
      if (seq !== requestSeq.current) return
      setError('无法读取本地知识点记录，请确认 Agent 服务正在运行。')
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    return () => { requestSeq.current += 1 }
  }, [])

  const graph = useMemo(() => makeGraph(profile?.topics ?? [], profile?.edges ?? []), [profile?.topics, profile?.edges])
  const positions = useMemo(() => new Map(graph.nodes.map(node => [
    node.topic,
    positionOverrides[node.topic] ?? { x: node.x, y: node.y },
  ])), [graph.nodes, positionOverrides])
  const selected = profile?.topics.find(topic => topic.topic === selectedTopic)

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-canvas px-6 py-7 dark:bg-[#0B0C0F]">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="知识图谱"
          icon={<BarChart3 size={18} />}
          actions={<>
            <Button size="sm" onClick={() => navigate('/knowledge/library')}><BookOpen size={14} />知识库</Button>
            <Segmented
              label="视图"
              value={listView ? 'list' : 'graph'}
              options={[{ value: 'graph', label: '图谱' }, { value: 'list', label: '列表' }] as const}
              onChange={value => setListView(value === 'list')}
            />
            <Button size="sm" onClick={() => void load()} disabled={loading} aria-busy={loading} aria-label="刷新知识图谱">
              <RefreshCw size={14} />刷新
            </Button>
          </>}
        />

        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !profile?.topics.length ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-panel border border-border bg-surface text-center dark:border-border-dark dark:bg-surface-dark">
            <BarChart3 size={28} className="text-text-muted dark:text-text-dark-muted" />
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary">完成并提交题目后，掌握度图谱会从真实训练记录中逐步生成。</p>
          </div>
        ) : (
          <>
            {masteryPath && <MasteryPathCard path={masteryPath} onOpenCoach={() => navigate('/workspace', { state: { openPanel: 'chat' } })} />}
            {listView ? (
              <div className="overflow-hidden rounded-card border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
            <div className="grid grid-cols-[minmax(0,1fr)_50px_32px] gap-2 border-b border-border bg-surface-soft px-2 py-3 text-xs text-text-muted dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-muted sm:grid-cols-[1fr_100px_90px] sm:gap-3 sm:px-4">
              <span className="whitespace-nowrap">知识点</span><span className="whitespace-nowrap">掌握度</span>
              <span className="whitespace-nowrap"><span className="sm:hidden">次数</span><span className="hidden sm:inline">训练次数</span></span>
            </div>
            {profile.topics.map(topic => <button key={topic.topic} onClick={() => setSelectedTopic(topic.topic)}
              type="button"
              aria-pressed={selectedTopic === topic.topic}
              className={`grid w-full grid-cols-[minmax(0,1fr)_50px_32px] gap-2 px-2 py-3 text-left text-xs hover:bg-surface-soft dark:hover:bg-surface-dark-soft sm:grid-cols-[1fr_100px_90px] sm:gap-3 sm:px-4 ${
                selectedTopic === topic.topic ? 'bg-accent/5' : ''
              }`}>
              <span className="min-w-0 truncate text-text-primary dark:text-text-dark-primary">{topic.topic}</span>
              <span className="text-text-secondary dark:text-text-dark-secondary">{Math.round(topic.mastery * 100)}%</span>
              <span className="text-text-secondary dark:text-text-dark-secondary">{topic.attempts}</span>
            </button>)}
              </div>
            ) : (
              <div className="space-y-5">
            <div className="overflow-auto rounded-panel border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <svg ref={svgRef} viewBox={`0 0 ${graph.width} ${graph.height}`} role="group"
                onPointerMove={event => {
                  if (!draggingTopic || !svgRef.current) return
                  const bounds = svgRef.current.getBoundingClientRect()
                  if (!bounds.width || !bounds.height) return
                  setPositionOverrides(current => ({
                    ...current,
                    [draggingTopic]: {
                      x: (event.clientX - bounds.left) / bounds.width * graph.width,
                      y: (event.clientY - bounds.top) / bounds.height * graph.height,
                    },
                  }))
                }}
                onPointerUp={event => {
                  if (draggingTopic) {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                    setDraggingTopic(null)
                  }
                }}
                onPointerCancel={() => setDraggingTopic(null)}
                aria-label="算法知识点掌握度关系图" className="mx-auto min-w-[520px] max-w-full">
                {profile.edges.map(edge => {
                  const from = positions.get(edge.from)
                  const to = positions.get(edge.to)
                  if (!from || !to) return null
                  return <g key={`${edge.from}-${edge.to}`}>
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      className="stroke-line-300 dark:stroke-border-dark"
                      strokeOpacity="0.9" strokeWidth={Math.min(4, 1 + Math.log2(edge.weight))} />
                    {edge.weight > 1 && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}
                      textAnchor="middle" fontSize="10" className="fill-text-secondary dark:fill-text-dark-secondary">{edge.weight}</text>}
                  </g>
                })}
                {graph.nodes.map(node => <g key={node.topic} role="button" tabIndex={0}
                  aria-pressed={selectedTopic === node.topic}
                  aria-label={`${node.topic}，掌握度 ${Math.round(node.mastery * 100)}%，训练 ${node.attempts} 次`}
                  onPointerDown={event => {
                    event.preventDefault()
                    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
                    setDraggingTopic(node.topic)
                  }}
                  onClick={() => setSelectedTopic(node.topic)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedTopic(node.topic)
                    }
                  }}
                  className="graph-node cursor-grab active:cursor-grabbing">
                  <circle cx={positions.get(node.topic)?.x ?? node.x} cy={positions.get(node.topic)?.y ?? node.y} r={node.radius}
                    className="fill-surface-muted dark:fill-surface-dark-muted" />
                  <circle cx={positions.get(node.topic)?.x ?? node.x} cy={positions.get(node.topic)?.y ?? node.y} r={node.radius}
                    style={{ fill: `rgb(var(--accent-rgb) / ${0.05 + node.mastery * 0.13})` }} pointerEvents="none" />
                  <circle cx={positions.get(node.topic)?.x ?? node.x} cy={positions.get(node.topic)?.y ?? node.y} r={node.radius}
                    className={selectedTopic === node.topic ? 'stroke-accent' : 'stroke-line-300 dark:stroke-border-dark'}
                    fill="none" strokeWidth={selectedTopic === node.topic ? 3 : 1.5} />
                  <text x={positions.get(node.topic)?.x ?? node.x} y={(positions.get(node.topic)?.y ?? node.y) + 4}
                    textAnchor="middle" fontSize="12" fontWeight="600"
                    className="fill-text-primary dark:fill-text-dark-primary" pointerEvents="none">
                    {shortLabel(node.topic)}
                  </text>
                </g>)}
              </svg>
              <p className="mt-2 text-center text-xs text-text-secondary dark:text-text-dark-secondary">节点按共同训练知识点自动排布；可拖动整理视图。</p>
              <p className="mt-1 text-center text-[11px] text-text-secondary dark:text-text-dark-secondary sm:hidden">
                窄屏可左右滑动查看完整图谱。
              </p>
              {!profile.edges.length && <p className="mt-2 text-center text-xs text-text-secondary dark:text-text-dark-secondary">
                暂无共同训练记录形成连线；图中只显示已记录的知识点。
              </p>}
            </div>

            {selected && <section className="rounded-card border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">{selected.topic}</h2>
                <span className="text-xs text-text-muted dark:text-text-dark-muted">
                  {Math.round(selected.mastery * 100)}% 掌握 · {selected.attempts} 次训练
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded bg-surface-muted dark:bg-surface-dark-muted">
                <div className="h-full rounded bg-accent" style={{ width: `${Math.round(selected.mastery * 100)}%` }} />
              </div>
              {selected.weakSubtopics.length > 0 && <p className="mt-3 text-xs text-text-secondary dark:text-text-dark-secondary">
                待加强：{selected.weakSubtopics.join('、')}
              </p>}
              {selected.relatedTopics.length > 0 && <p className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">
                相关知识点：{selected.relatedTopics.join('、')}
              </p>}
              <p className="mt-2 text-[11px] text-text-muted dark:text-text-dark-muted">
                最近记录：{selected.lastSeen ? new Date(selected.lastSeen).toLocaleDateString() : '暂无'}
              </p>
            </section>}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function MasteryPathCard({ path, onOpenCoach }: { path: MasteryPath; onOpenCoach: () => void }) {
  const actionLabel: Record<MasteryPath['steps'][number]['recommendedAction'], string> = {
    review: '到期复习', reinforce: '强化基础', practice: '变式练习', apply: '综合应用',
  }

  return <section className="mb-5 rounded-panel border border-accent/30 bg-surface p-5 dark:bg-surface-dark">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Route size={19} /></span>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">Mastery Path</p>
          <h2 className="mt-1 text-base font-semibold text-text-primary dark:text-text-dark-primary">下一步学习路径</h2>
          <p className="mt-1 text-xs text-text-secondary dark:text-text-dark-secondary">按到期复习与当前掌握度排序，每一步都说明为什么现在做。</p>
        </div>
      </div>
      <button type="button" onClick={onOpenCoach} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">让导师带我走 <ArrowRight size={14} /></button>
    </div>
    {path.steps.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">
      {path.steps.slice(0, 6).map(step => <div key={`${step.position}-${step.topic}`} className="rounded-card border border-border bg-surface-soft p-3 dark:border-border-dark dark:bg-surface-dark-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{step.position}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-text-primary dark:text-text-dark-primary">{step.topic}</h3>
              <span className="text-xs text-text-secondary dark:text-text-dark-secondary">{Math.round(step.mastery * 100)}% · {actionLabel[step.recommendedAction]}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-text-secondary dark:text-text-dark-secondary">{step.reason}</p>
            {step.dueReviews.length > 0 && <p className="mt-2 flex items-center gap-1 text-[11px] text-accent"><Clock3 size={12} /> {step.dueReviews.length} 个复习题到期</p>}
          </div>
        </div>
      </div>)}
    </div> : <p className="mt-4 rounded-card bg-surface-soft px-3 py-3 text-xs text-text-secondary dark:bg-surface-dark-soft dark:text-text-dark-secondary">{path.emptyReason ?? '完成一次练习后，这里会出现可执行的学习路径。'}</p>}
  </section>
}

function shortLabel(value: string): string {
  return value.length > 8 ? `${value.slice(0, 7)}…` : value
}

function Loading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-64 items-center justify-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
    <Loader2 size={16} className="animate-spin" /> 正在读取知识点…
  </div>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
    <AlertCircle size={24} className="text-danger" />
    <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{message}</p>
    <button type="button" onClick={onRetry} aria-label="重试读取知识图谱" className="text-sm text-accent hover:underline">重试</button>
  </div>
}
