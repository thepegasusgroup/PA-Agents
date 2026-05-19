// ── Pipeline desk editor ──
// Per-desk node graph: open/close the editor, CRUD nodes & connections,
// render the canvas, handle drag/connect mouse events, edit node params.
// Shared state lives on the Pipeline singleton (declared in core.js):
//   _currentObjId, _selectedNodeId, _draggingNode, _connectingFrom, _dragOffset

Pipeline.openDeskEditor = function (objId) {
  this._currentObjId = objId;
  this._selectedNodeId = null;
  this.configPanel.classList.add('hidden');

  const obj = AppState.objects.find(o => o.id === objId);
  const def = obj ? ObjectDefs[obj.type] : null;
  this.titleEl.textContent = def ? def.name + ' Pipeline' : 'Desk Pipeline';

  this.overlay.classList.remove('hidden');
  this._renderNodes();
  this._renderConnections();
};

Pipeline.closeDeskEditor = function () {
  this.overlay.classList.add('hidden');
  this._currentObjId = null;
  this._selectedNodeId = null;
  this._connectingFrom = null;
};

// ── Node CRUD ──

Pipeline._addNode = function (type, x, y) {
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
};

Pipeline._removeNode = function (nodeId) {
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
};

Pipeline._connectNodes = function (fromId, toId) {
  if (!this._currentObjId) return;
  const pipeline = AppState.getDeskPipeline(this._currentObjId);
  // Don't duplicate
  if (pipeline.connections.some(c => c.fromId === fromId && c.toId === toId)) return;
  // Don't self-connect
  if (fromId === toId) return;
  pipeline.connections.push({ fromId, toId });
  this._renderConnections();
};

// ── Rendering ──

Pipeline._renderNodes = function () {
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
};

Pipeline._renderConnections = function () {
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
};

// ── Node dragging ──

Pipeline._onCanvasMouseDown = function (e) {
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
};

Pipeline._onCanvasMouseMove = function (e) {
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
};

Pipeline._onCanvasMouseUp = function (e) {
  if (this._draggingNode) {
    this._draggingNode = null;
  }
  if (this._connectingFrom !== null) {
    // Check if we landed on an input port (handled by port mouseup)
    // If not, cancel
    setTimeout(() => { this._connectingFrom = null; }, 50);
  }
};

// ── Node config ──

Pipeline._selectNode = function (nodeId) {
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
};
