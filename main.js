const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const gmail = require('./gmail');
const ollama = require('./ollama');
const save = require('./save');
const { initAutoUpdater } = require('./updater');

let mainWindow;

let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1a1a2e',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Initialize modules
  gmail.init(mainWindow);
  save.init(mainWindow, app.getPath('userData'));

  // ── Save on close ──
  // Intercept the close event, autosave facility state, then destroy the window.
  // The renderer's beforeunload async promises never complete before exit,
  // so the main process handles the save directly via executeJavaScript.
  mainWindow.on('close', async (e) => {
    if (isQuitting) return; // Already saving/closing
    e.preventDefault();
    isQuitting = true;

    try {
      const json = await mainWindow.webContents.executeJavaScript(
        'JSON.stringify(AppState.serialize())'
      );
      const savePath = save.getAutosavePath();
      await save.saveToFile(savePath, json);
      console.log('[AutoSave] Saved on close');
    } catch (err) {
      console.error('[AutoSave] Failed on close:', err);
    }

    mainWindow.destroy();
  });
}

// ── Window controls ──
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ── Gmail IPC handlers ──
ipcMain.handle('gmail:is-authenticated', () => gmail.isAuthenticated());

ipcMain.handle('gmail:start-auth', async () => {
  try {
    await gmail.startOAuthFlow();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gmail:logout', () => {
  gmail.logout();
  return { success: true };
});

ipcMain.handle('gmail:list-messages', async (_event, max) => {
  try {
    return { success: true, data: await gmail.listMessages(max) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gmail:get-message', async (_event, id) => {
  try {
    return { success: true, data: await gmail.getMessage(id) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gmail:get-profile', async () => {
  try {
    return { success: true, data: await gmail.getProfile() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Ollama IPC handlers ──
ipcMain.handle('ollama:available', async () => {
  try {
    return await ollama.isAvailable();
  } catch (e) {
    return { available: false, error: e.message };
  }
});

ipcMain.handle('ollama:generate', async (_event, prompt, options) => {
  try {
    return { success: true, data: await ollama.generate(prompt, options) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('ollama:chat', async (_event, messages, options) => {
  try {
    return { success: true, data: await ollama.chat(messages, options) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('ollama:models', async () => {
  try {
    return { success: true, data: await ollama.listModels() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Save/Load IPC handlers ──
ipcMain.handle('save:autosave-path', () => save.getAutosavePath());
ipcMain.handle('save:autosave-exists', () => save.autosaveExists());

ipcMain.handle('save:write', async (_event, filePath, jsonString) => {
  try {
    await save.saveToFile(filePath, jsonString);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save:read', async (_event, filePath) => {
  try {
    return { success: true, data: await save.loadFromFile(filePath) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save:dialog-save', async () => {
  try {
    return await save.saveDialog();
  } catch (e) {
    return { canceled: true, error: e.message };
  }
});

ipcMain.handle('save:dialog-open', async () => {
  try {
    return await save.loadDialog();
  } catch (e) {
    return { canceled: true, error: e.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  app.quit();
});
