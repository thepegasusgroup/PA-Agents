/**
 * Extract just the SOUTH/HORIZONTAL (frame 0) of each PA sprite.
 * Replaces double-sized packed sprites with single-frame sprites.
 *
 * Issue: Previous extraction grabbed the full multi-frame sprite (e.g. 64x64 for
 * a 1x1 object) which contained all 4 rotation frames. The renderer then squashed
 * all 4 into one cell, looking wrong.
 *
 * Fix: Extract just frame 0 (south-facing for RT=1, horizontal for RT=2).
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

// RT=1, 2x2 sprites — frame 0 is top-left 1x1 cell
const rt1_2x2 = {
  chair:             { src: 'base', x: 0,  y: 40 },
  sofa_single:       { src: 'base', x: 24, y: 15 },
  toilet:            { src: 'base', x: 0,  y: 10 },
  tv:                { src: 'base', x: 4,  y: 6  },
  bookshelf:         { src: 'base', x: 0,  y: 12 },
  dining_chair:      { src: 'base', x: 12, y: 56 },
  bin:               { src: 'base', x: 12, y: 4  },
  leather_chair:     { src: 'base', x: 54, y: 52 },
};

// RT=1, 4x4 sprites — frame 0 is top-left 2x2 cells
const rt1_4x4 = {
  office_chair_exec: { src: 'd11', x: 49, y: 60 },
  computer_station:  { src: 'd11', x: 45, y: 32 },
};

// RT=1 tall — frame 0 is top half
const rt1_tall = {
  bed:            { src: 'base', x: 0,  y: 6,  w: 2, h: 4 },
  superior_bed:   { src: 'base', x: 50, y: 14, w: 2, h: 4 },
  school_desk:    { src: 'base', x: 26, y: 58, w: 2, h: 4 },
  weights_bench:  { src: 'base', x: 11, y: 16, w: 2, h: 3 },
  bunk_bed:       { src: 'base', x: 53, y: 0,  w: 3, h: 4 },
  treadmill:      { src: 'd11',  x: 41, y: 51, w: 2, h: 4 },
};

// RT=1 wide — frame 0 is left "splitW" cells
const rt1_wide = {
  sofa_double:    { src: 'base', x: 30, y: 15, w: 4, h: 2, splitW: 2 },
  cooker:         { src: 'base', x: 0,  y: 15, w: 4, h: 3, splitW: 3 },
  fridge:         { src: 'base', x: 0,  y: 19, w: 4, h: 3, splitW: 3 },
  serving_table:  { src: 'base', x: 0,  y: 37, w: 10,h: 3, splitW: 5 },
  oak_desk:       { src: 'base', x: 26, y: 62, w: 4, h: 2, splitW: 2 },
  large_tv:       { src: 'base', x: 18, y: 62, w: 3, h: 2, splitW: 2 },
  sink:           { src: 'base', x: 23, y: 42, w: 6, h: 3, splitW: 3 },
  leather_sofa:   { src: 'd11',  x: 58, y: 10, w: 4, h: 2, splitW: 2 },
  display_counter:{ src: 'd11_2',x: 99, y: 68, w: 6, h: 2, splitW: 4 },
  brown_sofa:     { src: 'd11_2',x: 38, y:101, w: 4, h: 2, splitW: 2 },
  blackboard:     { src: 'd11_2',x: 0,  y: 2,  w: 4, h: 2, splitW: 2 },
};

// RT=2 — frame 0 is left half (horizontal orientation)
const rt2 = {
  bench:          { src: 'base', x: 14, y: 22, w: 8, h: 2 },
  table:          { src: 'base', x: 11, y: 19, w: 8, h: 3 },
  pool_table:     { src: 'base', x: 8,  y: 60, w: 6, h: 4 },
  bookshelf_large:{ src: 'base', x: 28, y: 17, w: 4, h: 4 },
  dumbbell_rack:  { src: 'd11',  x: 56, y: 46, w: 4, h: 4 },
  table_tennis:   { src: 'd11',  x: 26, y: 2,  w: 6, h: 4 },
  foosball:       { src: 'd11',  x: 32, y: 16, w: 6, h: 4 },
  dining_booth:   { src: 'd11_2',x: 82, y: 73, w: 4, h: 6 },
};

async function extractFrame(srcPath, left, top, width, height, outPath, name) {
  try {
    await sharp(srcPath).extract({ left, top, width, height })
      .webp({ quality: 95 }).toFile(outPath + '.tmp');
    try { fs.unlinkSync(outPath); } catch(e) {}
    fs.renameSync(outPath + '.tmp', outPath);
    console.log(`  ✓ ${name} (${width}x${height})`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    return false;
  }
}

async function extractAll() {
  let ok = 0, fail = 0;

  // RT=1 2x2: extract top-left 1x1 cell
  console.log('\n── RT=1 2x2 (1x1 frame each) ──');
  for (const [name, s] of Object.entries(rt1_2x2)) {
    const result = await extractFrame(
      SRC[s.src], s.x * UNIT, s.y * UNIT, UNIT, UNIT,
      path.join(OUT_DIR, `${name}.webp`), name
    );
    result ? ok++ : fail++;
  }

  // RT=1 4x4: extract top-left 2x2 cells
  console.log('\n── RT=1 4x4 (2x2 frame each) ──');
  for (const [name, s] of Object.entries(rt1_4x4)) {
    const result = await extractFrame(
      SRC[s.src], s.x * UNIT, s.y * UNIT, 2*UNIT, 2*UNIT,
      path.join(OUT_DIR, `${name}.webp`), name
    );
    result ? ok++ : fail++;
  }

  // RT=1 tall: extract top half
  console.log('\n── RT=1 tall (top half) ──');
  for (const [name, s] of Object.entries(rt1_tall)) {
    const halfH = Math.floor(s.h / 2);
    const result = await extractFrame(
      SRC[s.src], s.x * UNIT, s.y * UNIT, s.w * UNIT, halfH * UNIT,
      path.join(OUT_DIR, `${name}.webp`), name
    );
    result ? ok++ : fail++;
  }

  // RT=1 wide: extract left splitW cells
  console.log('\n── RT=1 wide (left splitW) ──');
  for (const [name, s] of Object.entries(rt1_wide)) {
    const result = await extractFrame(
      SRC[s.src], s.x * UNIT, s.y * UNIT, s.splitW * UNIT, s.h * UNIT,
      path.join(OUT_DIR, `${name}.webp`), name
    );
    result ? ok++ : fail++;
  }

  // RT=2: extract left half (horizontal frame)
  console.log('\n── RT=2 (left half) ──');
  for (const [name, s] of Object.entries(rt2)) {
    const halfW = s.w / 2;
    const result = await extractFrame(
      SRC[s.src], s.x * UNIT, s.y * UNIT, halfW * UNIT, s.h * UNIT,
      path.join(OUT_DIR, `${name}.webp`), name
    );
    result ? ok++ : fail++;
  }

  console.log(`\nDone: ${ok} frames extracted, ${fail} failed`);
}

extractAll();
