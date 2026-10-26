/* ===========================
   calibration.js — Void calibration test (Settings › Calibration)
   Everything here produces GAME STATS ONLY — not a medical measure.
   Sets the existing leak-duration scalar (leakTimeScale, "⏱️ Leak/Push Duration")
   so a full accident at 100% lasts about as long as the measured void.
   =========================== */
(function () {
  const KEY = 'bs_calibration_v1';
  // Nominal push+relax seconds of a full accident at 1.0× (median of the macro/accident
  // tables' push+relax totals: BABYSITTER_ACCIDENT 8–11, MACRO_* 10–17, FULL_TRAINING 18 → 14 s).
  const FULL_REF_SEC = 14;
  const SCALE_MIN = 0.5, SCALE_MAX = 10; // slider range
  const OZ = 29.5735;

  // ---------- reference data (see docs/CALIBRATION-QUIZ-CAMPAIGN.md for sources) ----------
  // Expected bladder capacity, children 1–12: ICCS/Hjälmås 30×(age+1) ml; levels at 390 ml from 12.
  function expectedCapacity(age) {
    if (age == null || isNaN(age)) return null;
    if (age <= 12) return 30 * (Math.max(0, age) + 1);
    return 390; // adults typically 300–500+, game reference uses 390–450 band
  }
  // Adult average flow (Qavg) game reference: ~13 ml/s around age 30 (Kumar 2009),
  // males decline ~1.39 ml/s per decade (Kim 2024 J Clin Med); females ~flat <60.
  function refAvgFlow(age, sex) {
    const a = Math.max(18, Math.min(90, age || 30));
    if (sex === 'male') return Math.max(5, 13 - 0.139 * (a - 30));
    if (sex === 'female') return a < 60 ? 15 : 15 - 0.1 * (a - 60);
    return Math.max(5, 14 - 0.07 * (a - 30));
  }
  const URINATION_LAW = { mean: 21, sd: 13 }; // Yang et al. 2014 PNAS

  // ---------- storage ----------
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.trials)) return d; } catch (e) {} return { version: 1, trials: [], form: {} }; }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

  // ---------- math ----------
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const toMl = (v, unit) => v == null || v === '' || isNaN(+v) || +v <= 0 ? null : (unit === 'oz' ? +v * OZ : +v);
  /** Leak scalar so a 100% full accident (FULL_REF_SEC at 1×) lasts ~measuredSec. */
  function scalarFor(measuredSec) {
    if (!measuredSec || measuredSec <= 0) return 1;
    return Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, measuredSec / FULL_REF_SEC)) * 10) / 10;
  }
  /** Duration of a leak of `fraction` (0–1) of a full accident, in seconds, at a given scalar. */
  function leakSecondsFor(fraction, scalar) { return Math.max(1, Math.round(FULL_REF_SEC * Math.max(0, Math.min(1, fraction)) * scalar)); }
  function summarize(trials) {
    const d = trials.map(t => t.durationSec).filter(x => x > 0);
    const v = trials.map(t => t.volumeMl).filter(x => x > 0);
    const f = trials.filter(t => t.volumeMl > 0 && t.durationSec > 0).map(t => t.volumeMl / t.durationSec);
    const r1 = x => x == null ? null : Math.round(x * 10) / 10;
    return { n: trials.length, medianSec: r1(median(d)), meanSec: r1(mean(d)), medianMl: v.length ? Math.round(median(v)) : null,
      meanMl: v.length ? Math.round(mean(v)) : null, flowMlS: f.length ? r1(median(f)) : null, scalar: scalarFor(median(d)) };
  }
  /** "Bladder age" game stat. Returns {capacityAge, label, notes[], durationBand, flowRef}. */
  function bladderAge(sum, profile) {
    profile = profile || {};
    const age = +profile.age || null, sex = profile.sex || 'na';
    const out = { capacityAge: null, label: '', notes: [], flowRef: age ? Math.round(refAvgFlow(age, sex) * 10) / 10 : null, durationBand: null, gentle: false };
    if (sum.medianSec != null) {
      const z = (sum.medianSec - URINATION_LAW.mean) / URINATION_LAW.sd;
      out.durationBand = Math.abs(z) <= 1 ? 'typical (within 21 ± 13 s)' : (z < 0 ? 'quicker than the 21 s "law"' : 'longer than the 21 s "law"');
    }
    if (sum.medianMl != null) {
      const v = sum.medianMl;
      if (v >= 390) { out.capacityAge = 12; out.label = 'Functional capacity typical of an adult (age 12+ reference)'; }
      else { out.capacityAge = Math.max(1, Math.round(v / 30 - 1)); out.label = `Functional capacity typical of age ${out.capacityAge}`; }
      if (v < 150 || v > 800) out.gentle = true;
    } else out.label = 'Add a measured volume to unlock the capacity age';
    if (sum.flowMlS != null && sum.flowMlS < 10) out.gentle = true;
    return out;
  }


  /** v13: long, level-varying bladder-age write-up (game flavour only). */
  function ageStory(ba, sum) {
    const a = ba.capacityAge; if (a == null) return [];
    const office = !!(window.BSOffice && window.BSOffice.on());
    const band = a >= 12 ? 3 : a >= 8 ? 2 : a >= 4 ? 1 : 0;
    const P = [];
    const H = [['🍼 Tiny-tot tank', 'Your bladder behaves like a toddler\'s: it fills fast, holds a small cup, and decides on its own. Expect short waits, little warning and lots of changes.'],
      ['🧸 Little-kid tank', 'Your bladder is like a preschooler\'s: you get some warning, but not much, and waits are short. Dribbles on the way to the potty are common.'],
      ['🎒 Big-kid tank', 'Your bladder is like a school kid\'s: a decent warning, medium waits, and accidents mostly when you get distracted.'],
      ['🎓 Grown-up tank', 'Your bladder is grown-up sized: long waits, clear warnings, and accidents only when the dice say so.']][band];
    P.push(['', H[0]]);
    P.push(['What it means', H[1]]);
    P.push(['Likely', ['Short waits, hidden timers, frequent "use your gear" rolls, small cups at a time.', 'Hurry-up rolls and the odd dribble before you get there.', 'A mix of waits and holds; accidents mostly after long holds.', 'Long waits and "hold till hard" rolls; accidents are rare and usually big.'][band]]);
    P.push(['Unlikely', ['Long holds or surprise dry streaks.', 'Hour-long waits.', 'Constant tiny leaks.', 'Frequent small dribbles.'][band]]);
    P.push(['Typical day', ['Changes every couple of hours; checks before meals and naps.', 'Potty tries every hour or so, plus checks.', 'Trips every two hours, a spare in the bag.', 'Trips every three hours; protection optional.'][band]]);
    P.push(['Typical night', ['Silent nights in thick protection; a morning check.', 'Night protection, mixed mornings.', 'Mostly dry nights, light backup.', 'Dry nights; no backup needed unless you choose it.'][band]]);
    P.push(['Tips', 'Re-run the test on a few different days for a steadier median.']);
    if (sum && sum.medianSec != null) P.push(['Fun fact', `Your median of ${sum.medianSec} s compares with the "law of urination": most mammals empty in about 21 seconds.`]);
    return office ? P.map(([t, x]) => [t, window.BSOffice && window.BSOffice.swap ? window.BSOffice.swap(x) : x]) : P;
  }
  // ---------- apply ----------
  function applyScalar(s) {
    if (typeof updateLeakTimeScale === 'function') updateLeakTimeScale(s); else localStorage.setItem('leakTimeScale', JSON.stringify(s));
    const sl = document.getElementById('leakTimeScaleSlider'); if (sl) sl.value = s;
    const d = load(); d.appliedScalar = s; d.appliedAt = Date.now(); save(d);
  }

  // ---------- test runner ----------
  let run = null; // {holdStyle, segs:[{start,end}], active, t0, tick}
  function heldMs(r, now) { return r.segs.reduce((a, s) => a + ((s.end || now) - s.start), 0); }
  function press() { if (!run) return; if (run.holdStyle) { if (!run.active) { run.active = true; run.segs.push({ start: Date.now() }); } } else { toggle(); } paint(); }
  function release() { if (!run || !run.holdStyle || !run.active) return; run.active = false; run.segs[run.segs.length - 1].end = Date.now(); paint(); }
  function toggle() { if (run.active) { run.active = false; run.segs[run.segs.length - 1].end = Date.now(); } else { run.active = true; run.segs.push({ start: Date.now() }); } }
  function paint() {
    const b = document.getElementById('calHold'), t = document.getElementById('calTime'); if (!b || !run) return;
    b.classList.toggle('held', run.active);
    b.textContent = run.holdStyle ? (run.active ? 'FLOWING… (release to pause)' : 'HOLD while flowing') : (run.active ? 'TAP to pause' : 'TAP to start / resume');
    if (t) t.textContent = (heldMs(run, Date.now()) / 1000).toFixed(1) + ' s · ' + run.segs.length + ' stream' + (run.segs.length === 1 ? '' : 's');
  }
  function startTest(form) {
    run = { holdStyle: !!form.holdStyle, segs: [], active: false, form };
    run.tick = setInterval(paint, 100);
    render();
  }
  function finishTest(volumeRaw, unit) {
    if (!run) return null;
    if (run.active) { run.active = false; run.segs[run.segs.length - 1].end = Date.now(); }
    clearInterval(run.tick);
    const durationSec = Math.round(heldMs(run, Date.now()) / 100) / 10;
    const f = run.form; run = null;
    if (durationSec < 1) { if (typeof toast === 'function') toast('No flow time recorded — trial discarded'); render(); return null; }
    return addTrial({ sex: f.sex, age: f.age, urgency: f.urgency, holdStyle: f.holdStyle, durationSec, volumeMl: toMl(volumeRaw, unit) });
  }
  function addTrial(t) {
    const d = load();
    const trial = Object.assign({ id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: Date.now() }, t);
    if (trial.volumeMl != null) trial.volumeMl = Math.round(trial.volumeMl);
    d.trials.push(trial); save(d);
    const s = summarize(d.trials); applyScalar(s.scalar); render(); return trial;
  }
  function deleteTrial(id) { const d = load(); d.trials = d.trials.filter(t => t.id !== id); save(d); const s = summarize(d.trials); if (d.trials.length) applyScalar(s.scalar); render(); }
  function cancelTest() { if (run) clearInterval(run.tick); run = null; render(); }

  // ---------- UI ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function resultsCard(d) {
    if (!d.trials.length) return '<div class="cal-legend">No trials yet. Run the test once (a few trials on different days gives a steadier median).</div>';
    const s = summarize(d.trials), last = d.trials[d.trials.length - 1];
    const ba = bladderAge(s, { age: last.age, sex: last.sex });
    const unit = (d.form && d.form.unit) || 'ml';
    const vol = ml => ml == null ? '—' : unit === 'oz' ? (ml / OZ).toFixed(1) + ' oz' : ml + ' ml';
    return `<div class="calib-card">
      
      <div class="calib-big">${esc(ba.label)}</div>
      <div class="calib-grid">
        <div><b>${s.medianSec ?? '—'} s</b><span>median full-empty time</span></div>
        <div><b>${vol(s.medianMl)}</b><span>median volume</span></div>
        <div><b>${s.flowMlS ?? '—'}${s.flowMlS != null ? ' ml/s' : ''}</b><span>avg flow (vol ÷ time)</span></div>
        <div><b>${s.scalar.toFixed(1)}×</b><span>leak scalar set</span></div>
      </div>
      <div class="cal-legend">Trials: ${s.n} · mean ${s.meanSec ?? '—'} s · urination-time "law": ${ba.durationBand || '—'}${ba.flowRef ? ` · typical avg flow for your age/sex ≈ ${ba.flowRef} ml/s` : ''}.
      A full accident now lasts ≈ <b>${leakSecondsFor(1, s.scalar)} s</b>; a half leak ≈ ${leakSecondsFor(0.5, s.scalar)} s.</div>
      <div class="calib-story" id="calibStory">${ageStory(ba, s).map(([t, x]) => `<p>${t ? '<b>' + esc(t) + ':</b> ' : ''}${esc(x)}</p>`).join('')}</div>
      ${ba.gentle ? `<div class="calib-note">💬 Just so you know: these numbers are rough and home timing is imprecise, so this isn't a diagnosis. Everyone varies. If you notice a <i>persistent</i> change in your flow or how much you go, it's worth mentioning to a doctor at your next visit.</div>` : ''}
      <div class="calib-trials">${d.trials.slice().reverse().map(t => `<div class="calib-trial"><span>${new Date(t.ts).toLocaleDateString()} · ${t.durationSec}s${t.volumeMl ? ' · ' + vol(t.volumeMl) : ''} · urge ${t.urgency ?? '—'}/10</span><button type="button" data-cdel="${t.id}" aria-label="Delete trial">🗑</button></div>`).join('')}</div>
    </div>`;
  }
  function render() {
    const m = document.getElementById('calibrationMount'); if (!m) return;
    const d = load(), f = d.form || {};
    if (run) {
      m.innerHTML = `<h2 style="margin:0 0 6px;">🎯 Calibration — recording</h2>
        <p class="section-desc">${run.holdStyle ? 'Hold the button while flowing; release if the stream pauses and press again when it restarts.' : 'Tap when flow starts, tap again if it pauses.'} Tap <b>Done</b> when finished. Just go normally — don't push, hold back or change anything for the test.</p>
        <button type="button" id="calHold" class="calib-hold">${run.holdStyle ? 'HOLD while flowing' : 'TAP to start / resume'}</button>
        <div id="calTime" class="calib-time">0.0 s · 0 streams</div>
        <div class="cal-row"><label class="fld"><span>Measured volume (optional)</span><input id="calVol" type="number" min="0" step="1" inputmode="decimal" value=""></label>
          <label class="fld"><span>Unit</span><select id="calUnit"><option value="ml" ${f.unit !== 'oz' ? 'selected' : ''}>ml</option><option value="oz" ${f.unit === 'oz' ? 'selected' : ''}>oz</option></select></label></div>
        <div class="cal-row"><button type="button" id="calDone" style="background:#55efc4;color:#000;font-weight:bold;">✓ Done</button><button type="button" id="calCancel">Cancel</button></div>`;
      const b = m.querySelector('#calHold');
      b.addEventListener('mousedown', e => { e.preventDefault(); press(); });
      b.addEventListener('touchstart', e => { e.preventDefault(); press(); }, { passive: false });
      ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev => b.addEventListener(ev, e => { if (ev.startsWith('touch')) e.preventDefault(); release(); }, { passive: false }));
      b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) press(); } });
      b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') release(); });
      m.querySelector('#calDone').onclick = () => { const u = m.querySelector('#calUnit').value; const dd = load(); dd.form = Object.assign(dd.form || {}, { unit: u }); save(dd); finishTest(m.querySelector('#calVol').value, u); };
      m.querySelector('#calCancel').onclick = cancelTest;
      paint(); return;
    }
    m.innerHTML = `<h2 style="margin:0 0 6px;">🎯 Calibration (void timing)</h2>
      <p class="section-desc">Time a normal trip to the bathroom once so accidents last about as long as yours really take. It sets ⏱️ Leak/Push Duration for you.</p>
      <div class="cal-row"><label class="fld"><span>Sex</span><select id="calSex">${[['male', 'Male'], ['female', 'Female'], ['na', 'Prefer not to say']].map(([v, l]) => `<option value="${v}" ${f.sex === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="fld"><span>Age</span><input id="calAge" type="number" min="18" max="110" value="${esc(f.age || '')}"></label></div>
      <label class="fld"><span>Urgency right before (0–10): <b id="calUrgV">${f.urgency ?? 5}</b></span><input id="calUrg" type="range" min="0" max="10" value="${f.urgency ?? 5}"></label>
      <label class="toggle-row"><span>Use press-to-leak style (hold the button while flowing)</span><input type="checkbox" id="calHoldStyle" ${f.holdStyle !== false ? 'checked' : ''}></label>
      <div class="cal-row"><button type="button" id="calStart" style="background:#a29bfe;color:#000;font-weight:bold;">▶ Start test</button></div>
      ${resultsCard(d)}`;
    m.querySelector('#calUrg').oninput = e => { m.querySelector('#calUrgV').textContent = e.target.value; };
    m.querySelector('#calStart').onclick = () => {
      const form = { sex: m.querySelector('#calSex').value, age: +m.querySelector('#calAge').value || null, urgency: +m.querySelector('#calUrg').value, holdStyle: m.querySelector('#calHoldStyle').checked };
      const dd = load(); dd.form = Object.assign(dd.form || {}, form); save(dd); startTest(form);
    };
    m.querySelectorAll('[data-cdel]').forEach(b => { b.onclick = () => { if (confirm('Delete this trial?')) deleteTrial(b.dataset.cdel); }; });
  }

  window.BSCalib = { ageStory, FULL_REF_SEC, load, save, summarize, scalarFor, leakSecondsFor, bladderAge, expectedCapacity, refAvgFlow, median, mean, toMl,
    addTrial, deleteTrial, startTest, finishTest, press, release, render, applyScalar, URINATION_LAW };
  window.renderCalibration = render;
})();
