/* ===========================
   drinks.js — v44 drink log. One-tap presets, repeat last, missed days stay missing.
   A missing day is null, not 0 ml, so it does not pull the control estimate.
   An explicit "nothing" log is a real zero. No stars for drinking.
   The nudge opens #log-drink. Native action buttons wait on a later plugin pass.
   =========================== */
(function () {
  const KEY = 'bs_drinks_v1';
  const PRESETS = [
    { id: 'sip', label: 'Sip', ml: 50 },
    { id: 'small', label: 'Small', ml: 150 },
    { id: 'cup', label: 'Cup', ml: 250 },
    { id: 'glass', label: 'Glass', ml: 350 },
    { id: 'bottle', label: 'Bottle', ml: 500 }
  ];
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const dk = ts => { const d = new Date(ts || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function defaults() { return { v: 1, presets: PRESETS.map(p => Object.assign({}, p)), last: null, nudge: false, days: {} }; }
  function load() { const s = Object.assign(defaults(), J(KEY, {})); s.days = s.days || {}; if (!Array.isArray(s.presets) || !s.presets.length) s.presets = PRESETS.slice(); return s; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function dayRec(s, day, create) {
    if (!s.days[day] && create) s.days[day] = { logged: true, ml: 0, items: [] };
    return s.days[day] || null;
  }
  /** null when that day was never logged. 0 only when the player said so. */
  function total(day) {
    const rec = load().days[day || dk()];
    if (!rec || !rec.logged) return null;
    return Math.max(0, Math.round(+rec.ml || 0));
  }
  function add(ml, label, id, ts) {
    ml = Math.max(0, Math.round(+ml || 0));
    const s = load(); const when = ts || Date.now(); const day = dk(when);
    const rec = dayRec(s, day, true);
    rec.logged = true;
    rec.items.push({ ts: when, ml: ml, label: label || (ml + ' ml'), id: id || null });
    rec.ml = rec.items.reduce((a, it) => a + (+it.ml || 0), 0);
    if (ml > 0) s.last = { id: id || null, label: label || (ml + ' ml'), ml: ml, ts: when };
    save(s);
    try { window.dispatchEvent(new CustomEvent('bs:drinks', { detail: { day: day, ml: rec.ml } })); } catch (e) {}
    return rec;
  }
  function repeatLast() { const s = load(); if (!s.last) return null; return add(s.last.ml, s.last.label, s.last.id); }
  function logNothing(day) {
    const s = load(); const d = day || dk();
    s.days[d] = { logged: true, ml: 0, items: [] };
    return save(s);
  }
  /** Intake litres for the frequency adjustment. null if that day has no log. */
  function intakeLitres(day) { const ml = total(day); return ml == null ? null : ml / 1000; }
  function last2h(now) {
    now = now || Date.now();
    const s = load(); let ml = 0;
    Object.keys(s.days).forEach(day => {
      (s.days[day].items || []).forEach(it => { if (it.ts >= now - 2 * 3600000 && it.ts <= now) ml += +it.ml || 0; });
    });
    return ml;
  }
  function balance(day, outputMl) {
    const inn = total(day);
    const out = outputMl == null || outputMl === '' ? null : Math.round(+outputMl);
    return {
      day: day || dk(),
      intakeMl: inn,
      outputMl: out,
      diffMl: inn == null || out == null ? null : inn - out,
      intakeText: inn == null ? 'not logged' : inn + ' ml',
      outputText: out == null ? 'not logged' : out + ' ml'
    };
  }
  function nudgeSpec() { return { id: 1972, kind: 'drink', title: 'Drink log', body: 'Tap to log a drink.', hash: '#log-drink' }; }
  function render() {
    const m = document.getElementById('drinkLogMount'); if (!m) return;
    const s = load(); const today = total();
    const last = s.last ? `Last: ${s.last.label} ${s.last.ml} ml` : 'No drink yet today';
    m.innerHTML = `<div class="urge-note" id="drinkBar"><b>Drinks</b> <span id="drinkToday">${today == null ? 'not logged' : today + ' ml'}</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
        ${s.presets.map(p => `<button type="button" data-d="${p.id}" class="pill">${p.label} ${p.ml}</button>`).join('')}
        <button type="button" id="drinkAgain" class="pill" ${s.last ? '' : 'disabled'}>Same again</button>
        <button type="button" id="drinkZero" class="pill">Nothing</button>
      </div>
      <div class="cal-legend">${last}. A missed day stays blank — it is not counted as zero.</div></div>`;
    m.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const p = s.presets.find(x => x.id === b.dataset.d); if (!p) return;
      add(p.ml, p.label, p.id); render();
    });
    const ag = m.querySelector('#drinkAgain'); if (ag) ag.onclick = () => { repeatLast(); render(); };
    m.querySelector('#drinkZero').onclick = () => { logNothing(); render(); };
  }
  window.BSDrinks = { KEY, PRESETS, load, save, total, add, repeatLast, logNothing, intakeLitres, last2h, balance, nudgeSpec, render };
  try { window.addEventListener('load', () => { try { render(); if ((location.hash || '') === '#log-drink') render(); } catch (e) {} }); } catch (e) {}
})();
