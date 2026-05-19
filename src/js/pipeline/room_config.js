// ── Room config overlay ──
// Per-room tabs: Staff (hire/dismiss workers) and Pipeline (chain order of desks).
// Shared state: Pipeline._currentRoomId (declared in core.js).
// Note: deskOrder is opt-in — _renderRoomConfig prunes deleted desks but never
// auto-adds new ones. Chaining UI is currently view-only (reorder via arrows).

Pipeline.openRoomConfig = function (roomId) {
  this._currentRoomId = roomId;
  const room = AppState.rooms.find(r => r.id === roomId);
  if (!room) return;
  const def = RoomDefs[room.type];

  this.roomOverlay.classList.remove('hidden');
  const titleEl = this.roomOverlay.querySelector('.rc-title');
  titleEl.textContent = def ? def.name : 'Room';

  // Reset to Staff tab
  this.roomOverlay.querySelectorAll('.rc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'staff'));
  this.roomOverlay.querySelectorAll('.rc-tab-content').forEach(tc => tc.classList.toggle('hidden', tc.dataset.tab !== 'staff'));

  this._renderRoomConfig();
  this._renderStaffTab();
};

Pipeline.closeRoomConfig = function () {
  this.roomOverlay.classList.add('hidden');
  this._currentRoomId = null;
};

Pipeline._renderRoomConfig = function () {
  const roomId = this._currentRoomId;
  if (!roomId) return;

  const room = AppState.rooms.find(r => r.id === roomId);
  if (!room) return;
  const rp = AppState.getRoomPipeline(roomId);

  this._renderRoomInfo();

  // List desks with pipelines
  const listEl = this.roomOverlay.querySelector('.rc-desk-list');
  listEl.innerHTML = '';

  // Find all desk-type objects in this room
  const desks = AppState.objects.filter(obj => {
    if (obj.gx + obj.w <= room.x1 || obj.gx > room.x2 ||
        obj.gy + obj.h <= room.y1 || obj.gy > room.y2) return false;
    return DESK_TYPES.has(obj.type);
  });

  if (desks.length === 0) {
    listEl.innerHTML = '<div class="rc-empty">No desks in this room</div>';
    return;
  }

  // Show only desks the user has explicitly chained. Prune any whose object
  // was deleted but don't auto-add new desks — chaining is opt-in.
  const currentOrder = rp.deskOrder.filter(id => desks.some(d => d.id === id));
  AppState.setRoomDeskOrder(roomId, currentOrder);

  if (currentOrder.length === 0) {
    listEl.innerHTML = '<div class="rc-empty">No desks chained. Open a desk\'s pipeline editor to configure it individually.</div>';
    return;
  }

  for (let i = 0; i < currentOrder.length; i++) {
    const obj = AppState.objects.find(o => o.id === currentOrder[i]);
    if (!obj) continue;
    const objDef = ObjectDefs[obj.type];
    const pip = AppState.pipelines[obj.id];
    const nodeCount = pip ? pip.nodes.length : 0;

    const item = document.createElement('div');
    item.className = 'rc-desk-item';
    item.innerHTML = `
      <span class="rc-desk-num">${i + 1}</span>
      <span class="rc-desk-name">${objDef ? objDef.name : obj.type}</span>
      <span class="rc-desk-nodes">${nodeCount} node${nodeCount !== 1 ? 's' : ''}</span>
      <div class="rc-desk-arrows">
        <button class="rc-arrow-up" data-idx="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="rc-arrow-down" data-idx="${i}" ${i === currentOrder.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
    `;

    // Click to open desk editor
    item.querySelector('.rc-desk-name').addEventListener('click', () => {
      this.closeRoomConfig();
      this.openDeskEditor(obj.id);
    });

    // Arrow buttons to reorder
    item.querySelector('.rc-arrow-up').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(e.target.dataset.idx);
      if (idx > 0) {
        [currentOrder[idx], currentOrder[idx - 1]] = [currentOrder[idx - 1], currentOrder[idx]];
        AppState.setRoomDeskOrder(roomId, currentOrder);
        this._renderRoomConfig();
      }
    });
    item.querySelector('.rc-arrow-down').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(e.target.dataset.idx);
      if (idx < currentOrder.length - 1) {
        [currentOrder[idx], currentOrder[idx + 1]] = [currentOrder[idx + 1], currentOrder[idx]];
        AppState.setRoomDeskOrder(roomId, currentOrder);
        this._renderRoomConfig();
      }
    });

    listEl.appendChild(item);
  }
};

// ── Staff deployment tab ──

Pipeline._renderStaffTab = function () {
  const roomId = this._currentRoomId;
  if (!roomId) return;
  const room = AppState.rooms.find(r => r.id === roomId);
  if (!room) return;

  // Build staff button grid
  const staffGrid = this.roomOverlay.querySelector('.rc-staff-grid');
  staffGrid.innerHTML = '';

  for (const [typeId, wt] of Object.entries(WorkerTypes)) {
    const btn = document.createElement('div');
    btn.className = 'rc-staff-btn';
    btn.title = `Click to assign a ${wt.name} to this room`;
    btn.innerHTML = `
      <div class="rc-staff-icon" style="background:${wt.color}">${wt.icon}</div>
      <div class="rc-staff-name">${wt.name}</div>
    `;
    btn.addEventListener('click', () => {
      // Spawn worker at random position inside room bounds
      const rx = room.x1 + 1 + Math.random() * Math.max(0, room.x2 - room.x1 - 1);
      const ry = room.y1 + 1 + Math.random() * Math.max(0, room.y2 - room.y1 - 1);
      AppState.spawnWorker(typeId, Math.floor(rx), Math.floor(ry));
      this._renderStaffTab();
      this._renderRoomInfo();
    });
    staffGrid.appendChild(btn);
  }

  // Build assigned workers list
  this._renderAssignedWorkers();
};

Pipeline._renderAssignedWorkers = function () {
  const roomId = this._currentRoomId;
  if (!roomId) return;
  const list = this.roomOverlay.querySelector('.rc-assigned-list');
  list.innerHTML = '';

  const workers = AppState.getWorkersInRoom(roomId);

  if (workers.length === 0) {
    list.innerHTML = '<div class="rc-assigned-empty">No staff assigned</div>';
    return;
  }

  for (const w of workers) {
    const wt = WorkerTypes[w.type] || {};
    const item = document.createElement('div');
    item.className = 'rc-assigned-item';
    item.innerHTML = `
      <div class="rc-assigned-dot" style="background:${wt.color || '#888'}"></div>
      <span class="rc-assigned-name">${w.name}</span>
      <span class="rc-assigned-role">${wt.name || w.type}</span>
      <button class="rc-assigned-remove" title="Dismiss worker">&times;</button>
    `;
    item.querySelector('.rc-assigned-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.removeWorker(w.id);
      this._renderStaffTab();
      this._renderRoomInfo();
    });
    list.appendChild(item);
  }
};

Pipeline._renderRoomInfo = function () {
  const roomId = this._currentRoomId;
  if (!roomId) return;
  const room = AppState.rooms.find(r => r.id === roomId);
  if (!room) return;
  const def = RoomDefs[room.type];
  const workers = AppState.getWorkersInRoom(roomId);

  const infoEl = this.roomOverlay.querySelector('.rc-info');
  infoEl.innerHTML = `
    <div class="rc-stat"><label>Room</label><span>${def ? def.name : room.type}</span></div>
    <div class="rc-stat"><label>Workers</label><span>${workers.length}</span></div>
    <div class="rc-stat"><label>Status</label><span>${room.satisfied ? 'Satisfied' : 'Unsatisfied'}</span></div>
  `;
};
