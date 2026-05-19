// ── Reports app: Workshop ──
// Create, edit, and delete custom AI agents. Two views, tracked on the
// Reports singleton:
//   _workshopView === 'list' → roster of existing custom agents + "+ New"
//   _workshopView === 'edit' → editor form with hero, sections, save/delete
// The phone's top-bar back button handles edit → list → home (wired in core.js).
//
// Persists via AppState.customWorkerTypes (already integrated into save/load).

Reports._workshopView = 'list';
Reports._workshopCurrentId = null; // id when editing existing, null when creating
Reports._workshopDraft = null;     // working copy of the form fields

// Curated icon set the user can pick for the agent's identity badge.
// Names are keys into the global Icons library (icons.js). All stroke-based.
const WORKSHOP_ICONS = ['bot', 'brain', 'cpu', 'spark', 'target', 'eye', 'shield', 'terminal', 'compass', 'trophy', 'lightning'];

// Tasteful 8-colour palette — same colours used elsewhere for stable identity.
const WORKSHOP_COLORS = ['#4a90e2', '#e8821a', '#5cb85c', '#9b59b6', '#dc4e41', '#16a085', '#f39c12', '#2980b9'];

// Sprite options come from the worker-sprite preload list in render_workers.js.
const WORKSHOP_SPRITES = ['teacher', 'accountant', 'doctor', 'chef', 'lawyer', 'shrink'];

// ── Dispatcher entry-point ──

Reports._renderWorkshop = function () {
  this.titleEl.textContent = 'Workshop';
  if (this._workshopView === 'edit') {
    this._renderWorkshopEdit();
  } else {
    this._workshopView = 'list';
    this._renderWorkshopList();
  }
};

// ── List view: roster of custom agents + entry-point to create a new one ──

Reports._renderWorkshopList = function () {
  const customs = Object.values(AppState.customWorkerTypes || {});
  customs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  let html = `<div class="rp-ws">
    <div class="rp-ws-header">
      <div>
        <div class="rp-ws-title">Workshop</div>
        <div class="rp-ws-sub">Design custom AI agents for your facility</div>
      </div>
      <button class="rp-ws-new" id="rpWsNew">${Icons.plus}<span>New</span></button>
    </div>`;

  if (customs.length === 0) {
    html += `<div class="rp-ws-empty">
      <div class="rp-ws-empty-icon">${Icons.bot}</div>
      <div class="rp-ws-empty-title">No custom agents yet</div>
      <div class="rp-ws-empty-sub">Tap <b>New</b> to build your first one. Built-in roles like General Agent still work as normal.</div>
    </div>`;
  } else {
    html += '<div class="rp-ws-list">';
    for (const def of customs) {
      const iconSvg = (Icons[def.icon]) || Icons.bot;
      html += `<div class="rp-ws-item" data-id="${def.id}">
        <div class="rp-ws-item-avatar" style="background:${def.color}">
          <img class="rp-ws-item-sprite" src="assets/textures/workers/${def.sprite}/front.webp" alt="" draggable="false">
        </div>
        <div class="rp-ws-item-body">
          <div class="rp-ws-item-name">${this._esc(def.name)}</div>
          <div class="rp-ws-item-meta">
            <span class="rp-ws-item-badge" style="color:${def.color};">${iconSvg}</span>
            <span class="rp-ws-item-role">${this._esc(def.sprite)} · ${this._esc(def.prefix || '')}</span>
          </div>
        </div>
        <span class="rp-ws-item-chevron">${Icons.chevronRight}</span>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  this.content.innerHTML = html;

  // Wire up taps
  document.getElementById('rpWsNew').addEventListener('click', () => this._workshopOpen(null));
  this.content.querySelectorAll('.rp-ws-item').forEach(el => {
    el.addEventListener('click', () => this._workshopOpen(el.dataset.id));
  });
};

// ── Edit view: form for creating / editing one agent ──

Reports._workshopOpen = function (id) {
  this._workshopCurrentId = id || null;
  if (id && AppState.customWorkerTypes[id]) {
    const def = AppState.customWorkerTypes[id];
    this._workshopDraft = {
      name:         def.name,
      prefix:       def.prefix || '',
      color:        def.color,
      icon:         WORKSHOP_ICONS.includes(def.icon) ? def.icon : 'bot',
      sprite:       WORKSHOP_SPRITES.includes(def.sprite) ? def.sprite : 'teacher',
      systemPrompt: def.systemPrompt || '',
    };
  } else {
    this._workshopDraft = {
      name: '',
      prefix: '',
      color: WORKSHOP_COLORS[0],
      icon: 'bot',
      sprite: 'teacher',
      systemPrompt: '',
    };
  }
  this._workshopView = 'edit';
  this._renderWorkshopEdit();
};

Reports._renderWorkshopEdit = function () {
  const d = this._workshopDraft;
  if (!d) { this._workshopView = 'list'; this._renderWorkshopList(); return; }

  this._renderWorkshopHero();
  // Build the rest of the form structure once, then render each interactive piece.
  this.content.innerHTML = `
    <div class="rp-ws-edit">
      <div class="rp-ws-hero" id="rpWsHero"></div>

      <div class="rp-ws-section">
        <div class="rp-ws-section-header">Identity</div>
        <div class="rp-ws-section-card" id="rpWsIdentity"></div>
      </div>

      <div class="rp-ws-section">
        <div class="rp-ws-section-header">Appearance</div>
        <div class="rp-ws-section-card">
          <div class="rp-ws-row rp-ws-row-stack">
            <span class="rp-ws-row-label">Colour</span>
            <div class="rp-ws-colors" id="rpWsColors"></div>
          </div>
          <div class="rp-ws-row rp-ws-row-stack">
            <span class="rp-ws-row-label">Icon</span>
            <div class="rp-ws-icons" id="rpWsIcons"></div>
          </div>
          <div class="rp-ws-row rp-ws-row-stack">
            <span class="rp-ws-row-label">In-World Model</span>
            <div class="rp-ws-sprites" id="rpWsSprites"></div>
          </div>
        </div>
      </div>

      <div class="rp-ws-section">
        <div class="rp-ws-section-header">AI Behaviour</div>
        <div class="rp-ws-section-card rp-ws-prompt-card">
          <textarea id="rpWsPrompt" class="rp-ws-textarea" rows="5"
                    placeholder="You are a helpful research analyst. Summarise the user's emails…">${this._esc(d.systemPrompt)}</textarea>
        </div>
        <div class="rp-ws-section-footer">Used as the system prompt when this agent runs a pipeline.</div>
      </div>

      <button class="rp-ws-save" id="rpWsSave">${this._workshopCurrentId ? 'Save Changes' : 'Create Agent'}</button>
      ${this._workshopCurrentId
        ? '<button class="rp-ws-delete" id="rpWsDelete">Delete Agent</button>'
        : ''}
    </div>
  `;

  // Now render each interactive piece into its slot
  this._renderWorkshopHero();
  this._renderWorkshopIdentity();
  this._renderWorkshopColors();
  this._renderWorkshopIcons();
  this._renderWorkshopSprites();

  document.getElementById('rpWsPrompt').addEventListener('input', (e) => {
    d.systemPrompt = e.target.value;
  });
  document.getElementById('rpWsSave').addEventListener('click', () => this._workshopSave());
  const delBtn = document.getElementById('rpWsDelete');
  if (delBtn) delBtn.addEventListener('click', () => this._workshopDelete());

  // Auto-focus name when creating new
  if (!this._workshopCurrentId) {
    setTimeout(() => {
      const n = document.getElementById('rpWsName');
      if (n) n.focus();
    }, 60);
  }
};

Reports._renderWorkshopHero = function () {
  const d = this._workshopDraft;
  const el = document.getElementById('rpWsHero');
  if (!d || !el) return;
  el.innerHTML = `
    <div class="rp-ws-hero-avatar" style="background:${d.color}">
      <img class="rp-ws-hero-sprite" src="assets/textures/workers/${d.sprite}/front.webp" alt="" draggable="false">
    </div>
    <div class="rp-ws-hero-name">${this._esc(d.name || 'Unnamed Agent')}</div>
    <div class="rp-ws-hero-role">Custom AI Agent · ${this._esc(d.sprite)}</div>
  `;
};

Reports._renderWorkshopIdentity = function () {
  const d = this._workshopDraft;
  const el = document.getElementById('rpWsIdentity');
  if (!el) return;
  el.innerHTML = `
    <div class="rp-ws-row">
      <span class="rp-ws-row-label">Name</span>
      <input id="rpWsName" class="rp-ws-row-input" type="text" maxlength="40"
             placeholder="e.g. Research Analyst" value="${this._esc(d.name)}">
    </div>
    <div class="rp-ws-row">
      <span class="rp-ws-row-label">Prefix</span>
      <input id="rpWsPrefix" class="rp-ws-row-input" type="text" maxlength="6"
             placeholder="auto" value="${this._esc(d.prefix)}">
    </div>
  `;
  document.getElementById('rpWsName').addEventListener('input', (e) => {
    d.name = e.target.value;
    this._renderWorkshopHero();
  });
  document.getElementById('rpWsPrefix').addEventListener('input', (e) => {
    d.prefix = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
  });
};

Reports._renderWorkshopColors = function () {
  const d = this._workshopDraft;
  const el = document.getElementById('rpWsColors');
  if (!el) return;
  el.innerHTML = WORKSHOP_COLORS.map(c =>
    `<button class="rp-ws-color${c === d.color ? ' active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
  ).join('');
  el.querySelectorAll('.rp-ws-color').forEach(btn => {
    btn.addEventListener('click', () => {
      d.color = btn.dataset.color;
      this._renderWorkshopHero();
      this._renderWorkshopColors();
    });
  });
};

Reports._renderWorkshopIcons = function () {
  const d = this._workshopDraft;
  const el = document.getElementById('rpWsIcons');
  if (!el) return;
  el.innerHTML = WORKSHOP_ICONS.map(name =>
    `<button class="rp-ws-icon${name === d.icon ? ' active' : ''}" data-icon="${name}" title="${name}">${Icons[name] || ''}</button>`
  ).join('');
  el.querySelectorAll('.rp-ws-icon').forEach(btn => {
    btn.addEventListener('click', () => {
      d.icon = btn.dataset.icon;
      this._renderWorkshopIcons();
    });
  });
};

Reports._renderWorkshopSprites = function () {
  const d = this._workshopDraft;
  const el = document.getElementById('rpWsSprites');
  if (!el) return;
  el.innerHTML = WORKSHOP_SPRITES.map(sp =>
    `<button class="rp-ws-sprite${sp === d.sprite ? ' active' : ''}" data-sprite="${sp}" title="${sp}">
      <img src="assets/textures/workers/${sp}/front.webp" alt="${sp}" draggable="false">
      <span class="rp-ws-sprite-label">${sp}</span>
    </button>`
  ).join('');
  el.querySelectorAll('.rp-ws-sprite').forEach(btn => {
    btn.addEventListener('click', () => {
      d.sprite = btn.dataset.sprite;
      this._renderWorkshopHero();
      this._renderWorkshopSprites();
    });
  });
};

// ── Actions ──

Reports._workshopSave = function () {
  const d = this._workshopDraft;
  if (!d) return;
  const name = (d.name || '').trim();
  if (!name) {
    const n = document.getElementById('rpWsName');
    n?.focus();
    n?.classList.add('invalid');
    setTimeout(() => n?.classList.remove('invalid'), 1000);
    return;
  }

  let prefix = (d.prefix || '').trim();
  if (!prefix) prefix = name.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase();

  const id = this._workshopCurrentId || ('custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
  AppState.addCustomWorkerType({
    id,
    name,
    prefix,
    color: d.color,
    icon: d.icon || 'bot',
    sprite: d.sprite,
    category: 'AI Agents',
    role: 'operational',
    gender: 'male',
    systemPrompt: d.systemPrompt || '',
    isCustom: true,
  });

  this._workshopView = 'list';
  this._workshopCurrentId = null;
  this._workshopDraft = null;
  this._renderWorkshopList();

  // Re-render the staff toolbar so the new/changed agent shows up immediately.
  if (AppState.tools.activeCategory === 'staff' && typeof Toolbar !== 'undefined') {
    Toolbar.openCategory('staff');
  }
};

Reports._workshopDelete = function () {
  if (!this._workshopCurrentId) return;
  if (!confirm('Delete this custom agent? Existing workers of this type will be dismissed.')) return;
  AppState.removeCustomWorkerType(this._workshopCurrentId);
  if (typeof AppState._normalizeWorkersAndRooms === 'function') {
    AppState._normalizeWorkersAndRooms();
  }
  this._workshopView = 'list';
  this._workshopCurrentId = null;
  this._workshopDraft = null;
  this._renderWorkshopList();
  if (AppState.tools.activeCategory === 'staff' && typeof Toolbar !== 'undefined') {
    Toolbar.openCategory('staff');
  }
};
