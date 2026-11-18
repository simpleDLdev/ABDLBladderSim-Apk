// v56: conditioning deck, pee-button odds, queue, version.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['cond-events.js', 'event-queue.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const E = ctx.BSCondEvents, Q = ctx.BSEventQueue;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const letGo = {
  direction: { day: 'A', night: 'A' }, goals: ['urgency', 'relaxed'],
  methods: { day: ['relaxed', 'first_urge'], night: ['stay_bed'] },
  levelKey: { day: 'little', night: 'none' }, pacing: { day: 'steady', night: 'steady' },
  starting: { day: 30, night: 20 }, target: { day: 8, night: 5 },
  urgency: { style: 'first_urge', passes: 'rare' },
  dimensions: { day: { warning: { want: 70 }, dribble: { want: 80 }, hold: { want: 10 } } },
  habits: { streak: { day: 1, night: 0 } }
};
function startStop(ev) {
  let saw = false;
  for (const s of ev.guide || []) {
    if (s.type === 'relax') saw = true;
    else if (saw && s.type === 'stop') return true;
  }
  return false;
}
E.resetDeck();
const drawn = [];
let bad = 0;
for (let i = 0; i < 24; i++) {
  const ev = E.draw({ profile: letGo, ignoreConsent: true, track: 'day', rng: () => ((i * 17) % 97) / 97, tank: { ml: 180, minVoidMl: 50 } });
  ok(!!ev && ev.id && ev.desc.indexOf('Spasm Series') < 0 && ev.desc.indexOf('Pinprick') < 0, 'draw ' + i + ' is a conditioning event');
  if (!ev) continue;
  if (startStop(ev)) bad++;
  if (drawn.length && drawn[drawn.length - 1].id === ev.id) bad++;
  drawn.push(ev);
}
ok(bad === 0, 'let-go draws are not start-stop and do not repeat the same id');
let famRun = 1, famBad = false;
for (let i = 1; i < drawn.length; i++) {
  famRun = drawn[i].family === drawn[i - 1].family ? famRun + 1 : 1;
  if (famRun >= 3) famBad = true;
}
ok(!famBad, 'the same family does not land 3 times in a row');

const surprise = Object.assign({}, letGo, {
  goals: ['urgency', 'thin'],
  urgency: { style: 'partial', passes: 'rare' },
  dimensions: { day: { warning: { want: 0 }, dribble: { want: 10 }, notice: { want: 80 } } }
});
E.resetDeck();
let tiny = 0, full = 0;
for (let i = 0; i < 80; i++) {
  const ev = E.draw({ profile: surprise, ignoreConsent: true, track: 'day', surprise: true, rng: () => ((i * 13 + 5) % 89) / 89, tank: { ml: 220, minVoidMl: 50 } });
  if (!ev) continue;
  if (ev.family === 'dribble' || ev.family === 'spurt') tiny++;
  if (ev.size === 'full' || ev.family === 'full') full++;
}
ok(tiny > full * 2 && tiny >= 15, 'surprise mix is mostly short dribbles (' + tiny + ' vs full ' + full + ')');

E.resetDeck();
let lowFull = 0, lowN = 0;
for (let i = 0; i < 16; i++) {
  const ev = E.draw({ profile: letGo, ignoreConsent: true, track: 'day', kind: 'full', rng: () => ((i * 3) % 11) / 11, tank: { ml: 12, minVoidMl: 50 } });
  lowN++;
  if (ev && ev.size === 'full') lowFull++;
}
ok(lowN === 16 && lowFull === 0, 'a low tank does not roll a full void');

const none = E.passChance({ direction: { day: 'A' }, goals: ['urgency'], levelKey: { day: 'none' }, urgency: { passes: 'rare' } }, { track: 'day' });
const more = E.passChance({ direction: { day: 'B' }, goals: ['control'], levelKey: { day: 'full' }, urgency: { passes: 'generous' } }, { track: 'day' });
ok(none < 0.2 && more > 0.7 && more > none, 'lower control gets fewer passes (' + none + ' < ' + more + ')');
const pass = E.needToPee({ profile: letGo, ignoreConsent: true, rng: () => 0, track: 'day' });
const event = E.needToPee({ profile: letGo, ignoreConsent: true, rng: () => 0.99, track: 'day', tank: { ml: 180, minVoidMl: 50 } });
ok(pass.kind === 'pass' && event.kind === 'event' && event.event && event.event.id, 'the pee roll can be a pass or a deck event');

Q.clear();
Q.offer({ key: 'guide:open', kind: 'guide' });
const ticket = Q.offer({ key: 'pee:1', kind: 'guide', show() { throw new Error('should stay queued'); } });
ok(ticket.state === 'waiting' && Q.current().kind === 'guide' && Q.snapshot().waiting[0] === 'guide', 'a pee tap waits and does not replace the open guide');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8');
ok(/id="btnNeedToPee"/.test(html) && !/id="btnNeedToPee"[^>]*display\s*:\s*none/.test(html), 'I need to pee is on the session screen');
const fn = ui.slice(ui.indexOf('function needToPee'), ui.indexOf('function presentNeedToPee'));
ok(fn.indexOf('passChance') >= 0 && fn.indexOf('BSEventQueue.offer') >= 0 && fn.indexOf('applyConditioningUrge') >= 0 && fn.indexOf('completeActive') < 0, 'the button uses odds, the queue, and urge acceleration');
ok(engine.indexOf("profileMode === 'conditioning'") >= 0 && engine.indexOf('BSCondEvents.draw') >= 0, 'conditioning preroll uses the deck');
const pre = engine.slice(engine.indexOf('function prerollEvent'), engine.indexOf('function prerollEvent') + 700);
ok(pre.indexOf('conditioningDeckEvent') < pre.indexOf('microTableForMode') || pre.indexOf('microTableForMode') < 0, 'the deck runs before the standard tables');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 56 && +g.match(/versionCode (\d+)/)[1] >= 56, 'version at least 56');
const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
ok(/"version": "(\d+)\.0\.0"/.test(pkg) && +pkg.match(/"version": "(\d+)\.0\.0"/)[1] >= 56, 'package version at least 56');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v56 events ok');
