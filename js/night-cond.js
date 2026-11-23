/* ===========================
   night-cond.js — bedtime routine, then a Natural Night with a conditioning layer.
   v60: night conditioning has no event timer. After the routine it hands off to
   BSNight (natural-night.js): silent screen, wake and morning flow, DryClip
   morning check-in. Events only come from "I woke up", "I need to pee", or the
   opt-in DryClip sleep mode. The only scheduled notifications are DryClip (when
   opted in) and the morning check-in at the routine's wake time.
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
      { id: 'wake', title: 'Wake time', skip: true, text: 'Set the time morning starts. Until then there is no event timer, no sip prompts and no day events. The only reminder is the morning check-in at this time.' },
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
  const MORNING_ID = 1962;
  const ROUTINE_STALE_MS = 12 * 3600e3, WAKE_STALE_MS = 3 * 3600e3;
  function log(html) { try { if (typeof logToOutput === 'function') logToOutput(html); } catch (e) {} }
  function night() { try { return window.BSNight && window.BSNight.get ? window.BSNight.get() : null; } catch (e) { return null; } }
  /** The running Natural Night, when it carries the conditioning layer. */
  function nightCond() { const st = night(); return st && st.cond ? st : null; }
  function routineOpen() { const r = loadState(); return !!(r && r.phase === 'routine'); }
  /** v60: quiet only while the night is actually on: from the first routine step until the wake time.
      It ends at the wake time, when a day session starts, or when the night is closed. Nothing is
      stored as a loose flag, so nothing can stay muted into the day. */
  function quietNow(now) {
    now = now || Date.now();
    const r = loadState();
    if (r && r.phase === 'routine') return !(r.startedAt && now - r.startedAt > ROUTINE_STALE_MS);
    const st = nightCond();
    if (!st || st.phase === 'morning' || st.silenceOff) return false;
    return !(st.cond.wakeAt && now >= st.cond.wakeAt);
  }
  function active(now) { return quietNow(now); }
  // The engine and UI read these two names. They are derived from the saved night, never a stuck flag.
  let trackStore = 'day';
  try {
    Object.defineProperty(window, '_nightCondQuiet', { configurable: true, get: function () { return quietNow(); }, set: function () {} });
    Object.defineProperty(window, '_condTrack', { configurable: true, get: function () { return quietNow() ? 'night' : (trackStore === 'night' ? 'day' : trackStore); }, set: function (v) { trackStore = v === 'night' ? 'night' : 'day'; } });
  } catch (e) {}
  function condUpdate(fn) {
    if (window.BSNight && window.BSNight.condUpdate) return window.BSNight.condUpdate(fn);
    return null;
  }
  /** Stop every timer a day session could own. Night conditioning never has one. */
  function silence() {
    try { if (typeof sessionRunning !== 'undefined' && sessionRunning && typeof stopAll === 'function') stopAll(); } catch (e) {}
    try { if (typeof mainTimer !== 'undefined') clearTimeout(mainTimer); } catch (e) {}
    try { if (typeof preChimeTimer !== 'undefined') clearTimeout(preChimeTimer); } catch (e) {}
    try { if (typeof microTimer !== 'undefined') clearTimeout(microTimer); } catch (e) {}
    try { if (typeof hydrationTimer !== 'undefined') { clearTimeout(hydrationTimer); hydrationTimer = null; } } catch (e) {}
    try { if (typeof mainEndAt !== 'undefined') mainEndAt = null; } catch (e) {}
    try { if (typeof microEndAt !== 'undefined') microEndAt = null; } catch (e) {}
    try { if (typeof hydrationEndAt !== 'undefined') hydrationEndAt = null; } catch (e) {}
    try { if (typeof pendingMainEvent !== 'undefined') pendingMainEvent = null; } catch (e) {}
    try { if (typeof clearAllBabysitterTimers === 'function') clearAllBabysitterTimers(); } catch (e) {}
    try { if (typeof stopChime === 'function') stopChime(); } catch (e) {}
    try { const m = document.getElementById('profileSetupModal'); if (m && m.remove) m.remove(); } catch (e) {}
    // A day banner (sip, spasm) or day guide left on screen does not follow you to bed.
    try { const b = document.getElementById('alarmBanner'); if (b && b.style) b.style.display = 'none'; } catch (e) {}
    try { const v = document.getElementById('voidOverlay'); if (v && v.style && v.style.display === 'flex') v.style.display = 'none'; } catch (e) {}
    try { if (window.BSEventQueue && window.BSEventQueue.clear) window.BSEventQueue.clear(); } catch (e) {}
    try { if (typeof window.saveState === 'function') window.saveState(); } catch (e) {}
    try { if (typeof setCountdownLabel === 'function') setCountdownLabel(); } catch (e) {}
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
  }
  // v59 name kept for older callers.
  function quietOn() { silence(); }
  function wakeTs(hhmm, now) {
    now = now || Date.now();
    const m = /^(\d\d?):(\d\d)$/.exec(hhmm || '');
    const d = new Date(now);
    d.setHours(m ? +m[1] : 7, m ? +m[2] : 0, 0, 0);
    let t = d.getTime();
    if (t <= now + 60000) t += 864e5;
    return t;
  }
  function protFor(worn) {
    const w = String(worn || '').toLowerCase();
    if (/thick/.test(w)) return 'thick_diapers';
    if (/booster|diaper/.test(w)) return 'diapers';
    if (/pull/.test(w)) return 'pullups';
    if (/pad|training/.test(w)) return 'pad';
    return 'none';
  }
  function clipPaired() {
    try { if (window.BSDryClip && window.BSDryClip.deviceId) return true; } catch (e) {}
    try { const d = JSON.parse(localStorage.getItem('bs_dryclip_v1') || 'null'); return !!(d && d.lastId); } catch (e) { return false; }
  }
  /** The morning check-in reminder (shared with Natural Night). DryClip owns it when the clip is armed. */
  function pendingAlarm(now) {
    try { return window.BSNight && window.BSNight.pendingAlarm ? window.BSNight.pendingAlarm(now) : null; } catch (e) { return null; }
  }
  function recordEvent(ev, source) {
    if (!ev) return;
    condUpdate(function (c, st) {
      c.events = c.events || [];
      c.events.push({ ts: Date.now(), id: ev.id, label: ev.label, kind: ev.nightKind || ev.kind, size: ev.size, source: source });
      st.timeline.push({ k: 'cond', ts: Date.now(), label: ev.label, source: source });
    });
  }
  /** Run a drawn event's guide through the v54 queue (one item at a time). */
  function runGuide(ev) {
    if (!ev || !ev.guide || !ev.guide.length) return false;
    try {
      const q = window.BSEventQueue;
      const g = document.getElementById('voidOverlay'), b = document.getElementById('alarmBanner');
      const open = el => !!(el && (el.style.display === 'flex' || el.style.display === 'block'));
      if (q && q.current && q.current() && !open(g) && !open(b) && q.clear) q.clear();
    } catch (e) {}
    try { if (typeof startVoidGuide === 'function') { startVoidGuide(ev.guide, ev.desc || ev.label, ev.size === 'full' || ev.kind === 'full' ? 'full' : 'micro'); return true; } } catch (e) {}
    return false;
  }
  /** "I woke up": urge / already wet / dry → one night-deck event. */
  function wakeEvent(answers, opts) {
    opts = opts || {};
    const st = nightCond();
    const p = (st && st.cond.profile) || profile();
    const ev = drawWake(p, answers, opts);
    if (st) recordEvent(ev, 'wake:' + wakeKind(p, answers));
    log(ev ? '🌙 Wake: ' + ev.label : '🌙 Wake: no matching night event for this profile.');
    if (ev && !opts.noGuide) runGuide(ev);
    return ev;
  }
  /** "I need to pee" during the night: a potty pass or a night-deck event. Never the day deck. */
  function peeRoll(opts) {
    opts = opts || {};
    const st = nightCond();
    const p = (st && st.cond.profile) || profile() || {};
    const rng = opts.rng || Math.random;
    let chance = 0.3;
    try { if (window.BSCondEvents && window.BSCondEvents.passChance) chance = window.BSCondEvents.passChance(p, { track: 'night' }); } catch (e) {}
    if (rng() < chance) return { kind: 'pass', chance: chance };
    const ev = drawWake(p, { urge: true }, { rng: opts.rng });
    if (!ev) return { kind: 'pass', chance: chance };
    return { kind: 'event', chance: chance, event: ev };
  }
  function needToPee(opts) {
    opts = opts || {};
    const roll = peeRoll(opts);
    const st = nightCond();
    if (roll.kind === 'pass') {
      if (st && window.BSNight && window.BSNight.condUpdate) {
        window.BSNight.condUpdate(function (c, s) {
          s.awake = true;
          s.pendingRoll = { sips: 0, ts: Date.now(), pass: true };
          s.timeline.push({ k: 'roll', ts: Date.now(), outcome: 'cond_pass', chance: Math.round(roll.chance * 100) });
        });
      }
      log('🚽 <b>I need to pee</b> (night) — potty pass. You can go.');
    } else {
      if (st) recordEvent(roll.event, 'pee');
      log('🚽 <b>I need to pee</b> (night) — ' + (roll.event.label || 'event') + '.');
      if (!opts.noGuide) runGuide(roll.event);
    }
    try { if (!opts.noRender && window.BSNight && window.BSNight.open && st) window.BSNight.open(); } catch (e) {}
    return roll;
  }
  function onClipWet(info) {
    info = info || {};
    const st = nightCond();
    if (!st || st.phase !== 'night' || !st.cond.optedIn) return { handled: false, alert: false, reason: 'inactive' };
    const plan = clipReaction({ optedIn: true, mode: st.cond.clipMode || 'quiet', direction: st.cond.dir || nightDir(st.cond.profile), wetAt: info.wetAt });
    condUpdate(function (c, s) {
      c.clipWets = c.clipWets || [];
      c.clipWets.push({ at: plan.wetAt || Date.now(), mode: c.clipMode });
      s.timeline.push({ k: 'clip', ts: plan.wetAt || Date.now(), mode: c.clipMode });
    });
    if (plan.alert && plan.guide) {
      if (plan.alert === 'full') { try { if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 600]); } catch (e) {} }
      runGuide({ guide: plan.guide, desc: '📎 <b>DryClip</b> — ' + plan.text, label: 'DryClip', kind: 'micro' });
    }
    try { if (window.BSNight && window.BSNight.refresh) window.BSNight.refresh(); } catch (e) {}
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
    const less = nightDir(p) !== 'B';
    return 'At night you are ' + gear.levelName + '. Recommended night gear: ' + gear.name + '. ' + gear.why
      + ' Night conditioning runs like a Natural Night: after the bedtime routine there is no event timer, no countdown, no sip prompts and no alarms. Nothing happens unless you tap I woke up or I need to pee, '
      + (less ? 'and waking usually means staying in bed. ' : 'and waking with an urge means getting up. ')
      + 'Night events available: ' + total + ' (' + micro + ' micro, ' + macro + ' macro, ' + dry + ' no-wet). '
      + 'The only reminder is the morning check-in at your wake time. DryClip sleep mode is off until you opt in' + (clip.suggested ? '; if you turn it on, the quiz points at ' + clip.suggested : '') + '.';
  }
  function paint() {
    const host = document.getElementById('nightCondMount');
    if (!host) return;
    const st = loadState();
    if (!st || st.phase !== 'routine') { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    const step = st.steps[st.i] || st.steps[st.steps.length - 1];
    host.innerHTML = '<div class="night-step"><b>Night conditioning</b><div class="cal-legend">Step ' + (st.i + 1) + ' of ' + st.steps.length + ' · no event timer tonight</div><h2>' + step.title + '</h2><p>' + step.text + '</p>'
      + (st.notifWarn ? '<p class="nc-warn" role="alert">⚠️ ' + st.notifWarn + '</p>' : '')
      + (step.id === 'clip' ? '<label class="urge-lbl"><input type="checkbox" id="ncClip"> Opt in to DryClip</label><label class="urge-lbl">Mode <select id="ncClipMode"><option value="quiet">Quiet</option><option value="gentle">Gentle</option><option value="alarm">Alarm</option></select></label>' : '')
      + (step.id === 'wake' ? '<label class="urge-lbl">Wake <input id="ncWake" type="time" value="' + (st.wakeAt || '07:00') + '"></label>' : '')
      + (step.id === 'check' ? '<label class="urge-lbl">Wearing <select id="ncGear"><option>thick diaper</option><option>diaper</option><option>pull-up</option><option>pad</option><option>underwear</option></select></label>' : '')
      + '<div class="night-actions">' + (step.skip ? '<button type="button" id="ncSkip">Skip</button>' : '') + '<button type="button" id="ncNext">Done</button><button type="button" id="ncCancel" class="nn-ghost">Cancel</button></div></div>';
    const next = document.getElementById('ncNext');
    const skip = document.getElementById('ncSkip');
    const cancel = document.getElementById('ncCancel');
    if (next) next.onclick = function () { advance(false); };
    if (skip) skip.onclick = function () { advance(true); };
    if (cancel) cancel.onclick = function () { cancelRoutine(); };
    const mode = document.getElementById('ncClipMode');
    if (mode) mode.value = st.clipSuggest || 'quiet';
    const gearSel = document.getElementById('ncGear');
    if (gearSel && st.gear && st.gear.name) {
      const map = { thick_diapers: 'thick diaper', diapers: 'diaper', pullups: 'pull-up', pad: 'pad', none: 'underwear' };
      gearSel.value = map[protFor(st.gear.name)] || 'diaper';
    }
  }
  /** v60: ask for notification (and exact alarm) permission so the morning check-in rings with the app closed. */
  function prepareNotifications() {
    try {
      if (!window.BSNativeAlarm || !window.BSNativeAlarm.prepareMorning) return;
      window.BSNativeAlarm.prepareMorning().then(function (r) {
        const cur = loadState();
        if (cur) { cur.notifWarn = r && r.warning ? r.warning : ''; saveState(cur); paint(); }
        if (r && r.warning) { log('⚠️ ' + r.warning); try { if (typeof toast === 'function') toast(r.warning); } catch (e) {} }
      }).catch(function () {});
    } catch (e) {}
  }
  function cancelRoutine() {
    saveState(null);
    window._condTrack = 'day';
    try { if (typeof setCountdownLabel === 'function') setCountdownLabel(); } catch (e) {}
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    paint();
    log('🌙 Night conditioning cancelled before bed.');
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
      log('🌙 Night gear: ' + st.worn);
    }
    if (step && step.id === 'wake') {
      const t = document.getElementById('ncWake');
      st.wakeAt = t && t.value ? t.value : '07:00';
      prepareNotifications();
    }
    if (step && step.id === 'clip') {
      const box = document.getElementById('ncClip');
      const mode = document.getElementById('ncClipMode');
      st.optedIn = !skipped && !!(box && box.checked);
      st.clipMode = st.optedIn ? (mode ? mode.value : 'quiet') : 'off';
    }
    st.done = st.done || [];
    st.done.push({ id: step && step.id, skipped: !!skipped });
    st.i += 1;
    if (st.i >= st.steps.length) { finishRoutine(st); return; }
    saveState(st);
    paint();
  }
  /** End of the routine: hand off to Natural Night with the conditioning layer. */
  function finishRoutine(st, now) {
    now = now || Date.now();
    const done = st.done || [];
    const did = id => done.some(d => d.id === id && !d.skipped);
    const wake = st.wakeAt || '07:00';
    const worn = st.worn || (st.gear && st.gear.name) || '';
    const cond = {
      v: 60, profile: st.profile, dir: nightDir(st.profile), optedIn: !!st.optedIn, clipMode: st.optedIn ? (st.clipMode || 'quiet') : 'off',
      clipSuggest: st.clipSuggest, wake: wake, wakeAt: wakeTs(wake, now), worn: worn, gear: st.gear && st.gear.name,
      routine: done, events: [], clipWets: []
    };
    saveState(null);
    if (window.BSNight && window.BSNight.begin) {
      window.BSNight.begin({
        bedtime: now,
        drinks: did('drinks') ? [{ ts: now, ml: 30 }] : [],
        lastPeeAt: did('potty') ? now : null,
        protection: protFor(worn),
        memo: 'Night conditioning',
        cond: cond
      });
    }
    silence();
    log('🌙 <b>Night conditioning</b> runs like a Natural Night now: no event timer, no sips, no alarms. Tap I woke up or I need to pee if you need to. Morning check-in at ' + wake + '.');
    if (cond.optedIn) offerClip(cond);
    paint();
    try { if (window.BSNight && window.BSNight.open) window.BSNight.open(); } catch (e) {}
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    return cond;
  }
  function offerClip(cond) {
    if (clipPaired() && window.BSDryClip && window.BSDryClip.startNight) {
      const m = /^(\d\d?):(\d\d)$/.exec(cond.wake || '07:00');
      try { if (window.BSDryClip.deviceId && window.BSDryClip.arm) window.BSDryClip.arm(); } catch (e) {}
      try { window.BSDryClip.startNight({ wakeHour: m ? +m[1] : 7, wakeMin: m ? +m[2] : 0, wakeAt: cond.wakeAt }); } catch (e) {}
      log('📎 DryClip sleep mode: ' + cond.clipMode + '. It is the only thing that can react overnight.');
      return true;
    }
    log('📎 DryClip is not paired. Open Settings → DryClip when you want to arm it.');
    return false;
  }
  function open(opts) {
    opts = opts || {};
    const p = profile();
    if (!p) {
      try { if (typeof toast === 'function') toast('Save a conditioning profile first.'); } catch (e) {}
      return { ok: false, reason: 'profile' };
    }
    if (nightCond()) {
      silence();
      try { window.BSNight.open(); } catch (e) {}
      return { ok: true, resumed: 'night' };
    }
    if (night()) {
      try { window.BSNight.open(); } catch (e) {}
      return { ok: false, reason: 'natural_night' };
    }
    silence();
    try { if (typeof switchTab === 'function') switchTab('session'); } catch (e) {}
    if (routineOpen() && !opts.fresh) { paint(); return { ok: true, resumed: 'routine' }; }
    const clip = clipDefaults(p);
    const st = {
      phase: 'routine', startedAt: Date.now(), i: 0, profile: p, steps: routine(p), gear: gearRec(p),
      optedIn: false, clipMode: 'off', clipSuggest: clip.suggested, wets: [], done: []
    };
    saveState(st);
    try { if (typeof setCountdownLabel === 'function') setCountdownLabel(); } catch (e) {}
    paint();
    return { ok: true };
  }
  function morningEntry(answers, st) {
    answers = answers || {};
    st = st || {};
    const c = st.cond || st;
    return {
      woke: +answers.woke || 0, wets: +answers.wets || 0, when: answers.when || '',
      sat: +answers.sat || 0, feeling: answers.feeling || '',
      clipWets: (c.clipWets || c.wets || []).slice(), events: (c.events || []).map(e => e.label),
      clipMode: c.clipMode || 'off', gear: c.worn || (c.gear && c.gear.name) || c.gear || ''
    };
  }
  /** Called by BSNight.finish when the morning check-in of a conditioning night is saved. */
  function onMorning(st, m) {
    window._condTrack = 'day';
    try { if (typeof setCountdownLabel === 'function') setTimeout(setCountdownLabel, 0); } catch (e) {}
    try { if (st && st.cond && st.cond.optedIn && window.BSDryClip && window.BSDryClip.stopNight) window.BSDryClip.stopNight({ skipCheckIn: false }); } catch (e) {}
    return morningEntry({ woke: st && st.wakes, wets: m && m.wets, when: m && m.when, sat: m && m.sat, feeling: m && m.feeling }, st);
  }
  /** v60 self-heal: drop leftovers that could mute the day. Returns what it cleared. */
  function heal(now) {
    now = now || Date.now();
    const out = [];
    const r = loadState();
    if (r && r.phase !== 'routine') { saveState(null); out.push('v59-quiet-state'); }   // v59 kept a 'quiet' phase here forever
    else if (r && r.phase === 'routine' && (!r.startedAt || now - r.startedAt > ROUTINE_STALE_MS)) { saveState(null); out.push('stale-routine'); }
    const st = nightCond();
    if (st && st.cond.wakeAt && now > st.cond.wakeAt + WAKE_STALE_MS && window.BSNight && window.BSNight.finish) {
      try {
        window.BSNight.finish({ wakeAt: Math.min(now, st.cond.wakeAt), wet: (st.cond.clipWets || []).length > 0, sat: 0, rem: 'unsure', urg: 0,
          memo: 'Closed automatically: the morning check-in was not saved within 3 hours of the wake time.' });
        out.push('stale-night');
      } catch (e) {}
    }
    if (out.length) {
      trackStore = 'day';
      log('🌙 Cleared leftover night quiet (' + out.join(', ') + '). Day notifications are back on.');
      try { if (typeof setCountdownLabel === 'function') setCountdownLabel(); } catch (e) {}
      try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    }
    return out;
  }
  /** On app start: heal stale state; a night that is really still on silences the day timer again. */
  function restore() {
    heal();
    if (!quietNow()) { paint(); return false; }
    silence();
    paint();
    return true;
  }
  /** v60: any day session start ends the night's quiet right away. The night stays in Nights for its check-in. */
  function dayStart(reason) {
    let changed = false;
    const r = loadState();
    if (r) { saveState(null); changed = true; }
    try { if (window.BSNight && window.BSNight.endSilence && window.BSNight.endSilence(reason || 'day session started')) changed = true; } catch (e) {}
    trackStore = 'day';
    paint();
    try { if (typeof setCountdownLabel === 'function') setCountdownLabel(); } catch (e) {}
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    return changed;
  }
  try {
    window.addEventListener('load', function () { setTimeout(restore, 50); });
  } catch (e) {}
  window.BSNightCond = {
    KEY, MORNING_ID, gearRec, routine, clipDefaults, clipReaction, wakeKind, drawWake, onClipWet, aboutNight, hasProfile, open, quietOn, silence,
    loadState, morningEntry, active, quietNow, heal, dayStart, nightCond, pendingAlarm, wakeEvent, peeRoll, needToPee, finishRoutine, wakeTs, protFor, onMorning, restore, paint
  };
})();
