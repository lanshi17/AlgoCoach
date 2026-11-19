import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ChatMessage from './ChatMessage'
import type { ChatMessage as Msg } from '@/types'

function markup(content: string, role: Msg['role'] = 'agent') {
  return renderToStaticMarkup(
    <ChatMessage message={{ id: 'm1', role, content, timestamp: 'now' }} />,
  )
}

describe('ChatMessage math rendering', () => {
  it('renders the complete long response without hiding its final lines', () => {
    const content = Array.from({ length: 220 }, (_, index) => `第 ${index + 1} 行`).join('\n\n')
    const html = markup(content)
    expect(html).toContain('第 220 行')
    expect(html).not.toContain('展开剩余')
  })

  it('renders inline LaTeX as KaTeX instead of raw dollar signs', () => {
    const html = markup('复杂度是 $O(n\\log n)$。')
    expect(html).toContain('class="katex"')
    expect(html).not.toContain('$O(n\\log n)$')
  })

  it('renders display math in a scrollable block', () => {
    const html = markup('$$\n\\sum_{i=1}^{n} a_i = \\frac{n(n+1)}{2}\n$$')
    expect(html).toContain('katex-display')
    expect(html).not.toContain('$$')
  })

  it('keeps malformed LaTeX from breaking the message', () => {
    const html = markup('坏公式 $\\frac{1}{$ 也要显示')
    expect(html).toContain('坏公式')
    expect(html).toContain('katex-error')
  })

  it('leaves dollar signs in code blocks untouched', () => {
    const html = markup('```bash\necho $HOME\n```')
    expect(html).toContain('$HOME')
    expect(html).not.toContain('class="katex"')
  })

  it('renders a repair action on system errors', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ChatMessage message={{
          id: 'system', role: 'system', content: '需要配置 Provider', timestamp: 'now',
          action: { href: '/settings', label: '配置模型 Provider' },
        }} />
      </MemoryRouter>,
    )
    expect(html).toContain('href="/settings"')
    expect(html).toContain('配置模型 Provider')
  })

  it('announces failed turns as alerts while keeping normal system notices polite', () => {
    const failed = renderToStaticMarkup(
      <ChatMessage message={{
        id: 'failure', role: 'system', content: '模型不可用', timestamp: 'now', retryMessageId: 'user-1',
      }} />,
    )
    const normal = renderToStaticMarkup(
      <ChatMessage message={{ id: 'notice', role: 'system', content: '已保存', timestamp: 'now' }} />,
    )
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('aria-live="assertive"')
    expect(normal).toContain('role="status"')
    expect(normal).toContain('aria-live="polite"')
  })
})
