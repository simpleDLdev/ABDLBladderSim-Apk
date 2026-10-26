/* ===========================
   urge-matrix.js — v19 single source of truth for Natural Urge outcomes + the one rank ladder.
   BSRanks  : 6 ranks; maps Control ladder ↔ Babysitter/Quick tier ↔ session profile ↔ Path stage/classes ↔ Campaign rank.
   BSUrgeMatrix: urgency band × rank → % { gear (accident), dribble, hard (hold-guide), go (potty), wait }.
     Calibrated to the Quick Session hold chances (fully 78 / mostly 55 / somewhat 35 / mostly-inc 18 / fully-inc 8):
     at urgency 5–6, go + wait + hold ≈ that tier's hold chance; higher bands follow the quick-session pressure
     penalties (−10 / −20) and are then tightened for realism (Early Trainer 9–10 potty 3 %, Toddler / Infant 0 %).
     Properties (tested): rows sum to 100; accident ↑ with urgency and down the ranks; potty ↓ down the ranks;
     wait ↓ with urgency; dribble ≤ 15 %.
   BSVoice  : voice packs (caregiver / babysitter / coach) for Urge results.
   Content  : each outcome draws its text + step guide from the matching session profile's micro/macro tables.
   =========================== */
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  // ---------- one ladder ----------
  const RANKS = [
    { key: 'full', n: 6, name: '🎓 Big Kid', ctl: [92, 100], tier: 'fully_continent', quick: 'fully_continent', session: 'train_pro', sessionName: 'Retaining Control', stage: 3, classes: ['bigkid', 'scout'], camp: ['big_kid'] },
    { key: 'good', n: 5, name: '🧒 Little Kid', ctl: [80, 91], tier: 'fully_continent', quick: 'fully_continent', session: 'train_pro', sessionName: 'Retaining Control', stage: 3, classes: ['scout', 'shy'], camp: ['trainee'] },
    { key: 'okay', n: 4, name: '🌟 Advanced Trainer', ctl: [60, 79], tier: 'mostly_continent', quick: 'mostly_continent', session: 'train_rookie', sessionName: 'Struggle to Control', stage: 2, classes: ['shy', 'padgirl'], camp: ['sprout'] },
    { key: 'shaky', n: 3, name: '🚼 Early Trainer', ctl: [40, 59], tier: 'somewhat_incontinent', quick: 'somewhat_incontinent', session: 'train_rookie', sessionName: 'Struggle to Control → NPT', stage: 1, classes: ['pullup', 'padgirl'], camp: ['nightie'] },
    { key: 'little', n: 2, name: '🧸 Toddler', ctl: [20, 39], tier: 'mostly_incontinent', quick: 'mostly_incontinent', session: 'npt', sessionName: 'Not Potty Trained', stage: 0, classes: ['little', 'cascade'], camp: ['padded'] },
    { key: 'none', n: 1, name: '🍼 Infant', ctl: [0, 19], tier: 'fully_incontinent', quick: 'fully_incontinent', session: 'dependent', sessionName: 'Constant Incontinence', stage: 0, classes: ['baby'], camp: ['thick', 'legend'] }
  ];
  const BY = RANKS.reduce((a, r) => (a[r.key] = r, a), {});
  const CAMP_IDS = ['big_kid', 'trainee', 'sprout', 'nightie', 'padded', 'thick', 'legend'];
  const rankOfEst = v => { v = Math.max(0, Math.min(100, +v || 0)); return RANKS.find(r => v >= r.ctl[0] && v <= r.ctl[1]) || BY.okay; };
  const rankOfCampaign = i => RANKS.find(r => r.camp.includes(CAMP_IDS[Math.max(0, Math.min(6, i | 0))])) || BY.okay;
  const campaignOfRank = key => CAMP_IDS.indexOf(BY[key].camp[0]);
  const rankOfTier = t => RANKS.find(r => r.tier === t) || BY.okay;
  const mid = key => Math.round((BY[key].ctl[0] + BY[key].ctl[1]) / 2);
  W.BSRanks = { RANKS, BY, CAMP_IDS, rankOfEst, rankOfCampaign, campaignOfRank, rankOfTier, mid };

  // ---------- urgency × rank matrix ----------
  const BANDS = [{ id: '0-4', lo: 0, hi: 4 }, { id: '5-6', lo: 5, hi: 6 }, { id: '7-8', lo: 7, hi: 8 }, { id: '9-10', lo: 9, hi: 10 }];
  //            gear(accident) dribble hard(hold-guide) go(potty) wait
  const MATRIX = {
    full:   [[1, 3, 6, 45, 45], [4, 8, 13, 55, 20], [8, 10, 17, 58, 7], [14, 12, 12, 60, 2]],
    good:   [[3, 6, 8, 38, 45], [12, 12, 16, 45, 15], [22, 13, 15, 45, 5], [35, 13, 10, 40, 2]],
    okay:   [[8, 10, 12, 30, 40], [30, 14, 16, 30, 10], [45, 12, 13, 27, 3], [62, 10, 8, 20, 0]],
    shaky:  [[20, 12, 13, 20, 35], [52, 12, 10, 18, 8], [72, 10, 6, 10, 2], [90, 7, 0, 3, 0]],
    little: [[55, 12, 8, 7, 18], [75, 10, 5, 4, 6], [88, 8, 2, 1, 1], [95, 5, 0, 0, 0]],
    none:   [[75, 15, 10, 0, 0], [85, 12, 3, 0, 0], [93, 7, 0, 0, 0], [97, 3, 0, 0, 0]]
  };
  const COLS = ['gear', 'dribble', 'hard', 'go', 'wait'];
  const QUICK_HOLD = { fully_continent: 78, mostly_continent: 55, somewhat_incontinent: 35, mostly_incontinent: 18, fully_incontinent: 8 };
  const bandIdx = u => u == null || u === '' || isNaN(+u) ? 1 : (+u <= 4 ? 0 : +u <= 6 ? 1 : +u <= 8 ? 2 : 3);
  function cell(level, u) { const row = MATRIX[level] || MATRIX.okay; const c = row[bandIdx(u)]; return COLS.reduce((o, k, i) => (o[k] = c[i], o), {}); }
  function shape(odds, level, u) {
    const base = cell(level, 5), now = cell(level, u), o = {};
    COLS.forEach(k => { const r = base[k] ? now[k] / base[k] : (now[k] ? 1 : 0); o[k] = Math.max(0, (odds[k] || 0) * r); });
    return o;
  }
  function finalRoll(w, level) { const o = Object.assign({}, w); o.wait = 0; o.hard = 0; if (level === 'none' || level === 'little') o.go = 0; return o; }

  // ---------- content: session profile tables per rank ----------
  const REG = W.__BS_TABLES__ || (W.__BS_TABLES__ = {});
  const tbl = name => {
    if (REG[name]) return REG[name];
    try { if (W[name]) return (REG[name] = W[name]); } catch (e) {}
    try { return (REG[name] = eval(name)); } catch (e) {} // direct eval: sees global const in classic-script page
    return [];
  };
  /** Node / tests: BSUrgeMatrix.register({ MICRO_DIAPER_D8, ... }) */

  const SRC = {
    full:   { micro: ['MICRO_TRAINING_D8'], macro: ['FULL_TRAINING_FAILURES'], hold: ['OMORASHI_HOLDING_GUIDES'] },
    good:   { micro: ['MICRO_TRAINING_D8'], macro: ['FULL_TRAINING_FAILURES'], hold: ['OMORASHI_HOLDING_GUIDES'] },
    okay:   { micro: ['MICRO_TRAINING_D8'], macro: ['FULL_TRAINING_FAILURES', 'FULL_D20'], hold: ['OMORASHI_HOLDING_GUIDES'] },
    shaky:  { micro: ['MICRO_STD_D6', 'MICRO_TRAINING_D8'], macro: ['FULL_D20', 'FULL_TRAINING_FAILURES'], hold: ['OMORASHI_HOLDING_GUIDES'] },
    little: { micro: ['MICRO_DIAPER_D8'], macro: ['MACRO_NPT_MOSTLY_INCONTINENT_D20', 'FULL_D20'], hold: ['MICRO_DIAPER_D8'] },
    none:   { micro: ['MICRO_DEPENDENT_D20'], macro: ['MACRO_DEPENDENT_D20', 'MACRO_NPT_FULLY_INCONTINENT_D20'], hold: ['MICRO_DEPENDENT_D20'] }
  };
  const OUT_TBL = { gear: 'macro', dribble: 'micro', hard: 'hold' };
  const recent = [];
  function content(level, outcome, u, rng) {
    rng = rng || Math.random; const kind = OUT_TBL[outcome]; if (!kind) return null; const src = (SRC[level] || SRC.okay)[kind];
    let list = []; src.forEach(n => (tbl(n) || []).forEach((e, i) => { if (e && Array.isArray(e.guide) && e.guide.length) list.push({ e, n, i }); }));
    if (!list.length) return null;
    if (kind === 'macro' && list.length >= 6) { const b = bandIdx(u), L = list.length, third = Math.ceil(L / 3); const lo = b === 0 ? 0 : b === 3 ? L - third : third, hi = b === 0 ? third : b === 3 ? L : L - third; list = list.slice(lo, Math.max(lo + 1, hi)); }
    const fresh = list.filter(x => !recent.includes(x.n + ':' + x.i)); const pool = fresh.length ? fresh : list;
    const x = pool[Math.floor(rng() * pool.length)]; recent.push(x.n + ':' + x.i); if (recent.length > 6) recent.shift();
    return { label: x.e.label, flow: x.e.flow || x.e.desc || '', guide: x.e.guide.map(s => Object.assign({}, s)), source: x.n, kind: kind === 'macro' ? 'full' : kind === 'micro' ? 'micro' : 'hold' };
  }
  W.BSUrgeMatrix = { BANDS, MATRIX, COLS, QUICK_HOLD, bandIdx, cell, shape, finalRoll, content, SRC, MAX_CHAIN: 3, register: m => Object.assign(REG, m), _reg: REG };

  // ---------- voice packs ----------
  const VOICE = {
    caregiver: {
      go: ['Good job telling me! Off to the potty, sweetie.', 'Yes, you may — let’s go together.', 'Potty time! Quick quick, little one.', 'You asked so nicely. Go on, I’ll wait right here.'],
      wait: ['Not just yet, sweetie. Let’s wait a little bit.', 'Hold on for me a few minutes, okay?', 'We’ll go in a bit — you can do it.', 'Almost time. Stay with me a little longer.'],
      hard: ['Let’s practise holding, nice and steady.', 'A little challenge for my big helper.', 'Hold it for me — I’ll count with you.'],
      dribble: ['Oh! Just a little drip. Let’s keep going.', 'A tiny slip — that’s alright, sweetheart.', 'Feel that? A little came out. Tell me next time.'],
      gear: ['Oopsie — that’s what your padding is for.', 'There we go. Let it all out, then we’ll change.', 'No more holding, little one. Into your diaper.'],
      again: ['How are we feeling now?', 'Still need to go? Tell me how urgent it is.', 'Ready to try again?']
    },
    babysitter: {
      go: ['Alright, you can go. Don’t linger.', 'Fine — potty. Be quick.', 'Permission granted. Make it count.'],
      wait: ['Not yet. Sit still a few more minutes.', 'Babysitter says wait.', 'Hold it. I’ll decide when.', 'Patience. Almost.'],
      hard: ['Babysitter’s challenge: hold until I say.', 'Let’s see how long you last.', 'No potty yet — hold.'],
      dribble: ['Caught you leaking. Noted.', 'A drip already? Hmm.', 'That little leak is going in the log.'],
      gear: ['Too late. Use your padding.', 'You didn’t make it. Let it finish.', 'Accident. We’ll change when I say so.'],
      again: ['Still needing? Tell me the number.', 'How bad is it now?', 'Report. Urgency?']
    },
    coach: {
      go: ['Clear to go. Head to the potty.', 'You’re cleared. Make the trip.', 'Permission: go now.'],
      wait: ['Hold for the timer, then reassess.', 'Wait window active. Stay put.', 'Delay in effect. Re-check after.'],
      hard: ['Hold challenge. Follow the steps.', 'Endurance check — stay with it.', 'Hold protocol.'],
      dribble: ['Minor release logged. Continue.', 'Small leak recorded.', 'Partial release — keep monitoring.'],
      gear: ['Control lost. Use protection.', 'Void into gear. Then report.', 'Full release into padding.'],
      again: ['Reassess urgency.', 'Status check.', 'Ready for the next roll?']
    }
  };
  function getVoice() {
    try { if (W.officeOn && W.officeOn()) return 'coach'; } catch (e) {}
    try { if (W.BSReport && W.BSReport.getVoice) return W.BSReport.getVoice(); } catch (e) {}
    return 'caregiver';
  }
  function line(outcome, voice, rng) {
    rng = rng || Math.random; const pack = VOICE[voice || getVoice()] || VOICE.caregiver; const list = pack[outcome] || pack.gear || [];
    return list[Math.floor(rng() * list.length)] || '';
  }
  W.BSVoice = { VOICE, getVoice, line };
})();
