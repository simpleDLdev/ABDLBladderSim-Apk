/* ===========================
   change-roll.js — v12/v34 "May I change?" roll.
   Per-level change rules live in BSControl.LADDER[].change: a saturation threshold that the USER reports every time
   (never inferred), a "not yet" re-ask range, and yes/later/after weights. Outcomes: Yes · Not yet (ask again in N min)
   · Only after your next wetting · Change now. Sensitive-skin setting: after the user-set max hours worn, the answer is
   always "Change now". Respects carried spares (no spares → "change when you can restock"). Logs to session + calendar.
   v34: caregiver guides what to change into (class / campaign rank / wear); user can mark leaked yes/no. Solo stays plain.
   =========================== */
(function () {
  const KEY = 'bs_change_roll_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const office = () => !!(window.BSOffice && window.BSOffice.on());
  function state() { return Object.assign({ maxHours: 3, pendingAfter: false, wetSince: false, nextAt: 0, last: null }, J(KEY, {})); }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function setMaxHours(h) { const s = state(); s.maxHours = Math.max(1, Math.min(12, +h || 3)); save(s); return s.maxHours; }
  /** Called by BSAccident / gear outcomes: satisfies an "only after your next wetting" ruling. */
  function noteWetting() { const s = state(); if (s.pendingAfter) { s.wetSince = true; save(s); } }
  function levelKey() { try { return window.BSSimpleUrge.profile().levelKey; } catch (e) { return 'okay'; } }

  const ORDER = ['none', 'pad', 'pads', 'pullups', 'diapers', 'thick_diapers'];
  function normProt(p) {
    if (!p || p === 'none') return 'none';
    if (p === 'pad' || p === 'pads') return 'pads';
    if (p === 'pullup' || p === 'pullups') return 'pullups';
    if (p === 'diaper' || p === 'diapers') return 'diapers';
    if (p === 'thick' || p === 'thick_diapers') return 'thick_diapers';
    return p;
  }
  function protLabel(id) {
    try { if (window.BSSimpleUrge && window.BSSimpleUrge.protLabel) return window.BSSimpleUrge.protLabel(id); } catch (e) {}
    return ({ none: 'underwear', pads: 'a pad', pullups: 'a pull-up', diapers: 'a diaper', thick_diapers: 'a thick diaper' })[id] || id;
  }
  /** Suggest what to change into from campaign rank, class, current wear, and leak flag. Pure-ish. */
  function suggestWear(opts) {
    opts = opts || {};
    const leaked = !!opts.leaked;
    let want = null, reason = 'your usual gear';
    try {
      const camp = window.BSCampaign && window.BSCampaign.load();
      if (camp && camp.active && !camp.paused) {
        const r = window.BSCampaign.RANKS[camp.rank];
        if (r && r.prot) { want = normProt(r.prot); reason = 'campaign rank ' + (r.name || ''); }
      }
    } catch (e) {}
    try {
      const st = window.BSPathPlay && window.BSPathPlay.loadStart && window.BSPathPlay.loadStart();
      const cid = (st && st.classId) || null;
      const P = window.BSPath && window.BSPath.CLASS_BY_ID && cid && window.BSPath.CLASS_BY_ID[cid];
      if (P && P.needs && P.needs.length) {
        const need = String(P.needs[0]).split('|')[0];
        const n = normProt(need);
        if (!want || ORDER.indexOf(n) > ORDER.indexOf(want)) { want = n; reason = (P.name || cid) + ' class'; }
      }
      // Path stage gear hint
      try {
        const b = window.BSPath && window.BSPath.load();
        if (b) {
          const S = window.BSPath.STAGES[window.BSPath.stageOf(b.pos)];
          if (S && /diaper/i.test(S.gear)) { want = want || 'diapers'; reason = reason || 'Path stage gear'; }
          else if (S && /pull/i.test(S.gear)) { want = want || 'pullups'; }
          else if (S && /pad/i.test(S.gear)) { want = want || 'pads'; }
        }
      } catch (e2) {}
    } catch (e) {}
    let wearing = 'none';
    try {
      const i = window.BSSimpleUrge && window.BSSimpleUrge.inv();
      if (i && i.wearing) wearing = normProt(i.wearing);
    } catch (e) {}
    if (!want) want = wearing === 'none' ? 'pads' : wearing;
    // Leak → prefer one step thicker when below thick
    if (leaked) {
      const ix = Math.max(ORDER.indexOf(want), ORDER.indexOf(wearing));
      const next = ORDER[Math.min(ORDER.length - 1, Math.max(ix, 0) + (ix < ORDER.indexOf('diapers') ? 1 : 0))];
      if (ORDER.indexOf(next) > ORDER.indexOf(want)) { want = next; reason = (reason || 'wear') + ' after a leak'; }
    }
    // Prefer a spare the user actually has
    let have = [];
    try {
      const i = window.BSSimpleUrge && window.BSSimpleUrge.inv();
      if (i && i.spares) have = Object.keys(i.spares).filter(k => i.spares[k] > 0).map(normProt);
    } catch (e) {}
    if (have.length && have.indexOf(want) < 0) {
      // closest available at or thicker than want
      const wi = ORDER.indexOf(want);
      const thicker = have.filter(h => ORDER.indexOf(h) >= wi).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      const pick = thicker[0] || have.sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0];
      if (pick) { want = pick; reason = (reason || '') + ' (from your stash)'; }
    }
    return { id: want, label: protLabel(want), reason: reason || 'suggestion', wearing, leaked };
  }

  /** Pure. sat 0-100 (user-reported, required). opts { level, rng, hoursWorn, maxHours, pendingAfter, wetSince, spares, leaked } */
  function roll(sat, opts) {
    opts = opts || {}; const rng = opts.rng || Math.random;
    if (sat == null || sat === '' || isNaN(+sat)) return { outcome: 'ask', text: 'Report your saturation first.' };
    sat = Math.max(0, Math.min(100, Math.round(+sat)));
    const C = window.BSControl, l = (C && C.level(opts.level || levelKey())) || { change: { threshold: 40, notYet: [15, 30], w: { yes: 50, later: 35, after: 15 } }, key: 'okay' };
    let bump = 0; try { bump = (window.BSClasses && window.BSClasses.changeSatBump()) || 0; } catch (e) {}
    try { if (window.BSPathPlay) bump = Math.max(bump, window.BSPathPlay.protectionPressureBump()); } catch (e) {}
    const r = l.change, th = Math.min(95, (r.threshold || 0) + bump), maxH = opts.maxHours != null ? opts.maxHours : 3;
    let outcome, mins = 0, why;
    if (opts.hoursWorn != null && opts.hoursWorn >= maxH) { outcome = 'now'; why = `skin-safety limit (${maxH} h worn)`; }
    else if (opts.pendingAfter && opts.wetSince) { outcome = 'now'; why = 'you waited for the next wetting'; }
    else if (opts.leaked && sat >= Math.max(20, th - 15)) { outcome = rng() < 0.55 ? 'yes' : 'now'; why = `you marked a leak at ${sat}%`; }
    else if (sat >= Math.max(90, th + 30)) { outcome = 'now'; why = `you reported ${sat}%`; }
    else if (sat >= th) {
      const w = r.w, t = w.yes + w.later + w.after, x = rng() * t;
      outcome = x < w.yes ? 'yes' : x < w.yes + w.later ? 'later' : 'after'; why = `at or past ${th}%`;
    } else { outcome = rng() < 0.6 ? 'later' : 'after'; why = `below the ${th}% your level waits for`; }
    if (outcome === 'later') mins = Math.round(r.notYet[0] + rng() * Math.max(0, r.notYet[1] - r.notYet[0]));
    const spares = opts.spares || {}, have = Object.keys(spares).filter(k => spares[k] > 0);
    const sug = suggestWear({ leaked: !!opts.leaked });
    let T = { yes: 'Yes — you may change now.', later: `Not yet — roll again in ${mins} min.`, after: 'Only after your next wetting — then ask again.', now: 'Change now.' };
    const care = !!(window.BSPathPlay && window.BSPathPlay.caregiverOn && window.BSPathPlay.caregiverOn());
    try {
      if (care) {
        if (outcome === 'yes' || outcome === 'now') T[outcome] = window.BSPathPlay.line('change_yes');
        if (outcome === 'later' || outcome === 'after') T[outcome] = window.BSPathPlay.line('change_later');
      }
    } catch (e) {}
    let text = T[outcome];
    if ((outcome === 'yes' || outcome === 'now') && !have.length) text += ' No spares carried — change as soon as you can restock.';
    let guide = '';
    if (outcome === 'yes' || outcome === 'now') {
      if (care) {
        try {
          guide = window.BSPathPlay.line('change_into', { into: sug.label, reason: sug.reason, leaked: !!opts.leaked })
            || (opts.leaked
              ? `Mommy saw you leaked — change into ${sug.label} (${sug.reason}).`
              : `Mommy wants you in ${sug.label} next (${sug.reason}).`);
        } catch (e) {
          guide = `Change into ${sug.label} (${sug.reason}).`;
        }
      } else {
        guide = `Suggested: ${sug.label} (${sug.reason}).`;
      }
    }
    return { outcome, mins, sat, threshold: th, why, text, level: l.key, have, suggest: sug, guide, leaked: !!opts.leaked };
  }
  function hoursWorn() { try { const i = window.BSSimpleUrge.inv(); return i.changedAt && i.wearing !== 'none' ? (Date.now() - i.changedAt) / 36e5 : null; } catch (e) { return null; } }
  /** Roll + record (state, session log, calendar). opts may include { leaked }. */
  function ask(sat, rng, ctx, extra) {
    extra = extra || {};
    const S = window.BSSimpleUrge, s = state(), i = S ? S.inv() : { spares: {} };
    const leaked = !!extra.leaked;
    if (leaked) noteWetting();
    const res = roll(sat, { rng, hoursWorn: hoursWorn(), maxHours: s.maxHours, pendingAfter: s.pendingAfter, wetSince: s.wetSince || leaked, spares: i.spares, leaked });
    if (res.outcome === 'ask') return res;
    s.last = { ts: Date.now(), outcome: res.outcome, sat: res.sat, leaked };
    s.pendingAfter = res.outcome === 'after'; if (res.outcome !== 'after') s.wetSince = false; else s.wetSince = false;
    s.nextAt = res.outcome === 'later' ? Date.now() + res.mins * 60000 : 0; save(s);
    const leakBit = leaked ? ', leaked: yes' : ', leaked: no';
    const txt = `🎲 May I change? (reported ${res.sat}% saturation${leakBit}, ${res.why}): ${res.text}` + (res.guide ? ' · ' + res.guide : '');
    try { typeof logToOutput === 'function' && logToOutput(`<span style="color:#a29bfe">${esc(office() && window.BSOffice ? window.BSOffice.swap(txt) : txt)}</span>`); } catch (e) {}
    try {
      window.BSCalendar && window.BSCalendar.addEntry({
        source: 'sim', mode: 'change_roll', type: 'event', saturation: res.sat, protection: i.wearing,
        memo: 'May I change? ' + res.text + (res.guide ? ' · ' + res.guide : '') + leakBit,
        event: { kind: 'change_roll', label: res.outcome, leaked, suggest: res.suggest && res.suggest.id }
      });
    } catch (e) { console.warn(e); }
    try { window.BSNatSession && window.BSNatSession.active() && window.BSNatSession.note({ k: 'change_roll', text: res.text }); } catch (e) {}
    res.ctx = ctx; return res;
  }
  function open(o) {
    o = o || {}; const S = window.BSSimpleUrge, C = window.BSControl, lk = levelKey(), l = C && C.level(lk), s = state(), off = office();
    const th = l ? l.change.threshold : 40;
    const care = !!(window.BSPathPlay && window.BSPathPlay.caregiverOn && window.BSPathPlay.caregiverOn());
    const sug0 = suggestWear({ leaked: false });
    const careBlurb = care
      ? `<div class="urge-note" id="chgCareGuide">Mommy tip: if you change, plan on <b>${esc(sug0.label)}</b> (${esc(sug0.reason)}). Tell Mommy honestly if you leaked.</div>`
      : `<div class="cal-legend" id="chgCareGuide">Suggested next gear: <b>${esc(sug0.label)}</b> (${esc(sug0.reason)}).</div>`;
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap'; w.id = 'chgRoll';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true"><h3>🎲 May I change?</h3>
      <div class="cal-legend">${esc(C ? C.label(l, off) : '')}: ${th ? `changes usually come once you report about <b>${th}%</b> saturation.` : 'you may change whenever you like.'} if your skin or comfort needs a change, change.</div>
      ${S ? `<div class="urge-note">🎒 ${esc(S.invText())}</div>` : ''}
      ${careBlurb}
      ${s.pendingAfter ? `<div class="urge-note" id="chgPending">Last ruling: only after your next wetting${s.wetSince ? ' — that has happened, ask now.' : '.'}</div>` : ''}
      ${s.nextAt > Date.now() ? `<div class="urge-note">Last ruling: ask again after ${new Date(s.nextAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</div>` : ''}
      <label class="fld"><span>How saturated is your gear right now? <b id="chgSatV">${o.prefillSat != null ? o.prefillSat + '%' : '— (required)'}</b></span><input id="chgSat" type="range" min="0" max="100" step="5" value="${o.prefillSat != null ? o.prefillSat : 0}" data-set="${o.prefillSat != null ? '1' : ''}"></label>
      <div class="cal-legend">0% = dry · 25% = damp · 50% = used once · 75% = well used · 100% = full. You report it; the app never guesses.</div>
      <div class="seg nn-seg" id="chgLeakSeg" role="group" aria-label="Did you leak?">
        <label><input type="radio" name="chgLeak" value="no" checked> No leak</label>
        <label><input type="radio" name="chgLeak" value="yes"> Leaked</label>
      </div>
      <label class="fld"><span>Skin-safety: always "change now" after (h)</span><input id="chgMaxH" type="number" min="1" max="12" value="${s.maxHours}" style="width:64px"></label>
      <div id="chgOut"></div>
      <div class="actions"><button class="ok" id="chgGo" disabled>🎲 Roll</button><button data-x>Close</button></div></div>`;
    document.body.appendChild(w);
    const g = id => w.querySelector('#' + id);
    const leakedNow = () => !!(w.querySelector('input[name=chgLeak]:checked') && w.querySelector('input[name=chgLeak]:checked').value === 'yes');
    const refreshGuide = () => {
      const sug = suggestWear({ leaked: leakedNow() });
      const el = g('chgCareGuide'); if (!el) return;
      if (care) el.innerHTML = `Mommy tip: if you change, plan on <b>${esc(sug.label)}</b> (${esc(sug.reason)}). Tell Mommy honestly if you leaked.`;
      else el.innerHTML = `Suggested next gear: <b>${esc(sug.label)}</b> (${esc(sug.reason)}).`;
    };
    w.querySelectorAll('input[name=chgLeak]').forEach(r => r.onchange = refreshGuide);
    g('chgSat').oninput = e => { e.target.dataset.set = '1'; g('chgSatV').textContent = e.target.value + '%'; g('chgGo').disabled = false; };
    if (o.prefillSat != null) g('chgGo').disabled = false;
    g('chgMaxH').onchange = e => setMaxHours(e.target.value);
    w.querySelector('[data-x]').onclick = () => w.remove();
    g('chgGo').onclick = () => {
      if (!g('chgSat').dataset.set) return;
      const leaked = leakedNow();
      const r = ask(+g('chgSat').value, o.rng, o.ctx, { leaked });
      const i = S ? S.inv() : { spares: {} };
      const prefer = r.suggest && r.suggest.id;
      const spareKeys = S ? S.SPARE.filter(k => i.spares[k] > 0) : [];
      // Sort: suggested first
      spareKeys.sort((a, b) => (normProt(a) === prefer ? -1 : 0) - (normProt(b) === prefer ? -1 : 0));
      const btns = (r.outcome === 'yes' || r.outcome === 'now') && S ? spareKeys.map(k => {
        const rec = normProt(k) === prefer;
        return `<button type="button" data-chg="${k}" class="${rec ? 'ok' : ''}">${rec ? '⭐ ' : ''}Change into ${esc(S.protLabel(k).toLowerCase())} (${i.spares[k]} left)${rec ? ' — suggested' : ''}</button>`;
      }).join('') : '';
      g('chgOut').innerHTML = `<div class="urge-result" id="chgResult" data-outcome="${r.outcome}" data-leaked="${r.leaked ? '1' : '0'}" style="border-color:${{ yes: '#55efc4', now: '#fdcb6e', later: '#74b9ff', after: '#a29bfe' }[r.outcome] || '#888'}"><b>${esc(r.text)}</b><div class="urge-note">${esc(r.why || '')}${r.leaked ? ' · leaked: yes' : ' · leaked: no'}</div>${r.guide ? `<div class="urge-note" id="chgIntoGuide">${esc(r.guide)}</div>` : ''}${btns ? `<div class="actions">${btns}</div>` : ''}</div>`;
      g('chgGo').textContent = '🎲 Roll again';
      w.querySelectorAll('[data-chg]').forEach(b => b.onclick = () => { S.change(b.dataset.chg); w.remove(); S.render(); });
    };
    return w;
  }
  window.BSChange = { roll, ask, open, state, noteWetting, setMaxHours, KEY, suggestWear, normProt };
})();
