// ── Grid main render ──
// Two-pass canvas render (floors → walls with autotile, then objects with
// sprite-override offsets) plus orchestration of the sub-renderers in
// render_workers.js / render_utilities.js / render_environment.js / render_overlays.js.
// Attaches to Grid (declared in grid.js). getPattern caches CanvasPattern
// instances for tiled floor textures; cache is invalidated on zoom change.

Grid.getPattern = function (textureName) {
    if (this.texturePatterns[textureName]) return this.texturePatterns[textureName];
    const img = Textures.get(textureName);
    if (!img || !img.complete) return null;
    const pattern = this.ctx.createPattern(img, 'repeat');
    this.texturePatterns[textureName] = pattern;
    return pattern;
};

Grid.render = function () {
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
      }
      // Try rotation-specific texture first (PA's per-direction sprites: front/back/left + mirrored)
      // If a usable rotation sprite exists, draw it directly with no canvas rotation
      let rotImg = Textures.get(tex + '_r' + obj.rot);
      const hasRotSprite = !!(rotImg && rotImg.complete && rotImg.naturalWidth > 0);
      let img = hasRotSprite ? rotImg : Textures.get(tex);
      if (!img || !img.complete) continue;
      const fx = obj.gx * cellSize;
      const fy = obj.gy * cellSize;
      const fw = obj.w * cellSize;
      const fh = obj.h * cellSize;
      // PA-style object scaling: render at 64ppc base scale (cellSize/64).
      // PA atlas sprites are 32 ppc; baseScale=0.5 halves them. If the natural-scale
      // width is NARROWER than the footprint, stretch up so the sprite fills its
      // footprint width (preserving aspect ratio — height grows proportionally).
      // If the sprite is already WIDER than the footprint (e.g., bunk_bed's 3-cell-wide
      // sprite in a 1-cell-wide footprint), it stays at natural size and overhangs.
      // EXCEPTION: objects with `fitToFootprint: true` (custom/non-PA sprites that
      // weren't drawn at 32 ppc) are force-fit so their width equals the footprint width.
      const baseScale = cellSize / 64;
      const defForScale = ObjectDefs[obj.type];
      let dw, dh;
      if (defForScale && defForScale.fitToFootprint) {
        // Scale so sprite width matches the UN-rotated footprint width (def.w * cs).
        // Using def.w (not obj.w) keeps the sprite the same physical size at all rotations —
        // canvas rotation in the programmatic-rotation path then turns it sideways correctly.
        const targetWidth = (defForScale.w || obj.w) * cellSize;
        const fitScale = targetWidth / img.naturalWidth;
        dw = targetWidth;
        dh = img.naturalHeight * fitScale;
      } else {
        dw = img.naturalWidth * baseScale;
        dh = img.naturalHeight * baseScale;
        // Upscale-narrow-sprite-to-footprint, but use the UN-rotated footprint width when
        // we'll be applying programmatic rotation. Otherwise rotating a sprite that was
        // upscaled to the rotated-footprint width produces a 2×-too-large model (the bug
        // that made Big Desk render as 4×2 cells inside a 2×1 hitbox at rot=1).
        const referenceW = (!hasRotSprite && obj.rot !== 0 && defForScale)
          ? defForScale.w * cellSize
          : fw;
        if (dw < referenceW) {
          const upScale = referenceW / dw;
          dw = referenceW;
          dh *= upScale;
        }
      }
      const isSelected = obj.id === this._selectedObjId;
      if (isSelected && this._objMoveMode) continue;  // hide original when being moved (ghost shows at cursor)

      // Light-emitting objects render nearly invisible (they glow via the lightmap instead)
      const def = ObjectDefs[obj.type];
      const isLight = def && def.lightRadius;
      if (isLight && !isSelected) { ctx.save(); ctx.globalAlpha = 0.12; }
      else if (isSelected) { ctx.save(); ctx.globalAlpha = 0.5; }
      // Debug editor: per-(type, rot) pixel offset override
      const ovr = s.getSpriteOverride(obj.type, obj.rot);
      const ox = ovr ? ovr.ox : 0;
      const oy = ovr ? ovr.oy : 0;
      if (hasRotSprite || obj.rot === 0) {
        // Has pre-rendered rotation sprite OR is unrotated — draw directly bottom-aligned
        ctx.drawImage(img, fx + (fw - dw) / 2 + ox, fy + fh - dh + oy, dw, dh);
      } else {
        // Programmatic rotation for objects without per-direction sprites.
        // Anchor at the footprint's bottom-center so the rotated sprite stays bottom-aligned
        // (matches rot=0 behavior — fixes "rot=2 looks shifted down" when sprite > footprint).
        if (!isSelected) ctx.save();
        ctx.translate(fx + fw / 2 + ox, fy + fh + oy);
        ctx.rotate(obj.rot * Math.PI / 2);
        ctx.drawImage(img, -dw / 2, -dh, dw, dh);
        if (!isSelected) ctx.restore();
      }
      if (isLight && !isSelected) ctx.restore();
      else if (isSelected) ctx.restore();

      // Sprite-edit indicator: dashed cyan box around the object being nudged
      if (this._spriteEditObjId === obj.id) {
        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(fx - 1, fy - 1, fw + 2, fh + 2);
        ctx.setLineDash([]);
        // Corner crosshairs
        const c = 6;
        ctx.beginPath();
        ctx.moveTo(fx - c, fy);     ctx.lineTo(fx + c, fy);
        ctx.moveTo(fx, fy - c);     ctx.lineTo(fx, fy + c);
        ctx.moveTo(fx + fw - c, fy + fh); ctx.lineTo(fx + fw + c, fy + fh);
        ctx.moveTo(fx + fw, fy + fh - c); ctx.lineTo(fx + fw, fy + fh + c);
        ctx.stroke();
        ctx.restore();
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
          // Prefer pre-rendered per-rotation sprite (matches main render path)
          let pRotImg = Textures.get(tex + '_r' + rot);
          const pHasRotSprite = !!(pRotImg && pRotImg.complete && pRotImg.naturalWidth > 0);
          let pImg = pHasRotSprite ? pRotImg : Textures.get(tex);
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
          if (pImg && pImg.complete) {
            ctx.save();
            ctx.globalAlpha = blocked ? 0.25 : 0.5;
            const fw = cs * ow;
            const fh = cs * oh;
            const pBaseScale = cs / 64;
            let dw = pImg.naturalWidth * pBaseScale;
            let dh = pImg.naturalHeight * pBaseScale;
            if (pHasRotSprite || rot === 0) {
              // Sprite already matches the visual footprint orientation.
              if (dw < fw) {
                const upScale = fw / dw;
                dw = fw;
                dh *= upScale;
              }
              ctx.drawImage(pImg, px + (fw - dw) / 2, py + fh - dh, dw, dh);
            } else {
              // Programmatic rotation: compare sprite size against UN-rotated footprint
              // (def.w × def.h), since canvas rotation swaps the visual axes.
              const uFW = def.w * cs;
              if (dw < uFW) {
                const upScale = uFW / dw;
                dw = uFW;
                dh *= upScale;
              }
              // Bottom-aligned rotation (matches main render)
              ctx.translate(px + fw / 2, py + fh);
              ctx.rotate(rot * Math.PI / 2);
              ctx.drawImage(pImg, -dw / 2, -dh, dw, dh);
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
        const mTex = 'obj_' + moveObj.type;
        // Prefer a pre-rendered per-rotation sprite (matches main render path)
        let mRotImg = Textures.get(mTex + '_r' + moveObj.rot);
        const mHasRotSprite = !!(mRotImg && mRotImg.complete && mRotImg.naturalWidth > 0);
        let mimg = mHasRotSprite ? mRotImg : Textures.get(mTex);
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
          // Match the main-render scaling logic exactly (line 243-269) so the
          // ghost is the same size as the placed object — including the
          // fitToFootprint exception for custom-rendered sprites (work_pc etc.).
          const mBaseScale = cs / 64;
          const mDef = ObjectDefs[moveObj.type];
          let mdw, mdh;
          if (mDef && mDef.fitToFootprint) {
            const targetWidth = (mDef.w || moveObj.w) * cs;
            const fitScale = targetWidth / mimg.naturalWidth;
            mdw = targetWidth;
            mdh = mimg.naturalHeight * fitScale;
          } else {
            mdw = mimg.naturalWidth * mBaseScale;
            mdh = mimg.naturalHeight * mBaseScale;
            const referenceW = (!mHasRotSprite && moveObj.rot !== 0 && mDef)
              ? mDef.w * cs
              : mfw;
            if (mdw < referenceW) {
              const mUpScale = referenceW / mdw;
              mdw = referenceW;
              mdh *= mUpScale;
            }
          }
          if (mHasRotSprite || moveObj.rot === 0) {
            ctx.drawImage(mimg, mpx + (mfw - mdw) / 2, mpy + mfh - mdh, mdw, mdh);
          } else {
            // Bottom-aligned rotation (matches main render)
            ctx.translate(mpx + mfw / 2, mpy + mfh);
            ctx.rotate(moveObj.rot * Math.PI / 2);
            ctx.drawImage(mimg, -mdw / 2, -mdh, mdw, mdh);
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
      // No workers or day/night in utility mode
    } else {
      this.renderWorkers(ctx, s, cs);

      // Day/night tint overlay
      this._renderDayNight(ctx, cw, ch, s);
    }
};
