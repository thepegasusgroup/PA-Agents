// ── Pipeline Singleton — core ──
// Declares the Pipeline singleton (state + init + palette + _esc helper).
// App-specific methods attach from sibling files:
//   editor.js      — desk node editor (open/close, add/remove/connect, render, mouse handlers, select)
//   room_config.js — room config overlay (tabs, staff, pipeline tab, room info)
//   runner.js      — execution engine (runDeskPipeline, runRoomPipeline, _executeNode, results)
//   hitl.js        — learning + HITL queue (memory, correct/approve, _pushToHITL)
// Top-level helpers live in:
//   email_render.js — renderEmailSecure() for email body display
//   node_types.js   — NodeTypes registry

const Pipeline = {
  _currentObjId: null,
  _currentRoomId: null,
  _selectedNodeId: null,
  _draggingNode: null,
  _connectingFrom: null,
  _dragOffset: { x: 0, y: 0 },
  _lastContext: null,    // set by runner.js after execution, used by results panel

  init() {
    // Desk pipeline editor
    this.overlay = document.getElementById('pipelineOverlay');
    this.editor = this.overlay.querySelector('.pipeline-editor');
    this.paletteList = this.overlay.querySelector('.pe-palette-list');
    this.canvas = this.overlay.querySelector('.pe-canvas');
    this.svgConns = this.overlay.querySelector('.pe-connections');
    this.configPanel = this.overlay.querySelector('.pe-config');
    this.configBody = this.overlay.querySelector('.pe-config-body');
    this.titleEl = this.overlay.querySelector('.pe-title');

    this.overlay.querySelector('.pe-close').addEventListener('click', () => this.closeDeskEditor());
    this.overlay.querySelector('.pe-save-btn').addEventListener('click', () => this.closeDeskEditor());
    this.overlay.querySelector('.pe-run-btn').addEventListener('click', () => this._runCurrentPipeline());

    // Clicking overlay backdrop closes
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.closeDeskEditor();
    });

    // Canvas mouse events for node dragging & connecting
    this.canvas.addEventListener('mousedown', (e) => this._onCanvasMouseDown(e));
    document.addEventListener('mousemove', (e) => this._onCanvasMouseMove(e));
    document.addEventListener('mouseup', (e) => this._onCanvasMouseUp(e));

    // Build palette
    this._buildPalette();

    // Results panel
    this.resultsPanel = this.overlay.querySelector('.pe-results');
    this.resultsBody = this.overlay.querySelector('.pe-results-body');
    this.overlay.querySelector('.pe-results-close').addEventListener('click', () => {
      this.resultsPanel.classList.add('hidden');
    });

    // Room config overlay
    this.roomOverlay = document.getElementById('roomConfigOverlay');
    this.roomOverlay.querySelector('.rc-close').addEventListener('click', () => this.closeRoomConfig());
    this.roomOverlay.querySelector('.rc-run-btn').addEventListener('click', () => this._runRoomPipeline());
    this.roomOverlay.addEventListener('click', (e) => {
      if (e.target === this.roomOverlay) this.closeRoomConfig();
    });

    // Room config tabs
    this.roomOverlay.querySelectorAll('.rc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.roomOverlay.querySelectorAll('.rc-tab').forEach(t => t.classList.toggle('active', t === tab));
        this.roomOverlay.querySelectorAll('.rc-tab-content').forEach(tc => {
          tc.classList.toggle('hidden', tc.dataset.tab !== tabName);
        });
        // Re-render the content for the selected tab
        if (tabName === 'staff') this._renderStaffTab();
        else if (tabName === 'pipeline') this._renderRoomConfig();
      });
    });
  },

  // ── Palette ──

  _buildPalette() {
    this.paletteList.innerHTML = '';
    const categories = {};
    for (const [typeId, def] of Object.entries(NodeTypes)) {
      if (!categories[def.category]) categories[def.category] = [];
      categories[def.category].push({ typeId, def });
    }
    for (const [catName, nodes] of Object.entries(categories)) {
      const header = document.createElement('div');
      header.className = 'pe-palette-cat';
      header.textContent = catName.charAt(0).toUpperCase() + catName.slice(1);
      this.paletteList.appendChild(header);

      for (const { typeId, def } of nodes) {
        const item = document.createElement('div');
        item.className = 'pe-palette-item';
        item.dataset.nodeType = typeId;
        item.innerHTML = `<span class="pe-palette-icon" style="background:${def.color}">${def.icon}</span> ${def.label}`;
        item.addEventListener('click', () => this._addNode(typeId));
        this.paletteList.appendChild(item);
      }
    }
  },

  // ── Shared helpers ──

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
};
