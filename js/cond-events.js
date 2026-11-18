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
      text: 'A partial moment: let a little go into your gear, then stay relaxed. Finish on the toilet only if you want to. A small reward you chose can follow.' + REAL,
      guide: [{ text: 'LET A LITTLE GO', time: 5, type: 'relax' }, { text: 'STAY RELAXED', time: 3, type: 'relax' }] },
    { id: 'c_cue', dir: 'both', track: 'day', label: 'Same cue', kind: 'routine',
      text: 'Same cue, same small step, then the reward you picked. The cue is the reminder. The step stays easy enough to repeat.' + REAL,
      guide: [{ text: 'NOTICE THE CUE', time: 3, type: 'stop' }, { text: 'DO THE SMALL STEP', time: 4, type: 'relax' }] },
    { id: 'c_pass', dir: 'A', track: 'day', label: 'Pass request', kind: 'pass',
      text: 'Pass request: this one can be a no, or a compromise. It is not a guaranteed toilet trip.' + REAL,
      guide: [{ text: 'ASK', time: 3, type: 'stop' }, { text: 'TAKE THE ANSWER', time: 4, type: 'stop' }] },
    { id: 'c_sleep', dir: 'A', track: 'night', methods: ['stay_bed', 'deeper_sleep'], label: 'Sleep through it', kind: 'night',
      text: 'Sleep through it: DryClip stays quiet. If you wake, staying in bed is the practice.' + REAL,
      guide: [{ text: 'STAY QUIET', time: 4, type: 'stop' }, { text: 'SETTLE', time: 6, type: 'relax' }] },
    { id: 'c_wind', dir: 'A', track: 'night', methods: ['deeper_sleep'], label: 'Deeper-sleep wind-down', kind: 'night',
      text: 'Wind-down: same bedtime, dark room, no late screen. Sip earlier only if you are thirsty.' + REAL,
      guide: [{ text: 'LIGHTS DOWN', time: 4, type: 'stop' }, { text: 'SAME CUE', time: 4, type: 'stop' }] },
    { id: 'c_hold', dir: 'B', track: 'day', optIn: ['hold_longer'], label: 'Hold a bit longer', kind: 'hold',
      text: 'Hold a bit longer: a short shaping wait, then go. Stop if it gets strong. Not a maximum clench. Untraining skips this unless you opted in.' + REAL,
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
  const META = {
    c_spike: { family: 'urge', size: 'small', goals: ['urgency'] },
    c_noticed: { family: 'unnoticed', size: 'tiny', goals: ['urgency', 'thin'] },
    c_relax: { family: 'letgo', size: 'small', goals: ['relaxed'] },
    c_partial: { family: 'seep', size: 'small', goals: ['urgency', 'relaxed'] },
    c_cue: { family: 'cue', size: 'tiny', goals: ['thin', 'relaxed'] },
    c_pass: { family: 'pass', size: 'none', goals: ['urgency'] },
    c_sleep: { family: 'night', size: 'full', goals: ['bedwetting', 'deeper'] },
    c_wind: { family: 'night', size: 'none', goals: ['deeper'] },
    c_hold: { family: 'hold', size: 'none', goals: ['control'] },
    c_surf: { family: 'hold', size: 'none', goals: ['control'] },
    c_void: { family: 'hold', size: 'full', goals: ['control'] },
    c_kegel: { family: 'hold', size: 'none', goals: ['control'] },
    c_wake: { family: 'night', size: 'none', goals: ['control'] }
  };
  EVENTS.forEach(ev => { if (META[ev.id]) Object.assign(ev, META[ev.id]); });
  const HABITS = [
    { id: 'h_sip', dir: 'A', track: 'day', family: 'cue', size: 'tiny', goals: ['urgency', 'thin', 'relaxed'], label: 'Sip dribble',
      text: 'On the next sip: a short dribble while you swallow. Leave it soft. Don\'t stop it.' + REAL,
      guide: [{ text: 'SIP', time: 2, type: 'relax' }, { text: 'SHORT DRIBBLE', time: 3, type: 'relax' }] },
    { id: 'h_stand', dir: 'A', track: 'day', family: 'position', size: 'tiny', goals: ['urgency', 'thin'], label: 'Stand-up spurt',
      text: 'Standing up: let a small spurt go as you rise. Stay soft on the way up.' + REAL,
      guide: [{ text: 'RISE', time: 2, type: 'relax' }, { text: 'SMALL SPURT', time: 3, type: 'relax' }] },
    { id: 'h_sit', dir: 'A', track: 'day', family: 'position', size: 'tiny', goals: ['relaxed', 'thin'], label: 'Sit-down seep',
      text: 'Sitting down: soften as you sit and let a little seep. No clench when you land.' + REAL,
      guide: [{ text: 'SIT', time: 2, type: 'relax' }, { text: 'SEEP', time: 3, type: 'relax' }] },
    { id: 'h_laugh', dir: 'A', track: 'day', family: 'cue', size: 'tiny', goals: ['thin', 'urgency'], label: 'Laugh leak',
      text: 'Next laugh, cough, or giggle: let the leak ride it. Don\'t catch it.' + REAL,
      guide: [{ text: 'LAUGH OR COUGH', time: 2, type: 'relax' }, { text: 'LET IT RIDE', time: 3, type: 'relax' }] },
    { id: 'h_focus', dir: 'A', track: 'day', family: 'cue', size: 'tiny', goals: ['thin', 'urgency'], label: 'Focus dribble',
      text: 'While you concentrate or play: a quiet dribble. Don\'t pause what you were doing.' + REAL,
      guide: [{ text: 'KEEP GOING', time: 3, type: 'relax' }, { text: 'QUIET DRIBBLE', time: 2, type: 'relax' }] },
    { id: 'h_dontstop', dir: 'A', track: 'day', family: 'letgo', size: 'small', goals: ['relaxed'], methods: ['relaxed'], label: 'Don\'t stop it',
      text: 'Don\'t stop it: once it starts, leave the muscle soft until this step ends. No holding back and no pushing.' + REAL,
      guide: [{ text: 'SOFTEN', time: 4, type: 'relax' }, { text: 'DON\'T STOP IT', time: 6, type: 'relax' }] },
    { id: 'h_first', dir: 'A', track: 'day', family: 'letgo', size: 'small', goals: ['urgency'], label: 'First urge',
      text: 'First urge: this is the moment. Let go as it starts. No clench, no waiting it out.' + REAL,
      guide: [{ text: 'FIRST URGE', time: 3, type: 'relax' }, { text: 'LET GO', time: 5, type: 'relax' }] },
    { id: 'h_fade', dir: 'A', track: 'day', family: 'fade', size: 'small', goals: ['urgency'], label: 'Signal fade',
      text: 'Signal fade: the warning gets thin. If you barely feel it, still let a little go.' + REAL,
      guide: [{ text: 'NOTICE IT THIN', time: 3, type: 'relax' }, { text: 'LET A LITTLE', time: 4, type: 'relax' }] },
    { id: 'h_auto', dir: 'A', track: 'day', family: 'unnoticed', size: 'tiny', goals: ['urgency', 'thin'], label: 'Autopilot check',
      text: 'Autopilot check: pause one breath and notice. You may already be damp. No catching up.' + REAL,
      guide: [{ text: 'CHECK', time: 3, type: 'stop' }, { text: 'NO CATCH-UP', time: 3, type: 'relax' }] },
    { id: 'h_quiet', dir: 'A', track: 'day', family: 'unnoticed', size: 'tiny', goals: ['urgency', 'thin', 'relaxed'], label: 'Unnoticed beat',
      text: 'Unnoticed beat: keep doing what you were doing. The release can be small and quiet.' + REAL,
      guide: [{ text: 'KEEP GOING', time: 3, type: 'relax' }, { text: 'QUIET RELEASE', time: 3, type: 'relax' }] },
    { id: 'h_seep', dir: 'A', track: 'day', family: 'seep', size: 'small', goals: ['relaxed', 'urgency'], label: 'Slow seep',
      text: 'Slow seep: a warm trickle for a few seconds. Stay relaxed the whole time. No push.' + REAL,
      guide: [{ text: 'SEEP', time: 6, type: 'relax' }] },
    { id: 'h_spurt', dir: 'A', track: 'day', family: 'spurt', size: 'tiny', goals: ['urgency', 'thin'], label: 'One spurt',
      text: 'One short spurt into your gear. Leave it. No clench after.' + REAL,
      guide: [{ text: 'SHORT SPURT', time: 3, type: 'relax' }] },
    { id: 'h_dribble', dir: 'A', track: 'day', family: 'dribble', size: 'tiny', goals: ['thin', 'urgency'], label: 'Short dribble',
      text: 'A few-second dribble into your gear. Soft belly, no push, no stop.' + REAL,
      guide: [{ text: 'DRIBBLE', time: 3, type: 'relax' }] },
    { id: 'h_drip2', dir: 'A', track: 'day', family: 'dribble', size: 'tiny', goals: ['thin', 'urgency'], label: 'Second dribble',
      text: 'Another short dribble while you stay on whatever you were doing. Still no clench.' + REAL,
      guide: [{ text: 'DRIBBLE', time: 2, type: 'relax' }] },
    { id: 'h_full', dir: 'A', track: 'day', family: 'full', size: 'full', goals: ['relaxed', 'urgency'], label: 'Full let-go',
      text: 'Full let-go: one relaxed release, about as long as your calibration. No push, and no clench after.' + REAL,
      guide: [{ text: 'LET GO', time: 14, type: 'relax' }] },
    { id: 'h_surprise', dir: 'A', track: 'day', family: 'full', size: 'full', goals: ['urgency'], label: 'Surprise let-go',
      text: 'Surprise full: little warning, then one let-go. Stop only if it becomes a real need.' + REAL,
      guide: [{ text: 'LET GO', time: 13, type: 'relax' }] },
    { id: 'h_reward', dir: 'both', track: 'day', family: 'reward', size: 'tiny', goals: ['urgency', 'relaxed', 'thin', 'control'], label: 'Reward',
      text: 'You followed the last cue. Name the reward you picked, then take it.' + REAL,
      guide: [{ text: 'NAME THE REWARD', time: 3, type: 'stop' }, { text: 'TAKE IT', time: 3, type: 'relax' }] },
    { id: 'h_streak', dir: 'A', track: 'day', family: 'letgo', size: 'small', goals: ['relaxed', 'urgency'], escalate: true, label: 'Streak step',
      text: 'Streak step: this release is a little longer than the last small one. Still relaxed, still no push.' + REAL,
      guide: [{ text: 'A LITTLE LONGER', time: 6, type: 'relax' }] },
    { id: 'h_thin', dir: 'A', track: 'day', family: 'dribble', size: 'tiny', goals: ['thin'], label: 'Thin gear',
      text: 'Thin protection: a short dribble is enough to notice the gear. Don\'t add a second push.' + REAL,
      guide: [{ text: 'SHORT DRIBBLE', time: 3, type: 'relax' }] },
    { id: 'h_bed', dir: 'A', track: 'night', family: 'night', size: 'full', goals: ['bedwetting'], methods: ['stay_bed'], label: 'Stay in bed',
      text: 'Bedwetting practice: if you wake wet, stay in bed and settle. No dash to the toilet.' + REAL,
      guide: [{ text: 'STAY IN BED', time: 5, type: 'relax' }, { text: 'SETTLE', time: 6, type: 'relax' }] },
    { id: 'h_sleep', dir: 'A', track: 'night', family: 'night', size: 'full', goals: ['bedwetting', 'deeper'], label: 'Sleep-through',
      text: 'Sleep-through release: you don\'t have to wake for this. If you do, stay lying down and let it finish.' + REAL,
      guide: [{ text: 'STAY LYING', time: 4, type: 'relax' }, { text: 'LET IT FINISH', time: 14, type: 'relax' }] },
    { id: 'h_deeper', dir: 'A', track: 'night', family: 'night', size: 'none', goals: ['deeper'], methods: ['deeper_sleep'], label: 'Deeper sleep',
      text: 'Deeper sleep: same bedtime, dark room, no extra alarm. The practice is staying asleep.' + REAL,
      guide: [{ text: 'DARK AND QUIET', time: 4, type: 'stop' }, { text: 'SAME BEDTIME', time: 4, type: 'relax' }] },
    { id: 'h_lying', dir: 'A', track: 'night', family: 'night', size: 'full', goals: ['relaxed', 'bedwetting'], methods: ['lying'], label: 'Lying release',
      text: 'Lying down: one relaxed release while you stay on your side or back.' + REAL,
      guide: [{ text: 'STAY DOWN', time: 4, type: 'relax' }, { text: 'LET GO', time: 12, type: 'relax' }] },
    { id: 'h_hold', dir: 'B', track: 'day', family: 'hold', size: 'none', goals: ['control'], methods: ['urge_surf'], label: 'Hold drill',
      text: 'Hold drill: notice the wave for a few seconds, then go. Not a max clench. Stop if it gets strong.' + REAL,
      guide: [{ text: 'NOTICE', time: 5, type: 'stop' }, { text: 'THEN GO', time: 4, type: 'relax' }] },
    { id: 'h_timed', dir: 'B', track: 'day', family: 'hold', size: 'full', goals: ['control'], methods: ['timed_void'], label: 'Scheduled void',
      text: 'Scheduled toilet: go now and empty. This is the plan, not a test of how long you can wait.' + REAL,
      guide: [{ text: 'GO', time: 6, type: 'relax' }, { text: 'EMPTY', time: 6, type: 'relax' }] },
    { id: 'h_ask', dir: 'B', track: 'day', family: 'pass', size: 'none', goals: ['control'], label: 'Pass drill',
      text: 'Potty pass drill: ask, wait for the answer, and use a yes. A real need still means go.' + REAL,
      guide: [{ text: 'ASK', time: 3, type: 'stop' }, { text: 'USE A YES', time: 4, type: 'relax' }] },
    { id: 'h_wake', dir: 'B', track: 'night', family: 'night', size: 'none', goals: ['control'], label: 'Easier waking',
      text: 'Easier waking: if you stir, sit up and finish in the toilet.' + REAL,
      guide: [{ text: 'SIT UP', time: 3, type: 'stop' }, { text: 'TOILET', time: 5, type: 'relax' }] },
    { id: 'h_double', dir: 'B', track: 'day', family: 'hold', size: 'small', goals: ['control'], methods: ['double_void'], label: 'Double void',
      text: 'Double void: go, pause, then a second relaxed empty. No straining.' + REAL,
      guide: [{ text: 'FIRST EMPTY', time: 5, type: 'relax' }, { text: 'PAUSE', time: 3, type: 'stop' }, { text: 'SECOND EMPTY', time: 4, type: 'relax' }] }
  ];
  HABITS.forEach(ev => EVENTS.push(ev));
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
      if (ev.dir !== 'both' && dirs.indexOf(ev.dir) < 0) {
        if (!(ev.optIn && hasMethod(profile, ev.optIn))) return false;
      }
      if (!track && ev.dir === 'both') {
        const dayOn = profile.direction && profile.direction.day && profile.direction.day !== 'off';
        const nightOn = profile.direction && profile.direction.night && profile.direction.night !== 'off';
        if (ev.track === 'day' && !dayOn) return false;
        if (ev.track === 'night' && !nightOn) return false;
        if (ev.track === 'both' && !dayOn && !nightOn) return false;
        return hasMethod(profile, ev.methods);
      }
      if (ev.dir === 'both' && track && ev.track !== 'both' && ev.track !== track) return false;
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
      type: ev.size === 'full' ? 'full' : 'micro',
      source: 'Conditioning',
      group: 'Conditioning',
      label: ev.label,
      flow: ev.text,
      guide: ev.guide,
      dir: ev.dir,
      track: ev.track,
      family: ev.family || 'habit',
      size: ev.size || 'small'
    }));
  }
  function isStartStop(ev) {
    if (ev.pattern === 'startstop') return true;
    const guide = ev.guide || [];
    let sawRelax = false;
    for (let i = 0; i < guide.length; i++) {
      if (guide[i].type === 'relax') sawRelax = true;
      else if (sawRelax && guide[i].type === 'stop') return true;
    }
    return false;
  }
  function letGoMode(profile, track) {
    const dir = profile.direction && profile.direction[track];
    if (dir === 'B') return false;
    const goals = profile.goals || [];
    const style = profile.urgency && profile.urgency.style;
    if (style === 'surf' || style === 'timed') return false;
    if (goals.some(g => ['urgency', 'relaxed', 'thin', 'bedwetting', 'deeper'].indexOf(g) >= 0)) return true;
    if (style === 'first_urge' || style === 'partial') return true;
    if (dir === 'A' && goals.indexOf('control') < 0) return true;
    return false;
  }
  function dimWant(profile, track, id) {
    const d = profile.dimensions && profile.dimensions[track] && profile.dimensions[track][id];
    if (!d || d.want == null || d.want === '') return null;
    return +d.want;
  }
  function wantsSurprise(profile, track) {
    const goals = profile.goals || [];
    if (goals.indexOf('control') >= 0 && goals.indexOf('urgency') < 0 && goals.indexOf('thin') < 0) return false;
    const style = profile.urgency && profile.urgency.style;
    if (style === 'partial') return true;
    const warn = dimWant(profile, track === 'night' ? 'day' : track, 'warning');
    if (warn != null && warn <= 33) return true;
    const drib = dimWant(profile, 'day', 'dribble');
    if (goals.indexOf('urgency') >= 0 && drib != null && drib <= 45) return true;
    return false;
  }
  function holdPref(profile, track) {
    const dir = profile.direction && profile.direction[track];
    return dir === 'B' || (profile.goals || []).indexOf('control') >= 0;
  }
  function streakOf(profile, track) {
    const s = profile.habits && profile.habits.streak;
    if (!s) return 0;
    return Math.max(0, +s[track] || +s.day || 0);
  }
  function drawWeight(ev, profile, track, opts) {
    let w = weight(ev, profile, track);
    const goals = profile.goals || [];
    if ((ev.goals || []).some(g => goals.indexOf(g) >= 0)) w *= 2.4;
    const style = profile.urgency && profile.urgency.style;
    if (style === 'first_urge' && (ev.family === 'letgo' || ev.id === 'h_first')) w *= 2.1;
    if (style === 'partial' && (ev.family === 'seep' || ev.family === 'dribble' || ev.family === 'spurt')) w *= 2;
    if (style === 'surf' && ev.family === 'hold') w *= 2.2;
    if (style === 'timed' && (ev.id === 'h_timed' || ev.id === 'c_void')) w *= 2.4;
    const warn = dimWant(profile, 'day', 'warning');
    const notice = dimWant(profile, 'day', 'notice');
    const drib = dimWant(profile, 'day', 'dribble');
    const sudden = dimWant(profile, 'day', 'sudden');
    const hold = dimWant(profile, 'day', 'hold');
    if (warn != null && warn <= 40 && (ev.family === 'dribble' || ev.family === 'spurt')) w *= warn <= 20 ? 1.8 : 1.35;
    if (notice != null && notice <= 30 && ev.family === 'unnoticed') w *= 2.2;
    if (drib != null && drib <= 40 && (ev.family === 'dribble' || ev.family === 'spurt')) w *= 1.7;
    if (sudden != null && sudden <= 20 && ev.family === 'fade') w *= 2.1;
    if (hold != null && hold <= 30 && ev.family === 'letgo') w *= 1.6;
    if (opts.surprise && (ev.family === 'dribble' || ev.family === 'spurt')) w *= 3.2;
    if (opts.surprise && ev.family === 'seep') w *= 1.35;
    if (opts.surprise && ev.family === 'full') w *= 0.42;
    if (opts.surprise && ev.family === 'unnoticed') w *= 0.85;
    if (opts.preferHold && (ev.family === 'hold' || ev.family === 'pass')) w *= 2.6;
    if (opts.kind === 'micro' && ev.size === 'full') return 0;
    if (opts.kind === 'full' && ev.size === 'full') w *= 1.8;
    if (opts.kind === 'full' && (ev.size === 'tiny' || ev.size === 'none')) w *= 0.4;
    const streak = streakOf(profile, track);
    if (ev.escalate) w *= streak >= 3 ? 1.55 : 0.3;
    if (ev.family === 'reward') w *= streak >= 1 ? 1.6 : 0.35;
    if (ev.family === 'full' && streak < 2 && goals.indexOf('relaxed') < 0 && !opts.surprise) w *= 0.65;
    return w;
  }
  const recent = [];
  function cooldownOk(ev) {
    const n = recent.length;
    if (n && recent[n - 1].id === ev.id) return false;
    if (n >= 2 && recent[n - 1].family === ev.family && recent[n - 2].family === ev.family) return false;
    const window4 = recent.slice(-4);
    if (window4.filter(r => r.family === ev.family).length >= 2) return false;
    return true;
  }
  function toSession(ev) {
    const size = ev.size || 'small';
    return {
      kind: size === 'full' ? 'full' : 'micro',
      desc: ev.text,
      guide: (ev.guide || []).map(s => ({ text: s.text, time: s.time, type: s.type })),
      label: ev.label,
      id: ev.id,
      family: ev.family || 'habit',
      size: size,
      classKey: size === 'full' ? 'full_letgo' : (size === 'tiny' ? 'micro_tiny' : 'micro_small'),
      tmin: 12,
      tmax: 28
    };
  }
  function resetDeck() { recent.length = 0; }
  function draw(opts) {
    opts = opts || {};
    const profile = profileOf(opts);
    if (!profile || !consented(opts)) return null;
    const track = opts.track === 'night' ? 'night' : 'day';
    let list = eligible(profile, { ignoreConsent: true, track: track });
    if (letGoMode(profile, track)) list = list.filter(ev => !isStartStop(ev));
    const tank = opts.tank;
    if (tank && tank.ml != null) {
      const min = tank.minVoidMl != null ? tank.minVoidMl : 50;
      if (+tank.ml < min) list = list.filter(ev => ev.size !== 'full');
    }
    if (opts.kind === 'micro') list = list.filter(ev => ev.size !== 'full');
    if (!list.length) return null;
    const surprise = opts.surprise != null ? !!opts.surprise : wantsSurprise(profile, track);
    const preferHold = opts.preferHold != null ? !!opts.preferHold : holdPref(profile, track);
    let pool = list.filter(cooldownOk);
    if (!pool.length) pool = list.filter(ev => !recent.length || recent[recent.length - 1].id !== ev.id);
    if (!pool.length) pool = list;
    const weights = pool.map(ev => drawWeight(ev, profile, track, { surprise: surprise, preferHold: preferHold, kind: opts.kind }));
    let tot = weights.reduce((a, b) => a + b, 0);
    if (!(tot > 0)) {
      for (let i = 0; i < weights.length; i++) weights[i] = 1;
      tot = weights.length;
    }
    const rng = opts.rng || Math.random;
    let r = rng() * tot;
    let chosen = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r < 0) { chosen = pool[i]; break; } }
    recent.push({ id: chosen.id, family: chosen.family || 'habit' });
    if (recent.length > 12) recent.shift();
    const out = toSession(chosen);
    if (opts.log) log({ id: out.id, label: out.label, weight: drawWeight(chosen, profile, track, { surprise: surprise, preferHold: preferHold, kind: opts.kind }), track: track });
    return out;
  }
  function passChance(profile, opts) {
    profile = profile || {};
    opts = opts || {};
    const track = opts.track === 'night' ? 'night' : 'day';
    const lk = opts.levelKey || (profile.levelKey && (profile.levelKey[track] || profile.levelKey.day)) || 'okay';
    const rank = { none: 0.08, little: 0.15, shaky: 0.26, okay: 0.4, good: 0.58, full: 0.74 };
    let p = rank[lk] != null ? rank[lk] : 0.4;
    const goals = profile.goals || [];
    const dir = profile.direction && profile.direction[track];
    if (dir === 'B' || goals.indexOf('control') >= 0) p += 0.18;
    const passes = profile.urgency && profile.urgency.passes;
    if (passes === 'generous') p += 0.12;
    if (passes === 'rare') p -= 0.1;
    if (dir === 'A' && goals.indexOf('control') < 0) p -= 0.04;
    return Math.max(0.04, Math.min(0.92, Math.round(p * 100) / 100));
  }
  function needToPee(opts) {
    opts = opts || {};
    const profile = profileOf(opts) || {};
    const chance = passChance(profile, opts);
    const rng = opts.rng || Math.random;
    if (rng() < chance) return { kind: 'pass', chance: chance };
    const event = draw(Object.assign({}, opts, { profile: profile, record: true }));
    return { kind: event ? 'event' : 'pass', chance: chance, event: event };
  }
  function addEvents(list) {
    (list || []).forEach(ev => {
      if (!ev || !ev.id) return;
      if (EVENTS.some(e => e.id === ev.id)) return;
      EVENTS.push(ev);
    });
    return EVENTS.length;
  }
  const GOAL_LABELS = {
    urgency: 'urgency', first_urge: 'first urge', relaxed: 'relaxed release', fade: 'signal fade',
    unnoticed: 'unnoticed', dribble: 'dribbles', spurt: 'spurts', seep: 'seep', full: 'full let-go',
    bedwetting: 'bedwetting', deeper: 'deeper sleep', thin: 'thin protection', surprise: 'surprise mix',
    giggle: 'giggle and cough', habit: 'in-play cues', reward: 'reward', streak: 'streak', control: 'more control'
  };
  function deckSummary(profile) {
    profile = profile || {};
    const list = eligible(profile, { ignoreConsent: true });
    let micro = 0, macro = 0, dry = 0;
    const counts = {};
    list.forEach(ev => {
      if (ev.size === 'full') macro++;
      else if (ev.size === 'none') dry++;
      else micro++;
      (ev.goals || []).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    });
    const chosen = (profile.goals || []).map(id => ({ id: id, n: counts[id] || 0, label: GOAL_LABELS[id] || id }));
    const top = Object.keys(counts).map(id => ({ id: id, n: counts[id], label: GOAL_LABELS[id] || id }))
      .sort((a, b) => b.n - a.n).slice(0, 4);
    return { total: list.length, micro: micro, macro: macro, dry: dry, chosen: chosen, top: top, labels: GOAL_LABELS };
  }
  function aboutText(profile) {
    profile = profile || {};
    const track = 'day';
    const key = (profile.levelKey && (profile.levelKey[track] || profile.levelKey.day)) || 'okay';
    let base = '';
    try { base = window.BSControl && window.BSControl.describe ? window.BSControl.describe(key, false) : ''; } catch (e) {}
    const sum = deckSummary(profile);
    const chance = Math.round(passChance(profile, { track: track, levelKey: key }) * 100);
    let sip = { count: 4, gapMin: 30 };
    try {
      if (typeof conditioningSipPlan === 'function') {
        const plan = conditioningSipPlan(key, profile);
        if (plan) sip = { count: plan.count, gapMin: plan.gapMin };
      }
    } catch (e) {}
    const picked = (profile.goals && profile.goals.length && sum.chosen) ? sum.chosen : sum.top;
    const goals = (picked || []).filter(g => g.n > 0).slice(0, 4);
    const goalLine = goals.length ? goals.map(g => (g.label || g.id) + ' (' + g.n + ')').join(', ') : 'the goals on this profile';
    const level = window.BSControl && window.BSControl.level ? window.BSControl.level(key) : null;
    const name = level ? level.label : key;
    const head = base ? '' : ('About ' + name + '. ');
    const extra = 'This setup can draw ' + sum.total + ' events: ' + sum.micro + ' micro, ' + sum.macro + ' macro, ' + sum.dry + ' no-wet. Most of those train ' + goalLine + '. Sips are a batch of ' + sip.count + ', then ' + sip.gapMin + ' min quiet. I need to pee is a potty pass about ' + chance + '% of the time.';
    return (head + (base ? base + ' ' : '') + extra).replace(/\s+/g, ' ').trim();
  }
  window.BSCondEvents = {
    EVENTS, REAL, weight, eligible, pick, catalog, gapOf,
    draw, resetDeck, passChance, needToPee, isStartStop, letGoMode, wantsSurprise,
    addEvents, deckSummary, aboutText, GOAL_LABELS
  };
})();
