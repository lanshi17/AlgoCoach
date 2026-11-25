import { expect, it } from 'vitest'
import { CODE_LANGUAGES } from './languages'
import { GUIDED_CODE_TEMPLATES, guidedCodeTemplate, isGuidedCodeTemplate } from './guidedCodeTemplates'

it('gives every supported language a non-empty, recognisable starter template', () => {
  for (const language of CODE_LANGUAGES) {
    const template = guidedCodeTemplate(language)
    expect(template.trim().length).toBeGreaterThan(0)
    expect(template).toContain('TODO')
    expect(isGuidedCodeTemplate(template)).toBe(true)
  }
  expect(new Set(Object.values(GUIDED_CODE_TEMPLATES)).size).toBe(CODE_LANGUAGES.length)
})

it('does not treat an edited solution as an untouched template', () => {
  expect(isGuidedCodeTemplate('')).toBe(false)
  expect(isGuidedCodeTemplate('print("solved")')).toBe(false)
})
