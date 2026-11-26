import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Download, SlidersHorizontal, Upload } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { readProviderApiKey, useAppStore } from '@/stores/useAppStore'
import { createWorkspace, getWorkspaceId, readWorkspaceManifests, switchWorkspace, type WorkspaceManifest } from '@/services/deepTutorCapabilities'
import { agentService } from '@/services/agentService'
import { leetcodeService } from '@/services/leetcodeService'
import { createWorkspaceExport } from '@/services/workspaceExport'
import { importWorkspaceSnapshot, parseWorkspaceSnapshot, WORKSPACE_IMPORT_MAX_BYTES } from '@/services/workspaceImport'
import { parseMasteryBundle } from '@/services/masterySync'
import { normalizeHubUrl, readAutoSyncSettings, readLastAutoSync, readLastAutoSyncFailure, runAutoSync, saveAutoSyncSettings, type AutoSyncFailure, type AutoSyncResult, type AutoSyncSettings } from '@/services/autoSync'
import type { CoachStyle, ModelProviderConfig, TrainingGoal } from '@/types'
import { CUSTOM_PROVIDER_PRESET, PROTOCOL_OPTIONS, PROVIDER_PRESETS, providerFromPreset } from '@/services/providerPresets'
import { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_OUTPUT_TOKENS } from '@/services/providerPresets'
import Button from '@/components/Common/Button'
import PageHeader from '@/components/Common/PageHeader'
import Switch from '@/components/Common/Switch'

const control =
  'h-9 w-full rounded-[10px] border border-line-300 bg-surface px-3 text-sm text-text-primary outline-none transition-colors ' +
  'placeholder:text-text-muted focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-primary'
const field = `mt-1 ${control}`
const label = 'text-xs text-text-secondary dark:text-text-dark-secondary'

function formatAutoSyncFailure(failure: AutoSyncFailure): string {
  const when = new Date(failure.at).toLocaleString()
  return `上次自动同步失败：${when} · ${failure.message}`
}

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
  const [masteryExporting, setMasteryExporting] = useState(false)
  const [masteryImporting, setMasteryImporting] = useState(false)
  const [masteryMessage, setMasteryMessage] = useState('')
  const [masteryError, setMasteryError] = useState(false)
  const masteryFileRef = useRef<HTMLInputElement>(null)
  const [autoSync, setAutoSync] = useState<AutoSyncSettings>(() => readAutoSyncSettings())
  const [initialAutoSyncFailure] = useState<AutoSyncFailure | null>(() => (
    readAutoSyncSettings().enabled ? readLastAutoSyncFailure() : null
  ))
  const [autoSyncMessage, setAutoSyncMessage] = useState(() => initialAutoSyncFailure ? formatAutoSyncFailure(initialAutoSyncFailure) : '')
  const [autoSyncError, setAutoSyncError] = useState(Boolean(initialAutoSyncFailure))
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [lastAutoSync, setLastAutoSync] = useState<string | null>(() => readLastAutoSync())
  const [providerMessage, setProviderMessage] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [workspaceImporting, setWorkspaceImporting] = useState(false)
  const [workspaceImportMessage, setWorkspaceImportMessage] = useState('')
  const [workspaceImportError, setWorkspaceImportError] = useState(false)
  const workspaceFileRef = useRef<HTMLInputElement>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceManifest[]>(() => readWorkspaceManifests())
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceMessage, setWorkspaceMessage] = useState('')
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
    const contextWindow = providerDraft.contextWindow ?? DEFAULT_CONTEXT_WINDOW
    const maxOutputTokens = providerDraft.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
    if (!Number.isSafeInteger(contextWindow) || contextWindow < 2 || contextWindow > 10_000_000
      || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens >= contextWindow) {
      setProviderMessage('请填写有效的 token 限额；最大输出必须小于上下文窗口。')
      return
    }
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
      download(new Blob([JSON.stringify(createWorkspaceExport(), null, 2)], {
        type: 'application/json',
      }), 'algocoach-workspace.json')
      const [memoryResult, submissionsResult] = await Promise.allSettled([
        agentService.exportMemory(),
        leetcodeService.submissionHistory(),
      ])
      if (memoryResult.status === 'rejected') {
        setExportMessage('工作空间数据已导出；训练记忆和提交历史暂未导出，请检查服务后重试。')
        return
      }

      download(memoryResult.value, 'algocoach-memory.zip')
      if (submissionsResult.status === 'fulfilled') {
        download(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), preferences: { lang, goal, theme }, submissions: submissionsResult.value }, null, 2)], {
          type: 'application/json',
        }), 'algocoach-submissions.json')
        setExportMessage('工作空间数据、训练记忆和提交历史已导出（提交历史包含代码）。')
      } else {
        setExportMessage('工作空间数据和训练记忆已导出；提交历史暂未导出，请检查 Gateway 后重试。')
      }
    } catch {
      setExportMessage('导出失败，请确认 Agent 和 Java Gateway 正常运行后重试。')
    } finally {
      setExporting(false)
    }
  }

  const importWorkspace = async (file: File) => {
    if (workspaceImporting) return
    if (file.size > WORKSPACE_IMPORT_MAX_BYTES) {
      setWorkspaceImportError(true)
      setWorkspaceImportMessage('工作区备份不能超过 5 MB。')
      if (workspaceFileRef.current) workspaceFileRef.current.value = ''
      return
    }
    setWorkspaceImporting(true)
    setWorkspaceImportError(false)
    setWorkspaceImportMessage('')
    try {
      const snapshot = parseWorkspaceSnapshot(await file.text())
      const result = importWorkspaceSnapshot(snapshot)
      const counts = [
        ['任务', result.tasks],
        ['笔记', result.notebook],
        ['练习记录', result.practiceRecords],
        ['复盘', result.reviews],
        ['复盘事件', result.reviewEvents],
      ] as const
      const added = counts.filter(([, count]) => count.added > 0).map(([label, count]) => `${label} ${count.added} 条`)
      const skipped = counts.reduce((sum, [, count]) => sum + count.skipped, 0)
      setWorkspaceImportMessage([
        added.length ? `已补充 ${added.join('、')}。` : '没有可补充的记录。',
        skipped ? `${skipped} 条未导入（已存在、超出本机上限或格式无效），本机记录保持不变。` : '',
        `来源 workspace：${result.sourceWorkspaceId || '未知'}；导入到当前 workspace。`,
        '布局、对话、代码、Provider 密钥和 Agent 记忆不导入。',
      ].filter(Boolean).join(' '))
    } catch (cause) {
      setWorkspaceImportError(true)
      setWorkspaceImportMessage(cause instanceof Error ? cause.message : '导入工作区失败。')
    } finally {
      setWorkspaceImporting(false)
      if (workspaceFileRef.current) workspaceFileRef.current.value = ''
    }
  }

  const exportMastery = async () => {
    if (masteryExporting || masteryImporting) return
    setMasteryExporting(true)
    setMasteryError(false)
    setMasteryMessage('')
    try {
      const bundle = await agentService.exportMastery()
      download(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }), `algocoach-mastery-${bundle.workspaceId}.json`)
      setMasteryMessage(bundle.topics.length ? `已导出 ${bundle.topics.length} 个知识点。` : '当前 workspace 还没有掌握度记录。')
    } catch {
      setMasteryError(true)
      setMasteryMessage('导出掌握度失败，请确认 Agent 服务正在运行。')
    } finally {
      setMasteryExporting(false)
    }
  }

  const importMasteryFile = async (file: File) => {
    if (masteryImporting || masteryExporting) return
    if (file.size > 2 * 1024 * 1024) {
      setMasteryError(true)
      setMasteryMessage('掌握度文件不能超过 2 MB。')
      return
    }
    setMasteryImporting(true)
    setMasteryError(false)
    setMasteryMessage('')
    try {
      const bundle = parseMasteryBundle(await file.text())
      const result = await agentService.importMastery(bundle)
      const source = bundle.workspaceId && bundle.workspaceId !== getWorkspaceId() ? `（来源 workspace：${bundle.workspaceId}）` : ''
      setMasteryMessage(`已合并 ${result.imported} 个新知识点、更新 ${result.updated} 个，${result.unchanged} 个未变化；复习计划新增 ${result.schedulesImported} 条、更新 ${result.schedulesUpdated} 条，${result.schedulesUnchanged} 条未变化${source}。`)
    } catch (cause) {
      setMasteryError(true)
      setMasteryMessage(cause instanceof Error ? cause.message : '导入掌握度失败，请确认 Agent 服务正在运行。')
    } finally {
      setMasteryImporting(false)
      if (masteryFileRef.current) masteryFileRef.current.value = ''
    }
  }

  const updateAutoSync = (patch: Partial<AutoSyncSettings>) => {
    const next = { ...autoSync, ...patch }
    setAutoSync(next)
    saveAutoSyncSettings(next)
    setAutoSyncMessage('')
    setAutoSyncError(false)
    if (next.enabled && (!normalizeHubUrl(next.hubUrl) || !next.token.trim())) {
      setAutoSyncError(true)
      setAutoSyncMessage('启用自动同步需要填写同步服务地址和令牌。')
    }
  }

  const runSyncNow = async () => {
    const hubUrl = normalizeHubUrl(autoSync.hubUrl)
    if (!hubUrl || !autoSync.token.trim()) {
      setAutoSyncError(true)
      setAutoSyncMessage('启用自动同步需要填写同步服务地址和令牌。')
      return
    }
    const saved = saveAutoSyncSettings({ ...autoSync, hubUrl })
    setAutoSync(saved)
    setAutoSyncing(true)
    setAutoSyncError(false)
    setAutoSyncMessage('')
    try {
      const result = await runAutoSync()
      if (result.status === 'disabled') {
        setAutoSyncMessage('自动同步未启用或配置不完整。')
        return
      }
      setLastAutoSync(result.at ?? null)
      setAutoSyncMessage(result.counts
        ? `同步完成：知识点新增 ${result.counts.imported}、更新 ${result.counts.updated}；复习计划新增 ${result.counts.schedulesImported}、更新 ${result.counts.schedulesUpdated}。`
        : '同步完成。')
    } catch (cause) {
      setAutoSyncError(true)
      setAutoSyncMessage(cause instanceof Error ? cause.message : '自动同步失败，请检查同步服务地址和令牌。')
    } finally {
      setAutoSyncing(false)
    }
  }

  useEffect(() => {
    const onAutoSync = (event: Event) => {
      const detail = (event as CustomEvent<AutoSyncResult>).detail
      if (detail?.status === 'failed') {
        setAutoSyncError(true)
        setAutoSyncMessage(`后台同步失败：${detail.message ?? '未知错误'}`)
        return
      }
      if (detail?.status !== 'synced') return
      setLastAutoSync(detail.at ?? null)
      setAutoSyncError(false)
      setAutoSyncMessage('后台同步完成。')
    }
    window.addEventListener('algocoach:auto-sync', onAutoSync)
    return () => window.removeEventListener('algocoach:auto-sync', onAutoSync)
  }, [])

  const changeWorkspace = (workspaceId: string) => {
    switchWorkspace(workspaceId)
    window.location.reload()
  }

  const addWorkspace = () => {
    try {
      const next = createWorkspace(workspaceName)
      const created = next[next.length - 1]
      setWorkspaces(next)
      setWorkspaceName('')
      setWorkspaceMessage(`已创建「${created.name}」，正在切换。`)
      window.setTimeout(() => changeWorkspace(created.id), 120)
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : '创建 workspace 失败。')
    }
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-canvas px-6 py-7 dark:bg-[#0B0C0F]">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="设置" icon={<SlidersHorizontal size={18} />} />

        <section className="space-y-5 rounded-panel border border-border bg-surface p-7 dark:border-border-dark dark:bg-surface-dark">
          <div>
            <label htmlFor="training-goal" className="block text-sm font-medium text-text-primary dark:text-text-dark-primary">训练目标</label>
            <select id="training-goal" value={goal} onChange={event => setGoal(event.target.value as TrainingGoal)}
              className={`${field} max-w-sm`}>
              <option value="contest">OI / xCPC 竞赛训练</option>
              <option value="interview_prep">技术面试准备</option>
              <option value="casual">日常算法学习</option>
            </select>
          </div>

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">本地 Workspace</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary dark:text-text-dark-secondary">不同 workspace 的练习本、复盘、草稿和任务板相互隔离。切换后应用会重新载入。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select aria-label="本地 Workspace" value={getWorkspaceId()} onChange={event => changeWorkspace(event.target.value)} className={`${control} max-w-sm`}>
                {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.id}</option>)}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input aria-label="新 Workspace 名称" value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} placeholder="例如：2027 春季训练" className={`${control} max-w-sm`} />
              <Button variant="secondary" onClick={addWorkspace} disabled={!workspaceName.trim()}>创建并切换</Button>
            </div>
            {workspaceMessage && <p role="status" className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">{workspaceMessage}</p>}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-text-primary dark:text-text-dark-primary">教练风格</span>
              <select aria-label="教练风格" value={coachPrefs.coachStyle}
                onChange={event => setCoachPrefs({ coachStyle: event.target.value as CoachStyle })}
                className={`${control} w-40`}>
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
              <label className={label}>上下文窗口（tokens）
                <input aria-label="上下文窗口" type="number" min={2} max={10000000}
                  value={providerDraft.contextWindow ?? DEFAULT_CONTEXT_WINDOW}
                  onChange={event => updateProvider({ contextWindow: Number(event.target.value) })} className={field} />
              </label>
              <label className={label}>最大输出（tokens）
                <input aria-label="最大输出 tokens" type="number" min={1} max={10000000}
                  value={providerDraft.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS}
                  onChange={event => updateProvider({ maxOutputTokens: Number(event.target.value) })} className={field} />
              </label>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary sm:col-span-2">请按所选模型的实际限制调整。最大输出会发送给模型服务；上下文窗口用于记录模型容量，不会扩展模型自身能力。</p>
              {providerDraft.protocol !== 'ollama' && <label className={label}>API key
                <input aria-label="Provider API key" type="password" autoComplete="off" value={providerDraft.apiKey} onChange={event => updateProvider({ apiKey: event.target.value })}
                  placeholder="仅保存在当前浏览器会话"
                  className={field} />
              </label>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {providerDirty
                ? <Button variant="primary" onClick={saveProvider}>保存 Provider</Button>
                : <span className="text-xs text-text-secondary dark:text-text-dark-secondary">已保存</span>}
              {providerMessage && <span role="status" aria-live="polite" className={`text-xs ${providerMessage.startsWith('请') ? 'text-danger' : 'text-success'}`}>{providerMessage}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-5 dark:border-border-dark">
            <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">题库登录</p>
            <Button onClick={() => navigate('/settings/platforms')} disabled={mode === 'FOCUS'}>管理</Button>
          </div>

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">本地数据备份</p>
                <p className="mt-1 text-xs text-text-secondary dark:text-text-dark-secondary">导入只补充本机没有的任务、笔记、练习记录和复盘；已有记录保持不变。</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {exportMessage && <span role="status" aria-live="polite" className={`text-xs ${exportMessage.includes('失败') ? 'text-danger' : 'text-success'}`}>{exportMessage}</span>}
                <input
                  ref={workspaceFileRef}
                  type="file"
                  accept="application/json,.json"
                  aria-label="选择工作区备份文件"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0]
                    if (file) void importWorkspace(file)
                  }}
                />
                <Button onClick={() => workspaceFileRef.current?.click()} disabled={workspaceImporting} aria-busy={workspaceImporting}>
                  <Upload size={15} />{workspaceImporting ? '正在导入…' : '导入备份'}
                </Button>
                <Button variant="primary" onClick={() => void exportData()} disabled={exporting} aria-busy={exporting}>
                  <Download size={15} />{exporting ? '正在导出…' : '导出数据'}
                </Button>
              </div>
            </div>
            {workspaceImportMessage && (
              <p role="status" aria-live="polite" className={`mt-2 text-xs ${workspaceImportError ? 'text-danger' : 'text-success'}`}>
                {workspaceImportMessage}
              </p>
            )}
          </div>

          <div className="border-t border-border pt-5 dark:border-border-dark">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">跨设备掌握度与复习计划</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary dark:text-text-dark-secondary">在一台设备导出 JSON，在另一台导入。知识点取较高掌握度、较大训练次数和较新时间；复习计划按更新时间取较新状态，通知记录仍保留在本机。重复导入不会重复计数，也不含提交记录、对话或代码。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {masteryMessage && <span role="status" aria-live="polite" className={`max-w-xs text-xs ${masteryError ? 'text-danger' : 'text-success'}`}>{masteryMessage}</span>}
                <input
                  ref={masteryFileRef}
                  type="file"
                  accept="application/json,.json"
                  aria-label="选择掌握度文件"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0]
                    if (file) void importMasteryFile(file)
                  }}
                />
                <Button onClick={() => masteryFileRef.current?.click()} disabled={masteryImporting || masteryExporting} aria-busy={masteryImporting}>
                  <Upload size={15} />{masteryImporting ? '正在导入…' : '导入掌握度'}
                </Button>
                <Button variant="primary" onClick={() => void exportMastery()} disabled={masteryExporting || masteryImporting} aria-busy={masteryExporting}>
                  <Download size={15} />{masteryExporting ? '正在导出…' : '导出掌握度'}
                </Button>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3 dark:border-border-dark">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-text-primary dark:text-text-dark-primary">自动同步（共享同步服务）</p>
                <Switch label="自动跨设备同步" checked={autoSync.enabled} onChange={enabled => updateAutoSync({ enabled })} />
              </div>
              <p className="mt-1 text-xs leading-5 text-text-secondary dark:text-text-dark-secondary">两台设备连接同一个同步服务，每 60 秒、页面重新可见或网络恢复时自动交换。服务端需设置 <code className="font-mono">ALGOCOACH_SYNC_TOKEN</code>，并允许当前网页 Origin；令牌只保存在本机浏览器。</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input aria-label="同步服务地址" value={autoSync.hubUrl} onChange={event => updateAutoSync({ hubUrl: event.target.value })} placeholder="http://192.168.1.10:8080" className={control} />
                <input aria-label="同步令牌" type="password" autoComplete="off" value={autoSync.token} onChange={event => updateAutoSync({ token: event.target.value })} placeholder="ALGOCOACH_SYNC_TOKEN" className={control} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button onClick={() => void runSyncNow()} disabled={autoSyncing || !autoSync.enabled} aria-busy={autoSyncing}>
                  <Upload size={15} />{autoSyncing ? '正在同步…' : '保存并同步'}
                </Button>
                {lastAutoSync && <span className="text-xs text-text-muted dark:text-text-dark-muted">最近同步：{new Date(lastAutoSync).toLocaleString()}</span>}
                {autoSyncMessage && <span role="status" aria-live="polite" className={`max-w-xs text-xs ${autoSyncError ? 'text-danger' : 'text-success'}`}>{autoSyncMessage}</span>}
              </div>
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
