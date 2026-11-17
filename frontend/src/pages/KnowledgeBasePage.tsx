import React, { useEffect, useRef, useState } from 'react'
import { BookOpen, Database, RefreshCw, Trash2, Upload } from 'lucide-react'
import { agentService } from '@/services/agentService'
import type { KnowledgeEmbeddingConfig, KnowledgeSource, KnowledgeStatus } from '@/types'
import Button from '@/components/Common/Button'
import PageHeader from '@/components/Common/PageHeader'

const field = 'mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-dark-soft'

export default function KnowledgeBasePage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [draft, setDraft] = useState({ provider: 'local' as KnowledgeEmbeddingConfig['provider'], model: 'all-MiniLM-L6-v2', baseUrl: '', apiKey: '', dimensions: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  useEffect(() => { void load() }, [])

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

  return <main className="flex-1 min-h-0 overflow-y-auto bg-surface px-6 py-7 dark:bg-surface-dark">
    <div className="mx-auto max-w-4xl">
      <PageHeader title="知识库" icon={<BookOpen size={18} />} actions={<Button size="sm" onClick={() => void load()} disabled={busy}><RefreshCw size={14} />刷新</Button>} />
      <p className="mb-6 max-w-2xl text-sm leading-6 text-text-secondary dark:text-text-dark-secondary">把自己的笔记、题解和课程资料放进 AlgoCoach。文件只保存在本机，索引使用你选择的 embedding 模型。</p>

      {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
      {message && <div role="status" className="mb-4 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{message}</div>}

      <section className="space-y-4 rounded-lg border border-border p-5 dark:border-border-dark">
        <div className="flex items-center gap-2"><Database size={16} className="text-accent" /><h2 className="font-medium">Embedding 模型</h2></div>
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

      <section className="mt-5 rounded-lg border border-border p-5 dark:border-border-dark">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-medium">源知识库</h2><p className="mt-1 text-xs text-text-muted">支持 TXT、Markdown、JSON、CSV、HTML、PDF、DOCX 和 ZIP；单文件 20 MB，单次 100 MB。</p></div>
          <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={15} />上传文件</Button>
          <input ref={inputRef} className="hidden" type="file" multiple accept=".txt,.md,.markdown,.rst,.log,.json,.csv,.tsv,.yaml,.yml,.html,.htm,.pdf,.docx,.zip" onChange={event => { void upload(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
        </div>
        <div className="mt-4 divide-y divide-border dark:divide-border-dark">
          {!status?.sources.length ? <div className="py-10 text-center text-sm text-text-muted">还没有上传源知识库。</div> : status.sources.map(source => <div key={source.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0"><p className="truncate text-text-primary dark:text-text-dark-primary">{source.name}</p><p className="text-xs text-text-muted">{formatBytes(source.bytes)} · {new Date(source.updatedAt * 1000).toLocaleString()}</p></div>
            <button type="button" aria-label={`删除 ${source.name}`} onClick={() => void remove(source)} disabled={busy} className="shrink-0 text-text-muted hover:text-danger"><Trash2 size={15} /></button>
          </div>)}
        </div>
      </section>
    </div>
  </main>
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
