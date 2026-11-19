import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startDesktopServer } from './server.mjs'
import { startLocalServices } from './services.mjs'

const DESKTOP_ROOT = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(DESKTOP_ROOT, '..')
const FRONTEND_DIR = join(ROOT, 'frontend')
let frontendProcess = null
let desktopServer = null
let localServices = { stop: async () => {} }
let gatewayBaseUrl = process.env.ALGOCOACH_GATEWAY_URL ?? 'http://127.0.0.1:8080'

async function createWindow() {
  const isDev = !app.isPackaged
  let url
  if (isDev) {
    url = await startFrontendDevServer()
  } else {
    desktopServer ??= await startDesktopServer({ port: 18765, distRoot: join(DESKTOP_ROOT, 'embedded-dist'), gatewayBaseUrl })
    url = desktopServer.url
  }

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#F9FAFD',
    title: '算法练习室',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  await window.loadURL(url)
  window.webContents.setWindowOpenHandler(({ url: externalUrl }) => {
    void shell.openExternal(externalUrl)
    return { action: 'deny' }
  })
  return window
}

function startFrontendDevServer() {
  const port = Number(process.env.ALGOCOACH_FRONTEND_PORT ?? 5177)
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  frontendProcess = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: FRONTEND_DIR,
    env: { ...process.env, BROWSER: 'none' },
    stdio: 'inherit',
  })
  return waitForUrl(`http://127.0.0.1:${port}`)
}

async function waitForUrl(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return url
    } catch { /* Vite is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`桌面前端启动超时：${url}`)
}

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  await new Promise(resolve => server.close(resolve))
  return address.port
}

async function startBundledServices(root) {
  const gatewayPort = await availablePort()
  let agentPort = await availablePort()
  while (agentPort === gatewayPort) agentPort = await availablePort()
  gatewayBaseUrl = `http://127.0.0.1:${gatewayPort}`
  localServices = startLocalServices({ root, dataDir: join(app.getPath('userData'), 'data'), gatewayPort, agentPort, enabled: true })
  if (localServices.processes.length !== 2) throw new Error('桌面应用的后端运行文件不完整。')
  await waitForUrl(`${gatewayBaseUrl}/api/agent/memory/profile`, 60000)
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '算法练习室', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
    { label: '练习', submenu: [{ label: '重新加载学习空间', accelerator: 'CmdOrCtrl+Shift+R', click: (_item, window) => window?.loadURL(window.webContents.getURL()) }, { role: 'toggleDevTools' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  ]))
}

const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) app.quit()
else app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0]
  if (window?.isMinimized()) window.restore()
  window?.focus()
})

if (hasInstanceLock) app.whenReady().then(async () => {
  buildMenu()
  const bundledRoot = join(process.resourcesPath, 'sidecar')
  if (app.isPackaged && existsSync(bundledRoot)) {
    await startBundledServices(bundledRoot)
  } else {
    localServices = startLocalServices({ root: process.env.ALGOCOACH_SERVICE_ROOT ?? ROOT, dataDir: join(app.getPath('userData'), 'data') })
  }
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(error => {
      console.error('[desktop] 窗口打开失败', error)
      dialog.showErrorBox('无法打开学习空间', String(error?.message ?? error))
    })
  })
}).catch(async error => {
  console.error('[desktop] 启动失败', error)
  dialog.showErrorBox('算法练习室启动失败', String(error?.message ?? error))
  frontendProcess?.kill()
  await desktopServer?.close()
  await localServices.stop()
  app.exit(1)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async event => {
  if (frontendProcess || desktopServer || localServices.processes?.length) {
    event.preventDefault()
    frontendProcess?.kill()
    frontendProcess = null
    await desktopServer?.close()
    await localServices.stop()
    localServices = { stop: async () => {} }
    desktopServer = null
    app.quit()
  }
})
