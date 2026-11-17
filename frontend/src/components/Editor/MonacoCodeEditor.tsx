import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor'
import EditorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'

// `monaco-editor/editor` exposes the API without the contributions included
// by `editor.main`. Load completion UI and snippet insertion explicitly.
import 'monaco-editor/editor/contrib/suggest/browser/suggestController'
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2'
import './registerLocalCompletions'

// Register only the languages AlgoCoach exposes. The package root imports every
// Monaco language (and its optional language services); these granular
// definition entries keep the offline editor small while retaining local
// tokenization and suggestions for all six supported languages. TypeScript is
// intentionally syntax-only here; it does not need a language-service worker.
import 'monaco-editor/languages/definitions/cpp/register'
import 'monaco-editor/languages/definitions/go/register'
import 'monaco-editor/languages/definitions/java/register'
import 'monaco-editor/languages/definitions/python/register'
import 'monaco-editor/languages/definitions/rust/register'
import 'monaco-editor/languages/definitions/typescript/register'

// Use the bundled Monaco distribution instead of the loader's default CDN.
loader.config({ monaco })

monaco.editor.defineTheme('algocoach-paper', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '718096', fontStyle: 'italic' },
    { token: 'keyword', foreground: '2563EB' },
    { token: 'string', foreground: '0F766E' },
    { token: 'number', foreground: 'B45309' },
    { token: 'type', foreground: '6D28D9' },
    { token: 'predefined', foreground: '0E7490' },
    { token: 'delimiter', foreground: '475569' },
  ],
  colors: {
    'editor.background': '#F7F9FC',
    'editor.foreground': '#1F2D3D',
    'editor.lineHighlightBackground': '#EEF3F8',
    'editorLineNumber.foreground': '#8A99AA',
    'editorLineNumber.activeForeground': '#16708A',
    'editorCursor.foreground': '#16708A',
    'editor.selectionBackground': '#CFE7F0',
    'editor.inactiveSelectionBackground': '#E3EEF3',
    'editorIndentGuide.background1': '#E1E7EE',
    'editorIndentGuide.activeBackground1': '#C2D2E0',
    'editorBracketMatch.background': '#D9EEF4',
    'editorBracketMatch.border': '#7DBAC7',
    'editorWidget.background': '#FFFFFF',
    'editorWidget.border': '#CBD5E1',
    'editorSuggestWidget.background': '#FFFFFF',
    'editorSuggestWidget.border': '#CBD5E1',
    'editorSuggestWidget.selectedBackground': '#DCECF5',
    'editorSuggestWidget.selectedForeground': '#1F2D3D',
    'editorHoverWidget.background': '#FFFFFF',
    'editorHoverWidget.border': '#CBD5E1',
    'editorGutter.background': '#F7F9FC',
  },
})

monaco.editor.defineTheme('algocoach-ink', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '7F8EA3', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7DD3FC' },
    { token: 'string', foreground: 'A7F3D0' },
    { token: 'number', foreground: 'FCD34D' },
    { token: 'type', foreground: 'C4B5FD' },
    { token: 'predefined', foreground: '67E8F9' },
    { token: 'delimiter', foreground: 'B6C5D6' },
  ],
  colors: {
    'editor.background': '#0F1724',
    'editor.foreground': '#E3EDF7',
    'editor.lineHighlightBackground': '#172337',
    'editorLineNumber.foreground': '#687B92',
    'editorLineNumber.activeForeground': '#72D3EE',
    'editorCursor.foreground': '#72D3EE',
    'editor.selectionBackground': '#24465F',
    'editor.inactiveSelectionBackground': '#1B344A',
    'editorIndentGuide.background1': '#24354B',
    'editorIndentGuide.activeBackground1': '#3A5874',
    'editorBracketMatch.background': '#1A3A4A',
    'editorBracketMatch.border': '#4DA8C2',
    'editorWidget.background': '#19273A',
    'editorWidget.border': '#2B3B52',
    'editorSuggestWidget.background': '#19273A',
    'editorSuggestWidget.border': '#2B3B52',
    'editorSuggestWidget.selectedBackground': '#1F405A',
    'editorSuggestWidget.selectedForeground': '#E3EDF7',
    'editorHoverWidget.background': '#19273A',
    'editorHoverWidget.border': '#2B3B52',
    'editorGutter.background': '#0F1724',
  },
})

const globalWithMonacoWorker = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: () => Worker }
}
globalWithMonacoWorker.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

export default Editor
