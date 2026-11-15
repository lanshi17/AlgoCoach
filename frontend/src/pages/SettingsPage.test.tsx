import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import SettingsPage from './SettingsPage'

function ReturnTarget() {
  const location = useLocation()
  const state = location.state as { openPanel?: string } | null
  return <div data-testid="return-target">{state?.openPanel ?? 'missing-panel'}</div>
}

describe('provider setup return path', () => {
  let element: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    sessionStorage.clear()
    useAppStore.setState(useAppStore.getInitialState(), true)
    element = document.createElement('div')
    document.body.appendChild(element)
    root = createRoot(element)
  })

  afterEach(() => {
    act(() => root.unmount())
    element.remove()
    vi.unstubAllGlobals()
  })

  it('returns to the coach panel after saving and keeps the API key session-only', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[{ pathname: '/settings', state: { returnToChat: true } }]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/workspace" element={<ReturnTarget />} />
          </Routes>
        </MemoryRouter>,
      )
    })

    const apiKey = element.querySelector<HTMLInputElement>('input[aria-label="Provider API key"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(apiKey, 'test-session-key')
      apiKey.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => element.querySelector<HTMLButtonElement>('button[type="button"]')!.click())

    expect(element.querySelector('[data-testid="return-target"]')?.textContent).toBe('chat')
    expect(useAppStore.getState().provider.apiKey).toBe('test-session-key')
    expect(sessionStorage.getItem('algocoach.provider.apiKey')).toBe('test-session-key')
    expect(localStorage.getItem('algocoach.provider')).not.toContain('test-session-key')
  })
})
