// ── Reports app: Notes ──
// List view (most-recent first) + detail view with editable textarea.
// Persisted to localStorage via Reports._storage. Each note: { id, body, modified }.
// First line of body becomes the displayed title; the rest is the snippet.
// State: _notesView ('list' | 'edit'), _notesCurrentId.

Reports._notesView = 'list';
Reports._notesCurrentId = null;

Reports._notesAll = function () {
  return this._storage.get('notes', []);
};

Reports._notesSaveAll = function (notes) {
  this._storage.set('notes', notes);
};

Reports._renderNotes = function () {
  this.titleEl.textContent = 'Notes';
  if (this._notesView === 'edit') {
    this._renderNoteEdit();
  } else {
    this._renderNotesList();
  }
};

Reports._renderNotesList = function () {
  const notes = this._notesAll().slice().sort((a, b) => b.modified - a.modified);

  let html = `<div class="rp-notes">
    <div class="rp-notes-header">
      <span class="rp-notes-title">All Notes</span>
      <button class="rp-notes-new" id="rpNotesNew" title="New note">${Icons.plus}</button>
    </div>`;

  if (notes.length === 0) {
    html += `<div class="rp-notes-empty">
      <div class="rp-notes-empty-icon">${Icons.note}</div>
      <div class="rp-notes-empty-title">No notes yet</div>
      <div class="rp-notes-empty-sub">Tap ＋ to create your first note.</div>
    </div>`;
  } else {
    html += '<div class="rp-notes-list">';
    for (const n of notes) {
      const lines = (n.body || '').split('\n');
      const title = (lines[0] || '').trim() || 'New Note';
      const snippet = lines.slice(1).join(' ').trim() || 'No additional text';
      const date = new Date(n.modified).toLocaleDateString([], { month: 'short', day: 'numeric' });
      html += `<div class="rp-notes-item" data-id="${n.id}">
        <div class="rp-notes-item-row">
          <span class="rp-notes-item-title">${this._esc(title)}</span>
          <span class="rp-notes-item-date">${date}</span>
        </div>
        <div class="rp-notes-item-snippet">${this._esc(snippet)}</div>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  this.content.innerHTML = html;

  document.getElementById('rpNotesNew')?.addEventListener('click', () => this._openNote(null));
  this.content.querySelectorAll('.rp-notes-item').forEach(el => {
    el.addEventListener('click', () => this._openNote(parseInt(el.dataset.id)));
  });
};

Reports._openNote = function (id) {
  if (id === null) {
    // New note — assign id, push placeholder
    const notes = this._notesAll();
    const newNote = { id: Date.now(), body: '', modified: Date.now() };
    notes.push(newNote);
    this._notesSaveAll(notes);
    this._notesCurrentId = newNote.id;
  } else {
    this._notesCurrentId = id;
  }
  this._notesView = 'edit';
  this._renderNotes();
};

Reports._renderNoteEdit = function () {
  const notes = this._notesAll();
  const note = notes.find(n => n.id === this._notesCurrentId);
  if (!note) {
    this._notesView = 'list';
    this._renderNotesList();
    return;
  }

  this.content.innerHTML = `
    <div class="rp-note-edit">
      <div class="rp-note-edit-toolbar">
        <button class="rp-note-back" id="rpNoteBack"><span class="rp-icon-inline">${Icons.chevronLeft}</span> Notes</button>
        <button class="rp-note-delete" id="rpNoteDelete" title="Delete note">${Icons.trash}</button>
      </div>
      <textarea class="rp-note-textarea" id="rpNoteTextarea" placeholder="Title&#10;Then start writing…" spellcheck="false">${this._esc(note.body)}</textarea>
    </div>
  `;

  const ta = document.getElementById('rpNoteTextarea');
  ta.focus();
  // Place caret at end
  ta.setSelectionRange(ta.value.length, ta.value.length);

  let saveTimer = null;
  ta.addEventListener('input', () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const all = this._notesAll();
      const n = all.find(x => x.id === this._notesCurrentId);
      if (n) {
        n.body = ta.value;
        n.modified = Date.now();
        this._notesSaveAll(all);
      }
    }, 300);
  });

  document.getElementById('rpNoteBack').addEventListener('click', () => {
    // Drop empty notes so the list doesn't fill with blanks
    if (!ta.value.trim()) {
      const all = this._notesAll().filter(n => n.id !== this._notesCurrentId);
      this._notesSaveAll(all);
    }
    this._notesView = 'list';
    this._notesCurrentId = null;
    this._renderNotes();
  });

  document.getElementById('rpNoteDelete').addEventListener('click', () => {
    const all = this._notesAll().filter(n => n.id !== this._notesCurrentId);
    this._notesSaveAll(all);
    this._notesView = 'list';
    this._notesCurrentId = null;
    this._renderNotes();
  });
};
