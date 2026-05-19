// ── Per-frame update ──
// update() runs every frame from the main loop: syncs facility.time to the
// system clock, advances worker AI (idle wandering, walking to targets,
// sitting/working), and ticks _updateDoors for open/close animation.
// updateVisibleRoom highlights whichever room the cursor is currently over.

Grid.update = function () {
    const s = AppState;

    // Game time: 10 real seconds = 1 game minute
    // Real-time clock sync: game time = system clock
    const now = performance.now();
    const realDeltaSec = Math.min((now - (this._lastUpdateTime || now)) / 1000, 0.1);
    this._lastUpdateTime = now;

    const realNow = new Date();
    s.facility.time = realNow.getHours() * 60 + realNow.getMinutes() + realNow.getSeconds() / 60;

    // timeStep for worker movement (scale so workers move at a visible pace)
    const timeStep = realDeltaSec * 60;

    for (const w of s.workers) {
      const room = w.roomId ? s.rooms.find(r => r.id === w.roomId) : null;

      switch (w.state) {
        case 'idle': {
          // Pick a random walkable target. Operational workers stay in their
          // assigned room; unassigned workers free-roam near their current pos.
          let tx, ty;
          let attempts = 0;

          if (room) {
            // Room-assigned workers (operational): stay in their room
            do {
              tx = room.x1 + 0.5 + Math.random() * (room.x2 - room.x1);
              ty = room.y1 + 0.5 + Math.random() * (room.y2 - room.y1);
              attempts++;
            } while (!this._isWalkable(Math.floor(tx), Math.floor(ty)) && attempts < 10);
          } else {
            // No room — free roam near position
            do {
              tx = w.x + (Math.random() - 0.5) * 6;
              ty = w.y + (Math.random() - 0.5) * 6;
              tx = Math.max(0.5, Math.min(s.grid.width - 0.5, tx));
              ty = Math.max(0.5, Math.min(s.grid.height - 0.5, ty));
              attempts++;
            } while (!this._isWalkable(Math.floor(tx), Math.floor(ty)) && attempts < 10);
          }

          // Compute path via A*
          if (tx !== undefined && ty !== undefined) {
            const path = this.findPath(w.x, w.y, tx, ty);
            if (path && path.length > 1) {
              w._path = path;
              w._pathIdx = 1; // skip start node (we're already there)
              w.state = 'walking';
            } else {
              // No valid path — stay idle briefly then retry
              w._idleTimer = (w._idleTimer || 0) + timeStep;
              if (w._idleTimer > 60) {
                w._idleTimer = 0;
              }
            }
          }
          w.seatObj = null;
          break;
        }

        case 'walking': {
          if (!w._path || w._pathIdx >= w._path.length) {
            // Path complete — pause then go idle
            const pauseDuration = w._manualMove ? 600 + Math.random() * 400 : 120 + Math.random() * 200;
            w._idleTimer = (w._idleTimer || 0) + timeStep;
            if (w._idleTimer > pauseDuration) {
              w._idleTimer = 0;
              w._path = null;
              w._pathIdx = 0;
              w._manualMove = false;
              w.state = 'idle';
            }
            break;
          }

          const waypoint = w._path[w._pathIdx];
          const dx = waypoint.x - w.x;
          const dy = waypoint.y - w.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.15) {
            // Reached waypoint, advance to next
            w._pathIdx++;
          } else {
            w.x += (dx / dist) * w.speed * timeStep;
            w.y += (dy / dist) * w.speed * timeStep;
          }
          break;
        }

        case 'sitting':
        case 'working':
          if (w.seatObj) {
            w.x = w.seatObj.gx + 0.5;
            w.y = w.seatObj.gy + 0.5;
          }
          break;

      }
    }

    // Update doors (PA-style open/close)
    this._updateDoors(s, realDeltaSec);
};

Grid._updateDoors = function (s, dt) {
    const OPEN_SPEED = 4.0;   // Opens in ~0.25 sec
    const CLOSE_SPEED = 2.5;  // Closes in ~0.4 sec
    const PROXIMITY = 1.1;    // Grid cells distance to trigger open (adjacent)
    const CLOSE_DELAY = 0.6;  // Seconds after last worker leaves before closing

    // Scan all door cells that workers are near
    const activeDoors = new Set();

    // For each worker, check nearby cells for doors
    for (const w of s.workers) {
      const wcx = Math.floor(w.x);
      const wcy = Math.floor(w.y);
      // Check a small area around the worker
      for (let ox = -2; ox <= 2; ox++) {
        for (let oy = -2; oy <= 2; oy++) {
          const gx = wcx + ox;
          const gy = wcy + oy;
          if (gx < 0 || gx >= s.grid.width || gy < 0 || gy >= s.grid.height) continue;
          const cell = s.getCell(gx, gy);
          if (!s.isDoor(cell)) continue;
          // Distance check (center of cell to worker position)
          const ddx = (gx + 0.5) - w.x;
          const ddy = (gy + 0.5) - w.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dist <= PROXIMITY) {
            activeDoors.add(gx + ',' + gy);
          }
        }
      }
    }

    // Update door states
    for (const key of activeDoors) {
      if (!s._doorStates[key]) {
        s._doorStates[key] = { open: 0, closeTimer: 0 };
      }
      const ds = s._doorStates[key];
      ds.closeTimer = 0; // Reset close delay while worker is near
      // Open the door
      ds.open = Math.min(1, ds.open + OPEN_SPEED * dt);
    }

    // Close doors that have no workers nearby
    for (const key of Object.keys(s._doorStates)) {
      if (activeDoors.has(key)) continue;
      const ds = s._doorStates[key];
      if (ds.open <= 0) {
        delete s._doorStates[key]; // Clean up fully closed doors
        continue;
      }
      ds.closeTimer += dt;
      if (ds.closeTimer >= CLOSE_DELAY) {
        ds.open = Math.max(0, ds.open - CLOSE_SPEED * dt);
      }
    }
};

Grid.updateVisibleRoom = function () {
    const s = AppState;
    if (s.tools.activeCategory !== 'objects') return;

    // Find the most relevant unsatisfied room visible in the viewport
    const cw = this.canvas.width / window.devicePixelRatio;
    const ch = this.canvas.height / window.devicePixelRatio;
    const cs = s.grid.cellSize * s.camera.zoom;
    const startGX = Math.max(0, Math.floor(-s.camera.x / cs));
    const startGY = Math.max(0, Math.floor(-s.camera.y / cs));
    const endGX = Math.min(s.grid.width, Math.ceil((cw - s.camera.x) / cs));
    const endGY = Math.min(s.grid.height, Math.ceil((ch - s.camera.y) / cs));

    // Pick the unsatisfied room closest to viewport center
    const midGX = (startGX + endGX) / 2;
    const midGY = (startGY + endGY) / 2;
    let best = null;
    let bestDist = Infinity;
    for (const room of s.rooms) {
      if (room.satisfied) continue;
      if (room.x2 < startGX || room.x1 >= endGX ||
          room.y2 < startGY || room.y1 >= endGY) continue;
      const rcx = (room.x1 + room.x2) / 2;
      const rcy = (room.y1 + room.y2) / 2;
      const d = (rcx - midGX) ** 2 + (rcy - midGY) ** 2;
      if (d < bestDist) { bestDist = d; best = room; }
    }

    const visType = best ? best.type : null;
    if (visType !== s.ui.hoveredRoomType) {
      s.ui.hoveredRoomType = visType;
      Toolbar.updateRoomTab(visType);
    }
};
