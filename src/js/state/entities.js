// ── Entity management ──
// Object, room, worker, and pipeline management methods on AppState.
// These all cross-reference (rooms enclose objects, workers claim desks,
// pipelines belong to desks/rooms) so they live together for now.

// ─────────────────────────────────────────────────────────────
// Objects
// ─────────────────────────────────────────────────────────────

AppState.getObjectAt = function (gx, gy) {
  if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return null;
  const id = this.grid.objectGrid[gy * this.grid.width + gx];
  if (!id) return null;
  return this.objects.find(o => o.id === id) || null;
};

AppState.addObject = function (type, gx, gy, rot) {
  const def = ObjectDefs[type];
  if (!def) return null;
  const ow = rot % 2 === 0 ? def.w : def.h;
  const oh = rot % 2 === 0 ? def.h : def.w;
  for (let ox = 0; ox < ow; ox++) {
    for (let oy = 0; oy < oh; oy++) {
      const cx = gx + ox, cy = gy + oy;
      if (cx < 0 || cx >= this.grid.width || cy < 0 || cy >= this.grid.height) return null;
      const existing = this.grid.objectGrid[cy * this.grid.width + cx];
      if (existing) {
        // Allow placing under ceiling lights (passable + lightRadius)
        const exObj = this.objects.find(o => o.id === existing);
        const exDef = exObj ? ObjectDefs[exObj.type] : null;
        if (!exDef || !exDef.lightRadius || !exDef.passable) return null;
      }
      const isWall = this.isWall(this.getCell(cx, cy));
      if (def.wallMount ? !isWall : isWall) return null;
    }
  }
  const obj = { id: this._nextObjId++, type, gx, gy, rot, w: ow, h: oh };
  this.objects.push(obj);
  for (let ox = 0; ox < ow; ox++) {
    for (let oy = 0; oy < oh; oy++) {
      this.grid.objectGrid[(gy + oy) * this.grid.width + (gx + ox)] = obj.id;
    }
  }
  return obj;
};

AppState.moveObject = function (objId, newGx, newGy) {
  const obj = this.objects.find(o => o.id === objId);
  if (!obj) return false;
  const def = ObjectDefs[obj.type];
  if (!def) return false;
  // Clear old grid cells
  for (let ox = 0; ox < obj.w; ox++) {
    for (let oy = 0; oy < obj.h; oy++) {
      const cx = obj.gx + ox, cy = obj.gy + oy;
      if (cx >= 0 && cx < this.grid.width && cy >= 0 && cy < this.grid.height) {
        this.grid.objectGrid[cy * this.grid.width + cx] = 0;
      }
    }
  }
  // Check new position is valid
  for (let ox = 0; ox < obj.w; ox++) {
    for (let oy = 0; oy < obj.h; oy++) {
      const cx = newGx + ox, cy = newGy + oy;
      if (cx < 0 || cx >= this.grid.width || cy < 0 || cy >= this.grid.height) {
        // Restore old grid cells and abort
        this._claimObjectCells(obj);
        return false;
      }
      if (this.grid.objectGrid[cy * this.grid.width + cx]) {
        this._claimObjectCells(obj);
        return false;
      }
      const isWall = this.isWall(this.getCell(cx, cy));
      if (def.wallMount ? !isWall : isWall) {
        this._claimObjectCells(obj);
        return false;
      }
    }
  }
  // Apply move
  obj.gx = newGx;
  obj.gy = newGy;
  this._claimObjectCells(obj);
  this.recheckAllRooms();
  return true;
};

AppState.rotateObject = function (objId) {
  const obj = this.objects.find(o => o.id === objId);
  if (!obj) return false;
  const def = ObjectDefs[obj.type];
  if (!def) return false;
  // PA-style: symmetric objects and wallMount objects don't manually rotate
  if (def.noRotate || def.wallMount) return false;
  const newRot = (obj.rot + 1) % 4;
  const nw = newRot % 2 === 0 ? def.w : def.h;
  const nh = newRot % 2 === 0 ? def.h : def.w;
  // Clear old grid cells
  for (let ox = 0; ox < obj.w; ox++) {
    for (let oy = 0; oy < obj.h; oy++) {
      const cx = obj.gx + ox, cy = obj.gy + oy;
      if (cx >= 0 && cx < this.grid.width && cy >= 0 && cy < this.grid.height) {
        this.grid.objectGrid[cy * this.grid.width + cx] = 0;
      }
    }
  }
  // Check new footprint fits
  for (let ox = 0; ox < nw; ox++) {
    for (let oy = 0; oy < nh; oy++) {
      const cx = obj.gx + ox, cy = obj.gy + oy;
      if (cx < 0 || cx >= this.grid.width || cy < 0 || cy >= this.grid.height) {
        this._claimObjectCells(obj);
        return false;
      }
      if (this.grid.objectGrid[cy * this.grid.width + cx]) {
        this._claimObjectCells(obj);
        return false;
      }
      const isWall = this.isWall(this.getCell(cx, cy));
      if (def.wallMount ? !isWall : isWall) {
        this._claimObjectCells(obj);
        return false;
      }
    }
  }
  // Apply rotation
  obj.rot = newRot;
  obj.w = nw;
  obj.h = nh;
  this._claimObjectCells(obj);
  return true;
};

AppState._claimObjectCells = function (obj) {
  for (let ox = 0; ox < obj.w; ox++) {
    for (let oy = 0; oy < obj.h; oy++) {
      const cx = obj.gx + ox, cy = obj.gy + oy;
      if (cx >= 0 && cx < this.grid.width && cy >= 0 && cy < this.grid.height) {
        this.grid.objectGrid[cy * this.grid.width + cx] = obj.id;
      }
    }
  }
};

AppState.removeObject = function (objId) {
  const idx = this.objects.findIndex(o => o.id === objId);
  if (idx === -1) return;
  const obj = this.objects[idx];
  for (let ox = 0; ox < obj.w; ox++) {
    for (let oy = 0; oy < obj.h; oy++) {
      const cx = obj.gx + ox, cy = obj.gy + oy;
      if (cx >= 0 && cx < this.grid.width && cy >= 0 && cy < this.grid.height) {
        this.grid.objectGrid[cy * this.grid.width + cx] = 0;
      }
    }
  }
  this.objects.splice(idx, 1);
  this.removeDeskPipeline(objId);
  this.releaseWorkersFromObject(objId);
};

// ─────────────────────────────────────────────────────────────
// Rooms
// ─────────────────────────────────────────────────────────────

AppState.addRoom = function (type, x1, y1, x2, y2) {
  const def = RoomDefs[type];
  if (!def) return null;
  const w = x2 - x1 + 1;
  const h = y2 - y1 + 1;
  if (w < def.minW || h < def.minH) return null;

  // Rooms can only be designated over indoor floor — reject if any cell is a wall or empty
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      const cell = this.getCell(x, y);
      if (cell === CT.EMPTY || this.isWall(cell)) return null;
    }
  }

  const room = {
    id: this._nextRoomId++,
    type, x1, y1, x2, y2,
    satisfied: false,
  };
  this.rooms.push(room);

  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      this.grid.roomGrid[y * this.grid.width + x] = room.id;
    }
  }

  this.checkRoomRequirements(room);
  return room;
};

AppState.removeRoom = function (roomId) {
  const idx = this.rooms.findIndex(r => r.id === roomId);
  if (idx === -1) return;
  const room = this.rooms[idx];
  this.removeWorkersInRoom(roomId);
  delete this.roomPipelines[roomId];
  for (let x = room.x1; x <= room.x2; x++) {
    for (let y = room.y1; y <= room.y2; y++) {
      if (this.grid.roomGrid[y * this.grid.width + x] === roomId) {
        this.grid.roomGrid[y * this.grid.width + x] = 0;
      }
    }
  }
  this.rooms.splice(idx, 1);
};

AppState.getRoomAt = function (gx, gy) {
  if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return null;
  const id = this.grid.roomGrid[gy * this.grid.width + gx];
  if (!id) return null;
  return this.rooms.find(r => r.id === id) || null;
};

AppState.checkRoomRequirements = function (room) {
  const def = RoomDefs[room.type];
  if (!def) { room.satisfied = false; return; }

  const counts = {};
  for (const obj of this.objects) {
    // Check if object overlaps with room area
    if (obj.gx + obj.w > room.x1 && obj.gx <= room.x2 &&
        obj.gy + obj.h > room.y1 && obj.gy <= room.y2) {
      counts[obj.type] = (counts[obj.type] || 0) + 1;
    }
  }

  room.satisfied = def.requires.every(req => {
    // For chair requirement, accept any chair type
    if (req.type === 'chair') {
      let total = 0;
      for (const ct of CHAIR_TYPES) total += (counts[ct] || 0);
      return total >= req.count;
    }
    // For desk requirement, accept any desk type
    if (req.type === 'work_pc') {
      let total = 0;
      for (const dt of DESK_TYPES) total += (counts[dt] || 0);
      return total >= req.count;
    }
    return (counts[req.type] || 0) >= req.count;
  });
};

AppState.recheckAllRooms = function () {
  for (const room of this.rooms) {
    this.checkRoomRequirements(room);
  }
};

// ─────────────────────────────────────────────────────────────
// Workers
// ─────────────────────────────────────────────────────────────

// Find an unclaimed desk+chair pair in a room (for operational workers)
AppState.findFreeDeskInRoom = function (roomId) {
  const room = this.rooms.find(r => r.id === roomId);
  if (!room) return null;
  // Get all claimed desk IDs
  const claimedDesks = new Set(this.workers.filter(w => w.claimedDesk).map(w => w.claimedDesk));
  // Find desks in this room
  for (const obj of this.objects) {
    if (!DESK_TYPES.has(obj.type)) continue;
    if (obj.gx < room.x1 || obj.gx > room.x2 || obj.gy < room.y1 || obj.gy > room.y2) continue;
    if (claimedDesks.has(obj.id)) continue;
    // Check for a chair adjacent to this desk
    const chairNear = this._findChairNearDesk(obj, room);
    if (chairNear) return { desk: obj, chair: chairNear };
  }
  return null;
};

AppState._findChairNearDesk = function (desk, room) {
  // Search 1-cell radius around the desk for a chair
  for (let dx = -1; dx <= desk.w; dx++) {
    for (let dy = -1; dy <= desk.h; dy++) {
      const cx = desk.gx + dx, cy = desk.gy + dy;
      if (cx < room.x1 || cx > room.x2 || cy < room.y1 || cy > room.y2) continue;
      const obj = this.getObjectAt(cx, cy);
      if (obj && CHAIR_TYPES.has(obj.type) && obj.id !== desk.id) return obj;
    }
  }
  return null;
};

// Count available desk+chair slots in a room
AppState.countFreeDesks = function (roomId) {
  const room = this.rooms.find(r => r.id === roomId);
  if (!room) return 0;
  const claimedDesks = new Set(this.workers.filter(w => w.claimedDesk).map(w => w.claimedDesk));
  let count = 0;
  for (const obj of this.objects) {
    if (!DESK_TYPES.has(obj.type)) continue;
    if (obj.gx < room.x1 || obj.gx > room.x2 || obj.gy < room.y1 || obj.gy > room.y2) continue;
    if (claimedDesks.has(obj.id)) continue;
    if (this._findChairNearDesk(obj, room)) count++;
  }
  return count;
};

AppState.spawnWorker = function (type, gx, gy) {
  const wt = WorkerTypes[type];
  if (!wt) return null;

  // Find which room the spawn point is in (if any)
  const room = this.getRoomAt(gx, gy);
  const roomId = room ? room.id : null;

  let claimedDesk = null;
  let claimedChair = null;

  // Operational workers need a free desk+chair — look in same room if available
  if (wt.role === 'operational' && room) {
    const pair = this.findFreeDeskInRoom(room.id);
    if (pair) {
      claimedDesk = pair.desk.id;
      claimedChair = pair.chair.id;
    }
  }

  this._workerTypeCounts[type] = (this._workerTypeCounts[type] || 0) + 1;
  const nameList = wt.gender === 'female' ? WorkerNamesFemale : WorkerNamesMale;
  const randomName = nameList[Math.floor(Math.random() * nameList.length)];

  const worker = {
    id: this._nextWorkerId++,
    type,
    name: randomName,
    roomId,
    x: gx + 0.5,
    y: gy + 0.5,
    targetX: 0,
    targetY: 0,
    speed: 0.03,
    color: wt.color,
    state: 'idle',
    taskLabel: null,
    seatObj: null,
    _path: null,       // A* path waypoints
    _pathIdx: 0,       // current waypoint index
    claimedDesk,    // object ID of permanently assigned desk (operational only)
    claimedChair,   // object ID of paired chair
    _idleTimer: 0,
    _lastMeal: 0,      // game-time of last meal (legacy field, kept for save compat)
  };
  worker.targetX = worker.x;
  worker.targetY = worker.y;
  this.workers.push(worker);
  if (typeof Reports !== 'undefined') {
    const deskNote = claimedDesk ? ' (Desk claimed)' : '';
    Reports.log('worker', `Hired ${worker.name} (${wt.name})${deskNote}`);
  }
  return worker;
};

AppState.removeWorker = function (workerId) {
  const w = this.workers.find(w => w.id === workerId);
  if (w && typeof Reports !== 'undefined') Reports.log('worker', `Dismissed ${w.name}`);
  const idx = this.workers.findIndex(w => w.id === workerId);
  if (idx !== -1) this.workers.splice(idx, 1);
};

// Release any worker whose claimed desk/chair was removed
AppState.releaseWorkersFromObject = function (objId) {
  for (const w of this.workers) {
    if (w.claimedDesk === objId || w.claimedChair === objId) {
      if (typeof Reports !== 'undefined') Reports.log('worker', `${w.name}'s desk was removed — dismissed`, 'warn');
      w.claimedDesk = null;
      w.claimedChair = null;
      // Try to find another free desk in the same room
      const pair = this.findFreeDeskInRoom(w.roomId);
      if (pair) {
        w.claimedDesk = pair.desk.id;
        w.claimedChair = pair.chair.id;
        if (typeof Reports !== 'undefined') Reports.log('worker', `${w.name} reassigned to another desk`);
      } else {
        // No desk available — dismiss worker
        this.removeWorker(w.id);
      }
    }
  }
};

AppState.removeWorkersInRoom = function (roomId) {
  this.workers = this.workers.filter(w => w.roomId !== roomId);
};

AppState.getWorkersInRoom = function (roomId) {
  return this.workers.filter(w => w.roomId === roomId);
};

AppState.getWorkerAt = function (gx, gy) {
  let closest = null;
  let closestDist = 0.8; // detection radius in grid units
  for (const w of this.workers) {
    const dx = w.x - gx;
    const dy = w.y - gy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = w;
    }
  }
  return closest;
};

// ─────────────────────────────────────────────────────────────
// Pipelines
// ─────────────────────────────────────────────────────────────

AppState.getDeskPipeline = function (objId) {
  if (!this.pipelines[objId]) {
    this.pipelines[objId] = { nodes: [], connections: [], nextNodeId: 1 };
  }
  return this.pipelines[objId];
};

AppState.setDeskPipeline = function (objId, pipeline) {
  this.pipelines[objId] = pipeline;
};

AppState.removeDeskPipeline = function (objId) {
  delete this.pipelines[objId];
};

AppState.getRoomPipeline = function (roomId) {
  if (!this.roomPipelines[roomId]) {
    this.roomPipelines[roomId] = { deskOrder: [] };
  }
  return this.roomPipelines[roomId];
};

AppState.setRoomDeskOrder = function (roomId, order) {
  if (!this.roomPipelines[roomId]) {
    this.roomPipelines[roomId] = { deskOrder: [] };
  }
  this.roomPipelines[roomId].deskOrder = order;
};
