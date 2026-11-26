import React, { useCallback, useEffect, useRef, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { platformCookieService } from '@/services/platformCookieService'
import { parseCookieHeader, parseLeetCodeCurl } from '@/services/cookieParser'
import Button from '@/components/Common/Button'
import PageShell from '@/components/Common/PageShell'

type StatusMap = { LEETCODE: boolean; ACWING: boolean; HDU: boolean }

const textarea =
  'w-full rounded-[10px] border border-line-300 bg-surface px-3 py-2 font-mono text-xs leading-relaxed ' +
  'text-text-primary outline-none transition-colors focus:border-accent ' +
  'dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-primary dark:placeholder:text-text-dark-muted'

function StatusChip({ ok, okLabel, idleLabel }: { ok: boolean; okLabel: string; idleLabel: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs
                     text-text-secondary dark:bg-surface-dark-muted dark:text-text-dark-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-success' : 'bg-text-muted'}`} />
      {ok ? okLabel : idleLabel}
    </span>
  )
}

export default function PlatformLoginPage() {
  const [status, setStatus] = useState<StatusMap>({ LEETCODE: false, ACWING: false, HDU: false })
  const [lcPaste, setLcPaste] = useState('')
  const [acCookie, setAcCookie] = useState('')
  const [hduCookie, setHduCookie] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const confirmTimer = useRef<number>()
  const refreshingRef = useRef(false)
  const didInitialRefresh = useRef(false)

  const flash = useCallback((message: string) => {
    setError('')
    setConfirm(message)
    window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(() => setConfirm(''), 3000)
  }, [])

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    try {
      const summary = await platformCookieService.summary()
      setStatus(summary)
      setError('')
      // LeetCode 的真实校验要走上游，先渲染配置状态，再单独回填。
      if (!summary.LEETCODE) return
      const lc = await platformCookieService.validateLeetCode().catch(() => summary.LEETCODE)
      setStatus(current => ({ ...current, LEETCODE: lc }))
    } catch {
      setError('无法获取登录状态，请确认网关已启动后点击“刷新状态”。')
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // StrictMode replays effects in development. Keep the initial status
    // check single-shot; the explicit refresh button still always retries.
    if (didInitialRefresh.current) return
    didInitialRefresh.current = true
    void refresh()
  }, [refresh])
  useEffect(() => () => window.clearTimeout(confirmTimer.current), [])

  const saveLeetCode = async () => {
    const parsed = parseLeetCodeCurl(lcPaste)
    if (!parsed) { setError('未解析出 LEETCODE_SESSION / csrftoken，请粘贴完整的 Cookie 或 curl 命令。'); return }
    setSaving(true)
    setError('')
    try {
      await platformCookieService.saveLeetCode(parsed.session, parsed.csrf)
      const ok = await platformCookieService.validateLeetCode().catch(() => false)
      setStatus(current => ({ ...current, LEETCODE: ok }))
      if (ok) {
        window.dispatchEvent(new Event('algocoach:cookie-valid'))
        flash('已保存 · LeetCode 登录有效')
      }
      else setError('已保存，但上游校验未通过，请在 leetcode.cn 重新登录后复制新的 Cookie。')
    } catch {
      setError('保存失败，请检查网关连接后重试；已粘贴的内容不会被清空。')
    } finally {
      setSaving(false)
    }
  }

  const savePlatform = async (platform: 'ACWING' | 'HDU', raw: string) => {
    const cookie = parseCookieHeader(raw)
    if (!cookie) { setError('没有识别出 Cookie，请粘贴 Cookie 请求头或包含 cookie 的 curl 命令。'); return }
    setSaving(true)
    setError('')
    try {
      await platformCookieService.save(platform, cookie)
      setStatus(current => ({ ...current, [platform]: true }))
      flash(`已保存 · ${platform} 登录态已更新`)
    } catch {
      setError('保存失败，请检查网关连接后重试；已粘贴的内容不会被清空。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell
      title="题库登录"
      icon={<KeyRound size={18} />}
      width="narrow"
      actions={<Button onClick={() => void refresh()} disabled={refreshing || saving} aria-busy={refreshing}
        aria-label="刷新题库登录状态">{refreshing ? '刷新中…' : '刷新状态'}</Button>}
    >
      {confirm && (
        <div className="fixed right-6 top-6 z-[1100] rounded-tip bg-ink-950 px-3 py-1.5 text-meta text-canvas shadow-modal"
          role="status">
          {confirm}
        </div>
      )}

        {error && (
          <div role="alert" className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-meta text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <section className="rounded-card border border-border bg-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">LeetCode</h2>
              <StatusChip ok={status.LEETCODE} okLabel="已登录" idleLabel="未登录" />
            </div>
            <div className="mt-3 space-y-2">
              <textarea value={lcPaste} onChange={event => setLcPaste(event.target.value)} rows={3}
                aria-label="LeetCode Cookie"
                placeholder="Cookie: LEETCODE_SESSION=…; csrftoken=…　或整段 curl 命令"
                className={textarea} />
              {lcPaste.trim() && <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => void saveLeetCode()}
                  disabled={saving || refreshing} aria-busy={saving}>
                  {saving ? '保存中…' : '保存'}
                </Button>
              </div>}
            </div>
          </section>

          <section className="rounded-card border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">AcWing</h2>
              <StatusChip ok={status.ACWING} okLabel="已配置" idleLabel="未配置" />
            </div>
            <div className="mt-3 space-y-2">
              <textarea value={acCookie} onChange={event => setAcCookie(event.target.value)} rows={2}
                aria-label="AcWing Cookie"
                placeholder="csrftoken=…; sessionid=…"
                className={textarea} />
              {acCookie.trim() && <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => void savePlatform('ACWING', acCookie)}
                  disabled={saving || refreshing} aria-busy={saving}>
                  {saving ? '保存中…' : '保存'}
                </Button>
              </div>}
            </div>
          </section>

          <section className="rounded-card border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-text-primary dark:text-text-dark-primary">杭电 HDU</h2>
                <span className="text-xs text-text-muted dark:text-text-dark-muted">可选</span>
              </div>
              <StatusChip ok={status.HDU} okLabel="已配置" idleLabel="未配置" />
            </div>
            <div className="mt-3 space-y-2">
              <textarea value={hduCookie} onChange={event => setHduCookie(event.target.value)} rows={2}
                aria-label="杭电 HDU Cookie"
                placeholder="PHPSESSID=…; exesubmitlang=0"
                className={textarea} />
              {hduCookie.trim() && <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => void savePlatform('HDU', hduCookie)}
                  disabled={saving || refreshing} aria-busy={saving}>
                  {saving ? '保存中…' : '保存'}
                </Button>
              </div>}
            </div>
          </section>
        </div>
    </PageShell>
  )
}
