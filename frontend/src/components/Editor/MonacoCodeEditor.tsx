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
  rules: [{ token: 'comment', foreground: '857B6E', fontStyle: 'italic' }],
  colors: {
    'editor.background': '#FBF9F3',
    'editor.foreground': '#302B25',
    'editor.lineHighlightBackground': '#F3EFE6',
    'editorLineNumber.foreground': '#A49A8D',
    'editorLineNumber.activeForeground': '#844B3C',
    'editorCursor.foreground': '#844B3C',
    'editor.selectionBackground': '#EAD8CE',
    'editorIndentGuide.background1': '#E9E2D7',
    'editorWidget.background': '#FBF9F3',
    'editorWidget.border': '#DDD5C8',
    'editorSuggestWidget.background': '#FBF9F3',
    'editorSuggestWidget.border': '#DDD5C8',
    'editorSuggestWidget.selectedBackground': '#EFE1D8',
    'editorSuggestWidget.selectedForeground': '#302B25',
  },
})

monaco.editor.defineTheme('algocoach-ink', {
  base: 'vs-dark',
  inherit: true,
  rules: [{ token: 'comment', foreground: '9E9382', fontStyle: 'italic' }],
  colors: {
    'editor.background': '#211F1A',
    'editor.foreground': '#EEE7DB',
    'editor.lineHighlightBackground': '#292720',
    'editorLineNumber.foreground': '#81776A',
    'editorLineNumber.activeForeground': '#C98F79',
    'editorCursor.foreground': '#D29A83',
    'editor.selectionBackground': '#544037',
    'editorIndentGuide.background1': '#39342C',
    'editorWidget.background': '#2A2721',
    'editorWidget.border': '#443D33',
    'editorSuggestWidget.background': '#2A2721',
    'editorSuggestWidget.border': '#443D33',
    'editorSuggestWidget.selectedBackground': '#40342C',
    'editorSuggestWidget.selectedForeground': '#EEE7DB',
  },
})

const globalWithMonacoWorker = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: () => Worker }
}
globalWithMonacoWorker.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

export default Editor
