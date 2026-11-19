// Linux smoke test of the unpacked Electron build using a temporary user profile.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (process.platform !== 'linux') throw new Error('This smoke test requires Linux and xvfb-run')
const testDir = await mkdtemp(join(tmpdir(), 'algocoach-packaged-python-'))
const reservation = createServer()
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve) })
const debugPort = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const binary = process.env.ALGOCOACH_DESKTOP_BINARY ?? './dist/linux-unpacked/algo-coach-desktop'
const child = spawn('xvfb-run', ['-a', binary, '--no-sandbox', `--remote-debugging-port=${debugPort}`], {
  env: { ...process.env, XDG_CONFIG_HOME: join(testDir, 'config'), ALGOCOACH_CRONS_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})
let log = ''
for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log = (log + data.toString()).slice(-30000) })
let ws
try {
  const deadline = Date.now() + 90000
  let page
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Application exited: ${log}`)
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`)
      if (response.ok) page = (await response.json()).find(target => target.type === 'page')
      if (page) break
    } catch { /* still starting */ }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  if (!page) throw new Error(`Application did not open a window: ${log}`)
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let nextId = 0
  const pending = new Map()
  ws.onmessage = event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) } }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, message => message.error ? reject(new Error(message.error.message)) : message.result?.exceptionDetails ? reject(new Error(message.result.exceptionDetails.exception?.description)) : resolve(message.result))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
  const waitUntil = async expression => {
    for (let i = 0; i < 150; i++) {
      try { if (await evaluate(expression)) return } catch { /* initial navigation */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`UI did not reach expected state: ${expression}`)
  }
  const button = label => `[...document.querySelectorAll('button')].find(button => button.textContent.includes(${JSON.stringify(label)}))`
  await waitUntil(`!!${button('打开编码练习')}`)
  await evaluate(`${button('打开编码练习')}.click()`)
  await waitUntil(`!!${button('开始做题')}`)
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="编程语言"]');select.value='python3';select.dispatchEvent(new Event('change',{bubbles:true}));${button('开始做题')}.click()})()`)
  await waitUntil(`!!document.querySelector('[aria-label="代码编辑器"]')`)
  await evaluate(`document.querySelector('[aria-label="代码编辑器"]').focus()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 })
  await send('Input.insertText', { text: 'def two_sum(nums, target):\n    return [0, 1]' })
  await evaluate(`document.querySelector('button[aria-label="运行"]').click()`)
  await waitUntil(`document.body.innerText.includes('样例通过')`)
  assert.equal(await evaluate(`document.querySelector('button[aria-label="提交"]').disabled`), true)
  // Page.close shuts down the application and its managed services normally.
  ws.send(JSON.stringify({ id: ++nextId, method: 'Page.close' }))
  const exited = await Promise.race([new Promise(resolve => child.once('exit', () => resolve(true))), new Promise(resolve => { const timer = setTimeout(() => resolve(false), 15000); timer.unref() })])
  assert.equal(exited, true, 'Application did not exit after closing the window')
  assert.match(log, /Application shutdown complete/)
  assert.match(log, /HikariPool-1 - Shutdown completed/)
  console.log('packaged desktop verified: Python sample and managed-service shutdown')
} finally {
  ws?.close()
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM') } catch { /* process already exited */ }
  }
  await rm(testDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
