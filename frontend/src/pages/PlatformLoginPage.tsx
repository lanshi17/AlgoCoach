import React, { useCallback, useEffect, useRef, useState } from 'react'
import { platformCookieService } from '@/services/platformCookieService'
import { parseCookieHeader, parseLeetCodeCurl } from '@/services/cookieParser'

type StatusMap = { LEETCODE: boolean; ACWING: boolean; HDU: boolean }

const card =
  'rounded-[18px] border border-[#E6E9EF] bg-white p-6 transition-[transform,box-shadow] ' +
  'duration-[250ms] hover:-translate-y-1 hover:shadow-[0_12px_28px_rgb(11_12_15/0.042)] ' +
  'dark:border-border-dark dark:bg-surface-dark-soft dark:hover:shadow-none'
const textarea =
  'w-full rounded-[14px] border border-[#DEE2E9] bg-white px-4 py-2 font-mono text-[12px]/[18px] ' +
  'text-[#111317] outline-none transition-colors duration-150 focus:border-[#5B58FF] ' +
  'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark-primary dark:placeholder:text-text-dark-muted'
const primary =
  'inline-flex h-9 items-center rounded-full bg-[#111317] px-[18px] text-[13px]/[19px] font-medium ' +
  'text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent'

function StatusChip({ ok, okLabel, idleLabel }: { ok: boolean; okLabel: string; idleLabel: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#F2F4F8] px-3 py-1
                     text-[12px]/[16px] tracking-[0.4px] text-[#535B6B] dark:bg-surface-dark-muted dark:text-text-dark-secondary">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? '#0DA740' : '#8E96A7' }} />
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
    <main
      className="h-full overflow-y-auto bg-[#F9FAFD] text-[#111317] dark:bg-surface-dark dark:text-text-dark-primary"
      style={{ fontFamily: "'Inter var', Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" }}
    >
      {confirm && (
        <div className="fixed right-6 top-6 z-[1100] rounded-[6px] bg-[#1D2129] px-1 py-0.5
                        text-[12px]/[16px] tracking-[0.4px] text-white" role="status">
          {confirm}
        </div>
      )}

      <div className="mx-auto w-full max-w-[880px] px-6 pb-16 pt-10">
        <header className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[12px]/[16px] tracking-[0.4px] text-[#8E96A7] dark:text-text-dark-muted">ALGOCOACH · 题库</p>
            <h1 className="mt-2 text-[28px]/[36px] font-semibold tracking-[0.5px] text-[#111317] dark:text-text-dark-primary">题库登录</h1>
            <p className="mt-2 text-[14px]/[20px] tracking-[0.4px] text-[#535B6B] dark:text-text-dark-secondary">
              LeetCode / AcWing / 杭电 HDU 的登录态统一在这里管理；凭据只保存在本机网关数据库。
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={refreshing || saving} aria-busy={refreshing} aria-label="刷新题库登录状态"
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-[#DEE2E9] px-4
                       text-[13px]/[19px] tracking-[0.4px] text-[#111317] transition-colors duration-150
                       hover:border-[#D1D7E2] disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:text-text-dark-primary dark:hover:border-border-dark">
            {refreshing ? '刷新中…' : '刷新状态'}
          </button>
        </header>

        {error && (
          <div role="alert" className="mb-3 rounded-[12px] border border-[#F3C4C4] bg-[#FDECEC] px-4 py-2
                                       text-[12px]/[16px] tracking-[0.4px] text-[#B42318] dark:border-danger/40 dark:bg-danger/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <section className={card}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F4F8]
                                 text-[13px]/[19px] font-medium text-[#111317] dark:bg-surface-dark-muted dark:text-text-dark-primary">LC</span>
                <div>
                  <h2 className="text-[18px]/[28px] font-semibold tracking-[0.4px] text-[#111317] dark:text-text-dark-primary">LeetCode</h2>
                  <p className="text-[12px]/[16px] tracking-[0.4px] text-[#8E96A7] dark:text-text-dark-muted">leetcode.cn · 题单 / 题面 / 运行 / 提交</p>
                </div>
              </div>
              <StatusChip ok={status.LEETCODE} okLabel="已登录" idleLabel="未登录" />
            </div>
            <p className="mt-3 text-[13px]/[19px] tracking-[0.4px] text-[#535B6B] dark:text-text-dark-secondary">
              在 leetcode.cn 登录后复制整段 Cookie 或 cURL 命令；只需包含 LEETCODE_SESSION 与 csrftoken。
            </p>
            <div className="mt-4 space-y-2">
              <textarea value={lcPaste} onChange={event => setLcPaste(event.target.value)} rows={3}
                aria-label="LeetCode Cookie"
                placeholder="Cookie: LEETCODE_SESSION=…; csrftoken=…　或整段 curl 命令"
                className={textarea} />
              <div className="flex justify-end">
                <button onClick={() => void saveLeetCode()} disabled={saving || refreshing || !lcPaste.trim()} aria-busy={saving} className={primary}>
                  {saving ? '保存中…' : '保存 LeetCode 登录态'}
                </button>
              </div>
            </div>
          </section>

          <section className={card}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F4F8]
                                 text-[13px]/[19px] font-medium text-[#111317] dark:bg-surface-dark-muted dark:text-text-dark-primary">AW</span>
                <div>
                  <h2 className="text-[18px]/[28px] font-semibold tracking-[0.4px] text-[#111317] dark:text-text-dark-primary">AcWing</h2>
                  <p className="text-[12px]/[16px] tracking-[0.4px] text-[#8E96A7] dark:text-text-dark-muted">acwing.com · 题单 / 题面 / 标签专项</p>
                </div>
              </div>
              <StatusChip ok={status.ACWING} okLabel="已配置" idleLabel="未配置" />
            </div>
            <p className="mt-3 text-[13px]/[19px] tracking-[0.4px] text-[#535B6B] dark:text-text-dark-secondary">
              登录 acwing.com 后复制请求里的 Cookie 请求头（含 csrftoken、sessionid）粘贴到下面。
            </p>
            <div className="mt-4 space-y-2">
              <textarea value={acCookie} onChange={event => setAcCookie(event.target.value)} rows={2}
                aria-label="AcWing Cookie"
                placeholder="csrftoken=…; sessionid=…"
                className={textarea} />
              <div className="flex justify-end">
                <button onClick={() => void savePlatform('ACWING', acCookie)} disabled={saving || refreshing || !acCookie.trim()} aria-busy={saving} className={primary}>
                  {saving ? '保存中…' : '保存 AcWing 登录态'}
                </button>
              </div>
            </div>
          </section>

          <section className={card}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F4F8]
                                 text-[13px]/[19px] font-medium text-[#111317] dark:bg-surface-dark-muted dark:text-text-dark-primary">HD</span>
                <div>
                  <h2 className="text-[18px]/[28px] font-semibold tracking-[0.4px] text-[#111317] dark:text-text-dark-primary">杭电 HDU</h2>
                  <p className="text-[12px]/[16px] tracking-[0.4px] text-[#8E96A7] dark:text-text-dark-muted">acm.hdu.edu.cn · 题单 / 题面</p>
                </div>
              </div>
              <StatusChip ok={status.HDU} okLabel="已配置" idleLabel="未配置" />
            </div>
            <p className="mt-3 text-[13px]/[19px] tracking-[0.4px] text-[#535B6B] dark:text-text-dark-secondary">
              Cookie 可选：不填写也能浏览题面；填写后列表会显示“已解决”标记。
            </p>
            <div className="mt-4 space-y-2">
              <textarea value={hduCookie} onChange={event => setHduCookie(event.target.value)} rows={2}
                aria-label="杭电 HDU Cookie"
                placeholder="PHPSESSID=…; exesubmitlang=0"
                className={textarea} />
              <div className="flex justify-end">
                <button onClick={() => void savePlatform('HDU', hduCookie)} disabled={saving || refreshing || !hduCookie.trim()} aria-busy={saving} className={primary}>
                  {saving ? '保存中…' : '保存 HDU 登录态'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
