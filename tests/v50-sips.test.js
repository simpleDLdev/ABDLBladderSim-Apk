// v50: conditioning hydration is sips, and a 250 ml drink does not silence them.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, Map, parseInt, parseFloat, isNaN, isFinite, Number, String, Error,
  setTimeout(fn) { return 1; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById() { return null; }, visibilityState: 'visible' },
  addEventListener() {},
  sessionRunning: false, hydrationEndAt: 0, hydrationEnabled: true, profileMode: 'conditioning',
  meetingActive: false, mainEndAt: 0, microEndAt: 0
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['safety.js', 'engine.js', 'native-notify.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const S = ctx.BSSafety;
S.setSipCap(true);
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const T = new Date(2026, 10, 17, 8, 0, 0).getTime();

S.reset();
S.capDrink(250, { now: T, src: 'engine' });
const afterPrompt = S.capSips(2, { now: T + 19 * 60000, minGapMin: 15 });
ok(afterPrompt.ok && afterPrompt.sips === 2 && afterPrompt.ml === 30, 'sips still fire 19 min after a 250 ml prompt (' + afterPrompt.reason + ')');

S.reset();
ok(S.noteUserDrink(250, { now: T }).ok && S.noteUserDrink(250, { now: T }).blocked === false, 'a self-logged drink is never blocked');
const soon = S.capSips(1, { now: T + 5 * 60000, minGapMin: 15 });
ok(!soon.ok && soon.reason === 'after_log' && soon.nextAt - T <= 20 * 60000, 'a logged glass nudges the next sip by minutes, not 2 h');
const afterLog = S.capSips(2, { now: T + 19 * 60000, minGapMin: 15 });
ok(afterLog.ok && afterLog.sips === 2, 'sips fire 19 min after a logged 250 ml, inside a 15 min window');
ok(S.capDrink(200, { now: T + 30 * 60000 }).ok, 'a logged glass does not start the 2 h large-prompt clock');

S.reset();
ok(S.capDrink(250, { now: T }).ml === 250, 'a large prompt still commits');
const spaced = S.capDrink(100, { now: T + 30 * 60000 });
ok(!spaced.ok && spaced.reason === 'spacing', 'large prompts stay 2 h apart');

S.reset();
let ml = 0, blocked = null;
for (let i = 0; i < 80; i++) {
  const r = S.capSips(1, { now: T + i * 11 * 60000 });
  if (!r.ok) { blocked = r; break; }
  ml += r.ml;
}
ok(ml <= 1000 && ml >= 1000 - S.SIP_ML && blocked && blocked.reason === 'daily', 'sips stop at the 1 L day (' + ml + ' ml)');
const leftover = S.capDrink(250, { now: T + 66 * 11 * 60000 });
ok(leftover.ok && leftover.ml === 1000 - ml && leftover.ml < 250, 'a large prompt is cut to the ml still left in the day (' + (leftover && leftover.ml) + ')');
ok(!S.capDrink(250, { now: T + 66 * 11 * 60000 + 3 * 3600000 }).ok, 'once the day is full, the next prompt is blocked');

const logged = [];
ctx.logToOutput = html => logged.push(String(html));
ctx.profileMode = 'conditioning';
ctx.createDrinkPrompt();
ok(logged.length === 0, 'a conditioning session does not prompt a single glass');
ctx.profileMode = 'standard';
S.reset();
ctx.createDrinkPrompt();
ok(logged.some(t => /250|200/.test(t)), 'another profile can still prompt a glass');

ctx.profileMode = 'conditioning';
ctx.sessionRunning = true;
ctx.hydrationEnabled = true;
ctx.hydrationEndAt = Date.now() + 20 * 60000;
ctx.mainEndAt = 0;
ctx.microEndAt = 0;
const during = ctx.BSNativeAlarm.collectDesired().get(ctx.BSNativeAlarm.ID.hydration);
ok(during && during.kind === 'reminder' && /sip/i.test(during.body) && during.at === ctx.hydrationEndAt, 'the session sip is scheduled on the hydration notification');
ctx.sessionRunning = false;
ctx.urgeConditioningSips = () => true;
const urge = ctx.BSNativeAlarm.collectDesired().get(ctx.BSNativeAlarm.ID.hydration);
ok(urge && /sip/i.test(urge.body), 'Natural Urge on a conditioning profile schedules the same sip notification');

const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const urgeJs = fs.readFileSync(path.join(root, 'js', 'simple-urge.js'), 'utf8');
ok(ui.indexOf('Next sip') >= 0 && ui.indexOf('Not thirsty / skip') >= 0, 'the session clock names the next sip and the prompt can be skipped');
ok(urgeJs.indexOf('id="suSip"') >= 0, 'Natural Urge shows the sip line');
const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 50 && +g.match(/versionCode (\d+)/)[1] >= 50, 'version at least 50');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v50 sip tests passed');
