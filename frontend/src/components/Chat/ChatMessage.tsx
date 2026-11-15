import React, { Suspense, lazy, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import type { ChatMessage as Msg } from '@/types'

const CodeBlock = lazy(() => import('./CodeBlock'))

export default function ChatMessage({ message }: { message: Msg }) {
  const { theme } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const isUser = message.role === 'user'
  const lines = message.content.split('\n')
  const isLong = !isUser && lines.length > 200
  const content = isLong && !expanded ? lines.slice(0, 200).join('\n') : message.content

  if (message.role === 'system') {
    return (
      <div className="text-xs text-center text-text-muted dark:text-text-dark-muted py-1">
        {message.content}
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center
                        text-white text-xs flex-shrink-0 mt-0.5 mr-2">AI</div>
      )}
      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-agent'}>
        {isUser ? (
          <p className="text-sm">{content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm max-w-none dark:prose-invert"
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
              }
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        {isLong && <button onClick={() => setExpanded(value => !value)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? '收起长消息' : `展开剩余 ${lines.length - 200} 行`}
        </button>}
      </div>
    </div>
  )
}
