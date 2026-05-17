const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let saveDirPath = null;

const Save = {
  init(win, userDataPath) {
    mainWindow = win;
    saveDirPath = path.join(userDataPath, 'saves');
    // Ensure saves directory exists
    if (!fs.existsSync(saveDirPath)) {
      fs.mkdirSync(saveDirPath, { recursive: true });
    }
  },

  getAutosavePath() {
    return path.join(saveDirPath, 'autosave.json');
  },

  autosaveExists() {
    return fs.existsSync(this.getAutosavePath());
  },

  async saveToFile(filePath, jsonString) {
    const tmpPath = filePath + '.tmp';
    await fs.promises.writeFile(tmpPath, jsonString, 'utf-8');
    await fs.promises.rename(tmpPath, filePath);
  },

  async loadFromFile(filePath) {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return data;
  },

  async saveDialog() {
    return dialog.showSaveDialog(mainWindow, {
      title: 'Save Facility',
      defaultPath: path.join(saveDirPath, 'my-facility.json'),
      filters: [
        { name: 'PA-Agents Save', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
  },

  async loadDialog() {
    return dialog.showOpenDialog(mainWindow, {
      title: 'Load Facility',
      defaultPath: saveDirPath,
      filters: [
        { name: 'PA-Agents Save', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
  },
};

module.exports = Save;
