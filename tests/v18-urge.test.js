// v18: urgency slider bug + low-control potty access (Node, no DOM)
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {}; global.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
require('../js/control.js'); require('../js/urge-matrix.js'); require('../js/simple-urge.js');
const S = window.BSSimpleUrge; let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const src = require('fs').readFileSync(__dirname + '/../js/simple-urge.js', 'utf8');
ok(!/lastUrgency:\s*settings\(\)\.askUrgency \? null/.test(src), 'press() no longer nulls lastUrgency when askUrgency is on');
S.saveSettings({ askUrgency: true, lastUrgency: 8 }); ok(S.sliderValue() === 8, 'slider shows the kept value (8), not 5');
S.saveSettings({ lastUrgency: null }); ok(S.sliderValue() === null, 'unset stays unset (shows "touch to set")');
S.saveSettings({ lastUrgency: 0 }); ok(S.sliderValue() === 0, 'value 0 is kept (not treated as unset)');
const r = S.roll({ urgency: 9, profile: Object.assign({}, S.profile(), { levelKey: 'okay' }) }); ok(r.urgency === 9, 'roll uses the entered urgency');
const count = (k, u) => { const c = {}; for (let i = 0; i < 3000; i++) { const o = S.roll({ profile: Object.assign({}, S.profile(), { levelKey: k }), events: [], urgency: u }).outcome; c[o] = (c[o] || 0) + 1; } return c; };
const none = count('none', 5); ok(!none.go && !none.wait, 'no control: never go / wait ' + JSON.stringify(none));
const little = count('little', 5), shaky = count('shaky', 5), full = count('full', 5);
const pot = c => (c.go || 0) + (c.wait || 0);
ok(pot(little) < pot(shaky) && pot(shaky) < pot(full), `potty options phase in: little ${pot(little)} < shaky ${pot(shaky)} < full ${pot(full)}`);
ok(S.roll({ profile: Object.assign({}, S.profile(), { levelKey: 'none' }), events: [], urgency: 9 }).weights.go === 0, 'Infant @9 potty weight is 0');
ok(BSUrgeMatrix.cell('shaky', 9).go <= 3, 'Early Trainer @9 potty ≤ 3 in matrix');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
