const Grid = {
  canvas: null,
  ctx: null,
  animFrame: null,
  texturePatterns: {},
  _rightDrag: null,
  _workerSprites: {},  // { 'guard_front': Image, ... }
  _selectedWorkers: [],  // array of selected worker IDs
  _workerDrag: null,     // { startX, startY, endX, endY } for box-select
  _selectedObjId: null,  // selected object id for move/rotate/sell
  _objMoveMode: false,   // true when moving a selected object
  _objOriginal: null,    // saved {gx, gy, rot, w, h} for move cancel
  _utilityDrawing: false, // true while dragging to lay utilities
  // Clone tool state
  _cloneMode: false,     // true when clone toolbar is active
  _cloneData: null,      // { cells: Uint8Array, width, height, objects: [{type,rx,ry,rot,w,h}] }
  _cloneSelecting: false, // true during right-drag selection phase
  _clickTimer: null,      // delayed single-click action (to distinguish from double-click)

  init() {
    this.canvas = document.getElementById('gridCanvas');
    this.ctx = this.canvas.getContext('2d');

    this._loadWorkerSprites();

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.clearKeys());

    this._lastFrameTime = performance.now();

    this.buildStarterLayout();
    this.startLoop();
  },

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    this.texturePatterns = {};
  },

  getPattern(textureName) {
    if (this.texturePatterns[textureName]) return this.texturePatterns[textureName];
    const img = Textures.get(textureName);
    if (!img || !img.complete) return null;
    const pattern = this.ctx.createPattern(img, 'repeat');
    this.texturePatterns[textureName] = pattern;
    return pattern;
  },

  buildStarterLayout() {
    // Default facility is now built by AppState.buildDefaultFacility()
    // Camera is positioned there as well
  },

  screenToGrid(sx, sy) {
    const s = AppState;
    const worldX = (sx - s.camera.x) / s.camera.zoom;
    const worldY = (sy - s.camera.y) / s.camera.zoom;
    return {
      gx: Math.floor(worldX / s.grid.cellSize),
      gy: Math.floor(worldY / s.grid.cellSize),
    };
  },

  onWheel(e) {
    e.preventDefault();
    const s = AppState;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldZoom = s.camera.zoom;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    s.camera.zoom = Math.max(0.3, Math.min(3, s.camera.zoom * factor));

    s.camera.x = mx - (mx - s.camera.x) * (s.camera.zoom / oldZoom);
    s.camera.y = my - (my - s.camera.y) * (s.camera.zoom / oldZoom);

    this.texturePatterns = {};
  },

  onKeyDown(e) {
    // Let Ctrl/Meta combos pass through to global handlers (save/load)
    if (e.ctrlKey || e.metaKey) return;
    const cam = AppState.camera;
    switch (e.key) {
      case 'w': case 'W': case 'ArrowUp':    cam.keys.up = true; break;
      case 's': case 'S': case 'ArrowDown':   cam.keys.down = true; break;
      case 'a': case 'A': case 'ArrowLeft':   cam.keys.left = true; break;
      case 'd': case 'D': case 'ArrowRight':  cam.keys.right = true; break;
      case 'q': case 'Q': cam.keys.zoomIn = true; break;
      case 'e': case 'E': cam.keys.zoomOut = true; break;
      case 'r': case 'R':
        if (this._selectedObjId && !AppState.tools.activeItem) {
          // Check if selected object can rotate
          const selObj = AppState.objects.find(o => o.id === this._selectedObjId);
          const selDef = selObj ? ObjectDefs[selObj.type] : null;
          if (selDef && !selDef.noRotate && !selDef.wallMount) {
            if (this._objMoveMode) {
              // In move mode: just rotate data (grid cells already cleared on pickup)
              const newRot = (selObj.rot + 1) % 4;
              selObj.rot = newRot;
              selObj.w = newRot % 2 === 0 ? selDef.w : selDef.h;
              selObj.h = newRot % 2 === 0 ? selDef.h : selDef.w;
            } else {
              AppState.rotateObject(this._selectedObjId);
            }
          }
        } else if (AppState.tools.activeItem && AppState.tools.activeItem.objectType) {
          // Check if placing object can rotate (skip noRotate + wallMount auto-orients)
          const placeDef = ObjectDefs[AppState.tools.activeItem.objectType];
          if (placeDef && !placeDef.noRotate && !placeDef.wallMount) {
            AppState.tools.placeRotation = (AppState.tools.placeRotation + 1) % 4;
          }
        } else if (AppState.tools.activeItem) {
          // Non-object tools (doors etc) can still rotate
          AppState.tools.placeRotation = (AppState.tools.placeRotation + 1) % 4;
        }
        break;
      case 'm': case 'M':
        break;
      case 'Delete': case 'Backspace':
        if (this._selectedObjId && !AppState.tools.activeItem) {
          AppState.removeObject(this._selectedObjId);
          AppState.recheckAllRooms();
          this.deselectObject();
        }
        break;
      case 'Escape':
        if (this._cloneMode && this._cloneData) {
          this._cloneData = null;  // Cancel clone stamp, stay in clone mode
          e.stopImmediatePropagation();  // Don't let toolbar's Escape handler fire
          return;
        } else if (this._objMoveMode) {
          // Cancel move: revert to original position/rotation
          if (this._selectedObjId && this._objOriginal) {
            const obj = AppState.objects.find(o => o.id === this._selectedObjId);
            if (obj) {
              // Clear current grid cells
              for (let ox = 0; ox < obj.w; ox++)
                for (let oy = 0; oy < obj.h; oy++) {
                  const cx = obj.gx + ox, cy = obj.gy + oy;
                  if (cx >= 0 && cx < AppState.grid.width && cy >= 0 && cy < AppState.grid.height)
                    AppState.grid.objectGrid[cy * AppState.grid.width + cx] = 0;
                }
              // Restore original state
              obj.gx = this._objOriginal.gx;
              obj.gy = this._objOriginal.gy;
              obj.rot = this._objOriginal.rot;
              obj.w = this._objOriginal.w;
              obj.h = this._objOriginal.h;
              AppState._claimObjectCells(obj);
            }
          }
          this._objMoveMode = false;
          this._objOriginal = null;
          this.canvas.style.cursor = 'default';
        } else if (this._selectedObjId) {
          this.deselectObject();
        }
        break;
      case 'z': case 'Z': Toolbar.cycleItem(-1); break;
      case 'x': case 'X': Toolbar.cycleItem(1); break;
    }
  },

  onKeyUp(e) {
    const cam = AppState.camera;
    switch (e.key) {
      case 'w': case 'W': case 'ArrowUp':    cam.keys.up = false; break;
      case 's': case 'S': case 'ArrowDown':   cam.keys.down = false; break;
      case 'a': case 'A': case 'ArrowLeft':   cam.keys.left = false; break;
      case 'd': case 'D': case 'ArrowRight':  cam.keys.right = false; break;
      case 'q': case 'Q': cam.keys.zoomIn = false; break;
      case 'e': case 'E': cam.keys.zoomOut = false; break;
    }
  },

  clearKeys() {
    const k = AppState.camera.keys;
    k.up = k.down = k.left = k.right = k.zoomIn = k.zoomOut = false;
    AppState.camera.edgeScroll.x = 0;
    AppState.camera.edgeScroll.y = 0;
  },

  updateEdgeScroll(mx, my) {
    const s = AppState;
    const rect = this.canvas.getBoundingClientRect();
    const margin = s.camera.edgeScrollMargin;
    const cw = rect.width;
    const ch = rect.height;

    let ex = 0, ey = 0;
    if (mx <= margin)          ex = -1;
    else if (mx >= cw - margin) ex = 1;
    if (my <= margin)          ey = -1;
    else if (my >= ch - margin) ey = 1;

    s.camera.edgeScroll.x = ex;
    s.camera.edgeScroll.y = ey;
  },

  updateCamera(dt) {
    const s = AppState;
    const cam = s.camera;
    const speed = cam.panSpeed / cam.zoom;

    let dx = 0, dy = 0;

    if (cam.keys.up)    dy += speed * dt;
    if (cam.keys.down)  dy -= speed * dt;
    if (cam.keys.left)  dx += speed * dt;
    if (cam.keys.right) dx -= speed * dt;

    const edgeSpeed = cam.edgeScrollSpeed / cam.zoom;
    dx -= cam.edgeScroll.x * edgeSpeed * dt;
    dy -= cam.edgeScroll.y * edgeSpeed * dt;

    cam.x += dx;
    cam.y += dy;

    if (cam.keys.zoomIn || cam.keys.zoomOut) {
      const cw = this.canvas.width / window.devicePixelRatio;
      const ch = this.canvas.height / window.devicePixelRatio;
      const cx = cw / 2;
      const cy = ch / 2;

      const oldZoom = cam.zoom;
      const zoomRate = cam.keys.zoomIn ? 2.0 : 0.5;
      cam.zoom = Math.max(0.3, Math.min(3, cam.zoom * Math.pow(zoomRate, dt)));

      cam.x = cx - (cx - cam.x) * (cam.zoom / oldZoom);
      cam.y = cy - (cy - cam.y) * (cam.zoom / oldZoom);

      this.texturePatterns = {};
    }
  },

  onDoubleClick(e) {
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
  },

  onMouseDown(e) {
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

    if (e.button === 2) {
      if (s.tools.isPlacing) {
        s.tools.isPlacing = false;
        s.tools.placeStart = null;
        s.tools.placeEnd = null;
        return;
      }
      const { gx, gy } = this.screenToGrid(mx, my);
      // Clone mode: stamp or start selection (+ erase plan cells)
      if (this._cloneMode) {
        if (this._cloneData) {
          this._stampClone(gx, gy);
        } else {
          this._rightDrag = { startX: gx, startY: gy, endX: gx, endY: gy, moved: false };
          // Erase plan cell under cursor immediately
          s.setPlanCell(gx, gy, 0);
        }
        return;
      }
      // If workers are selected, right-click moves them to this location
      if (this._selectedWorkers.length > 0) {
        this._moveSelectedWorkers(gx, gy);
        return;
      }
      this._rightDrag = { startX: gx, startY: gy, endX: gx, endY: gy, moved: false };
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

      // Object click — select it (highlight only, no move mode)
      // Double-click enters move mode (see onDoubleClick)
      const obj = s.getObjectAt(gx, gy);
      if (obj) {
        if (this._clickTimer) { clearTimeout(this._clickTimer); this._clickTimer = null; }
        if (this._selectedObjId === obj.id) {
          this.deselectObject();
        } else {
          this._selectedWorkers = [];
          this.hideWorkerPanel();
          // Desks: defer pipeline open so double-click can cancel it
          if (DESK_TYPES.has(obj.type) && typeof Pipeline !== 'undefined') {
            this._selectedObjId = obj.id;
            this._objMoveMode = false;
            this._objOriginal = null;
            this._clickTimer = setTimeout(() => {
              this._clickTimer = null;
              this.deselectObject();
              Pipeline.openDeskEditor(obj.id);
            }, 250);
          } else {
            this._selectedObjId = obj.id;
            this._objMoveMode = false;
            this._objOriginal = null;
          }
        }
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
      // Room click (empty floor inside any designated room)
      const room = s.getRoomAt(gx, gy);
      if (room) {
        if (typeof Pipeline !== 'undefined') Pipeline.openRoomConfig(room.id);
        this._workerDrag = null;
        return;
      }
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
  },

  onMouseMove(e) {
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

    // Crate tooltip
    this._updateCrateTooltip(e.clientX, e.clientY);
  },

  _updateCrateTooltip(clientX, clientY) {
    const s = AppState;
    const tooltip = document.getElementById('crateTooltip');
    if (!tooltip || !this._mouseGrid) { if (tooltip) tooltip.classList.add('hidden'); return; }

    const obj = s.getObjectAt(this._mouseGrid.gx, this._mouseGrid.gy);
    if (obj && obj.type === 'crate') {
      const crateData = s._activeCrates.find(c => c.id === obj.id);
      if (crateData) {
        const itemName = ObjectDefs[crateData.containsType]?.name || crateData.containsType;
        tooltip.querySelector('.ct-item').textContent = itemName;
        tooltip.style.left = (clientX + 12) + 'px';
        tooltip.style.top = (clientY - 8) + 'px';
        tooltip.classList.remove('hidden');
        return;
      }
    }
    tooltip.classList.add('hidden');
  },

  onMouseUp(e) {
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

    if (e.button === 2 && this._rightDrag) {
      if (this._cloneMode && this._rightDrag.moved) {
        // Clone mode: capture the selected area
        this._captureClone();
      } else if (!this._rightDrag.moved && !this._cloneMode) {
        Toolbar.clearSelection();
      }
      this._rightDrag = null;
      return;
    }

    if (s.tools.isPlacing && s.tools.placeStart && s.tools.placeEnd) {
      this.commitPlacement();
      s.tools.isPlacing = false;
      s.tools.placeStart = null;
      s.tools.placeEnd = null;
    }
  },

  onMouseLeave(e) {
    const s = AppState;
    s.camera.edgeScroll.x = 0;
    s.camera.edgeScroll.y = 0;

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
  },

  commitPlacement() {
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
            s.setCell(x, y, floor || CT.EMPTY);
            s.setFloorUnder(x, y, 0);
          } else {
            s.setCell(x, y, CT.EMPTY);
          }
        }
      }
    } else if (item.id === 'demolish_walls') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.EMPTY);
            s.setFloorUnder(x, y, 0);
          } else if (this.isWall(cell)) {
            s.setCell(x, y, CT.EMPTY);
          }
        }
      }
    } else if (item.id === 'clear_indoor') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (cell !== CT.EMPTY && !this.isWall(cell)) {
            s.setCell(x, y, CT.EMPTY);
          }
        }
      }
    } else if (item.demolishAction === 'walls') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.EMPTY);
            s.setFloorUnder(x, y, 0);
          } else if (this.isWall(cell) && !s.isDoor(cell)) {
            s.setCell(x, y, CT.EMPTY);
          }
        }
      }
    } else if (item.demolishAction === 'doors') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (s.isDoor(cell)) {
            const floor = s.getFloorUnder(x, y);
            s.setCell(x, y, floor || CT.EMPTY);
            s.setFloorUnder(x, y, 0);
          }
        }
      }
    } else if (item.demolishAction === 'floors') {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const cell = s.getCell(x, y);
          if (cell !== CT.EMPTY && !this.isWall(cell) && !s.isDoor(cell)) {
            s.setCell(x, y, CT.EMPTY);
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
        // on the border — like PA. Single rows/columns fill entirely.
        const rectDrag = (x2 - x1 >= 1) && (y2 - y1 >= 1);
        for (let x = x1; x <= x2; x++) {
          for (let y = y1; y <= y2; y++) {
            if (rectDrag && x !== x1 && x !== x2 && y !== y1 && y !== y2) continue;
            if (placingDoor) this._saveDoorFloor(s, x, y);
            s.setCell(x, y, item.cell);
            s.setRotation(x, y, rot);
          }
        }
      }
    }

    s.facility.cash -= totalCost;
  },

  startLoop() {
    const loop = (now) => {
      const dt = Math.min((now - this._lastFrameTime) / 1000, 0.05);
      this._lastFrameTime = now;
      this.updateCamera(dt);
      this.update();
      this.updateVisibleRoom();
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this._lastFrameTime = performance.now();
    requestAnimationFrame(loop);
  },

  // ── A* Pathfinding (grid-based, walls block, doors pass, objects block) ──
  // Cached object-id-to-passable map for fast pathfinding lookups
  _objPassableCache: null,
  _objPassableCacheGen: -1,

  _rebuildObjPassableCache() {
    const s = AppState;
    this._objPassableCache = new Map();
    for (const obj of s.objects) {
      const def = ObjectDefs[obj.type];
      this._objPassableCache.set(obj.id, def ? !!def.passable : false);
    }
    this._objPassableCacheGen = s._nextObjId;
  },

  _isWalkable(gx, gy) {
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
  },

  // cellFilter: optional function(gx, gy, cellType) => bool. If provided, cells
  // that return false are treated as unwalkable (on top of normal wall/object checks).
  findPath(startX, startY, endX, endY, cellFilter) {
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
  },

  update() {
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
          // Pick a random walkable target based on worker zone
          const wt = WorkerTypes[w.type];
          const zone = wt ? wt.zone : null;
          let tx, ty;
          let attempts = 0;

          if (zone === 'outdoor') {
            // Gardener: only walk on outdoor floor cells (100-118)
            do {
              tx = w.x + (Math.random() - 0.5) * 10;
              ty = w.y + (Math.random() - 0.5) * 10;
              tx = Math.max(0.5, Math.min(s.grid.width - 0.5, tx));
              ty = Math.max(0.5, Math.min(s.grid.height - 0.5, ty));
              attempts++;
              const cell = s.getCell(Math.floor(tx), Math.floor(ty));
              if (cell >= 100 && cell <= 118 && this._isWalkable(Math.floor(tx), Math.floor(ty))) break;
            } while (attempts < 20);
          } else if (zone === 'kitchen') {
            // Chef: stay in kitchen room
            const kitchenRoom = s.rooms.find(r => r.type === 'kitchen') || room;
            if (kitchenRoom) {
              do {
                tx = kitchenRoom.x1 + 0.5 + Math.random() * (kitchenRoom.x2 - kitchenRoom.x1);
                ty = kitchenRoom.y1 + 0.5 + Math.random() * (kitchenRoom.y2 - kitchenRoom.y1);
                attempts++;
              } while (!this._isWalkable(Math.floor(tx), Math.floor(ty)) && attempts < 10);
            }
          } else if (zone === 'indoor') {
            // Janitor: roam between indoor rooms (pick a random room each time)
            const indoorRooms = s.rooms.filter(r => r.type !== 'deliveries' && r.type !== 'garbage');
            const targetRoom = indoorRooms.length > 0
              ? indoorRooms[Math.floor(Math.random() * indoorRooms.length)]
              : room;
            if (targetRoom) {
              do {
                tx = targetRoom.x1 + 0.5 + Math.random() * (targetRoom.x2 - targetRoom.x1);
                ty = targetRoom.y1 + 0.5 + Math.random() * (targetRoom.y2 - targetRoom.y1);
                attempts++;
              } while (!this._isWalkable(Math.floor(tx), Math.floor(ty)) && attempts < 10);
            } else {
              // No rooms — stay near current position inside building
              do {
                tx = w.x + (Math.random() - 0.5) * 6;
                ty = w.y + (Math.random() - 0.5) * 6;
                tx = Math.max(0.5, Math.min(s.grid.width - 0.5, tx));
                ty = Math.max(0.5, Math.min(s.grid.height - 0.5, ty));
                attempts++;
                const cell = s.getCell(Math.floor(tx), Math.floor(ty));
                if (cell >= 50 && cell <= 73 && this._isWalkable(Math.floor(tx), Math.floor(ty))) break;
              } while (attempts < 15);
            }
          } else if (room) {
            // Room-assigned workers (operational): stay in their room
            do {
              tx = room.x1 + 0.5 + Math.random() * (room.x2 - room.x1);
              ty = room.y1 + 0.5 + Math.random() * (room.y2 - room.y1);
              attempts++;
            } while (!this._isWalkable(Math.floor(tx), Math.floor(ty)) && attempts < 10);
          } else {
            // No room, no zone — free roam near position
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
            // Gardener: constrain pathfinding to outdoor cells only — but only when
            // already outdoors. If indoors (e.g. just ate in canteen), allow free
            // pathfinding so they can walk through doors/hallways to get outside.
            let pathFilter = null;
            if (zone === 'outdoor') {
              const curCell = s.getCell(Math.floor(w.x), Math.floor(w.y));
              if (curCell >= 100 && curCell <= 118) {
                pathFilter = (gx, gy, cell) => cell === 0 || (cell >= 100 && cell <= 118);
              }
            }
            const path = this.findPath(w.x, w.y, tx, ty, pathFilter);
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
            // If worker has a pickup target (maintenance delivering), handle pickup immediately
            if (w._pickupTarget) {
              w._path = null;
              w._pathIdx = 0;
              // Pickup handled by _updateMaintenancePickup in the delivery update
              break;
            }
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

        case 'delivering':
        case 'installing':
          // Handled by updateDelivery — don't interfere
          break;

        case 'eating':
          // Handled by updateMeals — don't interfere
          break;
      }
    }

    // Update meal system (random hunger → walk to canteen → eat → return)
    this.updateMeals(s, realDeltaSec, timeStep);

    // Update delivery system
    this.updateDelivery(realDeltaSec, timeStep);

    // Update doors (PA-style open/close)
    this._updateDoors(s, realDeltaSec);
  },

  // ── Meal System ──
  // Full flow: Chef cooks → food on serving table → worker gets hungry → picks up tray
  // → finds chair near table → sits and eats → returns home.
  updateMeals(s, realDeltaSec, timeStep) {
    // Find canteen or kitchen room (prefer canteen, fall back to kitchen)
    const canteen = s.rooms.find(r => r.type === 'canteen') || s.rooms.find(r => r.type === 'kitchen');
    if (!canteen) return;

    // Build set of chairs occupied by eating workers (to avoid double-seating)
    const occupiedSeats = new Set();
    for (const w of s.workers) {
      if (w._mealSeatId && (w._mealState === 'walking_to_seat' || w._mealState === 'eating')) {
        occupiedSeats.add(w._mealSeatId);
      }
    }

    for (const w of s.workers) {
      if (w.type === 'maintenance' || w.type === 'chef') continue;
      if (w.state === 'delivering' || w.state === 'installing') continue;

      // Initialize meal timer
      if (w._mealTimer === undefined || w._mealTimer === null) {
        w._mealTimer = 90 + Math.random() * 210;
      }

      switch (w._mealState) {
        case null:
        case undefined:
        case 'done': {
          w._mealTimer -= realDeltaSec;
          if (w._mealTimer <= 0) {
            w._mealState = 'hungry';
            w._mealTimer = 0;
          }
          break;
        }

        case 'hungry': {
          // Save home room for return trip
          w._mealHomeRoom = w.roomId;

          // Find serving table in canteen — walk adjacent to it to pick up food
          const servingTable = s.objects.find(o => o.type === 'serving_table' &&
            o.gx + o.w > canteen.x1 && o.gx <= canteen.x2 &&
            o.gy + o.h > canteen.y1 && o.gy <= canteen.y2);

          if (servingTable && s._servingFood > 0) {
            // Walk to a cell just below the serving table (front side)
            let tx = servingTable.gx + Math.floor(servingTable.w / 2) + 0.5;
            let ty = servingTable.gy + servingTable.h + 0.5;
            // If that cell isn't walkable, try cells along the table front
            if (!this._isWalkable(Math.floor(tx), Math.floor(ty))) {
              for (let dx = 0; dx < servingTable.w; dx++) {
                const cx = servingTable.gx + dx;
                const cy = servingTable.gy + servingTable.h;
                if (this._isWalkable(cx, cy)) { tx = cx + 0.5; ty = cy + 0.5; break; }
              }
            }
            const path = this.findPath(w.x, w.y, tx, ty);
            if (path && path.length > 1) {
              w._path = path;
              w._pathIdx = 1;
              w.state = 'walking';
              w._mealState = 'walking_to_serving';
              w._manualMove = true;
            } else {
              // Can't path to serving table — skip to finding a seat directly
              w._hasTray = false;
              w._mealState = '_find_seat';
            }
          } else {
            // No serving table or no food — go directly to seat (eat snack / drink)
            w._hasTray = false;
            w._mealState = '_find_seat';
          }
          break;
        }

        case 'walking_to_serving': {
          if (w.state === 'idle') {
            // Arrived at serving table — pick up food tray
            if (s._servingFood > 0) {
              s._servingFood--;
              w._hasTray = true;
            }
            w._mealState = '_find_seat';
          }
          break;
        }

        // Internal transition state: find a free chair near a dining table
        case '_find_seat': {
          const seat = this._findFreeMealSeat(s, canteen, occupiedSeats);
          if (seat) {
            w._mealSeatId = seat.id;
            occupiedSeats.add(seat.id);
            const path = this.findPath(w.x, w.y, seat.gx + 0.5, seat.gy + 0.5);
            if (path && path.length > 1) {
              w._path = path;
              w._pathIdx = 1;
              w.state = 'walking';
              w._mealState = 'walking_to_seat';
              w._manualMove = true;
            } else {
              // Can't path to chair — eat standing where we are
              w._mealState = 'eating';
              w.state = 'eating';
              w._mealTimer = 15 + Math.random() * 20;
              w.taskLabel = 'Eating';
            }
          } else {
            // No free chair — eat standing at a random spot in canteen
            let tx, ty, att = 0;
            do {
              tx = canteen.x1 + 1 + Math.random() * Math.max(0, canteen.x2 - canteen.x1 - 1);
              ty = canteen.y1 + 1 + Math.random() * Math.max(0, canteen.y2 - canteen.y1 - 1);
              att++;
            } while (!this._isWalkable(Math.floor(tx), Math.floor(ty)) && att < 15);
            const path = this.findPath(w.x, w.y, tx, ty);
            if (path && path.length > 1) {
              w._path = path;
              w._pathIdx = 1;
              w.state = 'walking';
              w._mealState = 'walking_to_seat';
              w._manualMove = true;
            } else {
              w._mealState = 'eating';
              w.state = 'eating';
              w._mealTimer = 15 + Math.random() * 20;
              w.taskLabel = 'Eating';
            }
          }
          break;
        }

        case 'walking_to_seat': {
          if (w.state === 'idle') {
            // Snap to chair position if we have one
            if (w._mealSeatId) {
              const chair = s.objects.find(o => o.id === w._mealSeatId);
              if (chair) {
                w.x = chair.gx + 0.5;
                w.y = chair.gy + 0.5;
              }
            }
            w._mealState = 'eating';
            w.state = 'eating';
            w._mealTimer = 15 + Math.random() * 20;
            w.taskLabel = 'Eating';
          }
          break;
        }

        case 'eating': {
          // Stay snapped to chair while eating
          if (w._mealSeatId) {
            const chair = s.objects.find(o => o.id === w._mealSeatId);
            if (chair) { w.x = chair.gx + 0.5; w.y = chair.gy + 0.5; }
          }
          w._mealTimer -= realDeltaSec;
          if (w._mealTimer <= 0) {
            // Done eating
            w.taskLabel = null;
            w._hasTray = false;
            w._mealSeatId = null;
            w._mealState = 'returning';
            w._lastMeal = s.facility.time;

            // Walk back to home room (or outdoors for gardeners)
            const wZone = (WorkerTypes[w.type] || {}).zone;
            const homeRoom = w._mealHomeRoom ? s.rooms.find(r => r.id === w._mealHomeRoom) : null;
            let tx, ty;
            if (wZone === 'outdoor') {
              // Gardeners must return outside — find a random outdoor cell
              let att = 0;
              do {
                tx = w.x + (Math.random() - 0.5) * 14;
                ty = w.y + (Math.random() - 0.5) * 14;
                tx = Math.max(0.5, Math.min(s.grid.width - 0.5, tx));
                ty = Math.max(0.5, Math.min(s.grid.height - 0.5, ty));
                att++;
                const cell = s.getCell(Math.floor(tx), Math.floor(ty));
                if (cell >= 100 && cell <= 118 && this._isWalkable(Math.floor(tx), Math.floor(ty))) break;
              } while (att < 30);
            } else if (homeRoom) {
              let att = 0;
              do {
                tx = homeRoom.x1 + 1 + Math.random() * Math.max(0, homeRoom.x2 - homeRoom.x1 - 1);
                ty = homeRoom.y1 + 1 + Math.random() * Math.max(0, homeRoom.y2 - homeRoom.y1 - 1);
                att++;
              } while (!this._isWalkable(Math.floor(tx), Math.floor(ty)) && att < 15);
            } else {
              tx = w.x + (Math.random() - 0.5) * 6;
              ty = w.y + (Math.random() - 0.5) * 6;
            }
            const path = this.findPath(w.x, w.y, tx, ty);
            if (path && path.length > 1) {
              w._path = path;
              w._pathIdx = 1;
              w.state = 'walking';
              w._manualMove = true;
            } else {
              w.state = 'idle';
              w._mealState = 'done';
              w._mealTimer = 90 + Math.random() * 210;
              w._mealHomeRoom = null;
            }
          }
          break;
        }

        case 'returning': {
          if (w.state === 'idle') {
            w._mealState = 'done';
            w._mealTimer = 90 + Math.random() * 210;
            w._mealHomeRoom = null;
          }
          break;
        }

        default: {
          // Handle stale states from old saves (e.g. 'walking_to_canteen', 'getting_food')
          w._mealState = null;
          w._hasTray = false;
          w._mealSeatId = null;
          w._mealTimer = 30 + Math.random() * 60;
          if (w.state === 'eating') w.state = 'idle';
          break;
        }
      }
    }

    // ── Chef behavior: cook at cooker → food appears on serving table ──
    for (const w of s.workers) {
      if (w.type !== 'chef') continue;
      if (w.state === 'delivering' || w.state === 'installing') continue;

      const kitchen = s.rooms.find(r => r.type === 'kitchen');
      if (!kitchen) continue;

      if (w._cookTimer === undefined || w._cookTimer === null) {
        w._cookTimer = 10 + Math.random() * 20;
      }
      if (!w._cookState) w._cookState = 'idle';

      switch (w._cookState) {
        case 'idle': {
          w._cookTimer -= realDeltaSec;
          if (w._cookTimer <= 0 && s._servingFood < 8) {
            const cooker = s.objects.find(o => o.type === 'cooker' &&
              o.gx >= kitchen.x1 && o.gx <= kitchen.x2 &&
              o.gy >= kitchen.y1 && o.gy <= kitchen.y2);
            if (cooker) {
              const path = this.findPath(w.x, w.y, cooker.gx + 0.5, cooker.gy + 0.5);
              if (path && path.length > 1) {
                w._path = path;
                w._pathIdx = 1;
                w.state = 'walking';
                w._cookState = 'walking_to_cooker';
                w._manualMove = true;
              }
            }
          }
          break;
        }
        case 'walking_to_cooker': {
          if (w.state === 'idle') {
            w._cookState = 'cooking';
            w.state = 'working';
            w.taskLabel = 'Cooking';
            w._cookTimer = 8 + Math.random() * 12;
          }
          break;
        }
        case 'cooking': {
          w._cookTimer -= realDeltaSec;
          if (w._cookTimer <= 0) {
            // Food ready — add to serving table
            s._servingFood = Math.min(8, (s._servingFood || 0) + 1);
            w.state = 'idle';
            w.taskLabel = null;
            w._cookState = 'idle';
            w._cookTimer = 15 + Math.random() * 30;
          }
          break;
        }
      }
    }
  },

  // Find a free chair adjacent to a dining table in the given room
  _findFreeMealSeat(s, room, occupiedSeats) {
    // Gather all tables in the room
    const tables = s.objects.filter(o => TABLE_TYPES.has(o.type) &&
      o.gx + o.w > room.x1 && o.gx <= room.x2 &&
      o.gy + o.h > room.y1 && o.gy <= room.y2);
    if (tables.length === 0) return null;

    // For each table, find adjacent chairs
    const candidates = [];
    for (const tbl of tables) {
      for (const ch of s.objects) {
        if (!CHAIR_TYPES.has(ch.type)) continue;
        if (occupiedSeats.has(ch.id)) continue;
        // Check adjacency: chair must be within 1 cell of the table perimeter
        const adjX = ch.gx >= tbl.gx - 1 && ch.gx <= tbl.gx + tbl.w;
        const adjY = ch.gy >= tbl.gy - 1 && ch.gy <= tbl.gy + tbl.h;
        if (adjX && adjY) candidates.push(ch);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  // ── Door Open/Close System ──
  // Doors auto-open when a worker is within proximity, auto-close when no one is near.
  // State tracked in AppState._doorStates as { "gx,gy": { open: 0..1, closing: bool } }
  _updateDoors(s, dt) {
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

    // Also check truck driver proximity
    if (s._truckState !== 'idle' && s._truckDriverState !== 'in_truck' && s._truckDriverState !== 'done') {
      const wcx = Math.floor(s._truckDriverX);
      const wcy = Math.floor(s._truckDriverY);
      for (let ox = -2; ox <= 2; ox++) {
        for (let oy = -2; oy <= 2; oy++) {
          const gx = wcx + ox;
          const gy = wcy + oy;
          if (gx < 0 || gx >= s.grid.width || gy < 0 || gy >= s.grid.height) continue;
          const cell = s.getCell(gx, gy);
          if (!s.isDoor(cell)) continue;
          const ddx = (gx + 0.5) - s._truckDriverX;
          const ddy = (gy + 0.5) - s._truckDriverY;
          if (Math.sqrt(ddx * ddx + ddy * ddy) <= PROXIMITY) {
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
  },

  // ── Delivery System Update ──
  updateDelivery(realDeltaSec, timeStep) {
    const s = AppState;
    if (!s._deliveryEnabled) return;

    switch (s._truckState) {
      case 'idle':
        // Check if delivery queue has items → start truck timer
        if (s._deliveryQueue.length > 0) {
          s._truckTimer += realDeltaSec;
          if (s._truckTimer >= 2.5) { // 2.5 sec delay before truck arrives
            s._truckTimer = 0;
            s._truckState = 'arriving';
            s._truckY = -10;
            // Batch up to 6 items from queue
            s._truckCargo = s._deliveryQueue.splice(0, Math.min(6, s._deliveryQueue.length));
            s._truckDriverState = 'in_truck';
            s._truckDriverCargoIdx = 0;
          }
        }
        break;

      case 'arriving':
        // Truck drives south
        s._truckY += 0.04 * timeStep;
        s._truckDriverY = s._truckY + 2; // Driver in cab
        s._truckDriverX = 93;
        if (s._truckY >= s._truckTargetY) {
          s._truckY = s._truckTargetY;
          s._truckState = 'unloading';
          s._truckDriverState = 'walking_to_zone';
          s._truckDriverY = s._truckY + 2;
        }
        break;

      case 'unloading':
        this._updateTruckDriver(realDeltaSec, timeStep);
        break;

      case 'departing':
        s._truckY += 0.05 * timeStep;
        s._truckDriverY = s._truckY + 2;
        s._truckDriverX = 93;
        if (s._truckY > 110) {
          s._truckState = 'idle';
          s._truckY = -10;
          s._truckDriverState = 'in_truck';
        }
        break;
    }

    // Maintenance worker pickup logic
    this._updateMaintenancePickup(realDeltaSec, timeStep);
  },

  _updateTruckDriver(realDeltaSec, timeStep) {
    const s = AppState;
    const driverSpeed = 0.04 * timeStep;

    switch (s._truckDriverState) {
      case 'walking_to_zone': {
        // Walk from truck to deliveries zone free spot
        const spot = s.findFreeDeliverySpot();
        if (!spot) {
          // Zone full — wait
          break;
        }
        // Move toward spot
        const tx = spot.gx + 0.5;
        const ty = spot.gy + 0.5;
        const dx = tx - s._truckDriverX;
        const dy = ty - s._truckDriverY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.3) {
          // Arrived — place crate
          s._truckDriverState = 'placing';
        } else {
          s._truckDriverX += (dx / dist) * driverSpeed;
          s._truckDriverY += (dy / dist) * driverSpeed;
        }
        break;
      }

      case 'placing': {
        // Place a crate for the current cargo item
        const spot = s.findFreeDeliverySpot();
        if (!spot) break;
        const objId = s._truckCargo[s._truckDriverCargoIdx];
        const obj = s.objects.find(o => o.id === objId);
        if (obj) {
          // Place crate in deliveries zone
          const crate = s.addObject('crate', spot.gx, spot.gy, 0);
          if (crate) {
            crate.ghost = false; // Crates are solid immediately
            s._activeCrates.push({
              id: crate.id,
              containsObjId: objId,
              containsType: obj.type,
              gx: spot.gx,
              gy: spot.gy,
            });
          }
        }
        s._truckDriverCargoIdx++;
        if (s._truckDriverCargoIdx >= s._truckCargo.length) {
          // All unloaded — walk back to truck
          s._truckDriverState = 'walking_to_truck';
        } else {
          // Walk back to truck for next item
          s._truckDriverState = 'walking_to_truck_for_next';
        }
        break;
      }

      case 'walking_to_truck_for_next': {
        // Walk back to truck
        const tx = 93;
        const ty = s._truckY + 3;
        const dx = tx - s._truckDriverX;
        const dy = ty - s._truckDriverY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.3) {
          // Back at truck — walk to zone with next crate
          s._truckDriverState = 'walking_to_zone';
        } else {
          s._truckDriverX += (dx / dist) * driverSpeed;
          s._truckDriverY += (dy / dist) * driverSpeed;
        }
        break;
      }

      case 'walking_to_truck': {
        // Final walk back to truck → depart
        const tx = 93;
        const ty = s._truckY + 3;
        const dx = tx - s._truckDriverX;
        const dy = ty - s._truckDriverY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.3) {
          s._truckDriverState = 'done';
          s._truckState = 'departing';
        } else {
          s._truckDriverX += (dx / dist) * driverSpeed;
          s._truckDriverY += (dy / dist) * driverSpeed;
        }
        break;
      }
    }
  },

  _updateMaintenancePickup(realDeltaSec, timeStep) {
    const s = AppState;

    // Check each maintenance worker
    for (const w of s.workers) {
      if (w.type !== 'maintenance') continue;

      // Handle delivering state
      if (w.state === 'delivering') {
        if (!w._path || w._pathIdx >= w._path.length) {
          // Arrived at destination — install
          w.state = 'installing';
          w._installTimer = 0;
          w.taskLabel = 'Installing...';
        } else {
          // Follow path
          const waypoint = w._path[w._pathIdx];
          const dx = waypoint.x - w.x;
          const dy = waypoint.y - w.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.15) {
            w._pathIdx++;
          } else {
            w.x += (dx / dist) * w.speed * timeStep;
            w.y += (dy / dist) * w.speed * timeStep;
          }
        }
        continue;
      }

      // Handle installing state
      if (w.state === 'installing') {
        w._installTimer += realDeltaSec;
        if (w._installTimer >= 4) {
          // Complete installation
          const obj = s.objects.find(o => o.id === w._cargoObjId);
          if (obj) obj.ghost = false;
          w._cargoObjId = null;
          w._cargoType = null;
          w.taskLabel = null;
          w.state = 'idle';
          if (typeof Reports !== 'undefined') {
            Reports.log('delivery', `${w.name} installed ${ObjectDefs[obj?.type]?.name || 'object'}`);
          }
        }
        continue;
      }

      // If idle and crates available — assign pickup
      if (w.state === 'idle' && !w._cargoObjId && s._activeCrates.length > 0) {
        const crate = s._activeCrates[0]; // FIFO
        // Path to crate
        const path = this.findPath(w.x, w.y, crate.gx + 0.5, crate.gy + 0.5);
        if (path && path.length > 1) {
          w._path = path;
          w._pathIdx = 1;
          w.state = 'walking';
          w._pickupTarget = crate;
          w.taskLabel = 'Picking up crate...';
        }
      }

      // If walking to a pickup target — check if arrived
      if (w.state === 'walking' && w._pickupTarget) {
        const crate = w._pickupTarget;
        const dist = Math.sqrt((w.x - (crate.gx + 0.5)) ** 2 + (w.y - (crate.gy + 0.5)) ** 2);
        if (dist < 0.5 || (!w._path || w._pathIdx >= w._path.length)) {
          // Pickup the crate
          const crateIdx = s._activeCrates.findIndex(c => c.id === crate.id);
          if (crateIdx !== -1) s._activeCrates.splice(crateIdx, 1);
          // Remove crate object from grid
          s.removeObject(crate.id);
          // Set cargo
          w._cargoObjId = crate.containsObjId;
          w._cargoType = crate.containsType;
          w._pickupTarget = null;
          // Path to ghost object location
          const targetObj = s.objects.find(o => o.id === crate.containsObjId);
          if (targetObj) {
            const path2 = this.findPath(w.x, w.y, targetObj.gx + 0.5, targetObj.gy + 0.5);
            if (path2 && path2.length > 1) {
              w._path = path2;
              w._pathIdx = 1;
              w.state = 'delivering';
              w.taskLabel = `Delivering ${ObjectDefs[crate.containsType]?.name || 'item'}`;
            } else {
              // Can't reach — just install instantly as fallback
              targetObj.ghost = false;
              w._cargoObjId = null;
              w._cargoType = null;
              w.taskLabel = null;
              w.state = 'idle';
            }
          } else {
            w._cargoObjId = null;
            w._cargoType = null;
            w.state = 'idle';
            w.taskLabel = null;
          }
        }
      }
    }
  },

  updateVisibleRoom() {
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
  },

  isWall(cellType) {
    return cellType >= 1 && cellType <= 46;
  },

  // PA-style auto-orient for wallMount objects.
  // Detects which direction has a non-wall cell and orients to face that way.
  // rot=0: face south, rot=1: face west, rot=2: face north, rot=3: face east
  _autoOrientWallMount(gx, gy) {
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
  },

  _saveDoorFloor(s, x, y) {
    const existing = s.getCell(x, y);
    if (s.isDoor(existing)) {
      // keep the already-saved floor
    } else if (existing !== CT.EMPTY && !s.isWall(existing)) {
      s.setFloorUnder(x, y, existing);
    } else {
      s.setFloorUnder(x, y, CT.CONCRETE_FLOOR);
    }
  },

  render() {
    const s = AppState;
    const ctx = this.ctx;
    const cw = this.canvas.width / window.devicePixelRatio;
    const ch = this.canvas.height / window.devicePixelRatio;
    const cs = s.grid.cellSize * s.camera.zoom;

    ctx.clearRect(0, 0, cw, ch);

    const utilMode = s.ui.showUtilities;

    // Void background
    ctx.fillStyle = utilMode ? '#1a1a1a' : '#000000';
    ctx.fillRect(0, 0, cw, ch);

    const startGX = Math.max(0, Math.floor(-s.camera.x / cs));
    const startGY = Math.max(0, Math.floor(-s.camera.y / cs));
    const endGX = Math.min(s.grid.width, Math.ceil((cw - s.camera.x) / cs));
    const endGY = Math.min(s.grid.height, Math.ceil((ch - s.camera.y) / cs));

    ctx.save();
    ctx.translate(s.camera.x, s.camera.y);
    ctx.scale(s.camera.zoom, s.camera.zoom);

    // Pass 1: Draw floors
    const cellSize = s.grid.cellSize;
    if (utilMode) {
      // Utility mode: flat grey floor cells + visible grid
      for (let gx = startGX; gx < endGX; gx++) {
        for (let gy = startGY; gy < endGY; gy++) {
          const cell = s.getCell(gx, gy);
          if (cell === CT.EMPTY) continue;
          if (this.isWall(cell)) continue; // walls drawn in pass 2
          // All floors → flat dark grey
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(gx * cellSize, gy * cellSize, cellSize, cellSize);
        }
      }
      // Grid lines over floor area
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let gx = startGX; gx <= endGX; gx++) {
        const x = gx * cellSize;
        ctx.moveTo(x, startGY * cellSize);
        ctx.lineTo(x, endGY * cellSize);
      }
      for (let gy = startGY; gy <= endGY; gy++) {
        const y = gy * cellSize;
        ctx.moveTo(startGX * cellSize, y);
        ctx.lineTo(endGX * cellSize, y);
      }
      ctx.stroke();
    } else {
      // Normal mode: textured floors
      for (let gx = startGX; gx < endGX; gx++) {
        for (let gy = startGY; gy < endGY; gy++) {
          const cell = s.getCell(gx, gy);
          let floorCell = 0;
          if (cell !== CT.EMPTY && !this.isWall(cell)) {
            floorCell = cell;
          } else if (s.isDoor(cell)) {
            floorCell = s.getFloorUnder(gx, gy);
          }
          if (!floorCell) continue;
          const texName = CellTextures[floorCell];
          if (!texName) continue;
          const img = Textures.get(texName);
          if (!img || !img.complete) continue;
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
            gx * cellSize, gy * cellSize,
            cellSize + 0.5, cellSize + 0.5);
        }
      }
    }

    // Pass 1b: Dynamic shadows (walls + objects)
    this._renderShadows(ctx, s, cellSize, startGX, startGY, endGX, endGY);

    // Pass 2: Walls
    if (utilMode) {
      // Utility mode: solid lighter grey blocks for walls, thin outlines for doors
      for (let gy = startGY; gy < endGY; gy++) {
        for (let gx = startGX; gx < endGX; gx++) {
          const cell = s.getCell(gx, gy);
          if (!this.isWall(cell)) continue;
          const dx = gx * cellSize;
          const dy = gy * cellSize;
          if (s.isDoor(cell)) {
            // Doors shown as thin grey bar (distinguishable gap in walls)
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(dx, dy, cellSize + 0.5, cellSize + 0.5);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(dx + 2, dy + 2, cellSize - 3.5, cellSize - 3.5);
          } else {
            // Walls: lighter grey
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(dx, dy, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }
    } else {
      // Normal mode: walls with autotile — direct bitmask lookup (N=1 S=2 W=4 E=8).
      // Pass 2A: Walls only (doors deferred to pass 2B so they render on top)
      const deferredDoors = [];
      for (let gy = startGY; gy < endGY; gy++) {
        for (let gx = startGX; gx < endGX; gx++) {
          const cell = s.getCell(gx, gy);
          if (!this.isWall(cell)) continue;

          const dx = gx * cellSize;
          const dy = gy * cellSize;
          const dw = cellSize + 0.5;
          const dh = cellSize + 0.5;

          // Defer doors to a later pass so they overlap walls
          if (cell >= CT.DOOR) {
            deferredDoors.push({ gx, gy, cell, dx, dy, dw, dh });
            continue;
          }

          const prefix = WallVariantPrefix[cell];
          let img;

          if (prefix) {
            const mask =
              (this.isWall(s.getCell(gx, gy - 1)) ? 1 : 0) |
              (this.isWall(s.getCell(gx, gy + 1)) ? 2 : 0) |
              (this.isWall(s.getCell(gx - 1, gy)) ? 4 : 0) |
              (this.isWall(s.getCell(gx + 1, gy)) ? 8 : 0);

            img = Textures.get(prefix + '_' + mask);
            if (img && img.complete) {
              ctx.drawImage(img, dx, dy, dw, dh);
              continue;
            }
          }

          const texName = CellTextures[cell];
          if (!texName) continue;
          img = Textures.get(texName);
          if (!img || !img.complete) continue;
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }

      // Pass 2B: Doors — rendered AFTER all walls so they always overlap
      for (const door of deferredDoors) {
        const { gx, gy, cell, dx, dy, dw, dh } = door;
        const texName = CellTextures[cell];
        if (!texName) continue;
        const img = Textures.get(texName);
        if (!img || !img.complete) continue;

        let rot = s.getRotation(gx, gy);
        if (rot === 0) {
          const hasNS = this.isWall(s.getCell(gx, gy - 1)) || this.isWall(s.getCell(gx, gy + 1));
          const hasEW = this.isWall(s.getCell(gx - 1, gy)) || this.isWall(s.getCell(gx + 1, gy));
          if (hasNS && !hasEW) rot = 1;
        }

        // PA-style sliding door: slides into adjacent wall
        const doorKey = gx + ',' + gy;
        const doorState = s._doorStates[doorKey];
        const openAmt = doorState ? doorState.open : 0;
        const slideOffset = openAmt * cellSize;

        if (rot === 1) {
          // Vertical door (N-S walls): sprite rotated 90°, slides upward
          ctx.save();
          ctx.translate(dx + dw / 2, dy + dh / 2 - slideOffset);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
          ctx.restore();
        } else {
          // Horizontal door (E-W walls): slides left
          ctx.drawImage(img, dx - slideOffset, dy, dw, dh);
        }
      }
    }

    // Pass 2C: Planning layer — draw planned walls/doors as outlines
    this._renderPlanGrid(ctx, s, cellSize, startGX, startGY, endGX, endGY);

    // Pass 3-4: Objects, highlights, room overlays (skip in utility mode)
    if (!utilMode) {
    // Pass 3: Objects — scale each sprite to fill footprint width, centered X, bottom-aligned Y
    // Sort by render layer: chairs/seating (0) → furniture (1) → lights/overhead (2), then by Y
    const sortedObjs = s.objects.slice().sort((a, b) => {
      const defA = ObjectDefs[a.type];
      const defB = ObjectDefs[b.type];
      const layerA = defA && defA.lightRadius ? 2 : CHAIR_TYPES.has(a.type) ? 0 : 1;
      const layerB = defB && defB.lightRadius ? 2 : CHAIR_TYPES.has(b.type) ? 0 : 1;
      if (layerA !== layerB) return layerA - layerB;
      return (a.gy + a.h) - (b.gy + b.h);
    });
    for (let i = 0; i < sortedObjs.length; i++) {
      const obj = sortedObjs[i];
      if (obj.gx + obj.w < startGX || obj.gx >= endGX ||
          obj.gy + obj.h < startGY || obj.gy >= endGY) continue;
      // Animated objects
      let tex = 'obj_' + obj.type;
      if (obj.type === 'server') {
        // Cycle through 3 "on" frames only (no off frame)
        const frame = Math.floor(Date.now() / 500) % 3;
        tex = frame === 0 ? 'obj_server_alt' : frame === 1 ? 'obj_server_alt2' : 'obj_server_alt3';
      } else if (obj.type === 'classroom_pc') {
        // Show "on" animation if a worker is nearby and working/sitting
        const inUse = s.workers.some(w =>
          (w.state === 'sitting' || w.state === 'working') &&
          Math.abs(w.x - (obj.gx + 0.5)) <= 1.5 &&
          Math.abs(w.y - (obj.gy + 1)) <= 1.5
        );
        if (inUse) {
          const frame = Math.floor(Date.now() / 500) % 2;
          tex = frame === 0 ? 'obj_classroom_pc_alt' : 'obj_classroom_pc_alt2';
        }
      }
      const img = Textures.get(tex);
      if (!img || !img.complete) continue;
      const fx = obj.gx * cellSize;
      const fy = obj.gy * cellSize;
      const fw = obj.w * cellSize;
      const fh = obj.h * cellSize;
      // PA-style object scaling: render at 64ppc base scale (cellSize/64).
      // Objects can extend beyond footprint (normal PA behavior for wide sprites).
      // Only scale UP if sprite is narrower than footprint at base scale.
      const baseScale = cellSize / 64;
      let dw = img.naturalWidth * baseScale;
      let dh = img.naturalHeight * baseScale;
      if (dw < fw) {
        const upScale = fw / dw;
        dw = fw;
        dh *= upScale;
      }
      const isSelected = obj.id === this._selectedObjId;
      if (isSelected && this._objMoveMode) continue;  // hide original when being moved (ghost shows at cursor)
      // Light-emitting objects render nearly invisible (they glow via the lightmap instead)
      const def = ObjectDefs[obj.type];
      const isLight = def && def.lightRadius;
      const isGhost = obj.ghost;
      if (isGhost) { ctx.save(); ctx.globalAlpha = 0.3; }
      else if (isLight && !isSelected) { ctx.save(); ctx.globalAlpha = 0.12; }
      else if (isSelected) { ctx.save(); ctx.globalAlpha = 0.5; }
      if (obj.rot === 0) {
        ctx.drawImage(img, fx + (fw - dw) / 2, fy + fh - dh, dw, dh);
      } else {
        if (!isSelected && !isGhost) ctx.save();
        ctx.translate(fx + fw / 2, fy + fh / 2);
        ctx.rotate(obj.rot * Math.PI / 2);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        if (!isSelected && !isGhost) ctx.restore();
      }
      if (isGhost) {
        ctx.restore();
        // Draw dashed orange border around ghost object
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);
        ctx.setLineDash([]);
        ctx.restore();
      } else if (isLight && !isSelected) ctx.restore();
      else if (isSelected) ctx.restore();
    }

    // Pass 3b: Food trays on serving tables
    if (s._servingFood > 0) {
      const trayImg = Textures.get('obj_food_tray');
      for (const obj of s.objects) {
        if (obj.type !== 'serving_table') continue;
        // Draw up to _servingFood trays evenly spaced along the table
        const count = Math.min(s._servingFood, obj.w);
        const traySize = cellSize * 0.45;
        for (let i = 0; i < count; i++) {
          const tx = obj.gx * cellSize + (i + 0.5) * (obj.w * cellSize / count) - traySize / 2;
          const ty = obj.gy * cellSize + (obj.h * cellSize - traySize) * 0.3;
          if (trayImg && trayImg.complete) {
            ctx.drawImage(trayImg, tx, ty, traySize, traySize);
          } else {
            // Fallback: draw colored rectangles
            ctx.fillStyle = 'rgba(180, 120, 60, 0.8)';
            ctx.fillRect(tx, ty, traySize, traySize * 0.6);
            ctx.fillStyle = 'rgba(200, 80, 40, 0.7)';
            ctx.fillRect(tx + 2, ty + 1, traySize * 0.4, traySize * 0.35);
            ctx.fillStyle = 'rgba(100, 170, 60, 0.7)';
            ctx.fillRect(tx + traySize * 0.5, ty + 1, traySize * 0.35, traySize * 0.35);
          }
        }
      }
    }

    // Pass 3a: Selected object highlight (PA-style: tinted overlay + border + name label)
    if (this._selectedObjId && !this._objMoveMode) {
      const selObj = s.objects.find(o => o.id === this._selectedObjId);
      if (selObj) {
        const sx = selObj.gx * cellSize;
        const sy = selObj.gy * cellSize;
        const sw = selObj.w * cellSize;
        const sh = selObj.h * cellSize;
        ctx.save();
        // Blue tint overlay
        ctx.fillStyle = this._objMoveMode ? 'rgba(232, 130, 26, 0.25)' : 'rgba(74, 144, 196, 0.25)';
        ctx.fillRect(sx, sy, sw, sh);
        // Solid border
        ctx.strokeStyle = this._objMoveMode ? '#e8821a' : '#4a90c4';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, sw, sh);
        // Object name label above
        if (cellSize > 10) {
          const def = ObjectDefs[selObj.type];
          const label = def ? def.name : selObj.type;
          ctx.font = `bold ${Math.max(9, cellSize * 0.3)}px 'Roboto Condensed', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const lx = sx + sw / 2;
          const ly = sy - 4;
          const tw = ctx.measureText(label).width;
          // Label background pill
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          const ph = cellSize * 0.35;
          const pw = tw + 8;
          ctx.beginPath();
          ctx.roundRect(lx - pw / 2, ly - ph, pw, ph, 3);
          ctx.fill();
          // Label text
          ctx.fillStyle = '#fff';
          ctx.fillText(label, lx, ly - 2);
        }
        ctx.restore();
      }
    }

    // Pass 3b: Desk claim labels — show worker name on their desk
    if (cellSize > 12) { // Only show when zoomed in enough
      ctx.font = `bold ${Math.max(7, cellSize * 0.22)}px 'Roboto Condensed', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const w of s.workers) {
        if (!w.claimedDesk) continue;
        const desk = s.objects.find(o => o.id === w.claimedDesk);
        if (!desk) continue;
        if (desk.gx + desk.w < startGX || desk.gx >= endGX ||
            desk.gy + desk.h < startGY || desk.gy >= endGY) continue;
        const lx = (desk.gx + desk.w / 2) * cellSize;
        const ly = (desk.gy + desk.h) * cellSize + 2;
        const wt = WorkerTypes[w.type] || {};
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const tw = ctx.measureText(w.name).width;
        ctx.fillRect(lx - tw / 2 - 2, ly - 1, tw + 4, cellSize * 0.25 + 2);
        ctx.fillStyle = wt.color || '#fff';
        ctx.fillText(w.name, lx, ly);
      }
    }

    // Pass 4: Room overlays
    for (const room of s.rooms) {
      if (room.x2 < startGX || room.x1 >= endGX ||
          room.y2 < startGY || room.y1 >= endGY) continue;
      const def = RoomDefs[room.type];
      if (!def) continue;
      const rx = room.x1 * cellSize;
      const ry = room.y1 * cellSize;
      const rw = (room.x2 - room.x1 + 1) * cellSize;
      const rh = (room.y2 - room.y1 + 1) * cellSize;

      ctx.fillStyle = def.color;
      ctx.fillRect(rx, ry, rw, rh);

      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = room.satisfied ? def.border : '#d9534f';
      ctx.lineWidth = 1 / s.camera.zoom;
      ctx.setLineDash(room.satisfied ? [] : [6 / s.camera.zoom, 4 / s.camera.zoom]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;

      // Room label
      const fontSize = Math.max(10, Math.min(14, 14 / s.camera.zoom));
      ctx.font = `bold ${fontSize}px "Roboto Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelX = rx + rw / 2;
      const pad = 4 / s.camera.zoom;

      let lines = [def.name];
      if (!room.satisfied) {
        const counts = {};
        for (const obj of s.objects) {
          if (obj.gx + obj.w > room.x1 && obj.gx <= room.x2 &&
              obj.gy + obj.h > room.y1 && obj.gy <= room.y2) {
            counts[obj.type] = (counts[obj.type] || 0) + 1;
          }
        }
        const missing = [];
        for (const req of def.requires) {
          const have = counts[req.type] || 0;
          if (have < req.count) {
            const objName = ObjectDefs[req.type]?.name || req.type;
            const need = req.count - have;
            missing.push(need + 'x ' + objName);
          }
        }
        if (missing.length) lines.push('Needs: ' + missing.join(', '));
      }

      const lineH = fontSize + 2 / s.camera.zoom;
      const totalH = lines.length * lineH + pad * 2;
      let maxW = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > maxW) maxW = w;
      }
      const boxW = maxW + pad * 4;

      // Center vertically in room
      const labelY = ry + (rh - totalH) / 2;

      ctx.globalAlpha = room.satisfied ? 0.45 : 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(labelX - boxW / 2, labelY, boxW, totalH);

      for (let li = 0; li < lines.length; li++) {
        ctx.fillStyle = li === 0
          ? (room.satisfied ? '#fff' : '#ffaaaa')
          : '#ffcc80';
        ctx.fillText(lines[li], labelX, labelY + pad + li * lineH);
      }
      ctx.globalAlpha = 1;
    }
    } // end if (!utilMode) — Pass 3-4

    // Pipeline flow lines (inside world transform)
    this.renderPipelineLines(ctx, s, cs);

    ctx.restore();

    if (!utilMode && s.camera.zoom > 0.5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let gx = startGX; gx <= endGX; gx++) {
        const x = Math.round(s.camera.x + gx * cs) + 0.5;
        ctx.moveTo(x, s.camera.y + startGY * cs);
        ctx.lineTo(x, s.camera.y + endGY * cs);
      }
      for (let gy = startGY; gy <= endGY; gy++) {
        const y = Math.round(s.camera.y + gy * cs) + 0.5;
        ctx.moveTo(s.camera.x + startGX * cs, y);
        ctx.lineTo(s.camera.x + endGX * cs, y);
      }
      ctx.stroke();
    }

    if (s.tools.isPlacing && s.tools.placeStart && s.tools.placeEnd) {
      const x1 = Math.min(s.tools.placeStart.x, s.tools.placeEnd.x);
      const y1 = Math.min(s.tools.placeStart.y, s.tools.placeEnd.y);
      const x2 = Math.max(s.tools.placeStart.x, s.tools.placeEnd.x);
      const y2 = Math.max(s.tools.placeStart.y, s.tools.placeEnd.y);

      const isDestructive = ['bulldoze', 'demolish_walls', 'clear_indoor'].includes(s.tools.activeItem?.id) || s.tools.activeItem?.objectAction === 'remove';

      if (isDestructive) {
        ctx.fillStyle = 'rgba(217, 83, 79, 0.3)';
        ctx.fillRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
      } else if (s.tools.activeItem?.roomType) {
        const rDef = RoomDefs[s.tools.activeItem.roomType];
        const w = x2 - x1 + 1, h = y2 - y1 + 1;
        const tooSmall = w < rDef.minW || h < rDef.minH;
        ctx.fillStyle = tooSmall ? 'rgba(217, 83, 79, 0.2)' : (rDef.color || 'rgba(74, 144, 196, 0.25)');
        ctx.fillRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
        ctx.strokeStyle = tooSmall ? '#d9534f' : (rDef.border || '#4a90c4');
        ctx.lineWidth = 2;
        ctx.setLineDash(tooSmall ? [4, 4] : []);
        ctx.strokeRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
        ctx.setLineDash([]);
        // Room name label centered in drag area
        ctx.font = 'bold 13px "Roboto Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = tooSmall ? '#d9534f' : '#fff';
        const label = rDef.name + (tooSmall ? ` (min ${rDef.minW}x${rDef.minH})` : '');
        ctx.fillText(label,
          s.camera.x + (x1 + (x2 - x1 + 1) / 2) * cs,
          s.camera.y + (y1 + (y2 - y1 + 1) / 2) * cs
        );
        this.drawDimensionLabels(ctx, s, cs, x1, y1, x2, y2);
      } else if (s.tools.activeItem?.planMode) {
        // Planning mode preview: white/orange outline per cell
        const isDoor = s.isDoor(s.tools.activeItem.cell);
        for (let x = x1; x <= x2; x++) {
          for (let y = y1; y <= y2; y++) {
            const px = s.camera.x + x * cs;
            const py = s.camera.y + y * cs;
            if (isDoor) {
              ctx.fillStyle = 'rgba(255, 152, 0, 0.3)';
              ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);
              ctx.strokeStyle = '#ff9800';
              ctx.lineWidth = 2;
              ctx.setLineDash([]);
              ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
            } else {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2);
              ctx.setLineDash([4, 3]);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.lineWidth = 2;
              ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
              ctx.setLineDash([]);
            }
          }
        }
      } else if (s.tools.activeItem?.planDemolish) {
        ctx.fillStyle = 'rgba(217, 83, 79, 0.2)';
        ctx.fillRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
      } else if (s.tools.activeItem?.mode === 'foundation') {
        ctx.fillStyle = 'rgba(74, 144, 196, 0.15)';
        ctx.fillRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
        ctx.fillStyle = 'rgba(26, 58, 92, 0.4)';
        ctx.fillRect(s.camera.x + x1 * cs, s.camera.y + y1 * cs, (x2 - x1 + 1) * cs, cs);
        if (y2 > y1) {
          ctx.fillRect(s.camera.x + x1 * cs, s.camera.y + y2 * cs, (x2 - x1 + 1) * cs, cs);
          ctx.fillRect(s.camera.x + x1 * cs, s.camera.y + (y1 + 1) * cs, cs, (y2 - y1 - 1) * cs);
          if (x2 > x1) {
            ctx.fillRect(s.camera.x + x2 * cs, s.camera.y + (y1 + 1) * cs, cs, (y2 - y1 - 1) * cs);
          }
        }
      } else if (s.tools.activeItem?.cell !== undefined && s.isWall(s.tools.activeItem.cell) && !s.isDoor(s.tools.activeItem.cell) && (x2 - x1 >= 1) && (y2 - y1 >= 1)) {
        // Wall rectangle drag: show border-only preview (like foundation)
        ctx.fillStyle = 'rgba(26, 58, 92, 0.15)';
        ctx.fillRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
        ctx.fillStyle = 'rgba(26, 58, 92, 0.4)';
        ctx.fillRect(s.camera.x + x1 * cs, s.camera.y + y1 * cs, (x2 - x1 + 1) * cs, cs);
        if (y2 > y1) {
          ctx.fillRect(s.camera.x + x1 * cs, s.camera.y + y2 * cs, (x2 - x1 + 1) * cs, cs);
          ctx.fillRect(s.camera.x + x1 * cs, s.camera.y + (y1 + 1) * cs, cs, (y2 - y1 - 1) * cs);
          if (x2 > x1) {
            ctx.fillRect(s.camera.x + x2 * cs, s.camera.y + (y1 + 1) * cs, cs, (y2 - y1 - 1) * cs);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(26, 58, 92, 0.35)';
        ctx.fillRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
      }

      if (!s.tools.activeItem?.roomType && !s.tools.activeItem?.planMode) {
        ctx.strokeStyle = isDestructive || s.tools.activeItem?.planDemolish ? '#d9534f' : '#4a90c4';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          s.camera.x + x1 * cs, s.camera.y + y1 * cs,
          (x2 - x1 + 1) * cs, (y2 - y1 + 1) * cs
        );
        ctx.setLineDash([]);

        this.drawDimensionLabels(ctx, s, cs, x1, y1, x2, y2);
      }
    }

    if (this._mouseGrid && s.tools.activeItem && !s.tools.isPlacing) {
      const item = s.tools.activeItem;
      const gx = this._mouseGrid.gx;
      const gy = this._mouseGrid.gy;
      const rot = s.tools.placeRotation;

      if (item.objectType) {
        const def = ObjectDefs[item.objectType];
        if (def) {
          const ow = rot % 2 === 0 ? def.w : def.h;
          const oh = rot % 2 === 0 ? def.h : def.w;
          const px = s.camera.x + gx * cs;
          const py = s.camera.y + gy * cs;
          const tex = 'obj_' + item.objectType;
          const img = Textures.get(tex);
          let blocked = false;
          for (let ox = 0; ox < ow; ox++) {
            for (let oy = 0; oy < oh; oy++) {
              const cx = gx + ox, cy = gy + oy;
              if (cx < 0 || cy < 0 || cx >= s.grid.width || cy >= s.grid.height) { blocked = true; break; }
              if (s.grid.objectGrid[cy * s.grid.width + cx]) { blocked = true; break; }
              const isWall = s.isWall(s.getCell(cx, cy));
              if (def.wallMount ? !isWall : isWall) { blocked = true; break; }
            }
            if (blocked) break;
          }
          if (img && img.complete) {
            ctx.save();
            ctx.globalAlpha = blocked ? 0.25 : 0.5;
            const fw = cs * ow;
            const fh = cs * oh;
            const pBaseScale = cs / 64;
            let dw = img.naturalWidth * pBaseScale;
            let dh = img.naturalHeight * pBaseScale;
            if (dw < fw) {
              const upScale = fw / dw;
              dw = fw;
              dh *= upScale;
            }
            if (rot === 0) {
              ctx.drawImage(img, px + (fw - dw) / 2, py + fh - dh, dw, dh);
            } else {
              ctx.translate(px + fw / 2, py + fh / 2);
              ctx.rotate(rot * Math.PI / 2);
              ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
            }
            ctx.restore();
          }
          ctx.strokeStyle = blocked ? 'rgba(217, 83, 79, 0.8)' : 'rgba(74, 144, 196, 0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, cs * ow, cs * oh);
        }
      } else {
        const pw = item.placeWidth || 1;
        let pw_x = pw, pw_y = 1;
        if (pw > 1) {
          const hasNS = this.isWall(s.getCell(gx, gy - 1)) || this.isWall(s.getCell(gx, gy + 1));
          const hasEW = this.isWall(s.getCell(gx - 1, gy)) || this.isWall(s.getCell(gx + 1, gy));
          if ((hasNS && !hasEW) || rot % 2 === 1) { pw_x = 1; pw_y = pw; }
        }

        const px = s.camera.x + gx * cs;
        const py = s.camera.y + gy * cs;

        const texName = item.cell !== undefined ? CellTextures[item.cell] : null;
        const img = texName ? Textures.get(texName) : null;

        if (img && img.complete) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          for (let ox = 0; ox < pw_x; ox++) {
            for (let oy = 0; oy < pw_y; oy++) {
              const cx = px + ox * cs + cs / 2;
              const cy = py + oy * cs + cs / 2;
              let cellImg = img;
              if (item.pairCell && (ox + oy) > 0) {
                const pairTex = CellTextures[item.pairCell];
                const pairImg = pairTex ? Textures.get(pairTex) : null;
                if (pairImg && pairImg.complete) cellImg = pairImg;
              }
              ctx.save();
              ctx.translate(cx, cy);
              if (rot > 0) ctx.rotate(rot * Math.PI / 2);
              ctx.drawImage(cellImg, -cs / 2, -cs / 2, cs, cs);
              ctx.restore();
            }
          }
          ctx.restore();
        }

        ctx.strokeStyle = 'rgba(74, 144, 196, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, cs * pw_x, cs * pw_y);
      }
    }

    // Worker ghost preview at cursor
    if (this._mouseGrid && s.tools.activeItem && s.tools.activeItem.workerType && !s.tools.isPlacing) {
      const wt = WorkerTypes[s.tools.activeItem.workerType];
      const spriteKey = (wt.sprite || 'guard') + '_front';
      const sprite = this._workerSprites[spriteKey];
      const gx = this._mouseGrid.gx;
      const gy = this._mouseGrid.gy;
      const wx = s.camera.x + (gx + 0.5) * cs;
      const wy = s.camera.y + (gy + 0.5) * cs;
      const spriteSize = Math.max(16, cs * 1.2);

      ctx.save();
      ctx.globalAlpha = 0.5;
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, wx - spriteSize / 2, wy - spriteSize / 2, spriteSize, spriteSize);
        ctx.imageSmoothingEnabled = true;
      } else {
        // Fallback: colored circle
        ctx.fillStyle = wt.color;
        ctx.beginPath();
        ctx.arc(wx, wy, spriteSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Object move-mode ghost preview
    if (this._objMoveMode && this._selectedObjId && this._mouseGrid) {
      const moveObj = s.objects.find(o => o.id === this._selectedObjId);
      if (moveObj) {
        const mgx = this._mouseGrid.gx;
        const mgy = this._mouseGrid.gy;
        const mpx = s.camera.x + mgx * cs;
        const mpy = s.camera.y + mgy * cs;
        const mfw = moveObj.w * cs;
        const mfh = moveObj.h * cs;
        const tex = 'obj_' + moveObj.type;
        const mimg = Textures.get(tex);
        // Check if placement is blocked (temporarily clear old cells)
        let mblocked = false;
        for (let ox = 0; ox < moveObj.w; ox++) {
          for (let oy = 0; oy < moveObj.h; oy++) {
            const cx = mgx + ox, cy = mgy + oy;
            if (cx < 0 || cx >= s.grid.width || cy < 0 || cy >= s.grid.height) { mblocked = true; break; }
            const existing = s.grid.objectGrid[cy * s.grid.width + cx];
            if (existing && existing !== moveObj.id) { mblocked = true; break; }
            const isWall = s.isWall(s.getCell(cx, cy));
            if (isWall) { mblocked = true; break; }
          }
          if (mblocked) break;
        }
        if (mimg && mimg.complete) {
          ctx.save();
          ctx.globalAlpha = mblocked ? 0.25 : 0.5;
          const mBaseScale = cs / 64;
          let mdw = mimg.naturalWidth * mBaseScale;
          let mdh = mimg.naturalHeight * mBaseScale;
          if (mdw < mfw) {
            const mUpScale = mfw / mdw;
            mdw = mfw;
            mdh *= mUpScale;
          }
          if (moveObj.rot === 0) {
            ctx.drawImage(mimg, mpx + (mfw - mdw) / 2, mpy + mfh - mdh, mdw, mdh);
          } else {
            ctx.translate(mpx + mfw / 2, mpy + mfh / 2);
            ctx.rotate(moveObj.rot * Math.PI / 2);
            ctx.drawImage(mimg, -mdw / 2, -mdh / 2, mdw, mdh);
          }
          ctx.restore();
        }
        ctx.strokeStyle = mblocked ? 'rgba(217, 83, 79, 0.8)' : 'rgba(74, 144, 196, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mpx, mpy, mfw, mfh);
      }
    }

    if (this._rightDrag && this._rightDrag.moved) {
      const x1 = Math.min(this._rightDrag.startX, this._rightDrag.endX);
      const y1 = Math.min(this._rightDrag.startY, this._rightDrag.endY);
      const x2 = Math.max(this._rightDrag.startX, this._rightDrag.endX);
      const y2 = Math.max(this._rightDrag.startY, this._rightDrag.endY);

      if (this._cloneMode) {
        // Clone selection: blue tint
        ctx.fillStyle = 'rgba(74, 144, 196, 0.2)';
        ctx.strokeStyle = 'rgba(74, 144, 196, 0.9)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      }
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(
        s.camera.x + x1 * cs,
        s.camera.y + y1 * cs,
        (x2 - x1 + 1) * cs,
        (y2 - y1 + 1) * cs
      );
      ctx.strokeRect(
        s.camera.x + x1 * cs,
        s.camera.y + y1 * cs,
        (x2 - x1 + 1) * cs,
        (y2 - y1 + 1) * cs
      );
      ctx.setLineDash([]);

      this.drawDimensionLabels(ctx, s, cs, x1, y1, x2, y2);
    }

    // Clone ghost preview at cursor
    if (this._cloneMode && this._cloneData && this._mouseGrid && !this._rightDrag) {
      this._renderClonePreview(ctx, s, cs);
    }

    // Move destination marker (fades out)
    if (this._moveMarker) {
      const elapsed = Date.now() - this._moveMarker.time;
      if (elapsed < 1000) {
        const alpha = 1 - elapsed / 1000;
        const mx = s.camera.x + (this._moveMarker.x + 0.5) * cs;
        const my = s.camera.y + (this._moveMarker.y + 0.5) * cs;
        const r = cs * 0.4 * (1 + elapsed / 2000);
        ctx.strokeStyle = `rgba(74, 220, 96, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mx, my, r, 0, Math.PI * 2);
        ctx.stroke();
        // Cross
        ctx.beginPath();
        ctx.moveTo(mx - r * 0.4, my);
        ctx.lineTo(mx + r * 0.4, my);
        ctx.moveTo(mx, my - r * 0.4);
        ctx.lineTo(mx, my + r * 0.4);
        ctx.stroke();
      } else {
        this._moveMarker = null;
      }
    }

    // Worker box-select drag rectangle
    if (this._workerDrag && this._workerDrag.moved) {
      const x1 = Math.min(this._workerDrag.startX, this._workerDrag.endX);
      const y1 = Math.min(this._workerDrag.startY, this._workerDrag.endY);
      const x2 = Math.max(this._workerDrag.startX, this._workerDrag.endX);
      const y2 = Math.max(this._workerDrag.startY, this._workerDrag.endY);

      ctx.fillStyle = 'rgba(74, 220, 96, 0.1)';
      ctx.strokeStyle = 'rgba(74, 220, 96, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(
        s.camera.x + x1 * cs,
        s.camera.y + y1 * cs,
        (x2 - x1 + 1) * cs,
        (y2 - y1 + 1) * cs
      );
      ctx.strokeRect(
        s.camera.x + x1 * cs,
        s.camera.y + y1 * cs,
        (x2 - x1 + 1) * cs,
        (y2 - y1 + 1) * cs
      );
      ctx.setLineDash([]);
    }

    if (utilMode) {
      // Utility mode: draw utility lines (no dark overlay — map is already grey)
      this._renderUtilities(ctx, s, cs, cw, ch);
      // No workers, delivery, or day/night in utility mode
    } else {
      this.renderWorkers(ctx, s, cs);

      // Delivery truck and driver
      this._renderDelivery(ctx, s, cs);

      // Day/night tint overlay
      this._renderDayNight(ctx, cw, ch, s);
    }
  },

  // ── Utility Rendering (lines, nodes, labels) ──
  _renderUtilities(ctx, s, cs, cw, ch) {
    ctx.save();

    // cs already includes zoom (cellSize * zoom), so no double-multiply
    const startX = Math.max(0, Math.floor(-s.camera.x / cs));
    const startY = Math.max(0, Math.floor(-s.camera.y / cs));
    const endX = Math.min(s.grid.width - 1, Math.ceil((-s.camera.x + cw) / cs));
    const endY = Math.min(s.grid.height - 1, Math.ceil((-s.camera.y + ch) / cs));

    const z = s.camera.zoom;

    // Draw utility lines (cell centers connected to neighbors with same type)
    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        const ut = s.getUtility(gx, gy);
        if (ut === UT.EMPTY) continue;

        const def = UtilityDefs[ut];
        if (!def) continue;

        const cx1 = s.camera.x + (gx + 0.5) * cs;
        const cy1 = s.camera.y + (gy + 0.5) * cs;

        // Draw node dot (larger in utility mode for visibility)
        ctx.fillStyle = def.color;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(cx1, cy1, Math.max(3.5, cs * 0.14), 0, Math.PI * 2);
        ctx.fill();

        // Glow halo around node
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(cx1, cy1, Math.max(6, cs * 0.25), 0, Math.PI * 2);
        ctx.fill();

        // Draw connections to right and down neighbors (avoid double-draw)
        ctx.strokeStyle = def.color;
        ctx.lineWidth = (def.lineWidth + 0.5) * z;
        ctx.setLineDash(def.dash.map(d => d * z));
        ctx.globalAlpha = 0.9;

        // Right neighbor
        const rut = s.getUtility(gx + 1, gy);
        if (this._utilityConnects(ut, rut)) {
          const cx2 = s.camera.x + (gx + 1.5) * cs;
          ctx.beginPath();
          ctx.moveTo(cx1, cy1);
          ctx.lineTo(cx2, cy1);
          ctx.stroke();
        }

        // Down neighbor
        const dut = s.getUtility(gx, gy + 1);
        if (this._utilityConnects(ut, dut)) {
          const cy2 = s.camera.y + (gy + 1.5) * cs;
          ctx.beginPath();
          ctx.moveTo(cx1, cy1);
          ctx.lineTo(cx1, cy2);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // Check if two utility types should visually connect
  // Same family connects: all power ↔ power, water ↔ water, network ↔ network
  _utilityFamily(u) {
    if (u === UT.POWER_CABLE || u === UT.POWER_CABLE_HEAVY || u === UT.POWER_SOURCE) return 'power';
    if (u === UT.WATER_PIPE_SMALL || u === UT.WATER_PIPE_LARGE || u === UT.WATER_SOURCE) return 'water';
    if (u === UT.ETHERNET_CAT5E || u === UT.ETHERNET_CAT6 || u === UT.ETHERNET_FIBER || u === UT.NETWORK_SOURCE) return 'network';
    return null;
  },
  _utilityConnects(a, b) {
    if (a === UT.EMPTY || b === UT.EMPTY) return false;
    if (a === b) return true;
    const fa = this._utilityFamily(a);
    const fb = this._utilityFamily(b);
    return fa !== null && fa === fb;
  },

  // Time-of-day periods and their tint colors/opacity
  _dayNightStops: [
    // [hour, r, g, b, opacity]  — PA-style: very dark at night
    [0,     5,  8, 25, 0.78],   // Midnight — near black
    [3,     5,  8, 25, 0.78],   // Deep night — near black
    [5,    15, 15, 40, 0.65],   // Pre-dawn — still very dark
    [5.5,  30, 25, 50, 0.45],   // First light — dark indigo
    [6,    50, 40, 30, 0.25],   // Dawn — amber glow breaking
    [6.5,  60, 45, 20, 0.12],   // Sunrise — warm golden
    [7.5,  30, 20, 10, 0.04],   // Early morning — faint warmth
    [8,     0,  0,  0, 0.00],   // Morning — clear
    [16,    0,  0,  0, 0.00],   // Afternoon — clear
    [17,   40, 25, 10, 0.04],   // Late afternoon — hint of amber
    [18,   60, 35, 10, 0.10],   // Golden hour
    [19,   55, 25, 30, 0.22],   // Sunset — orange-pink
    [20,   35, 20, 50, 0.40],   // Dusk — purple
    [21,   15, 12, 40, 0.60],   // Twilight — dark blue
    [22,    8, 10, 30, 0.72],   // Night — very dark
    [24,    5,  8, 25, 0.78],   // Midnight wrap
  ],

  _getSunInfo(s) {
    const hour = (s.facility.time / 60) % 24;
    // Sun rises at 6, peaks at 12, sets at 18
    // Sun angle: 0° = east (6AM), 90° = south/overhead (12PM), 180° = west (6PM)
    const sunProgress = Math.max(0, Math.min(1, (hour - 6) / 12)); // 0 at 6AM, 1 at 6PM

    // Sun angle across the sky (radians): east to west
    const sunAngle = sunProgress * Math.PI; // 0 = east, PI = west

    // Shadow direction is opposite the sun
    // At dawn (sun east), shadows point west (+x)
    // At noon (sun overhead), shadows are short and point south (+y slightly)
    // At dusk (sun west), shadows point east (-x)
    const shadowDirX = -Math.cos(sunAngle);
    const shadowDirY = 0.5 + 0.3 * Math.sin(sunAngle); // Always some forward/south component

    // Sun elevation: peaks at noon, low at dawn/dusk
    const elevation = Math.sin(sunProgress * Math.PI); // 0 at edges, 1 at noon

    // Shadow length: long at dawn/dusk (low elevation), short at noon
    const shadowLen = 0.3 + 2.5 * (1 - elevation);

    // Shadow opacity: strongest at midday, fades at dawn/dusk, none at night
    let opacity = 0;
    if (hour >= 6 && hour <= 18) {
      opacity = 0.15 + 0.15 * elevation; // 0.15 at dawn/dusk, 0.30 at noon
    } else if (hour > 5 && hour < 6) {
      opacity = 0.15 * (hour - 5); // fade in
    } else if (hour > 18 && hour < 19) {
      opacity = 0.15 * (19 - hour); // fade out
    }

    return { shadowDirX, shadowDirY, shadowLen, opacity, hour };
  },

  _renderShadows(ctx, s, cellSize, startGX, startGY, endGX, endGY) {
    const sun = this._getSunInfo(s);
    if (sun.opacity < 0.01) return;

    // Direction TO the sun (we trace toward sun to check for blocking walls)
    const toSunX = -sun.shadowDirX;
    const toSunY = -sun.shadowDirY;
    const maxTrace = Math.ceil(sun.shadowLen) + 1;

    ctx.save();

    // For each visible cell, check if it's outdoor and in shadow
    for (let gy = startGY; gy < endGY; gy++) {
      for (let gx = startGX; gx < endGX; gx++) {
        const cell = s.getCell(gx, gy);

        // Only cast shadows on outdoor/empty cells — skip walls and indoor floors
        if (this.isWall(cell) || s.isDoor(cell)) continue;
        // Skip indoor floors (cell types 50-73)
        if (cell >= 50 && cell <= 73) continue;
        // Skip empty cells with no ground
        if (cell === CT.EMPTY) continue;

        // Trace toward the sun — if we hit a wall, this cell is in shadow
        let inShadow = false;
        let shadowDist = 0;

        for (let step = 1; step <= maxTrace; step++) {
          const traceX = Math.round(gx + toSunX * step);
          const traceY = Math.round(gy + toSunY * step);
          const traceCell = s.getCell(traceX, traceY);
          if (this.isWall(traceCell)) {
            inShadow = true;
            shadowDist = step;
            break;
          }
        }

        if (inShadow) {
          // Opacity fades with distance from the wall
          const falloff = 1 - (shadowDist - 1) / maxTrace;
          const alpha = sun.opacity * falloff * falloff; // quadratic falloff for soft edge
          if (alpha < 0.01) continue;

          ctx.fillStyle = `rgba(0, 5, 20, ${alpha})`;
          ctx.fillRect(gx * cellSize, gy * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }

    ctx.restore();
  },

  // ── Planning Grid Rendering ──
  _renderPlanGrid(ctx, s, cellSize, startGX, startGY, endGX, endGY) {
    const planGrid = s.grid.planGrid;
    if (!planGrid) return;
    let hasPlan = false;
    for (let gx = startGX; gx < endGX; gx++) {
      for (let gy = startGY; gy < endGY; gy++) {
        const val = planGrid[gy * s.grid.width + gx];
        if (val === 0) continue;
        hasPlan = true;
        const px = gx * cellSize;
        const py = gy * cellSize;

        const isDoor = s.isDoor(val);
        if (isDoor) {
          // Orange filled rectangle for planned doors
          ctx.fillStyle = 'rgba(255, 152, 0, 0.35)';
          ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
          ctx.strokeStyle = '#ff9800';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
        } else {
          // White dashed outline for planned walls
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
          ctx.setLineDash([]);
          // Light white fill
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
        }
      }
    }
  },

  // ── Clone Tool Methods ──
  _captureClone() {
    const s = AppState;
    const rd = this._rightDrag;
    if (!rd || !rd.moved) return;

    const x1 = Math.min(rd.startX, rd.endX);
    const y1 = Math.min(rd.startY, rd.endY);
    const x2 = Math.max(rd.startX, rd.endX);
    const y2 = Math.max(rd.startY, rd.endY);
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;

    // Capture cells
    const cells = new Uint8Array(w * h);
    const rotations = new Uint8Array(w * h);
    for (let ox = 0; ox < w; ox++) {
      for (let oy = 0; oy < h; oy++) {
        const gx = x1 + ox, gy = y1 + oy;
        cells[oy * w + ox] = s.getCell(gx, gy);
        rotations[oy * w + ox] = s.getRotation(gx, gy);
      }
    }

    // Capture objects (relative positions)
    const objects = [];
    const seen = new Set();
    for (let ox = 0; ox < w; ox++) {
      for (let oy = 0; oy < h; oy++) {
        const obj = s.getObjectAt(x1 + ox, y1 + oy);
        if (obj && !seen.has(obj.id)) {
          seen.add(obj.id);
          objects.push({
            type: obj.type,
            rx: obj.gx - x1,
            ry: obj.gy - y1,
            rot: obj.rot,
            w: obj.w,
            h: obj.h,
          });
        }
      }
    }

    this._cloneData = { cells, rotations, width: w, height: h, objects };
  },

  _stampClone(gx, gy) {
    const s = AppState;
    const cd = this._cloneData;
    if (!cd) return;

    // Place cells
    for (let ox = 0; ox < cd.width; ox++) {
      for (let oy = 0; oy < cd.height; oy++) {
        const cell = cd.cells[oy * cd.width + ox];
        if (cell !== 0) {
          s.setCell(gx + ox, gy + oy, cell);
          s.setRotation(gx + ox, gy + oy, cd.rotations[oy * cd.width + ox]);
        }
      }
    }

    // Place objects
    for (const obj of cd.objects) {
      s.addObject(obj.type, gx + obj.rx, gy + obj.ry, obj.rot);
    }

    s.recheckAllRooms();
  },

  _renderClonePreview(ctx, s, cs) {
    const cd = this._cloneData;
    const mg = this._mouseGrid;
    if (!cd || !mg) return;

    const baseX = s.camera.x + mg.gx * cs;
    const baseY = s.camera.y + mg.gy * cs;

    ctx.save();
    ctx.globalAlpha = 0.4;

    // Draw cloned cells
    for (let ox = 0; ox < cd.width; ox++) {
      for (let oy = 0; oy < cd.height; oy++) {
        const cell = cd.cells[oy * cd.width + ox];
        if (cell === 0) continue;
        const px = baseX + ox * cs;
        const py = baseY + oy * cs;

        if (this.isWall(cell)) {
          ctx.fillStyle = 'rgba(180, 180, 180, 0.6)';
        } else {
          ctx.fillStyle = 'rgba(100, 140, 180, 0.5)';
        }
        ctx.fillRect(px, py, cs, cs);
      }
    }

    // Draw cloned objects
    const cBaseScale = cs / 64;
    for (const obj of cd.objects) {
      const tex = 'obj_' + obj.type;
      const img = Textures.get(tex);
      if (!img || !img.complete) continue;
      const fx = baseX + obj.rx * cs;
      const fy = baseY + obj.ry * cs;
      const fw = obj.w * cs;
      const fh = obj.h * cs;
      let dw = img.naturalWidth * cBaseScale;
      let dh = img.naturalHeight * cBaseScale;
      if (dw < fw) {
        const cUpScale = fw / dw;
        dw = fw;
        dh *= cUpScale;
      }
      ctx.drawImage(img, fx + (fw - dw) / 2, fy + fh - dh, dw, dh);
    }

    ctx.restore();

    // Outline
    ctx.strokeStyle = 'rgba(74, 144, 196, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(baseX, baseY, cd.width * cs, cd.height * cs);
    ctx.setLineDash([]);
  },

  _renderDelivery(ctx, s, cs) {
    // Rendered in screen space (after ctx.restore from world transform)
    // Use same projection as renderWorkers: screenX = s.camera.x + gridX * cs

    // Render truck on road
    if (s._truckState !== 'idle') {
      const truckImg = Textures.get('obj_supply_truck');
      if (truckImg && truckImg.complete) {
        // Truck sprite is 64x240 at UNIT=16. In our 32px cells: 2 cells wide, 7.5 cells tall
        const truckW = 2 * cs;
        const truckH = 7.5 * cs;
        const tx = s.camera.x + 92 * cs;
        const ty = s.camera.y + s._truckY * cs;
        ctx.drawImage(truckImg, tx, ty, truckW, truckH);
      }

      // Render truck driver (when not in truck)
      if (s._truckDriverState !== 'in_truck' && s._truckDriverState !== 'done') {
        const driverImg = Textures.get('obj_truck_driver');
        const dSize = cs * 0.8;
        const dx = s.camera.x + s._truckDriverX * cs;
        const dy = s.camera.y + s._truckDriverY * cs;
        if (driverImg && driverImg.complete) {
          ctx.drawImage(driverImg, dx - dSize / 2, dy - dSize / 2, dSize, dSize);
        } else {
          // Fallback: colored circle
          ctx.fillStyle = '#ff9800';
          ctx.beginPath();
          ctx.arc(dx, dy, cs * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Render progress bar for installing workers
    for (const w of s.workers) {
      if (w.state === 'installing' && w._cargoObjId) {
        const obj = s.objects.find(o => o.id === w._cargoObjId);
        if (obj) {
          const px = s.camera.x + obj.gx * cs;
          const py = s.camera.y + obj.gy * cs - 6;
          const pw = obj.w * cs;
          const progress = Math.min(1, (w._installTimer || 0) / 4);
          // Background bar
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(px, py, pw, 4);
          // Progress fill
          ctx.fillStyle = '#5cb85c';
          ctx.fillRect(px, py, pw * progress, 4);
          // Border
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px, py, pw, 4);
        }
      }
      // Render crate on worker's back when delivering
      if ((w.state === 'delivering' || w.state === 'walking') && w._cargoObjId) {
        const crateImg = Textures.get('obj_crate');
        if (crateImg && crateImg.complete) {
          const cSize = cs * 0.4;
          const cx = s.camera.x + w.x * cs - cSize / 2;
          const cy = s.camera.y + w.y * cs - cs * 0.6;
          ctx.drawImage(crateImg, cx, cy, cSize, cSize);
        }
      }
    }
  },

  _renderDayNight(ctx, cw, ch, s) {
    const hour = (s.facility.time / 60) % 24;
    const stops = this._dayNightStops;

    // Find the two stops we're between
    let i = 0;
    while (i < stops.length - 1 && stops[i + 1][0] <= hour) i++;
    if (i >= stops.length - 1) i = stops.length - 2;

    const [h0, r0, g0, b0, a0] = stops[i];
    const [h1, r1, g1, b1, a1] = stops[i + 1];
    const t = (hour - h0) / (h1 - h0);

    const r = Math.round(r0 + (r1 - r0) * t);
    const g = Math.round(g0 + (g1 - g0) * t);
    const b = Math.round(b0 + (b1 - b0) * t);
    const nightAlpha = a0 + (a1 - a0) * t;

    if (nightAlpha < 0.005) return;

    // ── Shadow-casting lightmap approach ──
    // 1. Create offscreen lightmap (darkness layer)
    // 2. For each light, raycast to build a visibility polygon that stops at walls
    // 3. Fill the visibility polygon with radial gradient to punch through darkness
    // 4. Composite onto main canvas

    const cs = s.grid.cellSize * s.camera.zoom;
    const camX = s.camera.x;
    const camY = s.camera.y;

    // Get or create offscreen lightmap canvas
    if (!this._lightmapCanvas || this._lightmapCanvas.width !== cw || this._lightmapCanvas.height !== ch) {
      this._lightmapCanvas = document.createElement('canvas');
      this._lightmapCanvas.width = cw;
      this._lightmapCanvas.height = ch;
    }
    const lctx = this._lightmapCanvas.getContext('2d');

    // Fill lightmap with darkness
    lctx.clearRect(0, 0, cw, ch);
    lctx.fillStyle = `rgba(${r},${g},${b},${nightAlpha})`;
    lctx.fillRect(0, 0, cw, ch);

    // Use 'destination-out' to punch light holes in the darkness
    lctx.globalCompositeOperation = 'destination-out';

    // ── Raycast shadow helper ──
    // Cast a ray from (ox, oy) in grid space at angle, stopping at walls or maxDist
    const _castRay = (ox, oy, angle, maxDist) => {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const stepSize = 0.3; // step in grid units (smaller = more accurate)
      let dist = 0;
      let px = ox, py = oy;
      while (dist < maxDist) {
        dist += stepSize;
        px = ox + dx * dist;
        py = oy + dy * dist;
        const gx = Math.floor(px);
        const gy = Math.floor(py);
        // Bounds check
        if (gx < 0 || gx >= s.grid.width || gy < 0 || gy >= s.grid.height) {
          return { x: px, y: py, dist };
        }
        // Wall check (doors pass light)
        const cell = s.getCell(gx, gy);
        if (cell >= 1 && cell <= 46 && !s.isDoor(cell)) {
          // Hit a wall — return point slightly inside the wall for clean edges
          return { x: px, y: py, dist };
        }
      }
      return { x: px, y: py, dist: maxDist };
    };

    // Number of rays per light (more = smoother shadows, but heavier)
    const RAY_COUNT = 90;
    const ANGLE_STEP = (Math.PI * 2) / RAY_COUNT;

    // ── Light sources from objects ──
    for (const obj of s.objects) {
      const def = ObjectDefs[obj.type];
      if (!def || !def.lightRadius) continue;
      if (obj.ghost) continue; // ghost objects don't emit light

      // Light origin in grid space (center of object)
      const lx = obj.gx + obj.w / 2;
      const ly = obj.gy + obj.h / 2;
      const maxDist = def.lightRadius;

      // Screen position of light center
      const screenCX = camX + lx * cs;
      const screenCY = camY + ly * cs;
      const screenRadius = maxDist * cs;

      // Quick frustum cull — skip lights entirely off-screen
      if (screenCX + screenRadius < 0 || screenCX - screenRadius > cw ||
          screenCY + screenRadius < 0 || screenCY - screenRadius > ch) continue;

      // Cast rays to build visibility polygon
      const polyPoints = [];
      for (let i = 0; i < RAY_COUNT; i++) {
        const angle = i * ANGLE_STEP;
        const hit = _castRay(lx, ly, angle, maxDist);
        // Convert hit point to screen space
        polyPoints.push({
          x: camX + hit.x * cs,
          y: camY + hit.y * cs,
          dist: hit.dist
        });
      }

      // Draw the visibility polygon with a radial gradient fill
      // Use a clipping path so the gradient only fills the visible area
      lctx.save();

      // Build the clipping polygon from raycast results
      lctx.beginPath();
      lctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      for (let i = 1; i < polyPoints.length; i++) {
        lctx.lineTo(polyPoints[i].x, polyPoints[i].y);
      }
      lctx.closePath();
      lctx.clip();

      // Fill with radial gradient (punches through darkness within the clipped polygon)
      const grad = lctx.createRadialGradient(screenCX, screenCY, 0, screenCX, screenCY, screenRadius);
      const intensity = Math.min(nightAlpha * 1.5, 1);
      grad.addColorStop(0, `rgba(255,255,255,${intensity})`);
      grad.addColorStop(0.2, `rgba(255,255,255,${intensity * 0.95})`);
      grad.addColorStop(0.5, `rgba(255,255,255,${intensity * 0.6})`);
      grad.addColorStop(0.75, `rgba(255,255,255,${intensity * 0.3})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = grad;
      lctx.fillRect(screenCX - screenRadius, screenCY - screenRadius, screenRadius * 2, screenRadius * 2);

      lctx.restore();
    }

    // ── Indoor rooms are automatically lit (bright, even fill) ──
    if (nightAlpha > 0.05) {
      const roomBrightness = Math.min(nightAlpha * 1.2, 0.92);
      for (const room of s.rooms) {
        const rx = camX + room.x1 * cs;
        const ry = camY + room.y1 * cs;
        const rw = (room.x2 - room.x1 + 1) * cs;
        const rh = (room.y2 - room.y1 + 1) * cs;
        // Clip room light to room bounds (doesn't leak through walls)
        lctx.save();
        lctx.beginPath();
        lctx.rect(rx, ry, rw, rh);
        lctx.clip();
        // Mostly even fill with slight falloff at edges (like overhead fluorescents)
        const rcx = rx + rw / 2;
        const rcy = ry + rh / 2;
        const maxDim = Math.max(rw, rh) * 0.85;
        const grad = lctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, maxDim);
        grad.addColorStop(0, `rgba(255,255,255,${roomBrightness})`);
        grad.addColorStop(0.6, `rgba(255,255,255,${roomBrightness * 0.95})`);
        grad.addColorStop(0.85, `rgba(255,255,255,${roomBrightness * 0.75})`);
        grad.addColorStop(1, `rgba(255,255,255,${roomBrightness * 0.5})`);
        lctx.fillStyle = grad;
        lctx.fillRect(rx, ry, rw, rh);
        lctx.restore();
      }
    }

    lctx.globalCompositeOperation = 'source-over';

    // ── Composite lightmap (darkness with holes) onto main canvas ──
    ctx.drawImage(this._lightmapCanvas, 0, 0);

    // ── Warm glow pass: add warm tint where lights are (also shadow-aware) ──
    if (nightAlpha > 0.1) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glowStrength = Math.min(nightAlpha * 0.25, 0.15);
      for (const obj of s.objects) {
        const def = ObjectDefs[obj.type];
        if (!def || !def.lightRadius) continue;
        if (obj.ghost) continue;

        const lx = obj.gx + obj.w / 2;
        const ly = obj.gy + obj.h / 2;
        const maxDist = def.lightRadius;
        const screenCX = camX + lx * cs;
        const screenCY = camY + ly * cs;
        const screenRadius = maxDist * cs * 0.7;
        const [lr, lg, lb] = def.lightColor;

        // Raycast again for glow polygon (use fewer rays for perf)
        const GLOW_RAYS = 60;
        const glowStep = (Math.PI * 2) / GLOW_RAYS;
        ctx.beginPath();
        for (let i = 0; i < GLOW_RAYS; i++) {
          const angle = i * glowStep;
          const hit = _castRay(lx, ly, angle, maxDist * 0.7);
          const sx = camX + hit.x * cs;
          const sy = camY + hit.y * cs;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.save();
        ctx.clip();

        const grad = ctx.createRadialGradient(screenCX, screenCY, 0, screenCX, screenCY, screenRadius);
        grad.addColorStop(0, `rgba(${lr},${lg},${lb},${glowStrength})`);
        grad.addColorStop(0.5, `rgba(${lr},${lg},${lb},${glowStrength * 0.4})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(screenCX - screenRadius, screenCY - screenRadius, screenRadius * 2, screenRadius * 2);
        ctx.restore();
      }
      ctx.restore();
    }
  },

  drawDimensionLabels(ctx, s, cs, x1, y1, x2, y2) {
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Share Tech Mono", monospace';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 3;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const bx = s.camera.x + (x1 + w / 2) * cs;
    const by = s.camera.y + (y2 + 1) * cs + 4;
    ctx.fillText(`${w}m`, bx, by);

    ctx.save();
    const rx = s.camera.x + (x2 + 1) * cs + 4;
    const ry = s.camera.y + (y1 + h / 2) * cs;
    ctx.translate(rx, ry);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${h}m`, 0, 0);
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
  },

  _loadWorkerSprites() {
    const sprites = ['workman', 'accountant', 'doctor', 'chef', 'janitor', 'gardener', 'lawyer', 'shrink', 'teacher'];
    const dirs = ['front', 'back', 'left', 'right'];
    let loaded = 0, failed = 0;
    const total = sprites.length * dirs.length;
    for (const sprite of sprites) {
      for (const dir of dirs) {
        const key = sprite + '_' + dir;
        const img = new Image();
        img.onload = () => { loaded++; if (loaded + failed === total) console.log(`[Workers] Sprites loaded: ${loaded}/${total}`); };
        img.onerror = () => { failed++; console.warn(`[Workers] FAILED to load sprite: ${key} (assets/textures/workers/${key}.webp)`); };
        img.src = 'assets/textures/workers/' + sprite + '/' + dir + '.webp';
        this._workerSprites[key] = img;
      }
    }
  },

  _getWorkerDirection(w) {
    // Determine facing direction from movement
    if (w.state === 'sitting' || w.state === 'working' || w.state === 'eating') return 'front';
    // Use current path waypoint for direction
    let tx = w.x, ty = w.y;
    if (w._path && w._pathIdx < w._path.length) {
      tx = w._path[w._pathIdx].x;
      ty = w._path[w._pathIdx].y;
    }
    const dx = tx - w.x;
    const dy = ty - w.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return 'front';
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'front' : 'back';
    }
  },

  renderWorkers(ctx, s, cs) {
    const now = Date.now();
    for (const w of s.workers) {
      const wx = s.camera.x + w.x * cs;
      const wy = s.camera.y + w.y * cs;
      const seated = (w.state === 'sitting' || w.state === 'working' || w.state === 'eating');
      const scale = seated ? 0.7 : 1;
      const spriteSize = Math.max(16, cs * 1.2) * scale;

      // Get sprite
      const wt = WorkerTypes[w.type] || {};
      const dir = this._getWorkerDirection(w);
      const spriteKey = (wt.sprite || 'guard') + '_' + dir;
      const sprite = this._workerSprites[spriteKey];

      // Selection highlight
      const isSelected = this._selectedWorkers.includes(w.id);
      if (isSelected) {
        ctx.strokeStyle = 'rgba(74, 220, 96, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.ellipse(wx, wy + spriteSize * 0.1, spriteSize * 0.45, spriteSize * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(wx, wy + spriteSize * 0.4, spriteSize * 0.3, spriteSize * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // State ring
      if (w.state === 'working' || w.state === 'installing') {
        const pulse = 0.5 + 0.5 * Math.sin(now / 300);
        ctx.strokeStyle = `rgba(232, 130, 26, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, spriteSize * 0.5 + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (w.state === 'sitting') {
        ctx.strokeStyle = 'rgba(74, 144, 196, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx, wy, spriteSize * 0.5 + 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (w.state === 'delivering') {
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx, wy, spriteSize * 0.5 + 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (w.state === 'eating') {
        ctx.strokeStyle = 'rgba(139, 195, 74, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx, wy, spriteSize * 0.5 + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw sprite
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite,
          wx - spriteSize / 2,
          wy - spriteSize / 2,
          spriteSize,
          spriteSize
        );
        ctx.imageSmoothingEnabled = true;
      } else {
        // Fallback: colored circle
        ctx.fillStyle = w.color;
        ctx.beginPath();
        ctx.arc(wx, wy, spriteSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Food tray carried by worker (when picking up food or eating)
      if (w._hasTray) {
        const trayImg = Textures.get('obj_food_tray');
        const traySize = spriteSize * 0.4;
        const trayX = wx + spriteSize * 0.15;
        const trayY = wy + spriteSize * 0.05;
        if (trayImg && trayImg.complete) {
          ctx.drawImage(trayImg, trayX, trayY, traySize, traySize);
        } else {
          ctx.fillStyle = 'rgba(180, 120, 60, 0.85)';
          ctx.fillRect(trayX, trayY, traySize, traySize * 0.6);
        }
      }

      // Name + role label above head with background pill
      if (s.camera.zoom > 0.6) {
        const wt = WorkerTypes[w.type] || {};
        const nameFont = `bold ${Math.max(9, 10 * s.camera.zoom)}px "Roboto Condensed", sans-serif`;
        const roleFont = `${Math.max(8, 9 * s.camera.zoom)}px "Roboto Condensed", sans-serif`;
        ctx.textAlign = 'center';

        // Measure text to draw background
        ctx.font = nameFont;
        const nameWidth = ctx.measureText(w.name).width;
        ctx.font = roleFont;
        const roleText = wt.name || w.type;
        const roleWidth = ctx.measureText(roleText).width;
        const pillW = Math.max(nameWidth, roleWidth) + 10;
        const pillH = Math.max(18, 22 * s.camera.zoom);
        const pillX = wx - pillW / 2;
        const pillY = wy - spriteSize / 2 - pillH - 6;

        // Background pill
        const radius = 4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.moveTo(pillX + radius, pillY);
        ctx.lineTo(pillX + pillW - radius, pillY);
        ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + radius);
        ctx.lineTo(pillX + pillW, pillY + pillH - radius);
        ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - radius, pillY + pillH);
        ctx.lineTo(pillX + radius, pillY + pillH);
        ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - radius);
        ctx.lineTo(pillX, pillY + radius);
        ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
        ctx.closePath();
        ctx.fill();

        // Name (bold, white)
        ctx.fillStyle = '#ffffff';
        ctx.font = nameFont;
        ctx.fillText(w.name, wx, pillY + pillH * 0.4);

        // Role (colored by worker type)
        ctx.fillStyle = wt.color || '#aaaaaa';
        ctx.font = roleFont;
        ctx.fillText(roleText, wx, pillY + pillH * 0.82);

        // Task label (when working or eating)
        if ((w.state === 'working' || w.state === 'eating') && w.taskLabel && s.camera.zoom > 0.7) {
          ctx.fillStyle = w.state === 'eating' ? 'rgba(139, 195, 74, 0.9)' : 'rgba(232, 130, 26, 0.9)';
          ctx.font = roleFont;
          ctx.fillText(w.taskLabel, wx, wy + spriteSize / 2 + 10);
        }
      }
    }
  },

  // Pipeline flow lines rendered on desk hover
  renderPipelineLines(ctx, s, cs) {
    if (!this._mouseGrid) return;
    const obj = s.getObjectAt(this._mouseGrid.gx, this._mouseGrid.gy);
    if (!obj) return;
    const room = s.getRoomAt(obj.gx, obj.gy);
    if (!room) return;
    const rp = s.roomPipelines[room.id];
    if (!rp || !rp.deskOrder || rp.deskOrder.length < 2) return;

    // Check if hovered desk is in the pipeline
    if (!rp.deskOrder.includes(obj.id)) return;

    ctx.save();
    const dashOffset = (Date.now() / 50) % 20;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.lineWidth = 2 / s.camera.zoom;
    ctx.strokeStyle = '#e8821a';

    const cellSize = s.grid.cellSize;
    for (let i = 0; i < rp.deskOrder.length - 1; i++) {
      const fromObj = s.objects.find(o => o.id === rp.deskOrder[i]);
      const toObj = s.objects.find(o => o.id === rp.deskOrder[i + 1]);
      if (!fromObj || !toObj) continue;

      const fx = (fromObj.gx + fromObj.w / 2) * cellSize;
      const fy = (fromObj.gy + fromObj.h / 2) * cellSize;
      const tx = (toObj.gx + toObj.w / 2) * cellSize;
      const ty = (toObj.gy + toObj.h / 2) * cellSize;

      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(ty - fy, tx - fx);
      const aLen = 8 / s.camera.zoom;
      ctx.fillStyle = '#e8821a';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - aLen * Math.cos(angle - 0.4), ty - aLen * Math.sin(angle - 0.4));
      ctx.lineTo(tx - aLen * Math.cos(angle + 0.4), ty - aLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }

    // Number badges
    ctx.setLineDash([]);
    for (let i = 0; i < rp.deskOrder.length; i++) {
      const dObj = s.objects.find(o => o.id === rp.deskOrder[i]);
      if (!dObj) continue;
      const bx = (dObj.gx + dObj.w / 2) * cellSize;
      const by = dObj.gy * cellSize - 6 / s.camera.zoom;
      const br = 8 / s.camera.zoom;
      ctx.fillStyle = '#e8821a';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(8, 10 / s.camera.zoom)}px "Roboto Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), bx, by);
    }
    ctx.restore();
  },

  _moveSelectedWorkers(gx, gy) {
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
  },

  showWorkerPanel(worker) {
    AppState.ui.selectedWorker = worker;
    const panel = document.getElementById('workerPanel');
    if (!panel) return;
    panel.classList.remove('hidden');
    const wt = WorkerTypes[worker.type] || {};
    panel.querySelector('.wp-dot').style.background = worker.color;
    panel.querySelector('.wp-name').textContent = worker.name;
    panel.querySelector('.wp-type').textContent = wt.name || worker.type;
    this._updateWorkerPanel();
  },

  hideWorkerPanel() {
    AppState.ui.selectedWorker = null;
    const panel = document.getElementById('workerPanel');
    if (panel) panel.classList.add('hidden');
  },

  _updateWorkerPanel() {
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
  },


  // ── Object selection (PA-style: highlight on canvas, keyboard controls only) ──

  selectObject(objId) {
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
  },

  deselectObject() {
    this._selectedObjId = null;
    this._objMoveMode = false;
    this._objOriginal = null;
    this.canvas.style.cursor = 'default';
  },

  _mouseGrid: null,
};
