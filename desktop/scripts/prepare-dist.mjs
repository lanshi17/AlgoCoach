import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const dist = join(desktopRoot, '..', 'frontend', 'dist')
const embedded = join(desktopRoot, 'embedded-dist')
if (!existsSync(dist)) throw new Error('找不到 frontend/dist，请先构建前端')
mkdirSync(embedded, { recursive: true })
cpSync(dist, embedded, { recursive: true })
console.log(`已准备桌面资源：${embedded}`)
