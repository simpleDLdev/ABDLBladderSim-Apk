/* ===========================
   sleep-source.js — v44 pluggable sleep nights for the night track.
   Normalised night: stages (deep|light|rem|awake|unknown), wakes, deep minutes.
   Adapters: manual JSON now; Health Connect SleepSessionRecord when a native plugin exists.
   LuckRing (Android package com.kewo.coolring) publishes sleep stages in its own app.
   No public API or Health Connect write is documented (Play listing + privacy policy, 2026-11).
   This file does not bind to that package. If any ring app writes Health Connect later, pull() uses it.
   A wet with no sleep data does not change the estimate.
   =========================== */
(function () {
  const KEY = 'bs_sleep_v1';
  const STAGES = { deep: 1, light: 1, rem: 1, awake: 1, unknown: 1 };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  function defaults() { return { v: 1, source: 'none', nights: [] }; }
  function load() { const s = Object.assign(defaults(), J(KEY, {})); s.nights = Array.isArray(s.nights) ? s.nights : []; return s; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function plugin() {
    try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.HealthConnect || null; } catch (e) { return null; }
  }
  function available() {
    const p = plugin();
    if (!p) return { ok: false, reason: 'plugin_missing', source: 'health_connect' };
    return { ok: true, source: 'health_connect' };
  }
  /** Health Connect read. No-op until the native plugin is added. Does not request permissions itself. */
  async function pull(from, to) {
    const p = plugin();
    if (!p || !p.readSleep) return { ok: false, reason: 'plugin_missing', nights: [] };
    try {
      const raw = await p.readSleep({ from: from, to: to });
      const nights = (raw && raw.sessions || []).map(normaliseSession).filter(Boolean);
      if (nights.length) mergeNights(nights, 'health_connect');
      return { ok: true, nights: nights };
    } catch (e) { return { ok: false, reason: 'read_failed', nights: [] }; }
  }
  function normaliseSession(session) {
    if (!session) return null;
    const stages = (session.stages || []).map(st => {
      const stage = STAGES[st.stage] ? st.stage : 'unknown';
      const start = +st.start || +st.startTime || 0;
      const end = +st.end || +st.endTime || 0;
      if (!start || !end || end <= start) return null;
      return { stage: stage, start: start, end: end };
    }).filter(Boolean);
    const wakes = (session.wakes || []).map(t => +t).filter(t => t > 0);
    const deepMin = Math.round(stages.filter(s => s.stage === 'deep').reduce((a, s) => a + (s.end - s.start), 0) / 60000);
    const date = session.date || new Date(session.end || session.start || Date.now()).toISOString().slice(0, 10);
    return { date: date, source: session.source || 'health_connect', stages: stages, wakes: wakes, deepMin: deepMin, importedAt: Date.now() };
  }
  function mergeNights(nights, source) {
    const s = load();
    nights.forEach(n => {
      const i = s.nights.findIndex(x => x.date === n.date);
      const row = Object.assign({ source: source }, n);
      if (i >= 0) s.nights[i] = row; else s.nights.push(row);
    });
    s.nights = s.nights.slice(-30);
    s.source = source || s.source;
    return save(s);
  }
  function importJSON(text) {
    let data; try { data = JSON.parse(text); } catch (e) { throw new Error('Sleep import is not JSON'); }
    const list = Array.isArray(data) ? data : (data.nights || []);
    const nights = list.map(normaliseSession).filter(Boolean);
    mergeNights(nights, 'manual');
    return nights;
  }
  function nightOn(date) { return load().nights.find(n => n.date === date) || null; }
  function stageAt(night, ts) {
    if (!night || !ts) return null;
    const st = (night.stages || []).find(s => ts >= s.start && ts < s.end);
    return st ? st.stage : null;
  }
  function wokeNear(night, ts, windowMs) {
    windowMs = windowMs == null ? 30 * 60000 : windowMs;
    if (!night || !ts) return false;
    return (night.wakes || []).some(w => w >= ts - windowMs && w <= ts + windowMs);
  }
  /**
   * Higher sSl = more control. Deep/REM wet with no wake scores low.
   * null when this wet has no stage (caller drops the metric).
   */
  function controlSignal(night, wetAt) {
    const stage = stageAt(night, wetAt);
    if (!stage || stage === 'unknown') return null;
    const woke = wokeNear(night, wetAt, 30 * 60000) || stage === 'awake';
    let sSl = 50;
    if (woke) sSl = (stage === 'deep' || stage === 'rem') ? 70 : 85;
    else if (stage === 'deep' || stage === 'rem') sSl = 15;
    else if (stage === 'light') sSl = 40;
    return { stage: stage, woke: woke, sSl: sSl };
  }
  function sSlForWets(night, wets) {
    if (!night || !wets || !wets.length) return null;
    const xs = wets.map(w => controlSignal(night, w.at || w.wetAt)).filter(s => s && s.sSl != null);
    if (!xs.length) return null;
    return Math.round(xs.reduce((a, s) => a + s.sSl, 0) / xs.length);
  }
  function render() {
    const m = document.getElementById('sleepMount'); if (!m) return;
    const s = load(); const av = available();
    m.innerHTML = `<div class="urge-note"><b>Sleep</b> <span style="color:#8ea0b6">${s.nights.length} night${s.nights.length === 1 ? '' : 's'} stored · ${s.source}</span>
      <div class="cal-legend">${av.ok ? 'Health Connect is available.' : 'Health Connect plugin is not in this build. Import a night below, or connect a plugin later. LuckRing has no public API; if it writes Health Connect, this reader will use that.'}</div>
      <textarea id="sleepIn" rows="3" placeholder='{"nights":[{"date":"2026-11-10","stages":[{"stage":"deep","start":1,"end":2}],"wakes":[]}]}' style="width:100%"></textarea>
      <button type="button" id="sleepGo" class="pill">Import JSON</button> <span id="sleepMsg"></span></div>`;
    m.querySelector('#sleepGo').onclick = () => {
      const msg = m.querySelector('#sleepMsg');
      try { const n = importJSON(m.querySelector('#sleepIn').value); msg.textContent = 'Imported ' + n.length; render(); }
      catch (e) { msg.textContent = e.message; }
    };
  }
  window.BSSleep = { KEY, load, save, available, pull, importJSON, nightOn, stageAt, wokeNear, controlSignal, sSlForWets, normaliseSession, render, LUCKRING_PACKAGE: 'com.kewo.coolring' };
  try { window.addEventListener('load', () => { try { render(); } catch (e) {} }); } catch (e) {}
})();
