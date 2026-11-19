import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error(`需要在 macOS arm64 runner 上运行，当前为 ${process.platform}/${process.arch}`)
}
const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const manifestPath = join(desktopRoot, 'sidecar-stage', 'platform.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.platform !== 'darwin' || manifest.arch !== 'arm64') throw new Error(`侧车架构不匹配：${manifest.platform}/${manifest.arch}`)
for (const relative of ['sidecar-stage/python/bin/python3.12', 'sidecar-stage/java/bin/java']) {
  const file = join(desktopRoot, relative)
  if (!existsSync(file)) throw new Error(`缺少侧车运行时：${relative}`)
  const result = spawnSync('file', [file], { encoding: 'utf8' })
  if (result.status !== 0 || !/arm64|universal/i.test(result.stdout)) throw new Error(`运行时不是 arm64/universal：${result.stdout}`)
}
const dist = join(desktopRoot, 'dist')
const artifacts = readdirSync(dist).filter(name => /\.(dmg|zip)$/.test(name) && statSize(join(dist, name)))
if (artifacts.length < 2) throw new Error('缺少 macOS dmg/zip 产物')
const zip = artifacts.find(name => name.endsWith('.zip'))
if (!zip) throw new Error('缺少 macOS zip 产物')
const listing = spawnSync('unzip', ['-l', join(dist, zip)], { encoding: 'utf8' })
if (listing.status !== 0 || !listing.stdout.includes('/Contents/Resources/sidecar/python/bin/python3.12')) {
  throw new Error('macOS zip 中没有完整侧车 Python 运行时')
}
const unpacked = mkdtempSync(join(tmpdir(), 'algocoach-macos-sidecar-'))
try {
  const extracted = spawnSync('unzip', ['-q', join(dist, zip), '-d', unpacked], { encoding: 'utf8' })
  if (extracted.status !== 0) throw new Error(`无法解压 macOS zip：${extracted.stderr}`)
  const appName = readdirSync(unpacked).find(name => name.endsWith('.app'))
  if (!appName) throw new Error('macOS zip 中缺少 .app')
  const sidecar = join(unpacked, appName, 'Contents', 'Resources', 'sidecar')
  const python = join(sidecar, 'python', 'bin', 'python3.12')
  const java = join(sidecar, 'java', 'bin', 'java')
  const gateway = join(sidecar, 'backend', 'gateway', 'target', 'gateway-0.1.0.jar')
  for (const file of [python, java, gateway]) {
    if (!existsSync(file)) throw new Error(`macOS zip 解压后缺少：${file.slice(sidecar.length + 1)}`)
  }
  const pythonProbe = spawnSync(python, ['-c', 'import platform,sys; assert platform.machine() in ("arm64", "aarch64"); print(sys.version)'], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONHOME: join(sidecar, 'python'), PYTHONPATH: join(sidecar, 'site-packages'), PYTHONDONTWRITEBYTECODE: '1' },
    timeout: 30000,
  })
  if (pythonProbe.status !== 0) throw new Error(`打包 Python 无法启动：${pythonProbe.stderr || pythonProbe.error}`)
  const javaProbe = spawnSync(java, ['-version'], { encoding: 'utf8', timeout: 30000 })
  if (javaProbe.status !== 0) throw new Error(`打包 Java 无法启动：${javaProbe.stderr || javaProbe.error}`)
} finally {
  rmSync(unpacked, { recursive: true, force: true })
}
console.log(`macOS arm64 sidecar verified: ${artifacts.join(', ')}`)

function statSize(path) {
  try { return statSync(path).size > 0 } catch { return false }
}
