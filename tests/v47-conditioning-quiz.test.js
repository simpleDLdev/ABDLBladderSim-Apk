// v47: distinct conditioning questions, per-dimension targets, pacing, urge and session.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({ style: {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] }) },
  addEventListener() {}, dispatchEvent() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['safety.js', 'control.js', 'gear.js', 'partial.js', 'passes.js', 'checkins.js', 'consent.js', 'onboarding.js', 'intake.js', 'quiz.js', 'simple-urge.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const I = ctx.BSIntake, O = ctx.BSOnboard, SU = ctx.BSSimpleUrge;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const qs = I.questions();
const texts = qs.map(q => q.q);
ok(qs.length >= 40 && qs.length <= 60, 'question count is in range (' + qs.length + ')');
ok(new Set(texts).size === texts.length, 'no duplicated question text');
ok(qs.filter(q => q.kind === 'flavour').length <= 3 && qs.filter(q => q.kind === 'flavour').length >= 1, 'at most a few flavour scenes');
ok(!qs.some(q => /Where you want this to land/.test(q.q)), 'the repeated scene stem is gone');
const counts = I.sectionCounts(qs);
['Current control · Day', 'Current control · Night', 'Desired control · Day', 'Desired control · Night', 'Goals and why', 'Urgency training', 'Sleep conditioning', 'Pacing'].forEach(name => {
  ok((counts[name] || 0) >= 2, name + ' has questions (' + (counts[name] || 0) + ')');
});
ok(qs.some(q => q.q.indexOf('How much warning do you want') === 0), 'warning is asked as a goal');
ok(qs.some(q => /wake when wet, or sleep through/.test(q.q)), 'sleep-through is its own want question');
ok(qs.some(q => q.id === 'u_style') && qs.some(q => q.id === 's_alarm') && qs.some(q => q.id === 'p_day'), 'urgency, sleep alarm, and pacing are present');

const ans = {};
qs.forEach(q => {
  if (q.phase === 'now') ans[q.id] = q.opts[0].v;
  else if (q.phase === 'want') ans[q.id] = q.opts[q.opts.length - 1].v;
});
ans.w_d_hold = 'keep';
ans.goals = ['urgency', 'bedwetting'];
ans.u_style = 'first_urge';
ans.u_often = 'often';
ans.u_pass = 'rare';
ans.s_drinks = 'early';
ans.s_stay = 'yes';
ans.s_alarm = 'off';
ans.p_day = 'gradual';
ans.p_night = 'slow';
ans.intensity = 'steady';
ans.timeframe = '3m';
ans.day_real = 'real';
ans.night_real = 'sim';
const sc = I.scoreIntake(ans);
ok(sc.dimensions.day.hold && sc.dimensions.day.hold.keep && sc.dimensions.day.hold.want === sc.dimensions.day.hold.now, 'keep-as-is copies the current hold');
ok(sc.dimensions.day.warning && sc.dimensions.day.warning.want !== sc.dimensions.day.warning.now, 'warning stores its own target');
ok(sc.dimensions.night.wetNights && sc.dimensions.night.wakeWet, 'night dimensions are saved separately');
ok(sc.pacing.day === 'gradual' && sc.pacing.night === 'slow' && sc.urgency.style === 'first_urge' && sc.sleep.alarm === 'off', 'pacing, urgency style, and alarm are on the score');

ok(I.mix(80, 20, 'instant', 0) === 20, 'instant equals the target even with no check-ins');
ok(I.mix(80, 20, 'gradual', 0) === 80, 'gradual with no agreeing check-in stays at now');
ok(I.mix(80, 20, 'gradual', 3) === 50, 'gradual is halfway after 3 of 6 check-ins');
ok(I.mix(80, 20, 'slow', 4) === 65, 'slow burn moves 4/16 of the gap');
ok(I.mix(80, 20, 'hybrid', 0, 'sim') === 20 && I.mix(80, 20, 'hybrid', 0, 'real') === 80, 'hybrid sims at the target and keeps real practice at now');
ok(I.mix(80, 20, 'gradual', 0) === I.mix(80, 20, 'gradual', 0), 'a quiet calendar does not move gradual pacing');

const shaped = {
  dimensions: { day: { hold: { now: 100, want: 0, scores: true, nowText: 'An hour or more', wantText: 'I do not want to wait', name: 'Hold after the first urge', keep: false }, warning: { now: 100, want: 0, scores: true, nowText: 'Plenty of time', wantText: 'Almost none', name: 'Warning before it is urgent', keep: false }, notice: { now: 100, want: 0, scores: true, nowText: 'Right away', wantText: 'Later', name: 'Noticing wetness', keep: false } }, night: {} },
  pacing: { day: 'instant', night: 'gradual' },
  urgency: { style: 'partial', prompts: 'often', passes: 'generous' },
  sleep: { drinks: 'early', stay: 'yes', alarm: 'off', cue: 'want', deeper: 'more', beforeAwake: 'yes' }
};
const instant = I.urgeModel('day', { profile: shaped, agreeing: 0 });
ok(instant && instant.control === 0 && instant.levelKey === 'none' && instant.hold[0] <= 2, 'instant urge model uses the target hold and level');
const gradual = I.urgeModel('day', { profile: Object.assign({}, shaped, { pacing: { day: 'gradual' } }), agreeing: 0 });
ok(gradual.control === 100 && gradual.hold[0] > instant.hold[0], 'gradual urge model stays on the current hold until a check-in agrees');
ok(gradual.odds.gear < instant.odds.gear, 'lower effective control raises gear odds');
ok(instant.unnoticed > gradual.unnoticed, 'a low notice target raises the did-not-notice chance');

const saved = O.load();
saved.profile = Object.assign({
  starting: { day: 100, night: 80 }, target: { day: 0, night: 80 }, targetKey: { day: 'none', night: 'good' },
  levelKey: { day: 'full', night: 'good' }, direction: { day: 'A', night: 'off' }, goals: [], intensity: 'steady', timeframe: 'open',
  methods: { day: ['first_urge'], night: [] }, gear: null
}, shaped, { pacing: { day: 'instant', night: 'gradual' } });
saved.completedAt = 1;
O.save(saved);
SU.saveSettings({ profileId: 'conditioning' });
const picked = SU.profile('conditioning');
ok(picked.levelKey === 'none' && picked.hold[0] === instant.hold[0], 'Natural Urge reads the effective profile (' + picked.levelKey + ', hold ' + picked.hold + ')');
const noonBits = I.sessionBits(Object.assign({}, shaped, { urgency: Object.assign({}, shaped.urgency, { style: 'first_urge' }) }), 10);
ok(noonBits.min === 15 && noonBits.max === 35 && noonBits.prompts.some(t => /first urge/i.test(t)), 'a daytime session uses the first-urge timer');
const plan = O.sessionPlan(new Date(2026, 10, 13, 18, 0).getTime());
ok(plan.hydration.sips[1] <= 1 && plan.hydration.min >= 90, 'an evening session keeps late sips inside a small cap');
ok(plan.prompts.some(p => /staying in bed/i.test(p.text)) && plan.prompts.some(p => /No bedwetting alarm/i.test(p.text)), 'the session carries the sleep routine');

const legacy = O.load();
legacy.profile = { starting: { day: 55, night: 40 }, target: { day: 30, night: 20 }, targetKey: { day: 'little', night: 'little' }, levelKey: { day: 'okay', night: 'shaky' }, direction: { day: 'A', night: 'A' }, goals: ['bedwetting'], intensity: 'gentle', timeframe: 'open', methods: { day: ['relaxed'], night: ['stay_bed'] }, gear: null };
legacy.habits = { log: [{ ts: 1, method: 'relaxed', track: 'day', reward: 1 }], streak: { day: 2, night: 0 }, best: { day: 2, night: 0 }, lastDone: {}, shield: { day: 1, night: 1 }, stageStreak: { day: 0, night: 0 }, grade: {}, cues: [], review: null };
legacy.completedAt = 9;
O.save(legacy);
ok(O.load().profile.methods.night[0] === 'stay_bed' && !O.load().profile.dimensions && I.urgeModel('day') == null, 'a v45 profile without dimensions still loads and does not invent an urge model');
const applied = O.applyIntake(ans, { adult: true, understand: true, realDay: true, realNight: false });
ok(applied.ok && applied.profile.dimensions.day.warning && applied.profile.pacing.day === 'gradual', 'retaking writes per-dimension targets');
ok(O.load().habits.log.length === 1, 'retaking keeps the habit log');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "47"/.test(g) && /versionCode 47/.test(g), 'version 47');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v47 conditioning quiz tests passed');
