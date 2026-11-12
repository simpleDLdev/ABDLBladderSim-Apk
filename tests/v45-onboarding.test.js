// v45: intake quiz, profile pickers, calibration skip, v44 migration.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError, Promise,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  Uint8Array, DataView,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({ style: {}, classList: { add() {} }, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] }) },
  addEventListener() {}, dispatchEvent() {}, location: { hash: '' },
  visibilityState: 'hidden'
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['safety.js', 'control.js', 'gear.js', 'symptoms-check.js', 'partial.js', 'passes.js', 'drinks.js', 'sleep-source.js', 'checkins.js', 'consent.js', 'calibration.js', 'quiz.js', 'onboarding.js', 'simple-urge.js', 'natural-session.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const O = ctx.BSOnboard, C = ctx.BSControl, N = ctx.BSConsent, K = ctx.BSCheckins, SU = ctx.BSSimpleUrge, G = ctx.BSGear, S = ctx.BSSleep;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const noon = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0).getTime();

const dry = O.scoreNow({ day: { urgency: 0, suddenness: 0, hold: 0, trips: 0, leaks30: 0 }, night: { wetNights: 0, wake: 0, depth: 0 } });
ok(dry.day === 96 && dry.dayKey === 'full' && dry.nightKey === 'full', 'dry answers score Big Kid ' + dry.day + '/' + dry.night);
const wetDay = O.scoreNow({ day: { urgency: 3, suddenness: 3, hold: 3, trips: 3, leaks30: 3 }, night: { wetNights: 0, wake: 0, depth: 0 } });
ok(wetDay.day === 0 && wetDay.dayKey === 'none', 'max day answers score Infant');
const toddler = O.scoreNight({ wetNights: 6, wake: 2, depth: 1 });
ok(toddler === 24 && O.bandOf(toddler) === 'little', 'six wet nights, rarely waking, is Toddler ' + toddler);
const card = O.levelCard('little', 'night');
ok(/Toddler/.test(card.name) && /wet most nights, rarely wakes/.test(card.text) && card.target === O.midOf('little') && card.target >= 20 && card.target <= 39, 'night card is a described Toddler, not a typed number');

const aDefs = O.defaultMethods(['bedwetting', 'relaxed'], 'A', 'A');
ok(aDefs.day.indexOf('relaxed') >= 0 && aDefs.day.indexOf('reverse_kegel') >= 0 && aDefs.night.indexOf('stay_bed') >= 0 && aDefs.night.indexOf('deeper_sleep') >= 0, 'A goals check relaxed release and night cues');
const bDefs = O.defaultMethods(['control'], 'B', 'B');
ok(bDefs.day.indexOf('timed_void') >= 0 && bDefs.day.indexOf('kegels') >= 0 && bDefs.night.indexOf('alarm') >= 0 && bDefs.day.indexOf('relaxed') < 0, 'B goals check timed voiding, kegels, and the alarm');
const relaxed = O.METHODS.find(m => m.id === 'relaxed');
ok(relaxed && /no holding back/i.test(relaxed.line) && /not overflow/i.test(relaxed.line) && /not stretching/i.test(relaxed.line), 'relaxed release is passive');

ctx.BSQuiz.save({ a: { urgency: 2, warning: 2, holdTime: 2, frequency: 1, leaks: 1, nights: 3, nightWake: 3, protDay: 'pullups', protNight: 'diapers' } });
const pre = O.prefillFromQuiz();
ok(pre && pre.day.urgency === 2 && pre.day.hold === 2 && pre.night.wetNights === 6 && pre.gear.home === 'G3' && pre.gear.night === 'G1', 'quiz A answers prefill the intake ' + JSON.stringify(pre && pre.gear));

const done = O.finishQuiz({
  adult: true, understand: true, realDay: true, realNight: false,
  day: { urgency: 1, suddenness: 1, hold: 1, trips: 1, leaks30: 1 },
  night: { wetNights: 6, wake: 2, depth: 1 },
  gear: { home: 'G3', work: 'G4', out: 'G4', night: 'G1' },
  dayDir: 'A', nightDir: 'A', dayLevel: 'little', nightLevel: 'none',
  goals: ['bedwetting', 'relaxed'], intensity: 'steady', timeframe: '3m',
  methods: aDefs, finishOnToilet: true, dailyCap: 4
});
ok(done.ok && done.profile.targetKey.night === 'none' && done.profile.levelKey.night === 'little', 'profile stores a named night goal and the quiz starting level');
ok(done.profile.target.night === O.midOf('none') && done.profile.starting.night === 24, 'numeric target is the band middle, hidden behind the card');
ok(done.profile.gear && done.profile.gear.recommended && done.profile.gear.recommended.night !== 'G6', 'recommended night gear follows the baseline ' + (done.profile.gear && done.profile.gear.recommended && done.profile.gear.recommended.night));
ok(N.realProgress('day') === true && N.realProgress('night') === false && C.mode() === 'conditioning', 'consent checkboxes are the last step and turn conditioning on');
ok(O.rollMods('day').hard === 0.7 && O.rollMods('day').gear > 1, 'day rolls ease off pushing when relaxed release is on');

const skipNone = O.chooseCalib('skip');
ok(skipNone.source === 'quiz' && skipNone.capacityMl == null, 'skip with no measured capacity uses the quiz');
store.bs_calibration_v1 = JSON.stringify({ version: 1, trials: [{ id: 't', volumeMl: 280, durationSec: 20 }], form: {} });
const skip = O.chooseCalib('skip');
ok(skip.source === 'calibration' && skip.capacityMl === 280, 'skip uses the calibration capacity ' + skip.capacityMl);
ok(K.load().every === 3 && K.load().nextAt > Date.now(), 'check-ins are scheduled every 3 days');
const diary = O.chooseCalib('diary');
ok(diary.choice === 'diary' && diary.until > Date.now(), 'diary baseline is a 2–3 day window');
O.logDiary('void', {}, noon(2026, 11, 2));
ok(O.diaryMetrics(noon(2026, 11, 2) - 1000, noon(2026, 11, 3)).metrics.V == null, 'a void without a volume does not become 0 ml');
O.logDiary('void', { ml: 200 }, noon(2026, 11, 2) + 1000);
ok(O.diaryMetrics(noon(2026, 11, 2) - 1000, noon(2026, 11, 3)).metrics.V === 200, 'an entered volume is kept');

const plan = O.todayPlan(noon(2026, 11, 3));
ok(plan.length >= 1 && plan[0].cue && plan[0].stage === 1, 'today’s practice has a cue and a starting stage');
let r = null;
for (let d = 1; d <= 3; d++) r = O.logBehaviour('relaxed', 'day', noon(2026, 11, d));
ok(r.streak === 3 && r.stage === 1 && !r.advanced, 'three steady days do not raise the task yet');
r = O.logBehaviour('relaxed', 'day', noon(2026, 11, 4));
ok(r.streak === 4 && r.advanced && r.stage === 2, 'the task gets harder after the steady streak');
r = O.logBehaviour('stay_bed', 'night', noon(2026, 11, 1));
r = O.logBehaviour('stay_bed', 'night', noon(2026, 11, 2));
r = O.logBehaviour('stay_bed', 'night', noon(2026, 11, 4));
ok(r.forgiven && r.streak === 3 && r.shield === 0, 'one missed night keeps the streak');
r = O.logBehaviour('stay_bed', 'night', noon(2026, 11, 6));
ok(!r.forgiven && r.streak === 1, 'a second miss starts the streak again');

const deep = S.controlSignal({ stages: [{ stage: 'deep', start: 0, end: 100000 }], wakes: [] }, 1000);
const woke = S.controlSignal({ stages: [{ stage: 'light', start: 0, end: 100000 }], wakes: [1000] }, 1000);
ok(deep && woke && O.nightAPoints(deep.sSl) > O.nightAPoints(woke.sSl), 'a deep wet with no wake scores higher for Night A than waking to change ' + deep.sSl + ' vs ' + woke.sSl);

O.load().profile.levelKey.day = 'little'; O.load().profile.targetKey.day = 'none';
const held = O.load(); held.profile.levelKey.day = 'little'; held.profile.targetKey.day = 'none'; O.save(held);
ok(!O.considerPromotion('day', [12]).promoted, 'one check-in does not move the level');
ok(!O.considerPromotion('day', [30, 28]).promoted, 'two check-ins still in Toddler do not move the level');
const promo = O.considerPromotion('day', [18, 10]);
ok(promo.promoted && promo.level === 'none' && promo.from === 'little', 'two Infant check-ins move Toddler one step');

const late = O.sessionPlan(new Date(2026, 10, 12, 18, 0).getTime());
ok(late.profileId === 'conditioning' && late.hydration.sips[1] <= 2, 'session sips stay small');
const capped = O.capSessionMl(400);
ok(capped.ml <= 250 && capped.ml > 0, 'a session drink is cut by the safety cap ' + capped.ml);

const opts = SU.profileOptions('conditioning');
ok(opts.indexOf('value="conditioning"') >= 0 && opts.indexOf('My Conditioning') >= 0, 'Natural Urge picker lists My Conditioning');
const picked = SU.profile('conditioning');
ok(picked.id === 'conditioning' && /My Conditioning/.test(picked.name) && picked.levelKey === O.playProfile().levelKey && picked.conditioning && picked.conditioning.direction, 'the picker resolves the conditioning level, direction, and gear');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cfg = fs.readFileSync(path.join(root, 'js', 'profile-config.js'), 'utf8');
const ns = fs.readFileSync(path.join(root, 'js', 'natural-session.js'), 'utf8');
ok(html.indexOf("selectProfileFromModal('conditioning')") >= 0 && html.indexOf('My Conditioning') >= 0, 'full session setup offers My Conditioning');
ok(cfg.indexOf('conditioning:') >= 0 && /My Conditioning/.test(cfg), 'session profile config has My Conditioning');
ok(ns.indexOf('profileOptions') >= 0 && ns.indexOf('My Conditioning') >= 0, 'natural session copies the conditioning option');

delete store.bs_conditioning_v1;
store.bs_consent_v1 = JSON.stringify({ v: 2, acceptedAt: 1700000000000, adult: true, textVersion: '2026-11-r3', tracks: { day: 'A', night: 'B' }, realProgress: { day: true, night: false }, rechecks: [], bandAt: {} });
C.setTrack('day', { value: 70, estimate: 70, target: 28 });
C.setTrack('night', { value: 40, estimate: 40, target: 88 });
const mig = O.migrateV44();
ok(mig.migratedFromV44 && mig.needsQuiz && !mig.completedAt, 'a v44 consent is kept and the quiz is offered');
ok(mig.profile.targetKey.day === 'little' && mig.profile.targetKey.night === 'good', 'numeric targets map to the nearest level ' + mig.profile.targetKey.day + '/' + mig.profile.targetKey.night);
ok(N.load().acceptedAt === 1700000000000 && N.realProgress('day') === true && N.load().tracks.night === 'B', 'v44 switches are not cleared');
ok(C.trackState('day').target === 28 && C.trackState('night').target === 88, 'v44 targets stay on the meters');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "45"/.test(g) && /versionCode 45/.test(g), 'version 45');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v45 onboarding tests passed');
