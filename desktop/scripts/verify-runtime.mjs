import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { startDesktopServer } from '../server.mjs'

const distRoot = process.env.ALGOCOACH_DESKTOP_DIST ?? fileURLToPath(new URL('../../frontend/dist/', import.meta.url))
const gateway = createServer((request, response) => {
  if (request.url === '/api/ping') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true }))
    return
  }
  response.writeHead(404)
  response.end()
})
await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve))
const gatewayAddress = gateway.address()
const gatewayBaseUrl = `http://127.0.0.1:${gatewayAddress.port}`
const desktop = await startDesktopServer({ distRoot, gatewayBaseUrl })
try {
  const shell = await fetch(`${desktop.url}/home`)
  if (!shell.ok || !(await shell.text()).includes('<div id="root">')) throw new Error('SPA fallback failed')
  const proxied = await fetch(`${desktop.url}/api/ping`)
  if (!proxied.ok || (await proxied.json()).ok !== true) throw new Error('API proxy failed')
  const malformed = await fetch(`${desktop.url}/%E0%A4%A`, { redirect: 'manual' })
  if (malformed.status !== 400) throw new Error(`malformed path returned ${malformed.status}`)
  console.log('desktop runtime verified: SPA fallback, API proxy, malformed path')
} finally {
  await desktop.close()
  await new Promise(resolve => gateway.close(resolve))
}
