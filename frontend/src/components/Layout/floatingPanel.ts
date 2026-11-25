export interface FloatRect {
  x: number
  y: number
  width: number
  height: number
}

export function clampFloatRect(rect: FloatRect): FloatRect {
  const width = Math.min(Math.max(rect.width, 320), Math.max(320, window.innerWidth - 16))
  const height = Math.min(Math.max(rect.height, 240), Math.max(240, window.innerHeight - 16))
  return {
    x: Math.min(Math.max(rect.x, 8), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(rect.y, 8), Math.max(8, window.innerHeight - height - 8)),
    width,
    height,
  }
}

export function readFloatRect(value: unknown, fallback: FloatRect): FloatRect {
  if (!value || typeof value !== 'object') return clampFloatRect(fallback)
  const rect = value as Partial<FloatRect>
  if (![rect.x, rect.y, rect.width, rect.height].every(item => typeof item === 'number' && Number.isFinite(item))) {
    return clampFloatRect(fallback)
  }
  return clampFloatRect(rect as FloatRect)
}
