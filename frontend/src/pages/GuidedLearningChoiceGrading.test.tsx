import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { agentService } from '@/services/agentService'
import { useAppStore } from '@/stores/useAppStore'
import GuidedLearningPage from './GuidedLearningPage'

const validChoice = '请选择正确的选项：\nA. 第一项\nB. 第二项\nC. 第三项\nD. 第四项\n[[答案:A]]'
const incompleteChoice = '请选择正确的选项：\nA. 第一项\nB. 第二项\nC. 第三项'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })

function setup() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
}

function newContainer() {
  const element = document.createElement('div')
  document.body.appendChild(element)
  return element
}

async function mount(element: HTMLElement): Promise<Root> {
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  return root
}

const button = (element: HTMLElement, label: string) =>
  Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!

// Option buttons carry aria-pressed; the submit button rendered in the same fieldset does not.
const optionButtons = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLButtonElement>(`[aria-label='选择题选项'] button[aria-pressed]`))

async function startTopic(element: HTMLElement) {
  const input = element.querySelector<HTMLInputElement>(`input[aria-label='学习知识点']`)!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setValue.call(input, '二分'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => { button(element, '开始学习').click() })
}

it('regenerates an incomplete choice without advancing, and keeps the next stage locked until answered', async () => {
  setup()
  let choiceCalls = 0
  const chat = vi.spyOn(agentService, 'chatStream').mockImplementation(async message => {
    if (!message.includes('单选题')) return { content: '讲解。' }
    choiceCalls += 1
    return { content: choiceCalls === 1 ? incompleteChoice : validChoice }
  })
  const element = newContainer()
  const root = await mount(element)
  await startTopic(element)

  await act(async () => { button(element, '下一步：选择题').click() })
  expect(element.textContent).toContain('这次未能生成完整的选择题')
  expect(optionButtons(element)).toHaveLength(0)
  expect(element.querySelector(`[aria-current='step']`)?.textContent).toContain('学习知识点')

  await act(async () => { button(element, '下一步：选择题').click() })
  expect(optionButtons(element)).toHaveLength(4)
  expect(element.textContent).not.toContain('[[答案')
  expect(button(element, '下一步：问答题').disabled).toBe(true)
  expect(chat).toHaveBeenCalledTimes(3)

  act(() => root.unmount())
  element.remove()
})

it('restores a wrong choice after a reload, then unlocks the next stage after a correct retry', async () => {
  setup()
  const chat = vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({
    content: message.includes('单选题') ? validChoice : '解释。',
  }))

  const first = newContainer()
  const firstRoot = await mount(first)
  await startTopic(first)
  await act(async () => { button(first, '下一步：选择题').click() })
  await act(async () => { optionButtons(first)[1].click() })
  await act(async () => { button(first, '提交选择').click() })
  expect(first.textContent).toContain('这次选错了，可以再试一次。')
  expect(button(first, '下一步：问答题').disabled).toBe(true)
  act(() => firstRoot.unmount())
  first.remove()

  const second = newContainer()
  const secondRoot = await mount(second)
  expect(second.textContent).toContain('这次选错了，可以再试一次。')
  expect(button(second, '下一步：问答题').disabled).toBe(true)
  await act(async () => { optionButtons(second)[0].click() })
  await act(async () => { button(second, '提交选择').click() })
  expect(second.textContent).toContain('回答正确。')
  expect(button(second, '下一步：问答题').disabled).toBe(false)
  act(() => secondRoot.unmount())
  second.remove()

  const third = newContainer()
  const thirdRoot = await mount(third)
  expect(button(third, '下一步：问答题').disabled).toBe(false)
  expect(optionButtons(third).every(option => option.disabled)).toBe(true)
  expect(third.textContent).not.toContain('[[答案')
  expect(chat.mock.calls[chat.mock.calls.length - 1][0]).toContain('解释这个选项为什么正确')
  act(() => thirdRoot.unmount())
  third.remove()
})
