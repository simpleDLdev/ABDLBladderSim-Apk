/* ===========================
   safety.js — v11 global drink-prompt cap (B13). Every drink prompt in the app passes through here.
   Rules (game rules only, never real-body training):
     • one prompt asks for at most 250 ml
     • extra drink prompts total at most 1 L per day
     • prompts are at least 2 h apart
   A prompt that would break a rule is shrunk or skipped. Drinks the user logs themselves are never blocked.
   =========================== */
(function () {
  const KEY = 'bs_safety_drinks_v1';
  const MAX_ML = 250, DAY_ML = 1000, GAP_MIN = 120, SIP_ML = 15;
  const dk = ts => { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function load(now) { let s; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} if (!s || s.day !== dk(now)) s = { day: dk(now), total: 0, last: s && s.last || 0, log: [] }; return s; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  /** Check (and with commit:true, record) a drink prompt. → { ok, ml, reason, left, nextAt } */
  function capDrink(ml, opts) {
    opts = opts || {}; const now = opts.now || Date.now(), s = load(now);
    const want = Math.max(0, Math.round(+ml || 0)), left = Math.max(0, DAY_ML - s.total), nextAt = s.last ? s.last + GAP_MIN * 60000 : 0;
    if (s.last && now < nextAt) return { ok: false, ml: 0, reason: 'spacing', left, nextAt };
    if (left <= 0) return { ok: false, ml: 0, reason: 'daily', left: 0, nextAt };
    const out = Math.min(want, MAX_ML, left);
    if (!(out > 0)) return { ok: false, ml: 0, reason: 'zero', left, nextAt };
    if (opts.commit !== false) { s.total += out; s.last = now; s.log.push({ ts: now, ml: out, src: opts.src || '' }); save(s); }
    return { ok: true, ml: out, reason: out < want ? 'capped' : '', left: left - out, nextAt: now + GAP_MIN * 60000 };
  }
  /** Sips prompts: counted as ~15 ml each, max floor(250/15) sips. → { ok, sips } */
  function capSips(n, opts) { const r = capDrink(Math.max(1, +n || 1) * SIP_ML, opts); return { ok: r.ok, sips: r.ok ? Math.max(1, Math.floor(r.ml / SIP_ML)) : 0, reason: r.reason }; }
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
  window.BSSafety = { capDrink, capSips, capText, status, reset, rankHydration, MAX_ML, DAY_ML, GAP_MIN };
})();
