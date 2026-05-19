// ── Reports app: Mail ──
// Gmail-style inbox + single-email viewer. Two views, controlled by
// Reports._mailView ('inbox' | 'detail') and Reports._mailCurrentId.
// Back navigation: the phone's top-bar back button (handled in core.js)
// returns from 'detail' → 'inbox', and from 'inbox' → home screen.
// Public entry-points: Reports.setEmails(emails), Reports.showHITL(queue).

// Stable colour palette for sender avatars — hash of sender → one of these.
const MAIL_AVATAR_COLORS = [
  '#4a90e2', '#e8821a', '#5cb85c', '#9b59b6', '#dc4e41',
  '#16a085', '#e74c3c', '#f39c12', '#2980b9', '#8e44ad',
];

// ── Helpers ──

// Strip "Name <email@host>" wrapping; fall back to raw if no angle brackets.
Reports._mailSenderName = function (from) {
  const raw = from || '';
  const nameMatch = raw.match(/^"?([^"<]+)"?\s*</);
  return nameMatch ? nameMatch[1].trim() : raw;
};

// Extract just the address part (or empty if not parseable).
Reports._mailSenderAddress = function (from) {
  const raw = from || '';
  const m = raw.match(/<([^>]+)>/);
  return m ? m[1].trim() : '';
};

// Deterministic color per sender so the same person always has the same chip.
Reports._mailAvatarColor = function (name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return MAIL_AVATAR_COLORS[Math.abs(h) % MAIL_AVATAR_COLORS.length];
};

// First letter of the sender's name, uppercased — single character avatar.
Reports._mailAvatarInitial = function (name) {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

// "10:42 AM" if today, "Mon" if this week, "Mar 5" otherwise. Empty on parse fail.
Reports._mailFormatDate = function (dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (now.getTime() - d.getTime() < oneWeek) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
};

// Full timestamp for the detail view header: "Mon, Mar 5, 2026 · 10:42 AM"
Reports._mailFormatFullDate = function (dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
           ' · ' +
           d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

// ── Top-level dispatch ──

Reports._renderComms = function () {
  this.titleEl.textContent = 'Mail';
  if (this._mailView === 'detail' && this._mailCurrentId) {
    this._renderEmailDetail(this._mailCurrentId);
  } else {
    this._mailView = 'inbox';
    this._renderInbox();
  }
};

// ── Inbox ──

Reports._renderInbox = async function () {
  const api = window.electronAPI?.gmail;

  // Not signed in → onboarding card.
  if (api && this._emails.length === 0) {
    const authed = await api.isAuthenticated();
    if (!authed) {
      this.content.innerHTML = `<div class="rp-mail-onboard">
        <div class="rp-mail-onboard-icon">${Icons.envelope}</div>
        <div class="rp-mail-onboard-title">Connect your inbox</div>
        <div class="rp-mail-onboard-sub">Sign in with Gmail to read and triage email from inside Pegasus.</div>
        <button class="rp-mail-onboard-btn" id="rpGmailSignIn">Sign in with Gmail</button>
      </div>`;
      document.getElementById('rpGmailSignIn').addEventListener('click', async () => {
        this.content.innerHTML = '<div class="rp-mail-onboard"><div class="rp-mail-onboard-title">Waiting for browser…</div><div class="rp-mail-onboard-sub">Approve access in the tab that just opened.</div></div>';
        try {
          await api.startAuth();
          const result = await api.listMessages(20);
          if (result.success) this._emails = result.data;
          this._renderInbox();
        } catch (e) {
          this.content.innerHTML = `<div class="rp-mail-onboard"><div class="rp-mail-onboard-title">Sign-in failed</div><div class="rp-mail-onboard-sub">${this._esc(e.message)}</div></div>`;
        }
      });
      return;
    }

    // Authed, no cache → show skeleton + fetch.
    this.content.innerHTML = '<div class="rp-mail-onboard"><div class="rp-mail-onboard-title">Loading inbox…</div></div>';
    try {
      const result = await api.listMessages(20);
      if (result.success) this._emails = result.data;
    } catch (e) { /* falls through to empty state */ }
  }

  if (this._emails.length === 0) {
    this.content.innerHTML = `<div class="rp-mail-onboard">
      <div class="rp-mail-onboard-title">Inbox empty</div>
      <div class="rp-mail-onboard-sub">No messages to show yet.</div>
    </div>`;
    return;
  }

  // Inbox list
  const unreadCount = this._emails.filter(e => e.unread).length;
  let html = `<div class="rp-mail-inbox-header">
    <span class="rp-mail-inbox-title">Inbox</span>
    <span class="rp-mail-inbox-count">${this._emails.length}${unreadCount ? ` · <b>${unreadCount} unread</b>` : ''}</span>
  </div>`;
  html += '<div class="rp-mail-list">';

  for (const email of this._emails) {
    const name = this._mailSenderName(email.from);
    const initial = this._mailAvatarInitial(name);
    const color = this._mailAvatarColor(name);
    const shortDate = this._mailFormatDate(email.date);
    const subject = email.subject || '(no subject)';
    const snippet = email.snippet || '';
    const unread = email.unread ? ' unread' : '';

    html += `<div class="rp-mail-item${unread}" data-email-id="${this._esc(email.id)}">
      <div class="rp-mail-avatar" style="background:${color}">${this._esc(initial)}</div>
      <div class="rp-mail-body">
        <div class="rp-mail-row1">
          <span class="rp-mail-sender">${this._esc(name || '(unknown)')}</span>
          <span class="rp-mail-date">${this._esc(shortDate)}</span>
        </div>
        <div class="rp-mail-subject">${this._esc(subject)}</div>
        <div class="rp-mail-snippet">${this._esc(snippet)}</div>
      </div>
      ${email.unread ? '<span class="rp-mail-unread-dot"></span>' : ''}
    </div>`;
  }
  html += '</div>';
  this.content.innerHTML = html;

  this.content.querySelectorAll('.rp-mail-item').forEach(el => {
    el.addEventListener('click', () => this._openEmail(el.dataset.emailId));
  });
};

// ── Detail view ──

Reports._openEmail = function (emailId) {
  this._mailView = 'detail';
  this._mailCurrentId = emailId;
  this._renderEmailDetail(emailId);
};

Reports._renderEmailDetail = async function (emailId) {
  this.content.innerHTML = '<div class="rp-mail-onboard"><div class="rp-mail-onboard-title">Loading…</div></div>';

  const api = window.electronAPI?.gmail;
  if (!api) {
    this.content.innerHTML = '<div class="rp-mail-onboard"><div class="rp-mail-onboard-title">Gmail unavailable</div></div>';
    return;
  }

  try {
    const result = await api.getMessage(emailId);
    if (!result.success) {
      this.content.innerHTML = `<div class="rp-mail-onboard">
        <div class="rp-mail-onboard-title">Couldn't load message</div>
        <div class="rp-mail-onboard-sub">${this._esc(result.error || 'Unknown error')}</div>
      </div>`;
      return;
    }

    const email = result.data;
    const name = this._mailSenderName(email.from);
    const address = this._mailSenderAddress(email.from);
    const initial = this._mailAvatarInitial(name);
    const color = this._mailAvatarColor(name);
    const subject = email.subject || '(no subject)';
    const fullDate = this._mailFormatFullDate(email.date);

    // Header card. The body iframe is appended after this so renderEmailSecure
    // can build its sandboxed iframe in a stable container.
    this.content.innerHTML = `
      <div class="rp-mail-detail">
        <div class="rp-mail-detail-subject">${this._esc(subject)}</div>
        <div class="rp-mail-detail-sender">
          <div class="rp-mail-avatar large" style="background:${color}">${this._esc(initial)}</div>
          <div class="rp-mail-detail-meta">
            <div class="rp-mail-detail-name">${this._esc(name || '(unknown)')}</div>
            ${address ? `<div class="rp-mail-detail-address">${this._esc(address)}</div>` : ''}
            <div class="rp-mail-detail-date">${this._esc(fullDate)}</div>
          </div>
        </div>
      </div>
      <div class="rp-mail-detail-body"></div>
    `;

    const bodyContainer = this.content.querySelector('.rp-mail-detail-body');
    renderEmailSecure(bodyContainer, email.body, email.snippet);
  } catch (e) {
    this.content.innerHTML = `<div class="rp-mail-onboard">
      <div class="rp-mail-onboard-title">Error</div>
      <div class="rp-mail-onboard-sub">${this._esc(e.message)}</div>
    </div>`;
  }
};

// ── Public entry-points ──

Reports.setEmails = function (emails) {
  this._emails = emails || [];
  if (this.isOpen() && this._activeApp === 'comms' && this._mailView === 'inbox') {
    this._renderApp();
  }
};

// Kept for backward-compat with Pipeline.openHITLPanel — Review tab was removed,
// so this now just opens Mail's inbox. (HITL surface will be reintroduced later.)
Reports.showHITL = function (queue) {
  this._activeApp = 'comms';
  this._mailView = 'inbox';
  this._mailCurrentId = null;
  this.homescreen.classList.add('hidden');
  this.appview.classList.remove('hidden');
  this._renderComms();
};
