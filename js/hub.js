/* ===========================
   hub.js — v15 UI regroup. Session = Play hub (Full / Quick / Potty Path / Nights), "new mechanics" callouts,
   Quick sheet (Urge · Quick Session · Short quiz → play), Settings deep-links, safety card, data export.
   Quick-from-quiz stores a temporary Simple Urge profile in bs_quick_quiz_session_v1 (skippable, one tap to end).
   Hard rules: no sexual content, game rules only, real urge always wins, nights stay silent.
   =========================== */
(function () {
  const QQ_KEY = 'bs_quick_quiz_session_v1', QQ_PROFILE = 'cp_quickquiz';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const toastMsg = t => { try { typeof toast === 'function' && toast(t); } catch (e) {} };
  function sheet(html) {
    const w = document.createElement('div'); w.className = 'cal-sheet-wrap';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">${html}</div>`;
    w.addEventListener('click', ev => { if (ev.target === w) w.remove(); }); document.body.appendChild(w); return w;
  }
  const go = t => { if (typeof switchTab === 'function') switchTab(t); };
  /** Open a <details> by id (and its parents), then scroll to an element inside. */
  function reveal(detailsId, targetId) {
    setTimeout(() => {
      const d = document.getElementById(detailsId); if (d) { d.open = true; let p = d.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; } }
      const t = document.getElementById(targetId || detailsId); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' });
    }, 80);
  }
  const openSettings = (sec, target) => { go('settings'); reveal(sec, target); };
  const openCalibration = () => openSettings('setCalib', 'calibrationMount');

  // ---------- v31 play prefs (soft / Path↔clip bridge) — new key, existing keys untouched ----------
  const PLAY_KEY = 'bs_play_prefs_v1';
  function playPrefs() { return Object.assign({ soft: false, pathClipBridge: false, clipAssistPath: false, clipAssistCampaign: false, theme: 'neutral' }, J(PLAY_KEY, {})); }
  function savePlayPrefs(p) { const n = Object.assign(playPrefs(), p || {}); localStorage.setItem(PLAY_KEY, JSON.stringify(n)); return n; }
  function softOn() { return !!playPrefs().soft; }
  function pathClipBridgeOn() { return !!playPrefs().pathClipBridge; }
  function clipAssistPathOn() { return !!playPrefs().clipAssistPath; }
  function clipAssistCampaignOn() { return !!playPrefs().clipAssistCampaign; }
  /** v38 CSS look themes (stored in bs_play_prefs_v1.theme). Adult-safe color/look only. */
  const THEMES = {
    neutral:  { id: 'neutral',  label: 'Neutral',   blurb: 'Default dark violet accents' },
    girl:     { id: 'girl',     label: 'Girl',      blurb: 'Rose accents on dark' },
    boy:      { id: 'boy',      label: 'Boy',       blurb: 'Sky accents on dark' },
    softpink: { id: 'softpink', label: 'Soft pink', blurb: 'Warm rose panels' },
    sky:      { id: 'sky',      label: 'Sky blue',  blurb: 'Cool blue panels' },
    lavender: { id: 'lavender', label: 'Lavender',  blurb: 'Soft purple glow' },
    midnight: { id: 'midnight', label: 'Midnight',  blurb: 'Near-black, cool cyan' }
  };
  const THEME_IDS = Object.keys(THEMES);
  function themeId() {
    const t = (playPrefs().theme || 'neutral');
    return THEMES[t] ? t : 'neutral';
  }
  function themeMeta(id) { return THEMES[id || themeId()] || THEMES.neutral; }
  function themeClassList() { return THEME_IDS.map(id => 'bs-theme-' + id); }
  function applyThemeDom(id) {
    id = THEMES[id] ? id : 'neutral';
    try {
      const cls = themeClassList();
      [document.documentElement, document.body].forEach(el => {
        if (!el) return;
        cls.forEach(c => el.classList.remove(c));
        el.classList.add('bs-theme-' + id);
        el.setAttribute('data-bs-theme', id);
      });
      const meta = document.querySelector('meta[name="theme-color"]');
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0f1115';
      if (meta) meta.setAttribute('content', bg);
    } catch (e) {}
    return id;
  }
  function setTheme(t) {
    const id = THEMES[t] ? t : 'neutral';
    savePlayPrefs({ theme: id });
    applyThemeDom(id);
    try {
      document.querySelectorAll('input[name=bsTheme], input[name=ppTheme]').forEach(r => { r.checked = r.value === id; });
      const host = document.getElementById('themeSeg');
      if (host && !host.querySelector('input[name=bsTheme]') && themePickerHtml) {
        host.innerHTML = themePickerHtml('bsTheme', id);
        host.querySelectorAll('input[name=bsTheme]').forEach(r => {
          r.onchange = () => { setTheme(r.value); try { if (typeof toast === 'function') toast('Look: ' + (themeMeta(r.value).label || r.value)); } catch (e) {} };
        });
      }
    } catch (e) {}
    return id;
  }
  /** Soft wording helpers (unchanged labels; look comes from CSS). */
  function themeWords() {
    return { needToGo: 'I need to go', haveToGo: 'I have to go', alreadyLeaked: 'I already leaked / dribbled', mayChange: 'May I change?', careCheck: 'Caregiver check', satCheck: 'Saturation check', cantHold: "Can't hold", followed: 'Followed the rule', session: 'Session', urge: 'Natural Urge', path: 'Potty Path' };
  }
  function themePickerHtml(nameAttr, selected) {
    selected = THEMES[selected] ? selected : themeId();
    return `<div class="bs-theme-picker" role="radiogroup" aria-label="App look">` +
      THEME_IDS.map(id => {
        const m = THEMES[id];
        return `<label class="bs-theme-swatch bs-sw-${id}" title="${m.blurb}"><input type="radio" name="${nameAttr}" value="${id}" ${id === selected ? 'checked' : ''}><span class="bs-sw-chip" aria-hidden="true"></span><span class="bs-sw-lab">${m.label}</span></label>`;
      }).join('') + `</div>`;
  }

  // ---------- Play hub ----------
  function openBoard() { try { if (window.BSPathPlay) window.BSPathPlay.setSurface('path'); } catch (e) {} if (window.BSPath || window.BSPathPlay) { go('path'); return; } go('session'); if (typeof window.renderBoard === 'function') try { window.renderBoard(); } catch (e) {} reveal('sessBoard', 'sessBoard'); }
  function startBedwetting() {
    try { showSessionSetupModal(); if (typeof dismissWelcome === 'function' && document.getElementById('welcomeStep') && document.getElementById('welcomeStep').style.display === 'block') dismissWelcome(); chooseBedwettingSession(); } catch (e) { toastMsg('Open ▶ Full Session › Bedwetting'); }
  }
  function startQuickSession() { try { showSessionSetupModal(); chooseQuickSession(); } catch (e) {} }
  function openQuick() {
    const q = qqLoad();
    const w = sheet(`<h3>⚡ Quick play</h3>
      <div class="hub-sheet">
        <button type="button" id="hqUrge" class="hub-sub">🙋 <b>Natural Urge</b><br><small>Open the Urge tab — one big “I need to go” button.</small></button>
        <button type="button" id="hqQuick" class="hub-sub">🚽 <b>Quick Session</b><br><small>Short timed session: pick a level, events roll by themselves.</small></button>
        <button type="button" id="hqQuiz" class="hub-sub">🧩 <b>Short quiz → play</b><br><small>7 quick questions build a temporary Urge profile for today.</small></button>
        ${q && q.active ? `<div class="camp-goal">Active quiz session: <b>${esc(q.result.summary)}</b> <button type="button" id="hqEnd">End it</button></div>` : ''}
      </div><div class="actions"><button data-x>Close</button></div>`);
    w.querySelector('[data-x]').onclick = () => w.remove();
    w.querySelector('#hqUrge').onclick = () => { w.remove(); go('urge'); };
    w.querySelector('#hqQuick').onclick = () => { w.remove(); startQuickSession(); };
    w.querySelector('#hqQuiz').onclick = () => { w.remove(); quickQuiz(); };
    const e = w.querySelector('#hqEnd'); if (e) e.onclick = () => { w.remove(); qqEnd(); };
    return w;
  }

  // ---------- Quick-from-quiz ----------
  const o = (v, l) => ({ v, l });
  const QQ = [
    { id: 'time', q: 'How long do you want to play?', opts: [o(30, '~30 min'), o(60, '~1 hour'), o(120, '~2 hours'), o(240, 'Half a day')] },
    { id: 'wait', q: 'When you press “I need to go”, how long should waits feel?', opts: [o('short', 'Short (5–10 min)'), o('mid', 'Medium (10–25 min)'), o('long', 'Long (20–45 min)')] },
    { id: 'shape', q: 'What should accidents mostly look like?', opts: [o('none', 'Rare — mostly potty'), o('drips', 'Little drips & dribbles'), o('mixed', 'A mix'), o('big', 'Bigger surprises')] },
    { id: 'gear', q: 'Lean on gear?', opts: [o(0, 'No — potty first'), o(1, 'Sometimes'), o(2, 'Often — “use your protection”')] },
    { id: 'voice', q: 'Voice for this session?', opts: [o('caregiver', '🤗 Caregiver'), o('babysitter', '🍼 Babysitter'), o('coach', '📋 Neutral coach')] },
    { id: 'flags', multi: true, q: 'Any symptom flags just for this session?', opts: [o('urge_waves', '⚡ Urge waves'), o('quiet_signals', '🔇 Quiet signals'), o('pre_void_dribble', '💧 Dribbler'), o('none', 'None')] },
    { id: 'hidden', q: 'Hide wait times?', opts: [o(false, 'Show them'), o(true, '✋ Hide them')] }
  ];
  function qqLoad() { const q = J(QQ_KEY, null); if (q && q.active && q.expiresAt && Date.now() > q.expiresAt) { q.active = false; q.expired = true; } return q; }
  function qqScore(a) {
    const wait = { short: [5, 10], mid: [10, 25], long: [20, 45] }[a.wait || 'mid'];
    const shape = a.shape || 'mixed', gear = +(a.gear || 0);
    const odds = { go: 40, wait: 30, hard: 15, dribble: 10, gear: 5 };
    if (shape === 'none') Object.assign(odds, { go: 55, wait: 30, hard: 10, dribble: 3, gear: 2 });
    if (shape === 'drips') Object.assign(odds, { go: 30, wait: 25, hard: 10, dribble: 30, gear: 5 });
    if (shape === 'big') Object.assign(odds, { go: 25, wait: 25, hard: 30, dribble: 10, gear: 10 });
    odds.gear += gear * 10; odds.go = Math.max(10, odds.go - gear * 5);
    let flags = (a.flags || []).filter(x => x !== 'none');
    const traits = { fastFill: false, quietSignals: flags.includes('quiet_signals') };
    if (flags.includes('urge_waves')) { wait[0] = Math.max(3, wait[0] - 3); wait[1] = Math.max(wait[0] + 2, wait[1] - 5); }
    if (flags.includes('pre_void_dribble')) odds.dribble += 8;
    const voice = a.voice || 'caregiver', minutes = +(a.time || 60);
    const summary = `waits ${wait[0]}–${wait[1]} min · ${{ none: 'rare', drips: 'drippy', mixed: 'mixed', big: 'big' }[shape] || shape} accidents · gear ${['low', 'some', 'high'][gear]} · ${voice}${flags.length ? ' · ' + flags.join(', ') : ''} · ${minutes} min`;
    return { wait, odds, traits, hidden: a.hidden === true, voice, flags, minutes, shape, gear, summary };
  }
  function qqApply(ans) {
    const r = qqScore(ans), SU = window.BSSimpleUrge;
    const prev = SU ? SU.settings().profileId : null;
    const old = qqLoad();
    const prevVoice = window.BSReport && window.BSReport.getVoice ? window.BSReport.getVoice() : null;
    if (SU) { SU.upsertProfile({ id: QQ_PROFILE, name: '🧩 Quiz session', wait: r.wait, odds: r.odds, hiddenWait: r.hidden, traits: r.traits }); SU.saveSettings({ profileId: QQ_PROFILE }); }
    try { if (window.BSReport && window.BSReport.setVoice) window.BSReport.setVoice(r.voice); } catch (e) {}
    const s = { v: 1, active: true, ans, result: r, profileId: QQ_PROFILE, prevProfileId: old && old.active ? old.prevProfileId : (prev === QQ_PROFILE ? 'match' : prev), prevVoice: old && old.active ? old.prevVoice : prevVoice, createdAt: Date.now(), expiresAt: Date.now() + r.minutes * 60000 };
    localStorage.setItem(QQ_KEY, JSON.stringify(s));
    if (SU) try { SU.render(); } catch (e) {}
    return s;
  }
  function qqEnd() {
    const s = qqLoad(); if (!s) return;
    const SU = window.BSSimpleUrge;
    if (SU && SU.settings().profileId === QQ_PROFILE) SU.saveSettings({ profileId: s.prevProfileId || 'match' });
    try { if (s.prevVoice && window.BSReport) window.BSReport.setVoice(s.prevVoice); } catch (e) {}
    s.active = false; s.endedAt = Date.now(); localStorage.setItem(QQ_KEY, JSON.stringify(s));
    if (SU) try { SU.render(); } catch (e) {}
    renderHub(); if (typeof window.renderMyProfile === 'function') window.renderMyProfile();
    toastMsg('Quiz session ended — back to your usual profile');
  }
  function quickQuiz() {
    const prev = (qqLoad() || {}).ans || {}; const ans = JSON.parse(JSON.stringify(prev)); let i = 0;
    const w = sheet('<div id="qqBody"></div>');
    const paint = () => {
      const q = QQ[i], cur = ans[q.id], on = v => q.multi ? (cur || []).includes(v) : cur === v;
      w.querySelector('#qqBody').innerHTML = `<h3>🧩 Short quiz → play</h3><div class="cal-legend">${i + 1} / ${QQ.length} · skip any time</div>
        <div class="quiz-progress"><i style="width:${Math.round((i + 1) / QQ.length * 100)}%"></i></div>
        <div class="quiz-q">${esc(q.q)}</div>
        <div class="quiz-opts">${q.opts.map((x, k) => `<button type="button" data-k="${k}" class="${on(x.v) ? 'on' : ''}">${esc(x.l)}</button>`).join('')}</div>
        <div class="quiz-nav"><button type="button" id="qqBack">${i ? '← Back' : '✕ Cancel'}</button><button type="button" id="qqSkip">Skip</button><button type="button" id="qqNext" style="background:#55efc4;color:#000;font-weight:bold;">${i === QQ.length - 1 ? '✓ Build & play' : 'Next →'}</button></div>`;
      w.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const v = q.opts[+b.dataset.k].v;
        if (q.multi) { let a = ans[q.id] || []; if (v === 'none') a = ['none']; else { a = a.filter(x => x !== 'none'); a = a.includes(v) ? a.filter(x => x !== v) : a.concat(v); } ans[q.id] = a; } else ans[q.id] = v;
        paint();
      });
      w.querySelector('#qqBack').onclick = () => { if (i) { i--; paint(); } else w.remove(); };
      const next = () => {
        if (i < QQ.length - 1) { i++; paint(); return; }
        const s = qqApply(ans); w.remove(); renderHub(); if (typeof window.renderMyProfile === 'function') window.renderMyProfile();
        toastMsg('Quiz session ready · ' + s.result.summary); go('urge');
      };
      w.querySelector('#qqSkip').onclick = () => { delete ans[q.id]; next(); };
      w.querySelector('#qqNext').onclick = next;
    };
    paint(); return w;
  }

  // ---------- Session hub decorations ----------
  const NEW_MECH = [
    ['🎲', 'Potty Path board', 'Winding visual board: classes, dice, adaptive free play', () => openBoard()],
    ['🧩', 'Quiz hub', 'Every quiz in one place — see what each one changes', () => { go('profiles'); reveal('myProfileMount'); }],
    ['⚡', 'Short quiz → play', '7 questions build a Quick Urge profile', () => quickQuiz()],
    ['🎯', 'Calibration moved', 'Now in Settings › Calibration', () => openCalibration()]
  ];
  function renderHub() {
    const nm = document.getElementById('hubNewMech');
    if (nm) {
      const seen = J('bs_hub_seen_v15', false);
      nm.innerHTML = `<details class="hub-new-d" ${seen ? '' : 'open'}><summary>✨ New in v15</summary>${NEW_MECH.map((x, k) => `<button type="button" class="hub-new-b" data-nm="${k}">${x[0]} <b>${esc(x[1])}</b> <small>${esc(x[2])}</small></button>`).join('')}</details>`;
      nm.querySelectorAll('[data-nm]').forEach(b => b.onclick = () => NEW_MECH[+b.dataset.nm][3]());
      const d = nm.querySelector('details'); d.addEventListener('toggle', () => { if (!d.open) localStorage.setItem('bs_hub_seen_v15', 'true'); });
    }
    const b = J('bs_board_v1', null);
    const sub = document.getElementById('hubBoardSub');
    if (sub) { const pb = window.BSPath && window.BSPath.load && window.BSPath.load(); sub.textContent = pb ? `Resume · square ${pb.pos || 1} / ${pb.length || 60}` : 'Path | Campaign · deep start'; }
    const bn = document.getElementById('hubBoardNight');
    if (bn) bn.innerHTML = b && b.length ? '🎲 Board active: night landings keep your token in place and stay silent. <button type="button" id="hubBoardNightGo">Open board</button>' : 'Board nights: start a Potty Path board to get silent night landings.';
    const bg = document.getElementById('hubBoardNightGo'); if (bg) bg.onclick = openBoard;
    // Nights card: open automatically only in the evening or while a night is running.
    const n = document.getElementById('hubNights');
    if (n && !n.dataset.user) { const ev = window.BSNight && window.BSNight.isEvening && window.BSNight.isEvening(); const st = window.BSNight && window.BSNight.get && window.BSNight.get(); const want = !!(ev || st); if (n.open !== want) { n._prog = true; n.open = want; } }
    const q = qldBadge(); const qb = document.getElementById('hubQuick'); if (qb) { const sm = qb.querySelector('small'); if (sm) sm.textContent = q || 'Natural Urge, short play, or quiz → play'; }
    const softMount = document.getElementById('hubSoftPlay');
    if (softMount) {
      const on = softOn();
      softMount.innerHTML = `<label class="qp-flag" style="display:flex;align-items:center;gap:8px;margin:8px 0;"><input type="checkbox" id="hubSoftChk" ${on ? 'checked' : ''}> Soft play <span class="muted" style="font-weight:normal;">— shorter holds, early Path stages, no Dare Deck</span></label>`;
      const chk = softMount.querySelector('#hubSoftChk');
      if (chk) chk.onchange = () => { savePlayPrefs({ soft: !!chk.checked }); if (typeof toast === 'function') toast(chk.checked ? 'Soft play on' : 'Soft play off'); };
    }
    // Settings mirror
    const setSoft = document.getElementById('softPlayToggle');
    if (setSoft && setSoft.checked !== softOn()) setSoft.checked = softOn();
    const setBridge = document.getElementById('pathClipBridgeToggle');
    if (setBridge && setBridge.checked !== pathClipBridgeOn()) setBridge.checked = pathClipBridgeOn();
    const setCap = document.getElementById('clipAssistPathToggle');
    if (setCap && setCap.checked !== clipAssistPathOn()) setCap.checked = clipAssistPathOn();
    const setCac = document.getElementById('clipAssistCampaignToggle');
    if (setCac && setCac.checked !== clipAssistCampaignOn()) setCac.checked = clipAssistCampaignOn();
  }
  function qldBadge() { const q = qqLoad(); return q && q.active ? '🧩 Quiz session active · ' + q.result.summary : ''; }
  function renderSafety() {
    const m = document.getElementById('safetyMount'); if (!m) return;
    const S = window.BSSafety, st = S ? S.status() : null;
    m.innerHTML = `<div class="cal-legend">Sip prompts today. Drinks you log yourself always count.</div>
      ${st ? `<div class="camp-goal">Today: <b>${st.total} ml</b> prompted · ${st.left} ml left</div>` : ''}`;
  }
  function exportAll() {
    const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out[k] = localStorage.getItem(k); }
    const text = JSON.stringify({ app: 'BladderSim', version: 'v15', exportedAt: new Date().toISOString(), data: out }, null, 1);
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'bladdersim-backup.json'; document.body.appendChild(a); a.click(); a.remove(); toastMsg('Export started'); }
    catch (e) { const w = sheet(`<h3>Export</h3><textarea readonly style="width:100%;height:200px">${esc(text)}</textarea><div class="actions"><button data-x>Close</button></div>`); w.querySelector('[data-x]').onclick = () => w.remove(); }
  }
  function collapseSecondary() {
    ['bioLoggerWrapper', 'maintenanceContent'].forEach(id => { const el = document.getElementById(id); if (el && el.style.display !== 'none' && typeof toggleSidebarSection === 'function') toggleSidebarSection(id); });
  }
  window.BSHub = { openQuick, openBoard, startBedwetting, startQuickSession, quickQuiz, qqScore, qqApply, qqEnd, qqLoad, QQ, QQ_KEY, PLAY_KEY, playPrefs, savePlayPrefs, softOn, pathClipBridgeOn, clipAssistPathOn, clipAssistCampaignOn, THEMES, THEME_IDS, themeId, themeMeta, themeClassList, applyThemeDom, setTheme, themeWords, themePickerHtml, renderHub, renderSafety, exportAll, openSettings, openCalibration, reveal };
  window.addEventListener('load', () => setTimeout(() => {
    const n = document.getElementById('hubNights'); if (n) n.addEventListener('toggle', () => { if (n._prog) { n._prog = false; return; } n.dataset.user = '1'; });
    collapseSecondary(); renderHub(); renderSafety();
    setInterval(renderHub, 60000);
  }, 120));
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-go]'); if (t) setTimeout(() => { renderHub(); renderSafety(); }, 50); });
})();
