/* ===========================
   partial.js — v44 partial release as one weighted "I need to go" outcome.
   The percent scales with direction, target gap, and debt. The daily cap is a setting (default 4).
   finishOnToilet defaults on and only changes the wording. It is not checked or enforced.
   The settings line about retention and UTIs lives here, once.
   =========================== */
(function () {
  const KEY = 'bs_partial_v1';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const dk = ts => { const d = new Date(ts || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function defaults() { return { v: 1, dailyCap: 4, finishOnToilet: true, day: dk(), count: 0, log: [] }; }
  function load() {
    const s = Object.assign(defaults(), J(KEY, {}));
    const day = dk();
    if (s.day !== day) { s.day = day; s.count = 0; }
    s.dailyCap = Math.max(0, Math.min(12, Math.round(+s.dailyCap || 0)));
    s.finishOnToilet = s.finishOnToilet !== false;
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function saveSettings(p) {
    const s = load();
    if (p.dailyCap != null) s.dailyCap = Math.max(0, Math.min(12, Math.round(+p.dailyCap)));
    if (p.finishOnToilet != null) s.finishOnToilet = !!p.finishOnToilet;
    return save(s);
  }
  function debtOf(track) {
    try { if (window.BSPasses && window.BSPasses.debt) return window.BSPasses.debt(track); } catch (e) {}
    return 0;
  }
  /** Fraction of the void to let go first. Cap 30%. */
  function pct(inp) {
    inp = inp || {};
    const est = inp.estimate != null ? +inp.estimate : 50;
    const tgt = inp.target != null ? +inp.target : est;
    const gap = est - tgt;
    let base = gap > 5 ? 0.12 + Math.min(40, gap) / 200 : gap < -5 ? 0.06 : 0.08;
    const debtF = 1 + 0.1 * Math.max(0, (+inp.debt || 0) - 2);
    let p = Math.min(0.30, base * debtF);
    if (inp.gear && window.BSGear) {
      const i = window.BSGear.LADDER.findIndex(g => g.id === inp.gear);
      if (i >= 4) p = Math.min(p, 0.15);
    }
    return Math.round(p * 100) / 100;
  }
  function rollWeight(inp) {
    inp = inp || {};
    try { if (window.BSSymptoms && window.BSSymptoms.paused && window.BSSymptoms.paused()) return 0; } catch (e) {}
    try { if (!window.BSControl || window.BSControl.mode() !== 'conditioning') return 0; } catch (e) { return 0; }
    if (inp.messy) return 0;
    if (inp.urgency != null && inp.urgency >= 9) return 0;
    const s = load();
    if (s.count >= s.dailyCap) return 0;
    const track = inp.track === 'night' ? 'night' : 'day';
    let tr = null;
    try { tr = window.BSControl.trackState(track); } catch (e) {}
    if (!tr || tr.phase === 'frozen') return 0;
    const gap = Math.abs(tr.target - tr.estimate);
    const dir = window.BSControl.direction(track);
    let w = 8 + gap / 10;
    if (dir === 'regress') w += 6;
    if (dir === 'progress') w *= 0.55;
    if (debtOf(track) >= 3) w *= 1.25;
    return Math.round(w * 10) / 10;
  }
  function plan(inp) {
    inp = inp || {};
    const track = inp.track === 'night' ? 'night' : 'day';
    let tr = { estimate: inp.estimate, target: inp.target };
    try { if (inp.estimate == null && window.BSControl) tr = window.BSControl.trackState(track); } catch (e) {}
    const s = load();
    const gear = inp.gear || (window.BSGear && window.BSGear.wearingFromInventory && window.BSGear.wearingFromInventory()) || null;
    const p = pct({ estimate: tr.estimate, target: tr.target, debt: inp.debt != null ? inp.debt : debtOf(track), gear: gear });
    const label = gear && window.BSGear ? window.BSGear.byId(gear).label : 'protection';
    let text = 'Let about ' + Math.round(p * 100) + '% go into your ' + label.toLowerCase() + '.';
    if (s.finishOnToilet) text += ' Then empty on the toilet.';
    return { pct: p, finishOnToilet: s.finishOnToilet, gear: gear, track: track, text: text };
  }
  function noteUse(info) {
    const s = load();
    s.count += 1;
    s.log.push(Object.assign({ ts: Date.now(), emptied: null }, info || {}));
    if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
    save(s);
    return s;
  }
  function logResult(ts, emptied) {
    const s = load();
    const row = s.log.slice().reverse().find(r => !ts || r.ts === ts) || s.log[s.log.length - 1];
    if (row) row.emptied = emptied;
    return save(s);
  }
  function renderSettings() {
    const m = document.getElementById('partialSettingsMount'); if (!m) return;
    const s = load();
    m.innerHTML = `<div class="urge-note"><b>Partial releases</b>
      <label class="urge-lbl">Daily cap <input id="ptCap" type="number" min="0" max="12" value="${s.dailyCap}" style="width:56px"> <span style="color:#8ea0b6">today ${s.count}</span></label>
      <label class="urge-lbl"><input type="checkbox" id="ptFin" ${s.finishOnToilet ? 'checked' : ''}> After a partial, empty fully on the toilet</label>
      <div class="cal-legend">Emptying fully helps avoid retention and UTIs.</div></div>`;
    m.querySelector('#ptCap').onchange = e => { saveSettings({ dailyCap: +e.target.value }); renderSettings(); };
    m.querySelector('#ptFin').onchange = e => saveSettings({ finishOnToilet: e.target.checked });
  }
  window.BSPartial = { KEY, load, save, saveSettings, pct, rollWeight, plan, noteUse, logResult, renderSettings, debtOf };
  try { window.addEventListener('load', () => { try { renderSettings(); } catch (e) {} }); } catch (e) {}
})();
