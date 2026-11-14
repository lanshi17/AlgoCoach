import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import type { AgentProfile } from '@/types'

export type GraphNode = AgentProfile['topics'][number] & { x: number; y: number; radius: number }
type GraphLink = { source: string | GraphNode; target: string | GraphNode; weight: number }

/** Deterministic local force layout; no physics loop or network is left running. */
export function makeGraph(topics: AgentProfile['topics'], edges: AgentProfile['edges']) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(topics.length)))
  const rows = Math.max(1, Math.ceil(topics.length / columns))
  const width = Math.max(520, 160 + columns * 170)
  const height = Math.max(260, 120 + rows * 140)
  const nodes: GraphNode[] = topics.map((topic, index) => {
    const angle = index / Math.max(1, topics.length) * Math.PI * 2
    const radius = Math.min(width, height) * 0.28
    return {
      ...topic,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
      radius: 27 + Math.min(16, Math.sqrt(topic.attempts) * 3),
    }
  })
  if (nodes.length > 1) {
    const topicNames = new Set(topics.map(topic => topic.topic))
    const links: GraphLink[] = edges
      .filter(edge => topicNames.has(edge.from) && topicNames.has(edge.to))
      .map(edge => ({ source: edge.from, target: edge.to, weight: edge.weight }))
    const simulation = forceSimulation<GraphNode>(nodes)
      .force('charge', forceManyBody().strength(-420))
      .force('link', forceLink<GraphNode, GraphLink>(links)
        .id(node => node.topic)
        .distance(link => 120 + Math.min(50, link.weight * 5))
        .strength(0.28))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide<GraphNode>(node => node.radius + 20))
      .stop()
    for (let tick = 0; tick < 240; tick++) simulation.tick()
    nodes.forEach(node => {
      node.x = Math.min(width - node.radius - 12, Math.max(node.radius + 12, node.x ?? width / 2))
      node.y = Math.min(height - node.radius - 12, Math.max(node.radius + 12, node.y ?? height / 2))
    })
  }
  return { nodes, width, height }
}
