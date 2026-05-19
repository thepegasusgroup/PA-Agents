// ── Central icon library ──
// Stroke-based linear SVGs in the same style as the bottom-toolbar icons:
//   viewBox="0 0 24 24", fill="none", stroke="currentColor", stroke-width="2",
//   stroke-linecap/linejoin="round", default width/height "1em" so icons scale
//   with their container's font-size.
// All strings are complete <svg> elements ready to drop into innerHTML.
// Consumers can override colour via CSS `color`, and size via font-size.
//
// Original geometric line-art — generic shapes (envelope, cog, plus, etc.).

const Icons = (() => {
  const wrap = (paths) =>
    `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

  return {
    // ── Actions ──
    plus:           wrap('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    close:          wrap('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'),
    trash:          wrap('<polyline points="4 7 6 7 20 7"/><path d="M19 7v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'),
    chevronLeft:    wrap('<polyline points="15 6 9 12 15 18"/>'),
    chevronRight:   wrap('<polyline points="9 6 15 12 9 18"/>'),
    chevronUp:      wrap('<polyline points="6 15 12 9 18 15"/>'),
    chevronDown:    wrap('<polyline points="6 9 12 15 18 9"/>'),
    arrowLeft:      wrap('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
    arrowRight:     wrap('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
    check:          wrap('<polyline points="5 12 10 17 19 7"/>'),
    edit:           wrap('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'),
    refresh:        wrap('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),

    // ── Empty state / large feature icons ──
    envelope:       wrap('<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>'),
    envelopeOpen:   wrap('<path d="M3 8l9-5 9 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="3 8 12 14 21 8"/>'),
    camera:         wrap('<path d="M3 8h3l2-3h8l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>'),
    image:          wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
    note:           wrap('<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="7" y1="13" x2="15" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/>'),
    checkCircle:    wrap('<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>'),
    gear:           wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    clipboard:      wrap('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/>'),
    user:           wrap('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    monitor:        wrap('<rect x="3" y="4" width="18" height="12" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/>'),

    // ── Pipeline node icons ──
    mailFetch:      wrap('<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/><polyline points="9 19 12 22 15 19"/>'),
    mailRead:       wrap('<path d="M3 8l9-5 9 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="3 8 12 14 21 8"/>'),
    filter:         wrap('<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>'),
    send:           wrap('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
    reply:          wrap('<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>'),
    brain:          wrap('<path d="M9 3a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3v0a3 3 0 0 0 1.5 2.6"/><path d="M15 3a3 3 0 0 1 3 3v0a3 3 0 0 1 3 3v0a3 3 0 0 1-1.5 2.6"/><path d="M4.5 11.6A3 3 0 0 0 3 14.2v0a3 3 0 0 0 3 3v0a3 3 0 0 0 3 3"/><path d="M19.5 11.6a3 3 0 0 1 1.5 2.6v0a3 3 0 0 1-3 3v0a3 3 0 0 1-3 3"/><line x1="12" y1="3" x2="12" y2="20"/>'),
    list:           wrap('<line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="14" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
    scale:          wrap('<line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="7" x2="21" y2="7"/><path d="M6 7l-3 7a3 3 0 0 0 6 0z"/><path d="M18 7l-3 7a3 3 0 0 0 6 0z"/>'),
    chat:           wrap('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),

    // ── Agent identity icons (Custom Agent editor picker) ──
    // Curated set of stroke-based glyphs the user can pick to represent a custom
    // AI agent's character / role. Simple geometric line-art.
    bot:            wrap('<rect x="5" y="8" width="14" height="11" rx="2"/><line x1="12" y1="3" x2="12" y2="8"/><circle cx="12" cy="3.2" r="0.9"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><line x1="3" y1="15" x2="5" y2="15"/><line x1="19" y1="15" x2="21" y2="15"/>'),
    cpu:            wrap('<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="0.5"/><line x1="10" y1="2" x2="10" y2="5"/><line x1="14" y1="2" x2="14" y2="5"/><line x1="10" y1="19" x2="10" y2="22"/><line x1="14" y1="19" x2="14" y2="22"/><line x1="2" y1="10" x2="5" y2="10"/><line x1="2" y1="14" x2="5" y2="14"/><line x1="19" y1="10" x2="22" y2="10"/><line x1="19" y1="14" x2="22" y2="14"/>'),
    spark:          wrap('<path d="M12 3v6"/><path d="M12 15v6"/><path d="M3 12h6"/><path d="M15 12h6"/><path d="M5.5 5.5l3 3"/><path d="M15.5 15.5l3 3"/><path d="M5.5 18.5l3-3"/><path d="M15.5 8.5l3-3"/>'),
    target:         wrap('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
    eye:            wrap('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>'),
    shield:         wrap('<path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6z"/>'),
    terminal:       wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><polyline points="7 9 10 12 7 15"/><line x1="13" y1="15" x2="17" y2="15"/>'),
    compass:        wrap('<circle cx="12" cy="12" r="9"/><polygon points="12 7 15 12 12 17 9 12"/>'),
    trophy:         wrap('<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M17 6h3a3 3 0 0 1-3 5"/><path d="M7 6H4a3 3 0 0 0 3 5"/>'),
    lightning:      wrap('<polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/>'),

    // ── Dummy app placeholders (Maps / News / App Store etc.) ──
    pin:            wrap('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    newspaper:      wrap('<path d="M4 4h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M19 8h2v11a2 2 0 0 1-2 2"/><line x1="8" y1="9" x2="15" y2="9"/><line x1="8" y1="13" x2="15" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'),
    shoppingBag:    wrap('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 1 1-8 0"/>'),
    alarm:          wrap('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="M22 6l-3-3"/>'),
    calendar:       wrap('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    abacus:         wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="7" x2="9" y2="9"/><line x1="15" y1="7" x2="15" y2="9"/><line x1="6" y1="13" x2="6" y2="15"/><line x1="12" y1="13" x2="12" y2="15"/><line x1="18" y1="13" x2="18" y2="15"/>'),

    // ── Weather ──
    sun:            wrap('<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>'),
    cloud:          wrap('<path d="M18 10a5 5 0 0 0-9.6-1.4A4 4 0 1 0 7 17h11a4 4 0 0 0 0-8 4 4 0 0 0 0 1z"/>'),
    cloudSun:       wrap('<circle cx="8" cy="8" r="3"/><path d="M8 2v2"/><path d="M2 8h2"/><path d="M3.5 3.5l1.4 1.4"/><path d="M12.5 3.5l-1.4 1.4"/><path d="M19 14a4 4 0 0 0-8-1 4 4 0 1 0-2 8h10a3.5 3.5 0 0 0 0-7z"/>'),
    cloudRain:      wrap('<path d="M18 10a5 5 0 0 0-9.6-1.4A4 4 0 1 0 7 16h11a4 4 0 0 0 0-6z"/><line x1="8" y1="19" x2="8" y2="22"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="16" y1="19" x2="16" y2="22"/>'),
    moon:           wrap('<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>'),
    cloudMoon:      wrap('<path d="M14 5a5 5 0 1 0 5 5"/><path d="M19 14a4 4 0 0 0-8-1 4 4 0 1 0-2 8h10a3.5 3.5 0 0 0 0-7z"/>'),
  };
})();
