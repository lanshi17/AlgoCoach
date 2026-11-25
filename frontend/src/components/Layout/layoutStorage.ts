/**
 * Layout records are persisted as `{ version, layout }`. Older builds wrote
 * the layout object directly, so `unpackLayout` accepts both shapes.
 */
export const LAYOUT_STORAGE_VERSION = 3

export function packLayout(layout: unknown, version = LAYOUT_STORAGE_VERSION): string {
  return JSON.stringify({ version, layout })
}

export function unpackLayout(value: string | null | undefined): unknown {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>
      if ('layout' in record) return record.layout
    }
    return parsed
  } catch {
    return null
  }
}
