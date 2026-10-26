/* ===========================
   control.js — v12 Control meter (0-100) + Natural Urge control ladder (single source table).
   Runs ALONGSIDE the campaign rank. Daily drift is capped (±8 default, setting 4-12).
   Updated by Simple Urge outcomes, flagged "during wait" accidents and campaign goals.
   Direction (progress / regress / hold) is chosen per campaign; it only changes the drift table.
   Real (natural) logs never move the meter, EXCEPT accidents during an wait when the user
   leaves "Count accidents during waits" ON (default ON, user request). 
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
  // Drift table (§3.2). [progress, regress]; 'hold' direction uses the progress column halved.
  const DRIFT = {
    go: [1, 0.3], alert_made: [1.5, 0.5], gear: [-0.5, -1], dry_morning: [2, 0.5], wet_morning: [-1, -3],
    goal_pass: [3, -3], promoted: [3, -3], failed_wait: [-2, -2], real_override: [0, 0]
  };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const dk = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function defaults() {
    let v = 60;
    try { const q = window.BSQuiz && window.BSQuiz.load(); if (q && q.baseline && q.baseline.control != null) v = Math.round(q.baseline.control); } catch (e) {}
    return { value: v, direction: 'progress', cap: 8, dayDelta: 0, lastDay: dk(Date.now()), countWaitAccidents: true, history: [] };
  }
  function load() { const s = Object.assign(defaults(), J(KEY, {})); s.cap = Math.max(4, Math.min(12, +s.cap || 8)); return s; }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function settings() { return load(); }
  function saveSettings(p) { const s = load(); ['direction', 'cap', 'countWaitAccidents', 'value'].forEach(k => { if (p[k] !== undefined) s[k] = p[k]; }); s.cap = Math.max(4, Math.min(12, +s.cap || 8)); s.value = Math.max(0, Math.min(100, +s.value)); save(s); return s; }
  function levelFor(v) { v = Math.max(0, Math.min(100, +v)); return LADDER.find(l => v >= l.band[0] && v <= l.band[1]) || LADDER[2]; }
  function band() { return levelFor(load().value).key; }
  function level(key) { return key === 'off' ? OFF : (LADDER.find(l => l.key === key) || null); }
  /** Pure: apply a delta with the daily cap. Returns {state, applied}. */
  function applyDelta(s, delta, now) {
    const day = dk(now || Date.now());
    if (s.lastDay !== day) { s.lastDay = day; s.dayDelta = 0; }
    const room = delta >= 0 ? s.cap - s.dayDelta : -s.cap - s.dayDelta;
    let d = delta >= 0 ? Math.min(delta, Math.max(0, room)) : Math.max(delta, Math.min(0, room));
    const nv = Math.max(0, Math.min(100, s.value + d)); d = nv - s.value;
    s.value = Math.round(nv * 10) / 10; s.dayDelta = Math.round((s.dayDelta + d) * 10) / 10;
    return { state: s, applied: Math.round(d * 10) / 10 };
  }
  /** Record a game event → drift. opts { now, direction } */
  function event(kind, opts) {
    opts = opts || {}; const s = load(), t = DRIFT[kind]; if (!t) return 0;
    const dir = opts.direction || s.direction;
    if (kind === 'failed_wait' && !s.countWaitAccidents) return 0;
    const delta = dir === 'regress' ? t[1] : dir === 'hold' ? t[0] / 2 : t[0];
    const r = applyDelta(s, delta, opts.now);
    s.history.push({ ts: opts.now || Date.now(), kind, d: r.applied, v: s.value }); if (s.history.length > 200) s.history.splice(0, s.history.length - 200);
    save(s); try { window.dispatchEvent(new CustomEvent('bs:control', { detail: { kind, applied: r.applied, value: s.value } })); } catch (e) {}
    return r.applied;
  }
  function chip() {
    const s = load(), l = levelFor(s.value);
    return `<div id="ctlChip" class="urge-note" style="display:flex;align-items:center;gap:8px;"><span>Control</span><span style="flex:1;height:10px;background:#2d3436;border-radius:5px;overflow:hidden;"><span style="display:block;height:100%;width:${s.value}%;background:#55efc4;"></span></span><b id="ctlVal">${Math.round(s.value)}</b><span>${label(l, !!(window.BSOffice && window.BSOffice.on()))}</span><span style="color:#8ea0b6">${s.direction === 'regress' ? '↓' : s.direction === 'hold' ? '=' : '↑'} today ${s.dayDelta > 0 ? '+' : ''}${s.dayDelta}/${s.cap}</span></div>`;
  }
  window.BSControl = { KEY, LADDER, OFF, CHAIN_LEAN, stats, describe, label, OUT, DRIFT, load, save, settings, saveSettings, levelFor, band, level, applyDelta, event, chip, rank: () => window.BSRanks ? window.BSRanks.rankOfEst(load().value) : null };
})();
