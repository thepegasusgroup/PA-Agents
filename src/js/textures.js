const Textures = {
  cache: {},
  loaded: 0,
  total: 0,

  manifest: {
    // ── Walls ──
    brick_wall:         'assets/textures/walls/Brick_Wall.webp',
    concrete_wall:      'assets/textures/walls/Concrete_Wall.webp',
    white_wall:         'assets/textures/walls/White_Wall.webp',
    fence:              'assets/textures/walls/Fence.webp',
    fence_grass:        'assets/textures/walls/Fence (Grass).webp',
    fence_bamboo:       'assets/textures/walls/Fence (Bamboo).webp',
    perimeter_wall:     'assets/textures/walls/Perimeter_Wall.webp',
    barred_wall:        'assets/textures/walls/Barred_Wall.webp',
    tiled_wall:         'assets/textures/walls/Tiled_Wall.webp',
    yutani_wall:        'assets/textures/walls/Wall (Yutani).webp',
    rusty_wall:         'assets/textures/walls/Wall (Rusty).webp',
    slum_wall:          'assets/textures/walls/Wall (Slum).webp',
    derelict_wall:      'assets/textures/walls/Wall (Derelict).webp',
    overgrown_wall:     'assets/textures/walls/Wall (Overgrown).webp',
    art_deco_wall:      'assets/textures/walls/Wall (Art Deco).webp',
    hedge:              'assets/textures/walls/Hedge.webp',
    cushioned_wall:     'assets/textures/walls/Wall (Cushioned).webp',
    classy_burgundy:    'assets/textures/walls/Wall (Classy Burgundy).webp',
    oriental_wall:      'assets/textures/walls/Wall (Oriental).webp',
    classy_green:       'assets/textures/walls/Wall Classy (Green).webp',
    classy_blue:        'assets/textures/walls/Wall Classy (Blue Stripes).webp',
    decayed_wall:       'assets/textures/walls/Wall (Decayed).webp',
    min_sec_wall:       'assets/textures/walls/Wall (Min Sec).webp',
    med_sec_wall:       'assets/textures/walls/Wall (Med Sec).webp',
    max_sec_wall:       'assets/textures/walls/Wall (Max Sec).webp',
    white_sec_wall:     'assets/textures/walls/Wall (White).webp',
    yellow_wall:        'assets/textures/walls/Wall (Yellow).webp',
    cliff_edge_wall:    'assets/textures/walls/Cliff_Edge.webp',
    reclaimed_wood:     'assets/textures/walls/Reclaimed Wood Wall.webp',
    bottle_wall:        'assets/textures/walls/Bottle Wall.webp',
    white_picket:       'assets/textures/walls/White Picket Fence.webp',
    hay_bale:           'assets/textures/walls/Hay Bale Wall.webp',
    wooden_fence:       'assets/textures/walls/Wooden Fence.webp',
    garden_wall:        'assets/textures/walls/Garden Wall.webp',

    // ── Doors ──
    door:               'assets/textures/doors/door.webp',
    staff_door:         'assets/textures/doors/staff_door.webp',
    double_door_l:      'assets/textures/doors/double_door_l.webp',
    double_door_r:      'assets/textures/doors/double_door_r.webp',
    secure_door:        'assets/textures/doors/secure_door.webp',
    blue_door:          'assets/textures/doors/blue_door.webp',
    red_door:           'assets/textures/doors/red_door.webp',
    orange_door:        'assets/textures/doors/orange_door.webp',
    double_staff_door:  'assets/textures/doors/double_staff_door.webp',
    double_staff_door_l:'assets/textures/doors/double_staff_door_l.webp',
    double_staff_door_r:'assets/textures/doors/double_staff_door_r.webp',
    house_door:         'assets/textures/doors/house_door.webp',
    house_door_l:       'assets/textures/doors/house_door_l.webp',
    house_door_r:       'assets/textures/doors/house_door_r.webp',

    // ── Objects ──
    obj_chair:          'assets/textures/objects/chair.webp',
    obj_sofa_single:    'assets/textures/objects/sofa_single.webp',
    obj_sofa_double:    'assets/textures/objects/sofa_double.webp',
    obj_table:          'assets/textures/objects/table.webp',
    obj_filing_cabinet: 'assets/textures/objects/filing_cabinet.webp',
    obj_toilet:         'assets/textures/objects/toilet.webp',
    obj_bathroom_sink:  'assets/textures/objects/bathroom_sink.webp',
    obj_tv:             'assets/textures/objects/tv.webp',
    obj_large_tv:       'assets/textures/objects/large_tv.webp',
    obj_pool_table:     'assets/textures/objects/pool_table.webp',
    obj_bookshelf:      'assets/textures/objects/bookshelf.webp',
    obj_power_station:  'assets/textures/objects/power_station.webp',
    obj_capacitor:      'assets/textures/objects/capacitor.webp',
    obj_radiator:       'assets/textures/objects/radiator.webp',
    obj_tree:           'assets/textures/objects/tree.webp',
    obj_water_pump:     'assets/textures/objects/water_pump.webp',

    // ── Objects (Stage 2) ──
    obj_big_desk:           'assets/textures/objects/big_desk.webp',
    obj_bookshelf_large:    'assets/textures/objects/bookshelf_large.webp',
    obj_leather_chair:      'assets/textures/objects/leather_chair.webp',
    obj_dining_chair:       'assets/textures/objects/dining_chair.webp',
    obj_dining_table:       'assets/textures/objects/dining_table.webp',
    obj_oak_desk:           'assets/textures/objects/oak_desk.webp',
    obj_oak_bookshelf:      'assets/textures/objects/oak_bookshelf.webp',
    obj_electrical_switch:  'assets/textures/objects/electrical_switch.webp',
    obj_glass_window:       'assets/textures/objects/glass_window.webp',
    obj_leather_sofa:       'assets/textures/objects/leather_sofa.webp',
    obj_coat_stand:         'assets/textures/objects/coat_stand.webp',
    obj_small_table:        'assets/textures/objects/small_table.webp',
    obj_wooden_stool:       'assets/textures/objects/wooden_stool.webp',
    obj_wooden_table:       'assets/textures/objects/wooden_table.webp',
    obj_picnic_table:       'assets/textures/objects/picnic_table.webp',
    obj_oval_table:         'assets/textures/objects/oval_table.webp',
    obj_bookshelf_short:    'assets/textures/objects/bookshelf_short.webp',
    obj_foosball:           'assets/textures/objects/foosball.webp',
    obj_plant:              'assets/textures/objects/plant.webp',
    obj_plant_cactus:       'assets/textures/objects/plant_cactus.webp',
    obj_bush:               'assets/textures/objects/bush.webp',
    obj_tree_cactus:        'assets/textures/objects/tree_cactus.webp',
    obj_tree_sakura:        'assets/textures/objects/tree_sakura.webp',
    obj_tree_snowy:         'assets/textures/objects/tree_snowy.webp',
    obj_tree_spooky:        'assets/textures/objects/tree_spooky.webp',
    obj_stone_fountain:     'assets/textures/objects/stone_fountain.webp',
    obj_office_chair_exec:  'assets/textures/objects/office_chair_exec.webp',
    obj_oak_table:          'assets/textures/objects/oak_table.webp',
    obj_window_classy:      'assets/textures/objects/window_classy.webp',
    obj_window_classy_large:'assets/textures/objects/window_classy_large.webp',
    obj_window_glass_large: 'assets/textures/objects/window_glass_large.webp',
    obj_backup_generator:   'assets/textures/objects/backup_generator.webp',
    obj_battery:            'assets/textures/objects/battery.webp',
    obj_solar_panel:        'assets/textures/objects/solar_panel.webp',
    obj_fan:                'assets/textures/objects/fan.webp',
    obj_fire_alarm:         'assets/textures/objects/fire_alarm.webp',
    obj_filing_cabinet_fancy:'assets/textures/objects/filing_cabinet_fancy.webp',
    obj_display_counter:    'assets/textures/objects/display_counter.webp',
    obj_dining_table_small: 'assets/textures/objects/dining_table_small.webp',
    obj_brown_sofa:         'assets/textures/objects/brown_sofa.webp',
    obj_fruit_apple_tree:   'assets/textures/objects/fruit_apple_tree.webp',
    obj_fruit_banana_tree:  'assets/textures/objects/fruit_banana_tree.webp',
    obj_fruit_orange_tree:  'assets/textures/objects/fruit_orange_tree.webp',
    obj_fruit_peach_tree:   'assets/textures/objects/fruit_peach_tree.webp',
    obj_fern_bush:          'assets/textures/objects/fern_bush.webp',
    obj_flower_begonias:    'assets/textures/objects/flower_begonias.webp',
    obj_flower_heather:     'assets/textures/objects/flower_heather.webp',
    obj_flower_hydrangeas:  'assets/textures/objects/flower_hydrangeas.webp',
    obj_flower_rose:        'assets/textures/objects/flower_rose.webp',
    obj_flower_sunflower:   'assets/textures/objects/flower_sunflower.webp',

    obj_metal_stool:        'assets/textures/objects/metal_stool.webp',
    obj_outdoor_sprinkler:  'assets/textures/objects/outdoor_sprinkler.webp',
    obj_bare_tree:          'assets/textures/objects/bare_tree.webp',
    obj_blackboard:         'assets/textures/objects/blackboard.webp',


    // ── Mod: Servers and More ──
    obj_server:             'assets/textures/objects/server.webp',
    obj_server_alt:         'assets/textures/objects/server_alt.webp',
    obj_server_alt2:        'assets/textures/objects/server_alt2.webp',
    obj_server_alt3:        'assets/textures/objects/server_alt3.webp',
    obj_network_switch:     'assets/textures/objects/network_switch.webp',
    obj_network_storage:    'assets/textures/objects/network_storage.webp',
    obj_server_parts_rack:  'assets/textures/objects/server_parts_rack.webp',
    obj_work_pc:            'assets/textures/objects/work_pc_combined.webp',
    obj_printer_small:      'assets/textures/objects/printer_small.webp',
    obj_printer_large:      'assets/textures/objects/printer_large.webp',
    obj_office_chair_mod:   'assets/textures/objects/office_chair_mod.webp',

    // ── PA-style rotation frames per RotateType layout (front | back | left + mirrored) ──
    // r0=South(front), r1=West(mirrored left), r2=North(back), r3=East(left).
    // Only register files that exist — the renderer falls back to programmatic
    // rotation of r0 when a frame is missing (offsets in defs/sprite_overrides.js
    // still apply).
    ...Object.fromEntries(
      // Objects with full 4-frame sprite sets:
      ['chair','sofa_single','toilet','tv','bookshelf','leather_chair','office_chair_exec',
       'dining_chair','bookshelf_large']
        .flatMap(n => [0,1,2,3].map(r => [`obj_${n}_r${r}`, `assets/textures/objects/${n}_r${r}.webp`]))
    ),
    ...Object.fromEntries(
      // Objects with only front (r0) and back (r2) — sides use programmatic rotation:
      ['sofa_double','oak_desk','large_tv','display_counter','brown_sofa','blackboard',
       'table','pool_table','foosball']
        .flatMap(n => [0,2].map(r => [`obj_${n}_r${r}`, `assets/textures/objects/${n}_r${r}.webp`]))
    ),
    // Front-only (programmatic rotation for everything else):
    obj_leather_sofa_r0: 'assets/textures/objects/leather_sofa_r0.webp',

    // ── Wall autotile (bitmask 0-15, N=1 S=2 W=4 E=8) ──
    ...Object.fromEntries([
      ['concrete_wall','cw'], ['brick_wall','bw'], ['perimeter_wall','pw'],
      ['fence','fn'], ['barred_wall','baw'], ['tiled_wall','tw'], ['hedge','hw'],
      ['white_wall','ww'], ['yutani_wall','yut'], ['rusty_wall','rw'],
      ['slum_wall','slw'], ['derelict_wall','dlw'], ['overgrown_wall','ogw'],
      ['art_deco_wall','adw'], ['cushioned_wall','csw'], ['classy_burgundy','cbw'],
      ['oriental_wall','orw'], ['classy_green','cgw'], ['classy_blue','cbl'],
      ['decayed_wall','dcw'], ['fence_grass','fgw'], ['fence_bamboo','fbw'],
      ['min_sec_wall','mnw'], ['med_sec_wall','mdw'], ['max_sec_wall','mxw'],
      ['white_sec_wall','wsw'], ['yellow_wall','ylw'], ['reclaimed_wood','rcw'],
      ['white_picket','wpf'], ['bottle_wall','btw'], ['wooden_fence','wnf'],
      ['hay_bale','hbw'], ['garden_wall','gdw'],
    ].flatMap(([w, p]) => Array.from({length:16}, (_,i) =>
      [p + '_' + i, 'assets/textures/walls/' + w + '/' + i + '.webp']))),

    // ── Flooring ──
    dirt:               'assets/textures/flooring/Dirt.webp',
    mud:                'assets/textures/flooring/Mud.webp',
    paving_stone:       'assets/textures/flooring/Paving_Stone.webp',
    grass:              'assets/textures/flooring/Grass.webp',
    grass_corner:       'assets/textures/flooring/Grass_Corner.webp',
    gravel:             'assets/textures/flooring/Gravel.webp',
    road:               'assets/textures/flooring/Road.webp',
    sand:               'assets/textures/flooring/Sand_01.webp',
    stone:              'assets/textures/flooring/Stone.webp',
    sandstone:          'assets/textures/flooring/Sandstone.webp',
    concrete_tile:      'assets/textures/flooring/Concrete_Tile.webp',
    concrete_floor:     'assets/textures/flooring/Concrete_Floor.webp',
    solaco:             'assets/textures/flooring/Solaco.webp',
    wooden_floor:       'assets/textures/flooring/Wooden_Floor.webp',
    ceramic_floor:      'assets/textures/flooring/CeramicFloor.webp',
    mosaic_floor:       'assets/textures/flooring/Mosaic_Floor.webp',
    metal_floor:        'assets/textures/flooring/Metal_Floor.webp',
    grate_floor:        'assets/textures/flooring/Grate.webp',
    limestone:          'assets/textures/flooring/Limestone.webp',
    marble_tiles:       'assets/textures/flooring/Marble_Tiles.webp',
    white_tiles:        'assets/textures/flooring/White_Tiles.webp',
    fancy_tiles:        'assets/textures/flooring/Fancy_Tiles.webp',
    carpet_blue:        'assets/textures/flooring/Carpet_Blue.webp',
    carpet_brown:       'assets/textures/flooring/Carpet_Brown.webp',
    carpet_red:         'assets/textures/flooring/Carpet_Red.webp',
    iron_floor:         'assets/textures/flooring/Iron_Floor.webp',
    cargo_floor:        'assets/textures/flooring/Cargo_Floor.webp',
    checkered_floor:    'assets/textures/flooring/Checkered_Floor.webp',
    padded:             'assets/textures/flooring/Padded.webp',
    grass_n_stones:     'assets/textures/flooring/Grass_n_Stones.webp',
    lunar:              'assets/textures/flooring/Lunar.webp',
    snow:               'assets/textures/flooring/Snow.webp',
    running_track:      'assets/textures/flooring/Running_Track.webp',
    bamboo_floor:       'assets/textures/flooring/Bamboo.webp',
    flowery_field:      'assets/textures/flooring/Flowery_Field.webp',
    dock_wooden:        'assets/textures/flooring/Dock_Wooden.webp',
    cliff_edge_floor:   'assets/textures/flooring/Cliff_Edge.webp',
    reclaimed_brick:    'assets/textures/flooring/Reclaimed_Brick.webp',
    reclaimed_rubber:   'assets/textures/flooring/Reclaimed_Rubber.webp',
    field_grass:        'assets/textures/flooring/Field_Grass.webp',
    laminate:           'assets/textures/flooring/Laminate_Flooring.webp',
    carpet:             'assets/textures/flooring/Carpet.webp',
    water:              'assets/textures/flooring/Water.webp',
  },

  init() {
    const entries = Object.entries(this.manifest);
    this.total = entries.length;
    this.loaded = 0;

    return new Promise((resolve) => {
      if (entries.length === 0) { resolve(); return; }

      for (const [name, path] of entries) {
        const img = new Image();
        img.onload = () => {
          this.cache[name] = img;
          this.loaded++;
          if (this.loaded >= this.total) resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load texture: ${name} (${path})`);
          this.loaded++;
          if (this.loaded >= this.total) resolve();
        };
        img.src = path;
      }
    });
  },

  get(name) {
    return this.cache[name] || null;
  },
};
