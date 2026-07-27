const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktopAPI', {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron,
})
