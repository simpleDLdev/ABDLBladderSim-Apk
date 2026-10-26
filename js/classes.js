/* ===========================
   classes.js — v12 scaffold + v32 play hooks.
   Each class carries systems hooks: oddsMod, accidentTypes, eventSteps (+ change/urge).
   v32: richer card copy (desc / mommy / solo / ± perks / stat mods), Leaky Girl alias on Dribbler,
   helpers for Urge/Campaign/Path. No laugh/cough triggers.
   Design: docs/DESIGN-classes-perks-campaign.md. All effects are prompt/gear/permission rules.
   No sexual content. Real urges always win. Urgency and saturation are always user-entered.
   =========================== */
(function () {
  const KEY = 'bs_class_v1';
  const CLASSES = [
    { id: 'trainee', name: 'Trainee', office: 'Starter', base: 'good', change: 'ask', urge: {},
      oddsMod: { go: 1.1 }, accidentTypes: [], eventSteps: [],
      perkTree: ['iron_hold', 'early_bird', 'second_chance'], mastery: ['dry_streak_3', 'alerts_made_5'],
      blurb: 'Learning big-kid habits with a friendly safety net.',
      desc: 'Mild go bias; standard accident types. Good starter for Path or Campaign.',
      mommy: 'Trainee today, sweetie — Mommy keeps the safety net close and cheers every potty make.',
      solo: 'Slightly more “go now” results. Plain prompts.',
      plus: ['Go odds ×1.1', 'Friendly ask-to-change'], minus: ['No special accident flavors'],
      stats: { constitution: 1, perception: 0, composure: 1 } },
    { id: 'office', name: 'Office Agent', office: 'Quiet', base: 'okay', change: 'ask', urge: { quietSignals: true },
      oddsMod: { hard: 0.8, dribble: 1.2 }, accidentTypes: ['quiet_leak'], eventSteps: [],
      perkTree: ['calm_bladder', 'hall_pass', 'thick_skin'], mastery: ['office_day_7', 'silent_rolls_10'],
      blurb: 'Neutral wording, quiet prompts; shorter grace at the desk.',
      desc: 'Quiet Signals on; fewer hard-holds, more dribbles. Office wording when enabled.',
      mommy: 'Quiet desk rules, love — soft signals, no fuss. Mommy still hears you if you really need to go.',
      solo: 'Hard ×0.8, dribble ×1.2. Quiet leak accident type.',
      plus: ['Quiet Signals', 'Dribble lean'], minus: ['Fewer hard-hold prompts'],
      stats: { constitution: 0, perception: 1, composure: 1 } },
    { id: 'sleepyhead', name: 'Sleepyhead', office: 'Night', base: 'okay', change: 'threshold', urge: {},
      oddsMod: {}, accidentTypes: ['wet_night'], eventSteps: [], night: { wetControl: -4 },
      perkTree: ['dry_streak', 'long_fuse', 'spare_stash'], mastery: ['dry_nights_5', 'night_checkins_14'],
      blurb: 'Nights matter most — dry mornings boost Control, wet ones sting.',
      desc: 'Night-focused Campaign class. Morning check-ins and dry/wet nights swing Control harder.',
      mommy: 'Nights are Mommy\'s special watch. Tell me honestly in the morning, love.',
      solo: 'Threshold changes. Wet night Control sting. Dry mornings count more in Campaign night focus.',
      plus: ['Night mastery lean', 'Dry morning boost'], minus: ['Wet nights sting Control', 'Threshold changes'],
      stats: { constitution: 0, perception: 0, composure: 0 }, campaign: { nightDouble: true } },
    { id: 'fast_filler', name: 'Fast Filler', office: 'Pace', base: 'shaky', change: 'ask', urge: { fastFill: true },
      oddsMod: { wait: 0.8, go: 1.1 }, accidentTypes: ['rush_leak'], eventSteps: [],
      perkTree: ['long_fuse', 'second_chance', 'lucky_roll'], mastery: ['waits_survived_10', 'go_streak_5'],
      blurb: 'Shorter waits, more re-rolls; the clock is always ticking.',
      desc: 'Fast Fill trait; shorter waits; rush-leak accident type.',
      mommy: 'You fill fast today, sweetie — Mommy keeps waits shorter so we stay honest.',
      solo: 'Wait ×0.8, go ×1.1. Fast Fill on.',
      plus: ['Shorter waits', 'Go lean'], minus: ['Rush-leak flavor more common'],
      stats: { constitution: -1, perception: 0, composure: 0 } },
    { id: 'quiet_one', name: 'Quiet One', office: 'Subtle', base: 'shaky', change: 'threshold', urge: { quietSignals: true },
      oddsMod: { hard: 0.6, dribble: 1.8 }, accidentTypes: ['no_warning'], eventSteps: [],
      perkTree: ['clear_signals', 'iron_hold', 'mercy_charm'], mastery: ['dribbles_logged_8', 'hidden_waits_5'],
      blurb: 'Fewer hard-hold prompts, more "wait for a dribble" rolls.',
      desc: 'Hard ×0.6, dribble ×1.8; no-warning accident type; threshold changes.',
      mommy: 'Quiet signals, love — Mommy wants you to notice the little drips before the big ones.',
      solo: 'Heavy dribble lean. Threshold May I change?.',
      plus: ['Dribble ×1.8', 'Quiet Signals'], minus: ['Hard ×0.6', 'Threshold changes'],
      stats: { constitution: 0, perception: 2, composure: 0 } },
    { id: 'pullup', name: 'Pull-up Soft', office: 'Soft', base: 'shaky', change: 'ask', urge: {},
      oddsMod: { go: 1 }, accidentTypes: ['soft_leak'], eventSteps: [],
      perkTree: ['second_chance', 'thick_skin', 'mercy_charm'], mastery: ['dribbles_logged_8'],
      blurb: 'Pull-ups with full-length holds. A different identity from Leaky Girl.',
      desc: 'Round-up energy without Leaky Girl\'s short holds or dribble gate. Small #2 step-back reduction.',
      mommy: 'Pull-ups on, love. Holds stay the normal length — Mommy is not using Leaky Girl rules.',
      solo: 'Full-length holds. No dribble gate. #2 accidents step back 1 less.',
      plus: ['Full-length holds (not ×0.8)', 'Distinct from Leaky Girl'],
      minus: ['Missed hold still counts as an accident', 'No dribble-gate perk'],
      stats: { constitution: 0, perception: 0, composure: 0 },
      flags: { failHoldIsAcc: true },
      aliases: ['Pull-up Soft', 'Pull-up Dribbler'] },
    { id: 'dribbler', name: 'Leaky Girl', office: 'Drip', base: 'shaky', change: 'ask', urge: {},
      oddsMod: { dribble: 2, go: 0.6 }, accidentTypes: ['pre_potty_dribble'],
      eventSteps: [{ before: ['go', 'permission'], micro: 'small_leak', text: 'Small leak into your gear first. Note it, then read your result.' }],
      perkTree: ['iron_hold', 'second_chance', 'mercy_charm'], mastery: ['pre_potty_micros_10', 'dribbles_logged_8'],
      blurb: 'A little leak comes before every potty permission.',
      desc: 'May only treat “need to pee” as unlocked after a logged dribble. Much shorter holds. Longer May I change saturation gates. Pads allowed with underwear.',
      mommy: 'Leaky rules, sweetie. Mommy wants a little drip logged before potty talk — and we stay padded a bit longer.',
      solo: 'Dribble ×2, go ×0.6. Micro leak step before go/May I?. Higher change saturation. Pads with undies OK.',
      plus: ['Pads with underwear', 'Clear leak→potty chain', 'Dribble mastery'],
      minus: ['Go ×0.6', 'Constitution dump (short holds)', 'Change saturation gate +25', 'Need-to-go gated on first dribble'],
      stats: { constitution: -2, perception: 1, composure: -1 },
      flags: { needDribbleFirst: true, holdScale: 0.65, changeSatBump: 25, padsWithUndies: true },
      aliases: ['leaky', 'Leaky Girl'] },
    { id: 'care_charge', name: 'Caregiver\'s Charge', office: 'Guided', base: 'little', change: 'threshold', urge: {},
      oddsMod: { go: 0.8 }, accidentTypes: [], eventSteps: [], denyTable: 'sitter',
      perkTree: ['hall_pass', 'mercy_charm', 'spare_stash'], mastery: ['ask_twice_ok_5', 'changes_rolled_10'],
      blurb: 'Potty permission is scarce; change rolls follow the babysitter schedule.',
      desc: 'Stricter May I? / deny table. Threshold changes. Caregiver mode shines here.',
      mommy: 'You\'re Mommy\'s charge today — ask before potty, and changes follow my schedule.',
      solo: 'Go ×0.8. Sitter deny table. Threshold changes.',
      plus: ['Clear caregiver gating', 'Change mastery'], minus: ['Scarcer potty yes', 'Less self-permission'],
      stats: { constitution: -1, perception: 0, composure: 1 } },
    { id: 'little_legend', name: 'Little Legend', office: 'Deep', base: 'none', change: 'threshold', urge: {},
      oddsMod: { gear: 1.3 }, accidentTypes: ['full_flood'], eventSteps: [],
      perkTree: ['spare_stash', 'thick_skin', 'gold_star'], mastery: ['sat_reports_20', 'gear_days_7'],
      blurb: 'Fully geared play; curses fade faster, warnings almost never show.',
      desc: 'Gear-default odds; high sat threshold; full-flood accident type.',
      mommy: 'Deep padded day, love — Mommy handles the big changes when you\'re truly soggy.',
      solo: 'Gear ×1.3. High change threshold. Flood accident flavor.',
      plus: ['Gear lean', 'Sat-report mastery'], minus: ['Rare potty window', 'High change threshold'],
      stats: { constitution: -1, perception: -1, composure: 0 },
      flags: { changeSatBump: 20 } },
    { id: 'scout', name: 'Scout', office: 'Kit', base: 'good', change: 'ask', urge: {},
      oddsMod: {}, accidentTypes: ['out_and_about'], eventSteps: [],
      perkTree: ['spare_stash', 'hall_pass', 'early_bird'], mastery: ['trips_out_5', 'changes_with_spares_8'],
      blurb: 'Extra spares and trip-focused mastery.',
      desc: 'Trip / spare-kit lean for Campaign and Path Scout board class.',
      mommy: 'Scout kit ready, love — Mommy packed spares. Check in when you\'re out.',
      solo: 'Out-and-about accident type. Spare-focused mastery.',
      plus: ['Spare lean', 'Trip mastery'], minus: ['No odds bias (skill is kit)'],
      stats: { constitution: 0, perception: 1, composure: 1 } },
    { id: 'night_owl', name: 'Night Owl', office: 'Late', base: 'okay', change: 'ask', urge: {},
      oddsMod: {}, accidentTypes: [], eventSteps: [], morning: 'shaky',
      perkTree: ['dry_streak', 'calm_bladder', 'long_fuse'], mastery: ['late_checkins_7', 'may_get_up_ok_5'],
      blurb: 'Natural Night is friendlier; mornings start a little shaky.',
      desc: 'Friendlier night permission; mornings start Shaky. Pairs with Campaign night focus.',
      mommy: 'Late night, sweetie — Mommy keeps night rules kinder. Mornings we go gentle and shaky.',
      solo: 'Natural Night friendlier. Morning band starts shaky.',
      plus: ['Kinder night permission', 'Late check-in mastery'], minus: ['Shaky mornings'],
      stats: { constitution: 0, perception: 0, composure: 1 }, campaign: { nightDouble: true } },
    { id: 'runner', name: 'Roguelike Runner', office: 'Run', base: 'okay', change: 'ask', urge: {},
      oddsMod: {}, accidentTypes: [], eventSteps: [],
      perkTree: ['lucky_roll', 'second_chance', 'gold_star'], mastery: ['runs_finished_3', 'perk_picks_10'],
      blurb: 'Pick 1 of 3 perks each morning; Control resets each run.',
      desc: 'Daily perk pick energy. Control resets per run (Campaign length days pair well).',
      mommy: 'Fresh run today, love — Mommy lets you pick a perk, then we play the board as it comes.',
      solo: 'Morning perk pick. Run-based mastery.',
      plus: ['Perk pick fantasy', 'Lucky roll tree'], minus: ['Control resets each run'],
      stats: { constitution: 0, perception: 0, composure: 0 } }
  ];
  // v39: every campaign class gets a small #2 modifier, same ± shape as Leaky Girl. Ids stay stable.
  const POO = {
    trainee: { note: '#2 in the potty counts +1 extra when you log it.', delta: 1 },
    office: { note: 'Quiet #2: a logged #2 leans −1.', delta: -1 },
    sleepyhead: { note: 'A night #2 leans −1 when you log it.', delta: -1 },
    fast_filler: { note: '#2 waits lean shorter — logged #2 is −1.', delta: -1 },
    quiet_one: { note: 'Quiet #2 accidents lean −1.', delta: -1 },
    pullup: { note: 'Pull-up Soft #2 steps the tally −1. Holds stay full length.', delta: -1 },
    dribbler: { note: 'Leaky Girl #2: a padding #2 leans −1 extra.', delta: -1 },
    care_charge: { note: 'Caregiver #2 asks first — logged #2 leans −1.', delta: -1 },
    little_legend: { note: 'Geared #2 still teaches: +1 when you log a padding #2.', delta: 1 },
    scout: { note: 'Scout kit: a logged #2 in the potty is +1 extra.', delta: 1 },
    night_owl: { note: 'Night focus: a night #2 leans −1.', delta: -1 },
    runner: { note: 'First logged #2 of the run is +1.', delta: 1 }
  };
  CLASSES.forEach(c => {
    const poo = POO[c.id] || { note: 'Logged #2 leans −1.', delta: -1 };
    c.flags = Object.assign({}, c.flags, { poo: poo });
    if (!(c.plus || []).some(p => String(p).indexOf('#2') >= 0)) c.plus = (c.plus || []).concat(['#2: ' + poo.note]);
  });
  const PERKS = {
    iron_hold: { name: 'Iron Hold', tier: 1, effect: 'First missed window of the day doesn\'t count.' },
    early_bird: { name: 'Early Bird', tier: 1, effect: 'Pre-chime always on until 10:00.' },
    second_chance: { name: 'Second Chance', tier: 2, effect: '1 re-roll of any Simple Urge result per day.' },
    hall_pass: { name: 'Hall Pass', tier: 2, effect: '1 guaranteed potty permission.' },
    thick_skin: { name: 'Thick Skin', tier: 2, effect: 'Playable-trigger leak chance ×0.5 for the day (stand / walk / lift you log).' },
    dry_streak: { name: 'Dry Streak', tier: 1, effect: '+1 Control per consecutive dry night (max +5).' },
    spare_stash: { name: 'Spare Stash', tier: 1, effect: '+2 spares when you leave home.' },
    calm_bladder: { name: 'Calm Bladder', tier: 1, effect: 'Waves −1.' },
    clear_signals: { name: 'Clear Signals', tier: 2, effect: 'No fog / Quiet Signals off for the day.' },
    lucky_roll: { name: 'Lucky Roll', tier: 3, effect: 'Next d20 counts as max.' },
    long_fuse: { name: 'Long Fuse', tier: 2, effect: 'Wait ranges ×1.3.' },
    gold_star: { name: 'Gold Star', tier: 3, effect: 'Next Control gain doubled.' },
    mercy_charm: { name: 'Mercy Charm', tier: 3, effect: 'Cancel one denial.' }
  };
  const DAILY = [
    { id: 'sunny', name: 'Sunny Day', effect: '+10% grace' }, { id: 'rainy', name: 'Rainy Day', effect: 'Waves +1' },
    { id: 'hydration', name: 'Hydration Day', effect: 'Fill prompts lean shorter waits' }, { id: 'lazy', name: 'Lazy Sunday', effect: 'Rest day' },
    { id: 'quiz', name: 'Pop Quiz', effect: '3 random check-ins' }, { id: 'big_kid', name: 'Big Kid Test', effect: 'Hit 5 windows → +5 Control' },
    { id: 'little_day', name: 'Little Day', effect: 'Mode = regress for today' }, { id: 'mystery', name: 'Mystery Gear', effect: 'Gear rolled at start (sim)' },
    { id: 'fog', name: 'Fog Bank', effect: 'Fewer warning prompts' }, { id: 'clear', name: 'Clear Skies', effect: 'Warnings always on' },
    { id: 'lucky7', name: 'Lucky 7', effect: '7th roll of the day = go' }, { id: 'double', name: 'Double or Nothing', effect: 'Control changes ×2 today' },
    { id: 'care_choice', name: 'Caregiver\'s Choice', effect: 'Partner picks the card' }, { id: 'speed', name: 'Speed Round', effect: 'Waits ×0.7, gains ×1.5' },
    { id: 'quiet_office', name: 'Quiet Office', effect: 'Office wording all day' }, { id: 'snack', name: 'Snack Attack', effect: '2 capped drink prompts' },
    { id: 'gentle', name: 'Gentle Day', effect: 'Curses off' }, { id: 'gauntlet', name: 'Gauntlet', effect: 'One Messy Holding gauntlet (messy on only)' },
    { id: 'streak_shield', name: 'Streak Shield', effect: 'Streak safe today' }, { id: 'reverse', name: 'Reverse Day', effect: 'Progress↔regress swapped' },
    { id: 'bonus_spare', name: 'Bonus Spare', effect: '+1 spare' }, { id: 'chill', name: 'Chill Pill', effect: 'Waves −1' }
  ];
  const PUNISH = [
    { id: 'diaper_day', name: 'Diaper Day', effect: 'Gear set to diaper for the whole day', maxH: 24 },
    { id: 'pullup_probation', name: 'Pull-up Probation', effect: 'Gear one step thicker', maxH: 4 },
    { id: 'extra_checkins', name: 'Extra Check-ins', effect: '+1 check-in prompt per hour', maxH: 3 },
    { id: 'no_perm', name: 'No-Permission Window', effect: 'Sim answers "not yet"', maxH: 1.5 },
    { id: 'strict', name: 'Strict Rules', effect: 'Grace ×0.6', maxH: 8 },
    { id: 'lines', name: 'Lines', effect: 'Type a short line N times in-app (N 5–20)', maxH: 0 },
    { id: 'chore', name: 'Chore', effect: 'Pick a real chore card', maxH: 0 },
    { id: 'short_fuse', name: 'Short Fuse', effect: 'Wait ranges ×0.5', maxH: 3 },
    { id: 'silent', name: 'Silent Treatment', effect: 'No pre-warnings', maxH: 4 },
    { id: 'spare_tax', name: 'Spare Tax', effect: '−1 spare', maxH: 0 },
    { id: 'babysitter', name: 'Babysitter Watch', effect: 'Babysitter-profile check-ins on', maxH: 2 },
    { id: 'timeout_potty', name: 'Time-out from potty permission', effect: 'Sim withholds potty permission (within skin-safety)', maxH: 1 }
  ];
  const MASTERIES = [
    { id: 'dry_streak_3', name: 'Three Dry', need: { dryNights: 3 } }, { id: 'alerts_made_5', name: 'Alert Ace', need: { alertsMade: 5 } },
    { id: 'dry_nights_5', name: 'Night Guard', need: { dryNights: 5 } }, { id: 'waits_survived_10', name: 'Patient', need: { waitsSurvived: 10 } },
    { id: 'go_streak_5', name: 'Potty Streak', need: { pottyStreak: 5 } }, { id: 'dribbles_logged_8', name: 'Dribble Diary', need: { dribbles: 8 } },
    { id: 'sat_reports_20', name: 'Honest Reporter', need: { satReports: 20 } }, { id: 'changes_rolled_10', name: 'Change Roulette', need: { changeRolls: 10 } },
    { id: 'gear_days_7', name: 'Week in Gear', need: { gearDays: 7 } }, { id: 'trips_out_5', name: 'Out & About', need: { trips: 5 } },
    { id: 'pre_potty_micros_10', name: 'Drip Before Go', need: { prePottyMicros: 10 } }
  ];
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  function load() { return Object.assign({ classId: null, perks: [], masteries: [], daily: null, punish: [], xp: {}, dribblesLog: [] }, J(KEY, {})); }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function get(id) {
    if (!id) return null;
    const hit = CLASSES.find(c => c.id === id);
    if (hit) return hit;
    return CLASSES.find(c => (c.aliases || []).includes(id) || (c.aliases || []).includes(String(id))) || null;
  }
  function pick(id) { const c = get(id); if (!c) return null; const s = load(); s.classId = c.id; save(s); return s; }
  function active() { const s = load(); return s.classId ? Object.assign({}, get(s.classId), { state: s }) : null; }
  function note(kind, n) { const s = load(); s.xp[kind] = (s.xp[kind] || 0) + (n == null ? 1 : +n || 0); save(s); return s.xp[kind]; }
  /** Log a user-confirmed dribble (Leaky / Dribbler gate). */
  function noteDribble(ts) {
    const s = load(); s.dribblesLog = (s.dribblesLog || []).filter(t => Date.now() - t < 864e5);
    s.dribblesLog.push(ts || Date.now());
    s.xp.dribbles = (s.xp.dribbles || 0) + 1;
    save(s);
    try {
      const b = window.BSPath && window.BSPath.load();
      if (b && b.dribbleGate) { b.dribbleLogged = true; window.BSPath.save(b); }
    } catch (e) {}
    return s.dribblesLog.length;
  }
  function hasRecentDribble(ms) {
    ms = ms == null ? 6 * 3600e3 : ms;
    const s = load();
    return (s.dribblesLog || []).some(t => Date.now() - t <= ms);
  }
  /** Apply oddsMod to a weights object (mutates copy). */
  function applyOdds(weights) {
    const a = active(); if (!a || !a.oddsMod) return Object.assign({}, weights);
    const w = Object.assign({}, weights);
    Object.keys(a.oddsMod).forEach(k => { if (w[k] != null) w[k] = Math.max(0, w[k] * a.oddsMod[k]); });
    return w;
  }
  function changeSatBump() {
    const a = active();
    let n = (a && a.flags && a.flags.changeSatBump) || 0;
    try { if (window.BSPathPlay) n = Math.max(n, window.BSPathPlay.protectionPressureBump()); } catch (e) {}
    return n;
  }
  function holdScale() {
    const a = active();
    let x = (a && a.flags && a.flags.holdScale) || 1;
    try { if (window.BSPathPlay) x *= window.BSPathPlay.holdScaleFromStats(); } catch (e) {}
    return x;
  }
  function needDribbleFirst() {
    const a = active();
    if (a && a.flags && a.flags.needDribbleFirst) return true;
    try { const b = window.BSPath && window.BSPath.load(); return !!(b && b.dribbleGate && !b.dribbleLogged); } catch (e) {}
    return false;
  }
  function pooMod(id) {
    const c = id ? get(id) : active();
    const p = c && c.flags && c.flags.poo;
    return p || { note: '', delta: 0 };
  }
  /** Apply the active class's small #2 delta to a logged tally. */
  function pooAdjust(base, id) {
    const d = +pooMod(id).delta || 0;
    return (+base || 0) + d;
  }
  function eventStepsFor(outcome) {
    const a = active(); if (!a || !a.eventSteps) return [];
    return a.eventSteps.filter(s => !s.before || s.before.includes(outcome) || s.before.includes('permission'));
  }

  window.BSClasses = {
    KEY, CLASSES, PERKS, DAILY, PUNISH, MASTERIES,
    load, save, get, pick, active, note, noteDribble, hasRecentDribble,
    applyOdds, changeSatBump, holdScale, needDribbleFirst, eventStepsFor, pooMod, pooAdjust
  };
})();
