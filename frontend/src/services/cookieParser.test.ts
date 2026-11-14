import { describe, expect, it } from 'vitest'
import { parseLeetCodeCurl } from './cookieParser'

describe('parseLeetCodeCurl', () => {
  it('extracts cookies from Chrome Copy as cURL output', () => {
    expect(parseLeetCodeCurl(
      "curl --url 'https://leetcode.cn/' \\\n+       -H 'Accept: text/html' \\\n+       -b 'foo=bar; LEETCODE_SESSION=session-value; csrftoken=csrf-value'",
    )).toEqual({ session: 'session-value', csrf: 'csrf-value' })
  })

  it('accepts a Cookie header and rejects incomplete input', () => {
    expect(parseLeetCodeCurl("curl -H 'Cookie: LEETCODE_SESSION=s; csrftoken=c'"))
      .toEqual({ session: 's', csrf: 'c' })
    expect(parseLeetCodeCurl("curl -b 'LEETCODE_SESSION=only'"))
      .toBeNull()
  })
})
