import { existsSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const target = process.argv[2]
const expectations = {
  'linux-x64': ['.AppImage', '.deb'],
  'macos-arm64': ['.dmg', '.zip'],
  'macos-x64': ['.dmg', '.zip'],
}
if (!target || !expectations[target]) throw new Error(`unknown desktop target: ${target ?? '(missing)'}`)
const distPath = fileURLToPath(new URL('../dist/', import.meta.url))
if (!existsSync(distPath)) throw new Error(`missing desktop dist: ${distPath}`)
const names = readdirSync(distPath)
const missing = expectations[target].filter(extension => !names.some(name => name.endsWith(extension) && statSize(join(distPath, name))))
if (missing.length) throw new Error(`${target} is missing: ${missing.join(', ')}`)
if (target === 'linux-x64') verifyLinuxX64(names, distPath)
console.log(`${target} artifacts verified: ${expectations[target].join(', ')}`)

function verifyLinuxX64(names, root) {
  const appImage = names.find(name => name.endsWith('.AppImage'))
  const deb = names.find(name => name.endsWith('.deb'))
  const file = spawnSync('file', [join(root, appImage)], { encoding: 'utf8' })
  if (file.status !== 0 || !/ELF 64-bit.*x86-64/i.test(file.stdout)) {
    throw new Error(`AppImage 不是 Linux x86_64 ELF：${file.stdout || file.stderr}`)
  }
  const architecture = spawnSync('dpkg-deb', ['-f', join(root, deb), 'Architecture'], { encoding: 'utf8' })
  if (architecture.status !== 0 || architecture.stdout.trim() !== 'amd64') {
    throw new Error(`deb 架构不是 amd64：${architecture.stdout || architecture.stderr}`)
  }
}

function statSize(path) {
  try { return statSync(path).size > 0 } catch { return false }
}
