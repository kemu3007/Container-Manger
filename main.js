const { app, BrowserWindow, ipcMain, screen } = require('electron')
const { execFile } = require('node:child_process')
const path = require('node:path')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)
let errorWindow = null

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const showErrorWindow = (message) => {
  const safeMessage = escapeHtml(message)
  const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>Container Manager Error</title>
    <style>
      body { margin: 0; font-family: "Trebuchet MS", sans-serif; background: #f7efe6; color: #1f1d1a; }
      .card { margin: 24px; padding: 20px; border-radius: 16px; border: 1px solid #e3d6c6; background: #fff; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 12px; color: #5a554f; }
      pre { margin: 0; padding: 12px; border-radius: 12px; background: #f9f2e8; border: 1px solid #eadbc9; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>エラーが発生しました</h1>
      <p>起動時の取得処理で問題が発生しました。</p>
      <pre>${safeMessage}</pre>
    </div>
  </body>
</html>`

  if (!errorWindow) {
    errorWindow = new BrowserWindow({
      width: 520,
      height: 420,
      resizable: false,
      webPreferences: {
        contextIsolation: true
      }
    })
    errorWindow.on('closed', () => {
      errorWindow = null
    })
  }

  errorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  errorWindow.show()
}

const createWindow = () => {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  const win = new BrowserWindow({
    width,
    height,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  win.maximize()
  win.loadFile('dist/container-manager/browser/index.html')
}

app.whenReady().then(() => {
  ipcMain.handle('docker:list', async () => {
    try {
      const { stdout } = await execFileAsync('docker', [
        'ps',
        '-a',
        '--format',
        '{{json .}}'
      ])
      const lines = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const data = lines.map((line) => JSON.parse(line))
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:volumes', async () => {
    try {
      const { stdout } = await execFileAsync('docker', [
        'volume',
        'ls',
        '--format',
        '{{json .}}'
      ])
      const lines = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const data = lines.map((line) => JSON.parse(line))
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:images', async () => {
    try {
      const { stdout } = await execFileAsync('docker', [
        'images',
        '--format',
        '{{json .}}'
      ])
      const lines = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const data = lines.map((line) => JSON.parse(line))
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:start', async (_event, id) => {
    try {
      await execFileAsync('docker', ['start', id])
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:stop', async (_event, id) => {
    try {
      await execFileAsync('docker', ['stop', id])
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:rm', async (_event, id) => {
    try {
      await execFileAsync('docker', ['rm', '-f', id])
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:inspect', async (_event, id) => {
    try {
      const { stdout } = await execFileAsync('docker', ['inspect', id])
      const parsed = JSON.parse(stdout)
      return { ok: true, data: parsed }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:logs', async (_event, id) => {
    try {
      const { stdout } = await execFileAsync('docker', ['logs', '--tail', '2000', id])
      return { ok: true, data: stdout }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:compose:logs', async (_event, project) => {
    if (!project) {
      return { ok: false, error: 'compose project が指定されていません。' }
    }
    try {
      const { stdout } = await execFileAsync('docker', [
        'compose',
        '-p',
        project,
        'logs',
        '--tail',
        '200',
        '--no-color'
      ])
      return { ok: true, data: stdout }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:volume:rm', async (_event, name) => {
    try {
      await execFileAsync('docker', ['volume', 'rm', name])
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:volume:inspect', async (_event, name) => {
    if (!name) {
      return { ok: false, error: 'volume が指定されていません。' }
    }
    try {
      const { stdout } = await execFileAsync('docker', ['volume', 'inspect', name])
      const parsed = JSON.parse(stdout)
      return { ok: true, data: parsed }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:image:rm', async (_event, name) => {
    try {
      await execFileAsync('docker', ['rmi', name])
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:image:inspect', async (_event, name) => {
    if (!name) {
      return { ok: false, error: 'image が指定されていません。' }
    }
    try {
      const { stdout } = await execFileAsync('docker', ['image', 'inspect', name])
      const parsed = JSON.parse(stdout)
      return { ok: true, data: parsed }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('docker:compose:inspect', async (_event, payload) => {
    const project = payload?.project
    const projectDir = payload?.projectDir
    if (!project || !projectDir) {
      return { ok: false, error: 'compose project またはディレクトリが指定されていません。' }
    }
    try {
      const { stdout } = await execFileAsync('docker', [
        'compose',
        '--project-directory',
        projectDir,
        '-p',
        project,
        'config',
        '--format',
        'json'
      ])
      const parsed = JSON.parse(stdout)
      return { ok: true, data: parsed }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  ipcMain.handle('app:error', async (_event, message) => {
    showErrorWindow(message)
    return { ok: true }
  })
  ipcMain.handle('app:open-vscode', async (_event, targetPath) => {
    if (!targetPath) {
      return { ok: false, error: 'パスが指定されていません。' }
    }
    try {
      await execFileAsync('code', [targetPath])
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
  })
  createWindow()
})
