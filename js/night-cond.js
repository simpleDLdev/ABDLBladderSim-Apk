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
      { id: 'wake', title: 'Wake time', skip: true, text: 'Set the time morning starts. That is the morning check-in. Until then there is no event timer, no countdown, and no sip prompts.' },
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
    return 'At night you are ' + gear.levelName + '. Recommended night gear: ' + gear.name + '. ' + gear.why + ' Night events available: ' + total + ' (' + micro + ' micro, ' + macro + ' macro, ' + dry + ' no-wet). After the bedtime routine the night is silent, like a natural night: no event timer, no countdown, no sip prompts, and no tank time. A night event shows only if you tap I woke up or I need to pee, or if an opted-in DryClip gets wet. The morning check-in is at the wake time you set. DryClip sleep mode is off until you opt in' + (clip.suggested ? '; if you turn it on, the quiz points at ' + clip.suggested : '') + '.';
  }
  const MORNING_ID = 1961;
  function wakeTimestamp(hhmm, now) {
    now = now || Date.now();
    if (!/^\d\d:\d\d$/.test(hhmm || '')) return null;
    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setHours(+hhmm.slice(0, 2), +hhmm.slice(3), 0, 0);
    let t = d.getTime();
    if (t < now - 60000) t += 86400000;
    return t;
  }
  function noTimer() {
    if (window._nightCondQuiet) return true;
    const st = loadState();
    return !!(st && (st.phase === 'quiet' || st.phase === 'routine'));
  }
  function isQuiet() {
    const st = loadState();
    return !!(window._nightCondQuiet && st && st.phase === 'quiet') || !!(st && st.phase === 'quiet');
  }
  function clipOptedIn() {
    const st = loadState();
    return !!(st && st.phase === 'quiet' && st.optedIn && st.clipMode && st.clipMode !== 'off');
  }
  function pendingMorning(now) {
    const st = loadState();
    if (!st || st.phase !== 'quiet') return null;
    now = now || Date.now();
    const at = st.wakeTs || wakeTimestamp(st.wakeAt || '07:00', now);
    if (!at || at < now - 60000) return null;
    return { id: MORNING_ID, at: at, kind: 'reminder', title: 'Morning check-in', body: 'Night conditioning morning check-in. No event timer ran overnight.' };
  }
  function sessionPlan(opts) {
    opts = opts || {};
    const night = opts.track === 'night' || opts.quiet === true || opts.phase === 'quiet' || opts.phase === 'routine';
    if (!night) {
      return { timer: true, countdown: true, preroll: true, sips: true, eta: true, pending: 'event', notifications: ['main', 'micro', 'hydration'] };
    }
    const notes = [];
    if (opts.phase === 'quiet' || opts.quiet) {
      notes.push('morning');
      if (opts.optedIn) notes.push('dryclip');
    }
    return { timer: false, countdown: false, preroll: false, sips: false, eta: false, pending: null, notifications: notes };
  }
  function silenceClock() {
    window._condTrack = 'night';
    try { if (typeof clearNightClock === 'function') clearNightClock(); } catch (e) {}
    try {
      if (typeof sessionRunning !== 'undefined') sessionRunning = false;
      if (typeof mainEndAt !== 'undefined') mainEndAt = null;
      if (typeof microEndAt !== 'undefined') microEndAt = null;
      if (typeof hydrationEndAt !== 'undefined') hydrationEndAt = null;
      if (typeof pendingMainEvent !== 'undefined') pendingMainEvent = null;
      if (typeof pendingAmbientEvent !== 'undefined') pendingAmbientEvent = null;
    } catch (e) {}
  }
  function quietOn() {
    window._condTrack = 'night';
    window._nightCondQuiet = true;
    const st = loadState();
    if (st) {
      st.phase = 'quiet';
      st.bedtime = st.bedtime || Date.now();
      st.wakeAt = st.wakeAt || '07:00';
      if (!st.wakeTs) st.wakeTs = wakeTimestamp(st.wakeAt, Date.now());
      saveState(st);
    }
    silenceClock();
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
  }
  function drawPee(p, opts) {
    opts = opts || {};
    if (!window.BSCondEvents || !window.BSCondEvents.draw) return null;
    return window.BSCondEvents.draw({
      profile: p || profile(),
      track: 'night',
      tank: opts.tank || null,
      ignoreConsent: true,
      rng: opts.rng
    });
  }
  function fmtClock(ts) {
    try { return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  let clockTimer = null;
  function closeSilent() {
    const o = document.getElementById('ncNightOv');
    if (o) o.remove();
    try { clearInterval(clockTimer); } catch (e) {}
    clockTimer = null;
    if (document.body) document.body.classList.remove('nn-open');
  }
  function dismiss() {
    closeSilent();
    saveState(null);
    window._nightCondQuiet = false;
    window._condTrack = 'day';
    if (document.body) document.body.classList.remove('nc-quiet');
    const host = document.getElementById('nightCondMount');
    if (host) { host.hidden = true; host.innerHTML = ''; }
    try { if (typeof setCountdownLabel === 'function') setCountdownLabel(); } catch (e) {}
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
  }
  function paint() {
    const host = document.getElementById('nightCondMount');
    if (!host) return;
    const st = loadState();
    if (!st) { host.hidden = true; host.innerHTML = ''; closeSilent(); return; }
    host.hidden = false;
    if (st.phase === 'routine') {
      closeSilent();
      const step = st.steps[st.i] || st.steps[st.steps.length - 1];
      host.innerHTML = '<div class="night-step"><b>Night conditioning</b><div class="cal-legend">Step ' + (st.i + 1) + ' of ' + st.steps.length + '</div><h2>' + step.title + '</h2><p>' + step.text + '</p>'
        + (step.id === 'clip' ? '<label class="urge-lbl"><input type="checkbox" id="ncClip"> Opt in to DryClip</label><label class="urge-lbl">Mode <select id="ncClipMode"><option value="quiet">Quiet</option><option value="gentle">Gentle</option><option value="alarm">Alarm</option></select></label>' : '')
        + (step.id === 'wake' ? '<label class="urge-lbl">Wake <input id="ncWake" type="time" value="' + (st.wakeAt || '07:00') + '"></label>' : '')
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
    host.innerHTML = '<div class="night-step"><b>Silent night</b><p>No event timer, no countdown, no sip prompts. DryClip is ' + (st.optedIn ? st.clipMode : 'off') + '. Clip wets logged: ' + wets + '.</p>'
      + '<div class="night-actions"><button type="button" id="ncOpenSilent">Open silent night</button></div></div>';
    const reopen = document.getElementById('ncOpenSilent');
    if (reopen) reopen.onclick = function () { renderSilent(); };
    renderSilent();
  }
  function renderSilent() {
    const st = loadState();
    if (!st || st.phase !== 'quiet') return;
    if (document.body) {
      document.body.classList.add('nn-open');
      document.body.classList.add('nc-quiet');
    }
    let o = document.getElementById('ncNightOv');
    if (!o) {
      o = document.createElement('div');
      o.id = 'ncNightOv';
      o.className = 'nn-ov';
      o.setAttribute('role', 'dialog');
      document.body.appendChild(o);
    }
    const since = Math.max(0, Math.round((Date.now() - (st.bedtime || Date.now())) / 60000));
    const hh = Math.floor(since / 60);
    const mm = String(since % 60).padStart(2, '0');
    o.innerHTML = '<div class="nn-night" id="ncSilent">'
      + '<div class="nn-clock" id="ncClock">' + fmtClock(Date.now()) + '</div>'
      + '<div class="nn-muted">In bed since ' + fmtClock(st.bedtime || Date.now()) + ' · ' + hh + 'h ' + mm + 'm · wakes ' + (st.wakes || 0) + ' · silent · no timer</div>'
      + '<div class="nn-muted">DryClip is ' + (st.optedIn ? st.clipMode : 'off') + '. Nothing else is scheduled until the morning check-in.</div>'
      + '<div class="nn-body"><button type="button" id="ncWoke" class="nn-big">I woke up</button>'
      + '<button type="button" id="ncPee" class="nn-big">I need to pee</button>'
      + '<button type="button" id="ncMorning" class="nn-big nn-rise">Morning check-in</button></div>'
      + '<div id="ncWakeBox"></div>'
      + '<div class="nn-foot"><button type="button" id="ncMin" class="nn-btn nn-ghost">Minimise</button></div></div>';
    document.getElementById('ncWoke').onclick = wakeForm;
    document.getElementById('ncPee').onclick = function () { peeNow(); };
    document.getElementById('ncMorning').onclick = morningForm;
    document.getElementById('ncMin').onclick = function () {
      closeSilent();
    };
    try { clearInterval(clockTimer); } catch (e) {}
    clockTimer = setInterval(function () {
      const c = document.getElementById('ncClock');
      if (!c) { clearInterval(clockTimer); return; }
      c.textContent = fmtClock(Date.now());
    }, 15000);
    try { if (typeof setCountdownLabel === 'function') setCountdownLabel(); } catch (e) {}
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
      st.wakeAt = (t && t.value) ? t.value : '07:00';
      st.wakeTs = wakeTimestamp(st.wakeAt, Date.now());
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
      try { if (typeof logToOutput === 'function') logToOutput('🌙 Silent night. No event timer, no countdown, no sip prompts. Morning check-in is at ' + (st.wakeAt || '07:00') + '.'); } catch (e) {}
      if (st.optedIn) offerClip();
      paint();
      return;
    }
    saveState(st);
    paint();
  }
  function offerClip() {
    const st = loadState() || {};
    let paired = false;
    try { paired = window.BSDryClip && window.BSDryClip.deviceId; } catch (e) {}
    if (paired && window.BSDryClip.arm) {
      try { window.BSDryClip.arm(); } catch (e) {}
      try {
        if (window.BSDryClip.startNight) {
          const parts = String(st.wakeAt || '07:00').split(':');
          window.BSDryClip.startNight({ wakeHour: +parts[0] || 7, wakeMin: +parts[1] || 0, wakeAt: st.wakeTs });
        }
      } catch (e) {}
      try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
      return;
    }
    try { if (typeof logToOutput === 'function') logToOutput('📎 DryClip is not paired. Open Settings → DryClip when you want to arm it.'); } catch (e) {}
  }
  function showNightEvent(ev) {
    if (!ev) return null;
    try {
      if (typeof startVoidGuide === 'function') startVoidGuide(ev.guide, ev.desc || ev.label, ev.size === 'full' || ev.kind === 'full' ? 'full' : 'micro');
    } catch (e) {}
    return ev;
  }
  function peeNow(opts) {
    opts = opts || {};
    silenceClock();
    window._nightCondQuiet = true;
    const st = loadState() || {};
    const ev = opts.event || drawPee(st.profile || profile(), opts);
    const el = document.getElementById('ncWakeEvent');
    if (!ev) {
      if (el) el.textContent = 'No night event on this profile.';
      try { if (typeof logToOutput === 'function') logToOutput('🚽 <b>I need to pee</b> — no night event on this profile.'); } catch (e) {}
      return null;
    }
    const roll = { kind: 'event', event: ev, chance: 0 };
    if (window.BSPee && typeof document !== 'undefined') {
      try {
        window.BSPee.show(document, roll, {
          queue: window.BSEventQueue,
          startGuide: function (guide, text, kind) {
            if (typeof startVoidGuide === 'function') startVoidGuide(guide, text, kind === 'full' ? 'full' : 'micro');
          }
        });
      } catch (e) { showNightEvent(ev); }
    } else {
      showNightEvent(ev);
    }
    if (el) el.textContent = ev.label + ' — ' + ev.desc;
    try { if (typeof logToOutput === 'function') logToOutput('🚽 <b>I need to pee</b> — ' + (ev.label || 'night event') + '.'); } catch (e) {}
    return ev;
  }
  function offerClipWake() {
    try {
      if (window.BSDryClip && window.BSDryClip.openWakeCheckIn && window.BSCalendar && window.BSCalendar.unconfirmedClipCount) {
        const n = window.BSCalendar.unconfirmedClipCount();
        if (n > 0) window.BSDryClip.openWakeCheckIn({ from: 'night-cond' });
      }
    } catch (e) {}
  }
  function wakeForm() {
    silenceClock();
    window._nightCondQuiet = true;
    const st0 = loadState();
    if (st0) { st0.wakes = (st0.wakes || 0) + 1; saveState(st0); }
    offerClipWake();
    const box = document.getElementById('ncWakeBox'); if (!box) return;
    box.innerHTML = '<p>What woke you?</p><div class="nn-body"><button type="button" id="ncUrge" class="nn-big">I have an urge</button><button type="button" id="ncWet" class="nn-big">Already wet</button><button type="button" id="ncDry" class="nn-big">Dry</button></div><div id="ncWakeEvent" class="nn-muted"></div>';
    const run = function (answers) {
      const st = loadState() || {};
      const ev = drawWake(st.profile || profile(), answers);
      const el = document.getElementById('ncWakeEvent');
      if (!ev) { if (el) el.textContent = 'No matching night event for this profile.'; return null; }
      if (el) el.textContent = ev.label + ' — ' + ev.desc;
      showNightEvent(ev);
      try { if (typeof logToOutput === 'function') logToOutput('🌙 Wake: ' + ev.label); } catch (e) {}
      return ev;
    };
    document.getElementById('ncUrge').onclick = function () { run({ urge: true, wet: false }); };
    document.getElementById('ncWet').onclick = function () { run({ urge: false, wet: true }); };
    document.getElementById('ncDry').onclick = function () { run({ urge: false, wet: false }); };
  }
  function morningForm() {
    const box = document.getElementById('ncWakeBox'); if (!box) return;
    const st = loadState() || {};
    const clipBtn = st.optedIn ? '<button type="button" id="ncClipMorning" class="nn-big">DryClip morning check-in</button>' : '';
    box.innerHTML = '<div class="nn-body"><label class="nn-fld">Wakes <input id="ncMWoke" type="number" min="0" value="' + (st.wakes || 0) + '"></label><label class="nn-fld">Wets <input id="ncMWet" type="number" min="0" value="' + ((st.wets || []).length) + '"></label><label class="nn-fld">When <input id="ncMWhen" type="text" placeholder="early / through / morning"></label><label class="nn-fld">Gear saturation <input id="ncMSat" type="number" min="0" max="100" value="0"></label><label class="nn-fld">Feeling <input id="ncMFeel" type="text" placeholder="sleepy, fine, annoyed"></label>'
      + clipBtn + '<button type="button" id="ncMSave" class="nn-big nn-primary">Save morning</button></div>';
    const clip = document.getElementById('ncClipMorning');
    if (clip) clip.onclick = function () {
      try { if (window.BSDryClip && window.BSDryClip.openMorningCheckIn) window.BSDryClip.openMorningCheckIn(); } catch (e) {}
    };
    document.getElementById('ncMSave').onclick = function () {
      const cur = loadState() || {};
      const entry = morningEntry({
        woke: +document.getElementById('ncMWoke').value || 0,
        wets: +document.getElementById('ncMWet').value || 0,
        when: document.getElementById('ncMWhen').value || '',
        sat: +document.getElementById('ncMSat').value || 0,
        feeling: document.getElementById('ncMFeel').value || ''
      }, cur);
      try {
        if (window.BSCalendar && window.BSCalendar.addEntry) {
          window.BSCalendar.addEntry({ source: 'sim', mode: 'night_cond', type: entry.wets > 0 ? 'accident' : 'event', memo: 'Night conditioning morning', night: entry });
        }
      } catch (e) {}
      try { if (typeof logToOutput === 'function') logToOutput('🌅 Morning: ' + entry.wets + ' wet(s), woke ' + entry.woke + ', sat ' + entry.sat + '%.'); } catch (e) {}
      const opted = !!cur.optedIn;
      dismiss();
      if (opted) {
        try { if (window.BSDryClip && window.BSDryClip.openMorningCheckIn) window.BSDryClip.openMorningCheckIn(); } catch (e) {}
      }
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
      optedIn: false, clipMode: 'off', clipSuggest: clip.suggested, wets: [], wakes: 0, done: [],
      bedtime: Date.now()
    };
    saveState(st);
    try {
      if (typeof sessionRunning !== 'undefined' && sessionRunning && typeof stopAll === 'function') stopAll();
    } catch (e) {}
    silenceClock();
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
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
    KEY, MORNING_ID, gearRec, routine, clipDefaults, clipReaction, wakeKind, drawWake, drawPee, peeNow,
    onClipWet, aboutNight, hasProfile, open, quietOn, loadState, morningEntry, saveState,
    noTimer, isQuiet, clipOptedIn, pendingMorning, sessionPlan, silenceClock, dismiss, wakeTimestamp
  };
  if (window.addEventListener) window.addEventListener('load', function () {
    const st = loadState();
    if (!st || (st.phase !== 'quiet' && st.phase !== 'routine')) return;
    window._condTrack = 'night';
    if (st.phase === 'quiet') {
      window._nightCondQuiet = true;
      if (!st.wakeTs) {
        st.wakeAt = st.wakeAt || '07:00';
        st.wakeTs = wakeTimestamp(st.wakeAt, Date.now());
        st.bedtime = st.bedtime || Date.now();
        saveState(st);
      }
    }
    silenceClock();
    try { paint(); } catch (e) {}
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    if (st.phase === 'quiet' && st.wakeTs && Date.now() >= st.wakeTs) {
      try { morningForm(); } catch (e) {}
    }
  });
})();
