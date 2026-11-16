/**
 * TwoPointer — two-pointer technique visualization.
 * Similar to SlidingWindow but with explicit left/right pointer movement logic.
 */
import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'

interface Step { left: number; right: number; action: string; note?: string }
interface Props { title?: string; array?: number[]; steps?: Step[] }

const DEMO = {
  array: [-2, -1, 0, 1, 2, 3, 4, 5],
  steps: [
    { left: 0, right: 7, action: 'init',  note: 'left=0, right=7, sum=3 > target' },
    { left: 0, right: 6, action: 'shrink', note: '和太大，右指针左移' },
    { left: 1, right: 6, action: 'expand', note: '和太小，左指针右移' },
    { left: 2, right: 5, action: 'found',  note: '找到目标！' },
  ],
}

export const TwoPointer: React.FC<Props> = ({
  title = '双指针',
  array = DEMO.array,
  steps = DEMO.steps,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const framesPerStep = Math.floor(durationInFrames / (steps.length + 1))
  const stepIdx = Math.min(Math.floor(frame / framesPerStep), steps.length - 1)
  const { left, right, action, note } = steps[stepIdx] ?? { left: 0, right: 0, action: 'init' }

  const cellW = 76; const cellH = 76; const gap = 10
  const totalW = array.length * (cellW + gap) - gap
  const startX = (1280 - totalW) / 2; const startY = 290

  const C = { bg: '#0d1117', text: '#e6edf3', muted: '#8b949e', accent: '#58a6ff', found: '#3fb950', border: '#30363d' }
  const isFound = action === 'found'

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0, textAlign: 'center', color: C.text, fontSize: 28, fontWeight: 700 }}>
        {title}
      </div>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {array.map((v, i) => {
          const x = startX + i * (cellW + gap)
          const isL = i === left; const isR = i === right
          const between = i >= left && i <= right
          const fill = isFound && between ? '#1a3a1a' : between ? '#161b22' : C.bg
          const stroke = isFound && between ? C.found : (isL || isR) ? C.accent : C.border
          return (
            <g key={i}>
              <rect x={x} y={startY} width={cellW} height={cellH} fill={fill} stroke={stroke} strokeWidth={(isL || isR) ? 2.5 : 1} rx={6} />
              <text x={x + cellW / 2} y={startY + cellH / 2 + 8} textAnchor="middle" fill={between ? C.text : C.muted}
                fontSize={22} fontWeight={600} fontFamily={MONO_FONT_STACK}>{v}</text>
              {/* Pointer arrows */}
              {isL && <text x={x + cellW / 2} y={startY - 16} textAnchor="middle" fill={C.accent} fontSize={14} fontFamily={MONO_FONT_STACK}>L →</text>}
              {isR && <text x={x + cellW / 2} y={startY - 16} textAnchor="middle" fill={C.accent} fontSize={14} fontFamily={MONO_FONT_STACK}>← R</text>}
            </g>
          )
        })}
      </svg>
      {note && (
        <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          background: isFound ? '#3fb95022' : '#1f6feb22', border: `1px solid ${isFound ? C.found : C.accent}`,
          borderRadius: 8, padding: '8px 28px', color: isFound ? C.found : C.accent, fontSize: 18, whiteSpace: 'nowrap' }}>
          {note}
        </div>
      )}
    </AbsoluteFill>
  )
}
