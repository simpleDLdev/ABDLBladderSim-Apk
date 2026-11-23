/* ===========================
   checkins.js — v44 metric math and a short check-in.
   Estimates move only here. Missing metrics, missing drinks, and missing sleep are dropped.
   A check-in also refreshes the recommended gear.
   =========================== */
(function () {
  const KEY = 'bs_checkins_v1';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function defaults() { return { v: 1, every: 3, time: '20:30', nextAt: 0, items: [] }; }
  function load() { const s = Object.assign(defaults(), J(KEY, {})); s.every = s.every === 2 ? 2 : 3; s.items = Array.isArray(s.items) ? s.items : []; return s; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  const sV = V => 100 * clamp01((V - 100) / 300);
  const sF = (F, intakeL) => { let f = F; if (intakeL != null && intakeL > 2.5) f = F * Math.max(0.7, Math.min(1, 2.0 / intakeL)); return 100 * clamp01((12 - f) / 7); };
  const sI = I => 100 * clamp01((I - 45) / 135);
  const sU = U => 100 * (1 - Math.max(0, Math.min(10, U)) / 10);
  const sR = R => 100 * clamp01(1 - R / 4);
  const sW = W => 100 * clamp01(W / 30);
  const sLd = Ld => 100 * clamp01(1 - Ld / 4);
  const sAw = Aw => 100 * clamp01(Aw);
  const sDn = Dn => 100 * clamp01(Dn);
  const sWn = Wn => 100 * clamp01(1 - Wn / 3);
  const sSn = Sn => 100 * (1 - Math.max(0, Math.min(1, Sn)));
  const sWp = Wp => 100 * clamp01(Wp);
  const sWw = Ww => 100 * clamp01(Ww);
  function wmean(pairs) {
    let sw = 0, sx = 0;
    pairs.forEach(p => { if (p[0] == null || !isFinite(p[0])) return; sw += p[1]; sx += p[0] * p[1]; });
    return sw ? sx / sw : null;
  }
  function scoresFromRaw(m, intakeL) {
    m = m || {};
    const o = {};
    if (m.V != null) o.sV = sV(m.V);
    if (m.F != null) o.sF = sF(m.F, intakeL);
    if (m.I != null) o.sI = sI(m.I);
    if (m.U != null) o.sU = sU(m.U);
    if (m.R != null) o.sR = sR(m.R);
    if (m.W != null) o.sW = sW(m.W);
    if (m.Ld != null) o.sLd = sLd(m.Ld);
    if (m.Aw != null) o.sAw = sAw(m.Aw);
    if (m.Dn != null) o.sDn = sDn(m.Dn);
    if (m.Wn != null) o.sWn = sWn(m.Wn);
    if (m.Sn != null) o.sSn = sSn(m.Sn);
    if (m.Wp != null) o.sWp = sWp(m.Wp);
    if (m.Ww != null) o.sWw = sWw(m.Ww);
    if (m.sSl != null) o.sSl = m.sSl;
    return o;
  }
  function dayMeasured(sc) {
    sc = sc || {};
    return wmean([[sc.sI, 0.20], [sc.sF, 0.10], [sc.sV, 0.10], [sc.sW, 0.15], [sc.sU, 0.10], [sc.sR, 0.05], [sc.sLd, 0.20], [sc.sAw, 0.10]]);
  }
  function nightMeasured(sc) {
    sc = sc || {};
    return wmean([[sc.sDn, 0.35], [sc.sWn, 0.15], [sc.sSn, 0.15], [sc.sWp, 0.20], [sc.sWw, 0.10], [sc.sAw, 0.05], [sc.sSl, 0.10]]);
  }
  function updateEstimate(old, measured, confidence) {
    if (measured == null || !isFinite(measured)) return old;
    const k = 0.5 * Math.max(0, Math.min(1, +confidence || 0));
    let next = (+old || 0) + k * (measured - (+old || 0));
    next = Math.max((+old || 0) - 10, Math.min((+old || 0) + 10, next));
    return Math.round(Math.max(0, Math.min(100, next)) * 10) / 10;
  }
  function confidenceDay(days, shareMeasured) {
    return Math.min(1, (+days || 0) / 10) * (0.6 + 0.4 * Math.max(0, Math.min(1, shareMeasured == null ? 0 : +shareMeasured)));
  }
  function confidenceNight(nights, hasClipOrSleep) {
    return Math.min(1, (+nights || 0) / 7) * (hasClipOrSleep ? 1 : 0.8);
  }
  /** Least-squares slope of check-in values, in points per week. */
  function trendSlope(values, everyDays) {
    const ys = (values || []).filter(v => v != null && isFinite(v));
    const n = ys.length;
    if (n < 2) return 0;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i]; }
    const den = n * sxx - sx * sx;
    if (!den) return 0;
    const perStep = (n * sxy - sx * sy) / den;
    const every = everyDays || 3;
    return perStep * (7 / every);
  }
  function statusBadge(slope, plan) {
    plan = +plan || 0; slope = +slope || 0;
    if (Math.abs(plan) < 0.25) return Math.abs(slope) <= 0.4 ? 'flat' : 'on pace';
    if (Math.sign(slope) !== Math.sign(plan) && Math.abs(slope) > 1) return 'drifting away';
    if (Math.abs(slope - plan) <= 0.4 * Math.abs(plan)) return 'on pace';
    if (Math.abs(slope) < 0.5 * Math.abs(plan)) return Math.abs(slope) < 0.4 ? 'flat' : 'slow';
    return 'ahead';
  }
  function paceWeekly(pace) { return pace === 'gentle' ? 2 : pace === 'fast' ? 6 : 4; }
  function adjustAfterCheckIn(track, slope) {
    const planMag = paceWeekly(track.pace);
    const sign = Math.sign(track.target - track.estimate);
    const plan = planMag * sign;
    if (Math.abs(track.target - track.estimate) <= 5) {
      if (track.phase !== 'frozen') track.phase = 'maintain';
      return track;
    }
    if (sign !== 0 && Math.sign(slope) !== sign && Math.abs(slope) > 1) track.difficulty = (+track.difficulty || 2) - 0.5;
    else if (Math.abs(slope) < 0.5 * planMag) track.difficulty = (+track.difficulty || 2) + 0.25;
    else if (Math.abs(slope) > 1.5 * planMag) track.difficulty = (+track.difficulty || 2) - 0.25;
    track.difficulty = Math.max(1, Math.min(5, track.difficulty));
    return track;
  }
  function latestMetrics() {
    const items = load().items;
    if (!items.length) return null;
    const m = items[items.length - 1].metrics || null;
    return m;
  }
  function record(body) {
    body = body || {};
    const s = load();
    const dayKey = body.dayKey || new Date().toISOString().slice(0, 10);
    let intakeL = null;
    try { if (window.BSDrinks) intakeL = window.BSDrinks.intakeLitres(dayKey); } catch (e) {}
    const raw = Object.assign({}, body.metrics || {});
    if (body.sSl != null) raw.sSl = body.sSl;
    const sc = scoresFromRaw(raw, intakeL);
    const dayM = dayMeasured(sc), nightM = nightMeasured(sc);
    const item = {
      ts: Date.now(), covers: [dayKey],
      day: body.day || {}, night: body.night || [],
      body: body.body || { flags: [] },
      metrics: raw,
      drinksLogged: intakeL != null,
      intakeL: intakeL,
      estimates: {}
    };
    if (window.BSControl) {
      ['day', 'night'].forEach(name => {
        const tr = window.BSControl.trackState(name);
        const measured = name === 'day' ? dayM : nightM;
        const conf = name === 'day' ? confidenceDay(Math.min(10, s.items.length + 1), body.shareMeasured) : confidenceNight(Math.min(7, s.items.length + 1), body.sSl != null || body.hasSleep);
        const after = updateEstimate(tr.estimate, measured, measured == null ? 0 : Math.max(conf, 0.3));
        item.estimates[name] = { measured: measured, before: tr.estimate, after: after };
        const hist = s.items.map(it => it.estimates && it.estimates[name] && it.estimates[name].after).concat([after]);
        const slope = trendSlope(hist.slice(-6), s.every);
        const plan = paceWeekly(tr.pace) * Math.sign(tr.target - after);
        const patch = { estimate: after, confidence: conf };
        const adj = adjustAfterCheckIn(Object.assign({}, tr, { estimate: after }), slope);
        patch.difficulty = adj.difficulty; patch.phase = adj.phase;
        window.BSControl.setTrack(name, patch);
        item.estimates[name].slope = Math.round(slope * 10) / 10;
        item.estimates[name].badge = statusBadge(slope, plan);
      });
    }
    if (body.body && body.body.flags && window.BSSymptoms) {
      try { window.BSSymptoms.applyFlags(body.body.flags); } catch (e) {}
    }
    s.items.push(item);
    if (s.items.length > 40) s.items.splice(0, s.items.length - 40);
    s.nextAt = Date.now() + s.every * 864e5;
    save(s);
    try { if (window.BSGear) window.BSGear.refresh(); } catch (e) {}
    try { if (window.BSOnboard && window.BSOnboard.onCheckIn) window.BSOnboard.onCheckIn(item); } catch (e) {}
    return item;
  }
  function schedule(every, from) {
    const s = load();
    s.every = every === 2 ? 2 : 3;
    s.nextAt = (from || Date.now()) + s.every * 864e5;
    return save(s);
  }
  function num(id, root) { const el = root.querySelector('#' + id); if (!el || el.value === '') return null; return +el.value; }
  function render() {
    const m = document.getElementById('checkinMount'); if (!m) return;
    const s = load();
    const due = !s.nextAt || Date.now() >= s.nextAt;
    m.innerHTML = `<div class="urge-note"><b>Check-in</b> <span style="color:#8ea0b6">every ${s.every} days${due ? ' · due' : ''}</span>
      <button type="button" id="ckOpen" class="pill">Log a check-in</button>
      <label class="urge-lbl">Every <select id="ckEvery"><option value="3" ${s.every === 3 ? 'selected' : ''}>3 days</option><option value="2" ${s.every === 2 ? 'selected' : ''}>2 days</option></select></label></div>`;
    m.querySelector('#ckEvery').onchange = e => { const n = load(); n.every = e.target.value === '2' ? 2 : 3; save(n); };
    m.querySelector('#ckOpen').onclick = open;
  }
  function open() {
    if (typeof document === 'undefined') return;
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap'; w.id = 'checkinSheet';
    const field = (id, label, ph) => `<label class="fld"><span>${label}</span><input id="${id}" type="number" step="any" placeholder="${ph || ''}" style="width:100%"></label>`;
    w.innerHTML = `<div class="cal-sheet" role="dialog"><h3>Check-in</h3>
      <div class="cal-legend">Skip anything you don't know. A blank is left out. It is not a zero.</div>
      ${field('ckV', 'Typical void (ml)', '300')}
      ${field('ckF', 'Voids in the waking day', '7')}
      ${field('ckI', 'Typical gap (min)', '120')}
      ${field('ckU', 'Urgency at void (0–10)', '4')}
      ${field('ckW', 'Warning (min)', '15')}
      ${field('ckLd', 'Leaks today (0–4, size-weighted)', '0')}
      ${field('ckDn', 'Dry-night share lately (0–1)', '0.8')}
      ${field('ckWn', 'Wets per night', '0')}
      <div class="actions"><button type="button" class="ok" id="ckSave">Save</button><button type="button" data-x>Close</button></div>
      <div id="ckResult" class="cal-legend"></div></div>`;
    document.body.appendChild(w);
    w.querySelector('[data-x]').onclick = () => w.remove();
    w.querySelector('#ckSave').onclick = () => {
      const metrics = {};
      [['V', 'ckV'], ['F', 'ckF'], ['I', 'ckI'], ['U', 'ckU'], ['W', 'ckW'], ['Ld', 'ckLd'], ['Dn', 'ckDn'], ['Wn', 'ckWn']].forEach(pair => {
        const v = num(pair[1], w); if (v != null && isFinite(v)) metrics[pair[0]] = v;
      });
      let sSl = null;
      try {
        const night = window.BSSleep && window.BSSleep.nightOn(new Date().toISOString().slice(0, 10));
        if (night && metrics.Wn > 0) sSl = window.BSSleep.sSlForWets(night, [{ at: Date.now() - 4 * 3600000 }]);
      } catch (e) {}
      const item = record({ metrics: metrics, sSl: sSl, hasSleep: sSl != null, shareMeasured: metrics.V != null ? 1 : 0 });
      const r = w.querySelector('#ckResult');
      const ed = item.estimates.day || {}, en = item.estimates.night || {};
      const bal = window.BSDrinks ? window.BSDrinks.balance(new Date().toISOString().slice(0, 10), metrics.V != null && metrics.F != null ? metrics.V * metrics.F : null) : null;
      r.textContent = `Day ${ed.before} → ${ed.after} (${ed.badge || '—'}). Night ${en.before} → ${en.after} (${en.badge || '—'}).` + (bal ? ` Drinks ${bal.intakeText}, output ${bal.outputText}.` : '');
    };
  }
  window.BSCheckins = {
    KEY, load, save, record, schedule, latestMetrics, scoresFromRaw, dayMeasured, nightMeasured, updateEstimate,
    confidenceDay, confidenceNight, trendSlope, statusBadge, paceWeekly, adjustAfterCheckIn, wmean, render, open
  };
  try { window.addEventListener('load', () => { try { render(); } catch (e) {} }); } catch (e) {}
})();
