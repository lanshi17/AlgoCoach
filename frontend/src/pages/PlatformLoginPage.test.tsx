import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { platformCookieService } from '@/services/platformCookieService'
import PlatformLoginPage from './PlatformLoginPage'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('keeps the entered cookie and shows an error when saving fails', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(platformCookieService, 'summary').mockResolvedValue({ LEETCODE: false, ACWING: false, HDU: false })
  vi.spyOn(platformCookieService, 'validateLeetCode').mockResolvedValue(false)
  vi.spyOn(platformCookieService, 'save').mockRejectedValue(new Error('offline'))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<PlatformLoginPage />))
  const field = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="AcWing Cookie"]')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'sessionid=example')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.includes('保存 AcWing'))!
  await act(async () => button.click())
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('保存失败')
  expect(field.value).toBe('sessionid=example')
  expect(button.disabled).toBe(false)
  act(() => root.unmount())
  element.remove()
})
