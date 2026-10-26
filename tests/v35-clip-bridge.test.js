// v35: DryClip assists Path holds / guides / Campaign leak goals
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global;
global.addEventListener = () => {};
global.confirm = () => true;
const els = [];
function el() {
  const o = { style: {}, className: '', innerHTML: '', children: [], dataset: {}, id: '',
    appendChild(c) { this.children.push(c); els.push(c); return c; },
    querySelector(sel) {
      if (sel && sel[0] === '#') {
        const id = sel.slice(1);
        let f = this._byId && this._byId[id];
        if (!f) { f = el(); f.id = id; this._byId = this._byId || {}; this._byId[id] = f; }
        return f;
      }
      if (sel && sel.startsWith('[')) {
        const m = /data-(\w+)/.exec(sel);
        if (m) { const b = el(); b.dataset = b.dataset || {}; /* click handlers set on returned stub */ return b; }
      }
      return el();
    },
    querySelectorAll(sel) {
      if (sel && sel.includes('cb-hold')) return els.filter(e => (e.className || '').includes('cb-hold'));
      if (sel && sel.includes('cb-guide')) return els.filter(e => (e.className || '').includes('cb-guide'));
      return [];
    },
    remove() { const i = els.indexOf(this); if (i >= 0) els.splice(i, 1); },
    addEventListener() {}, setAttribute() {}, classList: { add() {}, toggle() {} },
    onclick: null, onchange: null, textContent: '', value: '', checked: false
  };
  return o;
}
global.document = {
  addEventListener() {}, getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: (sel) => {
    if (sel && sel.includes('cb-hold')) return els.filter(e => (e.className || '').includes('cb-hold'));
    if (sel && sel.includes('cb-guide')) return els.filter(e => (e.className || '').includes('cb-guide'));
    return [];
  },
  createElement: () => { const e = el(); els.push(e); return e; },
  body: { appendChild(c) { els.push(c); } }
};

['hub', 'calendar', 'accident', 'classes', 'control', 'campaign', 'potty-path', 'path-play', 'path-features', 'dryclip', 'clip-bridge'].forEach(f => {
  try { require('../js/' + f + '.js'); } catch (e) { console.error('load', f, e.message); }
});

let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const fs = require('fs');

ok(typeof BSClipBridge === 'object', 'BSClipBridge exists');
ok(typeof BSClipBridge.onClipWet === 'function', 'onClipWet');
ok(typeof BSHub.clipAssistPathOn === 'function' && !BSHub.clipAssistPathOn(), 'clipAssistPath off by default');
ok(typeof BSHub.clipAssistCampaignOn === 'function' && !BSHub.clipAssistCampaignOn(), 'clipAssistCampaign off by default');
ok(BSHub.PLAY_KEY === 'bs_play_prefs_v1', 'play prefs key unchanged');
ok(BSDryClip.KEY === 'bs_dryclip_v1', 'dryclip key unchanged');
ok(BSPath.KEY === 'bs_path_v1' && BSCampaign.KEY === 'bs_campaign_v1', 'path/campaign keys unchanged');

// Assist off → no handle
BSClipBridge.clearPathHold();
const off = BSClipBridge.onClipWet({ wetAt: Date.now() - 1000, source: 'offer' });
ok(off && off.handled === false, 'assist off → not handled');

// Path hold + assist → interrupt
BSHub.savePlayPrefs({ clipAssistPath: true, clipAssistCampaign: false });
ok(BSHub.clipAssistPathOn(), 'path assist on');
const wetAt = Date.now() - 5000;
BSClipBridge.setPathHold({ kind: 'path_hold', mins: 5, endsAt: Date.now() + 60000, pos: 10 });
ok(!!BSClipBridge.pathHold(), 'path hold active');
const r1 = BSClipBridge.onClipWet({ wetAt, source: 'offer' });
ok(r1.handled && r1.actions.includes('hold_interrupt'), 'hold interrupt action: ' + JSON.stringify(r1.actions));
const rDupe = BSClipBridge.onClipWet({ wetAt: wetAt + 1000, source: 'offer' });
ok(rDupe.handled === false && rDupe.reason === 'dupe', 'dedupe within 60s');

// Soft play lighter path exists
BSHub.savePlayPrefs({ soft: true });
ok(BSHub.softOn(), 'soft on');

// Campaign assist counts clip accidents
BSHub.savePlayPrefs({ soft: false, clipAssistPath: false, clipAssistCampaign: true });
ok(BSHub.clipAssistCampaignOn(), 'camp assist on');
const camp = BSCampaign.start({ startRank: 5, target: 6, promoteDays: 3, restPerWeek: 1, playStyle: 'either', source: 'both', goal: 'day', prefs: {} });
ok(camp.active, 'campaign started');
const goals = BSCampaign.goalsFor(camp);
const leakG = goals.find(g => g.id === 'simleaks' || g.id === 'cap');
ok(!!leakG, 'leak/cap goal present: ' + (leakG && leakG.id));

// Inject a clip bridge accident and score
const day = BSCampaign.dayKey(Date.now());
try {
  BSCalendar.addEntry({
    type: 'accident', source: 'natural', mode: 'dryclip_bridge', ts: Date.now(),
    severity: 'wet', tags: ['natural accident', 'clip-flagged']
  });
} catch (e) { console.warn(e); }
const scored = BSCampaign.scoreDay(camp, day);
const leakScore = scored.goals.find(g => g.id === 'simleaks' || g.id === 'cap');
ok(leakScore && leakScore.val >= 1, 'clip accident counted in goal val=' + (leakScore && leakScore.val));

// Caregiver line
BSPathPlay.saveStart({ mode: 'caregiver' });
const line = BSPathPlay.line('clip_wet', { where: 'a Path hold' });
ok(/clip|Mommy|wet/i.test(line), 'caregiver clip_wet line: ' + line.slice(0, 60));

// Review has toggles
const rh = BSPathPlay.reviewHtml('path');
ok(rh.includes('ppClipPath') && rh.includes('ppClipCamp') && rh.includes('ppClipNight'), 'review clip toggles');

// Source markers
const dc = fs.readFileSync(__dirname + '/../js/dryclip.js', 'utf8');
ok(dc.includes('BSClipBridge.onClipWet'), 'dryclip notifies bridge');
const wn = fs.readFileSync(__dirname + '/../js/whats-new-data.js', 'utf8');
ok(wn.includes("hash: 'v35'"), 'Whats New v35');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
ok(html.includes('clipAssistPathToggle') && html.includes('clip-bridge.js'), 'settings + script');
const pp = fs.readFileSync(__dirname + '/../js/potty-path.js', 'utf8');
ok(pp.includes('setPathHold'), 'path hold tracks clip bridge');

// decideWet still ignores settle (balance)
ok(BSDryClip.decideWet({ wet: true, armed: true, secs: 0 }, Date.now(), { settling: true }) === 'arming', 'settle ignored');
ok(BSDryClip.decideWet({ wet: true, armed: true, secs: 0 }, Date.now(), { ignoreUntil: Date.now() + 10000 }) === 'ignore_window', 'ignore window');

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
