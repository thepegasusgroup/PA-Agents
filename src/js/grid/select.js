// ── Grid object selection ──
// Right-click context menu for objects, plus the move-mode "pick up" /
// "drop" lifecycle. Attaches to Grid (declared in grid.js).
// State fields read/written: _selectedObjId, _objMoveMode, _objOriginal
// (declared in grid.js), _activeMenuObjId (private to this module).

Grid.showObjectActionsMenu = function (obj, mx, my) {
  const menu = document.getElementById('objectActionsMenu');
  if (!menu) return;
  const def = ObjectDefs[obj.type] || {};
  const isConfigurable = DESK_TYPES.has(obj.type) && typeof Pipeline !== 'undefined';

  // Title shows object name
  const titleEl = menu.querySelector('.context-menu-title');
  if (titleEl) titleEl.textContent = def.name || obj.type;

  // Configure: enabled for desks/PCs, hidden/disabled otherwise
  const cfg = menu.querySelector('[data-action="configure"]');
  if (cfg) cfg.style.display = isConfigurable ? '' : 'none';

  // Position menu near click without going off-screen
  menu.classList.remove('hidden');
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  const left = Math.min(mx + 8, window.innerWidth - mw - 8);
  const top  = Math.min(my + 8, window.innerHeight - mh - 8);
  menu.style.left = left + 'px';
  menu.style.top  = top + 'px';

  this._activeMenuObjId = obj.id;
};

Grid.hideObjectActionsMenu = function () {
  const menu = document.getElementById('objectActionsMenu');
  if (menu) menu.classList.add('hidden');
  this._activeMenuObjId = null;
};

Grid._onObjectActionsMenuClick = function (action) {
  const objId = this._activeMenuObjId;
  if (!objId) { this.hideObjectActionsMenu(); return; }
  const obj = AppState.objects.find(o => o.id === objId);
  if (!obj) { this.hideObjectActionsMenu(); return; }

  switch (action) {
    case 'configure':
      this.hideObjectActionsMenu();
      if (typeof Pipeline !== 'undefined' && DESK_TYPES.has(obj.type)) {
        this.deselectObject();
        Pipeline.openDeskEditor(obj.id);
      }
      break;
    case 'move':
      this.hideObjectActionsMenu();
      // Enter move mode — same path as double-click
      this._selectedObjId = obj.id;
      this._objOriginal = { gx: obj.gx, gy: obj.gy, rot: obj.rot, w: obj.w, h: obj.h };
      this._objMoveMode = true;
      // Clear current grid cells so the object can be repositioned freely
      for (let ox = 0; ox < obj.w; ox++)
        for (let oy = 0; oy < obj.h; oy++) {
          const cx = obj.gx + ox, cy = obj.gy + oy;
          if (cx >= 0 && cx < AppState.grid.width && cy >= 0 && cy < AppState.grid.height)
            AppState.grid.objectGrid[cy * AppState.grid.width + cx] = 0;
        }
      break;
    case 'remove':
      this.hideObjectActionsMenu();
      AppState.removeObject(obj.id);
      AppState.recheckAllRooms();
      this.deselectObject();
      break;
    case 'close':
    default:
      this.hideObjectActionsMenu();
      this.deselectObject();
      break;
  }
};

// ── Object "pick up" / "drop" lifecycle (used by double-click handler) ──

Grid.selectObject = function (objId) {
  this._selectedObjId = objId;
  this._objMoveMode = true;
  // Save original state for cancel/revert and clear grid cells (object is "held")
  const obj = AppState.objects.find(o => o.id === objId);
  if (obj) {
    this._objOriginal = { gx: obj.gx, gy: obj.gy, rot: obj.rot, w: obj.w, h: obj.h };
    // Clear grid cells — object is "picked up"
    for (let ox = 0; ox < obj.w; ox++)
      for (let oy = 0; oy < obj.h; oy++) {
        const cx = obj.gx + ox, cy = obj.gy + oy;
        if (cx >= 0 && cx < AppState.grid.width && cy >= 0 && cy < AppState.grid.height)
          AppState.grid.objectGrid[cy * AppState.grid.width + cx] = 0;
      }
  }
  this.canvas.style.cursor = 'cell';
};

Grid.deselectObject = function () {
  this._selectedObjId = null;
  this._objMoveMode = false;
  this._objOriginal = null;
  this.canvas.style.cursor = 'default';
};
