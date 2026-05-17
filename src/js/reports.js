// ── Radio Stations ──
const RADIO_STATIONS = [
  { name: 'Groove Salad',       genre: 'Lo-fi / Chill',       url: 'https://ice5.somafm.com/groovesalad-128-mp3', img: 'https://api.somafm.com/logos/256/groovesalad256.png' },
  { name: 'Fluid',              genre: 'Lo-fi / Chill',       url: 'https://ice5.somafm.com/fluid-128-mp3', img: 'https://api.somafm.com/logos/256/fluid256.jpg' },
  { name: 'Nightwave Plaza',    genre: 'Vaporwave',           url: 'https://radio.plaza.one/mp3', img: 'https://play-lh.googleusercontent.com/yQ5dsEFxa285b-uFOTkjwRjpuu-wdbSKLJbWrU-PtYNAOtNB7zuCIB1fAub_6Y8w8LU=s256' },
  { name: 'Sonic Universe',     genre: 'Jazz',                url: 'https://ice5.somafm.com/sonicuniverse-256-mp3', img: 'https://api.somafm.com/logos/256/sonicuniverse256.png' },
  { name: 'VPR Classical',      genre: 'Classical',           url: 'https://vprclassical.streamguys1.com/vprclassical128.mp3', img: 'https://www.vermontpublic.org/apple-touch-icon.png' },
  { name: 'WWFM Classical',     genre: 'Classical',           url: 'https://wwfm.streamguys1.com/live-mp3', img: 'https://cdn-profiles.tunein.com/s23730/images/logog.jpg' },
  { name: 'Drone Zone',         genre: 'Ambient',             url: 'https://ice5.somafm.com/dronezone-256-mp3', img: 'https://api.somafm.com/logos/256/dronezone256.png' },
  { name: 'n5MD Radio',         genre: 'Ambient / IDM',       url: 'https://ice5.somafm.com/n5md-128-mp3', img: 'https://api.somafm.com/logos/256/n5md256.png' },
  { name: 'Indie Pop Rocks!',   genre: 'Indie / Alt',         url: 'https://ice5.somafm.com/indiepop-128-mp3', img: 'https://api.somafm.com/logos/256/indiepop256.png' },
  { name: 'KEXP 90.3',          genre: 'Indie / Eclectic',    url: 'https://kexp.streamguys1.com/kexp160.aac', img: 'https://cdn-profiles.tunein.com/s32537/images/logog.png' },
  { name: 'BBC World Service',  genre: 'News',                url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_world_service', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/BBC_World_Service_2022_%28Boxed%29.svg/250px-BBC_World_Service_2022_%28Boxed%29.svg.png' },
  { name: 'DEF CON Radio',      genre: 'Hacker / Electronic', url: 'https://ice5.somafm.com/defcon-128-mp3', img: 'https://api.somafm.com/logos/256/defcon256.png' },
];

// SVG icons for radio controls
const RadioIcons = {
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>',
  pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>',
  prev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="3" height="16"/></svg>',
  next: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,4 15,12 5,20"/><rect x="16" y="4" width="3" height="16"/></svg>',
  volLow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>',
  volHigh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>',
  volMute: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
};

// ── Reports Phone UI ──

const Reports = {
  _logs: [],
  _emails: [],
  _activeApp: null,   // null = homescreen, 'comms'|'agents'|'logs'|'system'|'radio'
  _commsTab: 'emails', // 'emails' or 'review'
  _agentsTab: 'workers', // 'workers' or 'pipelines'
  _maxLogs: 500,
  _radio: { audio: null, playing: false, stationIdx: -1 },

  init() {
    this.overlay = document.getElementById('reportsOverlay');
    this.screen = this.overlay.querySelector('.rp-screen');
    this.homescreen = this.overlay.querySelector('.rp-homescreen');
    this.appview = this.overlay.querySelector('.rp-appview');
    this.content = this.overlay.querySelector('.rp-content');
    this.titleEl = this.overlay.querySelector('.rp-title');
    this.statusTime = this.overlay.querySelector('.rp-statusbar-time');

    // App icon clicks
    this.overlay.querySelectorAll('.rp-app').forEach(app => {
      app.addEventListener('click', () => {
        this._openApp(app.dataset.app);
      });
    });

    // Back button
    this.overlay.querySelector('.rp-back').addEventListener('click', () => {
      this._goHome();
    });

    // Home bar click
    this.overlay.querySelector('.rp-homebar').addEventListener('click', () => {
      if (this._activeApp) this._goHome();
      else this.close();
    });

    // ── Close-on-outside-click ──
    // Any mousedown inside the phone panel stops propagation so the document
    // handler below never sees it. This is immune to innerHTML re-renders that
    // orphan the e.target node (which breaks .contains() checks).
    this.overlay.querySelector('.reports-panel').addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    // Clicks that reach document are guaranteed to be outside the phone panel.
    document.addEventListener('mousedown', (e) => {
      if (!this.isOpen()) return;
      // Don't close if clicking the phone toolbar button itself (it toggles)
      if (e.target.closest('[data-category="reports"]')) return;
      this.close();
    });

    // Clear button
    const clearBtn = this.overlay.querySelector('.rp-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (this._activeApp === 'logs') {
          this._logs = [];
          this._renderApp();
        } else if (this._activeApp === 'comms' && this._commsTab === 'emails') {
          this._emails = [];
          this._renderApp();
        }
      });
    }

    // Status bar clock
    this._updateClock();
    setInterval(() => this._updateClock(), 30000);

    // Log the startup
    this.log('system', 'PA-Agents started');
  },

  _updateClock() {
    if (!this.statusTime) return;
    const s = AppState.facility;
    const hours = Math.floor(s.time / 60) % 24;
    const mins = Math.floor(s.time % 60);
    this.statusTime.textContent = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  },

  open() {
    this.overlay.classList.remove('hidden');
    this._updateClock();
    if (this._activeApp) this._renderApp();
  },

  close() {
    this.overlay.classList.add('hidden');
  },

  isOpen() {
    return this.overlay ? !this.overlay.classList.contains('hidden') : false;
  },

  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  },

  // ── Navigation ──

  _openApp(appName) {
    this._activeApp = appName;
    this.homescreen.classList.add('hidden');
    this.appview.classList.remove('hidden');
    this._renderApp();
  },

  _goHome() {
    this._activeApp = null;
    this.appview.classList.add('hidden');
    this.homescreen.classList.remove('hidden');
  },

  // ── Logging API ──

  log(source, message, level) {
    const entry = {
      time: new Date(),
      source: source,
      message: message,
      level: level || 'info',
    };
    this._logs.unshift(entry);
    if (this._logs.length > this._maxLogs) this._logs.pop();

    if (this.isOpen() && this._activeApp === 'logs') {
      this._renderApp();
    }
  },

  setEmails(emails) {
    this._emails = emails || [];
    if (this.isOpen() && this._activeApp === 'comms' && this._commsTab === 'emails') {
      this._renderApp();
    }
  },

  // ── App Rendering ──

  _renderApp() {
    switch (this._activeApp) {
      case 'comms': this._renderComms(); break;
      case 'agents': this._renderAgents(); break;
      case 'logs': this._renderLogs(); break;
      case 'system': this._renderSystem(); break;
      case 'connections': this._renderConnections(); break;
      case 'radio': this._renderRadio(); break;
    }
  },

  _renderComms() {
    const titles = { emails: 'Emails', review: 'Review' };
    this.titleEl.textContent = 'Comms';

    // Sub-tabs for comms
    let html = `<div class="rp-subtabs">
      <button class="rp-subtab ${this._commsTab === 'emails' ? 'active' : ''}" data-sub="emails">Emails</button>
      <button class="rp-subtab ${this._commsTab === 'review' ? 'active' : ''}" data-sub="review">Review</button>
    </div>`;

    this.content.innerHTML = html;

    const tabContent = document.createElement('div');
    tabContent.className = 'rp-tab-content';
    this.content.appendChild(tabContent);

    // Wire sub-tabs
    this.content.querySelectorAll('.rp-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._commsTab = btn.dataset.sub;
        this._renderComms();
      });
    });

    if (this._commsTab === 'emails') {
      this._renderEmailsInto(tabContent);
    } else {
      this._renderReviewInto(tabContent);
    }
  },

  _renderAgents() {
    this.titleEl.textContent = 'Agents';

    let html = `<div class="rp-subtabs">
      <button class="rp-subtab ${this._agentsTab === 'workers' ? 'active' : ''}" data-sub="workers">Workers</button>
      <button class="rp-subtab ${this._agentsTab === 'pipelines' ? 'active' : ''}" data-sub="pipelines">Pipelines</button>
    </div>`;

    this.content.innerHTML = html;

    const tabContent = document.createElement('div');
    tabContent.className = 'rp-tab-content';
    this.content.appendChild(tabContent);

    this.content.querySelectorAll('.rp-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._agentsTab = btn.dataset.sub;
        this._renderAgents();
      });
    });

    if (this._agentsTab === 'workers') {
      this._renderWorkersInto(tabContent);
    } else {
      this._renderPipelinesInto(tabContent);
    }
  },

  _renderLogs() {
    this.titleEl.textContent = 'Logs';

    if (this._logs.length === 0) {
      this.content.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">📋</div>No log entries yet</div>';
      return;
    }

    let html = '';
    for (const entry of this._logs) {
      const t = entry.time;
      const timeStr = String(t.getHours()).padStart(2, '0') + ':' +
                      String(t.getMinutes()).padStart(2, '0') + ':' +
                      String(t.getSeconds()).padStart(2, '0');

      const icons = { gmail: '📨', pipeline: '⚙️', worker: '👤', system: '🖥️' };
      const icon = icons[entry.source] || '📋';
      const levelClass = entry.level === 'error' ? ' error' : entry.level === 'warning' ? ' warning' : '';

      html += `<div class="rp-log-entry${levelClass}">
        <span class="rp-log-time">${timeStr}</span>
        <span class="rp-log-icon">${icon}</span>
        <span class="rp-log-source ${entry.source}">${entry.source}</span>
        <span class="rp-log-msg">${this._esc(entry.message)}</span>
      </div>`;
    }
    this.content.innerHTML = html;
  },

  _renderSystem() {
    this.titleEl.textContent = 'System';
    const s = AppState;
    const row = (label, value) => `<div class="rp-sys-row"><span class="rp-sys-label">${label}</span><span class="rp-sys-value">${value}</span></div>`;
    const html = `<div class="rp-sys-table">
      ${row('Grid Size', s.grid.width + ' x ' + s.grid.height)}
      ${row('Rooms', s.rooms.length)}
      ${row('Objects', s.objects.length)}
      ${row('Workers', s.workers.length)}
      ${row('Pipelines', Object.keys(s.pipelines).length)}
      ${row('Day', s.facility.day)}
      ${row('Speed', ['Paused', '1x', '2x', '3x'][s.facility.speed])}
      ${row('Log Entries', this._logs.length + ' / ' + this._maxLogs)}
    </div>`;
    this.content.innerHTML = html;
  },

  // ── Sub-renderers ──

  async _renderEmailsInto(container) {
    const api = window.electronAPI?.gmail;

    // Check auth state and show sign-in if needed
    if (api && this._emails.length === 0) {
      const authed = await api.isAuthenticated();
      if (!authed) {
        container.innerHTML = `<div class="rp-empty">
          <div class="rp-empty-icon">📨</div>
          <div style="margin-bottom:12px;">Connect your Gmail to view emails</div>
          <button id="rpGmailSignIn" style="
            background: linear-gradient(135deg, #dc4e41, #c0392b);
            color: #fff; border: none; padding: 10px 20px;
            border-radius: 6px; font-size: 13px; font-weight: 600;
            cursor: pointer; font-family: inherit;
          ">Sign in with Gmail</button>
        </div>`;
        document.getElementById('rpGmailSignIn').addEventListener('click', async () => {
          container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">⏳</div>Waiting for authentication...</div>';
          try {
            await api.startAuth();
            // Auth complete — fetch emails
            const result = await api.listMessages(20);
            if (result.success) {
              this._emails = result.data;
            }
            this._renderComms();
          } catch (e) {
            container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">❌</div>Auth failed: ' + this._esc(e.message) + '</div>';
          }
        });
        return;
      }

      // Authenticated but no emails loaded yet — fetch them
      container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">⏳</div>Loading emails...</div>';
      try {
        const result = await api.listMessages(20);
        if (result.success) {
          this._emails = result.data;
        }
      } catch (e) { /* will show empty state */ }
    }

    if (this._emails.length === 0) {
      container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">📨</div>No emails fetched yet</div>';
      return;
    }

    let html = '';
    for (const email of this._emails) {
      let fromDisplay = email.from || '';
      const nameMatch = fromDisplay.match(/^"?([^"<]+)"?\s*</);
      if (nameMatch) fromDisplay = nameMatch[1].trim();
      if (fromDisplay.length > 20) fromDisplay = fromDisplay.substring(0, 18) + '…';

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
        } catch (e) { shortDate = ''; }
      }

      const unreadClass = email.unread ? ' unread' : '';
      html += `<div class="rp-email-item${unreadClass}" data-email-id="${email.id}">
        <span class="rp-email-from">${this._esc(fromDisplay)}<span class="rp-email-date">${this._esc(shortDate)}</span></span>
        <span class="rp-email-subject">${this._esc(email.subject || '(no subject)')}</span>
      </div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.rp-email-item').forEach(el => {
      el.addEventListener('click', () => this._openEmail(el.dataset.emailId));
    });
  },

  async _openEmail(emailId) {
    this.content.innerHTML = '<div class="rp-empty">Loading...</div>';

    const api = window.electronAPI?.gmail;
    if (!api) return;

    try {
      const result = await api.getMessage(emailId);
      if (!result.success) {
        this.content.innerHTML = '<div class="rp-empty">Failed to load email</div>';
        return;
      }

      const email = result.data;
      let html = `<button class="pe-result-back" id="rpEmailBack">← Back to list</button>`;
      html += `<div class="pe-result-detail-header">
        <strong>${this._esc(email.subject || '(no subject)')}</strong>
        <div>From: ${this._esc(email.from || '')}${email.to ? ' → ' + this._esc(email.to) : ''}</div>
        <div>${this._esc(email.date || '')}</div>
      </div>`;

      this.content.innerHTML = html;
      document.getElementById('rpEmailBack').addEventListener('click', () => this._renderComms());

      const bodyContainer = document.createElement('div');
      bodyContainer.className = 'pe-result-detail';
      renderEmailSecure(bodyContainer, email.body, email.snippet);
      this.content.appendChild(bodyContainer);
    } catch (e) {
      this.content.innerHTML = '<div class="rp-empty">Error: ' + this._esc(e.message) + '</div>';
    }
  },

  _renderWorkersInto(container) {
    const workers = AppState.workers;
    if (workers.length === 0) {
      container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">👤</div>No workers hired yet</div>';
      return;
    }

    let html = '';
    for (const w of workers) {
      const wt = WorkerTypes[w.type] || {};
      const room = AppState.rooms.find(r => r.id === w.roomId);
      const roomDef = room ? (RoomDefs[room.type] || {}) : {};

      html += `<div class="rp-worker-item">
        <div class="rp-worker-dot" style="background:${w.color}"></div>
        <span class="rp-worker-name">${this._esc(w.name)}</span>
        <span class="rp-worker-type">${this._esc(wt.name || w.type)}</span>
        <span class="rp-worker-state ${w.state}">${w.state}</span>
      </div>`;
    }
    container.innerHTML = html;
  },

  _renderPipelinesInto(container) {
    const pipelineIds = Object.keys(AppState.pipelines);
    if (pipelineIds.length === 0) {
      container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">⚙️</div>No pipelines configured</div>';
      return;
    }

    let html = '';
    for (const objId of pipelineIds) {
      const pip = AppState.pipelines[objId];
      if (!pip || pip.nodes.length === 0) continue;

      const obj = AppState.objects.find(o => o.id === parseInt(objId));
      const objDef = obj ? (ObjectDefs[obj.type] || {}) : {};

      let nodesHtml = '';
      for (const node of pip.nodes) {
        const nt = NodeTypes[node.type] || {};
        nodesHtml += `<span class="rp-pipeline-node-chip" style="background:${nt.color || '#666'}">${nt.icon || ''} ${this._esc(node.label)}</span>`;
      }

      html += `<div class="rp-pipeline-item">
        <div class="rp-pipeline-name">${this._esc(objDef.name || 'Desk')} #${objId}</div>
        <div class="rp-pipeline-info">${pip.nodes.length} nodes • ${pip.connections.length} connections</div>
        <div class="rp-pipeline-nodes">${nodesHtml}</div>
      </div>`;
    }

    if (!html) {
      container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">⚙️</div>No pipelines configured</div>';
      return;
    }
    container.innerHTML = html;
  },

  _renderReviewInto(container) {
    this._updateReviewBadge();
    const queue = AppState._hitlQueue || [];

    if (queue.length === 0) {
      container.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">✅</div>All caught up!</div>';
      return;
    }

    const memory = AppState._workerMemory || [];

    let html = `<div class="rp-review-intro">
      AI classified these — confirm or correct.
      <span style="color:#aaa;margin-left:4px;">(${memory.length} learned)</span>
    </div>`;

    for (const item of queue) {
      const aiSays = item.classification || item.action || 'unknown';
      const badgeColor = aiSays.includes('spam') ? '#dc4e41' :
                         aiSays.includes('important') ? '#e8821a' :
                         aiSays.includes('routine') ? '#5cb85c' : '#4a90c4';

      let fromDisplay = item.from || '';
      const nameMatch = fromDisplay.match(/^"?([^"<]+)"?\s*</);
      if (nameMatch) fromDisplay = nameMatch[1].trim();

      html += `<div class="rp-review-item" data-email-id="${item.id}">
        <div class="rp-review-email-info">
          <div class="rp-review-from">${this._esc(fromDisplay)}</div>
          <div class="rp-review-subject">${this._esc(item.subject || '(no subject)')}</div>
        </div>
        <div class="rp-review-decision">
          <div class="rp-review-ai-says">AI: <span class="rp-review-badge" style="background:${badgeColor}">${this._esc(aiSays)}</span></div>
          <div class="rp-review-actions">
            <button class="rp-review-approve" data-id="${item.id}">👍</button>
            <button class="rp-review-correct" data-id="${item.id}" data-correct="important">Imp</button>
            <button class="rp-review-correct" data-id="${item.id}" data-correct="routine">Rtn</button>
            <button class="rp-review-correct" data-id="${item.id}" data-correct="spam">Spam</button>
          </div>
        </div>
      </div>`;
    }

    container.innerHTML = html;

    container.querySelectorAll('.rp-review-approve').forEach(btn => {
      btn.addEventListener('click', () => {
        Pipeline.approveDecision(btn.dataset.id);
        this._renderComms();
      });
    });
    container.querySelectorAll('.rp-review-correct').forEach(btn => {
      btn.addEventListener('click', () => {
        Pipeline.correctDecision(btn.dataset.id, btn.dataset.correct);
        this._renderComms();
      });
    });
  },

  // ── HITL API ──

  showHITL(queue) {
    this._activeApp = 'comms';
    this._commsTab = 'review';
    this.homescreen.classList.add('hidden');
    this.appview.classList.remove('hidden');
    this._renderComms();
  },

  _updateReviewBadge() {
    const badge = document.getElementById('rpReviewBadge');
    if (!badge) return;
    const count = (AppState._hitlQueue || []).length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  },

  // ── Radio App ──

  _renderRadio() {
    this.titleEl.textContent = 'Radio';
    const r = this._radio;
    const currentStation = r.stationIdx >= 0 ? RADIO_STATIONS[r.stationIdx] : null;
    const vol = r.audio ? r.audio.volume : 0.5;

    // Now playing card
    let nowPlaying = '';
    if (currentStation) {
      const artSrc = currentStation.img;
      const artEl = artSrc
        ? `<img class="radio-np-art" src="${artSrc}" alt="">`
        : `<div class="radio-np-art radio-np-art-placeholder">${RadioIcons.volHigh}</div>`;

      nowPlaying = `
        <div class="radio-now-playing">
          <div class="radio-np-top">
            ${artEl}
            <div class="radio-np-info">
              <div class="radio-np-name">${this._esc(currentStation.name)}</div>
              <div class="radio-np-genre">${this._esc(currentStation.genre)}</div>
              <div class="radio-np-live">${r.playing ? '<span class="radio-live-dot"></span> LIVE' : 'PAUSED'}</div>
            </div>
          </div>
          <div class="radio-np-controls">
            <button class="radio-btn radio-prev" title="Previous">${RadioIcons.prev}</button>
            <button class="radio-btn radio-toggle" title="${r.playing ? 'Pause' : 'Play'}">${r.playing ? RadioIcons.pause : RadioIcons.play}</button>
            <button class="radio-btn radio-next" title="Next">${RadioIcons.next}</button>
          </div>
          <div class="radio-volume">
            <span class="radio-vol-icon">${vol === 0 ? RadioIcons.volMute : vol < 0.5 ? RadioIcons.volLow : RadioIcons.volHigh}</span>
            <input type="range" class="radio-vol-slider" min="0" max="100" value="${Math.round(vol * 100)}">
          </div>
        </div>`;
    } else {
      nowPlaying = `
        <div class="radio-now-playing radio-np-empty">
          <div class="radio-np-art radio-np-art-placeholder">${RadioIcons.play}</div>
          <div class="radio-np-info">
            <div class="radio-np-name">Select a station</div>
            <div class="radio-np-genre">Tap below to start listening</div>
          </div>
        </div>`;
    }

    // Station list
    let stationList = '';
    let lastGenre = '';
    for (let i = 0; i < RADIO_STATIONS.length; i++) {
      const s = RADIO_STATIONS[i];
      if (s.genre !== lastGenre) {
        stationList += `<div class="radio-genre-header">${this._esc(s.genre)}</div>`;
        lastGenre = s.genre;
      }
      const isActive = i === r.stationIdx;
      const stationArt = s.img
        ? `<img class="radio-station-art" src="${s.img}" alt="">`
        : `<div class="radio-station-art radio-station-art-placeholder"></div>`;

      stationList += `<div class="radio-station ${isActive ? 'active' : ''}" data-idx="${i}">
        ${stationArt}
        <div class="radio-station-info">
          <span class="radio-station-name">${this._esc(s.name)}</span>
          <span class="radio-station-genre">${this._esc(s.genre)}</span>
        </div>
        ${isActive && r.playing ? '<span class="radio-eq"><span></span><span></span><span></span></span>' : ''}
      </div>`;
    }

    this.content.innerHTML = nowPlaying + `<div class="radio-list">${stationList}</div>`;

    // Wire events
    this.content.querySelectorAll('.radio-station').forEach(el => {
      el.addEventListener('click', () => {
        this._radioPlay(parseInt(el.dataset.idx));
      });
    });

    const toggleBtn = this.content.querySelector('.radio-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (r.playing) this._radioPause();
        else if (r.stationIdx >= 0) this._radioResume();
      });
    }

    const prevBtn = this.content.querySelector('.radio-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this._radioPlay((r.stationIdx - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length);
      });
    }

    const nextBtn = this.content.querySelector('.radio-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this._radioPlay((r.stationIdx + 1) % RADIO_STATIONS.length);
      });
    }

    // Volume slider
    const volSlider = this.content.querySelector('.radio-vol-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value) / 100;
        if (r.audio) r.audio.volume = v;
        // Update icon without full re-render
        const iconEl = this.content.querySelector('.radio-vol-icon');
        if (iconEl) iconEl.innerHTML = v === 0 ? RadioIcons.volMute : v < 0.5 ? RadioIcons.volLow : RadioIcons.volHigh;
      });
    }
  },

  _radioPlay(idx) {
    const r = this._radio;
    const prevVol = r.audio ? r.audio.volume : 0.5;
    if (r.audio) { r.audio.pause(); r.audio.src = ''; }
    r.stationIdx = idx;
    r.audio = new Audio(RADIO_STATIONS[idx].url);
    r.audio.crossOrigin = 'anonymous';
    r.audio.volume = prevVol;
    r.audio.play().then(() => {
      r.playing = true;
      if (this._activeApp === 'radio') this._renderRadio();
    }).catch(() => {
      r.playing = false;
      if (this._activeApp === 'radio') this._renderRadio();
    });
    r.playing = true;
    this._renderRadio();
  },

  _radioPause() {
    const r = this._radio;
    if (r.audio) r.audio.pause();
    r.playing = false;
    this._renderRadio();
  },

  _radioResume() {
    const r = this._radio;
    if (r.audio) {
      r.audio.play().catch(() => {});
      r.playing = true;
    }
    this._renderRadio();
  },

  // ── Connections App ──

  async _renderConnections() {
    this.titleEl.textContent = 'Connections';
    const api = window.electronAPI?.gmail;

    // Check Gmail auth status
    let gmailAuthed = false;
    let gmailEmail = '';
    if (api) {
      try {
        gmailAuthed = await api.isAuthenticated();
        if (gmailAuthed) {
          const profile = await api.getProfile();
          if (profile.success) gmailEmail = profile.data.email || '';
        }
      } catch (e) { /* silent */ }
    }

    let html = '<div class="conn-list">';

    // ── Gmail ──
    html += `<div class="conn-item">
      <div class="conn-icon" style="background: linear-gradient(135deg, #dc4e41, #c0392b);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
      </div>
      <div class="conn-info">
        <div class="conn-name">Gmail</div>`;

    if (gmailAuthed) {
      html += `<div class="conn-status connected">Connected</div>`;
      if (gmailEmail) html += `<div class="conn-email">${this._esc(gmailEmail)}</div>`;
      html += `</div><button class="conn-action disconnect" id="connGmailDisconnect">Disconnect</button>`;
    } else {
      html += `<div class="conn-status disconnected">Not connected</div>`;
      html += `</div><button class="conn-action setup" id="connGmailSetup">Setup</button>`;
    }

    html += `</div>`;

    // ── Future connections placeholder ──
    html += `<div class="conn-coming-soon">More integrations coming soon</div>`;
    html += '</div>';

    this.content.innerHTML = html;

    // Wire buttons
    const setupBtn = document.getElementById('connGmailSetup');
    if (setupBtn) {
      setupBtn.addEventListener('click', async () => {
        setupBtn.disabled = true;
        setupBtn.textContent = 'Connecting...';
        try {
          const result = await api.startAuth();
          if (result && !result.success) {
            setupBtn.textContent = 'Not configured';
            setupBtn.disabled = true;
            return;
          }
          this._renderConnections();
        } catch (e) {
          setupBtn.textContent = 'Failed';
          setTimeout(() => { setupBtn.textContent = 'Setup'; setupBtn.disabled = false; }, 2000);
        }
      });
    }

    const disconnectBtn = document.getElementById('connGmailDisconnect');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', async () => {
        try {
          await api.logout();
          this._emails = [];
          this._renderConnections();
        } catch (e) { /* silent */ }
      });
    }
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};
