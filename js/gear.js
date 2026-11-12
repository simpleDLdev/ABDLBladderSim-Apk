/* ===========================
   gear.js — v44 gear ladder, including pads/liners.
   Recommended step comes from the calibration baseline (quiz, then check-ins).
   G0 thick … G3 pull-up (not fully dry) … G4 pad … G6 underwear.
   The advisor and pass requests assume the recommended step and warn on a mismatch.
   =========================== */
(function () {
  const KEY = 'bs_gear_v1';
  const LADDER = [
    { id: 'G0', prot: 'thick_diapers', label: 'Thick diaper', capMl: 1500 },
    { id: 'G1', prot: 'diapers', label: 'Diaper', capMl: 1000 },
    { id: 'G2', prot: 'pullups', label: 'Thin diaper / overnight pull-up', capMl: 600 },
    { id: 'G3', prot: 'pullups', label: 'Pull-up', capMl: 400 },
    { id: 'G4', prot: 'pad', label: 'Pad / liner', capMl: 150 },
    { id: 'G5', prot: 'training', label: 'Training pants', capMl: 80 },
    { id: 'G6', prot: 'none', label: 'Underwear', capMl: 0 }
  ];
  const FROM_PROT = { thick_diapers: 'G0', diapers: 'G1', pullups: 'G3', pad: 'G4', none: 'G6', training: 'G5' };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const idx = id => Math.max(0, LADDER.findIndex(g => g.id === id));
  function byId(id) { return LADDER.find(g => g.id === id) || LADDER[6]; }
  function defaults() {
    const items = {};
    LADDER.forEach(g => { items[g.id] = { label: g.label, capMl: g.capMl, owned: g.id === 'G6' ? 1 : 0 }; });
    return { v: 1, items: items, recommended: { day: 'G6', night: 'G6', at: 0, why: { day: '', night: '' } }, bed: { protector: false, pad: 0 }, homePrep: { seatPad: false, towel: false }, stats: { day: {}, night: {} }, skinCapHours: { default: 4, G6: 1 } };
  }
  function load() { return Object.assign(defaults(), J(KEY, {})); }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function fromProt(prot, night) {
    if (prot === 'pullups' && night) return 'G2';
    return FROM_PROT[prot] || 'G6';
  }
  /** Map a baseline profile to day and night steps. Metrics win over "what I wear". */
  function recommend(b) {
    b = b || {};
    const Ld = b.Ld, I = b.I, U = b.U, W = b.W, F = b.F, Dn = b.Dn, Wn = b.Wn, Sn = b.Sn;
    let day = null, night = null, whyD = '', whyN = '';
    const haveDay = Ld != null || I != null || U != null || W != null || F != null;
    const haveNight = Dn != null || Wn != null || Sn != null;
    if (haveDay) {
      if ((Ld != null && Ld >= 2.5) || (W != null && W <= 3 && (U == null || U >= 7)) || (F != null && F >= 13)) {
        day = 'G1'; whyD = 'Leaks or warning fit a diaper.';
      } else if ((Ld != null && Ld >= 1) || (I != null && I < 75) || (W != null && W < 10 && (U == null || U >= 6))) {
        day = 'G3'; whyD = 'Not fully dry — a pull-up matches this baseline.';
      } else if ((Ld != null && Ld >= 0.25) || (W != null && W < 20) || (U != null && U >= 5)) {
        day = 'G4'; whyD = 'Leaks at this rate fit a pad.';
      } else if (Ld != null && Ld > 0.05) {
        day = 'G5'; whyD = 'Small leaks — training pants.';
      } else {
        day = 'G6'; whyD = 'Baseline looks dry by day.';
      }
    }
    if (haveNight) {
      if ((Dn != null && Dn <= 0.25) || (Wn != null && Wn >= 1.4) || (Sn != null && Sn >= 0.8)) {
        night = 'G0'; whyN = 'Wet nights are heavy enough for a thick diaper.';
      } else if ((Dn != null && Dn < 0.6) || (Wn != null && Wn >= 0.6)) {
        night = 'G2'; whyN = 'Some wet nights — overnight pull-up.';
      } else if ((Dn != null && Dn < 0.9) || (Sn != null && Sn > 0.2)) {
        night = 'G4'; whyN = 'Light night wets — a pad can cover them.';
      } else {
        night = 'G6'; whyN = 'Nights look dry.';
      }
    }
    if (!day) day = fromProt(b.protDay, false);
    if (!night) night = fromProt(b.protNight, true);
    if (!whyD) whyD = day === 'G4' ? 'Usual day gear is a pad.' : 'From what you usually wear, until a check-in.';
    if (!whyN) whyN = 'From what you usually wear at night, until a check-in.';
    return { day: day, night: night, why: { day: whyD, night: whyN } };
  }
  function baselineFromQuiz(q) {
    q = q || {}; const a = q.a || {};
    if (!q.a && !(q.baseline)) return null;
    const n = k => (a[k] == null || a[k] === '' ? null : +a[k]);
    const band = (v, table) => (v == null || !table[v] && table[v] !== 0 ? null : table[v]);
    const Ld = band(n('leaks'), [0, 0.35, 1.2, 3]);
    const F = band(n('frequency'), [5, 8, 11, 13]);
    const U = band(n('urgency'), [2, 4, 7, 9]);
    const holdW = band(n('holdTime'), [70, 45, 20, 5]);
    const warnW = band(n('warning'), [30, 18, 8, 2]);
    let W = null;
    if (holdW != null && warnW != null) W = Math.min(holdW, warnW);
    else W = holdW != null ? holdW : warnW;
    const nights = n('nights');
    const Dn = band(nights, [1, 0.9, 0.55, 0.2]);
    const Wn = band(nights, [0, 0.15, 0.7, 1.6]);
    const Sn = band(n('nightWake'), [0.1, 0.25, 0.5, 0.85]);
    return { Ld: Ld, F: F, U: U, W: W, I: W != null ? Math.max(45, W * 3) : null, Dn: Dn, Wn: Wn, Sn: nights == null ? null : Sn, protDay: a.protDay || null, protNight: a.protNight || null };
  }
  function mergeBase(quizB, checkB) {
    const o = Object.assign({}, quizB || {});
    if (!checkB) return o;
    Object.keys(checkB).forEach(k => { if (checkB[k] != null && checkB[k] !== '') o[k] = checkB[k]; });
    return o;
  }
  function currentBaseline() {
    let q = null;
    try { q = baselineFromQuiz(window.BSQuiz && window.BSQuiz.load && window.BSQuiz.load()); } catch (e) {}
    let c = null;
    try { c = window.BSCheckins && window.BSCheckins.latestMetrics && window.BSCheckins.latestMetrics(); } catch (e) {}
    return mergeBase(q, c);
  }
  function apply(rec) {
    const s = load();
    s.recommended = { day: rec.day, night: rec.night, at: Date.now(), why: rec.why || {} };
    save(s);
    try {
      if (window.BSControl && window.BSControl.setTrack) {
        window.BSControl.setTrack('day', { gear: { recommended: rec.day } });
        window.BSControl.setTrack('night', { gear: { recommended: rec.night } });
      }
    } catch (e) {}
    return s.recommended;
  }
  function refresh() { return apply(recommend(currentBaseline())); }
  function recommended(track) {
    const r = load().recommended || {};
    return r[track === 'night' ? 'night' : 'day'] || 'G6';
  }
  /** 'match' | 'lighter' | 'heavier'. Higher ladder index is lighter gear. */
  function compare(wearing, rec) {
    if (!wearing || !rec) return 'match';
    const iw = idx(wearing), ir = idx(rec);
    if (iw === ir) return 'match';
    return iw > ir ? 'lighter' : 'heavier';
  }
  function wearingFromInventory() {
    try {
      const inv = window.BSSimpleUrge && window.BSSimpleUrge.inv && window.BSSimpleUrge.inv();
      if (inv && inv.wearing) return fromProt(inv.wearing, false);
    } catch (e) {}
    return null;
  }
  function warn(track, wearing) {
    const rec = recommended(track || 'day');
    const w = wearing || wearingFromInventory();
    if (!w) return { cmp: 'match', rec: rec, wearing: null, text: '' };
    const cmp = compare(w, rec);
    const text = cmp === 'lighter' ? 'Lighter than the gear your baseline points to (' + byId(rec).label + ').'
      : cmp === 'heavier' ? 'Heavier than the gear your baseline points to (' + byId(rec).label + ').'
      : '';
    return { cmp: cmp, rec: rec, wearing: w, text: text };
  }
  function warnHtml() {
    const d = warn('day'), n = warn('night');
    if (!d.text && !n.text) return '';
    return `<div class="urge-note" id="gearWarn">${d.text ? 'Day: ' + d.text : ''} ${n.text ? 'Night: ' + n.text : ''}</div>`;
  }
  window.BSGear = { KEY, LADDER, FROM_PROT, load, save, byId, fromProt, recommend, baselineFromQuiz, mergeBase, currentBaseline, apply, refresh, recommended, compare, wearingFromInventory, warn, warnHtml };
})();
