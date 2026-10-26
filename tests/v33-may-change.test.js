// v33: standing May I change? on Path + Campaign
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {};
function el() {
  const o = { style: {}, id: '', className: '', innerHTML: '', children: [], dataset: {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector(sel) { if (sel && sel[0] === '#') { const id = sel.slice(1); const f = stubById[id] || (stubById[id] = el()); f.id = id; return f; } return el(); },
    querySelectorAll() { return []; }, setAttribute() {}, classList: { add() {}, toggle() {} }, remove() {},
    oninput: null, onchange: null, onclick: null, disabled: false, textContent: '', value: '0'
  };
  return o;
}
const stubById = {};
const created = [];
global.document = {
  addEventListener() {}, getElementById: (id) => stubById[id] || null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => { const e = el(); created.push(e); return e; },
  body: { appendChild(c) { created.push(c); } }
};
['classes', 'hub', 'campaign', 'potty-path', 'path-play', 'path-features', 'change-roll'].forEach(f => {
  try { require('../js/' + f + '.js'); } catch (e) { console.error('load', f, e.message); }
});
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

ok(!!BSChange && typeof BSChange.open === 'function', 'BSChange.open exists');
ok(!!BSPathPlay && typeof BSPathPlay.openMayChange === 'function', 'BSPathPlay.openMayChange exists');
ok(BSChange.KEY === 'bs_change_roll_v1', 'change key unchanged');

const plain = BSPath.impliedLaunches({ rules: [{ t: 'Hold 5 min', k: 'hold', hold: [5, 5] }], feature: null });
ok(plain.some(x => x.id === 'may_change'), 'go sheet always offers May I change (plain hold)');
const prot = BSPath.impliedLaunches({ rules: [{ t: 'Protection', k: 'free', prot: true }, { t: 'Guide', guide: true }], feature: null });
ok(prot.filter(x => x.id === 'may_change').length === 1, 'prot + standing = single may_change');
ok(prot.some(x => x.id === 'guide_event'), 'guide still implied when rule asks');
const feat = BSPath.impliedLaunches({ rules: [], feature: 'may_change' });
ok(!feat.some(x => x.id === 'may_change'), 'no duplicate when feature square is already may_change');

created.length = 0; Object.keys(stubById).forEach(k => delete stubById[k]);
const opened = BSPathPlay.openMayChange('test_ctx');
ok(opened === true, 'openMayChange returns true');
ok(!!stubById.chgRoll || created.some(e => e.id === 'chgRoll'), 'change roll wrap #chgRoll mounted');

ok(BSPath.KEY === 'bs_path_v1' && BSCampaign.KEY === 'bs_campaign_v1', 'path/campaign keys unchanged');

const fs = require('fs');
const ppSrc = fs.readFileSync(__dirname + '/../js/potty-path.js', 'utf8');
const cpSrc = fs.readFileSync(__dirname + '/../js/campaign.js', 'utf8');
const plSrc = fs.readFileSync(__dirname + '/../js/path-play.js', 'utf8');
ok(ppSrc.includes('id="ppMayChange"'), 'Path board template has #ppMayChange');
ok(cpSrc.includes('id="cpMayChange"'), 'Campaign active template has #cpMayChange');
ok(cpSrc.includes('id="cpMayChangeIdle"'), 'Campaign idle template has #cpMayChangeIdle');
ok(plSrc.includes('id="ppCampMayChange"'), 'Path|Campaign toggle campaign chrome has #ppCampMayChange');
const wn = fs.readFileSync(__dirname + '/../js/whats-new-data.js', 'utf8');
ok(wn.includes("hash: 'v33'"), 'Whats New has v33');

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
