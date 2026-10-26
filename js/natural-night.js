/* ===========================
   natural-night.js — v7 Natural Night: real-life overnight tracking session.
   Bedtime (drinks, last pee, gear, memo) → dim night screen (I woke up → roll to get up /
   check / back to sleep, drinks anytime) → morning check-in → calendar NATURAL night entry
   with a full timeline. State persists in localStorage across app kill.
   TOTALLY SILENT: makes isBedwettingSilent() true while active; this file never plays sound,
   vibrates, schedules notifications or creates sim events. Natural entries never count toward
   campaign progress. Office mode wording is applied by the global terminology observer.
   =========================== */
(function () {
  const KEY = 'bs_natural_night', SKEY = 'bs_nn_settings';
  const DEF = { sipsMin: 1, sipsMax: 3, unit: 'ml' };
  const SIPS_CAP = 5, OZ = 29.5735;
  const LV = ['fully_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent'];
  const ALLOW = [80, 65, 50, 36, 22];   // base % allowed to get up, by continence level
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const hhmm = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const fmtT = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messyOn = () => typeof window.isMessyEnabled === 'function' && window.isMessyEnabled();

  function settings() {
    let s; try { s = Object.assign({}, DEF, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { s = Object.assign({}, DEF); }
    s.sipsMax = Math.max(1, Math.min(SIPS_CAP, Math.round(+s.sipsMax) || DEF.sipsMax));
    s.sipsMin = Math.max(1, Math.min(s.sipsMax, Math.round(+s.sipsMin) || DEF.sipsMin));
    s.unit = s.unit === 'oz' ? 'oz' : 'ml';
    return s;
  }
  function saveSettings(p) { localStorage.setItem(SKEY, JSON.stringify(Object.assign(settings(), p))); return settings(); }
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function put(st) { if (st) localStorage.setItem(KEY, JSON.stringify(st)); else localStorage.removeItem(KEY); }
  function active() { const s = get(); return !!(s && s.phase && s.phase !== 'bedtime'); }
  const toMl = (v, unit) => { v = +v; if (!isFinite(v) || v <= 0) return null; return Math.round(unit === 'oz' ? v * OZ : v); };
  const showAmt = (ml, unit) => unit === 'oz' ? `${Math.round(ml / OZ * 10) / 10} oz` : `${Math.round(ml)} ml`;
  /** "HH:MM" → timestamp at or before ref (before=true) or at/after ref. */
  function timeTs(v, ref, before) {
    if (!/^\d\d:\d\d$/.test(v || '')) return null;
    const d = new Date(ref); d.setHours(+v.slice(0, 2), +v.slice(3), 0, 0);
    let t = d.getTime();
    if (before && t > ref + 60000) t -= 864e5;
    if (!before && t < ref - 60000) t += 864e5;
    return t;
  }
  // v11 (B14): read the user's Natural Urge control (preset / Match my profile / custom), not the sim session's level.
  function levelIdx() { try { if (window.BSSimpleUrge) return window.BSSimpleUrge.profile().levelIdx; } catch (e) {} try { const q = window.BSQuiz && window.BSQuiz.load(); if (q && q.baseline) return q.baseline.levelIdx; } catch (e) {} return 1; }
  /** Pure roll: { urgency 0..10, level idx, rng } → { outcome 'allowed'|'stay', chance, sips } */
  function roll(o) {
    o = o || {}; const rng = o.rng || Math.random, s = settings();
    const u = Math.max(0, Math.min(10, Math.round(+o.urgency || 0)));
    const li = o.level != null ? o.level : levelIdx();
    const chance = Math.max(5, Math.min(95, ALLOW[li] + (u - 5) * 4));
    const allowed = rng() * 100 < chance;
    const sips = s.sipsMin + Math.floor(rng() * (s.sipsMax - s.sipsMin + 1));
    return { outcome: allowed ? 'allowed' : 'stay', chance, urgency: u, sips: allowed ? Math.min(SIPS_CAP, sips) : 0 };
  }

  // ---------- state transitions ----------
  function begin(b) {
    const now = b.bedtime || Date.now();
    const drinks = (b.drinks || []).filter(d => d && d.ml > 0 && d.ts).map(d => ({ ts: +d.ts, ml: Math.round(+d.ml) }));
    const st = { v: 1, phase: 'night', bedtime: now, drinks, lastPeeAt: b.lastPeeAt || null, protection: b.protection || 'none', bedMemo: b.memo || '', unit: settings().unit,
      timeline: [], wakes: 0, awake: false, pendingRoll: null };
    drinks.forEach(d => st.timeline.push({ k: 'drink', ts: d.ts, ml: d.ml, pre: 1 }));
    if (st.lastPeeAt) st.timeline.push({ k: 'pee', ts: st.lastPeeAt, pre: 1 });
    st.timeline.push({ k: 'bed', ts: now, memo: b.memo || undefined });
    // Silence everything: stop any running sim session and clear scheduled alarms.
    try { if (typeof sessionRunning !== 'undefined' && sessionRunning && typeof stopAll === 'function') stopAll(); } catch (e) {}
    put(st);
    try { if (typeof stopChime === 'function') stopChime(); } catch (e) {}
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    log(`🌙 <b>Natural Night started</b> — bedtime ${fmtT(now)}. Silent mode: no alarms, sounds or reminders.`);
    return st;
  }
  function push(ev) { const st = get(); if (!st) return null; st.timeline.push(Object.assign({ ts: Date.now() }, ev)); put(st); return st; }
  function wake(ts) {
    const st = get(); if (!st) return null; st.wakes++; st.awake = true; st.timeline.push({ k: 'wake', ts: ts || Date.now() }); put(st);
    // v21: if DryClip flagged events overnight, offer a short wake check-in (sat / pants / severity)
    try {
      if (window.BSDryClip && window.BSDryClip.openWakeCheckIn) {
        const n = window.BSCalendar && window.BSCalendar.unconfirmedClipCount && window.BSCalendar.unconfirmedClipCount();
        if (n > 0) setTimeout(() => { try { window.BSDryClip.openWakeCheckIn({ from: 'natural-night' }); } catch (e) {} }, 350);
      }
    } catch (e) {}
    return st;
  }
  function addDrink(ml, ts) { const st = get(); if (!st || !(ml > 0)) return null; ts = ts || Date.now(); st.drinks.push({ ts, ml: Math.round(ml) }); st.timeline.push({ k: 'drink', ts, ml: Math.round(ml) }); put(st); return st; }
  function doRoll(urgency, rng) {
    const st = get(); if (!st) return null;
    const r = roll({ urgency, rng });
    st.timeline.push({ k: 'roll', ts: Date.now(), outcome: r.outcome, chance: r.chance, urg: r.urgency * 10 });
    st.pendingRoll = r.outcome === 'allowed' ? { sips: r.sips, ts: Date.now() } : null;
    put(st); return r;
  }
  function confirmPee(sips) {
    const st = get(); if (!st || !st.pendingRoll) return null;
    const n = Math.max(0, Math.min(SIPS_CAP, Math.round(sips != null ? sips : st.pendingRoll.sips)));
    const ts = Date.now(); st.lastPeeAt = ts;
    st.timeline.push({ k: 'pee', ts, sips: n });
    st.pendingRoll = null; put(st); return st;
  }
  function logCheck(c) {
    const st = get(); if (!st) return null;
    st.timeline.push({ k: 'check', ts: Date.now(), sat: c.sat, urg: c.urg, leak: !!c.leak, rem: c.rem, messy: !!(c.messy && messyOn()) || undefined, memo: c.memo || undefined });
    put(st); return st;
  }
  function sleep() { const st = get(); if (!st) return null; st.awake = false; st.pendingRoll = null; st.timeline.push({ k: 'sleep', ts: Date.now() }); put(st); return st; }
  function toMorning() { const st = get(); if (!st) return null; st.phase = 'morning'; put(st); return st; }
  /** Final rise: getting up for the day — logs rise time, ends the night, opens morning check-in. */
  function rise(ts) { const st = get(); if (!st) return null; ts = ts || Date.now(); st.timeline = st.timeline.filter(t => t.k !== 'rise'); st.timeline.push({ k: 'rise', ts }); st.riseAt = ts; st.awake = false; st.pendingRoll = null; st.phase = 'morning'; put(st); return st; }
  function cancel() { put(null); close(); try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {} }

  /** Prefill for the morning check-in from night data. */
  function prefill(st) {
    const checks = st.timeline.filter(t => t.k === 'check'); const last = checks[checks.length - 1] || {};
    const wet = checks.some(c => (c.sat || 0) > 0 || c.leak);
    return { wet, sat: last.sat != null ? last.sat : 0, leak: checks.some(c => c.leak), rem: last.rem || (wet ? 'unsure' : 'no'), urg: last.urg != null ? last.urg : 50 };
  }
  /** Derived metrics. */
  function metrics(st, wakeAt, asleepAt) {
    const inBed = Math.max(0, Math.round((wakeAt - st.bedtime) / 60000));
    // time awake at night: wake → next sleep/roll-end (approximate by wake→sleep pairs)
    let awakeMin = 0, openW = null;
    st.timeline.forEach(t => { if (t.k === 'wake') openW = t.ts; if (t.k === 'sleep' && openW) { awakeMin += (t.ts - openW) / 60000; openW = null; } });
    const start = asleepAt && asleepAt >= st.bedtime && asleepAt <= wakeAt ? asleepAt : st.bedtime;
    const sleepMin = Math.max(0, Math.round((wakeAt - start) / 60000 - awakeMin));
    const fluid = st.drinks.reduce((a, d) => a + d.ml, 0);
    const before = st.drinks.filter(d => d.ts <= st.bedtime).reduce((a, d) => a + d.ml, 0);
    const hsp = st.lastPeeAt ? Math.round((wakeAt - st.lastPeeAt) / 360000) / 10 : null;
    return { timeInBedMin: inBed, sleepMin, hoursSincePee: hsp, fluidMl: fluid, fluidBeforeBedMl: before,
      wakes: st.wakes, pees: st.timeline.filter(t => t.k === 'pee' && !t.pre).length, rolls: st.timeline.filter(t => t.k === 'roll').length };
  }
  /** Finish: save NATURAL night entry and clear the session. */
  function finish(m) {
    const st = get(); if (!st) return null;
    let wakeAt = m.wakeAt || Date.now();
    const lastTs = Math.max(st.bedtime, ...st.timeline.filter(t => t.k !== 'rise').map(t => t.ts));
    if (wakeAt < lastTs && lastTs - wakeAt < 60000) wakeAt = lastTs + 1;   // HH:MM input truncates seconds
    const x = metrics(st, wakeAt, m.asleepAt);
    const sat = Math.max(0, Math.min(100, Math.round(+m.sat || 0)));
    const tl = st.timeline.filter(t => t.k !== 'rise').map(t => { const o = Object.assign({}, t); delete o.pre; return o; });
    tl.push({ k: 'rise', ts: wakeAt });
    tl.sort((a, b) => a.ts - b.ts);
    tl.push({ k: 'morning', ts: wakeAt, sat, urg: m.urg, leak: !!m.leak, rem: m.rem, memo: m.memo || undefined });
    const nn = Object.assign({ bedtime: st.bedtime, wakeAt, riseAt: wakeAt, asleepAt: m.asleepAt || undefined, lastPeeAt: st.lastPeeAt || undefined, drinks: st.drinks, timeline: tl,
      unit: st.unit, bedMemo: st.bedMemo || undefined }, x);
    const entry = { ts: wakeAt, type: 'night', source: 'natural', mode: 'natural_night', tags: ['natural-night'],
      night: { wet: !!m.wet, protected: st.protection !== 'none', protection: st.protection, leaked: !!(m.wet && m.leak), woke: st.wakes > 0, wokeCount: st.wakes,
        fluidMl: x.fluidMl, remembered: m.rem, saturation: sat, urgency: m.urg, messy: !!(m.messy && messyOn()), nn },
      memo: m.memo || undefined };
    if (m.wet) entry.night.saturation = sat || 60;
    const C = window.BSCalendar; const saved = C ? C.addEntry(entry) : null;
    put(null);
    log(`☀️ <b>Natural Night saved</b> — ${m.wet ? 'wet' : 'dry'} · ${x.wakes} wake(s) · ${showAmt(x.fluidMl, st.unit)} fluids · in bed ${Math.floor(x.timeInBedMin / 60)}h ${pad2(x.timeInBedMin % 60)}m.`);
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    return saved;
  }
  function log(html) { try { if (typeof logToOutput === 'function') logToOutput(html); } catch (e) {} }

  // ---------- UI ----------
  function ov() {
    let o = document.getElementById('nnOverlay');
    if (!o) { o = document.createElement('div'); o.id = 'nnOverlay'; o.className = 'nn-ov'; o.setAttribute('role', 'dialog'); document.body.appendChild(o); }
    return o;
  }
  function close() { const o = document.getElementById('nnOverlay'); if (o) o.remove(); document.body.classList.remove('nn-open'); }
  function protOpts(val) {
    const list = window.BSCalendar ? window.BSCalendar.protectionOptions() : [{ value: 'none', label: 'None' }];
    return list.map(o => `<option value="${esc(o.value)}" ${o.value === val ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  }
  const seg = (name, opts, val) => `<div class="seg nn-seg">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${String(v) === String(val) ? 'checked' : ''}>${l}</label>`).join('')}</div>`;
  const rv = (o, n) => { const r = o.querySelector(`input[name="${n}"]:checked`); return r ? r.value : null; };
  const satSel = (id, v) => `<label class="nn-fld"><span>Saturation of protection: <b id="${id}V">${v}%</b></span><input type="range" id="${id}" min="0" max="100" step="5" value="${v}" oninput="document.getElementById('${id}V').textContent=this.value+'%'"></label>`;
  const urgSel = (id, v) => `<label class="nn-fld"><span>Urgency: <b id="${id}V">${v}/10</b></span><input type="range" id="${id}" min="0" max="10" step="1" value="${v}" oninput="document.getElementById('${id}V').textContent=this.value+'/10'"></label>`;
  function apply() { try { if (window.BSOffice && window.BSOffice.on()) window.BSOffice.apply(); } catch (e) {} }

  function open() {
    document.body.classList.add('nn-open');
    const st = get();
    if (!st) return renderBedtime();
    if (st.phase === 'morning') return renderMorning();
    return renderNight();
  }

  let draftDrinks = [];
  function renderBedtime() {
    const o = ov(), s = settings(), now = Date.now();
    const cur = typeof currentProtectionLevel !== 'undefined' ? currentProtectionLevel : 'none';
    o.innerHTML = `<div class="nn-card" id="nnBedtime"><h2>🛏️ Natural Night — bedtime</h2>
      <p class="nn-muted">Real-life night. Totally silent: no alarms, sounds, vibration, reminders or sim events.</p>
      <h3>🥤 Drinks before bed</h3>
      <div class="nn-row"><input id="nnDrAmt" type="number" inputmode="decimal" min="0" placeholder="Amount" aria-label="Drink amount">
        <select id="nnUnit" aria-label="Unit"><option value="ml" ${s.unit === 'ml' ? 'selected' : ''}>ml</option><option value="oz" ${s.unit === 'oz' ? 'selected' : ''}>oz</option></select>
        <input id="nnDrTime" type="time" value="${hhmm(now)}" aria-label="Drink time"><button id="nnDrAdd" class="nn-btn">➕ Add</button></div>
      <ul id="nnDrList" class="nn-list"></ul>
      <label class="nn-fld"><span>🚽 Time of last pee</span><input id="nnLastPee" type="time" value="${hhmm(now)}"></label>
      <label class="nn-fld"><span>🧷 Protection worn</span><select id="nnProt">${protOpts(cur)}</select></label>
      <label class="nn-fld"><span>📝 Memo (optional)</span><textarea id="nnBedMemo" rows="2"></textarea></label>
      <button id="nnGoBed" class="nn-big nn-primary">🌙 Going to bed now</button>
      <button id="nnCancel" class="nn-btn nn-ghost">Cancel</button></div>`;
    const list = () => { const u = o.querySelector('#nnUnit').value; o.querySelector('#nnDrList').innerHTML = draftDrinks.map((d, i) => `<li>${fmtT(d.ts)} · ${showAmt(d.ml, u)} <button class="nn-btn nn-x" data-i="${i}" aria-label="Remove drink">✕</button></li>`).join('') || '<li class="nn-muted">No drinks logged.</li>';
      o.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { draftDrinks.splice(+b.dataset.i, 1); list(); }); apply(); };
    list();
    o.querySelector('#nnUnit').onchange = e => { saveSettings({ unit: e.target.value }); list(); };
    o.querySelector('#nnDrAdd').onclick = () => {
      const u = o.querySelector('#nnUnit').value, ml = toMl(o.querySelector('#nnDrAmt').value, u);
      const ts = timeTs(o.querySelector('#nnDrTime').value, Date.now(), true) || Date.now();
      if (!ml) { if (typeof toast === 'function') toast('Enter an amount'); return; }
      draftDrinks.push({ ts, ml }); draftDrinks.sort((a, b) => a.ts - b.ts); o.querySelector('#nnDrAmt').value = ''; list();
    };
    o.querySelector('#nnGoBed').onclick = () => {
      begin({ drinks: draftDrinks, lastPeeAt: timeTs(o.querySelector('#nnLastPee').value, Date.now(), true), protection: o.querySelector('#nnProt').value, memo: o.querySelector('#nnBedMemo').value.trim() });
      draftDrinks = []; renderNight();
    };
    o.querySelector('#nnCancel').onclick = () => { draftDrinks = []; close(); };
    apply();
  }

  let clockTimer = null, panel = null, lastRoll = null;
  function renderNight() {
    const o = ov(), st = get(); if (!st) return close();
    const s = settings();
    const sinceBed = Math.round((Date.now() - st.bedtime) / 60000);
    let body = '';
    if (!st.awake) {
      body = `<button id="nnWoke" class="nn-huge">👀 Woke up<br><span style="font-size:0.55em;font-weight:600;">(still night — back to sleep after)</span></button>
        <button id="nnRise" class="nn-big nn-rise">☀️ Getting up for the day<br><span style="font-size:0.7em;font-weight:600;">ends the night → morning check-in</span></button>`;
    } else if (st.pendingRoll) {
      body = `<div class="nn-result ok">✅ Allowed — get up and pee.</div>
        <div class="nn-rule">Rule: drink <b id="nnSips">${st.pendingRoll.sips}</b> sip${st.pendingRoll.sips === 1 ? '' : 's'} — <b>small sips only</b>.</div>
        <button id="nnPeeDone" class="nn-big nn-primary">✅ Peed &amp; drank ${st.pendingRoll.sips} small sip${st.pendingRoll.sips === 1 ? '' : 's'}</button>
        <button id="nnSkipPee" class="nn-btn">Didn't go after all</button>`;
    } else if (panel === 'roll') {
      body = `<h3>🎲 Roll to get up and pee</h3>${urgSel('nnRU', 5)}
        <div class="nn-muted">Uses your continence level. Outcome: allowed (go) or stay in bed and try to sleep.</div>
        <button id="nnDoRoll" class="nn-big nn-primary">🎲 Roll</button><button id="nnBack" class="nn-btn">◀ Back</button>`;
    } else if (panel === 'stay') {
      body = `<div class="nn-result stay">🛌 Stay in bed — try to sleep.</div>${lastRoll ? `<div class="nn-muted">${lastRoll.chance}% chance at urgency ${lastRoll.urgency}/10.</div>` : ''}
        <button id="nnSleep" class="nn-big nn-primary">😴 Back to sleep</button>`;
    } else if (panel === 'check') {
      body = `<h3>🔎 Log check</h3>${satSel('nnCS', 0)}${urgSel('nnCU', 5)}
        <div class="nn-fld"><span>Did it leak?</span>${seg('nnCL', [['1', 'Yes'], ['0', 'No']], '0')}</div>
        <div class="nn-fld"><span>Remember peeing?</span>${seg('nnCR', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Unsure']], 'no')}</div>
        ${messyOn() ? `<div class="nn-fld"><span>Messy?</span>${seg('nnCM', [['1', 'Yes'], ['0', 'No']], '0')}</div>` : ''}
        <label class="nn-fld"><span>Memo</span><textarea id="nnCMemo" rows="2"></textarea></label>
        <button id="nnSaveCheck" class="nn-big nn-primary">💾 Save check</button><button id="nnBack" class="nn-btn">◀ Back</button>`;
    } else if (panel === 'drink') {
      body = `<h3>🥤 Log a drink</h3><div class="nn-row"><input id="nnNDAmt" type="number" inputmode="decimal" min="0" placeholder="Amount (${s.unit})" aria-label="Drink amount"><span class="nn-muted">${s.unit}</span></div>
        <button id="nnSaveDrink" class="nn-big nn-primary">💾 Save drink</button><button id="nnBack" class="nn-btn">◀ Back</button>`;
    } else {
      body = `<div class="nn-muted">Awake since ${fmtT((st.timeline.filter(t => t.k === 'wake').pop() || {}).ts || Date.now())}</div>
        <button id="nnOptRoll" class="nn-big">🎲 Roll to get up and pee</button>
        <button id="nnOptCheck" class="nn-big">🔎 Log check</button>
        <button id="nnSleep" class="nn-big nn-primary">😴 Back to sleep</button>
        <button id="nnRise" class="nn-big nn-rise">☀️ Getting up for the day</button>`;
    }
    o.innerHTML = `<div class="nn-night" id="nnNight">
      <div class="nn-clock" id="nnClock">${fmtT(Date.now())}</div>
      <div class="nn-muted">In bed since ${fmtT(st.bedtime)} · ${Math.floor(sinceBed / 60)}h ${pad2(sinceBed % 60)}m · wakes ${st.wakes} · 🔕 silent</div>
      <div class="nn-body">${body}</div>
      <div class="nn-foot">${panel !== 'drink' && !st.pendingRoll ? '<button id="nnOptDrink" class="nn-btn">🥤 Log a drink</button>' : ''}
        <button id="nnMin" class="nn-btn nn-ghost">Minimise</button></div></div>`;
    const on = (id, fn) => { const b = o.querySelector('#' + id); if (b) b.onclick = fn; };
    on('nnWoke', () => { wake(); panel = null; renderNight(); });
    on('nnOptRoll', () => { panel = 'roll'; renderNight(); });
    on('nnOptCheck', () => { panel = 'check'; renderNight(); });
    on('nnOptDrink', () => { panel = 'drink'; renderNight(); });
    on('nnBack', () => { panel = null; renderNight(); });
    on('nnSleep', () => { sleep(); panel = null; lastRoll = null; renderNight(); });
    on('nnDoRoll', () => { lastRoll = doRoll(+o.querySelector('#nnRU').value); panel = lastRoll.outcome === 'stay' ? 'stay' : null; renderNight(); });
    on('nnPeeDone', () => { confirmPee(); panel = null; renderNight(); });
    on('nnSkipPee', () => { const x = get(); x.pendingRoll = null; put(x); panel = null; renderNight(); });
    on('nnSaveCheck', () => { logCheck({ sat: +o.querySelector('#nnCS').value, urg: +o.querySelector('#nnCU').value * 10, leak: rv(o, 'nnCL') === '1', rem: rv(o, 'nnCR'), messy: rv(o, 'nnCM') === '1', memo: o.querySelector('#nnCMemo').value.trim() }); panel = null; renderNight(); });
    on('nnSaveDrink', () => { const ml = toMl(o.querySelector('#nnNDAmt').value, s.unit); if (ml) addDrink(ml); panel = null; renderNight(); });
    on('nnRise', () => { rise(); panel = null; renderMorning(); });
    on('nnMin', () => close());
    clearInterval(clockTimer);
    clockTimer = setInterval(() => { const c = document.getElementById('nnClock'); if (!c) { clearInterval(clockTimer); return; } c.textContent = fmtT(Date.now()); }, 15000);
    apply();
  }

  function renderMorning() {
    const o = ov(), st = get(); if (!st) return close();
    const p = prefill(st), now = Date.now();
    o.innerHTML = `<div class="nn-card" id="nnMorningCard"><h2>☀️ Morning check-in</h2>
      <div class="nn-row"><label class="nn-fld"><span>Rise time (up for the day)</span><input id="nnMWake" type="time" value="${hhmm(st.riseAt || now)}"></label>
      <label class="nn-fld"><span>Fell asleep (est., optional)</span><input id="nnMAsleep" type="time" value=""></label></div>
      <div class="nn-fld"><span>Wet the bed?</span>${seg('nnMW', [['1', 'Yes'], ['0', 'No']], p.wet ? '1' : '0')}</div>
      <div class="nn-fld"><span>Remember peeing?</span>${seg('nnMR', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Unsure']], p.rem)}</div>
      ${satSel('nnMS', p.sat)}
      <div class="nn-fld"><span>Leaked?</span>${seg('nnML', [['1', 'Yes'], ['0', 'No']], p.leak ? '1' : '0')}</div>
      ${urgSel('nnMU', Math.round(p.urg / 10))}
      ${messyOn() ? `<div class="nn-fld"><span>Messy?</span>${seg('nnMM', [['1', 'Yes'], ['0', 'No']], '0')}</div>` : ''}
      <label class="nn-fld"><span>Memo</span><textarea id="nnMMemo" rows="2"></textarea></label>
      <div id="nnSummary" class="nn-summary"></div>
      <button id="nnSaveMorning" class="nn-big nn-primary">💾 Save Natural Night</button>
      <button id="nnBackNight" class="nn-btn">◀ Back to night</button>
      <button id="nnDiscard" class="nn-btn nn-ghost">Discard night</button></div>`;
    const read = () => {
      const wakeAt = timeTs(o.querySelector('#nnMWake').value, Date.now(), true) || Date.now();
      const asl = o.querySelector('#nnMAsleep').value ? timeTs(o.querySelector('#nnMAsleep').value, st.bedtime, false) : null;
      return { wakeAt: Math.max(wakeAt, st.bedtime), asleepAt: asl, wet: rv(o, 'nnMW') === '1', rem: rv(o, 'nnMR'), sat: +o.querySelector('#nnMS').value, leak: rv(o, 'nnML') === '1',
        urg: +o.querySelector('#nnMU').value * 10, messy: rv(o, 'nnMM') === '1', memo: o.querySelector('#nnMMemo').value.trim() };
    };
    const sum = () => { const m = read(), x = metrics(st, m.wakeAt, m.asleepAt), hm = v => `${Math.floor(v / 60)}h ${pad2(v % 60)}m`;
      o.querySelector('#nnSummary').innerHTML = `🛏️ Time in bed <b>${hm(x.timeInBedMin)}</b> · 😴 est. sleep <b>${hm(x.sleepMin)}</b><br>🚽 Hours since last pee <b>${x.hoursSincePee == null ? '—' : x.hoursSincePee}</b> · 🥤 Total fluids <b>${showAmt(x.fluidMl, st.unit)}</b> (${showAmt(x.fluidBeforeBedMl, st.unit)} before bed) · 👀 ${x.wakes} wake(s)`; apply(); };
    o.querySelectorAll('input,textarea').forEach(i => i.addEventListener('input', sum)); o.querySelectorAll('input[type=radio]').forEach(i => i.addEventListener('change', sum));
    sum();
    o.querySelector('#nnSaveMorning').onclick = () => {
      const saved = finish(read()); close();
      if (typeof toast === 'function') toast('Natural Night saved to calendar');
      if (typeof switchTab === 'function') switchTab('calendar');
      return saved;
    };
    o.querySelector('#nnBackNight').onclick = () => { const x = get(); x.phase = 'night'; delete x.riseAt; x.timeline = x.timeline.filter(t => t.k !== 'rise'); put(x); renderNight(); };
    o.querySelector('#nnDiscard').onclick = () => { if (confirm('Discard this Natural Night? Nothing will be saved.')) cancel(); };
    apply();
  }

  function renderSettings() {
    const host = document.getElementById('tab-settings'); if (!host) return;
    let c = document.getElementById('nnSettings');
    if (!c) { c = document.createElement('div'); c.id = 'nnSettings'; c.className = 'card'; host.appendChild(c); }
    const s = settings();
    const opt = (v) => [1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === v ? 'selected' : ''}>${n}</option>`).join('');
    c.innerHTML = `<h3>🌙 Natural Night</h3><p class="section-desc">After an allowed night-time pee you must drink a random number of <b>small sips only</b> (max ${SIPS_CAP}). Natural Night is always silent.</p>
      <div class="nn-row"><label class="nn-fld"><span>Min sips</span><select id="nnSetMin">${opt(s.sipsMin)}</select></label>
      <label class="nn-fld"><span>Max sips</span><select id="nnSetMax">${opt(s.sipsMax)}</select></label>
      <label class="nn-fld"><span>Unit</span><select id="nnSetUnit"><option value="ml" ${s.unit === 'ml' ? 'selected' : ''}>ml</option><option value="oz" ${s.unit === 'oz' ? 'selected' : ''}>oz</option></select></label></div>`;
    const upd = () => { let mn = +c.querySelector('#nnSetMin').value, mx = +c.querySelector('#nnSetMax').value; if (mn > mx) mn = mx; saveSettings({ sipsMin: mn, sipsMax: mx, unit: c.querySelector('#nnSetUnit').value }); renderSettings(); };
    c.querySelectorAll('select').forEach(x => x.onchange = upd);
    apply();
  }
  function updateButton() { const b = document.getElementById('btnNaturalNight'); if (!b) return; const st = get(); b.textContent = st ? '🌙 Resume Natural Night (silent)' : '🌙 Natural Night (silent, real-life)'; }

  window.BSNight = { active, get, settings, saveSettings, roll, begin, wake, addDrink, doRoll, confirmPee, logCheck, sleep, toMorning, rise, finish, cancel, metrics, prefill, open, close, renderSettings, SIPS_CAP };
  window.addEventListener('load', () => {
    renderSettings(); updateButton(); setInterval(updateButton, 5000);
    if (get()) setTimeout(open, 300);   // resume overnight session after app kill / reload
  });
})();
/* v8 discoverability: picker choice + evening card on Session tab (after 19:00 local). */
function chooseNaturalNightSession() { try { if (typeof closeSessionSetupModal === 'function') closeSessionSetupModal(); } catch (e) {} window.BSNight.open(); }
window.chooseNaturalNightSession = chooseNaturalNightSession;
(function () {
  function isEvening(now) { const h = (now ? new Date(now) : new Date()).getHours(); return h >= 19 || h < 4; }
  function updateEveningCard(now) {
    const c = document.getElementById('nnEveningCard'); if (!c) return;
    const st = window.BSNight.get();
    const show = !!st || isEvening(now);
    c.style.display = show ? '' : 'none';
    const t = document.getElementById('nnEveningTitle'); if (t) t.textContent = st ? 'Natural Night in progress — resume' : 'Going to bed? Start Natural Night';
  }
  window.BSNight.isEvening = isEvening; window.BSNight.updateEveningCard = updateEveningCard;
  window.addEventListener('load', () => { updateEveningCard(); setInterval(updateEveningCard, 60000); });
})();
