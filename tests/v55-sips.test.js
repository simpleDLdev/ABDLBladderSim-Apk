// v55: 4 sips, then 30 minutes quiet. A low tank does not stack a second alarm.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['profile-config.js', 'bladder-tank.js', 'event-queue.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
});
const T = ctx.BSTank, Q = ctx.BSEventQueue;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const none = ctx.conditioningSipPlan('none');
ok(none.count === 4 && none.gapMin === 30, 'lowest control defaults to 4 sips and 30 min');
const custom = ctx.conditioningSipPlan('none', { sipBatch: 6, sipGapMin: 45 });
ok(custom.count === 6 && custom.gapMin === 45, 'the profile can change the batch and the gap');
ok(ctx.conditioningSipPlan('full').count < none.count, 'higher control asks for a smaller batch');

const run = T.simulate({ minutes: 120, capacity: 300, startMl: 20, minVoidMl: 60, rng: () => 0 });
ok(run.sips === 4, 'a 2h session shows about 4 prompts (' + run.sips + ')');
ok(run.log.sips.every(s => s.n === 4), 'each prompt is 4 sips');
ok(run.log.sips.every((s, i) => i === 0 || s.t - run.log.sips[i - 1].t >= 30), 'no two prompts are inside 30 min');
const times = run.log.sips.map(s => s.t);
ok(new Set(times).size === times.length, 'no two drink alarms at the same minute');
ok(run.voidsBelowMin === 0, 'voids still wait for enough in the tank');

const now = 1_000_000;
ok(T.sipGate({ lastAt: 0, now: now, gapMin: 30 }).ok, 'the first batch is allowed');
const held = T.sipGate({ lastAt: now, now: now + 10 * 60000, gapMin: 30 });
ok(!held.ok && held.waitMin === 20, 'a low-tank check inside the gap waits (' + held.waitMin + ' min)');
ok(T.sipGate({ lastAt: now, now: now + 30 * 60000, gapMin: 30 }).ok, 'the next batch is allowed once 30 min have passed');
ok(!T.sipGate({ lastAt: 0, now: now, gapMin: 30, showing: true }).ok, 'a sip already on screen blocks a second alarm');

Q.clear();
Q.offer({ key: 'sip', kind: 'sip' });
ok(Q.offer({ key: 'sip', kind: 'sip' }).duplicate, 'the queue drops a second sip');

const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
ok(/versionName "55"/.test(g) && /versionCode 55/.test(g), 'version 55');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v55 sip tests passed');
