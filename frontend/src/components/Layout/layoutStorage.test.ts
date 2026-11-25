import { expect, it } from 'vitest'
import { LAYOUT_STORAGE_VERSION, packLayout, unpackLayout } from './layoutStorage'

it('packs layouts with a version and unwraps them', () => {
  const layout = { leftWidth: 230, leftOpen: true }
  const packed = JSON.parse(packLayout(layout))
  expect(packed).toEqual({ version: LAYOUT_STORAGE_VERSION, layout })
  expect(unpackLayout(JSON.stringify(packed))).toEqual(layout)
})

it('reads legacy layouts that were stored without an envelope', () => {
  const legacy = { problemWidth: 420, chatWidth: 360, modes: {}, floats: {} }
  expect(unpackLayout(JSON.stringify(legacy))).toEqual(legacy)
})

it('reads a v1 envelope after the schema bump', () => {
  const legacy = { problemWidth: 420, chatWidth: 360, modes: {}, floats: {} }
  expect(unpackLayout(JSON.stringify({ version: 1, layout: legacy }))).toEqual(legacy)
})

it('reads a v2 envelope after the schema bump', () => {
  const legacy = { problemWidth: 420, chatWidth: 360, modes: {}, maximized: {}, floats: {} }
  expect(unpackLayout(JSON.stringify({ version: 2, layout: legacy }))).toEqual(legacy)
})

it('returns null for missing or malformed storage', () => {
  expect(unpackLayout(null)).toBeNull()
  expect(unpackLayout('')).toBeNull()
  expect(unpackLayout('{not json')).toBeNull()
  expect(unpackLayout('42')).toBe(42)
})
