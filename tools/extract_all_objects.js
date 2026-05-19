/**
 * Extract ALL object textures from PA sprite sheets using spritebank coordinates.
 * Sources: objects.png (base), objectsTexture_d11.png (DLC1), objects_d11_2.png (DLC2)
 * UNIT = 16px per spritebank unit.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UNIT = 16;
const PA_DATA = 'C:/Users/admin/Desktop/PA-Extract/data';
const OUT_DIR = 'C:/Users/admin/Desktop/PA-Agents/src/assets/textures/objects';

const SRC = {
  base:  path.join(PA_DATA, 'objects.png'),
  dlc1:  path.join(PA_DATA, 'objectsTexture_d11.png'),
  dlc2:  path.join(PA_DATA, 'objects_d11_2.png'),
};

// Mapping: filename -> { src, x, y, w, h } (all in UNIT coords)
const sprites = {
  // ══════════════ Base game (objects.png) ══════════════
  'bed':              { src: 'base', x: 0, y: 6, w: 2, h: 2 },       // BedToolbar
  'bunk_bed':         { src: 'base', x: 59, y: 2, w: 2, h: 2 },      // BunkBedToolbar
  'superior_bed':     { src: 'base', x: 50, y: 14, w: 2, h: 2 },     // SuperiorBedToolbar
  'crib':             { src: 'base', x: 53, y: 4, w: 2, h: 2 },      // Cot
  'chair':            { src: 'base', x: 0, y: 22, w: 2, h: 2 },      // SwivelChair
  'bench':            { src: 'base', x: 22, y: 22, w: 2, h: 2 },     // BenchToolbar
  'sofa_single':      { src: 'base', x: 24, y: 15, w: 2, h: 2 },     // SofaSingle
  'sofa_double':      { src: 'base', x: 30, y: 15, w: 2, h: 2 },     // SofaDoubleToolbar
  'table':            { src: 'base', x: 19, y: 19, w: 3, h: 3 },     // TableToolbar
  'school_desk':      { src: 'base', x: 32, y: 60, w: 2, h: 2 },     // SchoolDeskToolbar
  'filing_cabinet':   { src: 'base', x: 10, y: 42, w: 2, h: 2 },     // FilingCabinetToolbar
  'cooker':           { src: 'base', x: 0, y: 15, w: 3, h: 3 },      // CookerToolbar
  'fridge':           { src: 'base', x: 0, y: 19, w: 3, h: 3 },      // FridgeToolbar
  'sink':             { src: 'base', x: 5, y: 54, w: 2, h: 2 },      // Sink
  'serving_table':    { src: 'base', x: 0, y: 37, w: 3, h: 3 },      // ServingTableToolbar
  'bin':              { src: 'base', x: 12, y: 4, w: 2, h: 2 },      // Bin
  'drink_machine':    { src: 'base', x: 40, y: 12, w: 2, h: 2 },     // DrinkMachineToolbar
  'toilet':           { src: 'base', x: 0, y: 10, w: 2, h: 2 },      // Toilet
  'tv':               { src: 'base', x: 4, y: 6, w: 2, h: 2 },       // TvSmall
  'large_tv':         { src: 'base', x: 18, y: 62, w: 3, h: 2 },     // TvLarge
  'pool_table':       { src: 'base', x: 14, y: 60, w: 4, h: 4 },     // PoolTableToolbar
  'radio':            { src: 'base', x: 14, y: 6, w: 2, h: 2 },      // Radio
  'phone_booth':      { src: 'base', x: 10, y: 2, w: 2, h: 2 },      // PhoneBooth
  'bookshelf':        { src: 'base', x: 0, y: 12, w: 2, h: 2 },      // Bookshelf
  'arcade_cabinet':   { src: 'base', x: 40, y: 14, w: 2, h: 3 },     // ArcadeCabinetToolbar
  'weights_bench':    { src: 'base', x: 11, y: 16, w: 2, h: 3 },     // WeightsBench
  'play_mat':         { src: 'base', x: 57, y: 4, w: 2, h: 2 },      // PlayMat
  'power_station':    { src: 'base', x: 0, y: 44, w: 6, h: 6 },      // PowerStation
  'capacitor':        { src: 'base', x: 6, y: 44, w: 2, h: 2 },      // Capacitor
  'radiator':         { src: 'base', x: 16, y: 42, w: 2, h: 2 },     // Radiator
  'light':            { src: 'base', x: 35, y: 10, w: 2, h: 2 },     // Light
  'window':           { src: 'base', x: 6, y: 10, w: 2, h: 2 },      // Window (window_obj)
  'window_large':     { src: 'base', x: 11, y: 10, w: 2, h: 2 },     // WindowLargeToolbar
  'tree':             { src: 'base', x: 4, y: 56, w: 4, h: 4 },      // Tree
  'water_pump':       { src: 'base', x: 10, y: 44, w: 6, h: 6 },     // WaterStation
  'big_desk':         { src: 'base', x: 8, y: 40, w: 2, h: 4 },      // BigDesk
  'double_bed':       { src: 'base', x: 0, y: 50, w: 3, h: 4 },      // DoubleBed
  'bookshelf_large':  { src: 'base', x: 28, y: 17, w: 4, h: 4 },     // BookshelfLarge
  'dining_chair':     { src: 'base', x: 12, y: 56, w: 2, h: 2 },     // DiningChair
  'dining_table':     { src: 'base', x: 30, y: 54, w: 3, h: 6 },     // DiningTable
  'oak_desk':         { src: 'base', x: 26, y: 62, w: 4, h: 2 },     // OakDesk
  'oak_bookshelf':    { src: 'base', x: 19, y: 46, w: 4, h: 4 },     // OakBookshelf
  'library_bookshelf':{ src: 'base', x: 28, y: 17, w: 2, h: 2 },     // LibraryBookshelfToolbar
  'cupboard':         { src: 'base', x: 7, y: 50, w: 4, h: 4 },      // Cupboard
  'laundry_basket':   { src: 'base', x: 26, y: 19, w: 2, h: 2 },     // LaundryBasket
  'laundry_machine':  { src: 'base', x: 38, y: 44, w: 2, h: 2 },     // LaundryMachineToolbar
  'ironing_board':    { src: 'base', x: 51, y: 26, w: 2, h: 2 },     // IroningBoardToolbar
  'candelabra':       { src: 'base', x: 24, y: 59, w: 2, h: 2 },     // Candelabra
  'boombox':          { src: 'base', x: 22, y: 8, w: 2, h: 2 },      // Boombox
  'electrical_switch':{ src: 'base', x: 20, y: 6, w: 2, h: 2 },      // ElectricalSwitch
  'fire_extinguisher':{ src: 'base', x: 28, y: 8, w: 2, h: 2 },      // FireExtinguisher
  'glass_window':     { src: 'base', x: 0, y: 54, w: 2, h: 2 },      // GlassWindow
  'hydrant':          { src: 'base', x: 57, y: 56, w: 2, h: 2 },     // Hydrant
  'light_outdoor':    { src: 'base', x: 18, y: 4, w: 2, h: 2 },      // LightOutdoor
  'mailbox':          { src: 'base', x: 57, y: 54, w: 2, h: 2 },     // MailBox
  'bathtub':          { src: 'base', x: 18, y: 56, w: 5, h: 3 },     // Bathtub
  'phone_monitor':    { src: 'base', x: 38, y: 26, w: 2, h: 3 },     // PhoneMonitor
  'banner':           { src: 'base', x: 56, y: 48, w: 8, h: 4 },     // Banner
  'food_tray':        { src: 'base', x: 10, y: 102, w: 2, h: 2 },    // FoodTray

  // ══════════════ DLC 1 (objectsTexture_d11.png) ══════════════
  'bathroom_sink':    { src: 'dlc1', x: 14, y: 4, w: 2, h: 2 },      // d_BathroomSink
  'lamp':             { src: 'dlc1', x: 6, y: 6, w: 2, h: 2 },       // d_LampToolbar
  'leather_chair':    { src: 'dlc1', x: 56, y: 6, w: 2, h: 2 },      // d_LeatherChair
  'leather_sofa':     { src: 'dlc1', x: 58, y: 10, w: 2, h: 2 },     // d_LeatherSofaToolbar
  'coat_stand':       { src: 'dlc1', x: 4, y: 21, w: 2, h: 2 },      // d_CoatStandToolbar
  'chest_drawers':    { src: 'dlc1', x: 20, y: 1, w: 2, h: 2 },      // d_ChestOfDrawersToolbar
  'small_table':      { src: 'dlc1', x: 4, y: 27, w: 2, h: 2 },      // d_SmallTableToolbar
  'wooden_stool':     { src: 'dlc1', x: 16, y: 2, w: 2, h: 2 },      // d_WoodenStool
  'wooden_table':     { src: 'dlc1', x: 18, y: 0, w: 2, h: 2 },      // d_WoodenTable
  'oak_bench':        { src: 'dlc1', x: 39, y: 33, w: 2, h: 2 },     // d_OakBenchToolbar
  'park_bench':       { src: 'dlc1', x: 14, y: 8, w: 3, h: 3 },      // d_ParkBenchToolbar
  'small_bench':      { src: 'dlc1', x: 12, y: 12, w: 2, h: 2 },     // d_SmallBenchToolbar
  'picnic_table':     { src: 'dlc1', x: 18, y: 13, w: 6, h: 6 },     // d_OutdoorPicnicTableToolbar
  'oval_table':       { src: 'dlc1', x: 17, y: 23, w: 2, h: 2 },     // d_OvalStaffTableToolbar
  'coffee_machine':   { src: 'dlc1', x: 26, y: 36, w: 2, h: 2 },     // d_CoffeeMachineToolbar
  'water_cooler':     { src: 'dlc1', x: 56, y: 18, w: 2, h: 2 },     // d_WaterCoolerToolbar
  'snack_machine':    { src: 'dlc1', x: 56, y: 22, w: 2, h: 2 },     // d_SnackMachineToolbar
  'bookshelf_short':  { src: 'dlc1', x: 18, y: 19, w: 2, h: 2 },     // d_BookshelfShortToolbar
  'chess_table':      { src: 'dlc1', x: 21, y: 8, w: 2, h: 2 },      // d_ChessTable
  'foosball':         { src: 'dlc1', x: 32, y: 16, w: 6, h: 4 },     // d_TableFootball
  'table_tennis':     { src: 'dlc1', x: 26, y: 2, w: 6, h: 4 },      // d_TableTennis
  'treadmill':        { src: 'dlc1', x: 45, y: 53, w: 2, h: 2 },     // d_TreadmillToolbar
  'punch_bag':        { src: 'dlc1', x: 32, y: 25, w: 2, h: 3 },     // d_PunchBagToolbar
  'dumbbell_rack':    { src: 'dlc1', x: 56, y: 46, w: 4, h: 3 },     // d_DumbbellRackToolbar
  'gym_mat':          { src: 'dlc1', x: 26, y: 0, w: 2, h: 2 },      // d_GymMat
  'canvas':           { src: 'dlc1', x: 18, y: 35, w: 2, h: 2 },     // d_CanvasToolbar
  'painting1':        { src: 'dlc1', x: 26, y: 54, w: 2, h: 2 },     // d_Painting1
  'painting2':        { src: 'dlc1', x: 28, y: 54, w: 2, h: 2 },     // d_Painting2
  'plant':            { src: 'dlc1', x: 2, y: 8, w: 2, h: 2 },       // d_Plant
  'plant_cactus':     { src: 'dlc1', x: 4, y: 8, w: 2, h: 2 },       // d_PlantCactus
  'bush':             { src: 'dlc1', x: 0, y: 8, w: 2, h: 2 },       // d_Bush
  'tree_cactus':      { src: 'dlc1', x: 12, y: 0, w: 4, h: 4 },      // d_TreeCactus
  'tree_sakura':      { src: 'dlc1', x: 10, y: 4, w: 4, h: 4 },      // d_TreeSakura
  'tree_snowy':       { src: 'dlc1', x: 8, y: 0, w: 4, h: 4 },       // d_TreeSnowyConifer
  'tree_spooky':      { src: 'dlc1', x: 0, y: 0, w: 4, h: 4 },       // d_TreeSpooky
  'flood_light':      { src: 'dlc1', x: 4, y: 14, w: 2, h: 2 },      // d_FloodLightToolbar
  'street_lamp':      { src: 'dlc1', x: 14, y: 14, w: 4, h: 4 },     // d_StreetLampToolbar
  'wall_light':       { src: 'dlc1', x: 6, y: 24, w: 1, h: 1 },      // d_WallLight
  'sink_mirror':      { src: 'dlc1', x: 20, y: 6, w: 2, h: 2 },      // d_SinkMirror
  'hand_dryer':       { src: 'dlc1', x: 14, y: 6, w: 2, h: 2 },      // d_HandDryer
  'flipboard':        { src: 'dlc1', x: 50, y: 14, w: 2, h: 2 },     // d_FlipboardToolbar
  'computer_station': { src: 'dlc1', x: 45, y: 32, w: 4, h: 4 },     // d_ComputerStation
  'stone_fountain':   { src: 'dlc1', x: 53, y: 24, w: 3, h: 3 },     // d_StoneWaterSpoutToolbar
  'metal_barrel':     { src: 'dlc1', x: 34, y: 26, w: 2, h: 2 },     // d_MetalBarrelToolbar
  'wooden_barrel':    { src: 'dlc1', x: 36, y: 26, w: 2, h: 2 },     // d_WoodenBarrelToolbar
  'moose_head':       { src: 'dlc1', x: 33, y: 10, w: 2, h: 2 },     // d_MooseHead
  'bird_cage':        { src: 'dlc1', x: 34, y: 35, w: 2, h: 2 },     // d_BirdCageToolbar
  'office_chair_exec':{ src: 'dlc1', x: 50, y: 61, w: 2, h: 2 },     // d_OfficeLeatherChairToolbar
  'statue':           { src: 'dlc1', x: 41, y: 29, w: 4, h: 4 },     // d_WardenStatue
  'door_mat':         { src: 'dlc1', x: 8, y: 42, w: 2, h: 2 },      // d_DoorMat
  'indoor_planter':   { src: 'dlc1', x: 50, y: 23, w: 2, h: 2 },     // d_IndoorTreePlanter
  'oak_table':        { src: 'dlc1', x: 28, y: 47, w: 6, h: 4 },     // d_OakTableToolbar
  'window_classy':    { src: 'dlc1', x: 8, y: 51, w: 2, h: 2 },      // d_WindowClassy
  'window_classy_large':{ src: 'dlc1', x: 14, y: 11, w: 3, h: 3 },   // d_WindowClassyLargeToolbar
  'window_glass':     { src: 'dlc1', x: 27, y: 8, w: 2, h: 2 },      // d_WindowGlass
  'window_glass_large':{ src: 'dlc1', x: 27, y: 10, w: 4, h: 2 },    // d_WindowGlassLarge

  // ══════════════ DLC 2 (objects_d11_2.png) ══════════════
  'chandelier':       { src: 'dlc2', x: 93, y: 64, w: 2, h: 2 },     // d_Chandelier
  'backup_generator': { src: 'dlc2', x: 12, y: 87, w: 6, h: 6 },     // d_BackupGenerator
  'battery':          { src: 'dlc2', x: 97, y: 5, w: 2, h: 2 },      // d_Battery
  'solar_panel':      { src: 'dlc2', x: 91, y: 0, w: 6, h: 4 },      // d_SolarPanels
  'fan':              { src: 'dlc2', x: 0, y: 107, w: 3, h: 3 },      // d_FanToolbar
  'fire_alarm':       { src: 'dlc2', x: 72, y: 89, w: 2, h: 2 },     // d_FireAlarm
  'filing_cabinet_fancy':{ src: 'dlc2', x: 92, y: 93, w: 2, h: 2 },  // d_FilingCabinetFancyToolbar
  'drinking_fountain':{ src: 'dlc2', x: 18, y: 89, w: 2, h: 2 },     // d_DrinkingFountain
  'display_counter':  { src: 'dlc2', x: 99, y: 68, w: 4, h: 2 },     // d_DisplayCounterToolbar
  'dining_booth':     { src: 'dlc2', x: 86, y: 75, w: 4, h: 4 },     // d_DiningBoothToolbar
  'dining_table_small':{ src: 'dlc2', x: 74, y: 72, w: 3, h: 4 },    // d_DiningTableSmall
  'brown_sofa':       { src: 'dlc2', x: 38, y: 100, w: 4, h: 4 },    // d_DoubleBrownSofaToolbar
  'fruit_apple_tree': { src: 'dlc2', x: 54, y: 24, w: 4, h: 4 },     // d_FruitAppleTree
  'fruit_banana_tree':{ src: 'dlc2', x: 54, y: 28, w: 4, h: 4 },     // d_FruitBananaTree
  'fruit_orange_tree':{ src: 'dlc2', x: 75, y: 4, w: 4, h: 4 },      // d_FruitOrangeTree
  'fruit_peach_tree': { src: 'dlc2', x: 75, y: 0, w: 4, h: 4 },      // d_FruitPeachTree
  'fern_bush':        { src: 'dlc2', x: 118, y: 34, w: 2, h: 2 },    // d_FernBush
  'flower_begonias':  { src: 'dlc2', x: 99, y: 23, w: 2, h: 2 },     // d_FlowerBegonias
  'flower_heather':   { src: 'dlc2', x: 91, y: 23, w: 2, h: 2 },     // d_FlowerHeatherBush
  'flower_hydrangeas':{ src: 'dlc2', x: 93, y: 23, w: 2, h: 2 },     // d_FlowerHydrangeas
  'flower_rose':      { src: 'dlc2', x: 95, y: 23, w: 2, h: 2 },     // d_FlowerRoseBush
  'flower_sunflower': { src: 'dlc2', x: 97, y: 23, w: 2, h: 2 },     // d_FlowerSunflower
  'garden_gnome':     { src: 'dlc2', x: 79, y: 18, w: 2, h: 2 },     // d_GardenGnome
  'pink_flamingo':    { src: 'dlc2', x: 72, y: 64, w: 2, h: 2 },     // d_PinkFlamingo
  'ornate_lantern':   { src: 'dlc2', x: 120, y: 32, w: 2, h: 2 },    // d_OrnateLantern
  'paper_lantern':    { src: 'dlc2', x: 124, y: 32, w: 2, h: 2 },    // d_PaperLantern
  'metal_stool':      { src: 'dlc2', x: 24, y: 105, w: 2, h: 2 },    // d_MetalStool
  'compost_bin':      { src: 'dlc2', x: 105, y: 5, w: 2, h: 2 },     // d_CompostBin
  'outdoor_sprinkler':{ src: 'dlc2', x: 38, y: 13, w: 2, h: 2 },     // d_OutdoorSprinkler
  'ox_statue':        { src: 'dlc2', x: 116, y: 26, w: 4, h: 4 },    // d_OxStatueToolbar
  'bare_tree':        { src: 'dlc2', x: 119, y: 42, w: 4, h: 4 },    // d_BareTree
  'blackboard':       { src: 'dlc2', x: 0, y: 2, w: 4, h: 2 },       // d_Blackboard
  'bench_full':       { src: 'dlc2', x: 16, y: 117, w: 2, h: 2 },    // d_BenchFullRotateToolbar
  'bench_small_full': { src: 'dlc2', x: 8, y: 114, w: 2, h: 2 },     // d_BenchSmallFullRotateToolbar
};

async function extractAll() {
  // Ensure output dir exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const keys = Object.keys(sprites);
  let ok = 0, fail = 0, skip = 0;

  for (const name of keys) {
    const s = sprites[name];
    const srcPath = SRC[s.src];
    const outPath = path.join(OUT_DIR, `${name}.webp`);

    const left = s.x * UNIT;
    const top = s.y * UNIT;
    const width = s.w * UNIT;
    const height = s.h * UNIT;

    try {
      await sharp(srcPath)
        .extract({ left, top, width, height })
        .webp({ quality: 95 })
        .toFile(outPath + '.tmp');

      // Rename .tmp → .webp (avoids EBUSY if file is in use)
      try { fs.unlinkSync(outPath); } catch(e) {}
      fs.renameSync(outPath + '.tmp', outPath);

      ok++;
      console.log(`  ✓ ${name} (${width}x${height} from ${s.src})`);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${ok} extracted, ${fail} failed, ${keys.length} total`);
}

extractAll();
