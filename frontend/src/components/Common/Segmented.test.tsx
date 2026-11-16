import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import Segmented from './Segmented'

afterEach(() => { vi.unstubAllGlobals() })

it('shows every view and marks the active one', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const element = document.createElement('div')
  document.body.appendChild(element)
  const root = createRoot(element)
  let value = 'graph'
  const render = () => act(() => root.render(
    <Segmented
      label="视图"
      value={value}
      options={[{ value: 'graph', label: '图谱' }, { value: 'list', label: '列表' }]}
      onChange={next => { value = next; render() }}
    />,
  ))
  render()

  const buttons = () => Array.from(element.querySelectorAll('button'))
  expect(buttons().map(button => button.textContent)).toEqual(['图谱', '列表'])
  expect(buttons()[0].getAttribute('aria-pressed')).toBe('true')
  expect(buttons()[1].getAttribute('aria-pressed')).toBe('false')

  act(() => buttons()[1].click())
  expect(value).toBe('list')
  expect(buttons()[1].getAttribute('aria-pressed')).toBe('true')

  act(() => root.unmount())
  element.remove()
})
