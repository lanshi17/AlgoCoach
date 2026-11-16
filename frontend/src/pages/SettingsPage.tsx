import React, { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Download, SlidersHorizontal } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { readProviderApiKey, useAppStore } from '@/stores/useAppStore'
import { agentService } from '@/services/agentService'
import { leetcodeService } from '@/services/leetcodeService'
import type { CoachStyle, ModelProviderConfig, TrainingGoal } from '@/types'
import { CUSTOM_PROVIDER_PRESET, PROTOCOL_OPTIONS, PROVIDER_PRESETS, providerFromPreset } from '@/services/providerPresets'
import Button from '@/components/Common/Button'
import PageHeader from '@/components/Common/PageHeader'
import Switch from '@/components/Common/Switch'

const field = 'mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft'
const label = 'text-xs text-text-muted dark:text-text-dark-muted'

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { goal, setGoal, provider, setProvider, mode, coachPrefs, setCoachPrefs } = useAppStore(useShallow(state => ({
    goal: state.goal,
    setGoal: state.setGoal,
    provider: state.provider,
    setProvider: state.setProvider,
    mode: state.mode,
    coachPrefs: state.coachPrefs,
    setCoachPrefs: state.setCoachPrefs,
  })))
  const [exporting, setExporting] = useState(false)
  const [providerMessage, setProviderMessage] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [providerDraft, setProviderDraft] = useState<ModelProviderConfig>(provider)
  const providerDirty = useMemo(
    () => JSON.stringify(providerDraft) !== JSON.stringify(provider),
    [providerDraft, provider],
  )
  const { lang, theme } = useAppStore(useShallow(state => ({ lang: state.lang, theme: state.theme })))

  const chooseProvider = (id: string) => {
    const preset = id === 'custom'
      ? CUSTOM_PROVIDER_PRESET
      : PROVIDER_PRESETS.find(item => item.id === id) ?? PROVIDER_PRESETS[0]
    const apiKey = id === providerDraft.id
      ? providerDraft.apiKey
      : readProviderApiKey(preset.id)
    setProviderDraft(providerFromPreset(preset, apiKey))
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
      const [memoryResult, submissionsResult] = await Promise.allSettled([
        agentService.exportMemory(),
        leetcodeService.submissionHistory(),
      ])
      if (memoryResult.status === 'rejected') throw memoryResult.reason

      download(memoryResult.value, 'algocoach-memory.zip')
      if (submissionsResult.status === 'fulfilled') {
        download(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), preferences: { lang, goal, theme }, submissions: submissionsResult.value }, null, 2)], {
          type: 'application/json',
        }), 'algocoach-submissions.json')
        setExportMessage('训练记忆和提交历史已导出（提交历史包含代码）。')
      } else {
        setExportMessage('训练记忆已导出；提交历史暂未导出，请配置有效的 LeetCode Cookie 后重试。')
      }
    } catch {
      setExportMessage('导出失败，请确认 Agent 和 Java Gateway 正常运行后重试。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-surface px-6 py-7 dark:bg-surface-dark">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="设置" icon={<SlidersHorizontal size={18} />} />

        <section className="space-y-5 rounded-lg border border-border p-5 dark:border-border-dark">
          <div>
            <label htmlFor="training-goal" className="block text-sm font-medium text-text-primary dark:text-text-dark-primary">训练目标</label>
            <select id="training-goal" value={goal} onChange={event => setGoal(event.target.value as TrainingGoal)}
              className={`${field} max-w-sm`}>
              <option value="contest">OI / xCPC 竞赛训练</option>
              <option value="interview_prep">技术面试准备</option>
              <option value="casual">日常算法学习</option>
            </select>
          </div>

          <div className="space-y-4 border-t border-border pt-5 dark:border-border-dark">
            <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">AI 教练</p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary dark:text-text-dark-primary">自动赛后复盘</span>
              <Switch label="自动赛后复盘" checked={coachPrefs.autoReview}
                onChange={value => setCoachPrefs({ autoReview: value })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary dark:text-text-dark-primary">显示思考过程</span>
              <Switch label="显示思考过程" checked={coachPrefs.showThinking}
                onChange={value => setCoachPrefs({ showThinking: value })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary dark:text-text-dark-primary">动画讲解</span>
              <Switch label="动画讲解" checked={coachPrefs.animations}
                onChange={value => setCoachPrefs({ animations: value })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary dark:text-text-dark-primary">教练风格</span>
              <select aria-label="教练风格" value={coachPrefs.coachStyle}
                onChange={event => setCoachPrefs({ coachStyle: event.target.value as CoachStyle })}
                className="w-40 rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft">
                <option value="auto">自动</option>
                <option value="socratic">苏格拉底式追问</option>
                <option value="direct">直接讲解</option>
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">模型 Provider</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={label}>预设
                <select aria-label="模型 Provider 预设" value={providerDraft.id} onChange={event => chooseProvider(event.target.value)}
                  className={field}>
                  {PROVIDER_PRESETS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  <option value="custom">自定义 Provider</option>
                </select>
              </label>
              <label className={label}>显示名称
                <input aria-label="Provider 名称" value={providerDraft.name} onChange={event => updateProvider({ name: event.target.value })}
                  className={field} />
              </label>
              {(providerDraft.id === 'custom' || providerDraft.protocol === 'openai' || providerDraft.protocol === 'openai-response') && <label className={label}>API 协议
                <select aria-label="Provider 协议" value={providerDraft.protocol} onChange={event => updateProvider({ protocol: event.target.value as ModelProviderConfig['protocol'] })}
                  className={field}>
                  {PROTOCOL_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {providerDraft.protocol === 'openai-response' && <span className="mt-1 block leading-relaxed">服务端点需支持 OpenAI Responses API；仅支持 Chat Completions 的请选 OpenAI-compatible。</span>}
              </label>}
              <label className={label}>Base URL
                <input aria-label="Provider Base URL" value={providerDraft.baseUrl} onChange={event => updateProvider({ baseUrl: event.target.value })}
                  placeholder="https://api.example.com/v1"
                  className={field} />
              </label>
              <label className={label}>模型名
                <input aria-label="Provider 模型名" value={providerDraft.model} onChange={event => updateProvider({ model: event.target.value })}
                  placeholder="model-name"
                  className={field} />
              </label>
              {providerDraft.protocol !== 'ollama' && <label className={label}>API key
                <input aria-label="Provider API key" type="password" autoComplete="off" value={providerDraft.apiKey} onChange={event => updateProvider({ apiKey: event.target.value })}
                  placeholder="仅保存在当前浏览器会话"
                  className={field} />
              </label>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {providerDirty
                ? <Button variant="primary" onClick={saveProvider}>保存 Provider</Button>
                : <span className="text-xs text-text-muted dark:text-text-dark-muted">已保存</span>}
              {providerMessage && <span role="status" aria-live="polite" className={`text-xs ${providerMessage.startsWith('请') ? 'text-danger' : 'text-success'}`}>{providerMessage}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-5 dark:border-border-dark">
            <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">题库登录</p>
            <Button onClick={() => navigate('/settings/platforms')} disabled={mode === 'FOCUS'}>管理</Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5 dark:border-border-dark">
            <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">导出本地数据</p>
            <div className="flex items-center gap-3">
              {exportMessage && <span role="status" aria-live="polite" className={`text-xs ${exportMessage.includes('失败') ? 'text-danger' : 'text-success'}`}>{exportMessage}</span>}
              <Button variant="primary" onClick={() => void exportData()} disabled={exporting} aria-busy={exporting}>
                <Download size={15} />{exporting ? '正在导出…' : '导出数据'}
              </Button>
            </div>
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
