import React, { Suspense, lazy, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { MONACO_LANGUAGES } from '@/services/languages'
import TestCasePanel from './TestCasePanel'
import SubmissionResult from './SubmissionResult'

const MonacoEditor = lazy(() => import('./MonacoCodeEditor'))

/**
 * Middle panel: Monaco code editor + test case / result tabs below.
 *
 * FOCUS mode: editor is fully enabled.
 * IDLE / PREP: editor is read-only until user clicks "Start".
 */
export default function EditorPanel() {
  const { code, setCode, lang, theme, mode, activeProblem, enterFocus, submitLoading } = useAppStore()
  const editorRef = useRef<unknown>(null)

  // When a new problem loads, populate code from its snippet
  const handleEditorMount = (editor: unknown) => {
    editorRef.current = editor
  }

  const isEditable = !submitLoading && (mode === 'FOCUS' || mode === 'REVIEW')

  return (
    <div className="flex flex-col h-full">
      {/* Editor area */}
      <div className="flex-1 min-h-0 relative">
        {submitLoading && <div role="status" className="absolute right-3 top-2 z-10 rounded bg-surface px-2 py-1 text-xs text-text-muted shadow dark:bg-surface-dark">提交中，编辑器暂时只读</div>}
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
          language={MONACO_LANGUAGES[lang]}
          value={code}
          onChange={v => setCode(v ?? '')}
          onMount={handleEditorMount}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            ariaLabel: '代码编辑器',
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
