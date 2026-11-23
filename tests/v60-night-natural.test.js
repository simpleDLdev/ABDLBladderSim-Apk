// v60: night conditioning runs like a Natural Night. No event timer, no pending event,
// no sips, and only DryClip + the morning check-in as notifications. Day timer unchanged.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const calls = { stopAll: 0, guides: [], logs: [] };
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, RegExp,
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  navigator: {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, body: { classList: { add() {}, remove() {} } } },
  addEventListener() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
['control.js', 'cond-events.js', 'cond-deck-v57.js', 'cond-night-v59.js', 'natural-night.js', 'night-cond.js', 'native-notify.js'].forEach(f => {
  vm.runInContext(read('js/' + f), ctx, { filename: f });
});
// Session globals the day timer owns (stand-ins for ui.js / engine.js state).
vm.runInContext(`
  var sessionRunning = false, mainTimer = null, preChimeTimer = null, microTimer = null, hydrationTimer = null;
  var mainEndAt = null, microEndAt = null, hydrationEndAt = null, pendingMainEvent = null, lastMicroEvent = null, lastMacroEvent = null;
  var profileMode = 'conditioning', customProfileRuntime = null, manualPressure = 0, meetingActive = false;
  var babysitterScheduledEvents = [];
  function stopAll() { calls.stopAll++; sessionRunning = false; clearTimeout(mainTimer); mainEndAt = null; microEndAt = null; hydrationEndAt = null; }
  function getProfileConfig() { return { scheduler: 'standard', mainMin: 20, mainMax: 30 }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function saveState() {} function scheduleNextMicro() {} function setCountdownLabel() {} function startChime() {} function alarmMain() {}
  function logToOutput(h) { calls.logs.push(h); }
  function startVoidGuide(seq, text, kind) { calls.guides.push({ seq, text, kind }); }
  function $() { return null; }
`, Object.assign(ctx, { calls }));
// Pull the real engine functions so the day timer is the shipped one.
const engine = read('js/engine.js');
function extract(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let depth = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (depth === 0) break; } }
  return src.slice(i, j + 1);
}
['conditioningDeckEvent', 'prerollEvent', 'scheduleMainEvent'].forEach(n => vm.runInContext(extract(engine, n), ctx, { filename: 'engine.js#' + n }));
const g = s => vm.runInContext(s, ctx);
const set = s => vm.runInContext(s, ctx);

let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const less = {
  levelKey: { day: 'none', night: 'none' }, direction: { day: 'A', night: 'A' },
  goals: ['bedwetting', 'deeper', 'urgency'], methods: { day: ['relaxed'], night: ['stay_bed', 'deeper_sleep'] },
  sleep: { alarm: 'off', deeper: 'more', stay: 'yes' }, pacing: { night: 'steady', day: 'steady' },
  starting: { day: 10, night: 10 }, target: { day: 5, night: 5 }
};
const more = {
  levelKey: { day: 'good', night: 'good' }, direction: { day: 'B', night: 'B' },
  goals: ['control'], methods: { day: ['urge_surf'], night: ['alarm'] },
  sleep: { alarm: 'on' }, pacing: { night: 'gradual', day: 'gradual' },
  starting: { day: 85, night: 85 }, target: { day: 92, night: 92 }
};
let activeProfile = less;
ctx.BSOnboard = { load: () => ({ profile: activeProfile }) };
const N = ctx.BSNightCond, NN = ctx.BSNight, A = ctx.BSNativeAlarm, E = ctx.BSCondEvents;

// ---- Day timer, before any night: unchanged behaviour ----
set("window._condTrack = 'day'; window._nightCondQuiet = false; sessionRunning = true;");
E.resetDeck();
g('scheduleMainEvent()');
const dayEnd = g('mainEndAt'), dayEv = g('pendingMainEvent');
ok(dayEnd && dayEnd - Date.now() >= 19 * 60000 && dayEnd - Date.now() <= 31 * 60000, 'day conditioning still sets the main event timer (20–30 min here)');
ok(dayEv && dayEv.track !== 'night', 'day conditioning still prerolls a day event (' + (dayEv && dayEv.label) + ')');

// ---- Start night conditioning while a day session is running ----
const opened = N.open();
ok(opened.ok && N.loadState().phase === 'routine', 'night conditioning opens on the bedtime routine');
ok(calls.stopAll === 1 && g('sessionRunning') === false, 'the running day session is stopped before the routine');
ok(g('mainEndAt') === null && g('pendingMainEvent') === null && g('hydrationEndAt') === null, 'no event timer, pending event, or sip timer during the routine');
ok(ctx._nightCondQuiet === true && ctx._condTrack === 'night', 'the night track is quiet from the first step');
ok(ctx.isBedwettingSilent() === true, 'the routine is already silent');

// Walk the routine: drinks, potty done; clip skipped (not opted in); wake 07:30.
const st = N.loadState();
st.done = [{ id: 'drinks', skipped: false }, { id: 'potty', skipped: false }, { id: 'gear', skipped: false }];
st.wakeAt = '07:30'; st.worn = 'thick diaper'; st.optedIn = false; st.clipMode = 'off';
const bed = new Date(); bed.setHours(23, 0, 0, 0);
const cond = N.finishRoutine(st, bed.getTime());
const night = NN.get();
ok(night && night.phase === 'night' && night.cond && night.cond.v === 60, 'after the routine it is a Natural Night with the conditioning layer');
ok(N.loadState() === null, 'the routine state is cleared');
ok(NN.active() && ctx.isBedwettingSilent(), 'the night is silent like a Natural Night');
ok(night.protection === 'thick_diapers' && night.drinks.length === 1 && night.lastPeeAt, 'routine gear, drink, and last potty carry into the night log');
const wake = new Date(cond.wakeAt);
ok(wake.getHours() === 7 && wake.getMinutes() === 30 && cond.wakeAt > bed.getTime(), 'the morning check-in is at the routine wake time');

// ---- The engine never schedules anything overnight ----
set('sessionRunning = true;');
g('scheduleMainEvent()');
ok(g('mainEndAt') === null && g('pendingMainEvent') === null, 'scheduleMainEvent sets no timer and prerolls nothing at night');
set('sessionRunning = false;');

// ---- Notifications: only the morning check-in ----
let desired = A.collectDesired();
const ids = Array.from(desired.keys());
ok(ids.length === 1 && ids[0] === N.MORNING_ID, 'the only notification is the morning check-in (' + ids.join(',') + ')');
ok(desired.get(N.MORNING_ID).at === cond.wakeAt, 'it fires at the wake time');
ok(!desired.has(A.ID.main) && !desired.has(A.ID.micro) && !desired.has(A.ID.hydration), 'no main, spasm, or sip alarms');
const mItem = desired.get(N.MORNING_ID);
ok(mItem.allowWhileIdle === true && mItem.channel === A.MORNING_CHANNEL && mItem.kind === 'reminder', 'the morning alarm is exact/allow-while-idle on the high-importance morning channel');
const quietKeep = A.quietDesired();
ok(quietKeep.has(N.MORNING_ID) && quietKeep.get(N.MORNING_ID).allowWhileIdle === true, 'the quiet-night cancel path keeps the morning check-in');
const prevArmed = new Map([[N.MORNING_ID, { at: cond.wakeAt }], [A.ID.main, { at: Date.now() + 600000 }]]);
const dq = A.diff(prevArmed, quietKeep, Date.now());
ok(dq.toCancel.indexOf(N.MORNING_ID) < 0 && dq.toCancel.indexOf(A.ID.main) >= 0, 'the quiet sync cancels the day alarm but not the morning check-in');
ok(N.quietNow(cond.wakeAt - 60000) === true && N.quietNow(cond.wakeAt + 1) === false && NN.active(cond.wakeAt + 1) === false, 'the quiet ends by itself at the wake time');
// DryClip opted in: DryClip owns the morning alarm, nothing else is added.
NN.condUpdate(c => { c.optedIn = true; c.clipMode = 'quiet'; });
ctx.BSDryClip = { pendingAlarm: () => ({ id: A.ID.dryclipMorning, at: cond.wakeAt, kind: 'reminder', title: 'DryClip', body: 'Morning check-in' }) };
desired = A.collectDesired();
ok(Array.from(desired.keys()).join() === String(A.ID.dryclipMorning), 'with DryClip opted in, only the DryClip morning check-in is scheduled');
ok(desired.get(A.ID.dryclipMorning).channel === A.MORNING_CHANNEL && desired.get(A.ID.dryclipMorning).allowWhileIdle === true, 'the DryClip morning check-in uses the same reliable path');
delete ctx.BSDryClip;

// ---- Resume / restart never brings the timer back ----
set("sessionRunning = true; mainEndAt = Date.now() + 600000; window._nightCondQuiet = false; window._condTrack = 'day';");
ok(N.restore() === true, 'restore finds the running night');
ok(g('sessionRunning') === false && g('mainEndAt') === null && ctx._nightCondQuiet === true && ctx._condTrack === 'night', 'resume stops the restored timer and stays quiet');
const ui = read('js/ui.js');
ok(/if \(isResume && window\.BSNightCond && window\.BSNightCond\.quietNow && window\.BSNightCond\.quietNow\(\)\)/.test(ui), 'a resume during a quiet night does not bring the day timer back');
ok(/if \(!isResume\) \{ try \{ if \(window\.BSNightCond && window\.BSNightCond\.dayStart\) window\.BSNightCond\.dayStart/.test(ui), 'starting a day session ends the night quiet first');

// ---- I woke up: urge / already wet / dry draw night events ----
const urge = N.wakeEvent({ urge: true, wet: false }, { rng: () => 0.3 });
const wet = N.wakeEvent({ urge: false, wet: true }, { rng: () => 0.3 });
const dry = N.wakeEvent({ urge: false, wet: false }, { rng: () => 0.3 });
ok(urge && urge.track === 'night' && urge.nightKind === 'urgeA', 'I woke up with an urge draws a night let-go event (' + (urge && urge.label) + ')');
ok(wet && wet.track === 'night' && wet.nightKind === 'stay', 'already wet draws a stay-in-bed event');
ok(dry && dry.track === 'night' && dry.nightKind === 'dry', 'dry draws a dry-wake event');
ok(calls.guides.length === 3, 'each wake event opens its guide');
ok(NN.get().cond.events.length === 3, 'wake events are logged on the night');
activeProfile = more;
NN.condUpdate(c => { c.profile = more; c.dir = 'B'; });
const up = N.wakeEvent({ urge: true }, { rng: () => 0.3, noGuide: true });
ok(up && up.nightKind === 'urgeB' && up.track === 'night', 'more control wakes to a get-up night event');
NN.condUpdate(c => { c.profile = less; c.dir = 'A'; });
activeProfile = less;

// ---- I need to pee draws from the night deck ----
const peeEv = N.needToPee({ rng: () => 0.99, noGuide: true, noRender: true });
ok(peeEv.kind === 'event' && peeEv.event.track === 'night', 'I need to pee at night draws a night event (' + (peeEv.event && peeEv.event.label) + ')');
const pass = N.needToPee({ rng: () => 0, noRender: true });
ok(pass.kind === 'pass' && NN.get().pendingRoll && NN.get().pendingRoll.pass, 'or gives a potty pass on the night screen');
NN.sleep();
ok(ui.indexOf('window.BSNightCond.needToPee()') >= 0, 'the session-screen button routes to the night deck while the night is on');

// ---- DryClip path ----
NN.condUpdate(c => { c.optedIn = true; c.clipMode = 'quiet'; c.clipWets = []; });
const q = N.onClipWet({ wetAt: bed.getTime() + 3 * 3600e3 });
ok(q.handled && q.alert === false && NN.get().cond.clipWets.length === 1, 'quiet DryClip logs the wet time with no alert');
const before = calls.guides.length;
NN.condUpdate(c => { c.clipMode = 'gentle'; });
const soft = N.onClipWet({ wetAt: bed.getTime() + 4 * 3600e3 });
ok(soft.alert === 'soft' && calls.guides.length === before + 1 && NN.get().cond.clipWets.length === 2, 'gentle DryClip shows a soft guide');
NN.condUpdate(c => { c.clipMode = 'alarm'; c.profile = more; c.dir = 'B'; });
const full = N.onClipWet({});
ok(full.alert === 'full' && calls.guides.length === before + 2, 'alarm DryClip wakes fully');
NN.condUpdate(c => { c.optedIn = false; });
ok(N.onClipWet({}).handled === false, 'without opt-in the clip does nothing overnight');
ok(read('js/dryclip.js').indexOf('BSNightCond.onClipWet') >= 0, 'a clip wet still reaches night conditioning');
ok(ctx.isBedwettingSilent() && g('mainEndAt') === null, 'still no timer after wake, pee, and clip events');

// ---- Morning ----
ctx.BSCalendar = { entries: [], addEntry(e) { this.entries.push(e); return e; } };
NN.rise();
const saved = NN.finish({ wakeAt: cond.wakeAt, wet: true, sat: 70, wets: 2, feeling: 'sleepy', rem: 'no', urg: 30 });
ok(saved && saved.tags.indexOf('night-conditioning') >= 0 && saved.night.cond && saved.night.cond.events.length >= 5, 'the morning check-in saves the conditioning night with its events');
ok(saved.night.wets === 2 && saved.night.feeling === 'sleepy' && saved.night.cond.clipWets.length === 3, 'it keeps wets, feeling, and clip wet times');
ok(!NN.get() && !N.active() && ctx._nightCondQuiet === false && ctx._condTrack === 'day', 'after the morning the night is over');
ok(A.collectDesired().size === 0 && !ctx.isBedwettingSilent(), 'no night notifications are left');

// ---- Day timer unchanged after the night ----
set('sessionRunning = true;');
E.resetDeck();
g('scheduleMainEvent()');
ok(g('mainEndAt') > Date.now() + 19 * 60000 && g('pendingMainEvent') && g('pendingMainEvent').track !== 'night', 'the day timer and day deck come back for day conditioning');

// ---- About + version ----
const about = E.aboutText(less);
ok(/no event timer/.test(about) && /morning check-in/.test(about) && /DryClip sleep mode is off/.test(about), 'About night section explains the quiet night');
ok(/no event timer/.test(N.routine(less).find(s => s.id === 'wake').text), 'the wake step says there is no event timer');
const gradle = read('android/app/build.gradle');
ok(/versionName "(\d+)"/.test(gradle) && +gradle.match(/versionName "(\d+)"/)[1] >= 60 && +gradle.match(/versionCode (\d+)/)[1] >= 60, 'version at least 60');
ok(+JSON.parse(read('package.json')).version.split('.')[0] >= 60, 'package version at least 60');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v60 night-natural ok');
