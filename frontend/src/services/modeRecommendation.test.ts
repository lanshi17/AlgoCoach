import { expect, it } from 'vitest'
import { recommendLearningMode } from './modeRecommendation'
import type { AgentProfile } from '@/types'

const profile = (patch: Partial<AgentProfile['stats']> = {}, topics: AgentProfile['topics'] = []): AgentProfile => ({
  topics, edges: [], recentProblems: [], dailyAttempts: [],
  stats: { totalAttempts: 0, accepted: 0, averageDurationSec: 0, streakDays: 0, ...patch },
})

it('suggests maintenance when topic mastery is high', () => {
  const result = recommendLearningMode({ currentMode: 'self_paced', localAttempts: 0, profile: profile({ totalAttempts: 6 }, [{ topic: '二分', mastery: 0.9, attempts: 4, lastSeen: '', weakSubtopics: [], relatedTopics: [] }]) })
  expect(result?.suggestedMode).toBe('maintenance')
  expect(result?.key).toBe('mastery')
})

it('suggests contest when accepted rate is low after enough attempts', () => {
  const result = recommendLearningMode({ currentMode: 'self_paced', localAttempts: 0, profile: profile({ totalAttempts: 12, accepted: 4 }) })
  expect(result?.suggestedMode).toBe('contest')
  expect(result?.key).toBe('error_rate')
})

it('falls back to local attempts when an older profile omits optional arrays', () => {
  const result = recommendLearningMode({ currentMode: 'self_paced', localAttempts: 3, profile: { stats: undefined, topics: undefined } as unknown as AgentProfile })
  expect(result).toBeNull()
})
