import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BarChart3, Loader2, RefreshCw } from 'lucide-react'
import { agentService } from '@/services/agentService'
import Button from '@/components/Common/Button'
import PageHeader from '@/components/Common/PageHeader'
import { makeGraph } from './graphLayout'
import type { AgentProfile } from '@/types'

export default function KnowledgeGraphPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null)
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
    <main className="flex-1 min-h-0 overflow-y-auto bg-surface px-6 py-7 dark:bg-surface-dark">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="知识图谱"
          icon={<BarChart3 size={18} />}
          actions={<>
            <Button size="sm" onClick={() => setListView(value => !value)} aria-pressed={listView}
              aria-label={listView ? '切换到图谱视图' : '切换到列表视图'}>
              {listView ? '图谱视图' : '列表视图'}
            </Button>
            <Button size="sm" onClick={() => void load()} disabled={loading} aria-busy={loading} aria-label="刷新知识图谱">
              <RefreshCw size={14} />刷新
            </Button>
          </>}
        />

        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !profile?.topics.length ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-border text-center dark:border-border-dark">
            <BarChart3 size={28} className="text-text-muted dark:text-text-dark-muted" />
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary">完成并提交题目后，掌握度图谱会从真实训练记录中逐步生成。</p>
          </div>
        ) : listView ? (
          <div className="overflow-hidden rounded-lg border border-border dark:border-border-dark">
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
            <div className="overflow-auto rounded-lg border border-border p-4 dark:border-border-dark">
              <svg ref={svgRef} viewBox={`0 0 ${graph.width} ${graph.height}`} role="img"
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
                      stroke="#9b927e" strokeOpacity="0.45" strokeWidth={Math.min(5, 1 + Math.log2(edge.weight))} />
                    {edge.weight > 1 && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}
                      textAnchor="middle" fontSize="10" fill="#776f62">{edge.weight}</text>}
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
                  className="cursor-grab active:cursor-grabbing">
                  <circle cx={positions.get(node.topic)?.x ?? node.x} cy={positions.get(node.topic)?.y ?? node.y} r={node.radius}
                    fill={masteryColor(node.mastery)} stroke={selectedTopic === node.topic ? '#725e42' : '#f4efe3'}
                    strokeWidth={selectedTopic === node.topic ? 3 : 2} />
                  <text x={positions.get(node.topic)?.x ?? node.x} y={(positions.get(node.topic)?.y ?? node.y) + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#332f27" pointerEvents="none">
                    {shortLabel(node.topic)}
                  </text>
                </g>)}
              </svg>
              <p className="mt-2 text-center text-xs text-text-muted dark:text-text-dark-muted">节点按共同训练知识点自动排布；可拖动整理视图。</p>
              <p className="mt-1 text-center text-[11px] text-text-muted dark:text-text-dark-muted sm:hidden">
                窄屏可左右滑动查看完整图谱。
              </p>
              {!profile.edges.length && <p className="mt-2 text-center text-xs text-text-muted dark:text-text-dark-muted">
                暂无共同训练记录形成连线；图中只显示已记录的知识点。
              </p>}
            </div>

            {selected && <section className="rounded-lg border border-border p-5 dark:border-border-dark">
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
      </div>
    </main>
  )
}

function masteryColor(value: number): string {
  if (value < 0.4) return '#d7aaa2'
  if (value < 0.7) return '#d8c58f'
  return '#a9bfa4'
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
