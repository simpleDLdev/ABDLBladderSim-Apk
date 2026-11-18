/* ===========================
   safety.js — v11 global drink-prompt cap (B13), sip spacing from v50.
   Rules (game rules only, never real-body training):
     • one large prompt asks for at most 250 ml
     • extra drink prompts, including sips, total at most 1 L per day
     • large prompts (100 ml or more) are at least 2 h apart
     • sips (~15 ml) use a short gap: at least 10 min, or the profile's hydration minimum when that is longer
   A prompt that would break a rule is shrunk or skipped. Drinks the user logs themselves are never blocked.
   A self-logged glass only nudges the next sip by about 15 min.
   =========================== */
(function () {
  const KEY = 'bs_safety_drinks_v1';
  const PREF = 'bs_safety_prefs_v1';
  const MAX_ML = 250, DAY_ML = 1000, GAP_MIN = 120, SIP_ML = 15, LARGE_ML = 100, SIP_GAP_MIN = 10, USER_NUDGE_MIN = 15;
  function prefs() { try { return Object.assign({ sipCap: false }, JSON.parse(localStorage.getItem(PREF) || 'null')); } catch (e) { return { sipCap: false }; } }
  function sipCapOn() { return !!prefs().sipCap; }
  function setSipCap(on) { const p = prefs(); p.sipCap = !!on; try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) {} return p.sipCap; }
  const dk = ts => { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function load(now) {
    let s; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    const keep = {
      last: s && s.last || 0,
      lastSip: s && s.lastSip || 0,
      lastUser: s && s.lastUser || 0,
      lastUserMl: s && s.lastUserMl || 0
    };
    if (!s || s.day !== dk(now)) s = { day: dk(now), total: 0, last: keep.last, lastSip: keep.lastSip, lastUser: keep.lastUser, lastUserMl: keep.lastUserMl, log: [] };
    s.lastSip = s.lastSip || 0; s.lastUser = s.lastUser || 0; s.lastUserMl = s.lastUserMl || 0; s.log = s.log || [];
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function sipGapMin(opts) {
    const asked = opts && +opts.minGapMin;
    return Math.max(SIP_GAP_MIN, asked > 0 ? asked : SIP_GAP_MIN);
  }
  /** Check (and with commit:true, record) a drink prompt. Large prompts keep the 2 h gap. → { ok, ml, reason, left, nextAt } */
  function capDrink(ml, opts) {
    opts = opts || {}; const now = opts.now || Date.now(), s = load(now);
    const want = Math.max(0, Math.round(+ml || 0)), left = Math.max(0, DAY_ML - s.total);
    if (want >= LARGE_ML) {
      const nextAt = s.last ? s.last + GAP_MIN * 60000 : 0;
      if (s.last && now < nextAt) return { ok: false, ml: 0, reason: 'spacing', left, nextAt };
      if (left <= 0) return { ok: false, ml: 0, reason: 'daily', left: 0, nextAt };
      const out = Math.min(want, MAX_ML, left);
      if (!(out > 0)) return { ok: false, ml: 0, reason: 'zero', left, nextAt };
      if (opts.commit !== false) { s.total += out; s.last = now; s.log.push({ ts: now, ml: out, src: opts.src || '', kind: 'large' }); save(s); }
      return { ok: true, ml: out, reason: out < want ? 'capped' : '', left: left - out, nextAt: now + GAP_MIN * 60000 };
    }
    return commitSmall(want, opts, s, now, left);
  }
  function commitSmall(want, opts, s, now, left) {
    const gap = sipGapMin(opts);
    const nextSip = s.lastSip ? s.lastSip + gap * 60000 : 0;
    if (s.lastSip && now < nextSip) return { ok: false, ml: 0, sips: 0, reason: 'spacing', left, nextAt: nextSip };
    if (s.lastUser && s.lastUserMl >= LARGE_ML) {
      const nudgeAt = s.lastUser + USER_NUDGE_MIN * 60000;
      if (now < nudgeAt) return { ok: false, ml: 0, sips: 0, reason: 'after_log', left, nextAt: nudgeAt };
    }
    if (left <= 0) return { ok: false, ml: 0, sips: 0, reason: 'daily', left: 0, nextAt: 0 };
    const out = Math.min(want, MAX_ML, left);
    if (!(out > 0)) return { ok: false, ml: 0, sips: 0, reason: 'zero', left, nextAt: 0 };
    if (opts.commit !== false) { s.total += out; s.lastSip = now; s.log.push({ ts: now, ml: out, src: opts.src || '', kind: 'sip' }); save(s); }
    return { ok: true, ml: out, sips: Math.max(1, Math.floor(out / SIP_ML)), reason: out < want ? 'capped' : '', left: left - out, nextAt: now + gap * 60000 };
  }
  /**
   * Sips. Default: always allowed, logged for stats, not part of the 1 L glass budget.
   * The optional sip cap (off unless the user turns it on) restores the daily total and the short gap.
   */
  function capSips(n, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const count = Math.max(1, Math.round(+n || 1));
    const ml = count * SIP_ML;
    if (!sipCapOn()) {
      if (opts.commit !== false) {
        const s = load(now);
        s.sipMl = (s.sipMl || 0) + ml;
        s.lastSip = now;
        s.log.push({ ts: now, ml: ml, src: opts.src || 'sip', kind: 'sip' });
        save(s);
      }
      return { ok: true, sips: count, ml: ml, reason: '', left: null, nextAt: now };
    }
    const s = load(now);
    const left = Math.max(0, DAY_ML - s.total);
    if (left < SIP_ML) return { ok: false, sips: 0, ml: 0, reason: 'daily', left: left, nextAt: 0 };
    const want = Math.floor(Math.min(ml, left) / SIP_ML) * SIP_ML;
    const r = commitSmall(want, opts, s, now, left);
    if (!r.ok) return { ok: false, sips: 0, ml: 0, reason: r.reason, left: r.left, nextAt: r.nextAt || 0 };
    return { ok: true, sips: Math.max(1, Math.floor(r.ml / SIP_ML)), ml: r.ml, reason: r.reason, left: r.left, nextAt: r.nextAt };
  }
  /** A drink the user logged. Never blocked, and it does not start the 2 h large-prompt clock. */
  function noteUserDrink(ml, opts) {
    opts = opts || {}; const now = opts.now || Date.now(), s = load(now);
    const amount = Math.max(0, Math.round(+ml || 0));
    s.lastUser = now; s.lastUserMl = amount;
    s.log.push({ ts: now, ml: amount, src: 'user', kind: 'user' });
    save(s);
    return { ok: true, ml: amount, blocked: false, nudgesSip: amount >= LARGE_ML };
  }
  /** Rewrite any "Drink NNN ml" text so it never exceeds the per-prompt cap (no ledger change). */
  function capText(t) {
    return String(t == null ? '' : t).replace(/(\d{2,4})\s?ml/gi, (m, n) => (+n > MAX_ML ? MAX_ML + 'ml' : m))
      .replace(/a full coffee\/tea/gi, 'a small cup of coffee/tea (max ' + MAX_ML + 'ml)');
  }
  function status(now) { const s = load(now || Date.now()); return { total: s.total, left: Math.max(0, DAY_ML - s.total), last: s.last }; }
  function reset() { localStorage.removeItem(KEY); }
  /** Light per-rank hydration cadence (in-app prompts only). Caps still ≤250 ml / ≤1 L/day. */
  function rankHydration(rankIdx) {
    const i = Math.max(0, Math.min(6, rankIdx == null ? 2 : +rankIdx || 0));
    const gapMin = [180, 150, 120, 100, 90, 75, 60][i];
    const suggestMl = [30, 45, 60, 80, 100, 120, 150][i];
    return { rankIdx: i, gapMin, suggestMl: Math.min(MAX_ML, suggestMl), maxMl: MAX_ML, dayMl: DAY_ML };
  }
  function renderCapSetting() {
    try {
      const m = document.getElementById('safetyMount'); if (!m) return;
      const on = sipCapOn();
      m.innerHTML = `<label class="urge-lbl"><input type="checkbox" id="sipCapToggle" ${on ? 'checked' : ''}> Cap sip reminders at 1 L/day</label>
        <div class="cal-legend">Off by default. Reminders keep coming. Skip one if you are not thirsty. A large glass prompt still stays at 250 ml, 2 hours apart, and 1 L a day.</div>`;
      const box = m.querySelector('#sipCapToggle');
      if (box) box.onchange = () => setSipCap(box.checked);
    } catch (e) {}
  }
  try { window.addEventListener('load', renderCapSetting); } catch (e) {}
  window.BSSafety = { capDrink, capSips, capText, noteUserDrink, status, reset, rankHydration, sipCapOn, setSipCap, renderCapSetting, MAX_ML, DAY_ML, GAP_MIN, SIP_ML, LARGE_ML, SIP_GAP_MIN };
})();
