import { describe, expect, it } from 'vitest'
import { makeGraph } from './graphLayout'
import type { AgentProfile } from '@/types'

const topics: AgentProfile['topics'] = [
  { topic: 'DP', mastery: 0.4, attempts: 3, lastSeen: '', weakSubtopics: [], relatedTopics: [] },
  { topic: 'Graph', mastery: 0.7, attempts: 2, lastSeen: '', weakSubtopics: [], relatedTopics: [] },
  { topic: 'Array', mastery: 0.8, attempts: 5, lastSeen: '', weakSubtopics: [], relatedTopics: [] },
]

describe('knowledge graph force layout', () => {
  it('returns deterministic node positions inside the canvas and preserves isolated topics', () => {
    const edges: AgentProfile['edges'] = [{ from: 'DP', to: 'Graph', weight: 2 }]
    const first = makeGraph(topics, edges)
    const second = makeGraph(topics, edges)

    expect(first.nodes).toHaveLength(3)
    expect(first.nodes.map(node => [node.x, node.y])).toEqual(second.nodes.map(node => [node.x, node.y]))
    expect(first.nodes.every(node => node.x >= 0 && node.x <= first.width && node.y >= 0 && node.y <= first.height)).toBe(true)
    expect(first.nodes.find(node => node.topic === 'Array')).toBeDefined()
  })

  it('keeps a one-node graph valid without force links', () => {
    const graph = makeGraph(topics.slice(0, 1), [])
    expect(graph.nodes).toHaveLength(1)
    expect(Number.isFinite(graph.nodes[0].x)).toBe(true)
    expect(Number.isFinite(graph.nodes[0].y)).toBe(true)
  })

  it('returns a valid empty canvas when there are no observed topics', () => {
    const graph = makeGraph([], [])
    expect(graph.nodes).toEqual([])
    expect(graph.width).toBeGreaterThan(0)
    expect(graph.height).toBeGreaterThan(0)
  })
})
