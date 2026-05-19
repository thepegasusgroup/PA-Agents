/**
 * Extract the FULL sprite for each PA object.
 * For RT=1, the entire sprite area is ONE view (PA's "sprite extends beyond footprint" style).
 * For RT=2, the sprite contains 2 packed views (horizontal + vertical), so we extract the LEFT half.
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

// RT=1 — sprite is one view, sprite size given as w x h (cells)
const rt1 = {
  chair:             { src: 'base', x: 0,  y: 40, w: 2, h: 2 },
  sofa_single:       { src: 'base', x: 24, y: 15, w: 2, h: 2 },
  toilet:            { src: 'base', x: 0,  y: 10, w: 2, h: 2 },
  tv:                { src: 'base', x: 4,  y: 6,  w: 2, h: 2 },
  bookshelf:         { src: 'base', x: 0,  y: 12, w: 2, h: 2 },
  dining_chair:      { src: 'base', x: 12, y: 56, w: 2, h: 2 },
  bin:               { src: 'base', x: 12, y: 4,  w: 2, h: 2 },
  leather_chair:     { src: 'base', x: 54, y: 52, w: 2, h: 2 },
  office_chair_exec: { src: 'd11',  x: 49, y: 60, w: 4, h: 4 },
  computer_station:  { src: 'd11',  x: 45, y: 32, w: 4, h: 4 },
  bed:               { src: 'base', x: 0,  y: 6,  w: 2, h: 4 },
  superior_bed:      { src: 'base', x: 50, y: 14, w: 2, h: 4 },
  school_desk:       { src: 'base', x: 26, y: 58, w: 2, h: 4 },
  weights_bench:     { src: 'base', x: 11, y: 16, w: 2, h: 3 },
  bunk_bed:          { src: 'base', x: 53, y: 0,  w: 3, h: 4 },
  treadmill:         { src: 'd11',  x: 41, y: 51, w: 2, h: 4 },
  sofa_double:       { src: 'base', x: 30, y: 15, w: 4, h: 2 },
  cooker:            { src: 'base', x: 0,  y: 15, w: 4, h: 3 },
  fridge:            { src: 'base', x: 0,  y: 19, w: 4, h: 3 },
  serving_table:     { src: 'base', x: 0,  y: 37, w: 10,h: 3 },
  oak_desk:          { src: 'base', x: 26, y: 62, w: 4, h: 2 },
  large_tv:          { src: 'base', x: 18, y: 62, w: 3, h: 2 },
  sink:              { src: 'base', x: 23, y: 42, w: 6, h: 3 },
  leather_sofa:      { src: 'd11',  x: 58, y: 10, w: 4, h: 2 },
  display_counter:   { src: 'd11_2',x: 99, y: 68, w: 6, h: 2 },
  brown_sofa:        { src: 'd11_2',x: 38, y:101, w: 4, h: 2 },
  blackboard:        { src: 'd11_2',x: 0,  y: 2,  w: 4, h: 2 },
};

// RT=2 — 2 views packed side-by-side, take left half (horizontal)
const rt2 = {
  bench:           { src: 'base', x: 14, y: 22, w: 8, h: 2 },
  table:           { src: 'base', x: 11, y: 19, w: 8, h: 3 },
  pool_table:      { src: 'base', x: 8,  y: 60, w: 6, h: 4 },
  bookshelf_large: { src: 'base', x: 28, y: 17, w: 4, h: 4 },
  dumbbell_rack:   { src: 'd11',  x: 56, y: 46, w: 4, h: 4 },
  table_tennis:    { src: 'd11',  x: 26, y: 2,  w: 6, h: 4 },
  foosball:        { src: 'd11',  x: 32, y: 16, w: 6, h: 4 },
  dining_booth:    { src: 'd11_2',x: 82, y: 73, w: 4, h: 6 },
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

  console.log('\n── RT=1 (full sprite) ──');
  for (const [name, s] of Object.entries(rt1)) {
    const result = await extractFrame(
      SRC[s.src], s.x * UNIT, s.y * UNIT, s.w * UNIT, s.h * UNIT,
      path.join(OUT_DIR, `${name}.webp`), name
    );
    result ? ok++ : fail++;
  }

  console.log('\n── RT=2 (left half = horizontal) ──');
  for (const [name, s] of Object.entries(rt2)) {
    const halfW = s.w / 2;
    const result = await extractFrame(
      SRC[s.src], s.x * UNIT, s.y * UNIT, halfW * UNIT, s.h * UNIT,
      path.join(OUT_DIR, `${name}.webp`), name
    );
    result ? ok++ : fail++;
  }

  console.log(`\nDone: ${ok} sprites extracted, ${fail} failed`);
}

extractAll();
