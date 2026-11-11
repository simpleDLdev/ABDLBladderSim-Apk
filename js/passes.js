/* ===========================
   passes.js — v44 Potty Pass as a request for better odds, not a guarantee.
   Answers: denied, granted, or compromise (partial first, or the walk may not make it).
   Weights use direction, target vs estimate, debt, gear vs the recommended step, and context.
   Allowance and debt backfires land in a later phase. Debt is stored so reverse can clear it.
   =========================== */
(function () {
  const KEY = 'bs_passes_v1';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  function defaults() { return { v: 1, debt: { day: 0, night: 0 }, requests: [] }; }
  function load() { const s = Object.assign(defaults(), J(KEY, {})); s.debt = Object.assign({ day: 0, night: 0 }, s.debt || {}); return s; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function debt(track) { const s = load(); return Math.max(0, +s.debt[track === 'night' ? 'night' : 'day'] || 0); }
  function resetDebt(track) {
    const s = load();
    if (!track) { s.debt.day = 0; s.debt.night = 0; }
    else s.debt[track === 'night' ? 'night' : 'day'] = 0;
    return save(s);
  }
  function addDebt(track, n) {
    const s = load(); const k = track === 'night' ? 'night' : 'day';
    s.debt[k] = Math.max(0, Math.min(10, Math.round((+s.debt[k] + (+n || 0)) * 10) / 10));
    return save(s);
  }
  function pick(weights, rng) {
    const keys = Object.keys(weights);
    const tot = keys.reduce((t, k) => t + Math.max(0, weights[k] || 0), 0) || 1;
    let r = (rng || Math.random)() * tot;
    for (const k of keys) { r -= Math.max(0, weights[k] || 0); if (r < 0) return k; }
    return keys[0];
  }
  /**
   * inp { track, estimate, target, debt, gear, recommended, context, urgency, realEmergency, rng }
   * → { outcome: denied|granted|compromise, kind?, pct?, then?, text, gearWarn }
   */
  function request(inp) {
    inp = inp || {};
    const rng = inp.rng || Math.random;
    const track = inp.track === 'night' ? 'night' : 'day';
    if (inp.realEmergency) return { outcome: 'granted', kind: 'real_need', guarantee: true, text: 'Real need — go now. No cost.', track: track };
    try { if (window.BSSymptoms && window.BSSymptoms.paused && window.BSSymptoms.paused()) return { outcome: 'granted', kind: 'paused', guarantee: true, text: 'Toilet whenever you need (paused).', track: track }; } catch (e) {}
    const est = inp.estimate != null ? +inp.estimate : 50;
    const tgt = inp.target != null ? +inp.target : est;
    const gap = est - tgt;
    const d = inp.debt != null ? +inp.debt : debt(track);
    let denied = 1, granted = 1, compromise = 1;
    if (gap > 5) {
      denied += gap / 20;
      compromise += 0.4 + d * 0.15;
      granted *= Math.max(0.35, 1 - d * 0.08);
    } else if (gap < -5) {
      granted += 1.2;
      denied *= 0.4;
      compromise *= 0.6;
    }
    let cmp = 'match';
    if (inp.gear && inp.recommended && window.BSGear) cmp = window.BSGear.compare(inp.gear, inp.recommended);
    if (cmp === 'lighter') { denied += 0.8; compromise += 0.4; granted *= 0.7; }
    const ctx = inp.context || 'home';
    if (ctx === 'office' || ctx === 'out' || ctx === 'car') { denied += 0.3; granted *= 0.85; }
    const u = inp.urgency == null ? null : +inp.urgency;
    if (u != null && u >= 9) { granted += 3; denied *= 0.2; }
    if (u != null && u >= 8) denied += 0; // waits are not offered at 8+; denied falls through to gear
    const outcome = pick({ denied: denied, granted: granted, compromise: compromise }, rng);
    const finish = !(window.BSPartial && window.BSPartial.load && window.BSPartial.load().finishOnToilet === false);
    const gearLabel = (inp.gear && window.BSGear) ? window.BSGear.byId(inp.gear).label : 'protection';
    const warn = (cmp === 'lighter' || cmp === 'heavier') && window.BSGear ? window.BSGear.warn(track, inp.gear).text : '';
    if (outcome === 'denied') {
      const then = (u != null && u >= 8) ? 'gear' : (u != null && u >= 6 ? 'gear' : 'wait');
      const text = then === 'gear' ? 'Not this time — use your ' + gearLabel.toLowerCase() + '.' : 'Not this time — wait a few minutes, then ask again.';
      return { outcome: 'denied', then: then, text: text, gearWarn: warn, weights: { denied: denied, granted: granted, compromise: compromise }, track: track };
    }
    if (outcome === 'granted') return { outcome: 'granted', then: 'toilet', text: 'Go ahead.', gearWarn: warn, weights: { denied: denied, granted: granted, compromise: compromise }, track: track };
    const pPartial = Math.min(0.8, 0.55 + Math.min(0.25, d * 0.04));
    const kind = rng() < pPartial ? 'partial_first' : 'walk_risk';
    let pct = 0.1;
    try { pct = window.BSPartial ? window.BSPartial.pct({ estimate: est, target: tgt, debt: d, gear: inp.gear }) : 0.1; } catch (e) {}
    let text;
    if (kind === 'walk_risk') text = 'You can head to the toilet. You may not fully make it.';
    else {
      text = 'Let about ' + Math.round(pct * 100) + '% go into your ' + gearLabel.toLowerCase() + '.';
      if (finish) text += ' Then empty on the toilet.';
    }
    return { outcome: 'compromise', kind: kind, pct: pct, finishOnToilet: kind === 'partial_first' ? finish : false, text: text, gearWarn: warn, weights: { denied: denied, granted: granted, compromise: compromise }, track: track };
  }
  function logRequest(res) {
    const s = load();
    s.requests.push({ ts: Date.now(), outcome: res.outcome, kind: res.kind || null, pct: res.pct || null, track: res.track || 'day', text: res.text });
    if (s.requests.length > 50) s.requests.splice(0, s.requests.length - 50);
    return save(s);
  }
  function render() {
    const m = document.getElementById('passMount'); if (!m) return;
    m.innerHTML = `<div class="urge-note" id="passBar"><b>Potty pass</b> <span style="color:#8ea0b6">a request, not a sure thing</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;" id="passCtx">
        ${['home', 'office', 'out', 'car', 'bed'].map(c => `<button type="button" data-ctx="${c}" class="pill">${c}</button>`).join('')}
      </div>
      <button type="button" id="passAsk" class="pill" style="margin-top:6px;">Request a pass</button>
      <div id="passOut" class="cal-legend"></div></div>`;
    let ctx = 'home';
    m.querySelectorAll('[data-ctx]').forEach(b => b.onclick = () => { ctx = b.dataset.ctx; });
    m.querySelector('#passAsk').onclick = () => {
      const track = window.BSControl ? window.BSControl.trackFor(Date.now(), ctx === 'bed' ? 'bed' : null) : 'day';
      let tr = { estimate: 50, target: 50 };
      try { tr = window.BSControl.trackState(track); } catch (e) {}
      const wearing = window.BSGear && window.BSGear.wearingFromInventory();
      const rec = window.BSGear && window.BSGear.recommended(track);
      let u = null;
      try { u = window.BSSimpleUrge && window.BSSimpleUrge.settings().lastUrgency; } catch (e) {}
      const res = request({ track: track, estimate: tr.estimate, target: tr.target, gear: wearing, recommended: rec, context: ctx, urgency: u });
      logRequest(res);
      const out = m.querySelector('#passOut');
      out.textContent = res.text + (res.gearWarn ? ' ' + res.gearWarn : '');
    };
  }
  window.BSPasses = { KEY, load, save, debt, resetDebt, addDebt, request, logRequest, render };
  try { window.addEventListener('load', () => { try { render(); } catch (e) {} }); } catch (e) {}
})();
