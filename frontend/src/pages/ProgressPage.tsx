import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, BookOpen, Clock3, Flame, Loader2, PenLine, RefreshCw, Trophy } from 'lucide-react'
import Button from '@/components/Common/Button'
import PageShell from '@/components/Common/PageShell'
import { agentService } from '@/services/agentService'
import { useNavigate } from 'react-router-dom'
import { dueReviewEntries, rateReviewEntry, readReviewEntries, readReviewEvents, REVIEW_ROUND_LIMIT, setReviewMastered, type LocalReviewEvent, type LocalReviewEntry } from '@/services/reviewQueue'
import { REVIEW_RATING_OPTIONS, type ReviewRating } from '@/services/deepTutorScheduler'
import { prepareReviewDiscussion, reviewUnavailableReason } from '@/services/reviewDiscussion'
import { useAppStore } from '@/stores/useAppStore'
import { localPracticeOutcomeLabel, readLocalPracticeSyncQueue } from '@/services/localProgress'
import type { LocalPracticeRecord } from '@/services/localProgress'
import type { AgentProfile } from '@/types'

export default function ProgressPage() {
  const localPracticeRecords = useAppStore(state => state.localPracticeRecords)
  const activeProblem = useAppStore(state => state.activeProblem)
  const mode = useAppStore(state => state.mode)
  const navigate = useNavigate()
  const [reviews, setReviews] = useState(() => readReviewEntries())
  const [reviewEvents, setReviewEvents] = useState(() => readReviewEvents())
  const [reviewNow, setReviewNow] = useState(() => Date.now())
  const [revealedReview, setRevealedReview] = useState<string | null>(null)
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSeq = useRef(0)

  const prepareReviewDiscussionAndNavigate = (problemKey: string | undefined, title: string, note: string) => { if (prepareReviewDiscussion(problemKey, title, note)) navigate('/workspace', { state: { openPanel: 'chat' } }) }

  const rateReview = (problemId: string, rating: ReviewRating) => {
    setReviews(rateReviewEntry(problemId, rating))
    // The scheduler writes the event before the schedule; re-read so an ignored
    // or rolled-back rating never shows a history row that was not persisted.
    setReviewEvents(readReviewEvents())
  }

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
    const timer = window.setInterval(() => setReviewNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    void load()
    return () => { requestSeq.current += 1 }
  }, [])

  return (
    <PageShell
      title="刷题进度"
      icon={<Trophy size={18} />}
      actions={<Button size="sm" onClick={() => void load()} disabled={loading} aria-busy={loading} aria-label="刷新进度">
        <RefreshCw size={14} />刷新
      </Button>}
    >
        {loading ? <Loading /> : error ? <LocalProgress records={localPracticeRecords} message={error} onRetry={() => void load()} /> : profile && (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-panel border border-border bg-surface p-6 lg:grid-cols-4">
              <Metric label="提交次数" value={profile.stats.totalAttempts} />
              <Metric label="通过次数" value={profile.stats.accepted} />
              <Metric label="平均专注用时" value={formatDuration(profile.stats.averageDurationSec)} />
              <Metric label="连续训练" value={`${profile.stats.streakDays} 天`} />
            </section>

            <section className="rounded-panel border border-border bg-surface p-6">
              <h2 className="mb-4 text-[15px] font-semibold tracking-title text-text-primary">最近 35 天</h2>
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 md:grid-cols-7 lg:grid-cols-[repeat(35,minmax(0,1fr))]">
                {profile.dailyAttempts.map(day => <div key={day.date} role="img"
                  aria-label={`${day.date}，提交 ${day.count} 次`} title={`${day.date} · ${day.count} 次`}
                  className={`aspect-square rounded-sm border border-border/50 dark:border-border-dark/60 ${
                    day.count >= 3 ? 'bg-accent/80' : day.count === 2 ? 'bg-accent/55' : day.count === 1 ? 'bg-accent/30' : 'bg-surface-soft dark:bg-surface-dark-soft'
                  }`} />)}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-panel border border-border bg-surface p-6">
                <h2 className="mb-4 text-[15px] font-semibold tracking-title text-text-primary">知识点掌握度</h2>
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

              <div className="rounded-panel border border-border bg-surface p-6">
                <h2 className="mb-4 text-[15px] font-semibold tracking-title text-text-primary">最近训练</h2>
                {profile.recentProblems.length ? <div className="divide-y divide-border dark:divide-border-dark">
                  {profile.recentProblems.slice(0, 8).map((item, index) => <div key={`${item.problemId}-${item.createdAt}-${index}`}
                    className="flex flex-col gap-1.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="max-w-full truncate font-medium text-text-primary dark:text-text-dark-primary">{item.problemId}</div>
                      <div className="mt-1 max-w-full break-words text-text-muted dark:text-text-dark-muted">{item.topics.join('、') || '未标注知识点'}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-left sm:block sm:text-right">
                      <div className={submissionTone(item.status)}>{formatSubmissionStatus(item.status)}</div>
                      <div className="mt-1 text-text-muted dark:text-text-dark-muted">{formatDuration(item.durationSec)}</div>
                    </div>
                  </div>)}
                </div> : <p className="text-xs text-text-muted dark:text-text-dark-muted">还没有已同步的提交。</p>}
              </div>
            </section>
            <LocalLedger records={localPracticeRecords} />
          </div>
        )}
        <section className="mt-6 rounded-panel border border-border bg-surface p-6" aria-labelledby="review-history-title">
          <h2 id="review-history-title" className="text-[15px] font-semibold tracking-title text-text-primary">已保存的复盘</h2>
          {(() => {
            const due = dueReviewEntries(reviews, new Date(reviewNow))
            const pending = reviews.filter(review => !due.some(entry => entry.problemId === review.problemId))
            return <>
              {due.length > 0 && <><h3 className="mt-5 font-medium text-text-primary dark:text-text-dark-primary">今日回想 · {due.length}</h3><div className="mt-3 divide-y divide-border dark:divide-border-dark">{due.slice(0, REVIEW_ROUND_LIMIT).map(review => <ProgressReview key={review.problemId} review={review} records={localPracticeRecords} activeProblem={activeProblem} mode={mode} onDiscuss={prepareReviewDiscussionAndNavigate} onRate={(entry, rating) => rateReview(entry.problemId, rating)} onReveal={setRevealedReview} revealed={revealedReview === review.problemId} />)}</div>{due.length > REVIEW_ROUND_LIMIT && <p className="mt-3 text-xs text-text-secondary dark:text-text-dark-secondary">本轮先显示 {REVIEW_ROUND_LIMIT} 条，完成后会继续显示其余 {due.length - REVIEW_ROUND_LIMIT} 条。</p>}</>}
              {pending.length > 0 && <><h3 className="mt-5 font-medium text-text-primary dark:text-text-dark-primary">之后再复习 · {pending.length}</h3><div className="mt-3 divide-y divide-border dark:divide-border-dark">{[...pending].reverse().map(review => <details key={review.problemId} className="py-3 text-sm"><summary className="cursor-pointer text-text-primary dark:text-text-dark-primary">{review.mastered ? '已掌握 · ' : ''}{review.title ?? localPracticeRecords.find(item => item.id === review.problemId)?.title ?? '原练习记录已过期'}</summary><p className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">{review.mastered ? '已暂停每日安排' : `下次复习：${formatReviewDate(review.schedule?.due ?? new Date(Date.parse(review.reviewedAt) + 86400000).toISOString())}`}</p><p className="mt-2 whitespace-pre-wrap text-text-secondary dark:text-text-dark-secondary">{review.note}</p><button type="button" onClick={() => setReviews(setReviewMastered(review.problemId, !review.mastered))} className="mt-3 rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-muted dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">{review.mastered ? '取消已掌握' : '标记已掌握'}</button></details>)}</div></>}
              {!reviews.length && <p className="mt-4 text-sm text-text-secondary dark:text-text-dark-secondary">保存复盘后，笔记会出现在这里。</p>}
            </>
          })()}
          <ReviewEventHistory events={reviewEvents} reviews={reviews} records={localPracticeRecords} />
        </section>
    </PageShell>
  )
}

function ProgressReview({ review, records, activeProblem, mode, onDiscuss, onRate, onReveal, revealed }: {
  review: ReturnType<typeof readReviewEntries>[number]
  records: LocalPracticeRecord[]
  activeProblem: ReturnType<typeof useAppStore.getState>['activeProblem']
  mode: ReturnType<typeof useAppStore.getState>['mode']
  onDiscuss: (problemKey: string | undefined, title: string, note: string) => void
  onRate: (entry: ReturnType<typeof readReviewEntries>[number], rating: ReviewRating) => void
  onReveal: (id: string | null) => void
  revealed: boolean
}) {
  const problemKey = review.problemKey ?? records.find(item => item.id === review.problemId)?.problemId
  const title = review.title ?? records.find(item => item.id === review.problemId)?.title ?? '原练习记录已过期'
  const reason = reviewUnavailableReason(problemKey, activeProblem, mode)
  return <div className="py-3 text-sm"><p className="text-text-primary dark:text-text-dark-primary">{title} · 先试着回忆解法</p>{revealed ? <><p className="mt-3 whitespace-pre-wrap break-words text-text-secondary dark:text-text-dark-secondary">{review.note}</p><div className="mt-3 flex flex-wrap gap-2">{REVIEW_RATING_OPTIONS.map(({value,label})=><button key={value} type="button" onClick={()=>{try{onRate(review,value);onReveal(null)}catch{/* keep note visible if persistence fails */}}} className="rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-muted dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">{label}</button>)}</div><button type="button" disabled={!!reason} onClick={()=>onDiscuss(problemKey,title,review.note)} className="mt-3 text-sm font-medium text-accent hover:underline disabled:opacity-40">带笔记问 Agent</button>{reason&&<p className="mt-2 text-xs text-text-muted dark:text-text-dark-muted">{reason}</p>}</>:<button type="button" onClick={()=>onReveal(review.problemId)} className="mt-2 text-sm font-medium text-accent hover:underline">显示笔记</button>}</div>
}
const REVIEW_EVENT_HISTORY_LIMIT = 20

function ReviewEventHistory({ events, reviews, records }: {
  events: LocalReviewEvent[]
  reviews: LocalReviewEntry[]
  records: LocalPracticeRecord[]
}) {
  if (!events.length) return null
  const recent = events.slice(-REVIEW_EVENT_HISTORY_LIMIT).reverse()
  return <details className="mt-6 border-t border-border pt-4 dark:border-border-dark">
    <summary className="cursor-pointer text-sm font-medium text-text-primary dark:text-text-dark-primary">复习评分记录 · {events.length} 次</summary>
    <p className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">每次自评都会留下本地记录，用于复核复习间隔；这里按时间倒序显示最近 {Math.min(events.length, REVIEW_EVENT_HISTORY_LIMIT)} 次。</p>
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-xs">
        <caption className="sr-only">复习评分记录</caption>
        <thead className="text-text-muted dark:text-text-dark-muted">
          <tr>
            <th scope="col" className="py-1.5 pr-3 font-medium">时间</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">题目</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">自评</th>
            <th scope="col" className="py-1.5 font-medium">距下次复习</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {recent.map((event, index) => {
            const title = reviews.find(review => review.problemId === event.problemId)?.title
              ?? records.find(record => record.id === event.problemId)?.title ?? '原练习记录已过期'
            const ratingLabel = REVIEW_RATING_OPTIONS.find(option => option.value === event.rating)?.label ?? `评分 ${event.rating}`
            return <tr key={`${event.problemId}-${event.reviewedAt}-${index}`}>
              <td className="whitespace-nowrap py-2 pr-3 text-text-muted dark:text-text-dark-muted"><time dateTime={event.reviewedAt}>{formatReviewDate(event.reviewedAt)}</time></td>
              <td className="max-w-[16rem] truncate py-2 pr-3 text-text-primary dark:text-text-dark-primary" title={title}>{title}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-text-secondary dark:text-text-dark-secondary">{ratingLabel}</td>
              <td className="whitespace-nowrap py-2 text-text-secondary dark:text-text-dark-secondary" title={`下次复习：${formatReviewDate(event.dueAfter)}`}>{formatReviewGap(event.reviewedAt, event.dueAfter)}</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  </details>
}

function formatReviewGap(reviewedAt: string, dueAfter: string): string {
  const gap = Date.parse(dueAfter) - Date.parse(reviewedAt)
  if (!Number.isFinite(gap) || gap <= 0) return '已到期'
  const minutes = Math.round(gap / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟`
  const hours = gap / 3600000
  if (hours < 36) return `${Math.round(hours)} 小时`
  return `${Math.round(hours / 24)} 天`
}
function formatReviewDate(value: string) { const date=new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : '未知' }

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="border-t border-border pt-3 first:border-t-0 first:pt-0 lg:border-l lg:border-t-0 lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
    <div className="whitespace-nowrap font-mono text-label uppercase text-text-muted">{label}</div>
    <div className="mt-1.5 whitespace-nowrap text-[24px] font-semibold leading-8 tracking-num tabular-nums text-text-primary">{value}</div>
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
  const syncQueue = new Set(readLocalPracticeSyncQueue())
  const totalMinutes = Math.round(records.reduce((sum, item) => sum + item.durationSec, 0) / 60)
  const activeDays = new Set(records.map(item => item.endedAt.slice(0, 10))).size
  return <section className="rounded-panel border border-border bg-surface p-6" aria-labelledby="local-ledger-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="local-ledger-title" className="text-[15px] font-semibold tracking-title text-text-primary">这台电脑上的练习本</h2>
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
        <div className="min-w-0"><p className="truncate text-text-primary dark:text-text-dark-primary">{record.title}</p><p className="mt-1 truncate text-text-muted dark:text-text-dark-muted">{record.topics.join(' · ') || '自由练习'} · {record.codeLength} 字符</p><p className={`mt-1 text-[11px] ${record.outcome === 'SAMPLE_PASSED' ? 'text-success' : record.outcome === 'SAMPLE_FAILED' ? 'text-danger' : 'text-text-muted dark:text-text-dark-muted'}`}>{localPracticeOutcomeLabel(record)} · {syncQueue.has(record.id) ? '等待同步 Agent' : '已同步或离线记录'}</p></div>
        <time className="shrink-0 font-mono text-[11px] text-text-muted dark:text-text-dark-muted">{formatDuration(record.durationSec)}</time>
      </div>)}
    </div> : <div className="flex items-center gap-3 py-6 text-xs text-text-muted dark:text-text-dark-muted"><BookOpen size={16} />选一道题，写满一页，再回来看看这里。</div>}
  </section>
}

function LedgerStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-2"><span className="text-accent">{icon}</span><div><div className="font-mono text-[10px] text-text-secondary dark:text-text-dark-secondary">{label}</div><div className="mt-0.5 font-editorial text-lg tracking-num tabular-nums text-text-primary dark:text-text-dark-primary">{value}</div></div></div>
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
    REVIEWED: '待复盘',
    PENDING: '待判题',
    JUDGING: '判题中',
  }
  return labels[status] ?? status
}

function submissionTone(status: string): string {
  if (status === 'ACCEPTED') return 'text-success'
  if (['WRONG_ANSWER', 'TIME_LIMIT', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'MEMORY_LIMIT'].includes(status)) return 'text-danger'
  return 'text-text-secondary dark:text-text-dark-secondary'
}
