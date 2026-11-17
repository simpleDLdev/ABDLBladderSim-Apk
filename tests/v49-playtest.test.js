// v49 playtest: relax length follows calibration; a thick diaper does not ask for a change at 10%.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {}, removeChild() {} }, createElement: () => ({ style: {}, href: '', click() {}, setAttribute() {}, appendChild() {}, remove() {} }) },
  addEventListener() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['calibration.js', 'gear.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const C = ctx.BSCalib, G = ctx.BSGear;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

[12, 13, 14, 15].forEach(sec => {
  const got = C.releaseSeconds({ medianSec: sec });
  ok(got <= 20 && got <= Math.round(sec * 1.5), 'a ' + sec + 's full void stays ≤20s and ≤1.5× (got ' + got + ')');
});
const full = C.releaseSeconds({ medianSec: 14 });
const half = C.releaseSeconds({ medianSec: 14, fraction: 0.5 });
ok(half < full && half === Math.round(14 * 0.5 + 3), 'a half release is half the calibrated time plus a short grace (' + half + ' vs ' + full + ')');
const slow = C.stepReleaseSeconds({ text: 'SLOW STREAM', time: 30, type: 'relax' }, { medianSec: 14 });
ok(slow <= 20 && slow === full, 'a 30s relax step uses the 14s calibration (' + slow + 's), not 33s');
const part = C.stepReleaseSeconds({ text: 'LET A LITTLE GO', time: 20, type: 'relax', fraction: 0.4 }, { medianSec: 14 });
ok(part < slow && part === Math.round(14 * 0.4 + 3), 'a partial step scales with the fill (' + part + 's)');
ok(C.stepReleaseSeconds({ text: 'BREATHE OUT', time: 4, type: 'relax' }, { medianSec: 14 }) === 4, 'a short relax cue stays a cue');
ok(C.releaseSeconds({ ml: 300, flowMlS: 20 }) === C.releaseSeconds({ medianSec: 15 }), 'no timed trial falls back to volume / flow');
ok(C.releaseSeconds({ medianSec: 10, grace: 40 }) === 15, 'default cap is 1.5× the full void');
ok(C.releaseSeconds({ medianSec: 10, grace: 40, capMul: 3 }) === 30, 'a higher cap the user set can pass 1.5×');

const thick = G.planChange({ gearId: 'G0', sat: 10, size: 'major' });
ok(thick.when === 'later' && thick.delayMin >= 10 && thick.delayMin <= 30, 'thick diaper at 10% waits ' + thick.delayMin + ' min');
ok(thick.offers && thick.offers.length === 3, 'the later check offers still fine / change / remind');
const under = G.planChange({ gearId: 'G6', sat: 100, size: 'major' });
ok(under.when === 'now', 'underwear over capacity asks immediately');
ok(G.planChange({ gearId: 'G0', sat: 90, size: 'major' }).when === 'now', 'a thick diaper near full asks immediately');
ok(G.planChange({ gearId: 'G4', sat: 10, size: 'major' }).when === 'now', 'a pad asks immediately');
const stay = G.planChange({ gearId: 'G0', sat: 10, size: 'major', direction: 'A' });
const sooner = G.planChange({ gearId: 'G0', sat: 10, size: 'major', direction: 'B' });
ok(stay.when === 'later' && sooner.when === 'later' && stay.delayMin > sooner.delayMin, 'untraining waits longer than a more-control profile');
ok(G.planChange({ gearId: 'G0', sat: 70, direction: 'A' }).when === 'later', 'untraining still waits at 70%');
const custom = G.planChange({ gearId: 'G0', sat: 10, size: 'major', windowMin: 12, windowMax: 18 });
ok(custom.when === 'later' && custom.delayMin >= 12 && custom.delayMin <= 18, 'the profile window is the delay range');
ok(G.planChange({ gearId: 'G0', sat: 10, size: 'dribble' }).when === 'none', 'a dribble in a thick diaper skips the check');

const rec = G.scheduleCheck(thick, 1_000_000);
ok(rec && G.peekCheck(1_000_000).waiting && G.peekCheck(rec.at).due, 'the check-in is stored until its time');
ok(G.resolveCheck('remind', rec.at).delayMin === 20 && G.peekCheck(rec.at).waiting, 'remind me later schedules another check');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v49 playtest ok');
