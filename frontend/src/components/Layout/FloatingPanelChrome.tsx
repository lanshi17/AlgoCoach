import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { GripVertical, Maximize2, Minimize2, PanelTop } from 'lucide-react'
import type { FloatRect } from './floatingPanel'

interface FloatingPanelChromeProps {
  title: string
  rect: FloatRect
  onRectChange: (rect: FloatRect) => void
  onDock: () => void
  onActivate?: () => void
  maximized?: boolean
  onToggleMaximize?: () => void
}

/** Drag bar for a detached workspace panel. */
export default function FloatingPanelChrome({
  title, rect, onRectChange, onDock, onActivate, maximized = false, onToggleMaximize,
}: FloatingPanelChromeProps) {
  const drag = useRef<{ startX: number; startY: number; rect: FloatRect } | null>(null)

  useEffect(() => () => { document.body.classList.remove('is-moving-panel') }, [])

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (maximized || event.button !== 0) return
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
    drag.current = { startX: event.clientX, startY: event.clientY, rect }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    document.body.classList.add('is-moving-panel')
    onActivate?.()
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const { startX, startY, rect: startRect } = drag.current
    onRectChange({
      ...startRect,
      x: Math.round(Math.max(8, Math.min(startRect.x + event.clientX - startX, window.innerWidth - 120))),
      y: Math.round(Math.max(8, Math.min(startRect.y + event.clientY - startY, window.innerHeight - 120))),
    })
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    document.body.classList.remove('is-moving-panel')
  }

  const moveByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (maximized || event.target !== event.currentTarget) return
    const dx = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0
    const dy = event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0
    if (!dx && !dy) return
    event.preventDefault()
    onActivate?.()
    onRectChange({
      ...rect,
      x: Math.round(Math.max(8, Math.min(rect.x + dx, window.innerWidth - 120))),
      y: Math.round(Math.max(8, Math.min(rect.y + dy, window.innerHeight - 120))),
    })
  }

  return (
    <div
      tabIndex={0}
      aria-label={`${title}浮窗拖动条`}
      aria-roledescription="可拖动面板标题栏"
      className={`flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface-muted px-3 text-xs text-text-secondary dark:border-border-dark dark:bg-surface-dark-muted dark:text-text-dark-secondary ${maximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={moveByKeyboard}
    >
      <GripVertical size={14} className="shrink-0 opacity-60" />
      <span className="truncate font-medium text-text-primary dark:text-text-dark-primary">{title}</span>
      <span className="ml-auto hidden text-[10px] text-text-muted sm:inline dark:text-text-dark-muted">{maximized ? '最大化中' : '拖动标题栏移动'}</span>
      {onToggleMaximize && (
        <button
          type="button"
          onClick={onToggleMaximize}
          aria-label={`${maximized ? '还原' : '最大化'}${title}浮窗`}
          title={maximized ? `还原${title}浮窗` : `最大化${title}浮窗`}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-border p-1 text-text-secondary transition-colors hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary"
        >
          {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      )}
      <button
        type="button"
        onClick={onDock}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary"
      >
        <PanelTop size={12} />嵌入布局
      </button>
    </div>
  )
}
