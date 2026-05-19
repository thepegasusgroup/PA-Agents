// ── Environment rendering: sun, shadows, day/night ──
// _getSunInfo computes sun azimuth/elevation from AppState.facility.time.
// _renderShadows projects wall shadows onto the floor. _renderDayNight
// composites a tint overlay (warm sunrise → blue night) over the whole scene.

// Time-of-day tint stops: [hour, r, g, b, opacity]. PA-style — very dark at night.
Grid._dayNightStops = [
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
];

Grid._getSunInfo = function (s) {
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
};

Grid._renderShadows = function (ctx, s, cellSize, startGX, startGY, endGX, endGY) {
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
        if (CT.isIndoor(cell)) continue;
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
};

Grid._renderDayNight = function (ctx, cw, ch, s) {
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

    // ── All indoor floors AND their walls are automatically lit ──
    // Indoor floor cell types are 50-73. Doors count as indoor.
    // Walls (1-46) are lit if any NSEW neighbor is an indoor floor or door.
    if (nightAlpha > 0.05) {
      const indoorBrightness = Math.min(nightAlpha * 1.4, 0.98);
      lctx.fillStyle = `rgba(255,255,255,${indoorBrightness})`;
      const vx1 = Math.max(0, Math.floor(-camX / cs));
      const vy1 = Math.max(0, Math.floor(-camY / cs));
      const vx2 = Math.min(s.grid.width, Math.ceil((cw - camX) / cs));
      const vy2 = Math.min(s.grid.height, Math.ceil((ch - camY) / cs));
      for (let gy = vy1; gy < vy2; gy++) {
        let runStart = -1; // batch adjacent indoor cells into one fillRect
        for (let gx = vx1; gx <= vx2; gx++) {
          const cell = gx < vx2 ? s.getCell(gx, gy) : 0;
          // Indoor floors (50-73), doors, and all walls (1-46) are lit
          const isLit = CT.isIndoor(cell) || s.isDoor(cell) || (cell >= 1 && cell <= 46);
          if (isLit && runStart < 0) {
            runStart = gx;
          } else if (!isLit && runStart >= 0) {
            lctx.fillRect(camX + runStart * cs, camY + gy * cs, (gx - runStart) * cs, cs);
            runStart = -1;
          }
        }
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
};
