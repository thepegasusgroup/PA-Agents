/**
 * Extract the VERTICAL frame for RT=2 objects.
 * RT=2 sprites have horizontal + vertical views packed side by side.
 * We already have the horizontal one as <name>.webp — now extract the vertical
 * as <name>_v.webp so the renderer can use the proper PA sprite when rotated.
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

// RT=2: horizontal left, vertical right (each w/2 wide)
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

  console.log('\n── RT=2 vertical sprites (right half) ──');
  for (const [name, s] of Object.entries(rt2)) {
    const halfW = s.w / 2;
    // Right half is the vertical view
    const result = await extractFrame(
      SRC[s.src], (s.x + halfW) * UNIT, s.y * UNIT, halfW * UNIT, s.h * UNIT,
      path.join(OUT_DIR, `${name}_v.webp`), name + '_v'
    );
    result ? ok++ : fail++;
  }

  console.log(`\nDone: ${ok} vertical sprites extracted, ${fail} failed`);
}

extractAll();
