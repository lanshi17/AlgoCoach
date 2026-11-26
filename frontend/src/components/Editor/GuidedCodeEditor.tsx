import { Suspense, lazy } from 'react'
import { RotateCcw } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { LANGUAGE_OPTIONS, MONACO_LANGUAGES } from '@/services/languages'
import { isGuidedCodeTemplate } from '@/services/guidedCodeTemplates'
import type { CodeLanguage } from '@/types'

const MonacoEditor = lazy(() => import('./MonacoCodeEditor'))

const FILE_EXTENSIONS: Record<CodeLanguage, string> = {
  rust: 'rs',
  cpp: 'cpp',
  python3: 'py',
  typescript: 'ts',
  golang: 'go',
  java: 'java',
}

interface GuidedCodeEditorProps {
  code: string
  language: CodeLanguage
  disabled: boolean
  busy: boolean
  submitted: boolean
  /** FOCUS silences the coach, so assessment submission is unavailable while code stays editable. */
  focusQuiet?: boolean
  onChange: (code: string) => void
  onLanguageChange: (language: CodeLanguage) => void
  onResetTemplate: () => void
  onSubmit: () => void
}

/** Dedicated code surface for the programming stage of guided learning. */
export default function GuidedCodeEditor({
  code, language, disabled, busy, submitted, focusQuiet = false, onChange, onLanguageChange, onResetTemplate, onSubmit,
}: GuidedCodeEditorProps) {
  const theme = useAppStore(state => state.theme)
  const languageLabel = LANGUAGE_OPTIONS.find(option => option.value === language)?.label ?? language
  const lineCount = code.trim() ? code.split('\n').length : 1
  const templateOnly = isGuidedCodeTemplate(code)
  const locked = disabled || submitted

  return (
    <div className="code-workbench flex h-full min-h-0 flex-col" aria-label="编程作答区">
      <div className="code-toolbar">
        <div className="code-toolbar-title whitespace-nowrap">
          <span>代码区</span>
          <span className="code-file max-w-[112px]">solution.{FILE_EXTENSIONS[language]}</span>
        </div>
        <select
          aria-label="编程语言"
          value={language}
          disabled={locked}
          onChange={event => onLanguageChange(event.target.value as CodeLanguage)}
          className="h-7 shrink-0 rounded-[4px] border px-1.5 text-[11px] outline-none disabled:opacity-60"
          style={{
            borderColor: 'var(--code-rule)',
            background: 'var(--code-panel-raised)',
            color: 'var(--code-ink)',
          }}
        >
          {LANGUAGE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="code-surface">
        <Suspense fallback={<div className="grid h-full place-items-center text-xs" style={{ color: 'var(--code-muted)' }}>正在打开代码编辑器…</div>}>
          <MonacoEditor
            height="100%"
            language={MONACO_LANGUAGES[language]}
            value={code}
            onChange={value => onChange(value ?? '')}
            theme={theme === 'dark' ? 'algocoach-ink' : 'algocoach-paper'}
            options={{
              ariaLabel: '编程题代码编辑器',
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              readOnly: locked,
              renderLineHighlight: 'line',
              cursorStyle: 'line',
              suggestOnTriggerCharacters: true,
              quickSuggestions: locked ? false : { other: true, comments: false, strings: false },
              wordBasedSuggestions: locked ? 'off' : 'currentDocument',
              suggest: { preview: true, snippetsPreventQuickSuggestions: false },
              tabSize: 4,
              padding: { top: 12, bottom: 12 },
              folding: true,
              renderWhitespace: 'none',
            }}
          />
        </Suspense>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel)', color: 'var(--code-muted)' }}>
        <span>{languageLabel} · {lineCount} 行 · {submitted ? '已通过' : focusQuiet ? '专注模式 · 教练静默' : templateOnly ? '待实现模板' : '草稿自动保留'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`恢复 ${languageLabel} 模板会覆盖当前代码，继续？`)) onResetTemplate()
            }}
            disabled={locked || busy || templateOnly}
            title={templateOnly ? '当前已经是初始模板' : `恢复 ${languageLabel} 初始模板`}
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 disabled:opacity-50"
            style={{ borderColor: 'var(--code-rule)', background: 'var(--code-panel-raised)', color: 'var(--code-ink)' }}
          >
            <RotateCcw size={12} />恢复模板
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={locked || busy || !code.trim() || templateOnly || focusQuiet}
            title={focusQuiet ? '专注模式下教练静默，结束专注后提交代码' : templateOnly ? '请先在模板基础上实现解法' : undefined}
            className="rounded-md bg-ink-950 px-3 py-1.5 font-medium text-canvas transition-colors hover:bg-accent disabled:opacity-50"
          >
            {busy ? '教练评估中…' : submitted ? '已通过' : focusQuiet ? '专注中不可提交' : '提交代码'}
          </button>
        </div>
      </div>
    </div>
  )
}
