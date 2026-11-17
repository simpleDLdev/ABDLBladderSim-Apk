/* ===========================
   event-queue.js — one banner or guide at a time.
   A sip logged while a guide is up does not finish that guide.
   A second copy of the same key is dropped.
   =========================== */
(function () {
  const q = [];
  let showing = null;
  function kindOf(item) { return item ? item.kind : null; }
  function keysOf(list) { return list.map(item => item.key); }
  function has(key) {
    if (!key) return false;
    if (showing && showing.key === key) return true;
    return q.some(item => item.key === key);
  }
  function snapshot() {
    return { active: kindOf(showing), activeKey: showing && showing.key, waiting: q.map(kindOf), keys: keysOf(q) };
  }
  function offer(item) {
    item = item || {};
    if (item.key && has(item.key)) return { duplicate: true, state: showing ? 'waiting' : 'idle', active: kindOf(showing), waiting: q.map(kindOf) };
    if (!showing) {
      showing = item;
      return { duplicate: false, state: 'active', active: item.kind, waiting: [] };
    }
    q.push(item);
    return { duplicate: false, state: 'waiting', active: showing.kind, waiting: q.map(kindOf) };
  }
  function replaceActive(item) {
    showing = item || null;
    return snapshot();
  }
  function completeActive() {
    const done = showing;
    showing = q.shift() || null;
    if (showing && typeof showing.show === 'function') {
      try { showing.show(); } catch (e) {}
    }
    return { doneKind: kindOf(done), nextKind: kindOf(showing), abortedGuide: false, waiting: q.map(kindOf) };
  }
  /** Logging a sip only finishes the queue when the sip itself is what is on screen. */
  function logSip() {
    if (!showing || showing.kind !== 'sip') {
      return { logged: false, abortedGuide: false, active: kindOf(showing), waiting: q.map(kindOf) };
    }
    const next = completeActive();
    return { logged: true, abortedGuide: false, active: next.nextKind, waiting: next.waiting };
  }
  function clear() { q.length = 0; showing = null; }
  function current() { return showing; }
  window.BSEventQueue = { offer, replaceActive, completeActive, logSip, clear, current, snapshot, has };
})();
