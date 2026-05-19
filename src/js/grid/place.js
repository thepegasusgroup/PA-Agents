// ── Grid placement engine ──
// commitPlacement is the end-of-drag commit: foundations, walls, floors, doors,
// objects, rooms, utilities, and clone stamps all route through here based on
// the active toolbar item. _autoOrientWallMount picks a rotation for objects
// like windows so they face the adjacent wall. _saveDoorFloor preserves the
// floor type underneath a door so removing the door reveals the original floor.

Grid.commitPlacement = function () {
    const s = AppState;
    const item = s.tools.activeItem;
    if (!item) return;

    const x1 = Math.min(s.tools.placeStart.x, s.tools.placeEnd.x);
    const y1 = Math.min(s.tools.placeStart.y, s.tools.placeEnd.y);
    let x2 = Math.max(s.tools.placeStart.x, s.tools.placeEnd.x);
    let y2 = Math.max(s.tools.placeStart.y, s.tools.placeEnd.y);

    let totalCost = 0;

    // ── Planning mode placement ──
    if (item.planMode) {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          s.setPlanCell(x, y, item.cell);
        }
      }
      return;
    }
    if (item.planDemolish) {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          s.setPlanCell(x, y, 0);
        }
      }
      return;
    }

    if (item.mode === 'foundation') {
      const wallType = s.tools.foundationWall;
      const fData = ToolbarData.foundations;
      if (!wallType) return;

      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          if (x === x1 || x === x2 || y === y1 || y === y2) {
            s.setCell(x, y, wallType.cell);
            totalCost += wallType.cost || 0;
          } else {
            s.setCell(x, y, fData.floorCell);
            totalCost += fData.floorCost || 0;
          }
        }
      }
    } else if (item.id === 'bulldoze' || s.tools.activeCategory === 'demolish') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.GRASS);
            s.setFloorUnder(x, y, 0);
          } else {
            s.setCell(x, y, CT.GRASS);
          }
        }
      }
    } else if (item.id === 'demolish_walls') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.GRASS);
            s.setFloorUnder(x, y, 0);
          } else if (this.isWall(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.CONCRETE_FLOOR);
            s.setFloorUnder(x, y, 0);
          }
        }
      }
    } else if (item.id === 'clear_indoor') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (cell !== CT.EMPTY && !this.isWall(cell)) {
            s.setCell(x, y, CT.GRASS);
          }
        }
      }
    } else if (item.demolishAction === 'walls') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.GRASS);
            s.setFloorUnder(x, y, 0);
          } else if (this.isWall(cell) && !s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.CONCRETE_FLOOR);
            s.setFloorUnder(x, y, 0);
          }
        }
      }
    } else if (item.demolishAction === 'doors') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.GRASS);
            s.setFloorUnder(x, y, 0);
          }
        }
      }
    } else if (item.demolishAction === 'floors') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (cell !== CT.EMPTY && !this.isWall(cell) && !s.isDoor(cell)) {
            s.setCell(x, y, CT.GRASS);
          }
        }
      }
    } else if (item.objectAction === 'remove') {
      const removedObjs = new Set();
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const obj = s.getObjectAt(x, y);
          if (obj && !removedObjs.has(obj.id)) {
            removedObjs.add(obj.id);
            s.removeObject(obj.id);
          }
        }
      }
      s.recheckAllRooms();
    } else if (item.roomType) {
      s.addRoom(item.roomType, x1, y1, x2, y2);
    } else if (item.cell !== undefined) {
      const rot = s.tools.placeRotation;
      const placingDoor = s.isDoor(item.cell);
      if (item.pairCell) {
        let vertical = rot % 2 === 1;
        if (item.placeWidth && rot === 0) {
          const hasNS = this.isWall(s.getCell(x1, y1 - 1)) || this.isWall(s.getCell(x1, y1 + 1));
          const hasEW = this.isWall(s.getCell(x1 - 1, y1)) || this.isWall(s.getCell(x1 + 1, y1));
          if (hasNS && !hasEW) vertical = true;
        }
        if (vertical) {
          if (y2 === y1) y2 = Math.min(y1 + 1, s.grid.height - 1);
          for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
              if (placingDoor) this._saveDoorFloor(s, x, y);
              s.setCell(x, y, (y - y1) % 2 === 0 ? item.cell : item.pairCell);
              s.setRotation(x, y, rot);
            }
          }
        } else {
          if (x2 === x1) x2 = Math.min(x1 + 1, s.grid.width - 1);
          for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
              if (placingDoor) this._saveDoorFloor(s, x, y);
              s.setCell(x, y, (x - x1) % 2 === 0 ? item.cell : item.pairCell);
              s.setRotation(x, y, rot);
            }
          }
        }
      } else {
        // For rectangular drags (width > 1 AND height > 1), only place walls
        // on the border — like PA. Floors fill the entire rectangle.
        const isWallType = this.isWall(item.cell);
        const isFloorType = !isWallType && !placingDoor;
        const rectDrag = isWallType && (x2 - x1 >= 1) && (y2 - y1 >= 1);
        for (let x = x1; x <= x2; x++) {
          for (let y = y1; y <= y2; y++) {
            if (rectDrag && x !== x1 && x !== x2 && y !== y1 && y !== y2) continue;
            // When placing floors, don't overwrite walls or doors
            if (isFloorType) {
              const existing = s.getCell(x, y);
              if (this.isWall(existing) || s.isDoor(existing)) continue;
            }
            if (placingDoor) this._saveDoorFloor(s, x, y);
            s.setCell(x, y, item.cell);
            s.setRotation(x, y, rot);
          }
        }
      }
    }

    s.facility.cash -= totalCost;
};

Grid._autoOrientWallMount = function (gx, gy) {
    const s = AppState;
    const n = s.getCell(gx, gy - 1);
    const south = s.getCell(gx, gy + 1);
    const w = s.getCell(gx - 1, gy);
    const e = s.getCell(gx + 1, gy);
    const nWall = this.isWall(n);
    const sWall = this.isWall(south);
    const wWall = this.isWall(w);
    const eWall = this.isWall(e);
    // Count non-wall neighbors — object faces toward the open side
    // If wall is to the north → face south (rot=0)
    // If wall is to the south → face north (rot=2)
    // If wall is to the west → face east (rot=3)
    // If wall is to the east → face west (rot=1)
    // Prefer: south-facing > east > west > north (most common room layouts)
    if (nWall && !sWall) return 0;  // wall above → face south
    if (sWall && !nWall) return 2;  // wall below → face north
    if (wWall && !eWall) return 3;  // wall left  → face east
    if (eWall && !wWall) return 1;  // wall right → face west
    // Corner or isolated: default to south
    return 0;
};

Grid._saveDoorFloor = function (s, x, y) {
    const existing = s.getCell(x, y);
    if (s.isDoor(existing)) {
      // keep the already-saved floor
    } else if (existing !== CT.EMPTY && !s.isWall(existing)) {
      s.setFloorUnder(x, y, existing);
    } else {
      s.setFloorUnder(x, y, CT.CONCRETE_FLOOR);
    }
};
