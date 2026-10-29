// v43: armed wet notifies, disarmed wet does not, BOND_NONE does not block connect.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError, Promise,
  Uint8Array, DataView, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: () => ({ style: {}, classList: { add() {} }, appendChild() {}, setAttribute() {} }) },
  navigator: { clipboard: { writeText: async () => {} } }, addEventListener() {}, toast() {},
  Capacitor: { isNativePlatform: () => false, Plugins: {} }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/dryclip.js'), 'utf8'), ctx, { filename: 'dryclip.js' });
const DC = ctx.BSDryClip;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const now = 1_800_000_000_000;
const armed = (secs) => ({ wet: true, armed: true, arming: false, secs });
const disarmed = (secs) => ({ wet: true, armed: false, arming: false, secs });

ok(DC.decideWet(armed(30), now, { ignoreUntil: now - 1000 }) === 'new', 'armed wet ~30 s late still notifies');
ok(DC.decideWet(armed(1), now, { settling: true, pairing: true }) === 'new', 'settling / pairing does not hide an armed wet');
ok(DC.decideWet(armed(2), now, { ignoreUntil: now + 2000 }) === 'ignore_window', 'only the few seconds after Arm are quiet');
ok(DC.decideWet(disarmed(5), now, {}) === 'not_armed', 'disarmed wet does not notify');
ok(DC.decideWet(armed(5), now, { armPending: true }) === 'arming', 'wet during the arm write does not notify yet');
ok(DC.POST_ARM_SUPPRESS_MS === 4000 && DC.SETTLE_ON_CONNECT_MS === 0, 'suppress is 4 s and connect does not settle-ignore');

const svc = read('android/app/src/main/java/dev/simpledl/bladdersim/dryclip/DryClipService.kt');
const proto = read('android/app/src/main/java/dev/simpledl/bladdersim/dryclip/DryClipProtocol.kt');
const plug = read('android/app/src/main/java/dev/simpledl/bladdersim/dryclip/DryClipPlugin.kt');
const js = read('js/dryclip.js');
ok(!/createBond/.test(svc) && /Bond is not required/.test(svc) && /classic pairing is optional/.test(svc), 'BOND_NONE does not block; no createBond');
ok(/connect\(dev, false\)/.test(svc) && /Trying the last MAC again/.test(svc), 'direct connect retries the last MAC when a scan would miss the clip');
ok(/postWetNotif/.test(svc) && /WET_CHANNEL/.test(svc) && /IMPORTANCE_HIGH/.test(svc), 'armed wet posts its own notification');
ok(/PRIORITY_LOW/.test(svc) && /setSilent\(true\)/.test(svc), 'background watch notification stays quiet and separate');
ok(!/at < ignoreUntil/.test(proto) && /POST_ARM_SUPPRESS_MS = 4_000L/.test(proto), 'late wet time is not treated as settling');
ok(/fun testWet/.test(plug) && /id="dcTestWet"/.test(js) && /function testWet/.test(js), 'Test wet is on the DryClip panel');
ok(/clipboard\.writeText/.test(js) && /dcExport/.test(js), 'Export log still copies to the clipboard');
ok(DC.KEY === 'bs_dryclip_v1', 'storage key unchanged');
ok(read('android/app/build.gradle').includes('versionName "43"') && read('android/app/build.gradle').includes('versionCode 43'), 'version 43');
ok(read('js/whats-new-data.js').includes("hash: 'v43'"), "What's New v43");

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
