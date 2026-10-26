/* ===========================
   board.js — Potty Path board demo + Test Mode (v14b)
   Storage: bs_board_v1 (v2 shape). Landings are phone-simple event guides.
   Hard rules: no sexual content; no real-body untraining; real-urge override on every square;
   skin-safety note on change gates. Office mode uses coach/neutral deny lines.
   =========================== */
(function () {
  const KEY = 'bs_board_v1';
  const KINDS = ['timer', 'guide', 'let_go', 'may_i', 'change', 'hold', 'rest', 'mystery', 'punish', 'checkin'];
  const KIND_LABEL = {
    timer: '⏱ Timer', guide: '▶ Guide', let_go: '🌊 Let go', may_i: '🙋 May I?',
    change: '🔄 Change', hold: '💪 Hold', rest: '🛋 Rest', mystery: '❓ Mystery',
    punish: '⚖️ Punish', checkin: '📋 Check-in'
  };
  const BANDS = ['good', 'okay', 'shaky', 'little', 'none'];
  const BAND_LABEL = { good: 'Good', okay: 'Okay', shaky: 'Shaky', little: 'Little', none: 'None' };
  const ZONES = [
    { id: 'baby', name: 'Baby', lo: 0, hi: 0.2 },
    { id: 'toddler', name: 'Toddler', lo: 0.2, hi: 0.45 },
    { id: 'preschool', name: 'Preschool', lo: 0.45, hi: 0.7 },
    { id: 'bigkid', name: 'Big Kid', lo: 0.7, hi: 0.9 },
    { id: 'grownup', name: 'Grown-up', lo: 0.9, hi: 1.01 }
  ];

  // Wait bands: shown vs hidden + example lengths (flavour for demo / Test Mode)
  const WAIT = {
    good:   { hide: false, lo: 15, hi: 30, label: 'shown wait' },
    okay:   { hide: false, lo: 10, hi: 25, label: 'shown wait' },
    shaky:  { hide: true,  lo: 8,  hi: 20, label: 'hidden ~50%' },
    little: { hide: true,  lo: 5,  hi: 15, label: 'hidden' },
    none:   { hide: true,  lo: 3,  hi: 12, label: 'hidden; length revealed at end' }
  };

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function ri(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function zoneFor(pos, length) {
    const p = (pos - 1) / Math.max(1, length - 1);
    for (let i = 0; i < ZONES.length; i++) if (p < ZONES[i].hi) return ZONES[i];
    return ZONES[ZONES.length - 1];
  }

  function generateSnakesLadders(length, seed, rng) {
    const snakes = [], ladders = [];
    const nS = Math.max(2, Math.round(length / 15));
    const nL = Math.max(2, Math.round(length / 15));
    const used = {};
    function slot() {
      for (let tries = 0; tries < 40; tries++) {
        const a = ri(rng, 3, length - 2);
        if (!used[a]) { used[a] = true; return a; }
      }
      return null;
    }
    for (let i = 0; i < nS; i++) {
      const from = slot(); if (from == null) break;
      const to = Math.max(1, from - ri(rng, Math.max(2, Math.floor(length * 0.08)), Math.max(3, Math.floor(length * 0.25))));
      if (to < from) snakes.push([from, to]);
    }
    for (let i = 0; i < nL; i++) {
      const from = slot(); if (from == null) break;
      const to = Math.min(length, from + ri(rng, Math.max(2, Math.floor(length * 0.08)), Math.max(3, Math.floor(length * 0.25))));
      if (to > from) ladders.push([from, to]);
    }
    return { snakes, ladders };
  }

  function assignSquares(length, rng) {
    const squares = {};
    // denser mid-board; always include a check-in near 1/3 and 2/3
    const dens = Math.max(8, Math.round(length * 0.55));
    const pool = KINDS.slice();
    const used = { 1: true, [length]: true };
    function freeSlot() {
      for (let t = 0; t < 50; t++) {
        const s = ri(rng, 2, length - 1);
        if (!used[s]) { used[s] = true; return s; }
      }
      return null;
    }
    const c1 = Math.max(2, Math.round(length / 3));
    const c2 = Math.max(c1 + 1, Math.round((2 * length) / 3));
    [c1, c2].forEach(s => { if (!used[s]) { squares[s] = 'checkin'; used[s] = true; } });
    for (let i = 0; i < dens; i++) {
      const s = freeSlot(); if (s == null) break;
      squares[s] = pick(rng, pool);
    }
    return squares;
  }

  function blankBoard(opts) {
    opts = opts || {};
    const length = Math.max(10, Math.min(200, +(opts.length || 60)));
    const seed = opts.seed != null ? (+opts.seed >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const dir = opts.dir || 'grow';
    const rng = mulberry32(seed);
    const { snakes, ladders } = generateSnakesLadders(length, seed, rng);
    const squares = assignSquares(length, rng);
    const pos = dir === 'slide' ? length : 1;
    return {
      v: 2,
      campaignId: opts.campaignId || null,
      length, seed, dir, pos,
      zone: zoneFor(pos, length).id,
      snakes, ladders, squares,
      stars: 0,
      pending: null,
      effects: [],
      punish: [],
      nightLog: [],
      lastSettled: 0,
      history: [],
      testLog: [],
      band: opts.band || 'okay',
      testMode: !!opts.testMode,
      finished: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save(b) {
    if (!b) { localStorage.removeItem(KEY); return; }
    b.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {}
  }

  function kindAt(b, pos) {
    if (b.squares && b.squares[pos]) return b.squares[pos];
    if (pos === b.length) return 'checkin';
    // flavour fill for empty boxes
    const rng = mulberry32((b.seed ^ (pos * 2654435761)) >>> 0);
    return pick(rng, ['timer', 'guide', 'rest', 'hold', 'mystery']);
  }

  function applyWarp(b, pos) {
    for (let i = 0; i < (b.ladders || []).length; i++) {
      if (b.ladders[i][0] === pos) return { pos: b.ladders[i][1], via: 'ladder' };
    }
    for (let i = 0; i < (b.snakes || []).length; i++) {
      if (b.snakes[i][0] === pos) return { pos: b.snakes[i][1], via: 'snake' };
    }
    return { pos, via: null };
  }

  /** Caregiver deny / permission lines — uses BSReport.denyFlavour when present. */
  function denyLine(band, kind) {
    const R = window.BSReport;
    if (R && typeof R.denyFlavour === 'function') return R.denyFlavour(band, kind);
    const office = window.BSOffice && window.BSOffice.on && window.BSOffice.on();
    if (office) {
      const N = {
        wait: 'Please wait a bit longer.',
        diaper: 'Use your protection for now.',
        little: 'Only a little is okay right now.',
        yes: 'You may go.',
        change_later: 'Change later when saturation is higher.',
        change_now: 'You may change now.',
        skin: 'Skin-safety: change if you’ve been wet too long.'
      };
      return N[kind] || N.wait;
    }
    const busy = [
      "Mommy's busy — use your diaper for now.",
      "Mommy's busy — wait a little longer, sweetie.",
      "Mommy's busy — only a little, then hold the rest.",
      "Not yet, little one — protection first."
    ];
    if (kind === 'yes') return 'Okay — you may use the potty.';
    if (kind === 'change_now') return 'Yes, you may change now.';
    if (kind === 'change_later') return "Not yet — wait until you're soggy, or ask again after another wetting.";
    if (kind === 'skin') return 'Skin-safety wins: change now if you’ve been wet too long.';
    if (kind === 'diaper') return busy[0];
    if (kind === 'little') return busy[2];
    return busy[1];
  }

  function scriptFor(kind, band, rng) {
    band = BANDS.includes(band) ? band : 'okay';
    const w = WAIT[band] || WAIT.okay;
    const mins = ri(rng, w.lo, w.hi);
    const hide = w.hide && (band === 'shaky' ? rng() < 0.5 : true);
    const satAsk = ri(rng, 20, 95);
    const leaked = rng() < 0.35;
    const realUrge = '';
    const skin = '🧴 Skin-safety: change if past max wet hours.';

    switch (kind) {
      case 'timer': {
        const shown = hide ? 'Wait. (length hidden until the alarm)' : `Wait ${mins} min (shown).`;
        return {
          title: KIND_LABEL.timer,
          copy: `${shown} One alarm when it ends. Band: ${BAND_LABEL[band]} (${w.label}).`,
          outcome: hide ? `hidden_wait_${mins}m` : `shown_wait_${mins}m`,
          detail: hide ? `Would wait ~${mins} min (hidden)` : `Would wait ${mins} min`,
          mins, hide
        };
      }
      case 'guide': {
        const how = pick(rng, ['slowly', 'all at once', 'in short pulses']);
        const pose = pick(rng, ['standing', 'sitting', 'a gentle squat (optional, skip anytime)']);
        return {
          title: KIND_LABEL.guide,
          copy: `Phone-simple guide: hold ${pose} briefly, then let go ${how} in your current protection (pull-ups / diaper) — not the bathroom. Look at the phone — no walking errands. ${realUrge}`,
          outcome: `guide_${how}_${pose.split(' ')[0]}`,
          detail: `Guide: ${pose}, let go ${how}`
        };
      }
      case 'let_go':
        return {
          title: KIND_LABEL.let_go,
          copy: `Stay in your current protection (pull-ups / diaper) and let go fully — not the bathroom — then no change until your next roll. ${skin} ${realUrge}`,
          outcome: 'let_go_no_change_until_roll',
          detail: 'Let go · no change until next roll (skin cap applies)'
        };
      case 'may_i': {
        const gate = band === 'good' ? 'auto-yes (logged)' :
          band === 'none' ? denyLine(band, 'diaper') :
          band === 'little' ? denyLine(band, rng() < 0.5 ? 'little' : 'wait') :
          (rng() < (band === 'okay' ? 0.65 : 0.4) ? denyLine(band, 'yes') : denyLine(band, 'wait'));
        return {
          title: KIND_LABEL.may_i,
          copy: `May I? — next urges use the permission table. Band ${BAND_LABEL[band]}: ${gate}`,
          outcome: 'may_i_' + (String(gate).toLowerCase().includes('may') || String(gate).toLowerCase().includes('yes') || String(gate).includes('auto') ? 'yes' : 'deny'),
          detail: gate
        };
      }
      case 'change': {
        const thresh = { good: 0, okay: 30, shaky: 45, little: 60, none: 75 }[band];
        const allow = band === 'good' || satAsk >= thresh || leaked;
        const line = allow ? denyLine(band, 'change_now') : denyLine(band, 'change_later');
        return {
          title: KIND_LABEL.change,
          copy: `🎲 May I change? Asks saturation (${satAsk}%) + leaked? ${leaked ? 'yes' : 'no'}. Threshold ~${thresh}. ${line} ${skin}`,
          outcome: allow ? 'change_yes' : 'change_later',
          detail: `sat ${satAsk}% · leak ${leaked ? 'y' : 'n'} · ${allow ? 'change ok' : 'wait'}`,
          satAsk, leaked
        };
      }
      case 'hold': {
        const hm = ri(rng, 2, band === 'none' ? 6 : 12);
        return {
          title: KIND_LABEL.hold,
          copy: `Uh-oh hold: hold ~${hide ? 'hidden' : hm + ' min'} with the accident button armed. ${realUrge}`,
          outcome: hide ? `hold_hidden_${hm}m` : `hold_${hm}m`,
          detail: `Hold challenge ~${hm} min${hide ? ' (hidden)' : ''}`
        };
      }
      case 'rest':
        return {
          title: KIND_LABEL.rest,
          copy: 'Rest square — soft pause. No punishment. Sip water if you like (safety caps still apply).',
          outcome: 'rest',
          detail: 'Rest / soft pause'
        };
      case 'mystery': {
        const draw = pick(rng, band === 'none' || band === 'little'
          ? ['extra hidden wait', 'soft check-in', 'tiny star bonus', 'short fuse flavour']
          : ['star +1', 'shown short wait', 'free change token (flavour)', 'cheer card']);
        return {
          title: KIND_LABEL.mystery,
          copy: `Mystery draw (band-filtered): ${draw}. ${realUrge}`,
          outcome: 'mystery_' + draw.replace(/\s+/g, '_'),
          detail: 'Mystery: ' + draw
        };
      }
      case 'punish': {
        const p = pick(rng, [
          '⏳ Extra wait on next go',
          '✋ Hidden waits for a bit',
          '↩ Step back 1–2 boxes',
          '🔄 Change threshold +15 (skin cap wins)',
          '🎟 Soft privilege loss (flavour)'
        ]);
        return {
          title: KIND_LABEL.punish,
          copy: `Punishment roll: ${p}. Remove/Pause always available. ${realUrge} ${skin}`,
          outcome: 'punish',
          detail: p,
          levelDown: /Step back/.test(p)
        };
      }
      case 'checkin':
      default: {
        const urg = ri(rng, 1, 10);
        const sat = ri(rng, 0, 100);
        const wet = rng() < 0.4;
        let move = 0;
        if (wet && sat < 40) move = -1;
        else if (!wet && urg <= 3) move = 1;
        return {
          title: KIND_LABEL.checkin,
          copy: `Check-in: urgency ${urg}/10, saturation ${sat}%, pants wet? ${wet ? 'yes' : 'no'} (all user-entered in live play). ${move < 0 ? 'Token eases back.' : move > 0 ? 'Token eases forward.' : 'Stay put.'} ${realUrge}`,
          outcome: 'checkin_u' + urg + '_s' + sat + (wet ? '_wet' : '_dry'),
          detail: `Check-in u${urg} sat${sat}% ${wet ? 'wet' : 'dry'}${move ? ' · Δ' + move : ''}`,
          moveDelta: move
        };
      }
    }
  }

  function resolveSquare(b, opts) {
    opts = opts || {};
    const rng = opts.rng || mulberry32(((b.seed || 1) ^ (b.pos * 97) ^ (Date.now() & 0xffff)) >>> 0);
    const band = opts.band || b.band || 'okay';
    const kind = kindAt(b, b.pos);
    const script = scriptFor(kind, band, rng);
    const z = zoneFor(b.pos, b.length);
    let levelDown = !!script.levelDown;
    let newPos = b.pos;
    if (script.moveDelta) {
      newPos = Math.max(1, Math.min(b.length, b.pos + script.moveDelta));
    }
    if (levelDown) {
      const back = ri(rng, 1, 2);
      newPos = Math.max(1, b.pos - back);
      script.detail += ` · level/zone nudge −${back}`;
    }
    // punish step-back already applied via levelDown; snakes/ladders apply when landing after a move in live play —
    // for resolve-in-place we only record the square outcome.
    const entry = {
      ts: Date.now(),
      square: b.pos,
      kind,
      outcome: script.outcome,
      detail: script.detail,
      copy: script.copy,
      band,
      zone: z.id,
      zoneName: z.name,
      levelDown: levelDown || undefined,
      title: script.title
    };
    return { entry, script, newPos, zone: z };
  }

  function advanceOne(b, opts) {
    opts = opts || {};
    if (!b || b.finished) return { b, done: true };
    const rng = opts.rng || mulberry32(((b.seed || 1) + (b.history || []).length * 131) >>> 0);
    const die = opts.die != null ? opts.die : (1 + Math.floor(rng() * 6));
    const from = b.pos;
    let to;
    if (b.dir === 'slide') to = Math.max(1, from - die);
    else to = Math.min(b.length, from + die);
    const warp = applyWarp(b, to);
    to = warp.pos;
    b.pos = to;
    b.zone = zoneFor(to, b.length).id;
    const resolved = resolveSquare(b, { rng, band: opts.band || b.band });
    // check-in / punish may nudge further
    if (resolved.newPos !== b.pos) {
      b.pos = resolved.newPos;
      b.zone = zoneFor(b.pos, b.length).id;
    }
    b.history = b.history || [];
    b.history.push({ ts: Date.now(), from, to: b.pos, why: opts.why || 'urge_roll', die, warp: warp.via });
    b.testLog = b.testLog || [];
    b.testLog.push(Object.assign({ die, from, to: b.pos, warp: warp.via }, resolved.entry));
    if ((b.dir === 'slide' && b.pos <= 1) || (b.dir !== 'slide' && b.pos >= b.length)) {
      b.finished = true;
    }
    save(b);
    return { b, entry: resolved.entry, script: resolved.script, die, from, to: b.pos, warp: warp.via, done: !!b.finished };
  }

  /** Instant full-path test: no real waits. Target <10s for N=60. */
  function simulatePass(b, opts) {
    opts = opts || {};
    const band = opts.band || b.band || 'okay';
    b = JSON.parse(JSON.stringify(b));
    b.band = band;
    b.testMode = true;
    b.testLog = [];
    b.history = [];
    b.finished = false;
    b.pending = null;
    b.pos = b.dir === 'slide' ? b.length : 1;
    b.zone = zoneFor(b.pos, b.length).id;
    const seed = (b.seed ^ (Date.now() & 0xffff) ^ 0x5a17) >>> 0;
    const rng = mulberry32(seed);
    const maxSteps = b.length * 5 + 30;
    let steps = 0;
    const log = [];
    while (!b.finished && steps < maxSteps) {
      const r = advanceOne(b, { rng, band, why: 'test_pass' });
      log.push(r.entry);
      steps++;
    }
    b.testLog = log;
    b.testSeed = seed;
    b.testSteps = steps;
    save(b);
    return b;
  }

  function formatLogText(b) {
    if (!b || !b.testLog || !b.testLog.length) return '(no test log yet)';
    const lines = [
      `Potty Path test log — length ${b.length} · dir ${b.dir} · band ${b.band} · seed ${b.seed}`,
      `steps ${b.testSteps || b.testLog.length} · finished=${!!b.finished} · final pos ${b.pos} (${b.zone})`,
      ''
    ];
    b.testLog.forEach((e, i) => {
      lines.push(`${i + 1}. #${e.square} ${KIND_LABEL[e.kind] || e.kind} · ${e.zoneName || e.zone} · ${BAND_LABEL[e.band] || e.band}`);
      lines.push(`   outcome: ${e.outcome}${e.levelDown ? ' · LEVEL/ZONE NUDGE' : ''}`);
      lines.push(`   ${e.detail || ''}`);
    });
    return lines.join('\n');
  }

  function exportJSON(b) {
    return JSON.stringify(b, null, 2);
  }

  // ---------- UI ----------
  let uiBusy = false;

  function mountEl() {
    return document.getElementById('boardMount');
  }

  function renderStrip(b) {
    if (!b) return '';
    const cells = [];
    for (let i = 1; i <= b.length; i++) {
      const k = kindAt(b, i);
      const z = zoneFor(i, b.length).id;
      const cls = ['bd-cell', i === b.pos ? 'cur' : '', z].join(' ');
      const snake = (b.snakes || []).some(s => s[0] === i);
      const ladder = (b.ladders || []).some(s => s[0] === i);
      const mark = snake ? '↓' : ladder ? '↑' : '';
      cells.push(`<button type="button" class="${cls}" data-sq="${i}" title="#${i} ${KIND_LABEL[k] || k}">${i}${mark}</button>`);
    }
    return `<div class="bd-strip" id="bdStrip">${cells.join('')}</div>`;
  }

  function renderLog(b) {
    if (!b || !b.testLog || !b.testLog.length) return `<div class="cal-legend" id="bdLogEmpty">No test log yet — run a test pass or step once.</div>`;
    const rows = b.testLog.slice().reverse().slice(0, 80).map(e =>
      `<div class="bd-log-row"><b>#${e.square}</b> ${esc(KIND_LABEL[e.kind] || e.kind)} · <span class="bd-zone">${esc(e.zoneName || e.zone)}</span> · ${esc(BAND_LABEL[e.band] || e.band)}` +
      `<div class="bd-out">${esc(e.detail || e.outcome)}${e.levelDown ? ' · <span style="color:#ff7675;">level nudge</span>' : ''}</div>` +
      `<div class="cal-legend">${esc((e.copy || '').slice(0, 160))}${(e.copy || '').length > 160 ? '…' : ''}</div></div>`
    ).join('');
    return `<div class="bd-log" id="bdLog">${rows}</div>`;
  }

  function render() {
    const m = mountEl(); if (!m) return;
    const b = load();
    if (!b) {
      m.innerHTML = `<h2 style="margin:0 0 6px;">🎲 Potty Path <span class="cal-legend" style="display:inline;font-weight:normal;">(demo)</span></h2>
        <p class="section-desc">Snakes-and-ladders campaign path. Landings are <b>phone-simple event guides</b> (look at the phone — no logistics walks). Test Mode auto-resolves every square with random outcomes — no real waits — so you can review a full path in seconds.</p>
        <label class="urge-lbl">Length N <input id="bdLen" type="number" min="10" max="200" value="60" style="width:72px;"></label>
        <label class="urge-lbl">Direction <select id="bdDir"><option value="grow">Grow Up (1→N)</option><option value="slide">Little Slide (N→1)</option><option value="free">Free play</option></select></label>
        <label class="urge-lbl">Control band <select id="bdBand">${BANDS.map(k => `<option value="${k}">${BAND_LABEL[k]}</option>`).join('')}</select></label>
        <div class="cal-legend">Office mode stays neutral.</div>
        <div class="camp-actions"><button type="button" id="bdStart" style="background:#a29bfe;color:#000;font-weight:bold;">▶ Start board (N=60 demo)</button></div>`;
      m.querySelector('#bdStart').onclick = () => {
        let length = +m.querySelector('#bdLen').value || 60;
        let dir = m.querySelector('#bdDir').value;
        const band = m.querySelector('#bdBand').value;
        try {
          const pk = window.BSQuiz && window.BSQuiz.loadPacks && window.BSQuiz.loadPacks().board;
          if (pk && pk.result) {
            if (pk.result.length && !m.querySelector('#bdLen').dataset.touched) length = pk.result.length;
            if (pk.result.dir) dir = pk.result.dir;
          }
        } catch (e) {}
        const board = blankBoard({ length, dir, band });
        save(board);
        render();
        if (typeof toast === 'function') toast('Potty Path started · ' + board.length + ' boxes');
      };
      const lenEl = m.querySelector('#bdLen');
      if (lenEl) {
        try {
          const pk = window.BSQuiz && window.BSQuiz.loadPacks && window.BSQuiz.loadPacks().board;
          if (pk && pk.result && pk.result.length) { lenEl.value = pk.result.length; }
          if (pk && pk.result && pk.result.dir) { const d = m.querySelector('#bdDir'); if (d) d.value = pk.result.dir; }
        } catch (e) {}
        lenEl.addEventListener('change', () => { lenEl.dataset.touched = '1'; });
      }
      return;
    }
    const z = zoneFor(b.pos, b.length);
    const kind = kindAt(b, b.pos);
    const prog = b.finished ? '🏁 Finished' : `#${b.pos} / ${b.length}`;
    m.innerHTML = `<h2 style="margin:0 0 6px;">🎲 Potty Path ${b.testMode ? '<span style="color:#fdcb6e;">· Test Mode</span>' : ''}</h2>
      <div class="camp-card">
        <div class="calib-big">${prog} · ${esc(z.name)} zone</div>
        <div class="cal-legend">dir ${esc(b.dir)} · seed ${b.seed} · snakes ${(b.snakes || []).length} · ladders ${(b.ladders || []).length} · landing now: ${esc(KIND_LABEL[kind] || kind)}</div>
        <label class="urge-lbl">Control band <select id="bdBand">${BANDS.map(k => `<option value="${k}" ${k === (b.band || 'okay') ? 'selected' : ''}>${BAND_LABEL[k]}</option>`).join('')}</select></label>
        ${renderStrip(b)}
        <div id="bdCurrent" class="quiz-card" style="margin-top:8px;"></div>
        <div class="camp-actions">
          <button type="button" id="bdStep" style="background:#55efc4;color:#000;font-weight:bold;">▶ Step one square</button>
          <button type="button" id="bdTest" style="background:#fdcb6e;color:#000;font-weight:bold;">🧪 Run test pass</button>
          <button type="button" id="bdExportTxt">📄 Export log (text)</button>
          <button type="button" id="bdExportJson">📦 Export JSON</button>
          <button type="button" id="bdLeave">⏸ Leave (keep save)</button>
          <button type="button" id="bdReset">✕ Reset board</button>
        </div>
        <div class="cal-legend" id="bdProgress"></div>
        <div style="margin-top:8px;"><b>Scrollable test log</b></div>
        ${renderLog(b)}
        <div class="cal-legend" style="margin-top:8px;">🧴 skin-safety on change · Office = coach voice</div>
      </div>`;

    // preview current square script
    const preview = resolveSquare(Object.assign({}, b), { band: b.band || 'okay', rng: mulberry32((b.seed ^ b.pos) >>> 0) });
    const cur = m.querySelector('#bdCurrent');
    if (cur) cur.innerHTML = `<div class="quiz-q">${esc(preview.script.title)}</div><p class="section-desc">${esc(preview.script.copy)}</p>`;

    m.querySelector('#bdBand').onchange = e => { const n = load(); n.band = e.target.value; save(n); render(); };
    m.querySelector('#bdStep').onclick = () => {
      const n = load();
      n.band = m.querySelector('#bdBand').value;
      n.testMode = true;
      const r = advanceOne(n, { band: n.band, why: 'step' });
      render();
      if (typeof toast === 'function') toast(r.done ? '🏁 Path finished' : `#${r.to} ${KIND_LABEL[r.entry.kind] || r.entry.kind}`);
    };
    m.querySelector('#bdTest').onclick = () => runTestPassUI();
    m.querySelector('#bdExportTxt').onclick = () => download('potty-path-log.txt', formatLogText(load()), 'text/plain');
    m.querySelector('#bdExportJson').onclick = () => download('potty-path-board.json', exportJSON(load()), 'application/json');
    m.querySelector('#bdLeave').onclick = () => { if (typeof toast === 'function') toast('Board saved — resume anytime on Profiles'); };
    m.querySelector('#bdReset').onclick = () => {
      if (!confirm('Reset Potty Path board? Save will be cleared.')) return;
      save(null); render();
    };
  }

  function download(name, text, type) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
      a.download = name; a.click();
      if (typeof toast === 'function') toast('Exported ' + name);
    } catch (e) {
      try { navigator.clipboard.writeText(text); if (typeof toast === 'function') toast('Copied to clipboard'); } catch (e2) {}
    }
  }

  function runTestPassUI() {
    if (uiBusy) return;
    const m = mountEl(); if (!m) return;
    let b = load(); if (!b) return;
    b.band = (m.querySelector('#bdBand') && m.querySelector('#bdBand').value) || b.band || 'okay';
    uiBusy = true;
    const prog = m.querySelector('#bdProgress');
    if (prog) prog.textContent = 'Running test pass…';
    // yield to paint, then compute (instant outcomes; N=60 is cheap)
    setTimeout(() => {
      try {
        b = simulatePass(b, { band: b.band });
        if (prog) prog.textContent = `Test pass done · ${b.testSteps} steps · final #${b.pos} (${b.zone}) · finished=${b.finished}`;
        render();
        if (typeof toast === 'function') toast('🧪 Test pass · ' + b.testSteps + ' steps');
      } finally { uiBusy = false; }
    }, 30);
  }

  window.BSBoard = {
    KEY, KINDS, KIND_LABEL, BANDS, ZONES, WAIT,
    blankBoard, load, save, kindAt, zoneFor, applyWarp,
    scriptFor, resolveSquare, advanceOne, simulatePass,
    formatLogText, exportJSON, denyLine, render, generateSnakesLadders, assignSquares, mulberry32
  };
  window.renderBoard = render;
  window.addEventListener('load', () => setTimeout(() => { try { render(); } catch (e) {} }, 80));
})();
