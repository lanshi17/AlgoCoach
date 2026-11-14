import React, { Suspense, lazy, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import TestCasePanel from './TestCasePanel'
import SubmissionResult from './SubmissionResult'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const LANG_MAP: Record<string, string> = {
  rust: 'rust', cpp: 'cpp', python3: 'python',
}

/**
 * Middle panel: Monaco code editor + test case / result tabs below.
 *
 * FOCUS mode: editor is fully enabled.
 * IDLE / PREP: editor is read-only until user clicks "Start".
 */
export default function EditorPanel() {
  const { code, setCode, lang, theme, mode, activeProblem, enterFocus } = useAppStore()
  const editorRef = useRef<unknown>(null)

  // When a new problem loads, populate code from its snippet
  const handleEditorMount = (editor: unknown) => {
    editorRef.current = editor
  }

  const isEditable = mode === 'FOCUS' || mode === 'REVIEW'

  return (
    <div className="flex flex-col h-full">
      {/* Editor area */}
      <div className="flex-1 min-h-0 relative">
        {/* Not-started overlay */}
        {activeProblem && mode === 'PREP' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center
                          bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm">
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary mb-4">
              准备好了吗？点击开始，AI 将进入静默模式
            </p>
            <button
              onClick={enterFocus}
              className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white
                         text-sm font-medium transition-colors"
            >
              🔒 开始做题
            </button>
          </div>
        )}

        <Suspense fallback={<div className="grid h-full place-items-center text-xs text-text-muted dark:text-text-dark-muted">正在打开编辑器…</div>}>
        <MonacoEditor
          height="100%"
          language={LANG_MAP[lang]}
          value={code}
          onChange={v => setCode(v ?? '')}
          onMount={handleEditorMount}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            readOnly: !isEditable,
            renderLineHighlight: 'line',
            cursorStyle: 'line',
            suggestOnTriggerCharacters: true,
            quickSuggestions: isEditable,   // native editor suggestions only; no AI completion
            tabSize: 4,
            padding: { top: 12, bottom: 12 },
            folding: true,
            renderWhitespace: 'none',
          }}
        />
        </Suspense>
      </div>

      {/* Bottom tabs: test cases or submission result */}
      <div className="flex-shrink-0 border-t border-border dark:border-border-dark"
           style={{ height: '200px' }}>
        {mode === 'REVIEW' ? <SubmissionResult /> : <TestCasePanel />}
      </div>
    </div>
  )
}
