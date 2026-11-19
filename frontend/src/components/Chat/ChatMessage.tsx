import React, { Suspense, lazy } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useAppStore } from '@/stores/useAppStore'
import type { ChatMessage as Msg } from '@/types'
import 'katex/dist/katex.min.css'

const CodeBlock = lazy(() => import('./CodeBlock'))

/** Malformed LaTeX from the model must never blow up the whole conversation. */
const KATEX_OPTIONS = { throwOnError: false, strict: false as const }

export default function ChatMessage({ message }: { message: Msg }) {
  const theme = useAppStore(state => state.theme)
  const isUser = message.role === 'user'
  const isFailure = message.role === 'system' && Boolean(message.retryMessageId)
  const content = message.content

  if (message.role === 'system') {
    return (
      <div role={isFailure ? 'alert' : 'status'} aria-live={isFailure ? 'assertive' : 'polite'}
        className="flex items-center justify-center gap-2 py-1 text-xs text-text-muted dark:text-text-dark-muted">
        <span className="min-w-0 max-w-full break-words text-center">{message.content}</span>
        {message.action && <Link to={message.action.href} state={{ returnToChat: true }} className="shrink-0 text-accent hover:underline">
          {message.action.label}
        </Link>}
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      {!isUser && (
        <div aria-hidden="true" className="mt-1 mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center
                        rounded-full bg-accent-soft text-[9px] font-semibold text-accent dark:bg-accent-dark-soft">A</div>
      )}
      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-agent'}>
        {isUser ? (
          <p className="text-sm break-words">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return match ? (
                    <Suspense fallback={<pre className="overflow-x-auto text-xs">{String(children).replace(/\n$/, '')}</pre>}>
                      <CodeBlock theme={theme} language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
                    </Suspense>
                  ) : (
                    <code className="font-mono text-xs bg-surface-muted dark:bg-surface-dark-muted
                                     px-1.5 py-0.5 rounded" {...props}>
                      {children}
                    </code>
                  )
                },
                // Wide display math scrolls inside the bubble instead of
                // stretching the chat panel.
                table({ children }) {
                  return (
                    <div className="max-w-full overflow-x-auto">
                      <table>{children}</table>
                    </div>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
