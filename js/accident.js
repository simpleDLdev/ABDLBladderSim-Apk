/* ===========================
   accident.js — v12 "I couldn't wait" / natural accident sheet.
   Opened from Simple Urge waits (including after a wait ends, while the button stays armed), the #2 timer,
   an active quick natural session, a running sim session, or the always-visible "Log natural accident" button.
   Everything is user-entered (urgency before/after, % released, saturation after). Grouped into Before / After.
   Saves a NATURAL calendar entry (tagged "during wait" + link to the roll when it happened in a wait),
   marks the worn protection used / offers "May I change?", and — when "Count accidents during waits" is ON
   (default) — counts as a failed hold for the Control meter and the campaign.
   =========================== */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SEV = { unknown: { type: 'accident', sev: 'unknown', l: 'Unknown (e.g. clip)' }, dribble: { type: 'leak', sev: 'damp', l: 'Dribble (mostly dry)' }, leak: { type: 'leak', sev: 'wet', l: 'Small accident' }, full: { type: 'accident', sev: 'soaked', l: 'Major accident' } };
  const toastMsg = t => { try { typeof toast === 'function' && toast(t); } catch (e) {} };
  const hhmm = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  /** Pure-ish save. d { ts, ctx, instruction, roll, duringWait, severity, protection, leaked, urgencyBefore, urgencyAfter, releasedPct, saturationAfter, warnMin, memo, messy } */
  function save(d) {
    const S = window.BSSimpleUrge, C = window.BSCalendar, K = window.BSControl, N = window.BSNatSession;
    const m = SEV[d.severity] || (d.severity === 'unknown' ? SEV.unknown : SEV.leak);
    const tags = ['natural accident']; if (d.duringWait) tags.push('during wait'); if (d.ctx === 'cant_hold') tags.push("can't hold it");
    const pct = v => v == null || v === '' ? undefined : Math.max(0, Math.min(100, +v));
    const entry = { source: 'natural', type: m.type, severity: m.sev, ts: d.ts || Date.now(), mode: d.ctx || 'urge_tab', protection: d.protection || 'none', leaked: !!d.leaked,
      urgencyBefore: pct(d.urgencyBefore), urgencyAfter: pct(d.urgencyAfter), releasedPct: pct(d.releasedPct), saturation: pct(d.saturationAfter), warnMin: d.warnMin != null && d.warnMin !== '' ? Math.max(0, +d.warnMin) : undefined,
      messy: d.messy ? true : undefined,
      memo: [d.instruction ? 'During: ' + d.instruction : '', d.memo || ''].filter(Boolean).join(' — ') || undefined, tags,
      failedWait: !!d.duringWait, link: { roll: d.roll || undefined, instr: d.instruction || undefined, ctx: d.ctx, session: N && N.active() ? N.state().id : undefined } };
    let saved = null; try { saved = C && C.addEntry(entry); } catch (e) { console.warn(e); }
    let i = null;
    if (S) { i = S.inv(); if (d.protection && d.protection !== 'none') { if (i.wearing !== d.protection) { i.wearing = d.protection; i.wetCount = 0; } i.wetCount++; S.saveInv(i); } }
    try { window.BSChange && window.BSChange.noteWetting(); } catch (e) {}
    let ctl = 0; if (d.duringWait && K) ctl = K.event('failed_wait');
    try { if (S && d.ctx === 'simple_urge') S.endByAccident(); } catch (e) {}
    let follow = null; try { if (S && S.followUp && (d.ctx === 'simple_urge' || d.ctx === 'urge_tab' || d.ctx === 'cant_hold') && d.followUp !== false) follow = S.followUp({ severity: d.severity, sat: d.saturationAfter, protection: d.protection }); } catch (e) { console.warn(e); }
    try { N && N.active() && N.note({ k: 'accident', text: `${m.l}${d.duringWait ? ' during wait' : ''}${d.leaked ? ' (leaked through)' : ''}`, entry: saved && saved.id }); } catch (e) {}
    try { typeof logToOutput === 'function' && logToOutput(`<span style="color:#e17055">💦 Natural accident logged (${m.l}${d.duringWait ? ', during wait' : ''}).</span>`); } catch (e) {}
    return { entry: saved, inv: i, control: ctl, follow };
  }
  function open(o) {
    o = o || {}; const S = window.BSSimpleUrge, i = S ? S.inv() : { wearing: 'none', spares: {} }, now = o.ts || Date.now();
    const PROT = S ? S.PROT : ['none', 'pad', 'pullups', 'diapers', 'thick_diapers'], lab = v => S ? S.protLabel(v) : v;
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap'; w.id = 'accSheet';
    const slider = (id, label, help) => `<label class="fld"><span>${label}: <b id="${id}V">—</b></span><input id="${id}" type="range" min="0" max="100" step="5" value="50" data-set=""><div class="cal-legend">${help}</div></label>`;
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true"><h3>${o.ctx === 'cant_hold' && !o.cascade ? "😣 Couldn't hold it" : o.ctx === 'dryclip' ? '💧 Clip detected wet' : '💦 Had an accident'}</h3>
      <div class="cal-legend">${o.ctx === 'dryclip' ? 'From your DryClip. Nothing is saved until you tap Save — severity starts as Unknown.' : 'Nothing here is guessed — fill in what you know, skip the rest.'}</div>
      <label class="fld"><span>Time</span><input id="acTime" type="time" value="${hhmm(now)}"></label>
      ${o.instruction ? `<div class="fld" id="acInstr"><span>You were on</span><b>${esc(o.instruction)}</b></div>` : ''}
      <label class="urge-lbl"><input type="checkbox" id="acWait" ${o.duringWait ? 'checked' : ''}> Happened during an wait / hold</label>
      <div class="fld"><span>How much?</span><div class="seg" role="radiogroup">${Object.keys(SEV).map(k => `<label><input type="radio" name="acSev" value="${k}" ${k === (SEV[o.severity] ? o.severity : (o.severity === 'unknown' ? 'unknown' : 'leak')) ? 'checked' : ''}>${SEV[k].l}</label>`).join('')}</div></div>
      <label class="fld"><span>Protection worn</span><select id="acProt">${PROT.map(k => `<option value="${k}" ${k === i.wearing ? 'selected' : ''}>${esc(lab(k))}</option>`).join('')}</select></label>

      <fieldset class="acc-sec" id="acBefore"><legend>Before the accident</legend>
        ${slider('acUb', 'Urgency before', 'How strong the need felt right before it happened (0 = none, 10 = desperate).')}
        <label class="fld"><span>How much warning did you get? (min)</span><input id="acWarn" type="number" min="0" max="120" step="1" placeholder="e.g. 5 — leave blank if unsure" style="width:100%"></label>
        <div class="cal-legend">Minutes between first noticing and the accident. Blank = skip.</div>
      </fieldset>

      <fieldset class="acc-sec" id="acAfter"><legend>After the accident</legend>
        ${slider('acUa', 'Urgency after / relief', 'How the need felt right after (0 = gone / full relief, 10 = still desperate).')}
        ${slider('acRel', '% released', 'Rough guess of how much came out: 0 = almost nothing, 100 = everything.')}
        <div class="fld"><span>Leaked through your gear?</span><div class="seg" role="radiogroup"><label><input type="radio" name="acLeak" value="1">Yes</label><label><input type="radio" name="acLeak" value="0" checked>No</label></div></div>
        ${slider('acSat', 'Saturation of gear after', 'How full your protection feels now (0 = dry, 100 = full). You report it; the app never guesses.')}
      </fieldset>

      <label class="fld"><span>Memo (optional)</span><input id="acMemo" type="text" maxlength="300"></label>
      <div class="actions"><button class="ok" id="acSave">Save</button><button data-x>Cancel</button></div></div>`;
    document.body.appendChild(w);
    const g = id => w.querySelector('#' + id);
    ['acUb', 'acUa', 'acRel', 'acSat'].forEach(id => g(id).oninput = e => { e.target.dataset.set = '1'; g(id + 'V').textContent = id === 'acRel' || id === 'acSat' ? e.target.value + '%' : Math.round(e.target.value / 10) + '/10'; });
    const val = id => g(id).dataset.set ? +g(id).value : null;
    // v14 S7: "I can't hold it" always logs — Cancel still saves the major accident with no extra details.
    w.querySelector('[data-x]').onclick = () => { w.remove(); if (o.alwaysLog) { save({ ctx: o.ctx, instruction: o.instruction, roll: o.roll, duringWait: !!o.duringWait, severity: o.severity || 'full', protection: i.wearing }); toastMsg('Logged (no details)'); try { S && S.render(); } catch (e) {} } };
    g('acSave').onclick = () => {
      const [h, mi] = (g('acTime').value || hhmm(now)).split(':').map(Number); const d = new Date(now); d.setHours(h, mi, 0, 0); let ts = d.getTime(); if (ts > now + 60000) ts -= 864e5;
      const sev = (w.querySelector('input[name=acSev]:checked') || {}).value || 'leak';
      const warn = g('acWarn').value === '' ? null : +g('acWarn').value;
      const r = save({ ts, ctx: o.ctx, instruction: o.instruction, roll: o.roll, duringWait: g('acWait').checked, severity: sev, protection: g('acProt').value,
        leaked: (w.querySelector('input[name=acLeak]:checked') || {}).value === '1', urgencyBefore: val('acUb'), urgencyAfter: val('acUa'), releasedPct: val('acRel'), saturationAfter: val('acSat'), warnMin: warn, memo: g('acMemo').value.trim(), messy: o.messy });
      w.remove(); toastMsg('Accident logged');
      if (r.inv && r.inv.wearing !== 'none') {
        // Offer May I change? (uses the user-reported saturation when given)
        try { if (window.BSChange) window.BSChange.open({ ctx: 'after_accident', prefillSat: val('acSat') }); else openChange(r); } catch (e) { openChange(r); }
      }
      try { S && S.render(); window.BSNatSession && window.BSNatSession.render && window.BSNatSession.render(); } catch (e) {}
    };
    return w;
  }
  /** Fallback change prompt (no BSChange): pick from carried spares, or later. */
  function openChange(r) {
    const S = window.BSSimpleUrge; if (!S) return; const i = S.inv();
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap'; w.id = 'accChange';
    const have = S.SPARE.filter(k => i.spares[k] > 0);
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true"><h3>🔄 Change?</h3>
      <div class="urge-note">${esc(S.invText(i))}${r.control ? ` · Control ${r.control > 0 ? '+' : ''}${r.control}` : ''}</div>
      ${have.length ? `<div class="actions">${have.map(k => `<button type="button" data-chg="${k}">Change into ${esc(S.protLabel(k).toLowerCase())} (${i.spares[k]} left)</button>`).join('')}</div>` : '<div class="urge-note" style="color:#ff7675">No spares carried — head home or restock when you can.</div>'}
      <div class="actions"><button type="button" id="accMay">🎲 May I change?</button><button data-x>Later</button></div></div>`;
    document.body.appendChild(w);
    w.querySelector('[data-x]').onclick = () => w.remove();
    const m = w.querySelector('#accMay'); if (m) m.onclick = () => { w.remove(); window.BSChange && window.BSChange.open({ ctx: 'after_accident' }); };
    w.querySelectorAll('[data-chg]').forEach(b => b.onclick = () => { S.change(b.dataset.chg); w.remove(); S.render(); try { window.BSNatSession.render(); } catch (e) {} });
  }
  function sessionButton() {
    let b = document.getElementById('accSessBtn'); const run = typeof sessionRunning !== 'undefined' && sessionRunning;
    if (!run) { if (b) b.style.display = 'none'; return; }
    if (!b) { const t = document.getElementById('tab-session'); if (!t) return; b = document.createElement('button'); b.type = 'button'; b.id = 'accSessBtn'; b.textContent = '💦 Had an accident (real)'; b.style.cssText = 'background:#e17055;color:#000;font-weight:bold;min-height:48px;';
      b.onclick = () => open({ ctx: 'sim_session', instruction: 'Sim session', duringWait: true }); t.insertBefore(b, t.firstChild); }
    b.style.display = '';
  }
  setInterval(sessionButton, 2000);
  window.BSAccident = { open, save, openChange, SEV };
})();
