/* ===========================
   simple-urge.js — Simple Urge (default view of the Urge tab), v11.
   Press "I need to go" → one short instruction rolled from the active Natural Urge Control
   profile: a preset ladder level (Full/Good/Okay/Shaky/Little/None), "Match my profile" (Control meter,
   seeded from the quiz) or a custom profile the user made. Custom events can be mixed in per level.
   Hidden waits (low control or profile toggle) show only "✋ Wait": no duration, one optional end alarm,
   the length is revealed only when it ends. Urgency is ALWAYS user-entered (unset = no modifier).
   Supplies use the shared protection list (none/pad/pullups/diapers/thick_diapers) with a daily reset prompt.
   "Had an accident" (real) is always one tap away → BSAccident sheet. Game rules only; a real urge always wins.
   =========================== */
(function () {
  const SKEY = 'bs_simple_urge_v1', IKEY = 'bs_inventory_v1', TKEY = 'bs_simple_urge_state';
  const PKEY = 'bs_urge_profiles_v1', EKEY = 'bs_urge_events_v1', LKEY = 'bs_urge_level_odds_v1';
  const ALARM_ID = 1950; // outside babysitter range 1100-1899
  const OUT = ['go', 'wait', 'hard', 'dribble', 'gear'];
  const OUT_LABEL = { go: 'Go now', wait: 'Wait', hard: 'Hold till hard', dribble: 'Wait for dribble', gear: 'Use gear' };
  const LV = ['fully_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent'];
  const PROT = ['none', 'pad', 'pullups', 'diapers', 'thick_diapers'];
  const SPARE = PROT.slice(1);
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const officeOn = () => !!(window.BSOffice && window.BSOffice.on());
  const sw = s => officeOn() && window.BSOffice ? window.BSOffice.swap(s) : s;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => new Date().toDateString();
  const L = () => window.BSControl ? window.BSControl.LADDER : [];
  function protLabel(v) { try { const o = window.BSCalendar.protectionOptions().find(x => x.value === v); if (o) return o.label; } catch (e) {} return { none: 'Nothing', pad: 'Pad', pullups: 'Pull-ups', diapers: 'Diapers', thick_diapers: 'Thick diapers' }[v] || v; }
  const one = v => protLabel(v).replace(/s$/, '').toLowerCase();

  // ---------- settings ----------
  function settings() { return Object.assign({ profileId: 'match', fastFill: false, quietSignals: false, alarm: true, askUrgency: true, useCalib: false, hideWaits: false, waveCluster: false, lastUrgency: null, afterSmall: '', type: 1 }, J(SKEY, {})); }
  function messyOn() { try { if (typeof isMessyEnabled === 'function') return !!isMessyEnabled(); return JSON.parse(localStorage.getItem('messyModeEnabled') || 'false') === true; } catch (e) { return false; } }
  function urgeType() { const t = settings().type === 2 ? 2 : 1; return t === 2 && !messyOn() ? 1 : t; }
  function messyRows(which) {
    let tbl = null;
    try {
      if (which === 'hold' && typeof MESSY_HOLDING_GAUNTLETS_D10 !== 'undefined') tbl = MESSY_HOLDING_GAUNTLETS_D10;
      if (which !== 'hold' && typeof MESSY_PUSHING_ACCIDENTS_D10 !== 'undefined') tbl = MESSY_PUSHING_ACCIDENTS_D10;
    } catch (e) {}
    if (!tbl) { const g = typeof globalThis !== 'undefined' ? globalThis : {}; tbl = which === 'hold' ? g.MESSY_HOLDING_GAUNTLETS_D10 : g.MESSY_PUSHING_ACCIDENTS_D10; }
    return (tbl || []).filter(e => e && e.guide && e.guide.length);
  }
  function pickMessy(which, rng) {
    rng = rng || Math.random; const rows = messyRows(which); if (!rows.length) return null;
    const e = rows[Math.floor(rng() * rows.length)], hold = which === 'hold';
    return { label: e.name || (hold ? 'Tummy hold' : 'Tummy'), flow: e.desc || (hold ? 'Hold the tummy feeling in your protection.' : 'Tummy — use protection or the potty.'), guide: e.guide.slice(), kind: hold ? 'hold' : 'push', name: e.name || '' };
  }
  function tummyCantWait() {
    try { if (window.BSCampaign && window.BSCampaign.tummyOn && window.BSCampaign.tummyOn()) return true; } catch (e) {}
    try { const b = window.BSPath && window.BSPath.load && window.BSPath.load(); if (b && b.flags && b.flags.tummy) return true; } catch (e) {}
    return false;
  }
  function clearTummy() { try { if (window.BSCampaign && window.BSCampaign.setTummy) window.BSCampaign.setTummy(false, { fromPath: true }); } catch (e) {} }
  function saveSettings(p) { localStorage.setItem(SKEY, JSON.stringify(Object.assign(settings(), p))); }

  // ---------- custom profiles / events / level tables ----------
  function customProfiles() { return J(PKEY, []); }
  function saveCustomProfiles(l) { localStorage.setItem(PKEY, JSON.stringify(l)); }
  function upsertProfile(p) {
    const l = customProfiles(); const id = p.id || ('cp' + Date.now().toString(36));
    const o = Object.fromEntries(OUT.map(k => [k, Math.max(0, +((p.odds || {})[k]) || 0)]));
    const lo = Math.max(1, +(p.wait || [])[0] || 5), hi = Math.max(lo, +(p.wait || [])[1] || lo);
    const n = { id, name: String(p.name || 'My profile').slice(0, 40), wait: [lo, hi], odds: o, hiddenWait: !!p.hiddenWait, traits: { fastFill: !!(p.traits || {}).fastFill, quietSignals: !!(p.traits || {}).quietSignals }, level: p.level || null };
    const i = l.findIndex(x => x.id === id); if (i >= 0) l[i] = n; else l.push(n); saveCustomProfiles(l); return n;
  }
  function deleteProfile(id) { saveCustomProfiles(customProfiles().filter(x => x.id !== id)); if (settings().profileId === id) saveSettings({ profileId: 'match' }); }
  function customEvents() { return J(EKEY, []); }
  function saveCustomEvents(l) { localStorage.setItem(EKEY, JSON.stringify(l)); }
  function upsertEvent(e) {
    const l = customEvents(); const id = e.id || ('ce' + Date.now().toString(36));
    const n = { id, text: String(e.text || 'Custom event').slice(0, 160), weight: Math.max(0, Math.min(100, +e.weight || 0)), levels: (e.levels || []).filter(k => L().some(x => x.key === k)),
      guide: (e.guide || []).filter(g => g && g.text).map(g => ({ text: String(g.text).slice(0, 40), time: Math.max(1, Math.min(120, +g.time || 3)), type: ['push', 'relax', 'stop'].includes(g.type) ? g.type : 'stop' })).slice(0, 12),
      timer: ['none', 'shown', 'hidden'].includes(e.timer) ? e.timer : 'none', min: Math.max(1, +e.min || 5), max: Math.max(+e.min || 5, +e.max || +e.min || 10), enabled: e.enabled !== false };
    const i = l.findIndex(x => x.id === id); if (i >= 0) l[i] = n; else l.push(n); saveCustomEvents(l); return n;
  }
  function deleteEvent(id) { saveCustomEvents(customEvents().filter(x => x.id !== id)); }
  function levelOdds() { return J(LKEY, {}); }
  function saveLevelOdds(o) { localStorage.setItem(LKEY, JSON.stringify(o || {})); }
  function ladderOdds(key) { const ov = levelOdds()[key]; if (ov) return Object.assign(Object.fromEntries(OUT.map((k, i) => [k, lOddsFallback(key)[k]])), ov); return lOddsFallback(key); }
  function lOddsFallback(key) { const M = window.BSUrgeMatrix; if (M && M.MATRIX[key]) return Object.assign({}, M.cell(key, 5)); const l = window.BSControl && window.BSControl.level(key); return l ? Object.fromEntries(OUT.map((k, i) => [k, l.odds[i]])) : { go: 30, wait: 30, hard: 15, dribble: 10, gear: 15 }; }
  function exportJSON() { return JSON.stringify({ app: 'bladder-sim-urge', version: 1, profiles: customProfiles(), events: customEvents(), levelOdds: levelOdds(), settings: { profileId: settings().profileId } }, null, 1); }
  function importJSON(txt) {
    const d = typeof txt === 'string' ? JSON.parse(txt) : txt; if (!d || d.app !== 'bladder-sim-urge') throw new Error('Not a Bladder Sim urge export');
    (d.profiles || []).forEach(p => upsertProfile(p)); (d.events || []).forEach(e => upsertEvent(e));
    if (d.levelOdds && typeof d.levelOdds === 'object') saveLevelOdds(Object.assign(levelOdds(), d.levelOdds));
    return { profiles: (d.profiles || []).length, events: (d.events || []).length };
  }

  /** Quiz-only level (used when no Control meter exists yet) — kept for compatibility. */
  function autoProfile() {
    const Q = window.BSQuiz, qd = Q ? Q.load() : {}; let base = qd.baseline; if (!base && qd.a && Q) base = Q.scoreA(qd.a);
    const li = base ? base.levelIdx : 1;
    return { level: LV[li], levelIdx: li, sources: base ? ['quiz'] : ['default'] };
  }
  /** Resolve the active profile → { id, name, levelKey, levelIdx, level, hold, odds, hiddenWait, fastFill, quietSignals, sources } */
  function profile(id) {
    const s = settings(); id = id || s.profileId || 'match';
    let lk, name, hold, odds, hidden, ff = s.fastFill, qs = s.quietSignals, src = [];
    const cp = customProfiles().find(x => x.id === id);
    if (cp) {
      lk = cp.level || (window.BSControl ? window.BSControl.band() : 'okay'); name = cp.name; hold = cp.wait.slice(); odds = Object.assign({}, cp.odds); hidden = cp.hiddenWait;
      ff = ff || cp.traits.fastFill; qs = qs || cp.traits.quietSignals; src.push('custom profile');
    } else {
      if (id === 'off') { lk = 'off'; src.push('not participating'); }
      else if (id === 'match' || !L().some(x => x.key === id)) { lk = window.BSControl ? window.BSControl.band() : 'okay'; id = 'match'; src.push('Control meter ' + Math.round(window.BSControl ? window.BSControl.load().value : 60)); }
      else { lk = id; src.push('preset'); }
      const l = (window.BSControl && window.BSControl.level(lk)) || { label: lk, wait: [5, 15], hidden: false };
      name = (id === 'match' ? 'Match my profile → ' : '') + (window.BSControl ? window.BSControl.label(l, officeOn()) : l.label); hold = l.wait.slice(); odds = ladderOdds(lk); hidden = l.hidden;
      if (levelOdds()[lk]) src.push('edited table');
    }
    if (s.useCalib) { try { const Cb = window.BSCalib, t = Cb ? Cb.load().trials : []; const sm = t.length ? Cb.summarize(t) : null; if (sm && sm.medianMl && sm.medianMl < 250) { hold = hold.map(x => Math.max(1, Math.round(x * 0.8))); src.push('calibration (opt-in)'); } } catch (e) {} }
    if (s.holdOverride) hold = s.holdOverride.slice(); // dev/test hook (pre-v11 API)
    if (s.oddsOverride) odds = Object.assign({}, odds, s.oddsOverride);
    const lv = L().find(x => x.key === lk); const li = lv ? lv.li : 1;
    return { id, name, levelKey: lk, levelIdx: li, level: LV[li], hold, odds, hiddenWait: !!(hidden || s.hideWaits), fastFill: ff, quietSignals: qs, sources: src };
  }

  // ---------- pure roll ----------
  /** opts { urgency 0-10|null, rng, chain, profile, fastFill, quietSignals, events } → result */
  // v19: matrix is the single source of truth. POTTY_ACCESS kept as a read of rank for Path Features.
  const POTTY_ACCESS = { full: 1, good: 1, okay: 1, shaky: 0.35, little: 0.1, none: 0 };
  function sliderValue(s) { s = s || settings(); return s.lastUrgency == null ? null : Math.max(0, Math.min(10, +s.lastUrgency)); }
  function roll(opts) {
    opts = opts || {}; const rng = opts.rng || Math.random;
    const p = opts.profile || profile();
    const u = opts.urgency == null || opts.urgency === '' ? null : Math.max(0, Math.min(10, Math.round(+opts.urgency)));
    const M = window.BSUrgeMatrix, V = window.BSVoice;
    const level = p.levelKey === 'off' ? 'full' : (p.levelKey || 'okay');
    // Base odds from the matrix cell (urgency × rank). Custom profile odds are reshaped to the same urgency curve.
    let w;
    if (M) {
      const cell = M.cell(level, u);
      if (opts.profile && opts.profile.id && opts.profile.id !== 'match' && !['full','good','okay','shaky','little','none','off'].includes(opts.profile.id) && p.odds) {
        w = M.shape(Object.assign({ go: 0, wait: 0, hard: 0, dribble: 0, gear: 0 }, p.odds), level, u);
      } else w = Object.assign({}, cell);
    } else { w = Object.assign({ go: 30, wait: 30, hard: 15, dribble: 10, gear: 15 }, p.odds); }
    // Symptoms / traits (keep small)
    if (opts.fastFill != null ? opts.fastFill : p.fastFill) { w.gear *= 1.15; w.wait *= 0.85; }
    if (opts.quietSignals != null ? opts.quietSignals : p.quietSignals) { w.dribble = Math.min(15, w.dribble * 1.4); }
    // v32: active class oddsMod (Dribbler/Leaky, Fast Filler, etc.) — mechanical, not flavor
    try { if (window.BSClasses && window.BSClasses.applyOdds) w = window.BSClasses.applyOdds(w); } catch (e) {}
    // Chain lean: each re-roll inside one urge nudges toward a terminal outcome.
    const chain = Math.min(M ? M.MAX_CHAIN : 3, Math.max(0, opts.chain || 0));
    if (chain > 0) {
      const lean = chain * 0.12;
      ['wait', 'hard'].forEach(k => { const take = w[k] * lean; w[k] -= take; w.gear += take * 0.7; w.go += take * 0.3; });
    }
    if (opts.final || (M && chain >= M.MAX_CHAIN)) w = M ? M.finalRoll(w, level) : w;
    // Custom events (user-defined) still mix in at their own weight
    const evs = (opts.events || customEvents()).filter(e => e.enabled !== false && e.weight > 0 && (!e.levels.length || e.levels.includes(p.levelKey)));
    const keys = OUT.concat(evs.map(e => 'ev:' + e.id)); evs.forEach(e => { w['ev:' + e.id] = e.weight; });
    const tot = keys.reduce((t, k) => t + Math.max(0, w[k] || 0), 0) || 1; let r = rng() * tot, pick = 'go';
    for (const k of keys) { r -= Math.max(0, w[k] || 0); if (r < 0) { pick = k; break; } }
    const ev = pick.startsWith('ev:') ? evs.find(e => 'ev:' + e.id === pick) : null;
    const outcome = ev ? 'custom' : pick;
    let waitMin = 0, hidden = false;
    if (outcome === 'wait') {
      const [lo, hi] = p.hold; waitMin = lo + rng() * Math.max(0, hi - lo);
      if (u != null) waitMin *= 1 - u / 25;
      try { if (window.BSHub && window.BSHub.softOn && window.BSHub.softOn()) waitMin *= 0.65; } catch (e) {}
      waitMin = Math.max(1, Math.min(20, Math.round(waitMin)));
      hidden = !!p.hiddenWait;
    }
    if (ev && ev.timer !== 'none') { waitMin = Math.max(1, Math.min(20, Math.round(ev.min + rng() * Math.max(0, ev.max - ev.min)))); hidden = ev.timer === 'hidden'; }
    try {
      const hs = window.BSClasses && window.BSClasses.holdScale ? window.BSClasses.holdScale() : 1;
      if (waitMin > 0 && hs && hs !== 1) waitMin = Math.max(1, Math.min(20, Math.round(waitMin * hs)));
    } catch (e) {}
    try { if (window.BSPathPlay && window.BSPathPlay.timerFog && window.BSPathPlay.timerFog()) hidden = true; } catch (e) {}
    const cont = (M && !ev && ['gear', 'dribble', 'hard'].includes(outcome)) ? M.content(level, outcome, u, rng) : null;
    const voice = V ? V.getVoice() : 'caregiver';
    const voiceLine = V ? V.line(outcome === 'custom' ? 'gear' : outcome, voice, rng) : '';
    const res = { id: 'r' + Date.now().toString(36) + Math.floor(rng() * 1e4), outcome, waitMin, hidden, urgency: u, weights: w, range: p.hold, gear: null, content: cont, voice: voiceLine, voiceKey: voice,
      levelKey: p.levelKey, profileName: p.name, access: POTTY_ACCESS[level] != null ? POTTY_ACCESS[level] : 1, lowControl: (POTTY_ACCESS[level] || 1) < 0.5, chain,
      event: ev ? { id: ev.id, text: ev.text, guide: ev.guide, timer: ev.timer } : null };
    // v32 class eventSteps (e.g. Leaky/Dribbler micro leak before go)
    try {
      const steps = window.BSClasses && window.BSClasses.eventStepsFor ? window.BSClasses.eventStepsFor(res.outcome) : [];
      if (steps.length && (res.outcome === 'go' || res.outcome === 'wait')) {
        res.eventSteps = steps;
        res.micro = steps[0].micro;
        if (steps[0].text) res.stepText = steps[0].text;
      }
      if (window.BSClasses && window.BSClasses.needDribbleFirst && window.BSClasses.needDribbleFirst() && res.outcome === 'go') {
        if (!(window.BSClasses.hasRecentDribble && window.BSClasses.hasRecentDribble())) {
          res.outcome = 'dribble'; res.stepText = 'Log a small dribble first, then press again for potty permission.';
          res.gated = 'dribble';
        }
      }
    } catch (e) {}
    if (p.levelKey === 'off') { res.outcome = 'go'; res.waitMin = 0; res.hidden = false; res.event = null; res.content = null; }
    if (res.outcome === 'gear') {
      const lv = window.BSControl && window.BSControl.level(p.levelKey); let sp = lv ? lv.split : [20, 40, 40];
      // At high urgency, skew toward major (realism, not training)
      if (u != null && u >= 9) sp = [5, 25, 70]; else if (u != null && u >= 7) sp = [10, 35, 55];
      const x = rng() * 100; res.severity = x < sp[0] ? 'dribble' : x < sp[0] + sp[1] ? 'small' : 'major';
      res.gear = cont || pickGear(res.severity === 'major' ? 8 : 4, rng);
    }
    if (res.outcome === 'dribble' && cont) res.gear = cont;
    if (res.outcome === 'hard' && cont) res.gear = cont;
    res.type = (opts.type === 2 || (opts.type == null && urgeType() === 2)) && messyOn() ? 2 : 1;
    if (res.type === 2 && !res.event) {
      if (res.outcome === 'hard') { const h = pickMessy('hold', rng); if (h) { res.content = h; res.gear = h; } }
      else if (res.outcome === 'gear' || res.outcome === 'dribble') { const h = pickMessy('push', rng); if (h) { res.content = h; res.gear = h; } }
    }
    res.text = describe(res);
    if (res.stepText) res.text = res.stepText + (res.text ? ' · ' + res.text : '');
    if (opts.quick) res.quick = true;
    try {
      if (window.BSHub && window.BSHub.naturalPlayOn && window.BSHub.naturalPlayOn() && res.outcome === 'gear') {
        const ch = window.BSHub.naturalOfficeChoice(rng);
        const kept = (res.content && res.content.guide) || (res.gear && res.gear.guide);
        res.outcome = 'natural'; res.waitMin = 0; res.hidden = false; res.gear = null; res.content = null;
        res.severity = null; res.voice = ''; res.natural = ch; res.text = (res.type === 2 ? '💩 #2 · ' : '') + ch.text; res.stepText = '';
        if (res.type === 2 && kept) res.pooGuide = kept;
      }
    } catch (e) {}
    if (res.type === 2 && tummyCantWait() && (res.outcome === 'wait' || res.outcome === 'natural' || res.outcome === 'hard')) {
      res.outcome = 'go'; res.waitMin = 0; res.hidden = false; res.tummy = true; res.natural = null; res.stepText = '';
      res.text = "🌀 Tummy trouble: this #2 can't wait — skip any waits.";
    }
    if (res.type === 2 && res.outcome === 'go' && !(res.pooGuide && res.pooGuide.length)) {
      if (res.tummy) res.pooGuide = [{ text: 'TUMMY — POTTY OR PROTECTION', time: 0, type: 'stop' }];
      else { const h = pickMessy('push', rng); if (h) res.pooGuide = h.guide; }
    }
    return res;
  }
  function pickGear(u, rng, type) {
    type = type == null ? urgeType() : type;
    if (type === 2 && messyOn()) { const h = pickMessy(u >= 7 ? 'push' : 'hold', rng); if (h) return h; }
    const M = window.BSUrgeMatrix; if (M && type !== 2) { const c = M.content('okay', u >= 7 ? 'gear' : 'dribble', u, rng); if (c) return c; }
    const tbl = u >= 7 && typeof FULL_D20 !== 'undefined' ? FULL_D20 : (typeof MICRO_DIAPER_D8 !== 'undefined' ? MICRO_DIAPER_D8 : []);
    const ev = tbl.filter(e => e.guide && e.guide.length); const e = ev[Math.floor((rng || Math.random)() * ev.length)];
    return e ? { label: e.label, flow: e.flow, guide: e.guide, kind: u >= 7 ? 'full' : 'micro' } : null;
  }
  function describe(res) {
    if (res && res.tummy) return "🌀 Tummy trouble: this #2 can't wait — skip any waits.";
    const t = describeRaw(res);
    if (res && res.type === 2 && t && !/#2|tummy/i.test(t)) return '💩 #2 · ' + t;
    return t;
  }
  function describeRaw(res) {
    if (res.voice && (res.outcome === 'go' || res.outcome === 'wait' || (!res.content && !res.gear))) {
      if (res.outcome === 'wait' && !res.hidden) return res.voice + ` (${res.waitMin} min)`;
      if (res.outcome === 'wait' && res.hidden) return res.voice;
      if (res.outcome === 'go') return res.voice;
    }
    if (res.content || (res.gear && res.gear.label)) {
      const c = res.content || res.gear; const head = res.voice ? res.voice + ' · ' : '';
      return head + (c.label ? c.label + (c.flow ? ': ' + c.flow : '') : (c.flow || describe0(res)));
    }
    return describe0(res);
  }
  function describe0(res) {
    switch (res.outcome) {
      case 'go': return 'Go now.';
      case 'wait': return res.hidden ? '✋ Wait.' : `Wait ${res.waitMin} min, then roll again.`;
      case 'hard': return 'Hold until it gets hard, then roll again.';
      case 'dribble': return 'A little leak. Follow the steps, then roll again.';
      case 'gear': return `Use your padding${res.severity ? ' (' + { dribble: 'just a dribble', small: 'small accident', major: 'major accident' }[res.severity] + ')' : ''}${res.gear ? ': ' + res.gear.label : ''}.`;
      case 'custom': return (res.event ? res.event.text : 'Custom event') + (res.event && res.event.timer === 'shown' ? ` (${res.waitMin} min)` : res.event && res.event.timer === 'hidden' ? ' ✋' : '');
    }
    return '';
  }
  const COLOR = { go: '#55efc4', wait: '#74b9ff', hard: '#fdcb6e', dribble: '#a29bfe', gear: '#ff7675', custom: '#fd79a8', natural: '#00cec9' };

  // ---------- inventory (shared protection list, B9/B10) ----------
  function recDay() { try { const R = window.BSReport, d = R && R.gather ? R.gather() : null; const r = d && R.recommendWear(d); if (r && r.day) return r.day; } catch (e) {} try { const q = window.BSQuiz.load(); if (q && q.a && q.a.protDay) return q.a.protDay; } catch (e) {} return 'pullups'; }
  function DEF_INV() { const w = recDay(); const sp = Object.fromEntries(SPARE.map(k => [k, 0])); if (w !== 'none') sp[w] = 2; return { day: today(), wearing: w, wetCount: 0, spares: sp, changes: 0 }; }
  function migrate(i) {
    const map = { pullup: 'pullups', diaper: 'diapers' };
    if (map[i.wearing]) i.wearing = map[i.wearing]; if (!PROT.includes(i.wearing)) i.wearing = 'none';
    const sp = Object.fromEntries(SPARE.map(k => [k, 0])); Object.keys(i.spares || {}).forEach(k => { const t = map[k] || k; if (sp[t] != null) sp[t] += Math.max(0, +i.spares[k] || 0); }); i.spares = sp; return i;
  }
  function inv() { const i = J(IKEY, null); return i ? migrate(Object.assign({ day: today(), wearing: 'none', wetCount: 0, spares: {}, changes: 0 }, i)) : Object.assign(DEF_INV(), { day: null }); }
  function saveInv(i) { localStorage.setItem(IKEY, JSON.stringify(migrate(i))); try { window.dispatchEvent(new Event('bs:inventory')); } catch (e) {} }
  function needsDailyReset() { return inv().day !== today(); }
  function invText(i) { i = i || inv(); const sp = SPARE.filter(k => i.spares[k]).map(k => `${i.spares[k]} ${i.spares[k] === 1 ? one(k) : protLabel(k).toLowerCase()}`); return `Wearing: ${protLabel(i.wearing)}${i.wearing !== 'none' && i.wetCount ? ` (used ${i.wetCount}×)` : ''} · Spares: ${sp.length ? sp.join(', ') : 'none'}`; }
  function useGear() { const i = inv(); i.wetCount++; saveInv(i); try { window.BSChange && window.BSChange.noteWetting(); } catch (e) {} return i; }
  /** Change into a spare of `type` (decrements). Returns false when none left. */
  function change(type) {
    const map = { pullup: 'pullups', diaper: 'diapers' }; type = map[type] || type;
    const i = inv(); if (!i.spares[type]) return false;
    i.spares[type]--; i.wearing = type; i.wetCount = 0; i.changes++; i.changedAt = Date.now(); saveInv(i);
    log(`🔄 Changed into a fresh ${one(type)}. ${invText(i)}`, '#55efc4');
    try { window.BSCalendar && window.BSCalendar.addEntry({ source: 'sim', mode: 'simple_urge', type: 'change', protection: type, memo: 'Change — ' + invText(i) }); } catch (e) {}
    try { window.BSNatSession && window.BSNatSession.note({ k: 'change', text: 'Changed into ' + one(type) }); } catch (e) {}
    return true;
  }

  // ---------- state / record ----------
  function st() { return Object.assign({ last: null, accFor: null, chain: 0, waitUntil: 0, waitStart: 0, fired: true, revealed: null }, J(TKEY, {})); }
  function saveSt(x) { localStorage.setItem(TKEY, JSON.stringify(x)); }
  function log(text, color) { try { typeof logToOutput === 'function' && logToOutput(`<span style="color:${color || '#cdd7e6'}">${esc(sw(text))}</span>`); } catch (e) {} }
  function ctlEvent(k) { try { window.BSControl && window.BSControl.event(k); } catch (e) {} }
  function record(res) {
    let i = null;
    if (res.outcome === 'gear') { i = useGear(); ctlEvent('gear'); } else if (res.outcome === 'go') ctlEvent('go');
    else if (res.outcome === 'natural') { /* choice only — potty or hold is logged when they pick */ }
    log(`🙋 Simple urge (${res.urgency == null ? 'urgency not set' : res.urgency + '/10'}, ${res.profileName}): ${res.text}${i ? ' ' + invText(i) : ''}`, COLOR[res.outcome]);
    try { window.BSNatSession && window.BSNatSession.note({ k: 'roll', outcome: res.outcome, text: res.text, roll: res.id, type: res.type || 1 }); } catch (e) {}
    if (res.type === 2 && (res.outcome === 'go' || res.outcome === 'gear')) clearTummy();
    try {
      const C = window.BSCalendar; if (!C) return;
      const b = { source: 'sim', mode: 'simple_urge', memo: res.text, event: { kind: 'urge', label: res.text }, link: { roll: res.id } };
      if (res.urgency != null) b.urgency = res.urgency * 10;
      let e;
      if (res.type === 2) b.messy = true;
      if (res.outcome === 'go') e = C.addEntry(Object.assign(b, { type: 'potty' }));
      else if (res.outcome === 'gear') e = C.addEntry(Object.assign(b, { type: res.severity === 'dribble' ? 'leak' : 'accident', severity: { dribble: 'damp', small: 'wet', major: 'soaked' }[res.severity] || 'wet', protection: i ? i.wearing : 'none' }));
      else e = C.addEntry(Object.assign(b, { type: 'event' }));
      res.calId = e && e.id; res.calBody = b;
    } catch (e) { console.warn('simple urge calendar failed', e); }
  }

  // ---------- v13: post-accident follow-up (permission now OR a wait timer before the next roll) ----------
  const FKEY = 'bs_simple_urge_follow';
  const ri = (a, b, rng) => a + Math.floor((rng || Math.random)() * (b - a + 1));
  /** Pure: accident size + level (+ user-entered saturation) → follow-up step. severity dribble|leak|full. */
  function followUpFor(o) {
    o = o || {}; const rng = o.rng || Math.random;
    const lvl = (window.BSControl && window.BSControl.level(o.level)) || null;
    const li = lvl ? lvl.li : 2, th = o.threshold != null ? +o.threshold : (lvl && lvl.change ? lvl.change.threshold : 40);
    const sev = ['dribble', 'leak', 'full'].includes(o.severity) ? o.severity : 'leak';
    const sat = o.sat == null || o.sat === '' ? null : +o.sat;
    let kind, waitMin = 0, check = false;
    // v14 S8: "After a small accident" (finish|stay|wait|ask|dice|level). Major accidents always rest.
    let mode = ['finish', 'stay', 'wait', 'ask', 'dice', 'level'].includes(o.afterSmall) ? o.afterSmall : 'level';
    if (sev !== 'full' && mode === 'dice') { const wt = { finish: li <= 1 ? 3 : li === 2 ? 1 : 0.5, wait: 1, stay: li >= 3 ? 3 : 0.5 }; let r = rng() * (wt.finish + wt.wait + wt.stay); mode = (r -= wt.finish) < 0 ? 'finish' : (r -= wt.wait) < 0 ? 'wait' : 'stay'; }
    if (sev !== 'full' && mode !== 'level') {
      check = sev === 'leak';
      if (mode === 'finish') kind = 'finish';
      else if (mode === 'ask') kind = 'ask';
      else if (mode === 'wait') { kind = 'wait'; waitMin = sev === 'dribble' ? ri(5, 10, rng) : ri(10, 15, rng); }
      else { kind = 'stay'; waitMin = sev === 'dribble' ? ri(10, 20, rng) : ri(15, 20, rng); }
    }
    else if (sev === 'dribble') { if (li <= 1) kind = 'finish'; else if (li === 2) { if (rng() < 0.5) kind = 'finish'; else { kind = 'wait'; waitMin = ri(5, 10, rng); } } else { kind = 'stay'; waitMin = ri(10, 20, rng); } }
    else if (sev === 'leak') { check = true; if (li <= 1) kind = 'finish'; else if (li === 2) { kind = 'wait'; waitMin = ri(10, 15, rng); } else { kind = 'stay'; waitMin = ri(15, 20, rng); } }
    else { kind = 'rest'; check = true; waitMin = ri(15, 20, rng); }
    let steps = [];
    if (kind === 'finish') steps.push(sev === 'dribble' ? 'Permission granted: go finish on the potty now.' : 'Permission granted: go finish on the potty now, then check your gear.');
    if (kind === 'wait') steps.push(`Stay in your protection. Wait ${waitMin} min, then roll again.`);
    if (kind === 'stay') steps.push(`No potty for now — stay in your protection. Wait ${waitMin} min before the next roll.`);
    if (kind === 'ask') steps.push('Your choice this time: finish on the potty now, or stay in your protection for a while.');
    if (kind === 'rest') steps.push(`That was a big one — you're empty now. Rest ${waitMin} min before the next roll.`);
    if (sev !== 'full' && mode === 'level') steps.push(kind === 'finish' ? "You're not done yet — finish on the potty, don't stop halfway." : kind === 'wait' ? "You're not done — when the timer ends, ask again (roll)." : "You're not done — you'll roll again when the timer ends.");
    let change = null;
    if (check) {
      if (sat == null) { change = 'ask'; steps.push(`Check your saturation: at ${th} or more you may change (use 🎲 May I change?); below that, stay in it.`); }
      else if (sat >= th) { change = 'yes'; steps.push(`Saturation ${sat} ≥ change rule ${th}: change now.`); }
      else { change = 'no'; steps.push(`Saturation ${sat} is under the change rule (${th}): stay in it for now.`); }
    }
    try {
      if (window.BSHub && window.BSHub.naturalPlayOn && window.BSHub.naturalPlayOn()) {
        const hold = Math.max(1, Math.min(20, waitMin || 10));
        const line = window.BSHub.naturalGearText(hold);
        steps = steps.map(s => /protection|padding|your gear/i.test(s) ? line : s);
        if (kind === 'stay' || kind === 'wait') waitMin = hold;
      }
    } catch (e) {}
    return { severity: sev, afterSmall: mode, kind, waitMin, check, change, threshold: th, sat, level: lvl ? lvl.key : null, text: steps[0], steps };
  }
  /** v14 S8: Simple Urge setting wins; otherwise the campaign quiz answer (prefs.afterAcc); otherwise 'level'. */
  function afterSmallPref() {
    const s = settings().afterSmall; if (s) return s;
    try { const c = window.BSCampaign && window.BSCampaign.load(); const a = c && c.prefs && c.prefs.afterAcc; if (a) return a; } catch (e) {}
    return 'level';
  }
  /** 'ask' follow-up: user picks finish (no timer) or stay (level stay timer). */
  function followChoose(which) {
    const f = fst(); if (!f || f.done || f.kind !== 'ask') return;
    if (which === 'finish') { followDone('potty'); return; }
    const now = Date.now(), m = f.severity === 'dribble' ? ri(10, 20) : ri(15, 20);
    Object.assign(f, { kind: 'stay', waitMin: m, start: now, until: now + m * 60000, fired: false, text: `No potty for now — stay in your protection. Wait ${m} min before the next roll.` });
    f.steps = [f.text].concat(f.steps.slice(1)); saveF(f); render(); setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0);
  }
  function fst() { return J(FKEY, null); }
  function saveF(f) { if (f) localStorage.setItem(FKEY, JSON.stringify(f)); else localStorage.removeItem(FKEY); }
  function followActive(now) { const f = fst(); return !!(f && !f.done && f.until && f.until > (now || Date.now())); }
  /** Called by BSAccident after a natural accident in Simple Urge / Natural Urge tab. */
  function followUp(o) {
    o = o || {};
    const lv = o.level || profile().levelKey || (window.BSControl ? window.BSControl.band() : 'okay');
    const r = followUpFor(Object.assign({ afterSmall: afterSmallPref() }, o, { level: lv }));
    const now = Date.now();
    const f = Object.assign(r, { id: 'fu' + now.toString(36), at: now, start: r.waitMin ? now : 0, until: r.waitMin ? now + r.waitMin * 60000 : 0, fired: !r.waitMin, done: false });
    saveF(f);
    log(`↪️ Follow-up: ${f.steps.slice(0, -1).join(' ')}`, '#fdcb6e');
    try { window.BSCalendar && window.BSCalendar.addEntry({ source: 'sim', mode: 'simple_urge', type: 'event', memo: 'Follow-up — ' + f.steps.slice(0, -1).join(' '), event: { kind: 'followup', label: f.text }, tags: ['follow-up', f.kind], link: { followup: f.id } }); } catch (e) {}
    render(); setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0);
    return f;
  }
  function followDone(how) {
    const f = fst(); if (!f) return;
    f.done = how || 'done'; f.fired = true; saveF(f);
    try {
      if (how === 'potty') { window.BSCalendar && window.BSCalendar.addEntry({ source: 'sim', mode: 'simple_urge', type: 'potty', memo: 'Finished on the potty after the accident', link: { followup: f.id } }); ctlEvent('go'); }
      else if (how === 'skip') window.BSCalendar && window.BSCalendar.addEntry({ source: 'sim', mode: 'simple_urge', type: 'event', memo: 'Follow-up cleared early', tags: ['follow-up'], link: { followup: f.id } });
    } catch (e) {}
    render(); setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0);
  }
  function followHtml() {
    const f = fst(); if (!f || f.done) return '';
    const now = Date.now(), waiting = f.until && f.until > now;
    const ttl = { ask: '🤔 Your choice', finish: '✅ Finish on the potty', wait: '⏳ Wait, then roll', stay: '🧷 Stay in protection', rest: '🛁 Change check & rest' }[f.kind];
    return `<div class="urge-result" id="suFollow" data-kind="${f.kind}" data-sev="${f.severity}" style="border-color:#fdcb6e"><b>↪️ Next step: ${esc(sw(ttl))}</b>
      ${f.steps.map(x => `<div class="urge-note">${esc(sw(x))}</div>`).join('')}
      ${f.until ? (waiting ? `<div class="urge-note" style="font-size:22px;font-weight:bold">⏳ Next roll in <span id="suFCount"></span></div>` : '<div class="urge-note" id="suFReady">✅ Timer done — you may roll again.</div>') : ''}
      <div class="urge-actions">${f.kind === 'ask' ? '<button type="button" id="suFAskFin">✅ Finish on potty</button><button type="button" id="suFAskStay">🧷 Stay in it</button>' : ''}${f.kind === 'finish' ? '<button type="button" id="suFPotty">✅ Finished on the potty</button>' : ''}${f.check ? '<button type="button" id="suFChange">🎲 May I change?</button>' : ''}<button type="button" id="suFDone">${waiting ? 'Skip wait' : 'Done'}</button></div></div>`;
  }
  /** Natural / office play: the gear card is a choice. 'go' heads to the restroom; 'hold' starts the rolled timer (≤20). */
  function chooseNatural(which) {
    const x = st(); const r = x.last; if (!r || r.outcome !== 'natural' || r.closed) return null;
    const hold = Math.max(1, Math.min(20, (r.natural && r.natural.holdMin) || 10));
    if (which === 'go') {
      r.outcome = 'go'; r.text = 'Go to the restroom.'; r.waitMin = 0; r.closed = 'natural-go';
      x.waitUntil = 0; x.fired = true; x.chain = 0; x.accFor = null;
      try { window.BSCalendar && window.BSCalendar.addEntry({ source: 'sim', mode: 'simple_urge', type: 'potty', memo: r.text, link: { roll: r.id }, messy: r.type === 2 ? true : undefined }); } catch (e) {}
      ctlEvent('go');
      if (r.type === 2) clearTummy();
    } else {
      r.outcome = 'wait'; r.waitMin = hold; r.hidden = false; r.text = 'Hold ' + hold + ' min, then roll again.'; r.closed = '';
      x.waitUntil = Date.now() + hold * 60000; x.waitStart = Date.now(); x.fired = false; x.accFor = r.id;
      try { window.BSCalendar && window.BSCalendar.addEntry({ source: 'sim', mode: 'simple_urge', type: 'event', memo: r.text, link: { roll: r.id } }); } catch (e) {}
    }
    x.last = r; saveSt(x); render();
    setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0);
    return r;
  }
  function press(urgency, rng, popts) {
    popts = popts || {};
    if (followActive()) { const f = fst(), l = Math.max(0, f.until - Date.now()); toastMsg(`Next roll in ${Math.floor(l / 60000)}:${String(Math.floor(l / 1000) % 60).padStart(2, '0')}`); return null; }
    { const f = fst(); if (f && !f.done) { f.done = 'rolled'; saveF(f); } }
    const s = st(); const u = urgency == null || urgency === '' ? null : +urgency;
    saveSettings(u == null ? {} : { lastUrgency: u, lastUrgencyTs: Date.now() });
    const chain = popts.chain != null ? popts.chain : s.chain;
    const M = window.BSUrgeMatrix; const maxC = M ? M.MAX_CHAIN : 3;
    const res = roll({ urgency: u, chain, rng, quick: !!popts.quick, final: chain >= maxC });
    record(res);
    const timed = res.waitMin > 0 && (res.outcome === 'wait' || res.outcome === 'custom');
    const terminal = res.outcome === 'go' || res.outcome === 'gear';
    const waity = ['wait', 'hard', 'dribble'].includes(res.outcome) || (res.outcome === 'custom' && timed);
    const n = { last: res, accFor: waity ? res.id : null, chain: terminal ? 0 : Math.min(maxC, chain + 1), prevChain: chain, waitUntil: timed ? Date.now() + res.waitMin * 60000 : 0, waitStart: timed ? Date.now() : 0, fired: !timed, revealed: null, urgeSteps: (s.urgeSteps || []).concat([{ outcome: res.outcome, u, at: Date.now(), label: (res.content && res.content.label) || res.outcome }]) };
    if (terminal) n.urgeSteps = [];
    saveSt(n); render();
    // Launch the session-style guide when we have one
    try {
      const g = (res.pooGuide && res.pooGuide.length ? res.pooGuide : null) || (res.content && res.content.guide) || (res.gear && res.gear.guide);
      if (g && g.length && typeof window.startVoidGuide === 'function') {
        const title = (res.type === 2 ? '<b>💩 #2</b> ' : '') + (res.voice ? '<b>' + res.voice + '</b><br>' : '') + (res.content ? (res.content.label || '') : (res.gear && res.gear.label) || '');
        window.startVoidGuide(g, title, res.type === 2 && res.outcome === 'hard' ? 'gauntlet' : (res.outcome === 'hard' ? 'challenge' : (res.outcome === 'gear' || res.type === 2 ? 'full' : 'micro')));
      }
    } catch (e) {}
    setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0);
    return res;
  }
  /** After a wait/hold/dribble: re-check urgency and continue the urge chain. */
  function continueUrge(urgency, rng) {
    const s = st(); if (!s.last) return press(urgency, rng);
    // Clear wait state so press can fire
    s.waitUntil = 0; s.fired = true; saveSt(s);
    return press(urgency != null ? urgency : settings().lastUrgency, rng, { chain: s.chain || 1 });
  }
  // ---------- v14 S6: per-roll "Don't log this" / "Reroll, no log" ----------
  function setLogged(on) {
    const x = st(), r = x.last; if (!r || !r.calBody) return false; const C = window.BSCalendar;
    if (!on && !r.unlogged) { try { r.calId && C && C.deleteEntry(r.calId); } catch (e) {} r.calId = null; r.unlogged = true;
      if (r.outcome === 'gear') { const i = inv(); if (i.wetCount > 0) { i.wetCount--; saveInv(i); } } }
    else if (on && r.unlogged) { try { const e = C && C.addEntry(Object.assign({}, r.calBody)); r.calId = e && e.id; } catch (e) {} r.unlogged = false;
      if (r.outcome === 'gear') { const i = inv(); i.wetCount++; saveInv(i); } }
    saveSt(x); render(); return true;
  }
  /** Reroll: retract this roll's log and roll again with the SAME chain lean (no fishing, D15). */
  function reroll(urgency, rng) {
    const x = st(); if (!x.last) return null; setLogged(false);
    const s2 = st(); s2.waitUntil = 0; s2.fired = true; saveSt(s2);
    return press(urgency != null ? urgency : x.last.urgency, rng, { chain: x.prevChain != null ? x.prevChain : 0, quick: !!x.last.quick });
  }

  // ---------- v14 S7: "I can't hold it" — no roll, major accident, always logged ----------
  const CKEY = 'bs_cant_hold_cascade';
  function cascadeState() { return J(CKEY, null); }
  function cantHold(o) {
    o = o || {}; const rng = o.rng || Math.random, now = Date.now();
    const x = st(), ws = inWaitState();
    if (x.last && !x.last.closed) endByAccident(); // cancels the active wait + its alarm (Surprise #2 timer untouched)
    { const f = fst(); if (f && !f.done) { f.done = 'cant_hold'; f.fired = true; saveF(f); } }
    const gear = pickGear(8, rng);
    const y = st();
    y.last = { id: 'ch' + now.toString(36), outcome: 'gear', severity: 'major', gear, closed: 'accident', cantHold: true, text: officeOn() ? 'Unplanned event.' : "😣 Couldn't hold it — major accident.", levelKey: profile().levelKey };
    y.accFor = null; y.waitUntil = 0; y.fired = true; y.chain = 0; saveSt(y);
    // light cascade second-check within 10 min (offered at all levels, D22)
    // v31 a6: clustered waves — 2–3 staggered in-app checks when waveCluster is on
    if (settings().waveCluster) {
      const gaps = [ri(3, 5, rng), ri(8, 12, rng), ri(15, 20, rng)].map(m => now + m * 60000);
      localStorage.setItem(CKEY, JSON.stringify({ at: gaps[0], queue: gaps.slice(1), from: y.last.id, done: false, clustered: true, n: 1 }));
    } else {
      localStorage.setItem(CKEY, JSON.stringify({ at: now + ri(4, 10, rng) * 60000, from: y.last.id, done: false }));
    }
    log("😣 I can't hold it — major accident. Wait ended.", '#e17055');
    render(); setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0);
    if (o.sheet !== false && window.BSAccident) window.BSAccident.open({ ctx: 'cant_hold', severity: 'full', instruction: ws && x.last ? x.last.text : "I can't hold it", roll: ws && x.last ? x.last.id : null, duringWait: ws, alwaysLog: true });
    return y.last;
  }
  function cascadeHtml() {
    const c = cascadeState(); if (!c || c.done) return '';
    const due = Date.now() >= c.at;
    const clusterBit = c.clustered ? ` (wave ${c.n || 1}${(c.queue && c.queue.length) ? ' of ' + ((c.n || 1) + c.queue.length) : ''})` : '';
    return `<div class="urge-result" id="suCascade" style="border-color:#74b9ff">${due ? `<b>🌊 Second-wave check${clusterBit}</b><div class="urge-note">Sometimes a second leak follows a big one. Did another one happen? Only log what really happened.</div>
      <div class="urge-actions"><button type="button" id="suCasYes">💦 Yes — log it</button><button type="button" id="suCasNo">No, all good</button></div>` : `<div class="urge-note">🌊 ${c.clustered ? 'Clustered wave checks' : 'A quick second-wave check'} will pop up here in a few minutes.</div><div class="urge-actions"><button type="button" id="suCasNo">Dismiss</button></div>`}</div>`;
  }
  function cascadeClose() {
    const c = cascadeState(); if (!c) return render();
    if (c.clustered && c.queue && c.queue.length) {
      const next = c.queue.shift();
      localStorage.setItem(CKEY, JSON.stringify({ at: next, queue: c.queue, from: c.from, done: false, shown: false, clustered: true, n: (c.n || 1) + 1 }));
    } else if (c) { c.done = true; localStorage.setItem(CKEY, JSON.stringify(c)); }
    render();
  }
  /** Is the user currently in a wait / hold / dribble instruction? */
  function inWaitState() { const x = st(); const o = x.last && x.last.outcome; return !!(o === 'wait' || o === 'hard' || o === 'dribble' || (o === 'custom' && x.waitUntil)) && !x.last.closed; }
  /** Called by BSAccident: an accident ends the current wait (no further alarm). */
  /** v12: the "Had an accident" button stays after a wait/hold/dribble ends (even after the timer) until the next press or a dismiss. */
  function accidentArmed() { const x = st(); return !!(x.accFor && x.last && x.last.id === x.accFor && !x.last.closed); }
  function dismissAccident() { const x = st(); x.accFor = null; saveSt(x); render(); }
  function endByAccident() { const x = st(); if (!x.last) return; x.last.closed = 'accident'; x.accFor = null; x.waitUntil = 0; x.fired = true; x.chain = 0; saveSt(x); render(); setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0); }
  /** The single native reminder for the current wait (or null). Read by native-notify.js. */
  function pendingAlarm(now) {
    now = now || Date.now(); const s = st();
    const f = fst();
    if (settings().alarm && f && !f.done && f.until && !f.fired && f.until > now - 60000 && !(typeof window.isBedwettingSilent === 'function' && window.isBedwettingSilent())) {
      const n = officeOn() ? { title: 'Reminder', body: 'Check in.' } : { title: 'Bladder Sim', body: 'Follow-up timer done — you may roll again.' };
      return { id: ALARM_ID, at: f.until, kind: 'reminder', title: n.title, body: n.body };
    }
    if (!settings().alarm || !s.waitUntil || s.waitUntil <= now - 60000 || s.fired) return null;
    if (typeof window.isBedwettingSilent === 'function' && window.isBedwettingSilent()) return null;
    const n = officeOn() ? { title: 'Reminder', body: 'Check in.' } : { title: 'Bladder Sim', body: 'Wait is over — roll again.' };
    return { id: ALARM_ID, at: s.waitUntil, kind: 'reminder', title: n.title, body: n.body };
  }
  function tick() {
    { const c = cascadeState(); if (c && !c.done && !c.shown && Date.now() >= c.at) { c.shown = true; localStorage.setItem(CKEY, JSON.stringify(c)); render(); } }
    const f = fst();
    if (f && !f.done && f.until) {
      const lf = f.until - Date.now(), ef = document.getElementById('suFCount');
      if (lf <= 0 && !f.fired) { f.fired = true; saveF(f); if (document.visibilityState === 'visible' && window.BSPrompt && !(typeof window.isBedwettingSilent === 'function' && window.isBedwettingSilent())) window.BSPrompt.ping(); log('⏰ Follow-up timer done — you may roll again.', '#74b9ff'); render(); }
      else if (ef && lf > 0) ef.textContent = `${Math.floor(lf / 60000)}:${String(Math.floor(lf / 1000) % 60).padStart(2, '0')}`;
    }
    const s = st(); if (!s.waitUntil) return;
    const left = s.waitUntil - Date.now(), el = document.getElementById('suCount');
    if (left <= 0) {
      if (!s.fired) {
        s.fired = true; s.revealed = Math.round((s.waitUntil - (s.waitStart || s.waitUntil)) / 60000); saveSt(s);
        if (document.visibilityState === 'visible' && window.BSPrompt) window.BSPrompt.ping();
        log(`⏰ Wait over${s.last && s.last.hidden ? ` — it was ${s.revealed} min` : ''} — roll again.`, '#74b9ff'); render();
      }
      return;
    }
    if (el && !(s.last && s.last.hidden)) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  }
  setInterval(tick, 1000);

  // ---------- UI ----------
  function profileOptions(sel) {
    const ctl = window.BSControl ? window.BSControl.levelFor(window.BSControl.load().value) : null;
    return `<option value="match" ${sel === 'match' ? 'selected' : ''}>🎯 Match my profile${ctl ? ' (' + (window.BSControl.label(ctl, officeOn())) + ')' : ''}</option>` +
      L().slice().reverse().map(l => `<option value="${l.key}" ${sel === l.key ? 'selected' : ''}>${esc(window.BSControl.label(l, officeOn()))}</option>`).join('') +
      `<option value="off" ${sel === 'off' ? 'selected' : ''}>${esc(window.BSControl ? window.BSControl.label('off', officeOn()) : 'Sitting out')}</option>` +
      customProfiles().map(p => `<option value="${esc(p.id)}" ${sel === p.id ? 'selected' : ''}>⭐ ${esc(p.name)}</option>`).join('');
  }
  function supplyForm(i, pre) {
    return `<label class="urge-lbl">Wearing <select id="${pre}Wear">${PROT.map(k => `<option value="${k}" ${k === i.wearing ? 'selected' : ''}>${esc(protLabel(k))}</option>`).join('')}</select></label>
      <div class="su-spares">${SPARE.map(k => `<label class="urge-lbl" style="display:inline-block;width:48%">Spare ${esc(protLabel(k).toLowerCase())} <input id="${pre}S_${k}" data-spare="${k}" type="number" min="0" max="20" value="${i.spares[k] || 0}" style="width:56px"></label>`).join('')}</div>`;
  }
  function readSupply(m, pre) { const n = inv(); n.wearing = m.querySelector('#' + pre + 'Wear').value; SPARE.forEach(k => { n.spares[k] = Math.max(0, +m.querySelector('#' + pre + 'S_' + k).value || 0); }); n.day = today(); n.wetCount = 0; return n; }
  function render() {
    const m = document.getElementById('simpleUrgeMount'); if (!m) return;
    try { if (window.BSHub && window.BSHub.applyThemeDom) window.BSHub.applyThemeDom(window.BSHub.themeId()); } catch (e) {}
    const s = settings(), x = st(), p = profile(), i = inv(), last = x.last;
    const waiting = x.waitUntil && x.waitUntil > Date.now();
    const ws = inWaitState(), armed = accidentArmed();
    const office = officeOn(), lvl = window.BSControl && window.BSControl.level(p.levelKey);
    const NS = window.BSNatSession, sess = NS && NS.active();
    const reset = needsDailyReset();
    const extras = document.getElementById('urgeExtras'); if (extras && m.contains(extras) && m.parentNode) m.parentNode.appendChild(extras);
    const moreWasOpen = !!(m.querySelector('#suMore') && m.querySelector('#suMore').open);
    const qq = window.BSHub && window.BSHub.qqLoad ? window.BSHub.qqLoad() : null;
    const wear = (() => { try { return protLabel(i.wearing); } catch (e) { return i.wearing || '—'; } })();
    const nowLine = waiting ? (last && last.hidden ? 'Wait running (hidden)' : 'Wait running') : (followActive() ? 'Follow-up in progress' : (armed ? 'Accident button ready' : 'Ready — press when you need to go'));
    const natOn = !!(window.BSHub && window.BSHub.naturalPlayOn && window.BSHub.naturalPlayOn());
    m.innerHTML = `<h2 style="margin:0 0 6px;">🙋 Natural Urge</h2>
      <label class="urge-lbl"><input type="checkbox" id="suNatural" ${natOn ? 'checked' : ''}> Natural / office play</label>
      <div class="cal-legend">At the office: “use your protection” becomes go to the restroom, or a hold still at most 20 minutes. DryClip can still log a natural accident. Separate from Office Mode wording.</div>
      <div class="su-glance" id="suGlance">
        <div class="pp-gl-row"><span class="pp-gl-k">Wear</span><span class="pp-gl-v">${esc(wear)}</span><span class="pp-gl-k">Control</span><span class="pp-gl-v">${esc(p.name || p.levelKey || '—')}</span></div>
        <div class="pp-gl-row"><span class="pp-gl-k">Now</span><span class="pp-gl-v">${esc(nowLine)}</span></div>
        <div class="pp-gl-row"><span class="pp-gl-k">Status</span><span class="pp-gl-v">Urgency is yours to enter below${s.lastUrgency != null ? ' · last ' + s.lastUrgency + '/10' : ''}.</span></div>
      </div>
      ${qq && qq.active && s.profileId === 'cp_quickquiz' ? `<div class="urge-note" id="suQQ">🧩 Quiz session: ${esc(qq.result.summary)} <button type="button" id="suQQEnd">End</button></div>` : ''}
      ${window.BSControl ? window.BSControl.chip() : ''}
      <label class="urge-lbl">Control <select id="suProf">${profileOptions(s.profileId)}</select></label>
      ${lvl ? `<details class="urge-more" id="suLvlInfo"><summary>About ${esc(window.BSControl.label(lvl, office))}</summary><div class="urge-note" id="suLvlDesc" data-office-raw="1">${esc(window.BSControl.describe(lvl.key, office))}</div><div class="urge-actions"><button type="button" id="suLvlAll">📋 All levels</button></div></details>` : ''}
      ${reset ? `<div class="urge-result" id="suDaily" style="border-color:#fdcb6e"><b>☀️ New day: what are you wearing / carrying?</b>${supplyForm(i, 'suD')}
        <div class="urge-actions"><button type="button" id="suDailySave">Save for today</button><button type="button" id="suDailyKeep">Keep as is</button></div></div>` : ''}
      ${sess ? NS.chip() : `<div class="urge-actions"><button type="button" id="suSessStart">▶ Start natural session</button></div>`}
      ${followHtml()}
      <div class="urge-type" id="suType" role="group" aria-label="Type">
        <button type="button" id="suT1" class="${urgeType() === 1 ? 'on' : ''}">#1 Pee</button>
        <button type="button" id="suT2" class="messy-only ${urgeType() === 2 ? 'on' : ''}">#2</button>
      </div>
      ${urgeType() === 2 ? '<div class="cal-legend" id="suTypeNote">Rolling #2 — tummy guides (hold, protection, or potty), not pee steps.</div>' : ''}
      <button type="button" id="suGo" class="su-big" ${followActive() ? 'data-locked="1"' : ''} style="width:100%;min-height:72px;font-size:22px;font-weight:bold;background:${followActive() ? '#636e72' : '#ff7675'};color:#000;border-radius:16px;">${followActive() ? '⏳ Wait for the follow-up timer' : 'I need to go'}</button>
      <div class="pp-pause-row"><button type="button" id="suCantHold" class="pp-real pp-pause">${office ? '⚠️ Unplanned event' : "😣 I can't hold it"}</button></div>
      ${cascadeHtml()}
      <label class="urge-lbl" for="suU">Urgency <b id="suUV">${s.lastUrgency == null ? '— (touch to set)' : s.lastUrgency + '/10'}</b></label>
      <input id="suU" type="range" min="0" max="10" step="1" value="${sliderValue(s) == null ? 5 : sliderValue(s)}" data-set="${sliderValue(s) == null ? '' : '1'}" style="width:100%">
      ${last ? `<div id="suResult" class="urge-result" data-outcome="${last.outcome}" data-hidden="${last.hidden ? 1 : 0}" style="border-color:${COLOR[last.outcome]};font-size:20px;"><span class="su-dot" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${COLOR[last.outcome]};margin-right:6px"></span><b>${esc(sw(last.text))}</b>
        ${last.closed === 'accident' ? '<div class="urge-note">Ended — accident logged. Roll again whenever you need.</div>' : ''}
        ${waiting && !last.closed ? (last.hidden ? `<div class="urge-note" id="suHidden">Time hidden — carry on.${s.alarm ? ' One alarm when it ends.' : ''}</div>` : `<div class="urge-note">⏳ <span id="suCount"></span></div>`) : ''}
        ${x.waitUntil && !waiting && !last.closed ? `<div class="urge-note" id="suReveal">Time's up${last.hidden ? ` — you waited ${x.revealed || last.waitMin} min` : ''} — roll again.</div>` : ''}
        ${(last.outcome === 'hard' || last.outcome === 'dribble') && !last.closed ? `<div class="urge-actions"><button type="button" id="suReady">${last.outcome === 'hard' ? 'It\'s hard now — roll' : 'Dribble happened — roll'}</button></div>` : ''}
        ${last.outcome === 'natural' && !last.closed ? `<div class="urge-actions"><button type="button" id="suNatGo">🚻 ${(last.natural && last.natural.goLabel) || 'Go to the restroom'}</button><button type="button" id="suNatHold">⏱ ${(last.natural && last.natural.holdLabel) || 'Hold'}</button></div>` : ''}
        ${last.calBody ? `<div class="urge-actions" id="suLogRow"><label class="urge-lbl"><input type="checkbox" id="suNoLog" ${last.unlogged ? 'checked' : ''}> Don't log this</label>${!last.closed ? '<button type="button" id="suReroll">🎲 Reroll, no log</button>' : ''}</div>` : ''}
        ${(last.pooGuide && last.pooGuide.length) || (last.content && last.content.guide) || (last.gear && last.gear.guide) || (last.event && last.event.guide && last.event.guide.length) ? '<div class="urge-actions"><button type="button" id="suGuide">▶ Guide</button></div>' : ''}
        </div>` : ''}
      ${armed ? `<div class="urge-actions" id="suAccRow"><button type="button" id="suAcc" class="su-acc" style="flex:1;min-height:56px;background:#e17055;color:#000;font-weight:bold;font-size:18px;">💦 Had an accident</button><button type="button" id="suAccX" title="Dismiss" aria-label="Dismiss accident button" style="min-width:56px;min-height:56px">✕</button></div>
        ${ws ? '' : '<div class="urge-note" id="suAccNote">The wait is over — still here in case it happened. Press "I need to go" or ✕ to clear.</div>'}` : ''}
      <div id="suInv" class="urge-note">🎒 ${esc(sw(invText(i)))}</div>
      <div class="urge-actions su-kit"><button type="button" id="suMayChange">🎲 May I change?</button></div>
      <details class="urge-more" id="suMore"><summary>More — profiles, events, traits, supplies, export</summary>
        <div class="urge-note"><b>Change now</b> (uses a spare):</div>
        <div class="urge-actions">${SPARE.map(k => `<button type="button" data-ch="${k}" ${i.spares[k] ? '' : 'disabled'}>Change: ${esc(one(k))}</button>`).join('')}</div>
        <div class="urge-actions"><button type="button" id="suLogAcc">📝 Log a past accident (no roll)</button></div>
        <div class="urge-note">Active: <b>${esc(p.name)}</b> · from ${esc(p.sources.join(', '))} · waits ${p.hold[0]}–${p.hold[1]} min${p.hiddenWait ? ' (hidden)' : ''}</div>
        <div class="urge-note">Odds: ${OUT.map(k => `${OUT_LABEL[k]} ${Math.round(p.odds[k])}`).join(' · ')}</div>
        <div class="urge-actions"><button type="button" id="suNewProf">＋ New profile</button>${customProfiles().some(c => c.id === s.profileId) ? '<button type="button" id="suEditProf">✏️ Edit profile</button>' : ''}<button type="button" id="suEvents">⚡ Custom events (${customEvents().length})</button><button type="button" id="suTables">📊 Level tables</button></div>
        <div class="urge-actions"><button type="button" id="suExport">⬇ Export JSON</button><button type="button" id="suImport">⬆ Import JSON</button></div>
        <div class="urge-note"><b>Body traits</b> (only change the dice/timers):</div>
        <label class="urge-lbl"><input type="checkbox" id="suFF" ${s.fastFill ? 'checked' : ''}> ⚡ Fast Fill — shorter waits</label>
        <label class="urge-lbl"><input type="checkbox" id="suQS" ${s.quietSignals ? 'checked' : ''}> 🤫 Quiet Signals — more "wait for dribble" rolls, fewer "hold till hard"</label>
        <label class="urge-lbl"><input type="checkbox" id="suWC" ${s.waveCluster ? 'checked' : ''}> 🌊 Clustered waves — a few staggered second-wave checks after a big accident (in-app timing)</label>
        <label class="urge-lbl"><input type="checkbox" id="suHW" ${s.hideWaits ? 'checked' : ''}> ✋ Always hide wait times</label>
        <label class="urge-lbl"><input type="checkbox" id="suAl" ${s.alarm ? 'checked' : ''}> One reminder when a wait ends (native)</label>
        <label class="urge-lbl"><input type="checkbox" id="suAsk" ${s.askUrgency ? 'checked' : ''}> Ask urgency every press (slider resets to unset)</label>
        <label class="urge-lbl"><input type="checkbox" id="suCal" ${s.useCalib ? 'checked' : ''}> Use calibration to shorten waits (opt-in)</label>
        <label class="urge-lbl"><input type="checkbox" id="suCW" ${window.BSControl && window.BSControl.load().countWaitAccidents ? 'checked' : ''}> Count accidents during waits toward progress/regress</label>
        <label class="urge-lbl">💦 After a small accident <select id="suAfter">${[['', 'Campaign / level default'], ['level', 'Level + "you\'re not done"'], ['finish', 'Go finish on the potty'], ['stay', 'Stay in protection'], ['wait', 'Wait timer, then roll'], ['ask', 'Ask me each time'], ['dice', 'Let the dice pick']].map(([v, l]) => `<option value="${v}" ${(s.afterSmall || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="urge-lbl">Control daily cap ± <input id="suCap" type="number" min="4" max="12" value="${window.BSControl ? window.BSControl.load().cap : 8}" style="width:56px"></label>
        <div class="urge-note"><b>Supplies</b></div>${supplyForm(i, 'su')}
        <div class="urge-actions"><button type="button" id="suInvSave">Save supplies</button><button type="button" id="suInvDef">Today's default</button></div>
        
      </details>`;
    const q = id => m.querySelector('#' + id), on = (id, f) => { const el = q(id); if (el) el.onclick = f; };
    { const more = q('suMore'); if (more) { if (moreWasOpen) more.open = true; if (extras) more.appendChild(extras); } }
    on('suQQEnd', () => window.BSHub && window.BSHub.qqEnd());
    const urg = () => q('suU').dataset.set ? +q('suU').value : null;
    q('suU').oninput = q('suU').onchange = e => { e.target.dataset.set = '1'; q('suUV').textContent = e.target.value + '/10'; saveSettings({ lastUrgency: +e.target.value, lastUrgencyTs: Date.now() }); }; // v18: persist on every move so re-renders keep it
    q('suProf').onchange = e => { saveSettings({ profileId: e.target.value }); render(); };
    on('suT1', () => { saveSettings({ type: 1 }); render(); });
    on('suT2', () => { if (messyOn()) { saveSettings({ type: 2 }); render(); } });
    on('suGo', () => press(urg()));
    on('suReady', () => { try { if (window.BSClasses && window.BSClasses.noteDribble) window.BSClasses.noteDribble(); } catch (e) {} continueUrge(urg()); });
    on('suGuide', () => { const g = (last.pooGuide && last.pooGuide.length ? last.pooGuide : null) || (last.content && last.content.guide) || (last.gear && last.gear.guide) || (last.event && last.event.guide); try { typeof startVoidGuide === 'function' && startVoidGuide(g, (last.type === 2 ? '<b>💩 #2</b> ' : '') + `<b>${esc(sw(last.text))}</b>`, last.type === 2 ? (last.outcome === 'hard' ? 'gauntlet' : 'full') : (last.outcome === 'hard' ? 'challenge' : last.outcome === 'gear' ? 'full' : 'micro')); } catch (e) {} });
    on('suAcc', () => window.BSAccident && window.BSAccident.open({ ctx: 'simple_urge', instruction: last.text, roll: last.id, duringWait: ws || armed }));
    on('suAccX', dismissAccident);
    on('suCantHold', () => cantHold());
    on('suCasYes', () => { cascadeClose(); window.BSAccident && window.BSAccident.open({ ctx: 'cant_hold', severity: 'leak', instruction: 'Second wave after a big accident', cascade: true }); });
    on('suCasNo', cascadeClose);
    on('suReroll', () => reroll(urg()));
    on('suFAskFin', () => followChoose('finish'));
    on('suFAskStay', () => followChoose('stay'));
    { const nl = q('suNoLog'); if (nl) nl.onchange = e => setLogged(!e.target.checked); }
    on('suFPotty', () => followDone('potty'));
    on('suFDone', () => followDone(followActive() ? 'skip' : 'done'));
    on('suFChange', () => window.BSChange && window.BSChange.open({ ctx: 'urge_tab' }));
    on('suMayChange', () => window.BSChange && window.BSChange.open({ ctx: 'urge_tab' }));
    on('suLvlAll', () => openLevelList());
    on('suLogAcc', () => window.BSAccident && window.BSAccident.open({ ctx: 'urge_tab', instruction: ws ? last.text : '', roll: ws ? last.id : null, duringWait: ws }));
    on('suSessStart', () => NS && NS.openStart());
    if (sess) NS.bind(m);
    m.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { change(b.dataset.ch); render(); });
    on('suDailySave', () => { const n = readSupply(m, 'suD'); saveInv(n); log('🎒 Supplies set for today. ' + invText(n)); render(); });
    on('suDailyKeep', () => { const n = inv(); n.day = today(); saveInv(n); render(); });
    on('suNewProf', () => openProfileEditor(null));
    on('suEditProf', () => openProfileEditor(customProfiles().find(c => c.id === s.profileId)));
    on('suEvents', () => openEventList());
    on('suTables', () => openLevelTables());
    on('suExport', () => openTextSheet('⬇ Export profiles & events', exportJSON(), null));
    on('suImport', () => openTextSheet('⬆ Import profiles & events', '', txt => { const r = importJSON(txt); toastMsg(`Imported ${r.profiles} profile(s), ${r.events} event(s)`); render(); }));
    const natEl = q('suNatural'); if (natEl) natEl.onchange = e => { try { window.BSHub && window.BSHub.setNaturalPlay(!!e.target.checked); } catch (err) {} toastMsg(e.target.checked ? 'Natural / office play on' : 'Natural / office play off'); const setBox = document.getElementById('naturalPlayToggle'); if (setBox) setBox.checked = !!e.target.checked; };
    on('suNatGo', () => chooseNatural('go'));
    on('suNatHold', () => chooseNatural('hold'));
    q('suFF').onchange = e => saveSettings({ fastFill: e.target.checked });
    q('suQS').onchange = e => saveSettings({ quietSignals: e.target.checked });
    if (q('suWC')) q('suWC').onchange = e => saveSettings({ waveCluster: e.target.checked });
    q('suHW').onchange = e => saveSettings({ hideWaits: e.target.checked });
    q('suAl').onchange = e => { saveSettings({ alarm: e.target.checked }); window.nativeNotifySync && window.nativeNotifySync(); };
    q('suAsk').onchange = e => saveSettings({ askUrgency: e.target.checked });
    q('suCal').onchange = e => { saveSettings({ useCalib: e.target.checked }); render(); };
    q('suCW').onchange = e => { window.BSControl && window.BSControl.saveSettings({ countWaitAccidents: e.target.checked }); };
    q('suAfter').onchange = e => saveSettings({ afterSmall: e.target.value });
    q('suCap').onchange = e => { window.BSControl && window.BSControl.saveSettings({ cap: +e.target.value }); render(); };
    on('suInvSave', () => { const n = readSupply(m, 'su'); saveInv(n); log('🎒 Supplies set. ' + invText(n)); render(); });
    on('suInvDef', () => { saveInv(DEF_INV()); render(); });
    tick();
    try { if (officeOn()) window.BSOffice.apply(); } catch (e) {}
  }
  function toastMsg(t) { try { typeof toast === 'function' && toast(t); } catch (e) {} }

  // ---------- sheets (profile editor, custom events, level tables, import/export) ----------
  function sheet(html) {
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">${html}</div>`;
    w.addEventListener('click', ev => { if (ev.target === w) w.remove(); }); document.body.appendChild(w); return w;
  }
  function openTextSheet(title, text, onImport) {
    const w = sheet(`<h3>${esc(title)}</h3><textarea id="suJson" style="height:200px;width:100%;font-size:12px;font-family:monospace;" ${onImport ? '' : 'readonly'}>${esc(text)}</textarea>
      <div class="actions">${onImport ? '<button class="ok" data-imp>Import</button>' : '<button data-copy>📋 Copy</button>'}<button data-x>Close</button></div>`);
    w.querySelector('[data-x]').onclick = () => w.remove();
    const c = w.querySelector('[data-copy]'); if (c) c.onclick = () => { try { navigator.clipboard.writeText(text); toastMsg('Copied'); } catch (e) {} };
    const im = w.querySelector('[data-imp]'); if (im) im.onclick = () => { try { onImport(w.querySelector('#suJson').value); w.remove(); } catch (e) { toastMsg('Import failed: ' + e.message); } };
    return w;
  }
  function openProfileEditor(cp) {
    const base = cp || (() => { const p = profile(); return { name: 'My profile', wait: p.hold, odds: p.odds, hiddenWait: p.hiddenWait, traits: { fastFill: p.fastFill, quietSignals: p.quietSignals }, level: null }; })();
    const w = sheet(`<h3>${cp ? '✏️ Edit' : '＋ New'} urge profile</h3>
      <label class="fld"><span>Name</span><input id="peName" type="text" maxlength="40" value="${esc(base.name)}"></label>
      <label class="fld"><span>Wait range (min)</span><span><input id="peLo" type="number" min="1" max="180" value="${base.wait[0]}" style="width:64px"> – <input id="peHi" type="number" min="1" max="240" value="${base.wait[1]}" style="width:64px"></span></label>
      <div class="fld"><span>Odds (relative weights)</span><div>${OUT.map(k => `<label class="urge-lbl" style="display:inline-block;width:48%">${OUT_LABEL[k]} <input type="number" min="0" max="100" data-podd="${k}" value="${Math.round(base.odds[k] || 0)}" style="width:56px"></label>`).join('')}</div></div>
      <label class="fld"><span>Custom events use level</span><select id="peLvl"><option value="">Follow Control meter</option>${L().map(l => `<option value="${l.key}" ${base.level === l.key ? 'selected' : ''}>${l.label}</option>`).join('')}</select></label>
      <label class="urge-lbl"><input type="checkbox" id="peHidden" ${base.hiddenWait ? 'checked' : ''}> ✋ Hidden waits (no duration shown)</label>
      <label class="urge-lbl"><input type="checkbox" id="peFF" ${base.traits.fastFill ? 'checked' : ''}> ⚡ Fast Fill</label>
      <label class="urge-lbl"><input type="checkbox" id="peQS" ${base.traits.quietSignals ? 'checked' : ''}> 🤫 Quiet Signals</label>
      <div class="actions"><button class="ok" id="peSave">Save &amp; use</button>${cp ? '<button id="peDel">Delete</button>' : ''}<button data-x>Cancel</button></div>`);
    const g = id => w.querySelector('#' + id);
    w.querySelector('[data-x]').onclick = () => w.remove();
    g('peSave').onclick = () => {
      const odds = {}; w.querySelectorAll('[data-podd]').forEach(e => odds[e.dataset.podd] = +e.value || 0);
      const n = upsertProfile({ id: cp && cp.id, name: g('peName').value.trim() || 'My profile', wait: [+g('peLo').value, +g('peHi').value], odds, hiddenWait: g('peHidden').checked, traits: { fastFill: g('peFF').checked, quietSignals: g('peQS').checked }, level: g('peLvl').value || null });
      saveSettings({ profileId: n.id }); w.remove(); render(); toastMsg('Profile saved: ' + n.name);
    };
    if (g('peDel')) g('peDel').onclick = () => { deleteProfile(cp.id); w.remove(); render(); };
    return w;
  }
  function openEventList() {
    const evs = customEvents();
    const w = sheet(`<h3>⚡ Custom Simple Urge events</h3>
      <div class="cal-legend">Your own outcomes, mixed into the roll. Weight is relative to the built-in odds (e.g. 10). </div>
      ${evs.map(e => `<div class="camp-goal" data-eid="${esc(e.id)}">${e.enabled === false ? '⏸' : '✅'} <b>${esc(e.text)}</b> <span style="color:#8ea0b6">w${e.weight} · ${e.levels.length ? e.levels.join('/') : 'all levels'} · timer ${e.timer}${e.guide.length ? ' · guide ' + e.guide.length : ''}</span> <button type="button" data-edit="${esc(e.id)}">Edit</button></div>`).join('') || '<div class="urge-note">No custom events yet.</div>'}
      <div class="actions"><button class="ok" id="ceNew">＋ New event</button><button data-x>Close</button></div>`);
    w.querySelector('[data-x]').onclick = () => w.remove();
    w.querySelector('#ceNew').onclick = () => { w.remove(); openEventEditor(null); };
    w.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { w.remove(); openEventEditor(customEvents().find(e => e.id === b.dataset.edit)); });
    return w;
  }
  function openEventEditor(ev) {
    const e = ev || { text: '', weight: 10, levels: [], guide: [], timer: 'none', min: 5, max: 15, enabled: true };
    const step = (g, i) => `<div class="su-step" data-step="${i}" style="display:flex;gap:4px;align-items:center;margin:4px 0"><select data-st="type">${['push', 'relax', 'stop'].map(t => `<option value="${t}" ${g.type === t ? 'selected' : ''}>${{ push: 'Push', relax: 'Relax', stop: 'Wait' }[t]}</option>`).join('')}</select><input data-st="text" type="text" maxlength="40" value="${esc(g.text)}" placeholder="Step text" style="flex:1;min-width:0"><input data-st="time" type="number" min="1" max="120" value="${g.time}" style="width:56px">s<button type="button" data-rm="${i}">✕</button></div>`;
    const w = sheet(`<h3>${ev ? '✏️ Edit' : '＋ New'} custom event</h3>
      <label class="fld"><span>Instruction text</span><input id="ceText" type="text" maxlength="160" value="${esc(e.text)}" placeholder="e.g. Finish your drink first, then roll again"></label>
      <label class="fld"><span>Weight (0-100)</span><input id="ceW" type="number" min="0" max="100" value="${e.weight}"></label>
      <div class="fld"><span>Available at levels (none ticked = all)</span><div>${L().map(l => `<label class="urge-lbl" style="display:inline-block;width:32%"><input type="checkbox" data-lvl="${l.key}" ${e.levels.includes(l.key) ? 'checked' : ''}> ${l.label}</label>`).join('')}</div></div>
      <label class="fld"><span>Timer</span><select id="ceTimer">${[['none', 'No timer'], ['shown', 'Timer shown'], ['hidden', 'Hidden timer (✋)']].map(([v, l]) => `<option value="${v}" ${e.timer === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld"><span>Timer range (min)</span><span><input id="ceMin" type="number" min="1" max="180" value="${e.min}" style="width:64px"> – <input id="ceMax" type="number" min="1" max="240" value="${e.max}" style="width:64px"></span></label>
      <div class="fld"><span>Guide steps (push / relax / wait builder, optional)</span><div id="ceSteps">${e.guide.map(step).join('')}</div><button type="button" id="ceAddStep">＋ Step</button></div>
      <label class="urge-lbl"><input type="checkbox" id="ceOn" ${e.enabled !== false ? 'checked' : ''}> Enabled</label>
      <div class="actions"><button class="ok" id="ceSave">Save event</button>${ev ? '<button id="ceDel">Delete</button>' : ''}<button data-x>Cancel</button></div>`);
    const g = id => w.querySelector('#' + id);
    const steps = () => [...w.querySelectorAll('[data-step]')].map(r => ({ type: r.querySelector('[data-st=type]').value, text: r.querySelector('[data-st=text]').value.trim(), time: +r.querySelector('[data-st=time]').value }));
    const bindRm = () => w.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { b.parentNode.remove(); });
    g('ceAddStep').onclick = () => { const box = g('ceSteps'); box.insertAdjacentHTML('beforeend', step({ type: 'stop', text: '', time: 3 }, box.children.length + Date.now() % 1000)); bindRm(); };
    bindRm();
    w.querySelector('[data-x]').onclick = () => w.remove();
    g('ceSave').onclick = () => {
      if (!g('ceText').value.trim()) { toastMsg('Add the instruction text'); return; }
      upsertEvent({ id: ev && ev.id, text: g('ceText').value.trim(), weight: +g('ceW').value, levels: [...w.querySelectorAll('[data-lvl]:checked')].map(x => x.dataset.lvl), timer: g('ceTimer').value, min: +g('ceMin').value, max: +g('ceMax').value, guide: steps(), enabled: g('ceOn').checked });
      w.remove(); render(); toastMsg('Event saved'); openEventList();
    };
    if (g('ceDel')) g('ceDel').onclick = () => { deleteEvent(ev.id); w.remove(); render(); openEventList(); };
    return w;
  }
  /** v12: every level with its generated description (numbers from BSControl.stats). */
  function openLevelList() {
    const C = window.BSControl, o = officeOn();
    const rows = L().slice().reverse().concat([C.OFF]).map(l => { const x = C.stats(l.key);
      return `<div class="camp-goal" data-lvl-row="${l.key}"><b>${esc(C.label(l, o))}</b>${l.off ? '' : `<div class="su-lvl-nums" style="font-size:12px;color:#8ea0b6">potty ${x.potty}% · mostly dry ${x.mostlyDry}% · small ${x.small}% · major ${x.major}% · wait/hold prompts ${x.holdPrompts}% · warning ~${x.warning} min${o ? '' : ` · change at ${x.changeAt}% · ${esc(protLabel(x.day))}/${esc(protLabel(x.night))}`}</div>`}<div class="urge-note" data-office-raw="1">${esc(C.describe(l.key, o))}</div></div>`; }).join('');
    const w = sheet(`<h3>📋 ${o ? 'Levels' : 'Control levels'}</h3><div class="cal-legend">Numbers are computed from the outcome tables the dice actually use (urgency unset, no custom events). </div><div id="suLvlList">${rows}</div><div class="actions"><button data-x>Close</button></div>`);
    w.querySelector('[data-x]').onclick = () => w.remove(); return w;
  }
  function openLevelTables() {
    const w = sheet(`<h3>📊 Outcome tables per control level</h3>
      <div class="cal-legend">Relative weights for each preset level. "Reset" restores the defaults.</div>
      <div style="overflow-x:auto"><table class="su-tbl" style="font-size:12px;border-collapse:collapse"><tr><th></th>${OUT.map(k => `<th>${OUT_LABEL[k]}</th>`).join('')}</tr>
      ${L().map(l => { const o = ladderOdds(l.key); return `<tr><td>${l.label}</td>${OUT.map(k => `<td><input type="number" min="0" max="100" data-lo="${l.key}:${k}" value="${Math.round(o[k])}" style="width:44px"></td>`).join('')}</tr>`; }).join('')}</table></div>
      <div class="actions"><button class="ok" id="ltSave">Save tables</button><button id="ltReset">Reset</button><button data-x>Close</button></div>`);
    w.querySelector('[data-x]').onclick = () => w.remove();
    w.querySelector('#ltReset').onclick = () => { saveLevelOdds({}); w.remove(); render(); };
    w.querySelector('#ltSave').onclick = () => {
      const o = {}; w.querySelectorAll('[data-lo]').forEach(e => { const [lk, k] = e.dataset.lo.split(':'); (o[lk] = o[lk] || {})[k] = Math.max(0, +e.value || 0); });
      const def = {}; L().forEach(l => { const changed = OUT.some((k, i) => o[l.key][k] !== l.odds[i]); if (changed) def[l.key] = o[l.key]; });
      saveLevelOdds(def); w.remove(); render(); toastMsg('Tables saved');
    };
    return w;
  }

  window.BSSimpleUrge = { POTTY_ACCESS, sliderValue, continueUrge, followUpFor, followUp, followDone, followActive, followState: fst, roll, press, chooseNatural, describe, profile, autoProfile, settings, saveSettings, urgeType, pickMessy, pickGear, inv, saveInv, invText, change, useGear, pendingAlarm, render, state: st, ALARM_ID, DEF_INV, OUT, PROT, SPARE,
    customProfiles, upsertProfile, deleteProfile, customEvents, upsertEvent, deleteEvent, levelOdds, saveLevelOdds, ladderOdds, exportJSON, importJSON, inWaitState, endByAccident, needsDailyReset,
    openProfileEditor, openEventEditor, openEventList, openLevelTables, openLevelList, accidentArmed, dismissAccident, protLabel, recDay, cantHold, reroll, setLogged, afterSmallPref, followChoose, cascadeState, CKEY };
  window.addEventListener('load', () => setTimeout(render, 60));
  window.addEventListener('bs:messy', () => { try { render(); } catch (e) {} });
  window.addEventListener('bs:control', () => { const m = document.getElementById('ctlChip'); if (m && window.BSControl) m.outerHTML = window.BSControl.chip(); });
})();
