// ── Reports app: Calendar ──
// Month grid view of the current month (real calendar from the system clock),
// today's date highlighted. A small chip up top shows the in-game day count
// so the player has a sense of how long the facility has been running.

Reports._calendarMonth = null; // {year, month} — 0-indexed month; null = current

Reports._renderCalendar = function () {
  this.titleEl.textContent = 'Calendar';

  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  const view = this._calendarMonth || { year: today.year, month: today.month };

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayHeaders = ['S','M','T','W','T','F','S'];

  // First day-of-week + total days in month (handles leap years automatically).
  const first = new Date(view.year, view.month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const daysInPrev = new Date(view.year, view.month, 0).getDate();

  let html = `<div class="rp-cal">
    <div class="rp-cal-header">
      <div class="rp-cal-month">
        <span class="rp-cal-month-name">${monthNames[view.month]}</span>
        <span class="rp-cal-month-year">${view.year}</span>
      </div>
      <div class="rp-cal-nav">
        <button class="rp-cal-nav-btn" data-nav="-1">‹</button>
        <button class="rp-cal-nav-btn" data-nav="today">Today</button>
        <button class="rp-cal-nav-btn" data-nav="1">›</button>
      </div>
    </div>
    <div class="rp-cal-game-day">Day ${AppState.facility.day} in facility</div>
    <div class="rp-cal-weekdays">`;
  for (const d of dayHeaders) html += `<span>${d}</span>`;
  html += '</div><div class="rp-cal-grid">';

  // Leading days from previous month (greyed out)
  for (let i = startDow - 1; i >= 0; i--) {
    html += `<div class="rp-cal-cell muted">${daysInPrev - i}</div>`;
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = (view.year === today.year && view.month === today.month && d === today.day);
    html += `<div class="rp-cal-cell${isToday ? ' today' : ''}">${d}</div>`;
  }
  // Trailing days to fill the grid out to a multiple of 7 (max 42 cells)
  const filled = startDow + daysInMonth;
  const trailing = (7 - (filled % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    html += `<div class="rp-cal-cell muted">${d}</div>`;
  }
  html += '</div></div>';
  this.content.innerHTML = html;

  this.content.querySelectorAll('.rp-cal-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'today') {
        this._calendarMonth = null;
      } else {
        const delta = parseInt(nav);
        const m = view.month + delta;
        this._calendarMonth = {
          year: view.year + Math.floor(m / 12),
          month: ((m % 12) + 12) % 12,
        };
      }
      this._renderCalendar();
    });
  });
};
