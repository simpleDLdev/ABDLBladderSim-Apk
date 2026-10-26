/* ===========================
   messy-timer.js — v10 "Random #2 timer" (Natural Urge tab; only when Messy content (#2) is ON).
   Pick an control level + a time range → hidden countdown (time never shown). At a random moment
   ONE prompt fires, worded per control level: Good/Okay = potty permission; Shaky = coin-flip; Little/None =
   gear guide (steps from MESSY_PUSHING_ACCIDENTS_D10). Little/None may add one early "heads-up" prompt.
   Respects Prompt output (BSPrompt), office mode (neutral wording), one native alarm, never during Natural Night.
   Game rules only: never strain; if your body isn't ready, tap "Not now"; a real need always wins — just go.
   =========================== */
(function () {
  const KEY = 'bs_messy_timer_v1', ALARM_ID = 1960, EARLY_ID = 1961;
  const LEVELS = {
    good: { name: 'Good', potty: 1, early: 0 },
    okay: { name: 'Okay', potty: 0.85, early: 0 },
    shaky: { name: 'Shaky', potty: 0.5, early: 0.15 },
    little: { name: 'Little', potty: 0.15, early: 0.35 },
    none: { name: 'None', potty: 0, early: 0.5 }
  };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const office = () => !!(window.BSOffice && window.BSOffice.on());
  const sw = s => office() && window.BSOffice ? window.BSOffice.swap(s) : s;
  const silent = () => typeof window.isBedwettingSilent === 'function' && window.isBedwettingSilent();
  const messy = () => typeof window.isMessyEnabled === 'function' && window.isMessyEnabled();
  function st() { return Object.assign({ level: 'okay', lo: 20, hi: 90, dueAt: 0, earlyAt: 0, earlyDone: true, last: null }, J(KEY, {})); }
  function save(p) { const n = Object.assign(st(), p); localStorage.setItem(KEY, JSON.stringify(n)); return n; }
  /** v11 (B11): "From my profile" = the Natural Urge control level (Control meter band / chosen preset), not the continence index. */
  function derived() { try { const k = window.BSSimpleUrge.profile().levelKey; const m = { off: 'good', full: 'good', good: 'good', okay: 'okay', shaky: 'shaky', little: 'little', none: 'none' }[k]; if (m && LEVELS[m]) return m; } catch (e) {} try { const b = window.BSControl.band(); return b === 'full' ? 'good' : (LEVELS[b] ? b : 'okay'); } catch (e) { return 'okay'; } }
  function log(t, c) { try { typeof logToOutput === 'function' && logToOutput(`<span style="color:${c || '#cdd7e6'}">${String(sw(t)).replace(/[&<>]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))}</span>`); } catch (e) {} }
  function cal(type, memo, extra) { try { window.BSCalendar && window.BSCalendar.addEntry(Object.assign({ source: 'sim', mode: 'messy_timer', type, memo, event: { kind: 'messy_timer', label: memo } }, extra || {})); } catch (e) {} }

  function start(opts, rng) {
    opts = opts || {}; rng = rng || Math.random; const s = st();
    if (!messy()) return null;
    if (silent()) { toastSafe('Not available during Natural Night.'); return null; }
    const level = LEVELS[opts.level] ? opts.level : (opts.level === 'auto' ? derived() : s.level);
    const lo = Math.max(1, +(opts.lo != null ? opts.lo : s.lo)), hi = Math.max(lo, +(opts.hi != null ? opts.hi : s.hi));
    const mins = lo + rng() * (hi - lo), now = Date.now(), dueAt = Math.round(now + mins * 60000); // v13b: integer ms — the native plugin reads `at` as a long
    const early = rng() < LEVELS[level].early;
    const n = save({ level, lo, hi, dueAt, earlyAt: early ? Math.round(now + mins * (0.3 + rng() * 0.4) * 60000) : 0, earlyDone: !early, last: null, startedAt: now });
    log(`💩 Random #2 timer started — control: ${LEVELS[level].name}. The time is hidden.`, '#e17055');
    sync(); render(); return n;
  }
  function cancel() { save({ dueAt: 0, earlyAt: 0, earlyDone: true }); log('💩 Random #2 timer cancelled.'); sync(); render(); }
  function toastSafe(t) { try { typeof toast === 'function' && toast(t); } catch (e) {} }
  /** Pure outcome roll for a level. */
  function outcome(level, rng) {
    rng = rng || Math.random; const L = LEVELS[level] || LEVELS.okay;
    if (rng() < L.potty) return { kind: 'potty', text: level === 'good' ? 'You may go to the potty now.' : level === 'okay' ? 'Potty time — head there now, no dawdling.' : 'Lucky — you made it. Go to the potty now.' };
    const tbl = typeof MESSY_PUSHING_ACCIDENTS_D10 !== 'undefined' ? MESSY_PUSHING_ACCIDENTS_D10.filter(e => e.guide && e.guide.length) : [];
    const e = tbl[Math.floor(rng() * tbl.length)];
    return { kind: 'gear', text: `No potty this time — use your gear${e ? ' (' + e.name + ')' : ''}. Only if your body is ready; never strain.`, guide: e ? e.guide : null, name: e ? e.name : null };
  }
  function fireEarly() {
    save({ earlyDone: true }); sync();
    try { window.BSPrompt && window.BSPrompt.ping(520); } catch (e) {}
    const t = office() ? 'Heads-up: a check-in is coming soon.' : 'Heads-up: a tummy rumble — stay close to your gear.';
    log('💩 ' + t, '#fdcb6e'); cal('event', 'Random #2 timer — early heads-up'); render();
  }
  function fire(rng) {
    const s = st(); if (!s.dueAt) return null;
    if (silent()) { save({ dueAt: 0 }); return null; }
    const o = outcome(s.level, rng);
    save({ dueAt: 0, earlyAt: 0, earlyDone: true, last: Object.assign({ at: Date.now(), level: s.level }, o) });
    try { window.BSPrompt && window.BSPrompt.ping(o.kind === 'potty' ? 784 : 440); } catch (e) {}
    log(`💩 Random #2 timer (${LEVELS[s.level].name}): ${o.text}`, o.kind === 'potty' ? '#55efc4' : '#e17055');
    cal(o.kind === 'potty' ? 'potty' : 'event', 'Random #2 timer — ' + (o.kind === 'potty' ? 'potty permission' : 'gear prompt'), { level: s.level });
    sync(); render(); return o;
  }
  /** Outcome logging after the prompt: did it / not now. */
  function resolve(did) {
    const s = st(); if (!s.last) return;
    const l = s.last; save({ last: Object.assign({}, l, { resolved: did ? 'done' : 'skipped' }) });
    if (did && l.kind === 'gear') { cal('accident', 'Random #2 timer — messy (sim)', { severity: 'messy' }); log('💩 Logged: messy (sim).', '#e17055'); }
    else if (did) log('🚽 Logged: made it to the potty.', '#55efc4');
    else log('Not now — skipped. That\'s always fine.');
    render();
  }
  function tick() {
    const s = st(), now = Date.now();
    if (!s.dueAt) return;
    if (!messy()) return;
    if (!s.earlyDone && s.earlyAt && now >= s.earlyAt) fireEarly();
    if (now >= s.dueAt) fire();
  }
  /** Single native alarm for the hidden due time (read by native-notify.js). */
  function pendingAlarm(now) {
    now = now || Date.now(); const s = st();
    if (!s.dueAt || s.dueAt < now - 60000 || !messy() || silent()) return null;
    const n = office() ? { title: 'Reminder', body: 'Time for your break.' } : { title: 'Bladder Sim', body: 'Your #2 timer is up — open the app.' };
    return Object.assign({ id: ALARM_ID, at: Math.floor(s.dueAt), kind: 'alarm' }, n);
  }
  /** v13b: optional early heads-up as a native reminder (Little/None/Shaky only). */
  function pendingEarly(now) {
    now = now || Date.now(); const s = st();
    if (!s.dueAt || s.earlyDone || !s.earlyAt || s.earlyAt < now - 60000 || !messy() || silent()) return null;
    const n = office() ? { title: 'Reminder', body: 'Check-in coming soon.' } : { title: 'Bladder Sim', body: 'Heads-up from your #2 timer — open the app.' };
    return Object.assign({ id: EARLY_ID, at: Math.floor(s.earlyAt), kind: 'reminder' }, n);
  }
  function sync() { setTimeout(() => { try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }, 0); }

  function render() {
    const m = document.getElementById('messyTimerMount'); if (!m) return;
    const s = st(), running = !!s.dueAt, l = s.last;
    const opts = Object.keys(LEVELS).map(k => `<option value="${k}" ${k === s.level ? 'selected' : ''}>${LEVELS[k].name}</option>`).join('') + `<option value="auto">From my profile (${LEVELS[derived()].name})</option>`;
    m.innerHTML = `<h2 style="margin:0 0 6px;">💩 Random #2 timer</h2>
      ${running ? `<div class="urge-result" id="mtRunning">⏳ Timer running (control: ${LEVELS[s.level].name}). The time is hidden — carry on.</div>
        <div class="urge-actions"><button type="button" id="mtAcc" style="background:#e17055;color:#000;font-weight:bold;">💦 Had an accident</button><button type="button" id="mtCancel">Cancel timer</button></div>` : `
      <label class="urge-lbl">Control level <select id="mtLevel">${opts}</select></label>
      <label class="urge-lbl">Between <input id="mtLo" type="number" min="1" max="600" value="${s.lo}" style="width:64px"> and <input id="mtHi" type="number" min="1" max="720" value="${s.hi}" style="width:64px"> min</label>
      <div class="urge-actions"><button type="button" id="mtStart">Start hidden timer</button></div>`}
      ${l && !running ? `<div class="urge-result" id="mtResult" data-kind="${l.kind}"><b>${sw(l.text)}</b>
        ${!l.resolved ? `<div class="urge-actions">${l.guide ? '<button type="button" id="mtGuide">▶ Guide</button>' : ''}<button type="button" id="mtDone">${l.kind === 'potty' ? 'Made it' : 'Done'}</button><button type="button" id="mtSkip">Not now</button></div>` : `<div class="urge-note">Logged: ${l.resolved}</div>`}</div>` : ''}
      <div class="cal-legend">Never strain — if your body isn't ready, tap "Not now". Not available during Natural Night.</div>`;
    const q = id => m.querySelector('#' + id);
    if (q('mtStart')) q('mtStart').onclick = () => start({ level: q('mtLevel').value, lo: +q('mtLo').value, hi: +q('mtHi').value });
    if (q('mtCancel')) q('mtCancel').onclick = cancel;
    if (q('mtAcc')) q('mtAcc').onclick = () => window.BSAccident && window.BSAccident.open({ ctx: 'messy_timer', instruction: 'Random #2 timer (hidden wait)', duringWait: true, messy: true });
    if (q('mtGuide')) q('mtGuide').onclick = () => { try { startVoidGuide(l.guide, `<b>${sw(l.name || 'Guide')}</b>`, 'full'); } catch (e) {} };
    if (q('mtDone')) q('mtDone').onclick = () => resolve(true);
    if (q('mtSkip')) q('mtSkip').onclick = () => resolve(false);
    try { if (office()) window.BSOffice.apply(); } catch (e) {}
  }
  window.BSMessyTimer = { EARLY_ID, pendingEarly, LEVELS, start, cancel, fire, fireEarly, outcome, resolve, tick, pendingAlarm, render, state: st, derived, ALARM_ID };
  window.addEventListener('load', () => { setTimeout(render, 80); setInterval(tick, 5000); });
  window.addEventListener('bs:messy', () => { render(); sync(); });
})();
