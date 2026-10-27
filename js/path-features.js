/* ===========================
   path-features.js — v18 Potty Path feature squares. A square launches a real app flow (session profile
   cycle, event guide, holding guide, temporary wait, Simple Urge roll, May I change?, check-in, natural
   session, Natural Night, bedwetting sim). The board stores a "quest" and watches for the flow to finish
   (calendar entries, Simple Urge state, guide close, session main events), then feeds the result back
   (move, stars, mastery). A manual ✅ / 💦 / 🚽 fallback is always shown.
   Hard rules: real urge always wins; urgency/saturation user-entered; nights stay silent.
   =========================== */
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const hr = () => new Date().getHours();
  const evening = () => hr() >= 19 || hr() < 5;
  // minAccess: potty-access needed (0 = fine at no control). stages: allowed stage indexes. fx: reward on ✅.
  const F = (id, icon, name, d, x) => Object.assign({ id, icon, name, do: d, stages: [0, 1, 2, 3], minAccess: 0, fx: { stars: 1 } }, x);
  const FEATURES = [
    F('sess_dependent', '🔁', 'Session: Constant Incontinence', 'Complete 1 full cycle of the Constant Incontinence profile (one main event).', { stages: [0, 1], profile: 'dependent', fx: { stars: 3, move: 2 } }),
    F('sess_npt', '🔁', 'Session: Not Potty Trained', 'Complete 1 full cycle of the Not Potty Trained profile (one main event).', { stages: [0, 1, 2], profile: 'npt', fx: { stars: 3, move: 2 } }),
    F('sess_rookie', '🔁', 'Session: Struggle to Control', 'Complete 1 full cycle of the Struggle to Control profile.', { stages: [1, 2], profile: 'train_rookie', minAccess: 0.2, fx: { stars: 3, move: 2 } }),
    F('sess_babysitter', '🔁', 'Session: Babysitter', 'Complete 1 full cycle of the Babysitter profile.', { stages: [1, 2, 3], profile: 'babysitter', fx: { stars: 3, move: 2 } }),
    F('sess_pro', '🔁', 'Session: Retaining Control', 'Complete 1 full cycle of the Retaining Control profile.', { stages: [2, 3], profile: 'train_pro', minAccess: 0.5, fx: { stars: 3, move: 2 } }),
    F('guide_event', '▶', 'Event guide', 'Follow one event guide in your protection, start to finish.', { stages: [0, 1, 2], intensity: s => ['light', 'moderate', 'moderate', 'light'][s], fx: { stars: 1, move: 1 } }),
    F('guide_hold', '🧘', 'Holding guide', 'Follow a short holding guide.', { stages: [2, 3], minAccess: 0.5, fx: { stars: 2, move: 1 } }),
    F('temp_wait', '⏳', 'Temporary wait', 'A short timer runs before your next go. When it rings, roll again.', { stages: [1, 2, 3], minAccess: 0.3, wait: [3, 10], fx: { stars: 1 } }),
    F('su_roll', '🙋', 'Natural Urge roll', 'Open the Urge tab, press I need to go, and follow what it says.', { fx: { stars: 1 } }),
    F('may_change', '🧷', 'May I change?', 'Do a May I change? roll (enter your saturation).', { fx: { stars: 1 }, mastery: 'acc' }),
    F('checkin_app', '📋', 'Status check-in', 'Set your urgency and saturation in the status bar.', { fx: { stars: 1 } }),
    F('nat_session', '🌿', 'Natural session', 'Start and finish a natural session (any length).', { fx: { stars: 2, move: 1 } }),
    F('night_nn', '🌙', 'Natural Night', 'Tonight: run Natural Night (silent) and do the morning check-in.', { evening: true, fx: { stars: 2 }, mastery: 'bed' }),
    F('bedwet_sim', '🛏', 'Bedwetting sim', 'Tonight: run the Bedwetting session (silent) to the morning.', { evening: true, stages: [0, 1, 2], fx: { stars: 2 } })
  ];
  const BY = FEATURES.reduce((a, f) => (a[f.id] = f, a), {});
  /** Pure: pick a feature for a square. tag hint: checkin→checkin_app, prot→may_change, hold→guide_hold/temp_wait. */
  function pick(b, stage, tag, rng, access, now) {
    rng = rng || Math.random; const night = now != null ? (new Date(now).getHours() >= 19 || new Date(now).getHours() < 5) : evening();
    const ok = f => f.stages.includes(stage) && (access == null ? 1 : access) >= f.minAccess && (!f.evening || night);
    if (tag === 'checkin') return 'checkin_app';
    if (tag === 'prot') return 'may_change';
    if (tag === 'hold') return ok(BY.guide_hold) ? 'guide_hold' : ok(BY.temp_wait) ? 'temp_wait' : 'guide_event';
    // v31 a7: reduce mid-board full session-profile launches; keep guides / urge / nights
    const pool = FEATURES.filter(f => ok(f) && !['checkin_app', 'may_change'].includes(f.id) && !(f.profile && (stage === 1 || stage === 2)));
    if (!pool.length) { const fb = FEATURES.filter(f => ok(f) && !f.profile); return (fb[0] || FEATURES[0]).id; }
    return pool[Math.floor(rng() * pool.length)].id;
  }
  // ---------- signals from the rest of the app ----------
  const sig = { events: [], guideOpen: 0, guideClosed: 0 };
  function hook() {
    if (typeof W.applyEvent === 'function' && !W.applyEvent._bs18) { const o = W.applyEvent; const w = function (evt) { try { sig.events.push({ ts: Date.now(), kind: evt && evt.kind, mode: typeof profileMode !== 'undefined' ? profileMode : null }); } catch (e) {} return o.apply(this, arguments); }; w._bs18 = 1; W.applyEvent = w; }
    if (typeof W.startVoidGuide === 'function' && !W.startVoidGuide._bs18) { const o = W.startVoidGuide; const w = function () { sig.guideOpen = Date.now(); return o.apply(this, arguments); }; w._bs18 = 1; W.startVoidGuide = w; }
    if (typeof W.closeVoidGuide === 'function' && !W.closeVoidGuide._bs18) { const o = W.closeVoidGuide; const w = function () { sig.guideClosed = Date.now(); return o.apply(this, arguments); }; w._bs18 = 1; W.closeVoidGuide = w; }
  }
  const calSince = (since, test) => { try { return (W.BSCalendar.load().entries || []).filter(e => e.ts >= since && test(e)); } catch (e) { return []; } };
  function messyOn() {
    try {
      if (typeof isMessyEnabled === 'function') return !!isMessyEnabled();
      return JSON.parse(localStorage.getItem('messyModeEnabled') || 'false') === true;
    } catch (e) { return false; }
  }
  function messyTable(which) {
    try {
      if (which === 'hold' && typeof MESSY_HOLDING_GAUNTLETS_D10 !== 'undefined') return MESSY_HOLDING_GAUNTLETS_D10;
      if (which !== 'hold' && typeof MESSY_PUSHING_ACCIDENTS_D10 !== 'undefined') return MESSY_PUSHING_ACCIDENTS_D10;
    } catch (e) {}
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    return which === 'hold' ? (g.MESSY_HOLDING_GAUNTLETS_D10 || null) : (g.MESSY_PUSHING_ACCIDENTS_D10 || null);
  }
  /** Pee keeps the random void / hold generators. #2 (messy on) reuses MESSY_* tummy tables. */
  function guideFor(kind, which, stage, rng) {
    rng = rng || Math.random; which = which === 'hold' ? 'hold' : 'event';
    const poo = kind === 'poo';
    if (poo && !messyOn()) return { blocked: 'messy', seq: null, title: '', type: which === 'hold' ? 'gauntlet' : 'full', poo: true };
    if (poo) {
      const tbl = (messyTable(which) || []).filter(e => e && e.guide && e.guide.length);
      if (tbl.length) {
        const e = tbl[Math.floor(rng() * tbl.length)];
        const hold = which === 'hold';
        return {
          blocked: null, seq: e.guide.slice(), poo: true, name: e.name || '',
          type: hold ? 'gauntlet' : 'full',
          title: hold
            ? '<b>🎲 Potty Path #2:</b> ' + (e.name || 'Tummy hold') + ' — hold it in your protection. Tummy only.'
            : '<b>🎲 Potty Path #2:</b> ' + (e.name || 'Tummy') + ' — use protection or the potty. Tummy only.'
        };
      }
    }
    if (which === 'hold') return { blocked: null, seq: W.buildRandomGauntlet(stage >= 3 ? 'medium' : 'easy'), title: '<b>🎲 Potty Path holding guide.</b>', type: 'challenge', poo: false };
    const intensity = (BY.guide_event.intensity && BY.guide_event.intensity(stage)) || 'moderate';
    return { blocked: null, seq: W.generateRandomGuideSteps(intensity), title: '<b>🎲 Potty Path:</b> follow this guide in your protection.', type: 'micro', poo: false };
  }
  /** Launch the flow. Returns quest { id, since, ... }. */
  function launch(id, b, stage) {
    hook(); const f = BY[id], q = { id, since: Date.now(), stage };
    const go = t => { try { W.switchTab && W.switchTab(t); } catch (e) {} };
    try {
      if (f.profile) {
        const sel = document.getElementById('profileSelect');
        if (typeof sessionRunning !== 'undefined' && sessionRunning) { q.note = 'A session is already running — its next main event counts.'; }
        else if (sel) { sel.value = f.profile; if (typeof W.applySelectedProfile === 'function') W.applySelectedProfile(); go('session'); if (typeof W.startSession === 'function') W.startSession(); }
      } else if (id === 'guide_event' || id === 'guide_hold') {
        const kind = (b && b.pending && b.pending.kind) || 'pee';
        q.kind = kind;
        const g = guideFor(kind, id === 'guide_hold' ? 'hold' : 'event', stage, Math.random);
        if (g.blocked) q.note = 'Messy content is off — #2 guides stay hidden.';
        else if (typeof W.startVoidGuide === 'function' && g.seq) W.startVoidGuide(g.seq, g.title, g.type);
      }
      else if (id === 'temp_wait') { q.until = Date.now() + Math.min(20, f.wait[0] + Math.floor(Math.random() * (f.wait[1] - f.wait[0] + 1))) * 60000; }
      else if (id === 'su_roll') { const s = W.BSSimpleUrge && W.BSSimpleUrge.state(); q.lastId = s && s.last ? s.last.id : null; go('urge'); }
      else if (id === 'may_change') { W.BSChange && W.BSChange.open({ ctx: 'potty_path' }); }
      else if (id === 'checkin_app') { /* handled inline by the board sheet sliders */ }
      else if (id === 'nat_session') { W.BSNatSession && W.BSNatSession.openStart(); }
      else if (id === 'night_nn') { W.BSNight && W.BSNight.open(); }
      else if (id === 'bedwet_sim') { W.BSHub && W.BSHub.startBedwetting(); }
    } catch (e) { q.note = 'Could not open automatically — open it yourself, then come back.'; }
    return q;
  }
  /** Pure-ish: has the quest's flow finished? → null | { outcome:'ok'|'acc', info, wet? } */
  function detect(q, now) {
    now = now || Date.now(); if (!q) return null; const f = BY[q.id];
    if (f.profile) { const e = sig.events.find(x => x.ts >= q.since && x.kind === 'full'); return e ? { outcome: 'ok', info: 'Main event done in ' + f.name.replace('Session: ', '') } : null; }
    if (q.id === 'guide_event' || q.id === 'guide_hold') return sig.guideClosed >= q.since && sig.guideOpen >= q.since ? { outcome: 'ok', info: 'Guide finished' } : null;
    if (q.id === 'temp_wait') return now >= q.until ? { outcome: 'ok', info: 'Wait over' } : null;
    if (q.id === 'su_roll') { const s = W.BSSimpleUrge && W.BSSimpleUrge.state(); const l = s && s.last; if (!l || l.id === q.lastId) return null; const low = q.access != null && q.access < 0.3; return { outcome: l.outcome === 'gear' && !low && q.stage >= 2 ? 'acc' : 'ok', info: 'Urge: ' + (l.text || l.outcome) }; }
    if (q.id === 'may_change') return calSince(q.since, e => e.mode === 'change_roll').length ? { outcome: 'ok', info: 'Change roll done' } : null;
    if (q.id === 'nat_session') return calSince(q.since, e => e.mode === 'nat_session').length ? { outcome: 'ok', info: 'Natural session logged' } : null;
    if (q.id === 'night_nn' || q.id === 'bedwet_sim') { const n = calSince(q.since, e => e.type === 'night'); return n.length ? { outcome: 'ok', info: n[0].night && n[0].night.wet ? 'Wet night logged' : 'Dry night logged', wet: !!(n[0].night && n[0].night.wet) } : null; }
    return null;
  }
  // ---------- watcher ----------
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('load', hook);
    setInterval(() => { try { const P = W.BSPath; const b = P && P.load(); if (!b || !b.quest) return; const r = detect(b.quest); if (r) { P.finishQuest(r); if (typeof toast === 'function') toast('🎲 Potty Path: ' + r.info + ' — result added'); if (typeof currentTab === 'function' && currentTab() === 'path') P.render(); } } catch (e) {} }, 2000);
  }
  W.BSPathFeatures = { FEATURES, BY, pick, launch, detect, hook, sig, guideFor, messyOn };
})();
