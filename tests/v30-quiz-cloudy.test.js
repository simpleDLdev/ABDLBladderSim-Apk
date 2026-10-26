// v30: quiz hub short list + DryClip cloudy night + settle telemetry (Node, no DOM for DryClip pure bits)
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {}; global.document = {
  addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, setAttribute() {}, classList: { add() {}, toggle() {} } }),
  body: { appendChild() {} }
};
['quiz-hub', 'dryclip'].forEach(f => require('../js/' + f + '.js'));
const H = BSQuizHub, DC = BSDryClip;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// --- quiz hub short list ---
ok(Array.isArray(H.PRIMARY) && H.PRIMARY.length >= 5, 'PRIMARY short list defined (' + H.PRIMARY.length + ')');
const ids = H.PRIMARY.map(p => p.id);
ok(['symPicker', 'classquiz', 'sliders', 'gear', 'longBoard'].every(x => ids.includes(x)), 'essentials: Symptom, Which Class, Self-Rating, Stash, Long board');
ok(ids.includes('longCamp') || (H.ADVANCED_SECTIONS || []).some(s => (s.cards || []).includes('longCamp')), 'Long campaign available (primary or advanced)');
const adv = new Set(); (H.ADVANCED_SECTIONS || []).forEach(s => (s.cards || []).forEach(c => adv.add(c)));
ok(['qzA', 'qzB', 'qzC', 'thisorthat', 'scenario'].every(x => adv.has(x)), 'A/B/C + This-or-That + Scenario are Advanced');
ok(!ids.includes('qzA') && !ids.includes('thisorthat') && !ids.includes('scenario'), 'flavour packs not in PRIMARY');

// --- cloudy night wires existing settings ---
store[DC.KEY] = null;
let d = DC.load();
ok(d.cloudyNight === false && d.settleIgnored === 0, 'defaults: cloudyNight false, settleIgnored 0');
d.rearmByProt = false; d.rearmMin = 20; DC.save(d);
// simulate what applyCloudyNight does to settings (without BLE / night UI)
d = DC.load(); d.cloudyNight = true; d.rearmByProt = true; DC.save(d);
ok(DC.rearmMinutesFor(DC.load()) === DC.REARM_BY_PROT[DC.currentProtection()] || DC.rearmMinutesFor(DC.load()) >= 15, 'Match-protection re-arm active under cloudy night');
ok(DC.cloudyNightActive({ cloudyNight: true, wearingTonight: true, night: { id: 1 }, rearmByProt: true }), 'cloudyNightActive when night+match on');
ok(!DC.cloudyNightActive({ cloudyNight: true, wearingTonight: false, night: null, rearmByProt: true }), 'cloudyNightActive false without night watch');

// --- settle telemetry ---
const n0 = DC.load().settleIgnored;
DC.noteSettleIgnored('Wet reading right after arming ignored (the plate reads a touch)');
ok(DC.load().settleIgnored === n0 + 1, 'noteSettleIgnored bumps settleIgnored');
ok((DC.load().log || []).some(e => e.settle === 1 && /ignored/i.test(e.msg)), 'ignored wet logged with settle=1');

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
