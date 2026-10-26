/* ===========================
   clip-bridge.js — v35 DryClip ↔ Path / Urge / Campaign
   Confirmed clip wets (armed + settled; settle/touch ignored upstream) can:
   • stamp Path hold timers and offer accident / still-holding
   • stamp event guides and branch "natural accident during guide"
   • count toward Campaign leak goals when opt-in
   Soft play: flag + toast only (no auto Path rollback). Caregiver: short clip-wet line.
   Prefs on bs_play_prefs_v1 (new fields only): clipAssistPath, clipAssistCampaign.
   Night Bed Mastery bridge remains pathClipBridge (v31). Storage keys unchanged.
   =========================== */
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const DEDUPE_MS = 60000;
  const HOLD_KEY = 'bs_clip_bridge_hold_v1'; // ephemeral path-hold marker (versioned OK)
  let lastHandledAt = 0;
  let lastContexts = []; // recent wetAts we handled

  function prefs() {
    try { return (W.BSHub && W.BSHub.playPrefs && W.BSHub.playPrefs()) || {}; } catch (e) { return {}; }
  }
  function pathOn() { return !!(prefs().clipAssistPath); }
  function campOn() { return !!(prefs().clipAssistCampaign); }
  function softOn() { try { return !!(W.BSHub && W.BSHub.softOn && W.BSHub.softOn()); } catch (e) { return false; } }
  function caregiverOn() { try { return !!(W.BSPathPlay && W.BSPathPlay.caregiverOn && W.BSPathPlay.caregiverOn()); } catch (e) { return false; } }

  function fmtHM(ts) {
    const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function toast(t) { try { if (typeof W.toast === 'function') W.toast(t); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function isDupe(wetAt) {
    if (!wetAt) return false;
    if (lastHandledAt && Math.abs(wetAt - lastHandledAt) <= DEDUPE_MS) return true;
    return lastContexts.some(t => Math.abs(t - wetAt) <= DEDUPE_MS);
  }
  function markHandled(wetAt) {
    lastHandledAt = wetAt;
    lastContexts.push(wetAt);
    if (lastContexts.length > 12) lastContexts.shift();
  }

  // ---------- Active context detectors ----------
  function pathHold() {
    try {
      const raw = localStorage.getItem(HOLD_KEY);
      if (!raw) return null;
      const h = JSON.parse(raw);
      if (!h || !h.active) return null;
      // v39: a pending Path go stays assist context until the go is resolved, including before Start timer and after it hits 0.
      if (h.untilResolve) return h;
      if (h.endsAt && Date.now() > h.endsAt + 120000) { clearPathHold(); return null; } // expired + 2 min grace
      return h;
    } catch (e) { return null; }
  }
  function setPathHold(h) {
    if (!h) { try { localStorage.removeItem(HOLD_KEY); } catch (e) {} return; }
    try { localStorage.setItem(HOLD_KEY, JSON.stringify(Object.assign({ active: true, startedAt: Date.now() }, h))); } catch (e) {}
  }
  function clearPathHold() { setPathHold(null); }

  /** v39: when Path assist is on, any pending go is hold context until resolve. Assist off clears the marker. */
  function syncFromBoard(b) {
    if (!pathOn()) { clearPathHold(); return null; }
    if (!b || b.finished || !b.pending) { clearPathHold(); return null; }
    const p = b.pending;
    const holds = p.holds || [];
    const mins = holds.length ? Math.max.apply(null, holds) : 0;
    setPathHold({
      kind: 'path_hold',
      pending: true,
      untilResolve: true,
      mins: mins,
      endsAt: p.holdEndsAt || 0,
      started: !!p.holdEndsAt,
      pos: b.pos,
      stage: p.stage
    });
    return pathHold();
  }

  function urgeWait() {
    try {
      const S = W.BSSimpleUrge; if (!S || !S.inWaitState || !S.inWaitState()) return null;
      const x = S.state ? S.state() : null;
      if (!x || !x.last) return { active: true };
      return { active: true, text: x.last.text, roll: x.last.id, waitUntil: x.waitUntil, outcome: x.last.outcome };
    } catch (e) { return null; }
  }

  function guideOpen() {
    try {
      const ov = typeof document !== 'undefined' && document.getElementById('voidOverlay');
      if (ov && ov.style && ov.style.display && ov.style.display !== 'none') {
        const step = (typeof currentGuideStep !== 'undefined') ? currentGuideStep : null;
        const seq = (typeof currentGuideSeq !== 'undefined') ? currentGuideSeq : null;
        const type = (typeof currentGuideType !== 'undefined') ? currentGuideType : null;
        return { active: true, step, type, len: seq && seq.length, text: (seq && step >= 0 && seq[step] && seq[step].text) || '' };
      }
      // Path feature quest that launched a guide
      const P = W.BSPath; const b = P && P.load && P.load();
      if (b && b.quest && (b.quest.id === 'guide_event' || b.quest.id === 'guide_hold')) {
        return { active: true, quest: b.quest.id, step: null, type: 'path_quest' };
      }
    } catch (e) {}
    return null;
  }

  function pathBoardActive() {
    try { const b = W.BSPath && W.BSPath.load && W.BSPath.load(); return !!(b && !b.finished); } catch (e) { return false; }
  }
  function campaignActive() {
    try { const s = W.BSCampaign && W.BSCampaign.load && W.BSCampaign.load(); return !!(s && s.active && !s.paused); } catch (e) { return false; }
  }

  // ---------- Calendar / accident logging ----------
  function flagCalendar(wetAt, ctx) {
    try {
      if (!W.BSCalendar) return null;
      // Avoid double clip_flag within dedupe window
      const es = (W.BSCalendar.load().entries || []).filter(e =>
        (e.type === 'clip_flag' || ((e.type === 'accident' || e.type === 'leak') && e.mode === 'dryclip_bridge')) &&
        Math.abs((e.ts || 0) - wetAt) < DEDUPE_MS);
      if (es.length) return es[0];
      return W.BSCalendar.addEntry({
        type: 'clip_flag', source: 'natural', mode: 'dryclip_bridge', ts: wetAt,
        severity: 'unknown', confirmed: false,
        clip: { kind: 'wet', ctx: ctx || 'play', bridge: true },
        tags: ['needs-review', 'clip-flagged', 'path-bridge'],
        memo: 'DryClip during ' + (ctx || 'play') + ' @ ' + fmtHM(wetAt)
      });
    } catch (e) { return null; }
  }

  function logNaturalAccident(wetAt, o) {
    o = o || {};
    try {
      if (!W.BSAccident || !W.BSAccident.save) return null;
      // Don't double-log accident if one already exists near wetAt from bridge
      const es = (W.BSCalendar && W.BSCalendar.load().entries || []).filter(e =>
        (e.type === 'accident' || e.type === 'leak') && e.mode === 'dryclip_bridge' && Math.abs((e.ts || 0) - wetAt) < DEDUPE_MS);
      if (es.length) return { entry: es[0], dupe: true };
      return W.BSAccident.save({
        ts: wetAt,
        ctx: 'dryclip_bridge',
        instruction: o.instruction || 'DryClip wet during hold/guide',
        duringWait: !!o.duringWait,
        severity: softOn() ? 'unknown' : (o.severity || 'leak'),
        protection: o.protection,
        memo: o.memo || ('Clip wetAt ' + fmtHM(wetAt)),
        followUp: false
      });
    } catch (e) { return null; }
  }

  function caregiverNote(wetAt, where) {
    if (!caregiverOn()) return '';
    try {
      if (W.BSPathPlay && W.BSPathPlay.line) {
        // Prefer dedicated kind if present; else inline short original line
        const custom = W.BSPathPlay.line('clip_wet', { where: where, wetAt: wetAt });
        if (custom) return custom;
      }
    } catch (e) {}
    const n = (W.BSPathPlay && W.BSPathPlay.nick && W.BSPathPlay.nick()) || 'sweetie';
    return `Oh ${n}… the clip said wet at ${fmtHM(wetAt)} while you were ${where}. Mommy saw — tell me if you need a change.`;
  }

  // ---------- Interrupt sheets ----------
  function showHoldInterrupt(wetAt, hold, urge) {
    document.querySelectorAll('.cal-sheet-wrap.cb-hold').forEach(n => n.remove());
    const where = hold ? 'a Path hold' : 'an Urge wait';
    const care = caregiverNote(wetAt, where);
    const soft = softOn();
    const w = document.createElement('div');
    w.className = 'cal-sheet-wrap cb-hold';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">
      <h3>💧 Clip wet during hold</h3>
      <p class="section-desc">DryClip flagged <b>${fmtHM(wetAt)}</b> while you were on ${esc(where)}. Calendar stamped. Soft play keeps this light.</p>
      ${care ? `<div class="urge-note">${esc(care)}</div>` : ''}
      <div class="actions">
        <button type="button" class="ok" data-acc>💦 Natural accident — resolve</button>
        ${soft ? '' : '<button type="button" data-hold>✋ Still holding — keep timer</button>'}
        <button type="button" data-x>Dismiss</button>
      </div>
      <div class="cal-legend">⏸ I'm going now stays free anytime. One clip event per wet (no spam).</div>
    </div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.querySelector('[data-x]').onclick = close;
    const keep = w.querySelector('[data-hold]');
    if (keep) keep.onclick = () => { toast('Timer continues — clip already flagged'); close(); };
    w.querySelector('[data-acc]').onclick = () => {
      close();
      // Log + resolve Path if pending
      logNaturalAccident(wetAt, {
        duringWait: true,
        instruction: hold ? 'Path hold timer' : (urge && urge.text) || 'Urge wait',
        severity: soft ? 'unknown' : 'leak',
        memo: 'clip bridge hold'
      });
      if (urge && W.BSSimpleUrge && W.BSSimpleUrge.endByAccident) {
        try { W.BSSimpleUrge.endByAccident(); } catch (e) {}
      }
      if (hold && !soft) {
        try {
          const P = W.BSPath; const b = P && P.load && P.load();
          if (b && b.pending) {
            const r = P.resolve(b, 'acc', { sat: undefined, urgency: undefined, clipWet: wetAt });
            P.save(b);
            clearPathHold();
            try { P.render && P.render(); } catch (e) {}
            toast((r.notes && r.notes[0]) || 'Path: natural accident');
          } else clearPathHold();
        } catch (e) { clearPathHold(); }
      } else {
        clearPathHold();
        toast(soft ? 'Flagged (Soft play — no Path rollback)' : 'Accident logged');
      }
      // Optional full accident sheet for details
      try {
        if (W.BSAccident && W.BSAccident.open) {
          W.BSAccident.open({
            ctx: 'dryclip', severity: soft ? 'unknown' : 'leak', ts: wetAt,
            instruction: hold ? 'Path hold' : 'Urge wait', duringWait: true, alwaysLog: false
          });
        }
      } catch (e) {}
    };
  }

  function showGuideInterrupt(wetAt, g) {
    document.querySelectorAll('.cal-sheet-wrap.cb-guide').forEach(n => n.remove());
    const stepLbl = g.step != null ? `step ${(g.step | 0) + 1}` : 'a step';
    const care = caregiverNote(wetAt, 'an event guide');
    const soft = softOn();
    const w = document.createElement('div');
    w.className = 'cal-sheet-wrap cb-guide';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">
      <h3>💧 Natural accident during guide</h3>
      <p class="section-desc">Clip wet at <b>${fmtHM(wetAt)}</b> during ${esc(stepLbl)}${g.text ? ': “' + esc(String(g.text).slice(0, 80)) + '”' : ''}.</p>
      ${care ? `<div class="urge-note">${esc(care)}</div>` : ''}
      <div class="actions">
        <button type="button" class="ok" data-done>💦 Count as guide accident</button>
        <button type="button" data-cont>Continue guide</button>
        <button type="button" data-x>Dismiss</button>
      </div>
    </div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.querySelector('[data-x]').onclick = close;
    w.querySelector('[data-cont]').onclick = () => { toast('Guide continues — clip stamped'); close(); };
    w.querySelector('[data-done]').onclick = () => {
      close();
      logNaturalAccident(wetAt, {
        duringWait: true,
        instruction: 'Event guide' + (g.text ? ': ' + String(g.text).slice(0, 60) : ''),
        severity: soft ? 'unknown' : 'leak',
        memo: 'clip bridge guide step ' + (g.step != null ? g.step : '?')
      });
      // Stamp Path feature quest if any
      try {
        const P = W.BSPath; const b = P && P.load && P.load();
        if (b && b.quest && (b.quest.id === 'guide_event' || b.quest.id === 'guide_hold')) {
          b.quest.clipWetAt = wetAt;
          b.quest.clipStep = g.step;
          P.save(b);
          if (!soft && P.finishQuest) {
            P.finishQuest({ outcome: 'acc', info: 'natural accident during guide (clip)', wet: true });
            try { P.render && P.render(); } catch (e) {}
          }
        }
      } catch (e) {}
      // Close void guide so user isn't stuck mid-step
      try { if (typeof W.closeVoidGuide === 'function') W.closeVoidGuide(); } catch (e) {}
      toast(soft ? 'Guide stamped (Soft play)' : 'Guide: natural accident');
    };
  }

  // ---------- Main entry ----------
  /**
   * Called when DryClip accepts a real wet (already past decideWet settle/arming/dedupe).
   * o: { wetAt, source:'day'|'night'|'offer'|'native', st?, secs? }
   */
  function onClipWet(o) {
    o = o || {};
    const wetAt = +o.wetAt || Date.now();
    if (isDupe(wetAt)) return { handled: false, reason: 'dupe' };

    const hold = pathHold();
    const urge = urgeWait();
    const guide = guideOpen();
    const wantPath = pathOn() && !!(hold || urge || guide);
    const wantCamp = campOn() && campaignActive();

    // Only engage when an assist toggle is on (off = leave DryClip's normal offerAccident UI)
    if (!wantPath && !wantCamp) {
      return { handled: false, reason: 'assist_off' };
    }

    markHandled(wetAt);

    // Always stamp calendar once when assisting or when mid hold/guide
    let flag = null;
    if (wantPath || wantCamp || hold || urge || guide) {
      flag = flagCalendar(wetAt, hold ? 'path_hold' : urge ? 'urge_wait' : guide ? 'event_guide' : 'campaign');
    }

    const actions = [];

    if (pathOn() && (hold || urge)) {
      showHoldInterrupt(wetAt, hold, urge);
      actions.push('hold_interrupt');
    } else if (pathOn() && guide) {
      showGuideInterrupt(wetAt, guide);
      actions.push('guide_interrupt');
    }

    if (wantCamp && !(hold || urge || guide)) {
      // Background campaign credit without Path interrupt sheet
      logNaturalAccident(wetAt, {
        duringWait: false,
        instruction: 'DryClip wet (Campaign assist)',
        severity: softOn() ? 'unknown' : 'leak',
        memo: 'clip bridge campaign'
      });
      actions.push('campaign_log');
      const care = caregiverNote(wetAt, 'the day');
      toast(care || ('💧 Clip wet @ ' + fmtHM(wetAt) + ' — counts toward Campaign leaks'));
    } else if (wantCamp && (hold || urge || guide)) {
      // Hold/guide path already logs on user confirm; also ensure campaign can see clip_flag
      actions.push('campaign_via_play');
    }

    if (!actions.length && flag) {
      toast('📎 Clip flagged @ ' + fmtHM(wetAt));
      actions.push('flag_only');
    }

    return { handled: true, wetAt, actions, flagId: flag && flag.id };
  }

  /** Pure helpers for tests */
  function _test() {
    return { isDupe, markHandled, pathOn, campOn, pathHold, setPathHold, clearPathHold, syncFromBoard, urgeWait, guideOpen, onClipWet, DEDUPE_MS, HOLD_KEY };
  }

  W.BSClipBridge = {
    onClipWet, setPathHold, clearPathHold, pathHold, syncFromBoard, pathOn, campOn,
    prefs, caregiverNote, flagCalendar, logNaturalAccident, _test, DEDUPE_MS, HOLD_KEY
  };
})();
