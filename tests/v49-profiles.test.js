// v49: several conditioning profiles, export/import, gated events.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {}, removeChild() {} }, createElement: () => ({ style: {}, href: '', click() {}, setAttribute() {}, appendChild() {}, remove() {} }) },
  addEventListener() {}, navigator: {}, URL: { createObjectURL: () => 'blob:' }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['control.js', 'checkins.js', 'consent.js', 'onboarding.js', 'intake.js', 'cond-events.js', 'cond-profiles.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const O = ctx.BSOnboard, P = ctx.BSCondProfiles, E = ctx.BSCondEvents, K = ctx.BSCheckins, N = ctx.BSConsent;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

store.bs_conditioning_v1 = JSON.stringify({
  v: 1, completedAt: 5,
  profile: {
    starting: { day: 70, night: 40 }, target: { day: 30, night: 80 },
    levelKey: { day: 'okay', night: 'shaky' }, targetKey: { day: 'little', night: 'good' },
    direction: { day: 'A', night: 'B' }, goals: ['urgency'], intensity: 'steady', timeframe: 'open',
    methods: { day: ['relaxed'], night: ['kegels'] }, pacing: { day: 'slow', night: 'instant' }
  },
  habits: { log: [{ ts: 1, method: 'relaxed', track: 'day', reward: 1 }], streak: { day: 2, night: 0 } }
});
const first = O.load();
ok(P.list().length === 1 && P.list()[0].name === 'My Conditioning' && first.profile.methods.day[0] === 'relaxed', 'a single profile becomes slot 1');
ok(P.list()[0].active && O.load().habits.log.length === 1, 'the migrated slot stays active and keeps its streak log');

K.record({ metrics: { F: 6, Ld: 0 }, dayKey: '2026-11-01' });
const id1 = P.active().id;
const made = P.duplicate(id1);
ok(made.ok && P.list().length === 2 && P.list().filter(p => p.active).length === 1, 'duplicate adds a second profile and leaves the original active');
ok(P.rename(made.id, 'Night instant').name === 'Night instant', 'rename');
ok(P.remove(made.id).reason === 'confirm' && P.list().length === 2, 'delete waits for confirm');
K.record({ metrics: { F: 8, Ld: 1 }, dayKey: '2026-11-02' });
const before = K.load().items.length;
ok(P.setActive(made.id).ok, 'switch active');
ok(K.load().items.length === 1, 'the copy keeps the check-ins it had, not ones logged after (' + K.load().items.length + ')');
ok(P.setActive(id1).ok && K.load().items.length === before, 'switching back restores the first check-ins (' + K.load().items.length + ')');
ok(P.remove(made.id, true).ok && P.list().length === 1, 'confirmed delete removes the copy');

const exp = P.exportProfile(id1);
ok(exp.ok && exp.data.kind === 'conditioning-profile' && exp.data.version === '49' && exp.data.nowWant === null || exp.data.pacing.day === 'slow', 'export carries pacing and version');
ok(exp.data.habits && exp.data.habits.log.length === 1 && Array.isArray(exp.data.checkins), 'export carries streak log and check-ins');
const text = P.summaryText(id1);
ok(/Conditioning profile: My Conditioning/.test(text) && /App version 49/.test(text) && /slow/.test(text), 'summary text is pasteable');
const imp = P.importJson(exp.json);
ok(imp.ok && P.list().length === 2 && imp.ids[0] !== id1, 'import adds a new profile');
ok(P.importJson('{').reason === 'json' && P.importJson('{"kind":"nope"}').reason === 'kind', 'bad import is rejected');
ok(P.exportAll().data.kind === 'conditioning-library' && P.exportAll().data.profiles.length === 2, 'export all');

N.accept({ adult: true, understand: true, day: 'A', night: 'B', realDay: false, realNight: false, targets: { day: 30, night: 80 } });
const prof = O.load().profile;
N.stop();
ok(E.eligible(prof).length === 0, 'events stay off when consent is off');
ok(E.eligible(prof, { ignoreConsent: true }).some(e => e.id === 'c_spike') && !E.eligible(prof, { ignoreConsent: true }).some(e => e.id === 'c_hold'), 'direction A gets the surprise urge and not the hold ladder');
ok(E.eligible(prof, { ignoreConsent: true }).some(e => e.id === 'c_relax'), 'relaxed method unlocks the relax drill');
ok(!E.eligible(prof, { ignoreConsent: true, track: 'day' }).some(e => e.id === 'c_wake'), 'night-only events stay off a day roll');
const instant = E.weight(E.EVENTS[0], { starting: { day: 80 }, target: { day: 20 }, pacing: { day: 'instant' } }, 'day');
const slow = E.weight(E.EVENTS[0], { starting: { day: 80 }, target: { day: 20 }, pacing: { day: 'slow' } }, 'day');
ok(instant > slow, 'instant weighs more than slow burn (' + instant + ' > ' + slow + ')');
const picked = E.pick({ profile: prof, ignoreConsent: true, rng: () => 0, log: false, track: 'day' });
ok(picked && picked.group === 'Conditioning' && /real need/i.test(picked.text), 'a picked event is a conditioning event and keeps the real-need line');
ok(E.catalog().length === E.EVENTS.length && E.catalog().every(e => e.source === 'Conditioning'), 'event builder catalog is the conditioning group');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mgr = P.managerHtml();
ok(html.indexOf('id="condProfileManager"') >= 0 && html.indexOf('id="condPickSession"') < 0 && html.indexOf('id="condPickUrge"') < 0, 'the manager is only on Profiles');
['New', 'Retake', 'Edit pacing', 'Duplicate', 'Rename', 'Delete', 'Export', 'Import', 'Export all'].forEach(label => ok(mgr.indexOf(label) >= 0, 'picker includes ' + label));
ok(html.indexOf('value="conditioning"') >= 0, 'event builder has a Conditioning profile');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 49 && +g.match(/versionCode (\d+)/)[1] >= 49, 'version at least 49');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v49 profile tests passed');
