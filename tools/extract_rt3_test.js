/**
 * Test if RT=3 objects have 4 packed directional sprites in 2x2 grid.
 * Extract dining_chair (RT=3, 2x2 at base) and bin (RT=3, 2x2 at base).
 * Frame layout assumption: TL=S(0), TR=W(1), BL=N(2), BR=E(3)
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

// RT=3 objects with 2x2 sprite area — assume 4 packed frames (1x1 each)
const rt3_2x2 = {
  dining_chair: { src: 'base', x: 12, y: 56 },
  bin:          { src: 'base', x: 12, y: 4 },
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

(async () => {
  console.log('\n── RT=3 2x2 (test: extract 4 frames each) ──');
  for (const [name, s] of Object.entries(rt3_2x2)) {
    // 4 frames in 2x2 grid: TL=S, TR=W, BL=N, BR=E
    const frames = [
      { rot: 0, dx: 0,    dy: 0 },       // South
      { rot: 1, dx: UNIT, dy: 0 },       // West
      { rot: 2, dx: 0,    dy: UNIT },    // North
      { rot: 3, dx: UNIT, dy: UNIT },    // East
    ];
    for (const f of frames) {
      await extractFrame(
        SRC[s.src], s.x * UNIT + f.dx, s.y * UNIT + f.dy, UNIT, UNIT,
        path.join(OUT_DIR, `${name}_r${f.rot}.webp`), `${name}_r${f.rot}`
      );
    }
  }
  console.log('\nDone');
})();
