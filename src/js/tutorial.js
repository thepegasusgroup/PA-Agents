/**
 * Tutorial — First-run guided onboarding for Pegasus Agents.
 * Step-by-step walkthrough: Google sign-in → UI tour → build office → hire agent.
 */
const Tutorial = {
  _step: -1,
  _active: false,
  _pollTimer: null,

  _steps: [
    {
      id: 'welcome',
      type: 'modal',
      icon: '🦅',
      title: 'Welcome to Pegasus Agents',
      desc: 'Your AI workforce, managed like a game. Sign in with Google to connect your email — your agents need it to work.',
      showSignIn: true,
    },
    {
      id: 'gmail_connected',
      type: 'modal',
      icon: '✅',
      title: 'Gmail Connected!',
      desc: 'Your AI agents can now read and manage your emails on your behalf.',
      buttonText: 'Continue',
    },
    {
      id: 'camera',
      type: 'guide',
      icon: '🎮',
      title: 'Camera Controls',
      desc: 'Use WASD to pan around the map. Q/E or scroll wheel to zoom. Middle-click drag to pan freely.',
      buttonText: 'Got it',
    },
    {
      id: 'toolbar',
      type: 'guide',
      icon: '🔨',
      title: 'The Build Toolbar',
      desc: 'The toolbar at the bottom has everything you need — walls, floors, rooms, furniture, and staff.',
      highlight: '#toolbar',
      buttonText: 'Continue',
    },
    {
      id: 'build_walls',
      type: 'guide',
      icon: '🧱',
      title: 'Build Your First Office',
      desc: 'Click "Foundations" in the toolbar below, select "Brick Wall", then click and drag a rectangle on the grass.',
      highlight: '[data-category="foundations"]',
      condition: () => {
        let count = 0;
        const cells = AppState.grid.cells;
        for (let i = 0; i < cells.length; i++) {
          if (Grid.isWall(cells[i])) count++;
        }
        return count >= 12;
      },
    },
    {
      id: 'add_floor',
      type: 'guide',
      icon: '🪵',
      title: 'Add a Floor',
      desc: 'Click "Flooring", pick any floor from the Indoor tab, then paint inside your walls.',
      highlight: '[data-category="flooring"]',
      condition: () => {
        let count = 0;
        const cells = AppState.grid.cells;
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i];
          if (c >= 50 && c <= 73) count++;
        }
        return count >= 4;
      },
    },
    {
      id: 'designate_room',
      type: 'guide',
      icon: '📋',
      title: 'Designate a Room',
      desc: 'Click "Rooms", select "Office", then drag over the inside of your building to designate it.',
      highlight: '[data-category="rooms"]',
      condition: () => AppState.rooms.some(r => r.type === 'office'),
    },
    {
      id: 'place_desk',
      type: 'guide',
      icon: '💻',
      title: 'Place a Work PC',
      desc: 'Click "Objects", find "Work PC" under IT/Computers, and place it inside the office.',
      highlight: '[data-category="objects"]',
      condition: () => AppState.objects.some(o =>
        o.type === 'work_pc' || o.type === 'classroom_pc' || o.type === 'computer_station'
      ),
    },
    {
      id: 'place_chair',
      type: 'guide',
      icon: '🪑',
      title: 'Add a Chair',
      desc: 'Still in "Objects", find a chair (Seating tab) and place it next to the desk. Agents need a desk AND chair to work.',
      highlight: '[data-category="objects"]',
      condition: () => AppState.objects.some(o =>
        o.type === 'chair' || o.type === 'leather_chair' || o.type === 'office_chair_exec' || o.type === 'office_chair_mod'
      ),
    },
    {
      id: 'hire_agent',
      type: 'guide',
      icon: '📨',
      title: 'Hire a Gmail Reader',
      desc: 'Click "Staff", select "Gmail Reader" from AI Agents, then click inside the office to hire them.',
      highlight: '[data-category="staff"]',
      condition: () => AppState.workers.some(w => w.type === 'gmail_reader'),
    },
    {
      id: 'click_worker',
      type: 'guide',
      icon: '👆',
      title: 'Meet Your Agent',
      desc: 'Click on your Gmail Reader agent to see their info panel. From here you can assign tasks and manage them.',
      condition: () => AppState.ui.selectedWorker != null,
    },
    {
      id: 'complete',
      type: 'modal',
      icon: '🎉',
      title: "You're Ready!",
      desc: 'Build more rooms, hire more agents, and automate your workflow. Your AI office is yours to command.',
      buttonText: 'Start Playing',
    },
  ],

  isActive() { return this._active; },

  start() {
    this._active = true;
    this._step = -1;
    // Disable delivery system during tutorial — objects appear instantly
    AppState._deliveryEnabled = false;
    document.getElementById('tutorialOverlay').classList.remove('hidden');
    this.advance();
  },

  advance() {
    this._stopPolling();
    this._clearHighlight();

    this._step++;
    if (this._step >= this._steps.length) {
      this.complete();
      return;
    }

    const step = this._steps[this._step];

    // Clear toolbar between guide steps so user starts fresh
    if (step.type === 'guide' && typeof Toolbar !== 'undefined') {
      Toolbar.clearSelection();
    }

    this._render();
    this._startPolling();
  },

  complete() {
    this._active = false;
    this._stopPolling();
    this._clearHighlight();

    // Re-enable delivery system
    AppState._deliveryEnabled = true;

    // Fade out
    const overlay = document.getElementById('tutorialOverlay');
    overlay.classList.add('fading');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('fading');
    }, 500);

    // Trigger autosave so tutorial doesn't show on next launch
    if (window.electronAPI && window.electronAPI.save) {
      (async () => {
        try {
          const data = AppState.serialize();
          const json = JSON.stringify(data);
          const savePath = await window.electronAPI.save.getAutosavePath();
          await window.electronAPI.save.write(savePath, json);
          console.log('[Tutorial] Saved — tutorial won\'t show again.');
        } catch (e) {
          console.warn('[Tutorial] Auto-save failed:', e);
        }
      })();
    }
  },

  skip() {
    this._step = this._steps.length;
    this.complete();
  },

  _render() {
    const step = this._steps[this._step];
    const backdrop = document.getElementById('tutBackdrop');
    const card = document.getElementById('tutorialCard');
    const icon = document.getElementById('tutIcon');
    const title = document.getElementById('tutTitle');
    const desc = document.getElementById('tutDesc');
    const actions = document.getElementById('tutActions');
    const stepNum = document.getElementById('tutStepNum');

    // Step counter
    stepNum.textContent = `${this._step + 1} / ${this._steps.length}`;

    // Content
    icon.textContent = step.icon || '';
    title.textContent = step.title;
    desc.textContent = step.desc;

    // Card mode
    if (step.type === 'modal') {
      backdrop.classList.remove('hidden');
      card.className = 'tutorial-card modal';
    } else {
      backdrop.classList.add('hidden');
      card.className = 'tutorial-card guide';
    }

    // Actions
    actions.innerHTML = '';

    if (step.showSignIn) {
      // Google sign-in button
      const btn = document.createElement('button');
      btn.className = 'tutorial-btn signin';
      btn.innerHTML = '<span class="tut-google-icon">G</span> Sign in with Google';
      btn.addEventListener('click', () => this._handleSignIn(btn));
      actions.appendChild(btn);

      // Skip link
      const skipLink = document.createElement('button');
      skipLink.className = 'tutorial-btn-skip';
      skipLink.textContent = 'Skip tutorial';
      skipLink.addEventListener('click', () => this.skip());
      actions.appendChild(skipLink);
    } else if (step.buttonText) {
      const btn = document.createElement('button');
      btn.className = 'tutorial-btn';
      btn.textContent = step.buttonText;
      btn.addEventListener('click', () => this.advance());
      actions.appendChild(btn);
    } else if (step.condition) {
      // Auto-detect step — show hint + skip
      const hint = document.createElement('span');
      hint.className = 'tutorial-hint';
      hint.textContent = 'Complete the action to continue';
      actions.appendChild(hint);

      const skip = document.createElement('button');
      skip.className = 'tutorial-btn-skip';
      skip.textContent = 'Skip step';
      skip.addEventListener('click', () => this.advance());
      actions.appendChild(skip);
    }

    // Highlight target element
    if (step.highlight) {
      const el = document.querySelector(step.highlight);
      if (el) el.classList.add('tutorial-highlight');
    }
  },

  async _handleSignIn(btn) {
    const api = window.electronAPI?.gmail;
    if (!api) {
      // Gmail module not available (no credentials.json) — skip auth
      btn.textContent = 'Gmail not configured — skipping';
      btn.disabled = true;
      setTimeout(() => {
        // Skip the "Gmail Connected" step too
        this._step++;
        this.advance();
      }, 1500);
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="tut-spinner"></span> Waiting for sign-in...';

    try {
      await api.startAuth();
      const authed = await api.isAuthenticated();
      if (authed) {
        this.advance();
      } else {
        btn.disabled = false;
        btn.innerHTML = '<span class="tut-google-icon">G</span> Try again';
      }
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = '<span class="tut-google-icon">G</span> Try again';
    }
  },

  _startPolling() {
    const step = this._steps[this._step];
    if (!step || !step.condition) return;

    this._pollTimer = setInterval(() => {
      if (step.condition()) {
        this._stopPolling();
        // Flash the card green briefly, then advance
        const card = document.getElementById('tutorialCard');
        card.classList.add('success');
        setTimeout(() => {
          card.classList.remove('success');
          this.advance();
        }, 700);
      }
    }, 400);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  _clearHighlight() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
    });
  },
};
