import { existsSync, readFileSync, readdirSync, readlinkSync } from 'node:fs'
import { arch, platform } from 'node:process'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifestPath = join(root, 'sidecar-stage', 'platform.json')
if (!existsSync(manifestPath)) throw new Error('找不到 sidecar-stage，请先运行 npm run prepare:sidecar')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.platform !== platform || manifest.arch !== arch) {
  throw new Error(`sidecar-stage 架构为 ${manifest.platform}/${manifest.arch}，当前构建为 ${platform}/${arch}；请在目标平台重新运行 npm run prepare:sidecar`)
}
const sidecar = join(root, 'sidecar-stage')
if (!existsSync(join(sidecar, 'backend/gateway/target/gateway-0.1.0.jar'))) throw new Error('sidecar-stage 缺少 Gateway JAR，请先构建 backend/gateway')
assertRelocatable(sidecar)
console.log(`sidecar-stage verified: ${manifest.platform}/${manifest.arch}`)

function assertRelocatable(directory) {
  const rootPath = resolve(directory)
  const boundary = `${rootPath}${sep}`
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isSymbolicLink()) {
        const target = readlinkSync(path)
        const resolvedTarget = resolve(dirname(path), target)
        if (resolvedTarget !== rootPath && !resolvedTarget.startsWith(boundary)) {
          throw new Error(`sidecar-stage 包含外部符号链接：${path} -> ${target}；请重新运行 npm run prepare:sidecar`)
        }
      } else if (entry.isDirectory()) {
        visit(path)
      }
    }
  }
  visit(directory)
}
