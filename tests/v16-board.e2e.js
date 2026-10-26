// v16 e2e: Path tab, SVG board, dice roll + token animation, event sheet, quiz hub cards, campaign feeds, bed drinks. Serve repo on :8765.
const puppeteer = require('puppeteer-core');
let fails = 0; const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
const sl = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle0' }); await sl(1000);
  const hide = () => page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; });
  await page.evaluate(() => { localStorage.setItem('profileMode', 'babysitter'); localStorage.removeItem('bs_path_v1'); }); await page.reload({ waitUntil: 'networkidle0' }); await sl(1000); await hide();
  // v17: Path board checks moved to tests/v17-board.e2e.js
  await page.evaluate(() => switchTab('profiles')); await sl(300);
  const qh = await page.evaluate(() => ({ n: Object.keys(BSQuizPlus.QUIZZES).filter(id => document.querySelector('.quiz-hub-card[data-qcard="' + id + '"]')).length, total: document.querySelectorAll('.quiz-hub-card').length, imp: document.querySelectorAll('.qh-imp').length }));
  check('Quiz hub: 9 new quiz cards with impacts', qh.n === 9 && qh.imp === qh.total, JSON.stringify(qh));
  await page.evaluate(() => document.querySelector('[data-qp="thisorthat"]').click()); await sl(200);
  check('This-or-That shows a pair + timer', await page.evaluate(() => !!document.querySelector('.qp-pair') && !!document.getElementById('qpT')));
  await page.screenshot({ path: '/workspace/v16-quiz-thisorthat.png' });
  for (let i = 0; i < 14; i++) { await page.evaluate(() => { const b = document.querySelector('[data-p="a"]'); if (b) b.click(); }); await sl(40); }
  check('This-or-That result saved', await page.evaluate(() => !!BSQuizPlus.result('thisorthat') && !!document.getElementById('qpResult')));
  await page.evaluate(() => document.getElementById('qpDone').click());
  await page.evaluate(() => { BSCampaign.start({}); renderCampaign(); }); await sl(300);
  check('Campaign shows quiz feed toggles', await page.evaluate(() => document.querySelectorAll('#cfFeeds [data-feed]').length === 13));
  await page.evaluate(() => { switchTab('session'); document.getElementById('hubNights').open = true; document.getElementById('btnNaturalNight').click(); }); await sl(300);
  await page.evaluate(() => document.getElementById('bdOpen').click()); await sl(100);
  await page.evaluate(() => document.querySelector('[data-th="1"]').click()); await sl(100);
  const bd = await page.evaluate(() => document.getElementById('bdSug').textContent);
  check('Natural Night pre-bed drinks check-in ends with pee before bed', /Pee before bed\.$/.test(bd), bd);
  await page.screenshot({ path: '/workspace/v16-night-drinks.png' });
  check('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
