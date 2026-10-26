// v39: post-settle latch is not a re-arm loop; Path clip-assist covers a pending go until resolve
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global;
global.addEventListener = () => {};
global.confirm = () => true;
const els = [];
function el() {
  const o = { style: {}, className: '', innerHTML: '', children: [], dataset: {}, id: '',
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return el(); },
    querySelectorAll() { return []; },
    remove() {}, addEventListener() {}, setAttribute() {},
    classList: { add() {}, toggle() {} }, onclick: null, textContent: ''
  };
  return o;
}
global.document = {
  addEventListener() {}, getElementById: () => null, querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => { const e = el(); els.push(e); return e; },
  body: { appendChild() {} }
};
['hub', 'calendar', 'accident', 'classes', 'control', 'campaign', 'potty-path', 'path-play', 'path-features', 'dryclip', 'clip-bridge'].forEach(f => {
  require(path.join(root, 'js', f + '.js'));
});

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

ok(BSDryClip.KEY === 'bs_dryclip_v1' && BSClipBridge.HOLD_KEY === 'bs_clip_bridge_hold_v1', 'storage keys frozen');
ok(BSHub.PLAY_KEY === 'bs_play_prefs_v1' && BSPath.KEY === 'bs_path_v1' && BSClasses.KEY === 'bs_class_v1', 'play/path/class keys frozen');

// --- A. latched touch is not a new wet and not an in-window ignore ---
const now = 1_800_000_000_000;
const W = (secs) => ({ wet: true, armed: true, secs });
ok(BSDryClip.decideWet(W(1), now, { ignoreUntil: now + 10000 }) === 'ignore_window', 'still inside settle → ignore_window');
ok(BSDryClip.decideWet(W(30), now + 25000, { ignoreUntil: now + 20000 }) === 'latched_touch', 'wet that started in the window, seen after it → latched_touch');
ok(BSDryClip.decideWet(W(2), now + 40000, { ignoreUntil: now + 20000 }) === 'new', 'wet that starts after settle → new');
ok(BSDryClip.decideWet(W(1), now, { settling: true, ignoreUntil: 0 }) === 'arming', 'settling flag still blocks a calendar wet');

const svc = read('android/app/src/main/java/dev/simpledl/bladdersim/dryclip/DryClipService.kt');
const proto = read('android/app/src/main/java/dev/simpledl/bladdersim/dryclip/DryClipProtocol.kt');
ok(proto.includes('LATCHED_TOUCH') && svc.includes('onLatchedTouch'), 'protocol + service name the latch');
ok(/not re-arming until the plate reads dry/.test(svc), 'service does not re-arm a post-settle latch');
ok(!svc.includes('arm("touch-clear")'), 'touch-clear re-arm loop is gone');
ok(svc.includes('classic pairing is optional') && !svc.includes('holdForUnpaired') && !svc.includes('Arm held'), 'bond none is logged and does not block connect or arm');
ok(svc.includes('mommyCheck') && svc.includes('Mommy check'), 'native padding check before auto-arm');

// --- C. random padding check sits before the nominal re-arm ---
const early = BSDryClip.planMommyCheck(now, 20, 8, () => 0);
const late = BSDryClip.planMommyCheck(now, 20, 8, () => 0.999);
ok(early.checkAt < early.armAt && late.checkAt < late.armAt, 'check is before arm');
ok(early.checkAt >= now + 12 * 60000 && late.checkAt <= early.armAt - 60000, 'check stays inside the spread window');
ok(early.baseMin === 20 && early.spreadMin === 8, 'plan keeps protection delay + spread');
const care = BSDryClip.mommyCheckCopy(true), solo = BSDryClip.mommyCheckCopy(false);
ok(/Mommy/.test(care.title + care.body) && !/Mommy/.test(solo.title), 'caregiver voice vs plain padding check');
ok(BSDryClip.mommyCheckOn({ mommyCheck: true }) && !BSDryClip.mommyCheckOn({ mommyCheck: false }), 'padding check is tunable');

// --- B. pending go is hold context before the timer and after it hits 0 ---
BSHub.savePlayPrefs({ clipAssistPath: true, clipAssistCampaign: false, soft: false });
BSClipBridge.clearPathHold();
const b = BSPath.newBoard({ seed: 3, classId: 'bigkid', mode: 'quiz', dares: false });
BSPath.needToGo(b, 'pee', () => 0.5);
ok(!!b.pending, 'pending go exists');
const hold = BSClipBridge.pathHold();
ok(hold && hold.untilResolve && hold.pending && !hold.started, 'assist on: pending go before Start timer: ' + JSON.stringify(hold && { untilResolve: hold.untilResolve, started: hold.started }));
b.pending.holdEndsAt = Date.now() - 5000;
BSClipBridge.syncFromBoard(b);
const after = BSClipBridge.pathHold();
ok(after && after.untilResolve && after.endsAt < Date.now(), 'timer at 0 keeps the hold until resolve');
const wet = BSClipBridge.onClipWet({ wetAt: Date.now() - 3000, source: 'offer' });
ok(wet.handled && wet.actions.includes('hold_interrupt'), 'clip during pending/post-timer still interrupts');
BSPath.resolve(b, 'real', {});
ok(!BSClipBridge.pathHold(), 'resolve clears the hold marker');
BSHub.savePlayPrefs({ clipAssistPath: false });
BSClipBridge.syncFromBoard(b.pending ? b : BSPath.newBoard({ seed: 4, classId: 'bigkid', mode: 'quiz', dares: false }));
ok(!BSClipBridge.pathHold(), 'assist off does not keep a hold');
ok(/hold && !soft/.test(read('js/clip-bridge.js')), 'interrupt still needs a confirm; soft play does not auto-resolve');

// --- D. classes: Leaky Girl template, Pull-up Soft, Night Little, #2 on every class ---
ok(BSPath.CLASSES.every(c => c.poo && c.poo.note), 'every Path class has a #2 note');
const cardSrc = read('js/path-play.js');
const cardFn = cardSrc.slice(cardSrc.indexOf('function classCardHtml'), cardSrc.indexOf('function classCardHtml') + 1600);
ok(!/c\.from/.test(cardFn) && !read('js/potty-path.js').includes('${esc(c.from)}'), 'picker does not show old from: aliases');
ok(/Pull-up Soft/.test(BSPath.CLASS_BY_ID.pullup.name), 'pullup display is Pull-up Soft');
ok(/Night Little/.test(BSPath.CLASS_BY_ID.little.name), 'little display is Night Little');
ok(/Pad Girl/.test(BSPath.CLASS_BY_ID.padgirl.name) && /Leaky Girl/.test(BSPath.CLASS_BY_ID.leaky.name), 'Pad Girl and Leaky Girl names');
ok(BSPath.classHoldScale({ classId: 'pullup' }) === 1, 'Pull-up Soft holds are not ×0.8');
ok(BSPath.classHoldScale({ classId: 'leaky' }) === 0.65, 'Leaky Girl keeps the short holds');
const pad = BSPath.newBoard({ seed: 1, classId: 'padgirl', mode: 'quiz', dares: false });
pad.mastery.poo = 5;
pad.pending = { pos: pad.pos, stage: 0, kind: 'poo', rules: [{ k: 'gear', n: 1 }], holds: [], check: false };
BSPath.resolve(pad, 'acc', { urgency: 2 });
ok(pad.mastery.poo === 4, 'Pad Girl #2 accident is −1 (got ' + pad.mastery.poo + ')');
const cas = BSPath.newBoard({ seed: 2, classId: 'cascade', mode: 'quiz', dares: false });
cas.pending = { pos: cas.pos, stage: 1, kind: 'poo', rules: [{ k: 'potty', n: 1, then: 'potty' }], holds: [], check: false };
BSPath.resolve(cas, 'ok', { urgency: 1 });
ok(cas.mastery.poo === 3, 'Cascade #2 in the potty is +3 (got ' + cas.mastery.poo + ')');
const shy = BSPath.newBoard({ seed: 8, classId: 'shy', control: 90, startStage: 2, mode: 'quiz', dares: false });
BSPath.needToGo(shy, 'poo', () => 0.2);
ok(shy.pending && shy.pending.rules.some(r => r.min === 5 && /#2/.test(r.t)), 'Shy Goer #2 wait still applies');
ok(BSClasses.get('dribbler').name === 'Leaky Girl' && BSClasses.get('leaky').id === 'dribbler', 'Campaign dribbler is Leaky Girl');
ok(BSClasses.get('pullup').name === 'Pull-up Soft' && BSClasses.get('pullup').id !== 'dribbler', 'Pull-up Soft is not the Leaky Girl class');
ok(!BSClasses.get('pullup').flags.needDribbleFirst && !BSClasses.get('pullup').flags.holdScale, 'Pull-up Soft does not copy Leaky Girl holds/gate');
ok(BSClasses.CLASSES.every(c => c.flags && c.flags.poo && c.flags.poo.delta), 'every Campaign class has a small #2 delta');
ok(BSClasses.pooAdjust(2, 'dribbler') === 1, 'Leaky Girl #2 delta applies');

// --- E. maturity skins change more than the accent ---
const hub = read('js/hub.js'), css = read('mobile.css');
['baby', 'toddler', 'teen'].forEach(id => {
  ok(hub.includes(id + ':') && css.includes('data-bs-theme="' + id + '"') && css.includes('bs-theme-' + id), 'theme ' + id);
});
ok(css.includes('--bs-font') && css.includes('--card-radius') && css.includes('--bs-scene'), 'maturity skins set type, radius, and background');
ok(css.includes('bs-theme-girl') && css.includes('bs-theme-boy'), 'girl and boy accents kept');
ok(read('js/whats-new-data.js').includes("hash: 'v39'"), "What's New v39");
ok(/versionName "\d+"/.test(read('android/app/build.gradle')) && /versionCode \d+/.test(read('android/app/build.gradle')), 'gradle still has a version name and code');

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
