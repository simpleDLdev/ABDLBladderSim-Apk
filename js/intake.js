/* ===========================
   intake.js — v47 conditioning quiz.
   Varied questions, one subject each, in the Quiz A / Quiz B style.
   The shared runner (BSQuiz.runFlow) draws them. Each scored answer is a
   dimension with a now value and a want value ("keep as is" copies now).
   Pacing mixes now → target for the sim. Instant is the target today.
   Gradual and slow burn move only when check-ins agree. Hybrid sims at the
   target while real-habit practice stays on the gradual curve.
   =========================== */
(function () {
  const KEEP = { v: 'keep', l: 'Keep this as it is' };
  const TITLES = {
    full: { day: 'Dry Day Captain', night: 'The All-Night Dry Spell' },
    good: { day: 'Mostly Makes It', night: 'Pad on Standby' },
    okay: { day: 'Pull-Up Backup', night: 'A Few Damp Mornings' },
    shaky: { day: 'Coin-Flip Days', night: 'Some Wet Nights' },
    little: { day: 'Diaper Does the Day', night: 'Toddler Nights' },
    none: { day: 'It Just Happens', night: 'Sleeps Right Through' }
  };
  const GEAR_OPTS = [
    { v: 'G6', l: 'Underwear' }, { v: 'G5', l: 'Training pants' }, { v: 'G4', l: 'A pad or liner' },
    { v: 'G3', l: 'A pull-up' }, { v: 'G1', l: 'A diaper' }, { v: 'G0', l: 'A thick diaper' }
  ];
  function scored(id, section, step, text, opts, extra) {
    return Object.assign({ id: id, section: section, step: step, q: text, opts: opts, kind: 'scale' }, extra || {});
  }
  function questions() {
    const dayNow = 'Current control · Day';
    const nightNow = 'Current control · Night';
    const dayWant = 'Desired control · Day';
    const nightWant = 'Desired control · Night';
    const list = [
      scored('d_hold', 'dayNow', dayNow, 'After the first urge in the daytime, how long can you usually wait?', [
        { v: 'hour', l: 'An hour or more', c: 100 }, { v: 'half', l: 'About 30–60 minutes', c: 75 },
        { v: 'ten', l: 'About 10–30 minutes', c: 50 }, { v: 'few', l: 'A few minutes', c: 25 }, { v: 'none', l: 'Barely at all', c: 0 }
      ], { dim: 'hold', track: 'day', phase: 'now' }),
      scored('d_warn', 'dayNow', dayNow, 'How much warning do you get before a daytime urge turns urgent?', [
        { v: 'plenty', l: 'Plenty of time', c: 100 }, { v: 'some', l: 'Some warning', c: 66 },
        { v: 'little', l: 'A little warning', c: 33 }, { v: 'none', l: 'Almost none', c: 0 }
      ], { dim: 'warning', track: 'day', phase: 'now' }),
      scored('d_sudden', 'dayNow', dayNow, 'How do daytime urges usually show up?', [
        { v: 'slow', l: 'They build slowly', c: 100 }, { v: 'mix', l: 'A mix of slow and sudden', c: 60 },
        { v: 'often', l: 'Often a sudden spike', c: 30 }, { v: 'spike', l: 'Almost always a spike', c: 0 }
      ], { dim: 'sudden', track: 'day', phase: 'now' }),
      scored('d_trips', 'dayNow', dayNow, 'How many pees on a typical day?', [
        { v: '6', l: '6 or fewer', c: 100 }, { v: '9', l: '7–9', c: 66 }, { v: '12', l: '10–12', c: 33 }, { v: '13', l: '13 or more', c: 0 }
      ], { dim: 'trips', track: 'day', phase: 'now' }),
      scored('d_volume', 'dayNow', dayNow, 'About how much is a typical daytime void? You can use a saved calibration instead.', [
        { v: 'small', l: 'Under about 150 ml', c: 20 }, { v: 'mid', l: 'About 150–250 ml', c: 45 },
        { v: 'full', l: 'About 250–400 ml', c: 75 }, { v: 'large', l: 'Over about 400 ml', c: 95 },
        { v: 'calib', l: 'Use my calibration estimate', c: null }
      ], { dim: 'volume', track: 'day', phase: 'now' }),
      scored('d_leak', 'dayNow', dayNow, 'How often do you leak, or not quite make it, during the day?', [
        { v: 'never', l: 'Almost never', c: 100 }, { v: 'month', l: 'A few times a month', c: 70 },
        { v: 'week', l: 'About weekly', c: 40 }, { v: 'days', l: 'Most days', c: 0 }
      ], { dim: 'leaks', track: 'day', phase: 'now' }),
      scored('d_dribble', 'dayNow', dayNow, 'Dribbles just before you pee, or just after you finish?', [
        { v: 'rare', l: 'Rarely', c: 100 }, { v: 'some', l: 'Sometimes', c: 60 },
        { v: 'often', l: 'Often', c: 30 }, { v: 'always', l: 'Almost every time', c: 0 }
      ], { dim: 'dribble', track: 'day', phase: 'now' }),
      scored('d_stress', 'dayNow', dayNow, 'Do coughs, sneezes, or a hard laugh cause a leak?', [
        { v: 'no', l: 'No', c: 100 }, { v: 'drop', l: 'A drop sometimes', c: 60 },
        { v: 'often', l: 'Often a leak', c: 25 }, { v: 'most', l: 'A leak most of those times', c: 0 }
      ], { dim: 'stress', track: 'day', phase: 'now' }),
      scored('d_full', 'dayNow', dayNow, 'How well can you tell how full your bladder is, before it is urgent?', [
        { v: 'gauge', l: 'Clearly, like a gauge', c: 100 }, { v: 'rough', l: 'Roughly', c: 66 },
        { v: 'late', l: 'Only when it is nearly full', c: 30 }, { v: 'no', l: 'I usually cannot tell', c: 0 }
      ], { dim: 'fullness', track: 'day', phase: 'now' }),
      scored('d_notice', 'dayNow', dayNow, 'If your gear is already wet, when do you notice?', [
        { v: 'now', l: 'Right away', c: 100 }, { v: 'min', l: 'Within a few minutes', c: 70 },
        { v: 'check', l: 'When I check', c: 35 }, { v: 'after', l: 'Often only afterwards', c: 0 }
      ], { dim: 'notice', track: 'day', phase: 'now' }),
      scored('d_putoff', 'dayNow', dayNow, 'Do you put off going until it is late?', [
        { v: 'early', l: 'I go when I first notice', c: 100 }, { v: 'some', l: 'Sometimes I wait', c: 60 },
        { v: 'usual', l: 'I usually wait', c: 30 }, { v: 'always', l: 'I wait until I have to rush', c: 0 }
      ], { dim: 'putoff', track: 'day', phase: 'now' }),
      scored('d_thick', 'dayNow', dayNow, 'Does thicker protection change how easily you wet? Many people let go more in thick gear.', [
        { v: 'same', l: 'No real difference', c: 80 }, { v: 'bit', l: 'A little easier to let go when it is thick', c: 50 },
        { v: 'much', l: 'I wet much more easily in thick gear', c: 20 }, { v: 'only', l: 'I really only let go in thick gear', c: 0 }
      ], { dim: 'thick', track: 'day', phase: 'now' }),

      scored('n_wet', 'nightNow', nightNow, 'How many nights in a typical week are wet?', [
        { v: 0, l: 'None', c: 100 }, { v: 1, l: 'About one', c: 80 }, { v: 2, l: 'About two', c: 60 },
        { v: 4, l: 'Three or four', c: 35 }, { v: 6, l: 'Five or six', c: 15 }, { v: 7, l: 'Every night', c: 0 }
      ], { dim: 'wetNights', track: 'night', phase: 'now' }),
      scored('n_rise', 'nightNow', nightNow, 'Do you wake in the night and get up to pee?', [
        { v: 'most', l: 'Most nights I get up', c: 100 }, { v: 'some', l: 'Some nights', c: 60 },
        { v: 'rare', l: 'Rarely', c: 30 }, { v: 'no', l: 'I do not get up', c: 0 }
      ], { dim: 'rise', track: 'night', phase: 'now' }),
      scored('n_wakewet', 'nightNow', nightNow, 'When a night is wet, do you wake for it?', [
        { v: 'up', l: 'I wake and get up', c: 100 }, { v: 'stay', l: 'I wake, and I stay in bed', c: 55 },
        { v: 'often', l: 'I often sleep through it', c: 25 }, { v: 'always', l: 'I almost always sleep through it', c: 0 }
      ], { dim: 'wakeWet', track: 'night', phase: 'now' }),
      scored('n_when', 'nightNow', nightNow, 'If a night wet happens, when does it usually land?', [
        { v: 'none', l: 'I do not have night wets', c: 100 }, { v: 'early', l: 'Early, not long after I fall asleep', c: 40 },
        { v: 'mid', l: 'In the middle of the night', c: 30 }, { v: 'morning', l: 'Toward morning', c: 50 }
      ], { dim: 'when', track: 'night', phase: 'now' }),
      scored('n_depth', 'nightNow', nightNow, 'How deep is your sleep? A LuckRing or JSON import can fill this if you have one.', [
        { v: 'light', l: 'Light — I wake easily', c: 80 }, { v: 'normal', l: 'Ordinary depth', c: 55 },
        { v: 'deep', l: 'Deep', c: 30 }, { v: 'very', l: 'Very deep', c: 10 }
      ], { dim: 'depth', track: 'night', phase: 'now' }),
      scored('n_rouse', 'nightNow', nightNow, 'How hard are you to wake once you are asleep?', [
        { v: 'easy', l: 'A quiet noise is enough', c: 90 }, { v: 'alarm', l: 'A normal alarm works', c: 60 },
        { v: 'miss', l: 'I sleep through alarms sometimes', c: 25 }, { v: 'hard', l: 'I am very hard to wake', c: 0 }
      ], { dim: 'rouse', track: 'night', phase: 'now' }),
      scored('n_length', 'nightNow', nightNow, 'How long do you sleep, and how regular is that bedtime?', [
        { v: 'short', l: 'Short, or the time jumps around', c: 40 }, { v: 'six', l: 'About six hours, and it varies', c: 55 },
        { v: 'eight', l: 'About 7–8 hours, fairly regular', c: 75 }, { v: 'long', l: 'Long and at the same time', c: 85 }
      ], { dim: 'sleepLength', track: 'night', phase: 'now', scores: false }),
      scored('n_eve', 'nightNow', nightNow, 'What do evening drinks look like in the hours before bed?', [
        { v: 'stop', l: 'I stop well before bed', c: 80 }, { v: 'small', l: 'One small drink', c: 60 },
        { v: 'normal', l: 'A normal evening amount', c: 40 }, { v: 'late', l: 'I drink a lot late', c: 15 }
      ], { dim: 'eveningDrinks', track: 'night', phase: 'now', scores: false }),
      scored('n_routine', 'nightNow', nightNow, 'Do you have a bedtime pee as part of going to sleep?', [
        { v: 'always', l: 'Always, before lights out', c: 90 }, { v: 'most', l: 'Most nights', c: 70 },
        { v: 'remember', l: 'When I remember', c: 40 }, { v: 'skip', l: 'I go straight to bed', c: 20 }
      ], { dim: 'routine', track: 'night', phase: 'now', scores: false }),
      scored('n_gear', 'nightNow', nightNow, 'What do you wear to bed now?', GEAR_OPTS, { dim: 'nightGear', track: 'night', phase: 'now', kind: 'gear', scores: false }),

      scored('w_d_warn', 'dayWant', dayWant, 'How much warning do you want before a daytime urge is urgent?', [
        KEEP, { v: 'plenty', l: 'Plenty of time', c: 100 }, { v: 'some', l: 'Some warning', c: 66 },
        { v: 'little', l: 'Only a little', c: 33 }, { v: 'none', l: 'Almost none — surprise me', c: 0 }
      ], { dim: 'warning', track: 'day', phase: 'want' }),
      scored('w_d_hold', 'dayWant', dayWant, 'After the first urge, how long do you want to be able to wait?', [
        KEEP, { v: 'hour', l: 'An hour or more', c: 100 }, { v: 'half', l: 'About half an hour', c: 70 },
        { v: 'few', l: 'A few minutes', c: 30 }, { v: 'none', l: 'I do not want to wait', c: 0 }
      ], { dim: 'hold', track: 'day', phase: 'want' }),
      scored('w_d_make', 'dayWant', dayWant, 'How often do you want to make it to the toilet, versus not quite making it?', [
        KEEP, { v: 'always', l: 'Almost always make it', c: 100 }, { v: 'mostly', l: 'Mostly make it', c: 70 },
        { v: 'half', l: 'About half and half', c: 40 }, { v: 'rarely', l: 'Rarely make it — not quite is the point', c: 0 }
      ], { dim: 'leaks', track: 'day', phase: 'want' }),
      scored('w_d_sudden', 'dayWant', dayWant, 'How sudden do you want daytime urges to feel?', [
        KEEP, { v: 'slow', l: 'Slow, so I can plan', c: 100 }, { v: 'mix', l: 'A mix', c: 55 },
        { v: 'spike', l: 'Sudden spikes', c: 15 }, { v: 'gone', l: 'I want the signal to fade', c: 0 }
      ], { dim: 'sudden', track: 'day', phase: 'want' }),
      scored('w_d_vol', 'dayWant', dayWant, 'What do you want a typical void amount to become?', [
        KEEP, { v: 'small', l: 'Smaller than now', c: 25 }, { v: 'sameband', l: 'About an average adult void', c: 70 },
        { v: 'large', l: 'A large comfortable void', c: 95 }
      ], { dim: 'volume', track: 'day', phase: 'want' }),
      scored('w_d_drip', 'dayWant', dayWant, 'How often do you want dribbles, cough leaks, or giggle leaks?', [
        KEEP, { v: 'rare', l: 'Rarely', c: 100 }, { v: 'some', l: 'Sometimes, as part of practice', c: 45 },
        { v: 'often', l: 'Often', c: 10 }
      ], { dim: 'dribble', track: 'day', phase: 'want' }),
      scored('w_d_notice', 'dayWant', dayWant, 'Do you want to notice fullness and wetness sooner, later, or leave it?', [
        { v: 'sooner', l: 'Sooner than I do now', c: 100 }, KEEP,
        { v: 'later', l: 'Later — missing some is fine', c: 15 }
      ], { dim: 'notice', track: 'day', phase: 'want' }),
      scored('w_d_gear', 'dayWant', dayWant, 'What is the lightest gear you want to be able to manage, at home, at work, and out?', [KEEP].concat(GEAR_OPTS.map(o => Object.assign({ c: { G6: 100, G5: 80, G4: 60, G3: 40, G1: 20, G0: 0 }[o.v] }, o))), { dim: 'dayGear', track: 'day', phase: 'want', kind: 'gear', scores: true }),

      scored('w_n_wet', 'nightWant', nightWant, 'How many wet nights a week do you want?', [
        KEEP, { v: 0, l: 'None', c: 100 }, { v: 1, l: 'About one', c: 80 }, { v: 3, l: 'A few', c: 45 },
        { v: 5, l: 'Most nights', c: 20 }, { v: 7, l: 'Every night', c: 0 }
      ], { dim: 'wetNights', track: 'night', phase: 'want' }),
      scored('w_n_wake', 'nightWant', nightWant, 'Do you want to wake when wet, or sleep through?', [
        KEEP, { v: 'wake', l: 'Wake, and deal with it', c: 100 }, { v: 'either', l: 'Either is fine', c: 50 },
        { v: 'through', l: 'Sleep through it', c: 0 }
      ], { dim: 'wakeWet', track: 'night', phase: 'want' }),
      scored('w_n_rise', 'nightWant', nightWant, 'Do you want to get up to pee at night?', [
        KEEP, { v: 'yes', l: 'Yes, when I need to', c: 100 }, { v: 'some', l: 'Sometimes', c: 50 },
        { v: 'no', l: 'No — staying in bed is the goal', c: 0 }
      ], { dim: 'rise', track: 'night', phase: 'want' }),
      scored('w_n_when', 'nightWant', nightWant, 'If a wet night happens, when do you want it?', [
        KEEP, { v: 'none', l: 'I do not want night wets', c: 100 }, { v: 'early', l: 'Early, while sleep is still light', c: 40 },
        { v: 'deep', l: 'During the deepest stretch, without waking', c: 5 }, { v: 'morning', l: 'Toward morning', c: 55 }
      ], { dim: 'when', track: 'night', phase: 'want' }),
      scored('w_n_gear', 'nightWant', nightWant, 'What night gear do you want to be able to use?', [KEEP].concat(GEAR_OPTS.map(o => Object.assign({ c: { G6: 100, G5: 80, G4: 60, G3: 40, G1: 20, G0: 0 }[o.v] }, o))), { dim: 'nightGear', track: 'night', phase: 'want', kind: 'gear', scores: true }),

      scored('goals', 'goals', 'Goals and why', 'What are you trying to change? Pick any.', [
        { v: 'bedwetting', l: 'Bedwetting' }, { v: 'deeper', l: 'Deeper sleep, including sleeping through a wet' },
        { v: 'urgency', l: 'Urgency training — not quite making it' }, { v: 'thin', l: 'Wetting in thin gear or underwear' },
        { v: 'relaxed', l: 'Relaxed, passive release' }, { v: 'signal', l: 'Losing the urge signal' },
        { v: 'control', l: 'More control and staying dry' }, { v: 'capacity', l: 'Bladder capacity' },
        { v: 'drynight', l: 'Night dryness' }
      ], { kind: 'multi', multi: true, scores: false }),
      scored('where', 'goals', 'Goals and why', 'Where should this apply?', [
        { v: 'home', l: 'At home' }, { v: 'work', l: 'At work' }, { v: 'out', l: 'Out' }, { v: 'night', l: 'At night, in bed' }
      ], { kind: 'multi', multi: true, scores: false }),
      scored('day_real', 'goals', 'Goals and why', 'For the day track, is this roleplay in the sim, or real habit conditioning?', [
        { v: 'sim', l: 'Sim and roleplay only' }, { v: 'real', l: 'Real habits, with results counted only if I opted in' }
      ], { kind: 'choice', scores: false }),
      scored('night_real', 'goals', 'Goals and why', 'For the night track, is this roleplay in the sim, or real habit conditioning?', [
        { v: 'sim', l: 'Sim and roleplay only' }, { v: 'real', l: 'Real habits, with results counted only if I opted in' }
      ], { kind: 'choice', scores: false }),

      scored('u_style', 'urgency', 'Urgency training', 'What kind of urgency practice do you want?', [
        { v: 'first_urge', l: 'First-urge release — go when it starts' },
        { v: 'surf', l: 'Urge surfing — let a wave peak, then go' },
        { v: 'partial', l: 'Not quite making it — a partial release, then the toilet if that is your setting' },
        { v: 'timed', l: 'Timed voids on a schedule' }
      ], { kind: 'choice', scores: false }),
      scored('u_often', 'urgency', 'Urgency training', 'How often should urge prompts show up while you are playing?', [
        { v: 'rare', l: 'Rarely' }, { v: 'some', l: 'A few times in a session' }, { v: 'often', l: 'Through the day' }
      ], { kind: 'choice', scores: false }),
      scored('u_pass', 'urgency', 'Urgency training', 'When you ask for a potty pass, how should the odds feel?', [
        { v: 'generous', l: 'Generous — a yes is common' }, { v: 'balanced', l: 'Balanced' },
        { v: 'rare', l: 'Strict — a yes is uncommon' }
      ], { kind: 'choice', scores: false }),

      scored('s_deeper', 'sleep', 'Sleep conditioning', 'What do you want from sleep depth?', [
        { v: 'more', l: 'Deeper than now' }, { v: 'keep', l: 'Keep the depth I have' }, { v: 'lighter', l: 'Wake more easily' }
      ], { kind: 'choice', scores: false }),
      scored('s_cue', 'sleep', 'Sleep conditioning', 'A bedtime cue, the same short routine at the same time?', [
        { v: 'want', l: 'I want to start one' }, { v: 'keep', l: 'I have one and want to keep it' }, { v: 'no', l: 'No routine' }
      ], { kind: 'choice', scores: false }),
      scored('s_stay', 'sleep', 'Sleep conditioning', 'If you wake in the night, is staying in bed part of the practice?', [
        { v: 'yes', l: 'Yes — stay, unless it is a real need' }, { v: 'some', l: 'Sometimes' }, { v: 'no', l: 'No — getting up is fine' }
      ], { kind: 'choice', scores: false }),
      scored('s_before', 'sleep', 'Sleep conditioning', 'Do you want releases that happen before you are fully awake?', [
        { v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }, KEEP
      ], { kind: 'choice', scores: false }),
      scored('s_alarm', 'sleep', 'Sleep conditioning', 'Night alarm: should DryClip wake you on a wet, or stay quiet?', [
        { v: 'on', l: 'Alarm — a wet should wake me' }, { v: 'off', l: 'No alarm — let sleep stay deep' }, KEEP
      ], { kind: 'choice', scores: false }),
      scored('s_drinks', 'sleep', 'Sleep conditioning', 'What evening drink pattern do you want?', [
        { v: 'early', l: 'More earlier in the day, little late' }, { v: 'even', l: 'Spread through the day' },
        { v: 'late', l: 'Late drinks are fine' }
      ], { kind: 'choice', scores: false }),

      scored('p_day', 'pace', 'Pacing', 'Day pacing — how fast should the sim move from where you are to the goal?', [
        { v: 'instant', l: 'Instant — the sim uses the goal now. Real results are still only recorded.' },
        { v: 'gradual', l: 'Gradual — a step every few weeks, and only when check-ins agree' },
        { v: 'slow', l: 'Slow burn — months, in very small steps, still gated by check-ins' },
        { v: 'hybrid', l: 'Hybrid — the sim jumps to the goal, and real-habit practice stays gradual' }
      ], { kind: 'choice', scores: false }),
      scored('p_night', 'pace', 'Pacing', 'Night pacing — same choices, for nights only.', [
        { v: 'instant', l: 'Instant — night sim uses the goal now' },
        { v: 'gradual', l: 'Gradual — nights step forward when check-ins agree' },
        { v: 'slow', l: 'Slow burn — months of small night steps' },
        { v: 'hybrid', l: 'Hybrid — night sim at the goal, real night practice gradual' }
      ], { kind: 'choice', scores: false }),

      scored('intensity', 'pace', 'Pacing', 'How full should a practice day be?', [
        { v: 'gentle', l: 'Gentle — one small task' }, { v: 'steady', l: 'Steady — a couple of tasks' },
        { v: 'intense', l: 'Intense — more tasks, stepping up sooner' }
      ], { kind: 'choice', scores: false }),
      scored('timeframe', 'pace', 'Pacing', 'What timeframe are you picturing?', [
        { v: 'open', l: 'Open-ended' }, { v: '1m', l: 'About a month' },
        { v: '3m', l: 'About three months' }, { v: '6m', l: 'About six months' }
      ], { kind: 'choice', scores: false })
    ];
    const goals = (window.BSOnboard && window.BSOnboard.GOALS) || [];
    const methods = (window.BSOnboard && window.BSOnboard.METHODS) || [];
    const opt = m => ({ v: m.id, l: m.title + ' — ' + m.line });
    list.push(scored('methods_day', 'methods', 'Practice to opt into', 'Day practice. Leave this blank to take the ones that match your goals.', methods.filter(m => m.tracks.indexOf('day') >= 0).map(opt), { kind: 'multi', multi: true, scores: false }));
    list.push(scored('methods_night', 'methods', 'Practice to opt into', 'Night practice. Blank means the goal defaults.', methods.filter(m => m.tracks.indexOf('night') >= 0).map(opt), { kind: 'multi', multi: true, scores: false }));
    list.push(scored('f_desk', 'flavour', 'A couple of pictures', 'One scene, just for colour: you are at your desk in a pull-up and a spike hits. What do you actually do today?', [
      { v: 'toilet', l: 'Get up and make it' }, { v: 'drops', l: 'A few drops, then the toilet' },
      { v: 'gear', l: 'It goes in the pull-up' }, { v: 'later', l: 'I notice afterwards' }
    ], { kind: 'flavour', optional: true, scores: false }));
    list.push(scored('f_night', 'flavour', 'A couple of pictures', 'One night scene, just for colour: you surface in the dark in whatever you wore to bed. What do you actually do?', [
      { v: 'up', l: 'Get up and pee' }, { v: 'stay', l: 'Stay in bed' },
      { v: 'sleep', l: 'I usually do not surface at all' }
    ], { kind: 'flavour', optional: true, scores: false }));
    if (!goals.length) { /* goals question is already inline */ }
    return list;
  }
  function labelOf(q, v) {
    const opt = (q.opts || []).find(o => o.v === v);
    return opt ? opt.l : '';
  }
  function byId(id, list) { return (list || questions()).find(q => q.id === id) || null; }
  function volumeControl() {
    try {
      const c = window.BSOnboard && window.BSOnboard.capacityEstimate && window.BSOnboard.capacityEstimate();
      const ml = c && c.ml;
      if (ml == null) return 50;
      if (ml < 150) return 20;
      if (ml < 250) return 45;
      if (ml < 400) return 70;
      return 90;
    } catch (e) { return 50; }
  }
  function controlOf(q, v) {
    if (!q || v == null || v === '' || v === 'keep') return null;
    if (q.scores === false && q.kind !== 'gear') return null;
    if (v === 'calib') return volumeControl();
    const opt = (q.opts || []).find(o => o.v === v);
    if (!opt || opt.c == null) return null;
    return opt.c;
  }
  function sectionCounts(list) {
    const c = {};
    (list || questions()).forEach(q => { const k = q.step || q.section; c[k] = (c[k] || 0) + 1; });
    return c;
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
  function mean(nums) {
    const xs = nums.filter(n => n != null && isFinite(n));
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  function buildDims(ans, list) {
    const dims = { day: {}, night: {} };
    list.filter(q => q.phase === 'now' && q.dim).forEach(nowQ => {
      const wantQ = list.find(w => w.phase === 'want' && w.dim === nowQ.dim && w.track === nowQ.track);
      let now = controlOf(nowQ, ans[nowQ.id]);
      if (nowQ.id === 'd_volume' && ans.d_volume === 'calib') now = volumeControl();
      let want = wantQ ? controlOf(wantQ, ans[wantQ.id]) : null;
      const keep = !wantQ || ans[wantQ.id] == null || ans[wantQ.id] === '' || ans[wantQ.id] === 'keep';
      if (keep) want = now;
      const row = {
        id: nowQ.dim, name: nowQ.dim, track: nowQ.track,
        now: now, want: want, keep: keep,
        nowText: labelOf(nowQ, ans[nowQ.id]) || '—',
        wantText: keep ? 'Keep as is' : labelOf(wantQ, ans[wantQ.id]),
        scores: nowQ.scores !== false
      };
      dims[nowQ.track][nowQ.dim] = row;
    });
    const names = {
      hold: 'Hold after the first urge', warning: 'Warning before it is urgent', sudden: 'How sudden urges are',
      trips: 'Trips per day', volume: 'Void amount', leaks: 'Making it vs not quite', dribble: 'Dribbles',
      stress: 'Cough, sneeze, or laugh leaks', fullness: 'Awareness of fullness', notice: 'Noticing wetness',
      putoff: 'Putting off going', thick: 'Thick gear vs thinner gear', wetNights: 'Wet nights a week',
      rise: 'Getting up to pee at night', wakeWet: 'Waking when wet', when: 'When a night wet happens',
      depth: 'Sleep depth', rouse: 'How hard you are to wake', sleepLength: 'Sleep length and regularity',
      eveningDrinks: 'Evening drinks', routine: 'Bedtime pee', nightGear: 'Night gear', dayGear: 'Day gear you can use'
    };
    ['day', 'night'].forEach(t => Object.keys(dims[t]).forEach(id => { dims[t][id].name = names[id] || id; }));
    return dims;
  }
  function trackMean(dims, track, key) {
    return mean(Object.keys(dims[track] || {}).map(id => dims[track][id].scores === false ? null : dims[track][id][key]));
  }
  /** t in 0..1 from now toward want. Check-in count gates gradual and slow. Time alone does not. */
  function mix(now, want, pacing, agreeing, layer) {
    if (now == null) return want == null ? null : want;
    if (want == null) return now;
    const a = Math.max(0, +agreeing || 0);
    let t = 0;
    if (pacing === 'instant') t = 1;
    else if (pacing === 'hybrid') t = layer === 'real' ? Math.min(1, a / 6) : 1;
    else if (pacing === 'slow') t = Math.min(1, a / 16);
    else t = Math.min(1, a / 6);
    return Math.round(now + (want - now) * t);
  }
  function agreeingCount(track) {
    let items = [];
    try { items = window.BSCheckins && window.BSCheckins.load ? window.BSCheckins.load().items : []; } catch (e) { items = []; }
    let target = null, start = null;
    try {
      const p = window.BSOnboard && window.BSOnboard.load && window.BSOnboard.load().profile;
      if (p) { target = p.target[track]; start = p.starting[track]; }
    } catch (e) {}
    const sign = target == null || start == null ? 0 : Math.sign(target - start);
    let n = 0;
    (items || []).forEach(it => {
      const e = it.estimates && it.estimates[track];
      if (!e || e.after == null || e.before == null) return;
      if (!sign) { n++; return; }
      if (Math.sign(e.after - e.before) === sign || Math.abs(e.after - target) < Math.abs(e.before - target)) n++;
    });
    return n;
  }
  function wordFor(dim, value) {
    if (!dim || value == null) return dim ? dim.nowText : '';
    if (dim.keep || dim.want == null || dim.now == null) return dim.nowText;
    const span = dim.want - dim.now;
    if (!span) return dim.nowText;
    const t = (value - dim.now) / span;
    if (t >= 0.67) return dim.wantText;
    if (t <= 0.33) return dim.nowText;
    return 'Between ' + dim.nowText + ' and ' + dim.wantText;
  }
  function goalList(ans) {
    const g = new Set(Array.isArray(ans.goals) ? ans.goals.filter(x => x !== 'none') : []);
    if (ans.u_style === 'first_urge' || ans.u_style === 'partial') g.add('urgency');
    if (ans.u_style === 'surf' || ans.u_style === 'timed') g.add('control');
    if (ans.s_deeper === 'more' || ans.s_stay === 'yes' || ans.s_before === 'yes') g.add('deeper');
    if (ans.s_alarm === 'on') g.add('drynight');
    if (ans.w_n_wake === 'through' || ans.w_n_rise === 'no') g.add('bedwetting');
    return Array.from(g);
  }
  function scoreIntake(ans) {
    ans = ans || {};
    const list = questions();
    const dimensions = buildDims(ans, list);
    const dayNowN = trackMean(dimensions, 'day', 'now');
    const nightNowN = trackMean(dimensions, 'night', 'now');
    const dayWantN = trackMean(dimensions, 'day', 'want');
    const nightWantN = trackMean(dimensions, 'night', 'want');
    const dayNow = dayNowN == null ? null : Math.round(dayNowN);
    const nightNow = nightNowN == null ? null : Math.round(nightNowN);
    const dayWant = dayWantN == null ? dayNow : Math.round(dayWantN);
    const nightWant = nightWantN == null ? nightNow : Math.round(nightWantN);
    let dayDir = dirOf(dayNow, dayWant);
    let nightDir = dirOf(nightNow, nightWant);
    const goals = goalList(ans);
    const less = goals.some(id => id === 'bedwetting' || id === 'urgency' || id === 'thin' || id === 'relaxed' || id === 'signal' || id === 'deeper');
    const more = goals.some(id => id === 'control' || id === 'capacity' || id === 'drynight');
    if (dayDir === 'off' && more && !less) dayDir = 'B';
    if (dayDir === 'off' && less && !more) dayDir = 'A';
    if (nightDir === 'off' && (goals.indexOf('bedwetting') >= 0 || goals.indexOf('deeper') >= 0) && goals.indexOf('drynight') < 0 && goals.indexOf('control') < 0) nightDir = 'A';
    if (nightDir === 'off' && (goals.indexOf('drynight') >= 0 || (goals.indexOf('control') >= 0 && goals.indexOf('bedwetting') < 0))) nightDir = 'B';
    let methods = { day: [], night: [] };
    try { if (window.BSOnboard && window.BSOnboard.defaultMethods) methods = window.BSOnboard.defaultMethods(goals, dayDir, nightDir); } catch (e) {}
    ['day', 'night'].forEach(track => {
      const picked = ans['methods_' + track];
      if (!picked || !picked.length || !window.BSOnboard || !window.BSOnboard.METHODS) return;
      const dir = track === 'night' ? nightDir : dayDir;
      const allow = {};
      window.BSOnboard.METHODS.forEach(m => { if (m.dir === dir && m.tracks.indexOf(track) >= 0) allow[m.id] = 1; });
      const kept = picked.filter(id => allow[id]);
      if (kept.length) methods[track] = kept;
    });
    const pacing = { day: ans.p_day || 'gradual', night: ans.p_night || 'gradual' };
    const urgency = { style: ans.u_style || 'surf', prompts: ans.u_often || 'some', passes: ans.u_pass || 'balanced' };
    const sleep = { deeper: ans.s_deeper || 'keep', cue: ans.s_cue || 'no', stay: ans.s_stay || 'no', beforeAwake: ans.s_before || 'keep', alarm: ans.s_alarm || 'keep', drinks: ans.s_drinks || 'even' };
    const worn = {
      home: 'G6', work: 'G6', out: 'G6',
      night: ans.n_gear || 'G6'
    };
    if (ans.w_d_gear && ans.w_d_gear !== 'keep') { worn.home = ans.w_d_gear; worn.work = ans.w_d_gear; worn.out = ans.w_d_gear; }
    return {
      dayNow: dayNow, nightNow: nightNow, dayWant: dayWant, nightWant: nightWant,
      dayDir: dayDir, nightDir: nightDir,
      dayKey: bandOf(dayNow), nightKey: bandOf(nightNow),
      dayTargetKey: dayDir === 'off' ? bandOf(dayNow) : bandOf(dayWant),
      nightTargetKey: nightDir === 'off' ? bandOf(nightNow) : bandOf(nightWant),
      goals: goals, methods: methods, dimensions: dimensions, pacing: pacing,
      urgency: urgency, sleep: sleep,
      scope: { where: ans.where || [], dayReal: ans.day_real === 'real', nightReal: ans.night_real === 'real' },
      flavour: { desk: ans.f_desk || null, night: ans.f_night || null },
      worn: worn,
      titles: {
        dayNow: (TITLES[bandOf(dayNow)] || {}).day || '',
        nightNow: (TITLES[bandOf(nightNow)] || {}).night || '',
        dayWant: (TITLES[bandOf(dayWant)] || {}).day || '',
        nightWant: (TITLES[bandOf(nightWant)] || {}).night || ''
      }
    };
  }
  function profileOf(opts) {
    opts = opts || {};
    if (opts.profile) return opts.profile;
    try { return window.BSOnboard && window.BSOnboard.load && window.BSOnboard.load().profile; } catch (e) { return null; }
  }
  function dimEffective(dim, pacing, agreeing, layer) {
    if (!dim) return null;
    const v = mix(dim.now, dim.want, pacing, agreeing, layer || 'sim');
    return { value: v, text: wordFor(dim, v) };
  }
  function trackEffective(profile, track, opts) {
    opts = opts || {};
    profile = profile || profileOf(opts);
    if (!profile) return null;
    const pacing = (profile.pacing && profile.pacing[track]) || 'gradual';
    const agreeing = opts.agreeing != null ? opts.agreeing : agreeingCount(track);
    const layer = opts.layer || 'sim';
    const dims = (profile.dimensions && profile.dimensions[track]) || {};
    const rows = {};
    Object.keys(dims).forEach(id => {
      const e = dimEffective(dims[id], pacing, agreeing, layer);
      rows[id] = Object.assign({}, dims[id], { effective: e && e.value, effectiveText: e && e.text });
    });
    const nowM = mean(Object.keys(dims).map(id => dims[id].scores === false ? null : dims[id].now));
    const wantM = mean(Object.keys(dims).map(id => dims[id].scores === false ? null : dims[id].want));
    const control = (nowM == null && wantM == null) ? null : mix(nowM == null ? wantM : nowM, wantM == null ? nowM : wantM, pacing, agreeing, layer);
    return { track: track, pacing: pacing, agreeing: agreeing, control: control == null ? null : Math.round(control), levelKey: control == null ? null : bandOf(control), dims: rows };
  }
  function urgeModel(track, opts) {
    opts = opts || {};
    const profile = profileOf(opts);
    if (!profile || !profile.dimensions) return null;
    const t = track === 'night' ? 'night' : 'day';
    const eff = trackEffective(profile, t, opts);
    if (!eff || eff.control == null) return null;
    const c = eff.control / 100;
    const suddenDim = eff.dims.sudden;
    const noticeDim = eff.dims.notice || eff.dims.fullness;
    const sud = suddenDim && suddenDim.effective != null ? 1 - suddenDim.effective / 100 : (1 - c);
    const notice = noticeDim && noticeDim.effective != null ? noticeDim.effective / 100 : c;
    const thick = eff.dims.thick;
    const holdLo = Math.max(1, Math.round(1 + c * 25));
    const holdHi = Math.max(holdLo + 1, Math.round(3 + c * 40));
    const warn = Math.max(1, Math.round(1 + (eff.dims.warning && eff.dims.warning.effective != null ? eff.dims.warning.effective : eff.control) / 100 * 30));
    const style = profile.urgency && profile.urgency.style;
    const odds = {
      go: Math.round((0.65 + c * 0.7) * 100) / 100,
      wait: Math.round((0.75 + (1 - sud) * 0.45) * 100) / 100,
      hard: Math.round((0.7 + sud * 0.8) * 100) / 100,
      dribble: Math.round((0.75 + (1 - notice) * 0.7 + sud * 0.25) * 100) / 100,
      gear: Math.round((0.55 + (1 - c) * 0.9 + (1 - notice) * 0.45 + (thick && thick.now != null && thick.now < 40 ? 0.2 : 0)) * 100) / 100,
      partial: style === 'partial' ? 1.45 : 1
    };
    const night = t === 'night' ? eff : null;
    return {
      track: t, pacing: eff.pacing, agreeing: eff.agreeing, control: eff.control, levelKey: eff.levelKey,
      hold: [Math.min(holdLo, 20), Math.min(holdHi, 20)], warningMin: Math.min(30, warn),
      sudden: Math.round(sud * 100) / 100, notice: Math.round(notice * 100) / 100,
      unnoticed: Math.round((1 - notice) * 100) / 100,
      odds: odds,
      wetChance: night && night.dims.wetNights && night.dims.wetNights.effective != null ? Math.round((1 - night.dims.wetNights.effective / 100) * 100) / 100 : null,
      wakeOnWet: night && night.dims.wakeWet && night.dims.wakeWet.effective != null ? Math.round(night.dims.wakeWet.effective / 100 * 100) / 100 : null
    };
  }
  function sessionBits(profile, hour) {
    profile = profile || profileOf({});
    if (!profile) return null;
    const u = profile.urgency || {};
    const sl = profile.sleep || {};
    let min = 30, max = 70, sips = [1, 2];
    const prompts = [];
    if (u.style === 'first_urge') { min = 15; max = 35; prompts.push('When the first urge shows up, go then.'); }
    else if (u.style === 'surf') { min = 25; max = 50; prompts.push('When an urge rises, let the peak ease, then go. Stop if it gets strong.'); }
    else if (u.style === 'partial') { min = 20; max = 45; prompts.push('Not quite: let a little go, then the toilet if that reminder is on.'); }
    else if (u.style === 'timed') { min = 50; max = 80; prompts.push('Go at the next planned time, even if the urge is small.'); }
    if (u.prompts === 'rare') { min = Math.max(min, 60); max = Math.max(max, 120); }
    if (u.prompts === 'often') { min = Math.min(min, 15); max = Math.min(max, 40); }
    const h = hour == null ? new Date().getHours() : hour;
    if (sl.drinks === 'early' && h >= 16) { sips = [0, 1]; min = Math.max(min, 90); max = Math.max(max, min); }
    if (sl.drinks === 'early' && h < 14) sips = [1, 3];
    if (sl.cue === 'want' || sl.cue === 'keep') prompts.push('Bedtime cue at your usual time: gear, the same steps, then lights.');
    if (sl.stay === 'yes') prompts.push('If you wake in the night, staying in bed is the practice. A real need still means you can get up.');
    if (sl.beforeAwake === 'yes') prompts.push('If you stir, you can let a release happen before you are fully awake.');
    if (sl.alarm === 'on') prompts.push('Arm DryClip so a wet can wake you.');
    if (sl.alarm === 'off') prompts.push('No bedwetting alarm. Sleep is allowed to stay deep.');
    if (sl.deeper === 'more') prompts.push('Same bedtime, dark room, no late screen.');
    return { min: min, max: max, sips: sips, prompts: prompts, passes: u.passes || 'balanced', style: u.style || null };
  }
  function passMode(profile) {
    profile = profile || profileOf({});
    return profile && profile.urgency && profile.urgency.passes || null;
  }
  function breakdown(profile, opts) {
    profile = profile || profileOf(opts || {});
    if (!profile || !profile.dimensions) return [];
    const rows = [];
    ['day', 'night'].forEach(track => {
      const eff = trackEffective(profile, track, opts || {});
      Object.keys(eff.dims).forEach(id => {
        const d = eff.dims[id];
        if (d.now == null && d.want == null) return;
        rows.push({ track: track, id: id, name: d.name, nowText: d.nowText, effectiveText: d.effectiveText, wantText: d.wantText, pacing: eff.pacing });
      });
    });
    return rows;
  }
  function prefill() {
    const a = {};
    try {
      const hint = window.BSOnboard && window.BSOnboard.sleepHint && window.BSOnboard.sleepHint();
      if (hint) a.n_depth = hint.depth >= 2 ? 'very' : hint.depth === 1 ? 'normal' : 'light';
    } catch (e) {}
    return a;
  }
  window.BSIntake = {
    TITLES, questions, sectionCounts, skipSectionFrom, resumeIndex, controlOf, mix, scoreIntake,
    urgeModel, sessionBits, passMode, breakdown, trackEffective, agreeingCount, prefill, bandOf, dirOf
  };
})();
