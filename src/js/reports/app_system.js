// ── Reports app: Settings ──
// iOS-style settings: profile card at the top (mirrors how real iPhone Settings
// opens), then grouped rows for Connections, Facility, and About. The Gmail
// connection has a tappable detail view with sign-in / sign-out controls.
// State: Reports._settingsView ('main' | 'gmail') is declared in core.js.

// Small monochrome icon library to keep row markup compact.
const SETTINGS_ICONS = {
  gmail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  rooms: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M3 9.5L10 3l7 6.5V20H4z" stroke="#fff" stroke-width="0" fill="#fff"/><path d="M3 9.5L10 3l7 6.5V20H4z" fill="#fff"/></svg>',
  objects: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
  workers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
  log: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM8 12h8v1.5H8zm0 3h8v1.5H8z"/></svg>',
  day: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
};

Reports._renderSettings = function () {
  this.titleEl.textContent = 'Settings';
  if (this._settingsView === 'gmail') {
    this._renderGmailDetail();
  } else {
    this._renderSettingsMain();
  }
};

Reports._renderSettingsMain = async function () {
  const s = AppState;
  const api = window.electronAPI?.gmail;

  // ── Pull Gmail status + user identity ──
  let gmailAuthed = false;
  let me = { name: '', email: '', picture: '' };
  if (api) {
    try {
      gmailAuthed = await api.isAuthenticated();
      if (gmailAuthed) {
        const info = await api.getUserInfo();
        if (info && info.success && info.data) {
          me = info.data;
        } else {
          const prof = await api.getProfile();
          if (prof && prof.success && prof.data) me.email = prof.data.email || '';
        }
      }
    } catch (e) { /* unauthed → render generic card */ }
  }

  const row = (iconBg, iconKey, label, value, valueClass, tappable, action) => {
    const icon = `<div class="settings-row-icon" style="background:${iconBg}">${SETTINGS_ICONS[iconKey] || ''}</div>`;
    const cls = 'settings-row' + (tappable ? ' tappable' : '');
    const ds = tappable ? ` data-setting="${action}"` : '';
    const chev = tappable ? '<span class="settings-chevron">›</span>' : '';
    return `<div class="${cls}"${ds}>${icon}<span class="settings-row-label">${label}</span><span class="settings-row-value ${valueClass || ''}">${value}</span>${chev}</div>`;
  };

  // ── Profile card up top (iOS Settings opens with this) ──
  const meName = me.name || (gmailAuthed ? me.email : 'Sign in to connect');
  const meSub  = me.name && me.email
    ? me.email
    : (gmailAuthed ? 'Tap to manage account' : 'Connect Gmail to read email');
  const initial = (meName.trim().charAt(0) || '?').toUpperCase();
  // Stable colour from name hash so the same person always gets the same chip.
  let h = 0;
  for (let i = 0; i < meName.length; i++) h = (h * 31 + meName.charCodeAt(i)) | 0;
  const palette = ['#4a90e2', '#e8821a', '#5cb85c', '#9b59b6', '#dc4e41', '#16a085', '#f39c12', '#2980b9'];
  const meColor = palette[Math.abs(h) % palette.length];

  const photoEl = me.picture
    ? `<img class="settings-profile-photo" src="${this._esc(me.picture)}" alt="" referrerpolicy="no-referrer">`
    : `<div class="settings-profile-photo placeholder" style="background:${meColor}">${this._esc(initial)}</div>`;

  let html = '<div class="settings-screen">';
  html += `<div class="settings-profile" data-setting="gmail">
    ${photoEl}
    <div class="settings-profile-text">
      <div class="settings-profile-name">${this._esc(meName)}</div>
      <div class="settings-profile-sub">${this._esc(meSub)}</div>
    </div>
    <span class="settings-chevron">›</span>
  </div>`;

  // ── Connections ──
  html += '<div class="settings-section">';
  html += '<div class="settings-section-group">';
  html += row(
    'linear-gradient(135deg, #4a90e2, #2a6ab0)',
    'gmail',
    'Gmail',
    gmailAuthed ? 'Connected' : 'Not connected',
    gmailAuthed ? 'green' : 'muted',
    true,
    'gmail'
  );
  html += '</div>';
  html += '<div class="settings-section-footer">Connect services for your AI agents to use.</div>';
  html += '</div>';

  // ── Facility ──
  html += '<div class="settings-section">';
  html += '<div class="settings-section-header">Facility</div>';
  html += '<div class="settings-section-group">';
  html += row('linear-gradient(135deg, #e8821a, #c06010)', 'day',     'Day',     String(s.facility.day));
  html += row('linear-gradient(135deg, #4a90c4, #2a6ab0)', 'rooms',   'Rooms',   String(s.rooms.length));
  html += row('linear-gradient(135deg, #8e44ad, #6c3483)', 'objects', 'Objects', String(s.objects.length));
  html += row('linear-gradient(135deg, #27ae60, #1e8449)', 'workers', 'Workers', String(s.workers.length));
  html += '</div>';
  html += '</div>';

  // ── About ──
  html += '<div class="settings-section">';
  html += '<div class="settings-section-header">About</div>';
  html += '<div class="settings-section-group">';
  html += row('linear-gradient(135deg, #34495e, #2c3e50)', 'info', 'Version',     '0.1.5');
  html += row('linear-gradient(135deg, #607080, #485868)', 'log',  'Log Entries', `${this._logs.length} / ${this._maxLogs}`);
  html += '</div>';
  html += '</div>';

  // ── Action ──
  html += '<div class="settings-section">';
  html += '<div class="settings-section-group">';
  html += '<div class="settings-row tappable destructive" data-setting="menu"><span class="settings-row-label center">Save &amp; Return to Menu</span></div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  this.content.innerHTML = html;

  // Wire taps
  this.content.querySelectorAll('[data-setting]').forEach(el => {
    el.addEventListener('click', () => {
      const setting = el.dataset.setting;
      if (setting === 'gmail') {
        this._settingsView = 'gmail';
        this._renderSettings();
      } else if (setting === 'menu') {
        this.close();
        if (typeof returnToMenu === 'function') returnToMenu();
      }
    });
  });
};

Reports._renderGmailDetail = async function () {
  const api = window.electronAPI?.gmail;

  let authed = false;
  let me = { name: '', email: '', picture: '' };
  if (api) {
    try {
      authed = await api.isAuthenticated();
      if (authed) {
        const info = await api.getUserInfo();
        if (info && info.success && info.data) {
          me = info.data;
        } else {
          const prof = await api.getProfile();
          if (prof && prof.success && prof.data) me.email = prof.data.email || '';
        }
      }
    } catch (e) { /* keep defaults */ }
  }

  let html = '<div class="settings-screen">';

  html += `<div class="settings-detail-hero">
    <div class="settings-detail-hero-icon" style="background: linear-gradient(135deg, #4a90e2, #2a6ab0);">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
    </div>
    <div class="settings-detail-hero-text">
      <div class="settings-detail-hero-name">Gmail</div>
      <div class="settings-detail-hero-desc">Read and triage email from inside Pegasus</div>
      <div class="settings-detail-hero-status ${authed ? 'green' : 'muted'}">${authed ? '● Connected' : '○ Not connected'}</div>
    </div>
  </div>`;

  if (authed) {
    html += '<div class="settings-section">';
    html += '<div class="settings-section-header">Account</div>';
    html += '<div class="settings-section-group">';
    if (me.name) {
      html += `<div class="settings-row"><span class="settings-row-label">Name</span><span class="settings-row-value">${this._esc(me.name)}</span></div>`;
    }
    html += `<div class="settings-row"><span class="settings-row-label">Email</span><span class="settings-row-value">${this._esc(me.email || 'Unknown')}</span></div>`;
    html += `<div class="settings-row"><span class="settings-row-label">Status</span><span class="settings-row-value green">Active</span></div>`;
    html += '</div>';
    html += '</div>';
    html += `<button class="settings-btn destructive" id="gmailDisconnect">Sign Out</button>`;
  } else {
    html += `<div class="settings-section">
      <div class="settings-section-footer">Sign in with your Google account so AI agents can read and manage your emails. Opens in your default browser.</div>
    </div>`;
    html += `<button class="settings-btn primary" id="gmailConnect">Sign in with Google</button>`;
  }

  html += '</div>';
  this.content.innerHTML = html;

  const connectBtn = document.getElementById('gmailConnect');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Waiting for browser…';
      try {
        const result = await api.startAuth();
        if (result && !result.success) {
          connectBtn.textContent = 'Not configured';
          return;
        }
        this._renderSettings();
      } catch (e) {
        connectBtn.textContent = 'Failed — tap to retry';
        connectBtn.disabled = false;
      }
    });
  }

  const disconnectBtn = document.getElementById('gmailDisconnect');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
      try {
        await api.logout();
        this._emails = [];
        this._renderSettings();
      } catch (e) { /* silent */ }
    });
  }
};
