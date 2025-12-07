const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  startRecording: (windowId) => ipcRenderer.invoke('start-recording', windowId),
  stopRecording: (windowId) => ipcRenderer.invoke('stop-recording', windowId),
  getStatus: () => ipcRenderer.invoke('get-status')
});


