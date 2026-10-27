/* ===========================
   campaign.js — Campaign mode (Profiles › Campaign). Multi-day rank ladder, .
   Inspired by the "Rank Trainer" points→rank ladder (panties → pad → Goodnites → diaper).
   Each rank = rule modifiers + daily goals checked against calendar entries.
   Safety: real-life (natural) accidents/wet nights NEVER count toward progress. Natural entries
   can only count for logging a morning check-in, a real potty trip, or against an accident cap.
   The campaign schedules nothing, makes no sound and sends no prompts, so Bedwetting stays silent.
   =========================== */
(function () {
  const KEY = 'bs_campaign_v1';
  // rank 0 = most continent (in-game) … 6 = most padded/little (in-game)
  const RANKS = [
    { id: 'big_kid', name: '🩲 Big Kid', prot: 'none', main: [60, 120], micro: [15, 30], waves: 1, hold: 85, warn: 'Long pre-chime warning', preChime: true, grace: { fg: [90, 240], bg: [20, 45] } },
    { id: 'trainee', name: '🎓 Trainee', prot: 'pad', main: [50, 100], micro: [12, 25], waves: 1, hold: 72, warn: 'Pre-chime warning', preChime: true, grace: { fg: [60, 180], bg: [15, 35] } },
    { id: 'sprout', name: '🌱 Sprout', prot: 'pullups', main: [40, 80], micro: [10, 20], waves: 2, hold: 58, warn: 'Pre-chime warning', preChime: true, grace: { fg: [45, 120], bg: [10, 25] } },
    { id: 'nightie', name: '🌙 Nightie', prot: 'pullups', main: [30, 70], micro: [8, 16], waves: 2, hold: 45, warn: 'Short warning', preChime: true, grace: { fg: [30, 90], bg: [8, 20] } },
    { id: 'padded', name: '🧷 Padded', prot: 'diapers', main: [25, 55], micro: [6, 14], waves: 3, hold: 32, warn: 'Short warning', preChime: true, grace: { fg: [20, 60], bg: [5, 15] } },
    { id: 'thick', name: '🧸 Thick-Padded', prot: 'thick_diapers', main: [18, 45], micro: [5, 12], waves: 4, hold: 20, warn: 'No warning', preChime: false, grace: { fg: [12, 40], bg: [3, 10] } },
    { id: 'legend', name: '👑 Little Legend', prot: 'thick_diapers', main: [12, 35], micro: [4, 10], waves: 5, hold: 10, warn: 'No warning', preChime: false, grace: { fg: [8, 25], bg: [2, 6] } }
  ];
  // v19: campaign ranks map onto the one ladder (BSRanks). Keys unchanged.
  const levelToRank = i => { try { if (window.BSRanks) return window.BSRanks.campaignOfRank(['full','good','okay','shaky','little'][Math.max(0, Math.min(4, i | 0))] || 'okay'); } catch (e) {} return [0, 2, 3, 5, 6][Math.max(0, Math.min(4, i | 0))]; };

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(s) { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); }
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const addDays = (k, n) => { const [y, m, d] = k.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n, 12).getTime()); };

  function direction(s) { return s.target < s.rank ? 'up' : s.target > s.rank ? 'down' : 'hold'; } // up = toward continent
  /** Daily goals for the current rank/direction. Each: {id,label,test(entries)->{ok,val}}. */
  function goalsFor(s) {
    const r = RANKS[s.rank], dir = direction(s), bed = s.goal === 'bedwetting';
    const style = s.playStyle || 'either';
    const NATM = ['simple_urge', 'messy_timer', 'nat_session'];
    const isNatRoll = e => NATM.includes(e.mode);
    // v11: a real accident during an in-game wait counts as a failed hold when "Count accidents during waits" is ON (default, user-confirmed)
    const waitFail = e => !!e.failedWait && (!window.BSControl || window.BSControl.load().countWaitAccidents !== false);
    // v11 play style: 'natural' = Simple Urge / natural rolls count as play, 'sessions' = sim sessions required, 'either'
    const simAny = e => e.source === 'sim';
    const sim = e => simAny(e) && (style === 'natural' ? isNatRoll(e) : style === 'sessions' ? !isNatRoll(e) : true);
    const play = e => sim(e) || (style !== 'sessions' && waitFail(e));
    const any = e => s.source === 'both' ? (e.source === 'natural' || sim(e)) : sim(e); // which entries count where natural is allowed
    const isAcc = e => e.type === 'accident' || e.type === 'leak';
    const clipCamp = !!(window.BSHub && window.BSHub.clipAssistCampaignOn && window.BSHub.clipAssistCampaignOn());
    const clipAcc = e => clipCamp && e.source === 'natural' && (
      ((e.type === 'accident' || e.type === 'leak') && (e.mode === 'dryclip_bridge' || e.mode === 'dryclip' || (e.tags && e.tags.indexOf && e.tags.indexOf('clip-flagged') >= 0))) ||
      (e.type === 'clip_flag' && e.confirmed && (!e.clip || e.clip.kind !== 'gap'))
    );
    const playLbl = style === 'natural' ? 'Simple Urge roll' : style === 'sessions' ? 'sim session' : 'sim session or Simple Urge roll';
    const g = [];
    g.push({ id: 'checkin', label: 'Log a morning check-in (night entry)', test: es => { const n = es.filter(e => e.type === 'night' && (s.source === 'both' || simAny(e))).length; return { ok: n >= 1, val: n }; } });
    if (bed) {
      g.push({ id: 'simnight', label: 'Play a silent sim night (Bedwetting mode)', test: es => { const n = es.filter(e => e.type === 'night' && simAny(e)).length; return { ok: n >= 1, val: n }; } });
    }
    // v32 night focus (opt-in via deep start / prefs): dry morning streak goal — independent of Path board
    const nightFocus = !!(s.prefs && s.prefs.nightFocus) || !!(window.BSPathPlay && window.BSPathPlay.loadStart && window.BSPathPlay.loadStart().nightFocus);
    if (nightFocus || bed) {
      g.push({ id: 'dryMorning', label: 'Dry morning (night entry marked dry / no wet)', test: es => {
        const nights = es.filter(e => e.type === 'night' && (s.source === 'both' || simAny(e)));
        const dry = nights.filter(e => e.wet === false || e.dry === true || (e.severity !== 'wet' && e.memo && /dry/i.test(e.memo)));
        // Also accept calendar nights with no accident subtype
        const ok = nights.some(e => !(e.wet === true || e.severity === 'wet' || e.type2 === 'wet'));
        return { ok: nights.length > 0 && ok, val: dry.length || (ok ? 1 : 0) };
      } });
    }
    if (dir === 'up' || (dir === 'hold' && s.rank <= 2)) {
      const need = Math.max(1, 4 - Math.floor(s.rank / 2));
      g.push({ id: 'potty', label: `Make it to the potty ${need}× (${s.source === 'both' ? 'any' : playLbl})`, test: es => { const n = es.filter(e => e.type === 'potty' && any(e)).length; return { ok: n >= need, val: n }; } });
      const cap = Math.max(0, Math.floor(s.rank / 2));
      g.push({ id: 'cap', label: `Keep accidents ≤ ${cap} (failed waits count)`, test: es => { const n = es.filter(e => (isAcc(e) && (any(e) && e.source === 'sim' || waitFail(e))) || clipAcc(e)).length; const played = es.some(play) || es.some(clipAcc); return { ok: played && n <= cap, val: n }; } });
    } else {
      g.push({ id: 'session', label: `Play at least one ${playLbl}`, test: es => { const n = es.filter(play).length; return { ok: n >= 1, val: n }; } });
      const need = 1 + Math.floor(r.waves / 2);
      // In-game leaks only — plus accidents during an in-game wait when the user turned that setting on (default ON).
      g.push({ id: 'simleaks', label: `Roll ${need}+ leaks/accidents (failed waits count)`, test: es => { const n = es.filter(e => (isAcc(e) && (sim(e) || waitFail(e))) || clipAcc(e)).length; return { ok: n >= need, val: n }; } });
    }
    return g;
  }
  function entriesForDay(k) { try { return window.BSCalendar.load().entries.filter(e => dayKey(e.ts) === k); } catch (e) { return []; } }
  function scoreDay(s, k, es) {
    es = es || entriesForDay(k);
    const goals = goalsFor(s).map(g => Object.assign({ id: g.id, label: g.label }, g.test(es)));
    // v15: day-end recap (self-report) counts as one extra goal alongside logs — never replaces them.
    const rc = s.recaps && s.recaps[k];
    if (rc && !rc.rest) goals.push({ id: 'recap', label: 'Day-end recap (self-report)', ok: !!rc.pass });
    const met = goals.filter(g => g.ok).length, need = Math.ceil(goals.length * 2 / 3);
    const active = es.length > 0 || !!(rc && !rc.rest);
    return { day: k, goals, met, total: goals.length, pass: met >= need, rest: !active || (s.restDays || []).includes(k), manualRest: (s.restDays || []).includes(k) };
  }
  /** Settle all whole days since lastEvalDay (exclusive) up to yesterday. Returns events. */
  function evaluate(now = Date.now(), getEntries) {
    const s = load(); if (!s || !s.active || s.paused) return [];
    const today = dayKey(now), ev = [];
    let k = addDays(s.lastEvalDay, 1);
    while (k < today && !(s.endDay && k > s.endDay)) {
      const res = scoreDay(s, k, getEntries ? getEntries(k) : undefined);
      // v11 (B12): rest days are explicit — default 1 per 7 (setting 0/1/2/unlimited) + manual "Rest today".
      // Unlogged days beyond the allowance are "idle": no drift, no fail, but the pass streak doesn't continue.
      let result = 'rest';
      if (res.rest && !res.manualRest) {
        const per = s.restPerWeek == null ? 1 : s.restPerWeek, wk = weekKey(k);
        const used = s.history.filter(h => h.result === 'rest' && weekKey(h.day) === wk).length;
        if (per !== 'unlimited' && used >= +per) { result = 'idle'; s.streakPass = 0; }
      }
      if (!res.rest) {
        if (res.pass) { s.streakPass++; s.streakFail = 0; result = 'pass'; ctl('goal_pass', s, k); } else { s.streakFail++; s.streakPass = 0; result = 'fail'; }
        const dir = direction(s);
        if (s.streakPass >= s.promoteDays && dir !== 'hold') { s.rank += dir === 'up' ? -1 : 1; s.streakPass = 0; result = 'promoted'; ev.push({ type: 'promoted', rank: s.rank, day: k }); ctl('promoted', s, k); }
        else if (s.streakFail >= 2) {
          const away = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
          const nr = s.rank + away;
          const full = s.prefs && (s.prefs.ladderMode === 'full' || s.prefs.ladderMode === 'travel');
          // classic: never demote past start↔target band; full/travel: whole 0..6 ladder
          const lo = full ? 0 : Math.min(s.startRank, s.target), hi = full ? 6 : Math.max(s.startRank, s.target);
          if (away && nr >= lo && nr <= hi) { s.rank = nr; result = 'demoted'; ev.push({ type: 'demoted', rank: s.rank, day: k }); }
          s.streakFail = 0;
        }
      }
      s.history.push({ day: k, met: res.met, total: res.total, result, rank: s.rank });
      if (s.history.length > 60) s.history.shift();
      s.lastEvalDay = k; k = addDays(k, 1);
    }
    // v11: optional fixed length — the campaign ends after its last day (open-ended when lengthDays is null)
    if (s.endDay && today > s.endDay && !s.endedAt) { s.endedAt = now; ev.push({ type: 'ended' }); }
    if (s.rank === s.target && !s.completedAt && s.history.some(h => h.result === 'promoted')) {
      // Rank travel: bounce — flip target to the other end of the ladder and keep going
      if (s.prefs && s.prefs.ladderMode === 'travel') {
        s.target = s.target <= 0 ? 6 : s.target >= 6 ? 0 : (s.rank < 3 ? 6 : 0);
        s.startRank = s.rank;
        s.streakPass = 0;
        s.completedAt = null;
        s.controlDir = ctlDir(s);
        ev.push({ type: 'travel_flip', rank: s.rank, target: s.target, day: s.lastEvalDay });
      } else {
        s.completedAt = now; ev.push({ type: 'complete' });
      }
    }
    save(s); if (ev.some(e => e.type !== 'complete')) applyRank(s);
    return ev;
  }
  function weekKey(k) { const [y, m, d] = k.split('-').map(Number); const dt = new Date(y, m - 1, d, 12); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dayKey(dt.getTime()); }
  function ctlDir(s) { return s.controlDir || (direction(s) === 'up' ? 'progress' : direction(s) === 'down' ? 'regress' : 'hold'); }
  function ctl(kind, s, k) { try { if (window.BSControl) { const [y, m, d] = k.split('-').map(Number); window.BSControl.event(kind, { direction: ctlDir(s), now: new Date(y, m - 1, d, 20).getTime() }); } } catch (e) {} }
  function restToday() { const s = load(); if (!s) return; const k = dayKey(Date.now()); s.restDays = (s.restDays || []).filter(x => x >= addDays(k, -60)); if (!s.restDays.includes(k)) s.restDays.push(k); save(s); }
  /** Game flag only. Stored on the existing campaign object (bs_campaign_v1.flags.tummy). */
  function tummyOn(s) { s = s || load(); return !!(s && s.flags && s.flags.tummy); }
  function setTummy(on, opts) {
    opts = opts || {};
    const s = load(); if (!s) return null;
    s.flags = s.flags || {};
    let keep = false;
    if (!on && !opts.user) {
      try {
        const b = window.BSPath && window.BSPath.load && window.BSPath.load();
        if (b && b.classId === 'cascade' && b.flags && b.flags.tummy) keep = true;
        const sym = window.BSSymptoms && window.BSSymptoms.activeToday && window.BSSymptoms.activeToday();
        if (sym && sym.indexOf && sym.indexOf('tummy_trouble') >= 0) keep = true;
      } catch (e) {}
    }
    s.flags.tummy = on ? true : !!keep;
    save(s);
    if (!opts.fromPath) {
      try {
        const P = window.BSPath, b = P && P.load && P.load();
        if (b) {
          b.flags = b.flags || {};
          if (on) b.flags.tummy = true;
          else if (opts.user && b.classId !== 'cascade') b.flags.tummy = false;
          P.save(b);
        }
      } catch (e) {}
    }
    return s;
  }
  /** #2 waits become 0 while tummy is rumbling. Same idea as Path: skip the wait, no medical advice. */
  function pooWaitMin(min) { return tummyOn() ? 0 : min; }
  function graceFor(r) { return { fgMinSec: r.grace.fg[0], fgMaxSec: r.grace.fg[1], bgMinMin: r.grace.bg[0], bgMaxMin: r.grace.bg[1] }; }
  /** Write the rank's modifiers: alarm-grace window + a "Campaign" custom profile (existing system). */
  function applyRank(s) {
    s = s || load(); if (!s) return null;
    const r = RANKS[s.rank];
    try { if (window.BSGrace) window.BSGrace.saveSettings(graceFor(r)); } catch (e) {}
    const q = window.BSQuiz && window.BSQuiz.load(), base = (q && q.program && q.program.runtime) || {};
    const lvl = (window.BSRanks && window.BSRanks.rankOfCampaign(s.rank).tier) || ['fully_continent', 'mostly_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent', 'fully_incontinent'][s.rank];
    const p = { id: 'campaign', source: 'campaign', name: `🏅 Campaign — ${r.name}`, description: `Campaign rank ${s.rank + 1}/7. ${r.warn}; ${r.waves} urgency wave(s)/cycle; hold odds ${r.hold}%. `,
      createdAt: new Date().toISOString(),
      runtime: Object.assign({ sipMin: 2, sipMax: 5, hydrationMin: 20, hydrationMax: 50, progressionEnabled: false, successThreshold: 3, failureThreshold: 2, pushToLeak: 'optional', mercyMode: 'optional', customMicroEvents: [], customFullEvents: [], leakScalar: 1, pressureAcceleration: 1 }, base, {
        baseProfile: base.baseProfile || 'babysitter', mainMin: r.main[0], mainMax: r.main[1], microMin: r.micro[0], microMax: r.micro[1], microsPerCycle: r.waves,
        pottySuccessRate: r.hold, preChime: r.preChime, startProtection: r.prot, continenceLevel: lvl, campaignRank: s.rank }) };
    if (typeof getSavedCustomProfiles === 'function') { const l = getSavedCustomProfiles().filter(x => x.id !== 'campaign'); l.push(p); saveCustomProfiles(l); }
    return p;
  }
  /** Map deep-start ladder / experience prefs → start() opts. Does not rename KEY. */
  function optsFromLadder(saved) {
    saved = saved || {};
    const mode = saved.ladderMode || 'target';
    const exp = saved.experience || 'standard';
    const out = { prefs: { ladderMode: mode, experience: exp, nightFocus: !!saved.nightFocus, playMode: saved.mode, pathClassId: saved.classId } };
    if (exp === 'gentle') out.restPerWeek = 2;
    else if (exp === 'intense') out.restPerWeek = 0;
    else out.restPerWeek = 1;
    if (mode === 'full' || mode === 'travel') {
      // Full 7-rank fantasy: start Big Kid (0), target Little Legend (6) by default (progress→padded)
      // Experience intense / regress feel: start legend, climb toward big kid
      const towardPadded = exp !== 'intense';
      out.startRank = towardPadded ? 0 : 6;
      out.target = towardPadded ? 6 : 0;
      out.controlDir = towardPadded ? 'regress' : 'progress';
      out.time = mode === 'travel' ? 2 : 1; // travel: standard promote pace; full climb: a bit slower days
      if (mode === 'full') out.time = 1;
    }
    return out;
  }
  function start(opts) {
    opts = opts || {};
    const q = window.BSQuiz && window.BSQuiz.load();
    const startRank = opts.startRank != null ? opts.startRank : Math.max(0, Math.min(6, levelToRank(q && q.baseline ? q.baseline.levelIdx : 1) + ((q && q.target && q.target.rankShift) || 0)));
    const target = opts.target != null ? opts.target : levelToRank(q && q.target ? q.target.targetIdx : 1);
    const time = opts.time || (q && q.target && q.target.time) || 2;
    let prevGrace = null; try { prevGrace = localStorage.getItem('bs_grace_settings'); } catch (e) {}
    const s = { active: true, paused: false, startRank, rank: startRank, target, goal: (q && q.target && q.target.goal) || 'stay',
      source: opts.source || 'sim', promoteDays: time >= 3 ? 2 : 3, startedAt: Date.now(), lastEvalDay: addDays(dayKey(opts.now || Date.now()), -1),
      streakPass: 0, streakFail: 0, history: [], prevGrace, restPerWeek: opts.restPerWeek != null ? opts.restPerWeek : 1, restDays: [], playStyle: opts.playStyle || 'either',
      lengthDays: opts.lengthDays ? Math.max(1, Math.min(365, +opts.lengthDays)) : null, flags: { tummy: false } };
    if (opts.prefs) s.prefs = opts.prefs;
    if (s.lengthDays) s.endDay = addDays(dayKey(opts.now || Date.now()), s.lengthDays - 1);
    s.controlDir = opts.controlDir || ctlDir(s);
    try {
      const b = window.BSPath && window.BSPath.load && window.BSPath.load();
      if (b && b.flags && b.flags.tummy) s.flags.tummy = true;
      const sym = window.BSSymptoms && window.BSSymptoms.activeToday && window.BSSymptoms.activeToday();
      if (sym && sym.indexOf && sym.indexOf('tummy_trouble') >= 0) s.flags.tummy = true;
    } catch (e) {}
    try { window.BSControl && window.BSControl.saveSettings({ direction: s.controlDir }); } catch (e) {}
    save(s); applyRank(s); return s;
  }
  function pause(on) { const s = load(); if (!s) return; s.paused = !!on; if (!on) s.lastEvalDay = addDays(dayKey(Date.now()), -1); save(s); }
  function abandon() {
    const s = load(); if (!s) return;
    try { if (window.BSGrace) { localStorage.removeItem('bs_grace_settings'); if (s.prevGrace) localStorage.setItem('bs_grace_settings', s.prevGrace); } } catch (e) {}
    if (typeof getSavedCustomProfiles === 'function') saveCustomProfiles(getSavedCustomProfiles().filter(x => x.id !== 'campaign'));
    save(null);
  }

  // ---------- UI ----------
  /** Open the real flow for a campaign goal id. Returns true if something opened. */
  function launchGoal(id) {
    id = id || '';
    try {
      if (id === 'checkin' || id === 'dryMorning') {
        if (window.BSDryClip && typeof window.BSDryClip.openMorningCheckIn === 'function') {
          window.BSDryClip.openMorningCheckIn(); return true;
        }
        if (window.BSNight) {
          const st = window.BSNight.get && window.BSNight.get();
          if (st && st.phase === 'morning') { window.BSNight.open(); return true; }
          window.BSNight.open(); return true;
        }
        if (typeof switchTab === 'function') switchTab('session');
        if (typeof toast === 'function') toast('Open DryClip / Natural Night for morning check-in');
        return true;
      }
      if (id === 'simnight') {
        if (window.BSHub && window.BSHub.startBedwetting) { window.BSHub.startBedwetting(); return true; }
        if (window.BSNight && window.BSNight.open) { window.BSNight.open(); return true; }
      }
      if (id === 'session' || id === 'potty' || id === 'simleaks' || id === 'cap') {
        if (typeof switchTab === 'function') switchTab('urge');
        if (typeof toast === 'function') toast(id === 'cap' ? 'Play Urge — keep accidents low today' : 'Open Urge to play toward this goal');
        return true;
      }
      if (id === 'recap') {
        if (window.BSQuiz && window.BSQuiz.begin) { window.BSQuiz.begin('recap'); return true; }
      }
      if (id === 'change' || id === 'may_change') {
        if (window.BSPathPlay && window.BSPathPlay.openMayChange) { window.BSPathPlay.openMayChange('campaign_goal'); return true; }
        if (window.BSChange) { window.BSChange.open({ ctx: 'campaign_goal' }); return true; }
      }
    } catch (e) { console.warn(e); }
    return false;
  }
  function goalRowHtml(g) {
    const done = !!g.ok;
    const actionable = ['checkin', 'dryMorning', 'simnight', 'session', 'potty', 'simleaks', 'cap', 'recap'].includes(g.id);
    if (!actionable || done) {
      return `<div class="camp-goal${done ? ' camp-goal-done' : ''}">${done ? '✅' : '⬜'} ${esc(g.label)} <span style="color:#8ea0b6;">(${g.val != null ? g.val : '—'})</span></div>`;
    }
    return `<button type="button" class="camp-goal camp-goal-btn" data-cgoal="${esc(g.id)}">⬜ ${esc(g.label)} <span style="color:#8ea0b6;">(${g.val != null ? g.val : '—'})</span> <span class="camp-goal-go">Open →</span></button>`;
  }

  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function render() {
    const m = document.getElementById('campaignMount'); if (!m) return;
    const evs = evaluate();
    evs.forEach(e => { if (typeof toast === 'function') toast(e.type === 'promoted' ? `🏅 Rank up: ${RANKS[e.rank].name}` : e.type === 'demoted' ? `↩ Back to ${RANKS[e.rank].name}` : e.type === 'ended' ? '🏁 Campaign length finished' : e.type === 'travel_flip' ? `🔁 Rank travel: now heading to ${RANKS[e.target].name}` : '🎉 Campaign target reached!'); });
    const s = load(), q = window.BSQuiz && window.BSQuiz.load();
    if (!s) {
      const ready = q && q.baseline && q.target;
      m.innerHTML = `<h2 style="margin:0 0 6px;">🏅 Campaign</h2>
        <p class="section-desc">A multi-day rank ladder. Runs <b>alongside</b> Path, Urge, and DryClip nights — you do not need the board open for goals to count. Each rank changes warning time, urgency waves, run-to-potty grace, micro frequency and hold odds.</p>
        <div class="camp-goal">Also on <b>🎲 Path › Campaign</b> toggle. <button type="button" id="cpOpenPath">Open shared tab</button></div>
        <label class="fld"><span>Count calendar entries from</span><select id="cpSrc"><option value="sim">Sessions & rolls</option><option value="both">Sim + real check-ins/potty trips</option></select></label>
        <div class="cal-legend">Real-life accidents never count toward progress — only sim ones do (plus wait-fails when that setting is on).</div>
        <div class="camp-actions"><button type="button" id="cpDeepStart">🎛 Deep start (mode · class · stats · night focus)</button><button type="button" id="cpSetupQuiz">📝 Setup quiz (optional)</button></div>
        <div class="camp-actions"><button type="button" id="cpMayChangeIdle">🧷 May I change?</button><button type="button" id="cpStart" style="background:#a29bfe;color:#000;font-weight:bold;">▶ Start campaign${ready ? '' : ' (default ranks — take the quizzes to personalise)'}</button></div>`;
      m.querySelector('#cpStart').onclick = () => { start({ source: m.querySelector('#cpSrc').value }); render(); if (typeof toast === 'function') toast('Campaign started'); };
      m.querySelector('#cpSetupQuiz').onclick = () => openSetup();
      const ds = m.querySelector('#cpDeepStart'); if (ds) ds.onclick = () => { if (window.BSPathPlay) window.BSPathPlay.openStartSheet({ target: 'campaign' }); else openSetup(); };
      const op = m.querySelector('#cpOpenPath'); if (op) op.onclick = () => { try { window.BSPathPlay && window.BSPathPlay.setSurface('campaign'); } catch(e){} if (typeof switchTab === 'function') switchTab('path'); };
      const mci = m.querySelector('#cpMayChangeIdle'); if (mci) mci.onclick = () => { try { if (window.BSPathPlay && window.BSPathPlay.openMayChange) window.BSPathPlay.openMayChange('campaign'); else if (window.BSChange) window.BSChange.open({ ctx: 'campaign' }); } catch (e) {} };
      return;
    }
    const today = scoreDay(s, dayKey(Date.now()));
    const dir = direction(s);
    const r = RANKS[s.rank];
    const tummy = tummyOn(s);
    m.innerHTML = `<h2 style="margin:0 0 6px;">🏅 Campaign ${s.paused ? '(paused)' : ''}</h2>
      <div class="camp-card"><div class="calib-big">${esc(r.name)} <span style="font-size:12px;color:#8ea0b6;">→ target ${esc(RANKS[s.target].name)}</span></div>
      ${tummy ? `<div class="pp-banner" id="cpTummyBanner" style="border-left:5px solid #e17055;margin:8px 0;padding:10px 12px;"><b>🌀 Tummy trouble: your next #2 can't wait.</b><div class="cal-legend">Game flag only. #2 waits are skipped until this rumble resolves.</div></div>` : '<div class="cal-legend" id="cpTummyQuiet">Tummy is quiet.</div>'}
      <label class="qp-flag" id="cpTummyRow"><input type="checkbox" id="cpTummy" ${tummy ? 'checked' : ''}> 🌀 Tummy is rumbling — next #2 can't wait</label>
      <div class="cal-legend">${s.completedAt ? '🎉 Target reached! Keep playing here or start a new campaign.' : dir === 'hold' ? 'Holding steady at your target.' : `${s.streakPass}/${s.promoteDays} good days to rank ${dir === 'up' ? 'up (more continent)' : 'up (more padded)'} · 2 missed days in a row steps back one rank (never past your start).`}</div>
      <div class="cal-legend">Rules now: ${esc(r.warn)} · ${r.waves} urgency wave(s)/cycle · micros every ${r.micro[0]}–${r.micro[1]} min · hold odds ${r.hold}% · grace ${r.grace.fg[0]}–${r.grace.fg[1]} s (app open).</div>
      <div class="quiz-q">Today’s goals (${today.met}/${today.total}, need ${Math.ceil(today.total * 2 / 3)})</div>
      ${today.goals.map(goalRowHtml).join('')}
      <div class="cal-legend">Tap an open goal to jump to morning check-in, Urge, nights, or May I change?.</div>
      <div class="camp-ladder">${RANKS.map((x, i) => `<div class="camp-rung ${i === s.rank ? 'cur' : ''} ${i === s.target ? 'tgt' : ''}"><span>${i + 1}. ${esc(x.name)}</span><span>${i === s.target ? '🎯' : ''}${i === s.startRank ? ' start' : ''}</span></div>`).join('')}</div>
      <div class="cal-legend">History: ${s.history.slice(-7).map(h => ({ pass: '✅', fail: '✖', rest: '🛋', idle: '·', promoted: '⬆', demoted: '⬇' }[h.result])).join(' ') || 'first day'}</div>
      <div class="cal-legend" id="cpLength">${s.lengthDays ? (s.endedAt ? `🏁 Finished its ${s.lengthDays} days.` : `Day ${Math.min(s.lengthDays, Math.round((Date.now() - s.startedAt) / 864e5) + 1)} of ${s.lengthDays} (ends ${s.endDay}).`) : 'Open-ended — runs until you reach the target.'}</div>
      ${window.BSControl ? window.BSControl.chip() : ''}
      <label class="urge-lbl">Control meter direction <select id="cpCtlDir">${[['progress', 'Progress (more control)'], ['regress', 'Regress (less control)'], ['hold', 'Hold']].map(([v, l]) => `<option value="${v}" ${ctlDir(s) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="urge-lbl">Play style <select id="cpPlayStyle">${[['either', 'Either'], ['natural', 'Natural rolls'], ['sessions', 'Sessions required']].map(([v, l]) => `<option value="${v}" ${(s.playStyle || 'either') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="urge-lbl">Rest days <select id="cpRest">${[['0', 'None'], ['1', '1 per 7 days'], ['2', '2 per 7 days'], ['unlimited', 'Unlimited (unlogged days never count)']].map(([v, l]) => `<option value="${v}" ${String(s.restPerWeek == null ? 1 : s.restPerWeek) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="cal-legend">Rest day: nothing changes, streak kept. Unlogged days beyond your rest allowance are idle (streak pauses).</div>
      <label class="qp-flag"><input type="checkbox" id="cpNightFocus" ${(s.prefs && s.prefs.nightFocus) ? 'checked' : ''}> Night focus — dry mornings count as a daily goal (works with DryClip / Natural Night / sim nights)</label>
      <div class="cal-legend">Path board is optional. Class from deep start shapes Urge odds via your active class pick.${(s.prefs && s.prefs.ladderMode && s.prefs.ladderMode !== 'target') ? ' · Ladder: <b>' + (s.prefs.ladderMode === 'travel' ? 'Rank travel (up & down)' : 'Full 7-rank climb') + '</b>' : ''}</div>
      <div id="cpReviewHost"></div><div id="cpQuizHost"></div>
      <div class="camp-actions"><button type="button" id="cpMayChange" class="pp-ok">🧷 May I change?</button>
        <button type="button" id="cpPlay" style="background:#55efc4;color:#000;font-weight:bold;">▶ Play this rank</button>
        <button type="button" id="cpRestToday">🛋 Rest today</button><button type="button" id="cpPause">${s.paused ? '▶ Resume' : '⏸ Pause'}</button><button type="button" id="cpAbandon">✕ Abandon</button></div></div>`;
    try {
      if (window.BSPathPlay) {
        const rh = m.querySelector('#cpReviewHost'); if (rh) { rh.innerHTML = window.BSPathPlay.reviewHtml('campaign'); window.BSPathPlay.bindReview(rh, 'campaign'); }
        const qh = m.querySelector('#cpQuizHost'); if (qh) { qh.innerHTML = window.BSPathPlay.sectionQuizzesHtml('campaign'); window.BSPathPlay.bindSectionQuizzes(qh); }
      }
    } catch (e) {}
    const cpChg = m.querySelector('#cpMayChange'); if (cpChg) cpChg.onclick = () => { try { if (window.BSPathPlay && window.BSPathPlay.openMayChange) window.BSPathPlay.openMayChange('campaign'); else if (window.BSChange) window.BSChange.open({ ctx: 'campaign' }); } catch (e) {} };
    m.querySelectorAll('[data-cgoal]').forEach(btn => btn.onclick = () => { launchGoal(btn.dataset.cgoal); });
    m.querySelector('#cpCtlDir').onchange = e => { const n = load(); n.controlDir = e.target.value; save(n); try { window.BSControl.saveSettings({ direction: n.controlDir }); } catch (er) {} render(); };
    m.querySelector('#cpPlayStyle').onchange = e => { const n = load(); n.playStyle = e.target.value; save(n); render(); };
    m.querySelector('#cpRest').onchange = e => { const n = load(); n.restPerWeek = e.target.value === 'unlimited' ? 'unlimited' : +e.target.value; save(n); };
    m.querySelector('#cpRestToday').onclick = () => { restToday(); if (typeof toast === 'function') toast('🛋 Rest day — nothing changes today'); render(); };
    m.querySelector('#cpPlay').onclick = () => { applyRank(); if (typeof window.applyCustomProfile === 'function') window.applyCustomProfile('campaign'); };
    m.querySelector('#cpPause').onclick = () => { pause(!s.paused); render(); };
    m.querySelector('#cpAbandon').onclick = () => { if (confirm('Abandon this campaign? Your grace settings are restored.')) { abandon(); render(); } };
    const tum = m.querySelector('#cpTummy'); if (tum) tum.onchange = () => { setTummy(tum.checked, { user: true }); render(); };
    const nf = m.querySelector('#cpNightFocus');
    if (nf) nf.onchange = () => { const n = load(); n.prefs = Object.assign({}, n.prefs || {}, { nightFocus: nf.checked }); save(n); try { window.BSPathPlay && window.BSPathPlay.saveStart({ nightFocus: nf.checked }); } catch (e) {} render(); };
  }
  // ---------- v11: campaign setup from the Session start flow (optional short quiz, skippable) ----------
  const START_RANK = { full: 0, good: 1, okay: 2, shaky: 3, little: 4, none: 5 }; // v19 aligned with BSRanks.camp
  /** Pure: quiz answers → start() opts. a { experience new|some|lots, level ladder key, direction progress|regress|hold, length short|standard|long, playStyle } */
  function optsFromQuiz(a) {
    a = a || {}; const sr = START_RANK[a.level] != null ? START_RANK[a.level] : 1;
    const dir = a.direction || 'progress';
    const target = dir === 'progress' ? Math.max(0, sr - (a.length === 'long' ? 4 : a.length === 'short' ? 1 : 2)) : dir === 'regress' ? Math.min(6, sr + (a.length === 'long' ? 4 : a.length === 'short' ? 1 : 2)) : sr;
    return { startRank: sr, target, time: a.length === 'short' ? 3 : a.length === 'long' ? 1 : 2, controlDir: dir, playStyle: a.playStyle || 'either',
      restPerWeek: a.experience === 'new' ? 2 : a.experience === 'lots' ? 0 : 1, source: a.source || 'sim', level: a.level, lengthDays: a.lengthDays || null, prefs: a.prefs || null };
  }
  function startFromQuiz(a) {
    const o = optsFromQuiz(a); const s = start(o);
    if (o.level && window.BSControl) { const l = window.BSControl.level(o.level); if (l) window.BSControl.saveSettings({ value: Math.round((l.band[0] + l.band[1]) / 2) }); }
    return s;
  }

  // v13: longer campaign quiz — optional extra questions (stored as s.prefs; flavour + rule hints, all in-game)
  const MORE_Q = [
    ['why', '🎯 What’s this campaign about?', [['fun', 'Just for fun'], ['routine', 'Building a routine'], ['challenge', 'A real challenge'], ['story', 'A little story arc']]],
    ['tone', '🧸 How little should it feel?', [['neutral', 'Neutral / grown-up'], ['playful', 'A bit playful'], ['cute', 'Big-kid cute'], ['tiny', 'Tiny-tot']]],
    ['caretaker', '🤗 Caretaker vibe', [['gentle', 'Gentle'], ['firm', 'Firm but fair'], ['strict', 'Strict'], ['chaos', 'Dice chaos']]],
    ['pottyPerm', '🙋 May I pee? gate', [['never', 'Never ask'], ['sometimes', 'Sometimes ask'], ['always', 'Always ask']]],
    ['changePerm', '🧷 May I change? gate', [['never', 'Change whenever'], ['threshold', 'Only past the saturation rule'], ['roll', 'Always roll for it']]],
    ['satRule', '💧 Change saturation threshold', [['30', '30 (damp)'], ['50', '50 (half)'], ['75', '75 (soggy)'], ['90', '90 (nearly full)']]],
    ['accShape', '🌊 Accident shape', [['dribble', 'Many small dribbles'], ['mixed', 'Mixed'], ['flood', 'Rare big floods']]],
    ['dryChance', '🏆 Chance of staying dry', [['high', 'High'], ['mid', 'Medium'], ['low', 'Low']]],
    ['urgency', '⏱️ Timer urgency', [['relaxed', 'Relaxed waits'], ['normal', 'Normal'], ['tight', 'Tight waits']]],
    ['afterAcc', '💦 After a small accident', [['finish', 'Go finish on the potty'], ['wait', 'Wait timer, then roll'], ['stay', 'Stay in protection'], ['dice', 'Let the dice pick']]],
    ['nights', '🌙 Nights in the campaign', [['off', 'Days only'], ['some', 'Some nights (silent)'], ['all', 'Every night (silent)']]],
    ['cards', '🃏 Blessings & curses', [['off', 'Off'], ['bless', 'Blessings only'], ['both', 'Both'], ['spicy', 'Curses lean heavier']]],
    ['stars', '⭐ Star tasks', [['off', 'Off'], ['few', 'A few a day'], ['lots', 'Lots']]],
    ['board', '🎲 Potty Path board', [['off', 'Off'], ['weekly', 'Weekly'], ['daily', 'Daily']]],
    ['setback', '📉 Setbacks after a rough day', [['soft', 'Soft (streak only)'], ['normal', 'Normal'], ['hard', 'Drop a rank']]],
    ['office', '🟢 Discreet at work?', [['no', 'No'], ['yes', 'Yes, neutral wording']]],
    ['reward', '🎁 Favourite reward', [['stickers', 'Stickers & praise'], ['passes', 'Potty passes'], ['stats', 'Streaks & stats'], ['perks', 'Perk picks']]]
  ];
  // v18: one question per screen with a progress bar (was a dropdown form). "Skip quiz — use defaults" on every screen.
  function setupSteps() {
    const lad = window.BSControl ? window.BSControl.LADDER.map(l => [l.key, l.label]) : [['okay', 'Advanced Trainer']];
    return [
      { id: 'experience', q: 'What experience do you want?', opts: [['new', 'Gentle (2 rest days/week)'], ['some', 'Standard (1 rest day/week)'], ['lots', 'Intense (no rest days)']], def: 'some' },
      { id: 'level', q: 'Starting control level?', opts: lad, def: window.BSControl ? window.BSControl.band() : 'okay' },
      { id: 'direction', q: 'Which direction?', opts: [['progress', 'Progress (more control)'], ['regress', 'Regress (less control)'], ['hold', 'Hold steady']], def: 'progress' },
      { id: 'length', q: 'Pace / distance?', opts: [['short', 'Short hop (1 rank, fast)'], ['standard', 'Standard (2 ranks)'], ['long', 'Long (4 ranks)']], def: 'standard' },
      { id: 'days', q: 'How long should it run?', opts: [['open', 'Open-ended (until the target)'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['custom', 'Custom number of days…']], def: 'open' },
      { id: 'playStyle', q: 'Which play counts?', opts: [['either', 'Either (sessions or natural rolls)'], ['natural', 'Natural rolls (Simple Urge counts)'], ['sessions', 'Sessions required']], def: 'either' },
      { id: 'more', q: `Answer ${MORE_Q.length} more optional questions?`, opts: [['no', 'No — review and start'], ['yes', 'Yes, one at a time (each skippable)']], def: 'no' }
    ].concat(MORE_Q.map(([id, l, o]) => ({ id: 'm_' + id, q: l, opts: o, def: null, more: true })));
  }
  function setupResult(ans) {
    const d = ans.days == null || ans.days === 'open' ? null : ans.days === 'custom' ? Math.max(1, Math.min(365, +ans.customDays || 21)) : +ans.days;
    const p = {}; MORE_Q.forEach(([id]) => { if (ans['m_' + id]) p[id] = ans['m_' + id]; });
    return { experience: ans.experience || 'some', level: ans.level, direction: ans.direction || 'progress', length: ans.length || 'standard', playStyle: ans.playStyle || 'either', lengthDays: d, prefs: Object.keys(p).length ? p : null };
  }
  function openSetup() {
    const old = document.getElementById('cpSetup'); if (old) old.remove();
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap'; w.id = 'cpSetup';
    w.innerHTML = '<div class="cal-sheet" role="dialog" aria-modal="true" id="cqBox"></div>'; document.body.appendChild(w);
    const box = w.querySelector('#cqBox'), steps = setupSteps(), ans = {}; steps.forEach(s => { if (s.def != null) ans[s.id] = s.def; });
    let i = 0;
    const visible = () => steps.filter(s => !s.more || ans.more === 'yes');
    const skipAll = () => { start({ playStyle: 'either' }); w.remove(); render(); if (typeof toast === 'function') toast('Campaign started (defaults)'); };
    const draw = () => {
      const V = visible(), total = V.length + 1;
      if (i >= V.length) {
        const r = setupResult(ans); const lab = s => { const o = s.opts.find(x => x[0] === ans[s.id]); return o ? o[1] : '— skipped —'; };
        box.innerHTML = `<h3>🏅 Campaign setup</h3><div class="cal-legend">Review · ${total} / ${total}</div><div class="quiz-progress"><i style="width:100%"></i></div>
          ${V.filter(s => s.id !== 'more').map(s => `<div class="camp-goal"><b>${esc(s.q)}</b><br>${esc(lab(s))}${s.id === 'days' && ans.days === 'custom' ? ' (' + r.lengthDays + ')' : ''}</div>`).join('')}
          <div class="actions"><button class="ok" id="cqStart">▶ Start campaign</button><button id="cqBack">← Back</button><button id="cqSkip">Skip quiz — use defaults</button><button data-x>Cancel</button></div>`;
        box.querySelector('#cqStart').onclick = () => { startFromQuiz(r); w.remove(); render(); if (typeof toast === 'function') toast('Campaign started'); };
      } else {
        const s = V[i];
        box.innerHTML = `<h3>🏅 Campaign setup</h3><div class="cal-legend">${s.more ? 'Optional · ' : ''}${i + 1} / ${total}</div><div class="quiz-progress"><i style="width:${Math.round((i + 1) / total * 100)}%"></i></div>
          <div class="quiz-q">${esc(s.q)}</div><div class="quiz-opts">${s.opts.map(([k, l]) => `<button type="button" data-cq="${esc(k)}" class="${ans[s.id] === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
          ${s.id === 'days' && ans.days === 'custom' ? `<label class="fld"><span>Days (1–365)</span><input id="cqDaysN" type="number" min="1" max="365" value="${ans.customDays || 21}"></label>` : ''}
          <div class="actions"><button id="cqBack">${i ? '← Back' : '✕ Cancel'}</button>${s.more ? '<button id="cqNext">Skip this one →</button>' : '<button class="ok" id="cqNext">Next →</button>'}<button id="cqSkip">Skip quiz — use defaults</button></div>`;
        box.querySelectorAll('[data-cq]').forEach(b => b.onclick = () => { ans[s.id] = b.dataset.cq; if (s.id === 'days' && b.dataset.cq === 'custom') return draw(); i++; draw(); });
        const dn = box.querySelector('#cqDaysN'); if (dn) dn.oninput = () => { ans.customDays = dn.value; };
        box.querySelector('#cqNext').onclick = () => { if (s.more) delete ans[s.id]; i++; draw(); };
      }
      const bk = box.querySelector('#cqBack'); if (bk) bk.onclick = () => { if (i) { i--; draw(); } else w.remove(); };
      box.querySelector('#cqSkip').onclick = skipAll; const x = box.querySelector('[data-x]'); if (x) x.onclick = () => w.remove();
    };
    draw(); return w;
  }
  window.openCampaignSetup = openSetup;
  // v11 (B12): also settle days on app resume, not only when the tab renders
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { try { evaluate(); } catch (e) {} } });
  window.BSCampaign = { setupSteps, setupResult, MORE_Q, RANKS, KEY, load, save, start, openSetup, optsFromQuiz, startFromQuiz, optsFromLadder, pause, abandon, evaluate, restToday, weekKey, scoreDay, goalsFor, applyRank, levelToRank, dayKey, addDays, direction, render, launchGoal, goalRowHtml, tummyOn, setTummy, pooWaitMin };
  window.renderCampaign = render;
})();
