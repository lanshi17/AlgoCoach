import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, MessageCircle, Plus, Save, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/Common/PageHeader'
import Button from '@/components/Common/Button'
import { deleteNotebookEntry, readNotebookEntries, saveNotebookEntry, type NotebookEntry } from '@/services/learningNotebook'
import { prepareNotebookDiscussion } from '@/services/notebookDiscussion'
import { agentService, getAgentErrorMessage } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'
import ChatMessage from '@/components/Chat/ChatMessage'

const field = 'w-full rounded-card border border-border bg-surface-soft px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-primary'

export default function NotebookPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<NotebookEntry[]>(() => readNotebookEntries())
  const [selectedId, setSelectedId] = useState<string | null>(() => readNotebookEntries().find(entry => (entry.author ?? 'user') === 'user')?.id ?? null)
  const selected = useMemo(() => entries.find(entry => entry.id === selectedId) ?? null, [entries, selectedId])
  const [draft, setDraft] = useState(() => selected ? { title: selected.title, body: selected.body, tags: selected.tags.join('、') } : { title: '', body: '', tags: '' })
  const [message, setMessage] = useState('')
  const [author, setAuthor] = useState<'user' | 'ai'>('user')
  const [generating, setGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const generationRequest = useRef<AbortController | null>(null)
  const mode = useAppStore(state => state.mode)
  useEffect(() => { if (mode === 'FOCUS' && generationRequest.current) { generationRequest.current.abort(); setMessage('已进入专注模式，笔记生成已中断。') } }, [mode])
  useEffect(() => () => { generationRequest.current?.abort() }, [])
  const visibleEntries = entries.filter(entry => (entry.author ?? 'user') === author)

  const selectEntry = (entry: NotebookEntry) => {
    setSelectedId(entry.id)
    setDraft({ title: entry.title, body: entry.body, tags: entry.tags.join('、') })
    setMessage('')
  }

  const newEntry = () => {
    setSelectedId(null)
    setDraft({ title: '', body: '', tags: '' })
    setMessage('写下一个算法观察或证明。')
  }

  const save = () => {
    const next = saveNotebookEntry({ id: selectedId ?? undefined, title: draft.title, body: draft.body, tags: draft.tags.split(/[、,，]/), author: selected?.author ?? 'user' })
    setEntries(next)
    setAuthor(next[0]?.author ?? 'user')
    setSelectedId(next[0]?.id ?? null)
    setDraft({ title: next[0]?.title ?? '', body: next[0]?.body ?? '', tags: next[0]?.tags.join('、') ?? '' })
    setMessage('笔记已保存。')
  }

  const remove = () => {
    if (!selectedId) return
    const next = deleteNotebookEntry(selectedId)
    setEntries(next)
    const first = next.find(entry => (entry.author ?? 'user') === author)
    setSelectedId(first?.id ?? null)
    setDraft(first ? { title: first.title, body: first.body, tags: first.tags.join('、') } : { title: '', body: '', tags: '' })
    setMessage('笔记已删除。')
  }

  const generate = async () => {
    if (!draft.title.trim() || generating) { setMessage('请先填写笔记标题或知识点。'); return }
    const state = useAppStore.getState()
    if (state.mode === 'FOCUS') { setMessage('请先结束专注，再生成笔记。'); return }
    setGenerating(true); setMessage('AI 正在编写笔记…'); setGeneratedText('')
    const controller = new AbortController()
    generationRequest.current = controller
    let partial = ''
    try {
      const response = await agentService.chatStream(`请为知识点「${draft.title.trim()}」编写学习笔记，包含核心概念、例子、常见错误和复杂度；参考资料不足时明确说明。补充要求：${draft.body}`, {
        mode: 'PREP', provider: state.provider, goal: state.goal, animations: false,
      }, { onText: delta => { if (!controller.signal.aborted) { partial += delta; setGeneratedText(partial) } } }, controller.signal)
      if (controller.signal.aborted) return
      const next = saveNotebookEntry({ title: draft.title, body: response.content, tags: draft.tags.split(/[、,，]/), author: 'ai' })
      setEntries(next); setAuthor('ai'); setSelectedId(next[0].id)
      setDraft({ title: next[0].title, body: next[0].body, tags: next[0].tags.join('、') })
      setMessage('AI 笔记已保存。')
      setGeneratedText('')
    } catch (error) { if (!controller.signal.aborted) setMessage(`${partial ? '生成中断，已保留预览内容。' : ''}${getAgentErrorMessage(error)}`) }
    finally { if (generationRequest.current === controller) { generationRequest.current = null; setGenerating(false) } }
  }

  return <main className="flex-1 min-h-0 overflow-y-auto bg-canvas px-6 py-7 dark:bg-[#0B0C0F]">
    <div className="mx-auto max-w-5xl">
      <PageHeader title="学习笔记" icon={<BookOpen size={18} />} actions={<Button size="sm" variant="primary" disabled={generating} onClick={newEntry}><Plus size={15} />新建笔记</Button>} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-panel border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex gap-3 px-2 pb-3 text-sm"><button type="button" disabled={generating} aria-pressed={author === 'user'} onClick={() => { setAuthor('user'); newEntry() }} className={author === 'user' ? 'text-accent' : ''}>我的笔记</button><button type="button" disabled={generating} aria-pressed={author === 'ai'} onClick={() => { setAuthor('ai'); newEntry() }} className={author === 'ai' ? 'text-accent' : ''}>AI 笔记</button></div>
          <p className="px-2 pb-2 text-xs text-text-muted dark:text-text-dark-muted">本地笔记 · {visibleEntries.length}</p>
          <div className="space-y-1">
            {visibleEntries.map(entry => <button key={entry.id} type="button" disabled={generating} onClick={() => selectEntry(entry)} className={`w-full rounded-card px-3 py-2 text-left text-sm ${selectedId === entry.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-muted dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted'}`}><span className="block truncate">{entry.title}</span><span className="mt-1 block truncate text-[11px] text-text-muted dark:text-text-dark-muted">{entry.tags.join(' · ') || '未分类'}</span></button>)}
            {!visibleEntries.length && <p className="px-2 py-5 text-xs leading-5 text-text-muted dark:text-text-dark-muted">还没有笔记。</p>}
          </div>
        </aside>
        <section className="rounded-panel border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-muted dark:text-text-dark-muted">Workspace 本地笔记</p>
            {selectedId && <button type="button" disabled={generating} aria-label="删除笔记" onClick={remove} className="text-text-muted hover:text-danger"><Trash2 size={16} /></button>}
          </div>
          <input aria-label="笔记标题" disabled={generating} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="笔记标题" className={`${field} mt-4 text-lg font-medium`} />
          <input aria-label="笔记标签" disabled={generating} value={draft.tags} onChange={event => setDraft({ ...draft, tags: event.target.value })} placeholder="标签，用顿号或逗号分隔" className={`${field} mt-3 text-xs`} />
          <textarea aria-label="笔记正文" disabled={generating} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} placeholder="写下算法直觉、证明、反例、复杂度或还没想通的问题……" rows={18} className={`${field} mt-3 min-h-[360px] resize-y leading-6`} />
          {generatedText && <div aria-label="AI 笔记生成预览" className="mt-4 rounded-card border border-border bg-surface-soft p-4 dark:border-border-dark dark:bg-surface-dark-soft"><p className="mb-2 text-xs text-text-muted">{generating ? 'AI 正在编写' : '未完成的生成内容'}</p><ChatMessage message={{ id: 'note-preview', role: 'agent', content: generatedText, timestamp: '' }} />{!generating && <button type="button" className="mt-2 text-xs text-accent" onClick={() => { setDraft(current => ({ ...current, body: generatedText })); setGeneratedText(''); setMessage('已放入编辑区，请检查后保存。') }}>放入编辑区</button>}</div>}
          <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="primary" onClick={save} disabled={generating}><Save size={15} />保存笔记</Button><Button variant="secondary" onClick={() => void generate()} disabled={generating}>{generating ? '正在生成…' : '让 AI 写笔记'}</Button>{selected && <Button variant="secondary" disabled={generating} onClick={() => { prepareNotebookDiscussion(selected.title, selected.body, selected.tags); navigate('/workspace', { state: { openPanel: 'chat' } }) }}><MessageCircle size={15} />带笔记问导师</Button>}{message && <span role="status" className="text-xs text-text-secondary dark:text-text-dark-secondary">{message}</span>}</div>
        </section>
      </div>
    </div>
  </main>
}
