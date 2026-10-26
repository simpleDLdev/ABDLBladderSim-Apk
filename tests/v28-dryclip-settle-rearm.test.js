// v28: settle/pair ignore (no false wet from plate-touch) + default 20 min re-arm + protection-linked delay
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const entries = [];
const BSCalendar = {
  addEntry(e) { const x = Object.assign({ id: 'e' + entries.length }, e); entries.push(x); return x; },
  load() { return { entries }; },
  unconfirmedClipFlags() { return entries.filter(e => e.type === 'clip_flag' && !e.confirmed && !e.dismissed); },
  unconfirmedClipCount() { return this.unconfirmedClipFlags().length; }
};
let status = { running: false, conn: 'off', bonded: 'bonded' };
const calls = [];
const plugin = {
  async addListener() { return { remove() {} }; },
  async getStatus() { return status; },
  async drainEvents() { return { events: [] }; },
  async ensurePermissions() { return { bluetooth: true, notifications: true }; },
  async findClip() { return { bonded: [{ address: 'E9:DE:61:89:8D:D2', name: 'DRYCLIP', isDryClip: true }] }; },
  async start(o) { calls.push('start:' + o.mac + ':' + o.rearmMin); status = Object.assign({}, status, { running: true, conn: 'connecting', mac: o.mac, rearmMin: o.rearmMin }); return status; },
  async stop() { calls.push('stop'); status = Object.assign({}, status, { running: false }); },
  async arm() { calls.push('arm'); }, async ackWet() { calls.push('ack'); },
  async setConfig(o) { calls.push('cfg:' + o.rearmMin); },
  async getLog() { return { text: '' }; }
};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError, Promise,
  Uint8Array, DataView, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({}) },
  navigator: {}, addEventListener() {}, toast() {}, BSCalendar,
  Capacitor: { isNativePlatform: () => true, Plugins: { DryClipService: plugin } }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/dryclip.js'), 'utf8'), ctx, { filename: 'dryclip.js' });
const DC = ctx.BSDryClip;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

(async () => {
  // ---------- 1. defaults ----------
  ok(DC.load().rearmMin === 20, 'default rearmMin is 20');
  ok(DC.SETTLE_ON_CONNECT_MS === 20000 && DC.IGNORE_AFTER_ARM_MS === 20000, 'settle and post-arm windows are 20 s');
  ok(DC.REARM_BY_PROT.pad === 20 && DC.REARM_BY_PROT.pullups === 25 && DC.REARM_BY_PROT.diapers === 30 && DC.REARM_BY_PROT.thick_diapers === 40 && DC.REARM_BY_PROT.none === 15, 'protection → re-arm map');

  // ---------- 2. decideWet: pairing / settling never yields 'new' ----------
  const now = 1_800_000_000_000;
  const W = (b, secs) => ({ wet: !!(b & 1), armed: !!(b & 2), arming: !!(b & 0x10), secs });
  ok(DC.decideWet(W(0x03, 2), now, { settling: true }) === 'arming', 'settling → treat as arming (no calendar wet)');
  ok(DC.decideWet(W(0x03, 2), now, { pairing: true }) === 'arming', 'pairing → no calendar wet');
  ok(DC.decideWet(W(0x03, 5), now, { ignoreUntil: now + 15000 }) === 'ignore_window', 'inside ignoreUntil → ignore_window');
  const ig = now - 5000;
  ok(DC.decideWet(W(0x03, 2), now, { ignoreUntil: now + 15000 }) === 'ignore_window', 'inside settle window stays ignore_window');
  ok(DC.decideWet(W(0x03, 40), ig + DC.SETTLE_ON_CONNECT_MS + 10000, { ignoreUntil: ig + DC.SETTLE_ON_CONNECT_MS }) === 'latched_touch',
     'post-settle latched touch is not a new wet');
  ok(DC.decideWet(W(0x03, 3), now + 60000, { ignoreUntil: now + 10000 }) === 'new' ||
     DC.decideWet(W(0x03, 3), ig + DC.SETTLE_ON_CONNECT_MS + 30000, { ignoreUntil: ig + DC.SETTLE_ON_CONNECT_MS }) === 'new',
     'wet starting after settle → new');

  // ---------- 3. rearmMinutesFor ----------
  store[DC.KEY] = JSON.stringify({ rearmMin: 20, rearmByProt: false });
  ok(DC.rearmMinutesFor() === 20, 'custom 20');
  store[DC.KEY] = JSON.stringify({ rearmMin: 5, rearmByProt: true });
  store.currentProtectionLevel = 'thick_diapers';
  ok(DC.rearmMinutesFor() === 40, 'Match protection · thick overnight → 40');
  store.currentProtectionLevel = 'pad';
  ok(DC.rearmMinutesFor() === 20, 'Match protection · pad → 20');
  store.currentProtectionLevel = 'pullups';
  ok(DC.rearmMinutesFor() === 25, 'Match protection · pullups → 25');

  // ---------- 4. native UI phases ----------
  let u = DC.nativeUiState({ running: true, conn: 'connected', armed: true, wet: false, ignoreUntil: 0, phase: 'listening' });
  ok(u.clip === 'Armed, listening', 'listening phase → Armed, listening');
  u = DC.nativeUiState({ running: true, conn: 'connected', armed: true, wet: true, ignoreUntil: Date.now() + 10000, settling: true, phase: 'settling' });
  ok(u.clip === 'Pairing / settling…' || u.settling, 'settling + wet → Pairing / settling…');
  u = DC.nativeUiState({ running: true, conn: 'waiting', armed: false, armPending: false });
  ok(/looking for clip|reconnect/i.test(u.connText), 'disconnected → reconnecting copy');

  // ---------- 5. start uses 20 ----------
  delete store[DC.KEY];
  await DC.connectAuto();
  ok(calls.some(c => /:20$/.test(c)), 'native start uses default re-arm 20');

  // ---------- 6. Kotlin static checks ----------
  const kdir = path.join(root, 'android/app/src/main/java/dev/simpledl/bladdersim/dryclip');
  const svc = fs.readFileSync(path.join(kdir, 'DryClipService.kt'), 'utf8');
  const storeKt = fs.readFileSync(path.join(kdir, 'DryClipStore.kt'), 'utf8');
  const proto = fs.readFileSync(path.join(kdir, 'DryClipProtocol.kt'), 'utf8');
  ok(/SETTLE_ON_CONNECT_MS = 20_000L/.test(proto), 'protocol SETTLE_ON_CONNECT_MS');
  ok(/getFloat\("rearmMin", 20f\)/.test(storeKt), 'store default rearmMin 20');
  ok(/SETTLE_ON_CONNECT_MS/.test(svc) && /Pairing \/ settling/.test(svc), 'service sets settle window on connect');
  ok(/already armed on connect/.test(svc) && /IGNORE_AFTER_ARM_MS/.test(svc), 'already-armed-on-connect also settles');
  ok(/Settling… \(touch ignored\)/.test(svc) && /Armed · listening/.test(svc) && /Reconnecting · looking for clip/.test(svc), 'notification reflects Settling / Armed / Reconnecting');
  ok(/phase\(\)/.test(svc) && /\.put\("settling"/.test(svc), 'status exposes phase + settling');
  ok(/fun arm\(source: String\)/.test(svc) && /Re-arm while armed/.test(svc), 'manual re-arm path still present');

  // ---------- 7. DryClip mount order (source check) ----------
  const js = fs.readFileSync(path.join(root, 'js/dryclip.js'), 'utf8');
  ok(/setPlay/.test(js) && /insertBefore\(details, play\.nextSibling\)/.test(js), 'DryClip mounts after Play & content');
  ok(/rearmByProt/.test(js) && /Match protection/.test(js), 'UI has Match protection re-arm mode');
  ok(/hash: 'v28'/.test(fs.readFileSync(path.join(root, 'js/whats-new-data.js'), 'utf8')), "What's New has v28");

  console.log(fail ? fail + ' FAILED' : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
