import { describe, expect, it } from 'vitest'
import { parseLocalPythonInput, localPythonSampleResult } from './localPythonRunner'

describe('local Python practice inputs', () => {
  it('accepts space separated and JSON arrays', () => {
    expect(parseLocalPythonInput('2 7 11 15\n9')).toEqual({ nums: [2, 7, 11, 15], target: 9 })
    expect(parseLocalPythonInput('[-1, 0, 3]\n-1')).toEqual({ nums: [-1, 0, 3], target: -1 })
  })
  it('rejects malformed, excessive and unsafe inputs', () => {
    for (const input of ['1 nope\n3', '[1, 2.5]\n2', '1\n1\n2', '1\nInfinity', '9007199254740992\n1', `${'1 '.repeat(10001)}\n1`]) {
      expect(() => parseLocalPythonInput(input)).toThrow()
    }
  })
  it('checks known samples without treating custom inputs as judged submissions', () => {
    expect(localPythonSampleResult('local-two-sum', '2 7 11 15\n9', '[1, 0]')).toEqual({ passed: true, expected: '[0, 1]（顺序不限）' })
    expect(localPythonSampleResult('local-binary-search', '-1 0 3 5 9 12\n9', '3')).toEqual({ passed: false, expected: '4' })
    expect(localPythonSampleResult('local-binary-search', '1 2\n2', '1')).toBeNull()
  })
})
