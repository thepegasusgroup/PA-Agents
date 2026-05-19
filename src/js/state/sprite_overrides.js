// ── Sprite render-offset overrides ──
// Reads/writes AppState.spriteOverrides (declared in state/core.js).
// Baked baseline lives in defs/sprite_overrides.js (BAKED_SPRITE_OVERRIDES);
// localStorage layers dev nudges on top.
// Use F3 + X (debug mode) to enter the in-game nudge editor; Ctrl+E exports JSON.

AppState.loadSpriteOverrides = function () {
  // Start from the baked baseline shipped in defs/sprite_overrides.js, then
  // layer localStorage on top so dev nudges (Ctrl+E export pending) still win.
  const baked = (typeof BAKED_SPRITE_OVERRIDES !== 'undefined') ? BAKED_SPRITE_OVERRIDES : {};
  this.spriteOverrides = { ...baked };
  try {
    const raw = localStorage.getItem('pa_sprite_overrides');
    if (raw) Object.assign(this.spriteOverrides, JSON.parse(raw) || {});
  } catch (e) { /* keep baked-only */ }
};

AppState.saveSpriteOverrides = function () {
  try {
    localStorage.setItem('pa_sprite_overrides', JSON.stringify(this.spriteOverrides));
  } catch (e) { /* ignore */ }
};

AppState.getSpriteOverride = function (type, rot) {
  return this.spriteOverrides[`${type}_r${rot}`] || null;
};

AppState.setSpriteOverride = function (type, rot, ox, oy) {
  const key = `${type}_r${rot}`;
  if ((ox | 0) === 0 && (oy | 0) === 0) {
    delete this.spriteOverrides[key];
  } else {
    this.spriteOverrides[key] = { ox: ox | 0, oy: oy | 0 };
  }
  this.saveSpriteOverrides();
};

AppState.resetSpriteOverride = function (type, rot) {
  delete this.spriteOverrides[`${type}_r${rot}`];
  this.saveSpriteOverrides();
};
