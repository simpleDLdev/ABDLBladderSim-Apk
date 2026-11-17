// v51: conditioning sips are the regular session prompts, and they are not stopped at 1 L.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, Map, parseInt, parseFloat, isNaN, isFinite, Number, String, Error,
  setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById() { return null; }, visibilityState: 'visible' },
  addEventListener() {},
  sessionRunning: true, hydrationEndAt: 0, hydrationEnabled: true, profileMode: 'conditioning',
  meetingActive: false, mainEndAt: 0, microEndAt: 0
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['safety.js', 'profile-config.js', 'engine.js', 'native-notify.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const S = ctx.BSSafety;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const early = ctx.hydrationCadence('early');
const cond = ctx.hydrationCadence('conditioning');
ok(cond.schedule === early.schedule && cond.schedule === 'scheduleNextHydration', 'conditioning schedules sips with the regular function');
ok(cond.prompt === early.prompt && cond.prompt === 'triggerHydrationEvent', 'conditioning shows the regular sip prompt');
ok(cond.notifyId === 1003 && cond.notifyId === early.notifyId, 'the sip notification id is the regular hydration alarm');
ok(cond.minMin === early.minMin && cond.maxMin === early.maxMin, 'the gap is the regular 6–12 min loop');
ok(cond.sips[0] === 1 && cond.sips[1] === 2, 'a conditioning prompt is 1–2 sips');

const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const logic = fs.readFileSync(path.join(root, 'js', 'profile-logic.js'), 'utf8');
ok(logic.indexOf('scheduleNextHydration()') >= 0, 'a conditioning session starts the regular hydration loop');
ok(ui.indexOf('Not thirsty / skip') >= 0 && ui.indexOf('The next sip reminder still comes') >= 0, 'skip is on the prompt and the loop continues');
ok(ui.indexOf('Sips paused') < 0, 'reminders are not paused at 1 L');
ok(ui.indexOf("skipBtn.textContent = \"Not thirsty / skip\"") >= 0, 'the skip control is the banner button');

ok(S.sipCapOn() === false, 'the sip cap is off by default');
const T = new Date(2026, 10, 17, 8, 0, 0).getTime();
S.reset();
let ml = 0, blocked = false;
for (let i = 0; i < 80; i++) {
  const r = S.capSips(1, { now: T + i * 60000, src: 'hydration' });
  if (!r.ok) blocked = true;
  ml += r.ml;
}
ok(!blocked && ml > 1000, 'sips continue past 1 L (' + ml + ' ml logged)');
const logged = S.status(T + 80 * 60000);
ok(logged.total === 0, 'uncapped sips stay out of the large-prompt budget');

S.setSipCap(true);
S.reset();
let cappedMl = 0, hit = null;
for (let i = 0; i < 80; i++) {
  const r = S.capSips(1, { now: T + i * 11 * 60000 });
  if (!r.ok) { hit = r; break; }
  cappedMl += r.ml;
}
ok(hit && hit.reason === 'daily' && cappedMl <= 1000, 'turning the cap on still stops sips at 1 L');
S.setSipCap(false);

ctx.customProfileRuntime = null;
ctx.hydrationEndAt = Date.now() + 12 * 60000;
const alarm = ctx.BSNativeAlarm.collectDesired().get(1003);
ok(alarm && alarm.kind === 'reminder' && /sip/i.test(alarm.body), 'the hydration notification is still scheduled');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 51 && +g.match(/versionCode (\d+)/)[1] >= 51, 'version at least 51');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v51 sip tests passed');
