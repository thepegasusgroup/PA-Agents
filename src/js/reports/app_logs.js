// ── Reports app: Logs ──
// Scrollback of system/gmail/pipeline/worker events.
// Public entry-point: Reports.log(source, message, level).

Reports._renderLogs = function () {
  this.titleEl.textContent = 'Logs';

  if (this._logs.length === 0) {
    this.content.innerHTML = `<div class="rp-empty"><div class="rp-empty-icon">${Icons.clipboard}</div>No log entries yet</div>`;
    return;
  }

  // Map each log source to a stroke-based SVG glyph from the central library.
  const sourceIcons = {
    gmail:    Icons.envelope,
    pipeline: Icons.gear,
    worker:   Icons.user,
    system:   Icons.monitor,
  };

  let html = '';
  for (const entry of this._logs) {
    const t = entry.time;
    const timeStr = String(t.getHours()).padStart(2, '0') + ':' +
                    String(t.getMinutes()).padStart(2, '0') + ':' +
                    String(t.getSeconds()).padStart(2, '0');

    const icon = sourceIcons[entry.source] || Icons.clipboard;
    const levelClass = entry.level === 'error' ? ' error' : entry.level === 'warning' ? ' warning' : '';

    html += `<div class="rp-log-entry${levelClass}">
      <span class="rp-log-time">${timeStr}</span>
      <span class="rp-log-icon">${icon}</span>
      <span class="rp-log-source ${entry.source}">${entry.source}</span>
      <span class="rp-log-msg">${this._esc(entry.message)}</span>
    </div>`;
  }
  this.content.innerHTML = html;
};

// ── Public entry-point ──

Reports.log = function (source, message, level) {
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
};
