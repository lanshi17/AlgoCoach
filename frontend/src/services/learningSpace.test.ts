import { afterEach, describe, expect, it } from 'vitest'
import { buildModeLayout, readLearningSpaceLayout, writeLearningSpaceLayout } from './learningSpace'

afterEach(() => localStorage.clear())

describe('learning space layouts', () => {
  it('builds an exam layout with review and plan blocks visible', () => {
    const layout = buildModeLayout('contest')
    expect(layout.mode).toBe('contest')
    expect(layout.blocks.find(block => block.id === 'review')?.visible).toBe(true)
    expect(layout.blocks.find(block => block.id === 'knowledge')?.visible).toBe(false)
  })

  it('persists the selected mode and restores missing default blocks', () => {
    writeLearningSpaceLayout({ mode: 'maintenance', blocks: [{ id: 'review', visible: true }] })
    const layout = readLearningSpaceLayout()
    expect(layout.mode).toBe('maintenance')
    expect(layout.blocks.map(block => block.id)).toContain('digest')
    expect(layout.blocks.find(block => block.id === 'review')?.visible).toBe(true)
  })

  it('falls back to a usable self-paced layout when storage is malformed', () => {
    localStorage.setItem('algocoach.learningSpaceLayout', '{bad json')
    const layout = readLearningSpaceLayout()
    expect(layout.mode).toBe('self_paced')
    expect(layout.blocks.length).toBeGreaterThan(3)
  })
})

it('aggregates practice and review activity by local week', async () => {
  const { getWeekActivity } = await import('./learningSpace')
  const records = [
    { id: 'a', problemId: 'LOCAL:a', title: 'A', topics: [], durationSec: 1, codeLength: 1, endedAt: '2026-01-05T10:00:00.000Z' },
    { id: 'b', problemId: 'LOCAL:b', title: 'B', topics: [], durationSec: 1, codeLength: 1, endedAt: '2026-01-05T12:00:00.000Z' },
    { id: 'c', problemId: 'LOCAL:c', title: 'C', topics: [], durationSec: 1, codeLength: 1, endedAt: '2026-01-11T12:00:00.000Z' },
  ]
  const reviews = [
    { problemId: 'a', note: 'one', reviewedAt: '2026-01-06T10:00:00.000Z' },
    { problemId: 'b', note: 'two', reviewedAt: '2026-01-12T10:00:00.000Z' },
  ]
  expect(getWeekActivity(records, reviews, new Date('2026-01-07T12:00:00.000Z'))).toEqual({ practice: [2, 0, 0, 0, 0, 0, 1], reviews: [0, 1, 0, 0, 0, 0, 0], practiceTotal: 3, reviewTotal: 1 })
})

it('chooses a quiz prompt from the active problem topic', async () => {
  const { dailyQuizForProblem } = await import('./learningSpace')
  expect(dailyQuizForProblem({ topics: ['数组', '哈希表'] }).answer).toBe(0)
  expect(dailyQuizForProblem({ topics: ['数组', '二分'] }).question).toContain('left + (right - left)')
})
