// ── Grid singleton — declaration + lifecycle ──
// Methods are attached from sibling files under src/js/grid/:
//   camera.js              — pan, zoom, edge-scroll, auto-follow
//   input_keyboard.js      — onKeyDown / onKeyUp / clearKeys
//   input_mouse.js         — onMouseDown/Move/Up/Leave, onDoubleClick, _findObjectAt
//   place.js               — commitPlacement + helpers
//   path.js                — A* pathfinding for workers
//   update.js              — per-frame update (worker AI, doors, room highlight)
//   select.js              — object actions menu, selectObject/deselectObject
//   clone.js               — clone tool capture/stamp/preview
//   debug.js               — F3 debug overlay
//   workers.js             — worker side panel + box-select dispatch
//   render.js              — main two-pass render + texture pattern cache
//   render_workers.js      — per-frame worker sprite draw
//   render_utilities.js    — underground utility view
//   render_environment.js  — sun, shadows, day/night tint
//   render_overlays.js     — dimension labels, pipeline arrows, plan ghosts

const Grid = {
  canvas: null,
  ctx: null,
  animFrame: null,
  texturePatterns: {},
  _rightDrag: null,
  _workerSprites: {},       // { 'guard_front': Image, ... }
  _selectedWorkers: [],     // array of selected worker IDs
  _workerDrag: null,        // { startX, startY, endX, endY } for box-select
  _selectedObjId: null,     // selected object id for move/rotate/sell
  _objMoveMode: false,      // true when moving a selected object
  _objOriginal: null,       // saved {gx, gy, rot, w, h} for move cancel
  _utilityDrawing: false,   // true while dragging to lay utilities

  // Clone tool state
  _cloneMode: false,        // true when clone toolbar is active
  _cloneData: null,         // { cells: Uint8Array, width, height, objects: [...] }
  _cloneSelecting: false,   // true during right-drag selection phase

  _clickTimer: null,         // delayed single-click action (vs double-click)

  // Debug overlay — hover info, toggle with F3
  _debugMode: true,
  _debugHoverObj: null,
  // Sprite nudge editor — press X over an object to grab it, arrows move its sprite
  _spriteEditObjId: null,

  // Pathfinding cache (rebuilt when objects change; consumed by path.js)
  _objPassableCache: null,
  _objPassableCacheGen: -1,

  _mouseGrid: null,          // last screen→grid result from onMouseMove

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

    // Object actions menu — wire click handlers + outside-click dismiss
    const menuEl = document.getElementById('objectActionsMenu');
    if (menuEl) {
      menuEl.addEventListener('click', (e) => {
        const item = e.target.closest('.context-item');
        if (!item || item.classList.contains('disabled')) return;
        const action = item.dataset.action;
        if (action) this._onObjectActionsMenuClick(action);
      });
      // Dismiss on any click outside the menu (canvas has its own flow).
      document.addEventListener('mousedown', (e) => {
        if (menuEl.classList.contains('hidden')) return;
        if (e.target.closest('#objectActionsMenu')) return;
        this.hideObjectActionsMenu();
      }, true);
    }

    this.startLoop();
  },

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.texturePatterns = {};
  },

  startLoop() {
    const loop = (now) => {
      const dt = Math.min((now - this._lastFrameTime) / 1000, 0.05);
      this._lastFrameTime = now;
      this.updateCamera(dt);
      this._updateAutoFollow(dt);
      this.update();
      this.updateVisibleRoom();
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this._lastFrameTime = performance.now();
    requestAnimationFrame(loop);
  },
};
