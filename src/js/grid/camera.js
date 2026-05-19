// ── Grid camera ──
// Pan, zoom, edge-scroll, and main-menu auto-follow.
// Attaches to the Grid singleton (declared in grid.js).
// State fields live on Grid: _autoFollow, _followTarget, _followTimer, _followInterval.

Grid._autoFollow = false;
Grid._followTarget = null;    // worker being followed
Grid._followTimer = 0;        // time until next target switch
Grid._followInterval = 10;    // seconds per worker

// ── Coordinate transform ──

Grid.screenToGrid = function (sx, sy) {
  const s = AppState;
  const worldX = (sx - s.camera.x) / s.camera.zoom;
  const worldY = (sy - s.camera.y) / s.camera.zoom;
  return {
    gx: Math.floor(worldX / s.grid.cellSize),
    gy: Math.floor(worldY / s.grid.cellSize),
  };
};

// ── Wheel zoom (zoom toward cursor) ──

Grid.onWheel = function (e) {
  e.preventDefault();
  if (this._autoFollow) return;
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
};

// ── Edge scroll (cursor near screen edge) ──

Grid.updateEdgeScroll = function (mx, my) {
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
};

// ── Per-frame camera update (keys + edge scroll + zoom keys) ──

Grid.updateCamera = function (dt) {
  if (this._autoFollow) return; // Auto-follow handles camera
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
};

// ── Auto-Follow Camera (main menu background) ──

Grid.startAutoFollow = function () {
  this._autoFollow = true;
  this._followTimer = 0;
  this._pickFollowTarget();

  // Set a comfortable zoom for the menu background
  const s = AppState;
  s.camera.zoom = 1.2;
};

Grid.stopAutoFollow = function () {
  this._autoFollow = false;
  this._followTarget = null;
};

Grid._pickFollowTarget = function () {
  const workers = AppState.workers;
  if (workers.length === 0) {
    this._followTarget = null;
    return;
  }
  // Pick a random worker different from current
  let pick;
  if (workers.length === 1) {
    pick = workers[0];
  } else {
    const filtered = workers.filter(w => w !== this._followTarget);
    pick = filtered[Math.floor(Math.random() * filtered.length)];
  }
  this._followTarget = pick;
  this._followTimer = this._followInterval;
};

Grid._updateAutoFollow = function (dt) {
  if (!this._autoFollow) return;

  this._followTimer -= dt;
  if (this._followTimer <= 0) {
    this._pickFollowTarget();
  }

  const w = this._followTarget;
  if (!w) return;

  const s = AppState;
  const cs = s.grid.cellSize * s.camera.zoom;
  const cw = this.canvas.width / window.devicePixelRatio;
  const ch = this.canvas.height / window.devicePixelRatio;

  // Target camera position to center on worker
  const targetX = -(w.x * cs) + cw / 2;
  const targetY = -(w.y * cs) + ch / 2;

  // Smooth lerp (lower = smoother/slower)
  const lerp = 1 - Math.pow(0.03, dt);
  s.camera.x += (targetX - s.camera.x) * lerp;
  s.camera.y += (targetY - s.camera.y) * lerp;
};
