// Global — main process reads this on close to know which slot to save to
var _activeSlot = 0;
var _gameStarted = false;

document.addEventListener('DOMContentLoaded', async () => {
  await Textures.init();
  initWindowControls();
  showMainMenu();
});

// ── Main Menu ──

async function showMainMenu() {
  _activeSlot = 0;
  if (_pauseOpen) closePauseMenu();
  const menu = document.getElementById('mainMenu');
  menu.classList.remove('hidden');
  document.body.classList.add('menu-active');

  // Load slot 1 (or default facility) as live background
  let bgSave = null;
  try {
    if (window.electronAPI && window.electronAPI.save) {
      // Try each slot in order — use whichever has data
      for (let i = 1; i <= 3; i++) {
        const savePath = await window.electronAPI.save.slotPath(i);
        const result = await window.electronAPI.save.read(savePath);
        if (result.success) {
          const parsed = JSON.parse(result.data);
          if (parsed && parsed.version) { bgSave = parsed; break; }
        }
      }
    }
  } catch (e) { /* silent — will use default facility */ }

  if (!_gameStarted) {
    // First launch — init everything with the background save
    AppState.init(bgSave);
    Grid.init();
    Toolbar.init();
    Pipeline.init();
    Reports.init();
    Todo.init();
    initClockUpdate();
    initWorkerPanel();
    initHudUpdater();
    initAutoSave();
    initSaveLoadKeys();
    initPauseMenu();
    _gameStarted = true;
  } else {
    // Returning to menu — reload background save
    AppState.init(bgSave);
    Grid.texturePatterns = {};
  }

  // Show the canvas behind the menu
  document.getElementById('main-area').style.visibility = 'visible';

  // Start auto-follow camera
  Grid.startAutoFollow();

  await renderSlots();
}

async function renderSlots() {
  const slotsEl = document.getElementById('mmSlots');
  if (!window.electronAPI || !window.electronAPI.save) {
    slotsEl.innerHTML = '<div style="color:#888;">Save system unavailable</div>';
    return;
  }

  const slots = await window.electronAPI.save.listSlots();
  slotsEl.innerHTML = '';

  for (const s of slots) {
    const card = document.createElement('div');
    card.className = 'mm-slot' + (s.exists ? '' : ' empty');

    if (s.exists) {
      let dateStr = '';
      try {
        const d = new Date(s.lastSaved);
        dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
                  ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) { dateStr = ''; }

      card.innerHTML = `
        <button class="mm-slot-delete" title="Delete save">&times;</button>
        <div class="mm-slot-num">Slot ${s.slot}</div>
        <div class="mm-slot-title">Facility</div>
        <div class="mm-slot-stats">
          <div class="mm-slot-stat">
            <span class="mm-slot-stat-label">Day</span>
            <span class="mm-slot-stat-value">${s.day}</span>
          </div>
          <div class="mm-slot-stat">
            <span class="mm-slot-stat-label">Workers</span>
            <span class="mm-slot-stat-value">${s.workers}</span>
          </div>
          <div class="mm-slot-stat">
            <span class="mm-slot-stat-label">Rooms</span>
            <span class="mm-slot-stat-value">${s.rooms}</span>
          </div>
        </div>
        <div class="mm-slot-date">${dateStr}</div>
      `;

      // Delete button
      card.querySelector('.mm-slot-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirm(card, s.slot);
      });

      // Load save
      card.addEventListener('click', () => loadSlot(s.slot));
    } else {
      card.innerHTML = `
        <div class="mm-slot-num">Slot ${s.slot}</div>
        <div class="mm-slot-empty-icon">+</div>
        <div class="mm-slot-empty-text">New Game</div>
      `;
      card.addEventListener('click', () => loadSlot(s.slot));
    }

    slotsEl.appendChild(card);
  }
}

function showDeleteConfirm(card, slot) {
  // Prevent duplicate confirm overlays
  if (card.querySelector('.mm-confirm')) return;

  const overlay = document.createElement('div');
  overlay.className = 'mm-confirm';
  overlay.innerHTML = `
    <div class="mm-confirm-text">Delete this save?</div>
    <div class="mm-confirm-btns">
      <button class="mm-confirm-btn cancel">Cancel</button>
      <button class="mm-confirm-btn delete">Delete</button>
    </div>
  `;

  overlay.querySelector('.cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
  });

  overlay.querySelector('.delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    await window.electronAPI.save.deleteSlot(slot);
    renderSlots();
  });

  overlay.addEventListener('click', (e) => e.stopPropagation());
  card.appendChild(overlay);
}

async function loadSlot(slot) {
  _activeSlot = slot;
  let saveData = null;

  try {
    const savePath = await window.electronAPI.save.slotPath(slot);
    const result = await window.electronAPI.save.read(savePath);
    if (result.success) {
      const parsed = JSON.parse(result.data);
      if (parsed && parsed.version) saveData = parsed;
    }
  } catch (e) {
    // No save — will start fresh
  }

  // Stop auto-follow camera
  Grid.stopAutoFollow();

  // Hide menu, show HUD
  document.getElementById('mainMenu').classList.add('hidden');
  document.body.classList.remove('menu-active');

  // Load the selected save (or new game)
  AppState.init(saveData);
  Grid.texturePatterns = {};
}

function returnToMenu() {
  // Save current slot before returning
  if (_activeSlot >= 1 && _activeSlot <= 3) {
    (async () => {
      try {
        const data = AppState.serialize();
        const json = JSON.stringify(data);
        const savePath = await window.electronAPI.save.slotPath(_activeSlot);
        await window.electronAPI.save.write(savePath, json);
      } catch (e) {
        console.warn('[Save] Failed to save before menu:', e);
      }
      showMainMenu();
    })();
  } else {
    showMainMenu();
  }
}

// ── Pause Menu ──

var _pauseOpen = false;

function togglePauseMenu() {
  if (_pauseOpen) closePauseMenu();
  else openPauseMenu();
}

function openPauseMenu() {
  if (_activeSlot < 1) return; // Don't open during main menu
  _pauseOpen = true;
  document.getElementById('pauseMenu').classList.remove('hidden');
}

function closePauseMenu() {
  _pauseOpen = false;
  document.getElementById('pauseMenu').classList.add('hidden');
}

function initPauseMenu() {
  document.getElementById('pauseResume').addEventListener('click', closePauseMenu);

  document.getElementById('pauseSettings').addEventListener('click', () => {
    closePauseMenu();
    Reports.open();
    Reports._openApp('system');
  });

  document.getElementById('pauseSave').addEventListener('click', async () => {
    if (_activeSlot < 1) return;
    try {
      const data = AppState.serialize();
      const json = JSON.stringify(data);
      const savePath = await window.electronAPI.save.slotPath(_activeSlot);
      await window.electronAPI.save.write(savePath, json);
      Reports.log('system', 'Saved to slot ' + _activeSlot);
    } catch (e) {
      console.warn('[Save] Failed:', e);
    }
    closePauseMenu();
  });

  document.getElementById('pauseLoad').addEventListener('click', async () => {
    closePauseMenu();
    // Re-load the current slot from disk
    try {
      const savePath = await window.electronAPI.save.slotPath(_activeSlot);
      const result = await window.electronAPI.save.read(savePath);
      if (result.success) {
        const parsed = JSON.parse(result.data);
        if (parsed && parsed.version) {
          AppState.init(parsed);
          Grid.texturePatterns = {};
          Reports.log('system', 'Loaded slot ' + _activeSlot);
        }
      }
    } catch (e) {
      console.warn('[Load] Failed:', e);
    }
  });

  document.getElementById('pauseQuit').addEventListener('click', () => {
    closePauseMenu();
    returnToMenu();
  });

  // ESC key handler — must run before grid/toolbar ESC handlers
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (_activeSlot < 1) return; // Ignore during main menu

    // If pause menu is open, close it
    if (_pauseOpen) {
      e.stopImmediatePropagation();
      closePauseMenu();
      return;
    }

    // If something is selected/active in the game, let existing handlers deal with it
    if (Grid._cloneMode && Grid._cloneData) return;
    if (Grid._objMoveMode) return;
    if (Grid._selectedObjId) return;
    if (AppState.tools.activeItem) return;
    if (Reports.isOpen()) return;

    // Nothing active — open pause menu
    e.stopImmediatePropagation();
    openPauseMenu();
  }, true); // 'true' = capture phase, runs before grid/toolbar handlers
}

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

// ── Auto-save (every 60 seconds, saves to active slot) ──
function initAutoSave() {
  if (!window.electronAPI || !window.electronAPI.save) return;

  const INTERVAL = 60000; // 60 seconds
  setInterval(async () => {
    if (_activeSlot < 1 || _activeSlot > 3) return;
    try {
      const data = AppState.serialize();
      const json = JSON.stringify(data);
      const savePath = await window.electronAPI.save.slotPath(_activeSlot);
      await window.electronAPI.save.write(savePath, json);
    } catch (e) {
      console.warn('[AutoSave] Failed:', e);
    }
  }, INTERVAL);
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
