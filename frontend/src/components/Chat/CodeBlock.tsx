import React, { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark'
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light'

const LANGUAGE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  bash: () => import('react-syntax-highlighter/dist/esm/languages/prism/bash'),
  cpp: () => import('react-syntax-highlighter/dist/esm/languages/prism/cpp'),
  go: () => import('react-syntax-highlighter/dist/esm/languages/prism/go'),
  golang: () => import('react-syntax-highlighter/dist/esm/languages/prism/go'),
  java: () => import('react-syntax-highlighter/dist/esm/languages/prism/java'),
  json: () => import('react-syntax-highlighter/dist/esm/languages/prism/json'),
  python: () => import('react-syntax-highlighter/dist/esm/languages/prism/python'),
  python3: () => import('react-syntax-highlighter/dist/esm/languages/prism/python'),
  rust: () => import('react-syntax-highlighter/dist/esm/languages/prism/rust'),
  ts: () => import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
  typescript: () => import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
}

const registeredLanguages = new Set<string>()

export default function CodeBlock({ children, theme, language }: { children: string; theme: 'light' | 'dark'; language: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [readyLanguage, setReadyLanguage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const normalized = language.toLowerCase()
    const loader = LANGUAGE_LOADERS[normalized]
    if (!loader) {
      setReadyLanguage('')
      return () => { active = false }
    }
    if (registeredLanguages.has(normalized)) {
      setReadyLanguage(normalized)
      return () => { active = false }
    }
    loader().then(module => {
      SyntaxHighlighter.registerLanguage(normalized, module.default as never)
      if (normalized === 'python3') SyntaxHighlighter.registerLanguage('python', module.default as never)
      if (normalized === 'golang') SyntaxHighlighter.registerLanguage('go', module.default as never)
      if (normalized === 'ts') SyntaxHighlighter.registerLanguage('typescript', module.default as never)
      registeredLanguages.add(normalized)
      if (active) setReadyLanguage(normalized)
    }).catch(() => { if (active) setReadyLanguage('') })
    return () => { active = false }
  }, [language])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('failed')
      window.setTimeout(() => setCopyState('idle'), 2400)
    }
  }

  const copyLabel = copyState === 'copied'
    ? '已复制代码'
    : copyState === 'failed'
      ? '复制失败，请检查剪贴板权限'
      : '复制代码'

  return <div className="group relative">
    <button onClick={() => void copy()} title={copyLabel} aria-label={copyLabel}
      className="absolute right-2 top-2 z-10 rounded border border-border bg-surface px-2 py-1
                 text-[10px] text-text-secondary opacity-0 transition-opacity hover:text-accent
                 focus:opacity-100 group-hover:opacity-100 dark:border-border-dark dark:bg-surface-dark
                 dark:text-text-dark-secondary">
      {copyState === 'copied' ? <Check size={13} /> : <Copy size={13} />}
    </button>
    <span role="status" aria-live="polite" className="sr-only">{copyState === 'failed' ? copyLabel : copyState === 'copied' ? copyLabel : ''}</span>
    {readyLanguage === null ? <pre className="overflow-x-auto rounded-md bg-surface-muted p-3 text-xs dark:bg-surface-dark-muted">{children}</pre> : readyLanguage ? (
      <SyntaxHighlighter style={theme === 'dark' ? oneDark : oneLight} language={readyLanguage} PreTag="div"
        customStyle={{ borderRadius: '6px', fontSize: '12px', margin: '8px 0' }}>
        {children}
      </SyntaxHighlighter>
    ) : <pre className="overflow-x-auto rounded-md bg-surface-muted p-3 text-xs dark:bg-surface-dark-muted">{children}</pre>}
  </div>
}
