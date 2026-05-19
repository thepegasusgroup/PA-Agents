// ── Grid mouse input ──
// Down/move/up/leave plus double-click. onMouseDown is the big router:
// middle-button drag pans, right-click opens the object actions menu (via
// grid/select.js), left-click handles placement / worker box-select / desk
// move-mode drop. onMouseMove tracks the cursor cell, updates debug overlay
// (when F3 on), drives utility free-draw and worker box-drag, and keeps
// placement preview in sync. Double-click on an object enters move mode.

Grid.onDoubleClick = function (e) {
    if (e.button !== 0) return;
    const s = AppState;
    if (s.tools.activeItem) return;
    // Cancel any pending single-click action (e.g. desk pipeline open)
    if (this._clickTimer) { clearTimeout(this._clickTimer); this._clickTimer = null; }
    const rect = this.canvas.getBoundingClientRect();
    const { gx, gy } = this.screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    const obj = s.getObjectAt(gx, gy);
    if (!obj) return;
    // Double-click on any object: enter move/edit mode (pick it up)
    this._selectedWorkers = [];
    this.hideWorkerPanel();
    this.selectObject(obj.id);
};

Grid.onMouseDown = function (e) {
    if (this._autoFollow) return;
    const s = AppState;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (e.button === 1) {
      s.camera.isDragging = true;
      s.camera.dragStart = { x: mx, y: my };
      s.camera.camStart = { x: s.camera.x, y: s.camera.y };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Right-click handling, in priority order:
    //   1. If workers are selected → dispatch them to the clicked cell (RTS-style move).
    //   2. Else if the cursor is over an object → open its actions menu.
    //   3. Else no-op.
    if (e.button === 2) {
      if (this._objMoveMode) return;  // don't interrupt an in-progress move
      const { gx, gy } = this.screenToGrid(mx, my);

      if (this._selectedWorkers.length > 0) {
        this._moveSelectedWorkers(gx, gy);
        return;
      }

      const obj = s.getObjectAt(gx, gy);
      if (obj) {
        this.hideWorkerPanel();
        this.showObjectActionsMenu(obj, mx, my);
      }
      return;
    }

    // Click with no tool: check move-mode placement, worker click, object click, room click
    if (e.button === 0 && !s.tools.activeItem) {
      const { gx, gy } = this.screenToGrid(mx, my);

      // Move mode: place object at new location
      if (this._objMoveMode && this._selectedObjId) {
        const moveObj = s.objects.find(o => o.id === this._selectedObjId);
        if (moveObj) {
          const moveDef = ObjectDefs[moveObj.type];
          // Validate new position (cells already cleared on pickup)
          let canPlace = true;
          for (let ox = 0; ox < moveObj.w && canPlace; ox++) {
            for (let oy = 0; oy < moveObj.h && canPlace; oy++) {
              const cx = gx + ox, cy = gy + oy;
              if (cx < 0 || cx >= s.grid.width || cy < 0 || cy >= s.grid.height) canPlace = false;
              else if (s.grid.objectGrid[cy * s.grid.width + cx]) canPlace = false;
              else if (moveDef && !moveDef.wallMount && s.isWall(s.getCell(cx, cy))) canPlace = false;
              else if (moveDef && moveDef.wallMount && !s.isWall(s.getCell(cx, cy))) canPlace = false;
            }
          }
          if (canPlace) {
            moveObj.gx = gx;
            moveObj.gy = gy;
            s._claimObjectCells(moveObj);
            s.recheckAllRooms();
            this.deselectObject();
          }
          // If can't place, stay in move mode (user can try again or Escape to revert)
        }
        return;
      }

      // Worker click — select/deselect
      const clickedWorker = s.getWorkerAt(gx + 0.5, gy + 0.5);
      if (clickedWorker) {
        this.deselectObject();
        if (e.shiftKey) {
          const idx = this._selectedWorkers.indexOf(clickedWorker.id);
          if (idx >= 0) this._selectedWorkers.splice(idx, 1);
          else this._selectedWorkers.push(clickedWorker.id);
        } else {
          this._selectedWorkers = [clickedWorker.id];
        }
        this.showWorkerPanel(clickedWorker);
        return;
      }

      // Left-click on an object is a no-op (no highlight, no menu).
      // Right-click opens the actions menu; double-click enters move mode.
      const obj = s.getObjectAt(gx, gy);
      if (obj) {
        if (this._clickTimer) { clearTimeout(this._clickTimer); this._clickTimer = null; }
        if (this._selectedObjId === obj.id && this._objMoveMode) {
          // Already moving — let the move-mode click handler deal with it
          return;
        }
        this._selectedWorkers = [];
        this.hideWorkerPanel();
        return;
      }

      // Clicked empty space — clear selections
      this.deselectObject();
      if (!e.shiftKey && this._selectedWorkers.length > 0) {
        this._selectedWorkers = [];
        this.hideWorkerPanel();
      }
      // Start box-drag for worker selection
      this._workerDrag = { startX: gx, startY: gy, endX: gx, endY: gy, moved: false };
    }

    if (e.button === 0 && s.tools.activeItem) {
      const { gx, gy } = this.screenToGrid(mx, my);

      // Planning mode: place planned walls/doors
      if (s.tools.activeItem.planMode || s.tools.activeItem.planDemolish) {
        if (s.tools.activeItem.placeWidth) {
          // Single-cell planning (doors)
          s.tools.placeStart = { x: gx, y: gy };
          s.tools.placeEnd = { x: gx, y: gy };
          this.commitPlacement();
          s.tools.placeStart = null;
          s.tools.placeEnd = null;
        } else {
          s.tools.isPlacing = true;
          s.tools.placeStart = { x: gx, y: gy };
          s.tools.placeEnd = { x: gx, y: gy };
        }
        return;
      }

      // Utility cable/pipe free-draw placement
      if (s.tools.activeItem.utilityType !== undefined) {
        this._utilityDrawing = true;
        s.setUtility(gx, gy, s.tools.activeItem.utilityType);
        return;
      }
      // Worker placement from staff toolbar
      if (s.tools.activeItem.workerType) {
        s.spawnWorker(s.tools.activeItem.workerType, gx, gy);
        return;
      }
      if (s.tools.activeItem.roomAction === 'remove') {
        const room = s.getRoomAt(gx, gy);
        if (room) s.removeRoom(room.id);
        return;
      }
      if (s.tools.activeItem.roomType) {
        s.tools.isPlacing = true;
        s.tools.placeStart = { x: gx, y: gy };
        s.tools.placeEnd = { x: gx, y: gy };
        return;
      }
      if (s.tools.activeItem.objectType) {
        s.addObject(s.tools.activeItem.objectType, gx, gy, s.tools.placeRotation);
        s.recheckAllRooms();
      } else if (s.tools.activeItem.placeWidth) {
        s.tools.placeStart = { x: gx, y: gy };
        s.tools.placeEnd = { x: gx, y: gy };
        this.commitPlacement();
        s.tools.placeStart = null;
        s.tools.placeEnd = null;
      } else {
        s.tools.isPlacing = true;
        s.tools.placeStart = { x: gx, y: gy };
        s.tools.placeEnd = { x: gx, y: gy };
      }
    }
};

Grid.onMouseMove = function (e) {
    const s = AppState;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    this.updateEdgeScroll(mx, my);

    if (s.camera.isDragging) {
      s.camera.x = s.camera.camStart.x + (mx - s.camera.dragStart.x);
      s.camera.y = s.camera.camStart.y + (my - s.camera.dragStart.y);
      return;
    }

    if (s.tools.isPlacing) {
      const { gx, gy } = this.screenToGrid(mx, my);
      s.tools.placeEnd = { x: gx, y: gy };
    }

    // Utility free-draw: continuously place while dragging
    if (this._utilityDrawing && s.tools.activeItem && s.tools.activeItem.utilityType !== undefined) {
      const { gx, gy } = this.screenToGrid(mx, my);
      s.setUtility(gx, gy, s.tools.activeItem.utilityType);
    }

    if (this._rightDrag) {
      const { gx, gy } = this.screenToGrid(mx, my);
      if (gx !== this._rightDrag.startX || gy !== this._rightDrag.startY) {
        this._rightDrag.moved = true;
      }
      this._rightDrag.endX = gx;
      this._rightDrag.endY = gy;
      // Clone mode: erase plan cells as we drag
      if (this._cloneMode && !this._cloneData) {
        AppState.setPlanCell(gx, gy, 0);
      }
    }

    // Worker box-select drag
    if (this._workerDrag) {
      const { gx, gy } = this.screenToGrid(mx, my);
      if (gx !== this._workerDrag.startX || gy !== this._workerDrag.startY) {
        this._workerDrag.moved = true;
      }
      this._workerDrag.endX = gx;
      this._workerDrag.endY = gy;
    }

    this._mouseGrid = this.screenToGrid(mx, my);

    // wallMount auto-orient: detect adjacent wall and face away from it
    if (s.tools.activeItem && s.tools.activeItem.objectType) {
      const aoDef = ObjectDefs[s.tools.activeItem.objectType];
      if (aoDef && aoDef.wallMount) {
        s.tools.placeRotation = this._autoOrientWallMount(this._mouseGrid.gx, this._mouseGrid.gy);
      }
    }

    // Debug overlay: show object info on hover
    if (this._debugMode) this._updateDebugOverlay(mx, my);
};

Grid._findObjectAt = function (gx, gy) {
    const s = AppState;
    if (gx < 0 || gy < 0 || gx >= s.grid.width || gy >= s.grid.height) return null;
    const objId = s.grid.objectGrid[gy * s.grid.width + gx];
    if (objId) return s.objects.find(o => o.id === objId) || null;
    return null;
};

Grid.onMouseUp = function (e) {
    const s = AppState;

    // Stop utility free-draw
    if (this._utilityDrawing) {
      this._utilityDrawing = false;
    }

    if (s.camera.isDragging) {
      s.camera.isDragging = false;
      this.canvas.style.cursor = s.tools.activeItem ? 'crosshair' : 'default';
      return;
    }

    // Worker box-select complete
    if (e.button === 0 && this._workerDrag) {
      if (this._workerDrag.moved) {
        const x1 = Math.min(this._workerDrag.startX, this._workerDrag.endX);
        const y1 = Math.min(this._workerDrag.startY, this._workerDrag.endY);
        const x2 = Math.max(this._workerDrag.startX, this._workerDrag.endX) + 1;
        const y2 = Math.max(this._workerDrag.startY, this._workerDrag.endY) + 1;
        // Find all workers within the box
        const selected = s.workers.filter(w =>
          w.x >= x1 && w.x <= x2 && w.y >= y1 && w.y <= y2
        );
        if (selected.length > 0) {
          if (e.shiftKey) {
            // Add to existing selection
            for (const w of selected) {
              if (!this._selectedWorkers.includes(w.id)) {
                this._selectedWorkers.push(w.id);
              }
            }
          } else {
            this._selectedWorkers = selected.map(w => w.id);
          }
          // Show panel for first selected worker
          this.showWorkerPanel(selected[0]);
        }
      }
      this._workerDrag = null;
      return;
    }

    // Right-click no longer has any release behavior — all right-button actions removed.
    if (e.button === 2) return;

    if (s.tools.isPlacing && s.tools.placeStart && s.tools.placeEnd) {
      this.commitPlacement();
      s.tools.isPlacing = false;
      s.tools.placeStart = null;
      s.tools.placeEnd = null;
    }
};

Grid.onMouseLeave = function (e) {
    const s = AppState;
    s.camera.edgeScroll.x = 0;
    s.camera.edgeScroll.y = 0;

    // Hide debug overlay when cursor leaves canvas
    const dbg = document.getElementById('debugOverlay');
    if (dbg) dbg.classList.add('hidden');
    this._debugHoverObj = null;

    if (s.camera.isDragging) {
      s.camera.isDragging = false;
      this.canvas.style.cursor = s.tools.activeItem ? 'crosshair' : 'default';
    }

    if (this._rightDrag) {
      this._rightDrag = null;
    }
    if (this._workerDrag) {
      this._workerDrag = null;
    }

    if (s.tools.isPlacing && s.tools.placeStart && s.tools.placeEnd) {
      this.commitPlacement();
      s.tools.isPlacing = false;
      s.tools.placeStart = null;
      s.tools.placeEnd = null;
    }
};
