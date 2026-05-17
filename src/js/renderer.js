document.addEventListener('DOMContentLoaded', async () => {
  await Textures.init();

  // Try to load autosave
  let saveData = null;
  try {
    if (window.electronAPI && window.electronAPI.save) {
      const exists = await window.electronAPI.save.autosaveExists();
      if (exists) {
        const savePath = await window.electronAPI.save.getAutosavePath();
        const result = await window.electronAPI.save.read(savePath);
        if (result.success) {
          const parsed = JSON.parse(result.data);
          if (parsed && parsed.version) saveData = parsed;
        }
      }
    }
  } catch (e) {
    console.warn('[Load] Failed to load autosave, using default facility:', e);
  }

  AppState.init(saveData);
  Grid.init();
  Toolbar.init();
  Pipeline.init();
  Reports.init();
  Todo.init();
  initClockUpdate();
  initWindowControls();
  initWorkerPanel();
  initHudUpdater();
  initAutoSave();
  initSaveLoadKeys();
});

// ── Todo Panel (HITL review queue in-game) ──
const Todo = {
  init() {
    this.bar = document.getElementById('todoBar');
    this.report = document.getElementById('todoReport');
    this.items = document.getElementById('todoItems');
    this.completeEl = document.getElementById('todoComplete');
    this.totalEl = document.getElementById('todoTotal');

    this.bar.addEventListener('click', () => {
      this.report.classList.toggle('hidden');
      if (!this.report.classList.contains('hidden')) this.refresh();
    });

    this._reviewed = 0;
    this.refresh();
  },

  refresh() {
    const queue = AppState._hitlQueue || [];
    const total = queue.length + this._reviewed;
    this.totalEl.textContent = total;
    this.completeEl.textContent = this._reviewed;

    if (!this.items) return;
    this.items.innerHTML = '';

    if (queue.length === 0 && this._reviewed === 0) {
      this.items.innerHTML = '<div class="todo-report-item done"><span class="todo-check">✓</span><span class="todo-report-text" style="color:#888">No tasks — all clear!</span></div>';
      return;
    }

    // Show completed items
    for (let i = 0; i < Math.min(this._reviewed, 5); i++) {
      const el = document.createElement('div');
      el.className = 'todo-report-item done';
      el.innerHTML = '<span class="todo-check">✓</span><span class="todo-report-text">Email reviewed</span>';
      this.items.appendChild(el);
    }

    // Show pending items
    for (const item of queue.slice(0, 10)) {
      let fromDisplay = item.from || '';
      const nameMatch = fromDisplay.match(/^"?([^"<]+)"?\s*</);
      if (nameMatch) fromDisplay = nameMatch[1].trim();
      if (fromDisplay.length > 18) fromDisplay = fromDisplay.substring(0, 16) + '…';

      const aiSays = item.classification || item.action || '?';

      const el = document.createElement('div');
      el.className = 'todo-report-item todo-review-item';
      el.innerHTML = `
        <span class="todo-check empty">🧠</span>
        <span class="todo-report-text">${this._esc(fromDisplay)}: AI says "${aiSays}" — right?</span>
      `;
      el.style.cursor = 'pointer';
      el.title = 'Click to open full review panel';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        // Open the Reports panel to the Review tab
        if (typeof Reports !== 'undefined') {
          Reports.open();
          Reports.showHITL(AppState._hitlQueue || []);
        }
      });
      this.items.appendChild(el);
    }
  },


  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};

function initClockUpdate() {
  const clockEl = document.getElementById('clockTime');
  const periodEl = document.getElementById('clockPeriod');
  const periods = [
    [0,  'Midnight'],
    [4,  'Late Night'],
    [5,  'Pre-Dawn'],
    [6,  'Dawn'],
    [7,  'Early Morning'],
    [9,  'Morning'],
    [12, 'Midday'],
    [13, 'Early Afternoon'],
    [15, 'Afternoon'],
    [17, 'Late Afternoon'],
    [18, 'Evening'],
    [19, 'Dusk'],
    [21, 'Night'],
  ];
  function update() {
    const s = AppState.facility;
    const hours = Math.floor(s.time / 60) % 24;
    const mins = Math.floor(s.time % 60);
    clockEl.textContent =
      String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
    // Find current period
    let label = 'Midnight';
    for (const [h, name] of periods) {
      if (hours >= h) label = name;
    }
    periodEl.textContent = label;
  }
  setInterval(update, 200);
}

function initWindowControls() {
  document.getElementById('winMinimize').addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.minimize();
  });
  document.getElementById('winMaximize').addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.maximize();
  });
  document.getElementById('winClose').addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.close();
  });
}

function initWorkerPanel() {
  const panel = document.getElementById('workerPanel');
  if (!panel) return;

  panel.querySelector('.wp-close').addEventListener('click', () => {
    Grid.hideWorkerPanel();
  });

  document.getElementById('wpDismissBtn').addEventListener('click', () => {
    const w = AppState.ui.selectedWorker;
    if (w) {
      AppState.removeWorker(w.id);
      Grid.hideWorkerPanel();
    }
  });

  document.getElementById('wpAssignBtn').addEventListener('click', () => {
    const w = AppState.ui.selectedWorker;
    if (!w) return;
    const room = AppState.rooms.find(r => r.id === w.roomId);
    if (room) {
      // Open pipeline for first desk in this room
      const desks = AppState.objects.filter(obj => {
        if (obj.gx + obj.w <= room.x1 || obj.gx > room.x2 ||
            obj.gy + obj.h <= room.y1 || obj.gy > room.y2) return false;
        return DESK_TYPES.has(obj.type);
      });
      if (desks.length > 0) {
        Pipeline.openDeskEditor(desks[0].id);
      } else {
        Pipeline.openRoomConfig(room.id);
      }
    }
    Grid.hideWorkerPanel();
  });

  // Click outside panel to close
  document.addEventListener('click', (e) => {
    if (AppState.ui.selectedWorker && !panel.contains(e.target) && e.target !== panel) {
      // Don't close if clicking on canvas (worker detection handles it)
      if (e.target.closest('#gridCanvas')) return;
      Grid.hideWorkerPanel();
    }
  });
}

function initHudUpdater() {
  setInterval(() => {
    const s = AppState;
    const agentsActive = document.getElementById('agentsActive');
    const agentsTotal = document.getElementById('agentsTotal');
    if (agentsActive) agentsActive.textContent = s.workers.filter(w => w.state === 'working').length;
    if (agentsTotal) agentsTotal.textContent = s.workers.length;

    // Update worker panel if open
    if (s.ui.selectedWorker) Grid._updateWorkerPanel();
  }, 500);
}

// ── Auto-save (every 60 seconds) ──
function initAutoSave() {
  if (!window.electronAPI || !window.electronAPI.save) return;

  const INTERVAL = 60000; // 60 seconds
  setInterval(async () => {
    try {
      const data = AppState.serialize();
      const json = JSON.stringify(data);
      const savePath = await window.electronAPI.save.getAutosavePath();
      await window.electronAPI.save.write(savePath, json);
    } catch (e) {
      console.warn('[AutoSave] Failed:', e);
    }
  }, INTERVAL);

  // Save-on-close is handled by the main process (main.js close event handler).
  // The main process calls executeJavaScript('AppState.serialize()') and writes
  // the autosave synchronously before destroying the window.
}

// ── Manual Save/Load (Ctrl+S / Ctrl+O) ──
function initSaveLoadKeys() {
  if (!window.electronAPI || !window.electronAPI.save) return;

  document.addEventListener('keydown', async (e) => {
    // Ctrl+S: Save to file
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      try {
        const result = await window.electronAPI.save.dialogSave();
        if (result.canceled || !result.filePath) return;
        const data = AppState.serialize();
        const json = JSON.stringify(data, null, 2);
        const writeResult = await window.electronAPI.save.write(result.filePath, json);
        if (writeResult.success) {
          Reports.log('system', 'Facility saved to ' + result.filePath);
        }
      } catch (e) {
        console.error('[Save] Error:', e);
      }
    }

    // Ctrl+O: Load from file
    if (e.ctrlKey && e.key === 'o') {
      e.preventDefault();
      try {
        const result = await window.electronAPI.save.dialogOpen();
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
        const readResult = await window.electronAPI.save.read(result.filePaths[0]);
        if (readResult.success) {
          const saveData = JSON.parse(readResult.data);
          if (!saveData || !saveData.version) {
            Reports.log('system', 'Invalid save file — no version field', 'error');
            return;
          }
          AppState.init(saveData);
          Grid.texturePatterns = {};  // Invalidate texture cache
          Reports.log('system', 'Facility loaded from ' + result.filePaths[0]);
        }
      } catch (e) {
        console.error('[Load] Error:', e);
      }
    }
  });
}
