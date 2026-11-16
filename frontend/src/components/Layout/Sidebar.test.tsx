import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import Sidebar from './Sidebar'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('owns the single theme control for every route', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState(useAppStore.getInitialState(), true)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  act(() => root.render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Sidebar />
    </MemoryRouter>,
  ))

  const themeControls = element.querySelectorAll<HTMLButtonElement>('button[aria-label="切换主题"]')
  expect(themeControls).toHaveLength(1)
  act(() => themeControls[0].click())
  expect(useAppStore.getState().theme).toBe('dark')
  act(() => root.unmount())
  element.remove()
})
