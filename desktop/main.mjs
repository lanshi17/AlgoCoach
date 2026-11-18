import { app, BrowserWindow, Menu, shell } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startDesktopServer } from './server.mjs'

const DESKTOP_ROOT = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(DESKTOP_ROOT, '..')
const FRONTEND_DIR = join(ROOT, 'frontend')
let frontendProcess = null
let desktopServer = null

async function createWindow() {
  const isDev = !app.isPackaged
  let url
  if (isDev) {
    url = await startFrontendDevServer()
  } else {
    desktopServer = await startDesktopServer({ distRoot: join(DESKTOP_ROOT, 'embedded-dist') })
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

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '算法练习室', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
    { label: '练习', submenu: [{ label: '重新加载学习空间', accelerator: 'CmdOrCtrl+Shift+R', click: (_item, window) => window?.loadURL(window.webContents.getURL()) }, { role: 'toggleDevTools' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  ]))
}

app.whenReady().then(async () => {
  buildMenu()
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
}).catch(error => {
  console.error('[desktop] 启动失败', error)
  app.exit(1)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async event => {
  if (frontendProcess || desktopServer) {
    event.preventDefault()
    frontendProcess?.kill()
    frontendProcess = null
    await desktopServer?.close()
    desktopServer = null
    app.quit()
  }
})
