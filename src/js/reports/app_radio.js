// ── Reports app: Radio ──
// 12 streaming station player with now-playing card and volume control.

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

Reports._renderRadio = function () {
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

  // Section header for the station list — matches the "Inbox / N unread" pattern
  // used by Mail and Settings for visual consistency.
  const listHeader = `<div class="radio-list-header">
    <span class="radio-list-header-title">Stations</span>
    <span class="radio-list-header-count">${RADIO_STATIONS.length}</span>
  </div>`;

  this.content.innerHTML = nowPlaying + listHeader + `<div class="radio-list">${stationList}</div>`;

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
};

Reports._radioPlay = function (idx) {
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
};

Reports._radioPause = function () {
  const r = this._radio;
  if (r.audio) r.audio.pause();
  r.playing = false;
  this._renderRadio();
};

Reports._radioResume = function () {
  const r = this._radio;
  if (r.audio) {
    r.audio.play().catch(() => {});
    r.playing = true;
  }
  this._renderRadio();
};
