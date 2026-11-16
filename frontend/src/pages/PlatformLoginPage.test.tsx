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
  const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.includes('保存'))!
  await act(async () => button.click())
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('保存失败')
  expect(field.value).toBe('sessionid=example')
  expect(button.disabled).toBe(false)
  act(() => root.unmount())
  element.remove()
})

it('shows saving feedback while a platform cookie request is pending', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(platformCookieService, 'summary').mockResolvedValue({ LEETCODE: false, ACWING: false, HDU: false })
  let resolveSave!: () => void
  vi.spyOn(platformCookieService, 'save').mockReturnValue(new Promise(resolve => { resolveSave = resolve }))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<PlatformLoginPage />))
  const field = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="AcWing Cookie"]')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'sessionid=example')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const button = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.includes('保存'))!
  act(() => button.click())
  expect(button.disabled).toBe(true)
  expect(button.getAttribute('aria-busy')).toBe('true')
  expect(button.textContent).toContain('保存中')
  await act(async () => resolveSave())
  expect(button.disabled).toBe(false)
  expect(button.getAttribute('aria-busy')).toBe('false')
  expect(button.textContent).toBe('保存')
  act(() => root.unmount())
  element.remove()
})

it('checks platform status once on a StrictMode mount', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const summary = vi.spyOn(platformCookieService, 'summary').mockResolvedValue({ LEETCODE: true, ACWING: false, HDU: false })
  const validate = vi.spyOn(platformCookieService, 'validateLeetCode').mockResolvedValue(false)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(
      <React.StrictMode><PlatformLoginPage /></React.StrictMode>,
    )
    await Promise.resolve()
  })

  expect(summary).toHaveBeenCalledTimes(1)
  expect(validate).toHaveBeenCalledTimes(1)
  act(() => root.unmount())
  element.remove()
})

it('does not validate LeetCode upstream when the local summary is unconfigured', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(platformCookieService, 'summary').mockResolvedValue({ LEETCODE: false, ACWING: false, HDU: false })
  const validate = vi.spyOn(platformCookieService, 'validateLeetCode').mockResolvedValue(false)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => {
    root.render(<PlatformLoginPage />)
    await Promise.resolve()
  })

  expect(validate).not.toHaveBeenCalled()
  expect(element.textContent).toContain('未登录')
  act(() => root.unmount())
  element.remove()
})

it('serializes status refreshes and exposes the busy state', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let resolveSummary!: (value: { LEETCODE: boolean; ACWING: boolean; HDU: boolean }) => void
  const summary = vi.spyOn(platformCookieService, 'summary').mockReturnValue(new Promise(resolve => {
    resolveSummary = resolve
  }))
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  await act(async () => root.render(<PlatformLoginPage />))

  const refresh = element.querySelector<HTMLButtonElement>('button[aria-label="刷新题库登录状态"]')!
  expect(summary).toHaveBeenCalledTimes(1)
  expect(refresh.disabled).toBe(true)
  expect(refresh.getAttribute('aria-busy')).toBe('true')
  expect(refresh.textContent).toContain('刷新中')
  act(() => { refresh.click(); refresh.click() })
  expect(summary).toHaveBeenCalledTimes(1)

  await act(async () => resolveSummary({ LEETCODE: false, ACWING: false, HDU: false }))
  expect(refresh.disabled).toBe(false)
  expect(refresh.getAttribute('aria-busy')).toBe('false')
  expect(refresh.textContent).toContain('刷新状态')
  act(() => root.unmount())
  element.remove()
})
