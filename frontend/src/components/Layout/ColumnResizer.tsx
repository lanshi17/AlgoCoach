import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

interface ColumnResizerProps {
  side: 'left' | 'right'
  width: number
  min: number
  max: number
  defaultWidth: number
  label: string
  variant?: 'guided' | 'workspace'
  onResize: (width: number) => void
}

const KEYBOARD_STEP = 16

/** Accessible divider that resizes the adjacent panel by mouse, touch or keyboard. */
export default function ColumnResizer({
  side, width, min, max, defaultWidth, label, variant = 'guided', onResize,
}: ColumnResizerProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const clamp = (value: number) => Math.round(Math.max(min, Math.min(max, value)))

  useEffect(() => () => { document.body.classList.remove('is-resizing-columns') }, [])

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    drag.current = { startX: event.clientX, startWidth: width }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    document.body.classList.add('is-resizing-columns')
  }

  const resizeDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const delta = event.clientX - drag.current.startX
    // A handle on the panel's right edge grows with a rightward drag; a handle
    // on its left edge grows with a leftward drag.
    onResize(clamp(drag.current.startWidth + (side === 'right' ? delta : -delta)))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    document.body.classList.remove('is-resizing-columns')
  }

  const resizeByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    onResize(clamp(width + direction * KEYBOARD_STEP * (side === 'right' ? 1 : -1)))
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={startDrag}
      onPointerMove={resizeDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={resizeByKeyboard}
      onDoubleClick={() => onResize(clamp(defaultWidth))}
      className={`column-resizer ${variant === 'workspace' ? 'workspace-resizer' : 'guided-resizer'} column-resizer-${side}`}
    />
  )
}
