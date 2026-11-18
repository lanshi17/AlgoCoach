import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, BookOpen, Clock3, Flame, Loader2, PenLine, RefreshCw, Trophy } from 'lucide-react'
import Button from '@/components/Common/Button'
import PageHeader from '@/components/Common/PageHeader'
import { agentService } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'
import type { LocalPracticeRecord } from '@/services/localProgress'
import type { AgentProfile } from '@/types'

export default function ProgressPage() {
  const localPracticeRecords = useAppStore(state => state.localPracticeRecords)
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSeq = useRef(0)

  const load = async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    try {
      const next = await agentService.getProfile()
      if (seq !== requestSeq.current) return
      setProfile(next)
    } catch {
      if (seq !== requestSeq.current) return
      setError('无法读取本地训练记录，请确认 Agent 服务正在运行。')
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    return () => { requestSeq.current += 1 }
  }, [])

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-canvas px-6 py-7 dark:bg-[#0B0C0F]">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="刷题进度"
          icon={<Trophy size={18} />}
          actions={<Button size="sm" onClick={() => void load()} disabled={loading} aria-busy={loading} aria-label="刷新进度">
            <RefreshCw size={14} />刷新
          </Button>}
        />

        {loading ? <Loading /> : error ? <LocalProgress records={localPracticeRecords} message={error} onRetry={() => void load()} /> : profile && (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-6 rounded-panel bg-surface p-7 dark:bg-surface-dark lg:grid-cols-4">
              <Metric label="提交次数" value={profile.stats.totalAttempts} />
              <Metric label="通过次数" value={profile.stats.accepted} />
              <Metric label="平均专注用时" value={formatDuration(profile.stats.averageDurationSec)} />
              <Metric label="连续训练" value={`${profile.stats.streakDays} 天`} />
            </section>

            <section className="rounded-panel bg-surface p-7 dark:bg-surface-dark">
              <h2 className="mb-5 text-xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">最近 35 天</h2>
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 md:grid-cols-7 lg:grid-cols-[repeat(35,minmax(0,1fr))]">
                {profile.dailyAttempts.map(day => <div key={day.date} role="img"
                  aria-label={`${day.date}，提交 ${day.count} 次`} title={`${day.date} · ${day.count} 次`}
                  className={`aspect-square rounded-sm border border-border/50 dark:border-border-dark/60 ${
                    day.count >= 3 ? 'bg-accent/80' : day.count === 2 ? 'bg-accent/55' : day.count === 1 ? 'bg-accent/30' : 'bg-surface-soft dark:bg-surface-dark-soft'
                  }`} />)}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-panel bg-surface p-7 dark:bg-surface-dark">
                <h2 className="mb-5 text-xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">知识点掌握度</h2>
                {profile.topics.length ? <div className="space-y-3">
                  {profile.topics.slice(0, 8).map(topic => <div key={topic.topic}>
                    <div className="mb-1 flex min-w-0 items-start justify-between gap-2 text-xs">
                      <span className="min-w-0 break-words text-text-primary dark:text-text-dark-primary">{topic.topic}</span>
                      <span className="shrink-0 text-text-muted dark:text-text-dark-muted">{Math.round(topic.mastery * 100)}% · {topic.attempts} 次</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-surface-muted dark:bg-surface-dark-muted">
                      <div className="h-full rounded bg-accent" style={{ width: `${Math.round(topic.mastery * 100)}%` }} />
                    </div>
                  </div>)}
                </div> : <p className="text-xs text-text-muted dark:text-text-dark-muted">提交后会逐步形成知识点记录。</p>}
              </div>

              <div className="rounded-panel bg-surface p-7 dark:bg-surface-dark">
                <h2 className="mb-5 text-xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">最近训练</h2>
                {profile.recentProblems.length ? <div className="divide-y divide-border dark:divide-border-dark">
                  {profile.recentProblems.slice(0, 8).map((item, index) => <div key={`${item.problemId}-${item.createdAt}-${index}`}
                    className="flex flex-col gap-1.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="max-w-full truncate font-medium text-text-primary dark:text-text-dark-primary">{item.problemId}</div>
                      <div className="mt-1 max-w-full break-words text-text-muted dark:text-text-dark-muted">{item.topics.join('、') || '未标注知识点'}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-left sm:block sm:text-right">
                      <div className={item.status === 'ACCEPTED' ? 'text-success' : 'text-danger'}>{formatSubmissionStatus(item.status)}</div>
                      <div className="mt-1 text-text-muted dark:text-text-dark-muted">{formatDuration(item.durationSec)}</div>
                    </div>
                  </div>)}
                </div> : <p className="text-xs text-text-muted dark:text-text-dark-muted">还没有已同步的提交。</p>}
              </div>
            </section>
            <LocalLedger records={localPracticeRecords} />
          </div>
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="border-y border-border/80 px-1 py-4 dark:border-border-dark/80">
    <div className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] leading-4 text-text-muted dark:text-text-dark-muted">{label}</div>
    <div className="mt-2 font-editorial text-2xl text-text-primary dark:text-text-dark-primary">{value}</div>
  </div>
}

function Loading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-64 items-center justify-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
    <Loader2 size={16} className="animate-spin" /> 正在读取训练记忆…
  </div>
}

function LocalProgress({ records, message, onRetry }: { records: LocalPracticeRecord[]; message: string; onRetry: () => void }) {
  return <div className="space-y-7">
    <div role="alert" className="flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm text-text-secondary dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-secondary">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0"><p>{message}</p><button type="button" onClick={onRetry} aria-label="重试读取训练记录" className="mt-1.5 text-accent hover:underline">连接后同步云端记录</button></div>
    </div>
    <LocalLedger records={records} />
  </div>
}

function LocalLedger({ records }: { records: LocalPracticeRecord[] }) {
  const totalMinutes = Math.round(records.reduce((sum, item) => sum + item.durationSec, 0) / 60)
  const activeDays = new Set(records.map(item => item.endedAt.slice(0, 10))).size
  return <section className="rounded-panel bg-surface p-7 dark:bg-surface-dark" aria-labelledby="local-ledger-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="local-ledger-title" className="text-xl font-semibold tracking-title text-text-primary dark:text-text-dark-primary">这台电脑上的练习本</h2>
      </div>
      <span className="text-xs text-text-muted dark:text-text-dark-muted">退出专注时自动记一页</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-4 border-y border-border/70 py-3 dark:border-border-dark/70">
      <LedgerStat icon={<PenLine size={14} />} label="练习页" value={records.length} />
      <LedgerStat icon={<Clock3 size={14} />} label="专注分钟" value={totalMinutes} />
      <LedgerStat icon={<Flame size={14} />} label="练习日" value={activeDays} />
    </div>
    {records.length ? <div className="divide-y divide-border dark:divide-border-dark">
      {records.slice(-5).reverse().map(record => <div key={record.id} className="flex items-center justify-between gap-3 py-3 text-xs">
        <div className="min-w-0"><p className="truncate text-text-primary dark:text-text-dark-primary">{record.title}</p><p className="mt-1 truncate text-text-muted dark:text-text-dark-muted">{record.topics.join(' · ') || '自由练习'} · {record.codeLength} 字符</p></div>
        <time className="shrink-0 font-mono text-[11px] text-text-muted dark:text-text-dark-muted">{formatDuration(record.durationSec)}</time>
      </div>)}
    </div> : <div className="flex items-center gap-3 py-6 text-xs text-text-muted dark:text-text-dark-muted"><BookOpen size={16} />选一道题，写满一页，再回来看看这里。</div>}
  </section>
}

function LedgerStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-2"><span className="text-accent">{icon}</span><div><div className="font-mono text-[10px] text-text-muted dark:text-text-dark-muted">{label}</div><div className="mt-0.5 font-editorial text-lg text-text-primary dark:text-text-dark-primary">{value}</div></div></div>
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

function formatSubmissionStatus(status: string): string {
  const labels: Record<string, string> = {
    ACCEPTED: '通过',
    WRONG_ANSWER: '未通过',
    TIME_LIMIT: '超时',
    RUNTIME_ERROR: '运行错误',
    COMPILE_ERROR: '编译错误',
    MEMORY_LIMIT: '内存超限',
  }
  return labels[status] ?? status
}
