// v24: arm like the vendor app — no IDENTIFY/POWER reads, write-no-response ARM, expected drop → close + backoff reconnect, armed confirmed from DC01
const fs = require('fs'), vm = require('vm');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError, Promise,
  Uint8Array, DataView, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({}) },
  navigator: {}, addEventListener() {}, toast() {},
  Capacitor: { isNativePlatform: () => false, Plugins: {} }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../js/dryclip.js', 'utf8'), ctx, { filename: 'dryclip.js' });
const DC = ctx.BSDryClip;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const dv = a => new DataView(Uint8Array.from(a).buffer);
const wait = ms => new Promise(r => setTimeout(r, ms));

function fakeBle() {
  const f = { reads: [], writes: [], wnr: [], notif: {}, onDisc: null, disconnects: 0, connects: 0, prio: [], failConnects: 0, scans: 0,
    stateBytes: [0x00],
    async initialize() {}, async stopLEScan() {},
    async requestLEScan(o, cb) { f.scans++; setTimeout(() => cb({ device: { deviceId: 'AA:BB', name: 'DryClip' }, uuids: [DC.SVC] }), 5); },
    async connect(id, onDisc) { f.connects++; f.onDisc = onDisc; if (f.failConnects > 0) { f.failConnects--; throw new Error('Connection timed out'); } },
    async disconnect() { f.disconnects++; },
    async requestConnectionPriority(id, p) { f.prio.push(p); },
    async startNotifications(id, s, c, cb) { f.notif[c] = cb; },
    async read(id, s, c) { f.reads.push(c); if (c === DC.C.STATE) return dv(f.stateBytes); if (c === DC.C.BAT) return dv([90]); throw new Error('Reading characteristic failed.'); },
    async write(id, s, c, v) { f.writes.push(c); }, async writeWithoutResponse(id, s, c, v) { f.wnr.push([c, Array.from(new Uint8Array(v.buffer))]); } };
  return f;
}

(async () => {
  Object.assign(DC._cfg, { backoffMs: [20, 40, 60], retryMs: 80, closeDelayMs: 10, scanMs: 50, armConfirmMs: 5000 });
  const f = fakeBle(); DC._setBle(f);
  await DC.connect('AA:BB', 'DryClip • 8DD2');
  ok(!f.reads.includes(DC.C.IDENTIFY) && !f.reads.includes(DC.C.POWER), 'no IDENTIFY / POWER_FLAGS reads on connect');
  ok(f.reads.filter(c => c === DC.C.STATE).length === 1 && f.reads.filter(c => c === DC.C.BAT).length === 1, 'DC01 + battery read once');
  ok(f.prio[0] === 1, 'connection priority HIGH like vendor');

  // Repeated identical notifications don't spam the log, and no reads happen in between
  const before = DC.load().log.length, readsBefore = f.reads.length;
  for (let i = 0; i < 5; i++) { f.notif[DC.C.STATE](dv([0x00])); f.notif[DC.C.BAT](dv([90])); }
  ok(DC.load().log.length - before <= 1, 'repeat readings not logged each time');
  ok(f.reads.length === readsBefore, 'no polling reads');

  // Arm: single 0x01 to DC02 without response, nothing else written
  await DC.arm();
  ok(f.wnr.length === 1 && f.wnr[0][0] === DC.C.ARM && f.wnr[0][1].join() === '1' && f.writes.length === 0, 'ARM = write-without-response [0x01], no other writes');
  ok(DC.armPending && DC.uiState().clip === 'Arming…' && !DC.uiState().buttons.arm.on, 'arming shown, Arm disabled');
  let threw = false; try { await DC.arm(); } catch (e) { threw = true; } ok(threw && f.wnr.length === 1, 'second Arm blocked while arming');
  await DC.ack(); ok(f.writes.length === 0, 'no ACK write while arming');

  // Stale WET bit while arming is ignored (vendor does the same)
  f.notif[DC.C.STATE](dv([0x13, 0, 0, 0, 0]));
  ok(!DC.state.wet && DC.armPending, 'stale WET ignored while arming');

  // Clip drops the link ~5 s after Arm: expected, not an error
  f.failConnects = 1; f.stateBytes = [0x02, 0, 0, 0, 0];
  const errsBefore = DC.load().log.filter(e => e.kind === 'err').length;
  f.onDisc('AA:BB');
  ok(DC.connState === 'rearming' && /restarts its link/.test(DC.uiState().connText), 'expected drop → "Arming… the clip restarts its link"');
  ok(!DC.load().log.some(e => e.kind === 'conn' && e.msg === 'Connection lost' && e.t > Date.now() - 50), 'not logged as Connection lost');
  await wait(400);
  ok(f.disconnects >= 1, 'old link closed before reconnect');
  ok(f.scans >= 1, 'rescanned after direct connect failed');
  ok(DC.connState === 'connected', 'reconnected');
  ok(!DC.armPending && DC.uiState().clip === 'Dry & armed', 'DC01 read after reconnect → Dry & armed');
  ok(DC.load().log.filter(e => e.kind === 'err').length === errsBefore, 'no error logged');

  // Armed & quiet: drop is not expected now, but we still reconnect (clip armed)
  const c0 = f.connects; f.onDisc('AA:BB');
  ok(DC.connState === 'lost', 'later drop → lost');
  await wait(200);
  ok(DC.connState === 'connected' && f.connects > c0, 'reconnects while clip armed');

  // Wet after armed: flag time = now − secs
  f.notif[DC.C.STATE](dv([0x03, 30, 0, 0, 0]));
  ok(DC.state.wet && DC.state.secs === 30, 'wet after arming is reported');

  await DC.disconnect();
  ok(DC.connState === 'idle', 'manual disconnect idle');
  console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
