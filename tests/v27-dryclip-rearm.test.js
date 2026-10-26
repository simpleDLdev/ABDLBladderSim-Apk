// v27: Arm re-arms (recalibrates) when already armed; wet → ACK then ARM; no gap marker for the re-arm drop
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
  const f = fakeBle(); f.stateBytes = [0x02, 0, 0, 0, 0]; DC._setBle(f);
  await DC.connect('AA:BB', 'DryClip');
  let u = DC.uiState();
  ok(u.buttons.arm.on && u.buttons.arm.label === '🔄 Re-arm (recalibrate)' && /fresh warmth baseline/.test(u.buttons.arm.why), 'armed → Re-arm (recalibrate) enabled with hint');
  ok(!JSON.stringify(u).includes('Already armed'), "no 'Already armed'");
  const cal = []; ctx.BSCalendar = { addEntry: e => cal.push(e), load: () => ({ entries: cal }) };
  await DC.arm();
  ok(f.wnr.length === 1 && f.wnr[0][0] === DC.C.ARM && f.writes.length === 0, 'ARM written again while armed');
  u = DC.uiState(); ok(!u.buttons.arm.on && u.buttons.arm.why === 'Arming…', 'blocked while arming, shows Arming…');
  f.notif[DC.C.STATE](dv([0x02, 0, 0, 0, 0]));
  ok(DC.armPending, 'old armed reading does not confirm the re-arm');
  f.onDisc('AA:BB');
  ok(DC.connState === 'rearming', 'expected drop after re-arm');
  await wait(400);
  ok(DC.connState === 'connected', 'reconnected');
  await wait(2700); f.notif[DC.C.STATE](dv([0x02, 0, 0, 0, 0]));
  ok(!DC.armPending && DC.uiState().buttons.arm.on, 're-arm confirmed; Arm available again');
  ok(cal.length === 0, 'no calendar event / gap marker from re-arm');
  // Wet → Re-arm = ACK then ARM
  f.notif[DC.C.STATE](dv([0x03, 5, 0, 0, 0]));
  u = DC.uiState(); ok(u.buttons.arm.on && u.buttons.arm.label === '🛡 Re-arm', 'wet → Re-arm enabled');
  const n = f.wnr.length; await DC.arm();
  ok(f.writes.includes(DC.C.ACK) && f.wnr.length === n + 1, 'wet re-arm sends WET_ACK then ARM');
  DC.disconnect && DC.disconnect();
  console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
