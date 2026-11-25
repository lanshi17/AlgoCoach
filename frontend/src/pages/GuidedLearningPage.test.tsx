import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { agentService } from '@/services/agentService'
import { GUIDED_CODE_TEMPLATES } from '@/services/guidedCodeTemplates'
import { useAppStore } from '@/stores/useAppStore'
import GuidedLearningPage from './GuidedLearningPage'

vi.mock('@/components/Editor/MonacoCodeEditor', () => ({
  default: ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options?: { ariaLabel?: string; readOnly?: boolean } }) =>
    <textarea aria-label={options?.ariaLabel} readOnly={options?.readOnly} value={value} onChange={event => onChange(event.target.value)} />,
}))

const defaultPlan = JSON.stringify({ stages: [
  { name: '学习知识点', type: 'concept', instruction: '讲解这个知识点的核心概念。' },
  { name: '选择题', type: 'choice', instruction: '出一道单选题。' },
  { name: '问答题', type: 'short', instruction: '出一道简答题。' },
  { name: '编程题', type: 'code', instruction: '给出一道编程练习。' },
  { name: '复盘', type: 'review', instruction: '复盘本次学习。' },
] })

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear() })

it('guides the learner through an agent-planned outline with knowledge, choice, short answer and programming', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  const chat = vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('学习规划师') ? defaultPlan
      : message.includes('单选题') ? '请选择正确的选项：\nA. 第一项\nB. 第二项\nC. 第三项\nD. 第四项\n[[答案:A]]'
        : message.includes('请评估学生') ? '回答正确。\n[[评价:通过]]' : '教练反馈' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setValue.call(input, '二分'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })
  expect(chat.mock.calls[0][0]).toContain('学习规划师')
  expect(chat.mock.calls[1][0]).toContain('核心概念')
  expect(element.textContent).toContain('AI 规划')
  await act(async () => { button('下一步：选择题').click() })
  expect(chat.mock.calls[2][0]).toContain('单选题')
  expect(button('下一步：问答题').disabled).toBe(true)
  await act(async () => { Array.from(element.querySelectorAll('[aria-label="选择题选项"] button'))[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await act(async () => { button('提交选择').click() })
  expect(button('下一步：问答题').disabled).toBe(false)
  await act(async () => { button('下一步：问答题').click() })
  expect(chat.mock.calls[4][0]).toContain('简答题')
  act(() => root.unmount()); element.remove()
})

it('shows streamed text before the response completes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  let finish!: (result: { content: string }) => void
  let emit!: (delta: string) => void
  vi.spyOn(agentService, 'chatStream').mockImplementation((message, _ctx, handlers) => {
    if (message.includes('学习规划师')) return Promise.resolve({ content: defaultPlan })
    emit = handlers?.onText ?? (() => {})
    return new Promise(resolve => { finish = resolve })
  })
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => { setValue.call(input, '二分'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => { Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === '开始学习')!.click() })
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
    message.includes('学习规划师') ? defaultPlan
      : message.includes('单选题') ? '请选择正确的选项：\nA. 第一项\nB. 第二项\nC. 第三项\nD. 第四项\n[[答案:B]]'
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

it('opens a dedicated code area in the programming stage and submits code for assessment', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  const plan = JSON.stringify({ stages: [
    { name: '概念热身', type: 'concept', instruction: '讲解二分查找的核心概念。' },
    { name: '编码实战', type: 'code', instruction: '给出一道二分查找编程题。' },
    { name: '复盘', type: 'review', instruction: '复盘代码和复杂度。' },
  ] })
  const chat = vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('学习规划师') ? plan
      : message.includes('请评估学生') ? '代码完整，边界处理正确。\n[[评价:通过]]'
        : message.includes('二分查找编程题') ? '请实现二分查找并返回下标。' : '先理解区间收缩。' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setValue.call(input, '二分查找'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })
  expect(element.querySelector('[aria-label="编程作答区"]')).toBeNull()
  expect(element.textContent).toContain('概念热身')
  expect(element.textContent).toContain('编码实战')

  await act(async () => { button('下一步：编码实战').click() })
  await act(async () => { await Promise.resolve() })
  expect(element.querySelector('[aria-label="编程作答区"]')).not.toBeNull()
  const editor = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="编程题代码编辑器"]')!
  const setEditorValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  await act(async () => {
    setEditorValue.call(editor, 'def search(nums, target):\n    return -1')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { button('提交代码').click() })

  const assessment = chat.mock.calls.find(call => call[0].includes('请评估学生对下面编程题的代码作答'))!
  expect(assessment[0]).toContain('def search(nums, target)')
  expect(element.textContent).toContain('教练认为本题已掌握')
  expect(button('下一步：复盘').disabled).toBe(false)
  act(() => root.unmount()); element.remove()
})

it('lets the outline and code columns collapse, expand and resize', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  localStorage.setItem('algocoach.guidedLayout', JSON.stringify({ leftWidth: 200, rightWidth: 320, leftOpen: true, rightOpen: true }))
  const plan = JSON.stringify({ stages: [
    { name: '概念热身', type: 'concept', instruction: '讲解二分查找的核心概念。' },
    { name: '编码实战', type: 'code', instruction: '给出一道二分查找编程题。' },
    { name: '复盘', type: 'review', instruction: '复盘代码和复杂度。' },
  ] })
  vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('学习规划师') ? plan
      : message.includes('二分查找编程题') ? '请实现二分查找并返回下标。' : '先理解区间收缩。' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setValue.call(input, '二分查找'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })

  expect(element.querySelector('aside[aria-label="学习大纲"]')).not.toBeNull()
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="收起大纲"]')!.click() })
  expect(element.querySelector('aside[aria-label="学习大纲"]')).toBeNull()
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="展开大纲"]')!.click() })
  expect(element.querySelector('aside[aria-label="学习大纲"]')).not.toBeNull()

  await act(async () => { button('下一步：编码实战').click() })
  expect(element.querySelector('[aria-label="编程题代码区"]')).not.toBeNull()
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="收起代码区"]')!.click() })
  expect(element.querySelector('[aria-label="编程题代码区"]')).toBeNull()
  expect(element.textContent).toContain('打开代码区')
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="展开代码区"]')!.click() })
  expect(element.querySelector('[aria-label="编程题代码区"]')).not.toBeNull()

  const outlineResizer = element.querySelector<HTMLElement>('[role="separator"][aria-label="调整大纲宽度"]')!
  const outlineWidth = Number(outlineResizer.getAttribute('aria-valuenow'))
  await act(async () => { outlineResizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })) })
  expect(Number(outlineResizer.getAttribute('aria-valuenow'))).toBe(outlineWidth - 16)

  const codeResizer = element.querySelector<HTMLElement>('[role="separator"][aria-label="调整代码区宽度"]')!
  const codeWidth = Number(codeResizer.getAttribute('aria-valuenow'))
  await act(async () => { codeResizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })) })
  expect(Number(codeResizer.getAttribute('aria-valuenow'))).toBe(codeWidth + 16)

  act(() => root.unmount()); element.remove()
})

it('fills the code stage with a starter template and swaps it on language change', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  const plan = JSON.stringify({ stages: [
    { name: '概念热身', type: 'concept', instruction: '讲解二分查找的核心概念。' },
    { name: '编码实战', type: 'code', instruction: '给出一道二分查找编程题。' },
    { name: '复盘', type: 'review', instruction: '复盘代码和复杂度。' },
  ] })
  vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('学习规划师') ? plan
      : message.includes('二分查找编程题') ? '请实现二分查找并返回下标。' : '先理解区间收缩。' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '二分查找')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })
  await act(async () => { button('下一步：编码实战').click() })

  const editor = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="编程题代码编辑器"]')!
  expect(editor.value).toBe(GUIDED_CODE_TEMPLATES.python3)
  expect(button('提交代码').disabled).toBe(true)
  expect(element.textContent).toContain('待实现模板')

  const select = element.querySelector<HTMLSelectElement>('select[aria-label="编程语言"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'cpp')
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(editor.value).toBe(GUIDED_CODE_TEMPLATES.cpp)

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(editor, 'int main() { return 0; }')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(button('提交代码').disabled).toBe(false)

  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  await act(async () => { button('恢复模板').click() })
  expect(confirm).toHaveBeenCalled()
  expect(editor.value).toBe(GUIDED_CODE_TEMPLATES.cpp)
  expect(button('提交代码').disabled).toBe(true)

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(editor, '# my solution')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  })
  confirm.mockReturnValue(false)
  await act(async () => { button('恢复模板').click() })
  expect(editor.value).toBe('# my solution')
  act(() => root.unmount()); element.remove()
})

it('detaches the guided code area into a floating code window', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  const plan = JSON.stringify({ stages: [
    { name: '概念热身', type: 'concept', instruction: '讲解二分查找的核心概念。' },
    { name: '编码实战', type: 'code', instruction: '给出一道二分查找编程题。' },
    { name: '复盘', type: 'review', instruction: '复盘代码和复杂度。' },
  ] })
  vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('学习规划师') ? plan
      : message.includes('二分查找编程题') ? '请实现二分查找并返回下标。' : '先理解区间收缩。' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '二分查找')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })
  await act(async () => { button('下一步：编码实战').click() })

  const panel = element.querySelector<HTMLElement>('[data-guided-code-panel]')!
  expect(panel.className).not.toContain('fixed')
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="独立代码区为浮窗"]')!.click() })
  expect(panel.className).toContain('fixed')
  expect(element.querySelector('[aria-label="编程题代码浮窗"]')).not.toBeNull()
  expect(element.querySelector('button[aria-label="嵌入代码区布局"]')).not.toBeNull()
  expect(element.querySelector('[aria-label="调整代码区浮窗大小"]')).not.toBeNull()
  expect(element.querySelectorAll('[aria-label="编程题代码区"]')).toHaveLength(1)

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="最大化代码区浮窗"]')!.click() })
  expect(panel.style.left).toBe('8px')
  expect(panel.style.width).toBe('auto')
  expect(element.querySelector('[aria-label="调整代码区浮窗大小"]')).toBeNull()
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="还原代码区浮窗"]')!.click() })
  expect(panel.style.width).not.toBe('auto')
  expect(element.querySelector('[aria-label="调整代码区浮窗大小"]')).not.toBeNull()

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="嵌入代码区布局"]')!.click() })
  expect(panel.className).not.toContain('fixed')
  expect(element.querySelector('[aria-label="编程题代码浮窗"]')).toBeNull()

  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="独立代码区为浮窗"]')!.click() })
  expect(panel.className).toContain('fixed')
  await act(async () => { element.querySelector<HTMLButtonElement>('button[aria-label="重置学习页布局"]')!.click() })
  expect(panel.className).not.toContain('fixed')
  expect(element.querySelector('[aria-label="编程题代码浮窗"]')).toBeNull()

  const layoutKey = 'algocoach.guidedLayout'
  const external = {
    leftWidth: 230,
    rightWidth: 420,
    leftOpen: true,
    rightOpen: true,
    codeFloating: true,
    codeFloat: { x: 650, y: 90, width: 520, height: 560 },
  }
  localStorage.setItem(layoutKey, JSON.stringify(external))
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', { key: layoutKey, newValue: JSON.stringify(external) }))
  })
  expect(panel.className).toContain('fixed')
  act(() => root.unmount()); element.remove()
})

it('shows a settings link when the model provider rejects the request', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  vi.spyOn(agentService, 'chatStream').mockRejectedValue({
    isAxiosError: true,
    response: { status: 401, data: {} },
  })
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '二分查找')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const start = Array.from(element.querySelectorAll('button')).find(button => button.textContent?.trim() === '开始学习')!
  await act(async () => { start.click() })
  const alert = element.querySelector('[role="alert"]')!
  expect(alert.textContent).toContain('教练暂时无法连接')
  const link = alert.querySelector('a')!
  expect(link.getAttribute('href')).toBe('/settings')
  expect(link.textContent).toBe('检查模型 Provider')
  act(() => root.unmount()); element.remove()
})

it('keeps guided code editable in focus while blocking the coach assessment', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.setState({ mode: 'PREP' })
  const plan = JSON.stringify({ stages: [
    { name: '概念热身', type: 'concept', instruction: '讲解二分查找的核心概念。' },
    { name: '编码实战', type: 'code', instruction: '给出一道二分查找编程题。' },
    { name: '复盘', type: 'review', instruction: '复盘代码和复杂度。' },
  ] })
  vi.spyOn(agentService, 'chatStream').mockImplementation(async message => ({ content:
    message.includes('学习规划师') ? plan
      : message.includes('二分查找编程题') ? '请实现二分查找并返回下标。' : '先理解区间收缩。' }))
  const element = document.createElement('div'); document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<MemoryRouter><GuidedLearningPage /></MemoryRouter>))
  const input = element.querySelector<HTMLInputElement>('input[aria-label="学习知识点"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '二分查找')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!
  await act(async () => { button('开始学习').click() })
  await act(async () => { button('下一步：编码实战').click() })
  await act(async () => { await Promise.resolve() })

  const editor = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="编程题代码编辑器"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(editor, 'def search(nums, target):\n    return -1')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  })

  act(() => useAppStore.getState().enterFocus())
  expect(editor.readOnly).toBe(false)
  expect(button('专注中不可提交')?.disabled).toBe(true)
  expect(element.textContent).toContain('专注模式 · 教练静默')

  act(() => useAppStore.getState().exitFocus())
  expect(button('提交代码')?.disabled).toBe(false)
  act(() => root.unmount()); element.remove()
})
