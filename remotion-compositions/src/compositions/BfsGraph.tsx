/**
 * BfsGraph — BFS algorithm visualization.
 *
 * Props (passed via data):
 *   nodes:  { id: number, x: number, y: number, label: string }[]
 *   edges:  { from: number, to: number }[]
 *   startNode: number
 *
 * Each step reveals the next BFS-visited node with a color transition.
 * The agent provides nodes/edges/startNode matching the actual problem graph.
 */
import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'

interface Node { id: number; x: number; y: number; label: string }
interface Edge { from: number; to: number }

interface Props {
  nodes?: Node[]
  edges?: Edge[]
  startNode?: number
}

const DEFAULT_NODES: Node[] = [
  { id: 0, x: 640, y: 100, label: 'S' },
  { id: 1, x: 400, y: 260, label: '1' },
  { id: 2, x: 880, y: 260, label: '2' },
  { id: 3, x: 280, y: 440, label: '3' },
  { id: 4, x: 520, y: 440, label: '4' },
  { id: 5, x: 760, y: 440, label: '5' },
]
const DEFAULT_EDGES: Edge[] = [
  { from: 0, to: 1 }, { from: 0, to: 2 },
  { from: 1, to: 3 }, { from: 1, to: 4 },
  { from: 2, to: 5 },
]

function bfsOrder(nodes: Node[], edges: Edge[], start: number): number[] {
  const adj: Map<number, number[]> = new Map(nodes.map(n => [n.id, []]))
  edges.forEach(e => { adj.get(e.from)!.push(e.to); adj.get(e.to)!.push(e.from) })
  const visited = new Set<number>()
  const queue = [start]
  const order: number[] = []
  visited.add(start)
  while (queue.length) {
    const cur = queue.shift()!
    order.push(cur)
    for (const nb of (adj.get(cur) ?? [])) {
      if (!visited.has(nb)) { visited.add(nb); queue.push(nb) }
    }
  }
  return order
}

export const BfsGraph: React.FC<Props> = ({
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
  startNode = 0,
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const order = bfsOrder(nodes, edges, startNode)
  const framesPerStep = Math.floor(durationInFrames / (order.length + 1))
  const currentStep = Math.floor(frame / framesPerStep)
  const visitedSet = new Set(order.slice(0, currentStep))

  // Colors
  const C_BG = '#0d1117'
  const C_BORDER = '#30363d'
  const C_NODE_DEFAULT = '#161b22'
  const C_NODE_VISITED = '#1f6feb'
  const C_NODE_CURRENT = '#58a6ff'
  const C_EDGE = '#30363d'
  const C_TEXT = '#e6edf3'
  const C_LABEL = '#8b949e'

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  return (
    <AbsoluteFill style={{ background: C_BG, position: 'relative' }}>
      {/* Title */}
      <div style={{
        position: 'absolute', top: 32, left: 0, right: 0,
        textAlign: 'center', color: C_TEXT,
        fontSize: 32, fontWeight: 700, letterSpacing: 1,
      }}>
        BFS — 广度优先遍历
      </div>

      {/* BFS order display */}
      <div style={{
        position: 'absolute', bottom: 48, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 8,
      }}>
        <span style={{ color: C_LABEL, fontSize: 18, marginRight: 8 }}>访问顺序：</span>
        {order.slice(0, currentStep).map((id, i) => (
          <span key={i} style={{
            padding: '4px 14px', borderRadius: 20,
            background: C_NODE_VISITED, color: '#fff',
            fontSize: 18, fontWeight: 600,
          }}>
            {nodeMap.get(id)?.label ?? id}
          </span>
        ))}
      </div>

      {/* SVG graph */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* Edges */}
        {edges.map((e, i) => {
          const from = nodeMap.get(e.from)!
          const to = nodeMap.get(e.to)!
          const active = visitedSet.has(e.from) && visitedSet.has(e.to)
          return (
            <line key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={active ? C_NODE_VISITED : C_EDGE}
              strokeWidth={active ? 2.5 : 1.5}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const isCurrent = order[currentStep - 1] === n.id
          const isVisited = visitedSet.has(n.id)
          const fill = isCurrent ? C_NODE_CURRENT : isVisited ? C_NODE_VISITED : C_NODE_DEFAULT
          const stroke = isCurrent ? C_NODE_CURRENT : isVisited ? C_NODE_VISITED : C_BORDER
          const r = isCurrent ? 34 : 30
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={stroke} strokeWidth={2} />
              <text x={n.x} y={n.y + 7} textAnchor="middle"
                fill={C_TEXT} fontSize={18} fontWeight={600} fontFamily="JetBrains Mono, monospace">
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}
