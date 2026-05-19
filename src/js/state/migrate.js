// ── Save-data migration / normalization ──
// Runs at the tail of AppState.init() to keep the live state coherent with
// the current ObjectDefs / RoomDefs / WorkerTypes after refactors. Safe to
// run multiple times — all three are idempotent.

// Recompute every object's w/h from its current ObjectDef (respecting rotation)
// and re-claim the objectGrid. Also drops any object whose type was removed from
// ObjectDefs since the save was created.
AppState._normalizeObjectFootprints = function () {
  if (!this.objects || !this.objects.length) return;
  // Clear the entire objectGrid so we re-claim cleanly
  if (this.grid && this.grid.objectGrid) {
    this.grid.objectGrid.fill(0);
  }
  let fixed = 0;
  let dropped = 0;
  const keep = [];
  for (const obj of this.objects) {
    const def = ObjectDefs[obj.type];
    if (!def) { dropped++; continue; }  // type no longer exists — drop the object
    const rot = obj.rot || 0;
    const expectedW = rot % 2 === 0 ? def.w : def.h;
    const expectedH = rot % 2 === 0 ? def.h : def.w;
    if (obj.w !== expectedW || obj.h !== expectedH) {
      obj.w = expectedW;
      obj.h = expectedH;
      fixed++;
    }
    this._claimObjectCells(obj);
    keep.push(obj);
  }
  this.objects = keep;
  if (fixed > 0) console.log(`[normalize] Updated footprint of ${fixed} object(s) to match ObjectDefs`);
  if (dropped > 0) console.log(`[normalize] Dropped ${dropped} object(s) with removed types`);
};

// Drop workers whose type was removed from WorkerTypes, and rooms whose type
// was removed from RoomDefs. Keeps the world coherent after a refactor.
AppState._normalizeWorkersAndRooms = function () {
  if (Array.isArray(this.workers)) {
    const before = this.workers.length;
    this.workers = this.workers.filter(w => WorkerTypes[w.type]);
    const dropped = before - this.workers.length;
    if (dropped > 0) console.log(`[normalize] Dropped ${dropped} worker(s) with removed types`);
  }
  if (Array.isArray(this.rooms)) {
    const before = this.rooms.length;
    this.rooms = this.rooms.filter(r => RoomDefs[r.type]);
    const dropped = before - this.rooms.length;
    if (dropped > 0) {
      // Rebuild roomGrid since some rooms were removed
      if (this.grid && this.grid.roomGrid) this.grid.roomGrid.fill(0);
      if (typeof this.recheckAllRooms === 'function') this.recheckAllRooms();
      console.log(`[normalize] Dropped ${dropped} room(s) with removed types`);
    }
  }
};

// Drop pipeline entries whose owning object or room no longer exists,
// and prune dangling deskOrder entries.
AppState._normalizePipelines = function () {
  const objIds = new Set((this.objects || []).map(o => String(o.id)));
  const roomIds = new Set((this.rooms || []).map(r => String(r.id)));
  let dropped = 0;
  if (this.pipelines) {
    for (const key of Object.keys(this.pipelines)) {
      if (!objIds.has(String(key))) { delete this.pipelines[key]; dropped++; }
    }
  }
  if (this.roomPipelines) {
    for (const key of Object.keys(this.roomPipelines)) {
      if (!roomIds.has(String(key))) { delete this.roomPipelines[key]; dropped++; }
      else {
        // One-time cleanup: deskOrder used to be auto-populated when the room
        // config opened, which made the orange chain arrow appear unbidden.
        // Auto-add is removed; reset any pre-existing chains so the visual goes
        // away. Chaining will become opt-in once an "add to chain" UI exists.
        const rp = this.roomPipelines[key];
        if (rp && Array.isArray(rp.deskOrder) && rp.deskOrder.length > 0) {
          dropped += rp.deskOrder.length;
          rp.deskOrder = [];
        }
      }
    }
  }
  if (dropped > 0) console.log(`[normalize] Dropped ${dropped} stale pipeline entr(ies)`);
};
