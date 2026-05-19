// ── Debug overlay (F3) ──
// Hover any object while debug mode is on to see its type/rot/size/sprite info,
// plus a panel for the per-rotation sprite-nudge editor (X to enter, arrows to
// nudge, Ctrl+E to export overrides). The keyboard handlers for F3 / X /
// Ctrl+E live in onKeyDown (grid.js) — only the per-frame overlay refresh
// lives here.
// State fields read/written: _debugMode, _debugHoverObj, _spriteEditObjId,
// _mouseGrid (all declared in grid.js).

Grid._updateDebugOverlay = function (mx, my) {
  const dbg = document.getElementById('debugOverlay');
  if (!dbg) return;
  const { gx, gy } = this._mouseGrid || {};
  const obj = this._findObjectAt(gx, gy);
  if (!obj) {
    dbg.classList.add('hidden');
    this._debugHoverObj = null;
    return;
  }
  this._debugHoverObj = obj;
  const def = ObjectDefs[obj.type] || {};
  // rot → direction (object's front face direction)
  const DIR = ['South (front view)', 'West (right side view)', 'North (back view)', 'East (left side view)'];
  const FACING = ['↓ Down', '← Left', '↑ Up', '→ Right'];
  const tex = Textures.get('obj_' + obj.type + '_r' + obj.rot);
  const hasRotSprite = !!(tex && tex.complete && tex.naturalWidth > 0);
  const ovr = AppState.getSpriteOverride(obj.type, obj.rot) || { ox: 0, oy: 0 };
  const isEditing = (obj.id === this._spriteEditObjId);
  const editorState = isEditing
    ? '<span class="dbg-val accent">✏ NUDGING</span> — arrows move sprite, Shift=8px, Ctrl+R reset, Ctrl+E export, X/Esc release'
    : 'press <b>X</b> to nudge this sprite';
  dbg.innerHTML =
    `<div class="dbg-title">${def.name || obj.type} #${obj.id}</div>` +
    `<div class="dbg-row"><span class="dbg-key">type:</span><span class="dbg-val">${obj.type}</span></div>` +
    `<div class="dbg-row"><span class="dbg-key">pos:</span><span class="dbg-val">(${obj.gx}, ${obj.gy})</span></div>` +
    `<div class="dbg-row"><span class="dbg-key">size:</span><span class="dbg-val">${obj.w}×${obj.h} (def ${def.w||'?'}×${def.h||'?'})</span></div>` +
    `<div class="dbg-row"><span class="dbg-key">rot:</span><span class="dbg-val accent">${obj.rot} — ${DIR[obj.rot]}</span></div>` +
    `<div class="dbg-row"><span class="dbg-key">facing:</span><span class="dbg-val">${FACING[obj.rot]}</span></div>` +
    `<div class="dbg-row"><span class="dbg-key">sprite:</span><span class="dbg-val">obj_${obj.type}_r${obj.rot} ${hasRotSprite ? '✓' : '(fallback→programmatic rot)'}</span></div>` +
    `<div class="dbg-row" style="border-top:1px solid rgba(255,152,0,0.3);margin-top:4px;padding-top:4px;"><span class="dbg-key">offset:</span><span class="dbg-val">x:${ovr.ox} y:${ovr.oy}</span></div>` +
    `<div class="dbg-row" style="font-size:10px;color:#888;">${editorState}</div>`;
  // Position overlay near cursor without going off-screen
  const ox = Math.min(mx + 16, window.innerWidth - 280);
  const oy = Math.min(my + 16, window.innerHeight - 160);
  dbg.style.left = ox + 'px';
  dbg.style.top = oy + 'px';
  dbg.classList.remove('hidden');
};
