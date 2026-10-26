/* ===========================
   symptoms-dict.js — v18 symptom & curse dictionary + Yes / Maybe / No picker.
   Every symptom and curse is an IN-GAME flag: it changes the sim's rolls, guides and prompts only. It never
   describes, diagnoses or trains a real body. Each one can be switched off here, in Settings, or on the Path ⚙.
   Prefs: bs_symptoms_v1 { prefs: { id: 'yes'|'maybe'|'no' } }. "Maybe" = on for some days (seeded by date).
   Today's active set is written to the existing stores (bs_quiz_plus_v1 flags, activeSymptoms) — keys unchanged.
   =========================== */
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const KEY = 'bs_symptoms_v1', MAYBE_P = 0.4;
  const J = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const OFF_SYM = 'Answer No in the Symptom picker (Quiz hub › Gear & body), or untick it in Path ⚙ / session setup. Off takes effect on the next roll.';
  // qp = Potty Path / quiz-plus flag key, bs = session (Babysitter) symptom key
  const DEFS = [
    { id: 'overactive_bladder', icon: '💢', name: 'Overactive bladder', kind: 'symptom', qp: 'oab', bs: 'overactive_bladder',
      what: 'Urges arrive suddenly instead of building slowly.', changes: ['Sessions: extra pressure checks; small events can start at 40% pressure.', 'Path: hold squares are shorter.', 'Urge tab: shorter wait ranges.'] },
    { id: 'urge_waves', icon: '⚡', name: 'Urge waves', kind: 'symptom', qp: 'urge_waves', bs: 'urge_incontinence',
      what: 'Urges come in stacked waves — a "can\'t-wait" race once a wave starts.', changes: ['Sessions: shorter hold windows after an urge starts.', 'Path: some potty rules become 2-minute races.'] },
    { id: 'pre_void_dribble', icon: '💧', name: 'Dribbler', kind: 'symptom', qp: 'dribbler', bs: 'pre_void_dribble',
      what: 'Before a potty trip the sim may add a small "drip" step to the guide.', changes: ['Sessions & Path: a short dribble prompt before some potty permissions.', 'Check-ins: sometimes find a surprise drip.'] },
    { id: 'sleepy_bladder', icon: '😴', name: 'Sleepy bladder', kind: 'symptom', qp: 'sleepy', bs: 'nocturnal_wetter',
      what: 'You sleep right through night signals.', changes: ['Night sims: more relaxation events, fewer wake prompts.', 'Path night squares lean wet. Real-night tools stay silent and only log what you enter.'] },
    { id: 'quiet_signals', icon: '🔇', name: 'Quiet signals', kind: 'symptom', qp: 'quiet', bs: null,
      what: 'Fewer warnings before anything happens.', changes: ['Urge tab: more "first dribble" outcomes, fewer hard holds.', 'Sessions: fewer pre-warnings.'] },
    { id: 'cascade', icon: '🌊', name: 'Cascade', kind: 'symptom', qp: 'cascade', bs: null,
      what: 'One leak can be followed by another.', changes: ['Path: accidents may chain (Cascade class doubles #2 move-backs).', 'Sessions: a follow-up micro event may be added.'] },
    { id: 'movement_leak', icon: '🚶', name: 'Movement leaks', kind: 'symptom', qp: 'movement', bs: 'stress_incontinence',
      what: 'Cues like "stand up" or "walk" can trigger small events.', changes: ['Sessions: more physical-cue micro events with longer relax steps.'] },
    { id: 'giggle', icon: '😂', name: 'Giggle flag', kind: 'symptom', qp: null, bs: 'giggle_incontinence',
      what: 'Funny-moment cards in Babysitter sessions can set off a leak.', changes: ['Babysitter: more joke cards; giggle events are larger.'] },
    { id: 'tummy_trouble', icon: '🌀', name: 'Tummy trouble', kind: 'symptom', qp: null, bs: null, path: 'tummy',
      what: 'An flag for #2 rolls: "this one can\'t wait". (Any laxative-type item is flavour text only — this flag is the whole effect.)', changes: ['Path: #2 goes skip waits.', 'Cascade class keeps it on until you switch it off.'] },
    // ---- curses (from classes & Babysitter) ----
    { id: 'diaper_day', icon: '🧷', name: 'Diaper Day', kind: 'curse', what: 'Gear is set to diaper for the whole day.', changes: ['Gear advice and session protection use diapers.', 'Ends after 24 h max.'] },
    { id: 'pullup_probation', icon: '🩲', name: 'Pull-up Probation', kind: 'curse', what: 'Gear one step thicker.', changes: ['Max 4 h.'] },
    { id: 'extra_checkins', icon: '📋', name: 'Extra Check-ins', kind: 'curse', what: '+1 check-in prompt per hour.', changes: ['You still enter urgency and saturation yourself.', 'Max 3 h.'] },
    { id: 'no_perm', icon: '🙅', name: 'No-Permission Window', kind: 'curse', what: 'The sim answers "not yet" to potty asks.', changes: ['Max 1.5 h.'] },
    { id: 'strict', icon: '📏', name: 'Strict Rules', kind: 'curse', what: 'Grace windows ×0.6.', changes: ['Max 8 h.'] },
    { id: 'lines', icon: '✍', name: 'Lines', kind: 'curse', what: 'Type a short, kind line 5–20 times in the app.', changes: ['One-off.'] },
    { id: 'chore', icon: '🧹', name: 'Chore', kind: 'curse', what: 'Pick an everyday chore card.', changes: ['One-off.'] },
    { id: 'short_fuse', icon: '⏱', name: 'Short Fuse', kind: 'curse', what: 'Wait ranges ×0.5.', changes: ['Max 3 h.'] },
    { id: 'silent', icon: '🤫', name: 'Silent Treatment', kind: 'curse', what: 'No pre-warnings at all.', changes: ['Max 4 h.'] },
    { id: 'spare_tax', icon: '🎒', name: 'Spare Tax', kind: 'curse', what: '−1 spare in the Spares counter.', changes: ['One-off.'] },
    { id: 'babysitter', icon: '👀', name: 'Babysitter Watch', kind: 'curse', what: 'Babysitter-profile check-ins on.', changes: ['Max 2 h.'] },
    { id: 'timeout_potty', icon: '⏸', name: 'Potty time-out', kind: 'curse', what: 'The sim withholds potty permission for a short time.', changes: ['Max 1 h.'] },
    { id: 'strict_sitter', icon: '👩‍🍼', name: 'Strict Sitter', kind: 'curse', what: 'Babysitter potty chance −10.', changes: ['Babysitter sessions only.'] },
    { id: 'no_free_passes', icon: '🎟', name: 'No Free Passes', kind: 'curse', what: 'Babysitter passes can\'t be earned.', changes: ['Babysitter sessions only.'] },
    { id: 'slippery_focus', icon: '🌫', name: 'Slippery Focus', kind: 'curse', what: 'Leaks ×1.2 with the Babysitter.', changes: ['Babysitter sessions only.'] },
    { id: 'hydration_debt', icon: '🥤', name: 'Hydration Debt', kind: 'curse', what: 'Adds optional sip suggestions.', changes: ['Never forced: skip any sip; drink only what you want.'] }
  ];
  DEFS.forEach(d => { d.off = d.off || (d.kind === 'symptom' ? OFF_SYM : 'Curses end on their own (max time shown), or end any now in Settings › Classes / Babysitter.'); });
  const BY = DEFS.reduce((a, d) => (a[d.id] = d, a), {});
  const SYMPTOMS = DEFS.filter(d => d.kind === 'symptom');
  function load() { return Object.assign({ prefs: {} }, J(KEY, {})); }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  const dayKey = t => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  /** Pure: which symptoms are on today. 'maybe' is on when hash(day+id) < 0.4 (same answer all day). */
  function activeToday(prefs, now) { prefs = prefs || load().prefs; const day = dayKey(now); return SYMPTOMS.filter(d => prefs[d.id] === 'yes' || (prefs[d.id] === 'maybe' && hash(day + ':' + d.id) < MAYBE_P)).map(d => d.id); }
  /** Push today's set into the existing stores (keys unchanged). */
  function apply(now) {
    const d = load(); if (!Object.keys(d.prefs).length) return null; const on = activeToday(d.prefs, now);
    try { if (W.BSQuizPlus) { const q = W.BSQuizPlus.load(); q.flags = q.flags || {}; SYMPTOMS.forEach(s => { if (s.qp) q.flags[s.qp] = on.includes(s.id); }); W.BSQuizPlus.save(q); } } catch (e) {}
    const bs = on.map(id => BY[id].bs).filter(Boolean); try { localStorage.setItem('activeSymptoms', JSON.stringify(bs)); if (typeof activeSymptoms !== 'undefined') activeSymptoms = bs.slice(); } catch (e) {}
    try { if (W.BSPath) { const b = W.BSPath.load(); if (b && d.prefs.tummy_trouble) { b.flags.tummy = on.includes('tummy_trouble') || b.classId === 'cascade' && b.flags.tummy; W.BSPath.save(b); } } } catch (e) {}
    d.appliedDay = dayKey(now); save(d); return on;
  }
  function defHtml(d, open) {
    return `<div class="sym-def" id="symdef-${d.id}"><b>${d.icon} ${esc(d.name)}</b> <small class="muted">${d.kind === 'curse' ? 'curse' : 'symptom'}</small>
      <div><b>What it is:</b> ${esc(d.what)}</div><div><b>What it changes:</b><ul style="margin:2px 0 2px 18px;padding:0">${d.changes.map(c => '<li>' + esc(c) + '</li>').join('')}</ul></div><div><b>How to turn it off:</b> ${esc(d.off)}</div></div>`;
  }
  function sheet(html) { const w = document.createElement('div'); w.className = 'cal-sheet-wrap pp-sheet-wrap'; w.innerHTML = `<div class="cal-sheet pp-ev" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(w); w.onclick = e => { if (e.target === w) w.remove(); }; return w; }
  function openDefs(focus) {
    const p = load().prefs, on = activeToday();
    const w = sheet(`<h3>📖 Symptoms & curses</h3><div class="cal-legend">Every one of these can be switched off whenever you like.</div>
      <div class="qz-sec">Symptoms</div>${SYMPTOMS.map(d => defHtml(d) + `<small class="muted">Your answer: ${p[d.id] || '—'}${on.includes(d.id) ? ' · on today' : ''}</small>`).join('')}
      <div class="qz-sec">Curses</div>${DEFS.filter(d => d.kind === 'curse').map(d => defHtml(d)).join('')}
      <div class="quiz-nav"><button type="button" id="sdPick" class="pp-ok">✏ Symptom picker</button><button type="button" id="sdX">Close</button></div>`);
    w.querySelector('#sdX').onclick = () => w.remove(); w.querySelector('#sdPick').onclick = () => { w.remove(); openPicker(); };
    if (focus) { const el = w.querySelector('#symdef-' + focus); if (el) el.scrollIntoView(); }
    return w;
  }
  /** One question per symptom: Yes / Maybe (random some days) / No, definition shown inline. */
  function openPicker(done) {
    const d = load(), ans = Object.assign({}, d.prefs); let i = 0;
    const w = sheet('<div id="sdP"></div>'), m = w.querySelector('#sdP');
    const draw = () => {
      if (i >= SYMPTOMS.length) {
        const on = activeToday(ans);
        m.innerHTML = `<h3>✓ Your symptoms</h3><div class="quiz-progress"><i style="width:100%"></i></div>${SYMPTOMS.map(s => `<div>${s.icon} ${esc(s.name)}: <b>${ans[s.id] || 'no'}</b>${on.includes(s.id) ? ' · on today' : ''}</div>`).join('')}
          <div class="cal-legend">Maybe = on for some days (about ${Math.round(MAYBE_P * 100)}% of days), decided once per day. Change any time.</div>
          <div class="quiz-nav"><button type="button" id="sdBack">← Back</button><button type="button" id="sdSave" class="pp-ok">✓ Save</button></div>`;
        m.querySelector('#sdBack').onclick = () => { i--; draw(); };
        m.querySelector('#sdSave').onclick = () => { SYMPTOMS.forEach(s => { if (!ans[s.id]) ans[s.id] = 'no'; }); const dd = load(); dd.prefs = ans; save(dd); const on2 = apply(); w.remove(); if (typeof toast === 'function') toast('Symptoms saved · on today: ' + (on2.length || 'none')); if (done) done(ans, on2); };
        return;
      }
      const s = SYMPTOMS[i], cur = ans[s.id];
      m.innerHTML = `<h3 style="margin:0 0 6px">🩺 Your symptoms</h3><div class="cal-legend">${i + 1} / ${SYMPTOMS.length}</div><div class="quiz-progress"><i style="width:${Math.round((i + 1) / (SYMPTOMS.length + 1) * 100)}%"></i></div>
        <div class="quiz-q">${s.icon} Play with <b>${esc(s.name)}</b>?</div><div class="qz-help">${defHtml(s)}</div>
        <div class="quiz-opts">${[['yes', '✅ Yes — always on'], ['maybe', '🎲 Maybe — random some days'], ['no', '❌ No']].map(([v, l]) => `<button type="button" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="quiz-nav"><button type="button" id="sdBack">${i ? '← Back' : '✕ Cancel'}</button><button type="button" id="sdSkip">Skip (No)</button></div>`;
      m.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { ans[s.id] = b.dataset.v; i++; draw(); });
      m.querySelector('#sdBack').onclick = () => { if (i) { i--; draw(); } else w.remove(); };
      m.querySelector('#sdSkip').onclick = () => { ans[s.id] = 'no'; i++; draw(); };
    };
    draw(); return w;
  }
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('load', () => { try { const d = load(); if (Object.keys(d.prefs).length && d.appliedDay !== dayKey()) apply(); } catch (e) {} });
  W.BSSymptoms = { KEY, DEFS, BY, SYMPTOMS, MAYBE_P, load, save, activeToday, apply, openDefs, openPicker, defHtml, dayKey };
})();
