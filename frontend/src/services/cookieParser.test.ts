import { describe, expect, it } from 'vitest'
import { parseCookieHeader } from './cookieParser'

describe('parseCookieHeader', () => {
  it('extracts the cookie from a pasted cURL command', () => {
    const curl = `curl 'https://www.acwing.com/problem/search/1/?page=1' \\
  -H 'cookie: csrftoken=abc; sessionid=def' \\
  -H 'user-agent: Mozilla/5.0'`
    expect(parseCookieHeader(curl)).toBe('csrftoken=abc; sessionid=def')
  })

  it('accepts -b shorthand and strips line breaks', () => {
    expect(parseCookieHeader("curl 'https://x.test' -b 'a=b; c=d'")).toBe('a=b; c=d')
    expect(parseCookieHeader('PHPSESSID=abc;\r\n  exesubmitlang=0')).toBe('PHPSESSID=abc; exesubmitlang=0')
  })

  it('strips a trailing semicolon and accepts an uppercase header', () => {
    expect(parseCookieHeader('PHPSESSID=abc;')).toBe('PHPSESSID=abc')
    expect(parseCookieHeader("-H 'COOKIE: a=b; c=d'")).toBe('a=b; c=d')
  })

  it('rejects input without a cookie pair', () => {
    expect(parseCookieHeader('curl https://x.test')).toBeNull()
    expect(parseCookieHeader("curl 'https://x.test/?page=1' -H 'user-agent: Mozilla/5.0'")).toBeNull()
    expect(parseCookieHeader("-H 'set-cookie: PHPSESSID=evil; Path=/'")).toBeNull()
    expect(parseCookieHeader('   ')).toBeNull()
  })
})
