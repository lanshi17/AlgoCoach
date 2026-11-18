/**
 * TwoPointer — two-pointer technique visualization.
 * Same grid as SlidingWindow, with the semantic action color animating
 * between steps (shrink → warning, expand → accent, found → success).
 */
import React from 'react'
import { AbsoluteFill, Easing, interpolateColors } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'
import { sequenceDurationInFrames, slide, springIn, useStepSequence } from '../motion'
import { C } from '../theme'

export type PointerAction = 'init' | 'shrink' | 'expand' | 'found'

export interface PointerStep { left: number; right: number; action: PointerAction; note?: string }
export interface TwoPointerProps {
  title?: string
  array?: number[]
  steps?: PointerStep[]
}

export const DEFAULT_POINTER_ARRAY = [-2, -1, 0, 1, 2, 3, 4, 5]
export const DEFAULT_POINTER_STEPS: PointerStep[] = [
  { left: 0, right: 7, action: 'init', note: 'left=0, right=7, sum=3 > target' },
  { left: 0, right: 6, action: 'shrink', note: '和太大，右指针左移' },
  { left: 1, right: 6, action: 'expand', note: '和太小，左指针右移' },
  { left: 2, right: 5, action: 'found', note: '找到目标！' },
]

const ACTION_COLOR: Record<PointerAction, string> = {
  init: C.accent,
  shrink: C.warning,
  expand: C.accent,
  found: C.success,
}

export const twoPointerFrames = (props: TwoPointerProps, fps: number) =>
  sequenceDurationInFrames((props.steps ?? DEFAULT_POINTER_STEPS).length, fps)

export const TwoPointer: React.FC<TwoPointerProps> = ({
  title = '双指针',
  array = DEFAULT_POINTER_ARRAY,
  steps = DEFAULT_POINTER_STEPS,
}) => {
  const seq = useStepSequence(steps.length)
  const current = steps[seq.index] ?? { left: 0, right: 0, action: 'init' as const }
  const previous = steps[Math.max(0, seq.index - 1)] ?? current
  const left = slide(seq.progress, previous.left, current.left, Easing.out(Easing.cubic))
  const right = slide(seq.progress, previous.right, current.right, Easing.out(Easing.cubic))
  const accent = interpolateColors(
    seq.index === 0 ? 1 : seq.eased,
    [0, 1],
    [ACTION_COLOR[previous.action], ACTION_COLOR[current.action]],
  )
  const isFound = current.action === 'found'

  const cellW = 76
  const cellH = 76
  const gap = 10
  const totalW = array.length * (cellW + gap) - gap
  const startX = (1280 - totalW) / 2
  const startY = 290
  const titleIn = springIn(seq.frame, seq.fps, 0)

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
        {array.map((value, i) => {
          const x = startX + i * (cellW + gap)
          const between = i >= current.left && i <= current.right
          const isLeft = i === current.left
          const isRight = i === current.right
          const enter = springIn(seq.frame, seq.fps, 4 + i * 3)
          return (
            <g key={i} opacity={enter} transform={`translate(0 ${(1 - enter) * -10})`}>
              <rect
                x={x} y={startY} width={cellW} height={cellH} rx={6}
                fill={isFound && between ? '#1a3a1a' : between ? C.panel : C.bg}
                stroke={isFound && between ? C.success : isLeft || isRight ? accent : C.border}
                strokeWidth={isLeft || isRight ? 2.5 : 1}
              />
              <text
                x={x + cellW / 2} y={startY + cellH / 2 + 8} textAnchor="middle"
                fill={between ? C.text : C.muted} fontSize={22} fontWeight={600}
                fontFamily={MONO_FONT_STACK}
              >
                {value}
              </text>
              {isLeft && (
                <text x={x + cellW / 2} y={startY - 16} textAnchor="middle" fill={accent} fontSize={14} fontFamily={MONO_FONT_STACK}>
                  L →
                </text>
              )}
              {isRight && (
                <text x={x + cellW / 2} y={startY - 16} textAnchor="middle" fill={accent} fontSize={14} fontFamily={MONO_FONT_STACK}>
                  ← R
                </text>
              )}
            </g>
          )
        })}
        {/* The window spans the moving pointers while they travel. */}
        <rect
          x={startX + left * (cellW + gap) - 8}
          y={startY + cellH + 6}
          width={Math.max(0, (right - left + 1) * (cellW + gap) - gap + 16)}
          height={4}
          rx={2}
          fill={accent}
          opacity={0.8}
        />
      </svg>
      {current.note && (
        <div
          style={{
            position: 'absolute', bottom: 60, left: '50%',
            transform: `translateX(-50%) translateY(${(1 - seq.eased) * 6}px)`,
            background: isFound ? '#3fb95022' : '#1f6feb22',
            border: `1px solid ${accent}`,
            borderRadius: 8, padding: '8px 28px', color: accent, fontSize: 18,
            whiteSpace: 'nowrap',
          }}
        >
          {current.note}
        </div>
      )}
    </AbsoluteFill>
  )
}
