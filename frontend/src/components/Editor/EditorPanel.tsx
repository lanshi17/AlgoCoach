import React, { Suspense, lazy, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/stores/useAppStore'
import { LANGUAGE_OPTIONS, MONACO_LANGUAGES } from '@/services/languages'
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
  const { activeProblem, code, codeEdited, setCode, lang, theme, mode, submitLoading } = useAppStore(useShallow(state => ({
    activeProblem: state.activeProblem,
    code: state.code,
    codeEdited: state.codeEdited,
    setCode: state.setCode,
    lang: state.lang,
    theme: state.theme,
    mode: state.mode,
    submitLoading: state.submitLoading,
  })))
  const editorRef = useRef<unknown>(null)

  // When a new problem loads, populate code from its snippet
  const handleEditorMount = (editor: unknown) => {
    editorRef.current = editor
  }

  const isEditable = !submitLoading && (mode === 'FOCUS' || mode === 'REVIEW')
  const languageLabel = LANGUAGE_OPTIONS.find(option => option.value === lang)?.label ?? lang
  const fileName = activeProblem ? `${activeProblem.platformId}.${fileExtension(lang)}` : '未命名代码'

  return (
    <div className="code-workbench flex h-full flex-col">
      <div className="code-toolbar" aria-label="代码工作区状态">
        <div className="code-toolbar-title">
          <span>代码区</span>
          <span className="code-file" title={fileName}>{fileName}</span>
        </div>
        <div className="code-toolbar-meta">
          <span>{languageLabel}</span>
          <span className="code-toolbar-status">{codeEdited ? '草稿已保存' : '题面模板'}</span>
          <span className="hidden sm:inline">{isEditable ? '可编辑' : '只读'}</span>
        </div>
      </div>
      {/* Editor area */}
      <div className="code-surface">
        {submitLoading && <div role="status" className="code-submit-notice">提交中，编辑器暂时只读</div>}

        <Suspense fallback={<div className="grid h-full place-items-center text-xs" style={{ color: 'var(--code-muted)' }}>正在打开编辑器…</div>}>
        <MonacoEditor
          height="100%"
          language={MONACO_LANGUAGES[lang]}
          value={code}
          onChange={v => setCode(v ?? '')}
          onMount={handleEditorMount}
          theme={theme === 'dark' ? 'algocoach-ink' : 'algocoach-paper'}
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
            quickSuggestions: isEditable ? { other: true, comments: false, strings: false } : false,
            wordBasedSuggestions: isEditable ? 'currentDocument' : 'off',
            suggest: { preview: true, snippetsPreventQuickSuggestions: false },
            tabSize: 4,
            padding: { top: 12, bottom: 12 },
            folding: true,
            renderWhitespace: 'none',
          }}
        />
        </Suspense>
      </div>

      {/* Bottom tabs: test cases or submission result */}
      <div className="code-output-shell flex-shrink-0" style={{ height: '200px' }}>
        {mode === 'REVIEW' ? <SubmissionResult /> : <TestCasePanel />}
      </div>
    </div>
  )
}

function fileExtension(language: string): string {
  return ({
    cpp: 'cpp', python3: 'py', rust: 'rs', typescript: 'ts', golang: 'go', java: 'java',
  } as Record<string, string>)[language] ?? 'txt'
}
