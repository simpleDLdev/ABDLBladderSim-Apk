// v14 headless e2e: serve repo root on :8765 (python3 -m http.server 8765), npm i --no-save puppeteer-core, run: node tests/v14-urge.e2e.js
const puppeteer = require('puppeteer-core');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function check(name, ok, info) { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); }
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(URL, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => { localStorage.clear(); window.switchTab && window.switchTab('urge'); });
  // S7: can't hold cancels an active wait
  const r1 = await page.evaluate(() => {
    const S = window.BSSimpleUrge; S.saveSettings({ profileId: 'okay' });
    let tries = 0, res; do { const x = localStorage.getItem('bs_simple_urge_state'); localStorage.removeItem('bs_simple_urge_follow'); res = S.press(5, () => 0.3); tries++; } while (res && res.outcome !== 'wait' && tries < 40);
    // force a wait if dice never gave one
    const st = S.state(); st.last = Object.assign({}, st.last, { outcome: 'wait', closed: undefined }); st.waitUntil = Date.now() + 600000; st.fired = false; st.accFor = st.last.id; localStorage.setItem('bs_simple_urge_state', JSON.stringify(st));
    const before = !!S.pendingAlarm(); const inWait = S.inWaitState();
    document.getElementById('suCantHold').click();
    const after = S.state(); const sheet = document.getElementById('accSheet');
    const sevChecked = sheet && sheet.querySelector('input[name=acSev]:checked').value;
    sheet.querySelector('[data-x]').click(); // cancel → still logs
    const cal = window.BSCalendar.load().entries.filter(e => (e.tags || []).includes("can't hold it"));
    const f = S.followState();
    return { before, inWait, waitUntil: after.waitUntil, closed: after.last.closed, alarm: !!S.pendingAlarm(), sevChecked, logged: cal.length, fkind: f && f.kind, cascade: !!S.cascadeState(), btn: !!document.getElementById('suCantHold') };
  });
  check('cant hold: was in wait', r1.inWait && r1.before);
  check('cant hold: wait cancelled', r1.waitUntil === 0 && r1.closed === 'accident', JSON.stringify(r1));
  check('cant hold: sheet preselects major', r1.sevChecked === 'full');
  check('cant hold: always logs (cancel)', r1.logged === 1);
  check('cant hold: rest follow-up', r1.fkind === 'rest');
  check('cant hold: cascade check queued + button stays', r1.cascade && r1.btn);
  // S8: after-small followUpFor
  const r2 = await page.evaluate(() => {
    const S = window.BSSimpleUrge, o = { severity: 'leak', level: 'okay', rng: () => 0.1 };
    const k = m => S.followUpFor(Object.assign({}, o, { afterSmall: m })).kind;
    const lvl = S.followUpFor(o);
    localStorage.setItem(window.BSCampaign.KEY, JSON.stringify({ prefs: { afterAcc: 'stay' } }));
    const fromCamp = S.afterSmallPref(); S.saveSettings({ afterSmall: 'finish' }); const fromSet = S.afterSmallPref();
    return { finish: k('finish'), stay: k('stay'), wait: k('wait'), ask: k('ask'), dice: k('dice'), full: S.followUpFor({ severity: 'full', afterSmall: 'finish', level: 'okay' }).kind,
      notDone: lvl.steps.some(x => /not done/.test(x)), fromCamp, fromSet };
  });
  check('after small: modes', r2.finish === 'finish' && r2.stay === 'stay' && r2.wait === 'wait' && r2.ask === 'ask' && ['finish', 'wait', 'stay'].includes(r2.dice), JSON.stringify(r2));
  check('after small: major still rests', r2.full === 'rest');
  check('after small: level default says not done', r2.notDone);
  check('after small: campaign prefs then setting', r2.fromCamp === 'stay' && r2.fromSet === 'finish');
  // S6: don't log / reroll
  const r3 = await page.evaluate(() => {
    const S = window.BSSimpleUrge; localStorage.removeItem('bs_simple_urge_follow'); S.saveSettings({ afterSmall: '' });
    const n0 = window.BSCalendar.load().entries.length; const res = S.press(5, () => 0.5); const n1 = window.BSCalendar.load().entries.length;
    S.setLogged(false); const n2 = window.BSCalendar.load().entries.length; S.setLogged(true); const n3 = window.BSCalendar.load().entries.length;
    const chainBefore = S.state().prevChain; S.reroll(5, () => 0.5); const n4 = window.BSCalendar.load().entries.length;
    return { n0, n1, n2, n3, n4, same: S.state().prevChain === chainBefore };
  });
  check('no-log retracts / restores', r3.n1 === r3.n0 + 1 && r3.n2 === r3.n0 && r3.n3 === r3.n1, JSON.stringify(r3));
  check('reroll: no extra log, same chain', r3.n4 === r3.n1 && r3.same);
  // S9: Quick redirect + S4 + S5
  const r4 = await page.evaluate(() => {
    localStorage.removeItem('bs_simple_urge_follow'); window.switchTab('session'); window.quickModeRoll();
    const sh = document.getElementById('quickUrgSheet'); const tab = document.body.dataset.tab; sh.querySelector('[data-qu="9"]').click();
    const last = window.BSSimpleUrge.state().last;
    window.BSNatSession.start({ place: 'out' }); window.BSSimpleUrge.render();
    return { tab, quick: last.quick, u: last.urgency, nsAcc: !!document.getElementById('nsAcc'), html: document.documentElement.innerHTML.includes('Drink <b>500ml</b>') };
  });
  check('quick: opens Urge + rolls Simple Urge with urgency', r4.tab === 'urge' && r4.quick && r4.u === 9, JSON.stringify(r4));
  check('S4: no duplicate nsAcc', !r4.nsAcc);
  check('S5: no 500ml instruction', !r4.html);
  const r5 = await page.evaluate(() => typeof showHydrationAlarm);
  const src = await (await page.goto('http://127.0.0.1:8765/js/ui.js')).text();
  check('S5: Already hydrated label, no Refuse', src.includes('"Already hydrated"') && !src.includes('"Refuse"') && !src.includes('Hydration Refused'));
  check('no page errors', !errs.length, errs.join(' | '));
  await browser.close(); process.exit(fails ? 1 : 0);
})();
