// ── Save/Load serialization ──
// CONTRACT WARNING: the shape returned by serialize() is the save format on
// disk AND is read by the main process via webContents.executeJavaScript on
// window close. Don't change field names or nesting without bumping `version`
// and adding a deserialize() migration step.

AppState.serialize = function () {
  const toBase64 = (typedArr) => {
    const bytes = new Uint8Array(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    grid: {
      width: this.grid.width,
      height: this.grid.height,
      cells: toBase64(this.grid.cells),
      rotations: toBase64(this.grid.rotations),
      objectGrid: toBase64(this.grid.objectGrid),
      floorUnder: toBase64(this.grid.floorUnder),
      roomGrid: toBase64(this.grid.roomGrid),
      utilityGrid: toBase64(this.grid.utilityGrid),
      planGrid: toBase64(this.grid.planGrid),
    },
    objects: this.objects.map(o => ({
      id: o.id, type: o.type, gx: o.gx, gy: o.gy,
      rot: o.rot, w: o.w, h: o.h,
    })),
    rooms: this.rooms.map(r => ({
      id: r.id, type: r.type, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, satisfied: r.satisfied,
    })),
    workers: this.workers.map(w => ({
      id: w.id, type: w.type, name: w.name, roomId: w.roomId,
      x: w.x, y: w.y, targetX: w.targetX, targetY: w.targetY,
      speed: w.speed, color: w.color, state: w.state, taskLabel: w.taskLabel,
      claimedDesk: w.claimedDesk, claimedChair: w.claimedChair,
      _idleTimer: w._idleTimer, _lastMeal: w._lastMeal,
    })),
    facility: { ...this.facility },
    counters: {
      nextObjId: this._nextObjId,
      nextRoomId: this._nextRoomId,
      nextWorkerId: this._nextWorkerId,
      workerTypeCounts: { ...this._workerTypeCounts },
    },
    pipelines: JSON.parse(JSON.stringify(this.pipelines || {})),
    roomPipelines: JSON.parse(JSON.stringify(this.roomPipelines || {})),
    doorStates: { ...this._doorStates },
    camera: { x: this.camera.x, y: this.camera.y, zoom: this.camera.zoom },
    customWorkerTypes: JSON.parse(JSON.stringify(this.customWorkerTypes || {})),
  };
};

AppState.deserialize = function (data) {
  const fromBase64Uint8 = (b64, size) => {
    const binary = atob(b64);
    const arr = new Uint8Array(size);
    for (let i = 0; i < Math.min(binary.length, size); i++) arr[i] = binary.charCodeAt(i);
    return arr;
  };
  const fromBase64Uint16 = (b64, size) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Uint16Array(bytes.buffer, 0, size);
  };

  const g = data.grid;
  const totalCells = g.width * g.height;
  this.grid.width = g.width;
  this.grid.height = g.height;
  this.grid.cells = fromBase64Uint8(g.cells, totalCells);
  this.grid.rotations = fromBase64Uint8(g.rotations, totalCells);
  this.grid.objectGrid = fromBase64Uint16(g.objectGrid, totalCells);
  this.grid.floorUnder = fromBase64Uint8(g.floorUnder, totalCells);
  this.grid.roomGrid = fromBase64Uint16(g.roomGrid, totalCells);
  this.grid.utilityGrid = fromBase64Uint8(g.utilityGrid, totalCells);
  this.grid.planGrid = g.planGrid ? fromBase64Uint8(g.planGrid, totalCells) : new Uint8Array(totalCells);

  this.objects = data.objects || [];
  // Migration: remove deprecated 'light' objects from old saves
  const removedIds = new Set();
  this.objects = this.objects.filter(obj => {
    if (obj.type === 'light') { removedIds.add(obj.id); return false; }
    return true;
  });
  if (removedIds.size > 0) {
    // Clear objectGrid entries for removed lights
    const og = this.grid.objectGrid;
    for (let i = 0; i < og.length; i++) {
      if (removedIds.has(og[i])) og[i] = 0;
    }
  }
  this.rooms = data.rooms || [];
  this.workers = (data.workers || []).map(w => ({
    ...w, _path: null, _pathIdx: 0, seatObj: null,
  }));

  if (data.facility) Object.assign(this.facility, data.facility);

  const c = data.counters || {};
  this._nextObjId = c.nextObjId || 1;
  this._nextRoomId = c.nextRoomId || 1;
  this._nextWorkerId = c.nextWorkerId || 1;
  this._workerTypeCounts = c.workerTypeCounts || {};

  this.pipelines = data.pipelines || {};
  this.roomPipelines = data.roomPipelines || {};
  this._doorStates = data.doorStates || {};
  this.customWorkerTypes = data.customWorkerTypes || {};

  if (data.camera) {
    this.camera.x = data.camera.x;
    this.camera.y = data.camera.y;
    this.camera.zoom = data.camera.zoom;
  }
};
