import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { startDesktopServer } from '../server.mjs'

function send(url, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, response => {
      response.resume()
      response.on('end', () => resolve(response.statusCode))
    })
    req.on('error', reject)
    req.end()
  })
}

test('desktop proxy accepts its own origin and rejects cross-site and rebinding requests', async () => {
  let calls = 0
  const forwardedOrigins = []
  const gateway = createServer((req, res) => { calls++; forwardedOrigins.push(req.headers.origin); res.end('ok') })
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve))
  const desktop = await startDesktopServer({ gatewayBaseUrl: `http://127.0.0.1:${gateway.address().port}` })
  try {
    const api = `${desktop.url}/api/test`
    assert.equal(await send(api), 200)
    assert.equal(await send(api, { method: 'POST', headers: { origin: desktop.url } }), 200)
    assert.equal(await send(api, { method: 'POST' }), 403)
    assert.equal(await send(api, { method: 'POST', headers: { origin: 'https://attacker.example' } }), 403)
    assert.equal(await send(api, { headers: { 'sec-fetch-site': 'cross-site' } }), 403)
    assert.equal(await send(api, { headers: { host: `attacker.example:${desktop.port}` } }), 403)
    assert.equal(calls, 2)
    assert.deepEqual(forwardedOrigins, [undefined, undefined])
  } finally {
    await desktop.close()
    await new Promise(resolve => gateway.close(resolve))
  }
})
