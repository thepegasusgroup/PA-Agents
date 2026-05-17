# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Pegasus Agents is an Electron desktop app that replicates Prison Architect's UI/UX as a visual interface for managing locally-hosted AI agents. It's UI-only right now — no AI backend yet. Think of it as an isometric management game where "prisoners" are AI agents and "rooms" are functional workspaces.

## Commands

```bash
npm start        # Launch the Electron app
npm run dev       # Launch with --dev flag
```

No test runner, linter, or build step. The app is vanilla JS loaded directly by Electron — no bundler.

The app can also be launched via `PA-Agents.bat (desktop shortcut)`.

## Architecture

**Electron setup:** `main.js` creates a frameless BrowserWindow loading `src/index.html`. Custom title bar with window controls uses IPC via `preload.js` (context isolation enabled, no node integration in renderer).

**Renderer is five scripts loaded in order** (in `src/index.html`):

1. **textures.js** — `Textures` object: manifest of texture name → `.webp` path, async image loader, cache. Wall autotile entries are generated dynamically via spread + `flatMap`.
2. **state.js** — `AppState` singleton (facility stats, camera, grid, tools, workers, HITL queue). Also defines `CT` cell-type enum, `CellTextures` lookup, `CellMinimapColors`, `WallVariantPrefix`, and `ToolbarData`.
3. **grid.js** — `Grid` object: owns the canvas, runs the delta-time game loop (`requestAnimationFrame`), handles mouse/keyboard/edge-scroll input, camera movement, cell placement, draws the minimap.
4. **toolbar.js** — `Toolbar` object: category selection, sub-toolbar population, placement info display.
5. **renderer.js** — DOM initialization: wires up `Textures`, `AppState`, `Grid`, `Toolbar`, todo panel toggle, speed controls, clock update, and window controls.

All state lives on the global `AppState`. No framework, no reactivity — manual DOM updates via `getElementById`.

## UI Layout

The UI uses fixed/absolute positioning so overlays sit on top of the canvas with true transparency (`rgba(0,0,0,0.7)` backgrounds).

- **Title bar** (`#titleBar`, 28px): App name "Pegasus Agents" left, window controls (minimize/maximize/close) right. Uses `-webkit-app-region: drag`.
- **Main area** (`#main-area`): Fills remaining space, contains the canvas and all overlay elements.
- **Top-left: Todo panel** (`.todo-container`): Lined-paper cream background (`rgba(255,248,235,0.88)` + repeating gradient for rules). Top row (230px wide) has todo count + 3 action buttons. Expandable report panel below with checklist items.
- **Top-center: Stat segments** (`.top-segments`): 6 segments — activity level, day, budget, cashflow, agents, tasks. Each is a dark semi-transparent chip.
- **Top-right: Clock & speed** (`.clock-container`): Digital clock display + 4 speed buttons (pause/1x/2x/3x).
- **Bottom: Toolbar** (`#toolbar`, 34px fixed): 3 groups — 11 blue build tools (left), 4 red placeholders (right), 1 folder/reports button (far right). Blueprint grid overlay on button icons via CSS `::before`.
- **Sub-toolbar** (`.sub-toolbar`, 110px fixed at `bottom: 34px`): Populates dynamically when a toolbar category is selected.
- **Bottom-right: Minimap** (160x120px): Canvas rendering of the full grid.

## Camera & Input Controls

Delta-time game loop ensures framerate-independent movement.

| Control | Action |
|---------|--------|
| WASD / Arrow keys | Pan camera |
| Q / E | Zoom in / out (exponential rate) |
| Scroll wheel | Zoom at cursor position |
| Middle-click drag | Pan camera |
| Edge scroll | Move cursor to screen edges |
| Left-click drag | Place/demolish cells |
| Escape | Clear tool selection |

Camera state in `AppState.camera`: `panSpeed: 600`, `edgeScrollMargin: 10`, `edgeScrollSpeed: 500`, zoom range `0.3-3`.

## Grid & Cell System

- 100x100 grid stored as a flat `Uint8Array` (index = `gy * width + gx`).
- Cell size: 32px.
- `AppState.getCell(gx, gy)` / `setCell(gx, gy, value)` with bounds checking.

**Cell type ranges** (`CT` enum in state.js):
- `0` = EMPTY
- `1-35` = Walls (BRICK_WALL through DOOR)
- `50-73` = Indoor floors
- `100-118` = Outdoor floors

`Grid.isWall(cellType)` returns true for values 1-35.

## Two-Pass Rendering

1. **Pass 1 — Floors:** Non-wall, non-empty cells drawn as simple texture blits.
2. **Pass 2 — Walls with autotile:** For each wall cell, compute a 4-bit neighbor bitmask, look up the variant texture, draw it. Falls back to base texture if no variants exist.

## Wall Autotile System

Every wall type has 16 pre-extracted sprites (one per neighbor configuration). No rotation needed.

**Bitmask:** `N=1 | S=2 | W=4 | E=8` — each bit is set if the adjacent cell in that direction is also a wall. Produces mask 0-15.

**Lookup:** `WallVariantPrefix[cellType]` returns a prefix string (e.g., `'cw'` for concrete wall). The texture key is `prefix + '_' + mask` (e.g., `'cw_12'` for a horizontal concrete wall segment).

**Texture files:** `assets/textures/walls/<wall_name>/0.webp` through `15.webp`.

**33 wall types** have full autotile support. The prefix map is in `WallVariantPrefix` (state.js).

## Toolbar Structure

3 groups in ToolbarData (state.js):
- **Blue (build):** foundations, materials, rooms, objects, staff, utilities, deployment, logistics, emergencies, clone, planning
- **Red (placeholder):** red_1-4 (empty, reserved)
- **Folder:** reports

Categories with items: foundations (21 walls), materials (35 floors), rooms (6), objects (6), staff (5), utilities (4), reports (3). Others are empty stubs.

## PA Tileset Extraction

Wall sprites come from Prison Architect's `tilesetpadded.png` (4608x4608, stride=72px, tile=64px, padding=4px per side). Two sprite systems:

- **Linked** (ConcreteWall): 18 explicit sprite positions in `materials.txt`.
- **Connected** (all others): 7x4 grid from a single base position. Both use the same offset table:

```
mask -> [col_offset, row_offset] from grid origin
0->[0,3]  1->[0,2]  2->[0,1]  3->[0,0]
4->[1,2]  5->[3,1]  6->[3,0]  7->[5,2]
8->[1,1]  9->[2,1]  10->[2,0] 11->[4,2]
12->[1,0] 13->[4,1] 14->[4,0] 15->[6,2]
```

Extraction uses `sharp` (npm dependency) to slice tiles from the tileset. The extracted data lives in `the PA-Extract directory (e.g. `PA-Extract/data/`)` (materials.txt, tilesetpadded.png). Base game walls are in `materials.txt`; DLC walls are in `materials_dlc.txt`.

## Asset Conventions

- All textures are `.webp` format.
- Wall base textures: `assets/textures/walls/<Name>.webp` (used as fallback).
- Wall autotile: `assets/textures/walls/<name>/0.webp` through `15.webp`.
- Floor textures: `assets/textures/flooring/<Name>.webp`.
- Texture patterns are cached in `Grid.texturePatterns` and invalidated on zoom change.

## CSS & Layout

- Dark theme with CSS custom properties in `:root` (main.css).
- Title bar: 28px. Bottom toolbar: 34px (fixed). Sub-toolbar: 110px (fixed at `bottom: 34px`).
- All overlays use `rgba(0,0,0,0.7)` or similar semi-transparent black backgrounds for canvas visibility.
- Fonts: Roboto Condensed (UI), Share Tech Mono (numbers/data).
- Accent: orange `#e8821a`, blue `#4a90c4`, green `#5cb85c`.
- Toolbar buttons: `.blue` (gradient #2a6ab0->#1a4a7c), `.red` (gradient #8a2a2a->#5c1a1a), `.folder` (gradient #3a3a3a->#2a2a2a). Blueprint grid overlay via `::before` pseudo-element.
