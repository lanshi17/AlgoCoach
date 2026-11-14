import React, { useState } from 'react'
import { Download, KeyRound, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import { agentService } from '@/services/agentService'
import { leetcodeService } from '@/services/leetcodeService'
import type { TrainingGoal } from '@/types'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { lang, setLang, goal, setGoal, theme, toggleTheme } = useAppStore()
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')

  const exportData = async () => {
    if (exporting) return
    setExporting(true)
    setMessage('')
    try {
      const [memoryArchive, submissions] = await Promise.all([
        agentService.exportMemory(),
        leetcodeService.submissionHistory(),
      ])
      download(memoryArchive, 'algocoach-memory.zip')
      download(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), preferences: { lang, goal, theme }, submissions }, null, 2)], {
        type: 'application/json',
      }), 'algocoach-submissions.json')
      setMessage('训练记忆和提交历史已导出。提交历史文件包含你提交过的代码。')
    } catch {
      setMessage('导出失败，请确认 Agent 和 Java Gateway 正常运行后重试。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-surface px-6 py-7 dark:bg-surface-dark">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7">
          <p className="text-xs uppercase tracking-widest text-text-muted dark:text-text-dark-muted">AlgoCoach</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary dark:text-text-dark-primary">设置</h1>
          <p className="mt-2 text-sm text-text-secondary dark:text-text-dark-secondary">训练偏好保存在当前浏览器；训练记录保存在本机服务目录。</p>
        </header>

        <section className="space-y-5 rounded-lg border border-border p-5 dark:border-border-dark">
          <div>
            <label htmlFor="preferred-language" className="block text-sm font-medium text-text-primary dark:text-text-dark-primary">默认编程语言</label>
            <p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">切换题目时优先使用对应语言的 LeetCode 模板。</p>
            <select id="preferred-language" value={lang} onChange={event => setLang(event.target.value as typeof lang)}
              className="mt-2 w-full max-w-sm rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft">
              <option value="rust">Rust</option><option value="cpp">C++</option><option value="python3">Python 3</option>
            </select>
          </div>

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <label htmlFor="training-goal" className="block text-sm font-medium text-text-primary dark:text-text-dark-primary">教练训练目标</label>
            <p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">OI/xCPC 阶段设置仍可在对话面板中逐题切换。</p>
            <select id="training-goal" value={goal} onChange={event => setGoal(event.target.value as TrainingGoal)}
              className="mt-2 w-full max-w-sm rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft">
              <option value="contest">OI / xCPC 竞赛训练</option>
              <option value="interview_prep">技术面试准备</option>
              <option value="casual">日常算法学习</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5 dark:border-border-dark">
            <div><p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">外观主题</p><p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">当前选择会保存在此浏览器。</p></div>
            <button onClick={toggleTheme} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm dark:border-border-dark">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}{theme === 'dark' ? '切换浅色' : '切换深色'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5 dark:border-border-dark">
            <div><p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">LeetCode 登录态</p><p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">Cookie 只保存在本机 Gateway 数据库。</p></div>
            <button onClick={() => navigate('/settings/cookie')} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm dark:border-border-dark">
              <KeyRound size={16} />重新设置 Cookie
            </button>
          </div>

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">导出本地数据</p><p className="mt-1 max-w-xl text-xs text-text-muted dark:text-text-dark-muted">下载 AgentScope/ReMe、SQLite、Chroma 训练记忆和浏览器偏好，以及 LeetCode 提交历史。提交历史包含代码。</p></div>
              <button onClick={() => void exportData()} disabled={exporting} className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-white disabled:opacity-50">
                <Download size={16} />{exporting ? '正在导出…' : '导出数据'}
              </button>
            </div>
            {message && <p role="status" className="mt-3 text-xs text-text-secondary dark:text-text-dark-secondary">{message}</p>}
          </div>
        </section>
      </div>
    </main>
  )
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
