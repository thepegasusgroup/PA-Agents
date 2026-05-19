// ── Reports app: Dummy "Coming soon" ──
// Fallback renderer for home-screen icons that don't have a real implementation
// yet (Calendar, Photos, Camera, Notes, Reminders, Clock, Calculator, Weather).
// Triggered by the default branch of core.js's _renderApp dispatcher.

// Icon names refer to keys on the global Icons library (icons.js) — looked up
// at render time so the constant can be declared before Icons loads.
const DUMMY_APP_INFO = {
  // (All the productive utility apps are real now — these entries remain as
  // a safety net in case a dispatcher case is removed.)
  calendar:   { name: 'Calendar',   glyph: 'calendar', tagline: 'Schedule and reminders coming soon.' },
  photos:     { name: 'Photos',     glyph: 'image',    tagline: 'A gallery of facility moments — coming soon.' },
  camera:     { name: 'Camera',     glyph: 'camera',   tagline: 'Snap shots of your agents at work — coming soon.' },
  notes:      { name: 'Notes',      glyph: 'note',     tagline: 'Jot down ideas — coming soon.' },
  reminders:  { name: 'Reminders',  glyph: 'alarm',    tagline: 'Nudge yourself about tasks — coming soon.' },
  clock:      { name: 'Clock',      glyph: 'alarm',    tagline: 'Timers and alarms — coming soon.' },
  calculator: { name: 'Calculator', glyph: 'abacus',   tagline: 'Quick math — coming soon.' },
  weather:    { name: 'Weather',    glyph: 'cloudSun', tagline: 'Local forecast — coming soon.' },
  // ── True dummies — placeholder apps that fill the home grid ──
  maps:       { name: 'Maps',       glyph: 'pin',         tagline: 'Facility navigation — coming soon.' },
  news:       { name: 'News',       glyph: 'newspaper',   tagline: 'Industry headlines and feeds — coming soon.' },
  appstore:   { name: 'App Store',  glyph: 'shoppingBag', tagline: 'Install new agent capabilities — coming soon.' },
};

Reports._renderDummy = function (appId) {
  const info = DUMMY_APP_INFO[appId] || { name: appId || 'App', glyph: 'gear', tagline: 'Coming soon.' };
  const iconSvg = (Icons && Icons[info.glyph]) || (Icons && Icons.gear) || '';
  this.titleEl.textContent = info.name;
  this.content.innerHTML = `
    <div class="rp-coming-soon">
      <div class="rp-coming-soon-icon">${iconSvg}</div>
      <div class="rp-coming-soon-title">${this._esc(info.name)}</div>
      <div class="rp-coming-soon-sub">${this._esc(info.tagline)}</div>
      <div class="rp-coming-soon-badge">Coming soon</div>
    </div>
  `;
};
