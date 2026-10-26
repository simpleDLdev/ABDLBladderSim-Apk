// v19: urgency × control matrix + ranks + DryClip parse (Node / vm)
const fs = require('fs'), vm = require('vm');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON, parseInt, parseFloat, isNaN, Number, String, Boolean, RegExp, Error, TypeError,
  Uint8Array, DataView, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} },
    createElement: () => ({ style: {}, classList: { add() {} }, appendChild() {}, querySelector() { return null; }, querySelectorAll: () => [], remove() {} }) },
  addEventListener() {}, dispatchEvent() {}, toast() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['tables.js', 'control.js', 'urge-matrix.js', 'simple-urge.js', 'dryclip.js']) {
  vm.runInContext(fs.readFileSync(__dirname + '/../js/' + f, 'utf8'), ctx, { filename: f });
}
const names = ['OMORASHI_HOLDING_GUIDES', 'MICRO_TRAINING_D8', 'FULL_TRAINING_FAILURES', 'FULL_D20', 'MICRO_STD_D6', 'MICRO_DIAPER_D8', 'MACRO_NPT_MOSTLY_INCONTINENT_D20', 'MACRO_NPT_FULLY_INCONTINENT_D20', 'MICRO_DEPENDENT_D20', 'MACRO_DEPENDENT_D20'];
const map = {}; names.forEach(n => { map[n] = vm.runInContext(n, ctx); });
ctx.BSUrgeMatrix.register(map);
const M = ctx.BSUrgeMatrix, R = ctx.BSRanks, S = ctx.BSSimpleUrge, DC = ctx.BSDryClip;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const LEVELS = ['full', 'good', 'okay', 'shaky', 'little', 'none'];
LEVELS.forEach(l => M.MATRIX[l].forEach((row, bi) => {
  ok(row.reduce((a, b) => a + b, 0) === 100, `${l} b${bi} sum 100`);
  ok(row[1] <= 15, `${l} b${bi} dribble≤15`);
}));
LEVELS.forEach(l => { for (let i = 1; i < 4; i++) ok(M.MATRIX[l][i][0] >= M.MATRIX[l][i - 1][0], `${l} acc↑ b${i}`); });
for (let bi = 0; bi < 4; bi++) for (let li = 1; li < LEVELS.length; li++) ok(M.MATRIX[LEVELS[li]][bi][3] <= M.MATRIX[LEVELS[li - 1]][bi][3], `potty↓ ${LEVELS[li]} b${bi}`);
ok(M.cell('shaky', 9).go <= 3 && M.cell('little', 9).go === 0 && M.cell('none', 9).go === 0, '9–10 caps: Early≤3 Toddler/Infant=0');
const holdOf = l => { const c = M.cell(l, 5); return c.go + c.wait + c.hard; };
[['full', 78], ['okay', 55], ['shaky', 35], ['little', 18], ['none', 8]].forEach(([l, h]) => ok(Math.abs(holdOf(l) - h) <= 12, `${l} ≈ Quick ${h} (got ${holdOf(l)})`));
const count = (level, u, n) => { const c = {}; for (let i = 0; i < n; i++) { const o = S.roll({ urgency: u, profile: Object.assign({}, S.profile(), { levelKey: level }), events: [], chain: 0 }).outcome; c[o] = (c[o] || 0) + 1; } return c; };
const N = 4000;
ok((count('shaky', 9, N).go || 0) / N <= 0.05, 'sample Early@9 potty≤5%');
const t9 = count('little', 9, N); ok(!(t9.go) && !(t9.wait) && (t9.gear || 0) / N >= 0.85, 'sample Toddler@9 gear≥85% no potty');
ok(!(count('none', 9, N).go), 'sample Infant@9 no potty');
ok((count('full', 5, N).gear || 0) / N < 0.12, 'sample BigKid@5 gear<12%');
let g = null; for (let i = 0; i < 80; i++) { const x = S.roll({ urgency: 9, profile: Object.assign({}, S.profile(), { levelKey: 'little' }), events: [] }); if (x.outcome === 'gear' && x.content && x.content.guide) { g = x; break; } }
ok(!!g, 'accident → session macro: ' + (g && g.content.label));
let d = null; for (let i = 0; i < 150; i++) { const x = S.roll({ urgency: 2, profile: Object.assign({}, S.profile(), { levelKey: 'okay' }), events: [] }); if (x.outcome === 'dribble' && x.content) { d = x; break; } }
ok(!!d, 'dribble → session micro: ' + (d && d.content.label));
const fin = S.roll({ urgency: 6, profile: Object.assign({}, S.profile(), { levelKey: 'okay' }), events: [], chain: 3, final: true });
ok(fin.weights.wait === 0 && fin.weights.hard === 0, 'final chain clears wait/hold');
ok(R.RANKS.length === 6 && R.rankOfEst(95).key === 'full' && R.rankOfCampaign(4).key === 'little' && R.BY.none.session === 'dependent', 'rank map');
const p = DC.parseState([0x03, 0x0c, 0, 0, 0]); ok(p.wet && p.armed && p.secs === 12, 'DryClip STATE parse');
ok(DC.parseState([0]).secs === null && DC.parseState([0x19]).arming && DC.parseState([0x19]).charging, 'DryClip flags');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
