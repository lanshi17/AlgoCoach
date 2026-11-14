/**
 * WeeklyReport — prebuilt weekly summary video.
 *
 * Rendered standalone as the 1920x1080 / 60fps "WeeklyReport" composition and
 * also registered in MainComp for the 1280x720 / 30fps chat preview. Props are
 * plain JSON produced by ``agent/crons.py::weekly_report_props``; no generated
 * JSX or runtime evaluation is involved, so the composition stays safe.
 *
 * Layout scales from the video width, so the same component works at both
 * resolutions without clipped text.
 */
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

interface TopicCount {
  name: string
  count: number
}

interface WeakTopic {
  topic: string
  mastery: number
}

export interface WeeklyReportProps {
  weekStart?: string
  weekEnd?: string
  totalAttempts?: number
  accepted?: number
  reviewed?: number
  topics?: TopicCount[]
  weakTopics?: WeakTopic[]
  stickingPoints?: string[]
}

export const DEFAULT_WEEKLY_REPORT: Required<WeeklyReportProps> = {
  weekStart: '2026-11-06',
  weekEnd: '2026-11-12',
  totalAttempts: 14,
  accepted: 9,
  reviewed: 3,
  topics: [
    { name: '动态规划', count: 5 },
    { name: '图论', count: 4 },
    { name: '双指针', count: 3 },
    { name: '二分查找', count: 2 },
  ],
  weakTopics: [
    { topic: '动态规划', mastery: 0.42 },
    { topic: '图论', mastery: 0.55 },
  ],
  stickingPoints: ['状态转移方程写错', '边界条件遗漏'],
}

const C = {
  bg: '#0d1117',
  bg2: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  visited: '#1f6feb',
  success: '#3fb950',
  warning: '#d29922',
}

export const WeeklyReport: React.FC<WeeklyReportProps> = ({
  weekStart = DEFAULT_WEEKLY_REPORT.weekStart,
  weekEnd = DEFAULT_WEEKLY_REPORT.weekEnd,
  totalAttempts = DEFAULT_WEEKLY_REPORT.totalAttempts,
  accepted = DEFAULT_WEEKLY_REPORT.accepted,
  reviewed = DEFAULT_WEEKLY_REPORT.reviewed,
  topics = DEFAULT_WEEKLY_REPORT.topics,
  weakTopics = DEFAULT_WEEKLY_REPORT.weakTopics,
  stickingPoints = DEFAULT_WEEKLY_REPORT.stickingPoints,
}) => {
  const frame = useCurrentFrame()
  const { width, height, durationInFrames } = useVideoConfig()
  // Design canvas is 1920x1080; s scales every dimension for the chat preview.
  const s = width / 1920
  const top = 88 * s

  const intro = interpolate(frame, [0, Math.min(48, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const attemptsShown = Math.round(totalAttempts * intro)
  const acceptedShown = Math.round(accepted * intro)
  const reviewedShown = Math.round(reviewed * intro)
  const acceptanceRate = totalAttempts > 0 ? Math.round((accepted / totalAttempts) * 100) : 0
  const maxTopic = Math.max(1, ...topics.map((item) => item.count))

  const stats = [
    { label: '本周提交', value: attemptsShown, color: C.accent },
    { label: '通过', value: acceptedShown, color: C.success },
    { label: '复盘', value: reviewedShown, color: C.warning },
    { label: '通过率', value: `${acceptanceRate}%`, color: C.text },
  ]

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: "'JetBrains Mono', monospace" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 18% 0%, ${C.visited}22 0%, transparent 46%)`,
        }}
      />

      {/* Header */}
      <div style={{ position: 'absolute', left: top, top: 72 * s, right: top }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ color: C.text, fontSize: 58 * s, fontWeight: 700 }}>
            本周刷题周报
          </div>
          <div style={{ color: C.muted, fontSize: 24 * s }}>
            {weekStart} — {weekEnd}
          </div>
        </div>
        <div style={{ marginTop: 20 * s, height: 2 * s, background: C.border }} />
      </div>

      {/* Stat cards */}
      <div
        style={{
          position: 'absolute',
          left: top,
          right: top,
          top: 235 * s,
          display: 'flex',
          gap: 28 * s,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              background: C.bg2,
              border: `1px solid ${C.border}`,
              borderRadius: 18 * s,
              padding: `${30 * s}px ${34 * s}px`,
            }}
          >
            <div style={{ color: C.muted, fontSize: 24 * s }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: 76 * s, fontWeight: 700, lineHeight: 1.15 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Topic distribution */}
      <div
        style={{
          position: 'absolute',
          left: top,
          top: 500 * s,
          width: 860 * s,
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 18 * s,
          padding: `${30 * s}px ${34 * s}px`,
        }}
      >
        <div style={{ color: C.text, fontSize: 30 * s, fontWeight: 700, marginBottom: 24 * s }}>
          考点分布
        </div>
        {topics.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 24 * s }}>本周暂无做题记录</div>
        ) : (
          topics.slice(0, 5).map((item, index) => {
            const grow = interpolate(
              frame,
              [24 + index * 8, 54 + index * 8],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            )
            const barWidth = Math.max(8 * s, (item.count / maxTopic) * 520 * s * grow)
            return (
              <div
                key={item.name}
                style={{ display: 'flex', alignItems: 'center', marginBottom: 22 * s }}
              >
                <div
                  style={{
                    width: 170 * s,
                    color: C.muted,
                    fontSize: 23 * s,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.name}
                </div>
                <div style={{ flex: 1, height: 18 * s, background: C.bg, borderRadius: 9 * s }}>
                  <div
                    style={{
                      width: barWidth,
                      height: '100%',
                      borderRadius: 9 * s,
                      background: `linear-gradient(90deg, ${C.visited}, ${C.accent})`,
                    }}
                  />
                </div>
                <div style={{ width: 62 * s, textAlign: 'right', color: C.text, fontSize: 23 * s }}>
                  ×{item.count}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Weak topics */}
      <div
        style={{
          position: 'absolute',
          right: top,
          top: 500 * s,
          width: 760 * s,
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 18 * s,
          padding: `${30 * s}px ${34 * s}px`,
        }}
      >
        <div style={{ color: C.text, fontSize: 30 * s, fontWeight: 700, marginBottom: 22 * s }}>
          需要加强
        </div>
        {weakTopics.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 24 * s }}>暂无薄弱考点，保持节奏。</div>
        ) : (
          weakTopics.slice(0, 3).map((item) => {
            const pct = Math.round(Math.max(0, Math.min(1, item.mastery)) * 100)
            return (
              <div key={item.topic} style={{ marginBottom: 20 * s }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: C.text,
                    fontSize: 24 * s,
                    marginBottom: 8 * s,
                  }}
                >
                  <span>{item.topic}</span>
                  <span style={{ color: pct < 50 ? C.warning : C.muted }}>{pct}%</span>
                </div>
                <div style={{ height: 12 * s, background: C.bg, borderRadius: 6 * s }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 6 * s,
                      background: pct < 50 ? C.warning : C.accent,
                    }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Sticking points */}
      <div
        style={{
          position: 'absolute',
          left: top,
          right: top,
          top: 875 * s,
          background: `${C.success}12`,
          border: `1px solid ${C.success}55`,
          borderRadius: 16 * s,
          padding: `${24 * s}px ${34 * s}px`,
          color: C.text,
          fontSize: 25 * s,
        }}
      >
        <span style={{ color: C.success, fontWeight: 700 }}>本周卡点：</span>
        {stickingPoints.length > 0 ? stickingPoints.slice(0, 3).join(' · ') : '没有记录到明显卡点。'}
      </div>

      <div
        style={{
          position: 'absolute',
          left: top,
          right: top,
          bottom: 42 * s,
          color: C.muted,
          fontSize: 20 * s,
          textAlign: 'right',
        }}
      >
        AlgoCoach · 自动生成
      </div>
    </AbsoluteFill>
  )
}
