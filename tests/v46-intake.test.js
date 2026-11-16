// v46 file kept so the suite still runs. The situational quiz was replaced in v47.
// This checks a saved v46-shaped profile still loads, and the version moved on.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, body: { appendChild() {} }, createElement() { return { style: {}, appendChild() {}, querySelector() { return null; } }; } },
  addEventListener() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['control.js', 'onboarding.js', 'intake.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f }));
const O = ctx.BSOnboard, I = ctx.BSIntake;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const s = O.load();
s.completedAt = 5;
s.profile = { starting: { day: 40, night: 30 }, target: { day: 20, night: 10 }, targetKey: { day: 'little', night: 'none' }, levelKey: { day: 'shaky', night: 'little' }, direction: { day: 'A', night: 'A' }, goals: [], intensity: 'steady', timeframe: 'open', methods: { day: ['relaxed'], night: ['stay_bed'] }, gear: null };
s.habits.log = [{ ts: 1, method: 'relaxed', track: 'day', reward: 1 }];
O.save(s);
const back = O.load();
ok(back.profile.methods.day[0] === 'relaxed' && back.habits.log.length === 1, 'a v46-shaped profile still loads');
ok(I.questions().length >= 40 && !I.questions().some(q => /Where you want this to land/.test(q.q)), 'the repeated scene wording is gone');
const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 46, 'version at least 46');
if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v46 compatibility checks passed');
