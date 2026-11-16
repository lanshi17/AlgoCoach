/**
 * SlidingWindow — sliding window / two pointer array visualization.
 * Agent provides: array (numbers), steps ([{left, right, note}])
 */
import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'

interface WindowStep { left: number; right: number; note?: string }
interface Props {
  title?: string
  array?: number[]
  steps?: WindowStep[]
}

const DEMO = {
  array: [1, 3, -1, -3, 5, 3, 6, 7],
  steps: [
    { left: 0, right: 2, note: '窗口 [0,2]: sum=3' },
    { left: 0, right: 3, note: '右指针右移' },
    { left: 1, right: 3, note: '左指针右移，收缩窗口' },
    { left: 1, right: 5, note: '右指针扩展' },
    { left: 2, right: 5, note: '左指针收缩' },
    { left: 2, right: 7, note: '找到最大和窗口' },
  ],
}

export const SlidingWindow: React.FC<Props> = ({
  title = '滑动窗口',
  array = DEMO.array,
  steps = DEMO.steps,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const framesPerStep = Math.floor(durationInFrames / (steps.length + 1))
  const stepIdx = Math.min(Math.floor(frame / framesPerStep), steps.length - 1)
  const { left, right, note } = steps[stepIdx] ?? { left: 0, right: 0 }

  const cellW = 72
  const cellH = 72
  const gap = 8
  const totalW = array.length * (cellW + gap) - gap
  const startX = (1280 - totalW) / 2
  const startY = 300

  const C = { bg: '#0d1117', text: '#e6edf3', muted: '#8b949e', accent: '#58a6ff', window: '#1f6feb', border: '#30363d' }

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0, textAlign: 'center', color: C.text, fontSize: 28, fontWeight: 700 }}>
        {title}
      </div>

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* Window highlight background */}
        {left <= right && (
          <rect
            x={startX + left * (cellW + gap) - 6}
            y={startY - 6}
            width={(right - left + 1) * (cellW + gap) - gap + 12}
            height={cellH + 12}
            fill={`${C.window}22`}
            stroke={C.accent}
            strokeWidth={2}
            rx={8}
          />
        )}

        {/* Cells */}
        {array.map((v, i) => {
          const x = startX + i * (cellW + gap)
          const inWindow = i >= left && i <= right
          return (
            <g key={i}>
              <rect x={x} y={startY} width={cellW} height={cellH}
                fill={inWindow ? '#161b22' : C.bg}
                stroke={i === left || i === right ? C.accent : C.border}
                strokeWidth={i === left || i === right ? 2 : 1} rx={6} />
              <text x={x + cellW / 2} y={startY + cellH / 2 + 7} textAnchor="middle"
                fill={inWindow ? C.text : C.muted} fontSize={22} fontWeight={600}
                fontFamily={MONO_FONT_STACK}>
                {v}
              </text>
              {/* index */}
              <text x={x + cellW / 2} y={startY + cellH + 24} textAnchor="middle"
                fill={C.muted} fontSize={12} fontFamily={MONO_FONT_STACK}>
                {i}
              </text>
            </g>
          )
        })}

        {/* Pointer labels */}
        <text x={startX + left * (cellW + gap) + cellW / 2} y={startY - 20}
          textAnchor="middle" fill={C.accent} fontSize={14} fontFamily={MONO_FONT_STACK}>
          L
        </text>
        <text x={startX + right * (cellW + gap) + cellW / 2} y={startY - 20}
          textAnchor="middle" fill={C.accent} fontSize={14} fontFamily={MONO_FONT_STACK}>
          R
        </text>
      </svg>

      {/* Step note */}
      {note && (
        <div style={{
          position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          background: '#1f6feb22', border: '1px solid #58a6ff',
          borderRadius: 8, padding: '8px 28px', color: C.accent, fontSize: 18, whiteSpace: 'nowrap',
        }}>
          {note}
        </div>
      )}
    </AbsoluteFill>
  )
}
