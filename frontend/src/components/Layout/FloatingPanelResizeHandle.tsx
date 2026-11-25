import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { FloatRect } from './floatingPanel'

interface FloatingPanelResizeHandleProps {
  rect: FloatRect
  label: string
  minWidth?: number
  minHeight?: number
  onResize: (rect: FloatRect) => void
}

const KEYBOARD_STEP = 16

/** Bottom-right resize grip for a detached panel. Keeps x/y fixed. */
export default function FloatingPanelResizeHandle({
  rect, label, minWidth = 320, minHeight = 240, onResize,
}: FloatingPanelResizeHandleProps) {
  const drag = useRef<{ startX: number; startY: number; rect: FloatRect } | null>(null)

  useEffect(() => () => { document.body.classList.remove('is-resizing-floating-panel') }, [])

  const sizeFor = (width: number, height: number): FloatRect => ({
    ...rect,
    width: Math.round(Math.min(Math.max(width, minWidth), Math.max(minWidth, window.innerWidth - rect.x - 8))),
    height: Math.round(Math.min(Math.max(height, minHeight), Math.max(minHeight, window.innerHeight - rect.y - 8))),
  })

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    drag.current = { startX: event.clientX, startY: event.clientY, rect }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    document.body.classList.add('is-resizing-floating-panel')
  }

  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const { startX, startY, rect: startRect } = drag.current
    onResize(sizeFor(startRect.width + event.clientX - startX, startRect.height + event.clientY - startY))
  }

  const endResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    document.body.classList.remove('is-resizing-floating-panel')
  }

  const resizeByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const grow = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const next = grow ? KEYBOARD_STEP : -KEYBOARD_STEP
    const width = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? rect.width + next : rect.width
    const height = event.key === 'ArrowUp' || event.key === 'ArrowDown' ? rect.height + next : rect.height
    onResize(sizeFor(width, height))
  }

  return (
    <div
      role="separator"
      aria-label={label}
      aria-valuenow={Math.round(rect.width)}
      aria-valuemin={minWidth}
      aria-valuemax={Math.max(minWidth, window.innerWidth - rect.x - 8)}
      tabIndex={0}
      onPointerDown={startResize}
      onPointerMove={resize}
      onPointerUp={endResize}
      onPointerCancel={endResize}
      onKeyDown={resizeByKeyboard}
      className="floating-resize-handle"
    />
  )
}
