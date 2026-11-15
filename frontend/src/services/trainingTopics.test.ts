import { describe, expect, it } from 'vitest'
import { ACWING_TOPICS, TRAINING_TOPICS, findAcWingTopic, findTrainingTopic } from './trainingTopics'

describe('training topics', () => {
  it('covers the LeetCode bank with official topic slugs', () => {
    expect(TRAINING_TOPICS.some(topic => topic.id === 'dynamic-programming')).toBe(true)
    expect(findTrainingTopic('graph')?.slugs).toEqual(
      expect.arrayContaining(['union-find', 'shortest-path', 'topological-sort']),
    )
    expect(findTrainingTopic('dynamic-programming')?.slugs).toEqual(
      expect.arrayContaining(['dynamic-programming', 'memoization']),
    )
  })

  it('returns undefined for unknown topics', () => {
    expect(findTrainingTopic('')).toBeUndefined()
  })

  it('maps AcWing 专项 to algorithm tags for tag search', () => {
    expect(ACWING_TOPICS.some(topic => topic.id === 'dp' && topic.tag === '动态规划')).toBe(true)
    expect(findAcWingTopic('shortest-path')?.tag).toBe('最短路')
  })
})
