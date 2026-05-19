// ── AppState singleton ──
// Holds all mutable game state. Methods are attached from sibling files:
//   sprite_overrides.js — loadSpriteOverrides/saveSpriteOverrides/getSpriteOverride/setSpriteOverride/resetSpriteOverride
//   migrate.js          — _normalizeObjectFootprints/_normalizeWorkersAndRooms/_normalizePipelines
//   serialize.js        — serialize/deserialize
//   entities.js         — object/room/worker/pipeline management
// Static data tables live under src/js/defs/*.js.

const AppState = {
  facility: {
    name: 'AGENT HUB',
    day: 1,
    time: new Date().getHours() * 60 + new Date().getMinutes(),  // Sync to real clock
    cash: 0,
    cashflow: 0,
    activityLevel: 0,
    tasksRunning: 0,
    tasksCapacity: 0,
  },

  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    camStart: { x: 0, y: 0 },
    keys: { up: false, down: false, left: false, right: false, zoomIn: false, zoomOut: false },
    edgeScroll: { x: 0, y: 0 },
    panSpeed: 600,
    edgeScrollMargin: 10,
    edgeScrollSpeed: 500,
  },

  grid: {
    cellSize: 32,
    width: 100,
    height: 100,
    cells: null,
    rotations: null,
    objectGrid: null,
    utilityGrid: null,    // Underground utility layer (cables/pipes)
  },

  objects: [],
  _nextObjId: 1,

  rooms: [],
  _nextRoomId: 1,

  tools: {
    activeCategory: null,
    activeItem: null,
    isPlacing: false,
    placeStart: null,
    placeEnd: null,
    foundationWall: null,
    placeRotation: 0,
  },

  ui: {
    sidePanelOpen: true,
    subToolbarOpen: false,
    contextMenuOpen: false,
    autoLights: true,
    hoveredRoomType: null,
    showUtilities: false,   // Toggle underground utility view
    planningMode: false,    // Planning mode — walls/doors placed as outlines only
  },

  workers: [],
  _nextWorkerId: 1,
  _workerTypeCounts: {},

  // User-defined worker types created via the "Add New" button in the Staff
  // toolbar. Keyed by id (always starts with "custom_"). Persisted with the
  // save. On load, syncCustomWorkerTypes() merges these into the global
  // WorkerTypes registry so the rest of the code "just sees" them.
  customWorkerTypes: {},

  // Pipeline data
  pipelines: {},       // { [objectId]: { nodes: [], connections: [], nextNodeId: 1 } }
  roomPipelines: {},   // { [roomId]: { deskOrder: [objId1, objId2, ...] } }

  // Door states: Map<"gx,gy" → { open: 0..1, opening: bool, timer: number }>
  _doorStates: {},

  // AI / Learning
  _workerMemory: [],       // Past decisions + user corrections — fed into LLM prompts
  _hitlQueue: [],          // Items awaiting user review/approval
  _reviewedEmailIds: {},   // { emailId: 'classification' } — emails already handled

  hitlQueue: [
    { id: 1, agent: 'Coder-01', task: 'Needs API key for external service', status: 'waiting', time: '2m ago' },
    { id: 2, agent: 'Research-03', task: 'Confirm search query scope', status: 'waiting', time: '5m ago' },
    { id: 3, agent: 'Review-02', task: 'Approve PR merge to main', status: 'resolved', time: '12m ago' },
  ],

  // ── Sprite render overrides (debug editor) ──
  // Keyed by `${type}_r${rot}` → { ox, oy } in pixel offsets.
  // Applied AFTER the normal anchor math in the renderer, before drawImage.
  // Persists to localStorage so adjustments survive reloads. Use Ctrl+E in debug
  // mode (F3) to export the current overrides as a JSON snippet for the source.
  // Methods live in state/sprite_overrides.js.
  spriteOverrides: {},

  init(saveData) {
    this.grid.cells = new Uint8Array(this.grid.width * this.grid.height);
    this.grid.rotations = new Uint8Array(this.grid.width * this.grid.height);
    this.grid.objectGrid = new Uint16Array(this.grid.width * this.grid.height);
    this.grid.floorUnder = new Uint8Array(this.grid.width * this.grid.height);
    this.grid.roomGrid = new Uint16Array(this.grid.width * this.grid.height);
    this.grid.utilityGrid = new Uint8Array(this.grid.width * this.grid.height);
    this.grid.planGrid = new Uint8Array(this.grid.width * this.grid.height);  // Planning layer

    if (saveData) {
      this.deserialize(saveData);
    } else {
      this.buildDefaultFacility();
    }
    // Merge any saved custom worker types into the global WorkerTypes registry
    // BEFORE normalization runs (otherwise workers of those types get filtered).
    this.syncCustomWorkerTypes();
    // Load any sprite render-overrides saved by the in-game debug editor.
    this.loadSpriteOverrides();
    // Migrate any existing object whose footprint differs from the current def,
    // and drop any objects whose type no longer exists in ObjectDefs (e.g. removed
    // furniture like beds/windows/etc.).
    this._normalizeObjectFootprints();
    // Also drop any workers / rooms whose type was removed since the save was created.
    this._normalizeWorkersAndRooms();
    // Drop pipelines keyed by object/room IDs that no longer exist.
    this._normalizePipelines();
  },

  // ── Custom worker types ──
  // Strategy: WorkerTypes is treated as the single source of truth for all
  // worker types at runtime (built-in + custom). On load we clear any previous
  // "custom_*" entries and re-add the ones in this save. addCustomWorkerType
  // writes to both customWorkerTypes (for persistence) and WorkerTypes (for
  // lookup). buildDefaultFacility starts with no customs (fresh game).
  syncCustomWorkerTypes() {
    // Drop stale customs from a previously-loaded save
    for (const key of Object.keys(WorkerTypes)) {
      if (key.startsWith('custom_')) delete WorkerTypes[key];
    }
    // Add what's in this save
    for (const [id, def] of Object.entries(this.customWorkerTypes || {})) {
      WorkerTypes[id] = def;
    }
  },
  addCustomWorkerType(def) {
    if (!def || !def.id) return null;
    this.customWorkerTypes[def.id] = def;
    WorkerTypes[def.id] = def;
    return def;
  },
  removeCustomWorkerType(id) {
    delete this.customWorkerTypes[id];
    delete WorkerTypes[id];
  },

  // ── Pre-built default facility ──
  buildDefaultFacility() {
    // ═══ Grass — fill entire playable area ═══
    for (let x = 0; x < 99; x++) {
      for (let y = 0; y < this.grid.height; y++) {
        this.setCell(x, y, CT.GRASS);
      }
    }

    // ═══ Road (right side): sidewalk | road x3 | sidewalk ═══
    for (let y = 0; y < 100; y++) {
      this.setCell(91, y, CT.PAVING_STONE);  // left sidewalk
      this.setCell(92, y, CT.ROAD);
      this.setCell(93, y, CT.ROAD);
      this.setCell(94, y, CT.ROAD);
      this.setCell(95, y, CT.PAVING_STONE);  // right sidewalk
    }

    // Center camera on middle of the map
    this.camera.x = -(50) * this.grid.cellSize + 550;
    this.camera.y = -(50) * this.grid.cellSize + 380;
  },

  // ── Grid cell accessors ──

  getCell(gx, gy) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return 0;
    return this.grid.cells[gy * this.grid.width + gx];
  },

  setCell(gx, gy, value) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return;
    this.grid.cells[gy * this.grid.width + gx] = value;
  },

  getRotation(gx, gy) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return 0;
    return this.grid.rotations[gy * this.grid.width + gx];
  },

  setRotation(gx, gy, value) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return;
    this.grid.rotations[gy * this.grid.width + gx] = value;
  },

  // ── Planning layer ──
  getPlanCell(gx, gy) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return 0;
    return this.grid.planGrid[gy * this.grid.width + gx];
  },
  setPlanCell(gx, gy, value) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return;
    this.grid.planGrid[gy * this.grid.width + gx] = value;
  },

  // ── Utility grid (underground) ──
  getUtility(gx, gy) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return 0;
    return this.grid.utilityGrid[gy * this.grid.width + gx];
  },
  setUtility(gx, gy, value) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return;
    this.grid.utilityGrid[gy * this.grid.width + gx] = value;
  },

  // ── Floor-under layer (preserves floor type beneath walls/objects) ──
  getFloorUnder(gx, gy) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return 0;
    return this.grid.floorUnder[gy * this.grid.width + gx];
  },
  setFloorUnder(gx, gy, value) {
    if (gx < 0 || gx >= this.grid.width || gy < 0 || gy >= this.grid.height) return;
    this.grid.floorUnder[gy * this.grid.width + gx] = value;
  },

  // ── Cell-type predicates ──
  isWall(cellType) {
    return cellType >= 1 && cellType <= 46;
  },

  isDoor(cellType) {
    return cellType >= CT.DOOR && cellType <= CT.HOUSE_DOOR_R;
  },
};
