/* ===========================
   natural-session.js — v11 Quick natural session ("out and about" / "at home").
   One tap to start: choose kit worn + carried (shared protection list) and the control profile.
   The session log gathers Simple Urge rolls, accidents and changes. Ending shows a summary that is
   saved to the calendar as a NATURAL event. No hydration or spasm prompts, nothing scheduled.
   =========================== */
(function () {
  const KEY = 'bs_nat_session_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const toastMsg = t => { try { typeof toast === 'function' && toast(t); } catch (e) {} };
  function state() { return J(KEY, null); }
  function put(s) { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); }
  function active() { const s = state(); return !!(s && s.active); }
  function start(o) {
    o = o || {}; const S = window.BSSimpleUrge;
    if (S) { const i = S.inv(); if (o.wearing) i.wearing = o.wearing; if (o.carried) S.SPARE.forEach(k => { if (o.carried[k] != null) i.spares[k] = Math.max(0, +o.carried[k] || 0); }); i.day = new Date().toDateString(); i.wetCount = 0; S.saveInv(i);
      if (o.profileId) S.saveSettings({ profileId: o.profileId }); }
    const i = S ? S.inv() : {};
    const s = { active: true, id: 'ns' + Date.now().toString(36), place: o.place === 'home' ? 'home' : 'out', startedAt: o.now || Date.now(), startKit: { wearing: i.wearing, spares: Object.assign({}, i.spares) },
      profile: S ? S.profile().name : '', log: [{ ts: o.now || Date.now(), k: 'start', text: `Started (${o.place === 'home' ? 'at home' : 'out and about'})` }] };
    put(s); try { S && S.render(); } catch (e) {} return s;
  }
  function note(item) { const s = state(); if (!s || !s.active) return; s.log.push(Object.assign({ ts: Date.now() }, item)); if (s.log.length > 300) s.log.splice(1, 1); put(s); }
  function summarize(s, now) {
    now = now || Date.now(); const S = window.BSSimpleUrge, i = S ? S.inv() : { spares: {} };
    const c = k => s.log.filter(x => x.k === k).length, rolls = s.log.filter(x => x.k === 'roll');
    const by = o => rolls.filter(x => x.outcome === o).length;
    const used = S ? S.SPARE.map(k => ({ k, n: Math.max(0, (s.startKit.spares[k] || 0) - (i.spares[k] || 0)) })).filter(x => x.n) : [];
    const mins = Math.max(1, Math.round((now - s.startedAt) / 60000));
    return { mins, rolls: rolls.length, go: by('go'), waits: by('wait') + by('hard') + by('dribble'), gear: by('gear'), custom: by('custom'), accidents: c('accident'), changes: c('change'),
      used, left: i.spares, wearing: i.wearing, place: s.place,
      text: `Natural session (${s.place === 'home' ? 'home' : 'out'}) ${mins} min · ${rolls.length} roll(s): ${by('go')} go, ${by('wait') + by('hard') + by('dribble')} wait/hold, ${by('gear')} gear · ${c('accident')} real accident(s) · ${c('change')} change(s)` + (used.length ? ' · used ' + used.map(x => x.n + ' ' + x.k.replace('_', ' ')).join(', ') : '') };
  }
  function end(now) {
    const s = state(); if (!s || !s.active) return null;
    const sum = summarize(s, now); s.active = false; s.endedAt = now || Date.now(); s.summary = sum; put(s);
    try { window.BSCalendar && window.BSCalendar.addEntry({ source: 'natural', type: 'event', mode: 'nat_session', ts: s.startedAt, memo: sum.text, event: { kind: 'session', label: 'Natural session' }, tags: ['natural session'], link: { session: s.id } }); } catch (e) {}
    try { typeof logToOutput === 'function' && logToOutput(`<span style="color:#55efc4">🎒 ${esc(sum.text)}</span>`); } catch (e) {}
    try { window.BSSimpleUrge && window.BSSimpleUrge.render(); } catch (e) {}
    return sum;
  }
  function chip() {
    const s = state(); const mins = Math.round((Date.now() - s.startedAt) / 60000);
    const acc = s.log.filter(x => x.k === 'accident').length, rolls = s.log.filter(x => x.k === 'roll').length;
    return `<div id="nsChip" class="urge-result" style="border-color:#55efc4;font-size:15px;">🎒 <b>Natural session</b> · ${s.place === 'home' ? 'home' : 'out'} · ${mins} min · ${rolls} roll(s) · ${acc} accident(s)
      <div class="urge-actions"><button type="button" id="nsEnd">⏹ End session</button></div></div>`;
  }
  function bind(m) {
    // v14 S4: no duplicate accident button here — Simple Urge's armed "Had an accident" / "I can't hold it" cover it.
    const e = m.querySelector('#nsEnd'); if (e) e.onclick = () => { const sum = end(); if (sum) showSummary(sum); };
  }
  function sheet(html) { const w = document.createElement('div'); w.className = 'cal-sheet-wrap'; w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(w); return w; }
  function showSummary(sum) {
    const S = window.BSSimpleUrge;
    const w = sheet(`<h3>🎒 Session summary</h3><div id="nsSummary">
      <div class="camp-goal">⏱ ${sum.mins} min ${sum.place === 'home' ? 'at home' : 'out and about'}</div>
      <div class="camp-goal">🙋 ${sum.rolls} roll(s): ${sum.go} go · ${sum.waits} wait/hold · ${sum.gear} gear${sum.custom ? ' · ' + sum.custom + ' custom' : ''}</div>
      <div class="camp-goal">💦 ${sum.accidents} real accident(s) · 🔄 ${sum.changes} change(s)</div>
      <div class="camp-goal">🎒 Used: ${sum.used.length ? sum.used.map(x => x.n + ' ' + esc(S ? S.protLabel(x.k).toLowerCase() : x.k)).join(', ') : 'no spares'} · now wearing ${esc(S ? S.protLabel(sum.wearing) : sum.wearing)}</div></div>
      <div class="cal-legend">Saved to your calendar as a natural session.</div><div class="actions"><button class="ok" data-x>Done</button></div>`);
    w.querySelector('[data-x]').onclick = () => w.remove(); return w;
  }
  function openStart() {
    const S = window.BSSimpleUrge; if (!S) return; const i = S.inv(), st = S.settings();
    const profs = document.createElement('select'); profs.id = 'nsProf';
    const w = sheet(`<h3>▶ Start natural session</h3>
      <div class="fld"><span>Where?</span><div class="seg" role="radiogroup"><label><input type="radio" name="nsPlace" value="out" checked>Out and about</label><label><input type="radio" name="nsPlace" value="home">At home</label></div></div>
      <label class="fld"><span>Wearing</span><select id="nsWear">${S.PROT.map(k => `<option value="${k}" ${k === i.wearing ? 'selected' : ''}>${esc(S.protLabel(k))}</option>`).join('')}</select></label>
      <div class="fld"><span>Carrying</span><div>${S.SPARE.map(k => `<label class="urge-lbl" style="display:inline-block;width:48%">${esc(S.protLabel(k))} <input type="number" min="0" max="20" id="nsC_${k}" value="${i.spares[k] || 0}" style="width:56px"></label>`).join('')}</div></div>
      <label class="fld"><span>Control</span><select id="nsProf"></select></label>
      <div class="cal-legend">No drink or spasm prompts. Rolls, accidents and changes are collected into one summary.</div>
      <div class="actions"><button class="ok" id="nsGo">▶ Start</button><button data-x>Cancel</button></div>`);
    const src = document.getElementById('suProf'); w.querySelector('#nsProf').innerHTML = src ? src.innerHTML : `<option value="match">Match my profile</option>`; w.querySelector('#nsProf').value = st.profileId;
    w.querySelector('[data-x]').onclick = () => w.remove();
    w.querySelector('#nsGo').onclick = () => {
      const carried = {}; S.SPARE.forEach(k => carried[k] = +w.querySelector('#nsC_' + k).value || 0);
      start({ place: (w.querySelector('input[name=nsPlace]:checked') || {}).value, wearing: w.querySelector('#nsWear').value, carried, profileId: w.querySelector('#nsProf').value });
      w.remove(); toastMsg('Natural session started');
    };
    return w;
  }
  function render() { try { window.BSSimpleUrge && window.BSSimpleUrge.render(); } catch (e) {} }
  window.BSNatSession = { start, end, note, active, state, summarize, chip, bind, openStart, showSummary, render, KEY };
})();
