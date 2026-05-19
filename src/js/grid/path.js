// ── Grid pathfinding ──
// A* over a 100×100 grid. Walls block, doors pass, objects block unless
// their ObjectDef marks them passable. _rebuildObjPassableCache is invalidated
// whenever objects change so each path query starts from a fresh map.
// isWall is the renderer/placement wall-range predicate (mirrors AppState.isWall).

Grid._rebuildObjPassableCache = function () {
    const s = AppState;
    this._objPassableCache = new Map();
    for (const obj of s.objects) {
      const def = ObjectDefs[obj.type];
      this._objPassableCache.set(obj.id, def ? !!def.passable : false);
    }
    this._objPassableCacheGen = s._nextObjId;
};

Grid._isWalkable = function (gx, gy) {
    const s = AppState;
    if (gx < 0 || gx >= s.grid.width || gy < 0 || gy >= s.grid.height) return false;
    const cell = s.getCell(gx, gy);
    if (cell === 0) return true;           // empty
    if (s.isDoor(cell)) return true;       // doors are walkable
    if (s.isWall(cell)) return false;      // walls block
    // Check if a solid object occupies this cell
    const objId = s.grid.objectGrid[gy * s.grid.width + gx];
    if (objId) {
      // Rebuild cache if objects changed
      if (this._objPassableCacheGen !== s._nextObjId) this._rebuildObjPassableCache();
      const passable = this._objPassableCache.get(objId);
      if (passable === false) return false; // solid objects block
    }
    return true;                           // floors are walkable
};

Grid.findPath = function (startX, startY, endX, endY, cellFilter) {
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    const ex = Math.floor(endX);
    const ey = Math.floor(endY);

    if (sx === ex && sy === ey) return [{ x: ex + 0.5, y: ey + 0.5 }];
    if (!this._isWalkable(ex, ey)) return null;
    if (cellFilter && !cellFilter(ex, ey, AppState.getCell(ex, ey))) return null;

    const s = AppState;
    const w = s.grid.width;
    const h = s.grid.height;
    const key = (x, y) => y * w + x;

    // A* with 4-directional movement
    const open = [];
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    const closed = new Set();

    const heuristic = (x, y) => Math.abs(x - ex) + Math.abs(y - ey);

    const startKey = key(sx, sy);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(sx, sy));
    open.push({ x: sx, y: sy, f: heuristic(sx, sy) });

    const maxIter = 2000; // cap to prevent lag
    let iter = 0;

    while (open.length > 0 && iter < maxIter) {
      iter++;
      // Find lowest f in open
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const current = open[bestIdx];
      open.splice(bestIdx, 1);

      const ck = key(current.x, current.y);
      if (current.x === ex && current.y === ey) {
        // Reconstruct path
        const path = [];
        let k = ck;
        while (k !== undefined) {
          const py = Math.floor(k / w);
          const px = k % w;
          path.unshift({ x: px + 0.5, y: py + 0.5 });
          k = cameFrom.get(k);
        }
        return path;
      }

      closed.add(ck);

      // Neighbors: 4 directions
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (!this._isWalkable(nx, ny)) continue;
        if (cellFilter && !cellFilter(nx, ny, s.getCell(nx, ny))) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;

        const tentG = (gScore.get(ck) || 0) + 1;
        if (tentG < (gScore.get(nk) ?? Infinity)) {
          cameFrom.set(nk, ck);
          gScore.set(nk, tentG);
          const f = tentG + heuristic(nx, ny);
          fScore.set(nk, f);
          if (!open.find(o => o.x === nx && o.y === ny)) {
            open.push({ x: nx, y: ny, f });
          } else {
            const existing = open.find(o => o.x === nx && o.y === ny);
            if (existing) existing.f = f;
          }
        }
      }
    }

    return null; // no path found
};

Grid.isWall = function (cellType) {
    return cellType >= 1 && cellType <= 46;
};
