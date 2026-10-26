// v22: Edit entry — separate date/time controls, Today / Yesterday / Now chips, ±15m / ±1h nudges.
// Part A (vm, no browser): storage + stats when an entry moves from yesterday to today.
// Part B (headless Chrome, self-served): the real Edit entry modal. Run: node tests/v22-edit-time.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), http = require('http');
let fail = 0; const ok = (c, m, i) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (!c && i ? ' — ' + i : '')); if (!c) fail++; };
const DAY = 864e5;
const at = (dayOffset, h, m) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.getTime(); };

// ---------- Part A ----------
function partA() {
  const store = {};
  const ctx = {
    console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String, Boolean, RegExp, Error, TypeError,
    setTimeout, clearTimeout,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {}, classList: { contains: () => false } }, createElement: () => ({}) },
    navigator: {}, addEventListener() {}, toast() {}
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/calendar.js'), 'utf8'), ctx, { filename: 'calendar.js' });
  const C = ctx.BSCalendar;
  const yK = C.dayKey(at(-1, 12, 0)), tK = C.dayKey(at(0, 12, 0));

  ok(C.combineLocal('2026-10-19', '10:39') === new Date(2026, 9, 19, 10, 39).getTime(), 'combineLocal builds a local timestamp');
  ok(isNaN(C.combineLocal('', '10:39')) && isNaN(C.combineLocal('2026-10-19', '')) && isNaN(C.combineLocal('2026-02-31', '10:00')), 'combineLocal rejects empty / impossible values');
  ok(C.dayKey(C.moveToDay(at(-1, 10, 39), tK)) === tK && new Date(C.moveToDay(at(-1, 10, 39), tK)).getHours() === 10, 'moveToDay keeps the clock time');

  store['bs_calendar_v2'] = JSON.stringify({ schema: 5, entries: [] }); C._resetCache();
  const acc = C.addEntry({ type: 'accident', source: 'natural', ts: at(-1, 10, 39), severity: 'soaked', protection: 'pad', leaked: false, awareness: 'felt' });
  C.addEntry({ type: 'night', source: 'natural', ts: at(-2, 8, 0), night: { wet: false, protected: true, protection: 'pad' } });
  const wetN = C.addEntry({ type: 'night', source: 'natural', ts: at(-1, 8, 0), night: { wet: true, protected: true, protection: 'pad', nn: { bedtime: at(-2, 22, 0), riseAt: at(-1, 7, 30), timeline: [{ k: 'wake', ts: at(-1, 3, 0) }] } } });
  ok(C.computeStats().dryStreak === 0, 'before: wet night yesterday → streak 0');
  const moved = C.updateEntry(acc.id, { ts: C.moveToDay(acc.ts, tK) });
  const ents = C.load().entries;
  ok(moved && C.dayKey(moved.ts) === tK, 'accident moved from yesterday to today');
  ok(!ents.some(e => e.type === 'accident' && C.dayKey(e.ts) === yK), 'yesterday no longer has the accident');
  ok(ents.filter(e => e.type === 'accident').length === 1, 'no duplicate left behind');
  ok(moved.severity === 'soaked' && moved.protection === 'pad' && moved.awareness === 'felt' && moved.leaked === false, 'other fields kept');
  ok(JSON.parse(store['bs_calendar_v2']).entries.find(e => e.id === acc.id).ts === moved.ts, 'stored under bs_calendar_v2 with the new time');
  // night moved yesterday → today: yesterday falls back to "not logged", streak counts from today
  const nn2 = C.shiftNN(wetN.night.nn, DAY);
  C.updateEntry(wetN.id, { ts: wetN.ts + DAY, night: Object.assign({}, wetN.night, { nn: nn2 }) });
  const st = C.computeStats();
  ok(st.dryStreak === 0 && st.wetNightsThisWeek === 1, 'night moved to today: still 1 wet night this week, today wet → streak 0', JSON.stringify({ s: st.dryStreak, w: st.wetNightsThisWeek }));
  const n3 = C.load().entries.find(e => e.id === wetN.id);
  ok(n3.night.nn && n3.night.nn.timeline[0].ts === at(0, 3, 0) && n3.night.nn.riseAt === at(0, 7, 30), 'Natural Night timeline moves with the night');
  C.updateEntry(wetN.id, { night: Object.assign({}, n3.night, { wet: false }) });
  ok(C.computeStats().dryStreak === 1, 'yesterday empty after the move → streak counts today only (1)', C.computeStats().dryStreak);
}

// ---------- Part B ----------
function serve(root) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv)));
}
async function partB() {
  let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { console.log('SKIP browser part (puppeteer-core not installed)'); return; }
  const srv = await serve(path.join(__dirname, '..'));
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));
    const r = await page.evaluate(async (A) => {
      const sl = ms => new Promise(x => setTimeout(x, ms));
      const C = BSCalendar, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
      try { hideWhatsNewModal(); } catch (e) {}
      const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none';
      C.wipe(); switchTab('calendar'); await sl(200);
      const out = {};
      const yK = C.dayKey(A.y1039), tK = C.dayKey(A.t1039);
      const e = C.addEntry({ type: 'accident', source: 'natural', ts: A.y1039, severity: 'soaked', protection: 'pad', leaked: false, awareness: 'felt' });
      $(`[data-day="${yK}"]`).click(); await sl(100);
      $(`[data-edit="${e.id}"]`).click(); await sl(100);
      out.title = $('.cal-sheet h3').textContent;
      out.controls = { date: $('#fTsDate') && $('#fTsDate').type, time: $('#fTsTime') && $('#fTsTime').type, oldCombined: !!$('input[type=datetime-local]') };
      out.before = { date: $('#fTsDate').value, time: $('#fTsTime').value, yOn: $('[data-dt=yday]').classList.contains('on') };
      out.chips = $$('.cal-sheet [data-dt]').map(b => b.textContent);
      $('[data-dt=today]').click(); await sl(50);
      out.afterToday = { date: $('#fTsDate').value, time: $('#fTsTime').value, read: $('#fTsRead').textContent, tOn: $('[data-dt=today]').classList.contains('on') };
      $('.cal-sheet [data-s]').click(); await sl(200);
      const e2 = C.load().entries.find(x => x.id === e.id);
      out.saved = { ts: e2.ts, sev: e2.severity, prot: e2.protection, aware: e2.awareness, urg: e2.urgency, sat: e2.saturation, n: C.load().entries.length };
      out.selected = $('#calDayDetail h3').textContent;
      out.todayCell = $(`[data-day="${tK}"] .ic`).textContent; out.yCell = $(`[data-day="${yK}"] .ic`).textContent;
      $(`[data-day="${yK}"]`).click(); await sl(100);
      out.yDetail = $('#calDayDetail').textContent.includes('No entries for this day');
      // nudges: +15m, −1h, −15m from 10:39 → 09:39; +1h → 10:39 back; Now
      $(`[data-day="${tK}"]`).click(); await sl(100);
      $(`[data-edit="${e.id}"]`).click(); await sl(100);
      $('[data-dt="15"]').click(); $('[data-dt="-60"]').click(); $('[data-dt="-15"]').click();
      out.nudge = $('#fTsTime').value;
      $('[data-dt="60"]').click(); out.nudge2 = $('#fTsTime').value;
      $('[data-dt=now]').click(); out.nowDate = $('#fTsDate').value; out.nowTime = $('#fTsTime').value;
      // empty date → save blocked, nothing changes
      $('#fTsDate').value = ''; $('#fTsDate').dispatchEvent(new Event('input'));
      $('.cal-sheet [data-s]').click(); await sl(100);
      out.blocked = { open: !!$('.cal-sheet #fTsDate'), ts: C.load().entries.find(x => x.id === e.id).ts };
      $('.cal-sheet [data-x]').click(); await sl(50);
      // crossing midnight with a nudge changes the date
      const late = C.addEntry({ type: 'potty', source: 'natural', ts: A.t0005 });
      $(`[data-edit="${late.id}"]`).click(); await sl(100);
      $('[data-dt="-15"]').click(); out.midnight = { date: $('#fTsDate').value, time: $('#fTsTime').value };
      $('.cal-sheet [data-x]').click(); C.deleteEntry(late.id);
      // quick "Log accident" opens on today even with yesterday selected
      $(`[data-day="${yK}"]`).click(); await sl(100);
      $('[data-act=addacc]').click(); await sl(100);
      out.quick = { title: $('.cal-sheet h3').textContent, date: $('#fTsDate').value, noClipType: !$$('#fType option').some(o => o.value === 'clip_flag') };
      $('.cal-sheet [data-x]').click();
      // "Add entry here" still uses the selected day
      $('#calDayDetail [data-dact=add]').click(); await sl(100);
      out.addHere = $('#fTsDate').value; $('.cal-sheet [data-x]').click();
      // DryClip flag: own form, keeps type / severity / blank saturation
      const f = C.addEntry({ type: 'clip_flag', source: 'natural', mode: 'dryclip_night', ts: A.t0310, severity: 'wet', confirmed: false, clip: { kind: 'wet', idx: 2, nightId: 'n1' } });
      $(`[data-day="${tK}"]`).click(); await sl(100);
      $(`[data-edit="${f.id}"]`).click(); await sl(100);
      out.flagForm = { title: $('.cal-sheet h3').textContent, hasType: !!$('.cal-sheet #fType'), sev: (document.querySelector('input[name=cfSev]:checked') || {}).value };
      $('[data-dt=yday]').click(); $('.cal-sheet [data-s]').click(); await sl(150);
      const f2 = C.load().entries.find(x => x.id === f.id);
      out.flag = { type: f2.type, day: C.dayKey(f2.ts), hm: new Date(f2.ts).getHours() + ':' + new Date(f2.ts).getMinutes(), sev: f2.severity, sat: f2.saturation, confirmed: f2.confirmed, idx: f2.clip.idx, review: (f2.tags || []).includes('needs-review'), unconf: C.unconfirmedClipCount() };
      // Natural Night via check-in: Today chip moves it, timeline kept + shifted, "Keep both?" not asked for its own day
      const nn = C.addEntry({ type: 'night', source: 'natural', ts: A.y0800, night: { wet: true, protected: true, protection: 'pad', remembered: 'no', nn: { bedtime: A.y0800 - 10 * 36e5, riseAt: A.y0800, timeline: [{ k: 'wake', ts: A.y0800 - 4 * 36e5 }] } } });
      openNightCheckin({ entry: C.load().entries.find(x => x.id === nn.id) }); await sl(100);
      out.nightPicker = !!$('#ncTsDate') && !!$('#ncTsTime');
      $('[data-dt=today]').click(); $('.cal-sheet [data-s]').click(); await sl(150);
      const nn2 = C.load().entries.find(x => x.id === nn.id);
      out.night = { day: C.dayKey(nn2.ts), nn: !!nn2.night.nn, rise: nn2.night.nn && nn2.night.nn.riseAt, wake: nn2.night.nn && nn2.night.nn.timeline[0].ts, rem: nn2.night.remembered, streak: C.computeStats().dryStreak, wetWeek: C.computeStats().wetNightsThisWeek };
      out.wn = WHATS_NEW_COMMITS[0].hash;
      out.storageKeys = Object.keys(localStorage).filter(k => k.startsWith('bs_calendar'));
      return out;
    }, { y1039: at(-1, 10, 39), t1039: at(0, 10, 39), t0005: at(0, 0, 5), t0310: at(0, 3, 10), y0800: at(-1, 8, 0) });
    const dk = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const tK = dk(at(0, 12, 0)), yK = dk(at(-1, 12, 0));
    ok(r.title.includes('Edit entry'), 'Edit entry modal opens');
    ok(r.controls.date === 'date' && r.controls.time === 'time' && !r.controls.oldCombined, 'separate date + time controls (no combined field)', JSON.stringify(r.controls));
    ok(r.before.date === yK && r.before.time === '10:39' && r.before.yOn, 'starts on yesterday 10:39, Yesterday chip lit', JSON.stringify(r.before));
    ok(['Today', 'Yesterday', 'Now', '−1h', '−15m', '+15m', '+1h'].every(c => r.chips.includes(c)), 'chips: Today / Yesterday / Now / −1h / −15m / +15m / +1h', r.chips.join(','));
    ok(r.afterToday.date === tK && r.afterToday.time === '10:39' && r.afterToday.tOn && /^Today/.test(r.afterToday.read), 'Today keeps 10:39 and moves the date', JSON.stringify(r.afterToday));
    ok(r.saved.ts === at(0, 10, 39) && r.saved.n === 1, 'Save stores today 10:39, no duplicate', JSON.stringify(r.saved));
    ok(r.saved.sev === 'soaked' && r.saved.prot === 'pad' && r.saved.aware === 'felt', 'severity / protection / awareness kept');
    ok(r.saved.urg === undefined && r.saved.sat === undefined, 'untouched urgency / saturation stay blank (not written as 0)', JSON.stringify(r.saved));
    ok(r.selected === new Date(tK + 'T12:00:00').toDateString(), 'calendar jumps to the new day', r.selected);
    ok(r.todayCell.includes('💦1') && !r.yCell.includes('💦'), 'today cell shows the accident, yesterday cell does not', JSON.stringify([r.todayCell, r.yCell]));
    ok(r.yDetail, 'yesterday day detail is empty');
    ok(r.nudge === '09:39' && r.nudge2 === '10:39', '+15m −1h −15m → 09:39; +1h → 10:39', r.nudge + ' ' + r.nudge2);
    const nowD = new Date(); ok(r.nowDate === tK && Math.abs((+r.nowTime.slice(0, 2) * 60 + +r.nowTime.slice(3)) - (nowD.getHours() * 60 + nowD.getMinutes())) <= 1, 'Now sets today + current time', r.nowDate + ' ' + r.nowTime);
    ok(r.blocked.open && r.blocked.ts === at(0, 10, 39), 'empty date: Save is blocked and the time is not replaced with "now"', JSON.stringify(r.blocked));
    ok(r.midnight.date === yK && r.midnight.time === '23:50', '−15m at 00:05 → yesterday 23:50', JSON.stringify(r.midnight));
    ok(r.quick.title.includes('New entry') && r.quick.date === tK && r.quick.noClipType, 'quick Log accident opens on today (yesterday selected); no clip-flag type offered', JSON.stringify(r.quick));
    ok(r.addHere === yK, '"Add entry here" still uses the selected day', r.addHere);
    ok(r.flagForm.title.includes('clip flag') && !r.flagForm.hasType && r.flagForm.sev === 'wet', 'clip flag opens its own form (no type switch, severity shown)', JSON.stringify(r.flagForm));
    ok(r.flag.type === 'clip_flag' && r.flag.day === yK && r.flag.hm === '3:10' && r.flag.sev === 'wet' && r.flag.sat === undefined && r.flag.confirmed === false && r.flag.idx === 2 && r.flag.review && r.flag.unconf === 1,
      'clip flag moved to yesterday 03:10, still unconfirmed, severity kept, saturation blank', JSON.stringify(r.flag));
    ok(r.nightPicker, 'night check-in uses the same picker');
    ok(r.night.day === tK && r.night.nn && r.night.rise === at(0, 8, 0) && r.night.wake === at(0, 4, 0) && r.night.rem === 'no', 'night moved to today keeps its Natural Night timeline (shifted) and "remembered"', JSON.stringify(r.night));
    ok(r.night.streak === 0 && r.night.wetWeek === 1, 'stats recomputed after the night move', JSON.stringify(r.night));
    ok(JSON.stringify(r.storageKeys.sort()) === JSON.stringify(['bs_calendar_settings', 'bs_calendar_v2'].filter(k => r.storageKeys.includes(k)).sort()) && r.storageKeys.includes('bs_calendar_v2'), 'storage keys unchanged (bs_calendar_v2)', r.storageKeys.join(','));
    ok(r.wn === 'v22', "What's New starts with v22", r.wn);
    ok(!errs.length, 'no page errors', errs.join(' | '));
  } finally { await browser.close(); srv.close(); }
}

(async () => {
  partA();
  await partB();
  console.log(fail ? `${fail} FAIL` : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
