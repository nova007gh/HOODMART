const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged
let mainWindow = null
let nextServer = null

function startNextServer() {
  return new Promise((resolve) => {
    const nextBin = path.join(__dirname, 'node_modules', '.bin', 'next')
    nextServer = spawn(nextBin, ['start', '-p', '3000'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: true,
    })

    nextServer.stdout.on('data', (data) => {
      const msg = data.toString().trim()
      console.log('[next]', msg)
      if (msg.includes('Ready') || msg.includes('started') || msg.includes('Local:')) {
        resolve()
      }
    })

    nextServer.stderr.on('data', (data) => {
      console.error('[next:error]', data.toString().trim())
    })

    // Fallback: resolve after 8 seconds even if we don't catch the ready message
    setTimeout(() => resolve(), 8000)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'EMDPOS Retail OS',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  const url = isDev
    ? 'http://localhost:3000'
    : 'http://localhost:3000'

  mainWindow.loadURL(url)
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Sale', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.loadURL('http://localhost:3000/pos') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Navigation',
      submenu: [
        { label: 'Dashboard', click: () => mainWindow?.loadURL('http://localhost:3000/dashboard') },
        { label: 'Point of Sale', click: () => mainWindow?.loadURL('http://localhost:3000/pos') },
        { label: 'Products', click: () => mainWindow?.loadURL('http://localhost:3000/products') },
        { label: 'Inventory', click: () => mainWindow?.loadURL('http://localhost:3000/inventory') },
        { label: 'Sales', click: () => mainWindow?.loadURL('http://localhost:3000/sales') },
        { label: 'Reports', click: () => mainWindow?.loadURL('http://localhost:3000/reports') },
        { label: 'Settings', click: () => mainWindow?.loadURL('http://localhost:3000/settings') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About EMDPOS', click: () => shell.openExternal('https://www.emdulab.com') },
        { label: 'Support', click: () => shell.openExternal('mailto:admin@emdulab.com') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  if (!isDev) {
    await startNextServer()
  }
  createWindow()
  createMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill('SIGTERM')
    nextServer = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill('SIGTERM')
    nextServer = null
  }
})
