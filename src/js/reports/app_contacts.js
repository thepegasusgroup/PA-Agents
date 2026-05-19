// ── Reports app: Contacts ──
// iOS-style Contacts: a "you" header card (Google profile pic + name) followed
// by an A–Z grouped list of workers. Single view — no tabs. Pipelines are
// no longer surfaced here (they live on desks, not on agents).

// Stable colour palette for sender/worker avatars when no photo is available.
const CONTACTS_AVATAR_COLORS = [
  '#4a90e2', '#e8821a', '#5cb85c', '#9b59b6', '#dc4e41',
  '#16a085', '#e74c3c', '#f39c12', '#2980b9', '#8e44ad',
];

Reports._contactsAvatarColor = function (name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return CONTACTS_AVATAR_COLORS[Math.abs(h) % CONTACTS_AVATAR_COLORS.length];
};

Reports._contactsAvatarInitial = function (name) {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

Reports._renderContacts = async function () {
  this.titleEl.textContent = 'Contacts';

  // ── Build the "you" card from Google userinfo, with graceful fallbacks ──
  // Old tokens (granted before the profile scope was added) won't return
  // name/picture — we fall back to email-only with an initial avatar.
  let me = { name: '', email: '', picture: '' };
  const api = window.electronAPI?.gmail;
  if (api) {
    try {
      const authed = await api.isAuthenticated();
      if (authed) {
        const info = await api.getUserInfo();
        if (info && info.success && info.data) {
          me = info.data;
        } else {
          // Old token without profile scope — fall back to gmail profile email
          const prof = await api.getProfile();
          if (prof && prof.success && prof.data) {
            me.email = prof.data.email || '';
          }
        }
      }
    } catch (e) { /* not authed → show generic card */ }
  }

  // ── Worker list, alphabetised + grouped by first letter ──
  const workers = (AppState.workers || []).slice().sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  const groups = {};
  for (const w of workers) {
    const letter = ((w.name || '?').trim().charAt(0).toUpperCase()) || '#';
    const key = /[A-Z]/.test(letter) ? letter : '#';
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    // '#' bucket always last
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  // ── Render ──
  let html = '<div class="rp-contacts">';

  // "You" card — mirrors how iOS Contacts shows the device owner up top.
  const meName = me.name || me.email || 'Sign in for profile';
  const meSub  = me.name && me.email ? me.email : '';
  const meColor = this._contactsAvatarColor(meName);
  const meInitial = this._contactsAvatarInitial(meName);
  html += '<div class="rp-contacts-me">';
  if (me.picture) {
    html += `<img class="rp-contacts-me-photo" src="${this._esc(me.picture)}" alt="" referrerpolicy="no-referrer">`;
  } else {
    html += `<div class="rp-contacts-me-photo placeholder" style="background:${meColor}">${this._esc(meInitial)}</div>`;
  }
  html += `<div class="rp-contacts-me-info">
      <div class="rp-contacts-me-name">${this._esc(meName)}</div>
      ${meSub ? `<div class="rp-contacts-me-sub">${this._esc(meSub)}</div>` : '<div class="rp-contacts-me-sub muted">My Card</div>'}
    </div>
  </div>`;

  // A–Z grouped worker list
  if (workers.length === 0) {
    html += `<div class="rp-contacts-empty">
      <div class="rp-contacts-empty-title">No contacts</div>
      <div class="rp-contacts-empty-sub">Hire agents from the Staff toolbar to see them here.</div>
    </div>`;
  } else {
    for (const key of sortedKeys) {
      html += `<div class="rp-contacts-section">
        <div class="rp-contacts-section-header">${this._esc(key)}</div>`;
      for (const w of groups[key]) {
        const wt = WorkerTypes[w.type] || {};
        const color = wt.color || this._contactsAvatarColor(w.name || '');
        const initial = this._contactsAvatarInitial(w.name);
        html += `<div class="rp-contacts-row" data-worker-id="${w.id}">
          <div class="rp-contacts-avatar" style="background:${color}">${this._esc(initial)}</div>
          <div class="rp-contacts-row-info">
            <div class="rp-contacts-row-name">${this._esc(w.name || '(unnamed)')}</div>
            <div class="rp-contacts-row-role">${this._esc(wt.name || w.type)}</div>
          </div>
          <span class="rp-contacts-row-chevron">›</span>
        </div>`;
      }
      html += '</div>';
    }
  }

  html += '</div>';
  this.content.innerHTML = html;
};
