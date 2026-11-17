/* ===========================
   cond-events.js — v49 events that exist only for conditioning.
   Regular sim tables are not these. Each one is gated by the active
   profile's direction, methods, and consent. Weight grows with the gap
   between now and the goal, and with faster pacing. A real need always
   ends the event. Nothing here asks you to push or to hold until you can't.
   =========================== */
(function () {
  const REAL = ' A real need still means stop and go.';
  const EVENTS = [
    { id: 'c_spike', dir: 'A', track: 'day', label: 'Surprise urge', kind: 'urge',
      text: 'Surprise urge: the warning is shorter than usual. Stop if it gets strong.' + REAL,
      guide: [{ text: 'NOTICE THE SPIKE', time: 4, type: 'stop' }, { text: 'STOP IF IT GETS STRONG', time: 4, type: 'stop' }] },
    { id: 'c_noticed', dir: 'A', track: 'day', label: 'Just noticed', kind: 'awareness',
      text: 'Just noticed: you may already be a little wet. No pushing, and no catching up.' + REAL,
      guide: [{ text: 'CHECK', time: 3, type: 'stop' }, { text: 'NO PUSH', time: 4, type: 'relax' }] },
    { id: 'c_relax', dir: 'A', track: 'day', methods: ['relaxed'], label: 'Relax drill', kind: 'drill',
      text: 'Relax drill: soften and let it happen. No holding back and no pushing. This is not overflow and not stretching.' + REAL,
      guide: [{ text: 'BREATHE OUT', time: 4, type: 'relax' }, { text: 'LET THE MUSCLE DROP', time: 5, type: 'relax' }] },
    { id: 'c_partial', dir: 'A', track: 'day', label: 'Partial moment', kind: 'partial',
      text: 'A partial moment: let a little go into your gear. Finish on the toilet only if that reminder is on.' + REAL,
      guide: [{ text: 'LET A LITTLE GO', time: 5, type: 'relax' }, { text: 'THEN STOP', time: 3, type: 'stop' }] },
    { id: 'c_pass', dir: 'A', track: 'day', label: 'Pass request', kind: 'pass',
      text: 'Pass request: this one can be a no, or a compromise. It is not a guaranteed toilet trip.' + REAL,
      guide: [{ text: 'ASK', time: 3, type: 'stop' }, { text: 'TAKE THE ANSWER', time: 4, type: 'stop' }] },
    { id: 'c_sleep', dir: 'A', track: 'night', methods: ['stay_bed', 'deeper_sleep'], label: 'Sleep through it', kind: 'night',
      text: 'Sleep through it: DryClip stays quiet. If you wake, staying in bed is the practice.' + REAL,
      guide: [{ text: 'STAY QUIET', time: 4, type: 'stop' }, { text: 'SETTLE', time: 6, type: 'relax' }] },
    { id: 'c_wind', dir: 'A', track: 'night', methods: ['deeper_sleep'], label: 'Deeper-sleep wind-down', kind: 'night',
      text: 'Wind-down: same bedtime, dark room, no late screen. Sip earlier only if you are thirsty.' + REAL,
      guide: [{ text: 'LIGHTS DOWN', time: 4, type: 'stop' }, { text: 'SAME CUE', time: 4, type: 'stop' }] },
    { id: 'c_hold', dir: 'B', track: 'day', label: 'Hold a bit longer', kind: 'hold',
      text: 'Hold a bit longer: a short wait, then go. Stop if it gets strong. Not a maximum clench.' + REAL,
      guide: [{ text: 'GENTLE WAIT', time: 5, type: 'stop' }, { text: 'THEN GO', time: 3, type: 'relax' }] },
    { id: 'c_surf', dir: 'B', track: 'day', methods: ['urge_surf'], label: 'Urge surfing', kind: 'drill',
      text: 'Urge surfing: notice the wave, let the peak ease, then go. Stop if it gets strong.' + REAL,
      guide: [{ text: 'NOTICE', time: 4, type: 'stop' }, { text: 'LET THE PEAK EASE', time: 5, type: 'stop' }] },
    { id: 'c_void', dir: 'B', track: 'day', methods: ['timed_void'], label: 'Scheduled void', kind: 'void',
      text: 'Scheduled void: go at the planned time, even if the urge is small.' + REAL,
      guide: [{ text: 'GO NOW', time: 4, type: 'relax' }, { text: 'EMPTY', time: 4, type: 'relax' }] },
    { id: 'c_kegel', dir: 'B', track: 'both', methods: ['kegels'], label: 'Pelvic-floor set', kind: 'drill',
      text: 'Pelvic-floor set: a gentle 3–5 second squeeze, then a full relax. Not a max clench.' + REAL,
      guide: [{ text: 'GENTLE SQUEEZE', time: 4, type: 'stop' }, { text: 'FULL RELAX', time: 4, type: 'relax' }] },
    { id: 'c_wake', dir: 'B', track: 'night', label: 'Wake on urge', kind: 'night',
      text: 'Wake on urge: if you stir, get up and finish in the toilet.' + REAL,
      guide: [{ text: 'WAKE', time: 3, type: 'stop' }, { text: 'GET UP', time: 4, type: 'stop' }] }
  ];
  function profileOf(opts) {
    opts = opts || {};
    if (opts.profile) return opts.profile;
    try { return window.BSOnboard && window.BSOnboard.load && window.BSOnboard.load().profile; } catch (e) { return null; }
  }
  function consented(opts) {
    if (opts && opts.ignoreConsent) return true;
    try { return !!(window.BSConsent && window.BSConsent.on && window.BSConsent.on()); } catch (e) { return false; }
  }
  function gapOf(profile, track) {
    const start = profile.starting && profile.starting[track];
    const target = profile.target && profile.target[track];
    if (start == null || target == null) return 0;
    return Math.abs(target - start);
  }
  function weight(ev, profile, track) {
    const t = track || (ev.track === 'night' ? 'night' : 'day');
    const gap = gapOf(profile || {}, t);
    const pace = profile && profile.pacing && profile.pacing[t];
    let w = 1 + gap / 40;
    if (pace === 'instant' || pace === 'hybrid') w *= 1.4;
    else if (pace === 'slow') w *= 0.45;
    else w *= 0.8;
    return Math.round(w * 100) / 100;
  }
  function hasMethod(profile, ids) {
    if (!ids || !ids.length) return true;
    const methods = profile.methods || {};
    const all = (methods.day || []).concat(methods.night || []);
    return ids.some(id => all.indexOf(id) >= 0);
  }
  function eligible(profile, opts) {
    opts = opts || {};
    profile = profile || profileOf(opts);
    if (!profile || !consented(opts)) return [];
    const track = opts.track === 'night' ? 'night' : (opts.track === 'day' ? 'day' : null);
    return EVENTS.filter(ev => {
      const dir = track ? (profile.direction && profile.direction[track]) : null;
      const dirs = track ? [dir] : [profile.direction && profile.direction.day, profile.direction && profile.direction.night];
      if (dirs.indexOf(ev.dir) < 0) return false;
      if (track && ev.track !== 'both' && ev.track !== track) return false;
      if (!track && ev.track === 'night' && (profile.direction && profile.direction.night) !== ev.dir) return false;
      if (!track && ev.track === 'day' && (profile.direction && profile.direction.day) !== ev.dir) return false;
      return hasMethod(profile, ev.methods);
    });
  }
  function pick(opts) {
    opts = opts || {};
    const profile = profileOf(opts);
    const list = eligible(profile, opts);
    if (!list.length) return null;
    const track = opts.track === 'night' ? 'night' : 'day';
    const weights = list.map(ev => weight(ev, profile, ev.track === 'night' ? 'night' : track));
    const tot = weights.reduce((a, b) => a + b, 0) || 1;
    const rng = opts.rng || Math.random;
    let r = rng() * tot;
    let chosen = list[0];
    for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r < 0) { chosen = list[i]; break; } }
    const w = weight(chosen, profile, chosen.track === 'night' ? 'night' : track);
    const out = { id: chosen.id, label: chosen.label, text: chosen.text, kind: chosen.kind, dir: chosen.dir, track: chosen.track, weight: w, group: 'Conditioning' };
    if (opts.log !== false) log(out);
    return out;
  }
  function log(ev) {
    try {
      if (!window.BSOnboard || !window.BSOnboard.load || !window.BSOnboard.save) return;
      const s = window.BSOnboard.load();
      s.eventLog = Array.isArray(s.eventLog) ? s.eventLog : [];
      s.eventLog.push({ ts: Date.now(), id: ev.id, label: ev.label, weight: ev.weight, track: ev.track });
      if (s.eventLog.length > 200) s.eventLog.splice(0, s.eventLog.length - 200);
      window.BSOnboard.save(s);
    } catch (e) {}
  }
  function catalog() {
    return EVENTS.map(ev => ({
      id: ev.id,
      profile: 'conditioning',
      type: 'micro',
      source: 'Conditioning',
      group: 'Conditioning',
      label: ev.label,
      flow: ev.text,
      guide: ev.guide,
      dir: ev.dir,
      track: ev.track
    }));
  }
  window.BSCondEvents = { EVENTS, REAL, weight, eligible, pick, catalog, gapOf };
})();
