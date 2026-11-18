// v60: night conditioning is a silent night. No timer, no preroll, no sip alarms.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  document: {
    hidden: false,
    getElementById() { return null; },
    addEventListener() {},
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }
  },
  navigator: { userAgent: 'node', maxTouchPoints: 0, vibrate() {} },
  addEventListener() {}
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
}
['js/control.js', 'js/cond-events.js', 'js/cond-deck-v57.js', 'js/cond-night-v59.js', 'js/night-cond.js'].forEach(load);
store.profileMode = 'conditioning';
vm.runInContext(
  ['js/state.js', 'js/engine.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')
  + '\nthis.readClock = function () { return { mainEndAt: mainEndAt, sessionRunning: sessionRunning, pendingMainEvent: pendingMainEvent, microEndAt: microEndAt, hydrationEndAt: hydrationEndAt }; };',
  ctx,
  { filename: 'state-engine.js' }
);
load('js/native-notify.js');

const E = ctx.BSCondEvents, N = ctx.BSNightCond;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const less = {
  levelKey: { day: 'none', night: 'none' }, direction: { day: 'A', night: 'A' },
  goals: ['bedwetting', 'deeper', 'urgency'], methods: { day: ['relaxed'], night: ['stay_bed', 'deeper_sleep'] },
  sleep: { alarm: 'off', deeper: 'more', stay: 'yes' }, pacing: { night: 'steady', day: 'steady' },
  starting: { day: 10, night: 10 }, target: { day: 5, night: 5 }
};

const dayPlan = N.sessionPlan({ track: 'day' });
ok(dayPlan.timer && dayPlan.countdown && dayPlan.preroll && dayPlan.sips && dayPlan.eta, 'day plan keeps the timer, countdown, preroll, sips, and tank ETA');
ok(dayPlan.notifications.indexOf('main') >= 0 && dayPlan.notifications.indexOf('hydration') >= 0, 'day plan still notifies for the main event and sips');

const quietOff = N.sessionPlan({ track: 'night', phase: 'quiet', quiet: true, optedIn: false });
ok(!quietOff.timer && !quietOff.countdown && !quietOff.preroll && !quietOff.sips && !quietOff.eta && quietOff.pending == null, 'quiet night has no timer, countdown, preroll, sips, ETA, or pending event');
ok(quietOff.notifications.length === 1 && quietOff.notifications[0] === 'morning', 'quiet night notifies only the morning check-in when DryClip is off (' + quietOff.notifications.join(',') + ')');
const quietOn = N.sessionPlan({ track: 'night', phase: 'quiet', quiet: true, optedIn: true });
ok(quietOn.notifications.indexOf('morning') >= 0 && quietOn.notifications.indexOf('dryclip') >= 0 && quietOn.notifications.length === 2, 'opted-in DryClip is the only extra night notification');
const routine = N.sessionPlan({ phase: 'routine' });
ok(!routine.timer && routine.notifications.length === 0, 'the bedtime routine does not start a timer or a notification');

ctx._nightCondQuiet = false;
try { localStorageRemove(); } catch (e) {}
function localStorageRemove() { delete store.bs_night_cond_v1; ctx._nightCondQuiet = false; }
localStorageRemove();
const dayEv = ctx.prerollEvent('full');
ok(!!dayEv && dayEv.desc, 'day preroll still returns an event (' + (dayEv && (dayEv.label || dayEv.desc || dayEv.kind)) + ')');

const wakeAt = Date.now() + 8 * 3600000;
N.saveState({
  phase: 'quiet', profile: less, optedIn: false, clipMode: 'off', wakeAt: '07:00', wakeTs: wakeAt,
  bedtime: Date.now(), wets: [], wakes: 0
});
ctx._nightCondQuiet = true;
ok(N.noTimer() && N.isQuiet(), 'a saved quiet night blocks the timer');
ok(ctx.prerollEvent('micro') == null && ctx.prerollEvent('full') == null, 'night preroll does not create a pending event');
ctx.scheduleMainEvent();
const clock = ctx.readClock();
ok(clock.mainEndAt == null && clock.sessionRunning === false && clock.pendingMainEvent == null, 'resuming the scheduler clears the night clock instead of arming it');

const morning = N.pendingMorning(Date.now());
ok(morning && morning.id === N.MORNING_ID && morning.at === wakeAt && morning.kind === 'reminder', 'morning check-in is scheduled at the routine wake time');
ok(!N.clipOptedIn(), 'DryClip stays off until the routine opts in');

['urge', 'wet', 'dry'].forEach(which => {
  const answers = which === 'urge' ? { urge: true } : which === 'wet' ? { wet: true } : {};
  const ev = N.drawWake(less, answers, { rng: () => 0.2 });
  ok(ev && ev.track === 'night', 'I woke up (' + which + ') draws a night event (' + (ev && ev.nightKind) + ')');
});
const pee = N.drawPee(less, { rng: () => 0.3, tank: { ml: 220, minVoidMl: 50 } });
ok(pee && pee.track === 'night', 'I need to pee draws from the night deck (' + (pee && pee.label) + ')');

const quiet = N.clipReaction({ optedIn: true, mode: 'quiet', direction: 'A', wetAt: 50 });
const gentle = N.clipReaction({ optedIn: true, mode: 'gentle', direction: 'A' });
const alarm = N.clipReaction({ optedIn: true, mode: 'alarm', direction: 'B' });
const off = N.clipReaction({ optedIn: false, mode: 'alarm' });
ok(quiet.alert === false && quiet.logged, 'quiet DryClip logs and does not alert');
ok(gentle.alert === 'soft' && alarm.alert === 'full' && off.handled === false, 'gentle and alarm still react, and opt-out does not');
N.saveState({ phase: 'quiet', profile: less, optedIn: true, clipMode: 'quiet', wakeAt: '07:00', wakeTs: wakeAt, wets: [] });
const handled = N.onClipWet({ wetAt: 50 });
ok(handled && handled.logged && (N.loadState().wets || []).length === 1, 'an opted-in quiet clip wet is logged on the night');

const desiredOff = ctx.BSNativeAlarm.collectDesired();
const idsOff = [...desiredOff.keys()];
ok(idsOff.indexOf(morning.id) >= 0 && idsOff.indexOf(1001) < 0 && idsOff.indexOf(1002) < 0 && idsOff.indexOf(1003) < 0, 'notifications while quiet are the morning check-in, not the session timer (' + idsOff.join(',') + ')');
ctx.BSDryClip = { pendingAlarm: () => ({ id: 1960, at: wakeAt, kind: 'reminder', title: 'DryClip', body: 'Morning check-in' }) };
N.saveState({ phase: 'quiet', profile: less, optedIn: false, clipMode: 'off', wakeAt: '07:00', wakeTs: wakeAt, wets: [] });
const stillOff = [...ctx.BSNativeAlarm.collectDesired().keys()];
ok(stillOff.indexOf(1960) < 0, 'a DryClip alarm is not scheduled when you did not opt in');
N.saveState({ phase: 'quiet', profile: less, optedIn: true, clipMode: 'gentle', wakeAt: '07:00', wakeTs: wakeAt, wets: [] });
const withClip = [...ctx.BSNativeAlarm.collectDesired().keys()];
ok(withClip.indexOf(1960) >= 0 && withClip.indexOf(morning.id) >= 0 && withClip.indexOf(1001) < 0, 'opted-in DryClip and the morning check-in are the only alarms (' + withClip.join(',') + ')');

localStorageRemove();
vm.runInContext('window._nightCondQuiet = false; sessionRunning = true; mainEndAt = Date.now() + 1200000; microEndAt = Date.now() + 600000; hydrationEndAt = Date.now() + 400000; profileMode = "conditioning";', ctx);
const dayNotes = ctx.BSNativeAlarm.collectDesired();
ok(dayNotes.has(1001), 'a day session still schedules the main alarm');
ok(dayNotes.has(1002) || dayNotes.has(1003) || dayNotes.has(ctx.BSNativeAlarm.ID.main), 'day notifications still include the session clock');

const engine = fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8');
const sched = engine.slice(engine.indexOf('function scheduleMainEvent'), engine.indexOf('function alarmMain'));
ok(sched.indexOf('nightCondNoTimer') >= 0 && sched.indexOf('nightCondNoTimer') < sched.indexOf("prerollEvent('full')"), 'the night guard returns before the day preroll');
ok(sched.indexOf("pendingMainEvent = prerollEvent('full')") >= 0 && sched.indexOf('mainEndAt = Date.now() + ms') >= 0, 'the day timer still prerolls and sets an end time');
const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
ok(ui.indexOf('nightCondNoTimer') < ui.indexOf('sessionRunning = true'), 'resume and start do not arm a night session');
const about = N.aboutNight(less);
ok(/no event timer/.test(about) && /Night events available/.test(about) && /DryClip sleep mode is off/.test(about), 'About night says the night is silent');
const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
ok(/versionName "60"/.test(g) && /versionCode 60/.test(g) && /"version": "60.0.0"/.test(pkg), 'version 60');
ok(fs.existsSync(path.join(root, 'docs/CONDITIONING-v60.md')), 'v60 notes exist');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v60 night natural ok');
