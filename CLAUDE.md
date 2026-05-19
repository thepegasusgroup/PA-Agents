# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Pegasus Agents is an Electron desktop app that uses Prison Architect's UI/UX as a visual interface for managing locally-hosted AI agents. The world is a 100×100 tile grid where rooms (Office, Server Room, etc.) host desks/PCs that each own a visual node-graph "pipeline." Pipelines wire Gmail nodes to local Ollama LLM nodes. There's no separate AI runtime — Ollama runs on the host, and Gmail talks directly to Google's REST API.

## Commands

```bash
npm start         # Launch the Electron app
npm run dev       # Launch with --dev flag
npm run dist      # Build Windows installer (NSIS) via electron-builder
npm run dist:dir  # Build unpacked Windows directory (faster, for testing)
```

No test runner, linter, or bundler. Renderer JS is loaded directly as `<script>` tags in `src/index.html`.

The app can also be launched via `PA-Agents.bat` (desktop shortcut).

## High-Level Architecture

There are two halves: the **Electron main process** (Node-side modules in the repo root) and the **renderer** (browser-side JS under `src/js/`). They communicate via `preload.js`, which exposes a typed `window.electronAPI` namespaced by feature (`electronAPI.gmail`, `electronAPI.ollama`, `electronAPI.save`, plus window controls).

### Main process modules (repo root)

- **`main.js`** — Creates the frameless BrowserWindow, wires every IPC handler, and handles autosave-on-close. The close handler is non-trivial: it intercepts the window's `close` event, reads `_activeSlot` and `AppState.serialize()` out of the renderer via `webContents.executeJavaScript`, writes the slot, then destroys the window. Renderer `beforeunload` async promises never complete before exit, which is why this lives in main.
- **`gmail.js`** — OAuth2 flow using a transient `http.createServer` on port 8234 to catch the redirect at `http://localhost:8234/oauth/callback`. Tokens persist in `electron-store` (encrypted). Reads `credentials.json` from the repo root. Exposes `listMessages`, `getMessage`, `getProfile`, `startOAuthFlow`, `logout`. Body decoding walks multipart MIME, prefers `text/plain` then `text/html`, strips `<script>` tags as a first pass (the renderer does the real sanitization).
- **`ollama.js`** — Plain `http` calls to `localhost:11434`. Default model is `qwen3:8b`, 1024 token cap, 2-min timeout for `/api/generate` and `/api/chat`, 10s for `/api/tags`. Exposes `generate`, `chat`, `isAvailable`, `listModels`.
- **`save.js`** — Slot-based saves (1–3) plus arbitrary save/load dialogs. Saves live in `app.getPath('userData')/saves/slot_N.json` or `autosave.json`. Writes are atomic via `.tmp` + rename. `listSlots` previews each slot (day, worker count, room count) by parsing the JSON.
- **`updater.js`** — `electron-updater` checking GitHub Releases (`thepegasusgroup/PA-Agents`) on a 5s post-launch delay. Privacy-first: no telemetry; auto-download is **off** (user must consent). Errors are silent (logged only).
- **`preload.js`** — `contextBridge` exposes the typed API. `contextIsolation: true`, `nodeIntegration: false`.

### Renderer scripts (loaded in this order — `src/index.html`)

```
textures.js              — Texture manifest, async loader, cache. Wall autotile entries
                            are generated dynamically via spread + flatMap.
defs/cells.js            — CT enum, CellTextures, CellMinimapColors, WallVariantPrefix, DoorTextures
defs/workers.js          — WorkerTypes, name pools (gendered)
defs/utilities.js        — UT enum, UtilityDefs (power/water/network capacities)
defs/objects.js          — ObjectDefs (footprints, infrastructure props), DESK_TYPES, CHAIR_TYPES
defs/rooms.js            — RoomDefs (required objects per room type)
defs/toolbar.js          — ToolbarData (build menu structure)
defs/sprite_overrides.js — BAKED_SPRITE_OVERRIDES (per-rotation pixel offsets)
state/core.js            — AppState declaration, init, buildDefaultFacility, grid getters
state/sprite_overrides.js — Sprite override load/save/get/set/reset
state/migrate.js         — _normalizeObjectFootprints / _normalizeWorkersAndRooms / _normalizePipelines
state/serialize.js       — serialize / deserialize (save format contract)
state/entities.js        — Object/Room/Worker/Pipeline management methods
grid.js                  — Canvas, input, camera, placement, two-pass render, minimap (~3300 LOC)
toolbar.js               — Sub-toolbar population, placement preview
pipeline/email_render.js — renderEmailSecure() — sanitizer + sandboxed iframe (also used by reports/app_comms)
pipeline/node_types.js   — NodeTypes registry (Gmail + AI nodes)
pipeline/core.js         — Pipeline singleton declaration, init, _buildPalette, _esc
pipeline/editor.js       — Desk node editor (CRUD nodes, render, mouse drag/connect, param config)
pipeline/room_config.js  — Room config overlay (Staff + Pipeline tabs, deskOrder reordering)
pipeline/runner.js       — Execution engine + results panel (runDeskPipeline, _executeNode, _showResults)
pipeline/hitl.js         — Worker memory + HITL queue (correct/approve, _pushToHITL, openHITLPanel)
reports/core.js          — Phone shell: lifecycle, navigation, _renderApp dispatcher, _esc
reports/app_comms.js     — Comms app (emails + review queue) + setEmails/showHITL entry-points
reports/app_agents.js    — Agents app (workers + pipelines)
reports/app_logs.js      — Logs app + public log() entry-point
reports/app_system.js    — System/Settings app + Gmail connection detail
reports/app_radio.js     — Radio app + RADIO_STATIONS / RadioIcons constants
renderer.js              — DOM init, main menu, save/load wiring, pause menu, autosave loop
```

**`defs/*.js` files are static data only** — no behavior, no AppState mutations. Order matters: `state/migrate.js` (`_normalizeWorkersAndRooms`, `_normalizeObjectFootprints`, `_normalizePipelines`) reads `WorkerTypes`, `RoomDefs`, and `ObjectDefs`, so the defs must load first.

**`state/*.js` files attach to a shared singleton.** `core.js` declares `const AppState = { …fields… }` with the bare state shape; siblings do `AppState.method = function () { … }` to add behavior. All five must load before `grid.js`.

All renderer state lives on the global `AppState`. No framework, no reactivity — manual DOM updates via `getElementById`.

### Global state shape

`AppState` (declared in `state/core.js`, augmented by the other `state/*.js` files) is the single source of truth. Key fields:

- `facility` — day, time, cash, cashflow, activityLevel, tasksRunning/Capacity, speed
- `camera` — x, y, zoom, drag state, key state, edge-scroll state. `panSpeed: 600`, `edgeScrollMargin: 10`, `edgeScrollSpeed: 500`, zoom range `0.3–3`.
- `grid` — `cellSize: 32`, `width/height: 100`, plus seven typed arrays of length 10000 each:
  - `cells` (cell types, Uint8), `rotations` (0–3, Uint8), `objectGrid` (object IDs, Uint16), `floorUnder` (Uint8 — floor type below walls/objects so demolishing reveals it), `roomGrid` (Uint16, room IDs), `utilityGrid` (Uint8, underground utility types), `planGrid` (Uint8, planning-mode outlines)
- `objects[]`, `rooms[]`, `workers[]` — sparse arrays with auto-incrementing IDs (`_nextObjId`, etc.)
- `pipelines{}` keyed by `objectId`, `roomPipelines{}` keyed by `roomId` (room pipelines hold a `deskOrder` array that chains the room's desks in execution order)
- `_doorStates{}` keyed by `"gx,gy"` — per-door open animation state
- `_workerMemory[]`, `_hitlQueue[]`, `_reviewedEmailIds{}` — AI loop state
- `spriteOverrides{}` — per-`type_r<rot>` pixel offsets; see below

### Save/load contract

`AppState.serialize()` returns a versioned JSON object. Typed arrays are base64-encoded. `deserialize()` decodes and then normalizes:

- Deprecated object types (e.g. `light`) are filtered out.
- `_normalizeObjectFootprints()` recomputes `w/h` from current `ObjectDefs` so rotations stay consistent after defs change.
- `_normalizeWorkersAndRooms()` drops workers/rooms whose type was removed.
- `_normalizePipelines()` drops pipelines for missing owners and prunes dangling `deskOrder` entries.

When changing the shape of `ObjectDefs` / `RoomDefs` / `WorkerTypes`, existing saves are tolerated — they get migrated on load.

## UI Layout

Fixed/absolute positioning over a transparent canvas so overlays use `rgba(0,0,0,0.7)` backgrounds.

- **Title bar** (28px, `#titleBar`): "Pegasus Agents" + window controls. `-webkit-app-region: drag`.
- **Main menu** (`#mainMenu`): Shown on launch. Renders 3 slot cards with day/worker/room/timestamp previews. The canvas runs behind the menu in auto-follow mode as a live background. Hidden once a slot is loaded.
- **Top-left todo panel** (lined-paper cream `rgba(255,248,235,0.88)` + repeating gradient): Counter chip + 3 action buttons + expandable report list.
- **Top-center stat segments**: 6 chips — activity arrows, day, budget, cashflow, agents, tasks.
- **Top-right clock & speed**: Digital clock + 4 speed buttons (pause/1×/2×/3×).
- **Bottom toolbar** (34px fixed): 11 blue build tools, 4 red placeholders, 1 reports button.
- **Sub-toolbar** (110px fixed at `bottom: 34px`): Populated by `Toolbar.openCategory` when a build tool is clicked.
- **Minimap** (160×120): Bottom-right; redrawn each frame.
- **Pipeline overlay** (`#pipelineOverlay`): Full-screen node editor. `Pipeline.openDeskEditor(objId)`.
- **Room config overlay** (`#roomConfigOverlay`): Tabbed (staff/pipeline) per-room config.
- **Reports overlay** (`#reportsOverlay`): Phone-style UI with apps for Comms (emails + review queue), Agents (workers + pipelines), Logs, System, Radio (12 streaming stations).
- **Utility underground view**: Toggled by `AppState.ui.showUtilities`. Renders dimmed terrain with cable/pipe lines overlaid.

## Camera & Input

Delta-time loop in `Grid.startLoop`. State in `AppState.camera`.

| Control | Action |
|---|---|
| WASD / Arrow keys | Pan |
| Q / E | Zoom in/out (exponential) |
| Scroll wheel | Zoom at cursor |
| Middle-click drag | Pan |
| Edge scroll | Cursor near screen edge |
| Left-click / drag | Place / demolish |
| Right-click drag | Box-select workers, or clone region select |
| Double-click worker | Camera follow |
| Double-click desk | Open pipeline editor |
| Double-click room border | Open room config |
| Escape | Clear tool selection |
| F3 | Toggle debug overlay |
| X (debug mode) | Enter sprite-nudge editor on hovered object |
| Ctrl+E (debug mode) | Export `spriteOverrides` JSON to clipboard |

## Grid & Cell System

100×100 grid. Cell size 32px. `AppState.getCell(gx, gy)` / `setCell(gx, gy, value)` with bounds checking.

**Cell type ranges** (`CT` in `defs/cells.js`):
- `0` — EMPTY
- `1–34` — Walls (BRICK_WALL through GARDEN_WALL)
- `35–46+` — Doors (DOOR, STAFF_DOOR, DOUBLE_DOOR, SECURE_DOOR, …)
- `50–73` — Indoor floors
- `100–118` — Outdoor floors

`Grid.isWall(cellType)` returns true for the wall range. Doors have their own animation state (`AppState._doorStates`) and open/close based on nearby worker pathfinding.

## Two-Pass Rendering

1. **Floors** — non-wall, non-empty cells drawn as texture blits. Patterns cached in `Grid.texturePatterns` and invalidated on zoom change.
2. **Walls with autotile** — for each wall cell, compute 4-bit neighbor mask, look up the variant texture by `<prefix>_<mask>`, fall back to the base texture if missing.

Objects are drawn on top with per-rotation sprite offsets (see Sprite Overrides).

## Wall Autotile System

Each wall type has 16 pre-extracted sprites (one per 4-bit neighbor configuration). No rotation at render time.

**Bitmask:** `N=1 | S=2 | W=4 | E=8`. Produces mask 0–15.

**Lookup:** `WallVariantPrefix[cellType]` → prefix string (e.g. `'cw'` for concrete wall). Texture key is `<prefix>_<mask>` (e.g. `'cw_12'` for a horizontal segment).

**Files:** `src/assets/textures/walls/<wall_name>/0.webp` … `15.webp`. The base `<Name>.webp` is the fallback if a variant is missing.

## Object & Room System

**Objects** (`AppState.objects[]`): `{ id, type, gx, gy, rot, w, h }`. `ObjectDefs[type]` provides `w/h`, `passable`, `noRotate`, `wallMount`, `fitToFootprint`, and infrastructure stats (`powerOutput`, `powerDraw`, `heatOutput`, `computeUnits`, `storageCapacity`, `ports`, `throughput`, etc.). When an object rotates, the renderer swaps `w` and `h` for odd rotations.

**Rooms** (`AppState.rooms[]`): `{ id, type, x1, y1, x2, y2, satisfied }`. Rooms are detected from wall enclosures and recalculated whenever walls/objects change. `RoomDefs[type].requires` lists required object types and counts; `satisfied` flips true when met.

**Workers** (`AppState.workers[]`): 4 types in `WorkerTypes`. `general` is operational (claims a desk + chair, runs pipelines). `janitor`, `gardener`, `maintenance` are facility/visual (zone-restricted: indoor/outdoor/any). Workers carry `claimedDesk`, `claimedChair`, `state`, `taskLabel`, `_idleTimer`, `_lastMeal`.

## Pipeline System

Each desk-type object (see `DESK_TYPES` set in `defs/objects.js`: `work_pc`, `big_desk`, `oak_desk`) can own a pipeline. Each room can own a `roomPipeline` with a `deskOrder` array chaining its desks in execution order.

**Node types** (`NodeTypes` in `pipeline.js`):
- Gmail: `gmail_fetch`, `gmail_read`, `gmail_filter`, `gmail_send`, `gmail_reply`
- AI: `ai_classify`, `ai_summarize`, `ai_decide`, `ai_custom`

Each node defines `inputs`, `outputs`, `params`, `icon`, `color`. Pipelines are stored as `{ nodes: [{id, type, x, y, params}], connections: [{from, to, fromPort, toPort}], nextNodeId }`. Connections render as SVG paths inside `.pe-connections`. Double-click a desk to open the editor.

`pipeline.js` also exports `renderEmailSecure(container, html, fallback)` — a sanitizer that strips script/iframe/etc., blocks external images by default, and renders the result in a `sandbox="allow-same-origin"` iframe with a strict CSP and a "Load external images" button.

## Utility Layer (Underground)

`AppState.grid.utilityGrid` is a separate `Uint8Array` overlaying the grid. Types in `UT` (`defs/utilities.js`):

- **Power:** `POWER_CABLE` (100W), `POWER_CABLE_HEAVY` (500W), `POWER_SOURCE`
- **Water:** `WATER_PIPE_SMALL` (5 L/min), `WATER_PIPE_LARGE` (40 L/min), `WATER_SOURCE`
- **Network:** `ETHERNET_CAT5E` (1 Gbps), `ETHERNET_CAT6` (10 Gbps), `ETHERNET_FIBER` (100 Gbps), `NETWORK_SOURCE`

`UtilityDefs` has `color`, `lineWidth`, `dash`, `capacity`, `unit`, `desc`. Toggle visibility with `AppState.ui.showUtilities`. Source types are emitted by infrastructure objects (`power_station`, `backup_generator`, `solar_panel`, `water_pump`, `network_switch`).

## Sprite Overrides

Many object sprites need per-rotation pixel nudges (the source PA sprites have inconsistent anchors). The system has two layers:

1. **`defs/sprite_overrides.js`** (`BAKED_SPRITE_OVERRIDES`) — committed defaults, loaded first.
2. **`localStorage['pa_sprite_overrides']`** — dev nudges, layered on top so unbaked tweaks still win.

In **F3 debug mode**, press **X** on a hovered object to enter the nudge editor. Arrow keys move the sprite. **Ctrl+E** exports the current `spriteOverrides` as JSON to the clipboard — paste into `defs/sprite_overrides.js` and commit to bake.

The renderer calls `AppState.getSpriteOverride(type, rot)` after computing the anchor and before `drawImage`.

## Toolbar Structure

`ToolbarData` (`defs/toolbar.js`) has 11 build categories:

- **Blue (build):** `foundations`, `materials` (Walls/Doors tabs), `flooring` (Indoor/Outdoor tabs), `rooms`, `objects`, `staff`, `utilities`, `deployment`, `logistics`, `clone`, `planning`
- **Red placeholders:** empty stubs
- **Folder:** `reports`

Modes:
- `mode: 'panel'` — tabbed sub-toolbar (materials, flooring)
- `mode: 'foundation'` — combined walls + floor for one-step room building
- `mode: 'clone'` — region copy/paste (right-drag selects, left-click pastes)
- `mode: 'planning'` — placement writes to `planGrid` only (outline-only; meant for future worker-built construction)

## PA Tileset Extraction

Sprites are extracted from Prison Architect's `tilesetpadded.png` (4608×4608, stride=72px, tile=64px, 4px padding per side). Scripts live in `tools/` and depend on `sharp` (devDependency). Run from repo root, e.g. `node tools/extract_pa_rotations.js`. Source data lives in `PA-Extract/data/` (`materials.txt`, `materials_dlc.txt`, `tilesetpadded.png`) — outside the app bundle. `tools/README.md` has more.

**Linked sprites** (ConcreteWall): 18 explicit positions in `materials.txt`.
**Connected sprites** (most others): 7×4 grid from a single base position. Same mask→[col,row] offset table:

```
0->[0,3]  1->[0,2]  2->[0,1]  3->[0,0]
4->[1,2]  5->[3,1]  6->[3,0]  7->[5,2]
8->[1,1]  9->[2,1]  10->[2,0] 11->[4,2]
12->[1,0] 13->[4,1] 14->[4,0] 15->[6,2]
```

## Asset Conventions

- All textures are `.webp`.
- Wall base: `assets/textures/walls/<Name>.webp` (fallback).
- Wall autotile: `assets/textures/walls/<name>/0.webp` … `15.webp`.
- Floors: `assets/textures/flooring/<Name>.webp`.
- Objects: `assets/textures/objects/<id>.webp` and rotated variants where needed.
- Workers: `assets/textures/workers/<sprite>_<direction>.webp`.

## CSS & Theming

CSS custom properties in `:root` (`src/css/main.css`). Title bar 28px, toolbar 34px, sub-toolbar 110px at `bottom: 34px`.

- Accent: orange `#e8821a`, blue `#4a90c4`, green `#5cb85c`
- Fonts: Roboto Condensed (UI), Share Tech Mono (numbers/data)
- Toolbar buttons: `.blue` (`#2a6ab0`→`#1a4a7c`), `.red` (`#8a2a2a`→`#5c1a1a`), `.folder` (`#3a3a3a`→`#2a2a2a`); blueprint-grid `::before` overlay.

## Things to Know

- `credentials.json` is gitignored. The user must supply their own Google OAuth client (Desktop type) for Gmail to work — otherwise `gmail.init` logs an error and `startOAuthFlow` throws.
- Ollama is optional; the renderer checks `electronAPI.ollama.isAvailable()` before running AI nodes.
- The `build.files` whitelist in `package.json` excludes `node_modules/sharp/**` and `node_modules/electron/**` — sharp is dev-only (extraction scripts), electron is provided by the runtime.
- Auto-updater publishes to `github.com/thepegasusgroup/PA-Agents` releases. Bumping `package.json` version and pushing a release triggers update prompts in deployed clients.
- The renderer's `_activeSlot` global must remain accessible to main (it's read via `executeJavaScript` on close) — don't wrap it in a closure or module.
