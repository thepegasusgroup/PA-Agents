// ── Reports app: Clock ──
// Big digital clock + date, ticking every second while the app is open.
// _clockTimer is cleaned up on _goHome (see core.js); harmless if it lingers
// since we only update the DOM if the clock element still exists.

Reports._renderClock = function () {
  this.titleEl.textContent = 'Clock';

  this.content.innerHTML = `
    <div class="rp-clock-screen">
      <div class="rp-clock-time" id="rpClockTime"></div>
      <div class="rp-clock-date" id="rpClockDate"></div>
      <div class="rp-clock-meta">
        <div class="rp-clock-meta-row">
          <span class="rp-clock-meta-label">In-game day</span>
          <span class="rp-clock-meta-value">${AppState.facility.day}</span>
        </div>
        <div class="rp-clock-meta-row">
          <span class="rp-clock-meta-label">Timezone</span>
          <span class="rp-clock-meta-value">${this._esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local')}</span>
        </div>
      </div>
    </div>
  `;

  const tick = () => {
    const timeEl = document.getElementById('rpClockTime');
    const dateEl = document.getElementById('rpClockDate');
    if (!timeEl || !dateEl) {
      if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null; }
      return;
    }
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    timeEl.innerHTML = `${String(h).padStart(2, '0')}<span class="rp-clock-colon">:</span>${String(m).padStart(2, '0')}<span class="rp-clock-sec">${String(s).padStart(2, '0')}</span>`;
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };
  tick();
  if (this._clockTimer) clearInterval(this._clockTimer);
  this._clockTimer = setInterval(tick, 1000);
};
