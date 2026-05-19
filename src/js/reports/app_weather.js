// ── Reports app: Weather ──
// Fake weather tied to the in-game time-of-day. Real weather would need a
// network API + location; instead we generate plausible numbers from the
// facility's sun position so it tracks the visible day/night cycle:
//   - Temp peaks around midday, dips at night
//   - "Condition" rotates deterministically by in-game day so each day has
//     its own look (sunny / partly cloudy / cloudy / rainy)
//   - Hourly strip shows the next 12 game-hours

// Each condition references a stroke-based SVG glyph from the central icon
// library (filled in at render time so this constant can be declared before
// Icons exists, in case load order ever shifts).
const WEATHER_CONDITIONS = [
  { id: 'sunny',   label: 'Sunny',        glyph: 'sun',       bg: 'linear-gradient(180deg, #4ec0ff 0%, #87cdff 60%, #c4e3f5 100%)', tempMod: 4 },
  { id: 'partly',  label: 'Partly Cloudy', glyph: 'cloudSun', bg: 'linear-gradient(180deg, #5ba8d8 0%, #98c1da 60%, #d8e2eb 100%)', tempMod: 0 },
  { id: 'cloudy',  label: 'Cloudy',       glyph: 'cloud',     bg: 'linear-gradient(180deg, #7090a5 0%, #a8b8c4 60%, #c8d3dc 100%)', tempMod: -3 },
  { id: 'rainy',   label: 'Light Rain',   glyph: 'cloudRain', bg: 'linear-gradient(180deg, #4a6878 0%, #6a8595 60%, #9aaab5 100%)', tempMod: -5 },
];

Reports._renderWeather = function () {
  this.titleEl.textContent = 'Weather';

  const hour = (AppState.facility.time / 60) % 24;
  const day = AppState.facility.day || 1;
  const cond = WEATHER_CONDITIONS[(day - 1) % WEATHER_CONDITIONS.length];

  // Synthetic temperature curve: base 18°C, swings ±8 across the day,
  // peak at 14:00, low at 02:00. Condition shifts the average ±5°C.
  const tempFor = (h) => {
    const phase = ((h - 2) / 24) * Math.PI * 2;
    const swing = -Math.cos(phase) * 8;
    return Math.round(18 + swing + cond.tempMod);
  };
  const currentTemp = tempFor(hour);
  const high = tempFor(14);
  const low  = tempFor(2);

  // 12-hour strip — pick the right SVG glyph for each hour:
  //   20:00–05:59 → moon, 06–07 & 18–19 → cloud-moon (low-sun proxy), else condition
  const condGlyph = Icons[cond.glyph] || Icons.sun;
  let strip = '';
  for (let i = 0; i < 12; i++) {
    const h = (Math.floor(hour) + i) % 24;
    const t = tempFor(h);
    const label = i === 0 ? 'Now' : (h % 12 === 0 ? '12' : String(h % 12)) + (h < 12 ? 'AM' : 'PM');
    let glyph;
    if (h >= 20 || h < 6) glyph = Icons.moon;
    else if (h < 8 || h >= 18) glyph = Icons.cloudMoon;
    else glyph = condGlyph;
    strip += `<div class="rp-wx-hour">
      <span class="rp-wx-hour-label">${label}</span>
      <span class="rp-wx-hour-icon">${glyph}</span>
      <span class="rp-wx-hour-temp">${t}°</span>
    </div>`;
  }

  this.content.innerHTML = `
    <div class="rp-wx" style="background: ${cond.bg};">
      <div class="rp-wx-hero">
        <div class="rp-wx-location">Facility</div>
        <div class="rp-wx-temp">${currentTemp}°</div>
        <div class="rp-wx-cond">
          <span class="rp-wx-cond-emoji">${condGlyph}</span>
          <span>${cond.label}</span>
        </div>
        <div class="rp-wx-range">H: ${high}°&nbsp;&nbsp;L: ${low}°</div>
      </div>
      <div class="rp-wx-hourly">${strip}</div>
      <div class="rp-wx-card">
        <div class="rp-wx-card-label">Game time</div>
        <div class="rp-wx-card-value">${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}</div>
      </div>
      <div class="rp-wx-card">
        <div class="rp-wx-card-label">Day</div>
        <div class="rp-wx-card-value">${day}</div>
      </div>
    </div>
  `;
};
