// v19 e2e: Urge matrix content, chain, ranks, DryClip lab mock, About, pause control. Serve on :8765.
const puppeteer = require('puppeteer-core');
let fails = 0; const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
const sl = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle0' }); await sl(800);
  await page.evaluate(() => { ['bs_path_v1', 'bs_simple_urge_state', 'bs_dryclip_v1'].forEach(k => localStorage.removeItem(k)); localStorage.setItem('bs_control_v1', JSON.stringify({ value: 30 })); });
  await page.reload({ waitUntil: 'networkidle0' }); await sl(900);
  const clean = () => page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()); });
  await clean();

  // Matrix + content at Toddler / urgency 9
  const roll = await page.evaluate(() => {
    BSControl.saveSettings({ value: 30 });
    const outs = [];
    for (let i = 0; i < 40; i++) {
      const r = BSSimpleUrge.roll({ urgency: 9, profile: Object.assign({}, BSSimpleUrge.profile(), { levelKey: 'little' }), events: [] });
      outs.push({ o: r.outcome, has: !!(r.content && r.content.guide && r.content.guide.length), label: r.content && r.content.label, voice: !!r.voice });
    }
    return { go: outs.filter(x => x.o === 'go').length, wait: outs.filter(x => x.o === 'wait').length, gear: outs.filter(x => x.o === 'gear').length, withContent: outs.filter(x => x.has).length, sample: outs.find(x => x.has) };
  });
  check('Toddler @9: no potty/wait, mostly accidents with guides', roll.go === 0 && roll.wait === 0 && roll.gear >= 30 && roll.withContent >= 25, JSON.stringify(roll));

  // Early Trainer @9 potty rare
  const early = await page.evaluate(() => {
    let go = 0; for (let i = 0; i < 200; i++) { if (BSSimpleUrge.roll({ urgency: 9, profile: Object.assign({}, BSSimpleUrge.profile(), { levelKey: 'shaky' }), events: [] }).outcome === 'go') go++; }
    return go;
  });
  check('Early Trainer @9 potty ≤ 5% of 200', early <= 10, 'go=' + early);

  // Urge UI: press + chain
  await page.evaluate(() => { BSSimpleUrge.saveSettings({ askUrgency: true, lastUrgency: 9, profileId: 'little' }); BSControl.saveSettings({ value: 30 }); switchTab('urge'); });
  await sl(300);
  await page.evaluate(() => { document.getElementById('suU').value = 9; document.getElementById('suU').dispatchEvent(new Event('input')); document.getElementById('suGo').click(); });
  await sl(500); await clean();
  const ui = await page.evaluate(() => {
    const last = BSSimpleUrge.state().last;
    return { outcome: last && last.outcome, text: last && last.text, hasGuideBtn: !!document.getElementById('suGuide'), pause: !!document.querySelector('#suCantHold.pp-pause'), realNeedBig: !!(document.querySelector('.pp-real:not(.pp-pause)')) };
  });
  check('Urge result has session-style text; cant-hold is a pause control', ui.outcome && ui.text && ui.text.length > 20 && ui.pause, JSON.stringify(ui));
  await page.screenshot({ path: '/workspace/v19-urge-result.png' });

  // Ranks
  const ranks = await page.evaluate(() => ({
    n: BSRanks.RANKS.length,
    t: BSRanks.rankOfEst(30).key,
    s: BSRanks.BY.little.session,
    c: BSRanks.rankOfCampaign(4).key,
    q: BSUrgeMatrix.QUICK_HOLD.somewhat_incontinent
  }));
  check('one ladder: 6 ranks, Toddler→npt, campaign padded→little', ranks.n === 6 && ranks.t === 'little' && ranks.s === 'npt' && ranks.c === 'little', JSON.stringify(ranks));

  // About + DryClip lab
  await page.evaluate(() => switchTab('settings')); await sl(400);
  await page.evaluate(() => { const d = document.getElementById('setData'); if (d) d.open = true; const c = document.getElementById('setDryClip'); if (c) c.open = true; });
  await sl(200);
  const about = await page.evaluate(() => ({ about: !!document.getElementById('aboutBladder'), lab: !!document.getElementById('dryclipMount'), mock: !!document.getElementById('dcMock') }));
  check('Settings › About and DryClip lab present', about.about && about.lab && about.mock, JSON.stringify(about));
  await page.screenshot({ path: '/workspace/v19-about.png' });

  // Mock clip wet → accident sheet with unknown
  await page.evaluate(() => { document.getElementById('dcMock').click(); }); await sl(200);
  await page.evaluate(() => { BSDryClip.connect('MOCK'); }); await sl(200);
  await page.evaluate(() => document.getElementById('dcWet').click()); await sl(600);
  const sheet = await page.evaluate(() => {
    const w = document.getElementById('accSheet');
    const sev = w && (w.querySelector('input[name=acSev]:checked') || {}).value;
    return { open: !!w, sev, title: w && w.querySelector('h3') && w.querySelector('h3').textContent };
  });
  check('Mock wet offers accident sheet with severity unknown (not auto-saved)', sheet.open && sheet.sev === 'unknown', JSON.stringify(sheet));
  await page.screenshot({ path: '/workspace/v19-dryclip-wet.png' });
  await clean();
  await page.evaluate(() => { const d = document.getElementById('setDryClip'); if (d) { d.open = true; d.scrollIntoView(); } }); await sl(200);
  await page.screenshot({ path: '/workspace/v19-dryclip-lab.png' });

  // Path pause control
  await page.evaluate(() => { BSPath.save(null); BSPath.save(BSPath.newBoard({ seed: 3, classId: 'bigkid', control: 80 })); switchTab('path'); }); await sl(300);
  await page.evaluate(() => document.getElementById('ppNeed').click()); await page.waitForSelector('#ppEv', { timeout: 8000 }).catch(() => {}); await sl(200);
  const path = await page.evaluate(() => ({ pause: !!document.querySelector('#ppEv .pp-pause'), realBig: Array.from(document.querySelectorAll('#ppEv button')).some(b => /Real need/i.test(b.textContent)) }));
  check('Path uses ⏸ I\'m going now, not a big Real need button', path.pause && !path.realBig, JSON.stringify(path));
  await page.screenshot({ path: '/workspace/v19-path-pause.png' });

  check('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
