// v53: a 2 hour conditioning session keeps drinking, and does not void an empty tank.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll: () => [] },
  addEventListener() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['profile-config.js', 'bladder-tank.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const T = ctx.BSTank;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const plan = ctx.conditioningSipPlan('none');
ok(plan.count === 4 && plan.gapMin === 30 && plan.sips.join() === '4,4', 'Infant conditioning is a batch of 4, then 30 min quiet');
ok(plan.from === 'dependent', 'lowest control still points at the dependent profile');

const run = T.simulate({
  minutes: 120,
  capacity: 300,
  startMl: 20,
  minVoidMl: 60,
  rng: () => 0.4
});
ok(run.sips === 4 && run.log.sips.every(s => s.n === 4), 'a 2h session is 4 prompts of 4 sips (' + run.sips + ')');
ok(run.log.sips.every((s, i) => i === 0 || s.t - run.log.sips[i - 1].t >= 30), 'no two sip prompts fall inside 30 min');
ok(run.voidsBelowMin === 0, 'no void fires under the tank minimum');
ok(run.log.voids.every(v => v.before >= 60), 'every void started at or above 60 ml');
ok(run.log.blocked.every(b => b.ml < 60), 'held voids were the ones under the minimum');

const low = T.defaults({ capacity: 300, ml: 20, minVoidMl: 60 });
ok(!T.canVoid(low) && T.eventWaitMin(low).voidOk === false, 'a low tank asks for a drink before a void');
const full = T.defaults({ capacity: 300, ml: 180, minVoidMl: 60 });
ok(T.canVoid(full) && T.eventWaitMin(full).voidOk && T.eventWaitMin(full).waitMin >= 8, 'a fuller tank can void, and not immediately');

const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'js', 'guide.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8');
ok(ui.indexOf('id="tankReadout"') < 0 && fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('id="tankReadout"') >= 0, 'the session screen has a tank readout');
ok(guide.indexOf('triggerHydrationEvent(true)') >= 0, 'an aborted guide forces a drink check');
ok(engine.indexOf('scheduleNextHydration()') >= 0 && engine.indexOf('isBannerVisible') >= 0, 'resume recovery still re-arms hydration');
ok(ui.indexOf("profileMode === 'conditioning') window.hydrationEnabled = true") >= 0, 'a conditioning session turns sip reminders on');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 53 && +g.match(/versionCode (\d+)/)[1] >= 53, 'version at least 53');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v53 tank tests passed');
