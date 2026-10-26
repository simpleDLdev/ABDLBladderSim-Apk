// v25: link like the vendor app — plugin patched (no MTU, priority HIGH before discovery, write-no-response ARM),
// calm reconnect (close → wait → one connect → scan; never overlapping, spaced out), 'Armed (assumed)' fallback.
const fs = require('fs'), vm = require('vm'), path = require('path');
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

// ---------- 1. Plugin patch (Android) ----------
const root = path.join(__dirname, '..');
const pdir = path.join(root, 'node_modules/@capacitor-community/bluetooth-le/android/src/main/java/com/capacitorjs/community/plugins/bluetoothle');
const dev = fs.readFileSync(path.join(pdir, 'Device.kt'), 'utf8');
const plug = fs.readFileSync(path.join(pdir, 'BluetoothLe.kt'), 'utf8');
const sd = dev.slice(dev.indexOf('override fun onServicesDiscovered'), dev.indexOf('override fun onMtuChanged'));
ok(dev.includes('BSIM-V25-PATCH'), 'plugin Device.kt carries the v25 patch');
ok(!/requestMtu\(/.test(sd) && /resolve\("connect"/.test(sd), 'no MTU request; connect resolves after service discovery');
const cb = dev.slice(dev.indexOf('override fun onConnectionStateChange'), dev.indexOf('override fun onServicesDiscovered'));
const iP = cb.indexOf('CONNECTION_PRIORITY_HIGH'), iD = cb.indexOf('discoverServices()');
ok(iP > 0 && iD > iP, 'requestConnectionPriority(HIGH) right after connect, before discovery');
ok(/reject\("connect", "Disconnected while connecting/.test(cb), 'a drop during connect rejects it at once');
ok(/gatt !== bluetoothGatt/.test(cb), 'callbacks from a stale GATT are ignored');
const wnr = plug.slice(plug.indexOf('fun writeWithoutResponse'), plug.indexOf('fun readDescriptor'));
ok(/WRITE_TYPE_NO_RESPONSE/.test(wnr), 'writeWithoutResponse uses WRITE_TYPE_NO_RESPONSE');
const pkg = require(path.join(root, 'package.json'));
ok(/patch-ble-plugin/.test(pkg.scripts.postinstall || '') && /patch-ble-plugin/.test(pkg.scripts.sync), 'patch runs on install (npm ci) and on sync');
ok(/already patched/.test(require('child_process').execFileSync('node', [path.join(root, 'scripts/patch-ble-plugin.js')]).toString()), 'patch is idempotent');

// ---------- 2. JS link handling ----------
function fakeBle() {
  const f = { reads: [], wnr: [], notif: {}, onDisc: null, connects: [], inFlight: 0, maxInFlight: 0, disconnects: 0, scans: 0,
    reachable: true, advertising: true, stateBytes: [0x00], dropDuringNotify: false, readsAfterDrop: 0, dropped: false,
    async initialize() {}, async stopLEScan() {},
    async requestLEScan(o, cb) { f.scans++; if (f.advertising) setTimeout(() => cb({ device: { deviceId: 'AA:BB', name: 'DryClip' }, uuids: [DC.SVC] }), 5); },
    async connect(id, onDisc) {
      f.connects.push(Date.now()); f.inFlight++; f.maxInFlight = Math.max(f.maxInFlight, f.inFlight); f.onDisc = onDisc;
      await wait(10); f.inFlight--;
      if (!f.reachable) throw new Error('Connection timeout.');
      f.dropped = false;
    },
    async disconnect() { f.disconnects++; },
    async requestConnectionPriority() {},
    async startNotifications(id, s, c, cb) {
      if (f.dropped) throw new Error('Not connected to device.');
      f.notif[c] = cb;
      if (f.dropDuringNotify) { f.dropDuringNotify = false; f.dropped = true; f.onDisc('AA:BB'); }
    },
    async read(id, s, c) { if (f.dropped) f.readsAfterDrop++; f.reads.push(c); if (c === DC.C.STATE) return dv(f.stateBytes); return dv([90]); },
    async write() {}, async writeWithoutResponse(id, s, c, v) { f.wnr.push([c, Array.from(new Uint8Array(v.buffer))]); } };
  return f;
}

(async () => {
  Object.assign(DC._cfg, { connectTimeoutMs: 30, closeDelayMs: 40, retryMs: 60, scanMs: 50, armAssumeMs: 150, armConfirmMs: 100000, armDropWindowMs: 100000 });
  const f = fakeBle(); DC._setBle(f);
  ok(DC._cfg.connectTimeoutMs === 30 && DC._cfg.closeDelayMs === 40, 'test timings applied');

  // Drop right during setup: no notify/read on the dead link
  f.dropDuringNotify = true;
  await DC.connect('AA:BB', 'DryClip • 8DD2');
  ok(f.readsAfterDrop === 0, 'drop during setup: no read on the dead link');
  ok(!DC.load().log.some(e => e.kind === 'warn' && /Not connected to device/.test(e.msg)), 'no "Not connected to device" warnings');
  await wait(250); // calm reconnect brings it back (Night/Day watch off, but keep while armed: here no keepLink → idle)
  // Fresh, normal connect
  await DC.disconnect(); await wait(20);
  f.dropped = false; f.connects.length = 0;
  await DC.connect('AA:BB', 'DryClip • 8DD2');
  ok(DC.connState === 'connected', 'connected');

  // Arm, then the clip goes to sleep: drops the link and doesn't come back or advertise
  await DC.arm();
  ok(f.wnr.length === 1 && f.wnr[0][1].join() === '1', 'ARM = one 0x01 write without response');
  f.reachable = false; f.advertising = false; f.connects.length = 0;
  const errs0 = DC.load().log.filter(e => e.kind === 'err').length;
  f.dropped = true; f.onDisc('AA:BB');
  ok(DC.connState === 'rearming', 'expected drop while arming');
  await wait(40);
  ok(f.connects.length === 0, 'waits after the close before the first connect');
  await wait(200);
  ok(DC.armAssumed && !DC.armPending && DC.uiState().clip === 'Armed (assumed)', "12 s fallback → 'Armed (assumed)'");
  ok(/asleep between checks/.test(DC.uiState().connText) && DC.uiState().dot !== '#e17055', 'shown calmly, not as an error');
  ok(DC.uiState().buttons.arm.on && DC.uiState().buttons.arm.mode === 'armed', 'v27: Re-arm available while assumed armed');
  await wait(500);
  const gaps = f.connects.slice(1).map((t, i) => t - f.connects[i]);
  ok(f.maxInFlight === 1, 'attempts never overlap');
  ok(f.connects.length <= 2, 'no connect storm while nothing advertises (connects: ' + f.connects.length + ')');
  ok(f.scans >= 3, 'keeps scanning in the background (scans: ' + f.scans + ')');
  ok(gaps.every(g => g >= 40), 'connects spaced at least the close delay apart');
  ok(DC.load().log.filter(e => e.kind === 'err').length === errs0, 'no error logged');

  // Clip wakes, advertises, reports wet 30 s ago
  f.reachable = true; f.advertising = true; f.stateBytes = [0x03, 30, 0, 0, 0];
  await wait(300);
  ok(DC.connState === 'connected', 'reconnects to a fresh advertisement');
  ok(DC.state.wet && DC.state.secs === 30 && !DC.armAssumed, 'wet picked up with seconds-since-wet; assumed cleared');

  await DC.disconnect();
  ok(DC.connState === 'idle' && !DC.armAssumed, 'manual disconnect idle');
  console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
