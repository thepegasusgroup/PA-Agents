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

  // ── Slot-based saves (1-3) ──

  getSlotPath(slot) {
    return path.join(saveDirPath, `slot_${slot}.json`);
  },

  async listSlots() {
    const slots = [];
    for (let i = 1; i <= 3; i++) {
      const p = this.getSlotPath(i);
      if (fs.existsSync(p)) {
        try {
          const raw = await fs.promises.readFile(p, 'utf-8');
          const data = JSON.parse(raw);
          const stat = await fs.promises.stat(p);
          slots.push({
            slot: i,
            exists: true,
            day: data.facility?.day || 1,
            workers: data.workers?.length || 0,
            rooms: data.rooms?.length || 0,
            lastSaved: stat.mtime.toISOString(),
          });
        } catch (e) {
          slots.push({ slot: i, exists: false });
        }
      } else {
        slots.push({ slot: i, exists: false });
      }
    }
    return slots;
  },

  async deleteSlot(slot) {
    const p = this.getSlotPath(slot);
    if (fs.existsSync(p)) {
      await fs.promises.unlink(p);
    }
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
