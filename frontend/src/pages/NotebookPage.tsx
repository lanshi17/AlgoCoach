import React, { useMemo, useState } from 'react'
import { BookOpen, MessageCircle, Plus, Save, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/Common/PageHeader'
import Button from '@/components/Common/Button'
import { deleteNotebookEntry, readNotebookEntries, saveNotebookEntry, type NotebookEntry } from '@/services/learningNotebook'
import { prepareNotebookDiscussion } from '@/services/notebookDiscussion'

const field = 'w-full rounded-card border border-border bg-surface-soft px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-primary'

export default function NotebookPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<NotebookEntry[]>(() => readNotebookEntries())
  const [selectedId, setSelectedId] = useState<string | null>(() => readNotebookEntries()[0]?.id ?? null)
  const selected = useMemo(() => entries.find(entry => entry.id === selectedId) ?? null, [entries, selectedId])
  const [draft, setDraft] = useState(() => selected ? { title: selected.title, body: selected.body, tags: selected.tags.join('、') } : { title: '', body: '', tags: '' })
  const [message, setMessage] = useState('')

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
    const next = saveNotebookEntry({ id: selectedId ?? undefined, title: draft.title, body: draft.body, tags: draft.tags.split(/[、,，]/) })
    setEntries(next)
    setSelectedId(next[0]?.id ?? null)
    setDraft({ title: next[0]?.title ?? '', body: next[0]?.body ?? '', tags: next[0]?.tags.join('、') ?? '' })
    setMessage('笔记已保存。')
  }

  const remove = () => {
    if (!selectedId) return
    const next = deleteNotebookEntry(selectedId)
    setEntries(next)
    setSelectedId(next[0]?.id ?? null)
    const first = next[0]
    setDraft(first ? { title: first.title, body: first.body, tags: first.tags.join('、') } : { title: '', body: '', tags: '' })
    setMessage('笔记已删除。')
  }

  return <main className="flex-1 min-h-0 overflow-y-auto bg-canvas px-6 py-7 dark:bg-[#0B0C0F]">
    <div className="mx-auto max-w-5xl">
      <PageHeader title="学习笔记" icon={<BookOpen size={18} />} actions={<Button size="sm" variant="primary" onClick={newEntry}><Plus size={15} />新建笔记</Button>} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-panel border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
          <p className="px-2 pb-2 text-xs text-text-muted dark:text-text-dark-muted">本地笔记 · {entries.length}</p>
          <div className="space-y-1">
            {entries.map(entry => <button key={entry.id} type="button" onClick={() => selectEntry(entry)} className={`w-full rounded-card px-3 py-2 text-left text-sm ${selectedId === entry.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-muted dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted'}`}><span className="block truncate">{entry.title}</span><span className="mt-1 block truncate text-[11px] text-text-muted dark:text-text-dark-muted">{entry.tags.join(' · ') || '未分类'}</span></button>)}
            {!entries.length && <p className="px-2 py-5 text-xs leading-5 text-text-muted dark:text-text-dark-muted">还没有笔记。把推导、反例或看资料时的疑问记下来。</p>}
          </div>
        </aside>
        <section className="rounded-panel border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-muted dark:text-text-dark-muted">Workspace 本地笔记</p>
            {selectedId && <button type="button" aria-label="删除笔记" onClick={remove} className="text-text-muted hover:text-danger"><Trash2 size={16} /></button>}
          </div>
          <input aria-label="笔记标题" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="笔记标题" className={`${field} mt-4 text-lg font-medium`} />
          <input aria-label="笔记标签" value={draft.tags} onChange={event => setDraft({ ...draft, tags: event.target.value })} placeholder="标签，用顿号或逗号分隔" className={`${field} mt-3 text-xs`} />
          <textarea aria-label="笔记正文" value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} placeholder="写下算法直觉、证明、反例、复杂度或还没想通的问题……" rows={18} className={`${field} mt-3 min-h-[360px] resize-y leading-6`} />
          <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="primary" onClick={save}><Save size={15} />保存笔记</Button>{selected && <Button variant="secondary" onClick={() => { prepareNotebookDiscussion(selected.title, selected.body, selected.tags); navigate('/workspace', { state: { openPanel: 'chat' } }) }}><MessageCircle size={15} />带笔记问导师</Button>}{message && <span role="status" className="text-xs text-text-secondary dark:text-text-dark-secondary">{message}</span>}</div>
        </section>
      </div>
    </div>
  </main>
}
