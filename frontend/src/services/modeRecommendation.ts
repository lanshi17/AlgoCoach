import type { AgentProfile } from '@/types'
import type { LearningMode } from './learningSpace'

export interface ModeSuggestion {
  suggestedMode: LearningMode
  key: 'mastery' | 'error_rate' | 'practice_rhythm'
  reason: string
}

export function recommendLearningMode({ currentMode, profile, localAttempts }: { currentMode: LearningMode; profile: AgentProfile | null; localAttempts: number }): ModeSuggestion | null {
  const attempts = profile?.stats.totalAttempts ?? localAttempts
  if (currentMode === 'self_paced' && profile?.topics.length) {
    const averageMastery = profile.topics.reduce((sum, topic) => sum + topic.mastery, 0) / profile.topics.length
    if (averageMastery >= 0.85 && attempts >= 5) return { suggestedMode: 'maintenance', key: 'mastery', reason: `近期知识点平均掌握度 ${Math.round(averageMastery * 100)}%，适合用短练习保持。` }
  }
  if (currentMode === 'self_paced' && profile && attempts >= 10) {
    const acceptedRate = profile.stats.accepted / Math.max(1, profile.stats.totalAttempts)
    if (acceptedRate < 0.6) return { suggestedMode: 'contest', key: 'error_rate', reason: '最近提交仍有较多卡点，建议切到竞赛冲刺，集中练习并及时复盘。' }
  }
  if (currentMode === 'contest' && (profile?.stats.streakDays ?? 0) >= 7) return { suggestedMode: 'maintenance', key: 'practice_rhythm', reason: '已经连续训练一周，可以用维护复习巩固现有知识。' }
  return null
}
