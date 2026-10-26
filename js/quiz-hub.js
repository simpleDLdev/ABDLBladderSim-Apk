/* ===========================
   quiz-hub.js — v18 Quiz hub sections + audit merges; v30 short list.
   Front-and-center: Symptom picker, Which Class, Self-Rating, Stash & Gear,
   Long board, Long campaign. Flavour / A–C packs / This-or-That / Scenario /
   Dare / readiness / voice / nights sit behind "Advanced quizzes" (collapsed).
   Merged duplicates stay under Advanced. Don't delete quizzes — just declutter.
   =========================== */
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  /** Always visible, plain labels. */
  const PRIMARY = [
    { id: 'symPicker', label: 'Symptom picker' },
    { id: 'classquiz', label: 'Which Class' },
    { id: 'sliders', label: 'Self-Rating' },
    { id: 'gear', label: 'Stash & Gear' },
    { id: 'longBoard', label: 'Long board' },
    { id: 'longCamp', label: 'Long campaign' }
  ];
  /** Collapsed by default — still available, still feed campaign/Path. */
  const ADVANCED_SECTIONS = [
    { id: 'start', title: '🚀 Start packs', cards: ['qzA', 'qzB', 'qzQuick', 'readiness'] },
    { id: 'person', title: '🧸 Personality flavour', cards: ['qzC', 'thisorthat', 'maturity'] },
    { id: 'board', title: '🎲 Board extras', cards: ['dare', 'qzCamp', 'recap'] },
    { id: 'voice', title: '🎧 Voice & stories', cards: ['voice', 'scenario'] },
    { id: 'nights', title: '🌙 Nights', cards: ['nightrisk'] }
  ];
  // Kept for callers / tests that still read SECTIONS
  const SECTIONS = [{ id: 'essentials', title: '⭐ Essentials', cards: PRIMARY.map(p => p.id) }].concat(ADVANCED_SECTIONS);
  // duplicate → where it now lives (old results still stored and still feed the campaign)
  const MERGED = { board: 'longBoard', protection: 'gear', symptoms: 'symPicker', symptom: 'symPicker' };
  function symCard() {
    const S = W.BSSymptoms; const p = S ? S.load().prefs : {}; const on = S ? S.activeToday() : [];
    const n = Object.keys(p).length;
    return `<div class="quiz-hub-card" data-qcard="symPicker"><div class="qh-title">🩺 Symptom picker <span class="qp-type">Yes / Maybe / No</span></div>
      <div class="cal-legend">One question per symptom, with its definition. Maybe = random some days. Replaces the old multi-select and Symptom Unlock.</div>
      <div class="qh-last">${n ? '✓ On today: ' + (on.map(id => S.BY[id].icon + ' ' + S.BY[id].name).join(', ') || 'none') : '<span class="muted">Not taken</span>'}</div>
      <div class="qh-imp"><b>Impacts:</b> Symptom flags (Urge, Path, sessions) · switch off any time</div>
      <div class="quiz-nav"><button type="button" id="qzSym">${n ? '↺ Retake' : '▶ Take'}</button><button type="button" id="qzSymDefs">📖 Definitions</button></div></div>`;
  }
  const PRIMARY_EMOJI = { symPicker: '🩺', classquiz: '🏫', sliders: '🎚', gear: '🎒', longBoard: '🎲', longCamp: '🏅' };
  function plainTitle(card, fallbackLabel) {
    if (!card || !fallbackLabel) return;
    const t = card.querySelector('.qh-title');
    if (!t) return;
    const type = t.querySelector('.qp-type');
    const typeHtml = type ? ' ' + type.outerHTML : '';
    const em = PRIMARY_EMOJI[card.dataset.qcard] || '';
    t.innerHTML = (em ? em + ' ' : '') + fallbackLabel + typeHtml;
  }
  function regroup(m) {
    m = m || document.getElementById('myProfileMount'); if (!m || m.querySelector('#qzSections')) return;
    const cards = {}; m.querySelectorAll('.quiz-hub-card[data-qcard]').forEach(c => { cards[c.dataset.qcard] = c; });
    if (!cards.qzA) return;
    const tmp = document.createElement('div'); tmp.innerHTML = symCard(); cards.symPicker = tmp.firstChild;
    const box = document.createElement('div'); box.id = 'qzSections';

    const prim = document.createElement('div'); prim.className = 'qz-section'; prim.dataset.sec = 'essentials';
    prim.innerHTML = `<div class="qz-sec">⭐ Essentials</div><div class="cal-legend" style="margin:0 0 6px;">The short list — start here. Everything else is under Advanced quizzes.</div><div class="quiz-hub-list"></div>`;
    const pList = prim.querySelector('.quiz-hub-list');
    PRIMARY.forEach(p => {
      const c = cards[p.id]; if (!c) return;
      plainTitle(c, p.label);
      pList.appendChild(c); delete cards[p.id];
    });
    box.appendChild(prim);

    const adv = document.createElement('details'); adv.className = 'sess-more'; adv.id = 'qzAdvanced';
    adv.innerHTML = `<summary>🧰 Advanced quizzes</summary><div class="cal-legend">A/B/C packs, This-or-That, Scenario, Dare Deck, voice, nights and the rest — still feed Path and Campaign when you take them.</div><div id="qzAdvBody"></div>`;
    const advBody = adv.querySelector('#qzAdvBody');
    ADVANCED_SECTIONS.forEach(s => {
      const sec = document.createElement('div'); sec.className = 'qz-section'; sec.dataset.sec = s.id;
      sec.innerHTML = `<div class="qz-sec">${s.title}</div><div class="quiz-hub-list"></div>`;
      const l = sec.querySelector('.quiz-hub-list');
      s.cards.forEach(id => { if (cards[id]) { l.appendChild(cards[id]); delete cards[id]; } });
      if (l.children.length) advBody.appendChild(sec);
    });

    const merged = document.createElement('details'); merged.className = 'sess-more'; merged.id = 'qzMerged';
    merged.innerHTML = `<summary>🗂 Merged quizzes (${Object.keys(MERGED).filter(k => cards[k]).length})</summary><div class="cal-legend">These overlapped another quiz, so they now live there. Old results are kept.</div><div class="quiz-hub-list"></div>`;
    Object.keys(cards).forEach(id => {
      const c = cards[id];
      if (MERGED[id]) {
        const note = document.createElement('div'); note.className = 'cal-legend'; note.textContent = '→ merged into ' + MERGED[id];
        c.appendChild(note); c.classList.add('qz-merged');
        merged.querySelector('.quiz-hub-list').appendChild(c);
      } else {
        // leftover unknown cards → Advanced catch-all
        let catchAll = advBody.querySelector('[data-sec="other"]');
        if (!catchAll) {
          catchAll = document.createElement('div'); catchAll.className = 'qz-section'; catchAll.dataset.sec = 'other';
          catchAll.innerHTML = `<div class="qz-sec">More</div><div class="quiz-hub-list"></div>`;
          advBody.appendChild(catchAll);
        }
        catchAll.querySelector('.quiz-hub-list').appendChild(c);
      }
    });
    if (merged.querySelectorAll('.quiz-hub-card').length) advBody.appendChild(merged);
    box.appendChild(adv);

    const first = m.querySelector('.quiz-hub-list'); first.before(box);
    m.querySelectorAll('.quiz-hub-list').forEach(l => { if (!box.contains(l) && !l.children.length) l.remove(); });
    const h = m.querySelector('#qpHub h3'); if (h) h.remove();
    const b1 = box.querySelector('#qzSym'); if (b1) b1.onclick = () => W.BSSymptoms.openPicker(() => { const x = document.getElementById('qzSections'); if (x) x.remove(); if (typeof W.renderMyProfile === 'function') W.renderMyProfile(); });
    const b2 = box.querySelector('#qzSymDefs'); if (b2) b2.onclick = () => W.BSSymptoms.openDefs();
  }
  W.BSQuizHub = { SECTIONS, PRIMARY, ADVANCED_SECTIONS, MERGED, regroup };
})();
