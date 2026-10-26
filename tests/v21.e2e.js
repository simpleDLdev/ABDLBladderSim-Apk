// v21 e2e: night-total sat morning, wake check-in, daytime watch, wear. Serve :8765
const puppeteer = require('puppeteer-core');
let fails = 0; const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
const sl = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle0' }); await sl(700);
  await page.evaluate(() => { ['bs_dryclip_v1', 'bs_calendar_v2', 'bs_natural_night'].forEach(k => localStorage.removeItem(k)); });
  await page.reload({ waitUntil: 'networkidle0' }); await sl(800);
  const clean = () => page.evaluate(() => {
    if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal();
    const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none';
  });
  await clean();

  await page.evaluate(() => switchTab('settings')); await sl(300);
  await page.evaluate(() => {
    const d = document.getElementById('setData'); if (d) d.open = true;
    const c = document.getElementById('setDryClip'); if (c) { c.open = true; c.scrollIntoView(); }
    BSDryClip.renderLab();
  }); await sl(250);
  const lab = await page.evaluate(() => ({
    day: !!document.getElementById('dcDay'), bat: !!document.getElementById('dcBatLow'), sim: !!document.getElementById('dcSimNight')
  }));
  check('Lab has daytime watch + bat low + simulate', lab.day && lab.bat && lab.sim, JSON.stringify(lab));
  await page.screenshot({ path: '/workspace/v21-dryclip-lab.png' });

  await page.evaluate(async () => { BSDryClip.mockEnable(true); await BSDryClip.connect('MOCK'); await BSDryClip.simulateNight(); });
  await sl(500);
  const morning = await page.evaluate(() => {
    const w = document.querySelector('.dc-morning');
    return {
      open: !!w,
      nightSat: !!(w && w.querySelector('#dcNightSat')),
      perSat: !!(w && w.querySelector('[data-sat]')),
      rows: w ? w.querySelectorAll('[data-id]').length : 0,
      text: w && w.textContent.slice(0, 200)
    };
  });
  check('Morning: night total sat, no per-event sat, 2 rows', morning.open && morning.nightSat && !morning.perSat && morning.rows === 2, JSON.stringify(morning));
  await page.screenshot({ path: '/workspace/v21-morning-total-sat.png' });

  await page.evaluate(() => {
    const w = document.querySelector('.dc-morning');
    w.querySelector('#dcNightSat').value = '55';
    const row = w.querySelector('[data-id]');
    row.querySelector('[data-sev]').value = 'wet';
    row.querySelector('[data-confirm]').click();
  }); await sl(250);
  const after = await page.evaluate(() => {
    const acc = BSCalendar.load().entries.find(e => e.type === 'accident' && e.confirmed);
    const night = BSDryClip.load().night;
    const totals = BSCalendar.load().entries.filter(e => e.clip && e.clip.nightTotalSat === 55).length;
    return { sat: acc && acc.saturation, totalOnFlags: totals, nightTotal: night && night.totalSat };
  });
  check('Confirm leaves per-event sat blank; night total 55 stored', after.sat == null && after.totalOnFlags >= 1 && after.nightTotal === 55, JSON.stringify(after));

  // Wake check-in
  await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').forEach(n => n.remove()); });
  await page.evaluate(async () => {
    await BSDryClip.simulateNight();
    BSDryClip.openWakeCheckIn();
  }); await sl(300);
  const wake = await page.evaluate(() => {
    const w = document.querySelector('.dc-wake');
    return { open: !!w, hasSat: !!(w && w.querySelector('#dcWakeSat')), hasPants: !!(w && w.querySelector('#dcWakePants')) };
  });
  check('Wake check-in sheet', wake.open && wake.hasSat && wake.hasPants, JSON.stringify(wake));
  await page.screenshot({ path: '/workspace/v21-wake-checkin.png' });
  await page.evaluate(() => {
    const w = document.querySelector('.dc-wake');
    w.querySelector('#dcWakeSat').value = '40';
    w.querySelector('#dcWakePants').value = '1';
    w.querySelector('[data-save]').click();
  }); await sl(200);
  const wakeSaved = await page.evaluate(() => {
    const f = BSCalendar.unconfirmedClipFlags().find(e => e.clip && e.clip.wakeReviewed);
    return !!(f && f.saturation === 40 && f.clip.pantsWet === true);
  });
  check('Wake notes on flag', wakeSaved);

  // Daytime watch + wear
  await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').forEach(n => n.remove()); });
  await page.evaluate(async () => {
    await BSDryClip.stopNight({ skipCheckIn: true });
    const d = BSDryClip.load(); d.daytimeWatch = true; BSDryClip.save(d);
    await BSDryClip.arm();
    BSDryClip.renderLab();
  }); await sl(200);
  await page.screenshot({ path: '/workspace/v21-daytime-wear.png' });
  const wear = await page.evaluate(() => BSDryClip.wearMinutes() != null);
  check('Wear timer after arm', wear);

  const wn = await page.evaluate(() => WHATS_NEW_COMMITS.some(c => c.hash === 'v21'));
  check("What's New v21", wn);
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
