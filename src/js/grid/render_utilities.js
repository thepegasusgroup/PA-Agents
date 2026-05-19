// ── Underground utility view rendering ──
// Draws power/water/network lines, source nodes, and labels when
// AppState.ui.showUtilities is on. _utilityFamily/_utilityConnects classify
// which utility types can connect to each other (power-to-power etc.).

Grid._renderUtilities = function (ctx, s, cs, cw, ch) {
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
};

Grid._utilityFamily = function (u) {
    if (u === UT.POWER_CABLE || u === UT.POWER_CABLE_HEAVY || u === UT.POWER_SOURCE) return 'power';
    if (u === UT.WATER_PIPE_SMALL || u === UT.WATER_PIPE_LARGE || u === UT.WATER_SOURCE) return 'water';
    if (u === UT.ETHERNET_CAT5E || u === UT.ETHERNET_CAT6 || u === UT.ETHERNET_FIBER || u === UT.NETWORK_SOURCE) return 'network';
    return null;
};

Grid._utilityConnects = function (a, b) {
    if (a === UT.EMPTY || b === UT.EMPTY) return false;
    if (a === b) return true;
    const fa = this._utilityFamily(a);
    const fb = this._utilityFamily(b);
    return fa !== null && fa === fb;
};
