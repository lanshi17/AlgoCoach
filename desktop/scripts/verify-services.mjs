import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startLocalServices } from '../services.mjs'

const root = process.env.ALGOCOACH_SERVICE_ROOT ?? fileURLToPath(new URL('../..', import.meta.url))
const dataDir = await mkdtemp(join(tmpdir(), 'algocoach-desktop-smoke-'))
async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
const gatewayPort = await freePort()
let agentPort = await freePort()
while (agentPort === gatewayPort) agentPort = await freePort()
process.env.ALGOCOACH_CRONS_ENABLED = 'false'
const bundledPython = join(root, 'python/bin/python3.12')
if (existsSync(bundledPython)) {
  const probe = spawnSync(bundledPython, ['-c', 'import json,sys,uvicorn; print(json.dumps([sys.executable,uvicorn.__file__]))'], {
    env: { ...process.env, PYTHONHOME: join(root, 'python'), PYTHONPATH: join(root, 'site-packages') }, encoding: 'utf8',
  })
  if (probe.status !== 0) throw new Error(`捆绑 Python 无法加载 Agent 依赖: ${probe.stderr}`)
  const [executable, module] = JSON.parse(probe.stdout)
  if (!executable.startsWith(`${root}/python/`) || !module.startsWith(`${root}/site-packages/`)) throw new Error('Python 或依赖来自侧车目录之外')
}
const services = startLocalServices({ root, dataDir, gatewayPort, agentPort, enabled: true })
try {
  if (services.processes.length !== 2) throw new Error('需要已构建的 Gateway JAR 和 Agent Python 环境')
  const deadline = Date.now() + 60000
  let profile
  while (Date.now() < deadline) {
    const failed = services.processes.find(entry => entry.closed)
    if (failed) throw new Error(`${failed.name} 提前退出`)
    try {
      const response = await fetch(`http://127.0.0.1:${gatewayPort}/api/agent/memory/profile`, { signal: AbortSignal.timeout(1500) })
      if (response.ok) { profile = await response.json(); break }
    } catch { /* services are starting */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  if (!profile || typeof profile !== 'object') throw new Error('Gateway → Agent 启动超时')
  await Promise.all(['algocoach.db', 'agent.db'].map(name => access(join(dataDir, name))))
  console.log('desktop managed services verified: Gateway → Agent profile and both databases in user data directory')
} finally {
  await services.stop()
  await rm(dataDir, { recursive: true, force: true })
}
