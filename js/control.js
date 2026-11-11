/* ===========================
   control.js — v44 Control meter. Single source for day and night (0-100 each).
   bs_control_v1 v2: tracks.day and tracks.night. The top-level value/direction/cap/history
   mirror the day track so older callers keep working. A v1 save is migrated in place;
   the previous object is kept on `legacy` (read-only).
   New saves default countWaitAccidents to off. A stored true/false is kept.
   Real accidents move a track only when that track's real-progress switch is on
   (or the legacy checkbox is on). failed_wait is direction-aware: it no longer
   counts as progress toward less control unless the player opted in.
   Game mode applies one delta to both tracks so the old single meter stays one meter.
   Conditioning mode writes the track the event belongs to.
   =========================== */
(function () {
  const KEY = 'bs_control_v1';
  // Ladder: key, label, band [lo,hi], Simple Urge odds go/wait/hard/dribble/gear, wait range, hidden wait default,
  // Natural Night "may get up" %, #2 permission %.
  // v12 ABDL ladder (keys kept for saved data / campaign compat). split = how an in-game "use your gear" outcome
  // resolves: [mostly dry (small dribble only), small accident, major accident] in %. change = "May I change?" rules
  // (threshold = saturation the USER reports; never inferred). gear = recommended in-game day/night protection.
  const LADDER = [
    { key: 'full', label: '🎓 Big Kid / Grown-up', office: 'Tier 6', band: [92, 100], odds: [60, 30, 8, 1, 1], wait: [30, 60], hidden: false, allow: 90, perm: 100, li: 0,
      split: [70, 25, 5], change: { threshold: 0, notYet: [5, 10], w: { yes: 90, later: 10, after: 0 } }, gear: { day: 'none', night: 'none' },
      flavor: 'You are fully potty trained, big one. Your body sends nice clear signals long before it gets serious, and getting to the potty is just part of your day. Accidents are a genuine rarity — the kind of thing that only happens on a really silly day.' },
    { key: 'good', label: '🧒 Little Kid', office: 'Tier 5', band: [80, 91], odds: [45, 30, 15, 5, 5], wait: [20, 45], hidden: false, allow: 80, perm: 100, li: 0,
      split: [60, 30, 10], change: { threshold: 25, notYet: [10, 20], w: { yes: 70, later: 25, after: 5 } }, gear: { day: 'none', night: 'pad' },
      flavor: 'You are mostly trained, little one — such a proud step! You usually know well ahead of time and you make it nearly every time. Once in a while you get busy playing, leave it a bit too late, and need a quick change, but it is rare and nobody minds.' },
    { key: 'okay', label: '🌟 Advanced Trainer', office: 'Tier 4', band: [60, 79], odds: [35, 30, 15, 10, 10], wait: [10, 30], hidden: false, allow: 65, perm: 85, li: 1,
      split: [45, 40, 15], change: { threshold: 40, notYet: [15, 30], w: { yes: 55, later: 35, after: 10 } }, gear: { day: 'pullups', night: 'pullups' },
      flavor: 'You are an advanced trainer: you usually feel it coming and can get yourself there with a bit of a wiggle-walk. Pull-ups are still your safety net, because sometimes the warning is shorter than you hoped. Every dry trip is a little gold star.' },
    { key: 'shaky', label: '🚼 Early Trainer', office: 'Tier 3', band: [40, 59], odds: [25, 25, 15, 15, 20], wait: [5, 15], hidden: false, allow: 50, perm: 50, li: 2,
      split: [30, 45, 25], change: { threshold: 50, notYet: [20, 40], w: { yes: 40, later: 40, after: 20 } }, gear: { day: 'pullups', night: 'diapers' },
      flavor: 'You are an early trainer, sweetie. Sometimes you get enough warning and sometimes you just don\'t — it is hard work and your body is still learning. Lots of potty trips end in a happy "made it!", but plenty of others end in your pull-up, and that is all part of learning.' },
    { key: 'little', label: '🧸 Toddler', office: 'Tier 2', band: [20, 39], odds: [12, 15, 8, 25, 40], wait: [2, 8], hidden: true, allow: 36, perm: 15, li: 3,
      split: [20, 40, 40], change: { threshold: 60, notYet: [20, 45], w: { yes: 30, later: 40, after: 30 } }, gear: { day: 'diapers', night: 'thick_diapers' },
      flavor: 'You are a toddler, little one — still diaper dependent, though you can often tell afterwards that you went. Every now and then you notice in time and get a potty try, which is a big deal! Most of the time your diaper does the work, and grown-ups decide when it is change time.' },
    { key: 'none', label: '🍼 Infant', office: 'Tier 1', band: [0, 19], odds: [4, 6, 2, 28, 60], wait: [1, 4], hidden: true, allow: 22, perm: 0, li: 4,
      split: [10, 35, 55], change: { threshold: 75, notYet: [30, 60], w: { yes: 20, later: 40, after: 40 } }, gear: { day: 'thick_diapers', night: 'thick_diapers' },
      flavor: 'You are an infant, baby — totally diaper dependent. You can\'t really tell when you go; it just happens, and your diaper is there to catch it. Potty trips are almost never on the cards, and changes happen on the babysitter\'s schedule, once your diaper is good and used.' }
  ];
  // "Not participating": Simple Urge always says go, no level rules. Not part of the band ladder.
  const OFF = { key: 'off', label: '🚫 Sitting out', office: 'Off', band: [-1, -1], odds: [1, 0, 0, 0, 0], wait: [1, 1], hidden: false, allow: 100, perm: 100, li: 0,
    split: [100, 0, 0], change: { threshold: 0, notYet: [5, 5], w: { yes: 100, later: 0, after: 0 } }, gear: { day: 'none', night: 'none' }, off: true,
    flavor: 'Natural Urge control is switched off. Every press simply says "go now"; nothing is rolled and nothing counts toward your level.' };
  const CHAIN_LEAN = 0.06; // must match simple-urge.js roll(): each chained re-roll adds 6% of the total weight to "go" (max 4)
  const PROTL = { none: 'regular underwear', pad: 'a pad', pullups: 'pull-ups', diapers: 'diapers', thick_diapers: 'thick diapers' };
  /** Pure: expected behaviour for a level at unset urgency, from the SAME numbers roll() uses. */
  function stats(key, oddsOverride) {
    const l = level(key); if (!l) return null;
    const o = oddsOverride ? OUT.map(k => +oddsOverride[k] || 0) : l.odds.slice();
    const t0 = o.reduce((a, b) => a + b, 0) || 1;
    let pPotty = 0, pGear = 0, reach = 1;
    for (let c = 0; c <= 4; c++) {
      const go = o[0] + Math.min(4, c) * CHAIN_LEAN * t0, T = t0 - o[0] + go;
      const pg = go / T, pa = o[4] / T, pc = 1 - pg - pa;
      if (c < 4) { pPotty += reach * pg; pGear += reach * pa; reach *= pc; }
      else { const d = pg + pa || 1; pPotty += reach * pg / d; pGear += reach * pa / d; }
    }
    const r = x => Math.round(x * 100);
    const potty = r(pPotty), gear = 100 - potty;
    const dry = Math.round(gear * l.split[0] / 100), small = Math.round(gear * l.split[1] / 100), major = gear - dry - small;
    return { key, potty, mostlyDry: dry, small, major, holdPrompts: r((o[1] + o[2] + o[3]) / t0), firstGo: r(o[0] / t0), warning: Math.round((l.wait[0] + l.wait[1]) / 2), wait: l.wait.slice(),
      hidden: l.hidden, changeAt: l.change.threshold, changeYes: l.change.w.yes, day: l.gear.day, night: l.gear.night };
  }
  /** In-depth description generated from stats() — numbers always match the code. */
  function describe(key, office) {
    const l = level(key); if (!l) return ''; const s = stats(key);
    if (l.off) return office ? 'Off: every check says go now.' : l.flavor;
    if (office) return `${l.office}: about ${s.potty}% on time; check prompts ${s.holdPrompts}% of the time; typical interval ${s.wait[0]}–${s.wait[1]} min.`;
    const warn = s.warning <= 4 ? `Warning time is tiny — about ${s.wait[0]}–${s.wait[1]} minutes when it comes at all${l.hidden ? ', and waits are hidden' : ''}.` : `You typically get around ${s.warning} minutes of warning (waits of ${s.wait[0]}–${s.wait[1]} min${l.hidden ? ', hidden' : ''}).`;
    return `${l.flavor} ${warn} When you press "I need to go", ${s.holdPrompts}% of first answers ask you to wait or hold, and ${s.firstGo}% say go straight away. ` +
      `Over a whole potty attempt you make it to the potty ${s.potty}% of the time; ${s.mostlyDry}% end mostly dry with just a small dribble, ${s.small}% are a small accident and ${s.major}% a major one. ` +
      `${s.changeAt ? `Change time usually comes once you report your gear at about ${s.changeAt}% saturation` : 'You may change whenever you like'} ("May I change?" says yes ${s.changeYes}% of the time${s.changeAt ? ' past that point' : ''}). ` +
      `Recommended gear: ${PROTL[s.day]} in the day, ${PROTL[s.night]} at night.`;
  }
  function label(l, office) { l = typeof l === 'string' ? level(l) : l; return l ? (office ? l.office : l.label) : ''; }
  const OUT = ['go', 'wait', 'hard', 'dribble', 'gear'];
  const LEVELS5 = ['fully_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent'];
  const ZONES = [
    { id: 'baby', name: 'Baby', hi: 0.2 }, { id: 'toddler', name: 'Toddler', hi: 0.45 },
    { id: 'preschool', name: 'Preschool', hi: 0.7 }, { id: 'bigkid', name: 'Big Kid', hi: 0.9 },
    { id: 'grownup', name: 'Grown-up', hi: 1.01 }
  ];
  // Drift table. [progress, regress]. 'hold' uses the progress column halved.
  // failed_wait is special-cased in event(): real events only count when opted in.
  const DRIFT = {
    go: [1, 0.3], alert_made: [1.5, 0.5], gear: [-0.5, -1], dry_morning: [2, 0.5], wet_morning: [-1, -3],
    goal_pass: [3, -3], promoted: [3, -3], failed_wait: [-2, -2], real_override: [0, 0]
  };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const dk = ts => { const d = new Date(ts || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const clamp = v => Math.max(0, Math.min(100, Math.round((+v || 0) * 10) / 10));
  const capOf = v => Math.max(4, Math.min(12, +v || 8));
  function quizBaseline() {
    try { const q = window.BSQuiz && window.BSQuiz.load(); if (q && q.baseline && q.baseline.control != null) return Math.round(q.baseline.control); } catch (e) {}
    return null;
  }
  function quizNightValue(dayValue) {
    try {
      const q = window.BSQuiz && window.BSQuiz.load(); if (!q || !q.a) return null;
      const n = +(q.a.nights || 0), w = +(q.a.nightWake || 0);
      const base = q.baseline && q.baseline.control != null ? q.baseline.control : dayValue;
      return Math.max(0, Math.min(100, Math.round(base - n * 12 - w * 6)));
    } catch (e) { return null; }
  }
  function campaignMid() {
    try {
      const c = window.BSCampaign && window.BSCampaign.load && window.BSCampaign.load();
      if (c && c.active && c.rank != null && window.BSRanks) return window.BSRanks.mid(window.BSRanks.rankOfCampaign(c.rank).key);
    } catch (e) {}
    return null;
  }
  function seedValue() {
    const q = quizBaseline(); if (q != null) return q;
    const c = campaignMid(); if (c != null) return c;
    return 60;
  }
  function directionOf(tr) {
    const gap = (+tr.target) - (+tr.estimate);
    if (Math.abs(gap) <= 5) return 'hold';
    return gap > 0 ? 'progress' : 'regress';
  }
  function applyDirection(tr, dir) {
    const v = +tr.value || 0;
    if (dir === 'regress') tr.target = Math.max(0, Math.round(v - 20));
    else if (dir === 'hold') tr.target = Math.round(v);
    else tr.target = Math.min(100, Math.round(v + 20));
  }
  function blankTrack(value, cap) {
    const v = clamp(value);
    return {
      value: v, target: Math.min(100, Math.round(v + 20)), estimate: v, confidence: 0.3, sim: v,
      pace: 'steady', cap: capOf(cap), dayDelta: 0, lastDay: dk(), difficulty: 2, phase: 'active',
      gear: { home: 'G0', pos: 'G0', stage: 1, recommended: null }, history: []
    };
  }
  function fillTrack(tr, value, cap) {
    const b = blankTrack(value, cap);
    tr = tr || {};
    const gear = Object.assign(b.gear, tr.gear || {});
    const out = Object.assign(b, tr, { gear: gear, history: Array.isArray(tr.history) ? tr.history : [] });
    out.value = clamp(out.value); out.target = clamp(out.target); out.estimate = clamp(out.estimate); out.sim = clamp(out.sim);
    out.cap = capOf(out.cap); out.confidence = Math.max(0, Math.min(1, +out.confidence || 0));
    if (!['gentle', 'steady', 'fast'].includes(out.pace)) out.pace = 'steady';
    if (!['active', 'maintain', 'frozen'].includes(out.phase)) out.phase = 'active';
    return out;
  }
  function mirror(s) {
    const d = s.tracks.day;
    s.value = d.value; s.direction = directionOf(d); s.cap = d.cap; s.dayDelta = d.dayDelta; s.lastDay = d.lastDay; s.history = d.history;
    return s;
  }
  function fresh() {
    const v = seedValue();
    const qn = quizNightValue(v);
    const night = qn != null ? Math.min(v, qn) : v;
    const s = { v: 2, mode: 'game', tracks: { day: blankTrack(v), night: blankTrack(night) }, countWaitAccidents: false, legacy: null, sleepWindow: { out: '23:00', rise: '07:00' } };
    return mirror(s);
  }
  function migrateV1(raw) {
    const value = clamp(raw.value != null ? raw.value : seedValue());
    const qn = quizNightValue(value);
    const nightV = qn != null ? Math.min(value, qn) : value;
    const cap = capOf(raw.cap);
    const day = fillTrack({ value: value, dayDelta: +raw.dayDelta || 0, lastDay: raw.lastDay || dk(), history: Array.isArray(raw.history) ? raw.history.slice() : [], cap: cap }, value, cap);
    const night = fillTrack({ value: nightV, lastDay: day.lastDay, cap: cap }, nightV, cap);
    const dir = raw.direction || 'progress';
    applyDirection(day, dir); applyDirection(night, dir);
    const hadFlag = Object.prototype.hasOwnProperty.call(raw, 'countWaitAccidents');
    const s = {
      v: 2, mode: 'game', tracks: { day: day, night: night },
      countWaitAccidents: hadFlag ? !!raw.countWaitAccidents : false,
      sleepWindow: { out: '23:00', rise: '07:00' },
      legacy: { value: raw.value, direction: raw.direction, cap: raw.cap, dayDelta: raw.dayDelta, lastDay: raw.lastDay, countWaitAccidents: raw.countWaitAccidents, history: Array.isArray(raw.history) ? raw.history.slice() : [] }
    };
    return mirror(s);
  }
  function normalize(raw) {
    const s = raw || fresh();
    s.v = 2;
    s.mode = s.mode === 'conditioning' ? 'conditioning' : 'game';
    s.tracks = s.tracks || {};
    const dayV = s.tracks.day && s.tracks.day.value != null ? s.tracks.day.value : (s.value != null ? s.value : 60);
    s.tracks.day = fillTrack(s.tracks.day, dayV, s.cap);
    const nightV = s.tracks.night && s.tracks.night.value != null ? s.tracks.night.value : dayV;
    s.tracks.night = fillTrack(s.tracks.night, nightV, s.tracks.day.cap);
    s.countWaitAccidents = !!s.countWaitAccidents;
    s.sleepWindow = s.sleepWindow || { out: '23:00', rise: '07:00' };
    return mirror(s);
  }
  function load() {
    const raw = J(KEY, null);
    if (!raw) return fresh();
    if (raw.v >= 2 && raw.tracks && raw.tracks.day && raw.tracks.night) return normalize(raw);
    const s = migrateV1(raw); save(s); return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function settings() { return load(); }
  function saveSettings(p) {
    p = p || {}; const s = load();
    if (p.countWaitAccidents !== undefined) s.countWaitAccidents = !!p.countWaitAccidents;
    if (p.mode === 'game' || p.mode === 'conditioning') s.mode = p.mode;
    if (p.sleepWindow) s.sleepWindow = Object.assign(s.sleepWindow || {}, p.sleepWindow);
    const names = p.track ? [p.track] : ['day', 'night'];
    if (p.value !== undefined && !p.track) {
      const prev = s.tracks.day.value;
      const dir = directionOf(s.tracks.day);
      const nightLinked = Math.abs(s.tracks.night.value - prev) < 0.11;
      s.tracks.day.value = clamp(p.value);
      if (s.tracks.day.estimate === prev) s.tracks.day.estimate = s.tracks.day.value;
      if (s.tracks.day.sim === prev) s.tracks.day.sim = s.tracks.day.value;
      if (!p.target && !p.direction) applyDirection(s.tracks.day, dir);
      if (s.mode !== 'conditioning' && nightLinked) {
        const nd = directionOf(s.tracks.night);
        s.tracks.night.value = s.tracks.day.value;
        if (s.tracks.night.estimate === prev) s.tracks.night.estimate = s.tracks.night.value;
        if (s.tracks.night.sim === prev) s.tracks.night.sim = s.tracks.night.value;
        if (!p.target && !p.direction) applyDirection(s.tracks.night, nd);
      }
    }
    names.forEach(n => {
      const tr = s.tracks[n]; if (!tr) return;
      if (p.track && p.value !== undefined) {
        const prev = tr.value; tr.value = clamp(p.value);
        if (tr.estimate === prev) tr.estimate = tr.value;
      }
      if (p.cap !== undefined) tr.cap = capOf(p.cap);
      if (p.target !== undefined) tr.target = clamp(p.target);
      if (p.estimate !== undefined) tr.estimate = clamp(p.estimate);
      if (p.pace) tr.pace = p.pace;
      if (p.phase) tr.phase = p.phase;
      if (p.direction && (s.mode !== 'conditioning' || p.track)) applyDirection(tr, p.direction);
    });
    if (p.direction && s.mode === 'conditioning' && !p.track) applyDirection(s.tracks.day, p.direction);
    mirror(s); save(s); return s;
  }
  function setTrack(name, patch) {
    const s = load(); const tr = s.tracks[name]; if (!tr || !patch) return s;
    ['value', 'target', 'estimate', 'confidence', 'sim', 'pace', 'difficulty', 'phase'].forEach(k => { if (patch[k] !== undefined) tr[k] = patch[k]; });
    if (patch.cap !== undefined) tr.cap = capOf(patch.cap);
    if (patch.gear) tr.gear = Object.assign(tr.gear || {}, patch.gear);
    tr.value = clamp(tr.value); tr.target = clamp(tr.target); tr.estimate = clamp(tr.estimate);
    mirror(s); save(s); return s;
  }
  function levelFor(v) { v = Math.max(0, Math.min(100, +v)); return LADDER.find(l => v >= l.band[0] && v <= l.band[1]) || LADDER[2]; }
  function trackState(name) { const s = load(); return s.tracks[name === 'night' ? 'night' : 'day']; }
  function band(track) { return levelFor(trackState(track || 'day').value).key; }
  function level(key) { return key === 'off' ? OFF : (LADDER.find(l => l.key === key) || null); }
  function continenceIndex(track) { const l = level(band(track)); return l && l.li != null ? l.li : 1; }
  function continenceLevel(track) { return LEVELS5[continenceIndex(track)] || LEVELS5[1]; }
  function controlFraction(track) { return Math.max(0, Math.min(1, trackState(track || 'day').value / 100)); }
  function trainingBand(track) {
    const tr = trackState(track || 'day');
    const cur = levelFor(tr.estimate);
    const i = LADDER.findIndex(l => l.key === cur.key);
    if (Math.abs(tr.target - tr.estimate) <= 5 || i < 0) return cur.key;
    const step = tr.target > tr.estimate ? -1 : 1;
    return (LADDER[i + step] || cur).key;
  }
  function rankIndex(track) {
    const v = trackState(track || 'day').value;
    try { if (window.BSRanks) return window.BSRanks.campaignOfRank(window.BSRanks.rankOfEst(v).key); } catch (e) {}
    return 3;
  }
  function zone(track) {
    const p = controlFraction(track);
    return ZONES.find(z => p < z.hi) || ZONES[ZONES.length - 1];
  }
  function parseHM(s, fallback) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
    if (!m) return fallback;
    return ((+m[1] % 24) * 60) + (+m[2] % 60);
  }
  function trackFor(ts, context) {
    if (context === 'bed' || context === 'night' || context === 'nap') return 'night';
    try { if (window.BSNaturalNight && window.BSNaturalNight.active && window.BSNaturalNight.active()) return 'night'; } catch (e) {}
    const d = new Date(ts || Date.now());
    const mins = d.getHours() * 60 + d.getMinutes();
    let win = { out: '23:00', rise: '07:00' };
    try { win = load().sleepWindow || win; } catch (e) {}
    const out = parseHM(win.out, 23 * 60), rise = parseHM(win.rise, 7 * 60);
    if (out === rise) return 'day';
    if (out < rise) { if (mins >= out && mins < rise) return 'night'; }
    else if (mins >= out || mins < rise) return 'night';
    return 'day';
  }
  function countsReal(track) {
    try { if (window.BSConsent && window.BSConsent.realProgress && window.BSConsent.realProgress(track || 'day')) return true; } catch (e) {}
    return !!load().countWaitAccidents;
  }
  /** Pure: apply a delta with the daily cap. A plain {value,cap,dayDelta,lastDay} still works. */
  function applyDelta(s, delta, now) {
    const tr = (s && s.tracks) ? (s._apply || s.tracks.day) : s;
    const day = dk(now || Date.now());
    if (tr.lastDay !== day) { tr.lastDay = day; tr.dayDelta = 0; }
    tr.cap = capOf(tr.cap);
    const room = delta >= 0 ? tr.cap - tr.dayDelta : -tr.cap - tr.dayDelta;
    let d = delta >= 0 ? Math.min(delta, Math.max(0, room)) : Math.max(delta, Math.min(0, room));
    const nv = Math.max(0, Math.min(100, (+tr.value || 0) + d)); d = nv - (+tr.value || 0);
    tr.value = Math.round(nv * 10) / 10; tr.dayDelta = Math.round((tr.dayDelta + d) * 10) / 10;
    if (s && s.tracks) mirror(s);
    return { state: s, applied: Math.round(d * 10) / 10 };
  }
  function pushHist(tr, row) { tr.history = tr.history || []; tr.history.push(row); if (tr.history.length > 200) tr.history.splice(0, tr.history.length - 200); }
  function deltaFor(kind, dir, table) {
    if (kind === 'failed_wait') return dir === 'hold' ? -1 : -2;
    const t = table || DRIFT[kind];
    if (!t) return 0;
    return dir === 'regress' ? t[1] : dir === 'hold' ? t[0] / 2 : t[0];
  }
  /** Record an outcome → drift on the right track. opts { now, direction, track, context, source } */
  function event(kind, opts) {
    opts = opts || {};
    if (!DRIFT[kind]) return 0;
    const s = load();
    const source = opts.source || (kind === 'failed_wait' ? 'real' : 'sim');
    const trackName = opts.track || trackFor(opts.now || Date.now(), opts.context);
    const names = s.mode === 'conditioning' ? [trackName === 'night' ? 'night' : 'day'] : ['day', 'night'];
    let applied = 0;
    names.forEach(name => {
      const tr = s.tracks[name];
      const dir = opts.direction || directionOf(tr);
      if (source === 'real' && kind !== 'real_override' && !countsReal(name)) return;
      if (tr.phase === 'frozen' && s.mode === 'conditioning') return;
      const delta = deltaFor(kind, dir);
      s._apply = tr;
      const r = applyDelta(s, delta, opts.now);
      delete s._apply;
      pushHist(tr, { ts: opts.now || Date.now(), kind: kind, d: r.applied, v: tr.value, track: name, source: source });
      if (name === 'day' || names.length === 1) applied = r.applied;
    });
    mirror(s); save(s);
    const detail = { kind: kind, applied: applied, value: s.value, track: trackName, source: source };
    try { window.dispatchEvent(new CustomEvent('bs:control', { detail: detail })); } catch (e) {}
    if (!opts._fromBus) { try { window.dispatchEvent(new CustomEvent('bs:outcome', { detail: Object.assign({ _fromControl: true }, detail) })); } catch (e) {} }
    return applied;
  }
  function reverseTrack(name) {
    const s = load(); const tr = s.tracks[name === 'night' ? 'night' : 'day']; if (!tr) return s;
    const keys = LADDER.map(l => l.key);
    const i = Math.max(0, keys.indexOf(levelFor(tr.target).key));
    const m = LADDER[keys.length - 1 - i];
    tr.target = Math.round((m.band[0] + m.band[1]) / 2);
    tr.phase = 'active';
    s.mode = 'conditioning';
    mirror(s); save(s);
    try { if (window.BSPasses && window.BSPasses.resetDebt) window.BSPasses.resetDebt(name); } catch (e) {}
    return s;
  }
  function stopConditioning() {
    const s = load();
    s.mode = 'game';
    ['day', 'night'].forEach(n => { const tr = s.tracks[n]; tr.phase = 'active'; tr.target = tr.value; });
    mirror(s); save(s);
    try { if (window.BSPasses && window.BSPasses.resetDebt) window.BSPasses.resetDebt(); } catch (e) {}
    return s;
  }
  function chip() {
    const s = load(); const off = !!(window.BSOffice && window.BSOffice.on());
    const row = (name, glyph) => {
      const tr = s.tracks[name], l = levelFor(tr.value);
      const arrow = directionOf(tr) === 'regress' ? '↓' : directionOf(tr) === 'hold' ? '=' : '↑';
      return `<div style="display:flex;align-items:center;gap:8px;"><span>${glyph} ${name === 'day' ? 'Day' : 'Night'}</span><span style="flex:1;height:8px;background:#2d3436;border-radius:5px;overflow:hidden;"><span style="display:block;height:100%;width:${tr.value}%;background:${name === 'day' ? '#55efc4' : '#a29bfe'};"></span></span><b>${Math.round(tr.value)}</b><span style="color:#8ea0b6">→ ${Math.round(tr.target)}</span><span>${label(l, off)}</span><span style="color:#8ea0b6">${arrow} ${tr.dayDelta > 0 ? '+' : ''}${tr.dayDelta}/${tr.cap}</span></div>`;
    };
    return `<div id="ctlChip" class="urge-note">${row('day', '☀')}${row('night', '🌙')}</div>`;
  }
  try {
    window.addEventListener('bs:outcome', ev => {
      const d = ev && ev.detail; if (!d || d._fromControl || !d.kind || !DRIFT[d.kind]) return;
      event(d.kind, Object.assign({}, d, { _fromBus: true }));
    });
  } catch (e) {}
  window.BSControl = {
    KEY, LADDER, OFF, CHAIN_LEAN, stats, describe, label, OUT, DRIFT, LEVELS5, ZONES,
    load, save, settings, saveSettings, setTrack, levelFor, band, level, applyDelta, event, chip,
    trackState, trackFor, direction: track => directionOf(trackState(track || 'day')),
    continenceIndex, continenceLevel, controlFraction, trainingBand, rankIndex, zone,
    countsReal, reverseTrack, stopConditioning, mode: () => load().mode,
    rank: () => window.BSRanks ? window.BSRanks.rankOfEst(load().value) : null
  };
})();
