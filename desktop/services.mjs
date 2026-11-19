import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * Start only processes that belong to this desktop session. Nothing is
 * auto-started by default: packaged installs may opt in with
 * ALGOCOACH_AUTOSTART_SERVICES=1, while developers can keep using Docker.
 */
export function startLocalServices({ root = process.cwd(), dataDir = join(root, 'data'), gatewayPort = 8080, agentPort = 8000, enabled = process.env.ALGOCOACH_AUTOSTART_SERVICES === '1' } = {}) {
  if (!enabled) return { processes: [], stop: async () => {} }

  mkdirSync(dataDir, { recursive: true })
  const animationsDir = join(dataDir, 'animations')
  mkdirSync(animationsDir, { recursive: true })
  const env = {
    SERVER_ADDRESS: '127.0.0.1', SERVER_PORT: String(gatewayPort),
    SPRING_DATASOURCE_URL: `jdbc:sqlite:${join(dataDir, 'algocoach.db')}`,
    AGENT_BASE_URL: `http://127.0.0.1:${agentPort}`,
    ANIMATIONS_LOCATION: `${pathToFileURL(animationsDir).href}/`,
    DB_PATH: join(dataDir, 'agent.db'), CHROMA_PATH: join(dataDir, 'chroma'),
    REME_WORKSPACE_DIR: join(dataDir, 'reme'), KNOWLEDGE_DIR: join(dataDir, 'knowledge'),
    OUTPUT_DIR: animationsDir, GATEWAY_BASE_URL: `http://127.0.0.1:${gatewayPort}`,
  }
  const processes = []
  const gatewayJar = resolveGatewayJar(root)
  const sidecarPython = existsSync(join(root, 'python', 'bin', 'python3.12'))
  const sidecarPackages = existsSync(join(root, 'site-packages'))
  const sidecarMarker = existsSync(join(root, 'platform.json')) || sidecarPython || sidecarPackages
  if (sidecarMarker && (!sidecarPython || !sidecarPackages)) {
    throw new Error(`侧车运行时不完整：${root}；请重新安装或运行 npm run prepare:sidecar`)
  }
  const sidecar = sidecarPython && sidecarPackages
  if (sidecar) assertSidecarPlatform(root)
  const python = sidecar ? join(root, 'python', 'bin', 'python3.12') : resolvePython(root)
  const java = sidecar ? join(root, 'java', 'bin', 'java') : 'java'
  if (sidecar) {
    env.PYTHONHOME = join(root, 'python')
    env.PYTHONPATH = join(root, 'site-packages')
    env.PYTHONDONTWRITEBYTECODE = '1'
  }
  const agentRoot = join(root, 'backend', 'agent')

  if (gatewayJar) {
    processes.push(startProcess('gateway', java, ['-jar', gatewayJar], root, env))
  }
  if (python && existsSync(join(agentRoot, 'app', 'main.py'))) {
    processes.push(startProcess('agent', python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(agentPort)], agentRoot, env))
  }

  return {
    processes,
    stop: async () => {
      await Promise.all(processes.map(process => stopProcess(process)))
    },
  }
}

export function assertSidecarPlatform(root) {
  const manifestPath = join(root, 'platform.json')
  if (!existsSync(manifestPath)) throw new Error(`侧车缺少 platform.json：${root}`)
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    throw new Error(`侧车 platform.json 无法读取：${error?.message ?? error}`)
  }
  const normalizedArch = value => ({ x86_64: 'x64', amd64: 'x64', AMD64: 'x64', aarch64: 'arm64', arm64: 'arm64' }[value] ?? value)
  if (manifest.platform !== process.platform || normalizedArch(manifest.arch) !== process.arch) {
    throw new Error(`侧车架构 ${manifest.platform}/${manifest.arch} 与运行时 ${process.platform}/${process.arch} 不匹配`)
  }
  return manifest
}

function resolveGatewayJar(root) {
  const target = join(root, 'backend', 'gateway', 'target')
  if (!existsSync(target)) return null
  const jar = readdirSync(target).find(name => name.endsWith('.jar') && !name.endsWith('-sources.jar') && !name.endsWith('-javadoc.jar'))
  return jar ? join(target, jar) : null
}

function resolvePython(root) {
  const candidates = [
    process.env.ALGOCOACH_PYTHON,
    join(root, 'backend', 'agent', '.venv', 'bin', 'python'),
    'python3',
  ].filter(Boolean)
  return candidates.find(candidate => candidate === 'python3' || existsSync(candidate)) ?? null
}

function startProcess(name, command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.on('data', chunk => process.stdout.write(`[${name}] ${chunk}`))
  child.stderr?.on('data', chunk => process.stderr.write(`[${name}] ${chunk}`))
  const entry = { name, child, closed: false }
  child.once('close', () => { entry.closed = true })
  child.once('error', error => console.error(`[desktop] ${name} 启动失败：${error.message}`))
  return entry
}

function stopProcess(process) {
  return new Promise(resolve => {
    if (process.closed || process.child.exitCode !== null || process.child.signalCode !== null) {
      resolve()
      return
    }
    const timeout = setTimeout(() => {
      if (!process.closed) process.child.kill('SIGKILL')
    }, 5000)
    timeout.unref()
    process.child.once('close', () => { clearTimeout(timeout); resolve() })
    process.child.kill('SIGTERM')
  })
}
