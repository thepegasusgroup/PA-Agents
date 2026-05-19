const Toolbar = {
  init() {
    this.categoriesEl = document.getElementById('toolbarCategories');
    this.subToolbar = document.getElementById('subToolbar');
    this.subItems = document.getElementById('subToolbarItems');
    this.placementInfo = document.getElementById('placement-info');

    this.categoriesEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (!btn) return;
      this.selectCategory(btn.dataset.category);
      // Blur the button so it doesn't keep keyboard focus — otherwise pressing
      // Space afterward would re-trigger a click and toggle the menu closed.
      btn.blur();
    });

    this.subItems.addEventListener('click', (e) => {
      const tab = e.target.closest('.fp-tab');
      if (tab) {
        if (tab.dataset.tab === 'more') return;
        this.switchPanelTab(tab.dataset.tab);
        if (tab.blur) tab.blur();
        return;
      }

      const fpItem = e.target.closest('.fp-grid-item');
      if (fpItem) {
        if (fpItem.dataset.fpAction) {
          this.selectFoundationAction(fpItem.dataset.fpAction);
        } else if (fpItem.dataset.itemId) {
          this.selectPanelItem(fpItem.dataset.itemId);
        }
        if (fpItem.blur) fpItem.blur();
        return;
      }

      const item = e.target.closest('.sub-item');
      if (!item) return;
      this.selectItem(item.dataset.itemId);
      if (item.blur) item.blur();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSelection();
      }
    });
  },

  selectCategory(category) {
    const s = AppState;

    // Deselect any selected object when picking a tool
    if (typeof Grid !== 'undefined') Grid.deselectObject();

    if (s.tools.activeCategory === category) {
      this.clearSelection();
      return;
    }

    s.tools.activeCategory = category;
    s.tools.activeItem = null;
    s.ui.showUtilities = false; // Reset — only utilities panel re-enables it
    s.ui.planningMode = false;  // Reset planning mode
    if (Grid._cloneMode) { Grid._cloneMode = false; Grid._cloneData = null; }
    const uiInd = document.getElementById('utilityIndicator');
    if (uiInd) uiInd.classList.remove('visible');

    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });

    const data = ToolbarData[category];
    if (!data) {
      this.subToolbar.classList.add('hidden');
      this.subToolbar.classList.remove('foundation-mode');
      s.ui.subToolbarOpen = false;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      return;
    }

    if (data.mode === 'foundation') {
      this.renderFoundationPanel();
      this.subToolbar.classList.remove('hidden');
      this.subToolbar.classList.add('foundation-mode');
      s.ui.subToolbarOpen = true;

      this.selectFoundationAction('build_brick');
      return;
    }

    if (data.mode === 'objects') {
      this.renderObjectsPanel(data);
      this.subToolbar.classList.remove('hidden');
      this.subToolbar.classList.add('foundation-mode');
      s.ui.subToolbarOpen = true;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      return;
    }

    if (data.mode === 'utilities') {
      this.renderUtilitiesPanel(data);
      this.subToolbar.classList.remove('hidden');
      this.subToolbar.classList.add('foundation-mode');
      s.ui.subToolbarOpen = true;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      // Toggle utility underground view
      s.ui.showUtilities = true;
      const uiEl = document.getElementById('utilityIndicator');
      if (uiEl) uiEl.classList.toggle('visible', true);
      return;
    }

    if (data.mode === 'overlay') {
      // Open a full overlay (e.g. Reports)
      if (category === 'reports' && typeof Reports !== 'undefined') {
        Reports.toggle();
      }
      s.tools.activeCategory = null;
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      this.subToolbar.classList.add('hidden');
      s.ui.subToolbarOpen = false;
      return;
    }

    if (data.mode === 'staff') {
      this.renderStaffPanel(data);
      this.subToolbar.classList.remove('hidden');
      this.subToolbar.classList.add('foundation-mode');
      s.ui.subToolbarOpen = true;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      return;
    }

    if (data.mode === 'clone') {
      // Clone mode — right-drag to select, then place with right-click
      Grid._selectedWorkers = [];
      Grid.hideWorkerPanel();
      Grid.deselectObject();
      this.renderClonePanel();
      this.subToolbar.classList.remove('hidden');
      this.subToolbar.classList.add('foundation-mode');
      s.ui.subToolbarOpen = true;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'crosshair';
      Grid._cloneMode = true;
      Grid._cloneData = null;
      return;
    }

    if (data.mode === 'planning') {
      // Planning mode — place walls/doors as outlines
      s.ui.planningMode = true;
      this.renderPlanningPanel();
      this.subToolbar.classList.remove('hidden');
      this.subToolbar.classList.add('foundation-mode');
      s.ui.subToolbarOpen = true;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'crosshair';
      return;
    }

    if (data.mode === 'panel') {
      this.renderPanel(data);
      this.subToolbar.classList.remove('hidden');
      this.subToolbar.classList.add('foundation-mode');
      s.ui.subToolbarOpen = true;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      return;
    }

    this.subToolbar.classList.remove('foundation-mode');

    if (!data.items || data.items.length === 0) {
      this.subToolbar.classList.add('hidden');
      s.ui.subToolbarOpen = false;
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      return;
    }

    this.subItems.innerHTML = '';
    for (const item of data.items) {
      const el = document.createElement('div');
      el.className = 'sub-item';
      el.dataset.itemId = item.id;
      el.innerHTML = `
        <div class="sub-item-icon">${item.icon}</div>
        <div class="sub-item-name">${item.name}</div>
        ${item.cost !== null ? `<div class="sub-item-cost">$${item.cost}</div>` : ''}
      `;
      this.subItems.appendChild(el);
    }

    this.subToolbar.classList.remove('hidden');
    s.ui.subToolbarOpen = true;
    this.hidePlacementInfo();
    Grid.canvas.style.cursor = 'default';
  },

  renderFoundationPanel() {
    this.subItems.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'foundation-panel';

    const tabs = document.createElement('div');
    tabs.className = 'fp-tabs';
    tabs.innerHTML =
      '<button class="fp-tab active" data-tab="main">Main</button>' +
      '<button class="fp-tab" data-tab="more">More</button>';
    panel.appendChild(tabs);

    const main = document.createElement('div');
    main.className = 'fp-content fp-grid';
    main.dataset.tab = 'main';

    const iconBase = 'assets/textures/';
    const items = [
      { id: 'build_brick', label: 'Building\n(Brick)', style: 'blue',
        icon: iconBase + 'walls/Brick_Wall.webp' },
      { id: 'build_concrete', label: 'Building\n(Concrete)', style: 'blue',
        icon: iconBase + 'walls/Concrete_Wall.webp' },
      { id: 'bulldoze', label: 'Bulldoze', style: 'red',
        icon: iconBase + 'icons/demolish.webp' },
      { id: 'demolish_walls', label: 'Demolish\nWalls', style: 'red',
        icon: iconBase + 'icons/demolish.webp' },
      { id: 'clear_indoor', label: 'Clear Indoor\nArea', style: 'red',
        icon: iconBase + 'icons/demolish.webp' },
    ];

    for (const item of items) {
      const cell = document.createElement('div');
      cell.className = 'fp-grid-item ' + item.style;
      cell.dataset.fpAction = item.id;

      let html = '<div class="fp-grid-icon"><img src="' + item.icon + '" draggable="false"></div>';
      html += '<div class="fp-grid-label">' + item.label.replace('\n', '<br>') + '</div>';
      if (item.style === 'toggle') {
        html += '<div class="fp-toggle">' + (AppState.ui.autoLights ? 'ON' : 'OFF') + '</div>';
      }
      cell.innerHTML = html;
      main.appendChild(cell);
    }
    panel.appendChild(main);

    const more = document.createElement('div');
    more.className = 'fp-content fp-grid hidden';
    more.dataset.tab = 'more';
    more.innerHTML = '<div class="fp-placeholder">Coming soon</div>';
    panel.appendChild(more);

    this.subItems.appendChild(panel);
  },

  renderPanel(data) {
    this.subItems.innerHTML = '';
    const iconBase = 'assets/textures/';

    const panel = document.createElement('div');
    panel.className = 'foundation-panel';

    const tabs = document.createElement('div');
    tabs.className = 'fp-tabs';
    for (const tab of data.tabs) {
      const btn = document.createElement('button');
      btn.className = 'fp-tab';
      btn.dataset.tab = tab.name;
      btn.textContent = tab.name;
      tabs.appendChild(btn);
    }
    tabs.children[0].classList.add('active');
    panel.appendChild(tabs);

    for (let i = 0; i < data.tabs.length; i++) {
      const tab = data.tabs[i];
      const content = document.createElement('div');
      content.className = 'fp-content fp-grid' + (i > 0 ? ' hidden' : '');
      content.dataset.tab = tab.name;

      for (const item of tab.items) {
        const cell = document.createElement('div');
        cell.className = 'fp-grid-item' + (item.objectAction || item.roomAction || item.demolishAction ? ' red' : '');
        cell.dataset.itemId = item.id;

        const label = item.name.replace('\n', '<br>');
        if (item.svg) {
          cell.className = 'fp-grid-item' + (item.style ? ' ' + item.style : '');
          cell.innerHTML =
            '<div class="fp-grid-icon fp-styled-icon">' + item.svg + '</div>' +
            '<div class="fp-grid-label">' + label + '</div>';
        } else {
          cell.innerHTML =
            '<div class="fp-grid-icon"><img src="' + iconBase + item.texture + '" draggable="false"></div>' +
            '<div class="fp-grid-label">' + label + '</div>';
        }
        content.appendChild(cell);
      }
      panel.appendChild(content);
    }

    this.subItems.appendChild(panel);
  },

  renderObjectsPanel(data) {
    this.subItems.innerHTML = '';
    const iconBase = 'assets/textures/';

    const panel = document.createElement('div');
    panel.className = 'foundation-panel';

    // Tab row: [All Types ▾ dropdown] [🔍 Search bar]
    const tabs = document.createElement('div');
    tabs.className = 'fp-tabs';

    const select = document.createElement('select');
    select.className = 'obj-filter-select';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Types';
    select.appendChild(allOpt);
    for (const cat of data.categories) {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
    }
    tabs.appendChild(select);

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'fp-search';
    search.placeholder = '🔍 Search...';
    tabs.appendChild(search);
    panel.appendChild(tabs);

    // Items grid (shows all by default)
    const grid = document.createElement('div');
    grid.className = 'fp-content fp-grid';
    grid.dataset.objGrid = 'true';

    const allItems = data.categories.flatMap(c => c.items);
    for (const item of allItems) {
      const cell = document.createElement('div');
      cell.className = 'fp-grid-item';
      cell.dataset.itemId = item.id;
      cell.dataset.objCategory = this._getItemCategory(item, data.categories);
      cell.dataset.searchName = item.name.replace('\n', ' ').toLowerCase();
      const label = item.name.replace('\n', '<br>');
      cell.innerHTML =
        '<div class="fp-grid-icon"><img src="' + iconBase + item.texture + '" draggable="false"></div>' +
        '<div class="fp-grid-label">' + label + '</div>';
      grid.appendChild(cell);
    }

    // Sell button — always last
    const sellCell = document.createElement('div');
    sellCell.className = 'fp-grid-item red';
    sellCell.dataset.itemId = 'remove_objects';
    sellCell.dataset.objCategory = '_pinned';
    sellCell.dataset.searchName = 'remove objects sell';
    sellCell.innerHTML =
      '<div class="fp-grid-icon"><img src="' + iconBase + 'icons/demolish.webp" draggable="false"></div>' +
      '<div class="fp-grid-label">Remove<br>Objects</div>';
    grid.appendChild(sellCell);
    panel.appendChild(grid);

    this.subItems.appendChild(panel);

    // Wire up dropdown change
    select.addEventListener('change', () => {
      this._filterGrid(grid, select.value, search.value);
    });

    // Wire up search
    search.addEventListener('input', () => {
      this._filterGrid(grid, select.value, search.value);
    });

    // Check for visible unsatisfied rooms and promote their needs
    Grid.updateVisibleRoom();
    if (AppState.ui.hoveredRoomType) {
      this._promoteRoomNeeds(AppState.ui.hoveredRoomType);
    }
  },

  renderUtilitiesPanel(data) {
    this.subItems.innerHTML = '';
    const iconBase = 'assets/textures/';

    const panel = document.createElement('div');
    panel.className = 'foundation-panel';

    // Tab row: [All Types ▾ dropdown] [🔍 Search bar]
    const tabs = document.createElement('div');
    tabs.className = 'fp-tabs';

    const select = document.createElement('select');
    select.className = 'obj-filter-select';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Types';
    select.appendChild(allOpt);
    for (const cat of data.categories) {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
    }
    tabs.appendChild(select);

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'fp-search';
    search.placeholder = '🔍 Search...';
    tabs.appendChild(search);
    panel.appendChild(tabs);

    // Items grid (shows all by default)
    const grid = document.createElement('div');
    grid.className = 'fp-content fp-grid';
    grid.dataset.objGrid = 'true';

    const allItems = data.categories.flatMap(c => c.items);
    for (const item of allItems) {
      const cell = document.createElement('div');
      cell.className = 'fp-grid-item';
      cell.dataset.itemId = item.id;
      cell.dataset.objCategory = this._getItemCategory(item, data.categories);
      cell.dataset.searchName = item.name.replace('\n', ' ').toLowerCase();
      const label = item.name.replace('\n', '<br>');

      if (item.svg) {
        cell.innerHTML =
          '<div class="fp-grid-icon fp-styled-icon">' + item.svg + '</div>' +
          '<div class="fp-grid-label">' + label + '</div>';
      } else {
        cell.innerHTML =
          '<div class="fp-grid-icon"><img src="' + iconBase + item.texture + '" draggable="false"></div>' +
          '<div class="fp-grid-label">' + label + '</div>';
      }
      grid.appendChild(cell);
    }

    // Remove Utility button — always last
    const removeCell = document.createElement('div');
    removeCell.className = 'fp-grid-item red';
    removeCell.dataset.itemId = 'demolish_utility';
    removeCell.dataset.objCategory = '_pinned';
    removeCell.dataset.searchName = 'remove utility demolish';
    removeCell.innerHTML =
      '<div class="fp-grid-icon fp-styled-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#f44336" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></div>' +
      '<div class="fp-grid-label">Remove<br>Utility</div>';
    grid.appendChild(removeCell);
    panel.appendChild(grid);

    this.subItems.appendChild(panel);

    // Wire up dropdown change
    select.addEventListener('change', () => {
      this._filterGrid(grid, select.value, search.value);
    });

    // Wire up search
    search.addEventListener('input', () => {
      this._filterGrid(grid, select.value, search.value);
    });
  },

  renderStaffPanel(data) {
    this.subItems.innerHTML = '';
    const iconBase = 'assets/textures/';

    const panel = document.createElement('div');
    panel.className = 'foundation-panel';

    // Tab row: [All Types ▾ dropdown] [🔍 Search bar]
    const tabs = document.createElement('div');
    tabs.className = 'fp-tabs';

    const select = document.createElement('select');
    select.className = 'obj-filter-select';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Types';
    select.appendChild(allOpt);
    for (const cat of data.categories) {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
    }
    tabs.appendChild(select);

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'fp-search';
    search.placeholder = '🔍 Search...';
    tabs.appendChild(search);
    panel.appendChild(tabs);

    // Items grid
    const grid = document.createElement('div');
    grid.className = 'fp-content fp-grid';
    grid.dataset.objGrid = 'true';

    // Built-in items from ToolbarData.staff
    const allItems = data.categories.flatMap(c => c.items);
    for (const item of allItems) {
      const cell = document.createElement('div');
      cell.className = 'fp-grid-item';
      cell.dataset.itemId = item.id;
      cell.dataset.objCategory = this._getItemCategory(item, data.categories);
      cell.dataset.searchName = item.name.replace('\n', ' ').toLowerCase();
      const label = item.name.replace('\n', '<br>');
      cell.innerHTML =
        '<div class="fp-grid-icon"><img src="' + iconBase + item.texture + '" draggable="false"></div>' +
        '<div class="fp-grid-label">' + label + '</div>';
      grid.appendChild(cell);
    }

    // ── Custom worker types — rendered like built-ins so click handling
    //    routes through the same selectPanelItem → selectItem path. ──
    const customs = AppState.customWorkerTypes || {};
    for (const [id, def] of Object.entries(customs)) {
      const cell = document.createElement('div');
      cell.className = 'fp-grid-item fp-grid-custom-agent';
      cell.dataset.itemId = id;
      cell.dataset.customAgentId = id;
      cell.dataset.objCategory = 'AI Agents';
      cell.dataset.searchName = (def.name || '').toLowerCase() + ' custom';
      const spriteUrl = iconBase + 'workers/' + def.sprite + '/front.webp';
      const badgeGlyph = (typeof Icons !== 'undefined' && Icons[def.icon]) || (typeof Icons !== 'undefined' ? Icons.bot : '');
      cell.innerHTML =
        '<div class="fp-grid-icon" style="position:relative;">' +
          '<img src="' + spriteUrl + '" draggable="false">' +
          '<span class="fp-custom-badge" style="background:' + def.color + ';">' + badgeGlyph + '</span>' +
        '</div>' +
        '<div class="fp-grid-label">' + this._esc(def.name) + '</div>';
      grid.appendChild(cell);
    }

    panel.appendChild(grid);

    this.subItems.appendChild(panel);

    // Right-click any custom agent tile to jump straight to its Workshop entry.
    grid.addEventListener('contextmenu', (e) => {
      const customTile = e.target.closest('[data-custom-agent-id]');
      if (customTile && typeof Reports !== 'undefined' && Reports._workshopOpen) {
        e.preventDefault();
        e.stopPropagation();
        Reports.open();
        Reports._activeApp = 'workshop';
        Reports.homescreen.classList.add('hidden');
        Reports.appview.classList.remove('hidden');
        Reports._workshopOpen(customTile.dataset.customAgentId);
      }
    });

    // Wire up dropdown
    select.addEventListener('change', () => {
      this._filterGrid(grid, select.value, search.value);
    });

    // Wire up search
    search.addEventListener('input', () => {
      this._filterGrid(grid, select.value, search.value);
    });
  },

  _getItemCategory(item, categories) {
    for (const cat of categories) {
      if (cat.items.includes(item)) return cat.name;
    }
    return '';
  },

  _filterGrid(grid, categoryFilter, searchText) {
    if (!grid) return;
    const query = (searchText || '').toLowerCase().trim();
    const items = grid.querySelectorAll('.fp-grid-item');
    items.forEach(el => {
      const cat = el.dataset.objCategory;
      const name = el.dataset.searchName || '';
      const matchCat = categoryFilter === 'all' || cat === categoryFilter || cat === '_pinned';
      const matchSearch = !query || name.includes(query);
      el.style.display = (matchCat && matchSearch) ? '' : 'none';
    });
  },

  switchPanelTab(tabName) {
    const panel = this.subItems.querySelector('.foundation-panel');
    if (!panel) return;
    panel.querySelectorAll('.fp-tab').forEach((t) =>
      t.classList.toggle('active', t.dataset.tab === tabName)
    );
    panel.querySelectorAll('.fp-content').forEach((c) =>
      c.classList.toggle('hidden', c.dataset.tab !== tabName)
    );
  },

  selectFoundationAction(actionId) {
    const s = AppState;
    const data = ToolbarData.foundations;

    this.subItems.querySelectorAll('.fp-grid-item').forEach((el) =>
      el.classList.remove('selected')
    );
    const el = this.subItems.querySelector('[data-fp-action="' + actionId + '"]');
    el?.classList.add('selected');

    switch (actionId) {
      case 'build_brick': {
        const wall = data.wallTypes.find((w) => w.id === 'brick_wall');
        s.tools.foundationWall = wall;
        s.tools.activeItem = { id: 'foundation', name: 'Foundation', mode: 'foundation' };
        this.showPlacementInfo('Brick Foundation', null, 'Drag to build room');
        Grid.canvas.style.cursor = 'crosshair';
        break;
      }
      case 'build_concrete': {
        const wall = data.wallTypes.find((w) => w.id === 'concrete_wall');
        s.tools.foundationWall = wall;
        s.tools.activeItem = { id: 'foundation', name: 'Foundation', mode: 'foundation' };
        this.showPlacementInfo('Concrete Foundation', null, 'Drag to build room');
        Grid.canvas.style.cursor = 'crosshair';
        break;
      }
      case 'bulldoze':
        s.tools.activeItem = { id: 'bulldoze', name: 'Bulldoze' };
        this.showPlacementInfo('Bulldoze', null, 'Drag to demolish');
        Grid.canvas.style.cursor = 'crosshair';
        break;
      case 'demolish_walls':
        s.tools.activeItem = { id: 'demolish_walls', name: 'Demolish Walls' };
        this.showPlacementInfo('Demolish Walls', null, 'Drag to remove walls');
        Grid.canvas.style.cursor = 'crosshair';
        break;
      case 'clear_indoor':
        s.tools.activeItem = { id: 'clear_indoor', name: 'Clear Indoor Area' };
        this.showPlacementInfo('Clear Indoor Area', null, 'Drag to clear floors');
        Grid.canvas.style.cursor = 'crosshair';
        break;
    }
  },

  selectPanelItem(itemId) {
    const s = AppState;
    const data = ToolbarData[s.tools.activeCategory];
    if (!data) return;

    const lists = data.tabs || data.categories;
    if (!lists) return;

    let item = null;
    for (const group of lists) {
      item = group.items.find((i) => i.id === itemId);
      if (item) break;
    }
    // Sell / Remove buttons are rendered separately, not in any group
    if (!item && itemId === 'remove_objects') {
      item = { id: 'remove_objects', name: 'Sell', cost: 0, objectAction: 'remove' };
    }
    if (!item && itemId === 'demolish_utility') {
      item = { id: 'demolish_utility', name: 'Remove\nUtility', cost: 0, utilityType: 0 };
    }
    // Custom worker types live in AppState, not in ToolbarData. Synthesise the
    // item the rest of the pipeline expects (workerType wired to the custom id).
    if (!item && AppState.customWorkerTypes && AppState.customWorkerTypes[itemId]) {
      const def = AppState.customWorkerTypes[itemId];
      item = { id: itemId, name: def.name, cost: 0, workerType: itemId };
    }
    if (!item) return;

    if (s.tools.activeItem && s.tools.activeItem.id === itemId) {
      s.tools.activeItem = null;
      this.subItems.querySelectorAll('.fp-grid-item').forEach((el) => el.classList.remove('selected'));
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      return;
    }

    s.tools.activeItem = item;
    s.tools.placeRotation = 0;  // Reset rotation on item change
    this.subItems.querySelectorAll('.fp-grid-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.itemId === itemId);
    });

    if (item.utilityType !== undefined) {
      const uName = item.name.replace('\n', ' ');
      this.showPlacementInfo(uName, null, item.utilityType === 0 ? 'Click and drag to remove' : 'Click and drag to lay');
      Grid.canvas.style.cursor = 'crosshair';
    } else if (item.workerType) {
      Grid.canvas.style.cursor = 'cell';
    } else if (item.demolishAction) {
      const labels = { walls: 'Demolish Walls', doors: 'Demolish Doors', floors: 'Clear Floor' };
      this.showPlacementInfo(labels[item.demolishAction] || 'Demolish', null, 'Click and drag to remove');
      Grid.canvas.style.cursor = 'crosshair';
    } else if (item.roomAction === 'remove') {
      this.showPlacementInfo('Remove Room', null, 'Click a room to remove');
      Grid.canvas.style.cursor = 'crosshair';
    } else if (item.roomType) {
      const def = RoomDefs[item.roomType];
      this.showPlacementInfo(def.name, item.cost, `Drag to designate (min ${def.minW}x${def.minH})`);
      Grid.canvas.style.cursor = 'crosshair';
    } else if (item.objectAction === 'remove') {
      this.showPlacementInfo('Sell Objects', null, 'Drag to remove objects');
      Grid.canvas.style.cursor = 'crosshair';
    } else if (item.objectType) {
      const def = ObjectDefs[item.objectType];
      const size = def && (def.w > 1 || def.h > 1) ? ` (${def.w}x${def.h})` : '';
      const rotHint = def && !def.noRotate && !def.wallMount ? ' (R to rotate)' : def && def.wallMount ? ' (auto-orient)' : '';
      this.showPlacementInfo(item.name.replace('\n', ' ') + size, item.cost, 'Click to place' + rotHint);
      Grid.canvas.style.cursor = 'pointer';
    } else if (item.placeWidth) {
      this.showPlacementInfo(item.name.replace('\n', ' '), item.cost, 'Click to place (R to rotate)');
      Grid.canvas.style.cursor = 'pointer';
    } else if (item.cell !== undefined) {
      this.showPlacementInfo(item.name.replace('\n', ' '), item.cost, 'Click and drag to place');
      Grid.canvas.style.cursor = 'crosshair';
    } else {
      this.showPlacementInfo(item.name.replace('\n', ' '), item.cost, 'Click to place');
      Grid.canvas.style.cursor = 'pointer';
    }
  },

  selectItem(itemId) {
    const s = AppState;
    const data = ToolbarData[s.tools.activeCategory];
    if (!data || !data.items) return;

    const item = data.items.find((i) => i.id === itemId);
    if (!item) return;

    if (s.tools.activeItem && s.tools.activeItem.id === itemId) {
      s.tools.activeItem = null;
      document.querySelectorAll('.sub-item').forEach((el) => el.classList.remove('selected'));
      this.hidePlacementInfo();
      Grid.canvas.style.cursor = 'default';
      return;
    }

    s.tools.activeItem = item;
    s.tools.placeRotation = 0;  // Reset rotation on item change

    document.querySelectorAll('.sub-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.itemId === itemId);
    });

    if (item.cell !== undefined) {
      this.showPlacementInfo(item.name, item.cost, 'Click and drag to place');
      Grid.canvas.style.cursor = 'crosshair';
    } else {
      const def = item.objectType ? ObjectDefs[item.objectType] : null;
      const rotHint = def && !def.noRotate && !def.wallMount ? ' — R to rotate' : '';
      this.showPlacementInfo(item.name, item.cost, 'Click to place' + rotHint);
      Grid.canvas.style.cursor = 'pointer';
    }
  },

  showPlacementInfo(name, cost, hint) {
    this.placementInfo.classList.remove('hidden');
    this.placementInfo.querySelector('.placement-name').textContent = name;
    this.placementInfo.querySelector('.placement-cost').textContent = cost !== null ? `$${cost}` : '';
    this.placementInfo.querySelector('.placement-hint').textContent = hint;
  },

  hidePlacementInfo() {
    this.placementInfo.classList.add('hidden');
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  clearSelection() {
    const s = AppState;
    s.tools.activeCategory = null;
    s.tools.activeItem = null;
    s.tools.isPlacing = false;
    s.tools.placeRotation = 0;
    s.ui.showUtilities = false;
    s.ui.planningMode = false;
    const uiEl = document.getElementById('utilityIndicator');
    if (uiEl) uiEl.classList.remove('visible');

    // Clear clone mode
    if (Grid._cloneMode) {
      Grid._cloneMode = false;
      Grid._cloneData = null;
    }

    document.querySelectorAll('.tool-btn').forEach((btn) => btn.classList.remove('active'));
    document.querySelectorAll('.sub-item').forEach((el) => el.classList.remove('selected'));
    this.subToolbar.classList.add('hidden');
    this.subToolbar.classList.remove('foundation-mode');
    s.ui.subToolbarOpen = false;
    this.hidePlacementInfo();
    Grid.canvas.style.cursor = 'default';
  },

  updateRoomTab(roomType) {
    const s = AppState;
    if (s.tools.activeCategory !== 'objects') return;
    this._promoteRoomNeeds(roomType);
  },

  _promoteRoomNeeds(roomType) {
    const grid = this.subItems.querySelector('[data-obj-grid]');
    if (!grid) return;

    // Remove any existing "needed" separator
    const oldSep = grid.querySelector('.obj-room-separator');
    if (oldSep) oldSep.remove();

    // Reset all items to default order (remove promoted state)
    const items = [...grid.querySelectorAll('.fp-grid-item')];
    items.forEach(el => {
      el.classList.remove('obj-promoted');
      el.style.order = '';
    });

    if (!roomType) return;
    const def = RoomDefs[roomType];
    if (!def || !def.requires) return;

    // Find needed object type IDs
    const neededTypes = new Set(def.requires.map(r => r.type));
    const allCatItems = ToolbarData.objects.categories.flatMap(c => c.items);
    const neededIds = new Set();
    for (const item of allCatItems) {
      if (item.objectType && neededTypes.has(item.objectType)) {
        neededIds.add(item.id);
      }
    }
    if (neededIds.size === 0) return;

    // Promote needed items to the top via CSS order
    let promotedCount = 0;
    items.forEach(el => {
      if (neededIds.has(el.dataset.itemId)) {
        el.style.order = '-1';
        el.classList.add('obj-promoted');
        promotedCount++;
      }
    });

    if (promotedCount > 0) {
      // Insert a label above promoted items
      const sep = document.createElement('div');
      sep.className = 'obj-room-separator';
      sep.textContent = def.name + ' needs';
      sep.style.order = '-2';
      grid.insertBefore(sep, grid.firstChild);
    }
  },

  // ── Clone Panel ──
  renderClonePanel() {
    this.subItems.innerHTML = '';
    const iconBase = 'assets/textures/';

    const panel = document.createElement('div');
    panel.className = 'foundation-panel';

    const tabs = document.createElement('div');
    tabs.className = 'fp-tabs';
    tabs.innerHTML = '<button class="fp-tab active" data-tab="clone">Clone</button>';
    panel.appendChild(tabs);

    const content = document.createElement('div');
    content.className = 'fp-content fp-grid';
    content.dataset.tab = 'clone';

    const steps = [
      { label: '1. Right-drag\nto select', icon: iconBase + 'icons/demolish.webp', style: 'blue' },
      { label: '2. Move mouse\n(ghost preview)', icon: iconBase + 'icons/demolish.webp', style: 'blue' },
      { label: '3. Right-click\nto stamp', icon: iconBase + 'icons/demolish.webp', style: 'blue' },
    ];

    for (const step of steps) {
      const cell = document.createElement('div');
      cell.className = 'fp-grid-item ' + step.style;
      cell.innerHTML =
        '<div class="fp-grid-icon fp-styled-icon">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a90c4" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="3" width="12" height="12" rx="1"/><path d="M3 8v10a1 1 0 001 1h10"/></svg>' +
        '</div>' +
        '<div class="fp-grid-label">' + step.label.replace('\n', '<br>') + '</div>';
      content.appendChild(cell);
    }
    panel.appendChild(content);
    this.subItems.appendChild(panel);
  },

  // ── Planning Panel ──
  renderPlanningPanel() {
    this.subItems.innerHTML = '';
    const iconBase = 'assets/textures/';

    const planItems = [
      { id: 'plan_concrete_wall', name: 'Concrete\nWall', cell: CT.CONCRETE_WALL, planMode: true, texture: 'walls/Concrete_Wall.webp' },
      { id: 'plan_brick_wall', name: 'Brick\nWall', cell: CT.BRICK_WALL, planMode: true, texture: 'walls/Brick_Wall.webp' },
      { id: 'plan_white_wall', name: 'White\nWall', cell: CT.WHITE_WALL, planMode: true, texture: 'walls/White_Wall.webp' },
      { id: 'plan_perimeter', name: 'Perimeter\nWall', cell: CT.PERIMETER_WALL, planMode: true, texture: 'walls/Perimeter_Wall.webp' },
      { id: 'plan_fence', name: 'Fence', cell: CT.FENCE, planMode: true, texture: 'walls/Fence.webp' },
      { id: 'plan_door', name: 'Door', cell: CT.DOOR, planMode: true, placeWidth: 1, texture: 'doors/door.webp' },
      { id: 'plan_demolish', name: 'Remove\nPlan', planDemolish: true },
    ];

    const panel = document.createElement('div');
    panel.className = 'foundation-panel';

    const tabs = document.createElement('div');
    tabs.className = 'fp-tabs';
    tabs.innerHTML = '<button class="fp-tab active" data-tab="plan">Planning</button>';
    panel.appendChild(tabs);

    const content = document.createElement('div');
    content.className = 'fp-content fp-grid';
    content.dataset.tab = 'plan';

    for (const item of planItems) {
      const cell = document.createElement('div');
      cell.className = 'fp-grid-item' + (item.planDemolish ? ' red' : '');
      cell.dataset.fpAction = item.id;

      if (item.texture) {
        cell.innerHTML =
          '<div class="fp-grid-icon"><img src="' + iconBase + item.texture + '" draggable="false"></div>' +
          '<div class="fp-grid-label">' + item.name.replace('\n', '<br>') + '</div>';
      } else {
        cell.innerHTML =
          '<div class="fp-grid-icon"><img src="' + iconBase + 'icons/demolish.webp" draggable="false"></div>' +
          '<div class="fp-grid-label">' + item.name.replace('\n', '<br>') + '</div>';
      }
      content.appendChild(cell);
    }
    panel.appendChild(content);
    this.subItems.appendChild(panel);

    // Click handler for planning items
    content.addEventListener('click', (e) => {
      const el = e.target.closest('.fp-grid-item');
      if (!el) return;
      const id = el.dataset.fpAction;
      const pItem = planItems.find(p => p.id === id);
      if (!pItem) return;
      AppState.tools.activeItem = pItem;
      content.querySelectorAll('.fp-grid-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      Grid.canvas.style.cursor = 'crosshair';
    });

    // Auto-select first item
    const firstEl = content.querySelector('.fp-grid-item');
    if (firstEl) firstEl.click();
  },

  cycleItem(direction) {
    const s = AppState;
    if (!s.tools.activeCategory) return;
    const data = ToolbarData[s.tools.activeCategory];
    if (!data || !data.items || data.items.length === 0) return;

    const items = data.items;
    let idx = -1;
    if (s.tools.activeItem) {
      idx = items.findIndex((i) => i.id === s.tools.activeItem.id);
    }

    idx += direction;
    if (idx >= items.length) idx = 0;
    if (idx < 0) idx = items.length - 1;

    this.selectItem(items[idx].id);
  },
};
