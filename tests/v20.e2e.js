// v20 e2e: DryClip night → calendar flags → morning check-in → confirm. Serve on :8765.
const puppeteer = require('puppeteer-core');
let fails = 0; const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
const sl = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle0' }); await sl(800);
  await page.evaluate(() => {
    ['bs_path_v1', 'bs_simple_urge_state', 'bs_dryclip_v1', 'bs_calendar_v2'].forEach(k => localStorage.removeItem(k));
  });
  await page.reload({ waitUntil: 'networkidle0' }); await sl(900);
  const clean = () => page.evaluate(() => {
    if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal();
    const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none';
    document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove());
  });
  await clean();

  // Settings › DryClip lab with night controls
  await page.evaluate(() => switchTab('settings')); await sl(400);
  await page.evaluate(() => {
    const d = document.getElementById('setData'); if (d) d.open = true;
    const c = document.getElementById('setDryClip'); if (c) { c.open = true; c.scrollIntoView(); }
    if (window.BSDryClip) BSDryClip.renderLab();
  }); await sl(300);
  const lab = await page.evaluate(() => ({
    mount: !!document.getElementById('dryclipMount'),
    night: !!document.getElementById('dcNight'),
    sim: !!document.getElementById('dcSimNight'),
    wake: !!document.getElementById('dcWakeH'),
    mock: !!document.getElementById('dcMock')
  }));
  check('DryClip lab has night toggle, wake time, simulate night', lab.mount && lab.night && lab.sim && lab.wake && lab.mock, JSON.stringify(lab));
  await page.screenshot({ path: '/workspace/v20-dryclip-lab.png' });

  // Simulate a night → morning check-in
  await page.evaluate(() => { document.getElementById('dcMock').checked = true; BSDryClip.mockEnable(true); });
  await page.evaluate(async () => { await BSDryClip.connect('MOCK'); await BSDryClip.simulateNight(); });
  await sl(600);
  const morning = await page.evaluate(() => {
    const w = document.querySelector('.cal-sheet-wrap.dc-morning');
    const rows = w ? w.querySelectorAll('[data-id]').length : 0;
    const title = w && w.querySelector('h3') && w.querySelector('h3').textContent;
    const gap = w && /no data/i.test(w.textContent);
    const flags = BSCalendar.unconfirmedClipCount();
    return { open: !!w, rows, title, gap, flags };
  });
  check('Simulate night opens morning check-in with 2 flags + gap', morning.open && morning.rows === 2 && morning.flags === 2 && morning.gap, JSON.stringify(morning));
  await page.screenshot({ path: '/workspace/v20-morning-checkin.png' });

  // Confirm first flag
  await page.evaluate(() => {
    const row = document.querySelector('.dc-morning [data-id]');
    if (row) { row.querySelector('[data-sev]').value = 'wet'; row.querySelector('[data-sat]').value = '65'; row.querySelector('[data-confirm]').click(); }
  }); await sl(300);
  const afterConf = await page.evaluate(() => ({
    left: BSCalendar.unconfirmedClipCount(),
    accidents: BSCalendar.load().entries.filter(e => e.type === 'accident' && e.confirmed).length
  }));
  check('Confirm → 1 left, 1 accident counted', afterConf.left === 1 && afterConf.accidents === 1, JSON.stringify(afterConf));

  // Dismiss remaining
  await page.evaluate(() => {
    const btn = document.querySelector('.dc-morning [data-dismiss]');
    if (btn) btn.click();
  }); await sl(200);
  const afterDis = await page.evaluate(() => BSCalendar.unconfirmedClipCount());
  check('Dismiss clears remaining flags', afterDis === 0, 'left=' + afterDis);

  // Close check-in if still open
  await page.evaluate(() => {
    const d = document.querySelector('.dc-morning [data-done], .dc-morning [data-x]');
    if (d) d.click();
    document.querySelectorAll('.cal-sheet-wrap.dc-morning').forEach(w => w.remove());
  });

  // Calendar shows clip history / badge cleared
  await page.evaluate(() => switchTab('calendar')); await sl(400);
  const cal = await page.evaluate(() => {
    const dot = document.getElementById('calDot');
    const html = document.getElementById('calendarInline') && document.getElementById('calendarInline').innerHTML;
    return { badgeOn: dot && dot.classList.contains('on'), hasClipIcon: /📎/.test(html || ''), entries: BSCalendar.load().entries.filter(e => e.type === 'accident' || e.type === 'clip_flag').length };
  });
  check('Calendar tab badge off after resolve; entries present', !cal.badgeOn && cal.entries >= 1, JSON.stringify(cal));
  await page.screenshot({ path: '/workspace/v20-calendar-flags.png' });

  // Night mode silent: wearing tonight + wet → no accident sheet
  await page.evaluate(() => switchTab('settings')); await sl(200);
  await page.evaluate(() => { const c = document.getElementById('setDryClip'); if (c) { c.open = true; c.scrollIntoView(); } BSDryClip.renderLab(); });
  await sl(200);
  await page.evaluate(async () => {
    await BSDryClip.startNight({ wakeAt: Date.now() + 8 * 3600000, keepAwake: false });
    await BSDryClip.connect('MOCK');
  }); await sl(200);
  // Clear calendar unconfirmed from prior for cleaner count
  const beforeWet = await page.evaluate(() => BSCalendar.unconfirmedClipCount());
  await page.evaluate(() => {
    document.querySelectorAll('#accSheet, .cal-sheet-wrap').forEach(n => { if (!n.classList.contains('dc-morning')) n.remove(); });
    const w = document.getElementById('dcWet'); if (w) w.click();
  }); await sl(500);
  const silent = await page.evaluate(() => {
    const sheet = document.getElementById('accSheet');
    const flags = BSCalendar.unconfirmedClipCount();
    const night = BSDryClip.load().wearingTonight;
    return { sheetOpen: !!sheet, flags, night };
  });
  check('Night wet: silent flag, no accident sheet', silent.night && !silent.sheetOpen && silent.flags > beforeWet, JSON.stringify({ beforeWet, ...silent }));
  await page.screenshot({ path: '/workspace/v20-night-silent.png' });

  // What's New mentions v20
  const wn = await page.evaluate(() => window.WHATS_NEW_COMMITS && WHATS_NEW_COMMITS[0] && WHATS_NEW_COMMITS[0].hash === 'v20');
  check("What's New leads with v20", wn);

  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
