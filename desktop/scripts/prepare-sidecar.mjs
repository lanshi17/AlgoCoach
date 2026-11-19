// Build a relocatable sidecar from a platform-native standalone Python and JDK.
// The supplied Python environment must already contain the Agent requirements.
import { cpSync, existsSync, mkdirSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const output = join(repo, 'desktop', 'sidecar-stage')
const python = process.env.ALGOCOACH_BUILD_PYTHON ?? join(repo, 'desktop/sidecar-build-env/bin/python')
const probe = spawnSync(python, ['-c', 'import json,platform,sys,sysconfig; print(json.dumps({"base":sys.base_prefix,"site":sysconfig.get_path("purelib"),"version":list(sys.version_info[:2]),"machine":platform.machine()}))'], { encoding: 'utf8' })
if (probe.status !== 0) throw new Error(`无法读取 Python 环境: ${probe.stderr}`)
const info = JSON.parse(probe.stdout)
if (info.version[0] !== 3 || info.version[1] !== 12 || !existsSync(join(info.base, 'bin/python3.12')) || !existsSync(join(info.base, 'BUILD'))) throw new Error('需要 python-build-standalone 的 Python 3.12 环境')
const normalizedArch = value => ({ x86_64: 'x64', amd64: 'x64', AMD64: 'x64', aarch64: 'arm64', arm64: 'arm64' }[value] ?? value)
if (normalizedArch(info.machine) !== process.arch) throw new Error('Python 架构与构建进程不一致')
const javaHome = process.env.JAVA_HOME ?? dirname(dirname(realpathSync(spawnSync('which', ['java'], { encoding: 'utf8' }).stdout.trim())))
const jlink = join(javaHome, 'bin/jlink')
const jar = join(repo, 'backend/gateway/target/gateway-0.1.0.jar')
if (!existsSync(jlink) || !existsSync(jar)) throw new Error('需要带 jlink 的 JDK 和已构建的 Gateway JAR')
const javaInfo = spawnSync(join(javaHome, 'bin/java'), ['-XshowSettings:properties', '-version'], { encoding: 'utf8' })
const javaArch = /os\.arch\s*=\s*(\S+)/.exec(javaInfo.stderr)?.[1]
if (javaInfo.status !== 0 || normalizedArch(javaArch) !== process.arch) throw new Error('JDK 架构与构建进程不一致')
rmSync(output, { recursive: true, force: true })
mkdirSync(join(output, 'backend/gateway/target'), { recursive: true })
mkdirSync(join(output, 'backend/agent'), { recursive: true })
const filter = source => !source.includes('__pycache__') && !source.endsWith('.pyc')
// uv's standalone distribution contains absolute symlinks back into its cache.
// Dereference them so the packaged sidecar remains relocatable after the build
// directory is removed or the app is moved to another machine.
cpSync(info.base, join(output, 'python'), { recursive: true, dereference: true, filter })
cpSync(info.site, join(output, 'site-packages'), { recursive: true, dereference: true, filter })
cpSync(join(repo, 'backend/agent/app'), join(output, 'backend/agent/app'), { recursive: true, filter })
cpSync(jar, join(output, 'backend/gateway/target/gateway-0.1.0.jar'))
const result = spawnSync(jlink, ['--module-path', join(javaHome, 'jmods'), '--add-modules', 'ALL-MODULE-PATH', '--strip-debug', '--no-header-files', '--no-man-pages', '--output', join(output, 'java')], { stdio: 'inherit' })
if (result.status !== 0) throw new Error('jlink 构建失败')
assertRelocatable(output)
writeFileSync(join(output, 'platform.json'), JSON.stringify({ platform: process.platform, arch: process.arch }) + '\n')
console.log(`已准备侧车运行目录：${output}`)

function assertRelocatable(root) {
  const boundary = `${resolve(root)}${sep}`
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        const target = readlinkSync(path)
        const resolvedTarget = resolve(dirname(path), target)
        if (resolvedTarget !== resolve(root) && !resolvedTarget.startsWith(boundary)) {
          throw new Error(`侧车包含指向构建目录之外的符号链接：${path} -> ${target}`)
        }
      } else if (entry.isDirectory()) {
        visit(path)
      }
    }
  }
  visit(root)
}
