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

// Monaco cannot consume CSS variables in a theme. These values mirror the
// `--code-*` palette in index.css; keep the two in sync.
monaco.editor.defineTheme('algocoach-paper', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6B7380', fontStyle: 'italic' },
    { token: 'keyword', foreground: '4A45E8' },
    { token: 'string', foreground: '2C7A58' },
    { token: 'number', foreground: '8F5B00' },
    { token: 'type', foreground: '6B4FC7' },
    { token: 'predefined', foreground: '237A96' },
    { token: 'delimiter', foreground: '535B6B' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#15171B',
    'editor.lineHighlightBackground': '#FAFAFB',
    'editorLineNumber.foreground': '#646B78',
    'editorLineNumber.activeForeground': '#4A45E8',
    'editorCursor.foreground': '#4A45E8',
    'editor.selectionBackground': '#E4E2FD',
    'editor.inactiveSelectionBackground': '#F2F1FE',
    'editorIndentGuide.background1': '#E2E4E8',
    'editorIndentGuide.activeBackground1': '#D6DAE0',
    'editorBracketMatch.background': '#EEEDFD',
    'editorBracketMatch.border': '#B9B7F7',
    'editorWidget.background': '#FFFFFF',
    'editorWidget.border': '#E2E4E8',
    'editorSuggestWidget.background': '#FFFFFF',
    'editorSuggestWidget.border': '#E2E4E8',
    'editorSuggestWidget.selectedBackground': '#EEEDFD',
    'editorSuggestWidget.selectedForeground': '#15171B',
    'editorHoverWidget.background': '#FFFFFF',
    'editorHoverWidget.border': '#E2E4E8',
    'editorGutter.background': '#FFFFFF',
  },
})

monaco.editor.defineTheme('algocoach-ink', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8E96A7', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9A96FF' },
    { token: 'string', foreground: '8DCFAA' },
    { token: 'number', foreground: 'E0B56C' },
    { token: 'type', foreground: 'C2B4FF' },
    { token: 'predefined', foreground: '7DD0E7' },
    { token: 'delimiter', foreground: 'B7BFCE' },
  ],
  colors: {
    'editor.background': '#121417',
    'editor.foreground': '#F5F6F8',
    'editor.lineHighlightBackground': '#171A1E',
    'editorLineNumber.foreground': '#7C838D',
    'editorLineNumber.activeForeground': '#9A96FF',
    'editorCursor.foreground': '#9A96FF',
    'editor.selectionBackground': '#2E2C55',
    'editor.inactiveSelectionBackground': '#232640',
    'editorIndentGuide.background1': '#292D33',
    'editorIndentGuide.activeBackground1': '#444A52',
    'editorBracketMatch.background': '#262540',
    'editorBracketMatch.border': '#6A66E0',
    'editorWidget.background': '#1D2126',
    'editorWidget.border': '#292D33',
    'editorSuggestWidget.background': '#1D2126',
    'editorSuggestWidget.border': '#292D33',
    'editorSuggestWidget.selectedBackground': '#262540',
    'editorSuggestWidget.selectedForeground': '#F5F6F8',
    'editorHoverWidget.background': '#1D2126',
    'editorHoverWidget.border': '#292D33',
    'editorGutter.background': '#121417',
  },
})

const globalWithMonacoWorker = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: () => Worker }
}
globalWithMonacoWorker.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

export default Editor
