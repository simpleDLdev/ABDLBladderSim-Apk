// v46: situational intake on the shared quiz runner, gear weighting, resume, v45 profiles.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError, Promise,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({ style: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] }) },
  addEventListener() {}, dispatchEvent() {}, location: { hash: '' }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['safety.js', 'control.js', 'gear.js', 'partial.js', 'checkins.js', 'consent.js', 'onboarding.js', 'intake.js', 'quiz.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const I = ctx.BSIntake, O = ctx.BSOnboard, Q = ctx.BSQuiz;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const qs = I.questions();
ok(qs.length >= 50, 'at least 50 questions (' + qs.length + ')');
const counts = I.sectionCounts(qs);
const labels = Object.keys(counts);
ok(labels.length >= 6, 'grouped into sections: ' + labels.map(k => k + '=' + counts[k]).join(' | '));
ok((counts['Where you are now · Day'] || 0) >= 10 && (counts['Where you want to be · Day'] || 0) === (counts['Where you are now · Day'] || 0), 'day now and day want are the same length');
ok((counts['Where you are now · Night'] || 0) >= 6 && counts['Where you want to be · Night'] === counts['Where you are now · Night'], 'night now and night want match');
ok((counts['How it feels'] || 0) >= 1 && qs.some(q => q.optional && q.section === 'feelings'), 'feelings section is optional');

const paired = I.pairs(qs);
ok(paired.length >= 20 && paired.every(p => p.want && p.want.pair === p.now.id && p.want.gear === p.now.gear && p.want.context === p.now.context && p.want.track === p.now.track), 'every now scene has a want twin with the same gear and place');
const sample = qs.find(q => q.id === 'office_pull');
ok(sample && /pull-up/.test(sample.q) && /office/.test(sample.q) && sample.opts.length === 5 && sample.opts[0].v === 0 && sample.opts[4].v === 4, 'office pull-up scene is one of the situational questions');

const undi = qs.find(q => q.gear === 'underwear' && q.phase === 'now');
const thick = qs.find(q => q.gear === 'thick' && q.phase === 'now');
ok(I.controlFor(undi, 4) < I.controlFor(thick, 4), 'a full wet in underwear scores lower control than the same wet in a thick diaper (' + I.controlFor(undi, 4) + ' vs ' + I.controlFor(thick, 4) + ')');
ok(I.controlFor({ gear: 'underwear', context: 'office', scale: 4 }, 2) < I.controlFor({ gear: 'underwear', context: 'home', scale: 4 }, 2), 'the same dribble counts more at the office than at home');

const ans = {};
qs.forEach(q => {
  if (q.kind === 'situation' && q.phase === 'now') ans[q.id] = 0;
  else if (q.kind === 'situation' && q.phase === 'want') ans[q.id] = 4;
  else if (q.kind === 'scale') ans[q.id] = 0;
  else if (q.id === 'gear_home' || q.id === 'gear_work' || q.id === 'gear_out') ans[q.id] = 'G6';
  else if (q.id === 'gear_night') ans[q.id] = 'G1';
});
ans.goals = ['relaxed'];
ans.intensity = 'steady';
ans.timeframe = '3m';
ans.feel_day = 'like';
const sc = I.scoreIntake(ans);
ok(sc.dayNow >= 90 && sc.dayKey === 'full' && sc.nightKey === 'full', 'dry now-answers map to Big Kid (' + sc.dayNow + '/' + sc.nightNow + ')');
ok(sc.dayDir === 'A' && sc.nightDir === 'A' && sc.dayWant <= sc.dayNow - 8 && sc.nightWant <= sc.nightNow - 8, 'wanting the wet ending drops the target and picks direction A (' + sc.dayWant + ' / ' + sc.nightWant + ')');
ok(sc.dayTargetKey === I.bandOf(sc.dayWant) && sc.nightTargetKey === I.bandOf(sc.nightWant), 'targets use the ladder (' + sc.dayTargetKey + ', ' + sc.nightTargetKey + ')');
ok(sc.methods.day.indexOf('relaxed') >= 0 && sc.methods.night.indexOf('stay_bed') >= 0, 'the gap plus a relaxed goal checks passive release and staying in bed');
ok(sc.titles.dayNow && sc.titles.nightWant, 'result titles exist for now and goal');

ans.methods_day = ['relaxed'];
const picked = I.scoreIntake(ans);
ok(picked.methods.day.length === 1 && picked.methods.day[0] === 'relaxed', 'an explicit method pick replaces the default for that track');

ok(I.resumeIndex({ i: 5 }, qs) === 5 && I.resumeIndex(null, qs) === 0 && I.resumeIndex({ i: 999 }, qs) === qs.length, 'resume restores the question index');
ok(I.skipSectionFrom(qs, 0) === counts['Where you are now · Day'], 'skipping a section jumps past it');
const feelAt = qs.findIndex(q => q.section === 'feelings');
ok(feelAt > 0 && I.skipSectionFrom(qs, feelAt) === qs.length, 'skipping feelings lands on the end');
ok(typeof Q.runFlow === 'function' && Q.runFlow({ mountId: 'missing' }).reason === 'mount', 'the intake uses the shared quiz runner');

const kept = O.load();
kept.completedAt = 10;
kept.quizStep = 'summary';
kept.calibration = { choice: 'skip', source: 'quiz' };
kept.profile = {
  starting: { day: 50, night: 40 }, target: { day: 30, night: 20 },
  targetKey: { day: 'little', night: 'little' }, levelKey: { day: 'okay', night: 'shaky' },
  direction: { day: 'A', night: 'A' }, goals: ['bedwetting'], intensity: 'gentle', timeframe: 'open',
  methods: { day: ['first_urge'], night: ['stay_bed'] }, gear: null
};
kept.habits.log = [{ ts: 1, method: 'first_urge', track: 'day', reward: 1 }];
O.save(kept);
ok(O.load().profile.methods.day[0] === 'first_urge' && O.load().habits.log.length === 1, 'a v45 profile still loads');
const applied = O.applyIntake(ans, { adult: true, understand: true, realDay: false, realNight: true });
ok(applied.ok && applied.profile.starting.day >= 90 && applied.profile.direction.day === 'A' && applied.profile.levelKey.day === 'full', 'retaking overwrites levels from the new quiz');
ok(O.load().habits.log.length === 1 && O.load().habits.log[0].method === 'first_urge', 'retaking keeps the habit log');
ok(O.load().profile.methods.day[0] === 'relaxed' && O.load().quizStep === 'calib', 'the new profile is saved and calibration is next');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "46"/.test(g) && /versionCode 46/.test(g), 'version 46');
const hub = fs.readFileSync(path.join(root, 'js', 'quiz.js'), 'utf8');
ok(hub.indexOf('qzIntake') >= 0 && hub.indexOf('runFlow') >= 0, 'quiz hub and runner know the intake');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v46 intake tests passed');
