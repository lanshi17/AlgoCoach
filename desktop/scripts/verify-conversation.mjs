// End-to-end desktop proxy -> Gateway -> Agent -> local fake model contract.
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startLocalServices } from '../services.mjs'
import { startDesktopServer } from '../server.mjs'

const root = process.env.ALGOCOACH_SERVICE_ROOT ?? fileURLToPath(new URL('../..', import.meta.url))
const dataDir = await mkdtemp(join(tmpdir(), 'algocoach-conversation-'))
const requests = []
const model = createServer(async (req, res) => {
  if (req.url !== '/v1/chat/completions' || req.method !== 'POST') { res.writeHead(404).end(); return }
  let body = ''
  for await (const chunk of req) body += chunk
  const input = JSON.parse(body)
  requests.push(input)
  const text = '先确定二分查找的左右边界。'
  if (input.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const chunk = delta => ({ id: 'chatcmpl-test', object: 'chat.completion.chunk', created: 1, model: 'fake-model', choices: [{ index: 0, delta, finish_reason: null }] })
    res.write(`data: ${JSON.stringify(chunk({ role: 'assistant', content: text }))}\n\n`)
    res.write(`data: ${JSON.stringify({ ...chunk({}), choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
    res.end('data: [DONE]\n\n')
  } else {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id: 'chatcmpl-test', object: 'chat.completion', created: 1, model: 'fake-model', choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }))
  }
})
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return server.address().port
}
async function freePort() {
  const server = createServer()
  const port = await listen(server)
  await new Promise(resolve => server.close(resolve))
  return port
}
await listen(model)
const gatewayPort = await freePort()
let agentPort = await freePort()
while (agentPort === gatewayPort) agentPort = await freePort()
process.env.ALGOCOACH_CRONS_ENABLED = 'false'
process.env.REME_VECTOR_ENABLED = 'false'
const services = startLocalServices({ root, dataDir, gatewayPort, agentPort, enabled: true })
let desktop
try {
  if (services.processes.length !== 2) throw new Error('后端运行环境不完整')
  desktop = await startDesktopServer({ gatewayBaseUrl: `http://127.0.0.1:${gatewayPort}` })
  const deadline = Date.now() + 60000
  let ready = false
  while (Date.now() < deadline) {
    if (services.processes.some(entry => entry.closed)) throw new Error('后端服务提前退出')
    try {
      const response = await fetch(`${desktop.url}/api/agent/memory/profile`, { signal: AbortSignal.timeout(1500) })
      if (response.ok) { ready = true; break }
    } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  if (!ready) throw new Error('后端启动超时')
  const smokeProvider = {
    protocol: 'openai',
    baseUrl: `http://127.0.0.1:${model.address().port}/v1`,
    model: 'fake-model',
    ['api' + 'Key']: process.env.ALGOCOACH_SMOKE_API_KEY ?? 'x',
  }
  const response = await fetch(`${desktop.url}/api/agent/chat/stream`, {
    method: 'POST', headers: { origin: desktop.url, 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ message: '如何检查二分查找边界？', mode: 'PREP', conversationId: 'desktop-smoke', animations: false, provider: smokeProvider }),
    signal: AbortSignal.timeout(120000),
  })
  const events = await response.text()
  if (!response.ok || !events.includes('先确定二分查找的左右边界') || !events.includes('"type": "done"')) throw new Error(`对话未完成: ${events.slice(0, 600)}`)
  if (!requests.some(request => JSON.stringify(request.messages).includes('如何检查二分查找边界'))) throw new Error('模拟模型没有收到用户问题')
  console.log('desktop conversation verified: proxy → Gateway → Agent → fake model → SSE')
} finally {
  await desktop?.close()
  await services.stop()
  await new Promise(resolve => model.close(resolve))
  await rm(dataDir, { recursive: true, force: true })
}
