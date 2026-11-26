import React, { useEffect, useRef, useState } from 'react'
import { BookOpen, Database, FileText, RefreshCw, Trash2, Upload } from 'lucide-react'
import { agentService } from '@/services/agentService'
import type { KnowledgeEmbeddingConfig, KnowledgeSource, KnowledgeStatus } from '@/types'
import Button from '@/components/Common/Button'
import PageShell from '@/components/Common/PageShell'
import { useNavigate } from 'react-router-dom'

const field = 'mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft'

export default function KnowledgeBasePage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [draft, setDraft] = useState({ provider: 'local' as KnowledgeEmbeddingConfig['provider'], model: 'all-MiniLM-L6-v2', baseUrl: '', apiKey: '', dimensions: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [patterns, setPatterns] = useState<Array<{ id: number; description: string; frequency: number; lastSeen: string }>>([])
  const [memoryError, setMemoryError] = useState('')

  const load = async () => {
    setError('')
    try {
      const next = await agentService.getKnowledgeStatus()
      setStatus(next)
      setDraft(current => ({ ...current, provider: next.config.provider, model: next.config.model, baseUrl: next.config.baseUrl, dimensions: next.config.dimensions ? String(next.config.dimensions) : '' }))
    } catch {
      setError('无法读取知识库状态，请确认 Agent 服务正在运行。')
    }
  }

  useEffect(() => { void load(); void agentService.getMemoryPatterns().then(setPatterns).catch(() => setMemoryError('无法读取个性化记忆点。')) }, [])

  const saveConfig = async () => {
    setBusy(true); setMessage(''); setError('')
    try {
      const config = await agentService.updateKnowledgeConfig({
        provider: draft.provider, model: draft.model, baseUrl: draft.baseUrl,
        apiKey: draft.apiKey, dimensions: draft.dimensions ? Number(draft.dimensions) : null,
      })
      setDraft(current => ({ ...current, apiKey: '' }))
      setMessage('Embedding 配置已保存；已有源文件需要重新建立索引。')
      setStatus(current => current ? { ...current, config } : current)
    } catch (cause) {
      setError(getKnowledgeErrorMessage(cause, 'Embedding 配置保存失败。'))
    } finally { setBusy(false) }
  }

  const upload = async (files: File[]) => {
    if (!files.length) return
    setBusy(true); setMessage(''); setError('')
    try {
      await agentService.uploadKnowledgeSources(files)
      setMessage(`已上传 ${files.length} 个源文件并完成索引。`)
      await load()
    } catch (cause) {
      setError(getKnowledgeErrorMessage(cause, '源文件上传失败。'))
    } finally { setBusy(false) }
  }

  const reindex = async () => {
    setBusy(true); setMessage(''); setError('')
    try {
      const result = await agentService.reindexKnowledge()
      setMessage(`索引完成：${result.files} 个文件，${result.chunks} 个文本片段。`)
      await load()
    } catch (cause) {
      setError(getKnowledgeErrorMessage(cause, '索引重建失败。'))
    } finally { setBusy(false) }
  }

  const remove = async (source: KnowledgeSource) => {
    if (!window.confirm(`删除「${source.name}」及其索引？`)) return
    setBusy(true); setError('')
    try { await agentService.deleteKnowledgeSource(source.id); await load(); setMessage('源文件和对应索引已删除。') }
    catch (cause) { setError(getKnowledgeErrorMessage(cause, '删除源文件失败。')) }
    finally { setBusy(false) }
  }

  return (
    <PageShell
      title="知识库"
      icon={<BookOpen size={18} />}
      actions={<><Button size="sm" onClick={() => navigate('/knowledge/graph')}>掌握度图谱</Button><Button size="sm" onClick={() => void load()} disabled={busy}><RefreshCw size={14} />刷新</Button></>}
    >
      <p className="mb-6 max-w-2xl text-body text-text-secondary">把自己的笔记、题解和课程资料放进 AlgoCoach。源文件保存在 Agent 所在设备。选择远程 embedding 或对话模型时，文本片段可能发送给对应服务。</p>

      {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">{error}</div>}
      {message && <div role="status" className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-body text-success">{message}</div>}

      <section className="mb-4 rounded-card border border-border bg-surface p-5" aria-label="个性化记忆点">
        <h2 className="text-[15px] font-semibold tracking-title text-text-primary">个性化记忆点</h2>
        <p className="mt-1 text-xs text-text-muted">这里管理教练记录的学习习惯与常见错误；删除只影响这些记忆点。训练记录及其他对话记忆不会在此删除。</p>
        {memoryError && <p role="alert" className="mt-2 text-sm text-danger">{memoryError}</p>}
        {!patterns.length && !memoryError && <p className="mt-3 text-sm text-text-muted">暂无记忆点。</p>}
        <ul className="mt-3 space-y-2">{patterns.map(pattern => <li key={pattern.id} className="flex items-start justify-between gap-3 text-sm"><span>{pattern.description} <span className="text-xs text-text-muted">· {pattern.frequency} 次</span></span><button type="button" aria-label={`删除记忆点：${pattern.description}`} className="shrink-0 text-danger" onClick={() => { void agentService.deleteMemoryPattern(pattern.id).then(() => setPatterns(current => current.filter(item => item.id !== pattern.id))).catch(() => setMemoryError('删除记忆点失败。')) }}>删除</button></li>)}</ul>
      </section>

      <section className="space-y-4 rounded-card border border-border bg-surface p-5">
        <div className="flex items-center gap-2"><Database size={16} className="text-accent" /><h2 className="text-[15px] font-semibold tracking-title text-text-primary">Embedding 模型</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-text-muted">供应商
            <select className={field} value={draft.provider} onChange={event => setDraft({ ...draft, provider: event.target.value as KnowledgeEmbeddingConfig['provider'] })}>
              <option value="local">本地 ONNX（all-MiniLM-L6-v2）</option>
              <option value="openai-compatible">自定义 OpenAI-compatible</option>
            </select>
          </label>
          <label className="text-xs text-text-muted">模型名
            <input className={field} value={draft.model} onChange={event => setDraft({ ...draft, model: event.target.value })} placeholder="text-embedding-3-small" />
          </label>
          {draft.provider === 'openai-compatible' && <>
            <label className="text-xs text-text-muted sm:col-span-2">Embeddings Base URL
              <input className={field} value={draft.baseUrl} onChange={event => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" />
            </label>
            <label className="text-xs text-text-muted">API key
              <input className={field} type="password" autoComplete="off" value={draft.apiKey} onChange={event => setDraft({ ...draft, apiKey: event.target.value })} placeholder={status?.config.hasApiKey ? '已保存，留空表示不更换' : '仅保存在 Agent 本机'} />
            </label>
            <label className="text-xs text-text-muted">向量维度
              <input className={field} type="number" min="1" max="8192" value={draft.dimensions} onChange={event => setDraft({ ...draft, dimensions: event.target.value })} placeholder="1536" />
            </label>
          </>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void saveConfig()} disabled={busy}>保存 Embedding 配置</Button>
          <Button onClick={() => void reindex()} disabled={busy}>重建全部索引</Button>
          {status && <span className="text-xs text-text-muted">当前索引 {status.indexedChunks} 个片段</span>}
        </div>
      </section>

      <section className="mt-5 rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-[15px] font-semibold tracking-title text-text-primary">源知识库</h2><p className="mt-1 text-meta text-text-muted">支持 TXT、Markdown、JSON、CSV、HTML、PDF、DOCX 和 ZIP；单文件 20 MB，单次 100 MB。</p></div>
          <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={15} />上传文件</Button>
          <input ref={inputRef} className="hidden" type="file" multiple accept=".txt,.md,.markdown,.rst,.log,.json,.csv,.tsv,.yaml,.yml,.html,.htm,.pdf,.docx,.zip" onChange={event => { void upload(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
        </div>
        <div className="mt-4 divide-y divide-border dark:divide-border-dark">
          {!status?.sources.length ? <div className="my-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-300 px-6 py-10 text-center">
            <FileText size={20} className="text-text-muted" />
            <p className="text-body text-text-secondary">还没有源文件</p>
            <p className="max-w-xs text-meta text-text-muted">上传后，教练会在相关问题中检索这些资料。</p>
          </div> : status.sources.map(source => <div key={source.id} className="flex items-center justify-between gap-3 py-3 text-body">
            <div className="min-w-0"><p className="truncate text-text-primary">{source.name}</p><p className="text-meta text-text-muted">{formatBytes(source.bytes)} · {new Date(source.updatedAt * 1000).toLocaleString()}</p></div>
            <button type="button" aria-label={`删除 ${source.name}`} onClick={() => void remove(source)} disabled={busy} className="shrink-0 text-text-muted hover:text-danger"><Trash2 size={15} /></button>
          </div>)}
        </div>
      </section>
    </PageShell>
  )
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function getKnowledgeErrorMessage(cause: unknown, fallback: string): string {
  if (typeof cause === 'object' && cause !== null && 'response' in cause) {
    const response = (cause as { response?: { data?: { detail?: unknown; message?: unknown } } }).response
    if (typeof response?.data?.detail === 'string' && response.data.detail.trim()) return response.data.detail
    if (typeof response?.data?.message === 'string' && response.data.message.trim()) return response.data.message
  }
  return cause instanceof Error && cause.message ? cause.message : fallback
}
