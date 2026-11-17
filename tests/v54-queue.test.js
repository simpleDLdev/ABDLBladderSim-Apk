// v54: a void guide and a sip that arrive together do not stack, and logging the sip does not abort the guide.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, Date, Math, Object, Array, JSON };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'event-queue.js'), 'utf8'), ctx, { filename: 'event-queue.js' });
const Q = ctx.BSEventQueue;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const shown = [];
Q.clear();
const first = Q.offer({ key: 'void-1', kind: 'guide' });
ok(first.state === 'active' && first.active === 'guide', 'the void guide takes the screen');
const second = Q.offer({ key: 'sip', kind: 'sip', show: () => shown.push('sip') });
ok(second.state === 'waiting' && second.active === 'guide' && second.waiting[0] === 'sip', 'the sip waits behind the guide');
const early = Q.logSip();
ok(!early.logged && early.abortedGuide === false && early.active === 'guide', 'logging a sip does not abort the guide');
ok(Q.snapshot().active === 'guide' && Q.snapshot().waiting[0] === 'sip', 'the guide is still the active item');
const done = Q.completeActive();
ok(done.doneKind === 'guide' && done.nextKind === 'sip' && shown[0] === 'sip', 'when the guide finishes, the sip shows');
const logged = Q.logSip();
ok(logged.logged && logged.abortedGuide === false && !logged.active, 'the sip logs only after it is the item on screen');

Q.clear();
Q.offer({ key: 'sip', kind: 'sip' });
ok(Q.offer({ key: 'sip', kind: 'sip' }).duplicate, 'a second sip is not queued again');
Q.clear();
Q.offer({ key: 'banner:spasm', kind: 'banner' });
Q.offer({ key: 'banner:spasm', kind: 'banner' });
ok(Q.snapshot().waiting.length === 0, 'the same banner is not stacked twice');
Q.offer({ key: 'sip', kind: 'sip', show: () => shown.push('after-banner') });
const next = Q.completeActive();
ok(next.doneKind === 'banner' && next.nextKind === 'sip' && shown.indexOf('after-banner') >= 0, 'resume shows the waiting sip once, after the banner');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "54"/.test(g) && /versionCode 54/.test(g), 'version 54');
const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
ok(ui.indexOf('A sip log never closes a guide') >= 0, 'the sip button refuses to close an open guide');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v54 queue tests passed');
