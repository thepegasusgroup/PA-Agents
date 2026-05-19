// ── Worker sprite rendering ──
// _loadWorkerSprites caches per-type/per-direction Image objects on
// Grid._workerSprites. _getWorkerDirection picks N/S/E/W from a worker's
// movement vector. renderWorkers draws every worker each frame on top of
// the floor/wall passes.

Grid._loadWorkerSprites = function () {
    const sprites = ['accountant', 'doctor', 'chef', 'lawyer', 'shrink', 'teacher'];
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
};

Grid._getWorkerDirection = function (w) {
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
};

Grid.renderWorkers = function (ctx, s, cs) {
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
      if (w.state === 'working') {
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
};
