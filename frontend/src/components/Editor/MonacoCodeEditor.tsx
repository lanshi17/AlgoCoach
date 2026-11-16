import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor'
import EditorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'
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

const globalWithMonacoWorker = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: () => Worker }
}
globalWithMonacoWorker.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

export default Editor
