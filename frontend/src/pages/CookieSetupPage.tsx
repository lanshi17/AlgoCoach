/**
 * First-launch page — guides user through pasting their LeetCode cookies.
 * Shown when /api/auth/status returns { authenticated: false }.
 */
import React, { useState } from 'react'
import { Cookie } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { leetcodeService } from '@/services/leetcodeService'
import { parseLeetCodeCurl } from '@/services/cookieParser'

const STEPS = [
  '在浏览器中打开 leetcode.cn 并登录',
  '打开开发者工具，在 Network 中刷新 leetcode.cn 页面',
  '右键页面请求 → Copy → Copy as cURL (bash)',
  '把完整 curl 粘贴到下方；前端只提取登录 Cookie',
]

export default function CookieSetupPage({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const [curl, setCurl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const parsed = parseLeetCodeCurl(curl)
    if (!parsed) {
      setError('没有找到 LEETCODE_SESSION 和 csrftoken，请粘贴 leetcode.cn 的完整 curl。')
      return
    }
    setLoading(true); setError('')
    try {
      await leetcodeService.setCookie(parsed.session, parsed.csrf)
      if (!await leetcodeService.verifyCookie()) {
        setError('LeetCode 没有确认登录状态，请重新复制当前有效的 Cookie。')
        return
      }
      onDone()
      navigate('/workspace')
    } catch {
      setError('Cookie 已保存，但 LeetCode 验证未通过。请确认仍处于登录状态并检查 Cookie 后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface dark:bg-surface-dark px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
            <Cookie size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">
            连接 LeetCode
          </h1>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary text-center">
            需要你的登录 Cookie 才能拉取题目和提交代码
          </p>
        </div>

        {/* Steps */}
        <ol className="mb-6 space-y-2">
          {STEPS.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-secondary dark:text-text-dark-secondary">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent
                               text-xs flex items-center justify-center font-mono mt-0.5">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        <form onSubmit={event => { event.preventDefault(); void save() }}>
        {/* Browser-generated curl stays local to this page. */}
        <div className="mb-4">
          <label htmlFor="leetcode-curl" className="block text-xs font-mono text-text-muted dark:text-text-dark-muted mb-1">
            leetcode.cn curl
          </label>
          <textarea
            id="leetcode-curl"
            autoComplete="off"
            value={curl}
            onChange={event => setCurl(event.target.value)}
            placeholder="curl 'https://leetcode.cn/' ... -b 'LEETCODE_SESSION=...; csrftoken=...'"
            rows={7}
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg bg-surface-soft dark:bg-surface-dark-soft
                       border border-border dark:border-border-dark text-xs font-mono
                       text-text-primary dark:text-text-dark-primary outline-none resize-y
                       focus:border-accent transition-colors
                       placeholder:text-text-muted dark:placeholder:text-text-dark-muted"
          />
          <p className="mt-1 text-[11px] text-text-muted dark:text-text-dark-muted">
            curl 只在浏览器内存中解析；保存时仅发送两个 Cookie 值到本机 Gateway。
          </p>
        </div>

        {error && (
          <p className="text-xs text-danger mb-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white
                     text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? '保存中…' : '保存并开始'}
        </button>
        </form>

        <p className="mt-3 text-xs text-text-muted dark:text-text-dark-muted text-center">
          Cookie 存在本机 Java Gateway 数据库中，只用于向 LeetCode 发起已登录请求。
        </p>
      </div>
    </div>
  )
}
