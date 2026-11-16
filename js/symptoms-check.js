/* ===========================
   symptoms-check.js — v44 red-flag check and symptom pause.
   Pause stops conditioning nudges (partials, drink prompts, A rules via the flag).
   Resume is a manual tap. Streaks are left for later phases; nothing here deletes logs.
   Hesitancy and straining never count as progress. Skin soreness is a gear pause, not a full pause.
   Four real-need overrides in a day show a quiet "anything feel off?" chip. No pause unless a flag is ticked.
   =========================== */
(function () {
  const KEY = 'bs_symptom_v1';
  const FLAGS = [
    { id: 'burning', label: 'Pain or burning when peeing', pause: 'now', care: 'See a doctor (possible infection).' },
    { id: 'blood', label: 'Blood in urine (pink, red, or brown)', pause: 'now', care: 'See a doctor.' },
    { id: 'fever', label: 'Fever, chills, or back/side pain', pause: 'now', care: 'Seek care today.' },
    { id: 'retention', label: "Can't pee, or very little comes out with a strong urge", pause: 'now', care: 'Seek care now.' },
    { id: 'not_empty', label: 'Not emptying, with a weak stream or straining', pause: 'repeat', care: 'See a doctor.' },
    { id: 'hesitancy', label: 'A lot of trouble starting', pause: 'repeat', care: 'See a doctor.' },
    { id: 'cloudy', label: 'Cloudy or strong-smelling urine, with another symptom', pause: 'with', care: 'See a doctor.' },
    { id: 'skin', label: 'Skin soreness or rash from gear', pause: 'skin', care: 'Change now. Gear goals can wait 2 days.' }
  ];
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const dk = ts => { const d = new Date(ts || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function defaults() { return { paused: false, pausedAt: null, reason: null, care: null, reminder: 'gentle', lastCheckDay: '', watch: { hesitancyLotCount: 0, notEmptyCount: 0 }, skinHoldUntil: 0, overrideDay: '', overrideCount: 0, history: [] }; }
  function load() {
    const s = Object.assign(defaults(), J(KEY, {}));
    if (s.reminder !== 'off' && s.reminder !== 'required') s.reminder = 'gentle';
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function paused() { return !!load().paused; }
  /**
   * flags: id strings. watch is the stored counters (not yet including this submission).
   * Returns { pause, skin, care, reason, watch }.
   */
  function evaluate(flags, watch) {
    flags = flags || [];
    watch = Object.assign({ hesitancyLotCount: 0, notEmptyCount: 0 }, watch || {});
    const next = { hesitancyLotCount: flags.indexOf('hesitancy') >= 0 ? watch.hesitancyLotCount + 1 : 0, notEmptyCount: flags.indexOf('not_empty') >= 0 ? watch.notEmptyCount + 1 : 0 };
    const hit = id => flags.indexOf(id) >= 0;
    let pause = false, skin = false, care = '', reason = null;
    FLAGS.forEach(f => {
      if (!hit(f.id)) return;
      if (f.pause === 'now') { pause = true; reason = f.id; care = f.care; }
      if (f.pause === 'skin') { skin = true; if (!care) care = f.care; }
    });
    if (hit('cloudy') && flags.filter(id => id !== 'cloudy').length) { pause = true; reason = reason || 'cloudy'; care = care || 'See a doctor.'; }
    if (next.hesitancyLotCount >= 2) { pause = true; reason = reason || 'hesitancy'; care = care || 'See a doctor.'; }
    if (next.notEmptyCount >= 2) { pause = true; reason = reason || 'not_empty'; care = care || 'See a doctor.'; }
    return { pause: pause, skin: skin, care: care, reason: reason, watch: next };
  }
  function applyFlags(flags) {
    const s = load();
    const ev = evaluate(flags, s.watch);
    s.watch = ev.watch;
    if (ev.skin) s.skinHoldUntil = Date.now() + 2 * 864e5;
    s.lastCheckDay = dk();
    if (ev.pause) {
      s.paused = true; s.pausedAt = Date.now(); s.reason = ev.reason; s.care = ev.care;
      s.history.push({ ts: s.pausedAt, flags: flags.slice(), action: 'pause' });
    } else s.history.push({ ts: Date.now(), flags: flags.slice(), action: ev.skin ? 'skin' : 'ok' });
    if (s.history.length > 40) s.history.splice(0, s.history.length - 40);
    save(s);
    if (ev.pause) openPause();
    return ev;
  }
  function pauseFor(reason, care) {
    const s = load();
    s.paused = true; s.pausedAt = Date.now(); s.reason = reason || 'reconsent'; s.care = care || 'Conditioning is paused.';
    s.history.push({ ts: s.pausedAt, flags: [s.reason], action: 'pause' });
    save(s); openPause(); return s;
  }
  function resume() {
    const s = load(); s.paused = false; s.reason = null; s.care = null;
    s.history.push({ ts: Date.now(), flags: [], action: 'resume' });
    save(s);
    const el = document.getElementById('symptomPause'); if (el) el.remove();
    return s;
  }
  function noteRealOverride() {
    const s = load(); const day = dk();
    if (s.overrideDay !== day) { s.overrideDay = day; s.overrideCount = 0; }
    s.overrideCount += 1; save(s); return s.overrideCount;
  }
  function openPause() {
    if (typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('symptomPause');
    const s = load(); if (!s.paused) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'symptomPause'; el.className = 'cal-sheet-wrap'; document.body.appendChild(el); }
    const flag = FLAGS.find(f => f.id === s.reason);
    el.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true"><h3>Paused</h3>
      <p>${flag ? flag.label : (s.reason || 'Paused')}</p>
      <p><b>${s.care || 'See a doctor if something feels wrong.'}</b></p>
      <div class="cal-legend">Chapters, debt, drink prompts, and night scoring stay put. Nothing is deleted. Real need still means go.</div>
      <div class="actions"><button type="button" class="ok" id="symResume">I've been checked / feeling fine</button></div></div>`;
    el.querySelector('#symResume').onclick = () => resume();
  }
  function reminder() { return load().reminder; }
  function setReminder(mode) {
    const s = load();
    s.reminder = mode === 'off' || mode === 'required' ? mode : 'gentle';
    return save(s);
  }
  function checkedToday(now) { return load().lastCheckDay === dk(now); }
  function blocksSession(now) { return reminder() === 'required' && !checkedToday(now) && !paused(); }
  function openCheck(done) {
    if (typeof document === 'undefined' || !document.body) { if (done) done(); return; }
    let el = document.getElementById('symptomCheck');
    if (!el) { el = document.createElement('div'); el.id = 'symptomCheck'; el.className = 'cal-sheet-wrap'; document.body.appendChild(el); }
    const s = load();
    el.innerHTML = `<div class="cal-sheet" role="dialog"><h3>Body check-in</h3>
      <div class="cal-legend">Tick anything that is true. Leaving them all off is a fine check. This does not start by itself.</div>
      ${s.paused ? '<div>Paused. ' + (s.care || '') + '</div>' : ''}
      <div id="symFlags">${FLAGS.map(f => `<label class="urge-lbl"><input type="checkbox" data-flag="${f.id}"> ${f.label}</label>`).join('')}</div>
      <div class="actions"><button type="button" class="ok" id="symSave">Save check</button><button type="button" id="symClose">Close</button>${s.paused ? '<button type="button" id="symRes">Resume</button>' : ''}</div></div>`;
    el.querySelector('#symClose').onclick = () => el.remove();
    const res = el.querySelector('#symRes'); if (res) res.onclick = () => { resume(); el.remove(); paintButtons(); };
    el.querySelector('#symSave').onclick = () => {
      const flags = [...el.querySelectorAll('[data-flag]:checked')].map(i => i.dataset.flag);
      applyFlags(flags);
      el.remove();
      paintButtons();
      if (done) done();
    };
  }
  function buttonHtml(prefix) {
    const s = load();
    const note = s.reminder === 'required' ? 'Required before a session until you check in today.' : (s.reminder === 'off' ? 'Reminders are off.' : 'Gentle reminder only. A session is not blocked.');
    return `<div class="urge-note" id="${prefix}Box"><b>Body check</b>
      <div class="cal-legend">${note}${s.lastCheckDay ? ' Last check ' + s.lastCheckDay + '.' : ''}${s.paused ? ' Paused. ' + (s.care || '') : ''}</div>
      <button type="button" id="${prefix}Go" class="pill">Body check-in</button>
      <label class="urge-lbl">Reminders <select id="${prefix}Rem">
        <option value="off" ${s.reminder === 'off' ? 'selected' : ''}>Off</option>
        <option value="gentle" ${s.reminder === 'gentle' ? 'selected' : ''}>Gentle reminder</option>
        <option value="required" ${s.reminder === 'required' ? 'selected' : ''}>Required before sessions</option>
      </select></label></div>`;
  }
  function paintButtons() {
    ['symptomMount', 'safetyBodyCheck'].forEach(id => {
      const m = document.getElementById(id); if (!m) return;
      const prefix = id === 'safetyBodyCheck' ? 'safeBody' : 'symBtn';
      m.innerHTML = buttonHtml(prefix);
      const go = m.querySelector('#' + prefix + 'Go');
      if (go) go.onclick = () => openCheck();
      const sel = m.querySelector('#' + prefix + 'Rem');
      if (sel) sel.onchange = () => { setReminder(sel.value); paintButtons(); try { if (window.BSOnboard && window.BSOnboard.render) window.BSOnboard.render(); } catch (e) {} };
    });
  }
  function render() { paintButtons(); }
  window.BSSymptoms = { KEY, FLAGS, load, save, paused, evaluate, applyFlags, pauseFor, resume, noteRealOverride, openPause, openCheck, render, reminder, setReminder, checkedToday, blocksSession };
  try { window.addEventListener('load', () => { try { render(); if (load().paused) openPause(); } catch (e) {} }); } catch (e) {}
})();
