// v18 e2e: urgency slider kept, campaign stepper, symptom picker/defs, quiz hub sections, calibration methods, feature square. Serve repo on :8765.
const puppeteer = require('puppeteer-core');
let fails = 0; const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
const sl = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle0' }); await sl(800);
  await page.evaluate(() => { ['bs_path_v1', 'bs_symptoms_v1', 'bs_calib_plus_v1'].forEach(k => localStorage.removeItem(k)); }); await page.reload({ waitUntil: 'networkidle0' }); await sl(1000);
  const clean = () => page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()); });
  await clean();
  // 1. urgency slider bug
  await page.evaluate(() => { BSSimpleUrge.saveSettings({ askUrgency: true, lastUrgency: null }); switchTab('urge'); }); await sl(300);
  await page.evaluate(() => { const u = document.getElementById('suU'); u.value = 8; u.dispatchEvent(new Event('input')); switchTab('session'); switchTab('urge'); }); await sl(300);
  const kept = await page.evaluate(() => ({ v: document.getElementById('suU').value, set: document.getElementById('suU').dataset.set }));
  check('slider value survives a re-render (was reset to 5)', kept.v === '8' && kept.set === '1', JSON.stringify(kept));
  await page.evaluate(() => document.getElementById('suGo').click()); await sl(400); await clean();
  const used = await page.evaluate(() => ({ u: (BSSimpleUrge.state().last || {}).urgency, v: (switchTab('urge'), document.getElementById('suU').value) }));
  check('press uses the slider value and keeps it afterwards', used.u === 8 && used.v === '8', JSON.stringify(used));
  await page.screenshot({ path: '/workspace/v18-urge-slider.png' }); await clean();
  // 2. campaign stepper
  await page.evaluate(() => { switchTab('profiles'); openCampaignSetup(); }); await sl(300);
  const c1 = await page.evaluate(() => ({ prog: !!document.querySelector('#cpSetup .quiz-progress'), opts: document.querySelectorAll('#cpSetup [data-cq]').length, sel: document.querySelectorAll('#cpSetup select').length, skip: !!document.getElementById('cqSkip') }));
  check('campaign quiz: one question per screen, progress bar, no dropdowns, Skip on screen', c1.prog && c1.opts === 3 && c1.sel === 0 && c1.skip, JSON.stringify(c1));
  await page.screenshot({ path: '/workspace/v18-campaign-step.png' });
  for (let k = 0; k < 7; k++) { await page.evaluate(() => { const b = document.querySelector('#cpSetup [data-cq]'); if (b) b.click(); }); await sl(80); }
  const c2 = await page.evaluate(() => ({ start: !!document.getElementById('cqStart'), txt: document.querySelector('#cpSetup .cal-legend').textContent }));
  check('stepper reaches the review screen', c2.start, JSON.stringify(c2));
  await page.screenshot({ path: '/workspace/v18-campaign-review.png' }); await clean();
  // 3. quiz hub sections + symptom picker
  await page.evaluate(() => { switchTab('profiles'); if (window.renderMyProfile) renderMyProfile(); }); await sl(500);
  const hub = await page.evaluate(() => ({ secs: [...document.querySelectorAll('#qzSections .qz-section')].map(s => s.dataset.sec + ':' + s.querySelectorAll('.quiz-hub-card').length), merged: document.querySelectorAll('#qzMerged .quiz-hub-card').length, sym: !!document.getElementById('qzSym') }));
  check('quiz hub grouped into 6 sections, duplicates merged, symptom picker card', hub.secs.length === 6 && hub.merged === 4 && hub.sym, JSON.stringify(hub));
  await page.evaluate(() => document.getElementById('qzSections').scrollIntoView()); await page.screenshot({ path: '/workspace/v18-quiz-hub.png' });
  await page.evaluate(() => document.getElementById('qzSym').click()); await sl(200);
  const sp = await page.evaluate(() => ({ opts: [...document.querySelectorAll('#sdP [data-v]')].map(b => b.dataset.v).join(','), def: /What it is/.test(document.querySelector('#sdP .qz-help').textContent) }));
  check('symptom picker: Yes / Maybe / No with inline definition', sp.opts === 'yes,maybe,no' && sp.def, JSON.stringify(sp));
  await page.screenshot({ path: '/workspace/v18-symptom-picker.png' });
  await page.evaluate(async () => { const pick = ['yes', 'maybe', 'no']; for (let k = 0; k < BSSymptoms.SYMPTOMS.length; k++) { document.querySelector(`#sdP [data-v="${pick[k % 3]}"]`).click(); } document.getElementById('sdSave').click(); }); await sl(300);
  const sv = await page.evaluate(() => ({ n: BSSymptoms.SYMPTOMS.length, p: Object.keys(BSSymptoms.load().prefs).length, oab: BSQuizPlus.load().flags.oab, act: JSON.parse(localStorage.getItem('activeSymptoms') || '[]') }));
  check('picker saves prefs and applies today\'s flags', sv.p === sv.n && sv.oab === true && sv.act.includes('overactive_bladder'), JSON.stringify(sv));
  await clean(); await page.evaluate(() => BSSymptoms.openDefs()); await sl(200);
  check('definitions page lists every symptom and curse', await page.evaluate(() => document.querySelectorAll('.sym-def').length === BSSymptoms.DEFS.length));
  await page.screenshot({ path: '/workspace/v18-symptom-defs.png' }); await clean();
  // 4. calibration
  await page.evaluate(() => switchTab('settings')); await sl(400);
  const cal = await page.evaluate(() => ({ m: !!document.getElementById('calibPlusMount'), n: document.querySelectorAll('#calibPlusMount .camp-goal').length }));
  check('Settings › Calibration shows 6 methods', cal.m && cal.n === 6, JSON.stringify(cal));
  await page.evaluate(() => { document.getElementById('cpHoldGo').click(); }); await sl(300);
  const hr = await page.evaluate(() => !!document.getElementById('cpHoldReal')); await page.evaluate(() => document.getElementById('cpHoldReal').click()); await sl(200);
  check('hold test runs and Real need stops it', hr ? await page.evaluate(() => BSCalibPlus.load().holds.slice(-1)[0].reason === 'real') : false);
  await page.evaluate(() => document.getElementById('calibPlusMount').scrollIntoView()); await page.screenshot({ path: '/workspace/v18-calibration.png' }); await clean();
  // 5. feature square on the board
  await page.evaluate(() => { const b = BSPath.newBoard({ seed: 4, classId: 'bigkid', control: 85, mode: 'quiz', startStage: 2 }); const i = b.squares.findIndex((q, k) => k > b.pos && q && q.tag === 'feat'); b.squares[i] = { rules: [1], tag: 'feat' }; for (let k = b.pos + 1; k < i; k++) b.squares[k] = { rules: [1], tag: 'feat' }; BSPath.save(b); switchTab('path'); }); await sl(300);
  await page.evaluate(() => document.getElementById('ppNeed').click()); await page.waitForSelector('#ppEv', { timeout: 8000 }).catch(() => {}); await sl(200);
  const fs = await page.evaluate(() => ({ feat: !!document.querySelector('#ppEv .pp-feat'), f: (BSPath.load().pending || {}).feature }));
  check('feature square shows the app flow card', fs.feat && !!fs.f, JSON.stringify(fs));
  await page.screenshot({ path: '/workspace/v18-feature-square.png' });
  if (fs.f !== 'checkin_app') {
    await page.evaluate(() => document.getElementById('ppLaunch').click()); await sl(500); await clean(); await page.evaluate(() => { if (typeof closeVoidGuide === 'function') try { closeVoidGuide(); } catch (e) {} switchTab('path'); }); await sl(300);
    const q = await page.evaluate(() => ({ quest: !!BSPath.load().quest, banner: !!document.getElementById('ppQuest') }));
    check('launch → quest in progress with Done / Accident / Real need', q.quest && q.banner, JSON.stringify(q));
    await page.screenshot({ path: '/workspace/v18-quest.png' });
    await page.evaluate(() => document.querySelector('#ppQuest [data-q="ok"]').click()); await sl(300);
    check('finishing the quest feeds the board', await page.evaluate(() => !BSPath.load().pending && !BSPath.load().quest));
  }
  check('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
