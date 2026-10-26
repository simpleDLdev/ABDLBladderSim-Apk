// Headless e2e: serve repo root on :8765 (python3 -m http.server 8765), npm i puppeteer-core, run: node tests/ui-calendar.e2e.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const URL = 'http://127.0.0.1:8765/index.html';
const VPS = [{ w: 360, h: 800 }, { w: 412, h: 915 }];
const TABS = ['session', 'log', 'urge', 'calendar', 'profiles', 'settings'];
fs.mkdirSync('/workspace/screens', { recursive: true });
const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); }
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  for (const vp of VPS) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('requestfailed', r => errs.push('reqfail: ' + r.url()));
    page.on('dialog', d => d.accept());
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // seed a v1 (previous build) calendar to test migration + merge of double entries
    await page.evaluateOnNewDocument(() => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const now = Date.now(), day = 864e5;
      const e = [];
      for (let i = 1; i <= 12; i++) e.push({ id: 'n' + i, ts: now - i * day, type: 'night', source: 'manual', night: { wet: i % 4 === 0, protected: true, protection: 'diapers', leaked: i === 8, urgency: 40, saturation: i % 4 === 0 ? 80 : 0 } });
      e.push({ id: 'a1', ts: now - 2 * day, type: 'micro', source: 'auto', mode: 'babysitter' });
      e.push({ id: 'a2', ts: now - 2 * day + 1000, type: 'partial', source: 'auto', mode: 'babysitter' });
      e.push({ id: 'a3', ts: now - 3 * day, type: 'accident', source: 'manual', protection: 'pullups', memo: 'old manual' });
      e.push({ id: 'a4', ts: now - 3 * day + 5000, type: 'potty', source: 'auto' });
      localStorage.setItem('bs_calendar_v1', JSON.stringify({ version: 1, entries: e }));
    });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; });
    const tag = `${vp.w}x${vp.h}`;
    for (const t of TABS) {
      await page.click(`#tabBar [data-go=${t}]`);
      await new Promise(r => setTimeout(r, 300));
      const m = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
        const small = [];
        document.querySelectorAll('.tab-page.active button, .tab-page.active select, #tabBar button').forEach(b => {
          const r = b.getBoundingClientRect(); if (!r.width || !r.height) return;
          if (getComputedStyle(b).visibility === 'hidden') return;
          if (r.height < 44 - 0.5 || r.width < 44 - 0.5) small.push((b.id || b.textContent.trim().slice(0, 24)) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
        });
        const wide = [];
        document.querySelectorAll('.tab-page.active *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > cw + 1) wide.push((el.id || el.tagName) + ':' + Math.round(r.right)); });
        const sb = document.getElementById('statusBar').getBoundingClientRect();
        return { sw, cw, small, wide: wide.slice(0, 8), sbVisible: sb.top >= 0 && sb.height > 30 };
      });
      check(`${tag} ${t}: no horizontal scroll`, m.sw <= m.cw && m.wide.length === 0, `scrollWidth ${m.sw} / ${m.cw} ${m.wide.join(',')}`);
      check(`${tag} ${t}: touch targets >=44px`, m.small.length === 0, m.small.slice(0, 10).join('; '));
      check(`${tag} ${t}: status bar visible`, m.sbVisible);
      await page.screenshot({ path: `/workspace/screens/${tag}-${t}.png`, fullPage: false });
      if (t === 'calendar' || t === 'session' || t === 'settings') await page.screenshot({ path: `/workspace/screens/${tag}-${t}-full.png`, fullPage: true });
    }
    // scroll down session tab: status bar sticks
    await page.click('#tabBar [data-go=session]');
    await page.evaluate(() => window.scrollTo(0, 1500));
    await new Promise(r => setTimeout(r, 200));
    const stickyTop = await page.evaluate(() => document.getElementById('statusBar').getBoundingClientRect().top);
    check(`${tag} status bar sticky after scroll`, stickyTop >= -1 && stickyTop < 5, 'top=' + stickyTop);
    await page.screenshot({ path: `/workspace/screens/${tag}-session-scrolled.png` });

    if (vp.w === 360) {
      // ---- calendar flows ----
      const r = await page.evaluate(() => {
        const C = window.BSCalendar; const d = C.load().entries;
        const merged = d.find(e => e.id === 'a1');
        return { n: d.length, migratedSources: d.filter(e => e.source === 'sim').length, nat: d.filter(e => e.source === 'natural').length,
          merged: merged && merged.type, a2gone: !d.find(e => e.id === 'a2'), potty: d.find(e => e.id === 'a4').source, acc: d.find(e => e.id === 'a3').source };
      });
      check('migration v1→v2 (sources, merge micro+partial)', r.merged === 'leak' && r.a2gone && r.potty === 'sim' && r.acc === 'natural' && r.n === 15, JSON.stringify(r));
      await page.click('#tabBar [data-go=calendar]');
      await page.click('[data-act=drynight]');
      await new Promise(r => setTimeout(r, 200));
      let st = await page.evaluate(() => window.BSCalendar.computeStats());
      check('one-tap dry night → streak', st.dryStreak >= 4, JSON.stringify({ s: st.dryStreak, b: st.bestDryStreak }));
      const tint = await page.evaluate(() => {
        const t = document.querySelector('.cal-cell.today'); const others = [...document.querySelectorAll('.cal-cell.dry:not(.today)')];
        return { today: getComputedStyle(t).backgroundColor, other: others.length ? getComputedStyle(others[0]).backgroundColor : null, cls: t.className };
      });
      check("today's dry tint matches other dry days", tint.today === tint.other, JSON.stringify(tint));
      // morning check-in flow via UI
      await page.click('[data-act=checkin]');
      await page.waitForSelector('.cal-sheet');
      await page.click('input[name=ncWet][value="1"]').catch(() => {});
      await page.evaluate(() => { document.querySelector('input[name=ncWet][value="1"]').click(); document.querySelector('input[name=ncSev][value=soaked]').click(); document.querySelector('input[name=ncLeak][value="1"]').click(); document.querySelector('#ncFluid').value = '300'; document.querySelector('#ncMemo').value = 'test night'; });
      await page.screenshot({ path: `/workspace/screens/${tag}-calendar-checkin.png` });
      await page.click('.cal-sheet [data-s]');
      await new Promise(r => setTimeout(r, 200));
      st = await page.evaluate(() => { const C = window.BSCalendar; const n = C.load().entries.filter(e => e.type === 'night' && e.night.fluidMl === 300); return { n: n.length, wet: n[0] && n[0].night.wet, sev: n[0] && n[0].night.severity, st: C.computeStats() }; });
      check('morning check-in edits today\'s night → wet, streak resets', st.n === 1 && st.wet && st.sev === 'soaked' && st.st.dryStreak === 0, JSON.stringify({ n: st.n, sev: st.sev, streak: st.st.dryStreak }));
      // add accident via form
      await page.click('[data-act=addacc]');
      await page.waitForSelector('#fType');
      await page.evaluate(() => { document.querySelector('input[name=fSev][value=damp]').click(); document.querySelector('input[name=fAware][value=unaware]').click(); document.querySelector('#fMemo').value = 'form test'; document.querySelector('#fTags').value = 'work, stress'; });
      await page.screenshot({ path: `/workspace/screens/${tag}-calendar-entryform.png` });
      await page.click('.cal-sheet [data-s]');
      await new Promise(r => setTimeout(r, 200));
      const acc = await page.evaluate(() => window.BSCalendar.load().entries.find(e => e.memo === 'form test'));
      check('manual accident (natural default, fields)', acc && acc.source === 'natural' && acc.severity === 'damp' && acc.awareness === 'unaware' && acc.tags.length === 2, JSON.stringify(acc));
      // edit + delete via day detail
      const editOk = await page.evaluate(async () => {
        const id = window.BSCalendar.load().entries.find(e => e.memo === 'form test').id;
        document.querySelector(`[data-edit="${id}"]`).click();
        await new Promise(r => setTimeout(r, 100));
        document.querySelector('input[name=fSrc][value=sim]').click();
        document.querySelector('.cal-sheet [data-s]').click();
        await new Promise(r => setTimeout(r, 100));
        const e1 = window.BSCalendar.load().entries.find(e => e.id === id);
        document.querySelector(`[data-del="${id}"]`).click(); // confirm auto-accepted
        await new Promise(r => setTimeout(r, 100));
        return { src: e1.source, gone: !window.BSCalendar.load().entries.find(e => e.id === id) };
      });
      check('edit entry (source→sim) and delete', editOk.src === 'sim' && editOk.gone, JSON.stringify(editOk));
      // auto-log merge: event + outcome = one entry; dedupe
      const merge = await page.evaluate(() => {
        const C = window.BSCalendar; const before = C.load().entries.length;
        C.autoLog('micro'); C.autoLog('micro'); // dedupe
        window.trackDayEvent('partial_accident');
        const after = C.load().entries.length; const last = C.load().entries.slice().sort((a, b) => b.ts - a.ts)[0];
        return { added: after - before, type: last.type, kind: last.event && last.event.kind, src: last.source };
      });
      check('sim event + leak outcome merged into one entry', merge.added === 1 && merge.type === 'leak' && merge.kind === 'micro' && merge.src === 'sim', JSON.stringify(merge));
      // sim toggle affects stats/month/day
      const tog = await page.evaluate(async () => {
        const C = window.BSCalendar; const s = C.settings();
        const withSim = C.visibleEntries().length;
        switchTab('settings'); await new Promise(r => setTimeout(r, 100));
        document.getElementById('csShowSim').click(); await new Promise(r => setTimeout(r, 100));
        const noSim = C.visibleEntries().length; const stScope = C.computeStats().scope;
        switchTab('calendar'); await new Promise(r => setTimeout(r, 100));
        const legend = document.querySelector('#tab-calendar .cal-legend').textContent;
        const simCells = [...document.querySelectorAll('.cal-cell .ic')].filter(x => x.textContent.includes('🎲')).length;
        return { withSim, noSim, stScope, hiddenNote: /hidden/.test(legend), simCells, total: C.load().entries.length };
      });
      await page.screenshot({ path: `/workspace/screens/${tag}-calendar-natural-only.png`, fullPage: true });
      check('show-sim toggle hides sim from view & stats', tog.noSim < tog.withSim && tog.stScope === 'Natural only' && tog.hiddenNote && tog.simCells === 0, JSON.stringify(tog));
      await page.evaluate(() => { const s = window.BSCalendar.settings(); s.showSim = true; s.showSimEvents = false; window.BSCalendar.saveSettings(s); });
      const sub = await page.evaluate(() => ({ scope: window.BSCalendar.computeStats().scope, ev: window.BSCalendar.visibleEntries().filter(e => e.source === 'sim' && e.type === 'event').length }));
      check('separate sim-events toggle', sub.ev === 0 && /accidents/.test(sub.scope), JSON.stringify(sub));
      await page.evaluate(() => { window.BSCalendar.saveSettings({ showSim: true, showSimEvents: true, showSimAccidents: true }); });
      // ---- export / wipe / import round trip ----
      const rt = await page.evaluate(() => {
        const C = window.BSCalendar;
        const strip = o => JSON.stringify(Object.assign({}, o, { exportedAt: null }));
        const a = C.exportObject(); const text = JSON.stringify(a);
        C.wipe(); const wiped = C.load().entries.length;
        const p = C.parseImport(text); const prev = C.previewImport(p);
        const rep = C.applyImport(p, 'merge');
        const b = C.exportObject();
        const rep2 = C.importJSONText(text, 'merge'); // all should be unchanged
        // reload from storage to make sure persisted
        C._resetCache(); const c = C.exportObject();
        const rep3 = C.importJSONText(text, 'replace');
        const d2 = C.exportObject();
        const diff = (x, y) => { const X = JSON.parse(strip(x)), Y = JSON.parse(strip(y)); if (JSON.stringify(X.settings) !== JSON.stringify(Y.settings)) return 'settings'; for (let i = 0; i < X.entries.length; i++) if (JSON.stringify(X.entries[i]) !== JSON.stringify(Y.entries[i])) return JSON.stringify(X.entries[i]) + ' VS ' + JSON.stringify(Y.entries[i]); return 'same'; };
        return { dab: diff(a, b), dac: diff(a, c), dad: diff(a, d2), schemaOk: a.app === 'bladder-sim-calendar' && a.version === 4 && !!a.exportedAt && !!a.settings, n: a.entries.length, wiped,
          prevAdded: prev.added, rep, identical: strip(a) === strip(b) && strip(a) === strip(c) && strip(a) === strip(d2), rep2, rep3 };
      });
      check('export schema {app,version,exportedAt,settings,entries}', rt.schemaOk, '');
      check('round trip export→wipe→import identical', rt.identical && rt.wiped === 0 && rt.rep.added === rt.n, JSON.stringify({ n: rt.n, rep: rt.rep, dab: rt.dab, dac: rt.dac, dad: rt.dad }));
      check('re-import merge dedupes by id', rt.rep2.added === 0 && rt.rep2.unchanged === rt.n, JSON.stringify(rt.rep2));
      const bad = await page.evaluate(() => {
        const C = window.BSCalendar; const out = [];
        for (const t of ['', 'not json', '{"foo":1}', '{"app":"other","entries":[]}', '{"app":"bladder-sim-calendar","version":99,"entries":[]}']) { try { C.parseImport(t); out.push('accepted?!'); } catch (e) { out.push(e.message); } }
        const mixed = C.parseImport(JSON.stringify({ app: 'bladder-sim-calendar', version: 2, entries: [{ id: 'x1', ts: Date.now(), type: 'leak', source: 'natural' }, { type: 'bogus', ts: 1 }, null, { id: 'x2', ts: 'abc', type: 'night' }] }));
        const before = C.load().entries.length; const rep = C.applyImport(mixed, 'merge');
        const upd = C.importJSONText(JSON.stringify({ app: 'bladder-sim-calendar', version: 2, entries: [{ id: 'x1', ts: Date.now(), type: 'leak', source: 'natural', memo: 'changed' }] }), 'merge');
        C.deleteEntry('x1');
        return { msgs: out, valid: mixed.entries.length, invalid: mixed.invalid, rep, upd, after: C.load().entries.length - before };
      });
      check('malformed imports rejected gracefully', bad.msgs.every(m => m !== 'accepted?!'), bad.msgs.join(' | '));
      check('partial-valid import: counts added/updated/skipped', bad.valid === 1 && bad.invalid === 3 && bad.rep.added === 1 && bad.upd.updated === 1, JSON.stringify({ rep: bad.rep, upd: bad.upd }));
      // import UI with file input + paste box
      const exportText = await page.evaluate(() => window.BSCalendar.exportText());
      fs.writeFileSync('/workspace/test/export.json', exportText);
      await page.click('#tabBar [data-go=calendar]');
      await page.click('[data-act=import]');
      await page.waitForSelector('#impFile');
      const fileEl = await page.$('#impFile');
      await fileEl.uploadFile('/workspace/test/export.json');
      await page.waitForFunction(() => /valid entries/.test(document.getElementById('impMsg').textContent), { timeout: 5000 });
      await page.screenshot({ path: `/workspace/screens/${tag}-calendar-import.png` });
      await page.click('.cal-sheet [data-merge]');
      await new Promise(r => setTimeout(r, 200));
      const repTxt = await page.evaluate(() => document.querySelector('.cal-sheet p') && document.querySelector('.cal-sheet p').textContent);
      check('import via <input type=file> + merge report', /0 added/.test(repTxt || ''), repTxt);
      await page.click('.cal-sheet [data-x]');
      await page.click('[data-act=import]'); await page.waitForSelector('#impText');
      await page.evaluate(() => { const t = document.getElementById('impText'); t.value = '{oops'; t.dispatchEvent(new Event('input')); });
      await page.click('.cal-sheet [data-check]');
      const em = await page.evaluate(() => document.getElementById('impMsg').textContent);
      check('paste box: malformed JSON message', /not valid JSON/.test(em), em);
      await page.click('.cal-sheet [data-x]');
      // export in browser triggers download without error
      await page.evaluate(() => window.BSCalendar.exportJSON());
      // silent: calendar code never touches audio/notification/vibrate
      const src = fs.readFileSync('/workspace/bladder-sim/js/calendar.js', 'utf8');
      check('calendar silent (no audio/notification/vibrate APIs)', !/AudioContext|new Audio\(|new Notification|navigator\.vibrate|LocalNotifications|startChime\(|playSound/.test(src));
      await page.click('#tabBar [data-go=calendar]'); await new Promise(r => setTimeout(r, 200));
      await page.screenshot({ path: `/workspace/screens/${tag}-calendar-final-full.png`, fullPage: true });
      // ---- v3: natural accident detail fields ----
      await page.click('#tabBar [data-go=calendar]');
      await page.click('[data-act=addacc]');
      await page.waitForSelector('#fUb');
      const natVis = await page.evaluate(() => {
        const vis = id => document.querySelector(id).closest('[data-for]').style.display !== 'none';
        const a = vis('#fUb') && vis('#fUa') && vis('#fRel');
        document.querySelector('input[name=fSrc][value=sim]').click(); document.querySelector('input[name=fSrc][value=sim]').dispatchEvent(new Event('change'));
        const b = !vis('#fUb');
        document.querySelector('input[name=fSrc][value=natural]').click(); document.querySelector('input[name=fSrc][value=natural]').dispatchEvent(new Event('change'));
        const lbl = document.querySelector('#fRel').closest('label').textContent;
        const set = (id, v) => { const el = document.querySelector(id); el.value = v; el.dispatchEvent(new Event('input')); };
        set('#fUb', 90); set('#fUa', 10); set('#fRel', 75);
        document.querySelector('#fMemo').value = 'nat detail';
        return { a, b, lbl, c: document.getElementById('fRelV').textContent };
      });
      check('natural accident form shows urgency before/after + % released (hidden for sim)', natVis.a && natVis.b && /Estimated bladder % released/.test(natVis.lbl) && natVis.c === '75%', JSON.stringify(natVis));
      await page.screenshot({ path: `/workspace/screens/${tag}-calendar-natural-detail-form.png` });
      await page.click('.cal-sheet [data-s]');
      await new Promise(r => setTimeout(r, 200));
      const nd = await page.evaluate(() => {
        const C = window.BSCalendar; const e = C.load().entries.find(x => x.memo === 'nat detail');
        C.addEntry({ type: 'leak', source: 'natural', urgencyBefore: 50, releasedPct: 25, memo: 'nat detail 2' });
        C.addEntry({ type: 'accident', source: 'natural', memo: 'no detail' });
        const st = C.computeStats().accDetail;
        const day = document.getElementById('calDayDetail').textContent;
        const ex = C.exportObject(); const exE = ex.entries.find(x => x.memo === 'nat detail');
        return { e, st, dayShows: /urgency 9→1\/10/.test(day) && /~75% released/.test(day), ver: ex.version, exE,
          trends: /Avg urgency before accidents/.test(document.getElementById('calendarInline').textContent) };
      });
      check('natural accident saved with urgencyBefore/After + releasedPct', nd.e && nd.e.urgencyBefore === 90 && nd.e.urgencyAfter === 10 && nd.e.releasedPct === 75, JSON.stringify(nd.e));
      check('day detail shows urgency before→after and % released', nd.dayShows);
      check('trend stats: avg urgency before / avg % released', nd.st.avgUrgencyBefore === 70 && nd.st.avgReleasedPct === 50 && nd.st.n === 2 && nd.trends, JSON.stringify(nd.st));
      check('export v4 includes v3 fields', nd.ver === 4 && nd.exE.releasedPct === 75 && nd.exE.urgencyBefore === 90, JSON.stringify(nd.exE));
      const mig = await page.evaluate(() => {
        const C = window.BSCalendar;
        const v2 = { app: 'bladder-sim-calendar', version: 2, entries: [{ id: 'v2a', ts: Date.now() - 3600e3, type: 'accident', source: 'natural', severity: 'wet', leaked: false, urgency: 60 }] };
        const p2 = C.parseImport(JSON.stringify(v2));
        const v3 = { app: 'bladder-sim-calendar', version: 3, entries: [{ id: 'v3a', ts: Date.now() - 7200e3, type: 'accident', source: 'natural', urgencyBefore: 140, urgencyAfter: -5, releasedPct: 33 }] };
        const p3 = C.parseImport(JSON.stringify(v3));
        // stored v2-era calendar (schema 2 in localStorage) loads under v3 code
        const raw = JSON.parse(localStorage.getItem('bs_calendar_v2')); raw.schema = 2; localStorage.setItem('bs_calendar_v2', JSON.stringify(raw));
        C._resetCache(); const n = C.load().entries.length;
        let newer = ''; try { C.parseImport(JSON.stringify({ app: 'bladder-sim-calendar', version: 5, entries: [] })); } catch (e) { newer = e.message; }
        return { v2: p2.entries.length === 1 && p2.version === 2 && p2.entries[0].urgency === 60 && p2.entries[0].releasedPct === undefined,
          v3: p3.entries[0], n, newer };
      });
      check('import v2 still works; v3 fields clamped 0-100; stored v2 data loads; v5 rejected', mig.v2 && mig.v3.urgencyBefore === 100 && mig.v3.urgencyAfter === 0 && mig.v3.releasedPct === 33 && mig.n > 0 && /newer/.test(mig.newer), JSON.stringify(mig));
      await page.evaluate(() => { const C = window.BSCalendar; C.load().entries.filter(e => /^nat detail|^no detail/.test(e.memo || '')).forEach(e => C.deleteEntry(e.id)); });

      // ---- run-to-potty grace logic ----
      const g = await page.evaluate(() => {
        const G = window.BSGrace; const o = {};
        localStorage.removeItem('bs_grace_settings');
        o.cv = ['fully_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent'].map(l => G.controlValue(l));
        o.fgLow = G.graceMs(true, 0); o.fgHigh = G.graceMs(true, 1); o.bgLow = G.graceMs(false, 0); o.bgHigh = G.graceMs(false, 1); o.bgMid = G.graceMs(false, 0.5);
        G.saveSettings({ fgMinSec: 20, fgMaxSec: 60, bgMinMin: 5, bgMaxMin: 20 });
        o.custom = [G.graceMs(true, 0), G.graceMs(true, 1), G.graceMs(false, 0), G.graceMs(false, 1)];
        localStorage.removeItem('bs_grace_settings');
        const now = Date.now();
        o.clsFg = G.classify(now - 200, now, false); o.clsHidden = G.classify(now - 200, now, true); o.clsLate = G.classify(now - 8 * 60000, now, false);
        return o;
      });
      check('control value from continence level (1 → 0)', JSON.stringify(g.cv) === JSON.stringify([1, 0.75, 0.5, 0.25, 0]), JSON.stringify(g.cv));
      check('grace defaults: fg 30s→90s, bg 10→15 min by control', g.fgLow === 30000 && g.fgHigh === 90000 && g.bgLow === 600000 && g.bgHigh === 900000 && g.bgMid === 750000, JSON.stringify(g));
      check('grace min/max adjustable via settings', JSON.stringify(g.custom) === JSON.stringify([20000, 60000, 300000, 1200000]), JSON.stringify(g.custom));
      check('classify: visible+on time = foreground; hidden or late = background from scheduled time', g.clsFg.foreground && !g.clsHidden.foreground && !g.clsLate.foreground && g.clsLate.firedAt < Date.now() - 7 * 60000, JSON.stringify([g.clsFg, g.clsHidden, g.clsLate]));
      const sim = await page.evaluate(async () => {
        const G = window.BSGrace; const o = {}; const calls = { acc: 0, ack: 0 };
        const origAcc = window.haveAccident, origAck = window.acknowledgeAlarm, origProfile = profileMode, origLvl = currentContinenceLevel;
        window.haveAccident = () => { calls.acc++; }; 
        const ackStub = () => { calls.ack++; hideBanner(); };
        sessionRunning = true; profileMode = 'early';
        // 1) foreground, low control: 30 s window
        currentContinenceLevel = 'fully_incontinent';
        let now = Date.now();
        G.start(now - 25000, true); showBanner('⚠️ test', '', 'high');
        o.fgOpen = G.check(now); o.btnVisible = document.getElementById('graceRunBtn').style.display !== 'none';
        o.cd = document.getElementById('graceCountdown').textContent;
        o.fgExpired = G.check(now + 6000).status; o.accAfterFg = calls.acc; o.pendingAfter = G.pending();
        // 2) foreground, high control: 90 s → still open after 60 s
        currentContinenceLevel = 'fully_continent';
        now = Date.now(); G.start(now - 60000, true); o.fgHigh = G.check(now).status; G.clear();
        // 3) background (alarm fired while asleep), mid control; user returns after 8 min → still offered
        currentContinenceLevel = 'mostly_continent'; // 0.75 → 13.75 min
        window.acknowledgeAlarm = ackStub;
        G.onMainAlarm(Date.now() - 8 * 60000);
        o.bgPending = Object.assign({}, G.pending()); o.bgEval = G.check(); 
        o.bgRun = G.runToPotty(); o.ackCalls = calls.ack; o.accAfterBgRun = calls.acc;
        // 4) background, user returns after 20 min → auto accident on return
        G.onMainAlarm(Date.now() - 20 * 60000); o.accAfterBgLate = calls.acc;
        // 5) background, low control (10 min) and 11 min elapsed → accident; high control (15) and 11 min → open
        currentContinenceLevel = 'fully_incontinent'; G.onMainAlarm(Date.now() - 11 * 60000); o.accLowCtl = calls.acc;
        currentContinenceLevel = 'fully_continent'; G.onMainAlarm(Date.now() - 11 * 60000); o.highCtlOpen = !!G.pending(); G.clear();
        // 6) full integration: main alarm overdue by 12 min found by the recovery check (screen-on / resume)
        hideBanner(); mainEndAt = Date.now() - 12 * 60000; meetingActive = false;
        runMobileRecoveryChecks('test');
        const p = G.pending(); o.integ = p && { fg: p.foreground, graceMin: p.graceMs / 60000, ageMin: Math.round((Date.now() - p.firedAt) / 60000) };
        o.bannerShown = document.getElementById('alarmBanner').style.display === 'flex';
        document.getElementById('graceRunBtn').click(); o.ackAfterClick = calls.ack; o.clearedAfterClick = !G.pending();
        stopChime && stopChime();
        // 7) bedwetting: nothing starts
        profileMode = 'bedwetting'; o.bed = G.onMainAlarm(Date.now() - 60000); o.bedPending = G.pending();
        // restore
        G.clear(); hideBanner(); window.haveAccident = origAcc; window.acknowledgeAlarm = origAck; profileMode = origProfile; currentContinenceLevel = origLvl;
        clearTimeout(mainTimer); clearTimeout(microTimer); clearTimeout(preChimeTimer); clearTimeout(hydrationTimer); mainEndAt = null; sessionRunning = false; pendingMainEvent = null;
        o.calls = calls; return o;
      });
      check('foreground grace: open with countdown + Run-to-potty button, then auto-accident at 30 s', sim.fgOpen.status === 'open' && sim.btnVisible && /left/.test(sim.cd) && sim.fgExpired === 'expired' && sim.accAfterFg === 1 && !sim.pendingAfter, JSON.stringify({ fgOpen: sim.fgOpen, cd: sim.cd, acc: sim.accAfterFg }));
      check('foreground grace longer with high control (open at 60 s)', sim.fgHigh === 'open', sim.fgHigh);
      check('background grace: measured from fire time; return at 8 min → run-to-potty still offered', sim.bgPending.foreground === false && sim.bgEval.status === 'open' && Math.round(sim.bgEval.remainingMs / 60000) === 6 && sim.bgRun === 'responded' && sim.ackCalls === 1 && sim.accAfterBgRun === 1, JSON.stringify({ p: sim.bgPending, e: sim.bgEval }));
      check('background grace: return after 20 min → auto accident', sim.accAfterBgLate === 2, String(sim.accAfterBgLate));
      check('background grace scales with control (11 min: low → accident, high → open)', sim.accLowCtl === 3 && sim.highCtlOpen, JSON.stringify({ a: sim.accLowCtl, h: sim.highCtlOpen }));
      check('integration: overdue main alarm on resume → background grace from real fire time; button acknowledges', sim.integ && sim.integ.fg === false && sim.integ.ageMin === 12 && sim.integ.graceMin === 15 && sim.bannerShown && sim.ackAfterClick === 2 && sim.clearedAfterClick, JSON.stringify(sim.integ));
      check('bedwetting: no grace window / no auto-accident', sim.bed === null && !sim.bedPending && sim.calls.acc === 3, JSON.stringify(sim.calls));
      // grace + alarm reliability settings render
      const gs = await page.evaluate(async () => { switchTab('settings'); await new Promise(r => setTimeout(r, 300));
        return { grace: !!document.getElementById('grFgMin') && /Run-to-potty grace/.test(document.getElementById('graceSettingsMount').textContent),
          rel: /Alarm reliability/.test(document.getElementById('alarmReliabilityMount').textContent) }; });
      await page.screenshot({ path: `/workspace/screens/${tag}-settings-alarm-grace-full.png`, fullPage: true });
      check('settings: Alarm reliability + grace sections render', gs.grace && gs.rel, JSON.stringify(gs));

      // ---- native alarm diff (never cancels a pending alarm unless its time changed) ----
      const df = await page.evaluate(() => {
        const D = window.BSNativeAlarm.diff, ID = window.BSNativeAlarm.ID, now = Date.now();
        const M = o => new Map(Object.entries(o).map(([k, v]) => [+k, { at: v }]));
        const r = {};
        r.same = D(M({ [ID.main]: now + 600000 }), M({ [ID.main]: now + 600400 }), now);
        r.changed = D(M({ [ID.main]: now + 600000 }), M({ [ID.main]: now + 900000 }), now);
        r.firingGone = D(M({ [ID.main]: now + 2000 }), M({}), now);        // JS consumed it 2 s early → must NOT cancel
        r.firingResched = D(M({ [ID.main]: now + 1500 }), M({ [ID.main]: now + 1800000 }), now); // wait till it fires
        r.removed = D(M({ [ID.micro]: now + 600000 }), M({}), now);
        r.past = D(M({}), M({ [ID.main]: now - 500 }), now);
        r.testKept = D(M({ [ID.test]: now + 60000 }), M({}), now);
        r.newOne = D(M({}), M({ [ID.hydration]: now + 300000 }), now);
        return r;
      });
      const n = x => x.toSchedule.length + '/' + x.toCancel.length;
      check('native diff: unchanged → no-op; changed → re-arm; firing/test alarm never cancelled; removed → cancel',
        n(df.same) === '0/0' && n(df.changed) === '1/0' && n(df.firingGone) === '0/0' && n(df.firingResched) === '0/0' && n(df.removed) === '0/1' && n(df.past) === '0/0' && n(df.testKept) === '0/0' && n(df.newOne) === '1/0',
        JSON.stringify(Object.fromEntries(Object.entries(df).map(([k, v]) => [k, n(v)]))));
      const nn = fs.readFileSync('/workspace/bladder-sim/js/native-notify.js', 'utf8');
      check('native-notify: no blanket cancel-all on reschedule', !/await cancelAllNative\(\);\s*\n\s*lastSignature/.test(nn) && /BladderAlarm/.test(nn));

      // log dot
      const dot = await page.evaluate(async () => { switchTab('session'); logToOutput('test line'); await new Promise(r => setTimeout(r, 50)); return document.getElementById('logDot').classList.contains('on'); });
      check('log tab unread dot', dot);
    }
    // ================= v5: calibration / quizzes / campaign =================
    {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      // --- calibration math (pure) ---
      const cm = await page.evaluate(() => {
        const C = window.BSCalib;
        const s = C.summarize([{ durationSec: 20, volumeMl: 400 }, { durationSec: 30, volumeMl: 300 }, { durationSec: 25 }]);
        return { s, sc21: C.scalarFor(21), scLo: C.scalarFor(2), scHi: C.scalarFor(500), full: C.leakSecondsFor(1, 1.5), half: C.leakSecondsFor(0.5, 1.5),
          ba1: C.bladderAge({ medianMl: 120, medianSec: 20, flowMlS: 6 }, { age: 30, sex: 'female' }), ba2: C.bladderAge({ medianMl: 420, medianSec: 21, flowMlS: 20 }, { age: 30, sex: 'male' }),
          ec: [C.expectedCapacity(5), C.expectedCapacity(12), C.expectedCapacity(40)], oz: Math.round(C.toMl(10, 'oz')) };
      });
      check(`${tag} calib: median/mean/flow`, cm.s.medianSec === 25 && cm.s.meanSec === 25 && cm.s.medianMl === 350 && cm.s.flowMlS === 15, JSON.stringify(cm.s));
      check(`${tag} calib: scalar = T/14 clamped 0.5–10`, cm.sc21 === 1.5 && cm.scLo === 0.5 && cm.scHi === 10 && cm.s.scalar === 1.8, `${cm.sc21} ${cm.scLo} ${cm.scHi} ${cm.s.scalar}`);
      check(`${tag} calib: partial scales proportionally`, cm.full === 21 && cm.half === 11, `${cm.full}/${cm.half}`);
      check(`${tag} calib: bladder age + gentle note thresholds`, cm.ba1.capacityAge === 3 && cm.ba1.gentle && !cm.ba2.gentle && /adult/.test(cm.ba2.label), JSON.stringify([cm.ba1, cm.ba2]));
      check(`${tag} calib: ref formulas`, cm.ec.join() === '180,390,390' && cm.oz === 296, cm.ec.join() + ' ' + cm.oz);
      // --- calibration UI flow: hold, release, re-press, done ---
      await page.evaluate(() => { localStorage.removeItem('bs_calibration_v1'); switchTab('settings'); document.getElementById('setCalib').open = true; });
      await sleep(150);
      await page.evaluate(() => document.getElementById('calibrationMount').scrollIntoView());
      await page.type('#calAge', '30');
      await page.click('#calStart'); await sleep(100);
      const hb = await page.$('#calHold'); const box = await hb.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await sleep(700); await page.mouse.up(); await sleep(300);
      await page.mouse.down(); await sleep(700); await page.mouse.up();
      await page.type('#calVol', '1');
      await page.screenshot({ path: `/workspace/screens/v5-${tag}-calibration-recording.png` });
      await page.click('#calDone'); await sleep(150);
      const cu = await page.evaluate(() => { const d = window.BSCalib.load(); return { n: d.trials.length, dur: d.trials[0] && d.trials[0].durationSec, scale: leakTimeScale, card: !!document.querySelector('.calib-card'), badge: /not a medical measure/.test(document.querySelector('.calib-card')?.textContent || ''), note: !!document.querySelector('.calib-note') }; });
      check(`${tag} calib UI: intermittent holds summed, scalar applied, game-stat badge, gentle note`, cu.n === 1 && cu.dur >= 1.2 && cu.dur <= 2.0 && cu.scale === 0.5 && cu.card && cu.badge && cu.note, JSON.stringify(cu));
      await page.evaluate(() => { window.BSCalib.addTrial({ sex: 'male', age: 30, urgency: 5, durationSec: 21, volumeMl: 420 }); window.BSCalib.addTrial({ sex: 'male', age: 30, urgency: 6, durationSec: 23, volumeMl: 440 }); });
      await sleep(100);
      await page.evaluate(() => document.querySelector('.calib-card').scrollIntoView());
      await page.screenshot({ path: `/workspace/screens/v5-${tag}-calibration-results.png` });
      await page.evaluate(() => document.querySelector('[data-cdel]').click()); await sleep(100);
      const cd = await page.evaluate(() => { const C = window.BSCalib, t = C.load().trials; return { n: t.length, scale: leakTimeScale, exp: C.summarize(t).scalar, newestGone: !t.some(x => x.durationSec === 23) }; });
      check(`${tag} calib: delete trial re-computes scalar`, cd.n === 2 && cd.newestGone && cd.scale === cd.exp, JSON.stringify(cd));
      // --- quizzes ---
      await page.evaluate(() => { localStorage.removeItem('bs_quiz_v1'); switchTab('profiles'); });
      await sleep(150);
      await page.evaluate(() => document.getElementById('myProfileMount').scrollIntoView());
      await page.click('#qzA'); await sleep(80);
      const pre = await page.evaluate(() => document.querySelector('#myProfileMount .quiz-q').textContent);
      const nA = await page.evaluate(() => window.BSQuiz.questions('a').length);
      for (let i = 0; i < nA; i++) {
        const opts = await page.$$('#myProfileMount .quiz-opts button');
        await opts[Math.min(1, opts.length - 1)].click(); await sleep(40);
        if (i === 2) await page.screenshot({ path: `/workspace/screens/v5-${tag}-quizA.png` });
        await page.click('#qzNext'); await sleep(40);
      }
      await page.click('#qzB'); await sleep(80);
      const nB = await page.evaluate(() => window.BSQuiz.questions('b').length);
      const pickB = [[0, 3], [1], [0, 4], [2], [1]]; while (pickB.length < nB) pickB.push([0]);
      for (let i = 0; i < pickB.length; i++) {
        for (const k of pickB[i]) { await page.click(`#myProfileMount .quiz-opts button[data-k="${k}"]`); await sleep(30); }
        if (i === 0) await page.screenshot({ path: `/workspace/screens/v5-${tag}-quizB.png` });
        await page.click('#qzNext'); await sleep(40);
      }
      const qz = await page.evaluate(() => { const d = window.BSQuiz.load(); const prof = getSavedCustomProfiles().find(p => p.source === 'quiz');
        return { base: d.baseline, tgt: d.target, prof: prof && prof.runtime, card: !!document.querySelector('.quiz-card'), n: getSavedCustomProfiles().filter(p => p.source === 'quiz').length, exp: window.BSCalib.summarize(window.BSCalib.load().trials).scalar }; });
      check(`${tag} quiz A → baseline`, qz.base && qz.base.level && qz.base.levelIdx >= 0, JSON.stringify(qz.base));
      check(`${tag} quiz B → target (less → +2 levels) & program w/ calibrated scalar + symptoms`, qz.tgt.targetIdx === Math.min(4, qz.base.levelIdx + 2) && qz.prof && qz.prof.leakTimeScale === qz.exp && qz.prof.symptoms.join() === 'overactive_bladder,nocturnal_wetter' && qz.card, JSON.stringify({ t: qz.tgt, p: qz.prof && { s: qz.prof.leakTimeScale, sy: qz.prof.symptoms } }));
      await page.evaluate(() => document.querySelector('.quiz-card').scrollIntoView());
      await page.screenshot({ path: `/workspace/screens/v5-${tag}-quiz-summary.png` });
      // retake replaces program (no duplicates)
      await page.evaluate(() => window.BSQuiz.finish());
      const nq = await page.evaluate(() => getSavedCustomProfiles().filter(p => p.source === 'quiz').length);
      check(`${tag} quiz: regenerate keeps one program`, nq === 1, String(nq));
      // --- campaign (pure evaluation with synthetic day entries) ---
      const cp = await page.evaluate(() => {
        const K = window.BSCampaign; K.abandon();
        const now = Date.now(), today = K.dayKey(now);
        K.start({ startRank: 2, target: 0, source: 'sim', time: 2, now: now - 5 * 864e5 });
        const good = [{ type: 'night', source: 'sim' }, { type: 'potty', source: 'sim' }, { type: 'potty', source: 'sim' }, { type: 'potty', source: 'sim' }, { type: 'potty', source: 'sim' }];
        const ev = K.evaluate(now, k => (k >= K.addDays(today, -4) && k <= K.addDays(today, -2)) ? good : []);
        const s1 = K.load(); const grace = window.BSGrace.settings();
        // less-continent direction: natural accidents must not count
        K.abandon(); K.start({ startRank: 2, target: 4, source: 'both', time: 2, now: now - 4 * 864e5 });
        const natOnly = [{ type: 'night', source: 'natural' }, { type: 'accident', source: 'natural' }, { type: 'accident', source: 'natural' }, { type: 'accident', source: 'natural' }];
        K.evaluate(now, k => natOnly);
        const s2 = K.load();
        const goalsNat = K.scoreDay(s2, today, natOnly);
        // demotion never below start
        K.abandon(); K.start({ startRank: 2, target: 0, source: 'sim', time: 2, now: now - 4 * 864e5 });
        K.evaluate(now, k => [{ type: 'accident', source: 'sim' }, { type: 'accident', source: 'sim' }]);
        const s3 = K.load();
        // pause skips days
        K.pause(true); const evP = K.evaluate(now + 3 * 864e5, k => good); K.pause(false);
        const camp = getSavedCustomProfiles().find(p => p.id === 'campaign');
        return { ev, rank1: s1.rank, hist: s1.history.map(h => h.result), grace, rank2: s2.rank, natMet: goalsNat.goals.find(g => g.id === 'simleaks').ok, rank3: s3.rank, evP: evP.length, camp: camp && camp.runtime.campaignRank };
      });
      check(`${tag} campaign: 3 good days → promoted one rank, grace updated`, cp.rank1 === 1 && cp.ev[0] && cp.ev[0].type === 'promoted' && cp.grace.fgMinSec === 60, JSON.stringify(cp));
      check(`${tag} campaign: natural accidents never count toward progress`, cp.rank2 === 2 && cp.natMet === false, JSON.stringify({ r: cp.rank2, m: cp.natMet }));
      check(`${tag} campaign: demotion floors at start rank; pause freezes`, cp.rank3 === 2 && cp.evP === 0 && cp.camp === 2, JSON.stringify(cp));
      await page.evaluate(() => { switchTab('profiles'); window.renderCampaign(); document.getElementById('campaignMount').scrollIntoView(); });
      await sleep(150);
      await page.screenshot({ path: `/workspace/screens/v5-${tag}-campaign.png` });
      // bedwetting silence: campaign/calibration/quiz add no audio/vibration/notification calls
      const silent = await page.evaluate(() => { const src = [window.BSCampaign, window.BSQuiz, window.BSCalib].map(o => Object.values(o).filter(f => typeof f === 'function').map(String).join('')).join('');
        return !/vibrate|playChime|Audio\(|LocalNotifications|scheduleNative|schedule\(/.test(src); });
      check(`${tag} v5 modules never sound/vibrate/schedule (bedwetting silent)`, silent);
      // layout checks on profiles + settings again with new content
      for (const t of ['profiles', 'settings']) {
        await page.evaluate(t => switchTab(t), t); await sleep(150);
        const m = await page.evaluate(() => { const cw = document.documentElement.clientWidth; const small = [], wide = [];
          document.querySelectorAll('#myProfileMount button, #campaignMount button, #calibrationMount button, #calibrationMount select').forEach(b => { const r = b.getBoundingClientRect(); if (!r.width) return; if (r.height < 43.5 || r.width < 43.5) small.push((b.id || b.textContent.trim().slice(0, 20)) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
          document.querySelectorAll('.tab-page.active *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > cw + 1) wide.push(el.id || el.className || el.tagName); });
          return { small, wide: wide.slice(0, 5), sw: document.documentElement.scrollWidth, cw }; });
        check(`${tag} v5 ${t}: no overflow, targets ≥44px`, m.small.length === 0 && m.wide.length === 0 && m.sw <= m.cw, JSON.stringify(m));
        await page.screenshot({ path: `/workspace/screens/v5-${tag}-${t}-full.png`, fullPage: true });
      }

      // ===================== v6 =====================
      // quiz length + messy gating
      const ql = await page.evaluate(() => { localStorage.setItem('messyModeEnabled', 'false'); applyMessyVisibility(false);
        const a0 = BSQuiz.questions('a'), b0 = BSQuiz.questions('b');
        localStorage.setItem('messyModeEnabled', 'true'); const a1 = BSQuiz.questions('a').length, b1 = BSQuiz.questions('b').length; localStorage.setItem('messyModeEnabled', 'false');
        return { a0: a0.length, b0: b0.length, a1, b1, messyHidden: !a0.some(q => q.messy) && !b0.some(q => q.messy) }; });
      check(`${tag} v6 quiz length: A ${ql.a0}/${ql.a1}, B ${ql.b0}/${ql.b1} (messy off/on); messy Qs hidden when off`, ql.a0 >= 34 && ql.a1 <= 45 && ql.b0 >= 26 && ql.b1 <= 35 && ql.a1 === ql.a0 + 1 && ql.b1 === ql.b0 + 1 && ql.messyHidden, JSON.stringify(ql));
      await page.evaluate(() => { switchTab('profiles'); BSQuiz.begin('a'); }); await sleep(100);
      await page.evaluate(() => document.getElementById('myProfileMount').scrollIntoView());
      await page.screenshot({ path: `/workspace/screens/v6-${tag}-quiz.png` });
      await page.evaluate(() => { const b = document.getElementById('qzBack'); if (b) b.click(); });
      // override moved into Settings › Advanced / Testing (collapsed)
      const ov6 = await page.evaluate(() => { const r = document.getElementById('overrideNextRow'); const d = r && r.closest('details');
        return { inSession: !!r.closest('#tab-session'), inSettings: !!r.closest('#tab-settings'), details: d && d.id, collapsed: d && !d.open }; });
      check(`${tag} v6 override control moved to Settings › Advanced / Testing (collapsed)`, !ov6.inSession && ov6.inSettings && ov6.details === 'advTesting' && ov6.collapsed, JSON.stringify(ov6));
      // messy opt-out hides #2 in urge tab + calendar field; label
      await page.evaluate(() => switchTab('urge')); await sleep(100);
      const mo6 = await page.evaluate(() => { const vis = el => !!el && getComputedStyle(el).display !== 'none';
        const off = { t2: vis(document.getElementById('urgeT2')), btn: vis(document.getElementById('btnMessy')) };
        const lbl = document.querySelector('label[for], #messyModeToggle').parentElement.textContent;
        toggleMessyMode(true); const on = { t2: vis(document.getElementById('urgeT2')) };
        toggleMessyMode(false); const off2 = vis(document.getElementById('urgeT2'));
        // forced #2 roll with messy off falls back to #1
        const r = BSUrge.roll({ type: 2, urgency: 5, rng: () => 0.99 });
        return { off, on, off2, lbl: document.getElementById('messyModeToggle').parentElement.textContent.trim(), rtype: r.chances.type }; });
      check(`${tag} v6 messy off: #2 hidden in urge tab, Uh-Oh hidden, #2 roll coerced to #1; on: shown; label "Messy content (#2)"`, !mo6.off.t2 && !mo6.off.btn && mo6.on.t2 && !mo6.off2 && mo6.rtype === 1 && /Messy content \(#2\)/.test(mo6.lbl), JSON.stringify(mo6));
      // calendar messy field hidden when opted out
      const cm6 = await page.evaluate(() => { const div = document.createElement('div'); div.innerHTML = '<label class="fld messy-only" style="display:flex">x</label>'; document.body.appendChild(div);
        const a = getComputedStyle(div.firstChild).display; toggleMessyMode(true); const b = getComputedStyle(div.firstChild).display; toggleMessyMode(false); div.remove();
        const src = String(window.BSCalendar.normalize) ; return { a, b, calHas: document.documentElement.innerHTML.length > 0 }; });
      const calSrc = fs.readFileSync(__dirname + '/../js/calendar.js', 'utf8');
      check(`${tag} v6 calendar 'messy' fields are .messy-only and hidden when off`, cm6.a === 'none' && cm6.b === 'flex' && (calSrc.match(/fld messy-only/g) || []).length === 2, JSON.stringify(cm6));
      // urge rolls: deterministic outcomes
      const ur = await page.evaluate(() => {
        const was = { sr: sessionRunning, me: mainEndAt };
        sessionRunning = false; mainEndAt = null; currentContinenceLevel = 'mostly_continent';
        const allowed = BSUrge.roll({ type: 1, urgency: 5, rng: () => 0.10 });
        const wait = BSUrge.roll({ type: 1, urgency: 5, rng: () => 0.99 });
        const acc = BSUrge.roll({ type: 1, urgency: 10, rng: () => 0.01 });
        const notYet = BSUrge.roll({ type: 1, urgency: 0, rng: () => 0.5 });
        const pLow = BSUrge.roll({ type: 1, urgency: 4, rng: () => 0.5 }).chances, pHigh = BSUrge.roll({ type: 1, urgency: 10, rng: () => 0.5 }).chances;
        sessionRunning = true; mainEndAt = Date.now() + 5 * 60000;
        const wt = BSUrge.roll({ type: 1, urgency: 5, rng: () => 0.10 });
        const hi = BSUrge.roll({ type: 1, urgency: 9, rng: () => 0.10 });
        const ck = BSUrge.check();
        mainEndAt = Date.now() + 30 * 60000; const far = BSUrge.roll({ type: 1, urgency: 5, rng: () => 0.10 }); const ck2 = BSUrge.check();
        sessionRunning = was.sr; mainEndAt = was.me;
        return { allowed: allowed.outcome, wait: wait.outcome, waitMin: wait.waitMin, acc: acc.outcome, notYet: notYet.outcome, pLow, pHigh, wt: wt.outcome, wtMin: wt.waitMin, hi: hi.outcome, ck, far: far.outcome, ck2 }; });
      check(`${tag} v6 urge roll: allowed / must wait X / accident / not yet`, ur.allowed === 'allowed' && ur.wait === 'wait' && ur.waitMin >= 2 && ur.acc === 'accident' && ur.notYet === 'not_yet', JSON.stringify(ur));
      check(`${tag} v6 urge: high urgency raises permission + accident odds`, ur.pHigh.permit > ur.pLow.permit && ur.pHigh.accident > ur.pLow.accident, JSON.stringify([ur.pLow, ur.pHigh]));
      check(`${tag} v6 urge: timer ≤ window + moderate urgency → wait for timer; high urgency skips it; far timer rolls normally`, ur.wt === 'wait_timer' && ur.wtMin === 5 && ur.hi !== 'wait_timer' && ur.ck.soon && !ur.ck2.soon && ur.far === 'allowed', JSON.stringify(ur));
      // urge UI roll → log + calendar
      const ul = await page.evaluate(async () => {
        BSUrge.saveSettings({ launchGuide: false }); renderUrge();
        const n0 = BSCalendar.load().entries.filter(e => e.mode === 'natural_urge').length, l0 = document.getElementById('output').children.length;
        document.getElementById('urgeRoll').click(); await new Promise(r => setTimeout(r, 50));
        BSUrge.miniStart(); document.getElementById('urgeRoll').click(); BSUrge.miniStop();
        const ents = BSCalendar.load().entries.filter(e => e.mode === 'natural_urge');
        return { cal: ents.length - n0, log: document.getElementById('output').children.length - l0, res: !!document.getElementById('urgeResult'), sim: ents.every(e => e.source === 'sim'), logTxt: document.getElementById('output').textContent.includes('Natural urge') };
      });
      check(`${tag} v6 urge tab roll → session log + calendar (sim); mini session works`, ul.cal === 2 && ul.log >= 4 && ul.res && ul.sim && ul.logTxt, JSON.stringify(ul));
      await page.evaluate(() => { const ui = BSUrge._ui(); ui.urgency = 6; renderUrge(); window.scrollTo(0, 0); }); await sleep(80);
      await page.screenshot({ path: `/workspace/screens/v6-${tag}-urge.png`, fullPage: true });
      // office mode: colour mapping
      const oc = await page.evaluate(() => { const c = BSOffice.colourFor;
        return { push: c({ type: 'push', text: 'PUSH', time: 3 }), pushSlow: c({ type: 'push', text: 'SLOW PUSH', time: 3 }), relax: c({ type: 'relax', text: 'RELAX', time: 3 }), flood: c({ type: 'relax', text: 'FLOOD', time: 3 }),
          stop: c({ type: 'stop', text: 'HOLD IT', time: 3 }), go: c({ type: 'stop', text: 'GO TO THE POTTY', time: 0 }) }; });
      check(`${tag} v6 office colours: push/flood→red, relax/slow→yellow, stop→blue, potty→green`, oc.push === 'red' && oc.flood === 'red' && oc.relax === 'yellow' && oc.pushSlow === 'yellow' && oc.stop === 'blue' && oc.go === 'green', JSON.stringify(oc));
      // office on → guide shows colour light, legend, terminology swapped, discreet notifications
      const of = await page.evaluate(async () => {
        BSOffice.set(true); await new Promise(r => setTimeout(r, 50));
        logToOutput('Diaper accident! Protection soaked, potty denied.'); await new Promise(r => setTimeout(r, 50));
        const logTxt = document.getElementById('output').firstElementChild.textContent;
        const n = BSOffice.notif('Bladder Sim', 'Alarm! Main event.');
        const title = document.title;
        togglePushToLeak && togglePushToLeak(true);
        startVoidGuide([{ text: 'PUSH HARD', time: 3, type: 'push' }, { text: 'RELAX', time: 3, type: 'relax' }, { text: 'HOLD', time: 3, type: 'stop' }], 'Diaper accident incoming', 'full');
        document.getElementById('voidActionBtn').click(); await new Promise(r => setTimeout(r, 120));
        const ov = document.getElementById('voidOverlay');
        const r = { oc: ov.dataset.oc, label: document.getElementById('voidLabel').textContent, next: document.getElementById('voidNextLabel').textContent, ins: document.getElementById('voidInstruction').textContent,
          bg: getComputedStyle(ov).backgroundImage, legend: getComputedStyle(document.getElementById('officeLegendBody')).display, ptl: getComputedStyle(document.getElementById('pushToLeakContainer')).display };
        return Object.assign(r, { logTxt, n, title, btnTxt: (document.getElementById('btnChange') || {}).textContent });
      });
      await page.screenshot({ path: `/workspace/screens/v6-${tag}-office-guide.png` });
      const of2 = await page.evaluate(async () => {
        document.getElementById('officeLegendBtn').click(); const hid = getComputedStyle(document.getElementById('officeLegendBody')).display;
        document.getElementById('officeLegendBtn').click();
        // press-to-leak: holding advances the red step
        const t0 = document.getElementById('voidTimer').textContent; pushToLeakHeld = true; await new Promise(r => setTimeout(r, 450)); const t1 = document.getElementById('voidTimer').textContent; pushToLeakHeld = false;
        closeVoidGuide && closeVoidGuide(); document.getElementById('voidOverlay').style.display = 'none';
        togglePushToLeak(false);
        BSOffice.set(false); await new Promise(r => setTimeout(r, 50));
        return { hid, t0, t1, restored: document.getElementById('btnChange').textContent, title: document.title, n: BSOffice.notif('Bladder Sim', 'x') };
      });
      check(`${tag} v6 office guide: full-screen colour light (red first), colour words not prompts, legend hideable, press-to-leak still works`, of.oc === 'red' && of.label === 'RED' && of.next === 'YELLOW' && /gradient/.test(of.bg) && of.ins === 'Follow the light.' && of.legend !== 'none' && of2.hid === 'none' && of.ptl === 'block' && +of2.t1 < +of2.t0, JSON.stringify({ of, of2 }));
      check(`${tag} v6 office terminology swap (UI + log) & discreet notifications; restored when off`, !/diaper|accident|protection|potty/i.test(of.logTxt) && /gear/i.test(of.logTxt) && /gear/i.test(of.btnTxt) && of.n.title === 'Reminder' && !/alarm|main/i.test(of.n.body) && of.title === 'Routine Timer' && /Diaper/.test(of2.restored) && of2.n.title === 'Bladder Sim', JSON.stringify({ log: of.logTxt, btn: of.btnTxt, n: of.n, r: of2.restored }));
      // settings screenshot with office + advanced open
      await page.evaluate(() => { BSOffice.set(true); switchTab('settings'); document.getElementById('advTesting').open = true; }); await sleep(150);
      await page.screenshot({ path: `/workspace/screens/v6-${tag}-settings.png`, fullPage: true });
      await page.evaluate(() => { document.getElementById('advTesting').open = false; BSOffice.set(false); }); await sleep(50);
      // layout on new tab
      for (const t of ['urge', 'session', 'settings']) {
        await page.evaluate(t => switchTab(t), t); await sleep(120);
        const m = await page.evaluate(() => { const cw = document.documentElement.clientWidth; const small = [], wide = [];
          document.querySelectorAll('.tab-page.active button, .tab-page.active summary, #tabBar button').forEach(b => { const r = b.getBoundingClientRect(); if (!r.width) return; if (r.height < 43.5 || r.width < 43.5) small.push((b.id || b.textContent.trim().slice(0, 20)) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
          document.querySelectorAll('.tab-page.active *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > cw + 1) wide.push(el.id || el.className || el.tagName); });
          return { small, wide: wide.slice(0, 5), sw: document.documentElement.scrollWidth, cw }; });
        check(`${tag} v6 ${t}: no overflow, targets ≥44px`, m.small.length === 0 && m.wide.length === 0 && m.sw <= m.cw, JSON.stringify(m));
      }
      // bedwetting silence: v6 modules never sound/vibrate/schedule
      const sil6 = await page.evaluate(() => { const src = [window.BSUrge, window.BSOffice].map(o => Object.values(o).filter(f => typeof f === 'function').map(String).join('')).join('');
        return !/vibrate|playChime|startChime|Audio\(|LocalNotifications|schedule\(/.test(src); });
      check(`${tag} v6 urge/office modules never sound/vibrate/schedule (bedwetting silent)`, sil6);
    }
    if (vp.w === 360) {
      // ================= v7 Natural Night =================
      {
        const sl = ms => new Promise(r => setTimeout(r, ms));
        // spies for silence
        await page.evaluate(() => {
          window._spy = { vib: 0, audio: 0, notif: 0 };
          navigator.vibrate = () => { window._spy.vib++; return true; };
          const AC = window.AudioContext; window.AudioContext = function () { window._spy.audio++; return new AC(); };
          const AU = window.Audio; window.Audio = function (...a) { window._spy.audio++; return new AU(...a); };
          window.Notification = function () { window._spy.notif++; }; window.Notification.permission = 'granted';
          window._calBefore = BSCalendar.load().entries.length;
          BSNight.saveSettings({ sipsMin: 1, sipsMax: 3, unit: 'ml' });
          switchTab('session');
        });
        await page.evaluate(() => { document.getElementById('hubNights').open = true; }); await page.click('#btnNaturalNight'); await sl(200);
        await page.type('#nnDrAmt', '250'); await page.click('#nnDrAdd');
        await page.type('#nnDrAmt', '150'); await page.click('#nnDrAdd'); await sl(100);
        const bt = await page.evaluate(() => ({ items: document.querySelectorAll('#nnDrList [data-i]').length, prot: document.querySelector('#nnProt').options.length }));
        check(`${tag} v7 bedtime: multiple drinks + gear list`, bt.items === 2 && bt.prot >= 3, JSON.stringify(bt));
        await page.evaluate(() => { document.getElementById('nnBedMemo').value = 'tired'; document.getElementById('nnProt').value = 'diapers'; });
        await page.screenshot({ path: `/workspace/screens/v7-bedtime.png` });
        await page.click('#nnGoBed'); await sl(150);
        const silent = await page.evaluate(() => ({ s: isBedwettingSilent(), run: typeof sessionRunning !== 'undefined' && sessionRunning, ph: BSNight.get().phase,
          bg: getComputedStyle(document.getElementById('nnOverlay')).backgroundColor, huge: document.getElementById('nnWoke').getBoundingClientRect().height }));
        check(`${tag} v7 Natural Night active → isBedwettingSilent() true, no sim session`, silent.s && !silent.run && silent.ph === 'night', JSON.stringify(silent));
        check(`${tag} v7 night screen dark + huge wake button`, /rgb\(5, 6, 10\)/.test(silent.bg) && silent.huge > 200, JSON.stringify(silent));
        await page.screenshot({ path: `/workspace/screens/v7-night.png` });
        // wake #1: roll allowed (forced rng) → sips → confirm
        await page.click('#nnWoke'); await sl(80);
        const r1 = await page.evaluate(() => { const r = BSNight.doRoll(8, () => 0.01); return r; });
        await page.evaluate(() => BSNight.open()); await sl(80);
        const sipTxt = await page.evaluate(() => document.getElementById('nnNight').textContent);
        check(`${tag} v7 roll allowed → sips 1-3, 'small sips only' shown`, r1.outcome === 'allowed' && r1.sips >= 1 && r1.sips <= 3 && /small sips only/.test(sipTxt), JSON.stringify(r1));
        await page.screenshot({ path: `/workspace/screens/v7-night-allowed.png` });
        await page.click('#nnPeeDone'); await sl(60);
        await page.click('#nnSleep'); await sl(60);
        // wake #2: UI roll forced stay, check, drink, sleep
        await page.click('#nnWoke'); await sl(60);
        await page.click('#nnOptRoll'); await sl(60);
        await page.evaluate(() => { window._mr = Math.random; Math.random = () => 0.999; });
        await page.click('#nnDoRoll'); await sl(60);
        await page.evaluate(() => { Math.random = window._mr; });
        const stay = await page.evaluate(() => document.getElementById('nnNight').textContent);
        check(`${tag} v7 roll stay in bed → try to sleep`, /Stay in bed/.test(stay));
        await page.click('#nnSleep'); await sl(60);
        await page.click('#nnWoke'); await sl(60);
        await page.click('#nnOptCheck'); await sl(60);
        await page.evaluate(() => { const s = document.getElementById('nnCS'); s.value = 40; s.dispatchEvent(new Event('input')); document.querySelector('input[name=nnCR][value=unsure]').click(); document.getElementById('nnCMemo').value = 'felt damp'; });
        await page.click('#nnSaveCheck'); await sl(60);
        await page.click('#nnOptDrink'); await sl(60);
        await page.type('#nnNDAmt', '100'); await page.click('#nnSaveDrink'); await sl(60);
        await page.click('#nnSleep'); await sl(60);
        // sips cap
        const cap = await page.evaluate(() => { const s = BSNight.saveSettings({ sipsMin: 9, sipsMax: 99 }); const r = BSNight.roll({ urgency: 10, rng: () => 0.99, level: 0 }); BSNight.saveSettings({ sipsMin: 1, sipsMax: 3 }); return { s, sips: r.sips }; });
        check(`${tag} v7 sips capped at 5`, cap.s.sipsMax === 5 && cap.sips <= 5, JSON.stringify(cap));
        // app kill → reload restores
        const before = await page.evaluate(() => JSON.stringify(BSNight.get()));
        await page.reload({ waitUntil: 'networkidle0' }); await sl(1300);
        const after = await page.evaluate(() => ({ st: JSON.stringify(BSNight.get()), ov: !!document.getElementById('nnNight'), s: isBedwettingSilent() }));
        check(`${tag} v7 persists across app kill (reload restores night screen, still silent)`, after.st === before && after.ov && after.s, '');
        await page.evaluate(() => { window._spy = { vib: 0, audio: 0, notif: 0 }; navigator.vibrate = () => { window._spy.vib++; return true; }; window.Notification = function () { window._spy.notif++; }; });
        // morning
        const btns = await page.evaluate(() => { const w = document.getElementById('nnWoke'), r = document.getElementById('nnRise'); return { w: w && w.textContent, r: r && r.textContent, wc: w && getComputedStyle(w).backgroundColor, rc: r && getComputedStyle(r).backgroundColor }; });
        check(`${tag} v7 distinct 'Woke up (still night)' vs 'Getting up for the day' buttons (labels + colours)`, /still night/.test(btns.w) && /Getting up for the day/.test(btns.r) && btns.wc !== btns.rc, JSON.stringify(btns));
        const wakesBefore = await page.evaluate(() => BSNight.get().wakes);
        await page.click('#nnRise'); await sl(120);
        const rs = await page.evaluate(() => { const s = BSNight.get(); return { ph: s.phase, rise: s.timeline.filter(t => t.k === 'rise').length, wakes: s.wakes, card: !!document.getElementById('nnMorningCard') }; });
        check(`${tag} v7 rise ends the night → morning check-in, not counted as night wake`, rs.ph === 'morning' && rs.rise === 1 && rs.wakes === wakesBefore && rs.card, JSON.stringify(rs));
        const pre = await page.evaluate(() => ({ wet: document.querySelector('input[name=nnMW]:checked').value, sat: document.getElementById('nnMS').value, rem: document.querySelector('input[name=nnMR]:checked').value, sum: document.getElementById('nnSummary').textContent }));
        check(`${tag} v7 morning prefilled from night (wet, 40%, unsure) + summary`, pre.wet === '1' && pre.sat === '40' && pre.rem === 'unsure' && /Total fluids\s*500 ml/.test(pre.sum) && /Hours since last pee/.test(pre.sum), JSON.stringify(pre));
        await page.screenshot({ path: `/workspace/screens/v7-morning.png`, fullPage: false });
        await page.evaluate(() => { document.getElementById('nnMMemo').value = 'woke damp'; });
        await page.click('#nnSaveMorning'); await sl(250);
        const saved = await page.evaluate(() => { const e = BSCalendar.load().entries.filter(x => x.mode === 'natural_night').pop(); return { e, active: BSNight.active(), s: isBedwettingSilent(), tab: currentTab(), day: document.getElementById('calDayDetail').innerHTML, spy: window._spy,
          stats: BSCalendar.computeStats().naturalNight, trends: document.getElementById('calendarInline').textContent }; });
        const e = saved.e, nn = e && e.night.nn, ks = nn ? nn.timeline.map(t => t.k) : [];
        check(`${tag} v7 saved NATURAL night entry with fields + timeline`, e && e.source === 'natural' && e.type === 'night' && e.night.wet && e.night.wokeCount === 3 && e.night.fluidMl === 500 && e.night.remembered === 'unsure' && e.night.protection === 'diapers' && nn.bedMemo === 'tired' && nn.drinks.length === 3 && nn.riseAt && ks.filter(k => k === 'rise').length === 1 && ks.filter(k => k === 'wake').length === 3 && ['drink', 'pee', 'bed', 'wake', 'rise', 'roll', 'check', 'sleep', 'morning'].every(k => ks.includes(k)) && nn.pees === 1 && nn.rolls === 2 && nn.timeInBedMin >= 0 && nn.fluidBeforeBedMl === 400, JSON.stringify(e).slice(0, 600));
        check(`${tag} v7 session ended → silence lifted; no vibration/notification/audio`, !saved.active && !saved.s && saved.spy.vib === 0 && saved.spy.notif === 0 && saved.spy.audio === 0, JSON.stringify(saved.spy));
        check(`${tag} v7 day detail shows timeline`, saved.tab === 'calendar' && /Natural Night/.test(saved.day) && /nn-tl/.test(saved.day) && /small sip/.test(saved.day) && /Roll/.test(saved.day) && /Night wake \(still night\)/.test(saved.day) && /Rise — up for the day/.test(saved.day) && /3 night wakes/.test(saved.day), '');
        check(`${tag} v7 stats: wet/dry natural nights, wakes, fluids vs wet rate`, saved.stats.n >= 1 && saved.stats.wet >= 1 && saved.stats.avgWakes === 3 && saved.stats.totalNightWakes >= 3 && !!saved.stats.avgRise && /avg rise/.test(saved.trends) && saved.stats.buckets.length === 3 && /Natural Nights/.test(saved.trends) && /Fluids before bed vs wet rate/.test(saved.trends), JSON.stringify(saved.stats));
        await page.evaluate(() => { document.querySelectorAll('.toast,#toast,[class*=toast]').forEach(t => t.style.display = 'none'); const tl = [...document.querySelectorAll('#calDayDetail .nn-tl')].pop(); const card = tl.closest('div').parentElement; window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100); }); await sl(100);
        await page.evaluate(() => { const tl = [...document.querySelectorAll('#calDayDetail .nn-tl')].pop(); let c = tl; while (c.parentElement && c.parentElement.id !== 'calDayDetail') c = c.parentElement; c.id = 'nnCalCard'; c.scrollIntoView({ block: 'start' }); });
        await sl(150); const card = await page.$('#nnCalCard'); await card.screenshot({ path: `/workspace/screens/v7-calendar-day.png` });
        // export v4 round trip + campaign exclusion + old imports
        const rt = await page.evaluate(() => {
          const C = BSCalendar; const a = C.exportObject(); const txt = JSON.stringify(a);
          const p = C.parseImport(txt); const x = p.entries.find(y => y.mode === 'natural_night');
          C.wipe(); C.importJSONText(txt, 'replace'); const b = C.exportObject();
          const same = JSON.stringify(a.entries) === JSON.stringify(b.entries);
          const v1 = C.parseImport(JSON.stringify({ version: 1, entries: [{ id: 'q1', ts: Date.now() - 864e5, type: 'night', source: 'manual', night: { wet: true } }] }));
          const v3 = C.parseImport(JSON.stringify({ app: 'bladder-sim-calendar', version: 3, entries: [{ id: 'q3', ts: Date.now() - 864e5, type: 'night', source: 'natural', night: { wet: false } }] }));
          const camp = window.BSCampaign && typeof BSCampaign.progress === 'function' ? BSCampaign.progress() : null;
          return { ver: a.version, same, tl: x && x.night.nn.timeline.length, v1: v1.entries.length, v3: v3.entries.length, camp };
        });
        check(`${tag} v7 export v4 round trip (byte-identical), v1/v3 import still OK`, rt.ver === 4 && rt.same && rt.tl > 5 && rt.v1 === 1 && rt.v3 === 1, JSON.stringify(rt));
        const campSrc = await page.evaluate(() => { try { return String(Object.values(window.BSCampaign || {}).filter(f => typeof f === 'function').join('')); } catch (e) { return ''; } });
        check(`${tag} v7 natural-night entries never count as campaign progress (campaign uses sim-only filter)`, /source === 'sim'/.test(campSrc) || /e\.source === 'sim'/.test(require('fs').readFileSync('js/campaign.js', 'utf8')), '');
        const src = require('fs').readFileSync('js/natural-night.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        check(`${tag} v7 natural-night.js never sounds/vibrates/schedules/creates sim events`, !/vibrate|playChime|startChime|Audio\(|AudioContext|LocalNotifications|schedule\(|source: 'sim'|calendarAutoLog/.test(src));
        // office wording + messy toggle
        const off = await page.evaluate(async () => { BSOffice.set(true); localStorage.setItem('messyModeEnabled', 'false'); BSNight.begin({ drinks: [] }); BSNight.open(); await new Promise(r => setTimeout(r, 100));
          BSNight.wake(); BSNight.open(); document.getElementById('nnOptCheck').click(); await new Promise(r => setTimeout(r, 120));
          const t = document.getElementById('nnOverlay').textContent; const messy = !!document.querySelector('input[name=nnCM]'); BSNight.cancel(); BSOffice.set(false); return { t, messy }; });
        check(`${tag} v7 office wording applied in Natural Night UI; messy hidden when off`, !/saturation|protection|pee\b|leak/i.test(off.t) && /capacity|gear/i.test(off.t) && !off.messy, off.t.slice(0, 200));
        // night screen layout
        await page.evaluate(() => { BSNight.begin({ drinks: [] }); BSNight.open(); });
        await sl(80);
        const lay = await page.evaluate(() => { const small = []; document.querySelectorAll('#nnOverlay button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width && (r.height < 44 || r.width < 44)) small.push(b.id); }); const r = document.documentElement.clientWidth; const wide = [...document.querySelectorAll('#nnOverlay *')].filter(el => el.getBoundingClientRect().right > r + 1).length; return { small, wide }; });
        check(`${tag} v7 night UI targets ≥44px, no overflow`, lay.small.length === 0 && lay.wide === 0, JSON.stringify(lay));
        await page.evaluate(() => BSNight.cancel());
      }
    }
    check(`${tag}: zero console/page errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // ================= v8: Natural Night discoverability + My Potty Profile =================
  {
    const sl = ms => new Promise(r => setTimeout(r, ms));
    const ctx8 = await browser.createBrowserContext(); const page = await ctx8.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('dialog', d => d.accept());
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // Fake an evening clock (21:30 local) so the evening card shows deterministically
    await page.evaluateOnNewDocument(() => { const R = Date; const d0 = new R(); d0.setHours(21, 30, 0, 0); const off = d0.getTime() - R.now();
      class FD extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } } window.Date = FD; });
    await page.goto(URL, { waitUntil: 'networkidle0' }); await sl(1200);
    await page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; localStorage.setItem('profileMode', 'babysitter'); });
    await page.click('#tabBar [data-go=session]'); await sl(200);
    const ev = await page.evaluate(() => { const c = document.getElementById('nnEveningCard'); const r = c.getBoundingClientRect(); const first = document.getElementById('tab-session').firstElementChild; return { vis: getComputedStyle(c).display !== 'none' && r.height >= 44, first: first === c, t: c.textContent, day: BSNight.isEvening(new Date(2026, 0, 1, 14).getTime()), eve: BSNight.isEvening(new Date(2026, 0, 1, 19, 5).getTime()) }; });
    check('v8 evening card at top of Session tab after 7pm', ev.vis && ev.first && /Going to bed\? Start Natural Night/.test(ev.t) && !ev.day && ev.eve, JSON.stringify(ev));
    await page.screenshot({ path: '/workspace/screens/v8-evening-card.png' });
    await page.click('#nnEveningCard'); await sl(150);
    check('v8 evening card opens Natural Night bedtime', await page.evaluate(() => !!document.getElementById('nnBedtime')));
    await page.evaluate(() => BSNight.close());
    await page.evaluate(() => showSessionSetupModal()); await sl(250);
    const pk = await page.evaluate(() => { const b = document.getElementById('pickNaturalNight'); const r = b.getBoundingClientRect(); return { vis: r.height >= 44 && r.width > 200, t: b.textContent, sim: /Bedwetting — Sim/.test(document.getElementById('sessionTypeStep').textContent) }; });
    check('v8 picker shows "Bedwetting — Natural Night (real, silent, no sim wetting)" beside sim bedwetting', pk.vis && /Bedwetting — Natural Night/.test(pk.t) && /silent/.test(pk.t) && /no sim wetting/i.test(pk.t) && pk.sim, JSON.stringify(pk));
    await page.evaluate(() => document.getElementById('pickNaturalNight').scrollIntoView({ block: 'center' })); await sl(100);
    await page.screenshot({ path: '/workspace/screens/v8-picker.png' });
    await page.click('#pickNaturalNight'); await sl(200);
    const ln = await page.evaluate(() => ({ bed: !!document.getElementById('nnBedtime'), modal: getComputedStyle(document.getElementById('sessionSetupBackdrop')).display, run: typeof sessionRunning !== 'undefined' && sessionRunning }));
    check('v8 picker option launches Natural Night bedtime screen (modal closed, no sim session)', ln.bed && ln.modal === 'none' && !ln.run, JSON.stringify(ln));
    await page.evaluate(() => BSNight.close());
    // ---- report: missing data ----
    await page.evaluate(() => { localStorage.removeItem('bs_quiz_v1'); localStorage.removeItem('bs_calibration_v1'); localStorage.removeItem('bs_potty_report_v1'); BSCalendar.wipe(); });
    await page.click('#tabBar [data-go=profiles]'); await sl(200);
    const ms = await page.evaluate(() => { const r = BSReport.build(); return { missing: r.missing, ui: !!document.getElementById('prMissing'), txt: document.getElementById('pottyReportMount').textContent, text: BSReport.toText(r) }; });
    check('v8 report: missing data → prompts to take quiz/calibration', ms.missing && ms.ui && /Quiz A/.test(ms.txt) && /Calibration/.test(ms.txt) && /Not enough data/.test(ms.text), ms.txt.slice(0, 160));
    // ---- seed profiles ----
    const seed = (lvl) => page.evaluate((lvl) => {
      const Q = BSQuiz; const a = {}, b = {};
      Q.QA.forEach(q => { if (q.multi) a[q.id] = lvl === 'low' ? ['giggle_incontinence', 'urge_incontinence'] : ['none']; else a[q.id] = lvl === 'low' ? q.opts[q.opts.length - 1].v : q.opts[0].v; });
      a.protDay = lvl === 'low' ? 'diapers' : 'none'; a.protNight = lvl === 'low' ? 'thick_diapers' : 'none'; a.protFeel = lvl === 'low' ? 'love' : 'backup'; a.structure = 'like';
      Object.assign(b, { symptoms: lvl === 'low' ? ['nocturnal_wetter', 'giggle_incontinence'] : ['urge_incontinence'], intensity: 2, styles: lvl === 'low' ? ['babysitter', 'bedwetting', 'dependent'] : ['training', 'omorashi'], goal: lvl === 'low' ? 'bedwetting' : 'more', time: 2, startPref: 0, discipline: 'gentle', permission: 1, consequences: 1, rewards: 'praise', protPref: 'auto', checks: 1, nightFocus: lvl === 'low' ? 2 : 0, officeFriendly: false });
      localStorage.setItem('bs_quiz_v1', JSON.stringify({ a, b })); Q.finish();
      localStorage.setItem('bs_calibration_v1', JSON.stringify({ version: 1, form: {}, trials: lvl === 'low' ? [{ id: 't1', ts: Date.now() - 864e5, age: 30, sex: 'na', durationSec: 14, volumeMl: 160 }, { id: 't2', ts: Date.now(), age: 30, sex: 'na', durationSec: 16, volumeMl: 180 }] : [{ id: 't1', ts: Date.now(), age: 30, sex: 'na', durationSec: 24, volumeMl: 420 }] }));
      BSCalendar.wipe(); const now = Date.now();
      for (let i = 1; i <= 10; i++) { const wet = lvl === 'low' ? i % 5 !== 0 : i === 7; const prot = lvl === 'low' ? (i <= 5 ? 'pullups' : 'diapers') : 'none';
        BSCalendar.addEntry({ ts: now - i * 864e5, type: 'night', source: 'natural', mode: 'natural_night', night: { wet, protected: prot !== 'none', protection: prot, leaked: lvl === 'low' && wet && prot === 'pullups', saturation: wet ? (lvl === 'low' ? 85 : 30) : 0, wokeCount: lvl === 'low' ? 0 : 1, woke: lvl !== 'low',
          nn: { bedtime: now - i * 864e5 - 8 * 36e5, wakeAt: now - i * 864e5, riseAt: now - i * 864e5, wakes: lvl === 'low' ? 0 : 1, sleepMin: 450, fluidBeforeBedMl: wet ? 550 : 250, drinks: [], timeline: [] } } }); }
      return true; }, lvl);
    const out = {};
    for (const lvl of ['high', 'low']) {
      await seed(lvl);
      await page.evaluate(() => document.getElementById('prRegen').click()); await sl(150);
      out[lvl] = await page.evaluate(() => { const r = BSReport.build(); return { tone: r.tone, score: r.toneScore, n: r.sections.length, text: BSReport.toText(r), ui: document.getElementById('prBody').textContent, rec: BSReport.recommendWear(BSReport.gather()) }; });
      fs.writeFileSync(`/workspace/screens/v8-report-sample-${lvl}.md`, out[lvl].text);
    }
    const H = out.high, L = out.low;
    const META = /quiz|calibration|game stat|GAME STAT|campaign|\bsim\b|in-game|score|trial|%/i;
    const body = t => t.split('\n---\n')[0];
    check('v9 profile: no meta words in body (both levels)', [H, L].every(x => !META.test(body(x.text))), [H, L].map(x => (body(x.text).match(META) || [''])[0]).join(','));
    check('v9 profile: footer present', [H, L].every(x => /Pretend check-up for fun, not medical advice/.test(x.text) && /real doctor/.test(x.text)));
    check('v9 profile low: in-character caregiver diagnosis (little bladder age, wet the bed, can\'t hold)', /little bladder age/.test(L.text) && /wet the bed/.test(L.text) && /can't hold it for long/.test(L.text) && /Mommy/.test(L.text), '');
    check('v9 profile: wear rec in-character', /you'll wear/.test(L.text), '');
    const vt = await page.evaluate(() => { const t = {}; for (const v of ['caregiver', 'babysitter', 'coach']) t[v] = BSReport.toText(BSReport.build({ voice: v })); BSOffice.set(true); t.office = BSReport.build({ voice: 'caregiver' }).voice; BSOffice.set(false); return t; });
    check('v9 profile voices differ; coach has no Mommy/sitter; office forces coach', /Mommy/.test(vt.caregiver) && /sitter/.test(vt.babysitter) && !/Mommy|sitter|sweetie|kiddo/.test(vt.coach) && vt.office === 'coach', vt.office);
    check('v13 profile: long sections (likely/unlikely/typical day/night/watch/tips/fun fact) in both levels, text differs by level', [H, L].every(x => /Likely for you/.test(x.text) && /Unlikely for you/.test(x.text) && /typical day/i.test(x.text) && /typical night/i.test(x.text) && /What to watch for/.test(x.text) && /Tips from/.test(x.text) && /Fun fact/.test(x.text) && x.text.length > 2000) && H.text.split('typical day')[1].slice(0, 200) !== L.text.split('typical day')[1].slice(0, 200), [H.text.length, L.text.length].join(','));
    check('v13 quizzes longer: A ≥ 34, B ≥ 26, new Quiz C (16) with a personality result', await page.evaluate(() => { const Q = BSQuiz; const r = Q.scoreC({ c1: 'brave', c2: 'brave', c3: 'cozy' }); return Q.questions('a').length >= 34 && Q.questions('b').length >= 26 && Q.questions('c').length === 16 && r.type === 'brave' && /Brave/.test(r.title); }));
    check('v13 campaign setup: 17 extra optional questions stored as prefs', await page.evaluate(() => { const o = BSCampaign.optsFromQuiz({ level: 'okay', prefs: { satRule: '75', afterAcc: 'wait' } }); const w = openCampaignSetup(); const n = BSCampaign.setupSteps().filter(x => x.more).length; w.remove(); /* v18: stepper */ return BSCampaign.MORE_Q.length >= 15 && n === BSCampaign.MORE_Q.length && o.prefs.satRule === '75'; }));
    fs.writeFileSync('/workspace/screens/v9-profile-sample.md', '<!-- Caregiver voice, low-continence sample -->\n' + L.text + '\n\n<!-- Babysitter voice -->\n' + vt.babysitter + '\n\n<!-- Neutral coach voice -->\n' + vt.coach);
    check('v8 wear recommendation from leak/saturation data (low → step above leaky pull-ups; high → light)', L.rec.tier === 'diapers' || L.rec.tier === 'thick_diapers', JSON.stringify({ L: L.rec.tier, H: H.rec.tier, why: L.rec.why }));
    check('v8 wear recommendation high continence is light', ['none', 'pad'].includes(H.rec.tier), H.rec.tier);
    await sl(2600); await page.evaluate(() => { document.querySelectorAll('.toast,#toast,[class*=toast]').forEach(t => t.style.display = 'none'); const m = document.getElementById('pottyReportMount'); window.scrollTo(0, m.getBoundingClientRect().top + window.scrollY - 100); }); await sl(150);
    await page.screenshot({ path: '/workspace/screens/v8-report-top.png' }); await page.screenshot({ path: '/workspace/screens/v9-profile.png' });
    const lay = await page.evaluate(() => { const cw = document.documentElement.clientWidth; return { wide: [...document.querySelectorAll('#pottyReportMount *')].filter(e => e.getBoundingClientRect().right > cw + 1).length, small: [...document.querySelectorAll('#pottyReportMount button')].filter(b => b.getBoundingClientRect().height < 44).map(b => b.id) }; });
    check('v8 report layout: no overflow, buttons ≥44px', lay.wide === 0 && lay.small.length === 0, JSON.stringify(lay));
    // office + messy
    const om = await page.evaluate(() => { BSOffice.set(true); const r = BSReport.build(); const t = BSReport.toText(r); BSOffice.set(false); localStorage.setItem('messyModeEnabled', 'false'); const nm = BSReport.toText(BSReport.build()); localStorage.setItem('messyModeEnabled', 'true'); const ym = BSReport.toText(BSReport.build()); localStorage.setItem('messyModeEnabled', 'false'); return { tone: r.tone, tn: typeof r.tone, potty: /potty|diaper|bedwetting/i.test(t), nm: /#2 close calls/.test(nm), ym: /#2 close calls|type B/.test(ym) }; });
    check('v9 report office mode → neutral tone + neutral wording', om.tone === 0 && !om.potty, JSON.stringify(om));
    const sh = await page.evaluate(async () => { window._shared = null; navigator.clipboard.writeText = async t => { window._shared = t; }; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); const how = await BSReport.share(BSReport.build()); return { how, len: (window._shared || '').length }; });
    check('v8 report export/share as text', sh.how === 'clipboard' && sh.len > 400, JSON.stringify(sh));
    // ---- v9 Simple Urge ----
    await page.click('#tabBar [data-go=urge]'); await sl(250);
    const su = await page.evaluate(() => {
      const S = BSSimpleUrge; localStorage.removeItem('bs_inventory_v1'); localStorage.removeItem('bs_simple_urge_state'); S.saveSettings({ profileId: 'okay', askUrgency: false }); S.render();
      const r = {}; r.def = S.invText();
      r.btn = !!document.getElementById('suGo') && !!document.getElementById('simpleUrgeMount').offsetHeight;
      r.classicHidden = !document.getElementById('classicUrge').open;
      const p = S.profile(); r.prof = p;
      const seq = [0.0, 0.5]; let k = 0; const rng = () => seq[k++ % 2];
      const cnt = {}; let rs = 1; const rr = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
      for (let i = 0; i < 400; i++) { const o = S.roll({ urgency: 5, rng: rr, fastFill: false, quietSignals: false }).outcome; cnt[o] = (cnt[o] || 0) + 1; }
      const cq = {}; for (let i = 0; i < 400; i++) { const o = S.roll({ urgency: 5, rng: rr, quietSignals: true }).outcome; cq[o] = (cq[o] || 0) + 1; }
      r.cnt = cnt; r.cq = cq;
      const w1 = S.roll({ urgency: 5, rng: () => 0.35, profile: Object.assign({}, p, { odds: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 }, hold: [10, 20] }) });
      const w2 = S.roll({ urgency: 5, rng: () => 0.35, fastFill: true, profile: Object.assign({}, p, { odds: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 }, hold: [10, 20] }) });
      r.w1 = w1.waitMin; r.w2 = w2.waitMin; r.wText = w1.text;
      // force a wait press → countdown + single native alarm
      S.saveSettings({ oddsOverride: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 } });
      const calN = BSCalendar.load().entries.length;
      const pr = S.press(6); r.press = pr.outcome; r.cal = BSCalendar.load().entries.length - calN;
      r.alarm = S.pendingAlarm(); r.desired = [...BSNativeAlarm.collectDesired().keys()];
      r.count = !!document.getElementById('suCount');
      // gear → inventory
      S.saveSettings({ oddsOverride: { go: 0, wait: 0, hard: 0, dribble: 0, gear: 1 } });
      localStorage.removeItem('bs_simple_urge_state'); const g = S.press(8); r.gear = g.outcome; r.gearGuide = !!(g.gear && g.gear.guide.length); r.afterGear = S.inv().wetCount;
      { const i0 = S.inv(); i0.spares = { pad: 0, pullups: 2, diapers: 1, thick_diapers: 0 }; i0.day = new Date().toDateString(); S.saveInv(i0); }
      r.ch = S.change('pullup'); r.afterCh = S.inv(); r.ch2 = S.change('pullup'); r.ch3 = S.change('pullup');
      S.saveSettings({ oddsOverride: null });
      r.log = document.getElementById('output') ? /Simple urge/.test(document.body.innerHTML) : true;
      return r;
    });
    check('v9 simple urge is default view (big button, classic collapsed)', su.btn && su.classicHidden);
    check('v11 inventory default from report day rec (shared protection list, 2 spares)', /Wearing: /.test(su.def) && /Spares: 2 /.test(su.def), su.def);
    check('v9 roll gives all outcome kinds with short text', Object.keys(su.cnt).length === 5 && /^Wait \d+ min, then roll again\.$/.test(su.wText), JSON.stringify(su.cnt));
    check('v9 Quiet Signals → more dribble rolls; Fast Fill → shorter waits', (su.cq.dribble || 0) > (su.cnt.dribble || 0) && su.w2 < su.w1, `${su.cnt.dribble}->${su.cq.dribble}, wait ${su.w1}->${su.w2}`);
    check('v9 wait → countdown + ONE native reminder (id 1950) + calendar log', su.press === 'wait' && su.count && su.alarm && su.alarm.id === 1950 && su.desired.filter(x => x === 1950).length === 1 && su.cal === 1, JSON.stringify({ a: su.alarm, d: su.desired }));
    check('v9 gear → event guide + inventory decrement on change', su.gear === 'gear' && su.gearGuide && su.afterGear === 1 && su.ch && su.afterCh.spares.pullups === 1 && su.afterCh.wetCount === 0 && su.ch2 && su.ch3 === false, JSON.stringify([su.gear, su.gearGuide, su.afterGear, su.ch, su.ch2, su.ch3, su.afterCh]));
    await page.evaluate(() => { BSSimpleUrge.saveSettings({ oddsOverride: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 } }); BSSimpleUrge.press(5); BSSimpleUrge.saveSettings({ oddsOverride: null }); window.scrollTo(0, 0); }); await sl(1100);
    await page.screenshot({ path: '/workspace/screens/v9-urge-wait.png' });
    await page.evaluate(() => { BSSimpleUrge.saveSettings({ oddsOverride: { go: 0, wait: 0, hard: 0, dribble: 0, gear: 1 } }); BSSimpleUrge.press(8); BSSimpleUrge.saveSettings({ oddsOverride: null }); }); await sl(200);
    await page.screenshot({ path: '/workspace/screens/v9-urge-gear.png' });
    await page.evaluate(() => { document.getElementById('suMore').open = true; }); await sl(150);
    await page.screenshot({ path: '/workspace/screens/v9-urge-profile.png', fullPage: true });
    const ul = await page.evaluate(() => { const cw = document.documentElement.clientWidth; return [...document.querySelectorAll('#simpleUrgeMount *')].filter(e => e.getBoundingClientRect().right > cw + 1).length; });
    check('v9 simple urge layout: no overflow', ul === 0, String(ul));
    // ---- v9 prompt output ----
    const po = await page.evaluate(() => {
      const r = {}; let vib = 0; navigator.vibrate = () => { vib++; return true; };
      BSSimpleUrge.saveSettings({ oddsOverride: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 } }); BSSimpleUrge.press(5); BSSimpleUrge.saveSettings({ oddsOverride: null });
      BSPrompt.set('sound'); r.ch = BSPrompt.channel(); r.ping = BSPrompt.ping(); r.vib = vib;
      r.desiredCh = [...BSNativeAlarm.collectDesired().values()].map(x => x.channel);
      BSPrompt.set('vibrate'); r.chV = BSPrompt.channel(); r.pingV = BSPrompt.ping();
      BSPrompt.set('silent'); r.pingS = BSPrompt.ping();
      BSPrompt.set('both'); r.chB = BSPrompt.channel();
      r.ui = !!document.getElementById('poMode');
      return r;
    });
    check('v9 prompt output sound-only: tone, no vibration, native channel sound-no-vibrate', po.ch === 'sound-no-vibrate' && po.ping.sound && !po.ping.vibrate && po.vib === 0 && po.desiredCh.every(c => c === 'sound-no-vibrate') && po.desiredCh.length >= 1, JSON.stringify(po));
    check('v9 prompt output vibrate/silent/both + settings UI', po.chV === 'vibrate-only' && po.pingV.vibrate && !po.pingV.sound && !po.pingS.sound && !po.pingS.vibrate && po.chB === null && po.ui, '');
    const srcJ = fs.readFileSync(__dirname + '/../android/app/src/main/java/dev/simpledl/bladdersim/alarm/AlarmScheduler.java', 'utf8');
    const blk = srcJ.slice(srcJ.indexOf('getNotificationChannel(CHANNEL_SOUND_NO_VIBRATE)'), srcJ.indexOf('getNotificationChannel(CHANNEL_VIBRATE_ONLY)'));
    check('v9 native channel "sound-no-vibrate": sound set, vibration disabled', /"sound-no-vibrate"/.test(srcJ) && /setSound\(snd/.test(blk) && /enableVibration\(false\)/.test(blk));
    check('v8 zero console/page errors', errs.length === 0, errs.join(' | '));
    await ctx8.close();
  }
  // v10 Random #2 timer
  {
    const c10 = await browser.createBrowserContext(); const page = await c10.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('dialog', d => d.accept());
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(URL, { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; applyMessyVisibility(false); });
    await page.click('#tabBar [data-go=urge]'); await new Promise(r => setTimeout(r, 300));
    const off = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('messyTimerMount')).display !== 'none', start: BSMessyTimer.start({ level: 'none', lo: 1, hi: 2 }) }));
    check('v10 messy timer hidden + inert when messy off', !off.vis && off.start === null, JSON.stringify(off));
    await page.evaluate(() => { localStorage.setItem('messyModeEnabled', 'true'); applyMessyVisibility(true); BSMessyTimer.render(); });
    await page.evaluate(() => { const d = document.getElementById('suMore'); if (d) d.open = true; }); await page.select('#mtLevel', 'little'); await page.click('#mtStart'); await new Promise(r => setTimeout(r, 200));
    const run = await page.evaluate(() => { const s = BSMessyTimer.state(); const t = document.getElementById('messyTimerMount').textContent;
      return { vis: getComputedStyle(document.getElementById('messyTimerMount')).display !== 'none', due: s.dueAt > Date.now(), hidden: !/\d+:\d\d/.test(t) && /hidden/.test(t), alarm: [...BSNativeAlarm.collectDesired().keys()].includes(BSMessyTimer.ALARM_ID) }; });
    check('v10 messy timer visible when on, starts hidden countdown + one native alarm', run.vis && run.due && run.hidden && run.alarm, JSON.stringify(run));
    await page.screenshot({ path: '/workspace/screens/v10-messy-timer-running.png' });
    const fired = await page.evaluate(() => { const s = BSMessyTimer.state(); localStorage.setItem('bs_messy_timer_v1', JSON.stringify(Object.assign(s, { dueAt: Date.now() - 1000, earlyDone: true }))); BSMessyTimer.tick();
      const n = BSMessyTimer.state(); const logT = document.getElementById('output') ? document.getElementById('output').textContent : document.body.textContent;
      const cal = JSON.parse(localStorage.getItem('bs_calendar_v2') || localStorage.getItem('bs_calendar_v1') || '{"entries":[]}').entries || [];
      return { last: n.last, due: n.dueAt, logged: /Random #2 timer \(Little\)/.test(logT), cal: cal.some(e => e.mode === 'messy_timer'), res: !!document.getElementById('mtResult'), good: BSMessyTimer.outcome('good', () => 0.5).kind, none: BSMessyTimer.outcome('none', () => 0.01).kind };
    });
    check('v10 messy timer fires, logs to session log + calendar', fired.last && fired.due === 0 && fired.logged && fired.cal && fired.res && fired.good === 'potty' && fired.none === 'gear', JSON.stringify(fired));
    await page.screenshot({ path: '/workspace/screens/v10-messy-timer.png' });
    check('v10 zero console/page errors', errs.length === 0, errs.join(' | '));
    await c10.close();
  }

  // ================= v11 =================
  {
    const c11 = await browser.createBrowserContext(); const page = await c11.newPage(); const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(URL, { waitUntil: 'networkidle0' }); const sl = ms => new Promise(r => setTimeout(r, ms)); await sl(1000);
    await page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; });
    await page.click('#tabBar [data-go=urge]'); await sl(250);
    // wear rule
    const wr = await page.evaluate(() => {
      const mk = (protDay, protNight, nightsAns, feel) => ({ a: { nights: nightsAns }, base: { protDay, protNight, protFeel: feel }, nights: [], nn: null });
      const r1 = BSReport.recommendWear(mk('diapers', 'none', 0, 'avoid')), r2 = BSReport.recommendWear(mk('pad', 'diapers', 1));
      const P = ['none', 'pad', 'pullups', 'diapers', 'thick_diapers'];
      return { n1: r1.night, d1: r1.day, n2: r2.night, ok1: P.indexOf(r1.night) >= P.indexOf(r1.day), why: r1.why.join('|') + r2.why.join('|') };
    });
    check('v11 wear rule: night >= day, quiz night answer as floor, no "—" why', wr.ok1 && wr.n1 === 'diapers' && wr.n2 === 'diapers' && !/—/.test(wr.why) && /quiz says/.test(wr.why), JSON.stringify(wr));
    // no inference
    const ni = await page.evaluate(async () => {
      openNightCheckin({ source: 'sim', hint: { wet: true } }); await new Promise(r => setTimeout(r, 100));
      const w = document.querySelector('.cal-sheet-wrap'); const r = { wetChecked: !!w.querySelector('input[name=ncWet]:checked'), urg: w.querySelector('#ncUrgV').textContent, sat: w.querySelector('#ncSatV').textContent, hint: !!w.querySelector('#ncHint') };
      const n0 = BSCalendar.load().entries.length; w.querySelector('[data-s]').click(); r.blocked = !!document.body.contains(w) && BSCalendar.load().entries.length === n0;
      w.querySelector('input[name=ncWet][value="0"]').click(); w.querySelector('[data-s]').click();
      const e = BSCalendar.load().entries.slice(-1)[0]; r.savedUrg = e.urgency; r.savedSat = e.saturation;
      const S = BSSimpleUrge.settings(); r.calib = S.useCalib; r.ask = S.askUrgency;
      return r;
    });
    check('v11 no inference: check-in opens blank (hint only), requires answer, sliders unset; calibration opt-in off; ask urgency on', !ni.wetChecked && ni.urg === '—' && ni.sat === '—' && ni.hint && ni.blocked && ni.savedUrg === undefined && ni.savedSat === undefined && ni.calib === false && ni.ask === true, JSON.stringify(ni));
    // drink cap
    const dc = await page.evaluate(() => {
      const B = BSSafety; B.reset(); const t0 = new Date(); t0.setHours(6, 0, 0, 0); const T = t0.getTime(), h = 36e5;
      const a = B.capDrink(400, { now: T }), b = B.capDrink(100, { now: T + 30 * 60000 });
      const c = [2, 4, 6].map(i => B.capDrink(250, { now: T + i * h }).ml); const d = B.capDrink(250, { now: T + 8 * h });
      B.reset(); return { a: a.ml, aR: a.reason, b: b.ok, bR: b.reason, c, d: d.ok, dR: d.reason, txt: B.capText('Drink 400ml before bed. Drink a full coffee/tea.') };
    });
    check('v11 drink cap: <=250 ml/prompt, >=2 h apart, <=1 L/day, text capped', dc.a === 250 && dc.aR === 'capped' && !dc.b && dc.bR === 'spacing' && dc.c.join() === '250,250,250' && !dc.d && dc.dR === 'daily' && /250ml/.test(dc.txt) && !/400/.test(dc.txt), JSON.stringify(dc));
    // urge levels screenshot
    await page.evaluate(() => { const S = BSSimpleUrge; const i = S.inv(); i.day = new Date().toDateString(); i.wearing = 'pullups'; i.spares = { pad: 1, pullups: 2, diapers: 1, thick_diapers: 0 }; S.saveInv(i); S.saveSettings({ profileId: 'match', askUrgency: true, lastUrgency: null }); S.render(); window.scrollTo(0, 0); }); await sl(200);
    const lv = await page.evaluate(() => ({ opts: [...document.querySelectorAll('#suProf option')].map(o => o.value), chip: !!document.getElementById('ctlChip') }));
    check('v11 urge control ladder (Full..None + Match) and Control chip in Urge header', ['match', 'full', 'good', 'okay', 'shaky', 'little', 'none'].every(k => lv.opts.includes(k)) && lv.chip, JSON.stringify(lv));
    await page.screenshot({ path: '/workspace/screens/v11-urge-levels.png' });
    // hidden wait
    const hw = await page.evaluate(() => {
      const S = BSSimpleUrge; S.saveSettings({ profileId: 'okay', hideWaits: true, oddsOverride: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 } }); /* v18: no wait-for-potty at None */
      const r = S.press(null); const box = document.getElementById('suResult');
      const out = { hidden: r.hidden, text: box.textContent, count: !!document.getElementById('suCount'), hid: !!document.getElementById('suHidden'), alarm: !!S.pendingAlarm(), urg: r.urgency };
      S.saveSettings({ profileId: 'good', hideWaits: false }); const r2 = S.roll({ urgency: 5, rng: () => 0.3 }); out.goodText = r2.text; S.saveSettings({ profileId: 'none' });
      return out;
    });
    await page.screenshot({ path: '/workspace/screens/v11-hidden-wait.png' });
    const rv = await page.evaluate(() => { const st = BSSimpleUrge.state(); st.waitUntil = Date.now() - 500; localStorage.setItem('bs_simple_urge_state', JSON.stringify(st)); return new Promise(r => setTimeout(() => r({ rev: (document.getElementById('suReveal') || {}).textContent || '' }), 1400)); });
    check('v11 hidden wait shows only "✋ Wait" (no time, hidden countdown, one alarm), reveals on finish; Good shows minutes; urgency unset = null', hw.hidden && !/\d/.test(hw.text) && /✋ Wait/.test(hw.text) && !hw.count && hw.hid && hw.alarm && hw.urg === null && /Wait \d+ min/.test(hw.goodText) && /waited \d+ min/.test(rv.rev), JSON.stringify([hw, rv]));
    // couldn't-wait flow + campaign
    await page.evaluate(() => { BSCampaign.startFromQuiz({ experience: 'some', level: 'okay', direction: 'progress', length: 'standard', playStyle: 'natural' }); BSControl.saveSettings({ value: 70 }); const S = BSSimpleUrge; S.saveSettings({ profileId: 'okay' }); S.press(4); window.scrollTo(0, 0); }); await sl(200);
    const pre = await page.evaluate(() => ({ btn: !!document.getElementById('suAcc'), quick: !!document.getElementById('suLogAcc'), v: BSControl.load().value, wet: BSSimpleUrge.inv().wetCount, sp: BSSimpleUrge.inv().spares.pullups, roll: BSSimpleUrge.state().last.id, instr: BSSimpleUrge.state().last.text }));
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#suAcc').click(); }); await sl(200);
    await page.evaluate(() => { const w = document.getElementById('accSheet'); w.querySelector('input[name=acSev][value=full]').click(); w.querySelector('#acProt').value = 'pullups'; const u = w.querySelector('#acUb'); u.value = 90; u.dispatchEvent(new Event('input')); w.querySelector('#acRel').value = 60; w.querySelector('#acRel').dispatchEvent(new Event('input')); w.querySelector('#acMemo').value = 'e2e'; });
    await page.screenshot({ path: '/workspace/screens/v11-accident-sheet.png' });
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#acSave').click(); }); await sl(250);
    const chg = await page.evaluate(() => ({ roll: !!document.getElementById('chgRoll'), old: !!document.getElementById('accChange') }));
    await page.evaluate(() => {
      const w = document.getElementById('chgRoll');
      if (w) { const sat = w.querySelector('#chgSat'); if (sat && !sat.dataset.set) { sat.value = 70; sat.dataset.set = '1'; sat.dispatchEvent(new Event('input')); } w.querySelector('#chgGo').click();
        setTimeout(() => { const b = w.querySelector('[data-chg=pullups]'); if (b) b.click(); else w.querySelector('[data-x]').click(); }, 50); }
      else { const b = document.querySelector('#accChange [data-chg=pullups]'); b && b.click(); }
    }); await sl(250);
    const acc = await page.evaluate(() => {
      const e = BSCalendar.load().entries.filter(x => x.failedWait).slice(-1)[0] || {}; const s = BSCampaign.load(); const sc = BSCampaign.scoreDay(s, BSCampaign.dayKey(Date.now()));
      const cap = sc.goals.find(g => g.id === 'cap');
      const sR = Object.assign({}, s, { rank: 3, target: 6 }); const leak = BSCampaign.scoreDay(sR, BSCampaign.dayKey(Date.now())).goals.find(g => g.id === 'simleaks');
      return { e, v: BSControl.load().value, hist: BSControl.load().history.slice(-1)[0], inv: BSSimpleUrge.inv(), cap: cap && cap.val, leak: leak && leak.val, ended: BSSimpleUrge.state().last.closed };
    });
    check('v11 couldn\'t-wait: button in wait, quick log button, natural entry tagged "during wait" linked to roll', pre.btn && pre.quick && acc.e.source === 'natural' && acc.e.type === 'accident' && (acc.e.tags || []).includes('during wait') && acc.e.link && acc.e.link.roll === pre.roll && acc.e.urgencyBefore === 90 && acc.e.releasedPct === 60 && acc.ended === 'accident', JSON.stringify(acc.e));
    check('v11 couldn\'t-wait: worn marked used, change prompt (May I change? or legacy), Control -2, campaign counts failed hold (progress cap + regress leaks)', (chg.roll || chg.old) && (acc.inv.wetCount >= pre.wet + 1 || acc.inv.changes >= 1) && acc.hist.kind === 'failed_wait' && acc.v < pre.v && acc.cap >= 1 && acc.leak >= 1, JSON.stringify({ pre, v: acc.v, inv: acc.inv, cap: acc.cap, leak: acc.leak, chg }));
    // control cap
    const cc = await page.evaluate(() => { const s = { value: 50, cap: 8, dayDelta: 0, lastDay: 'x' }; let t = 0; for (let i = 0; i < 20; i++) t += BSControl.applyDelta(s, 1, Date.now()).applied; return { t, v: s.value }; });
    check('v11 Control meter daily cap ±8', cc.t === 8 && cc.v === 58, JSON.stringify(cc));
    // custom profile via UI
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()); document.getElementById('suMore').open = true; }); await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#suNewProf').click(); }); await sl(150);
    await page.evaluate(() => { const w = [...document.querySelectorAll('.cal-sheet-wrap')].pop(); w.querySelector('#peName').value = 'Errand day'; w.querySelector('#peLo').value = 3; w.querySelector('#peHi').value = 9; w.querySelector('#peHidden').checked = true; });
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#peSave').click(); }); await sl(200);
    const cp = await page.evaluate(() => { const S = BSSimpleUrge, p = S.profile(); return { name: p.name, hold: p.hold, hidden: p.hiddenWait, sel: document.getElementById('suProf').value, n: S.customProfiles().length }; });
    check('v11 custom profile: create/save/switch (name, wait range, hidden toggle)', cp.name === 'Errand day' && cp.hold.join() === '3,9' && cp.hidden && cp.n === 1 && /^cp/.test(cp.sel), JSON.stringify(cp));
    // custom event editor
    await page.evaluate(() => BSSimpleUrge.openEventEditor(null)); await sl(150);
    await page.evaluate(() => { const w = [...document.querySelectorAll('.cal-sheet-wrap')].pop(); w.querySelector('#ceText').value = 'Finish your task first, then roll again'; w.querySelector('#ceW').value = 100; w.querySelector('[data-lvl=okay]').checked = true; w.querySelector('#ceTimer').value = 'hidden'; w.querySelector('#ceMin').value = 2; w.querySelector('#ceMax').value = 4; w.querySelector('#ceAddStep').click(); const r = w.querySelector('[data-step]'); r.querySelector('[data-st=text]').value = 'BREATHE'; r.querySelector('[data-st=type]').value = 'relax'; });
    await page.screenshot({ path: '/workspace/screens/v11-custom-event-editor.png' });
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#ceSave').click(); }); await sl(200);
    const ce = await page.evaluate(() => {
      const S = BSSimpleUrge; document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove());
      const ev = S.customEvents()[0]; const pOk = Object.assign({}, S.profile('okay'), { odds: { go: 0, wait: 0, hard: 0, dribble: 0, gear: 0 } });
      const r = S.roll({ urgency: 5, profile: pOk, rng: () => 0.5 }); const pGood = Object.assign({}, S.profile('good'), { odds: { go: 1, wait: 0, hard: 0, dribble: 0, gear: 0 } }); const r2 = S.roll({ urgency: 5, profile: pGood, rng: () => 0.99 });
      const ex = S.exportJSON(); localStorage.removeItem('bs_urge_events_v1'); localStorage.removeItem('bs_urge_profiles_v1'); const im = S.importJSON(ex);
      S.saveLevelOdds({ okay: { go: 1, wait: 2, hard: 3, dribble: 4, gear: 5 } }); const lo = S.ladderOdds('okay'); S.saveLevelOdds({});
      return { ev, out: r.outcome, hidden: r.hidden, txt: r.text, good: r2.outcome, im, lo, guide: ev && ev.guide[0] };
    });
    check('v11 custom event: editor saves text/weight/levels/hidden timer/guide; rolls at its level only; export/import; per-level tables', ce.ev && ce.out === 'custom' && ce.hidden && ce.good === 'go' && ce.guide && ce.guide.text === 'BREATHE' && ce.im.events === 1 && ce.im.profiles === 1 && ce.lo.gear === 5, JSON.stringify(ce));
    // quick natural session
    await page.evaluate(() => { BSSimpleUrge.saveSettings({ profileId: 'okay', oddsOverride: null }); BSSimpleUrge.render(); window.scrollTo(0, 0); }); await sl(100);
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#suSessStart').click(); }); await sl(150);
    await page.evaluate(() => { const w = [...document.querySelectorAll('.cal-sheet-wrap')].pop(); w.querySelector('#nsWear').value = 'diapers'; w.querySelector('#nsC_diapers').value = 2; });
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#nsGo').click(); }); await sl(150);
    await page.evaluate(() => { const S = BSSimpleUrge; localStorage.removeItem('bs_simple_urge_follow'); S.saveSettings({ oddsOverride: { go: 1, wait: 0, hard: 0, dribble: 0, gear: 0 } }); S.press(3); S.saveSettings({ oddsOverride: null }); BSAccident.save({ ctx: 'nat_session', severity: 'dribble', protection: 'diapers' }); S.change('diapers'); S.render(); }); await sl(150);
    const nsOn = await page.evaluate(() => ({ chip: !!document.getElementById('nsChip'), acc: !!document.getElementById('nsAcc') }));
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').length; document.querySelector('#nsEnd').click(); }); await sl(200);
    await page.screenshot({ path: '/workspace/screens/v11-quick-session-summary.png' });
    const ns = await page.evaluate(() => { const s = BSNatSession.state(); const e = BSCalendar.load().entries.filter(x => x.mode === 'nat_session').slice(-1)[0]; return { active: BSNatSession.active(), sum: s.summary, cal: e && e.source, ui: !!document.getElementById('nsSummary') }; });
    check('v11 quick natural session: start with kit, gathers rolls/accidents/changes, summary saved to calendar', nsOn.chip && nsOn.acc && !ns.active && ns.sum.rolls === 1 && ns.sum.accidents === 1 && ns.sum.changes === 1 && ns.sum.used.some(x => x.k === 'diapers' && x.n === 1) && ns.cal === 'natural' && ns.ui, JSON.stringify(ns));

    // ================= v13: post-accident follow-up =================
    const fu = await page.evaluate(() => {
      const S = BSSimpleUrge, z = () => 0;
      return { dGood: S.followUpFor({ severity: 'dribble', level: 'good', rng: z }), dNone: S.followUpFor({ severity: 'dribble', level: 'none', rng: () => 0.99 }),
        lOkay: S.followUpFor({ severity: 'leak', level: 'okay', rng: z }), lShakyNoSat: S.followUpFor({ severity: 'leak', level: 'shaky', rng: z }),
        fHi: S.followUpFor({ severity: 'full', level: 'okay', sat: 95, rng: z }), fLo: S.followUpFor({ severity: 'full', level: 'okay', sat: 5, rng: z }) };
    });
    check('v13 follow-up rules: dribble at high control → finish on potty now; dribble at low → stay + 10–20 min wait', fu.dGood.kind === 'finish' && fu.dGood.waitMin === 0 && /finish on the potty/.test(fu.dGood.text) && fu.dNone.kind === 'stay' && fu.dNone.waitMin >= 10 && fu.dNone.waitMin <= 20, JSON.stringify([fu.dGood, fu.dNone]));
    check('v13 follow-up rules: small accident → change check via saturation rule; big accident → rest timer + change yes/no by saturation', fu.lOkay.check && fu.lOkay.kind === 'finish' && fu.lShakyNoSat.kind === 'wait' && fu.lShakyNoSat.waitMin >= 10 && fu.lShakyNoSat.change === 'ask' && fu.fHi.kind === 'rest' && fu.fHi.waitMin >= 15 && fu.fHi.change === 'yes' && fu.fLo.change === 'no' && fu.fHi.steps.some(x => /real urge always wins/i.test(x)), JSON.stringify([fu.lShakyNoSat, fu.fHi.steps]));
    await page.evaluate(() => { localStorage.removeItem('bs_simple_urge_follow'); BSSimpleUrge.saveSettings({ profileId: 'none', alarm: true }); switchTab('urge'); BSSimpleUrge.render(); }); await sl(100);
    const fu2 = await page.evaluate(() => {
      const n0 = BSCalendar.load().entries.length;
      const r = BSAccident.save({ ctx: 'simple_urge', severity: 'dribble', protection: 'diapers' });
      document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()); BSSimpleUrge.render();
      const el = document.getElementById('suFollow'), go = document.getElementById('suGo');
      const ents = BSCalendar.load().entries.filter(e => /^Follow-up — /.test(e.memo || ''));
      return { f: r.follow, ui: !!el, kind: el && el.dataset.kind, count: !!document.getElementById('suFCount'), locked: go.dataset.locked === '1', pressed: BSSimpleUrge.press(5), alarm: BSSimpleUrge.pendingAlarm(), cal: ents.length && ents[ents.length - 1], n: BSCalendar.load().entries.length - n0 };
    });
    await sl(1200);
    await page.evaluate(() => document.getElementById('suFollow').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: '/workspace/screens/v13-followup.png' });
    check('v13 follow-up UI: dribble at Infant → stay-in-protection step, visible countdown, roll locked, native alarm at timer end, logged to calendar', fu2.ui && fu2.kind === 'stay' && fu2.count && fu2.locked && fu2.pressed === null && fu2.alarm && fu2.alarm.at === fu2.f.until && /roll again/.test(fu2.alarm.body) && fu2.cal && fu2.cal.type === 'event' && /stay in your protection/.test(fu2.cal.memo), JSON.stringify(fu2));
    const fu3 = await page.evaluate(() => {
      const o = {}; BSOffice.set(true); BSSimpleUrge.render(); o.officeAlarm = BSSimpleUrge.pendingAlarm(); o.officeTxt = document.getElementById('suFollow').textContent; BSOffice.set(false);
      const pm = profileMode; profileMode = 'bedwetting'; o.bedAlarm = BSSimpleUrge.pendingAlarm(); profileMode = pm;
      document.getElementById('suFDone').click(); o.cleared = !BSSimpleUrge.followActive(); o.skipLogged = BSCalendar.load().entries.some(e => e.memo === 'Follow-up cleared early');
      BSSimpleUrge.saveSettings({ profileId: 'good' });
      const r = BSAccident.save({ ctx: 'simple_urge', severity: 'dribble', protection: 'none' }); BSSimpleUrge.render(); document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove());
      o.finishKind = r.follow.kind; o.finishBtn = !!document.getElementById('suFPotty'); o.unlocked = !BSSimpleUrge.followActive();
      document.getElementById('suFPotty').click(); o.potty = BSCalendar.load().entries.some(e => e.type === 'potty' && /Finished on the potty/.test(e.memo || '')); o.gone = !document.getElementById('suFollow');
      return o;
    });
    check('v13 follow-up: office wording neutral (Reminder / no "potty"), bedwetting silent (no alarm), skip logs neutrally', fu3.officeAlarm && fu3.officeAlarm.title === 'Reminder' && !/potty|diaper/i.test(fu3.officeTxt) && fu3.bedAlarm === null && fu3.cleared && fu3.skipLogged, JSON.stringify({ a: fu3.officeAlarm, t: fu3.officeTxt.slice(0, 120), b: fu3.bedAlarm }));
    check('v13 follow-up: dribble at Little Kid → permission now ("Finished on the potty" logs a potty entry, no timer)', fu3.finishKind === 'finish' && fu3.finishBtn && fu3.unlocked && fu3.potty && fu3.gone, JSON.stringify(fu3));
    await page.evaluate(() => { localStorage.removeItem('bs_simple_urge_follow'); BSSimpleUrge.saveSettings({ profileId: 'okay' }); BSSimpleUrge.render(); });
    await page.evaluate(() => document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()));
    // daily reset prompt
    const dr = await page.evaluate(() => { const S = BSSimpleUrge, i = S.inv(); i.day = 'Mon Jan 01 2001'; S.saveInv(i); S.render(); const has = !!document.getElementById('suDaily'); document.getElementById('suDailyKeep').click(); return { has, after: !!document.getElementById('suDaily') }; });
    check('v11 daily supplies reset prompt', dr.has && !dr.after, JSON.stringify(dr));
    // campaign setup from session start + play style
    await page.evaluate(() => { BSCampaign.abandon(); showSessionSetupModal(); }); await sl(200);
    await page.evaluate(() => document.getElementById('ssCampaignBtn').click()); await sl(200);
    const cs0 = await page.evaluate(() => ({ sheet: !!document.getElementById('cpSetup'), modal: document.getElementById('sessionSetupBackdrop').style.display }));
    await page.evaluate(() => { /* v18 stepper */ const want = ['some', 'shaky', 'regress', 'short', 'open', 'natural', 'no']; const w = document.getElementById('cpSetup'); want.forEach(v => { const b = w.querySelector(`[data-cq="${v}"]`); if (b) b.click(); }); w.querySelector('#cqStart').click(); }); await sl(150);
    const cs = await page.evaluate(() => {
      const s = BSCampaign.load(); const k = BSCampaign.dayKey(Date.now()); const ts = Date.now();
      const es = [{ ts, type: 'event', source: 'sim', mode: 'simple_urge' }];
      const g = st => BSCampaign.scoreDay(Object.assign({}, s, { playStyle: st }), k, es).goals.find(x => x.id === 'session').ok;
      const r = { style: s.playStyle, dir: s.controlDir, start: s.startRank, target: s.target, ctlDir: BSControl.load().direction, nat: g('natural'), ses: g('sessions'), either: g('either') };
      BSCampaign.abandon(); openCampaignSetup(); document.querySelector('#cpSetup #cqSkip').click(); const d = BSCampaign.load(); r.skip = !!d && d.playStyle === 'either'; r.rest = d.restPerWeek; BSCampaign.abandon(); return r;
    });
    check('v11 campaign setup reachable from Session start; optional quiz sets direction/level/length/play style; skip uses defaults', cs0.sheet && cs0.modal === 'none' && cs.style === 'natural' && cs.dir === 'regress' && cs.ctlDir === 'regress' && cs.start === 2 && cs.target === 3 && cs.skip && cs.rest === 1, JSON.stringify([cs0, cs]));
    check('v11 campaign play style: natural rolls count / sessions required / either', cs.nat && !cs.ses && cs.either, JSON.stringify(cs));
    const rest = await page.evaluate(() => {
      const s = BSCampaign.start({ source: 'sim' }); const today = BSCampaign.dayKey(Date.now()); s.lastEvalDay = BSCampaign.addDays(today, -15); BSCampaign.save(s);
      BSCampaign.evaluate(Date.now(), () => []); const h = BSCampaign.load().history; BSCampaign.abandon();
      const byWk = {}; h.forEach(x => { if (x.result === 'rest') { const w = BSCampaign.weekKey(x.day); byWk[w] = (byWk[w] || 0) + 1; } });
      return { rests: h.filter(x => x.result === 'rest').length, idle: h.filter(x => x.result === 'idle').length, max: Math.max(...Object.values(byWk)) };
    });
    const ln = await page.evaluate(() => {
      /* v18 stepper: null = Next → (keep default) */ const go = (w, arr) => arr.forEach(v => { const b = v == null ? w.querySelector('#cqNext') : w.querySelector(`[data-cq="${v}"]`); if (b) b.click(); });
      openCampaignSetup(); const w = document.getElementById('cpSetup'); const hidden0 = !w.querySelector('#cqDaysN');
      go(w, [null, null, null, null, 'custom']); const dn = w.querySelector('#cqDaysN'); dn.value = 10; dn.dispatchEvent(new Event('input')); go(w, [null, null, 'no']); w.querySelector('#cqStart').click();
      const a = BSCampaign.load(); const r = { hidden0, days: a.lengthDays, end: a.endDay };
      const s = BSCampaign.load(); s.lastEvalDay = BSCampaign.addDays(BSCampaign.dayKey(Date.now()), -1); s.endDay = BSCampaign.addDays(BSCampaign.dayKey(Date.now()), -2); BSCampaign.save(s);
      r.ev = BSCampaign.evaluate(Date.now(), () => []).map(e => e.type); BSCampaign.abandon();
      openCampaignSetup(); go(document.getElementById('cpSetup'), [null, null, null, null, null, null, 'no']); document.querySelector('#cpSetup #cqStart').click(); r.open = BSCampaign.load().lengthDays; BSCampaign.abandon(); return r;
    });
    check('v11 campaign length optional: toggle + custom days → ends; off = open-ended', ln.hidden0 && ln.days === 10 && !!ln.end && ln.ev.includes('ended') && ln.open === null, JSON.stringify(ln));
    check('v11 rest days: default 1 per 7, other unlogged days idle', rest.max === 1 && rest.idle > rest.rests, JSON.stringify(rest));
    check('v11 zero console/page errors', errs.length === 0, errs.join(' | '));
    await c11.close();
  }
  // ================= v12 =================
  {
    const c12 = await browser.createBrowserContext(); const page = await c12.newPage(); const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(URL, { waitUntil: 'networkidle0' }); const sl = ms => new Promise(r => setTimeout(r, ms)); await sl(1000);
    await page.evaluate(() => { if (typeof hideWhatsNewModal === 'function') hideWhatsNewModal(); const sb = document.getElementById('sessionSetupBackdrop'); if (sb) sb.style.display = 'none'; });
    await page.click('#tabBar [data-go=urge]'); await sl(250);
    // levels: ABDL labels + descriptions match odds tables
    const lv = await page.evaluate(() => {
      const C = BSControl, opts = [...document.querySelectorAll('#suProf option')].map(o => ({ v: o.value, t: o.textContent }));
      const keys = ['full', 'good', 'okay', 'shaky', 'little', 'none', 'off'];
      const rows = keys.map(k => { const l = C.level(k), s = C.stats(k), d = C.describe(k, false), o = C.describe(k, true);
        const ok = k === 'off' || (d.includes(s.potty + '%') && d.includes(s.mostlyDry + '%') && d.includes(s.small + '%') && d.includes(s.major + '%') && d.includes(s.holdPrompts + '%') && (s.changeAt ? d.includes(s.changeAt + '%') : true));
        return { k, label: C.label(l, false), office: C.label(l, true), potty: s.potty, ok, hasFlavor: /trained|trainer|toddler|infant|switched off/i.test(d), officeShort: o.length < d.length };
      });
      return { opts: opts.map(o => o.v), labels: opts.map(o => o.t), rows, classes: !!(window.BSClasses && BSClasses.CLASSES.length >= 8), ncls: window.BSClasses ? BSClasses.CLASSES.length : 0 };
    });
    check('v12 ladder keys + Not participating + ABDL labels', ['match', 'full', 'good', 'okay', 'shaky', 'little', 'none', 'off'].every(k => lv.opts.includes(k)) && /Infant|Toddler|Trainer|Little Kid|Grown-up|Not participating/.test(lv.labels.join('|')), JSON.stringify(lv.labels));
    check('v12 level descriptions match odds tables (potty/mostly-dry/small/major/hold % + change threshold)', lv.rows.every(r => r.ok && r.hasFlavor) && lv.rows.filter(r => r.k !== 'off').every(r => r.officeShort), JSON.stringify(lv.rows.map(r => [r.k, r.potty, r.ok])));
    check('v12 classes scaffold loaded (8+ classes)', lv.classes, 'n=' + lv.ncls);
    await page.evaluate(() => { BSSimpleUrge.openLevelList(); }); await sl(200);
    await page.screenshot({ path: '/workspace/screens/v12-levels-list.png' });
    await page.evaluate(() => document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()));
    // persistent Had an accident button after wait ends
    const pers = await page.evaluate(async () => {
      const S = BSSimpleUrge; S.saveSettings({ profileId: 'okay', oddsOverride: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 }, askUrgency: true });
      S.press(null); let st = S.state();
      const during = { armed: S.accidentArmed(), btn: !!document.getElementById('suAcc') };
      st.waitUntil = Date.now() - 500; st.fired = false; localStorage.setItem('bs_simple_urge_state', JSON.stringify(st));
      await new Promise(r => setTimeout(r, 1400)); S.render();
      const after = { armed: S.accidentArmed(), btn: !!document.getElementById('suAcc'), note: !!document.getElementById('suAccNote'), reveal: !!document.getElementById('suReveal') };
      document.getElementById('suAccX').click(); S.render();
      const dismissed = { armed: S.accidentArmed(), btn: !!document.getElementById('suAcc') };
      S.saveSettings({ oddsOverride: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 } }); S.press(null);
      const again = { armed: S.accidentArmed(), btn: !!document.getElementById('suAcc') };
      S.saveSettings({ oddsOverride: { go: 1, wait: 0, hard: 0, dribble: 0, gear: 0 } }); S.press(null);
      const cleared = { armed: S.accidentArmed(), btn: !!document.getElementById('suAcc') };
      S.saveSettings({ oddsOverride: null });
      return { during, after, dismissed, again, cleared };
    });
    check('v12 persistent accident button: stays after wait ends, dismiss clears, next wait re-arms, go clears',
      pers.during.btn && pers.after.btn && pers.after.armed && pers.dismissed.armed === false && !pers.dismissed.btn && pers.again.btn && !pers.cleared.btn,
      JSON.stringify(pers));
    // accident sheet sections
    await page.evaluate(() => { BSSimpleUrge.saveSettings({ profileId: 'okay', oddsOverride: { go: 0, wait: 1, hard: 0, dribble: 0, gear: 0 } }); BSSimpleUrge.press(4); }); await sl(150);
    await page.evaluate(() => document.getElementById('suAcc').click()); await sl(200);
    const sheet = await page.evaluate(() => {
      const w = document.getElementById('accSheet');
      return { before: !!w.querySelector('#acBefore'), after: !!w.querySelector('#acAfter'), ub: !!w.querySelector('#acUb'), ua: !!w.querySelector('#acUa'), rel: !!w.querySelector('#acRel'), sat: !!w.querySelector('#acSat'), warn: !!w.querySelector('#acWarn'),
        beforeLeg: (w.querySelector('#acBefore legend') || {}).textContent, afterLeg: (w.querySelector('#acAfter legend') || {}).textContent };
    });
    check('v12 accident sheet: Before / After sections with clear fields (urgency before, warning, urgency after, % released, leaked, saturation)',
      sheet.before && sheet.after && sheet.ub && sheet.ua && sheet.rel && sheet.sat && sheet.warn && /Before/.test(sheet.beforeLeg) && /After/.test(sheet.afterLeg), JSON.stringify(sheet));
    await page.screenshot({ path: '/workspace/screens/v12-accident-sheet.png' });
    await page.evaluate(() => document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()));
    // May I change? roll with threshold
    const ch = await page.evaluate(() => {
      const S = BSSimpleUrge; const i = S.inv(); i.day = new Date().toDateString(); i.wearing = 'diapers'; i.spares = { pad: 0, pullups: 1, diapers: 2, thick_diapers: 0 }; S.saveInv(i);
      BSControl.saveSettings({ value: 10 }); // Infant
      S.saveSettings({ profileId: 'none' });
      const below = BSChange.roll(40, { level: 'none', rng: () => 0.1, spares: i.spares }); // under 75% threshold
      const aboveYes = BSChange.roll(80, { level: 'none', rng: () => 0.05, spares: i.spares }); // past threshold, low rng → yes
      const aboveLater = BSChange.roll(80, { level: 'none', rng: () => 0.35, spares: i.spares });
      const skin = BSChange.roll(10, { level: 'none', rng: () => 0.9, hoursWorn: 5, maxHours: 3, spares: i.spares });
      const baby = BSControl.level('none');
      return { th: baby.change.threshold, below: below.outcome, aboveYes: aboveYes.outcome, aboveLater: aboveLater.outcome, skin: skin.outcome, noAsk: below.outcome !== 'ask' };
    });
    check('v12 change roll: Infant threshold 75; below → later/after; above rolls yes/later/after; skin-safety → now',
      ch.th === 75 && (ch.below === 'later' || ch.below === 'after') && ch.aboveYes === 'yes' && (ch.aboveLater === 'later' || ch.aboveLater === 'after' || ch.aboveLater === 'yes') && ch.skin === 'now', JSON.stringify(ch));
    await page.evaluate(() => { document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()); BSChange.open({ ctx: 'e2e' }); }); await sl(200);
    await page.evaluate(() => { const w = document.getElementById('chgRoll'); const sat = w.querySelector('#chgSat'); sat.value = 80; sat.dataset.set = '1'; sat.dispatchEvent(new Event('input')); w.querySelector('#chgGo').click(); }); await sl(200);
    const chUI = await page.evaluate(() => { const r = document.getElementById('chgResult'); const cal = BSCalendar.load().entries.filter(e => e.mode === 'change_roll'); return { out: r && r.dataset.outcome, text: r && r.textContent, cal: cal.length, sat: cal.slice(-1)[0] && cal.slice(-1)[0].saturation }; });
    check('v12 change roll UI logs to calendar with user-reported saturation', !!chUI.out && chUI.cal >= 1 && chUI.sat === 80, JSON.stringify(chUI));
    await page.screenshot({ path: '/workspace/screens/v12-change-roll.png' });
    await page.evaluate(() => document.querySelectorAll('.cal-sheet-wrap').forEach(w => w.remove()));
    check('v12 zero console/page errors', errs.length === 0, errs.join(' | '));
    await c12.close();
  }
  // ================= v13b: #2 timer → native BladderAlarm (mock plugin) =================
  {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cx = await browser.createBrowserContext(); const pg = await cx.newPage(); const perr = [];
    pg.on('pageerror', e => perr.push(e.message));
    await pg.evaluateOnNewDocument(() => {
      const st = window.__ba = { calls: [], alarms: JSON.parse(localStorage.getItem('__baStore') || '[]').reduce((m, a) => m.set(a.id, a), new Map()) };
      const persist = () => localStorage.setItem('__baStore', JSON.stringify([...st.alarms.values()]));
      window.Capacitor = { isNativePlatform: () => true, Plugins: { BladderAlarm: {
        // mimic Java PluginCall.getLong: non-integer numbers used to come back null → reject
        schedule: async o => { st.calls.push(['s', o.id, o.at, o.title, o.body, o.kind]); if (!Number.isInteger(o.at) || !Number.isInteger(o.id)) throw new Error('id and at are required'); st.alarms.set(o.id, o); persist(); return { mode: o.kind === 'alarm' ? 'alarmClock' : 'exactIdle' }; },
        cancel: async o => { st.calls.push(['c', o.id]); st.alarms.delete(o.id); persist(); },
        cancelAll: async () => { st.calls.push(['ca']); st.alarms.clear(); persist(); },
        getPending: async () => ({ alarms: [...st.alarms.values()].map(a => ({ id: a.id, at: a.at, kind: a.kind })) }),
        checkPermissions: async () => ({ notifications: 'granted', exactAlarm: 'granted' }), requestNotifications: async () => ({}), requestExactAlarm: async () => ({}) } } };
    });
    await pg.goto(URL, { waitUntil: 'networkidle0' });
    await pg.evaluate(() => { localStorage.setItem('messyModeEnabled', 'true'); localStorage.removeItem('bs_messy_timer_v1'); }); await pg.reload({ waitUntil: 'networkidle0' });
    await sleep(2600);
    const W = ms => sleep(ms), A = () => pg.evaluate(() => ({ armed: (window.__ba.alarms.get(1960) || null), calls: window.__ba.calls.slice() }));
    await pg.evaluate(() => BSMessyTimer.start({ level: 'okay', lo: 30, hi: 40 }, () => 0.3711)); await W(800);
    const a1 = await A(); const due = await pg.evaluate(() => BSMessyTimer.state().dueAt);
    check('v13b #2 timer: schedules native BladderAlarm 1960 as kind "alarm" (setAlarmClock path) at an integer due time', a1.armed && a1.armed.kind === 'alarm' && Number.isInteger(a1.armed.at) && a1.armed.at === Math.floor(due) && /#2 timer/.test(a1.armed.body), JSON.stringify(a1));
    await W(3600); const a2 = await A();
    check('v13b #2 timer: the 3 s refresh does not cancel or re-arm it', a2.armed && a2.armed.at === a1.armed.at && a2.calls.filter(c => c[1] === 1960).length === 1, JSON.stringify(a2.calls));
    await pg.evaluate(() => { localStorage.setItem('bs_messy_timer_v1', JSON.stringify(Object.assign(BSMessyTimer.state(), { dueAt: Date.now() + 1800000.75 }))); }); // legacy fractional value
    await pg.reload({ waitUntil: 'networkidle0' }); await W(3200);
    const a3 = await A();
    check('v13b #2 timer: persisted target survives an app kill/reload; legacy fractional time is floored and re-armed', a3.armed && Number.isInteger(a3.armed.at) && Math.abs(a3.armed.at - (Date.now() + 1800000)) < 10000, JSON.stringify(a3.armed));
    await pg.evaluate(() => { BSMessyTimer.cancel(); BSMessyTimer.start({ level: 'okay', lo: 60, hi: 61 }, () => 0.5); }); await W(800);
    const a4 = await A();
    check('v13b #2 timer: reroll re-arms the native alarm at the new time', a4.armed && Math.abs(a4.armed.at - (Date.now() + 60.5 * 60000)) < 10000, JSON.stringify(a4.armed));
    await pg.evaluate(() => BSMessyTimer.cancel()); await W(800); const a5 = await A();
    check('v13b #2 timer: cancel removes the native alarm', !a5.armed && a5.calls.some(c => c[0] === 'c' && c[1] === 1960), '');
    await pg.evaluate(() => BSMessyTimer.start({ level: 'okay', lo: 60, hi: 61 })); await W(800);
    await pg.evaluate(() => { localStorage.setItem('messyModeEnabled', 'false'); applyMessyVisibility(false); }); await W(800); const a6 = await A();
    await pg.evaluate(() => { localStorage.setItem('messyModeEnabled', 'true'); applyMessyVisibility(true); }); await W(800); const a6b = await A();
    check('v13b #2 timer: messy toggle off → native alarm cancelled; back on → re-armed', !a6.armed && a6b.armed, '');
    const off = await pg.evaluate(() => { BSOffice.set(true); const x = BSMessyTimer.pendingAlarm(); BSOffice.set(false); const pm = profileMode; profileMode = 'bedwetting'; const bed = BSMessyTimer.pendingAlarm(); const des = BSNativeAlarm.collectDesired().has(1960); profileMode = pm; return { x, bed, des }; });
    check('v13b #2 timer: office wording neutral; bedwetting silence → no alarm', off.x.title === 'Reminder' && !/#2|potty|poop/i.test(off.x.body) && off.bed === null && !off.des, JSON.stringify(off));
    const ea = await pg.evaluate(() => { BSMessyTimer.cancel(); BSMessyTimer.start({ level: 'none', lo: 60, hi: 61 }, () => 0.1); return BSMessyTimer.state(); }); await W(800); const a7 = await pg.evaluate(() => window.__ba.alarms.get(1961) || null);
    check('v13b #2 timer: early heads-up is armed natively as a reminder', ea.earlyAt && a7 && a7.kind === 'reminder' && a7.at === Math.floor(ea.earlyAt), JSON.stringify(a7));
    await pg.evaluate(() => { sessionRunning = true; stopAll(); }); await W(3500); const a8 = await A();
    check('v13b #2 timer: a session stop (native cancel-all) re-arms the #2 alarm right away', a8.armed && a8.calls.some(c => c[0] === 'ca'), JSON.stringify(a8.calls.slice(-4)));
    check('v13b #2 timer: no page errors', perr.length === 0, perr.join('|'));
    await cx.close();
  }
  // desktop sanity
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200)); await page.evaluate(() => hideWhatsNewModal());
  const dk = await page.evaluate(() => ({ log: getComputedStyle(document.getElementById('tab-log')).display, sess: getComputedStyle(document.getElementById('tab-session')).display }));
  await page.screenshot({ path: '/workspace/screens/desktop-1280.png' });
  check('desktop: session + log side by side, no errors', dk.log !== 'none' && dk.sess !== 'none' && errs.length === 0, JSON.stringify(dk) + errs.join('|'));
  await browser.close();
  fs.writeFileSync('/workspace/test/results.json', JSON.stringify(results, null, 1));
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
})().catch(e => { console.error(e); process.exit(1); });
