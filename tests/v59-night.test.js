// v59: night track, bedtime routine, wake paths, opt-in DryClip.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { getElementById: () => null, addEventListener() {} }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['control.js', 'cond-events.js', 'cond-deck-v57.js', 'cond-night-v59.js', 'night-cond.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const E = ctx.BSCondEvents, N = ctx.BSNightCond;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const less = {
  levelKey: { day: 'none', night: 'none' }, direction: { day: 'A', night: 'A' },
  goals: ['bedwetting', 'deeper', 'urgency'], methods: { day: ['relaxed'], night: ['stay_bed', 'deeper_sleep'] },
  sleep: { alarm: 'off', deeper: 'more', stay: 'yes' }, pacing: { night: 'steady', day: 'steady' },
  starting: { day: 10, night: 10 }, target: { day: 5, night: 5 }
};
const more = {
  levelKey: { day: 'good', night: 'good' }, direction: { day: 'B', night: 'B' },
  goals: ['control'], methods: { day: ['urge_surf'], night: ['alarm'] },
  sleep: { alarm: 'on' }, pacing: { night: 'gradual', day: 'gradual' },
  starting: { day: 85, night: 85 }, target: { day: 92, night: 92 }
};

E.resetDeck();
let dayNight = 0;
for (let i = 0; i < 24; i++) {
  const ev = E.draw({ profile: less, ignoreConsent: true, track: 'day', rng: () => ((i * 13) % 97) / 97, tank: { ml: 200, minVoidMl: 50 } });
  if (ev && ev.track === 'night') dayNight++;
}
ok(dayNight === 0, 'day draws exclude night events');
E.resetDeck();
let nightDay = 0, nightN = 0;
for (let i = 0; i < 24; i++) {
  const ev = E.draw({ profile: less, ignoreConsent: true, track: 'night', rng: () => ((i * 13) % 97) / 97, tank: { ml: 220, minVoidMl: 50 } });
  if (!ev) continue;
  nightN++;
  if (ev.track === 'day') nightDay++;
}
ok(nightN > 0 && nightDay === 0, 'night draws stay on the night track (' + nightN + ')');

['asleep', 'through', 'deeper', 'full', 'multi', 'early', 'half', 'stay', 'urgeA', 'urgeB', 'wetB', 'dry'].forEach(kind => {
  const n = E.EVENTS.filter(e => e.nightKind === kind).length;
  ok(n >= 12, kind + ' has at least 12 events (' + n + ')');
});

const gear = N.gearRec(less);
ok(/thick diaper/.test(gear.line) && /full night/.test(gear.why), 'less-control night gear is a thick diaper (' + gear.name + ')');
const gearB = N.gearRec(more);
ok(/pad/.test(gearB.name), 'more-control night gear follows the level (' + gearB.name + ')');
const steps = N.routine(less);
ok(steps.some(s => s.id === 'gear' && /thick diaper/.test(s.text)) && steps.some(s => s.id === 'drinks') && steps.some(s => s.id === 'potty' && s.skip) && steps.some(s => s.id === 'clip'), 'the bedtime routine includes gear, drinks, a skippable potty, and DryClip');
ok(/skip the last potty/.test(N.routine(less).find(s => s.id === 'potty').text), 'less control can skip the last potty');
ok(/Empty before lights out/.test(N.routine(more).find(s => s.id === 'potty').text), 'more control keeps the bedtime void');

ok(N.wakeKind(less, { wet: true }) === 'stay' && N.wakeKind(less, { urge: true }) === 'urgeA' && N.wakeKind(less, {}) === 'dry', 'waking less-control picks stay, let-go, or dry');
ok(N.wakeKind(more, { wet: true }) === 'wetB' && N.wakeKind(more, { urge: true }) === 'urgeB', 'waking more-control picks get up');
const stayed = N.drawWake(less, { wet: true }, { rng: () => 0.2 });
const up = N.drawWake(more, { urge: true }, { rng: () => 0.2 });
ok(stayed && stayed.nightKind === 'stay' && stayed.track === 'night', 'the wake button draws a stay-in-bed event');
ok(up && up.nightKind === 'urgeB' && up.track === 'night', 'the wake button draws a get-up event for more control');

ok(N.clipDefaults(less).optedIn === false && N.clipDefaults(more).optedIn === false, 'DryClip sleep mode is off until you opt in');
ok(N.clipDefaults({ sleep: { alarm: 'off' } }).suggested === 'quiet' && N.clipDefaults({ sleep: { alarm: 'on' } }).suggested === 'alarm', 'the quiz alarm answer only suggests the mode');
const quiet = N.clipReaction({ optedIn: true, mode: 'quiet', direction: 'A', wetAt: 50 });
const gentleA = N.clipReaction({ optedIn: true, mode: 'gentle', direction: 'A' });
const gentleB = N.clipReaction({ optedIn: true, mode: 'gentle', direction: 'B' });
const alarm = N.clipReaction({ optedIn: true, mode: 'alarm', direction: 'B' });
const off = N.clipReaction({ optedIn: false, mode: 'alarm' });
ok(quiet.alert === false && quiet.logged && quiet.wetAt === 50, 'quiet DryClip logs the wet time and does not alert');
ok(gentleA.alert === 'soft' && /sleep/i.test(gentleA.text), 'gentle mode on a less-control night says stay soft');
ok(gentleB.alert === 'soft' && /toilet/i.test(gentleB.text), 'gentle mode on a more-control night says get up');
ok(alarm.alert === 'full' && alarm.guide && alarm.guide.length, 'alarm mode wakes fully');
ok(off.handled === false, 'opt-out does not handle the clip');

const morning = N.morningEntry({ woke: 1, wets: 2, when: 'early', sat: 70, feeling: 'sleepy' }, { wets: [{ at: 50 }], worn: 'a thick diaper' });
ok(morning.wets === 2 && morning.clipWets.length === 1 && morning.sat === 70 && /thick/.test(morning.gear), 'morning check keeps wets, clip times, saturation, and gear');

const about = E.aboutText(less);
ok(/thick diaper/.test(about) && /DryClip sleep mode is off/.test(about) && /Night events available/.test(about), 'About text has a night section');

const engine = fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(engine.indexOf("_condTrack === 'night'") >= 0 && engine.indexOf('_nightCondQuiet') >= 0, 'the engine passes night track and stays quiet overnight');
ok(ui.indexOf('startConditioningTrack') >= 0 && html.indexOf('Night conditioning') >= 0 && html.indexOf('id="nightCondMount"') >= 0, 'day and night are choices, and the routine has a home');
ok(fs.readFileSync(path.join(root, 'js', 'dryclip.js'), 'utf8').indexOf('BSNightCond.onClipWet') >= 0, 'a clip wet can reach night conditioning');
const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "59"/.test(g) && /versionCode 59/.test(g), 'version 59');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v59 night ok');
