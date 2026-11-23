// v60: night quiet is scoped to the night. A day session started after night conditioning gets its
// native notifications right away, and stale night state is healed on load. Runs the real native-notify
// sync against a fake BladderAlarm plugin.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

function makeCtx() {
  const store = {}, timers = [], loads = [];
  const armed = new Map(), calls = { scheduled: [], cancelled: [], stopAll: 0, cal: [] };
  const BA = {
    async getPending() { return { alarms: Array.from(armed.entries()).map(([id, a]) => ({ id, at: a.at, kind: a.kind })) }; },
    async schedule(o) { armed.set(o.id, o); calls.scheduled.push(o); return { id: o.id, at: o.at, mode: 'exactIdle' }; },
    async cancel(o) { armed.delete(o.id); calls.cancelled.push(o.id); },
    async cancelAll() { armed.clear(); },
    async checkPermissions() { return { notifications: 'granted', exactAlarm: 'granted' }; },
    async requestNotifications() { return { notifications: 'granted', exactAlarm: 'granted' }; },
    async requestExactAlarm() {}
  };
  const ctx = {
    console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, RegExp, Map, Promise,
    setTimeout: (fn, ms) => { timers.push({ fn, ms: ms || 0 }); return timers.length; }, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    navigator: {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, visibilityState: 'hidden', body: { classList: { add() {}, remove() {} } } },
    addEventListener: (t, fn) => { if (t === 'load') loads.push(fn); },
    Capacitor: { isNativePlatform: () => true, Plugins: { BladderAlarm: BA } },
    calls
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['control.js', 'cond-events.js', 'cond-deck-v57.js', 'cond-night-v59.js', 'natural-night.js', 'night-cond.js'].forEach(f => vm.runInContext(read('js/' + f), ctx, { filename: f }));
  const before = loads.length;
  vm.runInContext(read('js/native-notify.js'), ctx, { filename: 'native-notify.js' });
  const nativeLoad = loads.slice(before);
  vm.runInContext(`
    var sessionRunning = false, mainTimer = null, preChimeTimer = null, microTimer = null, hydrationTimer = null;
    var mainEndAt = null, microEndAt = null, hydrationEndAt = null, pendingMainEvent = null, lastMicroEvent = null, lastMacroEvent = null;
    var profileMode = 'conditioning', customProfileRuntime = null, manualPressure = 0, meetingActive = false, babysitterScheduledEvents = [];
    function stopAll() { calls.stopAll++; sessionRunning = false; mainEndAt = null; microEndAt = null; hydrationEndAt = null; }
    function getProfileConfig() { return { scheduler: 'standard', mainMin: 20, mainMax: 30 }; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function saveState() {} function scheduleNextMicro() {} function setCountdownLabel() {} function startChime() {} function alarmMain() {}
    function logToOutput() {} function startVoidGuide() {}
    function $() { return null; }
  `, ctx);
  const engine = read('js/engine.js');
  const extract = (src, name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
  ['conditioningDeckEvent', 'prerollEvent', 'scheduleMainEvent'].forEach(n => vm.runInContext(extract(engine, n), ctx));
  ctx.BSCalendar = { addEntry(e) { calls.cal.push(e); return e; } };
  async function flush() {
    for (let k = 0; k < 20; k++) {
      await new Promise(r => setImmediate(r));
      const due = timers.splice(0); due.forEach(t => { try { t.fn(); } catch (e) {} });
      if (!due.length) { await new Promise(r => setImmediate(r)); if (!timers.length) break; }
    }
  }
  async function boot() { nativeLoad.forEach(fn => fn()); await flush(); }
  async function sync() { ctx.nativeNotifySync(); await flush(); }
  return { ctx, store, armed, calls, flush, boot, sync, g: s => vm.runInContext(s, ctx) };
}

const less = {
  levelKey: { day: 'none', night: 'none' }, direction: { day: 'A', night: 'A' },
  goals: ['bedwetting', 'deeper', 'urgency'], methods: { day: ['relaxed'], night: ['stay_bed', 'deeper_sleep'] },
  sleep: { alarm: 'off', deeper: 'more', stay: 'yes' }, pacing: { night: 'steady', day: 'steady' },
  starting: { day: 10, night: 10 }, target: { day: 5, night: 5 }
};
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

(async () => {
  // ---- 1. Night conditioning, then a day session at noon ----
  const T = makeCtx();
  const { ctx, armed, g } = T;
  ctx.BSOnboard = { load: () => ({ profile: less }) };
  await T.boot();
  const N = ctx.BSNightCond, A = ctx.BSNativeAlarm;
  N.open();
  const st = N.loadState();
  st.done = [{ id: 'drinks', skipped: true }, { id: 'potty', skipped: true }];
  // wake time in the future, so the night is really on
  const soon = new Date(Date.now() + 6 * 3600e3);
  const pad = n => String(n).padStart(2, '0');
  st.wakeAt = pad(soon.getHours()) + ':' + pad(soon.getMinutes());
  const cond = N.finishRoutine(st);
  await T.sync();
  ok(armed.has(N.MORNING_ID) && Math.abs(armed.get(N.MORNING_ID).at - cond.wakeAt) < 1000, 'routine end arms the morning check-in natively at the wake time');
  ok(armed.get(N.MORNING_ID).allowWhileIdle === true && armed.get(N.MORNING_ID).channel === A.MORNING_CHANNEL, 'it is sent as allow-while-idle on the high-importance morning channel');
  ok(armed.size === 1, 'during the night only the morning check-in is armed');
  ok(ctx.isBedwettingSilent() === true, 'the night is silent');

  // The user starts a day session (what startSession(false) does first).
  N.dayStart('day session started');
  g('sessionRunning = true; hydrationEndAt = Date.now() + 8 * 60000;');
  ctx.BSCondEvents.resetDeck();
  g('scheduleMainEvent()');
  await T.sync();
  ok(ctx.isBedwettingSilent() === false && ctx._nightCondQuiet === false && ctx._condTrack === 'day', 'starting a day session ends the night quiet and the night track');
  const ids = Array.from(armed.keys());
  ok(ids.indexOf(A.ID.main) >= 0 && ids.indexOf(A.ID.hydration) >= 0, 'the day session main event and sip are armed natively right away (' + ids.join(',') + ')');
  ok(ids.some(id => id !== A.ID.dryclipMorning && id !== N.MORNING_ID), 'the native schedule is not limited to DryClip / morning items');
  ok(g('pendingMainEvent') && g('pendingMainEvent').track !== 'night', 'the day session draws day events');
  ok(ctx.BSNight.get() && ctx.BSNight.get().silenceOff && !armed.has(N.MORNING_ID), 'the night stays in Nights for its check-in but no longer mutes or rings');

  // ---- 2. Wake time passes with no day session: quiet ends by itself ----
  const W = makeCtx();
  W.ctx.BSOnboard = { load: () => ({ profile: less }) };
  await W.boot();
  W.ctx.BSNightCond.open();
  const st2 = W.ctx.BSNightCond.loadState(); st2.wakeAt = '07:00';
  const c2 = W.ctx.BSNightCond.finishRoutine(st2);
  ok(W.ctx.BSNightCond.quietNow(c2.wakeAt + 60000) === false && W.ctx.BSNight.active(c2.wakeAt + 60000) === false, 'after the wake time the night no longer mutes anything');

  // ---- 3. Stale state on load is healed ----
  const S = makeCtx();
  S.ctx.BSOnboard = { load: () => ({ profile: less }) };
  const now = Date.now();
  // A v59 leftover quiet state plus a conditioning night whose wake time was 4 h ago.
  S.store['bs_night_cond_v1'] = JSON.stringify({ phase: 'quiet', optedIn: false, wets: [] });
  S.store['bs_natural_night'] = JSON.stringify({ v: 1, phase: 'night', bedtime: now - 13 * 3600e3, drinks: [], timeline: [{ k: 'bed', ts: now - 13 * 3600e3 }], wakes: 0, awake: false, pendingRoll: null, protection: 'diapers', unit: 'ml',
    cond: { v: 60, profile: less, dir: 'A', optedIn: false, clipMode: 'off', wake: '07:00', wakeAt: now - 4 * 3600e3, events: [], clipWets: [] } });
  ok(S.ctx.BSNightCond.quietNow() === false, 'a night past its wake time is not quiet even before healing');
  const healed = S.ctx.BSNightCond.restore();
  ok(healed === false && !S.store['bs_night_cond_v1'] && !S.ctx.BSNight.get(), 'on load the v59 leftover and the stale night are cleared');
  ok(S.calls.cal.length === 1 && S.calls.cal[0].tags.indexOf('night-conditioning') >= 0 && /Closed automatically/.test(S.calls.cal[0].memo), 'the stale night is saved to the calendar, not lost');
  await S.boot();
  S.g('sessionRunning = true;');
  S.g('scheduleMainEvent()');
  await S.sync();
  ok(S.armed.has(S.ctx.BSNativeAlarm.ID.main), 'after healing, a day session is armed natively');
  // A stale routine (started 13 h ago) is cleared too.
  S.store['bs_night_cond_v1'] = JSON.stringify({ phase: 'routine', startedAt: now - 13 * 3600e3, i: 2, steps: [], done: [] });
  ok(S.ctx.BSNightCond.quietNow() === false && S.ctx.BSNightCond.heal().indexOf('stale-routine') >= 0, 'a routine left open for hours is not quiet and is cleared');

  // ---- 4. Natural Night's morning check-in uses the same reliable path ----
  const P = makeCtx();
  await P.boot();
  const mAt = Date.now() + 5 * 3600e3;
  P.ctx.BSNight.begin({ drinks: [], protection: 'none', morningAt: mAt });
  await P.sync();
  ok(P.armed.has(P.ctx.BSNight.MORNING_ID) && P.armed.get(P.ctx.BSNight.MORNING_ID).at === mAt && P.armed.size === 1, 'Natural Night arms only its morning check-in, natively');
  ok(P.ctx.BSNight.active(mAt + 1000) === false && P.ctx.BSNight.morningDue(mAt + 1000) === true, 'Natural Night silence ends at the morning time and the check-in is due');

  const java = read('android/app/src/main/java/dev/simpledl/bladdersim/alarm/AlarmScheduler.java');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  ok(/CHANNEL_MORNING = "bs_morning_v1"/.test(java) && /CHANNEL_MORNING, "Morning check-in", NotificationManager\.IMPORTANCE_HIGH/.test(java) && /CHANNEL_MORNING\.equals\(ch\)/.test(java), 'Android creates and uses a high-importance morning channel');
  ok(/setExactAndAllowWhileIdle/.test(java) && /USE_EXACT_ALARM/.test(manifest) && /SCHEDULE_EXACT_ALARM/.test(manifest) && /POST_NOTIFICATIONS/.test(manifest) && /BOOT_COMPLETED/.test(manifest), 'manifest has notification, exact-alarm and boot-reschedule support');

  if (fail) { console.error(fail + ' failed'); process.exit(1); }
  console.log('v60 day-after-night ok');
})().catch(e => { console.error(e); process.exit(1); });
