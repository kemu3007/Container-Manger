const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dockerApi', {
  listContainers: () => ipcRenderer.invoke('docker:list'),
  listVolumes: () => ipcRenderer.invoke('docker:volumes'),
  listImages: () => ipcRenderer.invoke('docker:images'),
  startContainer: (id) => ipcRenderer.invoke('docker:start', id),
  stopContainer: (id) => ipcRenderer.invoke('docker:stop', id),
  removeContainer: (id) => ipcRenderer.invoke('docker:rm', id),
  inspectContainer: (id) => ipcRenderer.invoke('docker:inspect', id),
  logsContainer: (id) => ipcRenderer.invoke('docker:logs', id),
  composeLogs: (project) => ipcRenderer.invoke('docker:compose:logs', project),
  composeInspect: (project, projectDir) =>
    ipcRenderer.invoke('docker:compose:inspect', { project, projectDir }),
  removeVolume: (name) => ipcRenderer.invoke('docker:volume:rm', name),
  inspectVolume: (name) => ipcRenderer.invoke('docker:volume:inspect', name),
  removeImage: (name) => ipcRenderer.invoke('docker:image:rm', name),
  inspectImage: (name) => ipcRenderer.invoke('docker:image:inspect', name),
  openInVSCode: (path) => ipcRenderer.invoke('app:open-vscode', path),
  openErrorWindow: (message) => ipcRenderer.invoke('app:error', message)
})
