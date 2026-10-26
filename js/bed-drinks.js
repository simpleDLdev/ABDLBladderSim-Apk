/* ===========================
   bed-drinks.js — v16 Natural Night: optional pre-bed drinks check-in (game flavour + hydration-sane).
   Suggests a modest amount scaled by profile: at most ~1 glass (250 ml) across the last 2 h before bed,
   often less (a few sips ~15 min before) for higher-control profiles. Already-logged drinks in the last
   2 h count against the 250 ml budget. Every suggestion passes BSSafety.capDrink (≤250 ml/prompt,
   ≤1 L/day extra, ≥2 h apart). Never suggests amounts meant to cause wetting or wake-ups.
   Always ends with "Pee before bed." Storage: bs_bed_drinks_v1 (settings + last suggestion).
   =========================== */
(function () {
  const KEY = 'bs_bed_drinks_v1', BUDGET = 250, WINDOW_MIN = 120, SIP = 15;
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  function settings() { return Object.assign({ enabled: true }, J(KEY, {})); }
  function saveSettings(p) { const s = Object.assign(settings(), p); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
  // levelIdx 0 = most control … 4 = least control (in-game profile). Tiers are deliberately small.
  const TIERS = [
    { ml: 45, label: 'a few sips (3 sips)', when: 'about 15 min before bed', flavour: 'Big-kid bedtime: just a few sips so your mouth isn\'t dry.' },
    { ml: 90, label: 'a small half-cup (~90 ml)', when: 'about 30 min before bed', flavour: 'A small cup with your bedtime story, then lights out.' },
    { ml: 150, label: 'a small cup (~150 ml)', when: 'within the last hour', flavour: 'A cosy small cup of water or milk while you wind down.' },
    { ml: 200, label: 'most of a glass (~200 ml)', when: 'spread over the last 2 hours', flavour: 'Sip a glass slowly over the evening, not all at once.' },
    { ml: 250, label: 'up to 1 glass (250 ml)', when: 'spread over the last 2 hours', flavour: 'One normal glass across the evening is plenty.' }
  ];
  function levelIdx() {
    try { if (window.BSSimpleUrge) return window.BSSimpleUrge.profile().levelIdx; } catch (e) {}
    try { const q = window.BSQuiz && window.BSQuiz.load(); if (q && q.baseline) return q.baseline.levelIdx; } catch (e) {}
    return 1;
  }
  /** Pure-ish: { levelIdx, bedtime, drinks:[{ts,ml}], now, thirsty } → suggestion. Uses BSSafety preview (no commit). */
  function suggest(o) {
    o = o || {};
    const now = o.now || Date.now(), bed = o.bedtime || now;
    const li = Math.max(0, Math.min(4, o.levelIdx == null ? levelIdx() : +o.levelIdx | 0));
    const t = TIERS[li];
    const recent = (o.drinks || []).filter(d => d && d.ml > 0 && d.ts >= bed - WINDOW_MIN * 60000 && d.ts <= bed).reduce((a, d) => a + (+d.ml || 0), 0);
    let ml = Math.max(0, Math.min(t.ml, BUDGET - recent));
    let reason = '';
    if (recent >= BUDGET) reason = 'budget';
    else if (ml < t.ml) reason = 'partial';
    if (o.thirsty === false && ml > SIP * 3) { ml = SIP * 3; reason = reason || 'not_thirsty'; }
    let safety = null;
    if (ml > 0 && window.BSSafety) { safety = window.BSSafety.capDrink(ml, { now, commit: false }); if (!safety.ok) { ml = 0; reason = 'safety_' + safety.reason; } else ml = safety.ml; }
    const sips = Math.max(0, Math.round(ml / SIP));
    let text;
    if (ml <= 0) text = reason === 'budget' ? 'You\'ve already had about a glass in the last 2 hours — that\'s plenty. No more needed tonight; a sip only if your mouth is dry.'
      : 'No drink prompt right now (that\'s plenty for tonight). If you\'re thirsty, drink normally — your body comes first.';
    else text = `${t.flavour} Suggested: ${ml >= 60 ? '~' + ml + ' ml' : sips + ' sip' + (sips === 1 ? '' : 's')} (${t.label}), ${t.when}.` + (recent ? ` (You already logged ${recent} ml in the last 2 h.)` : '');
    text += ' Pee before bed.';
    return { ml, sips, tier: li, when: t.when, recent, reason, text, endsWithPee: /Pee before bed\.$/.test(text) };
  }
  function accept(sug, now) {
    if (!sug || !(sug.ml > 0) || !window.BSSafety) return { ok: false };
    return window.BSSafety.capDrink(sug.ml, { now: now || Date.now(), commit: true, src: 'bed_drinks' });
  }
  // ---- UI: inject into Natural Night bedtime card ----
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function draftDrinksFromList(card) {
    // The bedtime list shows "HH:MM · N ml"; we only need totals for the budget. Use our own record of adds.
    return (card._bdAdds || []);
  }
  function inject(card) {
    if (!settings().enabled || card.querySelector('#bdCheck')) return;
    const anchor = card.querySelector('#nnDrList'); if (!anchor) return;
    const box = document.createElement('div'); box.id = 'bdCheck'; box.className = 'nn-row bd-check';
    box.innerHTML = `<button type="button" id="bdOpen" class="nn-btn">🥤 Pre-bed drinks check-in (optional)</button><div id="bdOut" class="nn-muted"></div>`;
    anchor.after(box);
    box.querySelector('#bdOpen').onclick = () => {
      const out = box.querySelector('#bdOut');
      out.innerHTML = `<div>Thirsty right now?</div><button type="button" class="nn-btn" data-th="1">Yes, a bit</button><button type="button" class="nn-btn" data-th="0">Not really</button>`;
      out.querySelectorAll('[data-th]').forEach(b => b.onclick = () => {
        const sug = suggest({ drinks: draftDrinksFromList(card), thirsty: b.dataset.th === '1' });
        out.innerHTML = `<div class="bd-sug" id="bdSug">${esc(sug.text)}</div>` + (sug.ml > 0 ? `<button type="button" class="nn-btn" id="bdAdd">➕ Add ${sug.ml} ml to tonight's drinks</button>` : '') + `<button type="button" class="nn-btn" id="bdSkip">Skip</button>`;
        const add = out.querySelector('#bdAdd');
        if (add) add.onclick = () => {
          const r = accept(sug); if (!r.ok) { out.querySelector('#bdSug').textContent = 'Drink limit reached — no prompt. Pee before bed.'; add.remove(); return; }
          const amt = card.querySelector('#nnDrAmt'), unit = card.querySelector('#nnUnit');
          if (amt) { if (unit) unit.value = 'ml'; amt.value = r.ml; const btn = card.querySelector('#nnDrAdd'); if (btn) btn.click(); }
          (card._bdAdds = card._bdAdds || []).push({ ts: Date.now(), ml: r.ml }); add.remove();
          if (typeof toast === 'function') toast('🥤 Added ' + r.ml + ' ml · then pee before bed');
        };
        out.querySelector('#bdSkip').onclick = () => { out.innerHTML = 'Skipped. Pee before bed.'; };
      });
    };
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.MutationObserver) {
    window.addEventListener('load', () => {
      new MutationObserver(() => { const c = document.getElementById('nnBedtime'); if (c) inject(c); }).observe(document.body, { childList: true, subtree: true });
    });
  }
  window.BSBedDrinks = { KEY, TIERS, BUDGET, suggest, accept, settings, saveSettings, inject };
})();
