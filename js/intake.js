/* ===========================
   intake.js — v46 conditioning intake questions and scoring.
   The screens are the existing quiz runner (BSQuiz.runFlow): one question,
   option cards, progress bar, personality-style result. This file is the
   question list and the now/want math. It does not draw its own quiz.
   Wetting in thicker gear counts less toward low control than the same
   ending in underwear. Context adds a little weight (an office counts more
   than the couch).
   =========================== */
(function () {
  const GEAR_W = { underwear: 1.35, pad: 1.15, training: 1.05, pullup: 0.9, diaper: 0.6, thick: 0.4 };
  const CTX_W = { office: 1.15, out: 1.1, friend: 1.1, car: 1.05, home: 0.95, movie: 1, laugh: 1, sneeze: 1, drink: 1, bed: 1, nap: 0.95, wake: 1, dream: 0.85 };
  const HAPPENS = [
    { v: 0, l: 'You make it to the toilet dry' },
    { v: 1, l: 'A few drops on the way, then you make it' },
    { v: 2, l: 'Partly wet, and you still get there' },
    { v: 3, l: 'Fully wet before you get there' },
    { v: 4, l: 'You only notice afterwards' }
  ];
  const NIGHT = [
    { v: 0, l: 'You wake and get to the toilet dry' },
    { v: 1, l: 'You wake a little damp and still get up' },
    { v: 2, l: 'You wake wet, stay a moment, then get up' },
    { v: 3, l: 'You wake already wet and stay in bed' },
    { v: 4, l: 'You sleep through it and notice in the morning' }
  ];
  const GEAR_OPTS = [
    { v: 'G6', l: 'Underwear' }, { v: 'G5', l: 'Training pants' }, { v: 'G4', l: 'A pad or liner' },
    { v: 'G3', l: 'A pull-up' }, { v: 'G2', l: 'A thin diaper or overnight pull-up' },
    { v: 'G1', l: 'A diaper' }, { v: 'G0', l: 'A thick diaper' }
  ];
  const DAY = [
    ['home_couch', 'underwear', 'home', 'Underwear on the couch at home. A slow urge builds through an episode. What happens?'],
    ['office_pad', 'pad', 'office', 'A pad under your work clothes. A sudden strong urge hits at your desk. What happens?'],
    ['shop_train', 'training', 'out', 'Training pants while you are out shopping. The urge shows up fast in the aisle. What happens?'],
    ['office_pull', 'pullup', 'office', 'You are wearing a pull-up at the office and feel a sudden strong urge. What happens?'],
    ['movie_diaper', 'diaper', 'movie', 'A diaper on the couch for a movie. The urge creeps up and you do not want to pause it. What happens?'],
    ['drink_thick', 'thick', 'drink', 'A thick diaper at home after a big drink. The urge arrives gradually. What happens?'],
    ['car_undi', 'underwear', 'car', 'Underwear in the car. The urge turns sharp before the next stop. What happens?'],
    ['friend_pad', 'pad', 'friend', 'A pad at a friend\'s place. You laugh hard and the urge jumps. What happens?'],
    ['sneeze_pull', 'pullup', 'sneeze', 'A pull-up at home. A sneeze catches you while you already need to go. What happens?'],
    ['shop_diaper', 'diaper', 'out', 'A diaper while you are out. A sudden urge hits with no toilet nearby. What happens?'],
    ['drink_train', 'training', 'drink', 'Training pants at home after a big drink. The urge builds while you are busy. What happens?'],
    ['movie_undi', 'underwear', 'movie', 'Underwear during a movie. You stay in your seat as the urge grows. What happens?']
  ];
  const NIGHTS = [
    ['bed_undi', 'underwear', 'wake', 'Underwear in bed. You wake in the night with an urge. What happens?'],
    ['bed_pad_dream', 'pad', 'dream', 'A pad in bed. The urge shows up inside a dream. What happens?'],
    ['nap_pull', 'pullup', 'nap', 'A pull-up during a nap. You start to surface with an urge. What happens?'],
    ['bed_diaper_morn', 'diaper', 'wake', 'A diaper in bed. You have just woken up. What happened in the night?'],
    ['bed_thick_dream', 'thick', 'dream', 'A thick diaper in bed. Sleep stays deep. What happens?'],
    ['nap_train', 'training', 'nap', 'Training pants for a nap. You wake halfway through. What happens?'],
    ['bed_pad_morn', 'pad', 'wake', 'A pad in bed, the moment you wake in the morning. What do you find?'],
    ['bed_pull_wake', 'pullup', 'wake', 'A pull-up in bed. A sudden urge wakes you. What happens?']
  ];
  const TITLES = {
    full: { day: 'Dry Day Captain', night: 'The All-Night Dry Spell' },
    good: { day: 'Mostly Makes It', night: 'Pad on Standby' },
    okay: { day: 'Pull-Up Backup', night: 'A Few Damp Mornings' },
    shaky: { day: 'Coin-Flip Days', night: 'Some Wet Nights' },
    little: { day: 'Diaper Does the Day', night: 'Toddler Nights' },
    none: { day: 'It Just Happens', night: 'Sleeps Right Through' }
  };
  function sceneQuestions(rows, track, phase, opts) {
    const step = phase === 'now'
      ? (track === 'day' ? 'Where you are now · Day' : 'Where you are now · Night')
      : (track === 'day' ? 'Where you want to be · Day' : 'Where you want to be · Night');
    const section = track + (phase === 'now' ? 'Now' : 'Want');
    return rows.map(row => ({
      id: phase === 'now' ? row[0] : row[0] + '_want',
      pair: row[0],
      phase: phase,
      track: track,
      kind: 'situation',
      gear: row[1],
      context: row[2],
      scale: 4,
      section: section,
      step: step,
      q: phase === 'now' ? row[3] : ('Where you want this to land. ' + row[3]),
      opts: opts
    }));
  }
  function signalQuestions() {
    const step = 'Signals and gear';
    const scale = [
      { v: 0, l: 'Clear, with plenty of time' },
      { v: 1, l: 'Usually enough warning' },
      { v: 2, l: 'Short warning' },
      { v: 3, l: 'It surprises you' }
    ];
    return [
      { id: 'gear_home', kind: 'choice', section: 'signals', step: step, q: 'Around the house, what do you usually wear?', opts: GEAR_OPTS },
      { id: 'gear_work', kind: 'choice', section: 'signals', step: step, q: 'At work or the office, what do you usually wear?', opts: GEAR_OPTS },
      { id: 'gear_out', kind: 'choice', section: 'signals', step: step, q: 'Out shopping or on errands, what do you usually wear?', opts: GEAR_OPTS },
      { id: 'gear_night', kind: 'choice', section: 'signals', step: step, q: 'In bed, what do you usually wear?', opts: GEAR_OPTS },
      { id: 'sig_clear', kind: 'scale', scale: 3, section: 'signals', step: step, q: 'By day, how much warning do your signals give you?', opts: scale },
      { id: 'sig_notice', kind: 'scale', scale: 3, section: 'signals', step: step, q: 'When your gear is wet, when do you notice?', opts: [
        { v: 0, l: 'Right away' }, { v: 1, l: 'Within a few minutes' }, { v: 2, l: 'When you check' }, { v: 3, l: 'Often only afterwards' }
      ] },
      { id: 'sig_hold', kind: 'scale', scale: 3, section: 'signals', step: step, q: 'After the first "I should go", how long can you comfortably wait?', opts: [
        { v: 0, l: 'An hour or more' }, { v: 1, l: 'About half an hour' }, { v: 2, l: 'A few minutes' }, { v: 3, l: 'Barely at all' }
      ] },
      { id: 'sig_leaks', kind: 'scale', scale: 3, section: 'signals', step: step, q: 'Daytime leaks in the last 30 days?', opts: [
        { v: 0, l: 'None' }, { v: 1, l: 'One to three' }, { v: 2, l: 'A handful' }, { v: 3, l: 'Most weeks have one' }
      ] }
    ];
  }
  function goalQuestions() {
    const step = 'What you want out of it';
    const goals = (window.BSOnboard && window.BSOnboard.GOALS) || [
      { id: 'bedwetting', l: 'Bedwetting' }, { id: 'urgency', l: 'Urgency — not quite making it' },
      { id: 'thin', l: 'Wetting in thin gear or underwear' }, { id: 'relaxed', l: 'Relaxed, passive wetting' },
      { id: 'control', l: 'More control / staying dry' }, { id: 'deeper', l: 'Deeper sleep' }
    ];
    return [
      { id: 'goals', kind: 'multi', multi: true, section: 'goals', step: step, q: 'What do you want out of conditioning? Pick any.', opts: goals.map(g => ({ v: g.id, l: g.l })) },
      { id: 'intensity', kind: 'choice', section: 'goals', step: step, q: 'How fast should the daily practice grow?', opts: [
        { v: 'gentle', l: 'Gentle — one small task, and it stays easy for a while' },
        { v: 'steady', l: 'Steady — a couple of tasks, a bit harder after a streak' },
        { v: 'intense', l: 'Intense — more tasks, and they step up sooner' }
      ] },
      { id: 'timeframe', kind: 'choice', section: 'goals', step: step, q: 'What timeframe feels right?', opts: [
        { v: 'open', l: 'Open-ended' }, { v: '1m', l: 'About a month' }, { v: '3m', l: 'About three months' }, { v: '6m', l: 'About six months' }
      ] }
    ];
  }
  function methodQuestions() {
    const step = 'Practice to opt into';
    const all = (window.BSOnboard && window.BSOnboard.METHODS) || [];
    const opt = m => ({ v: m.id, l: m.title + ' — ' + m.line });
    const day = all.filter(m => m.tracks.indexOf('day') >= 0).map(opt);
    const night = all.filter(m => m.tracks.indexOf('night') >= 0).map(opt);
    return [
      { id: 'methods_day', kind: 'multi', multi: true, section: 'methods', step: step, q: 'Day practice. Leave these blank to use the ones that match your goals. Tick any you want.', opts: day },
      { id: 'methods_night', kind: 'multi', multi: true, section: 'methods', step: step, q: 'Night practice. Blank means the goal defaults. Tick any you want.', opts: night }
    ];
  }
  function feelingQuestions() {
    const step = 'How it feels';
    const section = 'feelings';
    return [
      { id: 'feel_day', kind: 'choice', optional: true, section: section, step: step, q: 'A wet day, when it happens. How do you feel about it?', opts: [
        { v: 'rather_not', l: 'Rather not' }, { v: 'backup', l: 'Fine if it was only a backup' },
        { v: 'cozy', l: 'Cozy, honestly' }, { v: 'like', l: 'You like when it happens' }
      ] },
      { id: 'feel_night', kind: 'choice', optional: true, section: section, step: step, q: 'A wet night. What do you want that morning to be?', opts: [
        { v: 'wake_dry', l: 'Awake and dry, you got up' }, { v: 'wake_damp', l: 'You woke and dealt with it' },
        { v: 'stay', l: 'Wet, and you stayed until morning' }, { v: 'sleep', l: 'You slept through it' }
      ] },
      { id: 'feel_change', kind: 'choice', optional: true, section: section, step: step, q: 'When gear is wet, a change usually happens…', opts: [
        { v: 'soon', l: 'Soon' }, { v: 'later', l: 'When it is convenient' },
        { v: 'full', l: 'When it is really used' }, { v: 'morning', l: 'With the morning routine' }
      ] },
      { id: 'feel_thicker', kind: 'choice', optional: true, section: section, step: step, q: 'Night gear compared with day gear?', opts: [
        { v: 'same', l: 'About the same' }, { v: 'thicker', l: 'Thicker at night' },
        { v: 'thinner', l: 'Thinner at night' }, { v: 'either', l: 'Whatever the day needs' }
      ] }
    ];
  }
  function questions() {
    return []
      .concat(sceneQuestions(DAY, 'day', 'now', HAPPENS))
      .concat(sceneQuestions(NIGHTS, 'night', 'now', NIGHT))
      .concat(signalQuestions())
      .concat(sceneQuestions(DAY, 'day', 'want', HAPPENS))
      .concat(sceneQuestions(NIGHTS, 'night', 'want', NIGHT))
      .concat(goalQuestions())
      .concat(methodQuestions())
      .concat(feelingQuestions());
  }
  function sectionCounts(list) {
    const c = {};
    (list || questions()).forEach(q => { const k = q.step || q.section; c[k] = (c[k] || 0) + 1; });
    return c;
  }
  function pairs(list) {
    list = list || questions();
    const now = list.filter(q => q.kind === 'situation' && q.phase === 'now');
    return now.map(q => {
      const want = list.find(w => w.phase === 'want' && w.pair === q.id);
      return { now: q, want: want };
    });
  }
  function penalty(q, v) {
    const scale = q.scale == null ? 4 : q.scale;
    const raw = Math.max(0, Math.min(scale, +v || 0)) / scale;
    return Math.min(1, raw * (GEAR_W[q.gear] || 1) * (CTX_W[q.context] || 1));
  }
  function controlFor(q, v) { return Math.round(100 * (1 - penalty(q, v))); }
  function meanControl(qs, ans) {
    let n = 0, s = 0;
    qs.forEach(q => {
      if (!ans || ans[q.id] == null || ans[q.id] === '') return;
      n++; s += 100 * (1 - penalty(q, ans[q.id]));
    });
    return n ? s / n : null;
  }
  function readiness(ans) {
    const ids = ['sig_clear', 'sig_notice', 'sig_hold', 'sig_leaks'];
    let n = 0, s = 0;
    ids.forEach(id => {
      if (!ans || ans[id] == null || ans[id] === '') return;
      n++; s += 100 * (1 - Math.max(0, Math.min(3, +ans[id])) / 3);
    });
    return n ? s / n : null;
  }
  function blend(sit, ready) {
    if (sit == null) return ready == null ? null : Math.round(ready);
    if (ready == null) return Math.round(Math.max(0, Math.min(100, sit)));
    return Math.round(Math.max(0, Math.min(100, sit * 0.75 + ready * 0.25)));
  }
  function bandOf(v) {
    try { if (window.BSOnboard && window.BSOnboard.bandOf) return window.BSOnboard.bandOf(v); } catch (e) {}
    try { if (window.BSControl && window.BSControl.levelFor) return window.BSControl.levelFor(v).key; } catch (e) {}
    const x = Math.max(0, Math.min(100, +v || 0));
    if (x >= 92) return 'full'; if (x >= 80) return 'good'; if (x >= 60) return 'okay';
    if (x >= 40) return 'shaky'; if (x >= 20) return 'little'; return 'none';
  }
  function dirOf(now, want) {
    if (now == null || want == null) return 'off';
    if (want <= now - 8) return 'A';
    if (want >= now + 8) return 'B';
    return 'off';
  }
  function scoreIntake(ans) {
    ans = ans || {};
    const list = questions();
    const daySit = meanControl(list.filter(q => q.kind === 'situation' && q.track === 'day' && q.phase === 'now'), ans);
    const nightSit = meanControl(list.filter(q => q.kind === 'situation' && q.track === 'night' && q.phase === 'now'), ans);
    const dayWant = meanControl(list.filter(q => q.kind === 'situation' && q.track === 'day' && q.phase === 'want'), ans);
    const nightWant = meanControl(list.filter(q => q.kind === 'situation' && q.track === 'night' && q.phase === 'want'), ans);
    const dayNow = blend(daySit, readiness(ans));
    const nightNow = nightSit == null ? null : Math.round(Math.max(0, Math.min(100, nightSit)));
    const dayDir = dirOf(dayNow, dayWant == null ? null : Math.round(dayWant));
    const nightDir = dirOf(nightNow, nightWant == null ? null : Math.round(nightWant));
    const goals = new Set(Array.isArray(ans.goals) ? ans.goals : []);
    if (dayDir === 'A') { goals.add('urgency'); goals.add('thin'); }
    if (nightDir === 'A') goals.add('bedwetting');
    if (dayDir === 'B' || nightDir === 'B') goals.add('control');
    if (ans.feel_day === 'like' || ans.feel_day === 'cozy') goals.add('relaxed');
    if (ans.feel_night === 'sleep' || ans.feel_night === 'stay') { goals.add('deeper'); goals.add('bedwetting'); }
    const goalList = Array.from(goals);
    let methods = { day: [], night: [] };
    try {
      if (window.BSOnboard && window.BSOnboard.defaultMethods) methods = window.BSOnboard.defaultMethods(goalList, dayDir, nightDir);
    } catch (e) {}
    ['day', 'night'].forEach(track => {
      const picked = ans['methods_' + track];
      if (!picked || !picked.length || !window.BSOnboard || !window.BSOnboard.METHODS) return;
      const dir = track === 'night' ? nightDir : dayDir;
      const allow = {};
      window.BSOnboard.METHODS.forEach(m => { if (m.dir === dir && m.tracks.indexOf(track) >= 0) allow[m.id] = 1; });
      const kept = picked.filter(id => allow[id]);
      if (kept.length) methods[track] = kept;
    });
    const dw = dayWant == null ? dayNow : Math.round(Math.max(0, Math.min(100, dayWant)));
    const nw = nightWant == null ? nightNow : Math.round(Math.max(0, Math.min(100, nightWant)));
    return {
      dayNow: dayNow, nightNow: nightNow, dayWant: dw, nightWant: nw,
      dayDir: dayDir, nightDir: nightDir,
      dayKey: bandOf(dayNow), nightKey: bandOf(nightNow),
      dayTargetKey: dayDir === 'off' ? bandOf(dayNow) : bandOf(dw),
      nightTargetKey: nightDir === 'off' ? bandOf(nightNow) : bandOf(nw),
      goals: goalList, methods: methods,
      titles: {
        dayNow: (TITLES[bandOf(dayNow)] || {}).day || '',
        nightNow: (TITLES[bandOf(nightNow)] || {}).night || '',
        dayWant: (TITLES[bandOf(dw)] || {}).day || '',
        nightWant: (TITLES[bandOf(nw)] || {}).night || ''
      }
    };
  }
  function skipSectionFrom(list, i) {
    list = list || questions();
    const sec = list[i] && list[i].section;
    let j = i;
    while (j < list.length && list[j].section === sec) j++;
    return j;
  }
  function resumeIndex(saved, list) {
    list = list || questions();
    if (!saved || saved.i == null) return 0;
    return Math.max(0, Math.min(list.length, saved.i | 0));
  }
  function wornGear(ans) {
    ans = ans || {};
    return {
      home: ans.gear_home || 'G6',
      work: ans.gear_work || ans.gear_home || 'G6',
      out: ans.gear_out || ans.gear_home || 'G6',
      night: ans.gear_night || 'G6'
    };
  }
  window.BSIntake = {
    GEAR_W, CTX_W, HAPPENS, NIGHT, TITLES, questions, sectionCounts, pairs, penalty, controlFor,
    scoreIntake, skipSectionFrom, resumeIndex, wornGear, bandOf
  };
})();
