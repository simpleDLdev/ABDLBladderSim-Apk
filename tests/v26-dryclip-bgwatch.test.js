// v26: native background watch — JS parsing + event mapping (wetAt from secs, post-arm ignore window, ±60 s dedupe),
// drainEvents on resume, status card, and static checks on the Kotlin service / manifest.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const entries = [];
const BSCalendar = {
  addEntry(e) { const x = Object.assign({ id: 'e' + entries.length }, e); entries.push(x); return x; },
  load() { return { entries }; },
  unconfirmedClipFlags() { return entries.filter(e => e.type === 'clip_flag' && !e.confirmed && !e.dismissed && e.clip && e.clip.kind !== 'gap'); },
  unconfirmedClipCount() { return this.unconfirmedClipFlags().length; }
};
let drained = [], calls = [];
const listeners = {};
const plugin = {
  async addListener(n, cb) { listeners[n] = cb; return { remove() {} }; },
  async getStatus() { calls.push('getStatus'); return status; },
  async drainEvents() { calls.push('drainEvents'); const e = drained; drained = []; return { events: e }; },
  async ensurePermissions() { return { bluetooth: true, notifications: true }; },
  async findClip() { return { bonded: [{ address: 'E9:DE:61:89:8D:D2', name: 'DRYCLIP', isDryClip: true }] }; },
  async start(o) { calls.push('start:' + o.mac + ':' + o.rearmMin); status = Object.assign({}, status, { running: true, conn: 'connecting', mac: o.mac }); return status; },
  async stop() { calls.push('stop'); status = Object.assign({}, status, { running: false }); },
  async arm() { calls.push('arm'); }, async ackWet() { calls.push('ack'); }, async setConfig(o) { calls.push('cfg:' + o.rearmMin); },
  async getLog() { return { text: 'native line' }; }
};
let status = { running: false, conn: 'off', bonded: 'bonded' };
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
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // ---------- 1. parsing + wetAt ----------
  const st = DC.parseState(Uint8Array.from([0x03, 0x0C, 0x00, 0x00, 0x00]));
  ok(st.wet && st.armed && !st.arming && st.secs === 12, '03-0C-00-00-00 → wet + armed, 12 s since wet');
  ok(DC.parseState(Uint8Array.from([0x03, 0x1D, 0, 0, 0])).secs === 29, '03-1D → 29 s');
  ok(DC.parseState(Uint8Array.from([0x01, 0x10, 0x0E, 0x00, 0x00])).secs === 3600, 'uint32 LE: 10-0E-00-00 → 3600 s');
  const now = 1_800_000_000_000;
  ok(DC.wetAtFromSecs(now, 45) === now - 45000, 'wetAt = now − secs·1000');
  ok(DC.wetAtFromSecs(now, null) === now, 'no secs → wetAt = now');

  // ---------- 2. decideWet: ignore window + dedupe ----------
  const W = (b, secs) => ({ wet: !!(b & 1), armed: !!(b & 2), arming: !!(b & 0x10), secs });
  ok(DC.decideWet(W(0x02, 0), now, {}) === 'not_wet', 'dry → not_wet');
  ok(DC.decideWet(W(0x03, 5), now, { armPending: true }) === 'arming', 'WET while an arm is pending → ignored (arming)');
  ok(DC.decideWet(W(0x11, 5), now, {}) === 'arming', 'WET while the clip reports arming → ignored');
  ok(DC.decideWet(W(0x01, 5), now, {}) === 'not_armed', 'WET on an unarmed clip → not_armed');
  const confirmedAt = now - 5000, ig = confirmedAt + DC.IGNORE_AFTER_ARM_MS;
  ok(DC.IGNORE_AFTER_ARM_MS === 20000 && DC.DEDUPE_MS === 60000, 'window 20 s, dedupe 60 s');
  ok(DC.decideWet(W(0x03, 12), now, { ignoreUntil: ig }) === 'ignore_window', 'real log: 03-0C right after the armed confirmation → touch ignored');
  ok(DC.decideWet(W(0x03, 40), ig + 10000, { ignoreUntil: ig }) === 'ignore_window', 'wet that STARTED inside the window stays ignored after it');
  ok(DC.decideWet(W(0x03, 3), ig + 30000, { ignoreUntil: ig }) === 'new', 'wet starting after the window → new event');
  const last = ig + 30000 - 3000;
  ok(DC.decideWet(W(0x03, 33), ig + 60000, { ignoreUntil: ig, lastWetAt: last }) === 'duplicate', 'same wet time (±60 s) → duplicate');
  ok(DC.decideWet(W(0x03, 0), last + 59000, { lastWetAt: last }) === 'duplicate', '59 s apart → duplicate');
  ok(DC.decideWet(W(0x03, 0), last + 61000, { lastWetAt: last }) === 'new', '61 s apart → new');

  // ---------- 3. Kotlin mirror ----------
  const kdir = path.join(root, 'android/app/src/main/java/dev/simpledl/bladdersim/dryclip');
  const proto = fs.readFileSync(path.join(kdir, 'DryClipProtocol.kt'), 'utf8');
  const svc = fs.readFileSync(path.join(kdir, 'DryClipService.kt'), 'utf8');
  ok(/IGNORE_AFTER_ARM_MS = 20_000L/.test(proto) && /SETTLE_ON_CONNECT_MS = 20_000L/.test(proto) && /DEDUPE_MS = 60_000L/.test(proto) && /at < ignoreUntil/.test(proto), 'Kotlin decide() uses the same window, settle-on-connect, start-time rule and dedupe');
  ok(/now - secs \* 1000L/.test(proto), 'Kotlin wetAt = now − secs·1000');
  ok(/connectGatt\(this, auto, cb, BluetoothDevice.TRANSPORT_LE\)/.test(svc) && /connect\(dev, false\)/.test(svc) && /connect\(dev, true\)/.test(svc), 'direct connect (autoConnect=false) then autoConnect=true, TRANSPORT_LE');
  ok(/DIRECT_TIMEOUT_MS = 6_000L/.test(svc) && /RECONNECT_GAP_MS = 1_500L/.test(svc), '6 s direct timeout, 1.5 s after a drop');
  ok(!/requestMtu/.test(svc) && /CONNECTION_PRIORITY_HIGH/.test(svc) && /WRITE_TYPE_NO_RESPONSE/.test(svc), 'priority HIGH, no MTU, ARM without response');
  ok(!/createBond/.test(svc) && /setDeviceAddress\(mac\)/.test(svc) && !/setServiceUuid/.test(svc), 'never forces a bond; scan filters on address/name, not the DC00 UUID');
  ok(/START_STICKY/.test(svc) && /FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE/.test(svc) && /"Stop"/.test(svc), 'sticky connectedDevice foreground service with a Stop action');
  const man = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  ok(['FOREGROUND_SERVICE"', 'FOREGROUND_SERVICE_CONNECTED_DEVICE', 'POST_NOTIFICATIONS', 'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN'].every(p => man.includes('android.permission.' + p)), 'manifest permissions');
  ok(/\.dryclip\.DryClipService"[^>]*foregroundServiceType="connectedDevice"/.test(man), 'service declared with foregroundServiceType connectedDevice');
  ok(/DryClipPlugin/.test(fs.readFileSync(path.join(root, 'android/app/src/main/java/dev/simpledl/bladdersim/MainActivity.java'), 'utf8')), 'plugin registered in MainActivity');

  // ---------- 4. native path + event mapping ----------
  ok(DC.useNative(), 'native plugin present → native path');
  ok(DC.KEY === 'bs_dryclip_v1', 'storage key unchanged');
  await DC.connectAuto();
  ok(calls.some(c => /^start:E9:DE:61:89:8D:D2:20$/.test(c)), 'Connect with no saved clip → picks the paired DRYCLIP and starts the watch (default re-arm 20)');
  ok(DC.load().lastId === 'E9:DE:61:89:8D:D2', 'clip address saved');
  status = { running: true, conn: 'connected', bonded: 'bonded', armed: true, wet: false, raw: '02-00-00-00-00', battery: 90, armedSince: Date.now() };
  DC._setNativeStatus(status);
  let u = DC.uiState();
  ok(u.native && u.bg && (u.clip === 'Armed, listening' || u.clip === 'Dry & armed') && u.battery === 90, 'status card reads getStatus(): Armed, listening, battery 90%');
  ok(u.buttons.disconnect.on && !u.buttons.connect.on && u.buttons.arm.on && u.buttons.arm.label === '🔄 Re-arm (recalibrate)', 'buttons follow the watch (v27: Re-arm when armed)');
  u = DC.nativeUiState({ running: true, conn: 'connected', armed: true, wet: true, raw: '03-0C-00-00-00', ignoreUntil: Date.now() + 10000 });
  ok(u.clip === 'Pairing / settling…' || u.clip === 'Armed · touch ignored' || u.clip === 'Settling…', 'wet inside the ignore window shows settling / touch ignored');
  u = DC.nativeUiState({ running: true, conn: 'waiting', armed: true, wet: false });
  ok(/reconnects by itself/.test(u.connText), 'armed + link down → calm text');
  u = DC.nativeUiState({ running: true, conn: 'waiting', armed: false });
  ok(u.connText === 'Disconnected · looking for clip', 'link down → "Disconnected · looking for clip"');
  ok(DC.nativeUiState({ running: true, conn: 'connected', bonded: 'none' }).hint.includes("isn't paired"), 'not bonded → pairing hint');

  // Night on; events queued while the app was closed
  await DC.startNight({ wakeHour: 7, wakeMin: 0 });
  { const d0 = DC.load(); d0.night.startedAt = Date.now() - 4 * 3600e3; ctx.localStorage.setItem(DC.KEY, JSON.stringify(d0)); } // started 4 h ago
  const night = DC.load().night;
  ok(!DC.load().log.some(e => e.kind === 'awake' && /Keep-awake on/.test(e.msg)), 'native mode: no keep-awake');
  const t0 = Date.now();
  const wet1 = t0 - 3 * 3600e3, det1 = wet1 + 31000;
  drained = [
    { kind: 'wet', n: 2, wetAt: wet1 + 90 * 60e3, detectedAt: wet1 + 90 * 60e3 + 30000, secs: 30, battery: 88, rawHex: '03-1E-00-00-00' },
    { kind: 'wet', n: 1, wetAt: wet1, detectedAt: det1, secs: 31, battery: 89, rawHex: '03-1F-00-00-00' },
    { kind: 'wet', n: 3, wetAt: wet1 + 20000, detectedAt: det1 + 20000, secs: 11, battery: 89, rawHex: '03-0B-00-00-00' }, // same event ±60 s
    { kind: 'gap', from: wet1 + 10 * 60e3, to: wet1 + 25 * 60e3, detectedAt: wet1 + 25 * 60e3 },
    { kind: 'still_wet', detectedAt: wet1 + 100 * 60e3 }
  ];
  const n = await DC.drainNative();
  ok(n === 5 && calls.includes('drainEvents'), 'drainEvents() pulls the queue');
  const flags = entries.filter(e => e.type === 'clip_flag' && e.clip.kind === 'wet');
  ok(flags.length === 2, 'two wet flags, the ±60 s repeat deduped');
  ok(flags[0].ts === wet1 && flags[1].ts === wet1 + 90 * 60e3, 'flags logged at wetAt (not the reopen time), oldest first');
  ok(flags.every(f => f.mode === 'dryclip_night' && f.clip.nightId === night.id && !f.confirmed && f.tags.includes('needs-review')), 'silent overnight flags on tonight\'s night');
  ok(flags[0].clip.idx === 1 && flags[1].clip.idx === 2 && flags[0].clip.bat === 89, 'event numbers and battery kept');
  ok(entries.some(e => e.clip && e.clip.kind === 'gap' && e.clip.from === wet1 + 10 * 60e3), 'gap from the watch → calendar gap marker');
  ok(DC.load().night.saturatedAt === wet1 + 100 * 60e3 && entries.some(e => e.clip && e.clip.kind === 'saturated'), "still wet, can't re-arm → saturated marker");
  ok(DC.applyNativeEvent({ kind: 'wet', wetAt: night.startedAt - 3600e3, secs: 5 }) !== 'night', 'a wet before the night started is not a night flag');
  ok(!calls.includes('ack'), 'JS does not ack/re-arm itself in native mode (the service does)');

  // Morning: maybeMorning drains first, then opens the check-in
  const d = DC.load(); d.night.wakeAt = Date.now() - 1000; ctx.localStorage.setItem(DC.KEY, JSON.stringify(d));
  drained = [{ kind: 'wet', n: 4, wetAt: Date.now() - 20 * 60e3, detectedAt: Date.now() - 19 * 60e3, secs: 60, battery: 87, rawHex: '03-3C-00-00-00' }];
  calls.length = 0;
  DC.maybeMorning(); await wait(30);
  ok(calls[0] === 'drainEvents', 'resume: drainEvents() runs before the morning check-in');
  ok(entries.filter(e => e.clip && e.clip.kind === 'wet').length === 3 && DC.load().night.pendingCheckIn && !DC.load().wearingTonight, 'pre-wake event flagged, then morning check-in pending');

  // After the night: a later event goes to daytime watch / accident sheet, not the ended night
  const dd = DC.load(); dd.night = null; dd.daytimeWatch = true; ctx.localStorage.setItem(DC.KEY, JSON.stringify(dd));
  ok(DC.applyNativeEvent({ kind: 'wet', wetAt: Date.now() - 5000, detectedAt: Date.now(), secs: 5 }) === 'day', 'daytime watch → silent daytime flag');
  const dz = DC.load(); dz.daytimeWatch = false; ctx.localStorage.setItem(DC.KEY, JSON.stringify(dz));
  ok(DC.applyNativeEvent({ kind: 'wet', wetAt: Date.now() - 5000, secs: 5 }) === 'offer', 'no watch → offer the accident sheet at wetAt');

  // Arm / ack / stop route to the plugin
  calls.length = 0;
  await DC.arm(); await DC.ack(); DC.scheduleRearm(7); await DC.disconnect();
  ok(calls.includes('arm') && calls.includes('ack') && calls.includes('cfg:7') && calls.includes('stop'), 'Arm / Ack / re-arm delay / Stop go to the native watch');

  // What's New
  const wn = fs.readFileSync(path.join(root, 'js/whats-new-data.js'), 'utf8');
  ok(/hash: 'v28'/.test(wn) && wn.indexOf("'v28'") < wn.indexOf("'v27'"), "What's New has v28 on top");
  console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
