import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import GuidedCodeEditor from './GuidedCodeEditor'
import { GUIDED_CODE_TEMPLATES } from '@/services/guidedCodeTemplates'

vi.mock('./MonacoCodeEditor', () => ({
  default: ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options?: { ariaLabel?: string; readOnly?: boolean } }) =>
    <textarea aria-label={options?.ariaLabel} readOnly={options?.readOnly} value={value} onChange={event => onChange(event.target.value)} />,
}))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

const editedCode = 'def search(nums, target):\n    return -1'

async function renderEditor(props: Partial<React.ComponentProps<typeof GuidedCodeEditor>> = {}) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const onSubmit = vi.fn()
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(
      <GuidedCodeEditor
        code={editedCode}
        language="python3"
        disabled={false}
        busy={false}
        submitted={false}
        onChange={() => undefined}
        onLanguageChange={() => undefined}
        onResetTemplate={() => undefined}
        onSubmit={onSubmit}
        {...props}
      />,
    )
    await Promise.resolve()
  })
  const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.trim() === label)
  return { element, root, onSubmit, button }
}

it('keeps the code editable in focus while disabling the AI assessment', async () => {
  const { element, root, button } = await renderEditor({ focusQuiet: true })
  const editor = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="编程题代码编辑器"]')!

  expect(editor.readOnly).toBe(false)
  expect(element.querySelector<HTMLSelectElement>('select[aria-label="编程语言"]')!.disabled).toBe(false)
  expect(button('专注中不可提交')?.disabled).toBe(true)
  expect(element.textContent).toContain('专注模式 · 教练静默')

  act(() => root.unmount())
  element.remove()
})

it('locks the code surface while the coach is busy', async () => {
  const { element, root } = await renderEditor({ disabled: true })
  expect(element.querySelector<HTMLTextAreaElement>('textarea[aria-label="编程题代码编辑器"]')!.readOnly).toBe(true)
  act(() => root.unmount())
  element.remove()
})

it('submits implemented code outside focus', async () => {
  const { element, root, onSubmit, button } = await renderEditor()
  expect(button('提交代码')?.disabled).toBe(false)
  await act(async () => { button('提交代码')!.click() })
  expect(onSubmit).toHaveBeenCalledTimes(1)
  act(() => root.unmount())
  element.remove()
})

it('blocks submitting an untouched template', async () => {
  const { element, root, button } = await renderEditor({ code: GUIDED_CODE_TEMPLATES.python3 })
  expect(button('提交代码')?.disabled).toBe(true)
  act(() => root.unmount())
  element.remove()
})
