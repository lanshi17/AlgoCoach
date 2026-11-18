/**
 * DpTable — 2D DP table fill visualization.
 * Agent provides: rows, cols, table (2D array), steps ([{r,c,val,note}])
 */
import React from 'react'
import { AbsoluteFill } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'
import { popIn, sequenceDurationInFrames, springIn, useStepSequence } from '../motion'
import { C } from '../theme'

export interface DpStep { r: number; c: number; val: number; note?: string }
export interface DpTableProps {
  title?: string
  rowHeaders?: string[]
  colHeaders?: string[]
  table?: number[][]
  steps?: DpStep[]
}

export const DEFAULT_DP_TABLE = Array.from({ length: 5 }, () => Array(6).fill(0))
export const DEFAULT_DP_STEPS: DpStep[] = [
  { r: 0, c: 0, val: 0, note: '初始化' },
  { r: 1, c: 1, val: 1, note: 'dp[1][1] = 1' },
  { r: 1, c: 2, val: 2, note: 'dp[1][2] = 2' },
  { r: 2, c: 1, val: 1, note: 'dp[2][1] = 1' },
  { r: 2, c: 2, val: 3, note: 'dp[2][2] = dp[1][2]+dp[2][1]' },
  { r: 2, c: 3, val: 3, note: 'dp[2][3] = ...' },
  { r: 3, c: 2, val: 3 },
  { r: 3, c: 3, val: 6, note: 'dp[3][3] = 6' },
]

export const dpTableFrames = (props: DpTableProps, fps: number) =>
  sequenceDurationInFrames((props.steps ?? DEFAULT_DP_STEPS).length, fps)

export const DpTable: React.FC<DpTableProps> = ({
  title = '动态规划 — 状态转移可视化',
  rowHeaders,
  colHeaders,
  table = DEFAULT_DP_TABLE,
  steps = DEFAULT_DP_STEPS,
}) => {
  const seq = useStepSequence(steps.length)

  const rows = table.length
  const cols = table[0]?.length ?? 0

  // Last value written to each cell, plus the step that wrote it (drives the
  // per-cell spring so a cell lands exactly when its transition runs).
  const revealed = new Map<string, { val: number; step: number }>()
  for (let i = 0; i < seq.revealed; i++) {
    const s = steps[i]
    if (s && s.r >= 0 && s.r < rows && s.c >= 0 && s.c < cols) {
      revealed.set(`${s.r},${s.c}`, { val: s.val, step: i })
    }
  }

  const currentStep = seq.started ? steps[seq.index] : undefined

  const cellW = Math.min(80, Math.floor(900 / (cols + 1)))
  const cellH = 56
  const totalW = cellW * (cols + 1)
  const offsetX = (1280 - totalW) / 2
  const offsetY = 120
  const noteIn = springIn(seq.frame, seq.fps, 0)

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div
        style={{
          position: 'absolute', top: 32, left: 0, right: 0, textAlign: 'center',
          color: C.text, fontSize: 28, fontWeight: 700,
          opacity: noteIn, transform: `translateY(${(1 - noteIn) * 8}px)`,
        }}
      >
        {title}
      </div>

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: cols }).map((_, ci) => (
          <text
            key={ci}
            x={offsetX + (ci + 1) * cellW + cellW / 2}
            y={offsetY + 20}
            textAnchor="middle" fill={C.muted} fontSize={14} fontFamily={MONO_FONT_STACK}
          >
            {colHeaders?.[ci] ?? ci}
          </text>
        ))}

        {Array.from({ length: rows }).map((_, ri) => (
          <g key={ri}>
            <text
              x={offsetX + cellW / 2}
              y={offsetY + cellH + ri * cellH + cellH / 2 + 6}
              textAnchor="middle" fill={C.muted} fontSize={14} fontFamily={MONO_FONT_STACK}
            >
              {rowHeaders?.[ri] ?? ri}
            </text>
            {Array.from({ length: cols }).map((_, ci) => {
              const cell = revealed.get(`${ri},${ci}`)
              const active = currentStep?.r === ri && currentStep?.c === ci
              const x = offsetX + (ci + 1) * cellW
              const y = offsetY + cellH + ri * cellH
              const enter = cell
                ? popIn(seq.frame, seq.fps, seq.introFrame + cell.step * seq.framesPerStep)
                : 0
              const pulse = active
                ? popIn(seq.frame, seq.fps, seq.introFrame + seq.index * seq.framesPerStep)
                : 0
              const cx = x + cellW / 2
              const cy = y + cellH / 2
              return (
                <g key={ci}>
                  <rect
                    x={x} y={y} width={cellW} height={cellH} rx={4}
                    fill={active ? C.visited : cell ? C.bg2 : C.bg}
                    stroke={active ? C.accent : C.border}
                    strokeWidth={active ? 2 : 1}
                  />
                  {cell && (
                    <text
                      x={cx} y={cy + 6} textAnchor="middle"
                      fill={active ? '#ffffff' : C.text}
                      fontSize={16} fontFamily={MONO_FONT_STACK} fontWeight={600}
                      opacity={Math.min(1, enter)}
                      transform={`translate(${cx} ${cy}) scale(${0.5 + 0.5 * enter}) translate(${-cx} ${-cy})`}
                    >
                      {cell.val}
                    </text>
                  )}
                  {active && (
                    <rect
                      x={x} y={y} width={cellW} height={cellH} rx={4}
                      fill="none" stroke={C.accent} strokeWidth={2}
                      opacity={0.5 * pulse}
                      transform={`translate(${cx} ${cy}) scale(${1 + 0.08 * pulse}) translate(${-cx} ${-cy})`}
                    />
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {currentStep?.note && (
        <div
          style={{
            position: 'absolute', bottom: 48, left: '50%',
            transform: `translateX(-50%) translateY(${(1 - seq.eased) * 6}px)`,
            background: '#1f6feb22', border: `1px solid ${C.accent}`,
            borderRadius: 8, padding: '8px 24px', color: C.accent, fontSize: 18,
            opacity: 0.4 + 0.6 * seq.eased,
          }}
        >
          {currentStep.note}
        </div>
      )}
    </AbsoluteFill>
  )
}
