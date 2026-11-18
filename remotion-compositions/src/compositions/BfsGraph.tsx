/**
 * BfsGraph — BFS algorithm visualization.
 *
 * Props (passed via data):
 *   nodes:  { id: number, x: number, y: number, label: string }[]
 *   edges:  { from: number, to: number }[]
 *   startNode: number
 *
 * Each step reveals the next BFS-visited node with a spring transition.
 * The agent provides nodes/edges/startNode matching the actual problem graph.
 */
import React from 'react'
import { AbsoluteFill } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'
import { popIn, sequenceDurationInFrames, springIn, useStepSequence } from '../motion'
import { C } from '../theme'

export interface Node { id: number; x: number; y: number; label: string }
export interface Edge { from: number; to: number }

export interface BfsGraphProps {
  nodes?: Node[]
  edges?: Edge[]
  startNode?: number
}

export const DEFAULT_NODES: Node[] = [
  { id: 0, x: 640, y: 110, label: 'S' },
  { id: 1, x: 400, y: 265, label: '1' },
  { id: 2, x: 880, y: 265, label: '2' },
  { id: 3, x: 280, y: 440, label: '3' },
  { id: 4, x: 520, y: 440, label: '4' },
  { id: 5, x: 760, y: 440, label: '5' },
]
export const DEFAULT_EDGES: Edge[] = [
  { from: 0, to: 1 }, { from: 0, to: 2 },
  { from: 1, to: 3 }, { from: 1, to: 4 },
  { from: 2, to: 5 },
]

export function bfsOrder(nodes: Node[], edges: Edge[], start: number): number[] {
  const adj = new Map<number, number[]>(nodes.map((n) => [n.id, []]))
  // Agent-supplied edges may reference ids that are not in `nodes`; ignore
  // them instead of throwing inside the renderer.
  edges.forEach((e) => {
    adj.get(e.from)?.push(e.to)
    adj.get(e.to)?.push(e.from)
  })
  if (!adj.has(start)) return []
  const visited = new Set<number>([start])
  const queue = [start]
  const order: number[] = []
  while (queue.length) {
    const cur = queue.shift()!
    order.push(cur)
    for (const nb of adj.get(cur) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb)
        queue.push(nb)
      }
    }
  }
  return order
}

/** Duration of the scene for the given props; consumed by calculateMetadata. */
export const bfsGraphFrames = (props: BfsGraphProps, fps: number) =>
  sequenceDurationInFrames(
    bfsOrder(props.nodes ?? DEFAULT_NODES, props.edges ?? DEFAULT_EDGES, props.startNode ?? 0)
      .length,
    fps,
  )

export const BfsGraph: React.FC<BfsGraphProps> = ({
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
  startNode = 0,
}) => {
  const order = bfsOrder(nodes, edges, startNode)
  const seq = useStepSequence(order.length)
  const currentId = seq.started ? order[seq.index] : null
  const visitedSet = new Set(seq.started ? order.slice(0, seq.index + 1) : [])
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const titleIn = springIn(seq.frame, seq.fps, 0)

  return (
    <AbsoluteFill style={{ background: C.bg, position: 'relative' }}>
      <div
        style={{
          position: 'absolute', top: 32, left: 0, right: 0, textAlign: 'center',
          color: C.text, fontSize: 32, fontWeight: 700, letterSpacing: 1,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 8}px)`,
        }}
      >
        BFS — 广度优先遍历
      </div>

      <div
        style={{
          position: 'absolute', bottom: 48, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ color: C.muted, fontSize: 18, marginRight: 8 }}>访问顺序：</span>
        {order.slice(0, seq.revealed).map((id, i) => {
          const scale = popIn(seq.frame, seq.fps, seq.introFrame + i * seq.framesPerStep)
          return (
            <span
              key={`${id}-${i}`}
              style={{
                padding: '4px 14px', borderRadius: 20,
                background: C.visited, color: '#fff',
                fontSize: 18, fontWeight: 600,
                opacity: Math.min(1, scale),
                transform: `scale(${0.6 + 0.4 * scale})`,
              }}
            >
              {nodeMap.get(id)?.label ?? id}
            </span>
          )
        })}
      </div>

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {edges.map((e, i) => {
          const from = nodeMap.get(e.from)
          const to = nodeMap.get(e.to)
          if (!from || !to) return null
          const active = visitedSet.has(e.from) && visitedSet.has(e.to)
          const appear = springIn(seq.frame, seq.fps, 6 + i * 2)
          return (
            <line
              key={`${e.from}-${e.to}-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={active ? C.visited : C.border}
              strokeWidth={active ? 2.5 : 1.5}
              opacity={0.35 + 0.65 * appear}
              strokeDasharray={active ? undefined : 6}
            />
          )
        })}

        {nodes.map((n, i) => {
          const isCurrent = order[seq.index] === n.id && seq.started
          const isVisited = visitedSet.has(n.id)
          const enter = springIn(seq.frame, seq.fps, 4 + i * 4)
          const pulse = isCurrent ? popIn(seq.frame, seq.fps, seq.introFrame + seq.index * seq.framesPerStep) : 0
          const r = 30 + 4 * pulse
          return (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y}) scale(${0.85 + 0.15 * enter}) translate(${-n.x} ${-n.y})`}
              opacity={enter}
            >
              {isCurrent && (
                <circle cx={n.x} cy={n.y} r={r + 12} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.35 * pulse} />
              )}
              <circle
                cx={n.x} cy={n.y} r={r}
                fill={isCurrent ? C.accent : isVisited ? C.visited : C.panel}
                stroke={isCurrent ? C.accent : isVisited ? C.visited : C.border}
                strokeWidth={2}
              />
              <text
                x={n.x} y={n.y + 7} textAnchor="middle"
                fill={C.text} fontSize={18} fontWeight={600} fontFamily={MONO_FONT_STACK}
              >
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}
