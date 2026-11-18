/**
 * SlidingWindow — sliding window visualization.
 * Agent provides: array (numbers), steps ([{left, right, note}])
 */
import React from 'react'
import { AbsoluteFill, Easing } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'
import { sequenceDurationInFrames, slide, springIn, useStepSequence } from '../motion'
import { C } from '../theme'

export interface WindowStep { left: number; right: number; note?: string }
export interface SlidingWindowProps {
  title?: string
  array?: number[]
  steps?: WindowStep[]
}

export const DEFAULT_WINDOW_ARRAY = [1, 3, -1, -3, 5, 3, 6, 7]
export const DEFAULT_WINDOW_STEPS: WindowStep[] = [
  { left: 0, right: 2, note: '窗口 [0,2]: sum=3' },
  { left: 0, right: 3, note: '右指针右移' },
  { left: 1, right: 3, note: '左指针右移，收缩窗口' },
  { left: 1, right: 5, note: '右指针扩展' },
  { left: 2, right: 5, note: '左指针收缩' },
  { left: 2, right: 7, note: '找到最大和窗口' },
]

export const slidingWindowFrames = (props: SlidingWindowProps, fps: number) =>
  sequenceDurationInFrames((props.steps ?? DEFAULT_WINDOW_STEPS).length, fps)

export const SlidingWindow: React.FC<SlidingWindowProps> = ({
  title = '滑动窗口',
  array = DEFAULT_WINDOW_ARRAY,
  steps = DEFAULT_WINDOW_STEPS,
}) => {
  const seq = useStepSequence(steps.length)
  const current = steps[seq.index] ?? { left: 0, right: 0 }
  const previous = steps[Math.max(0, seq.index - 1)] ?? current
  const left = slide(seq.progress, previous.left, current.left, Easing.out(Easing.cubic))
  const right = slide(seq.progress, previous.right, current.right, Easing.out(Easing.cubic))

  const cellW = 72
  const cellH = 72
  const gap = 8
  const totalW = array.length * (cellW + gap) - gap
  const startX = (1280 - totalW) / 2
  const startY = 300
  const titleIn = springIn(seq.frame, seq.fps, 0)
  const noteIn = springIn(seq.frame, seq.fps, seq.introFrame + seq.index * seq.framesPerStep)

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div
        style={{
          position: 'absolute', top: 32, left: 0, right: 0, textAlign: 'center',
          color: C.text, fontSize: 28, fontWeight: 700,
          opacity: titleIn, transform: `translateY(${(1 - titleIn) * 8}px)`,
        }}
      >
        {title}
      </div>

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* The window rect slides between steps instead of jumping. */}
        <rect
          x={startX + left * (cellW + gap) - 6}
          y={startY - 6}
          width={Math.max(0, (right - left + 1) * (cellW + gap) - gap + 12)}
          height={cellH + 12}
          fill={`${C.visited}22`}
          stroke={C.accent}
          strokeWidth={2}
          rx={8}
        />

        {array.map((value, i) => {
          const x = startX + i * (cellW + gap)
          const inWindow = i >= current.left && i <= current.right
          const enter = springIn(seq.frame, seq.fps, 4 + i * 3)
          return (
            <g key={i} opacity={enter} transform={`translate(0 ${(1 - enter) * -10})`}>
              <rect
                x={x} y={startY} width={cellW} height={cellH}
                fill={inWindow ? C.panel : C.bg}
                stroke={i === Math.round(left) || i === Math.round(right) ? C.accent : C.border}
                strokeWidth={i === Math.round(left) || i === Math.round(right) ? 2 : 1}
                rx={6}
              />
              <text
                x={x + cellW / 2} y={startY + cellH / 2 + 7} textAnchor="middle"
                fill={inWindow ? C.text : C.muted} fontSize={22} fontWeight={600}
                fontFamily={MONO_FONT_STACK}
              >
                {value}
              </text>
              <text
                x={x + cellW / 2} y={startY + cellH + 24} textAnchor="middle"
                fill={C.muted} fontSize={12} fontFamily={MONO_FONT_STACK}
              >
                {i}
              </text>
            </g>
          )
        })}

        <text
          x={startX + left * (cellW + gap) + cellW / 2} y={startY - 20}
          textAnchor="middle" fill={C.accent} fontSize={14} fontFamily={MONO_FONT_STACK}
        >
          L
        </text>
        <text
          x={startX + right * (cellW + gap) + cellW / 2} y={startY - 20}
          textAnchor="middle" fill={C.accent} fontSize={14} fontFamily={MONO_FONT_STACK}
        >
          R
        </text>
      </svg>

      {current.note && (
        <div
          style={{
            position: 'absolute', bottom: 60, left: '50%',
            transform: `translateX(-50%) translateY(${(1 - noteIn) * 8}px)`,
            background: '#1f6feb22', border: `1px solid ${C.accent}`,
            borderRadius: 8, padding: '8px 28px', color: C.accent, fontSize: 18,
            whiteSpace: 'nowrap', opacity: noteIn,
          }}
        >
          {current.note}
        </div>
      )}
    </AbsoluteFill>
  )
}
