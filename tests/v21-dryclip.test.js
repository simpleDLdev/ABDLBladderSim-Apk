// v21: night-total sat, wake attach, no per-event sat on morning confirm; daytime watch; wear; bat low
const fs = require('fs'), vm = require('vm');
const store = {};
const created = [];
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError,
  Uint8Array, DataView, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: {
    addEventListener() {}, getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    body: { appendChild(n) { created.push(n); }, classList: { contains: () => false } },
    createElement: () => ({ style: {}, className: '', innerHTML: '', classList: { add() {}, toggle() {}, remove() {}, contains: () => false },
      appendChild() {}, remove() {}, querySelector() { return null; }, querySelectorAll: () => [],
      addEventListener() {}, setAttribute() {}, getAttribute: () => null, onclick: null })
  },
  navigator: {}, addEventListener() {}, dispatchEvent() {}, toast() {},
  Capacitor: { isNativePlatform: () => false, Plugins: {} }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['calendar.js', 'dryclip.js']) {
  vm.runInContext(fs.readFileSync(__dirname + '/../js/' + f, 'utf8'), ctx, { filename: f });
}
const Cal = ctx.BSCalendar, DC = ctx.BSDryClip;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

(async () => {
  ok(typeof DC.openWakeCheckIn === 'function', 'openWakeCheckIn exported');
  ok(typeof Cal.attachWakeToFlags === 'function', 'attachWakeToFlags');
  ok(typeof Cal.setClipNightTotalSat === 'function', 'setClipNightTotalSat');

  store['bs_calendar_v2'] = JSON.stringify({ schema: 5, entries: [] });
  Cal._resetCache();
  const sim = await DC.simulateNight();
  ok(!!sim, 'simulateNight');
  const flags = Cal.unconfirmedClipFlags();
  ok(flags.length === 2, '2 flags');

  // Morning confirm WITHOUT saturation → accident has no sat
  const id1 = flags[0].id;
  const conf = Cal.confirmClipFlag(id1, { severity: 'wet' });
  ok(conf && conf.type === 'accident', 'confirm → accident');
  ok(conf.saturation == null, 'no invented per-event sat (got ' + conf.saturation + ')');

  // Wake attach puts sat on remaining flag
  const left = Cal.unconfirmedClipFlags()[0];
  Cal.attachWakeToFlags({ severity: 'damp', saturation: 35, pantsWet: true, count: 1 });
  const enriched = Cal.load().entries.find(e => e.id === left.id);
  ok(enriched && enriched.saturation === 35, 'wake sat attached');
  ok(enriched.clip && enriched.clip.pantsWet === true && enriched.clip.wakeReviewed, 'pants + wakeReviewed');

  // Confirm keeps wake sat
  const conf2 = Cal.confirmClipFlag(left.id, { severity: 'damp', saturation: enriched.saturation });
  ok(conf2 && conf2.saturation === 35 && conf2.type === 'leak', 'confirm keeps wake sat → leak');

  // Night total sat
  store['bs_calendar_v2'] = JSON.stringify({ schema: 5, entries: [] });
  Cal._resetCache();
  await DC.simulateNight();
  const nid = DC.load().night.id;
  Cal.setClipNightTotalSat(nid, 70);
  const withTotal = Cal.load().entries.filter(e => e.clip && e.clip.nightTotalSat === 70);
  ok(withTotal.length >= 2, 'night total sat on flags');
  const st = Cal.computeStats();
  ok(st.clipNightTotalSats && st.clipNightTotalSats.avg === 70, 'stats avg night total');

  // Wear timer
  await DC.arm();
  ok(DC.load().wearStartedAt != null, 'wear started on arm');
  ok(DC.wearMinutes() != null && DC.wearMinutes() >= 0, 'wearMinutes');

  // Battery low
  DC.load(); // ensure
  store[DC.KEY] = JSON.stringify(Object.assign(DC.load(), { batLowNotified: false, batLowPct: 20 }));
  DC.checkBatteryLow(15);
  ok(DC.load().batLowNotified === true, 'bat low flagged');

  // Daytime watch mode stored
  const d = DC.load(); d.daytimeWatch = true; d.wearingTonight = false; DC.save(d);
  ok(DC.load().daytimeWatch === true, 'daytimeWatch setting');

  // Morning sheet has night sat field, not per-row sat
  created.length = 0;
  await DC.simulateNight();
  const sheet = created.find(n => (n.className || '').includes('dc-morning'));
  ok(!!sheet, 'morning sheet');
  ok(/dcNightSat|Total saturation/i.test(sheet.innerHTML || ''), 'night total sat field');
  ok(!/data-sat/.test(sheet.innerHTML || ''), 'no per-event sat inputs');

  console.log(fail ? `\n${fail} FAILED` : '\nAll v21 DryClip tests passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
