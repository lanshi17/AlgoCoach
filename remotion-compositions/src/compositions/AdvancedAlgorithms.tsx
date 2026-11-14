import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'

const C = {
  bg: '#0d1117', panel: '#161b22', border: '#30363d', text: '#e6edf3', muted: '#8b949e',
  accent: '#58a6ff', visited: '#1f6feb', success: '#3fb950', warning: '#d29922', danger: '#f85149',
}

type FrameContext = { frame: number; duration: number }
function useStep(count: number): [number, FrameContext] {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  if (count <= 0) return [0, { frame, duration: durationInFrames }]
  return [Math.min(count - 1, Math.floor(frame / Math.max(1, durationInFrames / count))), { frame, duration: durationInFrames }]
}

function Header({ title, note }: { title: string; note?: string }) {
  return <>
    <div style={{ position: 'absolute', top: 28, left: 28, right: 28, textAlign: 'center', color: C.text, fontSize: 28, fontWeight: 700 }}>{title}</div>
    {note && <div style={{ position: 'absolute', bottom: 30, left: 60, right: 60, textAlign: 'center', color: C.accent, fontSize: 18 }}>{note}</div>}
  </>
}

function nodePosition(index: number, count: number, y: number, width = 1280) {
  return { x: (width / (count + 1)) * (index + 1), y }
}

type GraphNode = { id: number; x: number; y: number; label: string }
type GraphEdge = { from: number; to: number; weight?: number }
const GRAPH_NODES: GraphNode[] = [
  { id: 0, x: 640, y: 180, label: 'S' }, { id: 1, x: 360, y: 360, label: 'A' },
  { id: 2, x: 920, y: 360, label: 'B' }, { id: 3, x: 260, y: 540, label: 'C' },
  { id: 4, x: 520, y: 540, label: 'D' }, { id: 5, x: 820, y: 540, label: 'E' },
]
const GRAPH_EDGES: GraphEdge[] = [
  { from: 0, to: 1, weight: 4 }, { from: 0, to: 2, weight: 2 },
  { from: 1, to: 3, weight: 3 }, { from: 1, to: 4, weight: 1 },
  { from: 2, to: 4, weight: 2 }, { from: 2, to: 5, weight: 5 },
]

export interface DfsTreeProps { nodes?: GraphNode[]; edges?: GraphEdge[]; startNode?: number }
export const DfsTree: React.FC<DfsTreeProps> = ({ nodes = GRAPH_NODES, edges = GRAPH_EDGES, startNode = 0 }) => {
  const adjacency = new Map(nodes.map(node => [node.id, [] as number[]]))
  edges.forEach(edge => { adjacency.get(edge.from)?.push(edge.to); adjacency.get(edge.to)?.push(edge.from) })
  const order: number[] = []
  const seen = new Set<number>()
  const visit = (id: number) => { if (seen.has(id)) return; seen.add(id); order.push(id); (adjacency.get(id) ?? []).forEach(visit) }
  visit(startNode)
  const [step] = useStep(order.length)
  const current = order[step]
  const visited = new Set(order.slice(0, step + 1))
  const byId = new Map(nodes.map(node => [node.id, node]))
  return <AbsoluteFill style={{ background: C.bg }}><Header title="DFS — 深度优先遍历" note={`递归深入一条路径，再回溯 · 当前：${byId.get(current)?.label ?? current}`} />
    <svg width="100%" height="100%">{edges.map((edge, i) => { const a = byId.get(edge.from); const b = byId.get(edge.to); if (!a || !b) return null; return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={visited.has(edge.from) && visited.has(edge.to) ? C.visited : C.border} strokeWidth={3} /> })}
      {nodes.map(node => <g key={node.id}><circle cx={node.x} cy={node.y} r={30} fill={node.id === current ? C.accent : visited.has(node.id) ? C.visited : C.panel} stroke={C.border} strokeWidth={2} /><text x={node.x} y={node.y + 6} textAnchor="middle" fill={C.text} fontSize={18}>{node.label}</text></g>)}</svg>
    <div style={{ position: 'absolute', bottom: 82, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10 }}>{order.slice(0, step + 1).map((id, i) => <span key={id} style={{ color: C.text, background: id === current ? C.accent : C.visited, borderRadius: 16, padding: '4px 12px' }}>{byId.get(id)?.label ?? id}{i === step ? ' ←' : ''}</span>)}</div>
  </AbsoluteFill>
}

export interface DijkstraProps { nodes?: GraphNode[]; edges?: GraphEdge[]; startNode?: number }
export const Dijkstra: React.FC<DijkstraProps> = ({ nodes = GRAPH_NODES, edges = GRAPH_EDGES, startNode = 0 }) => {
  const distance = new Map(nodes.map(node => [node.id, Number.POSITIVE_INFINITY]))
  distance.set(startNode, 0)
  const finalized = new Set<number>()
  const steps: Array<{ node: number; distances: Map<number, number>; done: number[] }> = []
  while (finalized.size < nodes.length) {
    let current: number | undefined
    for (const node of nodes) if (!finalized.has(node.id) && (current === undefined || (distance.get(node.id) ?? Infinity) < (distance.get(current) ?? Infinity))) current = node.id
    if (current === undefined || !Number.isFinite(distance.get(current))) break
    finalized.add(current)
    for (const edge of edges) {
      const to = edge.from === current ? edge.to : edge.to === current ? edge.from : undefined
      if (to === undefined || finalized.has(to)) continue
      distance.set(to, Math.min(distance.get(to) ?? Infinity, (distance.get(current) ?? Infinity) + Math.max(0, edge.weight ?? 1)))
    }
    steps.push({ node: current, distances: new Map(distance), done: [...finalized] })
  }
  const [step] = useStep(steps.length)
  const state = steps[step]
  const byId = new Map(nodes.map(node => [node.id, node]))
  return <AbsoluteFill style={{ background: C.bg }}><Header title="Dijkstra — 单源最短路径" note={state ? `确定节点 ${byId.get(state.node)?.label ?? state.node} 的最短距离` : '没有可达节点'} />
    <svg width="100%" height="100%">{edges.map((edge, i) => { const a = byId.get(edge.from); const b = byId.get(edge.to); if (!a || !b) return null; return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={state?.done.includes(edge.from) && state.done.includes(edge.to) ? C.visited : C.border} strokeWidth={3} /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8} textAnchor="middle" fill={C.warning} fontSize={16}>{edge.weight ?? 1}</text></g> })}
      {nodes.map(node => { const value = state?.distances.get(node.id) ?? (node.id === startNode ? 0 : Infinity); const done = state?.done.includes(node.id) ?? false; return <g key={node.id}><circle cx={node.x} cy={node.y} r={34} fill={state?.node === node.id ? C.accent : done ? C.visited : C.panel} stroke={C.border} strokeWidth={2} /><text x={node.x} y={node.y - 3} textAnchor="middle" fill={C.text} fontSize={16}>{node.label}</text><text x={node.x} y={node.y + 17} textAnchor="middle" fill={C.text} fontSize={12}>{Number.isFinite(value) ? value : '∞'}</text></g> })}</svg>
  </AbsoluteFill>
}

export interface UnionOperation { a: number; b: number; note?: string }
export interface UnionFindProps { size?: number; operations?: UnionOperation[] }
const DEFAULT_UNIONS: UnionOperation[] = [{ a: 0, b: 1 }, { a: 2, b: 3 }, { a: 1, b: 2 }, { a: 4, b: 5 }, { a: 5, b: 6 }]
export const UnionFind: React.FC<UnionFindProps> = ({ size = 7, operations = DEFAULT_UNIONS }) => {
  const count = Math.max(1, Math.min(16, size))
  const parent = Array.from({ length: count }, (_, i) => i)
  const snapshots: number[][] = []
  const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]))
  operations.forEach(operation => { if (operation.a < count && operation.b < count) { const a = find(operation.a); const b = find(operation.b); if (a !== b) parent[b] = a } snapshots.push(Array.from({ length: count }, (_, i) => find(i))) })
  const [step] = useStep(operations.length + 1)
  const roots = snapshots[Math.max(0, step - 1)] ?? Array.from({ length: count }, (_, i) => i)
  const active = operations[step - 1]
  const group = new Map<number, number>()
  roots.forEach(root => group.set(root, root))
  const palette = [C.accent, C.success, C.warning, '#bc8cff', '#d47f63', '#5bb8a9', '#d27ca8']
  return <AbsoluteFill style={{ background: C.bg }}><Header title="Union-Find — 合并连通分量" note={active ? `Union(${active.a}, ${active.b})${active.note ? ` · ${active.note}` : ''}` : 'Find 路径压缩 · Union 按秩合并'} />
    <svg width="100%" height="100%">{Array.from(group.keys()).flatMap(root => roots.map((member, i) => member === root && i !== root ? <line key={`${root}-${i}`} x1={nodePosition(root, count, 330).x} y1={330} x2={nodePosition(i, count, 510).x} y2={510} stroke={palette[root % palette.length]} strokeWidth={2} /> : null))}
      {roots.map((root, i) => { const x = nodePosition(i, count, 510).x; return <g key={i}><circle cx={x} cy={510} r={28} fill={palette[root % palette.length]} stroke={active && (active.a === i || active.b === i) ? C.text : C.border} strokeWidth={active && (active.a === i || active.b === i) ? 4 : 2} /><text x={x} y={516} textAnchor="middle" fill={C.bg} fontSize={16} fontWeight={700}>{i}</text></g> })}
      {[...group.keys()].map(root => { const members = roots.map((value, i) => value === root ? i : -1).filter(i => i >= 0); const x = nodePosition(root, count, 330).x; return <g key={root}><circle cx={x} cy={330} r={30} fill={palette[root % palette.length]} stroke={C.border} strokeWidth={2} /><text x={x} y={336} textAnchor="middle" fill={C.bg} fontSize={16} fontWeight={700}>{root}</text><text x={x} y={280} textAnchor="middle" fill={C.muted} fontSize={14}>{`{${members.join(',')}}`}</text></g> })}</svg>
    <div style={{ position: 'absolute', top: 110, left: 0, right: 0, textAlign: 'center', color: C.muted, fontSize: 18 }}>连通分量：{group.size}</div>
  </AbsoluteFill>
}

type ArraySnapshot = { values: number[]; active: number[]; sortedFrom: number }
function heapSnapshots(input: number[]): ArraySnapshot[] {
  const values = [...input]; const states: ArraySnapshot[] = []
  const swap = (a: number, b: number, sortedFrom = values.length) => { [values[a], values[b]] = [values[b], values[a]]; states.push({ values: [...values], active: [a, b], sortedFrom }) }
  const sift = (root: number, size: number, sortedFrom = values.length) => { let parent = root; while (parent * 2 + 1 < size) { let child = parent * 2 + 1; if (child + 1 < size && values[child + 1] > values[child]) child++; if (values[parent] >= values[child]) break; swap(parent, child, sortedFrom); parent = child } }
  for (let i = Math.floor(values.length / 2) - 1; i >= 0; i--) sift(i, values.length)
  for (let end = values.length - 1; end > 0; end--) { swap(0, end, end + 1); sift(0, end, end + 1) }
  states.push({ values: [...values], active: [], sortedFrom: 0 })
  return states
}
function ArrayBars({ state, title, subtitle }: { state: ArraySnapshot; title: string; subtitle: string }) {
  const max = Math.max(1, ...state.values.map(value => Math.abs(value)))
  const barW = Math.min(86, 930 / Math.max(state.values.length, 1))
  return <AbsoluteFill style={{ background: C.bg }}><Header title={title} note={subtitle} /><svg width="100%" height="100%">{state.values.map((value, i) => { const h = 260 * Math.abs(value) / max; const x = 640 - state.values.length * barW / 2 + i * barW; const y = 470 - h; const active = state.active.includes(i); const sorted = i >= state.sortedFrom; return <g key={i}><rect x={x + 4} y={y} width={barW - 8} height={Math.max(3, h)} rx={5} fill={sorted ? C.success : active ? C.warning : C.visited} /><text x={x + barW / 2} y={495} textAnchor="middle" fill={C.text} fontSize={16}>{value}</text></g> })}</svg></AbsoluteFill>
}
export interface HeapSortProps { array?: number[] }
export const HeapSort: React.FC<HeapSortProps> = ({ array = [7, 2, 9, 4, 1, 6, 3] }) => {
  const states = heapSnapshots(array)
  const [step] = useStep(states.length)
  const state = states[step] ?? { values: array, active: [], sortedFrom: 0 }
  return <ArrayBars state={state} title="Heap Sort — 堆排序" subtitle={`构造最大堆，再依次把堆顶放入有序区 · ${step + 1}/${states.length}`} />
}

type BacktrackAction = { path: number[]; note: string; solution?: boolean }
function permutations(values: number[]): { paths: number[][]; actions: BacktrackAction[] } {
  const paths: number[][] = []; const actions: BacktrackAction[] = []; const path: number[] = []; const used = new Set<number>()
  const walk = () => { if (path.length === values.length) { const complete = [...path]; paths.push(complete); actions.push({ path: complete, note: `找到一个解：${complete.join('')}`, solution: true }); return }
    values.forEach(value => { if (used.has(value)) return; used.add(value); path.push(value); actions.push({ path: [...path], note: `选择 ${value}，递归进入下一层` }); walk(); path.pop(); used.delete(value); actions.push({ path: [...path], note: `撤销 ${value}，回溯到上一步` }) }) }
  walk(); return { paths, actions }
}
export interface BacktrackingTreeProps { choices?: number[] }
export const BacktrackingTree: React.FC<BacktrackingTreeProps> = ({ choices = [1, 2, 3] }) => {
  const { actions } = permutations(choices.slice(0, 5))
  const [step] = useStep(actions.length)
  const action = actions[step]
  const path = action?.path ?? []
  return <AbsoluteFill style={{ background: C.bg }}><Header title="Backtracking — 回溯搜索" note={action?.note ?? '选择 → 递归 → 撤销选择'} />
    <svg width="100%" height="100%">{path.map((value, depth) => { const x = 640 + (depth - (path.length - 1) / 2) * 130; const y = 220 + depth * 90; const parentX = depth ? 640 + (depth - 1 - (path.length - 1) / 2) * 130 : x; const parentY = depth ? 220 + (depth - 1) * 90 : y; return <g key={`${depth}-${value}`}>{depth > 0 && <line x1={parentX} y1={parentY + 26} x2={x} y2={y - 26} stroke={C.visited} strokeWidth={3} />}<circle cx={x} cy={y} r={28} fill={action?.solution ? C.success : C.visited} /><text x={x} y={y + 6} textAnchor="middle" fill={C.text} fontSize={18}>{value}</text></g> })}</svg>
    <div style={{ position: 'absolute', top: 130, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, color: C.muted }}>当前路径：{path.join(' → ') || '（空）'}</div>
  </AbsoluteFill>
}

export interface BinarySearchStep { left: number; right: number; mid: number; note?: string }
export interface BinarySearchProps { array?: number[]; target?: number; steps?: BinarySearchStep[] }
const DEFAULT_SEARCH = [1, 3, 5, 7, 9, 11, 13, 15, 17]
export const BinarySearch: React.FC<BinarySearchProps> = ({ array = DEFAULT_SEARCH, target = 11, steps }) => {
  const generated: BinarySearchStep[] = []
  let left = 0; let right = array.length - 1
  while (left <= right) { const mid = Math.floor((left + right) / 2); generated.push({ left, right, mid, note: array[mid] === target ? `命中 ${target}` : array[mid] < target ? `${array[mid]} < ${target}，搜索右半区` : `${array[mid]} > ${target}，搜索左半区` }); if (array[mid] === target) break; if (array[mid] < target) left = mid + 1; else right = mid - 1 }
  const sequence = steps?.length ? steps : generated
  const [step] = useStep(sequence.length)
  const current = sequence[step] ?? { left: 0, right: -1, mid: -1, note: '搜索区间为空' }
  const width = Math.min(92, 1040 / Math.max(1, array.length)); const start = (1280 - width * array.length) / 2
  return <AbsoluteFill style={{ background: C.bg }}><Header title="Binary Search — 二分查找" note={current.note ?? `目标值：${target}`} /><svg width="100%" height="100%">{array.map((value, i) => { const inRange = i >= current.left && i <= current.right; const mid = i === current.mid; return <g key={i}><rect x={start + i * width + 3} y={330} width={width - 6} height={70} rx={6} fill={mid ? C.accent : inRange ? C.panel : C.bg} stroke={mid ? C.accent : C.border} strokeWidth={2} /><text x={start + i * width + width / 2} y={373} textAnchor="middle" fill={C.text} fontSize={20}>{value}</text><text x={start + i * width + width / 2} y={425} textAnchor="middle" fill={i === current.left || i === current.right ? C.warning : C.muted} fontSize={13}>{i === current.left && i === current.right ? 'L=R' : i === current.left ? 'L' : i === current.right ? 'R' : ''}</text>{mid && <text x={start + i * width + width / 2} y={292} textAnchor="middle" fill={C.accent} fontSize={16}>mid</text>}</g> })}</svg></AbsoluteFill>
}

export interface LinkedListStep { index: number; action?: 'visit' | 'reverse' | 'insert' | 'delete'; note?: string }
export interface LinkedListOpsProps { values?: number[]; steps?: LinkedListStep[] }
export const LinkedListOps: React.FC<LinkedListOpsProps> = ({ values = [4, 7, 2, 9, 5], steps = values.map((_, index) => ({ index, action: 'visit' as const, note: `访问节点 ${index}` })) }) => {
  const [step] = useStep(steps.length)
  const current = steps[step] ?? { index: 0, action: 'visit' as const }
  const width = Math.min(150, 920 / Math.max(1, values.length)); const start = (1280 - values.length * width) / 2
  const reversed = current.action === 'reverse'
  return <AbsoluteFill style={{ background: C.bg }}><Header title="Linked List — 链表操作" note={current.note ?? `${current.action ?? 'visit'} · 当前节点 ${current.index}`} /><svg width="100%" height="100%">{values.map((value, i) => { const x = start + i * width; const active = i === current.index; const next = reversed ? i > 0 : i < values.length - 1; return <g key={i}>{next && <line x1={reversed ? x - 12 : x + width - 22} y1={370} x2={reversed ? x - width + 22 : x + width - 8} y2={370} stroke={C.accent} strokeWidth={3} markerEnd="url(#arrow)" />}<rect x={x} y={335} width={width - 30} height={70} rx={7} fill={active ? C.visited : C.panel} stroke={active ? C.accent : C.border} strokeWidth={2} /><text x={x + (width - 30) / 2} y={365} textAnchor="middle" fill={C.text} fontSize={20}>{value}</text><text x={x + (width - 30) / 2} y={390} textAnchor="middle" fill={C.muted} fontSize={12}>{i === 0 ? 'head' : `node ${i}`}</text></g> })}<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.accent} /></marker></defs></svg></AbsoluteFill>
}

export interface ComparisonAlgorithm { name: string; idea: string; time: string; space: string; steps: string[] }
export interface SolutionCompareProps { title?: string; algorithms?: ComparisonAlgorithm[] }
const DEFAULT_COMPARISON: ComparisonAlgorithm[] = [
  { name: '暴力枚举', idea: '枚举每个数，再扫描后续元素', time: 'O(n²)', space: 'O(1)', steps: ['固定第一个元素', '枚举后续候选', '检查是否满足条件'] },
  { name: '哈希表', idea: '保存已见元素，查找互补值', time: 'O(n)', space: 'O(n)', steps: ['计算当前元素的互补值', '查询哈希表', '记录当前元素与下标'] },
]
export const SolutionCompare: React.FC<SolutionCompareProps> = ({ title = '解法对比 — 建模与复杂度', algorithms = DEFAULT_COMPARISON }) => {
  const cards = algorithms.slice(0, 2)
  const sequence = cards.flatMap((algorithm, side) => algorithm.steps.map((_, index) => ({ side, index })))
  const [step] = useStep(sequence.length)
  const active = sequence[step]
  return <AbsoluteFill style={{ background: C.bg }}><Header title={title} note={active ? `${cards[active.side]?.name}：${cards[active.side]?.steps[active.index]}` : '比较状态设计、时间复杂度与空间复杂度'} />
    <div style={{ position: 'absolute', top: 140, left: 70, right: 70, bottom: 100, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>{cards.map((algorithm, side) => <section key={algorithm.name} style={{ padding: 26, borderRadius: 14, background: C.panel, border: `1px solid ${active?.side === side ? C.accent : C.border}`, color: C.text }}><h2 style={{ margin: '0 0 10px', fontSize: 25 }}>{algorithm.name}</h2><p style={{ color: C.muted, fontSize: 18 }}>{algorithm.idea}</p><p style={{ color: C.warning }}>时间：{algorithm.time}　空间：{algorithm.space}</p><ol style={{ paddingLeft: 26, lineHeight: 2 }}>{algorithm.steps.map((line, index) => <li key={line} style={{ color: active?.side === side && active.index === index ? C.accent : C.text, fontWeight: active?.side === side && active.index === index ? 700 : 400 }}>{line}</li>)}</ol></section>)}</div>
  </AbsoluteFill>
}

export interface SortVisualizerProps { array?: number[] }
export const SortVisualizer: React.FC<SortVisualizerProps> = ({ array = [8, 3, 6, 2, 7, 1, 5, 4] }) => {
  const values = [...array]; const states: ArraySnapshot[] = [{ values: [...values], active: [], sortedFrom: values.length }]
  for (let i = 1; i < values.length; i++) { const value = values[i]; let j = i - 1; while (j >= 0 && values[j] > value) { values[j + 1] = values[j]; j--; states.push({ values: [...values], active: [j + 1, j + 2], sortedFrom: values.length - i }) } values[j + 1] = value; states.push({ values: [...values], active: [j + 1], sortedFrom: values.length - i }) }
  const [step] = useStep(states.length)
  return <ArrayBars state={states[step] ?? states[0]} title="Insertion Sort — 插入排序" subtitle={`将当前元素插入左侧有序区 · ${step + 1}/${states.length}`} />
}

export interface GridBfsProps { grid?: number[][]; start?: [number, number]; target?: [number, number] }
const DEFAULT_GRID = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 1, 0, 1, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0, 1, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 1], [0, 1, 1, 1, 1, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 1, 0],
]
export const GridBfs: React.FC<GridBfsProps> = ({ grid = DEFAULT_GRID, start = [0, 0], target = [6, 8] }) => {
  const rows = grid.length; const cols = grid[0]?.length ?? 0
  const queue: Array<[number, number]> = [start]; const seen = new Set([`${start[0]},${start[1]}`]); const parent = new Map<string, string>(); const order: Array<[number, number]> = []
  while (queue.length) { const [r, c] = queue.shift()!; order.push([r, c]); if (r === target[0] && c === target[1]) break; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = r + dr; const nc = c + dc; const key = `${nr},${nc}`; if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 0 && !seen.has(key)) { seen.add(key); parent.set(key, `${r},${c}`); queue.push([nr, nc]) } } }
  const path = new Set<string>(); let key = `${target[0]},${target[1]}`; while (key !== `${start[0]},${start[1]}` && parent.has(key)) { path.add(key); key = parent.get(key)! } path.add(`${start[0]},${start[1]}`)
  const [step] = useStep(order.length); const visited = new Set(order.slice(0, step + 1).map(([r, c]) => `${r},${c}`)); const cell = Math.min(60, 600 / Math.max(rows, cols)); const width = cols * cell; const height = rows * cell; const ox = (1280 - width) / 2; const oy = 180
  return <AbsoluteFill style={{ background: C.bg }}><Header title="Grid BFS — 网格最短路" note={`队列按层扩展 · 已访问 ${Math.min(step + 1, order.length)} / ${order.length} 个格子`} /><svg width="100%" height="100%">{grid.flatMap((line, r) => line.map((blocked, c) => { const id = `${r},${c}`; const current = order[step]?.[0] === r && order[step]?.[1] === c; const fill = blocked ? '#090d12' : path.has(id) ? '#1c452b' : current ? C.accent : visited.has(id) ? C.visited : C.panel; return <g key={id}><rect x={ox + c * cell + 2} y={oy + r * cell + 2} width={cell - 4} height={cell - 4} rx={5} fill={fill} stroke={C.border} /><text x={ox + c * cell + cell / 2} y={oy + r * cell + cell / 2 + 5} textAnchor="middle" fill={C.text} fontSize={14}>{r === start[0] && c === start[1] ? 'S' : r === target[0] && c === target[1] ? 'T' : ''}</text></g> }))}</svg></AbsoluteFill>
}
