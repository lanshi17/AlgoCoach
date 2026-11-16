/**
 * DpTable — 2D DP table fill visualization.
 * Agent provides: rows, cols, table (2D array), steps ([{r,c,val,note}])
 */
import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'

interface Step { r: number; c: number; val: number; note?: string }
interface Props {
  title?: string
  rowHeaders?: string[]
  colHeaders?: string[]
  table?: number[][]
  steps?: Step[]
}

const DEMO_TABLE = Array.from({ length: 5 }, () => Array(6).fill(0))
const DEMO_STEPS: Step[] = [
  { r: 0, c: 0, val: 0, note: '初始化' },
  { r: 1, c: 1, val: 1, note: 'dp[1][1] = 1' },
  { r: 1, c: 2, val: 2, note: 'dp[1][2] = 2' },
  { r: 2, c: 1, val: 1, note: 'dp[2][1] = 1' },
  { r: 2, c: 2, val: 3, note: 'dp[2][2] = dp[1][2]+dp[2][1]' },
  { r: 2, c: 3, val: 3, note: 'dp[2][3] = ...' },
  { r: 3, c: 2, val: 3 },
  { r: 3, c: 3, val: 6, note: 'dp[3][3] = 6' },
]

export const DpTable: React.FC<Props> = ({
  title = '动态规划 — 状态转移可视化',
  rowHeaders,
  colHeaders,
  table = DEMO_TABLE,
  steps = DEMO_STEPS,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const rows = table.length
  const cols = table[0]?.length ?? 0
  const framesPerStep = Math.floor(durationInFrames / (steps.length + 1))
  const stepIdx = Math.min(Math.floor(frame / framesPerStep), steps.length)

  // Build revealed grid
  const grid: (number | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))
  for (let i = 0; i < stepIdx; i++) {
    const s = steps[i]
    if (s && s.r < rows && s.c < cols) grid[s.r][s.c] = s.val
  }

  const currentStep = steps[stepIdx - 1]
  const cellW = Math.min(80, Math.floor(900 / (cols + 1)))
  const cellH = 56
  const totalW = cellW * (cols + 1)
  const totalH = cellH * (rows + 1)
  const offsetX = (1280 - totalW) / 2
  const offsetY = 120

  const C = { bg: '#0d1117', text: '#e6edf3', muted: '#8b949e', accent: '#58a6ff', current: '#1f6feb', border: '#30363d' }

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0, textAlign: 'center', color: C.text, fontSize: 28, fontWeight: 700 }}>
        {title}
      </div>

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* Col headers */}
        {Array.from({ length: cols }).map((_, ci) => (
          <text key={ci} x={offsetX + (ci + 1) * cellW + cellW / 2} y={offsetY + 20}
            textAnchor="middle" fill={C.muted} fontSize={14} fontFamily={MONO_FONT_STACK}>
            {colHeaders?.[ci] ?? ci}
          </text>
        ))}

        {/* Row headers + cells */}
        {Array.from({ length: rows }).map((_, ri) => (
          <g key={ri}>
            <text x={offsetX + cellW / 2} y={offsetY + cellH + ri * cellH + cellH / 2 + 6}
              textAnchor="middle" fill={C.muted} fontSize={14} fontFamily={MONO_FONT_STACK}>
              {rowHeaders?.[ri] ?? ri}
            </text>
            {Array.from({ length: cols }).map((_, ci) => {
              const val = grid[ri][ci]
              const isCurrent = currentStep && currentStep.r === ri && currentStep.c === ci
              const x = offsetX + (ci + 1) * cellW
              const y = offsetY + cellH + ri * cellH
              return (
                <g key={ci}>
                  <rect x={x} y={y} width={cellW} height={cellH}
                    fill={isCurrent ? C.current : val !== null ? '#161b22' : C.bg}
                    stroke={isCurrent ? C.accent : C.border} strokeWidth={isCurrent ? 2 : 1} rx={4} />
                  {val !== null && (
                    <text x={x + cellW / 2} y={y + cellH / 2 + 6} textAnchor="middle"
                      fill={isCurrent ? '#fff' : C.text} fontSize={16} fontFamily={MONO_FONT_STACK} fontWeight={600}>
                      {val}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {/* Step note */}
      {currentStep?.note && (
        <div style={{
          position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          background: '#1f6feb22', border: '1px solid #58a6ff',
          borderRadius: 8, padding: '8px 24px', color: C.accent, fontSize: 18,
        }}>
          {currentStep.note}
        </div>
      )}
    </AbsoluteFill>
  )
}
