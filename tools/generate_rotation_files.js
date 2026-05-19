/**
 * Generate 4 pre-rotated webp files for each object that supports rotation.
 * For objects WITHOUT PA-supplied directional frames (RT=1 in PA), we generate
 * _r0/_r1/_r2/_r3 by rotating the base sprite. User can then hand-edit each
 * file in Photopea to give the object truly distinct rotation views.
 *
 * Skips objects that already have proper PA-supplied rotation frames (bin, dining_chair).
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:/Users/admin/Desktop/PA-Agents/src/assets/textures/objects';

// Objects to generate pre-rotated files for (everything that's rotatable, except those with PA-supplied frames)
const objectsToRotate = [
  'chair', 'leather_chair', 'office_chair_exec', 'sofa_single', 'toilet', 'tv',
  'bookshelf', 'sofa_double', 'cooker', 'fridge', 'serving_table', 'oak_desk',
  'large_tv', 'sink', 'leather_sofa', 'display_counter', 'brown_sofa',
  'blackboard', 'bed', 'superior_bed', 'school_desk', 'weights_bench',
  'bunk_bed', 'treadmill', 'computer_station', 'bench', 'table', 'pool_table',
  'bookshelf_large', 'dumbbell_rack', 'table_tennis', 'foosball', 'dining_booth',
];

// SKIP these — they already have proper PA multi-frame sprites
const skip = new Set(['bin', 'dining_chair']);

async function generateRotations(name) {
  const basePath = path.join(OUT_DIR, name + '.webp');
  if (!fs.existsSync(basePath)) {
    console.error(`  ✗ ${name}: base file not found`);
    return false;
  }

  try {
    // r0 = south = original
    fs.copyFileSync(basePath, path.join(OUT_DIR, name + '_r0.webp'));

    // r1 = west = rotated 90° CCW (270° CW)
    await sharp(basePath).rotate(270).webp({ quality: 95 })
      .toFile(path.join(OUT_DIR, name + '_r1.webp.tmp'));
    fs.renameSync(path.join(OUT_DIR, name + '_r1.webp.tmp'),
                  path.join(OUT_DIR, name + '_r1.webp'));

    // r2 = north = rotated 180°
    await sharp(basePath).rotate(180).webp({ quality: 95 })
      .toFile(path.join(OUT_DIR, name + '_r2.webp.tmp'));
    fs.renameSync(path.join(OUT_DIR, name + '_r2.webp.tmp'),
                  path.join(OUT_DIR, name + '_r2.webp'));

    // r3 = east = rotated 90° CW
    await sharp(basePath).rotate(90).webp({ quality: 95 })
      .toFile(path.join(OUT_DIR, name + '_r3.webp.tmp'));
    fs.renameSync(path.join(OUT_DIR, name + '_r3.webp.tmp'),
                  path.join(OUT_DIR, name + '_r3.webp'));

    console.log(`  ✓ ${name} (4 rotation files)`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    return false;
  }
}

(async () => {
  let ok = 0, fail = 0;
  for (const name of objectsToRotate) {
    if (skip.has(name)) {
      console.log(`  ⊘ ${name}: skipped (has PA multi-frame sprites)`);
      continue;
    }
    const result = await generateRotations(name);
    result ? ok++ : fail++;
  }
  console.log(`\nDone: ${ok} succeeded, ${fail} failed`);
})();
