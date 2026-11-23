/* ===========================
   bladder-tank.js — v53 estimated fill for conditioning sessions.
   Sips add a little. A slow baseline adds a little more. A void only
   happens once the estimate is above a minimum, so an empty tank
   gets a drink before another accident.
   =========================== */
(function () {
  const KEY = 'bs_tank_v1';
  const SIP_ML = 15;
  function defaults(opts) {
    opts = opts || {};
    const capacity = Math.max(80, Math.round(+opts.capacity || 300));
    const minVoidMl = opts.minVoidMl != null ? Math.round(+opts.minVoidMl) : Math.max(50, Math.round(capacity * 0.2));
    const ml = opts.ml != null ? +opts.ml : Math.round(capacity * 0.1);
    return {
      capacity: capacity,
      ml: Math.max(0, Math.min(capacity, ml)),
      minVoidMl: minVoidMl,
      sipMin: 4,
      sipMax: 4,
      gapMin: 30,
      gapMax: 30,
      baselineMlPerMin: 0.35
    };
  }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    return Object.assign(defaults(), s || {});
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function reset(opts) { return save(defaults(opts)); }
  function addSips(s, n) {
    s = s || load();
    const count = Math.max(0, Math.round(+n || 0));
    s.ml = Math.min(s.capacity, s.ml + count * SIP_ML);
    return save(s);
  }
  function undoSips(s, n) {
    s = s || load();
    s.ml = Math.max(0, s.ml - Math.max(0, Math.round(+n || 0)) * SIP_ML);
    return save(s);
  }
  function tickBaseline(s, minutes) {
    s = s || load();
    s.ml = Math.min(s.capacity, s.ml + (s.baselineMlPerMin || 0) * Math.max(0, +minutes || 0));
    return save(s);
  }
  function canVoid(s) { s = s || load(); return s.ml >= s.minVoidMl; }
  function takeVoid(s, kind) {
    s = s || load();
    if (!canVoid(s)) return { ok: false, ml: 0, left: Math.round(s.ml) };
    const frac = kind === 'partial' || kind === 'micro' ? 0.3 : 0.75;
    const out = Math.min(s.ml, Math.max(1, Math.round(s.ml * frac)));
    s.ml = Math.max(0, s.ml - out);
    save(s);
    return { ok: true, ml: out, left: Math.round(s.ml) };
  }
  /** How long until the next void. A low tank waits, and a drink should come first. */
  function eventWaitMin(s) {
    s = s || load();
    if (!canVoid(s)) {
      const gap = Math.max(5, Math.round(s.gapMin || 30));
      return { voidOk: false, waitMin: gap, waitMax: gap + 5, reason: 'low' };
    }
    const frac = s.capacity ? s.ml / s.capacity : 0;
    const wait = Math.round(36 - 22 * Math.min(1, frac));
    return { voidOk: true, waitMin: Math.max(8, wait - 3), waitMax: Math.max(12, wait + 4), reason: 'fill' };
  }
  function readout(s, nextAt) {
    s = s || load();
    const eta = nextAt && nextAt > Date.now() ? Math.max(0, Math.ceil((nextAt - Date.now()) / 60000)) : null;
    return { ml: Math.round(s.ml), capacity: s.capacity, minVoidMl: s.minVoidMl, etaMin: eta, low: !canVoid(s) };
  }
  /** One drink alarm at a time, and not again until the quiet gap has passed. */
  function sipGate(opts) {
    opts = opts || {};
    const gapMin = Math.max(1, Math.round(+opts.gapMin || 30));
    if (opts.showing) return { ok: false, waitMin: gapMin, reason: 'showing' };
    const last = +opts.lastAt || 0;
    const now = +opts.now || 0;
    if (!last) return { ok: true, waitMin: 0, reason: '' };
    const left = last + gapMin * 60000 - now;
    if (left <= 0) return { ok: true, waitMin: 0, reason: '' };
    return { ok: false, waitMin: Math.max(1, Math.ceil(left / 60000)), reason: 'gap' };
  }
  function randInt(a, b, rng) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return lo + Math.floor(rng() * (hi - lo + 1));
  }
  /** Pure session: one minute at a time. Used to prove a 2 hour run still drinks. */
  function simulate(opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const minutes = Math.max(1, Math.round(+opts.minutes || 127));
    const tank = defaults({ capacity: opts.capacity, ml: opts.startMl, minVoidMl: opts.minVoidMl });
    let nextSip = randInt(tank.gapMin, tank.gapMax, rng);
    let nextEvent = null;
    const sips = [], voids = [], blocked = [];
    for (let t = 1; t <= minutes; t++) {
      tank.ml = Math.min(tank.capacity, tank.ml + tank.baselineMlPerMin);
      if (t >= nextSip) {
        const n = randInt(tank.sipMin, tank.sipMax, rng);
        tank.ml = Math.min(tank.capacity, tank.ml + n * SIP_ML);
        sips.push({ t: t, n: n, ml: Math.round(tank.ml) });
        nextSip = t + randInt(tank.gapMin, tank.gapMax, rng);
      }
      if (nextEvent == null) {
        const plan = eventWaitMin(tank);
        nextEvent = { at: t + plan.waitMin, voidOk: plan.voidOk };
      }
      if (t >= nextEvent.at) {
        if (tank.ml < tank.minVoidMl) {
          blocked.push({ t: t, ml: Math.round(tank.ml) });
          nextEvent = null;
        } else {
          const before = tank.ml;
          const out = Math.min(tank.ml, Math.max(1, Math.round(tank.ml * 0.7)));
          tank.ml -= out;
          voids.push({ t: t, before: Math.round(before), out: Math.round(out) });
          nextEvent = null;
        }
      }
    }
    return {
      sips: sips.length,
      voids: voids.length,
      blocked: blocked.length,
      voidsBelowMin: voids.filter(v => v.before < tank.minVoidMl).length,
      log: { sips: sips, voids: voids, blocked: blocked },
      ml: Math.round(tank.ml),
      minVoidMl: tank.minVoidMl
    };
  }
  window.BSTank = {
    KEY, SIP_ML, defaults, load, save, reset, addSips, undoSips, tickBaseline,
    canVoid, takeVoid, eventWaitMin, readout, simulate, sipGate
  };
})();
