/**
 * First-launch page — guides user through pasting their LeetCode cookies.
 * Shown when /api/auth/status returns { authenticated: false }.
 */
import React, { useState } from 'react'
import { Cookie } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { leetcodeService } from '@/services/leetcodeService'

const STEPS = [
  '在浏览器中打开 leetcode.cn 并登录',
  '按 F12 打开开发者工具，切换到「应用程序」→「Cookie」',
  '找到 LEETCODE_SESSION 和 csrftoken 的值',
  '粘贴到下方输入框',
]

export default function CookieSetupPage({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const [session, setSession] = useState('')
  const [csrf, setCsrf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!session.trim() || !csrf.trim()) { setError('两个字段都需要填写'); return }
    setLoading(true); setError('')
    try {
      await leetcodeService.setCookie(session.trim(), csrf.trim())
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
        {/* Inputs */}
        <div className="space-y-3 mb-4">
          {[
            { label: 'LEETCODE_SESSION', value: session, set: setSession },
            { label: 'csrftoken', value: csrf, set: setCsrf },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label htmlFor={`cookie-${label}`} className="block text-xs font-mono text-text-muted dark:text-text-dark-muted mb-1">
                {label}
              </label>
              <input
                id={`cookie-${label}`}
                type="password"
                autoComplete="off"
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={`粘贴 ${label} 值…`}
                className="w-full px-3 py-2 rounded-lg bg-surface-soft dark:bg-surface-dark-soft
                           border border-border dark:border-border-dark text-sm font-mono
                           text-text-primary dark:text-text-dark-primary outline-none
                           focus:border-accent transition-colors
                           placeholder:text-text-muted dark:placeholder:text-text-dark-muted"
              />
            </div>
          ))}
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
