import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FRONTEND_DIST = join(ROOT, 'frontend', 'dist')
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

export function startDesktopServer({ port = 0, distRoot = FRONTEND_DIST, gatewayBaseUrl = process.env.ALGOCOACH_GATEWAY_URL ?? 'http://127.0.0.1:8080' } = {}) {
  const gateway = new URL(gatewayBaseUrl)
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith('/api') || request.url?.startsWith('/animations')) {
      proxyRequest(request, response, gateway)
      return
    }
    serveFile(request, response, distRoot)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('桌面本地服务没有返回端口'))
        return
      }
      resolve({
        port: address.port,
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise(done => server.close(() => done())),
      })
    })
  })
}

function serveFile(request, response, distRoot) {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://desktop.local').pathname)
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
  const candidate = normalize(join(distRoot, relative))
  const safeRoot = `${normalize(distRoot)}${sep}`
  const isSafe = candidate === normalize(distRoot) || candidate.startsWith(safeRoot)
  const filePath = isSafe && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(distRoot, 'index.html')
  if (!existsSync(filePath)) {
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('前端尚未构建，请先运行 npm run build:frontend')
    return
  }
  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(response)
}

function proxyRequest(request, response, gateway) {
  const target = new URL(request.url ?? '/', gateway)
  const transport = target.protocol === 'https:' ? https : http
  const upstream = transport.request(target, {
    method: request.method,
    headers: { ...request.headers, host: target.host },
  }, result => {
    response.writeHead(result.statusCode ?? 502, result.headers)
    result.pipe(response)
  })
  upstream.on('error', error => {
    response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ message: `网关暂不可用：${error.message}` }))
  })
  request.pipe(upstream)
}
