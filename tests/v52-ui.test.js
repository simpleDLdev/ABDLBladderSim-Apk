// v52: manager only on Profiles, drag order, visible bio-logger, urge pull, level hydration.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
  addEventListener() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['profile-config.js', 'control.js', 'checkins.js', 'consent.js', 'onboarding.js', 'intake.js', 'cond-events.js', 'cond-profiles.js', 'layout.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const P = ctx.BSCondProfiles, E = ctx.BSCondEvents, L = ctx.BSLayout;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const session = html.slice(html.indexOf('id="tab-session"'), html.indexOf('id="tab-path"'));
const urge = html.slice(html.indexOf('id="tab-urge"'), html.indexOf('id="tab-calendar"'));
const profiles = html.slice(html.indexOf('id="tab-profiles"'), html.indexOf('id="tab-settings"'));
ok(session.indexOf('condProfileManager') < 0 && session.indexOf('data-cact') < 0, 'Session has no conditioning manager');
ok(urge.indexOf('condProfileManager') < 0 && urge.indexOf('data-cact') < 0 && urge.indexOf('condPickUrge') < 0, 'Urge has no conditioning manager');
ok(profiles.indexOf('id="condProfileManager"') >= 0 && profiles.indexOf('id="profQuizzes"') >= 0 && profiles.indexOf('id="profCalibration"') >= 0, 'Profiles keeps the manager, quizzes, and calibration');
ok(html.indexOf('id="sessionSetupCondPick"') >= 0 && session.indexOf('id="sessionCondPick"') >= 0, 'Session conditioning choice opens a saved-profile list');
ok(html.indexOf('id="pressureSlider"') >= 0 && html.indexOf('id="saturationSlider"') >= 0 && !/id="bioLoggerSection"[^>]*display:\s*none/.test(html), 'urgency and saturation sliders are visible without the gear');
ok(/id="bioLoggerAdvanced"[^>]*display:\s*none/.test(html), 'the gear section starts closed');

store.bs_conditioning_v1 = JSON.stringify({
  v: 2, completedAt: 5, activeId: 'a',
  profiles: [
    { id: 'a', name: 'Day relaxed', active: true, profile: { direction: { day: 'A', night: 'A' } } },
    { id: 'b', name: 'Night control', profile: { direction: { day: 'B', night: 'B' } } }
  ],
  profile: { direction: { day: 'A', night: 'A' }, levelKey: { day: 'none', night: 'none' }, targetKey: { day: 'none', night: 'none' }, methods: { day: ['relaxed'], night: [] } }
});
const sub = P.subPickerHtml('suCondPick');
ok(sub.indexOf('Day relaxed') >= 0 && sub.indexOf('Night control') >= 0 && sub.indexOf('Manage') >= 0, 'the conditioning sub-picker lists saved profiles');
ok(sub.indexOf('data-cact') < 0, 'the sub-picker is not the button grid');

const ids = ['profConditioning', 'profQuizzes', 'profCalibration'];
ok(L.reorderList(ids, 'profCalibration', 0).join() === 'profCalibration,profConditioning,profQuizzes', 'drag places a section at the new index');
L.place('tab-profiles', 'profCalibration', 0);
const saved = L.load();
ok(saved.groups['tab-profiles'].order[0] === 'profCalibration', 'the new order is saved');

const none = ctx.hydrationForLevel('none');
const full = ctx.hydrationForLevel('full');
ok(none.profileId === 'dependent' && none.sips[0] === 4 && none.sips[1] === 8, 'Infant hydration is the dependent profile');
ok(full.sips[1] < none.sips[1], 'higher control asks for fewer sips than Infant');

const pull = ctx.urgeAcceleration({ urgency: 9, remainingSec: 20 * 60, direction: 'A', targetKey: 'none' });
ok(pull.change && pull.delaySec <= 180 && pull.delaySec < 20 * 60, 'urgency 9 on a less-control profile pulls the event inside 3 min (' + pull.delaySec + 's)');
const quiet = ctx.urgeAcceleration({ urgency: 2, remainingSec: 20 * 60, direction: 'A', targetKey: 'none' });
ok(!quiet.change, 'a low urgency leaves the queued event alone');
const hold = ctx.urgeAcceleration({ urgency: 8, remainingSec: 60, direction: 'B', targetKey: 'full', methods: [] });
ok(!hold.change, 'more-control does not add a hold unless that method is on');

const a = { direction: { day: 'A', night: 'A' }, methods: { day: ['relaxed'], night: [] }, starting: { day: 40, night: 40 }, target: { day: 10, night: 10 } };
const b = { direction: { day: 'B', night: 'B' }, methods: { day: ['urge_surf'], night: [] }, starting: { day: 40, night: 40 }, target: { day: 80, night: 80 } };
const aIds = E.eligible(a, { ignoreConsent: true, track: 'day' }).map(e => e.id);
const bIds = E.eligible(b, { ignoreConsent: true, track: 'day' }).map(e => e.id);
ok(aIds.indexOf('c_hold') < 0 && aIds.indexOf('c_relax') >= 0, 'untraining does not get the hold drill');
ok(bIds.indexOf('c_hold') >= 0 && bIds.indexOf('c_surf') >= 0, 'more-control gets the shaping drills that were opted in');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 52 && +g.match(/versionCode (\d+)/)[1] >= 52, 'version at least 52');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v52 ui tests passed');
