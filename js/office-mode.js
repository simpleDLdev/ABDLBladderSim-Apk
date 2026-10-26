/* ===========================
   office-mode.js — v6 Office mode: discreet colour-light guide + neutral terminology.
   Guide steps become a colour light (RED / YELLOW / BLUE / GREEN) instead of text prompts,
   UI / log / guide / notification wording is swapped through a terminology map, and
   notifications (incl. lock screen) read just "Reminder". Pure UI: never plays sound.
   =========================== */
(function () {
  const KEY = 'bs_office_mode', LKEY = 'bs_office_legend_hidden';
  const on = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };

  // ---- colour mapping ----
  const COLOURS = {
    red:    { hex: '#e74c3c', word: 'RED',    meaning: 'Empty fully / push hard' },
    yellow: { hex: '#f1c40f', word: 'YELLOW', meaning: 'Push a little / slow stream' },
    blue:   { hex: '#3498db', word: 'BLUE',   meaning: 'Wait / hold' },
    green:  { hex: '#2ecc71', word: 'GREEN',  meaning: 'Go to the restroom' }
  };
  /** Map a guide step → colour key. Type first, then wording for steps that carry extra intent. */
  function colourFor(step) {
    if (!step) return 'blue';
    const t = String(step.text || '').toUpperCase();
    if (step.time === 0 || /POTTY|TOILET|BATHROOM|RESTROOM|RUN TO|GO NOW|DISPATCH|SIT DOWN/.test(t)) return 'green';
    if (step.type === 'push') return /SLOW|GENTLE|TRICKLE|DRIBBLE|LITTLE/.test(t) ? 'yellow' : 'red';
    if (step.type === 'relax') return /FLOOD|EMPTY|GUSH|DRAIN|FORCE|FULL|EVERYTHING/.test(t) ? 'red' : 'yellow';
    if (step.type === 'flood') return 'red';
    return 'blue'; // stop / hold / wait / unknown
  }

  // ---- terminology map (order matters: longer phrases first) ----
  const TERMS = [
    [/ABDL Bladder Sim/g, 'Routine Timer'], [/Bladder Sim/g, 'Routine Timer'],
    [/Change Diaper/gi, 'Change gear'], [/thick diapers/gi, 'heavy gear'], [/diapers?/gi, 'gear'], [/pull-?ups/gi, 'light gear'],
    [/protection/gi, 'gear'], [/undies/gi, 'basic'],
    [/bedwetting/gi, 'overnight'], [/wet nights?/gi, 'overnight events'],
    [/accidents?/gi, 'event'], [/\bleak(ing|ed|s)?\b/gi, 'step'], [/\bwetting\b|\bwet\b/gi, 'used'],
    [/bladder spasm/gi, 'Prompt'], [/bladder/gi, 'timer'], [/\bpee(ing)?\b/gi, 'break'], [/potty/gi, 'restroom'],
    [/saturation/gi, 'capacity'], [/\bsoak(ed|ing)?\b/gi, 'full'], [/\bdry\b/gi, 'clear'], [/omorashi/gi, 'endurance'], [/babysitter/gi, 'coach'], [/incontinen(ce|t)/gi, 'variable'],
    [/continence/gi, 'control'], [/messy|#2/gi, 'type B'], [/push-to-leak/gi, 'press-to-step'],
    [/urgency/gi, 'level'], [/flood(ing)?/gi, 'full'], [/\bvoid\b/gi, 'step']
  ];
  function swap(s) {
    if (!s || !/[A-Za-z#]/.test(s)) return s;
    let out = s; for (const [re, rep] of TERMS) out = out.replace(re, (m) => matchCase(m, rep));
    return out.replace(/[💩🧷💦🍼🚽🧸💧👶]/gu, '•');
  }
  function matchCase(src, rep) {
    if (src === src.toUpperCase() && /[A-Z]/.test(src)) return rep.toUpperCase();
    if (src[0] === src[0].toUpperCase() && /[A-Z]/.test(src[0])) return rep[0].toUpperCase() + rep.slice(1);
    return rep;
  }

  // ---- DOM text swapping (reversible) ----
  const orig = new WeakMap(); const touched = new Set();
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT']);
  function swapNode(n) {
    if (n.nodeType !== 3) return;
    const p = n.parentNode; if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-office-raw]'))) return;
    const base = orig.has(n) && n.nodeValue === orig.get(n).swapped ? orig.get(n).raw : n.nodeValue;
    const sw = swap(base);
    if (sw !== base) { orig.set(n, { raw: base, swapped: sw }); touched.add(n); if (n.nodeValue !== sw) n.nodeValue = sw; }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return swapNode(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) swapNode(n);
    if (root.querySelectorAll) root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(el => ['title', 'placeholder', 'aria-label'].forEach(a => {
      const v = el.getAttribute(a); if (!v) return;
      if (!el.dataset['oRaw' + a.replace('-', '')]) el.dataset['oRaw' + a.replace('-', '')] = v;
      el.setAttribute(a, swap(el.dataset['oRaw' + a.replace('-', '')]));
    }));
  }
  function restore() {
    touched.forEach(n => { const o = orig.get(n); if (o && n.nodeValue === o.swapped) n.nodeValue = o.raw; }); touched.clear();
    document.querySelectorAll('[data-o-rawtitle],[data-o-rawplaceholder],[data-o-rawarialabel]').forEach(el => {
      if (el.dataset.oRawtitle) el.setAttribute('title', el.dataset.oRawtitle);
      if (el.dataset.oRawplaceholder) el.setAttribute('placeholder', el.dataset.oRawplaceholder);
      if (el.dataset.oRawarialabel) el.setAttribute('aria-label', el.dataset.oRawarialabel);
    });
  }
  let mo = null, busy = false;
  function observe(start) {
    if (mo) { mo.disconnect(); mo = null; }
    if (!start || !window.MutationObserver) return;
    mo = new MutationObserver(muts => {
      if (busy) return; busy = true;
      try { muts.forEach(m => { if (m.type === 'characterData') swapNode(m.target); else m.addedNodes.forEach(walk); }); } finally { busy = false; }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  let rawTitle = null;

  // ---- guide overlay: colour light ----
  function legendHTML() {
    return Object.entries(COLOURS).map(([k, c]) => `<div class="ol-row"><i style="background:${c.hex}"></i><b>${c.word}</b><span>${c.meaning}</span></div>`).join('');
  }
  function ensureLegend() {
    const ov = document.getElementById('voidOverlay'); if (!ov) return null;
    let lg = document.getElementById('officeLegend');
    if (!lg) {
      lg = document.createElement('div'); lg.id = 'officeLegend'; lg.setAttribute('data-office-raw', '1');
      lg.innerHTML = `<div id="officeLegendBody">${legendHTML()}</div><button type="button" id="officeLegendBtn">Hide legend</button>`;
      ov.appendChild(lg);
      lg.querySelector('#officeLegendBtn').onclick = () => { localStorage.setItem(LKEY, localStorage.getItem(LKEY) === '1' ? '0' : '1'); syncLegend(); };
    }
    syncLegend(); return lg;
  }
  function syncLegend() {
    const hidden = localStorage.getItem(LKEY) === '1';
    const b = document.getElementById('officeLegendBody'), btn = document.getElementById('officeLegendBtn');
    if (b) b.style.display = hidden ? 'none' : '';
    if (btn) btn.textContent = hidden ? 'Show legend' : 'Hide legend';
  }
  function paintGuide() {
    const ov = document.getElementById('voidOverlay'); if (!ov) return;
    if (!on()) { delete ov.dataset.oc; return; }
    ensureLegend();
    const seq = typeof currentGuideSeq !== 'undefined' ? currentGuideSeq : [], i = typeof currentGuideStep !== 'undefined' ? currentGuideStep : -1;
    const lbl = document.getElementById('voidLabel'), ins = document.getElementById('voidInstruction');
    if (ins) { ins.setAttribute('data-office-raw', '1'); ins.textContent = 'Follow the light.'; }
    const setSide = (ringId, lblId, st) => { const l = document.getElementById(lblId); if (l && st) { l.setAttribute('data-office-raw', '1'); l.textContent = COLOURS[colourFor(st)].word; } const r = document.getElementById(ringId); if (r && st) r.dataset.oc = colourFor(st); };
    if (i < 0) { ov.dataset.oc = 'idle'; if (lbl) lbl.textContent = 'READY?'; setSide('voidNextRing', 'voidNextLabel', seq[0]); return; }
    if (i >= seq.length) { ov.dataset.oc = 'idle'; if (lbl) lbl.textContent = 'DONE'; return; }
    const c = colourFor(seq[i]); ov.dataset.oc = c;
    if (lbl) { lbl.setAttribute('data-office-raw', '1'); lbl.textContent = COLOURS[c].word; }
    setSide('voidPrevRing', 'voidPrevLabel', seq[i - 1]); setSide('voidNextRing', 'voidNextLabel', seq[i + 1]);
    const ptl = document.getElementById('pushToLeakBtn'); if (ptl) { ptl.setAttribute('data-office-raw', '1'); ptl.textContent = 'HOLD'; }
  }
  function hookGuide() {
    if (typeof window.runGuideStep !== 'function' || window.runGuideStep._office) return;
    const o = window.runGuideStep;
    const w = function () { const r = o.apply(this, arguments); try { paintGuide(); } catch (e) {} return r; };
    w._office = true; window.runGuideStep = w;
    // runGuideStep is a global function declaration; rebinding the global name makes internal recursive calls hit the wrapper too.
    try { runGuideStep = w; } catch (e) {}
  }

  // ---- notifications ----
  function notif(title, body) { return on() ? { title: 'Reminder', body: 'You have a reminder.' } : { title, body }; }
  function hookNotify() {
    const f = window.sendAlarmNotification;
    if (typeof f === 'function' && !f._office) {
      const w = function (t, b) { const n = notif(t, b); return f.call(this, n.title, n.body); }; w._office = true;
      window.sendAlarmNotification = w; try { sendAlarmNotification = w; } catch (e) {}
    }
  }

  // ---- toggle ----
  function apply() {
    const v = on();
    document.body.classList.toggle('office', v);
    document.querySelectorAll('.office-toggle').forEach(t => { if (t.type === 'checkbox') t.checked = v; else t.setAttribute('aria-pressed', v ? 'true' : 'false'); });
    const q = document.getElementById('btnOfficeQuick'); if (q) q.textContent = v ? '🟢 Office: ON' : '⚪ Office: off';
    if (rawTitle == null) rawTitle = document.title;
    document.title = v ? 'Routine Timer' : rawTitle;
    if (v) { walk(document.body); observe(true); } else { observe(false); restore(); }
    paintGuide();
    if (typeof window.nativeNotifySync === 'function') try { window.nativeNotifySync(); } catch (e) {}
  }
  function set(v) { localStorage.setItem(KEY, v ? '1' : '0'); apply(); if (typeof toast === 'function') toast(v ? 'Office mode on' : 'Office mode off'); }

  window.BSOffice = { on, set, toggle: () => set(!on()), colourFor, COLOURS, TERMS, swap, notif, paintGuide, apply };
  window.addEventListener('load', () => { hookGuide(); hookNotify(); apply(); });
})();
