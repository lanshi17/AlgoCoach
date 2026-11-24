import { describe, expect, it } from 'vitest'
import { parseChoiceAnswer, parseChoices, visibleReply } from './guidedChoice'

const OPTIONS = 'A. 第一项\nB. 第二项\nC. 第三项\nD. 第四项'
const MARKER = '[[答案:'

describe('parseChoiceAnswer', () => {
  it('reads the letter from a marker alone on the final line', () => {
    expect(parseChoiceAnswer(`请选择正确的选项：\n${OPTIONS}\n[[答案:C]]`)).toBe('C')
  })

  it('accepts surrounding spaces and CRLF line endings', () => {
    expect(parseChoiceAnswer(`${OPTIONS}\r\n[[答案:D]]\r\n`)).toBe('D')
    expect(parseChoiceAnswer(`${OPTIONS}\n  [[答案:B]]  \n`)).toBe('B')
  })

  it('rejects a marker followed by more text', () => {
    expect(parseChoiceAnswer(`${OPTIONS}\n[[答案:A]]\n解释：略`)).toBeUndefined()
  })

  it('rejects a marker that shares its line with other text', () => {
    expect(parseChoiceAnswer(`${OPTIONS}\n答案是 [[答案:A]]`)).toBeUndefined()
  })

  it('accepts only the letters A to D', () => {
    expect(parseChoiceAnswer(`${OPTIONS}\n[[答案:E]]`)).toBeUndefined()
  })

  it('returns undefined when there is no marker', () => {
    expect(parseChoiceAnswer(OPTIONS)).toBeUndefined()
  })
})

describe('parseChoices', () => {
  it('returns the four labelled options of a stem', () => {
    expect(parseChoices(`题干\n${OPTIONS}`)).toEqual([
      { label: 'A', body: '第一项' },
      { label: 'B', body: '第二项' },
      { label: 'C', body: '第三项' },
      { label: 'D', body: '第四项' },
    ])
  })

  it('returns nothing when fewer than four options are present', () => {
    expect(parseChoices('A. 第一项\nB. 第二项\nC. 第三项')).toEqual([])
  })

  it('returns nothing when a label repeats', () => {
    expect(parseChoices('A. 甲\nA. 乙\nB. 丙\nC. 丁')).toEqual([])
  })
})

describe('visibleReply', () => {
  it('drops a complete marker and the whitespace before it', () => {
    expect(visibleReply('解释。\n[[答案:A]]', MARKER)).toBe('解释。')
  })

  it('drops a marker that is still streaming in', () => {
    expect(visibleReply('解释。\n[[答', MARKER)).toBe('解释。')
  })

  it('drops a lone opening bracket at the end', () => {
    expect(visibleReply('解释。 [', MARKER)).toBe('解释。 ')
  })

  it('keeps unrelated double brackets', () => {
    expect(visibleReply('数组 [[1, 2]] 的含义', MARKER)).toBe('数组 [[1, 2]] 的含义')
  })
})
