/**
 * Extract rotation frames from PA object sprites using UNIT=32.
 * Coordinates verified against extract_objects_stage1.js / stage2.js.
 *
 * Frame naming: objectname_r0.webp (South), _r1 (West), _r2 (North), _r3 (East)
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UNIT = 32;
const OUT_DIR = 'C:/Users/admin/Desktop/PA-Agents/src/assets/textures/objects';

const SRC = {
  base: 'C:/Users/admin/Desktop/PA-Extract/main_dat_contents/data/objects.png',
  d11:  'C:/Users/admin/Desktop/PA-Extract/data/objectsTexture_d11.png',
  d11_2:'C:/Users/admin/Desktop/PA-Extract/data/objects_d11_2.png',
};

// ═══════════════════════════════════════════════════════════════
// RT=1, 2x2 sprites (64x64px) → 4 frames in 2x2 grid, each 32x32
// Layout: [S][W] / [N][E]
// ═══════════════════════════════════════════════════════════════
const rt1_2x2 = {
  // Coordinates from stage1/stage2 scripts (verified)
  chair:          { src: 'base', x: 0,  y: 40 },    // OfficeChair
  sofa_single:    { src: 'base', x: 24, y: 15 },    // SofaSingle
  toilet:         { src: 'base', x: 0,  y: 10 },    // Toilet
  tv:             { src: 'base', x: 4,  y: 6  },    // TvSmall
  bookshelf:      { src: 'base', x: 0,  y: 12 },    // Bookshelf
  dining_chair:   { src: 'base', x: 12, y: 56 },    // DiningChair
  bin:            { src: 'base', x: 12, y: 4  },    // Bin
  leather_chair:  { src: 'base', x: 54, y: 52 },    // LeatherChair (stage2 coords!)
};

// ═══════════════════════════════════════════════════════════════
// RT=1, 4x4 sprites (128x128px) → 4 frames in 2x2 grid, each 64x64
// ═══════════════════════════════════════════════════════════════
const rt1_4x4 = {
  office_chair_exec: { src: 'd11', x: 49, y: 60 },   // d_OfficeLeatherChair (stage2)
  computer_station:  { src: 'd11', x: 45, y: 32 },    // d_ComputerStation (stage2)
};

// ═══════════════════════════════════════════════════════════════
// RT=1 tall: 2 frames stacked vertically (South top, North bottom)
// Full sprite is w x h, each frame is w x (h/2)
// ═══════════════════════════════════════════════════════════════
const rt1_tall = {
  bed:            { src: 'base', x: 0,  y: 6,  w: 2, h: 4 },    // Bed (stage1)
  superior_bed:   { src: 'base', x: 50, y: 14, w: 2, h: 4 },    // SuperiorBed (stage1)
  school_desk:    { src: 'base', x: 26, y: 58, w: 2, h: 4 },    // SchoolDesk (stage1)
  weights_bench:  { src: 'base', x: 11, y: 16, w: 2, h: 3 },    // WeightsBench (stage1) — odd height
  bunk_bed:       { src: 'base', x: 53, y: 0,  w: 3, h: 4 },    // BunkBed (stage1)
  treadmill:      { src: 'd11',  x: 41, y: 51, w: 2, h: 4 },    // d_Treadmill (stage2)
};

// ═══════════════════════════════════════════════════════════════
// RT=1 wide: 2 frames side by side (South left, West right)
// splitW = width of south frame (from toolbar/ObjectDef)
// ═══════════════════════════════════════════════════════════════
const rt1_wide = {
  sofa_double:    { src: 'base', x: 30, y: 15, w: 4, h: 2, splitW: 2 },   // (stage1)
  cooker:         { src: 'base', x: 0,  y: 15, w: 4, h: 3, splitW: 3 },   // (stage1)
  fridge:         { src: 'base', x: 0,  y: 19, w: 4, h: 3, splitW: 3 },   // (stage1)
  serving_table:  { src: 'base', x: 0,  y: 37, w: 10,h: 3, splitW: 5 },   // (stage1)
  oak_desk:       { src: 'base', x: 26, y: 62, w: 4, h: 2, splitW: 2 },   // (stage2)
  large_tv:       { src: 'base', x: 18, y: 62, w: 3, h: 2, splitW: 2 },   // (stage1)
  sink:           { src: 'base', x: 23, y: 42, w: 6, h: 3, splitW: 3 },   // (stage1)
  leather_sofa:   { src: 'd11',  x: 58, y: 10, w: 4, h: 2, splitW: 2 },   // (stage2)
  display_counter:{ src: 'd11_2',x: 99, y: 68, w: 6, h: 2, splitW: 4 },   // (stage2)
  brown_sofa:     { src: 'd11_2',x: 38, y:101, w: 4, h: 2, splitW: 2 },   // (stage2)
  blackboard:     { src: 'd11_2',x: 0,  y: 2,  w: 4, h: 2, splitW: 2 },   // (stage2)
};

// ═══════════════════════════════════════════════════════════════
// RT=2: 2 orientations side by side (w/2 each)
// Frame 0 = Horizontal (rot=0), Frame 1 = Vertical (rot=1)
// ═══════════════════════════════════════════════════════════════
const rt2 = {
  bench:          { src: 'base', x: 14, y: 22, w: 8, h: 2 },    // (stage1)
  table:          { src: 'base', x: 11, y: 19, w: 8, h: 3 },    // (stage1)
  pool_table:     { src: 'base', x: 8,  y: 60, w: 6, h: 4 },    // (stage1)
  bookshelf_large:{ src: 'base', x: 28, y: 17, w: 4, h: 4 },    // (stage2)
  dumbbell_rack:  { src: 'd11',  x: 56, y: 46, w: 4, h: 4 },    // (stage2)
  table_tennis:   { src: 'd11',  x: 26, y: 2,  w: 6, h: 4 },    // (stage2)
  foosball:       { src: 'd11',  x: 32, y: 16, w: 6, h: 4 },    // (stage2)
  dining_booth:   { src: 'd11_2',x: 82, y: 73, w: 4, h: 6 },    // (stage2)
};

async function extractAll() {
  let ok = 0, fail = 0;

  // ─── RT=1 2x2: 4 frames in 2x2 grid, each 1×1 unit (32x32px) ───
  for (const [name, s] of Object.entries(rt1_2x2)) {
    const srcPath = SRC[s.src];
    const frames = [
      { rot: 0, fx: 0, fy: 0 },  // South
      { rot: 1, fx: 1, fy: 0 },  // West
      { rot: 2, fx: 0, fy: 1 },  // North
      { rot: 3, fx: 1, fy: 1 },  // East
    ];
    for (const f of frames) {
      const left = (s.x + f.fx) * UNIT;
      const top  = (s.y + f.fy) * UNIT;
      const outPath = path.join(OUT_DIR, `${name}_r${f.rot}.webp`);
      try {
        await sharp(srcPath).extract({ left, top, width: UNIT, height: UNIT })
          .webp({ quality: 95 }).toFile(outPath + '.tmp');
        try { fs.unlinkSync(outPath); } catch(e) {}
        fs.renameSync(outPath + '.tmp', outPath);
        ok++;
        console.log(`  ✓ ${name}_r${f.rot} (${UNIT}x${UNIT})`);
      } catch (err) {
        fail++;
        console.error(`  ✗ ${name}_r${f.rot}: ${err.message}`);
      }
    }
  }

  // ─── RT=1 4x4: 4 frames in 2x2 grid, each 2×2 units (64x64px) ───
  for (const [name, s] of Object.entries(rt1_4x4)) {
    const srcPath = SRC[s.src];
    const frames = [
      { rot: 0, fx: 0, fy: 0 },  // South
      { rot: 1, fx: 2, fy: 0 },  // West
      { rot: 2, fx: 0, fy: 2 },  // North
      { rot: 3, fx: 2, fy: 2 },  // East
    ];
    for (const f of frames) {
      const left = (s.x + f.fx) * UNIT;
      const top  = (s.y + f.fy) * UNIT;
      const outPath = path.join(OUT_DIR, `${name}_r${f.rot}.webp`);
      try {
        await sharp(srcPath).extract({ left, top, width: 2*UNIT, height: 2*UNIT })
          .webp({ quality: 95 }).toFile(outPath + '.tmp');
        try { fs.unlinkSync(outPath); } catch(e) {}
        fs.renameSync(outPath + '.tmp', outPath);
        ok++;
        console.log(`  ✓ ${name}_r${f.rot} (${2*UNIT}x${2*UNIT})`);
      } catch (err) {
        fail++;
        console.error(`  ✗ ${name}_r${f.rot}: ${err.message}`);
      }
    }
  }

  // ─── RT=1 tall: 2 frames stacked (South = top half, North = bottom half) ───
  for (const [name, s] of Object.entries(rt1_tall)) {
    const srcPath = SRC[s.src];
    const halfH = Math.floor(s.h / 2);
    const frames = [
      { rot: 0, fy: 0 },      // South (top)
      { rot: 2, fy: halfH },  // North (bottom)
    ];
    for (const f of frames) {
      const left = s.x * UNIT;
      const top  = (s.y + f.fy) * UNIT;
      const width = s.w * UNIT;
      const height = halfH * UNIT;
      const outPath = path.join(OUT_DIR, `${name}_r${f.rot}.webp`);
      try {
        await sharp(srcPath).extract({ left, top, width, height })
          .webp({ quality: 95 }).toFile(outPath + '.tmp');
        try { fs.unlinkSync(outPath); } catch(e) {}
        fs.renameSync(outPath + '.tmp', outPath);
        ok++;
        console.log(`  ✓ ${name}_r${f.rot} (${width}x${height})`);
      } catch (err) {
        fail++;
        console.error(`  ✗ ${name}_r${f.rot}: ${err.message}`);
      }
    }
  }

  // ─── RT=1 wide: 2 frames side by side (South = left, West = right) ───
  for (const [name, s] of Object.entries(rt1_wide)) {
    const srcPath = SRC[s.src];
    const frames = [
      { rot: 0, fx: 0,       fw: s.splitW },          // South
      { rot: 1, fx: s.splitW, fw: s.w - s.splitW },   // West
    ];
    for (const f of frames) {
      const left = (s.x + f.fx) * UNIT;
      const top  = s.y * UNIT;
      const width = f.fw * UNIT;
      const height = s.h * UNIT;
      const outPath = path.join(OUT_DIR, `${name}_r${f.rot}.webp`);
      try {
        await sharp(srcPath).extract({ left, top, width, height })
          .webp({ quality: 95 }).toFile(outPath + '.tmp');
        try { fs.unlinkSync(outPath); } catch(e) {}
        fs.renameSync(outPath + '.tmp', outPath);
        ok++;
        console.log(`  ✓ ${name}_r${f.rot} (${width}x${height})`);
      } catch (err) {
        fail++;
        console.error(`  ✗ ${name}_r${f.rot}: ${err.message}`);
      }
    }
  }

  // ─── RT=2: 2 orientations side by side (w/2 each) ───
  for (const [name, s] of Object.entries(rt2)) {
    const srcPath = SRC[s.src];
    const halfW = s.w / 2;
    const frames = [
      { rot: 0, fx: 0 },      // Horizontal
      { rot: 1, fx: halfW },  // Vertical
    ];
    for (const f of frames) {
      const left = (s.x + f.fx) * UNIT;
      const top  = s.y * UNIT;
      const width = halfW * UNIT;
      const height = s.h * UNIT;
      const outPath = path.join(OUT_DIR, `${name}_r${f.rot}.webp`);
      try {
        await sharp(srcPath).extract({ left, top, width, height })
          .webp({ quality: 95 }).toFile(outPath + '.tmp');
        try { fs.unlinkSync(outPath); } catch(e) {}
        fs.renameSync(outPath + '.tmp', outPath);
        ok++;
        console.log(`  ✓ ${name}_r${f.rot} (${width}x${height})`);
      } catch (err) {
        fail++;
        console.error(`  ✗ ${name}_r${f.rot}: ${err.message}`);
      }
    }
  }

  console.log(`\nDone: ${ok} frames extracted, ${fail} failed`);
}

extractAll();
