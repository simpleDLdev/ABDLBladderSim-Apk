// v44: two-track control, partial outcome, pass request, drinks, sleep, gear, symptoms.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError, Promise,
  setTimeout, clearTimeout, Uint8Array, DataView,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({ style: {}, classList: { add() {} }, appendChild() {} }) },
  addEventListener() {}, dispatchEvent() {}, location: { hash: '' }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['control.js', 'gear.js', 'symptoms-check.js', 'partial.js', 'passes.js', 'drinks.js', 'sleep-source.js', 'checkins.js', 'consent.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const C = ctx.BSControl, G = ctx.BSGear, P = ctx.BSPartial, R = ctx.BSPasses, D = ctx.BSDrinks, S = ctx.BSSleep, K = ctx.BSCheckins, Y = ctx.BSSymptoms, N = ctx.BSConsent;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

store.bs_control_v1 = JSON.stringify({ value: 42, direction: 'regress', cap: 6, dayDelta: 1, lastDay: '2026-01-01', countWaitAccidents: true, history: [{ ts: 1, kind: 'go', d: 1, v: 42 }] });
const mig = C.load();
ok(mig.v === 2 && mig.value === 42 && mig.tracks.day.value === 42 && mig.tracks.night.value === 42, 'v1 value copied to both tracks');
ok(mig.countWaitAccidents === true && mig.legacy && mig.legacy.history.length === 1 && mig.tracks.day.history[0].kind === 'go', 'legacy kept and wait-count flag kept');
ok(mig.direction === 'regress' && mig.tracks.day.target < mig.tracks.day.value, 'regress target sits below the meter');
delete store.bs_control_v1;
ok(C.load().countWaitAccidents === false && C.load().v === 2, 'new save defaults real-wait counting off');

const noon = new Date(2026, 5, 1, 12, 0).getTime();
ok(C.trackFor(noon) === 'day' && C.trackFor(noon, 'bed') === 'night' && C.trackFor(new Date(2026, 5, 1, 23, 30).getTime()) === 'night', 'trackFor day, bed, and sleep window');
C.saveSettings({ value: 70, direction: 'progress' });
ok(C.load().value === 70 && C.direction('day') === 'progress', 'value slider keeps direction');
ok(C.event('failed_wait', { source: 'real', track: 'day', now: noon }) === 0 && C.load().value === 70, 'real failed wait does not move the meter');
C.saveSettings({ countWaitAccidents: true });
ok(C.event('failed_wait', { source: 'real', track: 'day', now: noon }) === -2 && C.load().value === 68, 'opt-in failed wait moves the day meter');
const plain = { value: 50, cap: 8, dayDelta: 0, lastDay: 'x' };
let sum = 0; for (let i = 0; i < 20; i++) sum += C.applyDelta(plain, 1, noon).applied;
ok(sum === 8 && plain.value === 58, 'daily cap still ±8 on a plain state');

C.setTrack('day', { estimate: 70, target: 30 });
ok(C.trainingBand('day') === 'shaky', 'training band steps toward a lower target');
C.setTrack('day', { value: 96 });
ok(C.zone('day').id === 'grownup', 'high control is the grown-up zone');
C.setTrack('day', { value: 10 });
ok(C.zone('day').id === 'baby', 'low control is the baby zone');
const beforeRev = C.trackState('day').target;
C.reverseTrack('day');
ok(C.mode() === 'conditioning' && C.trackState('day').target !== beforeRev, 'reverse swaps the target and turns conditioning on');
C.stopConditioning();
ok(C.mode() === 'game', 'stop returns to game mode');

const pad = G.recommend({ Ld: 0.4, U: 5, W: 18, I: 110, F: 7, Dn: 0.95, Wn: 0.1, Sn: 0.1 });
const pull = G.recommend({ Ld: 1.2, U: 7, W: 8, I: 60, F: 9, Dn: 0.4, Wn: 0.8, Sn: 0.5 });
ok(pad.day === 'G4' && /pad/i.test(pad.why.day), 'pad-sized leaks recommend a pad ' + pad.day);
ok(pull.day === 'G3' && pull.night === 'G2', 'pull-up day and overnight night ' + pull.day + '/' + pull.night);
ok(G.compare('G4', 'G3') === 'lighter' && G.compare('G1', 'G3') === 'heavier' && G.compare('G3', 'G3') === 'match', 'lighter / heavier / match');
ok(G.recommend({ protDay: 'pullups', protNight: 'diapers' }).day === 'G3', 'worn gear is the fallback');

ok(P.pct({ estimate: 40, target: 80, debt: 0 }) === 0.06, 'direction B partial stays small');
ok(P.pct({ estimate: 70, target: 30, debt: 0 }) === 0.3, 'direction A partial caps at 30%');
ok(P.rollWeight({ urgency: 4 }) === 0, 'partial weight is 0 in game mode');
C.saveSettings({ mode: 'conditioning' });
C.setTrack('day', { phase: 'active', estimate: 70, target: 30, value: 70 });
P.saveSettings({ dailyCap: 4, finishOnToilet: true });
ok(P.rollWeight({ urgency: 4, track: 'day' }) > 0, 'partial weight turns on with conditioning');
ok(P.rollWeight({ urgency: 9, track: 'day' }) === 0, 'no partial at urgency 9');
P.saveSettings({ dailyCap: 0 });
ok(P.rollWeight({ urgency: 4, track: 'day' }) === 0, 'cap 0 removes the outcome');
P.saveSettings({ dailyCap: 4, finishOnToilet: false });
const plan = P.plan({ estimate: 70, target: 30, track: 'day', gear: 'G3' });
ok(plan.finishOnToilet === false && !/toilet/i.test(plan.text), 'toilet follow-through is off when the setting is off');
P.saveSettings({ finishOnToilet: true });
ok(/toilet/i.test(P.plan({ estimate: 70, target: 30, track: 'day', gear: 'G3' }).text), 'toilet sentence returns when the setting is on');

const real = R.request({ realEmergency: true });
ok(real.outcome === 'granted' && real.guarantee === true, 'real need is not a pass');
let seq = [0.99, 0.1];
const comp = R.request({ estimate: 70, target: 30, debt: 2, gear: 'G3', recommended: 'G3', context: 'home', urgency: 3, rng: () => seq.shift() });
ok(comp.outcome === 'compromise' && comp.kind === 'partial_first' && /toilet/.test(comp.text), 'compromise can be a partial then toilet: ' + comp.outcome + ' ' + comp.kind);
const lighter = R.request({ estimate: 70, target: 30, debt: 0, gear: 'G6', recommended: 'G3', urgency: 3, rng: () => 0 });
const matched = R.request({ estimate: 70, target: 30, debt: 0, gear: 'G3', recommended: 'G3', urgency: 3, rng: () => 0 });
ok(lighter.weights.denied > matched.weights.denied, 'lighter than recommended lowers grant odds');
C.stopConditioning();

ok(D.total('2020-01-01') === null, 'missing drink day is not zero');
D.add(250, 'Cup', 'cup', Date.parse('2020-01-02T12:00:00Z'));
ok(D.total('2020-01-02') === 250, 'logged drink counts');
D.logNothing('2020-01-03');
ok(D.total('2020-01-03') === 0, 'explicit nothing is a real zero');
ok(D.intakeLitres('2020-01-01') === null && D.balance('2020-01-01', 300).diffMl === null, 'balance is not invented');

const deep = { stages: [{ stage: 'deep', start: 1000, end: 5000 }], wakes: [] };
ok(S.controlSignal(deep, 2000).sSl === 15 && S.controlSignal(deep, 2000).woke === false, 'deep sleep wet without a wake scores low control');
ok(S.controlSignal({ stages: deep.stages, wakes: [2100] }, 2000).woke === true, 'a nearby wake counts');
ok(S.available().reason === 'plugin_missing', 'Health Connect plugin is absent');
const imported = S.importJSON(JSON.stringify({ nights: [{ date: '2026-11-10', stages: [{ stage: 'deep', start: 10, end: 20 }], wakes: [] }] }));
ok(imported.length === 1 && S.nightOn('2026-11-10').deepMin >= 0, 'manual sleep import stores a night');

ok(K.updateEstimate(50, 80, 1) === 60, 'one check-in cannot swing the estimate more than 10');
ok(K.updateEstimate(50, null, 1) === 50, 'missing measured value leaves the estimate');
ok(K.dayMeasured(K.scoresFromRaw({ I: 180, F: 5, V: 400, W: 30, U: 0, R: 0, Ld: 0, Aw: 1 }, null)) > 99.9, 'dry daytime metrics score about 100');
const hi = { sDn: 100, sWn: 100, sSn: 100, sWp: 100, sWw: 100, sAw: 100 };
ok(K.nightMeasured(hi) === 100 && K.nightMeasured(Object.assign({ sSl: 0 }, hi)) < 100, 'sleep term drops out when missing and pulls the night score when present');
ok(K.scoresFromRaw({ F: 8 }, 4).sF > K.scoresFromRaw({ F: 8 }, null).sF, 'a logged high-intake day is not read as lost control');
ok(!Y.evaluate(['hesitancy'], { hesitancyLotCount: 0 }).pause && Y.evaluate(['hesitancy'], { hesitancyLotCount: 1 }).pause, 'hesitancy pauses on the second check');
ok(Y.evaluate(['burning'], {}).pause && Y.evaluate(['skin'], {}).skin && !Y.evaluate(['skin'], {}).pause, 'burning pauses; skin does not pause everything');
const acc = N.accept({ adult: false, understand: true, day: 'A', night: 'off' });
ok(acc.ok === false, 'consent needs both boxes');
ok(N.accept({ adult: true, understand: true, day: 'A', night: 'B', targets: { day: 30, night: 80 }, realNight: true }).ok === true, 'consent can start');
ok(N.realProgress('night') === true && N.realProgress('day') === false && C.mode() === 'conditioning', 'real progress is per track');
N.stop();
ok(C.mode() === 'game' && N.realProgress('night') === false, 'stop clears real progress');

ok(/versionName "(\d+)"/.test(fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8')) && +fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8').match(/versionName "(\d+)"/)[1] >= 44, 'version at least 44');
ok(fs.readFileSync(path.join(root, 'js/whats-new-data.js'), 'utf8').includes("hash: 'v44'"), "What's New v44");

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
