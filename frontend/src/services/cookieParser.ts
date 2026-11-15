export interface ParsedLeetCodeCookie {
  session: string
  csrf: string
}

/**
 * Extract the two cookies needed by the Gateway from a browser-generated curl.
 * The full command stays in the textarea only and is never persisted or sent.
 */
export function parseLeetCodeCurl(input: string): ParsedLeetCodeCookie | null {
  const cookieHeader = findCookieArgument(input) ?? findCookieHeader(input)
    ?? (/^\s*[^\s=;]+\s*=/.test(input) ? input : null)
  if (!cookieHeader) return null

  const cookies = new Map<string, string>()
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (name && value) cookies.set(name, value)
  }

  const session = cookies.get('LEETCODE_SESSION')
  const csrf = cookies.get('csrftoken')
  return session && csrf ? { session, csrf } : null
}

/**
 * Normalise a pasted Cookie header or "Copy as cURL" command into a single
 * header line. Non-LeetCode platforms accept either form.
 */
export function parseCookieHeader(input: string): string | null {
  const raw = findCookieArgument(input) ?? findCookieHeader(input) ?? input
  const cleaned = raw
    // Reject ASCII control characters before forwarding a Cookie header.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .replace(/;+$/, '')
    .trim()
  return cleaned.includes('=') ? cleaned : null
}

function findCookieArgument(input: string): string | null {
  // Chrome copies either `-b '...'` or `--cookie "..."`; permit line breaks
  // and the shell's optional `$'...'` form as well.
  const match = input.match(/(?:^|\s)(?:-b|--cookie)\s+(?:\$)?(['"])([\s\S]*?)\1/)
  if (match?.[2]) return match[2]

  const unquoted = input.match(/(?:^|\s)(?:-b|--cookie)\s+([^\s\\]+)/)
  return unquoted?.[1] ?? null
}

function findCookieHeader(input: string): string | null {
  const match = input.match(/(?:Cookie|cookie)\s*:\s*([^'"\r\n]+)/)
  return match?.[1]?.trim() ?? null
}
