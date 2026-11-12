/* ===========================
   onboarding.js — v45 conditioning intake.
   The way into conditioning is this quiz, not a raw target number.
   Last step is the existing consent (adult, real progress, safety settings).
   A saved profile is what "My Conditioning" selects in a full session and in Natural Urge.
   Quiz A questions are reused when BSQuiz is loaded. Numbers stay behind the level cards.
   =========================== */
(function () {
  const KEY = 'bs_conditioning_v1';
  const ORDER = ['none', 'little', 'shaky', 'okay', 'good', 'full'];
  const BANDS = [
    { key: 'full', lo: 92, hi: 100 }, { key: 'good', lo: 80, hi: 91 }, { key: 'okay', lo: 60, hi: 79 },
    { key: 'shaky', lo: 40, hi: 59 }, { key: 'little', lo: 20, hi: 39 }, { key: 'none', lo: 0, hi: 19 }
  ];
  const LIFE = {
    full: { day: 'Big Kid by day: dry through the day, with clear warning. Underwear is enough.', night: 'Big Kid at night: dry nights. You wake when you need to and get up.' },
    good: { day: 'Little Kid by day: mostly dry. A close call now and then.', night: 'Little Kid at night: mostly dry, with a pad as backup.' },
    okay: { day: 'Advanced Trainer by day: you usually make it. Pull-ups are the backup.', night: 'Advanced Trainer at night: some damp nights. An overnight pull-up covers them.' },
    shaky: { day: 'Early Trainer by day: mixed days. You make it about half the time.', night: 'Early Trainer at night: wet a few nights a week, and you often wake too late.' },
    little: { day: 'Toddler by day: diapers do most of the work, and you notice some of the time.', night: 'Toddler at night: wet most nights, rarely wakes.' },
    none: { day: 'Infant by day: it just happens. Thick diapers, little warning.', night: 'Infant at night: wet every night, and you sleep through it.' }
  };
  const GOALS = [
    { id: 'bedwetting', l: 'Bedwetting' },
    { id: 'urgency', l: 'Urgency — not quite making it' },
    { id: 'thin', l: 'Wetting in thin gear or underwear' },
    { id: 'relaxed', l: 'Relaxed, passive wetting' },
    { id: 'control', l: 'More control / staying dry' },
    { id: 'deeper', l: 'Deeper sleep' }
  ];
  const METHODS = [
    { id: 'first_urge', tracks: ['day'], dir: 'A', goals: ['urgency', 'thin'], title: 'First-urge release',
      line: 'Go at the first urge. Repeating this shrinks functional capacity.',
      play: 'When the first urge shows up, go then. Do not wait it out.',
      score: 'A logged first-urge trip is practice. One trip does not move your level.',
      stages: ['Once today, go at the first urge.', 'The first two urges today.', 'Each first urge today.'] },
    { id: 'relaxed', tracks: ['day'], dir: 'A', goals: ['relaxed', 'urgency'], title: 'Relaxed release',
      line: 'Passive: no holding back and no pushing. Relax and let it happen when it happens. This is not overflow and not stretching.',
      play: 'When it starts, soften and let it happen. Do not push, and do not hold it back.',
      score: 'Logged as a passive release. It does not ask you to force or strain.',
      stages: ['Once today, let one release happen with no push and no hold.', 'Twice today, including one you did not plan.', 'Whenever it starts, do not hold and do not push.'] },
    { id: 'positions', tracks: ['day'], dir: 'A', goals: ['thin', 'relaxed'], title: 'Release in different positions',
      line: 'Practice letting go while sitting, standing, and lying down, so it is not tied to one posture.',
      play: 'Pick a position you do not usually use, and let a release happen there.',
      score: 'The position is logged with the practice. The level still waits for check-ins.',
      stages: ['One position today.', 'Two positions today.', 'Sitting, standing, and lying across the day.'] },
    { id: 'cue', tracks: ['day'], dir: 'A', goals: ['thin', 'relaxed'], title: 'Cue pairing',
      line: 'Pair a small cue — a phrase or a breath — with release, so the cue starts the habit.',
      play: 'Use the same cue, then let go. Keep the cue the same each time.',
      score: 'The cue counts when you log it with the release.',
      stages: ['One paired cue today.', 'The cue twice today.', 'The cue whenever you release.'] },
    { id: 'no_toilet', tracks: ['day'], dir: 'A', goals: ['thin'], title: 'No-toilet block',
      line: 'A block of time with no toilet, in the gear you chose for that place.',
      play: 'For this block, stay in your gear. A real need still ends the block.',
      score: 'Finishing the block is the log. Leaving for a real need is not a failure.',
      stages: ['A short block, about half an hour.', 'A longer block, about an hour.', 'The block you planned for today.'] },
    { id: 'reverse_kegel', tracks: ['day'], dir: 'A', goals: ['relaxed'], title: 'Pelvic-floor relaxation',
      line: 'A reverse kegel: soften and let the muscle drop. No clenching.',
      play: 'Breathe out and let the pelvic floor drop for a few seconds, then rest.',
      score: 'A set is logged. It is not a max hold.',
      stages: ['Three easy drops.', 'Five easy drops.', 'A short set at each cue.'] },
    { id: 'stay_bed', tracks: ['night'], dir: 'A', goals: ['bedwetting'], title: 'Stay in bed on waking',
      line: 'If you wake, stay in bed instead of getting up. Getting up for a real need is always fine.',
      play: 'On a wake, stay put unless you truly need to get up.',
      score: 'Staying is logged. Getting up for a real need does not count against you.',
      stages: ['Stay for the first wake.', 'Stay for wakes tonight.', 'Stay, and let the night finish in bed.'] },
    { id: 'before_awake', tracks: ['night'], dir: 'A', goals: ['bedwetting', 'relaxed'], title: 'Release before fully awake',
      line: 'Let a release happen before you are fully awake, instead of waking up to go.',
      play: 'If you stir, stay heavy and let it happen before you sit up.',
      score: 'A wet with no full wake scores higher for Night A than waking to change.',
      stages: ['Notice one moment you were not fully awake.', 'Let one release happen before you sit up.', 'Treat a slept-through wet as the night’s result.'] },
    { id: 'lying', tracks: ['night'], dir: 'A', goals: ['relaxed'], title: 'Lying-down release',
      line: 'Practice a release while lying down, so night wetting is not a new posture.',
      play: 'Lie down and let a small release happen. No pushing.',
      score: 'Logged as a lying-down drill.',
      stages: ['One lying-down release.', 'One at bedtime and one if you wake.', 'Lying down is the default posture.'] },
    { id: 'bedtime_cue', tracks: ['night'], dir: 'A', goals: ['bedwetting', 'deeper'], title: 'Bedtime cue routine',
      line: 'The same short routine at the same time each night: gear, cue, lights out.',
      play: 'Run the bedtime cue at the time on your plan.',
      score: 'Doing the routine is the log, even if the night is dry.',
      stages: ['The routine once, at your cue time.', 'The same routine two nights running.', 'The routine every night this week.'] },
    { id: 'deeper_sleep', tracks: ['night'], dir: 'A', goals: ['deeper', 'bedwetting'], title: 'Deeper-sleep habits',
      line: 'Same bedtime, a dark room, and no late screen, so sleep can run deeper.',
      play: 'Keep tonight’s bedtime. Dim the lights. Leave the screen out of bed.',
      score: 'A deep-sleep wet with no wake scores higher for Night A than a wake-and-change.',
      stages: ['Lights and screen, one night.', 'Same bedtime two nights.', 'The same wind-down all week.'] },
    { id: 'timed_void', tracks: ['day', 'night'], dir: 'B', goals: ['control'], title: 'Timed voiding',
      line: 'Go on a schedule, before urgency builds.',
      play: 'Go at the next planned time, even if the urge is small.',
      score: 'A planned trip is logged. A missed slot does not erase the streak.',
      stages: ['One planned trip today.', 'Two planned trips today.', 'The day’s planned trips.'] },
    { id: 'urge_surf', tracks: ['day', 'night'], dir: 'B', goals: ['control', 'urgency'], title: 'Urge surfing',
      line: 'Notice the wave and let it pass, then go. Stop if it gets strong.',
      play: 'When an urge rises, wait for the peak to ease, then go. Stop if it gets strong.',
      score: 'A surf you finished is logged. Stopping because it got strong still counts.',
      stages: ['Surf one mild urge.', 'Surf two urges.', 'Surf before each unplanned trip.'] },
    { id: 'kegels', tracks: ['day', 'night'], dir: 'B', goals: ['control'], title: 'Correct kegels',
      line: 'A gentle 3–5 second squeeze, then a full relax. Not a maximal clench.',
      play: 'Squeeze gently for a few seconds, then fully relax. Repeat a short set.',
      score: 'A set with a full relax is logged. A maximal clench is not the exercise.',
      stages: ['Five gentle squeezes.', 'Two short sets.', 'A set at each planned trip.'] },
    { id: 'double_void', tracks: ['day'], dir: 'B', goals: ['control'], title: 'Double voiding',
      line: 'Go, wait a moment, then go again, so the bladder empties.',
      play: 'After you go, wait a few breaths and go again.',
      score: 'Logged when the second void happens.',
      stages: ['Once today.', 'At the two main trips.', 'At each planned trip.'] },
    { id: 'alarm', tracks: ['night'], dir: 'B', goals: ['control', 'bedwetting'], title: 'Bedwetting alarm',
      line: 'DryClip alarm mode: a wet wakes you so you can get up.',
      play: 'Arm DryClip in alarm mode. If it wakes you, get up and finish in the toilet.',
      score: 'A wake-and-change is the result this mode is for.',
      stages: ['Arm it for one night.', 'Arm it two nights.', 'Arm it each night this week.'] },
    { id: 'front_load', tracks: ['day'], dir: 'B', goals: ['control', 'deeper'], title: 'Front-load drinks',
      line: 'More of today’s drinks earlier, and less late, still inside the drink cap.',
      play: 'If you want a drink, take it earlier in the day. Late prompts stay small.',
      score: 'Logged drinks still count. A missed day stays blank.',
      stages: ['One earlier drink you would have had later.', 'Most drinks before late afternoon.', 'The late slot stays a sip, if you are thirsty.'] }
  ];
  const NEED = { gentle: 5, steady: 4, intense: 3 };
  const TASKS = { gentle: 1, steady: 2, intense: 3 };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = n => Math.max(0, Math.min(100, Math.round(+n || 0)));
  const n03 = v => Math.max(0, Math.min(3, Math.round(+v || 0)));
  function dayKey(ts) {
    const d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayNum(key) {
    const p = String(key || '').split('-').map(Number);
    if (p.length < 3 || !p[0]) return 0;
    return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5);
  }
  function methodById(id) { return METHODS.find(m => m.id === id) || null; }
  function bandOf(v) {
    try { if (window.BSControl && window.BSControl.levelFor) return window.BSControl.levelFor(v).key; } catch (e) {}
    const x = Math.max(0, Math.min(100, +v || 0));
    const b = BANDS.find(r => x >= r.lo && x <= r.hi);
    return b ? b.key : 'okay';
  }
  function midOf(key) {
    try {
      const l = window.BSControl && window.BSControl.level && window.BSControl.level(key);
      if (l && l.band && l.band[0] >= 0) return Math.round((l.band[0] + l.band[1]) / 2);
    } catch (e) {}
    const b = BANDS.find(r => r.key === key);
    return b ? Math.round((b.lo + b.hi) / 2) : 50;
  }
  function labelOf(key) {
    try {
      const l = window.BSControl && window.BSControl.level && window.BSControl.level(key);
      if (l && l.label) return l.label;
    } catch (e) {}
    return key;
  }
  function levelCard(key, track) {
    const t = track === 'night' ? 'night' : 'day';
    return { key: key, name: labelOf(key), text: (LIFE[key] && LIFE[key][t]) || '', target: midOf(key) };
  }
  function scoreDay(a) {
    a = a || {};
    return clamp(96 - n03(a.urgency) * 8 - n03(a.suddenness) * 7 - n03(a.hold) * 10 - n03(a.trips) * 5 - n03(a.leaks30) * 12);
  }
  function scoreNight(a) {
    a = a || {};
    const wet = Math.max(0, Math.min(7, Math.round(+a.wetNights || 0)));
    return clamp(96 - Math.round(wet / 7 * 56) - n03(a.wake) * 10 - Math.max(0, Math.min(2, Math.round(+a.depth || 0))) * 4);
  }
  function scoreNow(draft) {
    draft = draft || {};
    const day = scoreDay(draft.day || draft);
    const night = scoreNight(draft.night || draft);
    return { day: day, night: night, dayKey: bandOf(day), nightKey: bandOf(night) };
  }
  function defaultMethods(goals, dayDir, nightDir) {
    const g = new Set(goals || []);
    const pick = (track, dir) => METHODS.filter(m => m.dir === dir && m.tracks.indexOf(track) >= 0 && m.goals.some(x => g.has(x))).map(m => m.id);
    let day = dayDir === 'A' || dayDir === 'B' ? pick('day', dayDir) : [];
    let night = nightDir === 'A' || nightDir === 'B' ? pick('night', nightDir) : [];
    if (dayDir === 'A' && !day.length) day = ['relaxed'];
    if (dayDir === 'B' && !day.length) day = ['timed_void', 'urge_surf'];
    if (nightDir === 'A' && !night.length) night = ['stay_bed', 'bedtime_cue'];
    if (nightDir === 'B' && !night.length) night = ['alarm', 'timed_void'];
    return { day: day, night: night };
  }
  function quizOpts(id, fallback) {
    try {
      const q = window.BSQuiz && window.BSQuiz.QA && window.BSQuiz.QA.find(x => x.id === id);
      if (q && q.opts && q.opts.length) return q.opts.map(o => ({ v: o.v, l: o.l }));
    } catch (e) {}
    return fallback;
  }
  function gearLadder() {
    try { if (window.BSGear && window.BSGear.LADDER) return window.BSGear.LADDER; } catch (e) {}
    return [
      { id: 'G0', label: 'Thick diaper' }, { id: 'G1', label: 'Diaper' }, { id: 'G2', label: 'Thin diaper / overnight pull-up' },
      { id: 'G3', label: 'Pull-up' }, { id: 'G4', label: 'Pad / liner' }, { id: 'G5', label: 'Training pants' }, { id: 'G6', label: 'Underwear' }
    ];
  }
  function protFromGear(id) {
    const g = gearLadder().find(x => x.id === id);
    if (g && g.prot) return g.prot;
    return { G0: 'thick_diapers', G1: 'diapers', G2: 'pullups', G3: 'pullups', G4: 'pad', G5: 'training', G6: 'none' }[id] || 'none';
  }
  function gearFromProt(prot) {
    try { if (window.BSGear && window.BSGear.fromProt) return window.BSGear.fromProt(prot, false); } catch (e) {}
    return { none: 'G6', pad: 'G4', pullups: 'G3', diapers: 'G1', thick_diapers: 'G0', training: 'G5' }[prot] || 'G6';
  }
  function metricsFrom(draft) {
    draft = draft || {};
    const day = draft.day || {};
    const night = draft.night || {};
    const sudden = [30, 18, 8, 2][n03(day.suddenness)];
    const hold = [70, 45, 20, 5][n03(day.hold)];
    const W = Math.min(sudden, hold);
    const wet = Math.max(0, Math.min(7, Math.round(+night.wetNights || 0)));
    let Dn, Wn;
    if (wet <= 0) { Dn = 1; Wn = 0; }
    else if (wet <= 2) { Dn = 0.8; Wn = 0.25; }
    else if (wet <= 4) { Dn = 0.5; Wn = 0.8; }
    else { Dn = 0.2; Wn = 1.6; }
    const worn = draft.gear || {};
    return {
      U: [2, 4, 7, 9][n03(day.urgency)], W: W, I: Math.max(45, W * 3), F: [5, 8, 11, 13][n03(day.trips)],
      Ld: [0, 0.35, 1.2, 3][n03(day.leaks30)], Dn: Dn, Wn: Wn, Sn: [0.1, 0.35, 0.65, 0.9][n03(night.wake)],
      protDay: protFromGear(worn.home || worn.work || 'G6'), protNight: protFromGear(worn.night || 'G6')
    };
  }
  function recommendGear(draft) {
    const metrics = metricsFrom(draft);
    let rec = { day: 'G6', night: 'G6', why: { day: '', night: '' } };
    try { if (window.BSGear && window.BSGear.recommend) rec = window.BSGear.recommend(metrics); } catch (e) {}
    return { worn: Object.assign({ home: 'G6', work: 'G6', out: 'G6', night: 'G6' }, draft.gear || {}), recommended: rec, metrics: metrics };
  }
  function prefillFromQuiz() {
    let a = null;
    try { a = window.BSQuiz && window.BSQuiz.load && window.BSQuiz.load().a; } catch (e) {}
    if (!a) return null;
    const nights = Math.max(0, Math.min(3, +a.nights || 0));
    const out = {
      day: { urgency: a.urgency, suddenness: a.warning, hold: a.holdTime, trips: a.frequency, leaks30: a.leaks },
      night: { wetNights: [0, 1, 3, 6][nights], wake: a.nightWake },
      gear: { home: gearFromProt(a.protDay), work: gearFromProt(a.protDay), out: gearFromProt(a.protDay), night: gearFromProt(a.protNight || a.protDay) }
    };
    const hint = sleepHint();
    if (hint) out.night.depth = hint.depth;
    return out;
  }
  function sleepHint() {
    try {
      const nights = window.BSSleep && window.BSSleep.load && window.BSSleep.load().nights;
      if (!nights || !nights.length) return null;
      const last = nights[nights.length - 1];
      const deep = +last.deepMin || 0;
      return { depth: deep >= 70 ? 2 : deep >= 30 ? 1 : 0, source: last.source || 'import', date: last.date || '' };
    } catch (e) { return null; }
  }
  function capacityEstimate() {
    try {
      const Cb = window.BSCalib;
      if (!Cb || !Cb.load || !Cb.summarize) return null;
      const d = Cb.load();
      if (!d.trials || !d.trials.length) return null;
      const sum = Cb.summarize(d.trials);
      if (sum && sum.medianMl) return { ml: sum.medianMl, source: 'calibration' };
    } catch (e) {}
    return null;
  }
  function freshHabits() {
    return {
      cues: [], streak: { day: 0, night: 0 }, best: { day: 0, night: 0 },
      lastDone: { day: null, night: null }, shield: { day: 1, night: 1 },
      stageStreak: { day: 0, night: 0 }, grade: {}, log: [], review: null
    };
  }
  function cuesFor(profile) {
    const cues = [];
    if (profile.methods && profile.methods.day && profile.methods.day.length) cues.push({ id: 'morning', time: '08:00', track: 'day', label: 'Morning practice' });
    if (profile.intensity === 'intense' || profile.intensity === 'steady') cues.push({ id: 'midday', time: '13:00', track: 'day', label: 'Midday practice' });
    if (profile.methods && profile.methods.night && profile.methods.night.length) cues.push({ id: 'bedtime', time: '22:00', track: 'night', label: 'Bedtime cue' });
    return cues;
  }
  function defaults() {
    return { v: 1, completedAt: 0, needsQuiz: false, migratedFromV44: false, quizStep: 'intro', draft: null, profile: null, calibration: null, diary: [], habits: freshHabits(), showAdvanced: false };
  }
  function load() {
    const s = Object.assign(defaults(), J(KEY, {}));
    s.habits = Object.assign(freshHabits(), s.habits || {});
    s.habits.streak = Object.assign({ day: 0, night: 0 }, s.habits.streak);
    s.habits.best = Object.assign({ day: 0, night: 0 }, s.habits.best);
    s.habits.lastDone = Object.assign({ day: null, night: null }, s.habits.lastDone);
    s.habits.shield = Object.assign({ day: 1, night: 1 }, s.habits.shield);
    s.habits.stageStreak = Object.assign({ day: 0, night: 0 }, s.habits.stageStreak);
    s.habits.grade = s.habits.grade || {};
    s.habits.log = Array.isArray(s.habits.log) ? s.habits.log : [];
    s.diary = Array.isArray(s.diary) ? s.diary : [];
    if (s.habits.shield.day == null) s.habits.shield.day = 1;
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function migrateV44() {
    const s = load();
    if (s.completedAt || s.migratedFromV44) return s;
    let consent = null, ctl = null;
    try { consent = window.BSConsent && window.BSConsent.load(); } catch (e) {}
    try { ctl = window.BSControl && window.BSControl.load(); } catch (e) {}
    if (!consent || !consent.acceptedAt || !ctl || !ctl.tracks) return s;
    const dayT = +ctl.tracks.day.target, nightT = +ctl.tracks.night.target;
    const dayE = +ctl.tracks.day.estimate, nightE = +ctl.tracks.night.estimate;
    s.migratedFromV44 = true;
    s.needsQuiz = true;
    s.quizStep = 'intro';
    s.profile = {
      starting: { day: dayE, night: nightE },
      target: { day: dayT, night: nightT },
      targetKey: { day: bandOf(dayT), night: bandOf(nightT) },
      levelKey: { day: bandOf(dayE), night: bandOf(nightE) },
      direction: { day: consent.tracks.day || 'off', night: consent.tracks.night || 'off' },
      goals: [], intensity: ctl.tracks.day.pace === 'fast' ? 'intense' : (ctl.tracks.day.pace === 'gentle' ? 'gentle' : 'steady'),
      timeframe: 'open', methods: { day: [], night: [] }, gear: null, fromV44: true
    };
    return save(s);
  }
  function finishQuiz(draft) {
    draft = draft || {};
    if (!draft.adult || !draft.understand) return { ok: false, reason: 'boxes' };
    const start = scoreNow(draft);
    const dayDir = draft.dayDir === 'A' || draft.dayDir === 'B' ? draft.dayDir : 'off';
    const nightDir = draft.nightDir === 'A' || draft.nightDir === 'B' ? draft.nightDir : 'off';
    const dayLevel = dayDir === 'off' ? start.dayKey : (draft.dayLevel || start.dayKey);
    const nightLevel = nightDir === 'off' ? start.nightKey : (draft.nightLevel || start.nightKey);
    const methods = draft.methods && (draft.methods.day || draft.methods.night) ? draft.methods : defaultMethods(draft.goals, dayDir, nightDir);
    const profile = {
      starting: { day: start.day, night: start.night },
      target: { day: dayDir === 'off' ? start.day : midOf(dayLevel), night: nightDir === 'off' ? start.night : midOf(nightLevel) },
      targetKey: { day: dayLevel, night: nightLevel },
      levelKey: { day: start.dayKey, night: start.nightKey },
      direction: { day: dayDir, night: nightDir },
      goals: draft.goals || [],
      intensity: draft.intensity || 'steady',
      timeframe: draft.timeframe || 'open',
      methods: { day: methods.day || [], night: methods.night || [] },
      gear: recommendGear(draft)
    };
    const s = load();
    const habits = s.habits && s.habits.log ? s.habits : freshHabits();
    habits.cues = cuesFor(profile);
    s.profile = profile;
    s.answers = draft;
    s.completedAt = Date.now();
    s.needsQuiz = false;
    s.quizStep = 'calib';
    s.habits = habits;
    save(s);
    try {
      if (window.BSControl && window.BSControl.setTrack) {
        window.BSControl.setTrack('day', { estimate: start.day, value: start.day });
        window.BSControl.setTrack('night', { estimate: start.night, value: start.night });
      }
    } catch (e) {}
    const pace = profile.intensity === 'intense' ? 'fast' : profile.intensity === 'gentle' ? 'gentle' : 'steady';
    let consent = { ok: true };
    try {
      if (window.BSConsent && window.BSConsent.accept) {
        consent = window.BSConsent.accept({
          adult: true, understand: true, realDay: !!draft.realDay, realNight: !!draft.realNight,
          day: dayDir, night: nightDir, targets: { day: profile.target.day, night: profile.target.night },
          pace: { day: pace, night: pace }
        });
      }
    } catch (e) {}
    try {
      if (window.BSPartial && window.BSPartial.saveSettings) {
        window.BSPartial.saveSettings({ finishOnToilet: draft.finishOnToilet !== false, dailyCap: draft.dailyCap == null ? 4 : draft.dailyCap });
      }
    } catch (e) {}
    try { if (window.BSGear && window.BSGear.apply && profile.gear.recommended) window.BSGear.apply(profile.gear.recommended); } catch (e) {}
    return { ok: !consent || consent.ok !== false, profile: profile, start: start };
  }
  function chooseCalib(choice) {
    const s = load();
    const cap = choice === 'skip' ? capacityEstimate() : null;
    s.calibration = {
      choice: choice === 'diary' ? 'diary' : 'skip',
      at: Date.now(),
      until: choice === 'diary' ? Date.now() + 3 * 864e5 : 0,
      capacityMl: cap ? cap.ml : null,
      source: choice === 'diary' ? 'diary' : (cap ? 'calibration' : 'quiz')
    };
    if (cap && s.profile) s.profile.baselineV = cap.ml;
    s.quizStep = 'summary';
    save(s);
    try { if (window.BSCheckins && window.BSCheckins.schedule) window.BSCheckins.schedule(3); } catch (e) {}
    return s.calibration;
  }
  function updateProfile(patch) {
    patch = patch || {};
    const s = load();
    if (!s.profile) return null;
    const p = s.profile;
    if (patch.dayDir) p.direction.day = patch.dayDir;
    if (patch.nightDir) p.direction.night = patch.nightDir;
    if (patch.dayLevel && p.direction.day !== 'off') { p.targetKey.day = patch.dayLevel; p.target.day = midOf(patch.dayLevel); }
    if (patch.nightLevel && p.direction.night !== 'off') { p.targetKey.night = patch.nightLevel; p.target.night = midOf(patch.nightLevel); }
    if (patch.goals) p.goals = patch.goals;
    if (patch.intensity) p.intensity = patch.intensity;
    if (patch.timeframe) p.timeframe = patch.timeframe;
    if (patch.methods) p.methods = { day: patch.methods.day || [], night: patch.methods.night || [] };
    s.habits.cues = cuesFor(p);
    save(s);
    const pace = p.intensity === 'intense' ? 'fast' : p.intensity === 'gentle' ? 'gentle' : 'steady';
    try {
      if (window.BSControl && window.BSControl.setTrack) {
        window.BSControl.setTrack('day', { target: p.target.day, pace: pace, phase: p.direction.day === 'off' ? 'frozen' : 'active' });
        window.BSControl.setTrack('night', { target: p.target.night, pace: pace, phase: p.direction.night === 'off' ? 'frozen' : 'active' });
      }
    } catch (e) {}
    return p;
  }
  function playProfile(ts) {
    const s = load();
    let track = 'day';
    try { if (window.BSControl && window.BSControl.trackFor) track = window.BSControl.trackFor(ts || Date.now()); } catch (e) {}
    const p = s.profile;
    if (!p || !p.levelKey) {
      let lk = 'okay';
      try { if (window.BSControl) lk = window.BSControl.band(track); } catch (e) {}
      return { id: 'conditioning', ready: false, track: track, levelKey: lk, levelName: labelOf(lk), direction: 'off', methods: [], gear: null };
    }
    const lk = p.levelKey[track] || p.levelKey.day;
    return {
      id: 'conditioning', ready: !!(s.completedAt || s.migratedFromV44), needsQuiz: !!s.needsQuiz,
      track: track, levelKey: lk, levelName: labelOf(lk), direction: p.direction[track] || 'off',
      methods: (p.methods && p.methods[track]) || [], gear: p.gear, targetKey: p.targetKey && p.targetKey[track],
      intensity: p.intensity
    };
  }
  function pickerOption(sel) {
    return `<option value="conditioning"${sel === 'conditioning' ? ' selected' : ''}>My Conditioning</option>`;
  }
  function rollMods(track) {
    const info = playProfile();
    const t = track === 'night' || track === 'day' ? track : info.track;
    const saved = load().profile;
    const ids = (saved && saved.methods && saved.methods[t]) || info.methods || [];
    const m = { go: 1, wait: 1, hard: 1, dribble: 1, gear: 1 };
    if (ids.indexOf('relaxed') >= 0) { m.gear *= 1.15; m.hard *= 0.7; }
    if (ids.indexOf('first_urge') >= 0) { m.go *= 1.25; m.wait *= 0.8; }
    if (ids.indexOf('urge_surf') >= 0) { m.wait *= 1.25; m.go *= 0.85; }
    if (ids.indexOf('no_toilet') >= 0) { m.gear *= 1.2; m.go *= 0.75; }
    return m;
  }
  function sessionPlan(now) {
    const s = load();
    const p = s.profile;
    const hour = new Date(now || Date.now()).getHours();
    const methods = p && p.methods ? (p.methods.day || []).concat(p.methods.night || []) : [];
    let sips = [1, 2], min = 30, max = 70;
    if (methods.indexOf('first_urge') >= 0) { min = 15; max = 35; }
    if (methods.indexOf('timed_void') >= 0) { min = 50; max = 80; }
    if (methods.indexOf('front_load') >= 0 && hour < 14) { min = Math.min(min, 25); max = Math.min(max, 50); sips = [1, 3]; }
    if (methods.indexOf('front_load') >= 0 && hour >= 16) { sips = [0, 1]; min = 120; max = 180; }
    if (p && p.intensity === 'gentle') sips = [Math.min(sips[0], 1), Math.min(sips[1], 2)];
    const prompts = methods.map(id => {
      const m = methodById(id);
      return m ? { id: id, title: m.title, text: m.play } : null;
    }).filter(Boolean);
    return {
      profileId: 'conditioning',
      hydration: { min: min, max: max, sips: sips },
      timers: { min: min, max: max },
      prompts: prompts,
      cap: ml => capSessionMl(ml)
    };
  }
  function capSessionMl(ml) {
    try {
      if (window.BSSafety && window.BSSafety.capDrink) return window.BSSafety.capDrink(ml, { src: 'conditioning', commit: false });
    } catch (e) {}
    return { ok: true, ml: Math.min(250, +ml || 0) };
  }
  function todayPlan(now) {
    const s = load();
    const p = s.profile;
    if (!p) return [];
    const n = TASKS[p.intensity] || 2;
    const cues = (s.habits.cues && s.habits.cues.length) ? s.habits.cues : cuesFor(p);
    const tasks = [];
    ['day', 'night'].forEach(track => {
      const ids = (p.methods && p.methods[track]) || [];
      ids.slice(0, n).forEach((id, i) => {
        const m = methodById(id); if (!m) return;
        const stage = Math.max(1, Math.min(3, s.habits.grade[id] || 1));
        const cue = cues.filter(c => c.track === track)[i] || cues.find(c => c.track === track) || null;
        tasks.push({ id: id, track: track, stage: stage, title: m.title, text: m.stages[stage - 1] || m.play, cue: cue ? cue.time : '', cueLabel: cue ? cue.label : '' });
      });
    });
    return tasks;
  }
  function logBehaviour(methodId, track, ts) {
    const s = load();
    const t = track === 'night' ? 'night' : 'day';
    const habits = s.habits;
    const key = dayKey(ts || Date.now());
    const last = habits.lastDone[t];
    const gap = last ? dayNum(key) - dayNum(last) : null;
    let forgiven = false;
    if (last !== key) {
      if (gap == null || gap === 1) habits.streak[t] = (habits.streak[t] || 0) + 1;
      else if (gap === 2 && (habits.shield[t] || 0) > 0) {
        habits.shield[t] -= 1;
        forgiven = true;
        habits.streak[t] = (habits.streak[t] || 0) + 1;
      } else habits.streak[t] = 1;
      habits.stageStreak[t] = habits.streak[t] === 1 && !forgiven && gap != null && gap !== 1 ? 1 : (habits.stageStreak[t] || 0) + 1;
      if (gap != null && gap > 2) habits.stageStreak[t] = 1;
      if (gap === 2 && !forgiven) habits.stageStreak[t] = 1;
    }
    habits.lastDone[t] = key;
    if (!forgiven && (habits.shield[t] || 0) < 1 && (habits.stageStreak[t] || 0) >= 3 && gap === 1) habits.shield[t] = 1;
    const stage = habits.grade[methodId] || 1;
    const need = NEED[(s.profile && s.profile.intensity) || 'steady'] || 4;
    let advanced = false;
    if (last !== key && (habits.stageStreak[t] || 0) >= need && stage < 3) {
      habits.grade[methodId] = stage + 1;
      habits.stageStreak[t] = 0;
      advanced = true;
    }
    habits.best[t] = Math.max(habits.best[t] || 0, habits.streak[t] || 0);
    habits.log.push({ ts: ts || Date.now(), method: methodId, track: t, reward: 1 });
    if (habits.log.length > 400) habits.log.splice(0, habits.log.length - 400);
    save(s);
    const m = methodById(methodId);
    const text = 'Logged' + (m ? ': ' + m.title : '') + '. Streak ' + habits.streak[t] + (forgiven ? ' (one missed day kept).' : '.') + (advanced ? ' Next time is a step harder.' : '');
    return { ok: true, streak: habits.streak[t], forgiven: forgiven, advanced: advanced, stage: habits.grade[methodId] || stage, shield: habits.shield[t], text: text };
  }
  function stepToward(from, to) {
    const a = ORDER.indexOf(from), b = ORDER.indexOf(to);
    if (a < 0 || b < 0 || a === b) return from;
    return ORDER[a + (b > a ? 1 : -1)];
  }
  function bandToward(cur, goal, band) {
    const next = stepToward(cur, goal);
    const c = ORDER.indexOf(band), n = ORDER.indexOf(next), g = ORDER.indexOf(goal);
    if (c < 0 || n < 0) return false;
    if (g > ORDER.indexOf(cur)) return c >= n;
    if (g < ORDER.indexOf(cur)) return c <= n;
    return false;
  }
  function considerPromotion(track, values) {
    const s = load();
    const p = s.profile;
    const t = track === 'night' ? 'night' : 'day';
    if (!p || !p.levelKey || !p.targetKey) return { promoted: false };
    const cur = p.levelKey[t], goal = p.targetKey[t];
    if (!cur || !goal || cur === goal) return { promoted: false, level: cur };
    const last2 = (values || []).filter(v => v != null && isFinite(v)).slice(-2);
    if (last2.length < 2) return { promoted: false, level: cur, reason: 'need two check-ins' };
    if (!last2.every(v => bandToward(cur, goal, bandOf(v)))) return { promoted: false, level: cur };
    const next = stepToward(cur, goal);
    p.levelKey[t] = next;
    save(s);
    return { promoted: true, from: cur, level: next };
  }
  function nightAPoints(v) {
    if (v === 'slept_wet' || v === 'deep_unwoke') return 3;
    if (v === 'woke_changed' || v === 'woke') return 1;
    if (typeof v === 'number') {
      if (v <= 20) return 3;
      if (v <= 45) return 2;
      return 1;
    }
    return 0;
  }
  function weeklyReview(item) {
    const bits = [];
    ['day', 'night'].forEach(t => {
      const e = item && item.estimates && item.estimates[t];
      if (!e) return;
      bits.push(t + ': ' + (e.badge || 'logged') + (e.slope != null ? ' (' + e.slope + '/week)' : ''));
    });
    const text = (bits.length ? 'This week — ' + bits.join('; ') + '. ' : '') + 'A track moves one level only after two check-ins in a row agree. One event is not enough.';
    const s = load();
    s.habits.review = { at: Date.now(), text: text };
    save(s);
    return text;
  }
  function onCheckIn(item) {
    const s = load();
    if (!s.profile) return null;
    const out = {};
    try {
      const items = window.BSCheckins && window.BSCheckins.load ? window.BSCheckins.load().items : [];
      ['day', 'night'].forEach(t => {
        const vals = (items || []).map(it => it.estimates && it.estimates[t] && it.estimates[t].after);
        out[t] = considerPromotion(t, vals);
      });
    } catch (e) {}
    out.review = weeklyReview(item);
    return out;
  }
  function logDiary(kind, extra, ts) {
    const s = load();
    extra = extra || {};
    s.diary.push({ ts: ts || Date.now(), kind: kind, ml: extra.ml == null || extra.ml === '' ? null : +extra.ml });
    if (s.diary.length > 400) s.diary.splice(0, s.diary.length - 400);
    save(s);
    return s.diary;
  }
  function diaryMetrics(from, to) {
    const rows = load().diary.filter(r => r.ts >= from && r.ts < to);
    const voids = rows.filter(r => r.kind === 'void');
    const mls = voids.map(v => v.ml).filter(v => v != null && isFinite(v));
    const metrics = {};
    if (voids.length) metrics.F = voids.length;
    if (mls.length) metrics.V = Math.round(mls.reduce((a, b) => a + b, 0) / mls.length);
    const urges = rows.filter(r => r.kind === 'urge').length;
    if (urges) metrics.U = Math.min(10, urges);
    if (rows.some(r => r.kind === 'leak')) metrics.Ld = rows.filter(r => r.kind === 'leak').length;
    if (rows.some(r => r.kind === 'nightwet')) {
      metrics.Wn = rows.filter(r => r.kind === 'nightwet').length;
      metrics.Dn = 0;
    }
    return { metrics: metrics, count: rows.length };
  }
  function progress(track) {
    const s = load();
    const p = s.profile;
    if (!p) return 0;
    const t = track === 'night' ? 'night' : 'day';
    const start = p.starting[t], target = p.target[t];
    let est = start;
    try { est = window.BSControl.trackState(t).estimate; } catch (e) {}
    const span = target - start;
    if (Math.abs(span) < 1) return Math.abs(est - target) <= 5 ? 1 : 0;
    return Math.max(0, Math.min(1, (est - start) / span));
  }
  function optsHtml(list, name, cur) {
    return list.map(o => `<label class="urge-lbl"><input type="radio" name="${name}" value="${esc(o.v)}" ${String(cur) === String(o.v) ? 'checked' : ''}> ${esc(o.l)}</label>`).join('');
  }
  function cardsHtml(track, cur) {
    const keys = (window.BSControl && window.BSControl.LADDER ? window.BSControl.LADDER.map(l => l.key) : BANDS.map(b => b.key));
    return keys.map(k => {
      const c = levelCard(k, track);
      return `<button type="button" data-act="level" data-track="${track}" data-level="${k}" class="pill" style="display:block;width:100%;text-align:left;margin:4px 0;${cur === k ? 'outline:2px solid #55efc4' : ''}"><b>${esc(c.name)}</b><br><span class="cal-legend">${esc(c.text)}</span></button>`;
    }).join('');
  }
  function render() {
    const m = document.getElementById('conditioningMount'); if (!m) return;
    migrateV44();
    const s = load();
    const step = s.quizStep || 'intro';
    const quizSteps = { intro: 1, day: 1, night: 1, gear: 1, goalDay: 1, goalNight: 1, want: 1, methods: 1, consent: 1, retake: 1 };
    if (step === 'edit') { renderEdit(m, s); return; }
    if (step === 'calib') { renderCalib(m, s); return; }
    if (quizSteps[step] && !(s.completedAt && s.calibration && s.calibration.choice && step === 'intro')) { renderQuiz(m, s, step === 'retake' ? 'day' : step); return; }
    if (s.completedAt && (!s.calibration || !s.calibration.choice)) { renderCalib(m, s); return; }
    if (s.profile) { renderSummary(m, s); return; }
    renderQuiz(m, s, 'intro');
  }
  function banner(s) {
    if (!(s.needsQuiz && s.migratedFromV44 && s.profile)) return '';
    const p = s.profile;
    const d = levelCard(p.targetKey.day, 'day'), n = levelCard(p.targetKey.night, 'night');
    return `<div class="urge-note"><b>You already started conditioning.</b> Your settings are kept. The old day target maps to ${esc(d.name)}. The old night target maps to ${esc(n.name)}. Take the intake quiz when you want level cards instead of a bare number.</div>`;
  }
  function renderQuiz(m, s, step) {
    const d = s.draft || {};
    d.day = d.day || {}; d.night = d.night || {}; d.gear = d.gear || {};
    const urge = quizOpts('urgency', [{ v: 0, l: 'Almost never' }, { v: 1, l: 'Sometimes' }, { v: 2, l: 'Often' }, { v: 3, l: 'Most days' }]);
    const sudden = quizOpts('warning', [{ v: 0, l: 'Plenty of warning' }, { v: 1, l: 'Some' }, { v: 2, l: 'A little' }, { v: 3, l: 'Basically none' }]);
    const hold = quizOpts('holdTime', [{ v: 0, l: 'An hour or more' }, { v: 1, l: '30–60 min' }, { v: 2, l: '10–30 min' }, { v: 3, l: 'Barely at all' }]);
    const trips = quizOpts('frequency', [{ v: 0, l: '≤ 6' }, { v: 1, l: '7–9' }, { v: 2, l: '10–12' }, { v: 3, l: '13+' }]);
    const leaks = quizOpts('leaks', [{ v: 0, l: 'None' }, { v: 1, l: '1–3' }, { v: 2, l: '4–10' }, { v: 3, l: '11+' }]);
    const wake = quizOpts('nightWake', [{ v: 0, l: 'I wake up and go' }, { v: 1, l: 'I wake up, eventually' }, { v: 2, l: 'I wake up too late sometimes' }, { v: 3, l: 'I sleep right through' }]);
    const hint = sleepHint();
    let body = '';
    if (step === 'intro') {
      body = `${banner(s)}<div class="urge-note"><b>Conditioning intake</b>
        <p>This is the way in. It asks where you are, where you want to go, and which practice you want. Both directions are available: less control, or more control. Game mode stays until you finish and consent.</p>
        <p>A real-need button stays free. The body check can pause the mode. You can reverse a track or stop later.</p>
        <button type="button" class="pill" data-act="start">Start the quiz</button></div>`;
    } else if (step === 'day') {
      body = `<div class="urge-note"><b>Day — where you are now</b>
        <div>Urge frequency</div>${optsHtml(urge, 'urgency', d.day.urgency)}
        <div>How sudden</div>${optsHtml(sudden, 'suddenness', d.day.suddenness)}
        <div>Hold after the first urge</div>${optsHtml(hold, 'hold', d.day.hold)}
        <div>Trips on a typical day</div>${optsHtml(trips, 'trips', d.day.trips)}
        <div>Day leaks in the last 30 days</div>${optsHtml(leaks, 'leaks30', d.day.leaks30)}
        <button type="button" class="pill" data-act="next" data-step="night">Next</button></div>`;
    } else if (step === 'night') {
      const wetOpts = [0, 1, 2, 3, 4, 5, 6, 7].map(v => ({ v: v, l: v === 0 ? 'None' : v + ' / week' }));
      body = `<div class="urge-note"><b>Night — where you are now</b>
        <div>Wet nights per week</div>${optsHtml(wetOpts, 'wetNights', d.night.wetNights)}
        <div>If the night is wet, do you wake?</div>${optsHtml(wake, 'wake', d.night.wake)}
        <div>Sleep depth${hint ? ' <span class="cal-legend">Imported ' + esc(hint.source) + (hint.date ? ' ' + esc(hint.date) : '') + ' suggests ' + ['light', 'normal', 'deep'][hint.depth] + '.</span>' : ' <span class="cal-legend">Type it here, or import LuckRing / JSON sleep under Sleep.</span>'}</div>
        ${optsHtml([{ v: 0, l: 'Light' }, { v: 1, l: 'Normal' }, { v: 2, l: 'Deep' }], 'depth', d.night.depth)}
        <button type="button" class="pill" data-act="back" data-step="day">Back</button>
        <button type="button" class="pill" data-act="next" data-step="gear">Next</button></div>`;
    } else if (step === 'gear') {
      const opts = gearLadder().map(g => `<option value="${g.id}">${esc(g.label)}</option>`).join('');
      const sel = (id, val) => `<label class="urge-lbl">${esc(id)} <select data-gear="${id}">${opts.replace(`value="${val || 'G6'}"`, `value="${val || 'G6'}" selected`)}</select></label>`;
      body = `<div class="urge-note"><b>Gear you wear now</b>
        ${sel('home', d.gear.home)}${sel('work', d.gear.work)}${sel('out', d.gear.out)}${sel('night', d.gear.night)}
        <div class="cal-legend">Home, work, out, and night can differ. A recommendation is computed at the end. It can disagree with what you wear.</div>
        <button type="button" class="pill" data-act="back" data-step="night">Back</button>
        <button type="button" class="pill" data-act="next" data-step="goalDay">Next</button></div>`;
    } else if (step === 'goalDay' || step === 'goalNight') {
      const track = step === 'goalNight' ? 'night' : 'day';
      const dir = track === 'night' ? d.nightDir : d.dayDir;
      body = `<div class="urge-note"><b>${track === 'day' ? 'Day' : 'Night'} — where you want to go</b>
        <div class="actions">
          <button type="button" class="pill" data-act="dir" data-track="${track}" data-dir="off">Off</button>
          <button type="button" class="pill" data-act="dir" data-track="${track}" data-dir="A">A — less control</button>
          <button type="button" class="pill" data-act="dir" data-track="${track}" data-dir="B">B — more control</button>
        </div>
        <div class="cal-legend">Chosen: ${esc(dir || '—')}</div>
        ${dir && dir !== 'off' ? cardsHtml(track, track === 'night' ? d.nightLevel : d.dayLevel) : '<div class="cal-legend">Off keeps this track out of conditioning.</div>'}
        <button type="button" class="pill" data-act="back" data-step="${track === 'night' ? 'goalDay' : 'gear'}">Back</button>
        <button type="button" class="pill" data-act="next" data-step="${track === 'night' ? 'want' : 'goalNight'}">Next</button></div>`;
    } else if (step === 'want') {
      body = `<div class="urge-note"><b>What you want out of it</b>
        ${GOALS.map(g => `<label class="urge-lbl"><input type="checkbox" data-goal="${g.id}" ${(d.goals || []).indexOf(g.id) >= 0 ? 'checked' : ''}> ${esc(g.l)}</label>`).join('')}
        <div>Intensity</div>
        ${optsHtml([{ v: 'gentle', l: 'Gentle' }, { v: 'steady', l: 'Steady' }, { v: 'intense', l: 'Intense' }], 'intensity', d.intensity || 'steady')}
        <div>Timeframe</div>
        ${optsHtml([{ v: 'open', l: 'Open-ended' }, { v: '1m', l: 'About 1 month' }, { v: '3m', l: 'About 3 months' }, { v: '6m', l: 'About 6 months' }], 'timeframe', d.timeframe || 'open')}
        <button type="button" class="pill" data-act="back" data-step="goalNight">Back</button>
        <button type="button" class="pill" data-act="next" data-step="methods">Next</button></div>`;
    } else if (step === 'methods') {
      if (!d.methods) d.methods = defaultMethods(d.goals, d.dayDir, d.nightDir);
      const block = (track, dir) => {
        const list = METHODS.filter(x => x.dir === dir && x.tracks.indexOf(track) >= 0);
        if (!dir || dir === 'off' || !list.length) return '';
        return `<div><b>${track} · ${dir}</b></div>` + list.map(x => `<label class="urge-lbl"><input type="checkbox" data-method="${x.id}" data-track="${track}" ${(d.methods[track] || []).indexOf(x.id) >= 0 ? 'checked' : ''}> <b>${esc(x.title)}</b> — ${esc(x.line)}</label>`).join('');
      };
      body = `<div class="urge-note"><b>Practice to opt into</b>
        <div class="cal-legend">Checked items follow the goals you picked. Turn any of them off.</div>
        ${block('day', d.dayDir)}${block('night', d.nightDir)}
        <button type="button" class="pill" data-act="back" data-step="want">Back</button>
        <button type="button" class="pill" data-act="next" data-step="consent">Next</button></div>`;
    } else if (step === 'consent') {
      body = `<div class="urge-note"><b>Consent and safety</b>
        <p>Conditioning is meant to change real habits, in the direction you picked. Weeks of practice can change real bladder control. Changes can take time to undo.</p>
        <p>A real-need button stays free. Pain, burning, blood, fever, or trouble emptying pauses the mode. Reverse and Stop stay in these settings.</p>
        <label class="urge-lbl"><input type="checkbox" id="obAdult" ${d.adult ? 'checked' : ''}> I'm an adult</label>
        <label class="urge-lbl"><input type="checkbox" id="obKnow" ${d.understand ? 'checked' : ''}> I understand this may change my real control</label>
        <label class="urge-lbl"><input type="checkbox" id="obRealD" ${d.realDay ? 'checked' : ''}> Count my real day results toward progress</label>
        <label class="urge-lbl"><input type="checkbox" id="obRealN" ${d.realNight ? 'checked' : ''}> Count my real night results toward progress</label>
        <label class="urge-lbl"><input type="checkbox" id="obFinish" ${d.finishOnToilet !== false ? 'checked' : ''}> After a partial, remind me to finish on the toilet</label>
        <div class="cal-legend">Fully emptying helps avoid retention and UTIs. This is a reminder, not a rule.</div>
        <label class="urge-lbl">Partial releases per day <input id="obCap" type="number" min="0" max="12" value="${d.dailyCap == null ? 4 : d.dailyCap}" style="width:56px"></label>
        <div id="obMsg" class="cal-legend"></div>
        <button type="button" class="pill" data-act="back" data-step="methods">Back</button>
        <button type="button" class="pill" data-act="finish">Save and continue</button></div>`;
    }
    m.innerHTML = body;
    bind(m);
  }
  function renderCalib(m) {
    const cap = capacityEstimate();
    m.innerHTML = `<div class="urge-note"><b>Baseline</b>
      <p>Check-ins every 3 days compare against this baseline and update each track’s estimate. The level on your card moves only after two check-ins in a row agree.</p>
      <button type="button" class="pill" data-act="calib" data-choice="diary">Start a 2–3 day baseline diary</button>
      <div class="cal-legend">Log drinks in the drink log. Log voids (volume optional), urges, leaks, and night wets on the practice card. A day you skip stays blank.</div>
      <button type="button" class="pill" data-act="calib" data-choice="skip">Skip and use my current bladder capacity estimate</button>
      <div class="cal-legend">${cap ? 'Saved calibration: about ' + Math.round(cap.ml) + ' ml.' : 'No measured capacity yet. Skipping uses the quiz starting level.'}</div></div>`;
    bind(m);
  }
  function renderSummary(m, s) {
    const p = s.profile;
    const row = track => {
      const cur = levelCard(p.levelKey[track], track);
      const goal = levelCard(p.targetKey[track], track);
      const pct = Math.round(progress(track) * 100);
      const adv = s.showAdvanced ? `<div class="cal-legend">Estimate ${Math.round(startEst(track))} → target ${Math.round(p.target[track])}</div>` : '';
      return `<div><b>${track === 'day' ? 'Day' : 'Night'}</b> ${esc(cur.name)} → ${esc(goal.name)}
        <div style="height:8px;background:#2d3436;border-radius:5px;overflow:hidden;margin:4px 0"><div style="height:100%;width:${pct}%;background:${track === 'day' ? '#55efc4' : '#a29bfe'}"></div></div>
        ${adv}</div>`;
    };
    const gear = p.gear && p.gear.recommended;
    const gline = gear ? `Recommended gear: day ${esc(gearName(gear.day))}, night ${esc(gearName(gear.night))}.` : '';
    const tasks = todayPlan();
    const review = s.habits.review && s.habits.review.text;
    const diaryOn = s.calibration && s.calibration.choice === 'diary' && (!s.calibration.until || Date.now() < s.calibration.until);
    m.innerHTML = `<div class="urge-note" id="condSummary"><b>My Conditioning</b>
      ${s.needsQuiz ? banner(s) : ''}
      ${row('day')}${row('night')}
      <div class="cal-legend">${esc(p.direction.day)} day · ${esc(p.direction.night)} night · ${esc(p.intensity)} · ${esc(p.timeframe)}</div>
      <div class="cal-legend">${gline}</div>
      <button type="button" class="pill" data-act="adv">${s.showAdvanced ? 'Hide numbers' : 'Advanced'}</button>
      <div><b>Today's practice</b></div>
      ${tasks.length ? tasks.map(t => `<div class="cal-legend">${t.cue ? esc(t.cue) + ' ' : ''}${esc(t.cueLabel)} — ${esc(t.text)} <button type="button" data-act="log" data-method="${t.id}" data-track="${t.track}">Done</button></div>`).join('') : '<div class="cal-legend">No practice opted in.</div>'}
      <div id="obLog" class="cal-legend"></div>
      ${review ? `<div><b>Weekly review</b><div class="cal-legend">${esc(review)}</div></div>` : ''}
      ${diaryOn ? `<div><b>Baseline diary</b>
        <button type="button" data-act="diary" data-kind="void">Void</button>
        <button type="button" data-act="diary" data-kind="urge">Urge</button>
        <button type="button" data-act="diary" data-kind="leak">Leak</button>
        <button type="button" data-act="diary" data-kind="nightwet">Night wet</button>
        <label class="urge-lbl">ml <input id="obMl" type="number" min="0" style="width:72px" placeholder="optional"></label>
        <div class="cal-legend">Drinks stay in the drink log. A blank volume is not zero.</div></div>` : ''}
      <div class="actions">
        <button type="button" data-act="edit">Edit</button>
        <button type="button" data-act="retake">Retake quiz</button>
        <button type="button" data-act="reverse" data-track="day">Reverse day</button>
        <button type="button" data-act="reverse" data-track="night">Reverse night</button>
        <button type="button" data-act="stop">Stop conditioning</button>
      </div></div>`;
    bind(m);
  }
  function renderEdit(m, s) {
    const p = s.profile || {};
    m.innerHTML = `<div class="urge-note"><b>Edit profile</b>
      <div>Day</div><div class="actions"><button type="button" data-act="edir" data-track="day" data-dir="off">Off</button><button type="button" data-act="edir" data-track="day" data-dir="A">A</button><button type="button" data-act="edir" data-track="day" data-dir="B">B</button></div>
      ${cardsHtml('day', p.targetKey && p.targetKey.day)}
      <div>Night</div><div class="actions"><button type="button" data-act="edir" data-track="night" data-dir="off">Off</button><button type="button" data-act="edir" data-track="night" data-dir="A">A</button><button type="button" data-act="edir" data-track="night" data-dir="B">B</button></div>
      ${cardsHtml('night', p.targetKey && p.targetKey.night)}
      ${GOALS.map(g => `<label class="urge-lbl"><input type="checkbox" data-goal="${g.id}" ${(p.goals || []).indexOf(g.id) >= 0 ? 'checked' : ''}> ${esc(g.l)}</label>`).join('')}
      <div>Intensity</div>
      ${optsHtml([{ v: 'gentle', l: 'Gentle' }, { v: 'steady', l: 'Steady' }, { v: 'intense', l: 'Intense' }], 'intensity', p.intensity || 'steady')}
      <div>Timeframe</div>
      ${optsHtml([{ v: 'open', l: 'Open-ended' }, { v: '1m', l: 'About 1 month' }, { v: '3m', l: 'About 3 months' }, { v: '6m', l: 'About 6 months' }], 'timeframe', p.timeframe || 'open')}
      <div><b>Practice</b></div>
      ${['day', 'night'].map(track => METHODS.filter(x => x.tracks.indexOf(track) >= 0 && x.dir === ((p.direction && p.direction[track]) || 'off')).map(x => `<label class="urge-lbl"><input type="checkbox" data-method="${x.id}" data-track="${track}" ${((p.methods && p.methods[track]) || []).indexOf(x.id) >= 0 ? 'checked' : ''}> ${esc(x.title)} <span class="cal-legend">${esc(x.line)}</span></label>`).join('')).join('')}
      <button type="button" class="pill" data-act="save-edit">Save</button>
      <button type="button" data-act="cancel-edit">Cancel</button></div>`;
    bind(m);
  }
  function startEst(track) {
    try { return window.BSControl.trackState(track).estimate; } catch (e) {}
    const p = load().profile;
    return p ? p.starting[track] : 0;
  }
  function gearName(id) {
    const g = gearLadder().find(x => x.id === id);
    return g ? g.label : id;
  }
  function readDraft(m, s) {
    const d = s.draft || {};
    d.day = d.day || {}; d.night = d.night || {}; d.gear = d.gear || {};
    const radio = name => { const el = m.querySelector(`input[name="${name}"]:checked`); return el ? el.value : undefined; };
    ['urgency', 'suddenness', 'hold', 'trips', 'leaks30'].forEach(k => { const v = radio(k); if (v != null) d.day[k] = +v; });
    ['wetNights', 'wake', 'depth'].forEach(k => { const v = radio(k); if (v != null) d.night[k] = +v; });
    const inten = radio('intensity'); if (inten) d.intensity = inten;
    const tf = radio('timeframe'); if (tf) d.timeframe = tf;
    m.querySelectorAll('[data-gear]').forEach(el => { d.gear[el.getAttribute('data-gear')] = el.value; });
    if (m.querySelector('[data-goal]')) d.goals = Array.from(m.querySelectorAll('[data-goal]:checked')).map(el => el.getAttribute('data-goal'));
    if (m.querySelector('[data-method]')) {
      d.methods = { day: [], night: [] };
      m.querySelectorAll('[data-method]:checked').forEach(el => {
        const t = el.getAttribute('data-track') === 'night' ? 'night' : 'day';
        d.methods[t].push(el.getAttribute('data-method'));
      });
    }
    const adult = m.querySelector('#obAdult'); if (adult) d.adult = adult.checked;
    const know = m.querySelector('#obKnow'); if (know) d.understand = know.checked;
    const rd = m.querySelector('#obRealD'); if (rd) d.realDay = rd.checked;
    const rn = m.querySelector('#obRealN'); if (rn) d.realNight = rn.checked;
    const fin = m.querySelector('#obFinish'); if (fin) d.finishOnToilet = fin.checked;
    const cap = m.querySelector('#obCap'); if (cap) d.dailyCap = +cap.value;
    s.draft = d;
    return d;
  }
  function bind(m) {
    m.onclick = ev => {
      const t = ev.target.closest('[data-act]'); if (!t || !m.contains(t)) return;
      const s = load();
      const act = t.getAttribute('data-act');
      if (act === 'start') {
        s.quizStep = 'day';
        s.draft = Object.assign({ day: {}, night: {}, gear: {}, goals: [], intensity: 'steady', timeframe: 'open', finishOnToilet: true, dailyCap: 4 }, prefillFromQuiz() || {});
        const hint = sleepHint();
        if (hint && s.draft.night && s.draft.night.depth == null) s.draft.night.depth = hint.depth;
        save(s); render(); return;
      }
      if (act === 'back' || act === 'next') {
        readDraft(m, s);
        if (act === 'next' && t.getAttribute('data-step') === 'methods' && !s.draft.methods) s.draft.methods = defaultMethods(s.draft.goals, s.draft.dayDir, s.draft.nightDir);
        s.quizStep = t.getAttribute('data-step');
        save(s); render(); return;
      }
      if (act === 'dir') {
        readDraft(m, s);
        const track = t.getAttribute('data-track') === 'night' ? 'night' : 'day';
        s.draft[track === 'night' ? 'nightDir' : 'dayDir'] = t.getAttribute('data-dir');
        s.draft.methods = null;
        save(s); render(); return;
      }
      if (act === 'level') {
        readDraft(m, s);
        const track = t.getAttribute('data-track') === 'night' ? 'night' : 'day';
        s.draft[track === 'night' ? 'nightLevel' : 'dayLevel'] = t.getAttribute('data-level');
        save(s); render(); return;
      }
      if (act === 'finish') {
        const d = readDraft(m, s);
        const r = finishQuiz(d);
        const msg = m.querySelector('#obMsg');
        if (!r.ok) { if (msg) msg.textContent = 'Both boxes are required.'; return; }
        render(); return;
      }
      if (act === 'calib') { chooseCalib(t.getAttribute('data-choice')); render(); return; }
      if (act === 'adv') { s.showAdvanced = !s.showAdvanced; s.quizStep = 'summary'; save(s); render(); return; }
      if (act === 'log') {
        const r = logBehaviour(t.getAttribute('data-method'), t.getAttribute('data-track'));
        render();
        const msg = document.getElementById('obLog'); if (msg) msg.textContent = r.text;
        return;
      }
      if (act === 'diary') {
        const ml = document.getElementById('obMl');
        logDiary(t.getAttribute('data-kind'), { ml: ml && ml.value !== '' ? +ml.value : null });
        render(); return;
      }
      if (act === 'edit') { s.quizStep = 'edit'; save(s); render(); return; }
      if (act === 'cancel-edit') { s.quizStep = 'summary'; save(s); render(); return; }
      if (act === 'save-edit') {
        const goals = Array.from(m.querySelectorAll('[data-goal]:checked')).map(el => el.getAttribute('data-goal'));
        const p = s.profile;
        const methods = { day: [], night: [] };
        m.querySelectorAll('[data-method]:checked').forEach(el => {
          const track = el.getAttribute('data-track') === 'night' ? 'night' : 'day';
          methods[track].push(el.getAttribute('data-method'));
        });
        const intenEl = m.querySelector('input[name="intensity"]:checked');
        const timeEl = m.querySelector('input[name="timeframe"]:checked');
        updateProfile({ goals: goals, dayDir: p.direction.day, nightDir: p.direction.night, dayLevel: p.targetKey.day, nightLevel: p.targetKey.night, methods: methods, intensity: intenEl ? intenEl.value : p.intensity, timeframe: timeEl ? timeEl.value : p.timeframe });
        const n = load(); n.quizStep = 'summary'; save(n); render(); return;
      }
      if (act === 'edir') {
        const track = t.getAttribute('data-track') === 'night' ? 'night' : 'day';
        updateProfile(track === 'night' ? { nightDir: t.getAttribute('data-dir') } : { dayDir: t.getAttribute('data-dir') });
        render(); return;
      }
      if (act === 'retake') {
        s.quizStep = 'day';
        s.draft = Object.assign({ day: {}, night: {}, gear: {}, goals: s.profile.goals || [], intensity: s.profile.intensity, timeframe: s.profile.timeframe }, prefillFromQuiz() || {});
        save(s); render(); return;
      }
      if (act === 'reverse') { try { window.BSConsent && window.BSConsent.reverse(t.getAttribute('data-track')); } catch (e) {} render(); return; }
      if (act === 'stop') { try { window.BSConsent && window.BSConsent.stop(); } catch (e) {} render(); return; }
    };
    const levelBtns = m.querySelectorAll('[data-act="level"]');
    if (m.querySelector('[data-act="edir"]')) {
      m.querySelectorAll('[data-act="level"]').forEach(btn => {
        btn.onclick = ev => {
          ev.stopPropagation();
          const track = btn.getAttribute('data-track') === 'night' ? 'night' : 'day';
          const patch = track === 'night' ? { nightLevel: btn.getAttribute('data-level') } : { dayLevel: btn.getAttribute('data-level') };
          updateProfile(patch);
          const n = load(); n.quizStep = 'edit'; save(n); render();
        };
      });
    }
  }
  try { migrateV44(); } catch (e) {}
  window.BSOnboard = {
    KEY, LIFE, GOALS, METHODS, load, save, scoreNow, scoreDay, scoreNight, bandOf, midOf, levelCard, defaultMethods,
    prefillFromQuiz, sleepHint, recommendGear, metricsFrom, finishQuiz, chooseCalib, capacityEstimate, updateProfile,
    migrateV44, playProfile, pickerOption, rollMods, sessionPlan, capSessionMl, todayPlan, logBehaviour,
    considerPromotion, nightAPoints, weeklyReview, onCheckIn, logDiary, diaryMetrics, progress, cuesFor, render
  };
  try { window.addEventListener('load', () => { try { render(); } catch (e) {} }); } catch (e) {}
})();
