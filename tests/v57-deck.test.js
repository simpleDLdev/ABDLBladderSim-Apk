// v57: large conditioning deck, tags, per-profile counts.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['cond-events.js', 'cond-deck-v57.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const E = ctx.BSCondEvents;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const GOALS = ['first_urge', 'relaxed', 'fade', 'unnoticed', 'dribble', 'spurt', 'seep', 'full', 'bedwetting', 'deeper', 'thin', 'surprise', 'giggle', 'habit', 'reward', 'streak', 'control', 'urgency'];
const LETGO = ['first_urge', 'relaxed', 'fade', 'unnoticed', 'dribble', 'spurt', 'seep', 'thin', 'surprise', 'giggle', 'habit', 'urgency'];

ok(E.EVENTS.length >= 150, 'deck has at least 150 events (' + E.EVENTS.length + ')');
const ids = E.EVENTS.map(e => e.id);
ok(new Set(ids).size === ids.length, 'ids are unique');
let untagged = 0;
E.EVENTS.forEach(e => {
  if (!e.family || !e.size || !Array.isArray(e.goals) || !e.goals.length || !e.dir || !e.track) untagged++;
  if (!e.guide || !e.guide.length || e.guide.some(s => !s.text || !s.time || !s.type)) untagged++;
});
ok(untagged === 0, 'every event has family, size, goals, direction, track, and a guide');

GOALS.forEach(g => {
  const n = E.EVENTS.filter(e => e.goals.indexOf(g) >= 0).length;
  ok(n >= 10, g + ' has at least 10 events (' + n + ')');
});

LETGO.forEach(g => {
  const list = E.EVENTS.filter(e => e.goals.indexOf(g) >= 0 && (e.size === 'tiny' || e.size === 'small' || e.size === 'full'));
  const micro = list.filter(e => e.size !== 'full').length;
  const ratio = micro / list.length;
  ok(ratio >= 0.6 && ratio <= 0.9, g + ' is mostly micro (' + Math.round(ratio * 100) + '%)');
});
const bed = E.EVENTS.filter(e => e.goals.indexOf('bedwetting') >= 0);
const bedMacro = bed.filter(e => e.size === 'full').length;
const bedMicro = bed.filter(e => e.size === 'tiny' || e.size === 'small').length;
ok(bedMacro > bedMicro, 'bedwetting has more macros than micros (' + bedMacro + ' > ' + bedMicro + ')');
ok(E.EVENTS.filter(e => e.goals.indexOf('full') >= 0).every(e => e.size === 'full'), 'full let-go tags are macros');

let startStop = 0;
E.EVENTS.filter(e => e.dir === 'A').forEach(e => {
  let saw = false;
  (e.guide || []).forEach(s => {
    if (s.type === 'relax') saw = true;
    else if (saw && s.type === 'stop') startStop++;
  });
});
ok(startStop === 0, 'direction A guides do not clench after a release');

const letGo = {
  direction: { day: 'A', night: 'A' },
  goals: ['urgency', 'relaxed', 'thin', 'bedwetting', 'deeper'],
  methods: { day: ['relaxed'], night: ['stay_bed', 'deeper_sleep'] },
  levelKey: { day: 'little', night: 'none' },
  pacing: { day: 'steady', night: 'steady' },
  starting: { day: 35, night: 15 }, target: { day: 8, night: 5 }
};
const control = {
  direction: { day: 'B', night: 'B' },
  goals: ['control'],
  methods: { day: ['urge_surf', 'kegels', 'timed_void', 'double_void'], night: ['timed_void'] },
  levelKey: { day: 'good', night: 'good' },
  pacing: { day: 'gradual', night: 'gradual' },
  starting: { day: 75, night: 70 }, target: { day: 92, night: 90 }
};
const sumA = E.deckSummary(letGo);
const sumB = E.deckSummary(control);
ok(sumA.total >= 120 && sumA.micro > sumA.macro && sumA.macro >= 20, 'a let-go profile sees a large deck (' + sumA.total + ' / micro ' + sumA.micro + ' / macro ' + sumA.macro + ' / dry ' + sumA.dry + ')');
ok(sumA.chosen.some(g => g.id === 'urgency' && g.n >= 10) && sumA.chosen.some(g => g.id === 'bedwetting' && g.n >= 10), 'the summary names the goals that profile trains');
ok(sumB.total >= 20 && sumB.dry >= sumB.micro && sumB.chosen.some(g => g.id === 'control' && g.n >= 10), 'a more-control profile is mostly no-wet practice (' + sumB.total + ', dry ' + sumB.dry + ')');
ok(!E.eligible(letGo, { ignoreConsent: true, track: 'day' }).some(e => e.dir === 'B'), 'a day let-go roll does not include direction B events');
ok(E.eligible(control, { ignoreConsent: true, track: 'day' }).some(e => e.methods && e.methods.indexOf('kegels') >= 0), 'kegels show up when that method is on the profile');
ok(!E.eligible(letGo, { ignoreConsent: true, track: 'day' }).some(e => e.id === 'ct07'), 'kegels stay off a profile that did not pick them');

E.resetDeck();
let famRun = 1, famBad = false, lowFull = 0;
for (let i = 0; i < 30; i++) {
  const ev = E.draw({ profile: letGo, ignoreConsent: true, track: 'day', rng: () => ((i * 19) % 97) / 97, tank: { ml: 10, minVoidMl: 50 }, kind: 'full' });
  if (!ev) { famBad = true; break; }
  if (ev.size === 'full') lowFull++;
  if (i > 0) {
    const prev = E.EVENTS.find(e => e.id === ev.id);
    famRun = prev && arguments ? famRun : famRun;
  }
}
const drawn = [];
E.resetDeck();
for (let i = 0; i < 30; i++) {
  drawn.push(E.draw({ profile: letGo, ignoreConsent: true, track: 'day', rng: () => ((i * 19) % 97) / 97, tank: { ml: 200, minVoidMl: 50 } }));
}
for (let i = 1; i < drawn.length; i++) {
  if (!drawn[i] || drawn[i].id === drawn[i - 1].id) famBad = true;
  const a = drawn[i] && drawn[i].family, b = drawn[i - 1] && drawn[i - 1].family, c = drawn[i - 2] && drawn[i - 2].family;
  if (i >= 2 && a === b && b === c) famBad = true;
}
ok(!famBad && lowFull === 0, 'anti-repeat holds and a low tank still blocks a full void');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profiles = fs.readFileSync(path.join(root, 'js', 'cond-profiles.js'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'docs', 'EVENTS-v57.md'), 'utf8');
ok(html.indexOf('js/cond-deck-v57.js') > html.indexOf('js/cond-events.js'), 'the expanded deck loads with the app');
ok(profiles.indexOf('id="condDeckSummary"') >= 0 && profiles.indexOf('deckSummary') >= 0, 'Profiles shows the per-setup counts');
ok(E.EVENTS.every(e => doc.indexOf('| ' + e.id + ' |') >= 0), 'the docs table lists every event id');
const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "57"/.test(gradle) && /versionCode 57/.test(gradle), 'version 57');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v57 deck ok');
