import { beforeAll, describe, expect, it, vi } from 'vitest'
import { MONACO_LANGUAGES } from '@/services/languages'

type Suggestion = {
  label: string
  insertText: string
  insertTextRules?: number
}

type Provider = {
  provideCompletionItems: (
    model: { getWordUntilPosition: (position: unknown) => { word: string; startColumn: number; endColumn: number } },
    position: unknown,
    context?: { triggerKind: number },
  ) => { suggestions: Suggestion[] }
}

const { registrations } = vi.hoisted(() => ({
  registrations: [] as Array<{ language: string; provider: unknown }>,
}))

vi.mock('monaco-editor/editor', () => ({
  Range: class Range {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
  languages: {
    CompletionItemKind: { Keyword: 0 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
    CompletionTriggerKind: { Invoke: 0, TriggerCharacter: 1 },
    registerCompletionItemProvider: (language: string, provider: unknown) => {
      registrations.push({ language, provider })
      return { dispose: () => {} }
    },
  },
}))

function providerFor(language: string): Provider {
  const entry = registrations.find(item => item.language === language)
  if (!entry) throw new Error(`no completion provider registered for ${language}`)
  return entry.provider as Provider
}

function modelFor(word: string, line = word) {
  return {
    getWordUntilPosition: () => ({ word, startColumn: 1, endColumn: 1 + word.length }),
    getLineContent: () => line,
    getValue: () => line,
  }
}

function suggestionsFor(language: string, word: string, triggerKind = 0, line = word): Suggestion[] {
  const position = { lineNumber: 1, column: line.length + 1 }
  return providerFor(language).provideCompletionItems(
    modelFor(word, line),
    position,
    { triggerKind },
  ).suggestions
}

beforeAll(async () => {
  await import('./registerLocalCompletions')
})

describe('local completions', () => {
  it('registers a provider for every language the editor exposes', () => {
    const registered = new Set(registrations.map(item => item.language))
    for (const language of new Set(Object.values(MONACO_LANGUAGES))) {
      expect(registered.has(language)).toBe(true)
    }
  })

  it('offers the keywords the offline editor promises', () => {
    // The e2e flow types `ret` and expects to see the widget: a candidate list
    // without `return` would make that flow time out.
    const labels = suggestionsFor('python', 'ret').map(item => item.label)
    expect(labels).toContain('return')
  })

  it('marks placeholder templates as snippets so they expand', () => {
    const range = suggestionsFor('python', 'ran').find(item => item.label === 'range')
    expect(range?.insertTextRules).toBe(4)
    expect(range?.insertText).toContain('${1:')

    const plain = suggestionsFor('python', 'ret').find(item => item.label === 'return')
    expect(plain?.insertTextRules).toBeUndefined()
  })

  it('does not offer unrelated candidates after a member-access dot', () => {
    // `self.` has no word to complete; suggesting `for`/`range` here would
    // insert `self.range(${1:n})`.
    expect(suggestionsFor('python', '', 1)).toHaveLength(0)
  })

  it('offers C++ STL member methods after a dot', () => {
    const labels = suggestionsFor('cpp', '', 1, 'vector.').map(item => item.label)
    expect(labels).toEqual(expect.arrayContaining(['size', 'push_back', 'begin', 'erase']))
  })

  it('offers C++ STL types and algorithms after std::', () => {
    const labels = suggestionsFor('cpp', '', 0, 'std::').map(item => item.label)
    expect(labels).toEqual(expect.arrayContaining(['vector', 'unordered_map', 'sort', 'lower_bound']))
  })

  it('offers priority queue operations after a member-access arrow', () => {
    const labels = suggestionsFor('cpp', '', 1, 'priority_queue->').map(item => item.label)
    expect(labels).toEqual(expect.arrayContaining(['top', 'push', 'pop', 'empty']))
  })

  it('infers a declared container variable before its member access', () => {
    const labels = suggestionsFor('cpp', '', 1, 'vector<int> nums; nums.').map(item => item.label)
    expect(labels).toEqual(expect.arrayContaining(['size', 'push_back', 'begin']))
  })
})
