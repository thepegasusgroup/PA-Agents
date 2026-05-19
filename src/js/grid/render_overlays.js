// ── Render overlays: dimension labels, pipeline chain, planning ghosts ──
// Drawn last so they sit on top of everything else.
// drawDimensionLabels — "5×3" size text during wall placement drag.
// renderPipelineLines — orange dashed arrow between chained desks on hover.
// _renderPlanGrid — outline-only walls/doors placed in planning mode.

Grid.drawDimensionLabels = function (ctx, s, cs, x1, y1, x2, y2) {
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
};

Grid.renderPipelineLines = function (ctx, s, cs) {
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
};

Grid._renderPlanGrid = function (ctx, s, cellSize, startGX, startGY, endGX, endGY) {
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
};
