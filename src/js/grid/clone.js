// ── Clone tool ──
// Right-drag a region to capture cells + objects, then left-click to stamp.
// Attaches to Grid (declared in grid.js).
// State fields read/written: _cloneMode, _cloneData, _cloneSelecting,
// _rightDrag, _mouseGrid (all declared in grid.js).

Grid._captureClone = function () {
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
};

Grid._stampClone = function (gx, gy) {
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
};

Grid._renderClonePreview = function (ctx, s, cs) {
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
    // Prefer per-rotation sprite (matches main render)
    const rotImg = Textures.get(tex + '_r' + (obj.rot || 0));
    const cHasRotSprite = !!(rotImg && rotImg.complete && rotImg.naturalWidth > 0);
    const img = cHasRotSprite ? rotImg : Textures.get(tex);
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
    if (cHasRotSprite || (obj.rot || 0) === 0) {
      ctx.drawImage(img, fx + (fw - dw) / 2, fy + fh - dh, dw, dh);
    } else {
      // Bottom-aligned programmatic rotation (matches main render)
      ctx.save();
      ctx.translate(fx + fw / 2, fy + fh);
      ctx.rotate((obj.rot || 0) * Math.PI / 2);
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
      ctx.restore();
    }
  }

  ctx.restore();

  // Outline
  ctx.strokeStyle = 'rgba(74, 144, 196, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(baseX, baseY, cd.width * cs, cd.height * cs);
  ctx.setLineDash([]);
};
