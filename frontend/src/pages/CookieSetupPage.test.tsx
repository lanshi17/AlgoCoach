import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { leetcodeService } from '@/services/leetcodeService'
import CookieSetupPage from './CookieSetupPage'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function renderPage() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CookieSetupPage onDone={() => undefined} />
    </MemoryRouter>,
  ))
  return { element, root }
}

it('distinguishes a gateway save failure from an upstream validation failure', async () => {
  vi.spyOn(leetcodeService, 'setCookie').mockRejectedValue(new Error('gateway offline'))
  const { element, root } = renderPage()
  const field = element.querySelector<HTMLTextAreaElement>('#leetcode-curl')!
  const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]')!
  expect(submit.disabled).toBe(true)
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Cookie: LEETCODE_SESSION=session; csrftoken=csrf')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(submit.disabled).toBe(false)
  await act(async () => submit.click())
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('Cookie 保存失败')
  act(() => root.unmount())
  element.remove()
})

it('keeps the saved-but-unverified message when upstream validation fails', async () => {
  vi.spyOn(leetcodeService, 'setCookie').mockResolvedValue(undefined)
  vi.spyOn(leetcodeService, 'verifyCookie').mockResolvedValue(false)
  const { element, root } = renderPage()
  const field = element.querySelector<HTMLTextAreaElement>('#leetcode-curl')!
  const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Cookie: LEETCODE_SESSION=session; csrftoken=csrf')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => submit.click())
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('LeetCode 没有确认登录状态')
  act(() => root.unmount())
  element.remove()
})
