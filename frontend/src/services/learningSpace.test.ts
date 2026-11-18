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
