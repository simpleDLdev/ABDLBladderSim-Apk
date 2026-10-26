/* ===========================
   quiz-plus.js — v16 quiz types. Each type feeds a distinct mechanic:
     scenario   (branching story)      → Path difficulty + direction + story intro
     thisorthat (rapid-fire pairs)     → Path event-type weights
     sliders    (self-rating 0–10)     → calibration prior (starting control) + hold-length scale
     classquiz  (which class are you)  → class suggestion (% match, runner-up)
     symptom    (symptom unlock)       → unlockable game flags (each user-confirmed, always switch-off-able)
     gear       (stash & gear check)   → stash gate + protection rules (day/night floor, spares, change rule)
     dare       (dare deck)            → accepted dares become Potty Path board tasks
     longBoard  (36 Q, mixed formats)  → full board config
     longCamp   (32 Q, mixed formats)  → campaign day-shaping prefs
   All questions are original (structure inspired by personality / "which X are you" quiz sites).
   Storage: bs_quiz_plus_v1. Game rules only; no sexual content; no real-body training; real urge always wins.
   =========================== */
(function () {
  const KEY = 'bs_quiz_plus_v1';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function load() { return Object.assign({ results: {}, flags: {} }, J(KEY, {})); }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  const o = (l, s) => ({ l, s: s || {} });
  const pr = (a, as, b, bs) => ({ kind: 'pair', a: o(a, as), b: o(b, bs) });
  const sl = (q, key, lo, hi) => ({ kind: 'slider', q, key, lo, hi });
  const ch = (q, opts) => ({ kind: 'choice', q, opts });
  const CLASS_IDS = ['bigkid', 'scout', 'padgirl', 'pullup', 'little', 'baby', 'cascade', 'shy']; // v18: Shy Goer added

  // ---------- 1. Scenario (branching) ----------
  const SCENARIO = {
    start: 'n1',
    nodes: {
      n1: { t: 'Recess bell! The sim says you have a little urge (you decide how real it feels). What do you do?', opts: [o('Ask the teacher right away', { grow: 2, next: 'n2' }), o('Keep playing tag — it can wait', { slide: 1, spice: 1, next: 'n3' }), o('Check your gear first', { gear: 2, next: 'n4' })] },
      n2: { t: 'The teacher says "after this game". Your move?', opts: [o('Wait politely by the door', { grow: 1, next: 'n5' }), o('Ask again, nicely', { grow: 1, spice: 1, next: 'n5' }), o('Shrug and remember you\'re padded', { slide: 2, gear: 1, next: 'n6' })] },
      n3: { t: 'Tag gets wild. The game rolls a surprise wiggle event. You…', opts: [o('Run for the potty now', { grow: 1, spice: 1, next: 'n5' }), o('Do a potty dance and keep going', { spice: 2, next: 'n6' }), o('Let the dice decide', { free: 2, spice: 1, next: 'n7' })] },
      n4: { t: 'Your gear check shows you packed a spare. Feeling…', opts: [o('Prepared — Scout style', { grow: 1, gear: 1, next: 'n5' }), o('Cosy — maybe I don\'t need to hurry', { slide: 2, next: 'n6' }), o('Curious what the board will do', { free: 2, next: 'n7' })] },
      n5: { t: 'You made it in time. The class cheers. Next recess you want…', opts: [o('A harder challenge', { grow: 2, spice: 2, end: 1 }), o('The same, nice and steady', { grow: 1, end: 1 }), o('A silly twist', { free: 1, spice: 1, end: 1 })] },
      n6: { t: 'The sim says "oops" — a little accident in your gear . How does the story continue?', opts: [o('Ask for a change and try again', { grow: 1, end: 1 }), o('Stay in it till the next roll', { slide: 2, spice: 1, end: 1 }), o('Laugh, shrug, keep playing', { slide: 1, free: 1, end: 1 })] },
      n7: { t: 'The die lands on a mystery square. You hope for…', opts: [o('A shortcut ladder', { grow: 1, end: 1 }), o('A wild chance card', { free: 2, spice: 2, end: 1 }), o('A comfy rest square', { spice: -1, end: 1 })] }
    }
  };
  function scoreScenario(s) {
    const dir = (s.grow || 0) >= Math.max(s.slide || 0, s.free || 0) ? 'grow' : (s.slide || 0) >= (s.free || 0) ? 'slide' : 'free';
    const difficulty = Math.max(1, Math.min(5, 2 + Math.round((s.spice || 0) / 2)));
    return { dir, difficulty, gearLean: s.gear || 0, summary: `Story says: ${{ grow: 'climb up', slide: 'slide down', free: 'free play' }[dir]} · difficulty ${difficulty}/5`, feeds: 'Path direction + difficulty' };
  }

  // ---------- 2. This-or-that ----------
  const TOT = [
    pr('🧃 Juice box break', { rest: 1 }, '⏱ Beat-the-timer', { hold: 1 }), pr('📋 Quick check-in', { checkin: 1 }, '🎲 Mystery card', { chance: 1 }),
    pr('🎒 Pack the diaper bag', { gear: 1 }, '🎉 Silly dance', { fun: 1 }), pr('🛋 Nap square', { rest: 1 }, '🎲 Roll again', { chance: 1 }),
    pr('🧷 Gear swap', { gear: 1 }, '📋 Rate your urge', { checkin: 1 }), pr('⏱ Wait-for-the-bell', { hold: 1 }, '🎉 Sticker hunt', { fun: 1 }),
    pr('🎲 Double or nothing', { chance: 1 }, '🛋 Snack & sit', { rest: 1 }), pr('📋 Saturation check', { checkin: 1 }, '🎒 Spare count', { gear: 1 }),
    pr('🎉 Cartoon break', { fun: 1 }, '⏱ Hold the line', { hold: 1 }), pr('🎲 Swap places', { chance: 1 }, '🧷 Thicker gear', { gear: 1 }),
    pr('🛋 Quiet colouring', { rest: 1 }, '🎉 Kitchen-disco', { fun: 1 }), pr('⏱ Potty race', { hold: 1 }, '📋 Honest log', { checkin: 1 }),
    pr('Short board', { short: 1 }, 'Long board', { long: 1 }), pr('Surprises', { chance: 1 }, 'Predictable', { checkin: 1 })
  ];
  const ETYPES = ['checkin', 'hold', 'fun', 'rest', 'gear', 'chance'];
  function scoreTot(s) {
    const w = {}; ETYPES.forEach(k => { w[k] = +(1 + (s[k] || 0) * 0.35).toFixed(2); });
    const top = ETYPES.slice().sort((a, b) => (s[b] || 0) - (s[a] || 0)).slice(0, 2);
    return { weights: w, length: (s.long || 0) > (s.short || 0) ? 80 : (s.short || 0) > 0 ? 40 : 60, summary: 'More ' + top.join(' + ') + ' squares', feeds: 'Path event weights' };
  }

  // ---------- 3. Self-rating sliders ----------
  const SLIDERS = [
    sl('How much warning does your bladder give?', 'warn', 'None', 'Lots'), sl('How well do you "hold" in the sim lately?', 'hold', 'Barely', 'Iron'),
    sl('How often should you be told "use your gear"?', 'gearwant', 'Never', 'Always'), sl('How sneaky should waits be?', 'hidden', 'Shown', 'Hidden'),
    sl('How long should hold squares feel?', 'holdlen', 'Tiny', 'Long'), sl('How bossy should the caregiver voice be?', 'bossy', 'Gentle', 'Strict'),
    sl('How much do you want to climb vs slide?', 'climb', 'Slide', 'Climb'), sl('How chaotic should the board be?', 'chaos', 'Calm', 'Chaos')
  ];
  function scoreSliders(s) {
    const v = k => (s[k] == null ? 5 : +s[k]);
    const control = Math.round(((v('warn') + v('hold')) / 20) * 100 * 0.8 + (10 - v('gearwant')) * 2);
    const holdScale = +(0.6 + v('holdlen') * 0.08).toFixed(2);
    return { control: Math.max(5, Math.min(95, control)), holdScale, hidden: v('hidden') >= 6, chaos: v('chaos'), climb: v('climb'), summary: `Self-rated control ${Math.max(5, Math.min(95, control))}% · holds ×${holdScale}${v('hidden') >= 6 ? ' · hidden waits' : ''}`, feeds: 'Calibration prior + hold length' };
  }

  // ---------- 4. Which class are you? ----------
  const C = (l, ids) => o(l, ids.reduce((a, k) => (a[k] = 1, a), {}));
  const CLASSQ = [
    ch('Pick a backpack charm:', [C('⭐ Gold star', ['bigkid']), C('🧭 Compass', ['scout']), C('🎀 Bow', ['padgirl']), C('💧 Raindrop', ['pullup']), C('🧸 Teddy', ['little']), C('🍼 Bottle', ['baby']), C('🌊 Wave', ['cascade'])]),
    ch('Your ideal Saturday:', [C('Chores done, then a reward', ['bigkid']), C('A day trip with a packed bag', ['scout']), C('Cute outfit, mall, café', ['padgirl']), C('Cartoons, lots of small breaks', ['pullup', 'little']), C('Blanket fort all day', ['baby']), C('Water park chaos', ['cascade'])]),
    ch('The grown-up says "wait 10 minutes". You:', [C('Set a timer and nail it', ['bigkid']), C('Check you have a spare, then wait', ['scout']), C('Wait, but you\'re glad of the pad', ['padgirl']), C('Probably a little drip first', ['pullup']), C('Potty dance the whole time', ['little']), C('What potty?', ['baby']), C('Wait… and then everything at once', ['cascade'])]),
    ch('Which square do you hope to land on?', [C('🏫 Class test', ['bigkid']), C('🎒 Outing', ['scout']), C('🧷 Gear swap', ['padgirl']), C('📋 Check-in', ['pullup']), C('🎉 Play time', ['little']), C('🛋 Nap', ['baby']), C('🎲 Chance', ['cascade'])]),
    ch('Your favourite bedtime gear:', [C('Undies', ['bigkid']), C('Undies + spare in the drawer', ['scout']), C('Pad', ['padgirl']), C('Pull-up', ['pullup']), C('Pull-up with a booster', ['little']), C('Thick diaper', ['baby', 'cascade'])]),
    ch('A friend asks for help. You:', [C('Make a checklist', ['bigkid']), C('Lend them your kit', ['scout']), C('Give styling tips', ['padgirl']), C('Help, with frequent breaks', ['pullup']), C('Bring snacks and a toy', ['little']), C('Need help yourself first', ['baby']), C('Help enthusiastically, then crash', ['cascade'])]),
    ch('Pick a board power-up:', [C('+1 to every roll', ['bigkid']), C('Spare stash +2', ['scout']), C('Leak shield', ['padgirl']), C('Drip-before-go skip', ['pullup']), C('Hug token', ['little']), C('Cosy blanket', ['baby']), C('Re-roll chaos', ['cascade'])]),
    ch('A surprise event ruins your plan. You:', [C('Adapt and move on', ['bigkid', 'scout']), C('Fix your outfit first', ['padgirl']), C('Need a minute', ['pullup', 'little']), C('Need a cuddle and a change', ['baby']), C('One surprise becomes three', ['cascade'])]),
    ch('Colour of your token:', [C('Blue', ['bigkid']), C('Green', ['scout']), C('Pink', ['padgirl']), C('Yellow', ['pullup']), C('Purple', ['little']), C('Pastel', ['baby']), C('Teal', ['cascade'])]),
    ch('Your sim urge style:', [C('Long warning', ['bigkid', 'scout']), C('Medium, with drips', ['padgirl', 'pullup']), C('Short and wiggly', ['little']), C('No warning at all', ['baby']), C('Waves that stack', ['cascade'])]),
    ch('The teacher hands out jobs. You get:', [C('Line leader', ['bigkid']), C('Map keeper', ['scout']), C('Decorations', ['padgirl']), C('Water-cup monitor', ['pullup']), C('Toy tidy', ['little']), C('Nap-mat helper', ['baby']), C('Splash-zone patrol', ['cascade'])]),
    ch('What makes a board day perfect?', [C('Finishing first', ['bigkid']), C('Being ready for anything', ['scout']), C('Looking cute the whole way', ['padgirl']), C('Little wins along the way', ['pullup']), C('Lots of play squares', ['little']), C('Being looked after', ['baby']), C('Total unpredictability', ['cascade'])])
  ];
  // v18 audit: Shy Goer gets one option on the 8 one-per-class questions
  [[0, '🙈 Tiny bell (quiet!)'], [2, 'Find the quietest potty first'], [3, 'A square nobody is watching'], [5, 'Help quietly, no fuss'], [6, 'Privacy door'], [8, 'Soft grey'], [10, 'Library helper'], [11, 'Nobody notices a thing']].forEach(([k, l]) => { if (CLASSQ[k]) CLASSQ[k].opts.push(o(l, { shy: 1 })); });
  function scoreClass(s, stash) {
    const total = CLASS_IDS.reduce((a, k) => a + (s[k] || 0), 0) || 1;
    const allowed = window.BSPath ? CLASS_IDS.filter(id => window.BSPath.classAllowed(id, stash)) : CLASS_IDS;
    const ranked = CLASS_IDS.slice().sort((a, b) => (s[b] || 0) - (s[a] || 0));
    const okRank = ranked.filter(id => allowed.includes(id));
    const best = okRank[0] || 'bigkid', second = okRank[1] || ranked[1];
    const name = id => (window.BSPath && window.BSPath.CLASS_BY_ID[id] ? window.BSPath.CLASS_BY_ID[id].name : id);
    const pct = Math.round(((s[best] || 0) / total) * 100);
    return { classId: best, second, pct, gatedOut: ranked[0] !== best ? ranked[0] : null, summary: `You are ${name(best)} (${pct}% match) · runner-up ${name(second)}`, feeds: 'Class suggestion on the Potty Path' };
  }

  // ---------- 5. Symptom unlock ----------
  const SYMS = { oab: '💢 Overactive bladder', urge_waves: '⚡ Urge waves', dribbler: '💧 Pre-void dribbler', sleepy: '😴 Sleepy bladder', quiet: '🔇 Quiet signals', cascade: '🌊 Cascade failure', movement: '🧍 Movement leaks' };
  const SYMQ = [
    ch('Should urges arrive…', [o('Slowly with lots of notice', {}), o('Suddenly', { oab: 2 }), o('In stacked waves', { urge_waves: 2 })]),
    ch('Before a potty square, should the sim add a small drip step?', [o('No', {}), o('Sometimes', { dribbler: 1 }), o('Every time', { dribbler: 2 })]),
    ch('Board night squares — how sleepy is your character?', [o('Wakes right up', {}), o('Hard to wake', { sleepy: 1 }), o('Sleeps through everything', { sleepy: 2 })]),
    ch('Should warnings show before events?', [o('Always', {}), o('Sometimes', { quiet: 1 }), o('Hardly ever', { quiet: 2 })]),
    ch('When a leak happens, should another follow?', [o('No', {}), o('Maybe', { cascade: 1 }), o('Yes, chain them', { cascade: 2 })]),
    ch('Should stand-up / walking cues trigger leak events?', [o('No', {}), o('Rarely', { movement: 1 }), o('Often', { movement: 2 })]),
    ch('How fast should hold squares feel?', [o('Relaxed', {}), o('Short', { oab: 1 }), o('Very short', { oab: 2 })]),
    ch('Should check-ins sometimes find a surprise drip?', [o('No', {}), o('Yes', { dribbler: 1, quiet: 1 })]),
    ch('Mid-board, should urge-wave race squares pop up?', [o('No', {}), o('Yes', { urge_waves: 1 }), o('Lots', { urge_waves: 2 })]),
    ch('Night squares: stay in gear rather than get up?', [o('Get up', {}), o('Sometimes stay', { sleepy: 1 }), o('Stay', { sleepy: 2, quiet: 1 })])
  ];
  function scoreSym(s) {
    const unlocked = Object.keys(SYMS).filter(k => (s[k] || 0) >= 2);
    return { unlocked, summary: unlocked.length ? 'Unlockable: ' + unlocked.map(k => SYMS[k]).join(', ') : 'No symptoms unlocked', feeds: 'Symptom flags (you confirm each; switch off any time)' };
  }

  // ---------- 6. Stash & gear ----------
  const GEARQ = [
    ch('Pads on hand right now?', [o('None', {}), o('A few', { pads: 1 }), o('Plenty', { pads: 2 })]),
    ch('Pull-ups on hand?', [o('None', {}), o('A few', { pullups: 1 }), o('Plenty', { pullups: 2 })]),
    ch('Diapers on hand?', [o('None', {}), o('A few', { diapers: 1 }), o('Plenty', { diapers: 2 })]),
    ch('Boosters / doublers?', [o('No', {}), o('Yes', { boosters: 1 })]),
    ch('Daytime gear floor?', [o('Undies OK', { dayFloor: 0 }), o('At least a pad', { dayFloor: 1 }), o('At least a pull-up', { dayFloor: 2 }), o('Diaper', { dayFloor: 3 })]),
    ch('Night gear floor?', [o('Same as day', { nightBump: 0 }), o('One step thicker', { nightBump: 1 }), o('Always a diaper', { nightBump: 3 })]),
    ch('Spares to carry when the board sends you out?', [o('0', { spares: 0 }), o('1', { spares: 1 }), o('2+', { spares: 2 })]),
    ch('Change rule:', [o('Change whenever you want', { change: 'free' }), o('Ask first (May I?)', { change: 'ask' }), o('Change at a saturation you enter', { change: 'threshold' })]),
    ch('Skin comfort first — change if it\'s been on long?', [o('Yes, always (recommended)', { skin: 1 }), o('Yes', { skin: 1 })]),
    ch('Is the stash basically unlimited?', [o('No', {}), o('Yes', { unlimited: 1 })])
  ];
  const PROT = ['undies', 'pad', 'pull-up', 'diaper', 'thick diaper'];
  function scoreGear(s) {
    const unl = !!s.unlimited;
    const stash = { pads: unl || (s.pads || 0) > 0, pullups: unl || (s.pullups || 0) > 0, diapers: unl || (s.diapers || 0) > 0, boosters: unl || !!s.boosters, unlimited: unl };
    const has = i => i === 0 || (i === 1 && stash.pads) || (i === 2 && stash.pullups) || (i >= 3 && stash.diapers);
    let day = s.dayFloor || 0; while (day > 0 && !has(day)) day--;
    let night = Math.min(4, day + (s.nightBump || 0)); if (night === 4 && !stash.boosters && !unl) night = 3; while (night > day && !has(night)) night--;
    const rules = { dayFloor: PROT[day], nightFloor: PROT[night], spares: s.spares || 0, change: s.change || 'ask', skinFirst: true };
    return { stash, rules, summary: `Stash: ${['pads', 'pullups', 'diapers'].filter(k => stash[k]).join(', ') || 'none'} · day ≥ ${rules.dayFloor} · night ≥ ${rules.nightFloor} · spares ${rules.spares} · change: ${rules.change}`, feeds: 'Stash gate + protection rules' };
  }

  // ---------- 7. Dare deck ----------
  const D = (id, l, task, stars) => o(l, { dare: { id, task, stars } });
  const DAREQ = [
    ch('Dare 1 — pick one:', [D('tidy5', '🧹 5-minute tidy', 'Tidy one surface for 5 minutes', 2), D('sticker', '⭐ Sticker chart', 'Put a sticker on the calendar for your next dry check-in', 1), o('Pass', {})]),
    ch('Dare 2 — pick one:', [D('askperm', '🙋 Ask first', 'Next potty square: tap "May I?" before going', 2), D('logall', '📋 Log everything', 'Log every check-in honestly for the next 5 squares', 2), o('Pass', {})]),
    ch('Dare 3 — pick one:', [D('cartoon', '📺 Cartoon block', 'Watch one cartoon episode before your next roll', 1), D('colour', '🖍 Colour 10 min', 'Colour or doodle for 10 minutes', 1), o('Pass', {})]),
    ch('Dare 4 — pick one:', [D('thicker', '🧷 Gear up', 'Wear one step thicker gear for the next 5 squares (stash allowing)', 3), D('spare', '🎒 Pack a spare', 'Pack a spare in your bag before the next roll', 1), o('Pass', {})]),
    ch('Dare 5 — pick one:', [D('lines', '📝 Lines', 'Type "I check in honestly" 5 times in the log', 1), D('dance', '💃 Silly dance', 'Do a 30-second silly dance (no strain)', 1), o('Pass', {})]),
    ch('Dare 6 — pick one:', [D('nodrinkprompt', '🥤 Sip check', 'Next time you drink, log it (your normal amount — no extra)', 1), D('water_plant', '🪴 Water a plant', 'Water a plant or wipe the sink', 1), o('Pass', {})]),
    ch('Dare 7 — pick one:', [D('hiddenwait', '✋ Hidden waits', 'Hide wait timers for the next 3 hold squares', 2), D('nap', '🛋 Rest 10', 'Lie down for 10 minutes with a stuffie', 1), o('Pass', {})]),
    ch('Dare 8 — pick one:', [D('mayi_twice', '🙋 Ask twice', 'Next May I? needs two asks', 2), D('snack', '🍎 Snack time', 'Have a small snack at the table', 1), o('Pass', {})]),
    ch('Dare 9 — pick one:', [D('outfit', '👕 Comfy outfit', 'Change into your comfiest outfit', 1), D('journal', '📓 One-line diary', 'Write one line about your board day', 1), o('Pass', {})]),
    ch('Dare 10 — pick one:', [D('stay_till_roll', '⏳ Stay till next roll', 'After the next accident, stay till the next roll (skin comfort first)', 2), D('tidy_toys', '🧸 Toy tidy', 'Put away 10 things', 1), o('Pass', {})])
  ];
  function scoreDare(s) { const dares = s.dares || []; return { dares, summary: dares.length ? dares.length + ' dares added to the board' : 'No dares (all passed)', feeds: 'Board tasks on 🎲 event squares' }; }

  // ---------- 8. Long board quiz (36) ----------
  const LONGBOARD = [
    ch('Where do you want to go on this board?', [o('Climb up (more control)', { dir: 'grow' }), o('Slide down (more padded)', { dir: 'slide' }), o('Free play', { dir: 'free' })]),
    ch('Board length?', [o('Short (40)', { len: 40 }), o('Normal (60)', { len: 60 }), o('Marathon (80)', { len: 80 })]),
    ch('Start with 3 calibration squares?', [o('Yes', { calib: 1 }), o('No', { calib: 0 })]),
    ch('Recalibrate every ~10 squares?', [o('Yes', { recal: 1 }), o('No', { recal: 0 })]),
    sl('Difficulty feel', 'diff', 'Gentle', 'Tough'), sl('Surprise level', 'chaos', 'Predictable', 'Wild'),
    pr('More ladders', { ladders: 1 }, 'More slides', { slides: 1 }), pr('Shown waits', { hidden: -1 }, 'Hidden waits', { hidden: 1 }),
    ch('Dice style?', [o('Normal d6', { dice: 'd6' }), o('Class decides', { dice: 'class' }), o('Big d8 for speed', { dice: 'd8' })]),
    ch('Roll how?', [o('Tap', { shake: 0 }), o('Tap or shake', { shake: 1 })]),
    pr('Check-ins', { checkin: 1 }, 'Holds', { hold: 1 }), pr('Fun squares', { fun: 1 }, 'Rest squares', { rest: 1 }),
    pr('Gear events', { gear: 1 }, 'Chance cards', { chance: 1 }), pr('Class squares often', { classq: 1 }, 'Class squares rarely', { classq: -1 }),
    ch('Hold squares length:', [o('1–3 min', { hl: 0.6 }), o('3–8 min', { hl: 1 }), o('5–15 min', { hl: 1.5 })]),
    ch('If you don\'t make a hold square:', [o('Step back 1', { back: 1 }), o('Step back by class die', { back: 'class' }), o('No step back, just a note', { back: 0 })]),
    ch('Stars for honest check-ins?', [o('Yes', { stars: 1 }), o('No', { stars: 0 })]),
    ch('Voice?', [o('🤗 Caregiver', { voice: 'caregiver' }), o('🍼 Babysitter', { voice: 'babysitter' }), o('📋 Coach', { voice: 'coach' })]),
    ch('Starting class?', [o('Use Which-Class quiz', { cls: 'quiz' }), o('Let calibration suggest', { cls: 'calib' }), o('Big Kid', { cls: 'bigkid' }), o('Baby (always padded)', { cls: 'baby' })]),
    ch('Allow 🔄 Class Swap squares?', [o('Yes', { swap: 1 }), o('No', { swap: 0 })]),
    ch('Leak-through on pad/pull-up classes:', [o('Offer a class-down', { leakDown: 1 }), o('Just a note', { leakDown: 0 })]),
    ch('Include dares from the Dare deck?', [o('Yes', { dares: 1 }), o('No', { dares: 0 })]),
    ch('Include symptom flags?', [o('Yes', { syms: 1 }), o('No', { syms: 0 })]),
    ch('Night landings:', [o('Token stays put overnight (silent)', { night: 'pause' }), o('One night square in the morning', { night: 'square' })]),
    ch('Square icons:', [o('Big emoji', { icons: 'emoji' }), o('Emoji + label', { icons: 'label' })]),
    sl('How often should check-ins appear?', 'ciFreq', 'Rarely', 'Often'),
    sl('How strict should May I? be?', 'strict', 'Easy', 'Strict'),
    pr('Rest when tired', { rest: 1 }, 'Push on', { hold: 1 }), pr('Gear-swap fun', { gear: 1 }, 'Silly-dance fun', { fun: 1 }),
    ch('Finish reward:', [o('Title + stars', { reward: 'title' }), o('Choose-or-keep class', { reward: 'class' })]),
    ch('Animate the token?', [o('Yes', { anim: 1 }), o('Fast mode', { anim: 0 })]),
    ch('Dice sound/vibrate?', [o('Silent', { buzz: 0 }), o('Small vibrate', { buzz: 1 })]),
    ch('Office-safe wording on the board?', [o('No', { office: 0 }), o('Yes', { office: 1 })]),
    ch('Track symptoms that stick from play?', [o('Yes (I can switch them off)', { stick: 1 }), o('No', { stick: 0 })]),
    ch('How many active dares at once?', [o('1', { dareMax: 1 }), o('3', { dareMax: 3 }), o('5', { dareMax: 5 })])
  ];
  function scoreLongBoard(s) {
    const n = v => (v == null ? 5 : +v);
    const cfg = { dir: s.dir || 'free', length: s.len || 60, calib: s.calib !== 0, recal: s.recal !== 0, difficulty: Math.max(1, Math.min(5, Math.round(1 + n(s.diff) * 0.4))), chaos: n(s.chaos),
      ladderBias: (s.ladders || 0) - (s.slides || 0), hidden: (s.hidden || 0) > 0, dice: s.dice || 'class', shake: s.shake !== 0,
      weights: { checkin: 1 + (s.checkin || 0) * 0.3 + (n(s.ciFreq) - 5) * 0.06, hold: 1 + (s.hold || 0) * 0.3, fun: 1 + (s.fun || 0) * 0.3, rest: 1 + (s.rest || 0) * 0.3, gear: 1 + (s.gear || 0) * 0.3, chance: 1 + (s.chance || 0) * 0.3 + n(s.chaos) * 0.04 },
      classFreq: 1 + (s.classq || 0) * 0.4, holdScale: s.hl || 1, back: s.back == null ? 'class' : s.back, stars: s.stars !== 0, voice: s.voice || 'caregiver', cls: s.cls || 'quiz', swap: s.swap !== 0, leakDown: s.leakDown !== 0,
      dares: s.dares !== 0, syms: s.syms !== 0, night: s.night || 'pause', strict: n(s.strict), reward: s.reward || 'title', anim: s.anim !== 0, office: !!s.office, dareMax: s.dareMax || 3 };
    return { cfg, summary: `${cfg.length} squares · ${cfg.dir} · difficulty ${cfg.difficulty}/5 · ${cfg.calib ? 'calibrating' : 'no calibration'} · dice ${cfg.dice}`, feeds: 'Potty Path board setup' };
  }

  // ---------- 9. Long campaign quiz (32) ----------
  const LONGCAMP = [
    ch('Campaign length?', [o('3 days', { days: 3 }), o('7 days', { days: 7 }), o('14 days', { days: 14 }), o('Open-ended', { days: 0 })]),
    ch('Direction?', [o('Progress (more control)', { dir: 'progress' }), o('Regress', { dir: 'regress' }), o('Hold steady', { dir: 'hold' })]),
    ch('Rest days per week?', [o('0', { rest: 0 }), o('1', { rest: 1 }), o('2', { rest: 2 })]),
    sl('Morning intensity', 'am', 'Calm', 'Busy'), sl('Afternoon intensity', 'pm', 'Calm', 'Busy'), sl('Evening intensity', 'eve', 'Calm', 'Busy'),
    ch('Nights in the campaign?', [o('Off', { nights: 0 }), o('Natural Night logs count as check-ins', { nights: 1 }), o('Night focus', { nights: 2 })]),
    ch('Daily class:', [o('Keep one class', { rot: 'keep' }), o('Briefing suggests 3', { rot: 'suggest' }), o('Random each day', { rot: 'random' })]),
    pr('Goal: dry check-ins', { gDry: 1 }, 'Goal: honest logging', { gLog: 1 }), pr('Goal: potty streak', { gStreak: 1 }, 'Goal: gear days', { gGear: 1 }),
    pr('Goal: board squares', { gBoard: 1 }, 'Goal: dares done', { gDare: 1 }),
    ch('Punishments enabled?', [o('Off', { pun: 0 }), o('Gentle only (stars, lines, chores)', { pun: 1 }), o('The full list', { pun: 2 })]),
    ch('Max active punishments:', [o('1', { punMax: 1 }), o('2', { punMax: 2 }), o('3', { punMax: 3 })]),
    ch('Harder-than-profile day:', [o('Rank down early', { hard: 'rank' }), o('Punishment roll', { hard: 'punish' }), o('Nothing', { hard: 'none' })]),
    ch('Daily cards?', [o('Off', { cards: 0 }), o('Blessings only', { cards: 1 }), o('Blessings + curses', { cards: 2 })]),
    sl('How surprising should days be?', 'surprise', 'Plan', 'Surprise'),
    ch('Morning briefing?', [o('Yes', { brief: 1 }), o('No', { brief: 0 })]),
    ch('Evening recap?', [o('Yes', { recap: 1 }), o('No', { recap: 0 })]),
    pr('Caregiver voice', { voice: 'caregiver' }, 'Coach voice', { voice: 'coach' }),
    ch('Outings in the campaign?', [o('No', { out: 0 }), o('Sometimes', { out: 1 }), o('Often', { out: 2 })]),
    ch('Spares when out:', [o('Gear quiz decides', { sp: 'gear' }), o('Always 1', { sp: 1 }), o('Always 2', { sp: 2 })]),
    sl('How strict are change rules?', 'chg', 'Free', 'Strict'),
    ch('Board in the campaign?', [o('No', { board: 0 }), o('One board per campaign', { board: 1 }), o('New board each day', { board: 2 })]),
    ch('Symptoms can stick between days?', [o('Yes (switch off any time)', { stick: 1 }), o('No', { stick: 0 })]),
    ch('Rank-up reward:', [o('Title', { rw: 'title' }), o('Perk pick', { rw: 'perk' }), o('Stars', { rw: 'stars' })]),
    ch('Missed day rule:', [o('Idle (streak pauses)', { miss: 'idle' }), o('Counts as a fail', { miss: 'fail' })]),
    pr('Short sessions', { sess: 'short' }, 'Long sessions', { sess: 'long' }),
    ch('Office days (neutral wording)?', [o('Never', { office: 0 }), o('Weekdays', { office: 1 })]),
    ch('Quiz results that feed in by default:', [o('All of them', { feedAll: 1 }), o('Only A/B', { feedAll: 0 })]),
    sl('How big are rank steps?', 'step', 'Small', 'Big'),
    ch('Drink prompts in the campaign?', [o('Off', { drinks: 0 }), o('Capped prompts only (safety limits)', { drinks: 1 })]),
    ch('End of campaign:', [o('Summary card', { end: 'summary' }), o('Start next automatically', { end: 'next' })])
  ];
  function scoreLongCamp(s) {
    const n = v => (v == null ? 5 : +v);
    const p = { days: s.days == null ? 7 : s.days, dir: s.dir || 'hold', restPerWeek: s.rest == null ? 1 : s.rest, blocks: { morning: n(s.am), afternoon: n(s.pm), evening: n(s.eve) }, nights: s.nights || 0, rotation: s.rot || 'suggest',
      goals: ['gDry', 'gLog', 'gStreak', 'gGear', 'gBoard', 'gDare'].filter(k => s[k]), punish: s.pun == null ? 1 : s.pun, punMax: s.punMax || 2, hardDay: s.hard || 'none', cards: s.cards || 0, surprise: n(s.surprise),
      briefing: s.brief !== 0, recap: s.recap !== 0, voice: s.voice || 'caregiver', outings: s.out || 0, spares: s.sp || 'gear', changeStrict: n(s.chg), board: s.board == null ? 1 : s.board, stick: s.stick !== 0,
      reward: s.rw || 'title', missed: s.miss || 'idle', sessions: s.sess || 'short', office: !!s.office, feedAll: s.feedAll !== 0, step: n(s.step), drinks: s.drinks || 0, end: s.end || 'summary' };
    return { prefs: p, summary: `${p.days || 'open'} days · ${p.dir} · rest ${p.restPerWeek}/wk · class ${p.rotation} · goals ${p.goals.length}`, feeds: 'Campaign day shape' };
  }

  const QUIZZES = {
    scenario: { title: '📖 Scenario: Recess Story', type: 'Branching', blurb: 'Choose what happens next; your path sets direction & difficulty.', branch: SCENARIO, score: scoreScenario },
    thisorthat: { title: '⚡ This or That', type: 'Rapid fire', blurb: '14 quick pairs — 5 s each, tap fast!', qs: TOT, score: scoreTot, timed: 5 },
    sliders: { title: '🎚 Self-Rating', type: 'Sliders', blurb: 'Rate 8 things 0–10. Seeds the board\'s calibration.', qs: SLIDERS, score: scoreSliders },
    classquiz: { title: '🏫 Which Class Are You?', type: 'Personality', blurb: '12 questions, % match to one of the 8 board classes.', qs: CLASSQ, score: s => scoreClass(s, (load().results.gear || {}).stash) },
    symptom: { title: '🔓 Symptom Unlock', type: 'Unlock', blurb: 'Unlock symptoms. You confirm each one.', qs: SYMQ, score: scoreSym },
    gear: { title: '🎒 Stash & Gear Check', type: 'Gear', blurb: 'What\'s on hand → which classes you can play + protection rules.', qs: GEARQ, score: scoreGear },
    dare: { title: '🎯 Dare Deck', type: 'Challenge', blurb: 'Pick a dare or pass; picked dares become board tasks.', qs: DAREQ, score: scoreDare },
    longBoard: { title: '🎲 Long board quiz', type: 'Long · mixed', blurb: `${LONGBOARD.length} questions mixing choices, pairs and sliders.`, qs: LONGBOARD, score: scoreLongBoard },
    longCamp: { title: '🏅 Long campaign quiz', type: 'Long · mixed', blurb: `${LONGCAMP.length} questions shaping every campaign day.`, qs: LONGCAMP, score: scoreLongCamp }
  };
  function addScore(acc, s) {
    Object.keys(s || {}).forEach(k => {
      const v = s[k];
      if (k === 'dare') (acc.dares = acc.dares || []).push(v);
      else if (k === 'next' || k === 'end') {}
      else if (typeof v === 'number' && ['len', 'days', 'rest', 'dayFloor', 'nightBump', 'spares', 'hl', 'punMax', 'dareMax', 'nights', 'pun', 'cards', 'out', 'board', 'sp'].indexOf(k) < 0) acc[k] = (acc[k] || 0) + v;
      else acc[k] = v;
    });
    return acc;
  }
  /** Pure: score a list of picked options' s-objects (or sliders {key:val}). */
  function scoreAnswers(id, picks) {
    const acc = {}; (picks || []).forEach(p => { if (p && p.slider) acc[p.slider] = p.v; else addScore(acc, p); });
    return QUIZZES[id].score(acc);
  }
  function setResult(id, r, raw) { const d = load(); d.results[id] = Object.assign({ at: Date.now(), raw }, r); if (id === 'symptom') { d.flags = d.flags || {}; } save(d); return d.results[id]; }
  function result(id) { return load().results[id] || null; }
  function setFlag(k, on) { const d = load(); d.flags[k] = !!on; save(d); return d.flags; }
  function flags() { const f = load().flags || {}; return Object.keys(f).filter(k => f[k]); }

  // ---------- campaign feeds ----------
  const FEEDS = [['quizA', 'Quiz A'], ['quizB', 'Quiz B'], ['quizC', 'Quiz C'], ['packs', 'Quiz packs'], ['scenario', 'Scenario'], ['thisorthat', 'This or That'], ['sliders', 'Self-Rating'], ['classquiz', 'Which Class'], ['symptom', 'Symptom Unlock'], ['gear', 'Stash & Gear'], ['dare', 'Dare Deck'], ['longBoard', 'Long board'], ['longCamp', 'Long campaign']];
  function defaultFeeds() { const lc = result('longCamp'); const all = !lc || lc.prefs.feedAll; return FEEDS.reduce((a, [k]) => (a[k] = all || ['quizA', 'quizB', 'longCamp'].includes(k), a), {}); }
  function feeds(camp) { return Object.assign(defaultFeeds(), (camp && camp.feeds) || {}); }
  /** Pure-ish: combine enabled quiz results into today's campaign shape. */
  function campaignDay(camp, now) {
    const f = feeds(camp), d = load().results, out = { sources: [], lines: [] };
    const day = new Date(now || Date.now()); const seed = day.getFullYear() * 1000 + day.getMonth() * 40 + day.getDate();
    if (f.quizA || f.quizB) { try { const q = window.BSQuiz && window.BSQuiz.load(); if (f.quizA && q && q.baseline) { out.control = q.baseline.control; out.sources.push('Quiz A'); } if (f.quizB && q && q.target) { out.intensity = q.target.intensity; out.sources.push('Quiz B'); } if (f.quizC && q && q.cResult) { out.lines.push('Card: ' + q.cResult.title); out.sources.push('Quiz C'); } } catch (e) {} }
    if (f.packs) { try { const p = window.BSQuiz.loadPacks(); const n = Object.keys(p).filter(k => p[k] && p[k].result).length; if (n) { out.sources.push(n + ' packs'); if (p.voice && p.voice.result) out.lines.push('Voice: ' + p.voice.result.summary); } } catch (e) {} }
    if (f.sliders && d.sliders) { out.control = out.control == null ? d.sliders.control : Math.round((out.control + d.sliders.control) / 2); out.holdScale = d.sliders.holdScale; out.sources.push('Self-Rating'); }
    if (f.scenario && d.scenario) { out.difficulty = d.scenario.difficulty; out.dir = d.scenario.dir; out.sources.push('Scenario'); }
    if (f.thisorthat && d.thisorthat) { out.weights = d.thisorthat.weights; out.sources.push('This or That'); }
    if (f.gear && d.gear) { out.rules = d.gear.rules; out.lines.push(`Gear: day ≥ ${d.gear.rules.dayFloor}, night ≥ ${d.gear.rules.nightFloor}, spares ${d.gear.rules.spares}`); out.sources.push('Stash & Gear'); }
    if (f.symptom) { const fl = flags(); if (fl.length) { out.symptoms = fl; out.lines.push('Symptoms on: ' + fl.map(k => SYMS[k] || k).join(', ')); out.sources.push('Symptoms'); } }
    if (f.dare && d.dare && d.dare.dares.length) { const dd = d.dare.dares[seed % d.dare.dares.length]; out.dareOfDay = dd; out.lines.push('Dare of the day: ' + dd.task); out.sources.push('Dare Deck'); }
    let lc = f.longCamp && d.longCamp ? d.longCamp.prefs : null;
    let cls = f.classquiz && d.classquiz ? d.classquiz.classId : null;
    if (lc && lc.rotation === 'random' && window.BSPath) { const ok = window.BSPath.CLASSES.filter(c => window.BSPath.classAllowed(c.id, d.gear && d.gear.stash)); cls = ok[seed % ok.length].id; }
    if (cls) { out.classId = cls; out.lines.push('Class today: ' + (window.BSPath ? window.BSPath.CLASS_BY_ID[cls].name : cls) + (lc && lc.rotation === 'random' ? ' (random rotation)' : '')); if (f.classquiz) out.sources.push('Which Class'); }
    if (lc) { const b = lc.blocks; const busiest = Object.keys(b).sort((x, y) => b[y] - b[x])[0]; out.lines.push(`Busiest block: ${busiest} · surprise ${lc.surprise}/10 · punish ${['off', 'gentle', 'full'][lc.punish]}`); out.sources.push('Long campaign'); out.prefs = lc; }
    if (f.longBoard && d.longBoard) { out.board = d.longBoard.cfg; out.sources.push('Long board'); }
    if (out.control != null) out.lines.unshift(`Starting control feel: ${out.control}%` + (out.difficulty ? ` · difficulty ${out.difficulty}/5` : ''));
    return out;
  }

  // ---------- runner UI ----------
  function sheet(html) {
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap';
    w.innerHTML = `<div class="cal-sheet qp-sheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(w); return w;
  }
  function run(id, done) {
    const Q = QUIZZES[id]; if (!Q) return;
    const w = sheet('<div id="qpBody"></div>'), body = () => w.querySelector('#qpBody');
    const picks = []; let i = 0, node = Q.branch ? Q.branch.start : null, timer = null;
    const finish = () => {
      clearInterval(timer);
      const r = scoreAnswers(id, picks); setResult(id, r, picks);
      let extra = '';
      if (id === 'symptom') extra = r.unlocked.map(k => `<label class="qp-flag"><input type="checkbox" data-flag="${k}" ${load().flags[k] ? 'checked' : ''}> ${esc(SYMS[k])}</label>`).join('') + (r.unlocked.length ? '<div class="cal-legend">Tick to turn on. Switch off any time in 🎲 Path › ⚙.</div>' : '');
      if (id === 'classquiz' && r.gatedOut) extra = `<div class="cal-legend">Top raw match was ${esc(r.gatedOut)}, but your stash doesn't allow it yet.</div>`;
      body().innerHTML = `<h3>${esc(Q.title)} — result</h3><div class="calib-big" id="qpResult">${esc(r.summary)}</div><div class="cal-legend">Feeds: ${esc(r.feeds)}</div>${extra}<div class="quiz-nav"><button type="button" id="qpDone" style="background:#55efc4;color:#000;font-weight:bold;">✓ Done</button></div>`;
      body().querySelectorAll('[data-flag]').forEach(c => c.onchange = () => setFlag(c.dataset.flag, c.checked));
      body().querySelector('#qpDone').onclick = () => { w.remove(); if (done) done(r); };
    };
    const paint = () => {
      clearInterval(timer);
      if (Q.branch) {
        const n = Q.branch.nodes[node];
        body().innerHTML = `<h3>${esc(Q.title)}</h3><div class="cal-legend">${esc(Q.type)}</div><div class="quiz-q">${esc(n.t)}</div>
          <div class="quiz-opts">${n.opts.map((x, k) => `<button type="button" data-k="${k}">${esc(x.l)}</button>`).join('')}</div><div class="quiz-nav"><button type="button" id="qpX">✕ Close</button></div>`;
        body().querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const x = n.opts[+b.dataset.k]; picks.push(x.s); if (x.s.end || !x.s.next) finish(); else { node = x.s.next; paint(); } });
      } else {
        const q = Q.qs[i], N = Q.qs.length;
        let inner = '';
        if (q.kind === 'pair') inner = `<div class="quiz-q">This or that?</div><div class="qp-pair"><button type="button" data-p="a">${esc(q.a.l)}</button><span>or</span><button type="button" data-p="b">${esc(q.b.l)}</button></div>`;
        else if (q.kind === 'slider') inner = `<div class="quiz-q">${esc(q.q)}</div><div class="qp-slider"><span>${esc(q.lo)}</span><input type="range" min="0" max="10" value="5" id="qpRange"><span>${esc(q.hi)}</span></div><div class="cal-legend" id="qpRangeV">5 / 10</div>`;
        else inner = `<div class="quiz-q">${esc(q.q)}</div><div class="quiz-opts">${q.opts.map((x, k) => `<button type="button" data-k="${k}">${esc(x.l)}</button>`).join('')}</div>`;
        body().innerHTML = `<h3>${esc(Q.title)}</h3><div class="cal-legend">${i + 1} / ${N} · ${esc(Q.type)}</div>
          <div class="quiz-progress"><i style="width:${Math.round((i + 1) / N * 100)}%"></i></div>${Q.timed ? '<div class="qp-timer"><i id="qpT"></i></div>' : ''}${inner}
          <div class="quiz-nav"><button type="button" id="qpX">✕ Close</button><button type="button" id="qpSkip">Skip</button>${q.kind === 'slider' ? '<button type="button" id="qpNext" style="background:#55efc4;color:#000;">Next →</button>' : ''}</div>`;
        const adv = p => { if (p) picks.push(p); i++; if (i >= N) finish(); else paint(); };
        body().querySelectorAll('[data-k]').forEach(b => b.onclick = () => adv(q.opts[+b.dataset.k].s));
        body().querySelectorAll('[data-p]').forEach(b => b.onclick = () => adv(q[b.dataset.p].s));
        const r = body().querySelector('#qpRange'); if (r) r.oninput = () => { body().querySelector('#qpRangeV').textContent = r.value + ' / 10'; };
        const nx = body().querySelector('#qpNext'); if (nx) nx.onclick = () => adv({ slider: q.key, v: +r.value });
        body().querySelector('#qpSkip').onclick = () => adv(null);
        if (Q.timed) { const t0 = Date.now(); timer = setInterval(() => { const f = (Date.now() - t0) / (Q.timed * 1000); const bar = w.querySelector('#qpT'); if (bar) bar.style.width = Math.max(0, 100 - f * 100) + '%'; if (f >= 1) adv(null); }, 100); }
      }
      body().querySelector('#qpX').onclick = () => { clearInterval(timer); w.remove(); };
    };
    paint(); return w;
  }

  // ---------- Quiz hub injection ----------
  const GO = { scenario: '🎲 Path', thisorthat: '🎲 Path', sliders: '🎲 Path', classquiz: '🎲 Path', symptom: '🎲 Path', gear: '🎲 Path', dare: '🎲 Path', longBoard: '🎲 Path', longCamp: '🏅 Campaign' };
  function hubHtml() {
    const d = load().results;
    return `<div id="qpHub"><h3 style="margin:12px 0 6px;">✨ New quiz types (v16)</h3><div class="quiz-hub-list">${Object.keys(QUIZZES).map(id => { const Q = QUIZZES[id], r = d[id]; return `<div class="quiz-hub-card" data-qcard="${id}">
      <div class="qh-title">${esc(Q.title)} <span class="qp-type">${esc(Q.type)}</span></div><div class="cal-legend">${esc(Q.blurb)}</div>
      <div class="qh-last">${r ? '✓ ' + esc(r.summary) : '<span class="muted">Not taken</span>'}</div>
      <div class="qh-imp"><b>Impacts:</b> ${esc(scoreAnswers(id, []).feeds)}</div>
      <div class="quiz-nav"><button type="button" data-qp="${id}">${r ? '↺ Retake' : '▶ Take'}</button><button type="button" data-qpgo="${id}">Go to ${esc(GO[id])}</button></div></div>`; }).join('')}</div></div>`;
  }
  function injectHub() {
    const m = document.getElementById('myProfileMount'); if (!m || m.querySelector('#qpHub') || !m.querySelector('.quiz-hub-list')) return;
    const list = m.querySelector('.quiz-hub-list'); const div = document.createElement('div'); div.innerHTML = hubHtml(); list.after(div.firstChild);
    const W18 = () => { try { if (window.BSQuizHub) window.BSQuizHub.regroup(m); } catch (e) { console.warn(e); } };
    m.querySelectorAll('[data-qp]').forEach(b => b.onclick = () => run(b.dataset.qp, () => { const h = m.querySelector('#qpHub'); if (h) h.remove(); injectHub(); }));
    m.querySelectorAll('[data-qpgo]').forEach(b => b.onclick = () => { if (b.dataset.qpgo === 'longCamp') { const c = document.getElementById('campaignMount'); if (c) c.scrollIntoView({ block: 'start' }); } else if (typeof switchTab === 'function') switchTab('path'); });
    W18();
  }
  function feedsHtml(camp) {
    const f = feeds(camp), day = campaignDay(camp);
    return `<details id="cfFeeds" class="sess-more"><summary>🧩 Quiz feeds &amp; today's shape</summary>
      <div class="cal-legend">Pick which quiz results shape this campaign's days.</div>
      <div class="cf-grid">${FEEDS.map(([k, l]) => `<label class="qp-flag"><input type="checkbox" data-feed="${k}" ${f[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
      <div class="camp-goal" id="cfDay"><b>Today's shape</b> (${esc(day.sources.join(', ') || 'no quiz data yet')}):<br>${day.lines.map(esc).join('<br>') || 'Take a quiz to shape your days.'}</div></details>`;
  }
  function injectCampaign() {
    const m = document.getElementById('campaignMount'); if (!m || m.querySelector('#cfFeeds') || !window.BSCampaign) return;
    const camp = window.BSCampaign.load(); if (!camp) return;
    const div = document.createElement('div'); div.innerHTML = feedsHtml(camp); m.appendChild(div.firstChild);
    m.querySelectorAll('[data-feed]').forEach(c => c.onchange = () => { const s = window.BSCampaign.load(); s.feeds = Object.assign(feeds(s), { [c.dataset.feed]: c.checked }); window.BSCampaign.save(s); const el = m.querySelector('#cfFeeds'); el.remove(); injectCampaign(); m.querySelector('#cfFeeds').open = true; });
  }
  if (typeof document !== 'undefined' && window.MutationObserver) window.addEventListener('load', () => {
    const obs = new MutationObserver(() => { injectHub(); injectCampaign(); });
    ['myProfileMount', 'campaignMount'].forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el, { childList: true }); });
    injectHub(); injectCampaign();
  });
  window.BSQuizPlus = { KEY, QUIZZES, SYMS, FEEDS, CLASS_IDS, load, save, scoreAnswers, setResult, result, setFlag, flags, feeds, campaignDay, run, injectHub, injectCampaign };
})();
