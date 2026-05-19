// ── Reports app: Reminders ──
// Simple todo list: add via input, toggle via checkbox, swipe-less delete via
// trash icon. Persisted to localStorage via Reports._storage.
// Each entry: { id, text, done, created }.

Reports._remindersAll = function () {
  return this._storage.get('reminders', []);
};

Reports._remindersSave = function (list) {
  this._storage.set('reminders', list);
};

Reports._renderReminders = function () {
  this.titleEl.textContent = 'Reminders';
  const list = this._remindersAll();
  const pending = list.filter(r => !r.done);
  const done    = list.filter(r => r.done);

  let html = `<div class="rp-rem">
    <div class="rp-rem-header">
      <span class="rp-rem-title">Reminders</span>
      <span class="rp-rem-count">${pending.length} remaining</span>
    </div>
    <div class="rp-rem-input-row">
      <input type="text" class="rp-rem-input" id="rpRemInput" placeholder="Add a reminder…" maxlength="140">
      <button class="rp-rem-add" id="rpRemAdd" title="Add">${Icons.plus}</button>
    </div>`;

  if (list.length === 0) {
    html += `<div class="rp-rem-empty">
      <div class="rp-rem-empty-icon">${Icons.check}</div>
      <div class="rp-rem-empty-title">All caught up</div>
      <div class="rp-rem-empty-sub">Type above to add your first reminder.</div>
    </div>`;
  } else {
    html += '<div class="rp-rem-list">';
    const renderItem = (r) => `<div class="rp-rem-item${r.done ? ' done' : ''}" data-id="${r.id}">
      <button class="rp-rem-check" data-act="toggle"><span class="rp-rem-check-dot"></span></button>
      <span class="rp-rem-text">${this._esc(r.text)}</span>
      <button class="rp-rem-del" data-act="del" title="Delete">${Icons.close}</button>
    </div>`;
    for (const r of pending) html += renderItem(r);
    if (done.length) {
      html += `<div class="rp-rem-done-header">Completed · ${done.length}</div>`;
      for (const r of done) html += renderItem(r);
    }
    html += '</div>';
  }
  html += '</div>';
  this.content.innerHTML = html;

  // Add
  const input = document.getElementById('rpRemInput');
  const addBtn = document.getElementById('rpRemAdd');
  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    const all = this._remindersAll();
    all.push({ id: Date.now(), text, done: false, created: Date.now() });
    this._remindersSave(all);
    input.value = '';
    this._renderReminders();
  };
  addBtn?.addEventListener('click', submit);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  // Toggle / delete
  this.content.querySelectorAll('.rp-rem-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-act]')?.dataset.act;
      const id = parseInt(el.dataset.id);
      const all = this._remindersAll();
      if (action === 'toggle') {
        const r = all.find(x => x.id === id);
        if (r) r.done = !r.done;
        this._remindersSave(all);
        this._renderReminders();
      } else if (action === 'del') {
        e.stopPropagation();
        this._remindersSave(all.filter(x => x.id !== id));
        this._renderReminders();
      }
    });
  });
};
