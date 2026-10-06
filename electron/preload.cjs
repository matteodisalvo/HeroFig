const { contextBridge, ipcRenderer } = require('electron');

// un file aperto dal Finder all'avvio può arrivare prima che React si metta in ascolto: lo si tiene da parte
const openedQueue = [];
const openedListeners = new Set();
ipcRenderer.on('file:opened', (_event, file) => {
  if (openedListeners.size) for (const cb of openedListeners) cb(file);
  else openedQueue.push(file);
});
const flushOpened = () => {
  while (openedListeners.size && openedQueue.length) {
    const file = openedQueue.shift();
    for (const cb of openedListeners) cb(file);
  }
};

// Interfaccia usata da src/platform.ts
contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (args) => ipcRenderer.invoke('file:save', args),
  saveExport: (args) => ipcRenderer.invoke('export:save', args),
  exportPdf: (args) => ipcRenderer.invoke('export:pdf', args),
  setDirty: (value) => ipcRenderer.send('state:dirty', value),
  setLanguage: (args) => ipcRenderer.send('app:language', args),
  saveSideFiles: (args) => ipcRenderer.invoke('export:side', args),
  closeWindow: () => ipcRenderer.send('window:close'),
  openExternal: (url) => ipcRenderer.send('shell:open', url),
  feedbackSubmit: (payload) => ipcRenderer.invoke('feedback:submit', payload),
  copyPng: (png) => ipcRenderer.invoke('clipboard:png', { png }),
  copyText: (text) => ipcRenderer.invoke('clipboard:text', { text }),
  onOpenFile: (cb) => {
    openedListeners.add(cb);
    if (openedQueue.length) setTimeout(flushOpened);
    return () => openedListeners.delete(cb);
  },
  projectPick: () => ipcRenderer.invoke('project:pick'),
  projectRead: (args) => ipcRenderer.invoke('project:read', args),
  projectWriteMeta: (args) => ipcRenderer.invoke('project:writeMeta', args),
  projectWriteFigure: (args) => ipcRenderer.invoke('project:writeFigure', args),
  readFile: (args) => ipcRenderer.invoke('file:read', args),
  watchFile: (args) => ipcRenderer.send('file:watch', args),
  onFileChanged: (cb) => {
    const handler = (_event, file) => cb(file);
    ipcRenderer.on('file:changed', handler);
    return () => ipcRenderer.removeListener('file:changed', handler);
  },
  presenceSet: (args) => ipcRenderer.invoke('presence:set', args),
  presenceList: (args) => ipcRenderer.invoke('presence:list', args),
  groupStatus: () => ipcRenderer.invoke('group:status'),
  groupCreate: (args) => ipcRenderer.invoke('group:create', args),
  groupLogin: (on) => ipcRenderer.invoke('group:login', on),
  groupStop: () => ipcRenderer.invoke('group:stop'),
  imageGenerate: (args) => ipcRenderer.invoke('image:generate', args),
  imageStop: () => ipcRenderer.send('image:stop'),
  imageTokenSource: () => ipcRenderer.invoke('image:token'),
  setImageToken: (token) => ipcRenderer.invoke('image:setToken', { token }),
  clearImageToken: () => ipcRenderer.invoke('image:clearToken'),
  onImageStep: (cb) => {
    const handler = (_event, text) => cb(text);
    ipcRenderer.on('image:step', handler);
    return () => ipcRenderer.removeListener('image:step', handler);
  },
  paperChoose: (args) => ipcRenderer.invoke('paper:choose', args),
  paperScan: (args) => ipcRenderer.invoke('paper:scan', args),
  paperWrite: (args) => ipcRenderer.invoke('paper:write', args),
  paperDrive: () => ipcRenderer.invoke('paper:drive'),
  overleafLink: (args) => ipcRenderer.invoke('overleaf:link', args),
  overleafHasToken: () => ipcRenderer.invoke('overleaf:hasToken'),
  paperReveal: (args) => ipcRenderer.invoke('paper:reveal', args),
  onMenu: (cb) => {
    const handler = (_event, action) => cb(action);
    ipcRenderer.on('menu', handler);
    return () => ipcRenderer.removeListener('menu', handler);
  },
});
