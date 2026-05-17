// ── Secure Email Renderer ──
// Renders HTML email content safely in a sandboxed iframe
function renderEmailSecure(container, htmlContent, plainFallback) {
  const content = htmlContent || plainFallback || '';

  // If it doesn't look like HTML, just show as plain text
  if (!content.includes('<') || !content.includes('>')) {
    const pre = document.createElement('div');
    pre.className = 'pe-result-detail';
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = content;
    container.appendChild(pre);
    return;
  }

  // Sanitize: strip dangerous elements and attributes
  let safe = content;

  // Remove script, iframe, object, embed, form, link, meta, base tags entirely
  safe = safe.replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*>[\s\S]*?<\/\1>/gi, '');
  safe = safe.replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*\/?>/gi, '');

  // Remove all event handler attributes (on*)
  safe = safe.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  safe = safe.replace(/\s+on\w+\s*=\s*\S+/gi, '');

  // Remove javascript: URLs
  safe = safe.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  safe = safe.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

  // Block external images by default (tracking pixels) — replace src with data placeholder
  safe = safe.replace(/(<img[^>]*?)src\s*=\s*["']https?:\/\/[^"']*["']/gi,
    '$1src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect fill=\'%23ddd\' width=\'16\' height=\'16\'/%3E%3C/svg%3E" data-blocked="true"');

  // Remove style tags that could break out
  safe = safe.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Build sandboxed iframe
  const wrapper = document.createElement('div');
  wrapper.className = 'email-frame-wrap';

  const iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-same-origin'; // No scripts, no forms, no popups
  iframe.setAttribute('csp', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  iframe.style.cssText = 'width:100%;border:none;background:#fff;border-radius:4px;min-height:150px;';

  const srcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<style>
  body { font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #222; padding: 12px; margin: 0; line-height: 1.5; word-break: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #4a90c4; }
  table { max-width: 100%; }
  * { max-width: 100% !important; }
</style></head><body>${safe}</body></html>`;

  iframe.srcdoc = srcdoc;

  // Auto-resize iframe to content height
  iframe.onload = () => {
    try {
      const h = iframe.contentDocument.body.scrollHeight;
      iframe.style.height = Math.min(Math.max(h + 20, 100), 400) + 'px';
    } catch (e) { iframe.style.height = '300px'; }
  };

  wrapper.appendChild(iframe);

  // "Load external images" button
  const imgBtn = document.createElement('button');
  imgBtn.className = 'email-load-images-btn';
  imgBtn.textContent = '🖼️ Load external images';
  imgBtn.addEventListener('click', () => {
    // Re-render with images unblocked
    const unblocked = content
      .replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset)[^>]*\/?>/gi, '')
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*\S+/gi, '')
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

    const newSrcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;">
<style>
  body { font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #222; padding: 12px; margin: 0; line-height: 1.5; word-break: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #4a90c4; }
  table { max-width: 100%; }
  * { max-width: 100% !important; }
</style></head><body>${unblocked}</body></html>`;
    iframe.srcdoc = newSrcdoc;
    imgBtn.remove();
  });
  wrapper.appendChild(imgBtn);

  container.appendChild(wrapper);
}

// ── Node Type Registry ──
const NodeTypes = {
  gmail_fetch: {
    label: 'Fetch Emails',
    category: 'gmail',
    color: '#dc4e41',
    icon: '\u{1F4E8}',
    inputs: [],
    outputs: ['emails'],
    params: [
      { key: 'maxResults', label: 'Max Emails', type: 'number', default: 10 },
      { key: 'query', label: 'Search Query', type: 'text', default: '' },
    ],
  },
  gmail_read: {
    label: 'Read Email',
    category: 'gmail',
    color: '#dc4e41',
    icon: '\u{1F4D6}',
    inputs: ['email'],
    outputs: ['content'],
    params: [],
  },
  gmail_filter: {
    label: 'Filter',
    category: 'gmail',
    color: '#e8821a',
    icon: '\u{1F50D}',
    inputs: ['emails'],
    outputs: ['matched', 'unmatched'],
    params: [
      { key: 'field', label: 'Filter By', type: 'select', options: ['from', 'subject', 'body'], default: 'from' },
      { key: 'contains', label: 'Contains', type: 'text', default: '' },
    ],
  },
  gmail_send: {
    label: 'Send Email',
    category: 'gmail',
    color: '#5cb85c',
    icon: '\u{1F4E4}',
    inputs: ['trigger'],
    outputs: ['sent'],
    params: [
      { key: 'to', label: 'To', type: 'text', default: '' },
      { key: 'subject', label: 'Subject', type: 'text', default: '' },
      { key: 'body', label: 'Body', type: 'textarea', default: '' },
    ],
  },
  gmail_reply: {
    label: 'Reply',
    category: 'gmail',
    color: '#4a90c4',
    icon: '↩️',
    inputs: ['email'],
    outputs: ['sent'],
    params: [
      { key: 'body', label: 'Reply Body', type: 'textarea', default: '' },
    ],
  },

  // ── AI Nodes ──
  ai_classify: {
    label: 'Classify Email',
    category: 'ai',
    color: '#9b59b6',
    icon: '🧠',
    inputs: ['emails'],
    outputs: ['classified'],
    params: [
      { key: 'categories', label: 'Categories', type: 'text', default: 'important, routine, spam' },
    ],
  },
  ai_summarize: {
    label: 'Summarize',
    category: 'ai',
    color: '#9b59b6',
    icon: '📝',
    inputs: ['emails'],
    outputs: ['summaries'],
    params: [
      { key: 'style', label: 'Style', type: 'select', options: ['brief', 'detailed', 'bullet-points'], default: 'brief' },
    ],
  },
  ai_decide: {
    label: 'Decide Action',
    category: 'ai',
    color: '#9b59b6',
    icon: '⚖️',
    inputs: ['emails'],
    outputs: ['actions'],
    params: [
      { key: 'actions', label: 'Possible Actions', type: 'text', default: 'flag_important, archive, notify_user, draft_reply' },
    ],
  },
  ai_custom: {
    label: 'Custom Prompt',
    category: 'ai',
    color: '#9b59b6',
    icon: '💬',
    inputs: ['data'],
    outputs: ['result'],
    params: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', default: 'Analyze the following data and provide insights:' },
    ],
  },
};

// ── Pipeline Singleton ──
const Pipeline = {
  _currentObjId: null,
  _currentRoomId: null,
  _selectedNodeId: null,
  _draggingNode: null,
  _connectingFrom: null,
  _dragOffset: { x: 0, y: 0 },

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

  // ── Desk Editor ──

  openDeskEditor(objId) {
    this._currentObjId = objId;
    this._selectedNodeId = null;
    this.configPanel.classList.add('hidden');

    const obj = AppState.objects.find(o => o.id === objId);
    const def = obj ? ObjectDefs[obj.type] : null;
    this.titleEl.textContent = def ? def.name + ' Pipeline' : 'Desk Pipeline';

    this.overlay.classList.remove('hidden');
    this._renderNodes();
    this._renderConnections();
  },

  closeDeskEditor() {
    this.overlay.classList.add('hidden');
    this._currentObjId = null;
    this._selectedNodeId = null;
    this._connectingFrom = null;
  },

  // ── Node CRUD ──

  _addNode(type, x, y) {
    if (!this._currentObjId) return;
    const pipeline = AppState.getDeskPipeline(this._currentObjId);
    const def = NodeTypes[type];
    if (!def) return;

    const params = {};
    for (const p of def.params) {
      params[p.key] = p.default;
    }

    const node = {
      id: pipeline.nextNodeId++,
      type,
      label: def.label,
      params,
      x: x || 40 + Math.random() * 300,
      y: y || 30 + Math.random() * 200,
    };
    pipeline.nodes.push(node);
    this._renderNodes();
    this._renderConnections();

    // Auto-add to room pipeline desk order
    this._ensureInRoomPipeline(this._currentObjId);
  },

  _removeNode(nodeId) {
    if (!this._currentObjId) return;
    const pipeline = AppState.getDeskPipeline(this._currentObjId);
    pipeline.nodes = pipeline.nodes.filter(n => n.id !== nodeId);
    pipeline.connections = pipeline.connections.filter(c => c.fromId !== nodeId && c.toId !== nodeId);
    if (this._selectedNodeId === nodeId) {
      this._selectedNodeId = null;
      this.configPanel.classList.add('hidden');
    }
    this._renderNodes();
    this._renderConnections();
  },

  _connectNodes(fromId, toId) {
    if (!this._currentObjId) return;
    const pipeline = AppState.getDeskPipeline(this._currentObjId);
    // Don't duplicate
    if (pipeline.connections.some(c => c.fromId === fromId && c.toId === toId)) return;
    // Don't self-connect
    if (fromId === toId) return;
    pipeline.connections.push({ fromId, toId });
    this._renderConnections();
  },

  // ── Rendering ──

  _renderNodes() {
    if (!this._currentObjId) return;
    const pipeline = AppState.getDeskPipeline(this._currentObjId);
    this.canvas.innerHTML = '';

    for (const node of pipeline.nodes) {
      const def = NodeTypes[node.type] || {};
      const el = document.createElement('div');
      el.className = 'pe-node' + (node.id === this._selectedNodeId ? ' selected' : '');
      el.dataset.nodeId = node.id;
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';

      el.innerHTML = `
        <div class="pe-node-header" style="background:${def.color || '#666'}">
          <span class="pe-node-icon">${def.icon || ''}</span>
          <span class="pe-node-label">${node.label}</span>
          <button class="pe-node-delete" data-del="${node.id}">&times;</button>
        </div>
        <div class="pe-node-body">
          ${(def.inputs || []).map((inp, i) =>
            `<div class="pe-port pe-port-in" data-node="${node.id}" data-port="in_${i}" title="${inp}"><span class="pe-port-dot"></span> ${inp}</div>`
          ).join('')}
          ${(def.outputs || []).map((out, i) =>
            `<div class="pe-port pe-port-out" data-node="${node.id}" data-port="out_${i}" title="${out}">${out} <span class="pe-port-dot"></span></div>`
          ).join('')}
        </div>
      `;

      // Click to select
      el.addEventListener('click', (e) => {
        if (e.target.closest('.pe-node-delete')) {
          this._removeNode(node.id);
          return;
        }
        if (e.target.closest('.pe-port')) return; // handled by port
        this._selectNode(node.id);
      });

      this.canvas.appendChild(el);
    }

    // Wire port events
    this.canvas.querySelectorAll('.pe-port-dot').forEach(dot => {
      dot.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const port = dot.closest('.pe-port');
        const nodeId = parseInt(port.dataset.node);
        if (port.classList.contains('pe-port-out')) {
          this._connectingFrom = nodeId;
        } else {
          // If connecting, complete the connection
          if (this._connectingFrom !== null) {
            this._connectNodes(this._connectingFrom, nodeId);
            this._connectingFrom = null;
          }
        }
      });
      dot.addEventListener('mouseup', (e) => {
        const port = dot.closest('.pe-port');
        const nodeId = parseInt(port.dataset.node);
        if (port.classList.contains('pe-port-in') && this._connectingFrom !== null) {
          this._connectNodes(this._connectingFrom, nodeId);
          this._connectingFrom = null;
        }
      });
    });
  },

  _renderConnections() {
    if (!this._currentObjId) return;
    const pipeline = AppState.getDeskPipeline(this._currentObjId);
    // Clear SVG
    this.svgConns.innerHTML = '';

    for (const conn of pipeline.connections) {
      const fromNode = pipeline.nodes.find(n => n.id === conn.fromId);
      const toNode = pipeline.nodes.find(n => n.id === conn.toId);
      if (!fromNode || !toNode) continue;

      // Approximate positions (node is 140px wide)
      const x1 = fromNode.x + 140;
      const y1 = fromNode.y + 40;
      const x2 = toNode.x;
      const y2 = toNode.y + 40;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = (x1 + x2) / 2;
      line.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', '#e8821a');
      line.setAttribute('stroke-width', '2');
      this.svgConns.appendChild(line);
    }
  },

  // ── Node dragging ──

  _onCanvasMouseDown(e) {
    const nodeEl = e.target.closest('.pe-node');
    if (!nodeEl) return;
    if (e.target.closest('.pe-port') || e.target.closest('.pe-node-delete')) return;

    const nodeId = parseInt(nodeEl.dataset.nodeId);
    const pipeline = AppState.getDeskPipeline(this._currentObjId);
    const node = pipeline.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    this._draggingNode = node;
    this._dragOffset = {
      x: e.clientX - canvasRect.left - node.x,
      y: e.clientY - canvasRect.top - node.y,
    };
  },

  _onCanvasMouseMove(e) {
    if (!this._draggingNode) return;
    const canvasRect = this.canvas.getBoundingClientRect();
    this._draggingNode.x = Math.max(0, e.clientX - canvasRect.left - this._dragOffset.x);
    this._draggingNode.y = Math.max(0, e.clientY - canvasRect.top - this._dragOffset.y);

    const el = this.canvas.querySelector(`[data-node-id="${this._draggingNode.id}"]`);
    if (el) {
      el.style.left = this._draggingNode.x + 'px';
      el.style.top = this._draggingNode.y + 'px';
    }
    this._renderConnections();
  },

  _onCanvasMouseUp(e) {
    if (this._draggingNode) {
      this._draggingNode = null;
    }
    if (this._connectingFrom !== null) {
      // Check if we landed on an input port (handled by port mouseup)
      // If not, cancel
      setTimeout(() => { this._connectingFrom = null; }, 50);
    }
  },

  // ── Node config ──

  _selectNode(nodeId) {
    this._selectedNodeId = nodeId;
    const pipeline = AppState.getDeskPipeline(this._currentObjId);
    const node = pipeline.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Highlight
    this.canvas.querySelectorAll('.pe-node').forEach(el => {
      el.classList.toggle('selected', parseInt(el.dataset.nodeId) === nodeId);
    });

    const def = NodeTypes[node.type];
    if (!def || !def.params || def.params.length === 0) {
      this.configPanel.classList.add('hidden');
      return;
    }

    this.configPanel.classList.remove('hidden');
    this.configBody.innerHTML = '';

    for (const p of def.params) {
      const row = document.createElement('div');
      row.className = 'pe-config-row';

      const label = document.createElement('label');
      label.textContent = p.label;
      row.appendChild(label);

      let input;
      if (p.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else if (p.type === 'select') {
        input = document.createElement('select');
        for (const opt of p.options) {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          input.appendChild(o);
        }
      } else {
        input = document.createElement('input');
        input.type = p.type === 'number' ? 'number' : 'text';
      }

      input.value = node.params[p.key] !== undefined ? node.params[p.key] : p.default;
      input.addEventListener('change', () => {
        node.params[p.key] = p.type === 'number' ? parseInt(input.value) || p.default : input.value;
      });
      input.addEventListener('input', () => {
        node.params[p.key] = p.type === 'number' ? parseInt(input.value) || p.default : input.value;
      });

      row.appendChild(input);
      this.configBody.appendChild(row);
    }
  },

  // ── Room Pipeline Config ──

  openRoomConfig(roomId) {
    this._currentRoomId = roomId;
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;
    const def = RoomDefs[room.type];

    this.roomOverlay.classList.remove('hidden');
    const titleEl = this.roomOverlay.querySelector('.rc-title');
    titleEl.textContent = def ? def.name : 'Room';

    // Reset to Staff tab
    this.roomOverlay.querySelectorAll('.rc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'staff'));
    this.roomOverlay.querySelectorAll('.rc-tab-content').forEach(tc => tc.classList.toggle('hidden', tc.dataset.tab !== 'staff'));

    this._renderRoomConfig();
    this._renderStaffTab();
  },

  closeRoomConfig() {
    this.roomOverlay.classList.add('hidden');
    this._currentRoomId = null;
  },

  _renderRoomConfig() {
    const roomId = this._currentRoomId;
    if (!roomId) return;

    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;
    const rp = AppState.getRoomPipeline(roomId);

    this._renderRoomInfo();

    // List desks with pipelines
    const listEl = this.roomOverlay.querySelector('.rc-desk-list');
    listEl.innerHTML = '';

    // Find all desk-type objects in this room
    const desks = AppState.objects.filter(obj => {
      if (obj.gx + obj.w <= room.x1 || obj.gx > room.x2 ||
          obj.gy + obj.h <= room.y1 || obj.gy > room.y2) return false;
      return DESK_TYPES.has(obj.type);
    });

    if (desks.length === 0) {
      listEl.innerHTML = '<div class="rc-empty">No desks in this room</div>';
      return;
    }

    // Ensure deskOrder includes existing desks
    const currentOrder = rp.deskOrder.filter(id => desks.some(d => d.id === id));
    // Add any desks not in order yet
    for (const d of desks) {
      if (!currentOrder.includes(d.id)) currentOrder.push(d.id);
    }
    AppState.setRoomDeskOrder(roomId, currentOrder);

    for (let i = 0; i < currentOrder.length; i++) {
      const obj = AppState.objects.find(o => o.id === currentOrder[i]);
      if (!obj) continue;
      const objDef = ObjectDefs[obj.type];
      const pip = AppState.pipelines[obj.id];
      const nodeCount = pip ? pip.nodes.length : 0;

      const item = document.createElement('div');
      item.className = 'rc-desk-item';
      item.innerHTML = `
        <span class="rc-desk-num">${i + 1}</span>
        <span class="rc-desk-name">${objDef ? objDef.name : obj.type}</span>
        <span class="rc-desk-nodes">${nodeCount} node${nodeCount !== 1 ? 's' : ''}</span>
        <div class="rc-desk-arrows">
          <button class="rc-arrow-up" data-idx="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="rc-arrow-down" data-idx="${i}" ${i === currentOrder.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      `;

      // Click to open desk editor
      item.querySelector('.rc-desk-name').addEventListener('click', () => {
        this.closeRoomConfig();
        this.openDeskEditor(obj.id);
      });

      // Arrow buttons to reorder
      item.querySelector('.rc-arrow-up').addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.idx);
        if (idx > 0) {
          [currentOrder[idx], currentOrder[idx - 1]] = [currentOrder[idx - 1], currentOrder[idx]];
          AppState.setRoomDeskOrder(roomId, currentOrder);
          this._renderRoomConfig();
        }
      });
      item.querySelector('.rc-arrow-down').addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.idx);
        if (idx < currentOrder.length - 1) {
          [currentOrder[idx], currentOrder[idx + 1]] = [currentOrder[idx + 1], currentOrder[idx]];
          AppState.setRoomDeskOrder(roomId, currentOrder);
          this._renderRoomConfig();
        }
      });

      listEl.appendChild(item);
    }
  },

  // ── Staff deployment tab ──

  _renderStaffTab() {
    const roomId = this._currentRoomId;
    if (!roomId) return;
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;

    // Build staff button grid
    const staffGrid = this.roomOverlay.querySelector('.rc-staff-grid');
    staffGrid.innerHTML = '';

    for (const [typeId, wt] of Object.entries(WorkerTypes)) {
      const btn = document.createElement('div');
      btn.className = 'rc-staff-btn';
      btn.title = `Click to assign a ${wt.name} to this room`;
      btn.innerHTML = `
        <div class="rc-staff-icon" style="background:${wt.color}">${wt.icon}</div>
        <div class="rc-staff-name">${wt.name}</div>
      `;
      btn.addEventListener('click', () => {
        // Spawn worker at random position inside room bounds
        const rx = room.x1 + 1 + Math.random() * Math.max(0, room.x2 - room.x1 - 1);
        const ry = room.y1 + 1 + Math.random() * Math.max(0, room.y2 - room.y1 - 1);
        AppState.spawnWorker(typeId, Math.floor(rx), Math.floor(ry));
        this._renderStaffTab();
        this._renderRoomInfo();
      });
      staffGrid.appendChild(btn);
    }

    // Build assigned workers list
    this._renderAssignedWorkers();
  },

  _renderAssignedWorkers() {
    const roomId = this._currentRoomId;
    if (!roomId) return;
    const list = this.roomOverlay.querySelector('.rc-assigned-list');
    list.innerHTML = '';

    const workers = AppState.getWorkersInRoom(roomId);

    if (workers.length === 0) {
      list.innerHTML = '<div class="rc-assigned-empty">No staff assigned</div>';
      return;
    }

    for (const w of workers) {
      const wt = WorkerTypes[w.type] || {};
      const item = document.createElement('div');
      item.className = 'rc-assigned-item';
      item.innerHTML = `
        <div class="rc-assigned-dot" style="background:${wt.color || '#888'}"></div>
        <span class="rc-assigned-name">${w.name}</span>
        <span class="rc-assigned-role">${wt.name || w.type}</span>
        <button class="rc-assigned-remove" title="Dismiss worker">&times;</button>
      `;
      item.querySelector('.rc-assigned-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        AppState.removeWorker(w.id);
        this._renderStaffTab();
        this._renderRoomInfo();
      });
      list.appendChild(item);
    }
  },

  _renderRoomInfo() {
    const roomId = this._currentRoomId;
    if (!roomId) return;
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;
    const def = RoomDefs[room.type];
    const workers = AppState.getWorkersInRoom(roomId);

    const infoEl = this.roomOverlay.querySelector('.rc-info');
    infoEl.innerHTML = `
      <div class="rc-stat"><label>Room</label><span>${def ? def.name : room.type}</span></div>
      <div class="rc-stat"><label>Workers</label><span>${workers.length}</span></div>
      <div class="rc-stat"><label>Status</label><span>${room.satisfied ? 'Satisfied' : 'Unsatisfied'}</span></div>
    `;
  },

  // ── Room pipeline helpers ──

  _ensureInRoomPipeline(objId) {
    const obj = AppState.objects.find(o => o.id === objId);
    if (!obj) return;
    // Find room this desk is in
    const room = AppState.getRoomAt(obj.gx, obj.gy);
    if (!room) return;
    const rp = AppState.getRoomPipeline(room.id);
    if (!rp.deskOrder.includes(objId)) {
      rp.deskOrder.push(objId);
    }
  },

  // ── Pipeline Execution ──

  async _runCurrentPipeline() {
    if (!this._currentObjId) return;
    await this.runDeskPipeline(this._currentObjId);
  },

  async _runRoomPipeline() {
    if (!this._currentRoomId) return;
    await this.runRoomPipeline(this._currentRoomId);
  },

  async runDeskPipeline(objId) {
    const pipeline = AppState.pipelines[objId];
    if (!pipeline || pipeline.nodes.length === 0) return;

    const obj = AppState.objects.find(o => o.id === objId);
    if (!obj) return;
    const room = AppState.getRoomAt(obj.gx, obj.gy);
    if (!room) return;

    // Find an idle worker in this room
    const workers = AppState.getWorkersInRoom(room.id);
    const worker = workers.find(w => w.state === 'idle' || w.state === 'walking') || workers[0];
    if (!worker) return;

    // Dispatch worker to desk
    worker.targetX = obj.gx + 0.5;
    worker.targetY = obj.gy + 0.5;
    worker.state = 'walking';

    // Wait for worker to arrive (poll)
    await new Promise(resolve => {
      const check = setInterval(() => {
        const dx = worker.x - worker.targetX;
        const dy = worker.y - worker.targetY;
        if (Math.sqrt(dx * dx + dy * dy) < 0.5 || worker.state === 'sitting' || worker.state === 'working') {
          clearInterval(check);
          resolve();
        }
      }, 100);
      // Safety timeout
      setTimeout(() => { clearInterval(check); resolve(); }, 10000);
    });

    worker.seatObj = obj;
    worker.state = 'working';
    if (typeof Reports !== 'undefined') Reports.log('worker', `${worker.name} sat down at desk #${objId}`);

    // Build execution order from connections (topological sort)
    const execOrder = this._topologicalSort(pipeline);

    // Execute each node
    let context = {};
    for (const node of execOrder) {
      worker.taskLabel = node.label + '...';
      Grid._updateWorkerPanel();

      try {
        context = await this._executeNode(node, context);
        if (typeof Reports !== 'undefined') Reports.log('pipeline', `✓ ${node.label} complete`);
      } catch (err) {
        console.error('Pipeline node error:', node.label, err);
        if (typeof Reports !== 'undefined') Reports.log('pipeline', `✗ ${node.label} failed: ${err.message}`, 'error');
        worker.taskLabel = 'Error: ' + (err.message || err);
        await new Promise(r => setTimeout(r, 2000));
        break;
      }

      // Brief pause between nodes for visual feedback
      await new Promise(r => setTimeout(r, 500));
    }

    // Done — release worker
    worker.state = 'idle';
    worker.taskLabel = null;
    worker.seatObj = null;
    Grid._updateWorkerPanel();

    // Show results
    this._lastContext = context;
    this._showResults(context);
  },

  async runRoomPipeline(roomId) {
    const rp = AppState.roomPipelines[roomId];
    if (!rp || !rp.deskOrder || rp.deskOrder.length === 0) return;

    for (const objId of rp.deskOrder) {
      await this.runDeskPipeline(objId);
    }
  },

  _topologicalSort(pipeline) {
    // Simple: follow connections from nodes with no inputs first
    const visited = new Set();
    const result = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      // Visit dependencies first
      for (const conn of pipeline.connections) {
        if (conn.toId === nodeId) visit(conn.fromId);
      }
      const node = pipeline.nodes.find(n => n.id === nodeId);
      if (node) result.push(node);
    };

    // Start from nodes with no outgoing connections (sinks), or just visit all
    for (const node of pipeline.nodes) {
      visit(node.id);
    }
    return result;
  },

  async _executeNode(node, context) {
    const api = window.electronAPI?.gmail;

    switch (node.type) {
      case 'gmail_fetch': {
        if (!api) {
          throw new Error('Gmail API not available');
        }
        const auth = await api.isAuthenticated();
        if (!auth) {
          // Don't auto-open popup — user must sign in via the Comms panel first
          throw new Error('Gmail not authenticated — sign in via the phone app first');
        }
        const result = await api.listMessages(node.params.maxResults || 10);
        if (!result.success) throw new Error(result.error || 'Failed to fetch');
        context.emails = result.data;
        console.log('[Pipeline] Fetched', result.data.length, 'emails');
        if (typeof Reports !== 'undefined') {
          Reports.log('gmail', `Fetched ${result.data.length} emails`);
          Reports.setEmails(result.data);
        }
        return context;
      }

      case 'gmail_read': {
        if (!api) throw new Error('Gmail API not available');
        if (context.emails && context.emails.length > 0) {
          const first = context.emails[0];
          const result = await api.getMessage(first.id);
          if (result.success) {
            context.currentEmail = result.data;
            console.log('[Pipeline] Read email:', result.data.subject);
          }
        }
        return context;
      }

      case 'gmail_filter': {
        if (!context.emails) return context;
        const field = node.params.field || 'from';
        const contains = (node.params.contains || '').toLowerCase();
        if (!contains) return context;
        context.matched = context.emails.filter(e => {
          const val = (e[field] || '').toLowerCase();
          return val.includes(contains);
        });
        context.unmatched = context.emails.filter(e => {
          const val = (e[field] || '').toLowerCase();
          return !val.includes(contains);
        });
        console.log('[Pipeline] Filtered:', context.matched.length, 'matched');
        return context;
      }

      case 'gmail_send':
      case 'gmail_reply':
        console.log('[Pipeline] Send/Reply not yet implemented');
        return context;

      // ── AI Nodes ──
      case 'ai_classify': {
        const ollama = window.electronAPI?.ollama;
        if (!ollama) throw new Error('Ollama API not available');

        const avail = await ollama.isAvailable();
        if (!avail.available) throw new Error('Ollama not running. Start it with: ollama serve');

        const emails = context.emails || [];
        if (emails.length === 0) return context;

        const categories = node.params.categories || 'important, routine, spam';
        const memory = this._getWorkerMemory();
        const memoryContext = memory.length > 0
          ? '\n\nHere are examples of past classifications the user corrected:\n' +
            memory.slice(-10).map(m => `- "${m.subject}" from ${m.from} → user said: ${m.correction}`).join('\n')
          : '';

        // Batch all emails into one prompt
        const emailList = emails.slice(0, 10).map((e, i) =>
          `${i + 1}. From: ${e.from || 'unknown'} | Subject: ${e.subject || '(none)'} | Snippet: ${(e.snippet || '').substring(0, 100)}`
        ).join('\n');

        const prompt = `/no_think\nClassify each email into one of these categories: ${categories}
${memoryContext}

Emails:
${emailList}

Respond with ONLY a numbered list like:
1. category
2. category
...
Nothing else.`;

        const result = await ollama.generate(prompt, { temperature: 0.1, maxTokens: 200 });
        if (!result.success) throw new Error(result.error);

        // Parse response
        const lines = result.data.response.split('\n').filter(l => l.trim());
        context.classified = [];
        for (let i = 0; i < emails.slice(0, 10).length; i++) {
          const email = emails[i];
          let classification = 'routine';
          if (lines[i]) {
            // Extract category from "1. spam" or "1. important" etc
            const match = lines[i].match(/\d+\.\s*(.+)/);
            classification = match ? match[1].trim().toLowerCase() : lines[i].trim().toLowerCase();
          }
          context.classified.push({ ...email, classification });
          if (typeof Reports !== 'undefined') {
            Reports.log('gmail', `"${email.subject}" → ${classification}`);
          }
        }

        // Push to HITL queue for user review
        this._pushToHITL(context.classified);
        return context;
      }

      case 'ai_summarize': {
        const ollama = window.electronAPI?.ollama;
        if (!ollama) throw new Error('Ollama API not available');

        const emails = context.emails || context.classified || [];
        if (emails.length === 0) return context;

        const style = node.params.style || 'brief';
        const styleInstructions = {
          brief: 'one short sentence each',
          detailed: '2-3 sentences each',
          'bullet-points': '2-3 bullet points each',
        };

        // Batch into one prompt
        const emailList = emails.slice(0, 8).map((e, i) =>
          `${i + 1}. From: ${e.from || 'unknown'} | Subject: ${e.subject || '(none)'} | Content: ${(e.snippet || '').substring(0, 150)}`
        ).join('\n');

        const prompt = `/no_think\nSummarize each email (${styleInstructions[style]}):

${emailList}

Respond with a numbered list of summaries:`;

        const result = await ollama.generate(prompt, { temperature: 0.2, maxTokens: 800 });
        if (!result.success) throw new Error(result.error);

        const lines = result.data.response.split(/\n(?=\d+\.)/).filter(l => l.trim());
        context.summaries = [];
        for (let i = 0; i < emails.slice(0, 8).length; i++) {
          const email = emails[i];
          let summary = '';
          if (lines[i]) {
            const match = lines[i].match(/\d+\.\s*(.+)/s);
            summary = match ? match[1].trim() : lines[i].trim();
          }
          context.summaries.push({ ...email, summary });
        }
        return context;
      }

      case 'ai_decide': {
        const ollama = window.electronAPI?.ollama;
        if (!ollama) throw new Error('Ollama API not available');

        const emails = context.classified || context.emails || [];
        if (emails.length === 0) return context;

        const actions = node.params.actions || 'flag_important, archive, notify_user, draft_reply';
        const memory = this._getWorkerMemory();
        const memoryContext = memory.length > 0
          ? '\n\nPast decisions the user approved or corrected:\n' +
            memory.slice(-8).map(m => `- "${m.subject}" (${m.classification || 'unknown'}) → action: ${m.action || m.correction}`).join('\n')
          : '';

        // Batch into one prompt
        const emailList = emails.slice(0, 10).map((e, i) =>
          `${i + 1}. From: ${e.from || 'unknown'} | Subject: ${e.subject || '(none)'} | Classification: ${e.classification || 'unknown'}`
        ).join('\n');

        const prompt = `/no_think\nFor each email, decide the best action. Choose from: ${actions}
${memoryContext}

Emails:
${emailList}

Respond with ONLY a numbered list like:
1. action
2. action
...
Nothing else.`;

        const result = await ollama.generate(prompt, { temperature: 0.1, maxTokens: 200 });
        if (!result.success) throw new Error(result.error);

        const lines = result.data.response.split('\n').filter(l => l.trim());
        context.actions = [];
        for (let i = 0; i < emails.slice(0, 10).length; i++) {
          const email = emails[i];
          let action = 'archive';
          if (lines[i]) {
            const match = lines[i].match(/\d+\.\s*(.+)/);
            action = match ? match[1].trim().toLowerCase() : lines[i].trim().toLowerCase();
          }
          context.actions.push({ ...email, action });
          if (typeof Reports !== 'undefined') {
            Reports.log('pipeline', `"${email.subject}" → action: ${action}`);
          }
        }

        this._pushToHITL(context.actions);
        return context;
      }

      case 'ai_custom': {
        const ollama = window.electronAPI?.ollama;
        if (!ollama) throw new Error('Ollama API not available');

        const userPrompt = node.params.prompt || '';
        const dataStr = JSON.stringify(context.emails || context.classified || context.summaries || context, null, 2).substring(0, 2000);

        const prompt = `/no_think\n${userPrompt}\n\nData:\n${dataStr}`;
        const result = await ollama.generate(prompt, { temperature: 0.3, maxTokens: 1024 });
        if (!result.success) throw new Error(result.error);

        context.customResult = result.data.response;
        if (typeof Reports !== 'undefined') Reports.log('pipeline', `Custom AI: ${result.data.response.substring(0, 100)}`);
        return context;
      }

      default:
        return context;
    }
  },

  // ── Worker Memory (Learning) ──

  _getWorkerMemory() {
    // Returns past corrections/decisions stored on AppState
    return AppState._workerMemory || [];
  },

  _addToMemory(entry) {
    if (!AppState._workerMemory) AppState._workerMemory = [];
    AppState._workerMemory.push({
      ...entry,
      timestamp: Date.now(),
    });
    // Keep last 100 memories
    if (AppState._workerMemory.length > 100) {
      AppState._workerMemory = AppState._workerMemory.slice(-100);
    }
  },

  // User corrects a classification or action
  correctDecision(emailId, correction) {
    const entry = (AppState._hitlQueue || []).find(e => e.id === emailId);
    if (entry) {
      this._addToMemory({
        from: entry.from,
        subject: entry.subject,
        classification: entry.classification,
        action: entry.action,
        correction: correction,
      });
      AppState._reviewedEmailIds[emailId] = correction;
      AppState._hitlQueue = (AppState._hitlQueue || []).filter(e => e.id !== emailId);
      if (typeof Reports !== 'undefined') Reports.log('worker', `User corrected: "${entry.subject}" → ${correction}`);
      if (typeof Todo !== 'undefined') Todo.refresh();
    }
  },

  // User approves a decision (reinforces it)
  approveDecision(emailId) {
    const entry = (AppState._hitlQueue || []).find(e => e.id === emailId);
    if (entry) {
      const finalClassification = entry.classification || entry.action;
      this._addToMemory({
        from: entry.from,
        subject: entry.subject,
        classification: entry.classification,
        action: entry.action,
        correction: finalClassification, // approved = correct
      });
      AppState._reviewedEmailIds[emailId] = finalClassification;
      AppState._hitlQueue = (AppState._hitlQueue || []).filter(e => e.id !== emailId);
      if (typeof Reports !== 'undefined') Reports.log('worker', `User approved: "${entry.subject}"`);
      if (typeof Todo !== 'undefined') Todo.refresh();
    }
  },

  // Fix a past decision (from the history view)
  correctPastDecision(from, subject, newCorrection) {
    const memory = AppState._workerMemory || [];
    // Find the matching memory entry and update it
    for (let i = memory.length - 1; i >= 0; i--) {
      if (memory[i].from === from && memory[i].subject === subject) {
        memory[i].correction = newCorrection;
        if (typeof Reports !== 'undefined') Reports.log('worker', `Corrected past decision: "${subject}" → ${newCorrection}`);
        break;
      }
    }
    // Also update _reviewedEmailIds if we can match
    for (const [id, val] of Object.entries(AppState._reviewedEmailIds)) {
      // We don't have a direct ID→from mapping here, but the memory correction
      // will affect future LLM prompts which is what matters
    }
    if (typeof Todo !== 'undefined') Todo.refresh();
  },

  // ── HITL Queue ──

  _pushToHITL(items) {
    if (!AppState._hitlQueue) AppState._hitlQueue = [];
    let newCount = 0;
    for (const item of items) {
      // Skip already-reviewed emails
      if (AppState._reviewedEmailIds[item.id]) continue;
      // Skip if already in queue
      if (AppState._hitlQueue.some(q => q.id === item.id)) continue;
      // Skip if worker memory has a confident match for this sender
      if (this._hasConfidentMatch(item)) continue;
      AppState._hitlQueue.push(item);
      newCount++;
    }
    if (newCount > 0) {
      this._showHITLNotification(newCount);
    }
  },

  // Check if worker memory already knows how to handle this email
  _hasConfidentMatch(item) {
    const memory = AppState._workerMemory || [];
    if (memory.length < 3) return false; // need some history first

    // Extract sender domain/name
    const from = (item.from || '').toLowerCase();

    // Count how many times this sender was classified the same way
    const senderMemories = memory.filter(m => {
      const mFrom = (m.from || '').toLowerCase();
      // Match by sender email/name
      return from.includes(mFrom.split('<')[0].trim()) ||
             mFrom.includes(from.split('<')[0].trim()) ||
             (mFrom.split('@')[1] && from.includes(mFrom.split('@')[1]));
    });

    if (senderMemories.length >= 2) {
      // Same sender reviewed 2+ times with same result — auto-classify
      const lastCorrection = senderMemories[senderMemories.length - 1].correction;
      const allSame = senderMemories.every(m => m.correction === lastCorrection);
      if (allSame) {
        // Auto-apply without asking
        item.classification = lastCorrection;
        AppState._reviewedEmailIds[item.id] = lastCorrection;
        if (typeof Reports !== 'undefined') {
          Reports.log('worker', `Auto-classified "${item.subject}" as ${lastCorrection} (learned from past)`);
        }
        return true;
      }
    }
    return false;
  },

  _showHITLNotification(count) {
    // Update todo panel
    if (typeof Todo !== 'undefined') Todo.refresh();
  },

  openHITLPanel() {
    const queue = AppState._hitlQueue || [];
    if (queue.length === 0) return;

    // Render in the results panel of the pipeline editor
    // If editor isn't open, open the reports panel instead
    if (typeof Reports !== 'undefined') {
      Reports.open();
      Reports.showHITL(queue);
    }
  },

  // ── Results Display ──

  _showResults(context) {
    if (!this.resultsPanel) return;
    this.resultsBody.innerHTML = '';

    const emails = context.matched || context.emails || [];
    if (emails.length === 0) {
      this.resultsBody.innerHTML = '<div style="padding:12px;color:rgba(255,255,255,0.4);font-size:12px;">No results</div>';
      this.resultsPanel.classList.remove('hidden');
      return;
    }

    this._renderEmailList(emails);
    this.resultsPanel.classList.remove('hidden');
  },

  _renderEmailList(emails) {
    this.resultsBody.innerHTML = '';
    for (const email of emails) {
      const item = document.createElement('div');
      item.className = 'pe-result-item' + (email.unread ? ' unread' : '');

      // Parse a short date
      let shortDate = '';
      if (email.date) {
        try {
          const d = new Date(email.date);
          const now = new Date();
          if (d.toDateString() === now.toDateString()) {
            shortDate = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            shortDate = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }
        } catch (e) { shortDate = email.date.substring(0, 10); }
      }

      // Clean up "from" — just show name or short email
      let fromDisplay = email.from || '';
      const nameMatch = fromDisplay.match(/^"?([^"<]+)"?\s*</);
      if (nameMatch) fromDisplay = nameMatch[1].trim();
      if (fromDisplay.length > 22) fromDisplay = fromDisplay.substring(0, 20) + '…';

      item.innerHTML = `
        <span class="pe-result-from">${this._esc(fromDisplay)}</span>
        <span class="pe-result-subject">${this._esc(email.subject || '(no subject)')}<span class="pe-result-snippet"> — ${this._esc((email.snippet || '').substring(0, 60))}</span></span>
        <span class="pe-result-date">${this._esc(shortDate)}</span>
      `;

      item.addEventListener('click', () => this._showEmailDetail(email));
      this.resultsBody.appendChild(item);
    }
  },

  async _showEmailDetail(email) {
    this.resultsBody.innerHTML = '<div style="padding:12px;color:rgba(255,255,255,0.4);">Loading...</div>';

    // Fetch full email body
    const api = window.electronAPI?.gmail;
    let fullEmail = email;
    if (api && email.id) {
      try {
        const result = await api.getMessage(email.id);
        if (result.success) fullEmail = result.data;
      } catch (e) { /* use what we have */ }
    }

    this.resultsBody.innerHTML = '';

    const back = document.createElement('button');
    back.className = 'pe-result-back';
    back.textContent = '← Back to list';
    back.addEventListener('click', () => this._showResults(this._lastContext));
    this.resultsBody.appendChild(back);

    const header = document.createElement('div');
    header.className = 'pe-result-detail-header';
    header.innerHTML = `
      <strong>${this._esc(fullEmail.subject || '(no subject)')}</strong>
      <div>From: ${this._esc(fullEmail.from || '')}${fullEmail.to ? ' → ' + this._esc(fullEmail.to) : ''}</div>
      <div>${this._esc(fullEmail.date || '')}</div>
    `;
    this.resultsBody.appendChild(header);

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'pe-result-detail';
    renderEmailSecure(bodyWrap, fullEmail.body, fullEmail.snippet);
    this.resultsBody.appendChild(bodyWrap);
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
};
