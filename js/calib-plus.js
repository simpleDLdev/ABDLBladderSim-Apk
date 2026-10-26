/* ===========================
   calib-plus.js — v18 calibration methods → one blended play-control estimate with a confidence %.
   Methods (all user-entered; nothing here asks for harder or longer holds):
     hold      timed comfortable-hold test — capped at 20 min, 🚽 Real need stops it at once
     interval  urge-to-void interval log over a day: tap "Urge noticed" (optional) and "Went"; scored on the natural gap between goes
     volume    optional voiding-volume diary (ml you enter; skip any time)
     accuracy  check-in accuracy: predict urgency in N min, then enter the actual value
     history   accidents & near-misses from your logs (calendar natural entries + near-miss taps)
     nights    night dryness from the calendar (natural nights)
   Each method → score 0–100 and a weight from its sample count. Estimate = weighted mean; confidence from
   total weight. Play calibration only. Key: bs_calib_plus_v1 (new).
   =========================== */
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const KEY = 'bs_calib_plus_v1', HOLD_CAP = 20, DAY = 864e5;
  const J = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)); const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  function load() { return Object.assign({ holds: [], urges: [], voids: [], volumes: [], predictions: [], nearMiss: [], openUrge: null, holdRun: null }, J(KEY, {})); }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  const METHODS = [
    { id: 'hold', icon: '⏱', name: 'Comfortable-hold test', how: 'Start when you first notice a comfortable urge. Stop when it stops feeling comfortable.' },
    { id: 'interval', icon: '📈', name: 'Urge-to-void interval log', how: 'Over a day, tap "Urge noticed" when you feel one (optional) and "Went" each time you go. Scored on your natural gap between goes — just go when you need to.' },
    { id: 'volume', icon: '🧪', name: 'Voiding-volume diary (optional)', how: 'If you like, enter the ml for a go. Skip any time.' },
    { id: 'accuracy', icon: '🎯', name: 'Check-in accuracy', how: 'Predict your urgency in 30 min; when asked, enter the actual value.' },
    { id: 'history', icon: '📋', name: 'Accidents & near-misses', how: 'From your calendar (natural entries) plus near-miss taps, last 14 days.' },
    { id: 'nights', icon: '🌙', name: 'Night dryness', how: 'From natural nights in your calendar, last 30 days.' }
  ];
  /** Pure: per-method {score, weight, n, detail} + blend. entries = calendar entries. */
  function compute(d, entries, now) {
    d = d || load(); entries = entries || []; now = now || Date.now(); const out = {};
    { const h = d.holds.slice(-10); const m = med(h.map(x => x.min)); out.hold = { n: h.length, score: m == null ? null : cl(Math.round(m / HOLD_CAP * 100), 0, 100), weight: Math.min(1, h.length / 3), detail: m == null ? 'no tests yet' : `median ${m} min of ${HOLD_CAP}` }; }
    { const g = d.urges.filter(u => u.went && u.went > now - 7 * DAY).map(u => u.went).sort((a, b) => a - b); const iv = []; for (let k = 1; k < g.length; k++) { const m = (g[k] - g[k - 1]) / 60000; if (m > 5 && m < 8 * 60) iv.push(Math.round(m)); }
      const m = med(iv); out.interval = { n: iv.length, score: m == null ? null : cl(Math.round((m - 30) / 120 * 100), 0, 100), weight: Math.min(1, iv.length / 6), detail: m == null ? 'log a few goes in one day' : `median ${m} min between goes (natural pace; 150+ scores the same)` }; }
    { const v = d.volumes.slice(-14).map(x => x.ml).filter(x => x > 0); const a = v.length ? Math.round(v.reduce((p, q) => p + q, 0) / v.length) : null; out.volume = { n: v.length, score: a == null ? null : cl(Math.round((a - 100) / 300 * 100), 0, 100), weight: Math.min(1, v.length / 5) * 0.6, detail: a == null ? 'optional — none entered' : `avg ${a} ml` }; }
    { const p = d.predictions.filter(x => x.actual != null).slice(-12); const mae = p.length ? p.reduce((s, x) => s + Math.abs(x.pred - x.actual), 0) / p.length : null; out.accuracy = { n: p.length, score: mae == null ? null : cl(Math.round(100 - mae * 15), 0, 100), weight: Math.min(1, p.length / 4) * 0.6, detail: mae == null ? 'no predictions checked' : `off by ${mae.toFixed(1)} on average` }; }
    { const since = now - 14 * DAY, nat = entries.filter(e => e.ts >= since && e.source === 'natural'); const acc = nat.filter(e => e.type === 'accident').length, leak = nat.filter(e => e.type === 'leak').length, nm = d.nearMiss.filter(t => t >= since).length;
      const days = new Set(nat.map(e => new Date(e.ts).toDateString()).concat(d.nearMiss.filter(t => t >= since).map(t => new Date(t).toDateString()))).size;
      const rate = days ? (acc + leak * 0.5 + nm * 0.25) / Math.max(days, 1) : null; out.history = { n: days, score: rate == null ? null : cl(Math.round(100 - rate * 40), 0, 100), weight: Math.min(1, days / 7), detail: days ? `${acc} accidents · ${leak} leaks · ${nm} near-misses over ${days} logged days` : 'nothing logged yet' }; }
    { const nn = entries.filter(e => e.type === 'night' && e.source === 'natural' && e.ts >= now - 30 * DAY && e.night); const dry = nn.filter(e => !e.night.wet).length; out.nights = { n: nn.length, score: nn.length ? Math.round(dry / nn.length * 100) : null, weight: Math.min(1, nn.length / 5) * 0.8, detail: nn.length ? `${dry}/${nn.length} dry` : 'no nights logged' }; }
    let sw = 0, sv = 0; Object.values(out).forEach(m => { if (m.score != null && m.weight > 0) { sw += m.weight; sv += m.score * m.weight; } });
    const MAXW = 1 + 1 + 0.6 + 0.6 + 1 + 0.8;
    const estimate = sw ? Math.round(sv / sw) : null, confidence = Math.round(cl(sw / MAXW, 0, 1) * 100);
    return { methods: out, estimate, confidence, band: estimate == null ? null : Math.round((1 - confidence / 100) * 30) };
  }
  const entries = () => { try { return W.BSCalendar.load().entries || []; } catch (e) { return []; } };
  function current() { return compute(load(), entries()); }
  /** Prior for Potty Path / quizzes: only when confidence ≥ 30. */
  function prior() { const c = current(); return c.estimate != null && c.confidence >= 30 ? c.estimate : null; }
  // ---------- actions ----------
  function holdStart(u) { const d = load(); d.holdRun = { at: Date.now(), u: u == null ? null : +u }; save(d); return d.holdRun; }
  function holdStop(reason, now) { const d = load(); if (!d.holdRun) return null; now = now || Date.now(); const min = Math.min(HOLD_CAP, Math.round((now - d.holdRun.at) / 6000) / 10); const r = { at: d.holdRun.at, min, reason, u: d.holdRun.u }; d.holds.push(r); d.holdRun = null; save(d); return r; }
  function urgeNoticed() { const d = load(); d.openUrge = Date.now(); save(d); }
  function went(ml) { const d = load(), now = Date.now(); d.urges.push({ at: d.openUrge && now - d.openUrge < 6 * 3600e3 ? d.openUrge : null, went: now }); d.openUrge = null; if (ml != null && ml !== '' && +ml > 0) d.volumes.push({ at: now, ml: Math.min(2000, +ml) }); save(d); }
  function predict(v, mins) { const d = load(); d.predictions.push({ at: Date.now(), due: Date.now() + (mins || 30) * 60000, pred: +v, actual: null }); save(d); }
  function answer(v) { const d = load(); const p = d.predictions.find(x => x.actual == null && x.due <= Date.now()) || d.predictions.find(x => x.actual == null); if (p) { p.actual = +v; save(d); } return p; }
  function nearMiss() { const d = load(); d.nearMiss.push(Date.now()); save(d); }
  // ---------- UI (Settings › Calibration) ----------
  let tick = null;
  function render() {
    const host = document.getElementById('calibrationMount'); if (!host) return; let m = document.getElementById('calibPlusMount');
    if (!m) { m = document.createElement('div'); m.id = 'calibPlusMount'; m.className = 'quiz-card'; host.after(m); }
    const d = load(), c = current(), due = d.predictions.find(x => x.actual == null && x.due <= Date.now()), pend = d.predictions.find(x => x.actual == null);
    const run = d.holdRun ? Math.min(HOLD_CAP * 60, Math.floor((Date.now() - d.holdRun.at) / 1000)) : 0;
    m.innerHTML = `<h3 style="margin:0 0 4px">🎯 Calibration methods</h3><div class="cal-legend">Six ways to learn how your bladder behaves. Everything here is what you tell it.</div>
      <div class="calib-big" id="cpEst">${c.estimate == null ? '—' : c.estimate + ' ± ' + c.band}</div><div class="cal-legend">Blended estimate · confidence <b id="cpConf">${c.confidence}%</b>${c.confidence >= 30 ? ' · used as the Potty Path starting estimate' : ' · needs 30% to feed the Path'}</div>
      ${METHODS.map(x => { const r = c.methods[x.id]; return `<div class="camp-goal"><b>${x.icon} ${esc(x.name)}</b> — ${r.score == null ? '<span class="muted">no data</span>' : r.score + '/100'} <small class="muted">(${esc(r.detail)} · weight ${Math.round(r.weight * 100)}%)</small><div class="cal-legend">${esc(x.how)}</div>${ctrl(x.id, d, run, due, pend)}</div>`; }).join('')}`;
    bind(m);
    clearInterval(tick); if (d.holdRun) tick = setInterval(() => { const dd = load(); if (!dd.holdRun) return clearInterval(tick); const s = Math.floor((Date.now() - dd.holdRun.at) / 1000); const el = document.getElementById('cpHoldT'); if (s >= HOLD_CAP * 60) { holdStop('cap'); if (typeof toast === 'function') toast('20-min cap reached — test stopped. Go whenever you like.'); render(); } else if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);
  }
  function ctrl(id, d, run, due, pend) {
    if (id === 'hold') return d.holdRun ? `<div class="calib-big" id="cpHoldT">${Math.floor(run / 60)}:${String(run % 60).padStart(2, '0')}</div><div class="quiz-nav"><button type="button" id="cpHoldStop" class="pp-ok">✋ Not comfortable any more — stop</button><button type="button" id="cpHoldReal" class="pp-real pp-pause">⏸ I'm going now</button></div>`
      : `<label class="fld"><span>Urgency now (you enter it): <b id="cpHUV">3</b>/10</span><input type="range" id="cpHU" min="0" max="10" value="3"></label><button type="button" id="cpHoldGo">▶ Start comfortable-hold test (max ${HOLD_CAP} min)</button>`;
    if (id === 'interval') return `<div class="quiz-nav"><button type="button" id="cpUrge" ${d.openUrge ? 'disabled' : ''}>${d.openUrge ? '🟢 Urge noted ' + new Date(d.openUrge).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '💭 Urge noticed'}</button><button type="button" id="cpWent">🚽 Went</button></div>`;
    if (id === 'volume') return `<div class="quiz-nav"><input id="cpMl" type="number" min="0" max="2000" placeholder="ml (optional)" style="width:110px"><button type="button" id="cpMlSave">Save with "Went"</button></div>`;
    if (id === 'accuracy') return due ? `<label class="fld"><span>You predicted ${due.pred}/10. Actual urgency now: <b id="cpAV">5</b>/10</span><input type="range" id="cpA" min="0" max="10" value="5"></label><button type="button" id="cpASave">✓ Save actual</button>`
      : pend ? `<div class="cal-legend">Prediction ${pend.pred}/10 due at ${new Date(pend.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</div>` : `<label class="fld"><span>Predict your urgency in 30 min: <b id="cpPV">4</b>/10</span><input type="range" id="cpP" min="0" max="10" value="4"></label><button type="button" id="cpPSave">🎯 Save prediction</button>`;
    if (id === 'history') return '<button type="button" id="cpNear">😬 Log a near-miss</button>';
    return '<button type="button" id="cpNight">🌙 Open calendar</button>';
  }
  function bind(m) {
    const on = (id, f) => { const e = m.querySelector('#' + id); if (e) e.onclick = () => { f(); render(); }; };
    const sl = (id, lab) => { const e = m.querySelector('#' + id); if (e) e.oninput = () => { m.querySelector('#' + lab).textContent = e.value; }; };
    sl('cpHU', 'cpHUV'); sl('cpA', 'cpAV'); sl('cpP', 'cpPV');
    on('cpHoldGo', () => holdStart(m.querySelector('#cpHU').value)); on('cpHoldStop', () => holdStop('uncomfortable')); on('cpHoldReal', () => { holdStop('real'); if (typeof toast === 'function') toast('Off you go.'); });
    on('cpUrge', urgeNoticed); on('cpWent', () => went()); on('cpMlSave', () => went(m.querySelector('#cpMl').value));
    on('cpPSave', () => predict(m.querySelector('#cpP').value, 30)); on('cpASave', () => answer(m.querySelector('#cpA').value)); on('cpNear', nearMiss);
    on('cpNight', () => { if (typeof switchTab === 'function') switchTab('calendar'); });
  }
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('load', () => { const o = window.renderCalibration; window.renderCalibration = function () { const r = o && o.apply(this, arguments); try { render(); } catch (e) { console.warn(e); } return r; }; });
  W.BSCalibPlus = { KEY, HOLD_CAP, METHODS, load, save, compute, current, prior, holdStart, holdStop, urgeNoticed, went, predict, answer, nearMiss, render };
})();
