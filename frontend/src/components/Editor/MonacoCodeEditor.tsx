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
    { token: 'comment', foreground: '8E96A7', fontStyle: 'italic' },
    { token: 'keyword', foreground: '4A47D8' },
    { token: 'string', foreground: '2C7A58' },
    { token: 'number', foreground: 'A66B00' },
    { token: 'type', foreground: '6B4FC7' },
    { token: 'predefined', foreground: '237A96' },
    { token: 'delimiter', foreground: '535B6B' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#111317',
    'editor.lineHighlightBackground': '#F2F4F8',
    'editorLineNumber.foreground': '#A4AABB',
    'editorLineNumber.activeForeground': '#5B58FF',
    'editorCursor.foreground': '#5B58FF',
    'editor.selectionBackground': '#E0DFFF',
    'editor.inactiveSelectionBackground': '#F0F0FF',
    'editorIndentGuide.background1': '#E6E9EF',
    'editorIndentGuide.activeBackground1': '#D1D7E2',
    'editorBracketMatch.background': '#F2F3FF',
    'editorBracketMatch.border': '#B9B8FF',
    'editorWidget.background': '#FFFFFF',
    'editorWidget.border': '#E6E9EF',
    'editorSuggestWidget.background': '#FFFFFF',
    'editorSuggestWidget.border': '#E6E9EF',
    'editorSuggestWidget.selectedBackground': '#F2F3FF',
    'editorSuggestWidget.selectedForeground': '#111317',
    'editorHoverWidget.background': '#FFFFFF',
    'editorHoverWidget.border': '#E6E9EF',
    'editorGutter.background': '#FFFFFF',
  },
})

monaco.editor.defineTheme('algocoach-ink', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8E96A7', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9B99FF' },
    { token: 'string', foreground: '8DCFAA' },
    { token: 'number', foreground: 'E0B56C' },
    { token: 'type', foreground: 'C2B4FF' },
    { token: 'predefined', foreground: '7DD0E7' },
    { token: 'delimiter', foreground: 'B7BFCE' },
  ],
  colors: {
    'editor.background': '#111317',
    'editor.foreground': '#F8F9FC',
    'editor.lineHighlightBackground': '#171A21',
    'editorLineNumber.foreground': '#707889',
    'editorLineNumber.activeForeground': '#8784FF',
    'editorCursor.foreground': '#8784FF',
    'editor.selectionBackground': '#323263',
    'editor.inactiveSelectionBackground': '#23233E',
    'editorIndentGuide.background1': '#2A2E38',
    'editorIndentGuide.activeBackground1': '#454B5A',
    'editorBracketMatch.background': '#23233E',
    'editorBracketMatch.border': '#6764E5',
    'editorWidget.background': '#1D222B',
    'editorWidget.border': '#2A2E38',
    'editorSuggestWidget.background': '#1D222B',
    'editorSuggestWidget.border': '#2A2E38',
    'editorSuggestWidget.selectedBackground': '#23233E',
    'editorSuggestWidget.selectedForeground': '#F8F9FC',
    'editorHoverWidget.background': '#1D222B',
    'editorHoverWidget.border': '#2A2E38',
    'editorGutter.background': '#111317',
  },
})

const globalWithMonacoWorker = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: () => Worker }
}
globalWithMonacoWorker.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

export default Editor
