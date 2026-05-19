// ── Grid keyboard input ──
// onKeyDown is the central key dispatch: WASD/arrows pan, Q/E zoom, R rotates,
// Delete removes selected object, Escape cancels placement/move/clone, F3
// toggles debug overlay, X enters sprite-nudge editor, Ctrl+E exports overrides.
// onKeyUp tracks released movement keys; clearKeys resets the pan-key state
// (used on focus loss so a stuck-down key doesn't keep panning).

Grid.onKeyDown = function (e) {
    // Block input while auto-follow (main menu) is active
    if (this._autoFollow) return;

    // ── Sprite nudge editor (debug mode) ──
    // Press X over a hovered object to "grab" it — then arrows nudge its sprite offset.
    // Press X again or Escape to release. Auto-saves to localStorage.
    if (this._debugMode && (e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey) {
      if (this._spriteEditObjId) {
        // Already grabbing — release
        console.log('[sprite-edit] released');
        this._spriteEditObjId = null;
      } else {
        // Grab the hovered object
        const { gx, gy } = this._mouseGrid || {};
        const hover = this._findObjectAt(gx, gy);
        if (hover) {
          this._spriteEditObjId = hover.id;
          const ovr = AppState.getSpriteOverride(hover.type, hover.rot) || { ox: 0, oy: 0 };
          console.log(`[sprite-edit] grabbed ${hover.type}_r${hover.rot} — offset x:${ovr.ox} y:${ovr.oy}. Arrows nudge, Shift+arrow=8px, Ctrl+R reset, Ctrl+E export, X/Esc release.`);
        } else {
          console.log('[sprite-edit] hover an object first');
        }
      }
      e.preventDefault();
      return;
    }
    if (this._debugMode && this._spriteEditObjId) {
      const sel = AppState.objects.find(o => o.id === this._spriteEditObjId);
      if (sel) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const cur = AppState.getSpriteOverride(sel.type, sel.rot) || { ox: 0, oy: 0 };
          const step = e.shiftKey ? 8 : 1;
          let nx = cur.ox, ny = cur.oy;
          if (e.key === 'ArrowUp')    ny -= step;
          if (e.key === 'ArrowDown')  ny += step;
          if (e.key === 'ArrowLeft')  nx -= step;
          if (e.key === 'ArrowRight') nx += step;
          AppState.setSpriteOverride(sel.type, sel.rot, nx, ny);
          e.preventDefault();
          return;
        }
        if (e.key === 'Escape') {
          console.log('[sprite-edit] released');
          this._spriteEditObjId = null;
          e.preventDefault();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
          AppState.resetSpriteOverride(sel.type, sel.rot);
          console.log(`[sprite-edit] reset ${sel.type}_r${sel.rot}`);
          e.preventDefault();
          return;
        }
      } else {
        this._spriteEditObjId = null; // stale id
      }
    }
    if (this._debugMode && (e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
      const json = JSON.stringify(AppState.spriteOverrides, null, 2);
      console.log('═══ Sprite Overrides Export ═══\n' + json);
      try { if (navigator.clipboard) navigator.clipboard.writeText(json); console.log('(Copied to clipboard)'); } catch(_) {}
      e.preventDefault();
      return;
    }

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
      case 'F3': {
        this._debugMode = !this._debugMode;
        if (!this._debugMode) {
          const dbg = document.getElementById('debugOverlay');
          if (dbg) dbg.classList.add('hidden');
        }
        e.preventDefault();
        break;
      }
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
        // Dismiss object actions menu if open
        if (this._activeMenuObjId) {
          this.hideObjectActionsMenu();
          return;
        }
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
};

Grid.onKeyUp = function (e) {
    const cam = AppState.camera;
    switch (e.key) {
      case 'w': case 'W': case 'ArrowUp':    cam.keys.up = false; break;
      case 's': case 'S': case 'ArrowDown':   cam.keys.down = false; break;
      case 'a': case 'A': case 'ArrowLeft':   cam.keys.left = false; break;
      case 'd': case 'D': case 'ArrowRight':  cam.keys.right = false; break;
      case 'q': case 'Q': cam.keys.zoomIn = false; break;
      case 'e': case 'E': cam.keys.zoomOut = false; break;
    }
};

Grid.clearKeys = function () {
    const k = AppState.camera.keys;
    k.up = k.down = k.left = k.right = k.zoomIn = k.zoomOut = false;
    AppState.camera.edgeScroll.x = 0;
    AppState.camera.edgeScroll.y = 0;
};
