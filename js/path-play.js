/* ===========================
   path-play.js — v32 Path | Campaign shared play surface + start sheet.
   Path = interactive board. Campaign runs independently (Urge / nights / calendar)
   and can also be opened from this tab. Storage: bs_play_start_v1 (new).
   Never renames bs_path_v1 / bs_campaign_v1 / bs_class_v1.
   Hard rules: no sexual content; real urge always wins (⏸); urgency/sat user-entered;
   holds ≤20 min. Caregiver copy is original adult-player mommy voice (warm, firm, practical).
   =========================== */
(function () {
  const START_KEY = 'bs_play_start_v1';
  const SURFACE_KEY = 'bs_play_surface_v1'; // 'path' | 'campaign'
  const STAT_BUDGET = 4;
  const STAT_KEYS = ['constitution', 'perception', 'composure'];
  const STAT_LABEL = {
    constitution: 'Constitution (hold length)',
    perception: 'Perception (timer fog)',
    composure: 'Composure (leak pressure)'
  };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function defaults() {
    return {
      v: 1,
      mode: 'solo', // solo | caregiver
      classId: null,
      stats: { constitution: 1, perception: 1, composure: 1 },
      boardMode: 'free', // free | quiz | campaign
      nightFocus: false, // campaign: count dry mornings / soft nights
      experience: 'standard', // gentle | standard | intense
      ladderMode: 'target', // target | full | travel — full/travel = all 7 ranks fantasy
      theme: 'neutral', // CSS look id (bs_play_prefs_v1.theme)
      updatedAt: 0
    };
  }
  function loadStart() { return Object.assign(defaults(), J(START_KEY, {})); }
  function saveStart(p) {
    const n = Object.assign(loadStart(), p || {}, { updatedAt: Date.now(), v: 1 });
    // clamp stats into budget
    let sum = STAT_KEYS.reduce((a, k) => a + (+n.stats[k] || 0), 0);
    if (sum > STAT_BUDGET) {
      // trim from composure then perception
      let over = sum - STAT_BUDGET;
      ['composure', 'perception', 'constitution'].forEach(k => {
        if (over <= 0) return;
        const cut = Math.min(over, Math.max(0, n.stats[k]));
        n.stats[k] -= cut; over -= cut;
      });
    }
    STAT_KEYS.forEach(k => { n.stats[k] = Math.max(0, Math.min(3, +n.stats[k] || 0)); });
    localStorage.setItem(START_KEY, JSON.stringify(n));
    return n;
  }
  function surface() { const s = localStorage.getItem(SURFACE_KEY); return s === 'campaign' ? 'campaign' : 'path'; }
  function setSurface(s) { localStorage.setItem(SURFACE_KEY, s === 'campaign' ? 'campaign' : 'path'); }

  function caregiverOn() { return loadStart().mode === 'caregiver'; }
  function stats() { return Object.assign({ constitution: 1, perception: 1, composure: 1 }, loadStart().stats || {}); }

  /** Hold scale from constitution: 0→0.7, 1→0.85, 2→1.0, 3→1.15 — still capped ≤20 by Path. */
  function holdScaleFromStats(st) {
    st = st || stats();
    return [0.7, 0.85, 1.0, 1.15][Math.max(0, Math.min(3, +st.constitution || 0))];
  }
  /** Soft fog when perception ≤1 during holds (numbers/circle muted, not broken UI). */
  function timerFog() { return (+stats().perception || 0) <= 1; }
  /** Leak / accident pressure nudge for composure 0–1. */
  function composurePressure() {
    const c = +stats().composure || 0;
    return c <= 0 ? 1.25 : c === 1 ? 1.1 : c === 2 ? 1.0 : 0.85;
  }

  // ---------- Caregiver voice (original; warm / firm / practical) ----------
  const NICK = ['sweetie', 'dear', 'love'];
  function nick() { return NICK[Math.floor(Date.now() / 864e5) % NICK.length]; }
  function line(kind, ctx) {
    ctx = ctx || {};
    if (!caregiverOn()) {
      const S = {
        class_start: 'Class locked in. Press when you need to go.',
        resolve_ok: 'Rule followed — stay put.',
        resolve_acc: 'Accident logged — token moves back.',
        mayi_yes: 'Yes — you may go.',
        mayi_no: 'Not yet — wait, then go.',
        change_yes: 'You may change now.',
        change_later: 'Not yet — ask again later.',
        change_into: ctx.into ? `Suggested: ${ctx.into}${ctx.reason ? ' (' + ctx.reason + ')' : ''}.` : '',
        checkin: 'Enter your urgency and saturation.',
        night_tip: 'Morning check-in counts toward your campaign.',
        clip_wet: ctx.where ? `Clip wet while ${ctx.where}.` : 'Clip wet flagged.'
      };
      return S[kind] || '';
    }
    const n = nick();
    const C = {
      class_start: ctx.className
        ? `Alright ${n}, Mommy picked ${ctx.className} for you. Listen close, follow the rules, and ask when you need something.`
        : `Alright ${n}, Mommy's watching. Follow the rules and ask when you need something.`,
      resolve_ok: `Good job, ${n}. Mommy's proud you followed that. Stay right there.`,
      resolve_acc: `Oh ${n}… that one got away. That's alright — we clean up and keep going.`,
      mayi_yes: `Okay ${n}, Mommy says yes — you may use the potty. Go on.`,
      mayi_no: `Not yet, ${n}. Mommy wants you to wait a little. Use your padding if you truly can't.`,
      change_yes: `Yes, ${n} — you may change now. Fresh gear, then back to it.`,
      change_later: `Not yet, ${n}. Mommy says stay padded until it's soggy enough — or if your skin needs it, change.`,
      change_into: ctx.leaked
        ? `Oh ${n}, you leaked… Mommy wants you in ${ctx.into || 'fresh padding'} next${ctx.reason ? ' (' + ctx.reason + ')' : ''}. Let's get you cleaned up.`
        : `Alright ${n}, Mommy wants you in ${ctx.into || 'fresh padding'} next${ctx.reason ? ' (' + ctx.reason + ')' : ''}. Change carefully, then come tell Mommy you're set.`,
      checkin: `Tell Mommy honestly, ${n}: how urgent, and how wet is your gear?`,
      night_tip: `Sleep well, ${n}. In the morning, tell Mommy how the night went — it counts.`,
      clip_wet: `Oh ${n}… the clip said wet${ctx.where ? ' while you were ' + ctx.where : ''}. Mommy saw — say if you need a change.`
    };
    return C[kind] || '';
  }

  // ---------- Class cards (Path board classes + Leaky) enriched for start sheet ----------
  function pathClasses() {
    const P = window.BSPath;
    if (!P || !P.CLASSES) return [];
    return P.CLASSES.map(enrichPathClass);
  }
  function enrichPathClass(c) {
    const extra = CLASS_META[c.id] || {};
    return Object.assign({}, c, extra, {
      desc: extra.desc || c.blurb || (c.plus && c.plus[0]) || '',
      mommy: extra.mommy || '',
      solo: extra.solo || '',
      statsHint: extra.statsHint || { constitution: 0, perception: 0, composure: 0 },
      flags: Object.assign({}, c.flags || {}, extra.flags || {})
    });
  }
  // Original copy; mechanical flags wired in potty-path / classes / urge
  const CLASS_META = {
    bigkid: {
      desc: 'Full-roll moves, big-kid stage start. Accidents in later stages sting harder.',
      mommy: 'You\'re my big one today — full steps forward, but Mommy expects you to make those potty rules.',
      solo: 'Move the full dice total. Stage 3–4 accidents send you to the previous STOP.',
      statsHint: { constitution: 1, perception: 0, composure: 1 },
      flags: { holdScale: 1.05, accessBonus: 0.15 }
    },
    scout: {
      desc: 'Spare kit once per stage; check-in on every go. Half moves, round up into STOPs.',
      mommy: 'Scout rules, love — pack your spare, and check in with Mommy every single go.',
      solo: 'One spare ignore-accident per stage. Every go asks for your urgency.',
      statsHint: { constitution: 0, perception: 1, composure: 1 },
      flags: { alwaysCheck: true, accessBonus: 0.1 }
    },
    padgirl: {
      desc: 'Pads matter. Redirect mastery into Accident track; limited changes until that track is done.',
      mommy: 'Pad day, sweetie. Mommy wants honest checks — one change until you\'ve learned from the drips.',
      solo: 'One change/day until Accident Mastery (skin comfort always overrides). Pads in stash required.',
      statsHint: { constitution: 0, perception: 1, composure: 0 },
      flags: { padsOk: true, changeSatBump: 10 }
    },
    pullup: {
      desc: 'Pull-up dribbler: round half-rolls up, shorter holds, busy-potty chance.',
      mommy: 'Pull-ups on, love. Holds are shorter — Mommy knows you get wiggly fast.',
      solo: 'Hold timers ×0.8. Missing a hold counts as an accident. 1-in-6 potty busy.',
      statsHint: { constitution: -1, perception: 0, composure: 0 },
      flags: { holdScale: 0.8, failHoldIsAcc: true }
    },
    leaky: {
      desc: 'Leaky Girl: need-to-go rolls unlock only after you log a first dribble. Short holds, soggy change gates, pads OK with undies.',
      mommy: 'Leaky rules today, sweetie. Mommy wants a little drip logged before we even talk potty — and we stay padded longer.',
      solo: 'Gate: log a dribble before Path “I need to go”. Constitution dump. Higher May I change? saturation. Pads with underwear allowed.',
      statsHint: { constitution: -2, perception: 1, composure: -1 },
      flags: { needDribbleFirst: true, holdScale: 0.65, changeSatBump: 25, padsWithUndies: true, leakPressure: 1.2 }
    },
    little: {
      desc: 'Leaky Toddler band: bed mastery swings hard; night dry counts double.',
      mommy: 'Little mode, love. Nights matter to Mommy — dry mornings get double stickers.',
      solo: 'Dry nights ×2 on Bed Mastery; wet nights −6. After Bed Mastery, accidents always −3.',
      statsHint: { constitution: -1, perception: 0, composure: -1 },
      flags: { holdScale: 0.9, accessBonus: -0.1 }
    },
    baby: {
      desc: 'Diapers every stage; never moved back for diaper accidents. No potty access.',
      mommy: 'All diaper today, sweetie. Mommy handles changes — no potty fretting.',
      solo: 'Potty rules become diaper-by-the-potty. Unlimited changes. No #2 mastery.',
      statsHint: { constitution: -1, perception: -1, composure: 0 },
      flags: { holdScale: 0.75, accessBonus: -1, changeSatBump: 20 }
    },
    cascade: {
      desc: '#2-focused: potty allowed for #2 when rules permit; tummy flag daily; #2 accidents hurt more.',
      mommy: 'Tummy day, love — Mommy keeps the potty ready for #2, but accidents cost extra steps.',
      solo: '#2 potty perk; tummy trouble every day (flag only). #2 accidents move back double.',
      statsHint: { constitution: 0, perception: 0, composure: -1 },
      flags: { tummyDaily: true }
    },
    shy: {
      desc: 'Privacy first: optional move-1 / rule-1; landing on a lone “1” steps back one.',
      mommy: 'Shy rules, dear — Mommy gives you privacy. Tiny steps are okay.',
      solo: 'After a roll you may move 1 and use rule 1. A “1” square steps you back 1.',
      statsHint: { constitution: 0, perception: 2, composure: 1 },
      flags: { accessBonus: 0 }
    }
  };

  function classCardHtml(c, selected, mode) {
    const care = mode === 'caregiver';
    const voice = care ? (c.mommy || c.solo) : (c.solo || c.desc);
    const plus = (c.plus || []).map(x => `<li class="pp-perk-plus">+ ${esc(x)}</li>`).join('');
    const minus = (c.minus || []).concat(c.flags && c.flags.needDribbleFirst ? ['Need-to-go unlocks after a logged dribble'] : []).map(x => `<li class="pp-perk-minus">− ${esc(x)}</li>`).join('');
    const sh = c.statsHint || {};
    const mods = STAT_KEYS.filter(k => sh[k]).map(k => `${STAT_LABEL[k].split(' ')[0]} ${sh[k] > 0 ? '+' : ''}${sh[k]}`).join(' · ');
    const fl = c.flags || {};
    const mech = [];
    if (fl.holdScale && fl.holdScale !== 1) mech.push(`holds ×${fl.holdScale}`);
    if (fl.changeSatBump) mech.push(`change sat +${fl.changeSatBump}`);
    if (fl.needDribbleFirst) mech.push('dribble gate');
    if (fl.accessBonus) mech.push(`access ${fl.accessBonus > 0 ? '+' : ''}${Math.round(fl.accessBonus * 100)}%`);
    if (fl.failHoldIsAcc) mech.push('missed hold = accident');
    return `<button type="button" class="pp-class-card pp-class-card-wide ${selected === c.id ? 'on' : ''}" data-cls="${esc(c.id)}" ${c._blocked ? 'disabled' : ''}>
      <div class="pp-cc-top"><b>${esc(c.name)}</b> <small>${esc(c.band || '')}</small>${c.from ? ` <small class="muted">· ${esc(c.from)}</small>` : ''}</div>
      <div class="pp-cc-desc">${esc(c.desc || '')}</div>
      <div class="pp-cc-voice">${esc(voice || '')}</div>
      <ul class="pp-cc-perks">${plus}${minus}</ul>
      ${mech.length ? `<div class="pp-cc-mech">Mechanics: ${esc(mech.join(' · '))}</div>` : ''}
      ${mods ? `<div class="cal-legend">Stat lean: ${esc(mods)}</div>` : ''}
      ${c._blocked ? '<div class="cal-legend">Not in stash — take 🎒 Stash & Gear first</div>' : ''}
    </button>`;
  }

  function openStartSheet(opts) {
    opts = opts || {};
    const target = opts.target || 'path'; // path | campaign
    const prev = loadStart();
    const draft = {
      mode: prev.mode || 'solo',
      classId: prev.classId || null,
      stats: Object.assign({ constitution: 1, perception: 1, composure: 1 }, prev.stats || {}),
      boardMode: opts.boardMode || prev.boardMode || 'free',
      nightFocus: prev.nightFocus === true,
      experience: prev.experience || 'standard',
      ladderMode: prev.ladderMode || 'target',
      startStage: opts.startStage
    };
    // Steps: 0 mode, 1 experience+ladder, 2 class, 3 stats, 4 confirm
    let step = 0;
    const STEPS = 5;
    const w = document.createElement('div');
    w.className = 'cal-sheet-wrap pp-sheet-wrap';
    w.id = 'ppStartSheet';
    w.innerHTML = '<div class="cal-sheet pp-ev pp-start-wide" role="dialog" aria-modal="true" id="ppStartBody"></div>';
    document.body.appendChild(w);
    const body = () => w.querySelector('#ppStartBody');
    const budgetLeft = () => STAT_BUDGET - STAT_KEYS.reduce((a, k) => a + (+draft.stats[k] || 0), 0);
    const pct = () => Math.round(((step + 1) / STEPS) * 100);
    const nav = (backTo, nextTo, nextLabel) =>
      `<div class="quiz-nav"><button type="button" id="ppStBack">${backTo == null ? 'Cancel' : '← Back'}</button><button type="button" id="ppStNext" class="pp-ok">${nextLabel || 'Next →'}</button></div>`;
    const wireNav = (el, backTo, nextFn) => {
      el.querySelector('#ppStBack').onclick = () => { if (backTo == null) w.remove(); else { step = backTo; paint(); } };
      el.querySelector('#ppStNext').onclick = () => nextFn();
    };

    const paint = () => {
      const el = body();
      if (step === 0) {
        el.innerHTML = `<h3>${target === 'campaign' ? '🏅 Campaign deep start' : '🎲 Path deep start'}</h3>
          <div class="cal-legend">Step 1 / ${STEPS} · Mode</div>
          <div class="quiz-progress"><i style="width:${pct()}%"></i></div>
          <div class="seg nn-seg" id="ppModeSeg">
            <label><input type="radio" name="ppMode" value="solo" ${draft.mode === 'solo' ? 'checked' : ''}> Solo</label>
            <label><input type="radio" name="ppMode" value="caregiver" ${draft.mode === 'caregiver' ? 'checked' : ''}> Caregiver (mommy)</label>
          </div>
          <div class="camp-goal" id="ppModeBlurb"></div>
          <div class="quiz-q">App look</div>
          <div id="ppThemeSeg"></div>
          <div class="cal-legend">Live preview — backgrounds, accents, buttons, cards, nav. Adult-safe; Settings keeps the same choice.</div>
          <div class="pp-start-quizzes"><b>Related quizzes</b> (optional, open any time)
            <div class="camp-actions" id="ppStQz0"></div></div>
          ${nav(null)}`;
        const blurb = () => {
          el.querySelector('#ppModeBlurb').innerHTML = draft.mode === 'caregiver'
            ? '<b>Caregiver:</b> warmer mommy prompts on start, resolve, May I?, and change. More check-in / May I gating. <b>⏸ I\'m going now</b> always works.'
            : '<b>Solo:</b> plainer copy and more self-resolution. Same board rules. <b>⏸ I\'m going now</b> always works.';
        };
        blurb();
        el.querySelectorAll('input[name=ppMode]').forEach(r => r.onchange = () => { draft.mode = r.value; blurb(); });
        try {
          const host = el.querySelector('#ppThemeSeg');
          const cur = draft.theme || (window.BSHub && window.BSHub.themeId && window.BSHub.themeId()) || 'neutral';
          if (host && window.BSHub && window.BSHub.themePickerHtml) {
            host.innerHTML = window.BSHub.themePickerHtml('ppTheme', cur);
          } else if (host) {
            host.innerHTML = `<div class="seg nn-seg"><label><input type="radio" name="ppTheme" value="neutral" checked> Neutral</label></div>`;
          }
          el.querySelectorAll('input[name=ppTheme]').forEach(r => r.onchange = () => { draft.theme = r.value; try { if (window.BSHub && window.BSHub.setTheme) window.BSHub.setTheme(r.value); } catch (e) {} });
        } catch (e) {}
        fillQuizStrip(el.querySelector('#ppStQz0'), target);
        wireNav(el, null, () => { step = 1; paint(); });
        return;
      }
      if (step === 1) {
        el.innerHTML = `<h3>Experience & ladder</h3>
          <div class="cal-legend">Step 2 / ${STEPS} · What kind of run do you want?</div>
          <div class="quiz-progress"><i style="width:${pct()}%"></i></div>
          <div class="quiz-q">Intensity</div>
          <div class="seg nn-seg pp-exp-seg">
            ${[['gentle', 'Gentle — more rest'], ['standard', 'Standard'], ['intense', 'Intense — fewer rest days']].map(([v, l]) =>
              `<label><input type="radio" name="ppExp" value="${v}" ${draft.experience === v ? 'checked' : ''}> ${l}</label>`).join('')}
          </div>
          <div class="quiz-q">Rank ladder (7 ranks: Big Kid → Little Legend)</div>
          <div class="pp-ladder-opts">
            <label class="qp-flag"><input type="radio" name="ppLad" value="target" ${draft.ladderMode === 'target' ? 'checked' : ''}> <b>Target hop</b> — climb toward one target rank (classic)</label>
            <label class="qp-flag"><input type="radio" name="ppLad" value="full" ${draft.ladderMode === 'full' ? 'checked' : ''}> <b>Full 7-rank climb</b> — start at one end, finish at the other (play every rung)</label>
            <label class="qp-flag"><input type="radio" name="ppLad" value="travel" ${draft.ladderMode === 'travel' ? 'checked' : ''}> <b>Rank travel</b> — go up <i>and</i> down over time (yo-yo the full ladder)</label>
          </div>
          <div class="camp-goal">Full climb / travel suits a long campaign fantasy across all 7 ranks. Path still uses its 4 stages; campaign ranks drive Urge protection & waits.</div>
          ${target === 'campaign' ? `<label class="qp-flag"><input type="checkbox" id="ppNightFocus" ${draft.nightFocus ? 'checked' : ''}> Night focus — dry mornings count toward campaign</label>` : ''}
          <div class="pp-start-quizzes"><b>Shape it with quizzes</b>
            <div class="camp-actions" id="ppStQz1"></div></div>
          ${nav(0)}`;
        el.querySelectorAll('input[name=ppExp]').forEach(r => r.onchange = () => { draft.experience = r.value; });
        el.querySelectorAll('input[name=ppLad]').forEach(r => r.onchange = () => { draft.ladderMode = r.value; });
        const nf = el.querySelector('#ppNightFocus'); if (nf) nf.onchange = () => { draft.nightFocus = nf.checked; };
        fillQuizStrip(el.querySelector('#ppStQz1'), target);
        wireNav(el, 0, () => { step = 2; paint(); });
        return;
      }
      if (step === 2) {
        const stash = window.BSPath && window.BSPath.stashNow ? window.BSPath.stashNow() : null;
        const list = pathClasses().map(c => {
          const ok = !window.BSPath || window.BSPath.classAllowed(c.id, stash);
          return Object.assign({}, c, { _blocked: !ok });
        });
        if (!draft.classId) {
          const sug = window.BSPath && window.BSPath.suggestClass ? window.BSPath.suggestClass(50, stash) : (list.find(c => !c._blocked) || list[0] || {}).id;
          draft.classId = sug;
        }
        el.innerHTML = `<h3>Pick a class</h3>
          <div class="cal-legend">Step 3 / ${STEPS} · Classes change odds, holds, access, change gates — not just flavour</div>
          <div class="quiz-progress"><i style="width:${pct()}%"></i></div>
          <div class="pp-class-grid pp-class-grid-wide" id="ppClassGrid">${list.map(c => classCardHtml(c, draft.classId, draft.mode)).join('')}</div>
          <div class="camp-actions"><button type="button" id="ppWhichClass">🏫 Take Which Class quiz</button></div>
          ${nav(1)}`;
        el.querySelectorAll('[data-cls]').forEach(btn => btn.onclick = () => {
          if (btn.disabled) return;
          draft.classId = btn.dataset.cls;
          paint();
        });
        const wc = el.querySelector('#ppWhichClass');
        if (wc) wc.onclick = () => openSectionQuiz('classquiz');
        wireNav(el, 1, () => { if (draft.classId) { step = 3; paint(); } });
        const nx = el.querySelector('#ppStNext'); if (nx && !draft.classId) nx.disabled = true;
        return;
      }
      if (step === 3) {
        const left = budgetLeft();
        const meta = CLASS_META[draft.classId] || {};
        const hint = meta.statsHint || {};
        el.innerHTML = `<h3>Stat allocator</h3>
          <div class="cal-legend">Step 4 / ${STEPS} · ${STAT_BUDGET} points · ${left} left · holds still ≤ 20 min</div>
          <div class="quiz-progress"><i style="width:${pct()}%"></i></div>
          ${hint.constitution || hint.perception || hint.composure ? `<div class="camp-goal">Class lean: ${STAT_KEYS.filter(k => hint[k]).map(k => `${k} ${hint[k] > 0 ? '+' : ''}${hint[k]}`).join(', ')} (on top of your spend)</div>` : ''}
          ${STAT_KEYS.map(k => `<label class="fld pp-stat-row"><span>${esc(STAT_LABEL[k])} <b id="stV_${k}">${draft.stats[k]}</b></span>
            <input type="range" min="0" max="3" step="1" value="${draft.stats[k]}" data-st="${k}"></label>`).join('')}
          <div class="cal-legend">Perception ≤1 soft-fogs hold timers. Constitution scales hold length. Composure nudges leak pressure.</div>
          ${nav(2)}`;
        el.querySelectorAll('[data-st]').forEach(inp => {
          inp.oninput = () => {
            const k = inp.dataset.st, want = +inp.value;
            const others = STAT_KEYS.filter(x => x !== k).reduce((a, x) => a + draft.stats[x], 0);
            draft.stats[k] = Math.min(want, Math.max(0, STAT_BUDGET - others));
            inp.value = draft.stats[k];
            el.querySelector('#stV_' + k).textContent = draft.stats[k];
            el.querySelector('.cal-legend').textContent = `Step 4 / ${STEPS} · ${STAT_BUDGET} points · ${budgetLeft()} left · holds still ≤ 20 min`;
          };
        });
        wireNav(el, 2, () => { step = 4; paint(); });
        return;
      }
      // confirm
      const c = pathClasses().find(x => x.id === draft.classId) || { name: draft.classId, plus: [], minus: [] };
      const voice = line('class_start', { className: c.name });
      const ladLbl = { target: 'Target hop', full: 'Full 7-rank climb', travel: 'Rank travel (up & down)' }[draft.ladderMode] || draft.ladderMode;
      el.innerHTML = `<h3>Confirm</h3>
        <div class="cal-legend">Step ${STEPS} / ${STEPS}</div>
        <div class="quiz-progress"><i style="width:100%"></i></div>
        <div class="camp-card pp-confirm-card">
          <div><b>${esc(draft.mode === 'caregiver' ? 'Caregiver (mommy)' : 'Solo')}</b> · <b>${esc(c.name || '')}</b></div>
          <div class="cal-legend">CON ${draft.stats.constitution} · PER ${draft.stats.perception} · CMP ${draft.stats.composure}</div>
          <div class="cal-legend">Experience: ${esc(draft.experience)} · Ladder: ${esc(ladLbl)}${draft.nightFocus ? ' · Night focus on' : ''}</div>
          ${voice ? `<div class="pp-cc-voice">${esc(voice)}</div>` : ''}
          <ul class="pp-cc-perks">${(c.plus || []).slice(0, 3).map(x => `<li class="pp-perk-plus">+ ${esc(x)}</li>`).join('')}${(c.minus || []).slice(0, 2).map(x => `<li class="pp-perk-minus">− ${esc(x)}</li>`).join('')}</ul>
        </div>
        <div class="quiz-nav"><button type="button" id="ppStBack">← Back</button><button type="button" id="ppStGo" class="pp-ok">▶ Begin</button></div>`;
      el.querySelector('#ppStBack').onclick = () => { step = 3; paint(); };
      el.querySelector('#ppStGo').onclick = () => {
        const saved = saveStart({
          mode: draft.mode,
          classId: draft.classId,
          stats: draft.stats,
          boardMode: draft.boardMode,
          nightFocus: !!draft.nightFocus,
          experience: draft.experience,
          ladderMode: draft.ladderMode,
          theme: draft.theme || 'neutral'
        });
        try { if (window.BSHub && window.BSHub.setTheme) window.BSHub.setTheme(saved.theme || draft.theme || 'neutral'); } catch (e) {}
        try {
          const map = { leaky: 'dribbler', pullup: 'dribbler', shy: 'quiet_one', scout: 'scout', baby: 'little_legend', little: 'care_charge', bigkid: 'trainee', padgirl: 'fast_filler', cascade: 'sleepyhead' };
          const cid = map[draft.classId] || draft.classId;
          if (window.BSClasses && window.BSClasses.get(cid)) window.BSClasses.pick(cid);
        } catch (e) {}
        w.remove();
        if (typeof opts.onConfirm === 'function') opts.onConfirm(saved, draft);
        else beginFromStart(target, saved, draft);
      };
    };
    paint();
    return w;
  }

  function beginFromStart(target, saved, draft) {
    saved = saved || loadStart();
    draft = draft || saved;
    if (target === 'campaign') {
      setSurface('campaign');
      const C = window.BSCampaign;
      if (C) {
        const ladderOpts = C.optsFromLadder ? C.optsFromLadder(saved) : {};
        if (!C.load() || !C.load().active) {
          const s = C.start(Object.assign({ playStyle: 'either' }, ladderOpts));
          if (s) {
            s.prefs = Object.assign({}, s.prefs || {}, {
              playMode: saved.mode,
              pathClassId: saved.classId,
              nightFocus: !!saved.nightFocus,
              experience: saved.experience || 'standard',
              ladderMode: saved.ladderMode || 'target'
            });
            C.save(s);
          }
        } else {
          const s = C.load();
          s.prefs = Object.assign({}, s.prefs || {}, {
            playMode: saved.mode, pathClassId: saved.classId, nightFocus: !!saved.nightFocus,
            experience: saved.experience || 'standard', ladderMode: saved.ladderMode || 'target'
          });
          if (ladderOpts.startRank != null && confirm('Apply new ladder preference to this campaign (may reset start/target ranks)?')) {
            Object.assign(s, ladderOpts);
            if (C.applyRank) C.applyRank(s);
          }
          C.save(s);
        }
      }
      if (typeof toast === 'function') toast(caregiverOn() ? line('class_start', { className: (CLASS_META[saved.classId] && saved.classId) || 'campaign' }) : 'Campaign ready');
      renderPlay();
      return;
    }
    // Path board
    setSurface('path');
    const P = window.BSPath;
    if (!P) return;
    const o = P.optsFromQuizzes(draft.boardMode || 'free');
    o.classId = saved.classId;
    o.holdScale = holdScaleFromStats(saved.stats);
    // Apply class flag holdScale on top
    const meta = CLASS_META[saved.classId];
    if (meta && meta.flags && meta.flags.holdScale) o.holdScale *= meta.flags.holdScale;
    if (draft.startStage != null && draft.startStage !== '') o.startStage = +draft.startStage;
    o.hidden = timerFog() || !!o.hidden;
    const b = P.newBoard(o);
    b.playMode = saved.mode;
    b.playStats = Object.assign({}, saved.stats);
    b.dribbleGate = !!(meta && meta.flags && meta.flags.needDribbleFirst);
    b.dribbleLogged = false;
    b.changeSatBump = (meta && meta.flags && meta.flags.changeSatBump) || 0;
    b.padsWithUndies = !!(meta && meta.flags && meta.flags.padsWithUndies);
    if (meta && meta.flags && meta.flags.tummyDaily) b.flags.tummy = true;
    P.save(b);
    const notes = [];
    if (caregiverOn()) notes.push(line('class_start', { className: (P.CLASS_BY_ID[b.classId] || {}).name }));
    else notes.push(`Board ready as ${(P.CLASS_BY_ID[b.classId] || {}).name}.`);
    if (b.dribbleGate) notes.push('💧 Leaky gate: log a dribble before your first need-to-go roll.');
    if (window.BSPath) { /* lastNotes via render */ }
    try { window._ppLastNotes = notes; } catch (e) {}
    P.render();
  }

  function toggleHtml() {
    const s = surface();
    return `<div class="pp-surface-toggle seg nn-seg" role="tablist" aria-label="Path or Campaign">
      <label><input type="radio" name="ppSurf" value="path" ${s === 'path' ? 'checked' : ''}> Path</label>
      <label><input type="radio" name="ppSurf" value="campaign" ${s === 'campaign' ? 'checked' : ''}> Campaign</label>
    </div>
    <div class="cal-legend pp-surf-note">${s === 'path'
      ? 'Interactive board. Campaign can run at the same time via Urge, nights, and calendar goals.'
      : 'Campaign goals track from calendar / Urge / mornings even when you are not on the board.'}</div>`;
  }

  function bindToggle(root) {
    if (!root) return;
    root.querySelectorAll('input[name=ppSurf]').forEach(r => {
      r.onchange = () => { setSurface(r.value); renderPlay(); };
    });
  }

  function renderPlay() {
    const m = document.getElementById('pathMount');
    if (!m) return;
    if (surface() === 'campaign') {
      // Keep Profiles #campaignMount intact: clone-render into a path-local host via temp id swap
      m.innerHTML = `<div id="ppPlayChrome">${toggleHtml()}</div><div id="campaignMountPath"></div>`;
      bindToggle(m.querySelector('#ppPlayChrome'));
      const host = document.getElementById('campaignMountPath');
      const profileMount = document.querySelector('#tab-profiles #campaignMount') || document.getElementById('campaignMount');
      if (window.BSCampaign && host) {
        const prevId = profileMount && profileMount !== host ? profileMount.id : null;
        if (profileMount && profileMount !== host) profileMount.removeAttribute('id');
        host.id = 'campaignMount';
        try { window.BSCampaign.render(); } catch (e) { console.warn(e); }
        host.id = 'campaignMountPath';
        if (profileMount && prevId) profileMount.id = prevId;
        const note = document.createElement('div');
        note.className = 'camp-goal';
        const wrap = document.createElement('div');
        wrap.innerHTML = reviewHtml('campaign') + sectionQuizzesHtml('campaign') +
          `<div class="camp-goal">Campaign goals keep counting from Urge, calendar, and DryClip mornings even when Path is closed.
          <button type="button" id="ppCampMayChange">🧷 May I change?</button>
          <button type="button" id="ppCampStartDeep">🎛 Deep start</button></div>`;
        while (wrap.firstChild) host.prepend(wrap.lastChild);
        bindReview(host, 'campaign');
        bindSectionQuizzes(host);
        const mc = host.querySelector('#ppCampMayChange');
        if (mc) mc.onclick = () => openMayChange('campaign_path_tab');
        const btn = host.querySelector('#ppCampStartDeep');
        if (btn) btn.onclick = () => openStartSheet({ target: 'campaign' });
      }
      return;
    }
    // Path board surface
    if (window.BSPath && window.BSPath.renderBoardOnly) window.BSPath.renderBoardOnly();
    else if (window.BSPath) window.BSPath.render();
    const mount = document.getElementById('pathMount');
    if (!mount) return;
    let ch = mount.querySelector('#ppPlayChrome');
    if (!ch) {
      ch = document.createElement('div');
      ch.id = 'ppPlayChrome';
      mount.prepend(ch);
    }
    ch.innerHTML = toggleHtml();
    bindToggle(ch);
    try {
      const rh = mount.querySelector('#ppReviewHost');
      if (rh) { rh.innerHTML = reviewHtml('path'); bindReview(rh, 'path'); }
      const qh = mount.querySelector('#ppQuizHost');
      if (qh) { qh.innerHTML = sectionQuizzesHtml('path'); bindSectionQuizzes(qh); }
    } catch (e) {}
  }

  /** Protection pressure: campaign rank wants thicker gear than current wear → bump change sat threshold. */
  function protectionPressureBump() {
    try {
      const s = window.BSCampaign && window.BSCampaign.load();
      if (!s || !s.active || s.paused) return 0;
      const r = window.BSCampaign.RANKS[s.rank];
      if (!r) return 0;
      const order = ['none', 'pad', 'pads', 'pullups', 'diapers', 'thick_diapers'];
      const want = order.indexOf(r.prot === 'pad' ? 'pad' : r.prot);
      let have = 0;
      try {
        const i = window.BSSimpleUrge && window.BSSimpleUrge.inv();
        const w = (i && i.wearing) || 'none';
        have = order.indexOf(w === 'pads' ? 'pad' : w);
      } catch (e) {}
      if (want > have && want >= 0 && have >= 0) return Math.min(20, (want - have) * 8);
    } catch (e) {}
    // Path board class bump
    try {
      const b = window.BSPath && window.BSPath.load();
      if (b && b.changeSatBump) return +b.changeSatBump || 0;
    } catch (e) {}
    const st = loadStart();
    const meta = CLASS_META[st.classId];
    return (meta && meta.flags && meta.flags.changeSatBump) || 0;
  }



  // ---------- Section quizzes (Path / Campaign — not only Profiles hub) ----------
  const PATH_QUIZZES = [
    { id: 'classquiz', label: '🏫 Which Class', via: 'plus' },
    { id: 'longBoard', label: '🎲 Long board', via: 'plus' },
    { id: 'gear', label: '🎒 Stash & Gear', via: 'plus' },
    { id: 'sliders', label: '🎚 Self-Rating', via: 'plus' },
    { id: 'board', label: '🎲 Board pack', via: 'pack' }
  ];
  const CAMP_QUIZZES = [
    { id: 'longCamp', label: '🏅 Long campaign', via: 'plus' },
    { id: 'readiness', label: '📋 Readiness', via: 'pack' },
    { id: 'classquiz', label: '🏫 Which Class', via: 'plus' },
    { id: 'recap', label: '📓 Day recap', via: 'pack' },
    { id: 'maturity', label: '🧸 Maturity', via: 'pack' }
  ];
  function openSectionQuiz(id) {
    try {
      if (window.BSQuizPlus && window.BSQuizPlus.QUIZZES && window.BSQuizPlus.QUIZZES[id]) {
        window.BSQuizPlus.run(id, () => { try { renderPlay(); } catch (e) {} });
        return true;
      }
      if (window.BSQuiz && typeof window.BSQuiz.begin === 'function') {
        // Packs / A-B-C live on BSQuiz
        window.BSQuiz.begin(id);
        return true;
      }
    } catch (e) { console.warn(e); }
    if (typeof switchTab === 'function') switchTab('profiles');
    if (typeof toast === 'function') toast('Open Profiles › Quizzes for that one');
    return false;
  }
  function sectionQuizzesHtml(which) {
    const list = which === 'campaign' ? CAMP_QUIZZES : PATH_QUIZZES;
    return `<div class="pp-section-quizzes camp-card">
      <div class="calib-big" style="font-size:14px;">📚 ${which === 'campaign' ? 'Campaign' : 'Path'} quizzes</div>
      <div class="cal-legend">Take these here — same quizzes as Profiles, wired into this section.</div>
      <div class="camp-actions">${list.map(q => `<button type="button" data-sqz="${esc(q.id)}">${esc(q.label)}</button>`).join('')}</div>
    </div>`;
  }
  function fillQuizStrip(host, which) {
    if (!host) return;
    const list = which === 'campaign' ? CAMP_QUIZZES : PATH_QUIZZES;
    host.innerHTML = list.map(q => `<button type="button" data-sqz="${esc(q.id)}">${esc(q.label)}</button>`).join('');
    bindSectionQuizzes(host);
  }
  function bindSectionQuizzes(root) {
    if (!root) return;
    root.querySelectorAll('[data-sqz]').forEach(btn => {
      btn.onclick = () => openSectionQuiz(btn.dataset.sqz);
    });
  }

  // ---------- Review panel (stats-driven, on Path + Campaign) ----------
  function reviewHtml(which) {
    const st = loadStart();
    const stats = Object.assign({ constitution: 1, perception: 1, composure: 1 }, st.stats || {});
    const clsId = st.classId;
    let clsName = clsId || '—';
    try {
      if (window.BSPath && window.BSPath.CLASS_BY_ID && clsId) clsName = (window.BSPath.CLASS_BY_ID[clsId] || {}).name || clsId;
    } catch (e) {}
    const lad = { target: 'Target hop', full: 'Full 7-rank climb', travel: 'Rank travel (up & down)' }[st.ladderMode] || 'Target hop';
    let stageOrRank = '—', prot = '—', recent = 'No recent rolls yet.', nightLine = st.nightFocus ? 'Night focus on' : 'Night focus off';
    const lines = [];

    if (which === 'path' || which === 'both') {
      try {
        const b = window.BSPath && window.BSPath.load();
        if (b) {
          const S = window.BSPath.STAGES[window.BSPath.stageOf(b.pos)];
          stageOrRank = `${(window.BSPath.CLASS_BY_ID[b.classId] || {}).name || b.classId} · ${S ? S.short : '?'} · sq ${b.pos}/60 · ⭐ ${b.stars}`;
          prot = S ? S.gear : '—';
          const hist = (b.history || []).slice(-5).reverse();
          if (hist.length) {
            recent = hist.map(h => {
              const o = h.outcome === 'refuse' ? `🙅 refuse d${h.refuse || '?'}` : h.outcome === 'acc' ? '💦 acc' : h.outcome === 'real' ? '⏸' : '✅';
              return `${o} @${h.pos}${h.feature ? ' · ' + h.feature : ''}`;
            }).join(' · ');
          }
          if (b.mastery) {
            lines.push(`Mastery: bed ${b.mastery.bed}/12 · acc ${b.mastery.acc}/12 · #2 ${b.mastery.poo}/12`);
          }
        } else stageOrRank = 'No board yet — Deep start to begin';
      } catch (e) {}
    }
    if (which === 'campaign' || which === 'both') {
      try {
        const s = window.BSCampaign && window.BSCampaign.load();
        if (s && s.active) {
          const R = window.BSCampaign.RANKS;
          const r = R[s.rank], t = R[s.target];
          stageOrRank = `${r ? r.name : '?'} → ${t ? t.name : '?'} (${s.streakPass}/${s.promoteDays} good days)`;
          prot = r ? r.prot : '—';
          const today = window.BSCampaign.scoreDay(s, window.BSCampaign.dayKey(Date.now()));
          lines.push(`Today ${today.met}/${today.total} goals` + (today.goals ? ': ' + today.goals.map(g => (g.ok ? '✅' : '⬜') + ' ' + g.label).join('; ') : ''));
          const hist = (s.history || []).slice(-7);
          if (hist.length) recent = hist.map(h => ({ pass: '✅', fail: '✖', rest: '🛋', idle: '·', promoted: '⬆', demoted: '⬇' }[h.result] || h.result)).join(' ');
          const lm = (s.prefs && s.prefs.ladderMode) || st.ladderMode || 'target';
          lines.push('Ladder: ' + ({ target: 'Target hop', full: 'Full 7-rank climb', travel: 'Rank travel' }[lm] || lm));
          if (s.prefs && s.prefs.nightFocus || st.nightFocus) {
            const g = today.goals && today.goals.find(x => x.id === 'dryMorning');
            nightLine = g ? `Night focus · dry morning ${g.ok ? '✅' : '⬜'} (${g.val})` : 'Night focus on';
          }
        } else if (which === 'campaign') stageOrRank = 'No active campaign — Deep start to begin';
      } catch (e) {}
    }

    return `<details class="sess-more pp-review" id="ppReview" open>
      <summary>📊 ${which === 'campaign' ? 'Campaign' : 'Path'} review</summary>
      <div class="camp-card">
        <div class="calib-big" style="font-size:15px;">${esc(clsName)}</div>
        <div class="cal-legend">CON ${stats.constitution} · PER ${stats.perception} · CMP ${stats.composure} · ${esc(st.mode || 'solo')} · ${esc(st.experience || 'standard')}</div>
        <div class="camp-goal"><b>Progress:</b> ${esc(stageOrRank)}</div>
        <div class="camp-goal"><b>Protection goal:</b> ${esc(prot)}</div>
        <div class="camp-goal"><b>Ladder:</b> ${esc(lad)}</div>
        <div class="camp-goal"><b>Recent:</b> ${esc(recent)}</div>
        <div class="camp-goal"><b>Nights:</b> ${esc(nightLine)}</div>
        ${lines.map(l => `<div class="cal-legend">${esc(l)}</div>`).join('')}
        <div class="camp-actions"><button type="button" id="ppReviewDeep">🎛 Deep start</button><button type="button" id="ppMayFromReview">🧷 May I change?</button></div>
        <div class="pp-clip-toggles camp-card" style="margin-top:8px;">
          <div class="calib-big" style="font-size:13px;">📎 DryClip assists</div>
          <div class="cal-legend">Opt-in. Settle/touch wets stay ignored. Soft play keeps consequences light.</div>
          <label class="qp-flag"><input type="checkbox" id="ppClipPath" ${(function(){ try { return window.BSHub && window.BSHub.clipAssistPathOn && window.BSHub.clipAssistPathOn() ? 'checked' : ''; } catch(e){ return ''; } })()}> Clip assists Path (holds + event guides)</label>
          <label class="qp-flag"><input type="checkbox" id="ppClipCamp" ${(function(){ try { return window.BSHub && window.BSHub.clipAssistCampaignOn && window.BSHub.clipAssistCampaignOn() ? 'checked' : ''; } catch(e){ return ''; } })()}> Clip assists Campaign (leak goals)</label>
          <label class="qp-flag"><input type="checkbox" id="ppClipNight" ${(function(){ try { return window.BSHub && window.BSHub.pathClipBridgeOn && window.BSHub.pathClipBridgeOn() ? 'checked' : ''; } catch(e){ return ''; } })()}> Path night bridge (Bed Mastery / morning)</label>
        </div>
      </div>
    </details>`;
  }
  function bindReview(root, which) {
    if (!root) return;
    const d = root.querySelector('#ppReviewDeep'); if (d) d.onclick = () => openStartSheet({ target: which === 'campaign' ? 'campaign' : 'path' });
    const m = root.querySelector('#ppMayFromReview'); if (m) m.onclick = () => openMayChange(which === 'campaign' ? 'campaign_review' : 'path_review');
    const bindPref = (id, key, onMsg, offMsg) => {
      const el = root.querySelector('#' + id); if (!el) return;
      el.onchange = () => {
        try {
          if (window.BSHub && window.BSHub.savePlayPrefs) window.BSHub.savePlayPrefs({ [key]: !!el.checked });
          if (typeof toast === 'function') toast(el.checked ? onMsg : offMsg);
        } catch (e) {}
      };
    };
    bindPref('ppClipPath', 'clipAssistPath', 'Clip assists Path on', 'Clip assists Path off');
    bindPref('ppClipCamp', 'clipAssistCampaign', 'Clip assists Campaign on', 'Clip assists Campaign off');
    bindPref('ppClipNight', 'pathClipBridge', 'Path night bridge on', 'Path night bridge off');
  }


  /** Standing May I change? — opens BSChange; used by Path board, go sheet, and Campaign. */
  function openMayChange(ctx, extra) {
    extra = extra || {};
    try {
      if (window.BSChange && window.BSChange.open) {
        window.BSChange.open(Object.assign({ ctx: ctx || 'play' }, extra));
        return true;
      }
    } catch (e) { console.warn(e); }
    if (typeof toast === 'function') toast('May I change? is unavailable right now');
    return false;
  }

  /* v36: after a void / let-go event guide in protection, chain straight into May I change? so the guide never ends without the check. */
  (function chainMayChangeAfterGuide() {
    function hook() {
      if (typeof window.closeVoidGuide !== 'function' || window.closeVoidGuide._bs36) return;
      const orig = window.closeVoidGuide;
      const w = function () {
        let chain = false;
        try {
          const prev = (typeof isPreviewMode !== 'undefined') && isPreviewMode;
          const rest = (typeof isRestroomTrip !== 'undefined') && isRestroomTrip;
          const seq = (typeof currentGuideSeq !== 'undefined' && currentGuideSeq) || [];
          const voidish = seq.some(st => st && (st.type === 'relax' || /LET GO|RELEASE|FLOOD|STREAM|WET|VOID|PEE/i.test(st.text || '')));
          const t = (typeof currentGuideType !== 'undefined') ? currentGuideType : '';
          chain = !prev && !rest && voidish && t !== 'gauntlet' && localStorage.getItem('bs_guide_maychange') !== 'off';
        } catch (e) {}
        const r = orig.apply(this, arguments);
        if (chain) setTimeout(() => {
          try { if (typeof toast === 'function') toast('🧷 Guide done — May I change? check'); } catch (e) {}
          openMayChange('after_guide', { forced: true });
        }, 700);
        return r;
      };
      w._bs36 = 1;
      window.closeVoidGuide = w;
    }
    hook(); setTimeout(hook, 0); if (document.readyState !== 'complete') window.addEventListener('load', hook);
  })();

  window.BSPathPlay = {
    START_KEY, SURFACE_KEY, STAT_BUDGET, STAT_KEYS, CLASS_META,
    loadStart, saveStart, surface, setSurface, caregiverOn, stats,
    holdScaleFromStats, timerFog, composurePressure, line, nick,
    pathClasses, openStartSheet, beginFromStart, renderPlay, toggleHtml,
    protectionPressureBump, enrichPathClass, openMayChange,
    reviewHtml, bindReview, sectionQuizzesHtml, bindSectionQuizzes, openSectionQuiz,
    PATH_QUIZZES, CAMP_QUIZZES
  };
  window.renderPath = function () { renderPlay(); };
})();
