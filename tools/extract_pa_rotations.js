/**
 * Correctly extract PA's rotation frames per the official wiki.
 *
 * Layout per RotateType (https://prisonarchitect.paradoxwikis.com/RotateTypes_Explained):
 *   RT=0: 1 sprite (front only). Engine rotates 90/180/270 to make back/left/right.
 *   RT=1: 3 sprites packed HORIZONTALLY at same y: [front | back | left]. Right = left mirrored.
 *   RT=2: 2 sprites packed: [front | left]. Back same as front. Right = left mirrored.
 *   RT=3: Like RT=1 but doesn't tilt non-square sprites. Layout: [front | back | left].
 *   RT=4: 1 sprite, can't rotate (same in all 4 facings).
 *
 * Game rotation mapping:
 *   rot=0 = South = front
 *   rot=1 = West  = right (= mirrored left)
 *   rot=2 = North = back
 *   rot=3 = East  = left
 *
 * (Note: depending on the renderer's rotation direction convention, west/east may swap.
 *  Adjust the rot→view mapping in the renderer if needed.)
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

// Front sprite location for each object. (x, y) is top-left in cell units.
// w, h is the FRONT sprite's size in cells (back and left are at x+w, x+2w).
// rt is the RotateType (governs how many extra frames to extract).
const objects = {
  // RT=1: front | back | left (3 frames)
  chair:             { src: 'base', x: 0,  y: 40, w: 2, h: 2, rt: 1 },
  sofa_single:       { src: 'base', x: 24, y: 15, w: 2, h: 2, rt: 1 },
  toilet:            { src: 'base', x: 0,  y: 10, w: 2, h: 2, rt: 1 },
  tv:                { src: 'base', x: 4,  y: 6,  w: 2, h: 2, rt: 1 },
  bookshelf:         { src: 'base', x: 0,  y: 12, w: 2, h: 2, rt: 1 },
  leather_chair:     { src: 'base', x: 54, y: 52, w: 2, h: 2, rt: 1 },
  office_chair_exec: { src: 'd11',  x: 49, y: 60, w: 4, h: 4, rt: 1 },
  computer_station:  { src: 'd11',  x: 45, y: 32, w: 4, h: 4, rt: 1 },
  bed:               { src: 'base', x: 0,  y: 6,  w: 2, h: 4, rt: 1 },
  superior_bed:      { src: 'base', x: 50, y: 14, w: 2, h: 4, rt: 1 },
  school_desk:       { src: 'base', x: 26, y: 58, w: 2, h: 4, rt: 1 },
  weights_bench:     { src: 'base', x: 11, y: 16, w: 2, h: 3, rt: 1 },
  bunk_bed:          { src: 'base', x: 53, y: 0,  w: 3, h: 4, rt: 1 },
  treadmill:         { src: 'd11',  x: 41, y: 51, w: 2, h: 4, rt: 1 },
  sofa_double:       { src: 'base', x: 30, y: 15, w: 4, h: 2, rt: 1 },
  cooker:            { src: 'base', x: 0,  y: 15, w: 4, h: 3, rt: 1 },
  fridge:            { src: 'base', x: 0,  y: 19, w: 4, h: 3, rt: 1 },
  serving_table:     { src: 'base', x: 0,  y: 37, w: 10,h: 3, rt: 1 },
  oak_desk:          { src: 'base', x: 26, y: 62, w: 4, h: 2, rt: 1 },
  large_tv:          { src: 'base', x: 18, y: 62, w: 3, h: 2, rt: 1 },
  sink:              { src: 'base', x: 23, y: 42, w: 6, h: 3, rt: 1 },
  leather_sofa:      { src: 'd11',  x: 58, y: 10, w: 4, h: 2, rt: 1 },
  display_counter:   { src: 'd11_2',x: 99, y: 68, w: 6, h: 2, rt: 1 },
  brown_sofa:        { src: 'd11_2',x: 38, y:101, w: 4, h: 2, rt: 1 },
  blackboard:        { src: 'd11_2',x: 0,  y: 2,  w: 4, h: 2, rt: 1 },

  // RT=3: front | back | left (same layout as RT=1)
  dining_chair:      { src: 'base', x: 12, y: 56, w: 2, h: 2, rt: 3 },
  bin:               { src: 'base', x: 12, y: 4,  w: 2, h: 2, rt: 3 },

  // RT=2: front | left
  // Note: PA spritebank w/h is the FRONT sprite size at PA's 32 ppc. Our renderer's
  // baseScale=0.5 maps 2 PA cells → 1 game cell, so e.g. an 8-cell-wide bench sprite
  // renders as 4 game cells, matching the def w:4 h:1.
  bench:             { src: 'base', x: 14, y: 22, w: 8, h: 2, rt: 2 },
  table:             { src: 'base', x: 11, y: 19, w: 8, h: 3, rt: 2 },
  pool_table:        { src: 'base', x: 8,  y: 60, w: 6, h: 4, rt: 2 },
  bookshelf_large:   { src: 'base', x: 28, y: 17, w: 4, h: 4, rt: 2 },
  dumbbell_rack:     { src: 'd11',  x: 56, y: 46, w: 4, h: 4, rt: 2 },
  table_tennis:      { src: 'd11',  x: 26, y: 2,  w: 6, h: 4, rt: 2 },
  foosball:          { src: 'd11',  x: 32, y: 16, w: 6, h: 4, rt: 2 },
  dining_booth:      { src: 'd11_2',x: 82, y: 73, w: 4, h: 6, rt: 2 },
};

async function extract(srcPath, left, top, width, height, outPath, label, mirror = false) {
  try {
    let img = sharp(srcPath).extract({ left, top, width, height });
    if (mirror) img = img.flop();  // horizontal flip
    await img.webp({ quality: 95 }).toFile(outPath + '.tmp');
    try { fs.unlinkSync(outPath); } catch(e) {}
    fs.renameSync(outPath + '.tmp', outPath);
    console.log(`  ✓ ${label} (${width}x${height}${mirror ? ' mirrored' : ''})`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
    return false;
  }
}

(async () => {
  let ok = 0, fail = 0;
  for (const [name, o] of Object.entries(objects)) {
    const srcPath = SRC[o.src];
    const w = o.w * UNIT, h = o.h * UNIT;
    const baseX = o.x * UNIT, baseY = o.y * UNIT;

    // rot=0 = South = front (at baseX)
    // Note: also overwrite the base file as the south view
    (await extract(srcPath, baseX, baseY, w, h, path.join(OUT_DIR, name + '_r0.webp'), name + '_r0')) ? ok++ : fail++;
    (await extract(srcPath, baseX, baseY, w, h, path.join(OUT_DIR, name + '.webp'), name + ' (base)')) ? ok++ : fail++;

    // PA's atlas layout for RT=1 left view:
    //   - Sprite is rotated 90° (size h×w cells: width=h, height=w).
    //   - X position: baseX + 2*w (right after back).
    //   - Y position: baseY + max(0, h - w) — for tall objects, shifted DOWN so its bottom
    //     aligns with the front's bottom (leaves room above for smaller sprites packed there).
    //     For wide/square objects, stays at baseY.
    // For RT=3: side view is NOT rotated, all sprites stay w×h.
    const leftYShift = Math.max(0, o.h - o.w);
    const leftY = (o.y + leftYShift) * UNIT;
    const leftW = o.h * UNIT;  // swapped: width = h cells
    const leftH = o.w * UNIT;  // swapped: height = w cells

    if (o.rt === 1) {
      // front | back | left(rotated)
      // rot=2 = North = back at (x+w, y) — always safe to extract
      (await extract(srcPath, baseX + w, baseY, w, h, path.join(OUT_DIR, name + '_r2.webp'), name + '_r2')) ? ok++ : fail++;
      // For TALL and SQUARE objects (h >= w), PA stores a properly-rotated left view at
      // (x+2w, y+max(0,h-w)) sized h×w. For WIDE objects (w > h), the atlas position
      // collides with neighboring sprites (e.g. sofa_double left would overlap GunRack),
      // so skip the extraction and let the renderer fall back to programmatic rotation.
      if (o.h >= o.w) {
        // rot=3 = East = left
        (await extract(srcPath, baseX + 2*w, leftY, leftW, leftH, path.join(OUT_DIR, name + '_r3.webp'), name + '_r3')) ? ok++ : fail++;
        // rot=1 = West = right = mirrored left
        (await extract(srcPath, baseX + 2*w, leftY, leftW, leftH, path.join(OUT_DIR, name + '_r1.webp'), name + '_r1', true)) ? ok++ : fail++;
      } else {
        // Wide object: delete any stale r1/r3 files from previous (buggy) extractions
        for (const r of ['_r1.webp', '_r3.webp']) {
          const p = path.join(OUT_DIR, name + r);
          if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`  ⊘ ${name}${r} removed (wide → use programmatic rotation)`); }
        }
      }
    } else if (o.rt === 3) {
      // RT=3: no rotation on side view; all sprites w×h
      (await extract(srcPath, baseX + w, baseY, w, h, path.join(OUT_DIR, name + '_r2.webp'), name + '_r2')) ? ok++ : fail++;
      (await extract(srcPath, baseX + 2*w, baseY, w, h, path.join(OUT_DIR, name + '_r3.webp'), name + '_r3')) ? ok++ : fail++;
      (await extract(srcPath, baseX + 2*w, baseY, w, h, path.join(OUT_DIR, name + '_r1.webp'), name + '_r1', true)) ? ok++ : fail++;
    } else if (o.rt === 2) {
      // front | left(rotated)  →  back = same as front, right = mirrored left
      fs.copyFileSync(path.join(OUT_DIR, name + '_r0.webp'), path.join(OUT_DIR, name + '_r2.webp'));
      console.log(`  ✓ ${name}_r2 (copied from front)`);
      ok++;
      // Same as RT=1: only extract side view for TALL/SQUARE objects.
      // Wide RT=2 objects (table, bench) use programmatic rotation for sides.
      if (o.h >= o.w) {
        (await extract(srcPath, baseX + w, leftY, leftW, leftH, path.join(OUT_DIR, name + '_r3.webp'), name + '_r3')) ? ok++ : fail++;
        (await extract(srcPath, baseX + w, leftY, leftW, leftH, path.join(OUT_DIR, name + '_r1.webp'), name + '_r1', true)) ? ok++ : fail++;
      } else {
        for (const r of ['_r1.webp', '_r3.webp']) {
          const p = path.join(OUT_DIR, name + r);
          if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`  ⊘ ${name}${r} removed (wide → use programmatic rotation)`); }
        }
      }
    }
  }
  console.log(`\nDone: ${ok} succeeded, ${fail} failed`);
})();
