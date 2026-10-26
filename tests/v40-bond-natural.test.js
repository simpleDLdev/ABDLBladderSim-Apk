// v40: BLE connect does not require a classic bond; export copies the log; natural play replaces gear prompts
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global;
global.addEventListener = () => {};
global.confirm = () => true;
const copied = [];
if (typeof navigator !== 'undefined' && navigator) {
  navigator.clipboard = { writeText: async t => { copied.push(t); } };
} else {
  global.navigator = { clipboard: { writeText: async t => { copied.push(t); } } };
}
function el() {
  return { style: {}, className: '', innerHTML: '', value: '', dataset: {}, children: [],
    appendChild() {}, querySelector: () => null, querySelectorAll: () => [],
    select() {}, remove() {}, setAttribute() {}, click() {} };
}
global.document = {
  addEventListener() {}, visibilityState: 'visible',
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => el(), body: { appendChild() {} }, execCommand: () => false
};
['hub', 'calendar', 'accident', 'classes', 'control', 'campaign', 'potty-path', 'dryclip', 'simple-urge'].forEach(f => {
  require(path.join(root, 'js', f + '.js'));
});

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const svc = read('android/app/src/main/java/dev/simpledl/bladdersim/dryclip/DryClipService.kt');
const plug = read('android/app/src/main/java/dev/simpledl/bladdersim/dryclip/DryClipPlugin.kt');
const js = read('js/dryclip.js');

ok(!svc.includes('holdForUnpaired') && !svc.includes('Arm held'), 'service does not hold arm or connect for bond none');
ok(svc.includes('classic pairing is optional') && svc.includes('Connecting directly'), 'bond none is a log line, then GATT connect');
ok(!/bondNow\(\) == "none"/.test(svc), 'no bond-none branch left in the service');
ok(plug.includes('fun scanForClips') && plug.includes('startScan(null'), 'picker scans adverts, not only bonded devices');
ok(!plug.includes('setServiceUuid'), 'scan does not require the DC00 advert');
ok(js.includes('scanForClips') && js.includes("requestLEScan({ allowDuplicates: true }"), 'JS scan matches name or last MAC');
ok(js.includes('(last clip)') && !/nRF Connect/.test(js) && !/Pair it in Android/.test(js), 'help does not tell the user to re-pair');
ok(js.includes('A classic Bluetooth bond is not required'), 'copy says Forget bond is fine');

const armed = BSDryClip.nativeUiState({ running: true, conn: 'connected', bonded: 'none', armed: true, wet: false });
ok(armed.clip === 'Armed, listening' && !/pair|nRF/i.test(armed.hint || ''), 'connected + bond none still shows armed');
const looking = BSDryClip.nativeUiState({ running: true, conn: 'waiting', bonded: 'none', armed: false, wet: false });
ok(/looking for clip/.test(looking.connText) && looking.clip !== 'Not paired', 'not connected + bond none keeps looking');

const text = BSDryClip.buildExportText({ log: [{ t: 1700000000000, kind: 'conn', msg: 'Background watch on' }], settleIgnored: 1 }, 'native line one');
ok(text.includes('Background watch on') && text.includes('background watch (native'), 'export includes JS log and native section');
BSDryClip.copyExportText(text).then(how => {
  ok(how === 'clipboard' && copied[0] === text, 'copy uses the clipboard');
  ok(BSHub.NATURAL_KEY === 'bs_natural_play_v1' && !BSHub.naturalPlayOn(), 'natural play is its own key and starts off');
  ok(!store.bs_office_mode, 'office mode key is untouched');
  const lo = BSHub.naturalOfficeChoice(() => 0), hi = BSHub.naturalOfficeChoice(() => 0.999);
  ok(lo.holdMin === 1 && hi.holdMin === 20 && /restroom/.test(lo.text), 'hold choice stays inside 1–20');
  BSHub.setNaturalPlay(true);
  ok(BSHub.naturalPlayOn() && JSON.parse(store.bs_natural_play_v1).on === true, 'toggle persists on bs_natural_play_v1');
  const gear = BSPath.rule(0, 1, 'bigkid');
  ok(gear.natural && /restroom/.test(gear.t) && gear.holdChoice <= 20 && gear.k !== 'gear', 'Path gear rule becomes restroom or hold: ' + gear.t);
  BSHub.setNaturalPlay(false);
  ok(BSPath.rule(0, 1, 'bigkid').k === 'gear', 'Path gear rule is unchanged when the toggle is off');
  BSHub.setNaturalPlay(true);
  const rolled = BSSimpleUrge.roll({
    rng: () => 0,
    profile: { id: 'nat', name: 'n', levelKey: 'okay', hold: [5, 10], odds: { gear: 100, go: 0, wait: 0, hard: 0, dribble: 0 }, hiddenWait: false }
  });
  ok(rolled.outcome === 'natural' && rolled.natural.holdMin >= 1 && rolled.natural.holdMin <= 20 && !/protection|padding/i.test(rolled.text), 'gear roll becomes a restroom or hold: ' + rolled.text);
  const fu = BSSimpleUrge.followUpFor({ severity: 'leak', afterSmall: 'stay', level: 'okay', rng: () => 0.2 });
  ok(!/stay in your protection/i.test(fu.steps.join(' ')) && /restroom/.test(fu.steps.join(' ')) && fu.waitMin <= 20, 'follow-up drops the protection line');
  BSHub.setNaturalPlay(false);
  ok(read('android/app/build.gradle').includes('versionName "40"') && read('android/app/build.gradle').includes('versionCode 40'), 'version 40');
  ok(read('js/whats-new-data.js').includes("hash: 'v40'"), "What's New v40");
  const css = read('mobile.css');
  ['girl', 'boy', 'baby', 'toddler', 'teen'].forEach(id => {
    ok(css.includes('data-bs-theme="' + id + '"') && css.includes('--bs-scene') && css.includes('--bs-font') && css.includes('--card-radius'), 'skin tokens for ' + id);
  });
  ok(/bs-theme-baby[\s\S]{0,400}background-size:\s*56px/.test(css), 'baby wallpaper tiles');
  ok(css.includes('5px 5px 0 #ff7a45'), 'toddler chunky card shadow');
  ok(css.includes('font-variant: small-caps'), 'teen diary headings');
  ok(css.includes('border-left: 4px solid var(--accent2)'), 'boy sky stripe on cards');
  ok(css.includes('bs-theme-girl') && css.includes('--card-radius: 18px'), 'girl soft card radius');
  ok(read('js/hub.js').includes('bs_play_prefs_v1'), 'theme storage key unchanged');
  console.log(fail ? fail + ' FAILED' : 'ALL PASS');
  process.exit(fail ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
