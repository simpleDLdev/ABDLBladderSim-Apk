/* ===========================
   night-cond.js — bedtime routine, quiet night, wake events, opt-in DryClip.
   Day sessions pass track day. Night sessions pass track night and stay quiet
   except the opt-in clip and the buttons on this screen.
   =========================== */
(function () {
  const KEY = 'bs_night_cond_v1';
  const GEAR = {
    G0: ['a thick diaper', 'It holds a full night, so a change can wait until morning.'],
    G1: ['a diaper', 'Enough for a wet night, with a change only if you wake soaked and that is your plan.'],
    G2: ['a booster under a diaper', 'Extra room for more than one wet without getting up.'],
    G3: ['a pull-up', 'You can get it on and off if you do wake.'],
    G4: ['a pad', 'A backup for a mostly dry night.'],
    G5: ['training pants', 'A light layer while the night is still uneven.'],
    G6: ['underwear', 'You are aiming to wake and get up, with little gear in the way.']
  };
  const FROM_LEVEL = { none: 'G6', pad: 'G4', pullups: 'G3', diapers: 'G1', thick_diapers: 'G0' };
  function loadState() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function saveState(st) { try { if (st) localStorage.setItem(KEY, JSON.stringify(st)); else localStorage.removeItem(KEY); } catch (e) {} }
  function profile() {
    try { return window.BSOnboard && window.BSOnboard.load && window.BSOnboard.load().profile; } catch (e) { return null; }
  }
  function hasProfile() { return !!profile(); }
  function nightDir(p) {
    p = p || profile() || {};
    return (p.direction && p.direction.night) === 'B' ? 'B' : 'A';
  }
  function wantsDeeper(p) {
    p = p || {};
    const goals = p.goals || [];
    return goals.indexOf('deeper') >= 0 || goals.indexOf('bedwetting') >= 0 || (p.sleep && (p.sleep.deeper === 'more' || p.sleep.stay === 'yes'));
  }
  function gearRec(p) {
    p = p || profile() || {};
    let id = 'G1';
    const key = (p.levelKey && p.levelKey.night) || 'okay';
    try {
      const level = window.BSControl && window.BSControl.level && window.BSControl.level(key);
      if (level && level.gear && FROM_LEVEL[level.gear.night]) id = FROM_LEVEL[level.gear.night];
    } catch (e) {}
    const rec = p.gear && p.gear.recommended && p.gear.recommended.night;
    if (rec && GEAR[rec]) id = rec;
    const worn = p.gear && (p.gear.worn && p.gear.worn.night || p.gear.night);
    if (worn && GEAR[worn]) id = worn;
    const pair = GEAR[id] || GEAR.G1;
    const levelName = (function () { try { const l = window.BSControl.level(key); return l && l.label; } catch (e) { return key; } })();
    return {
      id: id, name: pair[0], why: pair[1], levelKey: key, levelName: levelName || key,
      line: 'Wear ' + pair[0] + ' to bed. ' + pair[1]
    };
  }
  function clipDefaults(p) {
    p = p || {};
    const alarm = p.sleep && p.sleep.alarm;
    const suggested = alarm === 'on' ? 'alarm' : 'quiet';
    return { optedIn: false, suggested: suggested, mode: 'off' };
  }
  function routine(p) {
    p = p || profile() || {};
    const gear = gearRec(p);
    const less = nightDir(p) !== 'B';
    const clip = clipDefaults(p);
    return [
      { id: 'drinks', title: 'Evening drinks', skip: true, text: less
        ? 'A bedtime drink is fine if you are thirsty. One small one. It adds a little to the night tank.'
        : 'Cut off drinks well before bed. The last sip was earlier on purpose.' },
      { id: 'potty', title: less ? 'Last potty, or skip it' : 'Last potty', skip: true, text: less
        ? 'You can skip the last potty on purpose. Staying in bed is the practice.'
        : 'Empty before lights out. That is the bedtime void, not a test of how long you can wait.' },
      { id: 'gear', title: 'What to wear to bed', skip: false, gear: gear.id, text: gear.line },
      { id: 'check', title: 'Gear check-in', skip: true, text: 'Confirm what you actually put on. The morning log compares against this.' },
      { id: 'wind', title: 'Wind down', skip: true, text: wantsDeeper(p)
        ? 'Same bedtime, dark room, one short phrase, then stop deciding things. Deeper sleep is the goal.'
        : 'Lights down when you are ready. After this the session stays quiet.' },
      { id: 'affirm', title: 'Affirmation', skip: true, text: less
        ? 'If you wake, you can stay in bed and let go. A real need still means get up.'
        : 'If you wake with an urge, you get up and finish in the toilet. A real need still means go.' },
      { id: 'wake', title: 'Wake time', skip: true, text: 'Set the time morning starts. Until then there are no sip prompts and no day events.' },
      { id: 'clip', title: 'DryClip (opt in)', skip: true, text: 'DryClip sleep mode is off until you turn it on. Suggested if you do: ' + clip.suggested + ', from your night-alarm answer. Quiet logs the wet time with no alert. Gentle is a soft stay-asleep or get-up line. Alarm wakes you fully.' }
    ];
  }
  function wakeKind(p, answers) {
    answers = answers || {};
    const dir = nightDir(p);
    if (answers.wet && dir === 'B') return 'wetB';
    if (answers.wet) return 'stay';
    if (answers.urge && dir === 'B') return 'urgeB';
    if (answers.urge) return 'urgeA';
    return 'dry';
  }
  function drawWake(p, answers, opts) {
    opts = opts || {};
    const kind = opts.nightKind || wakeKind(p, answers);
    if (!window.BSCondEvents || !window.BSCondEvents.draw) return null;
    let tank = null;
    try { tank = window.BSTank && window.BSTank.load && window.BSTank.load(); } catch (e) {}
    return window.BSCondEvents.draw({
      profile: p || profile(),
      track: 'night',
      nightKind: kind,
      tank: tank,
      ignoreConsent: true,
      rng: opts.rng
    });
  }
  function clipReaction(opts) {
    opts = opts || {};
    if (!opts.optedIn) return { handled: false, alert: false, reason: 'opt_out' };
    const mode = opts.mode || 'quiet';
    const wetAt = opts.wetAt || Date.now();
    if (mode === 'off') return { handled: false, alert: false, reason: 'off' };
    if (mode === 'quiet') return { handled: true, alert: false, logged: true, wetAt: wetAt, mode: mode };
    const dir = opts.direction === 'B' ? 'B' : 'A';
    if (mode === 'alarm') {
      return { handled: true, alert: 'full', mode: mode, wetAt: wetAt, text: 'Wake fully. Light on. Finish in the toilet if that is your goal, or note the wet and change.', guide: [{ text: 'WAKE FULLY', time: 3, type: 'stop' }, { text: 'LIGHT ON', time: 4, type: 'stop' }] };
    }
    if (dir === 'B') {
      return { handled: true, alert: 'soft', mode: mode, wetAt: wetAt, text: 'Get up and finish in the toilet.', guide: [{ text: 'GET UP', time: 3, type: 'stop' }, { text: 'TOILET', time: 4, type: 'relax' }] };
    }
    return { handled: true, alert: 'soft', mode: mode, wetAt: wetAt, text: 'Stay soft. Back to sleep.', guide: [{ text: 'STAY SOFT', time: 4, type: 'relax' }, { text: 'BACK TO SLEEP', time: 4, type: 'relax' }] };
  }
  function onClipWet(info) {
    info = info || {};
    const st = loadState();
    if (!st || st.phase !== 'quiet' || !st.optedIn) return { handled: false, alert: false, reason: 'inactive' };
    const plan = clipReaction({ optedIn: true, mode: st.clipMode || 'quiet', direction: nightDir(st.profile), wetAt: info.wetAt });
    st.wets = st.wets || [];
    st.wets.push({ at: plan.wetAt || Date.now(), mode: st.clipMode });
    saveState(st);
    if (plan.alert && typeof showBannerNow === 'function') {
      try { showBannerNow(plan.alert === 'full' ? '📎 <b>DryClip</b>' : '📎 <b>DryClip, soft</b>', plan.text); } catch (e) {}
    }
    if (plan.alert === 'full' && plan.guide && typeof startVoidGuide === 'function') {
      try { startVoidGuide(plan.guide, plan.text, 'micro', null, true); } catch (e) {}
    }
    return plan;
  }
  function aboutNight(p) {
    p = p || profile() || {};
    const gear = gearRec(p);
    let micro = 0, macro = 0, dry = 0, total = 0;
    try {
      const list = window.BSCondEvents.eligible(p, { ignoreConsent: true, track: 'night' });
      total = list.length;
      list.forEach(function (ev) {
        if (ev.size === 'full') macro++;
        else if (ev.size === 'none') dry++;
        else micro++;
      });
    } catch (e) {}
    const clip = clipDefaults(p);
    return 'At night you are ' + gear.levelName + '. Recommended night gear: ' + gear.name + '. ' + gear.why + ' Night events available: ' + total + ' (' + micro + ' micro, ' + macro + ' macro, ' + dry + ' no-wet). DryClip sleep mode is off until you opt in' + (clip.suggested ? '; if you turn it on, the quiz points at ' + clip.suggested : '') + '.';
  }
  function quietOn() {
    window._condTrack = 'night';
    window._nightCondQuiet = true;
    try { clearTimeout(hydrationTimer); } catch (e) {}
    try { if (typeof hydrationEndAt !== 'undefined') hydrationEndAt = null; } catch (e) {}
    try { if (typeof scheduleMainEvent === 'function') scheduleMainEvent(); } catch (e) {}
  }
  function paint() {
    const host = document.getElementById('nightCondMount');
    if (!host) return;
    const st = loadState();
    if (!st) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    const p = st.profile || profile() || {};
    if (st.phase === 'routine') {
      const step = st.steps[st.i] || st.steps[st.steps.length - 1];
      host.innerHTML = '<div class="night-step"><b>Night conditioning</b><div class="cal-legend">Step ' + (st.i + 1) + ' of ' + st.steps.length + '</div><h2>' + step.title + '</h2><p>' + step.text + '</p>'
        + (step.id === 'clip' ? '<label class="urge-lbl"><input type="checkbox" id="ncClip"> Opt in to DryClip</label><label class="urge-lbl">Mode <select id="ncClipMode"><option value="quiet">Quiet</option><option value="gentle">Gentle</option><option value="alarm">Alarm</option></select></label>' : '')
        + (step.id === 'wake' ? '<label class="urge-lbl">Wake <input id="ncWake" type="time" value="07:00"></label>' : '')
        + (step.id === 'check' ? '<label class="urge-lbl">Wearing <select id="ncGear"><option>thick diaper</option><option>diaper</option><option>pull-up</option><option>pad</option><option>underwear</option></select></label>' : '')
        + '<div class="night-actions">' + (step.skip ? '<button type="button" id="ncSkip">Skip</button>' : '') + '<button type="button" id="ncNext">Done</button></div></div>';
      const next = document.getElementById('ncNext');
      const skip = document.getElementById('ncSkip');
      const go = function (skipped) { advance(skipped); };
      if (next) next.onclick = function () { go(false); };
      if (skip) skip.onclick = function () { go(true); };
      const mode = document.getElementById('ncClipMode');
      if (mode) mode.value = st.clipSuggest || 'quiet';
      return;
    }
    const wets = (st.wets || []).length;
    host.innerHTML = '<div class="night-step"><b>Quiet night</b><p>No sip prompts and no day events. DryClip is ' + (st.optedIn ? st.clipMode : 'off') + '. Clip wets logged: ' + wets + '.</p>'
      + '<div class="night-actions"><button type="button" id="ncWoke">I woke up</button><button type="button" id="ncMorning">Morning check-in</button></div>'
      + '<div id="ncWakeBox"></div></div>';
    document.getElementById('ncWoke').onclick = wakeForm;
    document.getElementById('ncMorning').onclick = morningForm;
  }
  function advance(skipped) {
    const st = loadState(); if (!st) return;
    const step = st.steps[st.i];
    if (step && step.id === 'drinks' && !skipped && window.BSTank && window.BSTank.addSips) {
      try { window.BSTank.addSips(window.BSTank.load(), 2); } catch (e) {}
    }
    if (step && step.id === 'check') {
      const gear = document.getElementById('ncGear');
      st.worn = gear ? gear.value : (st.gear && st.gear.name);
      try { if (typeof logToOutput === 'function') logToOutput('🌙 Night gear: ' + st.worn); } catch (e) {}
    }
    if (step && step.id === 'wake') {
      const t = document.getElementById('ncWake');
      st.wakeAt = t ? t.value : '07:00';
    }
    if (step && step.id === 'clip') {
      const box = document.getElementById('ncClip');
      const mode = document.getElementById('ncClipMode');
      st.optedIn = !!(box && box.checked);
      st.clipMode = st.optedIn ? (mode ? mode.value : 'quiet') : 'off';
    }
    st.done = st.done || [];
    st.done.push({ id: step && step.id, skipped: !!skipped });
    st.i += 1;
    if (st.i >= st.steps.length) {
      st.phase = 'quiet';
      saveState(st);
      quietOn();
      try { if (typeof logToOutput === 'function') logToOutput('🌙 Night conditioning is quiet until you wake or it is morning.'); } catch (e) {}
      if (st.optedIn) offerClip();
      paint();
      return;
    }
    saveState(st);
    paint();
  }
  function offerClip() {
    let paired = false;
    try { paired = window.BSDryClip && window.BSDryClip.deviceId; } catch (e) {}
    if (paired && window.BSDryClip.arm) {
      try { window.BSDryClip.arm(); } catch (e) {}
      try { if (window.BSDryClip.startNight) window.BSDryClip.startNight(); } catch (e) {}
      return;
    }
    try { if (typeof logToOutput === 'function') logToOutput('📎 DryClip is not paired. Open Settings → DryClip when you want to arm it.'); } catch (e) {}
  }
  function wakeForm() {
    const box = document.getElementById('ncWakeBox'); if (!box) return;
    box.innerHTML = '<p>What woke you?</p><div class="night-actions"><button type="button" id="ncUrge">I have an urge</button><button type="button" id="ncWet">Already wet</button><button type="button" id="ncDry">Dry</button></div><div id="ncWakeEvent"></div>';
    const run = function (answers) {
      const st = loadState() || {};
      const ev = drawWake(st.profile || profile(), answers);
      const el = document.getElementById('ncWakeEvent');
      if (!ev) { if (el) el.textContent = 'No matching night event for this profile.'; return; }
      if (el) el.textContent = ev.label + ' — ' + ev.desc;
      try { if (typeof startVoidGuide === 'function') startVoidGuide(ev.guide, ev.desc, ev.kind === 'full' ? 'full' : 'micro', null, true); } catch (e) {}
      try { if (typeof logToOutput === 'function') logToOutput('🌙 Wake: ' + ev.label); } catch (e) {}
    };
    document.getElementById('ncUrge').onclick = function () { run({ urge: true, wet: false }); };
    document.getElementById('ncWet').onclick = function () { run({ urge: false, wet: true }); };
    document.getElementById('ncDry').onclick = function () { run({ urge: false, wet: false }); };
  }
  function morningForm() {
    const box = document.getElementById('ncWakeBox'); if (!box) return;
    box.innerHTML = '<label class="urge-lbl">Wakes <input id="ncMWoke" type="number" min="0" value="0"></label><label class="urge-lbl">Wets <input id="ncMWet" type="number" min="0" value="0"></label><label class="urge-lbl">When <input id="ncMWhen" type="text" placeholder="early / through / morning"></label><label class="urge-lbl">Gear saturation <input id="ncMSat" type="number" min="0" max="100" value="0"></label><label class="urge-lbl">Feeling <input id="ncMFeel" type="text" placeholder="sleepy, fine, annoyed"></label><button type="button" id="ncMSave">Save morning</button>';
    document.getElementById('ncMSave').onclick = function () {
      const st = loadState() || {};
      const entry = {
        woke: +document.getElementById('ncMWoke').value || 0,
        wets: +document.getElementById('ncMWet').value || 0,
        when: document.getElementById('ncMWhen').value || '',
        sat: +document.getElementById('ncMSat').value || 0,
        feeling: document.getElementById('ncMFeel').value || '',
        clipWets: st.wets || [],
        gear: st.worn || (st.gear && st.gear.name)
      };
      try {
        if (window.BSCalendar && window.BSCalendar.addEntry) {
          window.BSCalendar.addEntry({ source: 'sim', mode: 'night_cond', type: entry.wets > 0 ? 'accident' : 'event', memo: 'Night conditioning morning', night: entry });
        }
      } catch (e) {}
      try { if (typeof logToOutput === 'function') logToOutput('🌅 Morning: ' + entry.wets + ' wet(s), woke ' + entry.woke + ', sat ' + entry.sat + '%.'); } catch (e) {}
      window._nightCondQuiet = false;
      window._condTrack = 'day';
      saveState(null);
      paint();
    };
  }
  function open() {
    const p = profile();
    if (!p) {
      try { if (typeof toast === 'function') toast('Save a conditioning profile first.'); } catch (e) {}
      return { ok: false, reason: 'profile' };
    }
    window._condTrack = 'night';
    window._nightCondQuiet = false;
    const clip = clipDefaults(p);
    const st = {
      phase: 'routine', i: 0, profile: p, steps: routine(p), gear: gearRec(p),
      optedIn: false, clipMode: 'off', clipSuggest: clip.suggested, wets: [], done: []
    };
    saveState(st);
    try { if (typeof switchTab === 'function') switchTab('session'); } catch (e) {}
    paint();
    return { ok: true };
  }
  function morningEntry(answers, st) {
    answers = answers || {};
    st = st || {};
    return {
      woke: +answers.woke || 0, wets: +answers.wets || 0, when: answers.when || '',
      sat: +answers.sat || 0, feeling: answers.feeling || '',
      clipWets: (st.wets || []).slice(), gear: st.worn || (st.gear && st.gear.name) || ''
    };
  }
  window.BSNightCond = {
    KEY, gearRec, routine, clipDefaults, clipReaction, wakeKind, drawWake, onClipWet, aboutNight, hasProfile, open, quietOn, loadState, morningEntry
  };
})();
