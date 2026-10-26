/* ===========================
   alarm-grace.js — "Run to potty" grace window + auto-accident.
   When a MAIN event alarm fires (alarmMain), the user has a grace window to
   respond (Run to potty / Reveal / Skip). If the window runs out, an accident
   is declared automatically (haveAccident()).
     • App open & visible when the alarm fired  → foreground window
       (default 30 s at lowest control … 90 s at highest control).
     • App backgrounded / screen off / killed   → background window measured
       from the alarm's scheduled fire time (default 10 … 15 min).
       On return we compute elapsed time and either still offer Run-to-potty
       (with the remaining time) or declare the accident.
   Control comes from the session's continence level (currentContinenceLevel,
   Settings/Session → "Continence level"): fully_continent = 1.0 … fully_incontinent = 0.0.
   Bedwetting mode: never starts a grace window and never auto-declares anything.
   Pure helpers are exposed on window.BSGrace for tests.
   =========================== */
(function () {
  const SKEY = 'bs_grace_settings';
  const PKEY = 'bs_grace_pending';
  const DEFAULTS = { enabled: true, fgMinSec: 30, fgMaxSec: 90, bgMinMin: 10, bgMaxMin: 15 };
  const LATE_MS = 5000; // a JS timer that fires >5 s after the scheduled time means the page was asleep
  let pending = null;   // { firedAt, foreground, graceMs }
  let tick = null;

  const silent = () => { try { return typeof isBedwettingSilent === 'function' && isBedwettingSilent(); } catch (e) { return false; } };
  const num = (v, d, lo, hi) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };

  function settings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) {}
    const o = Object.assign({}, DEFAULTS, s);
    o.enabled = o.enabled !== false;
    o.fgMinSec = num(o.fgMinSec, DEFAULTS.fgMinSec, 5, 600);
    o.fgMaxSec = num(o.fgMaxSec, DEFAULTS.fgMaxSec, o.fgMinSec, 900);
    o.bgMinMin = num(o.bgMinMin, DEFAULTS.bgMinMin, 1, 120);
    o.bgMaxMin = num(o.bgMaxMin, DEFAULTS.bgMaxMin, o.bgMinMin, 240);
    return o;
  }
  function saveSettings(s) { localStorage.setItem(SKEY, JSON.stringify(Object.assign(settings(), s))); }

  /** 0 (no control) … 1 (full control) from the continence level. */
  function controlValue(level) {
    const lv = level || (typeof currentContinenceLevel !== 'undefined' ? currentContinenceLevel : 'mostly_continent');
    const list = (typeof CONTINENCE_LEVELS !== 'undefined') ? CONTINENCE_LEVELS
      : ['fully_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent'];
    const i = list.indexOf(lv);
    return i < 0 ? 0.75 : 1 - i / (list.length - 1);
  }
  /** Grace length in ms for a given context. */
  function graceMs(foreground, control, s) {
    s = s || settings();
    const c = Math.max(0, Math.min(1, control == null ? controlValue() : control));
    if (foreground) return Math.round((s.fgMinSec + (s.fgMaxSec - s.fgMinSec) * c) * 1000);
    return Math.round((s.bgMinMin + (s.bgMaxMin - s.bgMinMin) * c) * 60000);
  }
  /** Decide state at `now` for an alarm that fired at firedAt. */
  function evaluate(firedAt, now, ms) {
    const elapsed = Math.max(0, now - firedAt);
    return elapsed >= ms ? { status: 'expired', elapsed, remainingMs: 0 } : { status: 'open', elapsed, remainingMs: ms - elapsed };
  }
  /** Was the app open & visible at fire time? scheduledAt = intended fire time. */
  function classify(scheduledAt, now, hidden) {
    if (hidden) return { foreground: false, firedAt: scheduledAt || now };
    if (scheduledAt && now - scheduledAt > LATE_MS) return { foreground: false, firedAt: scheduledAt };
    return { foreground: true, firedAt: now };
  }

  function persist() { try { if (pending) localStorage.setItem(PKEY, JSON.stringify(pending)); else localStorage.removeItem(PKEY); } catch (e) {} }
  function fmt(ms) { const s = Math.ceil(ms / 1000); return s >= 120 ? `${Math.ceil(s / 60)} min` : `${s}s`; }

  function ensureButton() {
    const b = document.getElementById('alarmBanner'); if (!b) return null;
    let run = document.getElementById('graceRunBtn');
    if (!run) {
      run = document.createElement('button');
      run.id = 'graceRunBtn'; run.className = 'btn ack'; run.type = 'button';
      run.textContent = '🏃 Run to potty';
      run.onclick = () => runToPotty();
      b.insertBefore(run, b.querySelector('.btn.ack'));
    }
    let cd = document.getElementById('graceCountdown');
    if (!cd) { cd = document.createElement('span'); cd.id = 'graceCountdown'; cd.style.cssText = 'font-weight:bold;color:#fdcb6e;'; b.insertBefore(cd, run); }
    return { run, cd };
  }
  function hideUI() {
    const r = document.getElementById('graceRunBtn'); if (r) r.style.display = 'none';
    const c = document.getElementById('graceCountdown'); if (c) c.textContent = '';
  }
  function bannerVisible() { const b = document.getElementById('alarmBanner'); return !!(b && b.style.display === 'flex'); }

  function start(firedAt, foreground, opts) {
    if (silent() || !settings().enabled) return null;
    if (typeof sessionRunning !== 'undefined' && !sessionRunning) return null;
    // same alarm re-delivered (cold start / recovery) → keep the original window
    if (pending && Math.abs(pending.firedAt - firedAt) < 2000) { render(); return pending; }
    pending = { firedAt, foreground: !!foreground, graceMs: (opts && opts.graceMs) || graceMs(!!foreground) };
    persist();
    clearInterval(tick); tick = setInterval(check, 1000);
    check();
    return pending;
  }
  function clear() { pending = null; persist(); clearInterval(tick); tick = null; hideUI(); }

  function render() {
    if (!pending) return;
    const ui = ensureButton(); if (!ui) return;
    const ev = evaluate(pending.firedAt, Date.now(), pending.graceMs);
    ui.run.style.display = 'inline-block';
    ui.cd.textContent = `⏱ ${fmt(ev.remainingMs)} left`;
  }
  function check(now) {
    if (!pending) return null;
    if (silent()) { clear(); return null; }
    now = now || Date.now();
    const ev = evaluate(pending.firedAt, now, pending.graceMs);
    if (ev.status === 'expired') { autoAccident(ev); return ev; }
    if (!document.hidden) render();
    return ev;
  }
  function autoAccident(ev) {
    const p = pending; clear();
    try { if (typeof hideBanner === 'function') hideBanner(); if (typeof stopChime === 'function') stopChime(); } catch (e) {}
    try {
      if (typeof logToOutput === 'function') logToOutput(`<span style="color:#ff7675;">⏰ <b>Too late!</b> No response within ${fmt(p.graceMs)} of the alarm${p.foreground ? '' : ' (you were away)'} — you didn't make it.</span>`);
    } catch (e) {}
    window._lastGraceOutcome = { outcome: 'accident', firedAt: p.firedAt, foreground: p.foreground, elapsed: ev.elapsed, graceMs: p.graceMs };
    if (typeof haveAccident === 'function') haveAccident();
  }
  function runToPotty() {
    const p = pending;
    if (p) {
      const ev = evaluate(p.firedAt, Date.now(), p.graceMs);
      if (ev.status === 'expired') { autoAccident(ev); return 'accident'; }
      window._lastGraceOutcome = { outcome: 'responded', firedAt: p.firedAt, foreground: p.foreground, elapsed: ev.elapsed, graceMs: p.graceMs };
      try { if (typeof logToOutput === 'function') logToOutput(`<span style="color:#55efc4;">🏃 Ran for the potty with ${fmt(ev.remainingMs)} to spare…</span>`); } catch (e) {}
    }
    clear();
    if (typeof acknowledgeAlarm === 'function') acknowledgeAlarm();
    return 'responded';
  }

  /** Called from alarmMain(). scheduledAt = when the alarm was supposed to fire. */
  function onMainAlarm(scheduledAt) {
    const c = classify(scheduledAt, Date.now(), document.hidden);
    return start(c.firedAt, c.foreground);
  }

  // Any other acknowledgement of the banner (Reveal / Skip / Stop) ends the window.
  window.addEventListener('load', () => {
    ['acknowledgeAlarm', 'skipAlarm', 'stopAll'].forEach(name => {
      const fn = window[name]; if (typeof fn !== 'function' || fn._graceWrapped) return;
      const w = function () {
        if (pending) {
          const ev = evaluate(pending.firedAt, Date.now(), pending.graceMs);
          if (ev.status === 'expired' && name !== 'stopAll') { autoAccident(ev); return; }
          if (name === 'stopAll') clear(); else { window._lastGraceOutcome = { outcome: 'responded', firedAt: pending.firedAt, foreground: pending.foreground, elapsed: ev.elapsed, graceMs: pending.graceMs }; clear(); }
        }
        return fn.apply(this, arguments);
      };
      w._graceWrapped = true; w._nativeWrapped = fn._nativeWrapped; w._calWrapped = fn._calWrapped;
      window[name] = w;
    });
    // Restore a window that was open when the app was killed.
    setTimeout(() => {
      if (pending) return;
      let p = null; try { p = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) {}
      if (!p || !p.firedAt) return;
      if (silent() || (typeof sessionRunning !== 'undefined' && !sessionRunning)) { localStorage.removeItem(PKEY); return; }
      pending = p; clearInterval(tick); tick = setInterval(check, 1000);
      if (!bannerVisible() && typeof showBanner === 'function') {
        const cfg = typeof getProfileConfig === 'function' ? getProfileConfig() : {};
        const [title, sub] = cfg.alarmText || ['⚠️ <b>BLADDER SPASM</b>', 'Status uncertain...'];
        showBanner(title, sub, 'high');
      }
      check();
    }, 1500);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pending) check(); });

  // ---------- Settings UI ----------
  function renderSettings() {
    const m = document.getElementById('graceSettingsMount'); if (!m) return;
    const s = settings();
    const c = controlValue();
    m.innerHTML = `<h2 style="margin:0 0 6px;">🏃 Run-to-potty grace</h2>
      <p class="section-desc">When a main alarm fires you must respond (🏃 Run to potty / Reveal / Skip) before the grace window ends, or an accident is declared automatically.
      The window scales with your continence level (current control: <b>${Math.round(c * 100)}%</b>). Never used in Bedwetting mode.</p>
      <label class="toggle-row"><span>Auto-accident when grace runs out</span><input type="checkbox" id="grEnabled" ${s.enabled ? 'checked' : ''}></label>
      <div class="cal-row"><label class="fld"><span>App open: low control (s)</span><input id="grFgMin" type="number" min="5" max="600" value="${s.fgMinSec}"></label>
        <label class="fld"><span>App open: high control (s)</span><input id="grFgMax" type="number" min="5" max="900" value="${s.fgMaxSec}"></label></div>
      <div class="cal-row"><label class="fld"><span>App closed/asleep: low control (min)</span><input id="grBgMin" type="number" min="1" max="120" value="${s.bgMinMin}"></label>
        <label class="fld"><span>App closed/asleep: high control (min)</span><input id="grBgMax" type="number" min="1" max="240" value="${s.bgMaxMin}"></label></div>
      <div class="cal-legend">Now: app open → <b>${fmt(graceMs(true, c, s))}</b> · app closed → <b>${fmt(graceMs(false, c, s))}</b> (measured from the alarm time).</div>
      <div class="cal-row"><button id="grReset" type="button">↺ Defaults</button></div>`;
    const save = () => { saveSettings({ enabled: m.querySelector('#grEnabled').checked, fgMinSec: +m.querySelector('#grFgMin').value, fgMaxSec: +m.querySelector('#grFgMax').value,
      bgMinMin: +m.querySelector('#grBgMin').value, bgMaxMin: +m.querySelector('#grBgMax').value }); renderSettings(); };
    m.querySelectorAll('input').forEach(i => { i.onchange = save; });
    m.querySelector('#grReset').onclick = () => { localStorage.removeItem(SKEY); renderSettings(); };
  }

  window.BSGrace = { settings, saveSettings, controlValue, graceMs, evaluate, classify, start, check, clear, runToPotty, onMainAlarm, renderSettings,
    pending: () => pending, DEFAULTS };
  window.runToPotty = runToPotty;
})();
