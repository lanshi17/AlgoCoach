import React, { useMemo, useState } from 'react'
import { Download, KeyRound, Moon, Sun } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import { agentService } from '@/services/agentService'
import { leetcodeService } from '@/services/leetcodeService'
import type { ModelProviderConfig, TrainingGoal } from '@/types'
import { CUSTOM_PROVIDER_PRESET, PROTOCOL_OPTIONS, PROVIDER_PRESETS, providerFromPreset } from '@/services/providerPresets'
import { LANGUAGE_OPTIONS } from '@/services/languages'

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, setLang, goal, setGoal, theme, toggleTheme, provider, setProvider, mode } = useAppStore()
  const [exporting, setExporting] = useState(false)
  const [providerMessage, setProviderMessage] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [providerDraft, setProviderDraft] = useState<ModelProviderConfig>(provider)
  const providerDirty = useMemo(
    () => JSON.stringify(providerDraft) !== JSON.stringify(provider),
    [providerDraft, provider],
  )

  const chooseProvider = (id: string) => {
    const preset = id === 'custom'
      ? CUSTOM_PROVIDER_PRESET
      : PROVIDER_PRESETS.find(item => item.id === id) ?? PROVIDER_PRESETS[0]
    setProviderDraft(providerFromPreset(preset, providerDraft.apiKey))
    setProviderMessage('')
  }

  const updateProvider = (patch: Partial<ModelProviderConfig>) => {
    setProviderMessage('')
    setProviderDraft(current => ({ ...current, ...patch }))
  }

  const saveProvider = () => {
    if (!providerDraft.model.trim()) {
      setProviderMessage('请填写模型名。')
      return
    }
    if (!providerDraft.baseUrl.trim()) {
      setProviderMessage('请填写 Provider Base URL。')
      return
    }
    if (providerDraft.protocol !== 'ollama' && !providerDraft.apiKey.trim()) {
      setProviderMessage('请填写 API key；它只会保存在当前浏览器会话。')
      return
    }
    setProvider(providerDraft)
    setProviderMessage('Provider 已保存。')
    const navigationState = location.state as { returnToChat?: boolean } | null
    if (navigationState?.returnToChat) {
      navigate('/workspace', { replace: true, state: { openPanel: 'chat' } })
    }
  }

  const exportData = async () => {
    if (exporting) return
    setExporting(true)
    setExportMessage('')
    try {
      const [memoryArchive, submissions] = await Promise.all([
        agentService.exportMemory(),
        leetcodeService.submissionHistory(),
      ])
      download(memoryArchive, 'algocoach-memory.zip')
      download(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), preferences: { lang, goal, theme }, submissions }, null, 2)], {
        type: 'application/json',
      }), 'algocoach-submissions.json')
      setExportMessage('训练记忆和提交历史已导出。提交历史文件包含你提交过的代码。')
    } catch {
      setExportMessage('导出失败，请确认 Agent 和 Java Gateway 正常运行后重试。')
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
            <p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">{mode === 'FOCUS' ? '专注解题期间不能切换语言，请先返回工作区结束专注。' : '切换题目时优先使用对应语言的模板。'}</p>
            <select id="preferred-language" value={lang} disabled={mode === 'FOCUS'} onChange={event => setLang(event.target.value as typeof lang)}
              className="mt-2 w-full max-w-sm rounded-md border border-border bg-surface-soft px-3 py-2 text-sm disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark-soft">
              {LANGUAGE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
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

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">模型 Provider</p>
              <p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">参考 omp 的 Provider 管理：预设可直接编辑，也支持 OpenAI / Anthropic 兼容的自定义端点。</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-text-muted dark:text-text-dark-muted">预设
                <select aria-label="模型 Provider 预设" value={providerDraft.id} onChange={event => chooseProvider(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft">
                  {PROVIDER_PRESETS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  <option value="custom">自定义 Provider</option>
                </select>
              </label>
              <label className="text-xs text-text-muted dark:text-text-dark-muted">显示名称
                <input aria-label="Provider 名称" value={providerDraft.name} onChange={event => updateProvider({ name: event.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft" />
              </label>
              {(providerDraft.id === 'custom' || providerDraft.protocol === 'openai' || providerDraft.protocol === 'openai-response') && <label className="text-xs text-text-muted dark:text-text-dark-muted">API 协议
                <select aria-label="Provider 协议" value={providerDraft.protocol} onChange={event => updateProvider({ protocol: event.target.value as ModelProviderConfig['protocol'] })}
                  className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft">
                  {PROTOCOL_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {providerDraft.protocol === 'openai-response' && <span className="mt-1 block leading-relaxed">服务端点需支持 OpenAI Responses API；仅支持 Chat Completions 的服务请选择 OpenAI-compatible。</span>}
                {providerDraft.id === 'commandcode-goat' && <span className="mt-1 block leading-relaxed">Command Code 的这个模型支持两种接口；默认使用 Chat Completions，若要尝试 Responses API 可在此切换。</span>}
              </label>}
              <label className="text-xs text-text-muted dark:text-text-dark-muted">Base URL
                <input aria-label="Provider Base URL" value={providerDraft.baseUrl} onChange={event => updateProvider({ baseUrl: event.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft" />
              </label>
              <label className="text-xs text-text-muted dark:text-text-dark-muted">模型名
                <input aria-label="Provider 模型名" value={providerDraft.model} onChange={event => updateProvider({ model: event.target.value })}
                  placeholder="model-name"
                  className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft" />
              </label>
              {providerDraft.protocol !== 'ollama' && <label className="text-xs text-text-muted dark:text-text-dark-muted">API key
                <input aria-label="Provider API key" type="password" autoComplete="off" value={providerDraft.apiKey} onChange={event => updateProvider({ apiKey: event.target.value })}
                  placeholder="仅保存在当前浏览器会话"
                  className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft" />
              </label>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={saveProvider} disabled={!providerDirty}
                className="rounded-md bg-accent px-3 py-2 text-sm text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40">
                {providerDirty ? '保存 Provider' : '已保存'}
              </button>
              {providerDirty && <span className="text-xs text-amber-700 dark:text-amber-300">有未保存的更改</span>}
            </div>
            {providerMessage && <p role="status" aria-live="polite" className={`mt-2 text-xs ${providerMessage.startsWith('请') ? 'text-danger' : 'text-success'}`}>{providerMessage}</p>}
          </div>

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">题库登录态</p>
                <p className="mt-1 text-xs text-text-muted dark:text-text-dark-muted">LeetCode / AcWing / 杭电 HDU 的 Cookie 统一在“题库登录”页管理。</p>
              </div>
              <button type="button" onClick={() => navigate('/settings/platforms')}
                className="h-9 rounded-full border border-border px-4 text-xs text-text-secondary hover:bg-surface-muted dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted">
                进入题库登录
              </button>
            </div>
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
            {exportMessage && <p role="status" aria-live="polite" className={`mt-3 text-xs ${exportMessage.includes('失败') ? 'text-danger' : 'text-success'}`}>{exportMessage}</p>}
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
