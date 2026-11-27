import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chrome = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
if (!chrome) throw new Error('Set CHROME_PATH to a Chromium executable')
const dataDir = await mkdtemp(join(tmpdir(), 'algocoach-python-browser-'))
let hits = 0
const trap = createServer((_request, response) => { hits++; response.end('unexpected') })
await new Promise(resolve => trap.listen(0, '127.0.0.1', resolve))
const port = trap.address().port
// Allocate ports independently of the external test server.
async function freePort() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const result = server.address().port
  await new Promise(resolve => server.close(resolve))
  return result
}
const vitePort = await freePort()
let debugPort = await freePort()
while (debugPort === vitePort || debugPort === port) debugPort = await freePort()
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], { stdio: 'ignore' })
let browser
let ws
async function waitFor(url) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return await response.json() } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}`)
}
try {
  // Vite has no JSON health endpoint; its status code is enough.
  const deadline = Date.now() + 30000
  while (true) {
    try { if ((await fetch(`http://127.0.0.1:${vitePort}/tests/local-python.html`)).ok) break } catch { /* starting */ }
    if (Date.now() > deadline) throw new Error('Vite startup timed out')
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${dataDir}`, `http://127.0.0.1:${vitePort}/tests/local-python.html`], { stdio: 'ignore' })
  const targets = await waitFor(`http://127.0.0.1:${debugPort}/json`)
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let nextId = 0
  const pending = new Map()
  ws.onmessage = event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) } }
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, message => message.error ? reject(new Error(message.error.message)) : message.result?.exceptionDetails ? reject(new Error(message.result.exceptionDetails.exception?.description)) : resolve(message.result))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
  for (let i = 0; i < 100 && !(await evaluate('window.ready === true')); i++) await new Promise(resolve => setTimeout(resolve, 100))
  const run = (problem, code, input) => evaluate(`window.runPractice(${JSON.stringify(problem)}, ${JSON.stringify(code)}, ${JSON.stringify(input)}).then(value=>({value})).catch(error=>({error:error.message}))`)
  const good = await run('local-two-sum', 'def two_sum(nums, target):\n    print("hello")\n    return [1, 0]', '2 7 11 15\n9')
  assert.equal(good.value.status_msg, '样例通过')
  assert.deepEqual(good.value.std_output_list, ['hello'])
  const wrong = await run('local-binary-search', 'def search(nums, target):\n    return 3', '-1 0 3 5 9 12\n9')
  assert.equal(wrong.value.status_msg, '样例未通过')
  const error = await run('local-two-sum', 'def two_sum(nums, target):\n    raise ValueError("bad input")', '2 7 11 15\n9')
  assert.match(error.error, /ValueError: bad input/)
  const timeout = await run('local-two-sum', 'def two_sum(nums, target):\n    while True: pass', '2 7 11 15\n9')
  assert.match(timeout.error, /运行超时/)
  const js = await run('local-two-sum', 'from js import fetch\ndef two_sum(nums, target): return [0, 1]', '2 7 11 15\n9')
  assert.match(js.error, /cannot import name 'fetch'/)
  assert.equal(await evaluate(`window.probeSandbox('http://127.0.0.1:${port}/trap')`), 'blocked')
  assert.equal(hits, 0)
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/learning/dashboard` })
  const waitUntil = async expression => {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(expression)) return } catch { /* navigation in progress */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`UI did not reach expected state: ${expression}`)
  }
  const button = label => `[...document.querySelectorAll('button')].find(button => button.textContent.includes(${JSON.stringify(label)}))`
  await waitUntil(`!!${button('打开编码练习')}`)
  await evaluate(`${button('打开编码练习')}.click()`)
  await waitUntil(`!!${button('开始做题')}`)
  await evaluate(`(()=>{ const select=document.querySelector('select[aria-label="编程语言"]'); select.value='python3'; select.dispatchEvent(new Event('change',{bubbles:true})); ${button('开始做题')}.click() })()`)
  await waitUntil(`!!document.querySelector('[aria-label="代码编辑器"]')`)
  await evaluate(`document.querySelector('[aria-label="代码编辑器"]').focus()`)
  const modifier = process.platform === 'darwin' ? 4 : 2
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: modifier })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: modifier })
  await send('Input.insertText', { text: 'def two_sum(nums, target):\n    return [0, 1]' })
  await evaluate(`document.querySelector('button[aria-label="运行"]').click()`)
  await waitUntil(`document.body.innerText.includes('样例通过')`)
  assert.equal(await evaluate(`document.querySelector('button[aria-label="提交"]').disabled`), true)
  console.log('local Python verified in Chromium: editor workflow, samples, exceptions, timeout and network isolation')
} finally {
  ws?.close()
  browser?.kill('SIGTERM')
  vite.kill('SIGTERM')
  await new Promise(resolve => trap.close(resolve))
  await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
