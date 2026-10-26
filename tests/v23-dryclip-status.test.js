// v23: DryClip status card, state-aware buttons, connect timeout hint, reconnect, raw DC01 line
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

function fakeBle(opts) {
  const f = { reads: [], notif: {}, onDisc: null, disconnects: 0,
    async initialize() {}, async stopLEScan() {},
    connect(id, onDisc) { f.onDisc = onDisc; return opts.hang ? new Promise(() => {}) : Promise.resolve(); },
    async disconnect() { f.disconnects++; },
    async startNotifications(id, s, c, cb) { f.notif[c] = cb; },
    async read(id, s, c) { f.reads.push(c); if (c === DC.C.STATE) return dv([0x00]); if (c === DC.C.BAT) return dv([77]); throw new Error('n/a'); },
    async write() {}, async writeWithoutResponse() {} };
  return f;
}

(async () => {
  ok(DC.clipLabel(DC.parseState([0x03])) === 'Wet', 'wet label');
  ok(DC.clipLabel(DC.parseState([0x02])) === 'Dry & armed', 'armed label');
  ok(DC.clipLabel(DC.parseState([0x10])) === 'Arming…', 'arming label');
  ok(DC.clipLabel(DC.parseState([0x08])) === 'Charging', 'charging label');
  ok(DC.clipLabel(DC.parseState([0x00])) === 'Not armed', 'not armed label');

  let u = DC.uiState();
  ok(u.connText === 'Not connected' && u.buttons.connect.on && !u.buttons.disconnect.on && !u.buttons.arm.on && !u.buttons.ack.on, 'idle: only Connect');
  ok(!!u.buttons.arm.why && !!u.buttons.ack.why, 'disabled buttons have reasons');

  // Timeout → hint
  DC._cfg.connectTimeoutMs = 50;
  DC._setBle(fakeBle({ hang: true }));
  let err = null; try { await DC.connect('AA:BB', 'DryClip • AABB'); } catch (e) { err = e; }
  ok(err && /timed out/i.test(err.message), 'connect times out');
  u = DC.uiState();
  ok(u.conn === 'idle' && u.hint === DC.HINT, 'hint shown after failed connect');

  // Successful connect: subscribes + reads DC01 once
  const f = fakeBle({}); DC._setBle(f);
  await DC.connect('AA:BB', 'DryClip • AABB');
  u = DC.uiState();
  ok(u.conn === 'connected' && u.connText === 'Connected' && !u.hint, 'connected, hint cleared');
  ok(!!f.notif[DC.C.STATE], 'subscribed to DC01');
  ok(f.reads.filter(c => c === DC.C.STATE).length === 1, 'read DC01 once on connect');
  ok(u.battery === 77 && u.name === 'DryClip • AABB' && u.lastSeenAt, 'battery, name, last seen');
  ok(u.clip === 'Not armed' && u.buttons.arm.on && !u.buttons.ack.on && !u.buttons.connect.on && u.buttons.disconnect.on, 'not armed: Arm + Disconnect');

  f.notif[DC.C.STATE](dv([0x10]));
  ok(DC.uiState().clip === 'Arming…' && !DC.uiState().buttons.arm.on, 'arming disables Arm');
  f.notif[DC.C.STATE](dv([0x02, 0, 0, 0, 0]));
  ok(DC.uiState().clip === 'Dry & armed' && DC.uiState().buttons.arm.label === '🔄 Re-arm (recalibrate)', 'v27: armed → Re-arm (recalibrate)');
  f.notif[DC.C.STATE](dv([0x03, 5, 0, 0, 0]));
  u = DC.uiState();
  ok(u.clip === 'Wet' && u.buttons.ack.on, 'wet enables Acknowledge');
  ok(u.raw && u.raw.hex === '03 05 00 00 00' && u.raw.t, 'raw DC01 hex + time');

  // Unexpected drop while Daytime watch on → lost + retry
  const d = DC.load(); d.daytimeWatch = true; DC.save(d);
  DC._cfg.retryMs = 30;
  f.onDisc('AA:BB');
  ok(DC.uiState().connText === 'Lost connection, reconnecting…', 'lost while watching');
  await new Promise(r => setTimeout(r, 120));
  ok(DC.connState === 'connected', 'auto-reconnected');

  // Manual disconnect: idle, no reconnect, duplicate callback ignored
  await DC.disconnect();
  f.onDisc('AA:BB');
  await new Promise(r => setTimeout(r, 80));
  ok(DC.connState === 'idle', 'manual disconnect stays idle');
  const discLogs = DC.load().log.filter(e => e.kind === 'conn' && /^Disconnected/.test(e.msg)).length;
  ok(discLogs === 1, 'Disconnected logged once (got ' + discLogs + ')');

  console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
