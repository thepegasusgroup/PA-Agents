// ── Reports Phone UI — core ──
// Declares the Reports singleton (state + lifecycle + navigation + dispatcher).
// App-specific render methods attach from sibling files:
//   app_comms.js    — Mail: _renderComms, _renderInbox, _renderEmailDetail, _openEmail, setEmails
//   app_contacts.js — Contacts: _renderContacts (you-card + A–Z workers)
//   app_logs.js     — Logs: _renderLogs, log
//   app_system.js   — Settings: _renderSettings + connections detail
//   app_radio.js    — Radio: _renderRadio + audio control
//   app_dummy.js    — Coming-soon placeholders for not-yet-built apps

const Reports = {
  _logs: [],
  _emails: [],
  _activeApp: null,       // null = homescreen, 'comms'|'contacts'|'logs'|'system'|'radio'|dummy
  _mailView: 'inbox',     // 'inbox' or 'detail' — which Mail screen we're on
  _mailCurrentId: null,   // emailId currently shown in detail view
  _settingsView: 'main',  // 'main' or 'gmail'
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

    // Back button — context-aware:
    //   Settings detail → Settings main
    //   Mail detail → Inbox
    //   Notes edit → Notes list
    //   Photos full → Photos grid
    //   else → home
    this.overlay.querySelector('.rp-back').addEventListener('click', () => {
      if (this._activeApp === 'system' && this._settingsView !== 'main') {
        this._settingsView = 'main';
        this._renderSettings();
      } else if (this._activeApp === 'comms' && this._mailView === 'detail') {
        this._mailView = 'inbox';
        this._mailCurrentId = null;
        this._renderComms();
      } else if (this._activeApp === 'notes' && this._notesView === 'edit') {
        // Drop any empty note (matches what the inline Notes button does)
        const all = this._storage.get('notes', []).filter(n => {
          if (n.id !== this._notesCurrentId) return true;
          return (n.body || '').trim() !== '';
        });
        this._storage.set('notes', all);
        this._notesView = 'list';
        this._notesCurrentId = null;
        this._renderNotes();
      } else if (this._activeApp === 'photos' && this._photosView === 'full') {
        this._photosView = 'grid';
        this._photosCurrentId = null;
        this._renderPhotos();
      } else if (this._activeApp === 'workshop' && this._workshopView === 'edit') {
        this._workshopView = 'list';
        this._workshopCurrentId = null;
        this._workshopDraft = null;
        this._renderWorkshop();
      } else {
        this._goHome();
      }
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

    // Clear button — context-aware:
    //   Logs → wipe log scrollback
    //   Mail inbox → drop cached emails (next render refetches from Gmail)
    const clearBtn = this.overlay.querySelector('.rp-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (this._activeApp === 'logs') {
          this._logs = [];
          this._renderApp();
        } else if (this._activeApp === 'comms' && this._mailView === 'inbox') {
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

  // ── Lifecycle ──

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
    this._settingsView = 'main';
    this._mailView = 'inbox';
    this._mailCurrentId = null;
    this._notesView = 'list';
    this._notesCurrentId = null;
    this._photosView = 'grid';
    this._photosCurrentId = null;
    this._workshopView = 'list';
    this._workshopCurrentId = null;
    this._workshopDraft = null;
    if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null; }
    this.appview.classList.add('hidden');
    this.homescreen.classList.remove('hidden');
  },

  // ── App dispatch ──
  // Each render method is attached by its app_*.js file.
  // Unknown app names fall through to the dummy "Coming soon" renderer so
  // newly-added home-screen icons work out of the box.
  _renderApp() {
    // Clock has a 1Hz timer that runs while the app is open — clear it on
    // every dispatch so navigating away stops the tick.
    if (this._activeApp !== 'clock' && this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
    switch (this._activeApp) {
      case 'comms':      this._renderComms(); break;
      case 'contacts':   this._renderContacts(); break;
      case 'logs':       this._renderLogs(); break;
      case 'system':     this._renderSettings(); break;
      case 'radio':      this._renderRadio(); break;
      case 'calendar':   this._renderCalendar(); break;
      case 'photos':     this._renderPhotos(); break;
      case 'camera':     this._renderCamera(); break;
      case 'notes':      this._renderNotes(); break;
      case 'reminders':  this._renderReminders(); break;
      case 'clock':      this._renderClock(); break;
      case 'calculator': this._renderCalculator(); break;
      case 'weather':    this._renderWeather(); break;
      case 'workshop':   this._renderWorkshop(); break;
      default:           this._renderDummy(this._activeApp);
    }
  },

  // ── Shared helpers ──

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  // localStorage-backed persistence for phone apps (notes, reminders, photos).
  // Single JSON blob under one key so all phone state lives in one place;
  // survives across game saves since it's user-data, not facility state.
  _storage: {
    KEY: 'pa_phone_data',
    _load() {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
      catch (e) { return {}; }
    },
    _save(data) {
      try { localStorage.setItem(this.KEY, JSON.stringify(data)); }
      catch (e) { console.warn('[phone storage] quota?', e); }
    },
    get(key, defaultVal) {
      const data = this._load();
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : defaultVal;
    },
    set(key, value) {
      const data = this._load();
      data[key] = value;
      this._save(data);
    },
  },
};
