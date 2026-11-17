// v48: calibration hub is where the quiz starts; body check does not block by default.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({ style: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] }) },
  addEventListener() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['control.js', 'symptoms-check.js', 'checkins.js', 'onboarding.js', 'intake.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const O = ctx.BSOnboard, Y = ctx.BSSymptoms;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/id="setCalib"/.test(html) && /Calibration &amp; Conditioning/.test(html), 'calibration section is labelled Calibration & Conditioning');
ok(html.indexOf('id="setCondition"') < 0, 'the separate conditioning section is gone');
ok(html.indexOf('condHubTop') >= 0 && html.indexOf('id="profCalibration"') >= 0 && html.indexOf('calibrationMount') >= 0, 'settings links out and calibration lives on Profiles');
ok(html.indexOf('id="condSetupHint"') >= 0 && html.indexOf('safetyBodyCheck') >= 0, 'home hint and safety body-check mount exist');

const fresh = O.hubTopHtml({ completedAt: 0, profile: null, intakeResume: null });
ok(fresh.indexOf('Start conditioning quiz') >= 0 && fresh.indexOf('id="condQuizStart"') >= 0 && fresh.indexOf('No conditioning profile yet') >= 0, 'a fresh install offers Start conditioning quiz');
ok(O.homeHintHtml({ completedAt: 0 }).indexOf('Set up conditioning') >= 0 && O.homeHintHtml({ completedAt: 0 }).indexOf('condSetupGo') >= 0, 'home hint points at Calibration');

const old = {
  completedAt: 10,
  profile: { levelKey: { day: 'okay', night: 'shaky' }, targetKey: { day: 'little', night: 'little' }, direction: { day: 'A', night: 'A' }, methods: { day: ['relaxed'], night: ['stay_bed'] } },
  intakeResume: null
};
const upgraded = O.hubTopHtml(old);
ok(upgraded.indexOf('Retake quiz') >= 0 && upgraded.indexOf('Day:') >= 0, 'an older profile shows Retake quiz and a status line');
ok(O.homeHintHtml(old).indexOf('Retake the conditioning quiz') >= 0, 'upgrade path still shows the home hint');
ok(O.homeHintHtml({ completedAt: 10, profile: { dimensions: { day: {} } } }) === '', 'hint hides once the quiz profile has dimensions');

const rest = O.hubRestHtml(old);
ok(rest.indexOf('Start Natural Urge with My Conditioning') >= 0 && rest.indexOf('id="hubUrge"') >= 0, 'quick start preselects Natural Urge');
ok(rest.indexOf('Start full session with My Conditioning') >= 0 && rest.indexOf('id="hubSession"') >= 0, 'quick start preselects a full session');
ok(rest.indexOf('data-pace="day"') >= 0 && rest.indexOf('data-pace="night"') >= 0 && rest.indexOf('Do check-in now') >= 0, 'pacing and check-in are in the hub');
const saved = O.load();
saved.completedAt = old.completedAt;
saved.profile = old.profile;
O.save(saved);
ok(O.setPacing('day', 'instant') === 'instant' && O.load().profile.pacing.day === 'instant', 'pacing can change without retaking');

ok(Y.reminder() === 'gentle' && Y.blocksSession() === false, 'body check does not block a session by default');
Y.setReminder('required');
ok(Y.blocksSession() === true, 'required reminders block until a check-in');
Y.applyFlags([]);
ok(Y.blocksSession() === false && Y.checkedToday(), 'saving a body check clears the gate for today');
Y.setReminder('off');
ok(Y.blocksSession() === false, 'off never blocks');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 48, 'version at least 48');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v48 hub tests passed');
