/* ===========================
   urge.js — v6 Natural Urge tab. Roll for permission when you need to go.
   Pick #1 or #2 (#2 only with Messy content on) + urgency 0–10 → allowed / must wait X /
   wait for the timer / accident, using profile continence odds. Works with or without a
   running session (optional mini session). Every roll goes to the log + calendar (source sim).
   In-game simulation only. Never plays sound or vibrates.
   =========================== */
(function () {
  const SKEY = 'bs_urge_settings', MKEY = 'bs_urge_mini';
  const DEF = { waitWindowMin: 8, moderateMax: 7, launchGuide: true };
  const LV = ['fully_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent'];
  const PERMIT = [85, 70, 52, 36, 22];   // base permission % by continence level
  const ACC_K = [2, 4, 6, 9, 12];        // accident % per urgency point above 5
  function settings() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
  function saveSettings(s) { localStorage.setItem(SKEY, JSON.stringify(Object.assign(settings(), s))); }
  const messyOn = () => typeof window.isMessyEnabled === 'function' && window.isMessyEnabled();
  function levelIdx() { const l = typeof currentContinenceLevel !== 'undefined' ? currentContinenceLevel : 'mostly_continent'; const i = LV.indexOf(l); return i < 0 ? 1 : i; }
  function running() { return typeof sessionRunning !== 'undefined' && !!sessionRunning; }
  /** ms until the next major event, or null when no timer is running. */
  function nextMajorMs(now) {
    now = now || Date.now();
    if (!running() || typeof mainEndAt === 'undefined' || !mainEndAt || mainEndAt <= now) return null;
    return mainEndAt - now;
  }
  /** Timer check: is a major event coming soon? */
  function check(now) {
    const ms = nextMajorMs(now), s = settings();
    if (ms == null) return { running: running(), soon: false, minutes: null, text: running() ? 'No timed event pending.' : 'No session timer running.' };
    const m = ms / 60000, soon = m <= s.waitWindowMin;
    return { running: true, soon, minutes: Math.round(m * 10) / 10, text: soon ? `Something is coming up in ~${Math.ceil(m)} min.` : `Nothing due for ~${Math.round(m)} min.` };
  }
  /**
   * Pure roll. opts: { type: 1|2, urgency: 0..10, now, rng, level }.
   * Returns { outcome: 'allowed'|'close_call'|'wait'|'wait_timer'|'accident'|'not_yet', waitMin, chances }.
   */
  function roll(opts) {
    const s = settings(), rng = opts.rng || Math.random, now = opts.now || Date.now();
    const type = opts.type === 2 && messyOn() ? 2 : 1;
    const u = Math.max(0, Math.min(10, Math.round(+opts.urgency || 0)));
    const li = opts.level != null ? opts.level : levelIdx();
    let permit = PERMIT[li], acc = Math.max(0, u - 5) * ACC_K[li];
    if (u >= 8) { permit += (u - 7) * 8; acc += (u - 7) * 4; }   // high urgency: more likely allowed… or it just happens
    if (type === 2) acc = Math.round(acc * 0.6);
    acc = Math.min(70, acc); permit = Math.min(95, permit);
    const chances = { permit, accident: acc, level: LV[li], urgency: u, type };
    if (u <= 1) return { outcome: 'not_yet', waitMin: 15, chances };
    const ms = nextMajorMs(now);
    if (ms != null && ms / 60000 <= s.waitWindowMin && u <= s.moderateMax) {
      return { outcome: 'wait_timer', waitMin: Math.ceil(ms / 60000), chances: Object.assign(chances, { timerMin: Math.round(ms / 6000) / 10 }) };
    }
    const r = rng() * 100;
    if (r < acc) return { outcome: 'accident', waitMin: 0, chances };
    if (r < acc + permit * (100 - acc) / 100) {
      const close = u >= 7 && r > acc + permit * (100 - acc) / 100 - 8;
      return { outcome: close ? 'close_call' : 'allowed', waitMin: 0, chances };
    }
    const waitMin = Math.max(2, Math.round((5 + rng() * 15) * (1 - u / 14)));
    return { outcome: 'wait', waitMin, chances };
  }
  const LABEL = { allowed: '✅ Allowed — go now', close_call: '😅 Allowed — close call!', wait: '⏳ Must wait', wait_timer: '⏱️ Wait for the timer', accident: '💦 Too late — accident', not_yet: '🙂 Not yet' };
  const COLOR = { allowed: '#55efc4', close_call: '#fdcb6e', wait: '#74b9ff', wait_timer: '#a29bfe', accident: '#ff7675', not_yet: '#8ea0b6' };
  function describe(res) {
    const t = res.chances.type === 2 ? '#2' : '#1', u = res.chances.urgency;
    switch (res.outcome) {
      case 'allowed': return `${t} at ${u}/10: permission granted. Off you go!`;
      case 'close_call': return `${t} at ${u}/10: allowed — but it was a close call on the way.`;
      case 'wait': return `${t} at ${u}/10: not yet. Hold on for ${res.waitMin} min, then roll again.`;
      case 'wait_timer': return `${t} at ${u}/10: the timer has something planned in ~${res.waitMin} min. Wait for it.`;
      case 'accident': return `${t} at ${u}/10: it couldn't wait — accident!`;
      default: return `${t} at ${u}/10: that's barely an urge. Check back in ${res.waitMin} min.`;
    }
  }
  /** Log a roll to the session log + calendar (sim). */
  function record(res) {
    const html = `<span style="color:${COLOR[res.outcome]}"><b>🙋 Natural urge:</b> ${LABEL[res.outcome]}</span><br><span style="color:#cdd7e6">${describe(res)}</span>` +
      `<br><span style="color:#8ea0b6;font-size:0.85em">odds — allowed ${Math.round(res.chances.permit)}% · accident ${Math.round(res.chances.accident)}% · ${res.chances.level.replace(/_/g, ' ')}</span>`;
    try { if (typeof logToOutput === 'function') logToOutput(html); } catch (e) {}
    try {
      const C = window.BSCalendar; if (!C) return;
      const base = { source: 'sim', mode: 'natural_urge', urgency: res.chances.urgency * 10, memo: describe(res) };
      const ev = { kind: 'urge', label: LABEL[res.outcome] };
      const messy = res.chances.type === 2 && messyOn() ? true : undefined;
      if (res.outcome === 'accident') C.addEntry(Object.assign(base, { type: 'accident', severity: 'wet', messy, event: ev }));
      else if (res.outcome === 'close_call') C.addEntry(Object.assign(base, { type: 'leak', severity: 'damp', event: ev }));
      else if (res.outcome === 'allowed') C.addEntry(Object.assign(base, { type: 'potty', event: ev }));
      else C.addEntry(Object.assign(base, { type: 'event', event: ev }));
    } catch (e) { console.warn('urge calendar log failed', e); }
    const m = mini(); if (m.active) { m.rolls++; m[res.outcome] = (m[res.outcome] || 0) + 1; localStorage.setItem(MKEY, JSON.stringify(m)); }
  }
  // ---- optional mini (standalone) session ----
  function mini() { try { return Object.assign({ active: false, rolls: 0 }, JSON.parse(localStorage.getItem(MKEY) || '{}')); } catch (e) { return { active: false, rolls: 0 }; } }
  function miniStart() { localStorage.setItem(MKEY, JSON.stringify({ active: true, startedAt: Date.now(), rolls: 0 })); try { logToOutput('<span style="color:#a29bfe">🙋 Mini urge session started.</span>'); } catch (e) {} render(); }
  function miniStop() {
    const m = mini(); if (!m.active) return;
    const mins = Math.round((Date.now() - m.startedAt) / 60000);
    try { logToOutput(`<span style="color:#a29bfe">🙋 Mini urge session ended — ${mins} min, ${m.rolls} roll(s): ${['allowed', 'close_call', 'wait', 'wait_timer', 'accident'].map(k => `${k.replace('_', ' ')} ${m[k] || 0}`).join(', ')}.</span>`); } catch (e) {}
    localStorage.setItem(MKEY, JSON.stringify({ active: false, rolls: 0 })); render();
  }
  // ---- UI ----
  let ui = { type: 1, urgency: 5, last: null, waitUntil: 0 };
  function act(res) {
    record(res); ui.last = res;
    if (res.outcome === 'wait' || res.outcome === 'wait_timer' || res.outcome === 'not_yet') ui.waitUntil = Date.now() + res.waitMin * 60000;
    else ui.waitUntil = 0;
    render();
    if (!settings().launchGuide || typeof startVoidGuide !== 'function') return;
    try {
      if (res.outcome === 'accident') {
        const tbl = res.chances.type === 2 && typeof MESSY_PUSHING_ACCIDENTS_D10 !== 'undefined' ? MESSY_PUSHING_ACCIDENTS_D10 : (typeof FULL_D20 !== 'undefined' ? FULL_D20 : []);
        const ev = tbl.filter(e => e.guide && e.guide.length); const pickd = ev[Math.floor(Math.random() * ev.length)];
        if (pickd) startVoidGuide(pickd.guide, `<b>Natural urge:</b> ${pickd.desc || 'Too late!'}`, 'full');
      } else if (res.outcome === 'allowed' || res.outcome === 'close_call') {
        startVoidGuide([{ text: 'GO TO THE POTTY', time: 0, type: 'stop' }], '<b>Natural urge:</b> permission granted.', 'micro');
      }
    } catch (e) { console.warn(e); }
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function render() {
    const m = document.getElementById('urgeMount'); if (!m) return;
    if (ui.type === 2 && !messyOn()) ui.type = 1;
    const s = settings(), ck = check(), mn = mini(), last = ui.last;
    const waitLeft = ui.waitUntil > Date.now() ? Math.ceil((ui.waitUntil - Date.now()) / 60000) : 0;
    m.innerHTML = `<h2 style="margin:0 0 6px;">🙋 Natural Urge</h2>
      <p class="section-desc">Feel like you need to go? Roll for it. The result uses your current profile odds — and if a session timer is running, it may tell you to wait for it.</p>
      <div class="urge-type" role="group" aria-label="Type">
        <button type="button" id="urgeT1" class="${ui.type === 1 ? 'on' : ''}">#1 Pee</button>
        <button type="button" id="urgeT2" class="messy-only ${ui.type === 2 ? 'on' : ''}">#2 Poop</button>
      </div>
      <label class="urge-lbl" for="urgeLevel">Urgency right now: <b id="urgeLevelV">${ui.urgency}/10</b></label>
      <input id="urgeLevel" type="range" min="0" max="10" step="1" value="${ui.urgency}" style="width:100%; background:linear-gradient(to right,#2ecc71 0%,#f1c40f 50%,#e74c3c 100%);">
      <div class="urge-actions"><button type="button" id="urgeRoll" style="background:#ff7675;color:#000;font-weight:bold;">🎲 Roll — can I go?</button>
        <button type="button" id="urgeCheck">🔍 Check timer</button></div>
      <div id="urgeCheckOut" class="urge-note">${esc(ck.text)}</div>
      ${last ? `<div id="urgeResult" class="urge-result" data-outcome="${last.outcome}" style="border-color:${COLOR[last.outcome]}"><b style="color:${COLOR[last.outcome]}">${LABEL[last.outcome]}</b><div>${esc(describe(last))}</div>${waitLeft ? `<div class="urge-note">⏳ ~${waitLeft} min left before rolling again.</div>` : ''}</div>` : ''}
      <details class="urge-more"><summary>Mini session &amp; options</summary>
        <div class="urge-note">${running() ? 'A full session is running — rolls attach to it.' : 'No full session needed. Start a short mini session to tally rolls.'}</div>
        <div class="urge-actions">${mn.active ? `<button type="button" id="urgeMiniStop">⏹ End mini session (${mn.rolls} rolls)</button>` : `<button type="button" id="urgeMiniStart">▶ Start mini session</button>`}</div>
        <label class="urge-lbl">Wait-for-timer window: <input id="urgeWin" type="number" min="1" max="30" step="1" value="${s.waitWindowMin}" style="width:64px"> min</label>
        <label class="urge-lbl">“Moderate” urgency up to: <input id="urgeMod" type="number" min="1" max="10" step="1" value="${s.moderateMax}" style="width:64px"> /10</label>
        <label class="urge-lbl"><input id="urgeGuide" type="checkbox" ${s.launchGuide ? 'checked' : ''}> Open the guide for results</label>
      </details>`;
    const q = id => m.querySelector('#' + id);
    q('urgeT1').onclick = () => { ui.type = 1; render(); };
    q('urgeT2').onclick = () => { if (messyOn()) { ui.type = 2; render(); } };
    q('urgeLevel').oninput = e => { ui.urgency = +e.target.value; q('urgeLevelV').textContent = ui.urgency + '/10'; };
    q('urgeRoll').onclick = () => act(roll({ type: ui.type, urgency: ui.urgency }));
    q('urgeCheck').onclick = () => { const c = check(); q('urgeCheckOut').textContent = c.text; try { logToOutput(`<span style="color:#a29bfe">🔍 Urge timer check: ${esc(c.text)}</span>`); } catch (e) {} };
    const ms = q('urgeMiniStart'), me = q('urgeMiniStop'); if (ms) ms.onclick = miniStart; if (me) me.onclick = miniStop;
    q('urgeWin').onchange = e => saveSettings({ waitWindowMin: Math.max(1, Math.min(30, +e.target.value || 8)) });
    q('urgeMod').onchange = e => saveSettings({ moderateMax: Math.max(1, Math.min(10, +e.target.value || 7)) });
    q('urgeGuide').onchange = e => saveSettings({ launchGuide: e.target.checked });
  }
  window.BSUrge = { roll, check, record, describe, settings, saveSettings, render, mini, miniStart, miniStop, PERMIT, ACC_K, _ui: () => ui };
  window.renderUrge = render;
  window.addEventListener('bs:messy', () => render());
})();
