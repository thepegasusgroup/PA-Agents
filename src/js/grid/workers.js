// ── Worker selection panel (UI) ──
// Side panel that appears when a worker is selected. _moveSelectedWorkers
// is the right-click-target dispatch for box-selected workers (sends each
// to a spread of nearby cells around the target). Rendering of workers
// themselves lives in grid/render_workers.js.

Grid._moveSelectedWorkers = function (gx, gy) {
    const s = AppState;
    const count = this._selectedWorkers.length;
    if (count === 0) return;

    // Show move marker
    this._moveMarker = { x: gx, y: gy, time: Date.now() };

    // Spread workers around the target point to avoid stacking
    const workers = this._selectedWorkers
      .map(id => s.workers.find(w => w.id === id))
      .filter(Boolean);

    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      // Offset each worker slightly so they don't all stack on one cell
      let tx = gx + 0.5;
      let ty = gy + 0.5;
      if (count > 1) {
        const angle = (i / count) * Math.PI * 2;
        const radius = Math.min(Math.ceil(count / 4), 3);
        tx = gx + 0.5 + Math.cos(angle) * radius;
        ty = gy + 0.5 + Math.sin(angle) * radius;
        tx = Math.max(0.5, Math.min(s.grid.width - 0.5, tx));
        ty = Math.max(0.5, Math.min(s.grid.height - 0.5, ty));
      }

      // Compute path to target
      const path = this.findPath(w.x, w.y, tx, ty);
      if (path && path.length > 1) {
        w._path = path;
        w._pathIdx = 1;
        w.state = 'walking';
        w._idleTimer = 0;
        w._manualMove = true; // won't auto-roam after arrival
      }
    }
};

Grid.showWorkerPanel = function (worker) {
    AppState.ui.selectedWorker = worker;
    const panel = document.getElementById('workerPanel');
    if (!panel) return;
    panel.classList.remove('hidden');
    const wt = WorkerTypes[worker.type] || {};
    panel.querySelector('.wp-dot').style.background = worker.color;
    panel.querySelector('.wp-name').textContent = worker.name;
    panel.querySelector('.wp-type').textContent = wt.name || worker.type;
    this._updateWorkerPanel();
};

Grid.hideWorkerPanel = function () {
    AppState.ui.selectedWorker = null;
    const panel = document.getElementById('workerPanel');
    if (panel) panel.classList.add('hidden');
};

Grid._updateWorkerPanel = function () {
    const w = AppState.ui.selectedWorker;
    if (!w) return;
    const room = AppState.rooms.find(r => r.id === w.roomId);
    const def = room ? RoomDefs[room.type] : null;
    const stateEl = document.getElementById('wpState');
    const roomEl = document.getElementById('wpRoom');
    const taskEl = document.getElementById('wpTask');
    if (stateEl) stateEl.textContent = w.state.charAt(0).toUpperCase() + w.state.slice(1);
    if (roomEl) roomEl.textContent = def ? def.name : 'Unknown';
    if (taskEl) taskEl.textContent = w.taskLabel || 'None';
};
