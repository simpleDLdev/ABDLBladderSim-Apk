/* ===========================
   potty-path.js — v17 Potty Path: four-stage training board driven by "I need to go".
   Mechanics (adapted, original wording): 4 corner stages, each with a rules box and a 1–12 rule table.
   Press 🚽 I need to go → roll 2d6 → move half the roll (class may change this) → the landed square's
   number(s) pick the rule(s) from the current stage's table → follow it → ✅ stay · 💦 accident
   rolls you back · 2 accidents in a row = start of the previous stage. STOP squares halt you. Doubles
   draw from the stage's 2d6 event table. Three mastery tracks (Bed / Accident / #2) with finish rewards.
   8 classes with perks + drawbacks, stash-gated. Test Mode auto-plays every table.
   Storage: bs_path_v1 (board v2 shape; v1 boards are retired with a notice).
   Hard rules: , no sexual content, no real-body training. The real urge always wins
   (🚽 Real need = no penalty, no move). Urgency/saturation only entered by the user. Holds ≤ 20 min.
   No drink forcing. "Tummy trouble" is an flag only — never take anything real.
   =========================== */
(function () {
  const KEY = 'bs_path_v1', SQ = 15, N = 60, HOLD_MAX = 20;
  function softPlayOn() { try { return !!(window.BSHub && window.BSHub.softOn && window.BSHub.softOn()); } catch (e) { return false; } }
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a) { return function () { let t = (a += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const dn = (rng, n) => 1 + Math.floor(rng() * n);
  const dayKey = ts => { const d = new Date(ts || Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  // ---------- Stages: rules box + 1–12 rule table + 2d6 doubles event table ----------
  // rule kinds: gear (use protection as told) · potty · wait (game timer then potty/gear) · hold (timer, max 20) · mixed · free · flag · nochange · mayi · race · urge (wait for an urge level you enter)
  const R = (t, k, x) => Object.assign({ t, k }, x || {});
  const STAGES = [
    { id: 'obey', name: '🧷 Stage 1 · Diaper Days', short: 'Diaper Days', color: '#f8a5c2', gear: 'diaper (or your thickest gear)',
      box: ['Diapers day and night.', 'No potty trips in this stage — use your protection when you need to go.', 'Up to 3 changes a day. Skin comfort always beats this limit.'],
      stop: R('STOP: stay in your protection and go right where you are (no bathroom), then do a change check.', 'gear', { check: true }),
      table: [null,
        R('Stay in your protection (diaper / pull-up) and go now, any comfy position — not the bathroom.', 'gear'), R('Use your protection standing up.', 'gear'), R('Use your protection sitting on the floor.', 'gear'),
        R('Use your protection sitting on a chair or sofa.', 'gear'), R('Stay in your pull-ups (or diaper) and let go — keep doing what you\'re doing, no bathroom.', 'gear'), R('Use your protection lying down.', 'gear'),
        R('Wait 5 minutes, then use your protection.', 'wait', { min: 5, then: 'gear' }), R('Stay in your protection and let it happen on its own — no pushing, no bathroom.', 'gear'),
        R('Tummy trouble: your next #2 can\'t wait. Use your protection now.', 'flag', { flag: 'tummy', then: 'gear' }),
        R('Use your protection. No change until after your next go.', 'nochange'), R('Use your protection. No change until the roll after next.', 'nochange', { span: 2 }),
        R('Your choice of any rule 1–8.', 'free')],
      events: { 2: { t: 'Tummy trouble until your next go.', fx: { tummy: true } }, 4: { t: 'Surprise change check — enter saturation.', fx: { check: true } }, 6: { t: 'Mercy card: your next accident doesn\'t move you back.', fx: { mercy: true } },
        8: { t: 'Cosy rule: stay as you are until your next roll.', fx: { nochange: true } }, 10: { t: 'Honest check-in: +1 ⭐.', fx: { stars: 1 } }, 12: { t: 'Lucky! Move +3.', fx: { move: 3 } } } },
    { id: 'potty', name: '🚽 Stage 2 · Potty Practice', short: 'Potty Practice', color: '#f6e58d', gear: 'diaper or pull-up',
      box: ['Protection on all day; the potty is sometimes allowed.', 'Two changes a day (skin comfort first).', 'If a rule allows the potty, use it; otherwise your protection.', 'STOP squares: wait, then potty — or protection if it can\'t wait.'],
      stop: R('STOP: wait 10 minutes, then the potty. Can\'t wait? Use your protection.', 'wait', { min: 10, then: 'potty' }),
      table: [null,
        R('Stay in your protection (diaper / pull-up) and go in it — not the potty.', 'gear'), R('Use the potty.', 'potty'), R('Start in your protection, finish on the potty.', 'mixed'),
        R('Sit on the potty with your protection on and go there.', 'gear'), R('Use your protection, then sit on the potty for 1 minute.', 'gear'), R('Use the potty, then put on fresh protection.', 'potty'),
        R('Potty allowed — take your time.', 'potty'), R('Roll on the Stage 1 table instead.', 'roll', { stage: 0 }),
        R('Hold until you really need to, then the potty.', 'hold', { hold: [4, 12], then: 'potty' }), R('Wait 10 minutes, then the potty.', 'wait', { min: 10, then: 'potty' }),
        R('Potty only if you get there within a minute — otherwise protection.', 'race', { sec: 60 }), R('Your choice of any rule 1–11.', 'free')],
      events: { 2: { t: 'Potty busy: your next potty rule waits 5 minutes first.', fx: { busy: true } }, 4: { t: 'Gold star: +2 ⭐.', fx: { stars: 2 } }, 6: { t: 'Potty practice: sit on the potty for 1 minute now (no need to go).', fx: {} },
        8: { t: 'Change check — enter saturation.', fx: { check: true } }, 10: { t: 'Mercy card: next accident doesn\'t move you back.', fx: { mercy: true } }, 12: { t: 'Lucky! Move +3.', fx: { move: 3 } } } },
    { id: 'trainer', name: '🩲 Stage 3 · Trainer Pants', short: 'Trainer Pants', color: '#7ed6df', gear: 'pull-up or pad by day, diaper at night',
      box: ['Trainers (pull-up or pad) by day, diaper at night.', 'Potty is the default.', 'Two accidents in one day → thicker protection for the rest of the day.'],
      stop: R('STOP: use the potty, and keep trainers on for the rest of the day.', 'potty'),
      table: [null,
        R('Use the potty.', 'potty'), R('Stay in your trainers (pull-up / pad) and go in them — not the potty.', 'gear'), R('Use the potty, then do a gear check.', 'potty', { check: true }),
        R('Sit on the potty for at least 2 minutes.', 'potty'), R('Wait 5 minutes, then the potty.', 'wait', { min: 5, then: 'potty' }), R('Hold until you really need to, then the potty.', 'hold', { hold: [5, 15], then: 'potty' }),
        R('Don\'t go until your urge is at least 6/10 (you enter it), then the potty.', 'urge', { lvl: 6 }), R('A little in your trainers first, then finish on the potty.', 'mixed'),
        R('Wait 10 minutes, then the potty.', 'wait', { min: 10, then: 'potty' }), R('May I? Ask nicely: yes = potty, no = wait 5 then potty.', 'mayi'),
        R('Race: reach the potty within 2 minutes or use your trainers.', 'race', { sec: 120 }), R('Your choice of any rule 1–11.', 'free')],
      events: { 2: { t: 'Trainer check — enter saturation; 60%+ means change.', fx: { check: true } }, 4: { t: 'Race card: your next potty rule becomes a 2-minute race.', fx: { race: true } }, 6: { t: 'Mercy card.', fx: { mercy: true } },
        8: { t: 'May I? token: cancels your next "no".', fx: { mayiToken: true } }, 10: { t: '+2 ⭐.', fx: { stars: 2 } }, 12: { t: 'Lucky! Move +3.', fx: { move: 3 } } } },
    { id: 'undies', name: '⭐ Stage 4 · Big-Kid Undies', short: 'Big-Kid Undies', color: '#badc58', gear: 'undies (spare nearby)',
      box: ['Undies, potty every time.', 'Two accidents in one day → pull-up for the rest of the day.', 'Finish the board to keep your undies!'],
      stop: R('STOP: use the potty one more time before moving on.', 'potty'),
      table: [null,
        R('Potty — nothing special.', 'potty'), R('Hold until you really need to, then the potty.', 'hold', { hold: [6, 18], then: 'potty' }), R('Wait until your urge is 7/10 (you enter it).', 'urge', { lvl: 7 }),
        R('Potty right now — no waiting.', 'potty'), R('Wait 5 minutes.', 'wait', { min: 5, then: 'potty' }), R('Wait 10 minutes.', 'wait', { min: 10, then: 'potty' }),
        R('Finish what you\'re doing first (up to 5 minutes).', 'wait', { min: 5, then: 'potty' }), R('May I? Ask nicely.', 'mayi'), R('Potty, wash hands, and log it.', 'potty'),
        R('Wait 15 minutes.', 'wait', { min: 15, then: 'potty' }), R('One more small task first (up to 10 minutes).', 'wait', { min: 10, then: 'potty' }),
        R('Race: be on the potty within 1 minute.', 'race', { sec: 60 })],
      events: { 2: { t: 'Slip-up card: your next accident counts double.', fx: { doubleNext: true } }, 4: { t: 'Hall pass: skip the next wait rule.', fx: { pass: true } }, 6: { t: '+2 ⭐.', fx: { stars: 2 } },
        8: { t: 'Check-in — enter your urgency.', fx: { check: true } }, 10: { t: 'Mercy card.', fx: { mercy: true } }, 12: { t: 'Ladder! Move +4.', fx: { move: 4 } } } }
  ];

  // ---------- Classes: Leaky Girl is the ± template. Ids stay stable. Every class has a small #2 modifier (poo). ----------
  const CLASSES = [
    { id: 'bigkid', name: '🎓 Big Kid', from: 'Big Girl', band: 'Good', needs: [], back: 6, start: 3, move: 'full',
      plus: ['Move the full roll forward, not half.', 'You may follow the rule of the square just ahead or behind instead.'],
      minus: ['An accident in stage 3 or 4 sends you to the previous stage\'s STOP.', 'No Accident Mastery progress.'],
      poo: { potty: 1, note: '#2 in the potty is +2 on #2 Mastery.' } },
    { id: 'scout', name: '🧭 Scout', from: 'Scout (v16)', band: 'Good', needs: [], back: 6, start: 2, move: 'half',
      plus: ['Spare kit: once per stage, an accident doesn\'t move you back.', 'Round up on rolls that reach a STOP.'],
      minus: ['Check in (enter your urgency) on every go.', 'Two accidents in a row also loses your spare kit for the stage.'],
      poo: { back: -1, note: '#2 accidents move back 1 less (at least 1).' } },
    { id: 'padgirl', name: '🎀 Pad Girl', from: 'Lazy Gal', band: 'Okay', needs: ['pads'], back: 6, start: 2, move: 'half',
      plus: ['Pads are the protection: bed and #2 progress can go to Accident Mastery until that track is done.', 'Once a day, a go in your pad is free if you choose it before trying the potty.'],
      minus: ['One change a day until Accident Mastery — skin comfort always overrides.', 'Fail a STOP → back to square 2 of the stage.'],
      poo: { penalty: 1, note: '#2 accident is −1 on #2 Mastery (pads), not −2.' } },
    { id: 'pullup', name: '💧 Pull-up Soft', from: 'Desperate Goer', band: 'Shaky', needs: ['pullups'], back: 6, start: 1, move: 'up',
      plus: ['Round half-rolls up.', 'Holds stay full length — this is not Leaky Girl.'],
      minus: ['Not making a "hold" rule counts as an accident.', 'Potty busy 1 in 6: wait 5 minutes (not an accident).'],
      poo: { back: -1, note: '#2 accidents move back 1 less. Holds are not shortened.' } },
    { id: 'leaky', name: '💧 Leaky Girl', from: 'Dribbler', band: 'Shaky', needs: ['pads|pullups'], back: 6, start: 1, move: 'up',
      plus: ['Pads allowed with underwear.', 'Clear drip→potty chain once a dribble is logged.'],
      minus: ['Need-to-go unlocks only after a logged dribble.', 'Much shorter holds (higher change sat gate).'],
      flags: { needDribbleFirst: true, holdScale: 0.65, changeSatBump: 25, padsWithUndies: true },
      poo: { penalty: -1, note: '#2 accident is −3 on #2 Mastery (small extra).' } },
    { id: 'little', name: '🌙 Night Little', from: 'Bedwetter', band: 'Little', needs: ['pullups|diapers'], back: 4, start: 1, move: 'half',
      plus: ['Night focus: dry nights count double on Bed Mastery.', 'Potty after bedtime is allowed in stages 2–3.'],
      minus: ['A wet night is −6 on Bed Mastery (not −3).', 'After Bed Mastery, accidents always move you back 3 (no roll).'],
      poo: { bed: 1, note: 'A #2 accident also −1 Bed Mastery (night focus).' } },
    { id: 'baby', name: '🍼 Baby', from: 'Forced Into Diapers', band: 'None', needs: ['diapers'], back: 0, start: 0, move: 'half',
      plus: ['Unlimited changes.', 'Never moved back for accidents in your diaper.'],
      minus: ['Diapers in every stage: potty rules become "use your diaper on or by the potty".', 'No #2 Mastery progress.'],
      poo: { note: '#2 in the diaper never moves you back and never touches #2 Mastery.' } },
    { id: 'cascade', name: '🌊 Cascade Prone', from: 'Panty Pooper', band: 'Shaky–Little', needs: ['pullups|diapers'], back: 6, start: 1, move: 'half',
      plus: ['When a rule allows the potty, #2 may always use it.', '#2 in the potty is +3 on #2 Mastery.'],
      minus: ['Tummy trouble every day — never take anything real.', '#2 accidents move back double.'],
      poo: { potty: 2, backMul: 2, note: '#2 in the potty is +3; #2 accidents move back double.' } },
    { id: 'shy', name: '🙈 Shy Goer', from: 'Ashamed Pooper', band: 'Okay', needs: [], back: 6, start: 2, move: 'half',
      plus: ['After a roll you may move just 1 and use plain rule 1 instead.', 'Privacy always (no "someone watching" cards).'],
      minus: ['Landing on a "1" square moves you back 1 (still follow rule 1).', '#2 waits 5 minutes before any rule.'],
      poo: { wait: 5, note: '#2 waits 5 minutes before any rule.' } }
  ];
  const CLASS_BY_ID = CLASSES.reduce((a, c) => (a[c.id] = c, a), {});
  function stashNow() { try { const r = window.BSQuizPlus && window.BSQuizPlus.result('gear'); if (r && r.stash) return r.stash; } catch (e) {} return null; }
  function classAllowed(id, stash) { const c = CLASS_BY_ID[id]; if (!c) return false; if (stash === undefined) stash = stashNow(); if (!stash || stash.unlimited) return true; return c.needs.every(n => n.split('|').some(k => stash[k])); }
  function suggestClass(est, stash) {
    // v19: prefer the one ladder's class list for this estimate
    try { if (window.BSRanks) { const order = window.BSRanks.rankOfEst(est).classes.concat(['bigkid']); const hit = order.find(id => classAllowed(id, stash)); if (hit) return hit; } } catch (e) {}
    const order = est >= 75 ? ['bigkid', 'scout'] : est >= 60 ? ['scout', 'shy'] : est >= 48 ? ['padgirl', 'shy'] : est >= 36 ? ['pullup', 'leaky', 'padgirl'] : est >= 24 ? ['leaky', 'little', 'cascade'] : est >= 14 ? ['cascade', 'little', 'baby'] : ['baby', 'little'];
    return order.concat(CLASSES.map(c => c.id)).find(id => classAllowed(id, stash)) || 'bigkid';
  }
  const stageForEst = est => { try { if (window.BSRanks) return window.BSRanks.rankOfEst(est).stage; } catch (e) {} return est >= 75 ? 3 : est >= 50 ? 2 : est >= 25 ? 1 : 0; };

  // ---------- Mastery tracks ----------
  const MASTERY = {
    bed: { name: '🛏 Bed Mastery', len: 12, how: 'Dry night +1 (+1 more for each night in a row, max +3). Wet night −3.', reward: 'Night gear may go one step lighter, and the potty after bedtime is allowed in stages 2–3.' },
    acc: { name: '💧 Accident Mastery', len: 12, how: 'Each accident +1 (you learn from it). Accident-free day +2.', reward: 'Change right away after any accident — no change limits.' },
    poo: { name: '💩 #2 Mastery', len: 12, how: '#2 in the potty +1. A day without a #2 accident +1 (+1 more per day in a row). #2 accident −2.', reward: 'Once per stage, ignore a move backwards; tummy trouble turns off.' }
  };

  // ---------- Board ----------
  /** Pure: 60 squares, 15 per stage. Square = { rules:[n..] | 'rand', tag }. Square 1 of each stage = stage rules, 15 = STOP. */
  function genSquares(seed) {
    const rng = mulberry32(seed >>> 0), sq = [null];
    for (let s = 0; s < 4; s++) {
      const tags = ['checkin', 'hold', 'prot', 'again', 'rand', s === 0 ? 'prot' : 'mayi', 'stop', 'feat', 'feat', 'feat'];
      const slots = {}; const free = [3, 4, 5, 6, 7, 9, 10, 11, 12, 13]; for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
      tags.forEach((t, i) => { slots[t === 'stop' ? 8 : free[i]] = t; }); slots[8] = 'stop';
      for (let i = 1; i <= SQ; i++) {
        let rules = [dn(rng, 12)]; if (rng() < 0.25) { let b = dn(rng, 12); if (b === rules[0]) b = (b % 12) + 1; rules.push(b); rules.sort((x, y) => x - y); }
        let tag = slots[i] || null;
        if (i === 1) { tag = 'stage'; rules = [1]; } if (i === SQ) tag = 'stop';
        if (tag === 'rand') rules = 'rand'; if (tag === 'stop') rules = 'stop'; if (tag === 'again') rules = [rules[0]];
        if (tag === 'hold') { const h = STAGES[s].table.findIndex(r => r && r.k === 'hold'); rules = [h > 0 ? h : 7]; }
        if (tag === 'mayi') { const h = STAGES[s].table.findIndex(r => r && r.k === 'mayi'); if (h > 0) rules = [h]; }
        sq.push({ rules, tag });
      }
    }
    return sq;
  }
  const stageOf = pos => clamp(Math.floor((pos - 1) / SQ), 0, 3);
  const stageStart = s => s * SQ + 1, stageEnd = s => (s + 1) * SQ;
  function blankMastery() { return { bed: 0, acc: 0, poo: 0, bedRun: 0, pooRun: 0, done: {}, logged: {} }; }
  function newBoard(o) {
    o = o || {};
    const seed = o.seed != null ? +o.seed >>> 0 : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const sliders = window.BSQuizPlus && window.BSQuizPlus.result && window.BSQuizPlus.result('sliders');
    const cp = window.BSCalibPlus && window.BSCalibPlus.prior ? window.BSCalibPlus.prior() : null; // v18: blended calibration (confidence ≥ 30)
    const est = o.control != null ? o.control : cp != null ? cp : sliders ? sliders.control : 50;
    const classId = o.classId && classAllowed(o.classId) ? o.classId : suggestClass(est);
    let stage = o.startStage != null && o.startStage !== '' ? clamp(+o.startStage, 0, 3) : o.mode === 'free' ? stageForEst(est) : CLASS_BY_ID[classId].start;
    if (softPlayOn() && o.startStage == null) stage = Math.min(stage, 1); // soft: prefer early stages
    const b = { v: 2, mode: o.mode || 'free', length: N, seed, squares: genSquares(seed), pos: stageStart(stage), startStage: stage, classId, est,
      calib: { need: o.mode === 'free' && o.calib !== false ? 3 : 0, done: 0, log: [] }, recal: o.mode === 'free' && o.recal !== false,
      holdScale: o.holdScale || (sliders ? sliders.holdScale : 1), hidden: !!o.hidden || !!(sliders && sliders.hidden),
      stars: 0, accStreak: 0, accDay: { day: dayKey(), n: 0 }, flags: {}, spareUsed: {}, freeGearDay: null, mastery: blankMastery(),
      goes: 0, pending: null, history: [], finished: false, shake: o.shake !== false, anim: o.anim !== false, createdAt: Date.now() };
    if (classId === 'cascade') b.flags.tummy = true;
    b.tasks = []; b.doneTasks = []; if (o.dares !== false && !softPlayOn() && window.BSQuizPlus && window.BSQuizPlus.result) { const dr = window.BSQuizPlus.result('dare'); if (dr) b.tasks = dr.dares.slice(0, o.dareMax || 3); }
    // v32 play start prefs
    try {
      const st = window.BSPathPlay && window.BSPathPlay.loadStart && window.BSPathPlay.loadStart();
      if (st) {
        if (!o.playMode) b.playMode = st.mode || 'solo';
        if (!o.playStats) b.playStats = Object.assign({ constitution: 1, perception: 1, composure: 1 }, st.stats || {});
        if (classId === 'leaky' || (st.classId === 'leaky' && classId === st.classId)) { b.dribbleGate = true; b.dribbleLogged = false; b.changeSatBump = 25; b.padsWithUndies = true; }
        const meta = window.BSPathPlay.CLASS_META && window.BSPathPlay.CLASS_META[classId];
        if (meta && meta.flags) {
          if (meta.flags.needDribbleFirst) { b.dribbleGate = true; b.dribbleLogged = !!b.dribbleLogged; }
          if (meta.flags.changeSatBump) b.changeSatBump = meta.flags.changeSatBump;
          if (meta.flags.padsWithUndies) b.padsWithUndies = true;
        }
      }
    } catch (e) {}
    if (o.playMode) b.playMode = o.playMode;
    if (o.playStats) b.playStats = o.playStats;
    return b;
  }
  function load() { const b = J(KEY, null); return b && b.v === 2 ? b : null; }
  function legacy() { const b = J(KEY, null); return !!(b && b.v !== 2); }
  function save(b) { if (!b) { localStorage.removeItem(KEY); return; } b.updatedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(b)); }

  /** Rule lookup with class transforms. */
  function rule(stage, n, classId) {
    const r = Object.assign({ n, stage }, STAGES[stage].table[n]);
    if (classId === 'baby' && stage > 0 && ['potty', 'mixed', 'race', 'mayi', 'urge'].includes(r.k)) { r.t = r.t.replace(/the potty|potty/gi, 'your diaper by the potty') + ' (Baby: diapers in every stage)'; r.k = 'gear'; }
    if (classId === 'baby' && r.then === 'potty') r.then = 'gear';
    try {
      if (window.BSHub && window.BSHub.naturalPlayOn && window.BSHub.naturalPlayOn()) {
        const gearish = r.k === 'gear' || r.then === 'gear' || /use your protection|stay in your protection/i.test(String(r.t || ''));
        if (gearish) {
          const hold = Math.max(1, Math.min(HOLD_MAX, r.min || (((stage + 1) * 3 + ((+n) || 1)) % 16) + 4));
          if (r.k === 'gear') r.k = 'potty';
          if (r.then === 'gear') r.then = 'potty';
          r.natural = true;
          r.holdChoice = hold;
          r.t = window.BSHub.naturalGearText(hold);
        }
      }
    } catch (e) {}
    return r;
  }
  function classHoldScale(b) {
    let x = 1;
    // Pull-up Soft keeps full-length holds. Leaky Girl is the short-hold class.
    if (b.classId === 'leaky') x *= 0.65;
    if (b.classId === 'baby') x *= 0.75;
    if (b.classId === 'little') x *= 0.9;
    if (b.classId === 'bigkid') x *= 1.05;
    try {
      const meta = window.BSPathPlay && window.BSPathPlay.CLASS_META && window.BSPathPlay.CLASS_META[b.classId];
      if (meta && meta.flags && meta.flags.holdScale && b.classId !== 'pullup' && b.classId !== 'leaky') x *= meta.flags.holdScale;
    } catch (e) {}
    return x;
  }
  function holdMinutes(b, r, rng) {
    if (r.min) {
      let m = r.min;
      if (softPlayOn()) m = Math.max(1, Math.round(m * 0.65));
      try { if (window.BSPathPlay) m = Math.max(1, Math.round(m * window.BSPathPlay.holdScaleFromStats(b.playStats))); } catch (e) {}
      m = Math.round(m * classHoldScale(b));
      return Math.min(HOLD_MAX, Math.max(1, m));
    }
    const [lo, hi] = r.hold || [3, 8]; let x = classHoldScale(b) * (b.holdScale || 1) * (0.6 + (b.est || 50) / 125);
    try { if (window.BSPathPlay) x *= window.BSPathPlay.holdScaleFromStats(b.playStats); } catch (e) {}
    if (softPlayOn()) x *= 0.65; // soft: shorter holds, still capped at HOLD_MAX
    return clamp(Math.round((lo + (rng || Math.random)() * (hi - lo)) * x) || 1, 1, HOLD_MAX);
  }
  /** Pure: 2d6 */
  function rollDice(rng) { rng = rng || Math.random; const a = dn(rng, 6), c = dn(rng, 6); return { faces: [a, c], total: a + c, doubles: a === c }; }
  function moveFor(b, roll) { const c = CLASS_BY_ID[b.classId]; if (c.move === 'full') return roll.total; if (c.move === 'up') return Math.ceil(roll.total / 2); return Math.floor(roll.total / 2); }

  /** Core: the user pressed "I need to go". kind 'pee'|'poo'. opts.shyOne = Shy Goer "move 1, rule 1". */
  const GW = typeof window !== 'undefined' ? window : globalThis;
  // ---------- v18 low control ----------
  const LOW_RULES = [
    { t: 'Guidance: stay in your current protection (pull-up / trainers / diaper) and follow one event guide — not the bathroom (▶ Event guide).', k: 'free', guide: true },
    { t: 'Natural accident: no potty this time — stay in your current protection (pull-up / trainers / diaper), let it happen naturally, then log it.', k: 'free', natural: true },
    { t: 'Protection rule: stay in your current protection (pull-up / trainers / diaper) and go in it — not the bathroom — then check it (change only if the May I change? rules say so).', k: 'free', prot: true }
  ];
  const CLASS_ACCESS = { bigkid: 0.15, scout: 0.1, padgirl: 0, pullup: 0, leaky: -0.05, shy: 0, little: -0.1, cascade: -0.05, baby: -1 };
  const STAGE_CAP = [0, 0.6, 0.85, 1];
  /** 0..1: how much potty choice an urge offers. 0 at very low / no control; phases in with control, class, stage. */
  function pottyAccess(b, st) {
    if (b.classId === 'baby') return 0;
    const est = b.est == null ? 50 : b.est; let a = Math.max(0, Math.min(1, (est - 20) / 55)) + (CLASS_ACCESS[b.classId] || 0);
    if (est < 15) a = 0;
    return Math.round(Math.max(0, Math.min(STAGE_CAP[st == null ? stageOf(b.pos) : st], a)) * 100) / 100;
  }
  const isPottyRule = r => ['potty', 'race', 'mayi', 'hold', 'mixed'].includes(r.k) || (r.k === 'wait' && r.then === 'potty');
  function needToGo(b, kind, rng, opts) {
    rng = rng || Math.random; opts = opts || {}; kind = kind === 'poo' ? 'poo' : 'pee';
    const c = CLASS_BY_ID[b.classId], notes = [];
    // v37 Leaky Girl: lock urgency ("I have to go") before roll results; "I already leaked" is step 2 for timing data.
    // Poo / testMode / bypass skip. Recent dribble still counts as step 2 done.
    if (kind === 'pee' && !opts.bypassDribbleGate && !opts.bypassUrgeLock && !b.testMode && (b.dribbleGate || c.id === 'leaky')) {
      if (!b.urgeLock) {
        return { board: b, roll: { faces: [0, 0], total: 0, doubles: false }, path: [], from: b.pos, move: 0, blocked: 'urge',
          notes: ['💦 Log your urge first (locks urgency), then the roll.', ...(function(){ try { return window.BSPathPlay && window.BSPathPlay.caregiverOn() ? [window.BSPathPlay.line('checkin')] : []; } catch(e){ return []; } })()] };
      }
      let recent = !!b.dribbleLogged;
      try { if (!recent) recent = !!(window.BSClasses && window.BSClasses.hasRecentDribble()); } catch (e) {}
      if (recent) b.dribbleLogged = true;
      // Step 2 (leak) is encouraged for data but does not hard-block the roll once urge is locked.
    }
    const roll = rollDice(rng); let mv = opts.shyOne && c.id === 'shy' ? 1 : moveFor(b, roll);
    const from = b.pos, s0 = stageOf(from), end = stageEnd(s0);
    if (c.id === 'scout' && from < end && from + Math.ceil(roll.total / 2) >= end) mv = Math.max(mv, end - from);
    let to = Math.min(N, from + mv);
    if (from < end && to > end) { to = end; notes.push('🛑 STOP square — you stop here.'); }
    const path = []; for (let p = from + 1; p <= to; p++) path.push(p);
    b.pos = to; b.goes++;
    let sq = b.squares[to], st = stageOf(to);
    if (c.id === 'shy' && !opts.shyOne && Array.isArray(sq.rules) && sq.rules.length === 1 && sq.rules[0] === 1 && to > 1) { b.pos = to - 1; notes.push('🙈 Shy Goer: a "1" square — back 1, still follow rule 1.'); }
    let nums = sq.rules === 'stop' ? 'stop' : sq.rules === 'rand' ? [dn(rng, 12)] : sq.rules.slice();
    if (sq.rules === 'rand') notes.push(`❓ Mystery square: rolled rule ${nums[0]}.`);
    if (opts.shyOne && c.id === 'shy') { nums = [1]; notes.push('🙈 Moved 1 and used plain rule 1.'); }
    let rules = nums === 'stop' ? [Object.assign({ n: 'STOP', stage: st }, STAGES[st].stop)] : [];
    if (nums !== 'stop') nums.forEach(n => { let r = rule(st, n, b.classId); if (r.k === 'roll') { const n2 = dn(rng, 12); notes.push(`🎲 Rule ${n} → Stage ${r.stage + 1} table, rolled ${n2}.`); r = Object.assign(rule(r.stage, n2, b.classId), { n: n + '→' + n2 }); } if (r.k === 'free') r.free = true; rules.push(r); });
    // modifiers from flags
    if (b.flags.busy && rules.some(r => r.k === 'potty')) { rules.unshift({ n: '⏳', t: 'Potty busy: wait 5 minutes first.', k: 'wait', min: 5, then: 'potty' }); b.flags.busy = false; }
    if (b.flags.race && rules.some(r => r.k === 'potty')) { rules = rules.map(r => r.k === 'potty' ? Object.assign({}, r, { k: 'race', sec: 120, t: r.t + ' (Race card: within 2 minutes.)' }) : r); b.flags.race = false; }
    if (b.flags.pass && rules.some(r => r.k === 'wait')) { rules = rules.filter(r => r.k !== 'wait'); if (!rules.length) rules.push(rule(st, 1, b.classId)); notes.push('🎟 Hall pass used: wait rule skipped.'); b.flags.pass = false; }
    if (c.id === 'pullup' && rules.some(r => r.k === 'potty' || r.then === 'potty') && rng() < 1 / 6) { rules.unshift({ n: '🚪', t: 'Potty busy: wait 5 minutes (not an accident).', k: 'wait', min: 5, then: 'potty' }); }
    if (kind === 'poo' && b.flags.tummy) notes.push('🌀 Tummy trouble: this #2 can\'t wait — skip any waits.');
    if (kind === 'poo' && c.id === 'cascade' && STAGES[st].table.some(r => r && r.k === 'potty') && !rules.some(r => r.k === 'potty')) notes.push('🌊 Cascade perk: #2 may use the potty anyway.');
    let mayi = null; if (rules.some(r => r.k === 'mayi') || sq.tag === 'mayi' || (b.playMode === 'caregiver' && rng() < 0.2)) {
      mayi = rng() < 0.35 + (b.est / 100) * 0.5 || !!b.flags.mayiToken; if (!mayi && b.flags.mayiToken) mayi = true; b.flags.mayiToken = false;
      // Caregiver: slightly stricter yes rate (less autonomy)
      if (b.playMode === 'caregiver' && mayi && rng() < 0.25) mayi = false;
    }
    const holds = rules.filter(r => r.k === 'hold' || r.k === 'wait').map(r => (kind === 'poo' && b.flags.tummy) ? 0 : holdMinutes(b, r, rng));
    let ev = null; if (roll.doubles) { ev = Object.assign({ sum: roll.total }, STAGES[st].events[roll.total]); notes.push(`🎲 Doubles! Stage event (${roll.total}): ${ev.t}`); applyFx(b, ev.fx, notes); }
    // v18 low-control balance: potty-type rules phase in with control/class/stage.
    const acc = pottyAccess(b, st);
    if (acc < 1 && nums !== 'stop') {
      let swapped = 0; rules = rules.map((r, i) => { if (!isPottyRule(r)) return r; if (acc >= 0.15 && rng() < acc) return r; swapped++; return Object.assign({ n: r.n, low: true }, LOW_RULES[(st + i + (b.goes % 3)) % LOW_RULES.length]); });
      if (swapped) notes.push(`🧷 Low control (potty access ${Math.round(acc * 100)}%): potty options swapped for guidance / protection rules.`);
    }
    const poo = c.poo || {};
    if (kind === 'poo' && poo.wait) {
      const nxt = rules[0] || {};
      rules.unshift({ n: '💩', t: '#2: wait ' + poo.wait + ' minutes first.', k: 'wait', min: poo.wait, then: nxt.then || nxt.k || 'potty' });
      holds.unshift(b.flags.tummy ? 0 : Math.min(HOLD_MAX, poo.wait));
    }
    let feature = null;
    if (['feat', 'checkin', 'prot', 'hold'].includes(sq.tag) && GW.BSPathFeatures && nums !== 'stop') { feature = GW.BSPathFeatures.pick(b, st, sq.tag, rng, acc, opts.now); notes.push(`✨ Feature square: ${GW.BSPathFeatures.BY[feature].name}.`); }
    const needCheck = sq.tag === 'checkin' || (b.calib.need && b.calib.done < b.calib.need) || (b.recal && to % 10 === 0) || c.id === 'scout' || rules.some(r => r.check) || (ev && ev.fx.check);
    b.pending = { pos: b.pos, stage: st, kind, tag: sq.tag, feature, access: acc, rules, mayi, holds, check: !!needCheck, again: sq.tag === 'again', dare: ['again', 'checkin', 'prot'].includes(sq.tag) ? ((b.tasks || []).find(t => !(b.doneTasks || []).includes(t.id)) || null) : null, ev: ev ? ev.sum : null, roll };
    syncClipHold(b);
    return { board: b, roll, path, from, notes, move: mv };
  }
  function applyFx(b, fx, notes) {
    if (!fx) return; if (fx.tummy) b.flags.tummy = true; if (fx.mercy) b.flags.mercy = true; if (fx.busy) b.flags.busy = true; if (fx.race) b.flags.race = true; if (fx.mayiToken) b.flags.mayiToken = true;
    if (fx.doubleNext) b.flags.doubleNext = true; if (fx.pass) b.flags.pass = true; if (fx.nochange) b.flags.nochange = 1; if (fx.stars) b.stars += fx.stars;
    if (fx.move) { const s = stageOf(b.pos); b.pos = Math.min(b.pos + fx.move, b.pos < stageEnd(s) ? stageEnd(s) : N); }
  }
  function bump(b, track, n, notes) {
    const c = CLASS_BY_ID[b.classId], M = b.mastery;
    if (c.id === 'padgirl' && track !== 'acc' && n > 0 && !M.done.acc && b.lazyRedirect !== false) track = 'acc';
    if (track === 'acc' && c.id === 'bigkid') return; if (track === 'poo' && c.id === 'baby') return;
    if (M.done[track]) return;
    M[track] = clamp(M[track] + n, 0, MASTERY[track].len);
    if (M[track] >= MASTERY[track].len) { M.done[track] = true; notes.push(`🏆 ${MASTERY[track].name} complete! Reward: ${MASTERY[track].reward}`); if (track === 'poo' && c.id !== 'cascade') b.flags.tummy = false; }
  }
  /** Resolve the pending go. outcome: 'ok' (followed the rule) · 'acc' (in-game accident) · 'real' (real need — no penalty). m: { urgency, sat } user-entered. */
  function resolve(b, outcome, m, rng) {
    rng = rng || Math.random; m = m || {}; const p = b.pending; if (!p) return { board: b, notes: [], move: 0 };
    const c = CLASS_BY_ID[b.classId], notes = [], st = p.stage; let move = 0;
    if (p.check && m.urgency != null) recalibrate(b, { urgency: m.urgency, sat: m.sat }, notes);
    if (outcome === 'real') notes.push('⏸ Paused — off you go. Your token stays put.');
    else if (outcome === 'ok') {
      b.accStreak = 0; b.stars += 1; notes.push('✅ Followed the rule: +1 ⭐, you stay here.');
      try { if (window.BSPathPlay && window.BSPathPlay.caregiverOn()) notes.push(window.BSPathPlay.line('resolve_ok')); } catch (e) {}
      if (p.kind === 'poo' && p.rules.some(r => r.k === 'potty' || r.then === 'potty' || r.k === 'race' || r.k === 'mixed')) bump(b, 'poo', 1 + ((c.poo && c.poo.potty) || 0), notes);
      if (p.tag === 'stop') notes.push('🛑 STOP cleared.');
    } else if (outcome === 'refuse') {
      // Feature refuse: forced dice rollback. Does not count as an accident streak (different flavour).
      const die = m.refuseDie != null ? +m.refuseDie : dn(rng, 6);
      move = -die;
      notes.push(`🙅 Refused the feature: rolled ${die} — move back ${die}.`);
      if (b.stars > 0) { b.stars = Math.max(0, b.stars - 1); notes.push('↩ Refuse slip: −1 ⭐.'); }
    } else {
      b.accStreak++; if (b.accDay.day !== dayKey()) b.accDay = { day: dayKey(), n: 0 }; b.accDay.n++;
      bump(b, 'acc', 1, notes);
      if (p.kind === 'poo') {
        bump(b, 'poo', -2 + ((c.poo && c.poo.penalty) || 0), notes);
        b.mastery.pooRun = 0;
        if (c.poo && c.poo.bed && !b.mastery.done.bed) {
          b.mastery.bed = Math.max(0, b.mastery.bed - c.poo.bed);
          notes.push('🌙 #2 also −' + c.poo.bed + ' on Bed Mastery.');
        }
      }
      try { if (window.BSPathPlay && window.BSPathPlay.caregiverOn()) notes.push(window.BSPathPlay.line('resolve_acc')); } catch (e) {}
      // v32 light reactive pressure: failed hold / accident can slip a star even on progress campaigns
      if (b.stars > 0 && (p.holds || []).some(h => h > 0)) { b.stars = Math.max(0, b.stars - 1); notes.push('↩ Hold slip: −1 ⭐.'); }
      try {
        const camp = window.BSCampaign && window.BSCampaign.load();
        if (camp && camp.active && !camp.paused && window.BSCampaign.direction(camp) === 'up') {
          camp.streakPass = Math.max(0, (camp.streakPass || 0) - 0); // keep streak; soft flag only
          camp._pathSlip = (camp._pathSlip || 0) + 1;
          if (camp._pathSlip >= 2) { camp.streakFail = (camp.streakFail || 0) + 1; camp._pathSlip = 0; notes.push('🏅 Campaign feels the slip (failed holds).'); }
          window.BSCampaign.save(camp);
        }
      } catch (e) {}
      const inDiaper = st === 0 || c.id === 'baby';
      if (b.flags.mercy) { b.flags.mercy = false; notes.push('🃏 Mercy card used — no move back.'); }
      else if (c.id === 'baby' && inDiaper) notes.push('🍼 Baby: never moved back for a diaper accident. Change check if you like.');
      else if (c.id === 'scout' && !b.spareUsed[st]) { b.spareUsed[st] = true; notes.push('🎒 Spare kit used: no move back this stage.'); }
      else if (b.mastery.done.poo && !b.immuneUsed?.[st]) { b.immuneUsed = Object.assign({}, b.immuneUsed, { [st]: true }); notes.push('💩 #2 Mastery reward: this move back is ignored.'); }
      else if (c.id === 'padgirl' && p.tag === 'stop') { move = stageStart(st) + 1 - b.pos; notes.push('🎀 Failed STOP: back to square 2 of this stage.'); }
      else {
        let k = c.id === 'little' && b.mastery.done.bed ? 3 : dn(rng, c.back || 6);
        if (p.kind === 'poo' && c.poo && c.poo.backMul) k *= c.poo.backMul;
        if (p.kind === 'poo' && c.poo && c.poo.back) k = Math.max(1, k + c.poo.back);
        if (b.flags.doubleNext) { k *= 2; b.flags.doubleNext = false; }
        move = -k; notes.push(`💦 Accident: move back ${k}.`);
      }
      if (b.accStreak >= 2) { const t = stageStart(Math.max(0, st - 1)); move = t - b.pos; b.accStreak = 0; notes.push(`↩ Two accidents in a row: back to the start of ${STAGES[Math.max(0, st - 1)].short}.`); if (c.id === 'scout') b.spareUsed[st] = true; }
      else if (c.id === 'bigkid' && st >= 2) { move = stageEnd(st - 1) - b.pos; notes.push('🎓 Big Kid drawback: back to the previous stage\'s STOP.'); }
      if (st >= 2 && b.accDay.n === 2) notes.push(st === 3 ? '🩲 Two accidents today: pull-up for the rest of the day.' : '🧷 Two accidents today: thicker protection for the rest of the day.');
    }
    if (p.dare && m.dareDone) { b.doneTasks = (b.doneTasks || []).concat(p.dare.id); b.stars += p.dare.stars; notes.push(`🎯 Dare done: +${p.dare.stars} ⭐.`); }
    if (m.sat != null && m.sat >= 60) notes.push('🧷 Saturation 60%+ — change now (skin comfort first).');
    if (b.flags.nochange) { notes.push('⏳ Cosy rule: no change until your next roll (skin comfort still wins).'); b.flags.nochange = 0; }
    if (p.kind === 'poo' && outcome !== 'real' && b.flags.tummy && c.id !== 'cascade') b.flags.tummy = false;
    b.pos = clamp(b.pos + move, 1, N);
    if (p.check && b.calib.need && b.calib.done < b.calib.need) b.calib.done++;
    b.history.push({ ts: Date.now(), pos: b.pos, stage: st, rules: p.rules.map(r => r.n), kind: p.kind, outcome, m });
    const again = p.again && outcome === 'ok'; b.pending = null; clearUrgeLock(b); b.rollAgain = again; if (again) notes.push('↻ Roll-again square: go again on your next need, with a +2 head start.'), b.pos = Math.min(stageEnd(stageOf(b.pos)), b.pos + 2);
    syncClipHold(b);
    if (b.pos >= N && outcome === 'ok') { b.finished = true; notes.push('🏆 Board finished — you kept your Big-Kid Undies!'); }
    return { board: b, notes, move };
  }
  /** v18: a feature-square flow finished (auto-detected or manual). r = { outcome:'ok'|'acc'|'real', info, wet? } */
  function finishQuest(r, rng) {
    const b = load(); if (!b || !b.quest) return null; const q = b.quest, F = GW.BSPathFeatures && GW.BSPathFeatures.BY[q.id];
    if (!b.pending) { b.quest = null; save(b); return null; }
    const out = resolve(b, r.outcome, { feature: q.id, info: r.info }, rng);
    if (r.outcome === 'ok' && F) {
      const fx = F.fx || {}; if (fx.stars) { b.stars += fx.stars; out.notes.push(`✨ ${F.name} done: +${fx.stars} ⭐.`); }
      if (fx.move) { const s0 = stageOf(b.pos); b.pos = Math.min(b.pos + fx.move, b.pos < stageEnd(s0) ? stageEnd(s0) : N); out.notes.push(`➡ Feature bonus: move ${fx.move}.`); }
      if (F.mastery === 'bed') out.notes.push(...logMastery(b, r.wet ? 'wet' : 'dry', Date.now()).notes);
      if (F.mastery === 'acc') bump(b, 'acc', 1, out.notes);
    }
    b.history[b.history.length - 1].feature = q.id; b.quest = null; save(b); lastNotes = [`✨ ${F ? F.name : q.id}: ${r.info || r.outcome}`].concat(out.notes); return out;
  }
  /** Refuse a feature square: confirm → roll 1d6 → move back that many (stage/square regression). ⏸ real urge stays no-penalty via outcome 'real'. */
  function refuseQuest(rng) {
    rng = rng || Math.random;
    const b = load(); if (!b || !b.pending) return null;
    const q = b.quest, F = GW.BSPathFeatures && GW.BSPathFeatures.BY[q && q.id];
    const die = dn(rng, 6);
    const name = F ? F.name : (q && q.id) || 'feature';
    // Resolve as refuse: always roll back die squares (mercy/scout still apply via resolve path using 'acc'-like branch)
    const out = resolve(b, 'refuse', { feature: q && q.id, info: 'refused', refuseDie: die }, rng);
    // Extra explicit die note if resolve used refuseDie
    if (!out.notes.some(n => /Refuse|refuse|Refused/.test(n))) out.notes.unshift(`🙅 Refused ${name}: rolled ${die}, move back.`);
    if (b.quest) b.quest = null;
    b.history[b.history.length - 1].feature = q && q.id;
    b.history[b.history.length - 1].refuse = die;
    save(b);
    lastNotes = [`🙅 Refused ${name} — dice ${die}`].concat(out.notes);
    return out;
  }
  function startQuest(id) {
    const b = load(); if (!b || !b.pending) return null; const q = GW.BSPathFeatures.launch(id, b, b.pending.stage); q.access = b.pending.access; b.quest = q; save(b); return q;
  }
  function observe(m) { let v = 100 - (m.urgency == null ? 5 : m.urgency) * 8; if (m.sat != null) v -= m.sat * 0.25; return clamp(Math.round(v), 0, 100); }
  function recalibrate(b, m, notes) { const obs = observe(m); b.est = Math.round(b.calib.log.length ? b.est * 0.6 + obs * 0.4 : (b.est + obs * 2) / 3); b.calib.log.push(Object.assign({ pos: b.pos, obs, est: b.est }, m)); b.suggested = suggestClass(b.est); if (notes) notes.push(`🎯 Check-in: control estimate ${b.est}% · suggested ${CLASS_BY_ID[b.suggested].name}`); return b; }
  /** Mastery logging (user-entered). kind: 'dry'|'wet' (night) · 'clean' (accident-free day) · 'pooFree' (no #2 accident today). Once per day per kind. */
  function logMastery(b, kind, now) {
    const notes = [], c = CLASS_BY_ID[b.classId], M = b.mastery, k = kind + '@' + dayKey(now);
    if (M.logged[k]) return { ok: false, notes: ['Already logged today.'] }; M.logged[k] = 1;
    if (kind === 'dry') { M.bedRun++; let n = Math.min(3, M.bedRun); if (c.id === 'little') n *= 2; bump(b, 'bed', n, notes); notes.unshift(`🛏 Dry night: +${n}.`); }
    if (kind === 'wet') { M.bedRun = 0; const n = c.id === 'little' ? 6 : 3; if (!M.done.bed) M.bed = Math.max(0, M.bed - n); notes.unshift(`🛏 Wet night: −${n}${M.done.bed ? ' (track already complete)' : ''}.`); }
    if (kind === 'clean') { bump(b, 'acc', 2, notes); notes.unshift('💧 Accident-free day: +2.'); }
    if (kind === 'pooFree') { M.pooRun++; bump(b, 'poo', Math.min(3, M.pooRun), notes); notes.unshift(`💩 #2-accident-free day: +${Math.min(3, M.pooRun)}.`); }
    return { ok: true, notes };
  }
  function setClass(id) { const b = load(); if (!b || !classAllowed(id)) return null; if (b.pending) b.pendingClass = id; else b.classId = id; if (id === 'cascade') b.flags.tummy = true; save(b); return b; }

  // ---------- Test Mode ----------
  function simulate(opts) {
    opts = opts || {}; const seed = (opts.seed != null ? +opts.seed : 1) >>> 0, rng = mulberry32(seed);
    const b = newBoard(Object.assign({ seed: seed ^ 7 }, opts, { startStage: opts.startStage != null ? opts.startStage : 0 })); b.testMode = true; b.testLog = []; b.testSeed = seed;
    const cover = STAGES.map(() => ({})); let n = 0;
    while (!b.finished && n++ < 600) {
      const kind = rng() < 0.2 ? 'poo' : 'pee';
      const s = needToGo(b, kind, rng, { shyOne: b.classId === 'shy' && rng() < 0.2 });
      const p = b.pending; p.rules.forEach(r => { cover[p.stage][r.n] = (cover[p.stage][r.n] || 0) + 1; });
      const out = rng() < 0.72 ? 'ok' : rng() < 0.8 ? 'acc' : 'real';
      const r = resolve(b, out, { urgency: Math.floor(rng() * 11), sat: Math.floor(rng() * 100) }, rng);
      if (n % 5 === 0) logMastery(b, rng() < 0.7 ? 'dry' : 'wet', Date.now() + n * 864e5);
      if (n % 7 === 0) logMastery(b, 'clean', Date.now() + n * 864e5); if (n % 6 === 0) logMastery(b, 'pooFree', Date.now() + n * 864e5);
      b.testLog.push({ i: n, from: s.from, to: b.pos, roll: s.roll.total, faces: s.roll.faces, stage: p.stage, kind, tag: p.tag, rules: p.rules.map(x => x.n + ': ' + x.t), outcome: out, notes: s.notes.concat(r.notes), est: b.est });
    }
    b.testSteps = n; b.testCover = cover; b.testSweep = sweep(seed); save(b); return { board: b, rolls: n, cover, sweep: b.testSweep };
  }
  /** Test Mode sweep: every stage × rule 1–12 + STOP × every class, resolved with ok/acc/real on a scratch board. */
  function sweep(seed) {
    const rng = mulberry32((seed || 1) ^ 0xabc), out = { cases: 0, bad: [] };
    CLASSES.forEach(c => STAGES.forEach((S, si) => { for (let n = 1; n <= 13; n++) ['ok', 'acc', 'real'].forEach(o => {
      const b = newBoard({ seed: n, classId: c.id, startStage: si, mode: 'quiz' }); const pos = stageStart(si) + 3; b.pos = pos;
      const r = n === 13 ? Object.assign({ n: 'STOP', stage: si }, S.stop) : rule(si, n, c.id);
      if (!r || !r.t) out.bad.push(c.id + ' S' + (si + 1) + ' #' + n);
      b.pending = { pos, stage: si, kind: n % 3 ? 'pee' : 'poo', tag: n === 13 ? 'stop' : null, rules: [r], mayi: null, holds: [], check: false };
      const x = resolve(b, o, { urgency: 5, sat: 30 }, rng); out.cases++;
      if (o === 'real' && b.pos !== pos) out.bad.push('real moved ' + c.id);
      if (o === 'ok' && b.pos < pos) out.bad.push('ok moved back ' + c.id);
      if (x.board.pos < 1) out.bad.push('pos<1');
    }); }));
    return out;
  }
  function formatLogText(b) {
    if (!b || !b.testLog || !b.testLog.length) return '(no test log yet — run a test pass)';
    const c = CLASS_BY_ID[b.classId];
    const lines = [`Potty Path v17 test log — ${c.name} · start ${STAGES[b.startStage].short} · seed ${b.testSeed}`, `goes ${b.testSteps} · finished=${!!b.finished} · pos ${b.pos} · ⭐ ${b.stars} · mastery bed ${b.mastery.bed}/12 acc ${b.mastery.acc}/12 #2 ${b.mastery.poo}/12`,
      'Table coverage (play): ' + (b.testCover || []).map((cv, i) => `S${i + 1} ${Object.keys(cv).length} rules`).join(' · '), b.testSweep ? `Table sweep: ${b.testSweep.cases} cases (classes × 4 stages × 12 rules + STOP × ok/accident/real) · problems ${b.testSweep.bad.length}` : '', ''];
    b.testLog.forEach(e => { lines.push(`${e.i}. #${e.from}→#${e.to} 🎲${e.faces.join('+')} · S${e.stage + 1} ${e.tag || ''} · ${e.kind}`); e.rules.forEach(r => lines.push('   Rule ' + r)); lines.push(`   → ${e.outcome}${e.notes.length ? ' · ' + e.notes.join(' · ') : ''}`); });
    return lines.join('\n');
  }
  function downloadText(name, text, mime) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch (e) {} }
  function runTestPass(opts) { const r = simulate(opts); lastNotes = [`🧪 Test pass: ${r.rolls} goes · ${r.board.finished ? 'finished' : 'stopped'} at ${r.board.pos}/${N} as ${CLASS_BY_ID[r.board.classId].name}`]; return r.board; }

  function optsFromQuizzes(mode) {
    const QP = window.BSQuizPlus, r = id => QP ? QP.result(id) : null, o = { mode };
    const lb = r('longBoard'), cq = r('classquiz');
    if (lb) { const c = lb.cfg; Object.assign(o, { calib: c.calib, recal: c.recal, hidden: c.hidden, holdScale: c.holdScale, shake: c.shake, anim: c.anim }); if (c.cls === 'quiz' && cq) o.classId = cq.classId; else if (CLASS_BY_ID[c.cls]) o.classId = c.cls; }
    else if (cq && mode !== 'free') o.classId = cq.classId;
    if (mode === 'campaign' && QP && window.BSCampaign) { const d = QP.campaignDay(window.BSCampaign.load()); if (d.classId) o.classId = d.classId; if (d.control != null) o.control = d.control; if (d.holdScale) o.holdScale = d.holdScale; o.calib = false; }
    return o;
  }


  // ---------- v37 Path UX helpers (inline go, glance, leaky urge/leak, hydration) ----------
  function wearHint(b) {
    try {
      const i = window.BSSimpleUrge && window.BSSimpleUrge.inv && window.BSSimpleUrge.inv();
      const w = (i && i.wearing) || null;
      const map = { none: 'undies / none', pad: 'pad', pads: 'pad', pullups: 'pull-ups', diapers: 'diaper', thick_diapers: 'thick diaper' };
      if (w) return map[w] || w;
    } catch (e) {}
    const S = STAGES[stageOf(b.pos)];
    return S ? S.gear : '—';
  }
  function classBehaviors(b) {
    const c = CLASS_BY_ID[b.classId] || {};
    const bits = [];
    if (b.dribbleGate || c.id === 'leaky') bits.push(b.dribbleLogged ? 'dribble logged' : 'log urge → leak');
    if (c.id === 'pullup') bits.push('round half up · full holds');
    if (c.poo && c.poo.note && bits.length < 4) bits.push(c.poo.note);
    if (c.id === 'shy') bits.push('may move 1 / rule 1');
    if (c.id === 'baby') bits.push('diaper every stage');
    if (c.id === 'cascade') bits.push('tummy flag');
    if (b.padsWithUndies) bits.push('pads+undies OK');
    if (b.changeSatBump) bits.push('change sat +' + b.changeSatBump);
    (c.minus || []).slice(0, 2).forEach(m => { if (bits.length < 4) bits.push(m); });
    return bits.slice(0, 4);
  }
  function hydrationGlance() {
    const S = window.BSSafety;
    const st = S ? S.status() : { total: 0, left: 1000 };
    let rankLine = 'No campaign rank — soft sip reminders only.';
    let nextHint = 'Caps: ≤250 ml/prompt, ≤1 L/day, ≥2 h apart.';
    try {
      const camp = window.BSCampaign && window.BSCampaign.load();
      if (camp && camp.active && !camp.paused) {
        const r = window.BSCampaign.RANKS[camp.rank];
        // Light per-rank cadence (in-app only). Higher ranks = more frequent soft prompts, still capped.
        const rh = (S && S.rankHydration) ? S.rankHydration(camp.rank) : { gapMin: 120, suggestMl: 60 };
        rankLine = (r ? r.name : ('Rank ' + (camp.rank + 1))) + ' · soft prompt ~every ' + rh.gapMin + 'm · ~' + rh.suggestMl + ' ml (capped).';
        nextHint = 'Wear goal: ' + ((r && r.prot) || '—') + '. ' + nextHint;
      }
    } catch (e) {}
    return { total: st.total || 0, left: st.left == null ? 1000 : st.left, rankLine, nextHint };
  }
  function glanceHtml(b) {
    const S = STAGES[stageOf(b.pos)], c = CLASS_BY_ID[b.classId];
    const beh = classBehaviors(b);
    const hy = hydrationGlance();
    const nowBits = [];
    if (b.pending) {
      const p = b.pending;
      nowBits.push('Go on square ' + p.pos + (p.holds && p.holds.length ? ' · hold ' + Math.max(...p.holds) + 'm' : ''));
      if (p.holdEndsAt) {
        const left = Math.max(0, p.holdEndsAt - Date.now());
        nowBits.push(left ? ('Timer ' + Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0')) : 'Timer done — resolve');
      } else if (p.holds && p.holds.length) nowBits.push('Timer not started');
    }
    if (b.quest) nowBits.push('Feature in progress');
    if (b.urgeLock) nowBits.push('Urge locked ' + b.urgeLock.urgency + '/10');
    if (!nowBits.length) nowBits.push('Idle — board ready');
    const care = (function () { try { return window.BSPathPlay && window.BSPathPlay.caregiverOn(); } catch (e) { return false; } })();
    return `<div class="pp-glance" id="ppGlance">
      <div class="pp-gl-row"><span class="pp-gl-k">Wear</span><span class="pp-gl-v">${esc(wearHint(b))}</span><span class="pp-gl-k">Stage gear</span><span class="pp-gl-v">${esc(S.gear)}</span></div>
      <div class="pp-gl-row"><span class="pp-gl-k">Class</span><span class="pp-gl-v">${esc(c.name)}${care ? ' · caregiver' : ''}</span></div>
      <div class="pp-gl-row"><span class="pp-gl-k">Keep in mind</span><span class="pp-gl-v">${beh.length ? esc(beh.join(' · ')) : '—'}</span></div>
      <div class="pp-gl-row"><span class="pp-gl-k">Now</span><span class="pp-gl-v">${esc(nowBits.join(' · '))}</span></div>
      <div class="pp-gl-row pp-gl-hyd"><span class="pp-gl-k">💧 Hydration</span><span class="pp-gl-v">${esc(hy.rankLine)} · today ${hy.total}/${1000} ml (${hy.left} left). ${esc(hy.nextHint)}</span></div>
    </div>`;
  }
  function ensureUrgeFields(b) {
    if (!b.leakLog) b.leakLog = [];
    if (!Array.isArray(b.leakLog)) b.leakLog = [];
    return b;
  }
  /** Log urge (Leaky / class): locks urgency before roll results. */
  function logUrge(b, urgency) {
    ensureUrgeFields(b);
    const u = clamp(+urgency || 0, 0, 10);
    b.urgeLock = { ts: Date.now(), urgency: u };
    b.leakLog = b.leakLog.filter(x => x && (Date.now() - (x.ts || 0) < 7 * 864e5)).slice(-30);
    b.leakLog.push({ kind: 'urge', ts: b.urgeLock.ts, urgency: u });
    save(b);
    return b.urgeLock;
  }
  /** Log first natural leak/dribble after urge — returns { sinceUrgeMs, urgeUrgency, urgency }. */
  function logLeak(b, urgency) {
    ensureUrgeFields(b);
    const u = clamp(+urgency || 0, 0, 10);
    const urge = b.urgeLock || (b.leakLog || []).slice().reverse().find(x => x.kind === 'urge');
    const since = urge && urge.ts ? Math.max(0, Date.now() - urge.ts) : null;
    const entry = { kind: 'leak', ts: Date.now(), urgency: u, sinceUrgeMs: since, urgeUrgency: urge ? urge.urgency : null };
    b.leakLog.push(entry);
    b.dribbleLogged = true;
    save(b);
    try { window.BSClasses && window.BSClasses.noteDribble(entry.ts); } catch (e) {}
    return entry;
  }
  function clearUrgeLock(b) { if (b) { b.urgeLock = null; } }
  function holdLeftMs(p) {
    if (!p || !p.holdEndsAt) return null;
    return Math.max(0, p.holdEndsAt - Date.now());
  }
  function timerLocksRolls(b) {
    if (!b || !b.pending) return false;
    const p = b.pending;
    if (!p.holds || !p.holds.length) return !!b.pending;
    if (!p.holdEndsAt) return true; // must start / wait — rolls stay locked while go pending
    return holdLeftMs(p) > 0;
  }

  // ---------- Rendering ----------
  const W = 360, COLS = 10;
  function coords() {
    const pts = [null], rows = N / COLS, H = rows * 96 + 50;
    for (let p = 1; p <= N; p++) { const i = p - 1, row = Math.floor(i / COLS), col = i % COLS, c = row % 2 ? COLS - 1 - col : col;
      pts.push([+(24 + c * ((W - 48) / (COLS - 1))).toFixed(1), +(H - 44 - row * 96 + Math.sin((c / (COLS - 1)) * Math.PI * 2 + row) * 14).toFixed(1)]); }
    return { pts, H };
  }
  function pathD(pts) { let d = `M${pts[1][0]},${pts[1][1]}`; for (let i = 2; i < pts.length; i++) { const a = pts[i - 1], z = pts[i]; d += ` Q${a[0]},${a[1]} ${(a[0] + z[0]) / 2},${(a[1] + z[1]) / 2}`; } const l = pts[pts.length - 1]; return d + ` T${l[0]},${l[1]}`; }
  const TAG_ICON = { stage: '📜', stop: '🛑', checkin: '📋', hold: '⏱', prot: '🧷', again: '↻', rand: '❓', mayi: '🙋' };
  const label = s => s.rules === 'stop' ? 'STOP' : s.rules === 'rand' ? '?' : s.rules.join('+');
  function svg(b) {
    const { pts, H } = coords(), c = CLASS_BY_ID[b.classId]; let sq = '';
    for (let p = 1; p <= N; p++) {
      const [x, y] = pts[p], s = b.squares[p], st = STAGES[stageOf(p)], stop = s.tag === 'stop';
      sq += `<g class="pp-sq" data-p="${p}"><circle cx="${x}" cy="${y}" r="15.5" fill="${stop ? '#d63031' : st.color}" fill-opacity="${p < b.pos ? 0.4 : 0.95}" stroke="#1e272e" stroke-width="1.5"/>
        <text x="${x}" y="${y + (stop ? 3 : 4)}" text-anchor="middle" font-size="${stop ? 7.5 : label(s).length > 3 ? 8 : 11}" font-weight="bold" fill="${stop ? '#fff' : '#2d3436'}">${esc(label(s))}</text>
        ${s.tag && !stop ? `<text x="${x + 11}" y="${y - 9}" text-anchor="middle" font-size="9">${TAG_ICON[s.tag] || ''}</text>` : ''}<text x="${x - 12}" y="${y - 13}" font-size="6.5" fill="#b2bec3">${p}</text></g>`;
    }
    const corners = STAGES.map((s, i) => { const [x, y] = pts[stageStart(i)]; return `<text x="${clamp(x, 40, W - 40)}" y="${y + 30}" text-anchor="middle" font-size="10" fill="${s.color}" font-weight="bold">${esc(s.short)}</text>`; }).join('');
    const tp = pts[b.pos];
    return `<svg id="ppSvg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Potty Path, 4 stages, token on ${b.pos}">
      <rect class="pp-board-bg" width="${W}" height="${H}" rx="16" fill="var(--board, #1e2a3a)"/><path class="pp-track" d="${pathD(pts)}" stroke="var(--track, #3d5a80)" stroke-width="24" fill="none" stroke-linecap="round"/>
      <path class="pp-track-dash" d="${pathD(pts)}" stroke="var(--text, #e0fbfc)" stroke-width="2" fill="none" stroke-dasharray="4 6" opacity=".45"/>${corners}${sq}
      <g id="ppToken" style="transform:translate(${tp[0]}px,${tp[1]}px)"><circle r="12" cy="-8" fill="#fff" stroke="#6c5ce7" stroke-width="3"/><text y="-3" text-anchor="middle" font-size="14">${esc(c.name.split(' ')[0])}</text></g></svg>`;
  }
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieHtml = f => `<div class="pp-face">${Array.from({ length: 9 }, (_, i) => `<i class="${(PIPS[f] || []).includes(i) ? 'on' : ''}"></i>`).join('')}</div>`;
  let busy = false, lastNotes = [], holdTimer = null;
  function tableHtml(st, classId) { const S = STAGES[st]; return `<ol class="pp-rules">${S.table.slice(1).map((r, i) => `<li>${esc(rule(st, i + 1, classId).t)}</li>`).join('')}</ol><div class="cal-legend"><b>STOP:</b> ${esc(S.stop.t.replace(/^STOP: /, ''))}</div><div class="cal-legend"><b>Doubles (2d6):</b> ${Object.keys(S.events).map(k => k + ' ' + esc(S.events[k].t)).join(' · ')}</div>`; }
  function masteryHtml(b) {
    return `<div class="pp-mastery">${Object.keys(MASTERY).map(k => `<div class="pp-mtrack"><b>${MASTERY[k].name}</b> ${b.mastery[k]}/12 ${b.mastery.done[k] ? '🏆' : ''}<div class="pp-mbar"><i style="width:${b.mastery[k] / 12 * 100}%"></i></div><small>${esc(MASTERY[k].how)} 🏆 ${esc(MASTERY[k].reward)}</small></div>`).join('')}
      <div class="quiz-nav"><button type="button" data-ml="dry">🛏 Dry night</button><button type="button" data-ml="wet">🌊 Wet night</button><button type="button" data-ml="clean">💧 Accident-free day</button><button type="button" data-ml="pooFree">💩 No #2 accident today</button></div></div>`;
  }
  function syncClipHold(b) {
    try {
      const B = window.BSClipBridge;
      if (!B) return;
      if (B.syncFromBoard) { B.syncFromBoard(b || null); return; }
      // Older bridge: a pending go is still hold context until the board clears it.
      if (b && b.pending && B.setPathHold) B.setPathHold({ kind: 'path_hold', pending: true, untilResolve: true, endsAt: b.pending.holdEndsAt || 0, pos: b.pos, stage: b.pending.stage });
      else if (B.clearPathHold) B.clearPathHold();
    } catch (e) {}
  }
  function render() {
    const m = document.getElementById('pathMount'); if (!m) return; const b = load();
    syncClipHold(b);
    try { if (window._ppLastNotes && window._ppLastNotes.length) { lastNotes = window._ppLastNotes; window._ppLastNotes = null; } } catch (e) {}
    if (!b) return renderSetup(m);
    applyThemeClass();
    const c = CLASS_BY_ID[b.classId], st = stageOf(b.pos), S = STAGES[st], calibLeft = b.calib.need - b.calib.done;
    const rollsLocked = !!(b.pending || b.finished);
    const leaky = !!(b.dribbleGate || c.id === 'leaky');
    const tw = themeWords();
    m.innerHTML = `<div class="pp-top"><div><b>${esc(c.name)}</b> <span class="muted">${esc(S.short)} · ${b.pos}/${N}</span></div><div>⭐ ${b.stars}</div>
      <button type="button" id="ppFull" class="pp-mini" aria-label="Full screen">⛶</button><button type="button" id="ppGear" class="pp-mini" aria-label="Board settings">⚙</button></div>
      ${glanceHtml(b)}
      <div class="pp-banner" style="border-left:5px solid ${S.color}">${b.finished ? '🏆 Board finished! New board in ⚙.' : `<b>${esc(S.name)}</b> — gear: ${esc(S.gear)}.` + (calibLeft > 0 ? ` 🎯 Your next ${calibLeft} go${calibLeft > 1 ? 'es include' : ' includes'} a quick check-in.` : ` Control est. ${b.est}%.`) + (b.accStreak ? ` ⚠ ${b.accStreak} accident in a row — another sends you back a stage.` : '') + Object.keys(b.flags).filter(k => b.flags[k]).map(k => ' · ' + ({ tummy: '🌀 tummy trouble', mercy: '🃏 mercy', busy: '🚪 potty busy', race: '🏃 race', mayiToken: '🙋 token', doubleNext: '⚠ slip-up', pass: '🎟 hall pass', nochange: '⏳ cosy' }[k] || k)).join('')}</div>
      <div class="pp-board">${svg(b)}</div>
      <div id="ppActiveHost"></div>
      <div class="pp-legend"><span>Numbers = rules from the stage table</span>${Object.keys(TAG_ICON).map(k => `<span>${TAG_ICON[k]} ${({ stage: 'stage rules', stop: 'STOP', checkin: 'check-in', hold: 'hold', prot: 'protection', again: 'roll again', rand: 'mystery rule', mayi: 'May I?' })[k]}</span>`).join('')}</div>
      ${leaky ? `<div class="pp-leaky-row" id="ppLeakyRow">
        <button type="button" id="ppUrgeLog" class="pp-ok" ${b.pending || b.finished ? 'disabled' : ''}>💦 ${esc(tw.haveToGo)}</button>
        <button type="button" id="ppLeakLog" class="pp-need2" ${b.finished ? 'disabled' : ''}>💧 ${esc(tw.alreadyLeaked)}${b.dribbleLogged ? ' ✓' : ''}</button>
        <small class="muted">Step 1 locks urgency before the roll. Step 2 logs urgency at first natural leak (tracks time since urge).</small>
      </div>` : ''}
      <div class="pp-care-row" id="ppCareRow">
        <button type="button" id="ppCareCheck" class="pp-mini">🤗 ${esc(tw.careCheck)}</button>
        <button type="button" id="ppSatCheck" class="pp-mini">📋 ${esc(tw.satCheck)}</button>
        <button type="button" id="ppHydHint" class="pp-mini">💧 Hydration</button>
      </div>
      <div class="pp-dicebar"><button type="button" id="ppDie" class="pp-die pp-die2" aria-label="I need to go — roll" ${rollsLocked ? 'disabled' : ''}>${dieHtml((b.lastFaces || [1, 1])[0])}${dieHtml((b.lastFaces || [1, 1])[1])}</button>
        <div class="pp-go"><button type="button" id="ppNeed" class="pp-need" ${rollsLocked ? 'disabled' : ''}>🚽 ${esc(tw.needToGo)}</button><button type="button" id="ppNeed2" class="pp-need2" ${rollsLocked ? 'disabled' : ''}>💩 #2</button>
        <button type="button" id="ppMayChange" class="pp-need2" title="Standing May I change? roll">🧷 ${esc(tw.mayChange)}</button>
        ${c.id === 'shy' ? '<label class="qp-flag"><input type="checkbox" id="ppShy"> 🙈 Move 1, use rule 1</label>' : ''}<small class="muted">${b.pending ? 'Stay on the board — resolve the go below. Roll buttons locked while a go / timer is active. 🧷 May I change? stays available.' : 'Press when you really need to go. Roll 2d6, move ' + (c.move === 'full' ? 'the full roll' : 'half (' + (c.move === 'up' ? 'round up' : 'round down') + ')') + '. Tap dice or shake = 🚽. 🧷 = May I change? any time.'}</small></div></div>
      <div id="ppNotes" class="pp-notes">${lastNotes.map(n => `<div>${esc(n)}</div>`).join('')}</div>
      <div id="ppReviewHost"></div>
      <div id="ppQuizHost"></div>
      <details class="sess-more" id="ppRulesBox"><summary>📜 ${esc(S.short)} rules &amp; 1–12 table</summary><ul class="pp-box">${S.box.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${tableHtml(st, b.classId)}</details>
      <details class="sess-more" id="ppMastery"><summary>🏅 Mastery tracks</summary>${masteryHtml(b)}</details>`;
    m.querySelector('#ppDie').onclick = () => doGo('pee'); m.querySelector('#ppNeed').onclick = () => doGo('pee'); m.querySelector('#ppNeed2').onclick = () => doGo('poo');
    const ppChg = m.querySelector('#ppMayChange'); if (ppChg) ppChg.onclick = () => { try { if (window.BSPathPlay && window.BSPathPlay.openMayChange) window.BSPathPlay.openMayChange('potty_path'); else if (window.BSChange) window.BSChange.open({ ctx: 'potty_path' }); } catch (e) {} };
    m.querySelector('#ppGear').onclick = openSettings;
    m.querySelector('#ppFull').onclick = () => { const s = document.getElementById('tab-path'); if (s) s.classList.toggle('pp-fullscreen'); };
    m.querySelectorAll('[data-ml]').forEach(x => x.onclick = () => { const bb = load(); const r = logMastery(bb, x.dataset.ml); save(bb); lastNotes = r.notes; render(); const d = document.getElementById('ppMastery'); if (d) d.open = true; });
    const urgeBtn = m.querySelector('#ppUrgeLog'); if (urgeBtn) urgeBtn.onclick = () => openUrgeLeakPanel('urge');
    const leakBtn = m.querySelector('#ppLeakLog'); if (leakBtn) leakBtn.onclick = () => openUrgeLeakPanel('leak');
    const careBtn = m.querySelector('#ppCareCheck'); if (careBtn) careBtn.onclick = () => openCareInline();
    const satBtn = m.querySelector('#ppSatCheck'); if (satBtn) satBtn.onclick = () => openSatInline();
    const hydBtn = m.querySelector('#ppHydHint'); if (hydBtn) hydBtn.onclick = () => {
      const hy = hydrationGlance();
      lastNotes = ['💧 ' + hy.rankLine, hy.nextHint + ' Today ' + hy.total + '/' + 1000 + ' ml (' + hy.left + ' left).'];
      render();
    };
    try {
      if (window.BSPathPlay) {
        const rh = m.querySelector('#ppReviewHost'); if (rh) rh.innerHTML = window.BSPathPlay.reviewHtml('path');
        const qh = m.querySelector('#ppQuizHost'); if (qh) { qh.innerHTML = window.BSPathPlay.sectionQuizzesHtml('path'); window.BSPathPlay.bindSectionQuizzes(qh); }
      }
    } catch (e) {}
    if (b.pending && b.quest) showQuest(b, m); else if (b.pending) showGo(b);
  }
  function themeId() {
    try { if (window.BSHub && window.BSHub.themeId) return window.BSHub.themeId(); } catch (e) {}
    try { const p = window.BSHub && window.BSHub.playPrefs && window.BSHub.playPrefs(); if (p && p.theme) return p.theme; } catch (e) {}
    return 'neutral';
  }
  function themeWords() {
    try { if (window.BSHub && window.BSHub.themeWords) return window.BSHub.themeWords(); } catch (e) {}
    return { needToGo: 'I need to go', haveToGo: 'I have to go', alreadyLeaked: 'I already leaked / dribbled', mayChange: 'May I change?', careCheck: 'Caregiver check', satCheck: 'Saturation check', cantHold: "Can't hold", followed: 'Followed the rule' };
  }
  function applyThemeClass() {
    try {
      if (window.BSHub && window.BSHub.applyThemeDom) window.BSHub.applyThemeDom(themeId());
      else {
        const ids = ['neutral','girl','boy','softpink','sky','lavender','midnight','baby','toddler','teen'];
        const t = themeId();
        [document.documentElement, document.body].forEach(el => {
          if (!el) return;
          ids.forEach(id => el.classList.remove('bs-theme-' + id));
          el.classList.add('bs-theme-' + t);
          el.setAttribute('data-bs-theme', t);
        });
      }
    } catch (e) {}
  }
  function openUrgeLeakPanel(kind) {
    const host = document.getElementById('ppActiveHost'); if (!host) return;
    const b = load(); if (!b) return;
    const tw = themeWords();
    const title = kind === 'leak' ? tw.alreadyLeaked : tw.haveToGo;
    const hint = kind === 'leak'
      ? (b.urgeLock ? ('Urge was ' + b.urgeLock.urgency + '/10 — enter urgency at the leak.') : 'No urge logged yet — you can still note the leak.')
      : 'Enter urgency now. It locks before the roll.';
    host.innerHTML = `<div class="pp-inline-go" id="ppUrgePanel">
      <div class="pp-evtype" style="background:#74b9ff">${esc(title)}</div>
      <div class="cal-legend">${esc(hint)}</div>
      <label class="fld"><span>📋 Urgency (you enter it): <b id="ppULV">5</b>/10</span><input type="range" id="ppUL" min="0" max="10" value="5"></label>
      <div class="quiz-nav"><button type="button" id="ppULSave" class="pp-ok">✓ Save</button><button type="button" id="ppULX">Close</button>
      <button type="button" data-out="real" class="pp-real pp-pause">⏸ I'm going now</button></div></div>`;
    const sl = host.querySelector('#ppUL'); sl.oninput = () => { host.querySelector('#ppULV').textContent = sl.value; };
    host.querySelector('#ppULX').onclick = () => { host.innerHTML = ''; };
    host.querySelector('[data-out]').onclick = () => { host.innerHTML = ''; lastNotes = ['⏸ Paused — off you go. Your token stays put.']; render(); };
    host.querySelector('#ppULSave').onclick = () => {
      const u = +sl.value;
      if (kind === 'urge') {
        logUrge(b, u);
        lastNotes = ['💦 Urge locked at ' + u + '/10 — you may roll.'];
        host.innerHTML = '';
        render();
        return;
      }
      const entry = logLeak(b, u);
      const mins = entry.sinceUrgeMs != null ? Math.round(entry.sinceUrgeMs / 60000) : null;
      lastNotes = ['💧 Leak logged at ' + u + '/10' + (entry.urgeUrgency != null ? ' (urge was ' + entry.urgeUrgency + '/10)' : '') + (mins != null ? ' · ' + mins + ' min since urge' : '') + '.'];
      host.innerHTML = '';
      render();
    };
  }
  function openCareInline() {
    const host = document.getElementById('ppActiveHost'); if (!host) return;
    const care = (function () { try { return window.BSPathPlay && window.BSPathPlay.caregiverOn(); } catch (e) { return false; } })();
    const line = (function () {
      try {
        if (care && window.BSPathPlay && window.BSPathPlay.line) return window.BSPathPlay.line('checkin');
      } catch (e) {}
      return 'Quick check: enter urgency & saturation, then May I change? if you need a fresh change.';
    })();
    host.innerHTML = `<div class="pp-inline-go pp-care-inline" id="ppCarePanel">
      <div class="pp-evtype" style="background:#a29bfe">🤗 Caregiver</div>
      <div class="pp-do">${esc(line)}</div>
      <div class="quiz-nav">
        <button type="button" id="ppCareMay" class="pp-ok">🧷 May I change?</button>
        <button type="button" id="ppCareSat">📋 Saturation</button>
        <button type="button" id="ppCareX">Close</button>
      </div></div>`;
    host.querySelector('#ppCareX').onclick = () => { host.innerHTML = ''; };
    host.querySelector('#ppCareMay').onclick = () => { try { if (window.BSPathPlay && window.BSPathPlay.openMayChange) window.BSPathPlay.openMayChange('path_care'); else if (window.BSChange) window.BSChange.open({ ctx: 'path_care' }); } catch (e) {} };
    host.querySelector('#ppCareSat').onclick = () => openSatInline();
  }
  function openSatInline() {
    const host = document.getElementById('ppActiveHost'); if (!host) return;
    host.innerHTML = `<div class="pp-inline-go" id="ppSatPanel">
      <div class="pp-evtype" style="background:#7cc4ff">📋 Saturation check</div>
      <label class="fld"><span>Saturation (you enter it): <b id="ppSatV">25</b>%</span><input type="range" id="ppSatS" min="0" max="100" step="5" value="25"></label>
      <label class="fld"><span>Urgency (you enter it): <b id="ppSatU">0</b>/10</span><input type="range" id="ppSatUrg" min="0" max="10" value="0"></label>
      <div class="quiz-nav"><button type="button" id="ppSatSave" class="pp-ok">✓ Save to status</button>
        <button type="button" id="ppSatMay">🧷 May I change?</button><button type="button" id="ppSatX">Close</button></div></div>`;
    const s = host.querySelector('#ppSatS'), u = host.querySelector('#ppSatUrg');
    s.oninput = () => { host.querySelector('#ppSatV').textContent = s.value; };
    u.oninput = () => { host.querySelector('#ppSatU').textContent = u.value; };
    host.querySelector('#ppSatX').onclick = () => { host.innerHTML = ''; };
    host.querySelector('#ppSatMay').onclick = () => { try { if (window.BSPathPlay && window.BSPathPlay.openMayChange) window.BSPathPlay.openMayChange('path_sat'); else if (window.BSChange) window.BSChange.open({ ctx: 'path_sat' }); } catch (e) {} };
    host.querySelector('#ppSatSave').onclick = () => {
      try {
        if (typeof manualPressure !== 'undefined') { manualPressure = +u.value * 10; manualSaturation = +s.value; if (typeof updateUI === 'function') updateUI(); if (typeof confirmStatus === 'function') confirmStatus(); }
      } catch (e) {}
      lastNotes = ['📋 Saved urgency ' + u.value + '/10 · saturation ' + s.value + '%.'];
      host.innerHTML = ''; render();
    };
  }
  function showQuest(b, m) {
    const q = b.quest, F = GW.BSPathFeatures && GW.BSPathFeatures.BY[q.id]; if (!F) return;
    const left = q.until ? Math.max(0, Math.ceil((q.until - Date.now()) / 60000)) : null;
    const host = m.querySelector('#ppActiveHost') || m;
    const d = document.createElement('div'); d.className = 'pp-quest pp-inline-go'; d.id = 'ppQuest';
    d.innerHTML = `<b>${F.icon} In progress: ${esc(F.name)}</b><div>${esc(F.do)}</div>${q.note ? `<div class="cal-legend">${esc(q.note)}</div>` : ''}${left != null ? `<div class="calib-big">${b.hidden ? '✋' : left + ' min'}</div>` : ''}
      <div class="cal-legend">Auto-detects when it's done. Or finish it here. Refuse forces a dice rollback (⏸ real urge stays free).</div>
      <div class="quiz-nav"><button type="button" data-q="ok" class="pp-ok">✅ Done</button><button type="button" data-q="acc">💦 Accident</button><button type="button" data-q="refuse" class="pp-refuse">🙅 Refuse (dice rollback)</button><button type="button" data-q="real" class="pp-real pp-pause" title="Pause — no move">⏸ I'm going now</button><button type="button" data-q="re">▶ Reopen</button></div>`;
    host.innerHTML = ''; host.appendChild(d);
    d.querySelectorAll('[data-q]').forEach(x => x.onclick = () => {
      if (x.dataset.q === 're') { GW.BSPathFeatures.launch(q.id, b, b.pending.stage); return; }
      if (x.dataset.q === 'refuse') {
        if (!confirm('Refuse this feature? You will roll 1d6 and move back that many squares. (⏸ I\'m going now is still free if you really need to go.)')) return;
        refuseQuest(); render(); return;
      }
      finishQuest({ outcome: x.dataset.q, info: 'marked by you' }); render();
    });
  }
  function renderSetup(m) {
    applyThemeClass();
    const stash = stashNow();
    m.innerHTML = `<h2 style="margin:0 0 6px;">🎲 Potty Path</h2><p class="section-desc">Four training stages around a 60-square path. Every time you really need to go, press <b>🚽 I need to go</b>: roll 2d6, move half, and the square's number tells you <i>how</i> to go from that stage's 1–12 table. Follow it → stay. Accident → back. Two in a row → back a stage. Active goes stay on the board (inline) so the path stays visible.</p>
      ${legacy() ? '<div class="pp-banner">Your v16 board used the old squares and was retired. Start a new one below.</div>' : ''}
      <div class="pp-modes">
        <button type="button" id="ppDeepStart" class="hub-sub" style="border-color:#a29bfe;">🎛 <b>Deep start</b><br><small>Mode · class cards · theme · stat allocator · confirm (recommended)</small></button>
        <button type="button" data-mode="free" class="hub-sub">🎯 <b>Quick free play</b><br><small>Skip the sheet — adaptive stage from your control estimate.</small></button>
        <button type="button" data-mode="quiz" class="hub-sub">🧩 <b>From my quizzes</b><br><small>Which-Class / Long board quiz pick class and timer feel.</small></button>
        <button type="button" data-mode="campaign" class="hub-sub">🏅 <b>Campaign-shaped board</b><br><small>Uses today's campaign shape for class/control. Campaign itself also runs outside the board.</small></button></div>
      <label class="fld"><span>Quick class (stash-gated${stash ? '' : ' — take 🎒 Stash & Gear to gate'})</span><select id="ppCls"><option value="">Auto-suggest</option>${CLASSES.map(c => `<option value="${c.id}" ${classAllowed(c.id) ? '' : 'disabled'}>${esc(c.name)} — ${esc(c.band)}${classAllowed(c.id) ? '' : ' (not in stash)'}</option>`).join('')}</select></label>
      <label class="fld"><span>Start stage</span><select id="ppStage"><option value="">Auto</option>${STAGES.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('')}</select></label>
      <div class="pp-test"><b>🧪 Test Mode</b><p class="section-desc" style="margin:4px 0 8px;">Auto-plays a whole board with random outcomes (no real waits), hitting every stage table, STOPs, doubles and mastery logs.</p>
        <div class="camp-actions"><button type="button" id="ppTest" style="background:#fdcb6e;color:#000;font-weight:bold;">🧪 Run test pass</button><button type="button" id="ppTestExport" class="pp-mini">📄 Export last log</button></div>
        <pre id="ppTestPreview" class="cal-legend" style="max-height:160px;overflow:auto;white-space:pre-wrap;margin:8px 0 0;"></pre></div>
      <details class="sess-more"><summary>📚 Classes (perks & drawbacks)</summary>${classTable()}</details>
      <details class="sess-more"><summary>📜 Stage tables</summary>${STAGES.map((s, i) => `<h4>${esc(s.name)}</h4>${tableHtml(i, null)}`).join('')}</details>`;
    const opts = mode => { const o = optsFromQuizzes(mode); const cv = m.querySelector('#ppCls').value, sv = m.querySelector('#ppStage').value; if (cv) o.classId = cv; if (sv !== '') o.startStage = +sv; return o; };
    const deep = m.querySelector('#ppDeepStart');
    if (deep) deep.onclick = () => {
      if (window.BSPathPlay) window.BSPathPlay.openStartSheet({
        target: 'path', boardMode: 'free',
        onConfirm: (saved, draft) => { window.BSPathPlay.beginFromStart('path', saved, Object.assign({}, draft, { startStage: m.querySelector('#ppStage').value })); }
      });
      else { const b = newBoard(opts('free')); save(b); lastNotes = ['Board ready.']; render(); }
    };
    m.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => {
      if (window.BSPathPlay) {
        window.BSPathPlay.openStartSheet({
          target: 'path', boardMode: btn.dataset.mode,
          startStage: m.querySelector('#ppStage').value,
          onConfirm: (saved, draft) => {
            const o = opts(btn.dataset.mode);
            draft = Object.assign({}, draft, { boardMode: btn.dataset.mode, startStage: o.startStage != null ? o.startStage : draft.startStage });
            if (m.querySelector('#ppCls').value) saved = window.BSPathPlay.saveStart(Object.assign({}, saved, { classId: m.querySelector('#ppCls').value || saved.classId }));
            window.BSPathPlay.beginFromStart('path', saved, draft);
          }
        });
      } else {
        const b = newBoard(opts(btn.dataset.mode)); save(b); lastNotes = [`Board ready as ${CLASS_BY_ID[b.classId].name}, starting in ${STAGES[b.startStage].short}. Press 🚽 when you need to go.`]; render();
      }
    });
    m.querySelector('#ppTest').onclick = () => { const b = runTestPass(Object.assign(opts('free'), { seed: Date.now() & 0xffff })); if (typeof toast === 'function') toast('Test pass: ' + b.testSteps + ' goes'); render(); };
    m.querySelector('#ppTestExport').onclick = exportLog;
  }
  function exportLog() { const b = load(); if (!b || !b.testLog) { if (typeof toast === 'function') toast('Run a test pass first'); return; } downloadText('potty-path-test.txt', formatLogText(b)); downloadText('potty-path-test.json', JSON.stringify({ meta: { classId: b.classId, steps: b.testSteps, seed: b.testSeed, cover: b.testCover, mastery: b.mastery }, log: b.testLog }, null, 2), 'application/json'); }
  function classTable() { return `<table class="pp-table"><tr><th>Class</th><th>Needs</th><th>Perks</th><th>Drawbacks</th></tr>${CLASSES.map(c => `<tr><td>${esc(c.name)}<br><small>${esc(c.band)} · start ${esc(STAGES[c.start].short)}</small></td><td>${esc(c.needs.join(', ').replace(/\|/g, ' or ') || '—')}</td><td>${c.plus.map(esc).join('<br>')}${c.poo ? '<br><b>#2</b> ' + esc(c.poo.note) : ''}</td><td>${c.minus.map(esc).join('<br>')}</td></tr>`).join('')}</table>`; }
  function animateToken(path, done) { const b = load(), { pts } = coords(), tok = document.getElementById('ppToken'); if (!tok || !b.anim || !path.length) return done(); let i = 0; const next = () => { if (i >= path.length) return done(); const p = pts[path[i++]]; tok.style.transform = `translate(${p[0]}px,${p[1]}px)`; setTimeout(next, 220); }; next(); }
  function doGo(kind) {
    if (busy) return; const b = load(); if (!b || b.pending || b.finished) return;
    // Leaky: require urge lock before rolling
    if (kind === 'pee' && (b.dribbleGate || b.classId === 'leaky') && !b.urgeLock && !b.testMode) {
      openUrgeLeakPanel('urge');
      lastNotes = ['💦 Log your urge first (locks urgency), then the roll.'];
      return;
    }
    busy = true;
    const die = document.getElementById('ppDie'), shy = document.getElementById('ppShy'); if (die) die.classList.add('rolling');
    let t = 0; const spin = setInterval(() => { if (die) die.innerHTML = dieHtml(dn(Math.random, 6)) + dieHtml(dn(Math.random, 6)); if (++t > 8) { clearInterval(spin); land(); } }, 80);
    function land() {
      const s = needToGo(b, kind, Math.random, { shyOne: !!(shy && shy.checked) });
      if (s.blocked === 'urge') {
        if (die) die.classList.remove('rolling');
        lastNotes = s.notes.slice(); busy = false; openUrgeLeakPanel('urge'); return;
      }
      if (s.blocked === 'dribble') {
        if (die) die.classList.remove('rolling');
        lastNotes = s.notes.slice(); busy = false; openUrgeLeakPanel('leak'); return;
      }
      b.lastFaces = s.roll.faces; if (die) { die.classList.remove('rolling'); die.innerHTML = dieHtml(s.roll.faces[0]) + dieHtml(s.roll.faces[1]); }
      lastNotes = [`🎲 ${s.roll.faces.join(' + ')} = ${s.roll.total} → move ${s.move}`].concat(s.notes);
      // Carry locked urgency onto pending for resolve defaults
      if (b.urgeLock && b.pending) b.pending.lockedUrgency = b.urgeLock.urgency;
      save(b); animateToken(s.path, () => { busy = false; render(); });
    }
  }
  function sheet(html) { const w = document.createElement('div'); w.className = 'cal-sheet-wrap pp-sheet-wrap'; w.innerHTML = `<div class="cal-sheet pp-ev" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(w); return w; }
  /** Buttons named in rule / guidance copy that must actually appear (low-control swaps, etc.). Skip ids already covered by the feature Launch button. */
  function impliedLaunches(p) {
    const out = [], seen = new Set();
    if (p.feature && p.feature !== 'checkin_app') seen.add(p.feature);
    const add = (id, label) => { if (!seen.has(id)) { seen.add(id); out.push({ id, label }); } };
    (p.rules || []).forEach(r => {
      if (r.guide) add('guide_event', '▶ Event guide');
      if (r.prot) add('may_change', '🧷 May I change?');
    });
    add('may_change', '🧷 May I change?');
    return out;
  }
  /** v37: inline go panel on the Path board (no face-blocking modal). Timer persists on pending.holdEndsAt. */
  function showGo(b) {
    const host = document.getElementById('ppActiveHost'); if (!host) return;
    if (host.querySelector('#ppEv')) return;
    const p = b.pending, S = STAGES[p.stage], c = CLASS_BY_ID[b.classId];
    const mins = p.holds.length ? Math.max(...p.holds) : 0;
    const timed = p.rules.find(r => r.k === 'race'); const urge = p.rules.find(r => r.k === 'urge');
    const implied = impliedLaunches(p);
    const tw = themeWords();
    const fog = !!(b.hidden || (window.BSPathPlay && window.BSPathPlay.timerFog && window.BSPathPlay.timerFog()));
    const left0 = holdLeftMs(p);
    const timerLabel = (() => {
      if (!mins) return '';
      if (fog) return '✋ soft fog';
      if (p.holdEndsAt) {
        if (left0 <= 0) return '⏰ Time! Go now.';
        return Math.floor(left0 / 60000) + ':' + String(Math.floor(left0 / 1000) % 60).padStart(2, '0');
      }
      return mins + ':00';
    })();
    const lockU = p.lockedUrgency != null ? p.lockedUrgency : (b.urgeLock ? b.urgeLock.urgency : null);
    host.innerHTML = `<div class="pp-inline-go" id="ppEv">
      <div class="pp-evtype" style="background:${S.color}">${esc(S.short)} · square ${p.pos} ${p.tag ? TAG_ICON[p.tag] || '' : ''} · ${p.kind === 'poo' ? '💩 #2' : '💧 pee'}</div>
      <h3 style="margin:6px 0 4px;font-size:16px;">${p.tag === 'stop' ? '🛑 STOP' : 'Rule' + (p.rules.length > 1 ? 's ' : ' ') + p.rules.map(r => r.n).join(' + ')}</h3>
      ${p.rules.map(r => `<div class="pp-do">${esc(r.t)}${r.free ? ' <small>(pick one from the table below)</small>' : ''}</div>`).join('')}
      ${p.feature && GW.BSPathFeatures ? (f => `<div class="pp-feat"><b>${f.icon} Feature: ${esc(f.name)}</b><div>${esc(f.do)}</div>${p.feature === 'checkin_app' ? '' : '<button type="button" id="ppLaunch" class="pp-ok">▶ Launch ' + esc(f.name) + '</button> <button type="button" id="ppRefuseFeat" class="pp-refuse">🙅 Refuse</button>'}</div>`)(GW.BSPathFeatures.BY[p.feature]) : ''}
      ${implied.length ? `<div class="pp-feat">${implied.map(x => `<button type="button" class="pp-ok" data-launch="${x.id}">${esc(x.label)}</button>`).join(' ')}</div>` : ''}
      ${p.mayi != null ? `<div class="pp-cons">🙋 May I? → <b>${(function(){ try { if (window.BSPathPlay && window.BSPathPlay.caregiverOn()) return window.BSPathPlay.line(p.mayi ? 'mayi_yes' : 'mayi_no'); } catch(e){} return p.mayi ? 'Yes, you may.' : 'Not yet — wait 5 minutes, then go.'; })()}</b></div>` : ''}
      ${p.tag === 'prot' ? `<div class="pp-cons">🧷 Protection square: wear ${esc(S.gear)} for this go.</div>` : ''}
      ${mins ? `<div class="pp-hold${fog ? ' pp-fog' : ''}"><div class="calib-big" id="ppHoldT">${esc(timerLabel)}</div>${p.holdEndsAt ? '' : '<button type="button" id="ppHoldGo">▶ Start timer</button>'}<div class="cal-legend">Timer runs on the board. Rolls stay locked until it ends (you can still log accident / can\'t hold / caregiver).</div></div>` : ''}
      ${timed ? `<div class="cal-legend">🏃 Race: ${timed.sec} seconds.</div>` : ''}${urge ? `<div class="cal-legend">Urgency target ${urge.lvl}/10 (you enter it).</div>` : ''}
      ${p.check || urge || lockU != null || true ? `<label class="fld"><span>📋 Your urgency now (you enter it): <b id="ppUV">${lockU != null ? lockU : '–'}</b>/10</span><input type="range" id="ppU" min="0" max="10" value="${lockU != null ? lockU : 0}"></label><label class="fld"><span>Saturation (you enter it): <b id="ppSV">0</b>%</span><input type="range" id="ppS" min="0" max="100" step="5" value="0"></label>` : ''}
      ${p.dare ? `<label class="qp-flag pp-cons"><input type="checkbox" id="ppDare"> 🎯 Bonus dare: ${esc(p.dare.task)} (+${p.dare.stars} ⭐)</label>` : ''}
      <div class="pp-cons"><div>✅ Followed it → stay, +1 ⭐.</div><div>💦 Accident / can\'t hold → move back ${c.id === 'baby' ? '(Baby: not for diaper accidents)' : 'd' + (c.back || 6)}.</div></div>
      <details class="sess-more"><summary>Stage table</summary>${tableHtml(p.stage, b.classId)}</details>
      <div class="quiz-nav">
        <button type="button" data-out="ok" class="pp-ok">✅ ${esc(tw.followed)}</button>
        <button type="button" data-out="acc">💦 ${esc(tw.cantHold)} / Accident</button>
        <button type="button" id="ppGoCare">🤗 Caregiver</button>
        <button type="button" id="ppGoMay">🧷 ${esc(tw.mayChange)}</button>
      </div>
      <div class="pp-pause-row"><button type="button" data-out="real" class="pp-real pp-pause" title="Pause — no move">⏸ I'm going now</button></div>
    </div>`;
    const w = host;
    const u = w.querySelector('#ppU'), s = w.querySelector('#ppS'); let touched = lockU != null || !u;
    if (u && lockU != null) { u.value = lockU; w.querySelector('#ppUV').textContent = lockU; touched = true; }
    const la = w.querySelector('#ppLaunch'); if (la) la.onclick = () => { clearInterval(holdTimer); startQuest(p.feature); render(); };
    const rf = w.querySelector('#ppRefuseFeat'); if (rf) rf.onclick = () => {
      if (!confirm('Refuse this feature? You will roll 1d6 and move back that many squares. (⏸ I\'m going now is still free.)')) return;
      clearInterval(holdTimer); refuseQuest(); render();
    };
    w.querySelectorAll('[data-launch]').forEach(btn => btn.onclick = () => { clearInterval(holdTimer); startQuest(btn.dataset.launch); render(); });
    if (u) u.oninput = () => { touched = true; w.querySelector('#ppUV').textContent = u.value; };
    if (s) s.oninput = () => { w.querySelector('#ppSV').textContent = s.value; };
    const care = w.querySelector('#ppGoCare'); if (care) care.onclick = () => openCareInline();
    const may = w.querySelector('#ppGoMay'); if (may) may.onclick = () => { try { if (window.BSPathPlay && window.BSPathPlay.openMayChange) window.BSPathPlay.openMayChange('path_go'); else if (window.BSChange) window.BSChange.open({ ctx: 'path_go' }); } catch (e) {} };
    function armHold(end) {
      clearInterval(holdTimer);
      try {
        const held = load();
        if (held && held.pending) { held.pending.holdEndsAt = end; save(held); syncClipHold(held); }
      } catch (e) {}
      holdTimer = setInterval(() => {
        const bb = load(); if (!bb || !bb.pending) { clearInterval(holdTimer); return; }
        const left = Math.max(0, end - Date.now()), el = document.getElementById('ppHoldT');
        if (el && !fog) el.textContent = left ? (Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0')) : '⏰ Time! Go now.';
        if (!left) {
          clearInterval(holdTimer);
          syncClipHold(load());
          // Unlock resolve emphasis — rolls stay locked until resolve, but timer done
          try {
            const gl = document.querySelector('#ppGlance .pp-gl-row:nth-child(4) .pp-gl-v');
            if (gl) gl.textContent = 'Timer done — resolve below';
          } catch (e) {}
        }
      }, 500);
    }
    const hg = w.querySelector('#ppHoldGo');
    if (hg) hg.onclick = () => {
      const end = Date.now() + mins * 60000;
      const bb = load(); if (bb && bb.pending) { bb.pending.holdEndsAt = end; save(bb); }
      hg.disabled = true; hg.remove();
      armHold(end);
    };
    if (p.holdEndsAt && left0 > 0) armHold(p.holdEndsAt);
    else if (p.holdEndsAt && left0 <= 0) {
      const el = w.querySelector('#ppHoldT'); if (el && !fog) el.textContent = '⏰ Time! Go now.';
    }
    w.querySelectorAll('[data-out]').forEach(btn => btn.onclick = () => {
      if (!touched && btn.dataset.out !== 'real') { touched = true; w.querySelector('#ppUV').textContent = '?'; if (typeof toast === 'function') toast('Slide to your urgency first (0 is fine)'); return; }
      // If hold timer still running and not real-urge, allow accident/can't-hold; for "ok" require timer done or no hold
      if (btn.dataset.out === 'ok' && mins && p.holdEndsAt && holdLeftMs(p) > 0) {
        if (typeof toast === 'function') toast('Timer still running — wait, or log can\'t hold / accident');
        return;
      }
      clearInterval(holdTimer); try { if (window.BSClipBridge && window.BSClipBridge.clearPathHold) window.BSClipBridge.clearPathHold(); } catch (e) {}
      const bb = load(); const dd = w.querySelector('#ppDare');
      const urgVal = u ? +u.value : (lockU != null ? lockU : undefined);
      const r = resolve(bb, btn.dataset.out, { urgency: urgVal, sat: s ? +s.value : undefined, dareDone: !!(dd && dd.checked) });
      if (p.feature === 'checkin_app' && u) { try { if (typeof manualPressure !== 'undefined') { manualPressure = +u.value * 10; if (s) manualSaturation = +s.value; if (typeof updateUI === 'function') updateUI(); if (typeof confirmStatus === 'function') confirmStatus(); } } catch (e) {} if (btn.dataset.out === 'ok') { bb.stars += 1; r.notes.push('📋 Status check-in synced to the app: +1 ⭐.'); } }
      bb.quest = null;
      if (bb.pendingClass) { bb.classId = bb.pendingClass; bb.pendingClass = null; }
      save(r.board); lastNotes = lastNotes.slice(0, 1).concat(r.notes); render();
    });
  }
  function openSettings() {
    const b = load(); const fl = window.BSQuizPlus ? window.BSQuizPlus.load().flags : {};
    const w = sheet(`<h3>⚙ Potty Path</h3>
      <label class="fld"><span>Switch class (applies after the current go; leaving Baby is always free)</span><select id="ppSw">${CLASSES.map(c => `<option value="${c.id}" ${c.id === b.classId ? 'selected' : ''} ${classAllowed(c.id) ? '' : 'disabled'}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="qp-flag"><input type="checkbox" id="ppShake" ${b.shake ? 'checked' : ''}> Shake to roll</label><label class="qp-flag"><input type="checkbox" id="ppAnim" ${b.anim ? 'checked' : ''}> Animate token</label>
      <label class="qp-flag"><input type="checkbox" id="ppHid" ${b.hidden ? 'checked' : ''}> Hidden timers</label><label class="qp-flag"><input type="checkbox" id="ppTummy" ${b.flags.tummy ? 'checked' : ''}> 🌀 Tummy trouble</label>
      <div class="quiz-q">Symptoms (switch off any time)</div>
      ${Object.keys(window.BSQuizPlus ? window.BSQuizPlus.SYMS : {}).map(k => `<label class="qp-flag"><input type="checkbox" data-sym="${k}" ${fl[k] ? 'checked' : ''}> ${esc(window.BSQuizPlus.SYMS[k])}</label>`).join('')}
      <details class="sess-more"><summary>📚 Classes</summary>${classTable()}</details>
      <div class="quiz-nav"><button type="button" id="ppSave" class="pp-ok">✓ Save</button><button type="button" id="ppTestNow" style="background:#fdcb6e;color:#000;font-weight:bold;">🧪 Test pass</button><button type="button" id="ppExportLog">📄 Export log</button><button type="button" id="ppNew">↺ New board</button><button type="button" id="ppX">Close</button></div>`);
    w.querySelector('#ppSave').onclick = () => { const id = w.querySelector('#ppSw').value; if (id !== b.classId) setClass(id); const b2 = load(); b2.shake = w.querySelector('#ppShake').checked; b2.anim = w.querySelector('#ppAnim').checked; b2.hidden = w.querySelector('#ppHid').checked; b2.flags.tummy = w.querySelector('#ppTummy').checked; save(b2); w.querySelectorAll('[data-sym]').forEach(c => window.BSQuizPlus.setFlag(c.dataset.sym, c.checked)); w.remove(); render(); };
    w.querySelector('#ppTestNow').onclick = () => { const bb = load(); const r = runTestPass({ mode: bb.mode, classId: bb.classId, seed: Date.now() & 0xffff }); w.remove(); if (typeof toast === 'function') toast('Test pass: ' + r.testSteps + ' goes'); render(); };
    w.querySelector('#ppExportLog').onclick = exportLog;
    w.querySelector('#ppNew').onclick = () => { if (confirm('Start a new Potty Path board?')) { save(null); w.remove(); lastNotes = []; render(); } };
    w.querySelector('#ppX').onclick = () => w.remove();
  }
  let lastShake = 0;
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return; const g = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    if (g > 22 && Date.now() - lastShake > 1500 && typeof currentTab === 'function' && currentTab() === 'path') { const b = load(); if (b && b.shake && !b.pending) { lastShake = Date.now(); doGo('pee'); } }
  });
  function stashNowExport() { return stashNow(); }
  window.BSPath = { KEY, N, SQ, HOLD_MAX, STAGES, CLASSES, CLASS_BY_ID, MASTERY, classAllowed, suggestClass, stageOf, stageStart, stageEnd, genSquares, newBoard, rule, rollDice, moveFor, needToGo, resolve, finishQuest, startQuest, refuseQuest, pottyAccess, LOW_RULES, impliedLaunches, holdMinutes, classHoldScale, observe, recalibrate, logMastery, simulate, sweep, formatLogText, runTestPass, setClass, optsFromQuizzes, coords, load, save, render, renderBoardOnly: render, classTable, stashNow: stashNowExport, logUrge, logLeak, clearUrgeLock, glanceHtml, hydrationGlance, wearHint, themeId, themeWords, applyThemeClass, holdLeftMs, timerLocksRolls, syncClipHold };
  // path-play.js takes window.renderPath when present; keep board render available
  if (!window.BSPathPlay) window.renderPath = render;
})();
