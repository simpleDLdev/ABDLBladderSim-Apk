// v58: pee tap always shows, urge uses the deck, quiz tags, About text matches the odds.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { getElementById: () => null, addEventListener() {} }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['control.js', 'profile-config.js', 'event-queue.js', 'pee-tap.js', 'intake.js', 'cond-events.js', 'cond-deck-v57.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const C = ctx.BSControl, Pee = ctx.BSPee, I = ctx.BSIntake, E = ctx.BSCondEvents, Q = ctx.BSEventQueue;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

function node(id) {
  const el = { id: id, style: { display: 'none' }, innerHTML: '', textContent: '', alarm: { innerHTML: '' } };
  el.querySelector = sel => sel === '#alarmText' ? el.alarm : null;
  return el;
}
function docOf(extra) {
  const els = Object.assign({
    alarmBanner: node('alarmBanner'),
    voidOverlay: node('voidOverlay'),
    voidInstruction: { textContent: '', style: {} }
  }, extra || {});
  return { getElementById: id => els[id] || null, els: els };
}

const doc = docOf();
const shown = Pee.show(doc, { kind: 'pass', chance: 0.2 }, { queue: Q });
ok(shown.shown === 'banner' && doc.els.alarmBanner.style.display === 'flex' && /Potty pass/.test(doc.els.alarmBanner.alarm.innerHTML), 'a pass tap paints a visible banner');
Q.clear();
const lowDoc = docOf();
const low = Pee.show(lowDoc, { kind: 'low' }, { queue: Q });
ok(low.shown === 'banner' && /Not enough in the tank yet/.test(lowDoc.els.alarmBanner.alarm.innerHTML), 'a low tank paints the tank message');
Q.clear();
const busy = docOf();
busy.els.voidOverlay.style.display = 'flex';
busy.els.voidInstruction.textContent = 'OPEN GUIDE';
const queued = Pee.show(busy, { kind: 'event', event: { label: 'Later', desc: 'Later event', guide: [{ text: 'GO', time: 3, type: 'relax' }], kind: 'micro' } }, { queue: Q });
ok(queued.shown === 'queued' && busy.els.voidOverlay.style.display === 'flex' && busy.els.voidInstruction.textContent === 'OPEN GUIDE', 'an open guide stays up and the tap waits');
Q.clear();
const evDoc = docOf();
let started = null;
const ev = Pee.show(evDoc, { kind: 'event', event: { label: 'Kettle', desc: 'Kettle ping', guide: [{ text: 'DRIBBLE', time: 3, type: 'relax' }], kind: 'micro' } }, {
  queue: Q,
  startGuide: function (guide, text) { started = text; evDoc.els.voidOverlay.style.display = 'flex'; evDoc.els.voidInstruction.textContent = text; }
});
ok(ev.shown === 'guide' && started === 'Kettle ping' && evDoc.els.voidOverlay.style.display === 'flex', 'an event tap opens the guide');

Q.clear();
const revDoc = docOf();
let revealed = null;
const rev = Pee.reveal(revDoc, {
  event: { label: 'First urge', desc: 'Let go as it starts.', guide: [{ text: 'LET GO', time: 5, type: 'relax' }], kind: 'micro' },
  queue: Q,
  startGuide: function (guide, text) { revealed = text; revDoc.els.voidOverlay.style.display = 'flex'; revDoc.els.voidInstruction.textContent = text; }
});
ok(rev.shown === 'guide' && revealed === 'Let go as it starts.' && revDoc.els.voidOverlay.style.display === 'flex', 'Reveal now opens the queued event');
Q.clear();
const lowRev = docOf();
const lowNote = Pee.reveal(lowRev, { lowTank: true, queue: Q });
ok(lowNote.shown === 'banner' && lowRev.els.alarmBanner.style.display === 'flex' && /Not enough in the tank yet/.test(lowRev.els.alarmBanner.alarm.innerHTML), 'Reveal now with a low tank paints the tank message');
Q.clear();
const emptyRev = docOf();
const empty = Pee.reveal(emptyRev, { queue: Q });
ok(empty.shown === 'banner' && /Nothing is queued right now/.test(emptyRev.els.alarmBanner.alarm.innerHTML), 'Reveal now with nothing queued says so');
Q.clear();
const busyRev = docOf();
busyRev.els.voidOverlay.style.display = 'flex';
busyRev.els.voidInstruction.textContent = 'OPEN GUIDE';
const busyNote = Pee.reveal(busyRev, { guideOpen: true, event: { desc: 'Should not replace', guide: [{ text: 'X', time: 2, type: 'relax' }] }, queue: Q });
ok(busyNote.shown === 'busy' && busyRev.els.voidInstruction.textContent === 'OPEN GUIDE', 'Reveal now does not replace an open guide');
const uiReveal = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
ok(uiReveal.indexOf('BSPee.reveal') >= 0 && uiReveal.indexOf('function nextReveal') >= 0, 'Reveal now goes through the visible reveal path');

const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
const urge = fs.readFileSync(path.join(root, 'js', 'simple-urge.js'), 'utf8');
ok(ui.indexOf('BSPee.show') >= 0 && ui.indexOf('function buildPeeRoll') >= 0 && ui.indexOf('peeLogLine') >= 0, 'the session button goes through the visible pee path');
ok(urge.indexOf('BSCondEvents.draw') >= 0 && urge.indexOf("p.id === 'conditioning'") >= 0, 'Urge draws from the conditioning deck');

const DECK = ['first_urge', 'relaxed', 'fade', 'unnoticed', 'dribble', 'spurt', 'seep', 'full', 'bedwetting', 'deeper', 'thin', 'surprise', 'giggle', 'habit', 'reward', 'streak', 'control', 'urgency'];
function hasEvents(tag) { return E.EVENTS.some(e => (e.goals || []).indexOf(tag) >= 0); }
const samples = {
  first_urge: { goals: ['urgency'], u_style: 'first_urge' },
  relaxed: { goals: ['relaxed'] },
  fade: { goals: ['signal'] },
  unnoticed: { goals: ['urgency'], f_desk: 'later' },
  dribble: { goals: ['thin'], u_style: 'partial' },
  spurt: { goals: ['urgency'], u_style: 'partial' },
  seep: { goals: ['urgency'], u_style: 'partial' },
  full: { goals: ['urgency'], f_desk: 'gear' },
  bedwetting: { goals: ['bedwetting'] },
  deeper: { goals: ['deeper'], s_deeper: 'more' },
  thin: { goals: ['thin'] },
  surprise: { goals: ['urgency'] },
  giggle: { goals: ['urgency'] },
  habit: { goals: ['urgency'], u_often: 'often', where: ['home'] },
  reward: { goals: ['urgency'] },
  streak: { goals: ['urgency'], intensity: 'intense', timeframe: '3m' },
  control: { goals: ['control'], u_style: 'surf' },
  urgency: { goals: ['urgency'] },
  signal: { goals: ['signal'] },
  capacity: { goals: ['capacity'] },
  drynight: { goals: ['drynight'] }
};
const dims = {
  day: {
    warning: { want: 0 }, dribble: { want: 10 }, notice: { want: 10 }, hold: { want: 0 },
    sudden: { want: 0 }, leaks: { want: 0 }, stress: { now: 0 }, dayGear: { want: 100 }
  }
};
['signal', 'capacity', 'drynight'].concat(DECK).forEach(tag => {
  const ans = Object.assign({ u_often: 'rare', timeframe: 'open' }, samples[tag] || { goals: [tag] });
  const got = I.expandGoals(ans, dims, ans.goals || []);
  const hit = got.some(id => hasEvents(id) && (id === tag || (tag === 'signal' && id === 'fade') || (tag === 'capacity' && id === 'control') || (tag === 'drynight' && id === 'control')));
  ok(got.indexOf(tag) >= 0 || (tag === 'signal' && got.indexOf('fade') >= 0) || (tag === 'capacity' && got.indexOf('control') >= 0) || (tag === 'drynight' && got.indexOf('control') >= 0), tag + ' is reachable from a quiz answer (' + got.join(',') + ')');
  ok(hit && hasEvents(tag === 'signal' ? 'fade' : tag === 'capacity' || tag === 'drynight' ? 'control' : tag), tag + ' maps onto events');
});

function chain(odds, n, rng) {
  const o = odds.slice();
  const t0 = o.reduce((a, b) => a + b, 0) || 1;
  let potty = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c <= 4; c++) {
      const go = o[0] + Math.min(4, c) * 0.06 * t0;
      const T = t0 - o[0] + go;
      const r = rng() * T;
      if (r < go) { potty++; break; }
      if (r < go + o[4]) break;
      if (c === 4) break;
    }
  }
  return Math.round(100 * potty / n);
}
let seed = 3;
const rng = () => { seed = (seed * 48271) % 2147483647; return (seed - 1) / 2147483646; };
['none', 'little', 'shaky', 'okay', 'good', 'full'].forEach(key => {
  const s = C.stats(key);
  const text = C.describe(key, false);
  const sim = chain(C.level(key).odds, 4000, rng);
  ok(Math.abs(sim - s.potty) <= 4, key + ' potty % matches a chain simulation (' + sim + ' vs ' + s.potty + ')');
  ok(text.indexOf(s.holdPrompts + '%') >= 0 && text.indexOf(s.firstGo + '%') >= 0 && text.indexOf(s.potty + '%') >= 0 && text.indexOf(s.mostlyDry + '%') >= 0, key + ' About text uses the computed odds');
});
const infant = {
  levelKey: { day: 'none', night: 'none' },
  direction: { day: 'A', night: 'A' },
  goals: ['urgency', 'bedwetting', 'first_urge', 'relaxed'],
  methods: { day: ['relaxed'], night: ['stay_bed'] },
  urgency: { passes: 'rare' },
  sipBatch: 4, sipGapMin: 30
};
const about = E.aboutText(infant);
const sum = E.deckSummary(infant);
const chance = Math.round(E.passChance(infant, { track: 'day', levelKey: 'none' }) * 100);
ok(about.indexOf(C.stats('none').potty + '%') >= 0 && about.indexOf(sum.total + ' events') >= 0 && about.indexOf(sum.micro + ' micro') >= 0 && about.indexOf(chance + '%') >= 0, 'conditioning About adds deck counts and the pee-pass chance');
ok(/batch of 4/.test(about) && /30 min quiet/.test(about), 'About names the sip batch and gap');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profiles = fs.readFileSync(path.join(root, 'js', 'cond-profiles.js'), 'utf8');
const onboard = fs.readFileSync(path.join(root, 'js', 'onboarding.js'), 'utf8');
ok(html.indexOf('js/pee-tap.js') >= 0, 'pee tap script is loaded');
ok(profiles.indexOf('id="condAbout"') >= 0 && onboard.indexOf('id="quizDeckMix"') >= 0 && onboard.indexOf('id="quizAbout"') >= 0, 'Profiles and the quiz result show the write-up');
const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "(\d+)"/.test(g) && +g.match(/versionName "(\d+)"/)[1] >= 58 && +g.match(/versionCode (\d+)/)[1] >= 58, 'version at least 58');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v58 ok');
