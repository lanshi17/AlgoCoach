import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { agentService } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'
import GuidedLearningPage from './GuidedLearningPage'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })

it('guides the learner through knowledge, choice, short answer, programming and review', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  const chat = vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('单选题') ? '请选择正确的选项：\nA. 第一项\nB. 第二项\nC. 第三项\nD. 第四项\n[[答案:A]]'
      : message.includes('请评估学生') ? '回答正确。\n[[评价:通过]]' : '教练反馈' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setValue.call(input, '二分'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })
  expect(chat.mock.calls[0][0]).toContain('核心概念')
  await act(async () => { button('下一步：选择题').click() })
  expect(chat.mock.calls[1][0]).toContain('单选题')
  expect(button('下一步：问答题').disabled).toBe(true)
  await act(async () => { Array.from(element.querySelectorAll('[aria-label="选择题选项"] button'))[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await act(async () => { button('提交选择').click() })
  expect(button('下一步：问答题').disabled).toBe(false)
  await act(async () => { button('下一步：问答题').click() })
  expect(chat.mock.calls[3][0]).toContain('简答题')
  act(() => root.unmount()); element.remove()
})

it('shows streamed text before the response completes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  let finish!: (result: { content: string }) => void
  let emit!: (delta: string) => void
  vi.spyOn(agentService, 'chatStream').mockImplementation((_message, _ctx, handlers) => {
    emit = handlers?.onText ?? (() => {})
    return new Promise(resolve => { finish = resolve })
  })
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => { setValue.call(input, '二分'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  act(() => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === '开始学习')!.click())
  act(() => emit('逐步输出'))
  expect(element.querySelector('[aria-label="学习对话"]')?.textContent).toContain('逐步输出')
  await act(async () => finish({ content: '逐步输出完成' }))
  expect(element.textContent).toContain('逐步输出完成')
  expect(element.textContent?.match(/逐步输出完成/g)).toHaveLength(1)
  act(() => root.unmount()); element.remove()
})

it('keeps the next stage locked after a follow-up or an incorrect answer, and renders choice controls', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('单选题') ? '请选择正确的选项：\nA. 第一项\nB. 第二项\nC. 第三项\nD. 第四项\n[[答案:B]]'
      : message.includes('请评估学生') ? '请再思考。\n[[评价:再练]]' : '解释。' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const title = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, '二分'); title.dispatchEvent(new Event('input', { bubbles: true })) })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })
  await act(async () => { button('下一步：选择题').click() })
  const group = element.querySelector('[aria-label="选择题选项"]')!
  expect(group.querySelectorAll('button')).toHaveLength(5)
  const textarea = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="回复教练"]')!
  act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '什么是边界？'); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => { button('追问').click() })
  expect(button('下一步：问答题').disabled).toBe(true)
  act(() => (group.querySelector('button') as HTMLButtonElement).click())
  await act(async () => { button('提交选择').click() })
  expect(button('下一步：问答题').disabled).toBe(true)
  expect(element.textContent).toContain('还需要再练习')
  expect(element.textContent).not.toContain('[[评价:再练]]')
  act(() => root.unmount()); element.remove()
})
