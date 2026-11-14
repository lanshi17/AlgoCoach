import React, { useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, Trophy } from 'lucide-react'
import { agentService } from '@/services/agentService'
import type { AgentProfile } from '@/types'

export default function ProgressPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setProfile(await agentService.getProfile())
    } catch {
      setError('无法读取本地训练记录，请确认 Agent 服务正在运行。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-surface px-6 py-7 dark:bg-surface-dark">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Trophy size={21} className="text-accent" />
          <div>
            <h1 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">刷题进度</h1>
            <p className="text-xs text-text-muted dark:text-text-dark-muted">来自本地提交与训练记忆</p>
          </div>
          <button onClick={() => void load()} title="刷新" aria-label="刷新进度" className="sidebar-btn ml-auto !h-8 !w-8">
            <RefreshCw size={15} />
          </button>
        </div>

        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : profile && (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="提交次数" value={profile.stats.totalAttempts} />
              <Metric label="通过次数" value={profile.stats.accepted} />
              <Metric label="平均专注用时" value={formatDuration(profile.stats.averageDurationSec)} />
              <Metric label="连续训练" value={`${profile.stats.streakDays} 天`} />
            </section>

            <section className="rounded-lg border border-border p-5 dark:border-border-dark">
              <h2 className="mb-4 text-sm font-medium text-text-primary dark:text-text-dark-primary">最近 35 天</h2>
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 md:grid-cols-7 lg:grid-cols-[repeat(35,minmax(0,1fr))]">
                {profile.dailyAttempts.map(day => <div key={day.date} title={`${day.date} · ${day.count} 次`}
                  className={`aspect-square rounded-sm border border-border/50 dark:border-border-dark/60 ${
                    day.count >= 3 ? 'bg-accent/80' : day.count === 2 ? 'bg-accent/55' : day.count === 1 ? 'bg-accent/30' : 'bg-surface-soft dark:bg-surface-dark-soft'
                  }`} />)}
              </div>
              <p className="mt-3 text-[11px] text-text-muted dark:text-text-dark-muted">
                每格按当天提交次数着色。
              </p>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-border p-5 dark:border-border-dark">
                <h2 className="mb-4 text-sm font-medium text-text-primary dark:text-text-dark-primary">知识点掌握度</h2>
                {profile.topics.length ? <div className="space-y-3">
                  {profile.topics.slice(0, 8).map(topic => <div key={topic.topic}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-text-primary dark:text-text-dark-primary">{topic.topic}</span>
                      <span className="text-text-muted dark:text-text-dark-muted">{Math.round(topic.mastery * 100)}% · {topic.attempts} 次</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-surface-muted dark:bg-surface-dark-muted">
                      <div className="h-full rounded bg-accent" style={{ width: `${Math.round(topic.mastery * 100)}%` }} />
                    </div>
                  </div>)}
                </div> : <p className="text-xs text-text-muted dark:text-text-dark-muted">提交后会逐步形成知识点记录。</p>}
              </div>

              <div className="rounded-lg border border-border p-5 dark:border-border-dark">
                <h2 className="mb-4 text-sm font-medium text-text-primary dark:text-text-dark-primary">最近训练</h2>
                {profile.recentProblems.length ? <div className="divide-y divide-border dark:divide-border-dark">
                  {profile.recentProblems.slice(0, 8).map((item, index) => <div key={`${item.problemId}-${item.createdAt}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text-primary dark:text-text-dark-primary">{item.problemId}</div>
                      <div className="mt-1 truncate text-text-muted dark:text-text-dark-muted">{item.topics.join('、') || '未标注知识点'}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={item.status === 'ACCEPTED' ? 'text-success' : 'text-danger'}>{item.status}</div>
                      <div className="mt-1 text-text-muted dark:text-text-dark-muted">{formatDuration(item.durationSec)}</div>
                    </div>
                  </div>)}
                </div> : <p className="text-xs text-text-muted dark:text-text-dark-muted">还没有已同步的提交。</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border p-4 dark:border-border-dark">
    <div className="text-xs text-text-muted dark:text-text-dark-muted">{label}</div>
    <div className="mt-2 text-lg font-semibold text-text-primary dark:text-text-dark-primary">{value}</div>
  </div>
}

function Loading() {
  return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
    <Loader2 size={16} className="animate-spin" /> 正在读取训练记忆…
  </div>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
    <AlertCircle size={24} className="text-danger" />
    <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{message}</p>
    <button onClick={onRetry} className="text-sm text-accent hover:underline">重试</button>
  </div>
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}
