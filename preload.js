const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  gmail: {
    isAuthenticated: () => ipcRenderer.invoke('gmail:is-authenticated'),
    startAuth:       () => ipcRenderer.invoke('gmail:start-auth'),
    logout:          () => ipcRenderer.invoke('gmail:logout'),
    listMessages:   (max) => ipcRenderer.invoke('gmail:list-messages', max),
    getMessage:      (id) => ipcRenderer.invoke('gmail:get-message', id),
    getProfile:      () => ipcRenderer.invoke('gmail:get-profile'),
  },

  ollama: {
    isAvailable:  () => ipcRenderer.invoke('ollama:available'),
    generate:     (prompt, opts) => ipcRenderer.invoke('ollama:generate', prompt, opts),
    chat:         (messages, opts) => ipcRenderer.invoke('ollama:chat', messages, opts),
    listModels:   () => ipcRenderer.invoke('ollama:models'),
  },

  save: {
    getAutosavePath: () => ipcRenderer.invoke('save:autosave-path'),
    autosaveExists:  () => ipcRenderer.invoke('save:autosave-exists'),
    write:           (filePath, jsonString) => ipcRenderer.invoke('save:write', filePath, jsonString),
    read:            (filePath) => ipcRenderer.invoke('save:read', filePath),
    dialogSave:      () => ipcRenderer.invoke('save:dialog-save'),
    dialogOpen:      () => ipcRenderer.invoke('save:dialog-open'),
  },
});
