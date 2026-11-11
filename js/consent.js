/* ===========================
   consent.js — v44 conditioning consent, per-track real progress, reverse and stop.
   Game mode stays the default. Conditioning starts only after the two required boxes.
   Re-consent every 4 weeks, and if a track crosses two bands. No answer for 7 days pauses.
   Copy states the effect in both directions without a lecture.
   =========================== */
(function () {
  const KEY = 'bs_consent_v1';
  const TEXT = '2026-11-r3';
  const ORDER = ['full', 'good', 'okay', 'shaky', 'little', 'none'];
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  function defaults() {
    return { v: 2, acceptedAt: 0, textVersion: TEXT, adult: false, tracks: { day: 'off', night: 'off' }, realProgress: { day: false, night: false }, nightCountsReal: false, caregiver: 'none', partnerInformed: false, nextRecheckAt: 0, rechecks: [], bandAt: { day: null, night: null } };
  }
  function load() {
    const s = Object.assign(defaults(), J(KEY, {}));
    s.tracks = Object.assign({ day: 'off', night: 'off' }, s.tracks || {});
    s.realProgress = Object.assign({ day: false, night: false }, s.realProgress || {});
    s.rechecks = Array.isArray(s.rechecks) ? s.rechecks : [];
    s.bandAt = Object.assign({ day: null, night: null }, s.bandAt || {});
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function realProgress(track) { const s = load(); return !!(s.acceptedAt && s.realProgress[track === 'night' ? 'night' : 'day']); }
  function on() { const s = load(); return !!(s.acceptedAt && (s.tracks.day !== 'off' || s.tracks.night !== 'off')); }
  function bandsBetween(a, b) {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    if (ia < 0 || ib < 0) return 0;
    return Math.abs(ia - ib);
  }
  function accept(p) {
    p = p || {};
    if (!p.adult || !p.understand) return { ok: false, reason: 'boxes' };
    const s = load();
    s.acceptedAt = Date.now();
    s.textVersion = TEXT;
    s.adult = true;
    s.tracks.day = p.day === 'A' || p.day === 'B' ? p.day : 'off';
    s.tracks.night = p.night === 'A' || p.night === 'B' ? p.night : 'off';
    s.realProgress.day = !!p.realDay;
    s.realProgress.night = !!p.realNight;
    s.nightCountsReal = !!p.realNight;
    s.caregiver = p.caregiver || 'none';
    s.partnerInformed = !!p.partnerInformed;
    s.nextRecheckAt = s.acceptedAt + 28 * 864e5;
    s.rechecks.push({ ts: s.acceptedAt, answer: 'continue' });
    save(s);
    if (window.BSControl) {
      window.BSControl.saveSettings({ mode: (s.tracks.day === 'off' && s.tracks.night === 'off') ? 'game' : 'conditioning', countWaitAccidents: false });
      ['day', 'night'].forEach(name => {
        const choice = s.tracks[name];
        const tr = window.BSControl.trackState(name);
        if (choice === 'off') window.BSControl.setTrack(name, { phase: 'frozen', target: tr.estimate });
        else {
          const tgt = p.targets && p.targets[name] != null ? +p.targets[name] : (choice === 'A' ? Math.max(0, tr.estimate - 15) : Math.min(100, tr.estimate + 15));
          window.BSControl.setTrack(name, { phase: 'active', target: tgt, pace: (p.pace && p.pace[name]) || 'steady' });
        }
        try { s.bandAt[name] = window.BSControl.band(name); } catch (e) {}
      });
      save(s);
    }
    try { if (window.BSGear) window.BSGear.refresh(); } catch (e) {}
    return { ok: true };
  }
  function answer(kind) {
    const s = load();
    s.rechecks.push({ ts: Date.now(), answer: kind });
    if (kind === 'continue') {
      s.nextRecheckAt = Date.now() + 28 * 864e5;
      try { ['day', 'night'].forEach(n => { s.bandAt[n] = window.BSControl.band(n); }); } catch (e) {}
      save(s);
    } else if (kind === 'pause') {
      save(s);
      try { window.BSSymptoms && window.BSSymptoms.pauseFor('reconsent', 'Paused until you say to go on.'); } catch (e) {}
    } else if (kind === 'reverse') {
      save(s);
      try { if (s.tracks.day !== 'off') window.BSControl.reverseTrack('day'); if (s.tracks.night !== 'off') window.BSControl.reverseTrack('night'); } catch (e) {}
    } else if (kind === 'stop') stop();
    return s;
  }
  function stop() {
    const s = load();
    s.tracks.day = 'off'; s.tracks.night = 'off';
    s.realProgress.day = false; s.realProgress.night = false; s.nightCountsReal = false;
    s.rechecks.push({ ts: Date.now(), answer: 'stop' });
    save(s);
    try { window.BSControl && window.BSControl.stopConditioning(); } catch (e) {}
    return s;
  }
  function reverse(track) {
    const s = load();
    const name = track === 'night' ? 'night' : 'day';
    const cur = s.tracks[name];
    s.tracks[name] = cur === 'A' ? 'B' : cur === 'B' ? 'A' : cur;
    s.rechecks.push({ ts: Date.now(), answer: 'reverse', track: name });
    save(s);
    try { window.BSControl && window.BSControl.reverseTrack(name); } catch (e) {}
    try { window.BSPasses && window.BSPasses.resetDebt(name); } catch (e) {}
    return s;
  }
  function tick() {
    const s = load(); if (!s.acceptedAt) return;
    const now = Date.now();
    let need = false;
    if (s.nextRecheckAt && now >= s.nextRecheckAt) need = true;
    try {
      ['day', 'night'].forEach(n => {
        if (s.tracks[n] === 'off') return;
        const b = window.BSControl.band(n);
        if (s.bandAt[n] && bandsBetween(s.bandAt[n], b) >= 2) need = true;
      });
    } catch (e) {}
    const last = s.rechecks[s.rechecks.length - 1];
    const unanswered = s.nextRecheckAt && now >= s.nextRecheckAt + 7 * 864e5 && (!last || last.ts < s.nextRecheckAt);
    if (unanswered && window.BSSymptoms && !window.BSSymptoms.paused()) window.BSSymptoms.pauseFor('reconsent', 'No answer for 7 days, so conditioning is paused.');
    if (need && !unanswered) openRecheck();
  }
  function openRecheck() {
    if (typeof document === 'undefined' || document.getElementById('consentRecheck')) return;
    const w = document.createElement('div'); w.id = 'consentRecheck'; w.className = 'cal-sheet-wrap';
    w.innerHTML = `<div class="cal-sheet" role="dialog"><h3>Still want to continue?</h3>
      <p>Conditioning can keep changing real habits in the direction you picked. You can pause, reverse, or stop.</p>
      <div class="actions">
        <button type="button" data-a="continue">Continue</button>
        <button type="button" data-a="pause">Pause</button>
        <button type="button" data-a="reverse">Reverse</button>
        <button type="button" data-a="stop">Stop</button>
      </div></div>`;
    document.body.appendChild(w);
    w.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { answer(b.dataset.a); w.remove(); try { render(); } catch (e) {} });
  }
  function render() {
    const m = document.getElementById('conditioningMount'); if (!m) return;
    const s = load();
    if (!s.acceptedAt) {
      m.innerHTML = `<div class="urge-note"><b>Conditioning</b>
        <p>This mode is meant to change real habits. Weeks or months of practice may change real bladder control, day, night, or both, in the direction you pick. Changes may take time to undo.</p>
        <p>Direction A (less control) can mean more wet nights, wetting in thinner protection, and needing protection more often.</p>
        <p>Direction B (more control) uses scheduled trips, urge practice, and pelvic-floor exercises.</p>
        <p>You can reverse a track or stop with one tap. A real-need button stays free. Pain, burning, blood, fever, or trouble emptying pauses the mode and asks you to see a doctor.</p>
        <label class="urge-lbl"><input type="checkbox" id="cAdult"> I'm an adult</label>
        <label class="urge-lbl"><input type="checkbox" id="cKnow"> I understand this may change my real control</label>
        <label class="urge-lbl"><input type="checkbox" id="cRealD"> Count my real day results toward progress</label>
        <label class="urge-lbl"><input type="checkbox" id="cRealN"> Count my real night results toward progress</label>
        <div>Day <select id="cDay"><option value="off">Off</option><option value="B">B — more control</option><option value="A">A — less control</option></select>
        target <input id="cDayT" type="number" min="0" max="100" value="70" style="width:56px"></div>
        <div>Night <select id="cNight"><option value="off">Off</option><option value="B">B — more control</option><option value="A">A — less control</option></select>
        target <input id="cNightT" type="number" min="0" max="100" value="70" style="width:56px"></div>
        <button type="button" id="cGo" class="pill">Start conditioning</button>
        <button type="button" id="cStay" class="pill">Stay in game mode</button>
        <div id="cMsg" class="cal-legend"></div></div>`;
      m.querySelector('#cGo').onclick = () => {
        const r = accept({
          adult: m.querySelector('#cAdult').checked, understand: m.querySelector('#cKnow').checked,
          realDay: m.querySelector('#cRealD').checked, realNight: m.querySelector('#cRealN').checked,
          day: m.querySelector('#cDay').value, night: m.querySelector('#cNight').value,
          targets: { day: +m.querySelector('#cDayT').value, night: +m.querySelector('#cNightT').value }
        });
        m.querySelector('#cMsg').textContent = r.ok ? 'Conditioning is on.' : 'Both boxes are required.';
        if (r.ok) render();
      };
      m.querySelector('#cStay').onclick = () => { m.querySelector('#cMsg').textContent = 'Game mode stays as it is.'; };
      return;
    }
    const line = n => `${n}: ${s.tracks[n]} · real ${s.realProgress[n] ? 'on' : 'off'}`;
    m.innerHTML = `<div class="urge-note"><b>Conditioning</b>
      <div>${line('day')}</div><div>${line('night')}</div>
      <div class="actions">
        <button type="button" id="cRevD">Reverse day</button>
        <button type="button" id="cRevN">Reverse night</button>
        <button type="button" id="cStop">Stop conditioning</button>
      </div>
      <div class="cal-legend">Reverse swaps the target to the mirror band and clears pass debt. Stop returns to game mode and keeps your logs.</div></div>`;
    m.querySelector('#cRevD').onclick = () => { reverse('day'); render(); };
    m.querySelector('#cRevN').onclick = () => { reverse('night'); render(); };
    m.querySelector('#cStop').onclick = () => { stop(); render(); };
  }
  window.BSConsent = { KEY, TEXT, load, save, accept, answer, stop, reverse, realProgress, on, tick, render, bandsBetween };
  try { window.addEventListener('load', () => { try { render(); tick(); } catch (e) {} }); } catch (e) {}
})();
