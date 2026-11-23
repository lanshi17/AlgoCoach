import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { agentService } from '@/services/agentService'
import { readNotebookEntries } from '@/services/learningNotebook'
import { useAppStore } from '@/stores/useAppStore'
import NotebookPage from './NotebookPage'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

it('streams a note preview while leaving the original draft intact, then saves the final AI note', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  let emit!: (delta: string) => void
  let finish!: (reply: { content: string }) => void
  vi.spyOn(agentService, 'chatStream').mockImplementation((_message, _ctx, handlers) => {
    emit = handlers?.onText ?? (() => {})
    return new Promise(resolve => { finish = resolve })
  })
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><NotebookPage /></MemoryRouter>))
  const title = element.querySelector<HTMLInputElement>('input[aria-label="笔记标题"]')!
  const body = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="笔记正文"]')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, '二分')
    title.dispatchEvent(new Event('input', { bubbles: true }))
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(body, '个人草稿')
    body.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent === '让 AI 写笔记')!.click())
  act(() => emit('第一部分'))
  expect(element.querySelector('[aria-label="AI 笔记生成预览"]')?.textContent).toContain('第一部分')
  expect(body.value).toBe('个人草稿')
  expect(readNotebookEntries()).toHaveLength(0)
  await act(async () => finish({ content: '完整笔记' }))
  expect(readNotebookEntries()[0]).toMatchObject({ author: 'ai', body: '完整笔记' })
  expect(element.querySelector('[aria-label="AI 笔记生成预览"]')).toBeNull()
  act(() => root.unmount()); element.remove()
})
