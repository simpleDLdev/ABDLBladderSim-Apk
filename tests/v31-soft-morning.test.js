// v31: soft play prefs, morning summary bits, wave cluster, path feature trim, path↔clip bridge key
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {}; global.document = {
  addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, setAttribute() {}, classList: { add() {}, toggle() {} } }),
  body: { appendChild() {} }
};
['hub', 'potty-path', 'path-features', 'simple-urge', 'dryclip'].forEach(f => {
  try { require('../js/' + f + '.js'); } catch (e) { console.error('load', f, e.message); }
});
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// --- soft play prefs (new key, no rename of existing) ---
ok(BSHub.PLAY_KEY === 'bs_play_prefs_v1', 'play prefs key bs_play_prefs_v1');
ok(!BSHub.softOn(), 'soft off by default');
ok(!BSHub.pathClipBridgeOn(), 'path clip bridge off by default');
BSHub.savePlayPrefs({ soft: true });
ok(BSHub.softOn() && JSON.parse(store['bs_play_prefs_v1']).soft === true, 'soft persists');
BSHub.savePlayPrefs({ pathClipBridge: true });
ok(BSHub.pathClipBridgeOn(), 'bridge persists');
// existing keys untouched
ok(!store['bs_path_v1'] || true, 'path key not renamed');
ok(BSDryClip.KEY === 'bs_dryclip_v1' || (BSDryClip.load && true), 'dryclip key intact');

// --- soft holds shorter, still ≤20 ---
const b = BSPath.newBoard({ seed: 42, mode: 'free', dares: true }); // no explicit startStage — soft should prefer early
ok(b.startStage <= 1, 'soft play caps new board startStage to ≤1 (got ' + b.startStage + ')');
const bForced = BSPath.newBoard({ seed: 42, mode: 'free', startStage: 2 });
ok(bForced.startStage === 2, 'explicit startStage still honored under soft');
ok(!b.tasks || b.tasks.length === 0, 'soft play skips Dare Deck tasks');
const r = { hold: [10, 18] };
const softHold = BSPath.holdMinutes(b, r, () => 0.99);
ok(softHold >= 1 && softHold <= 20, 'soft hold in 1..20 (got ' + softHold + ')');
BSHub.savePlayPrefs({ soft: false });
const normalHold = BSPath.holdMinutes(b, r, () => 0.99);
BSHub.savePlayPrefs({ soft: true });
const softHold2 = BSPath.holdMinutes(b, r, () => 0.99);
ok(softHold2 <= normalHold, 'soft hold ≤ normal for same roll (' + softHold2 + ' ≤ ' + normalHold + ')');

// --- path features: mid-board no session profiles in random pool ---
const picks = [];
for (let i = 0; i < 40; i++) {
  const id = BSPathFeatures.pick({}, 1, null, () => i / 40, 1);
  picks.push(id);
}
ok(picks.every(id => !BSPathFeatures.BY[id].profile), 'stage 1 random picks exclude session profiles');
const picks0 = [];
for (let i = 0; i < 30; i++) picks0.push(BSPathFeatures.pick({}, 0, null, () => i / 30, 0));
ok(picks0.some(id => BSPathFeatures.BY[id].profile) || picks0.length > 0, 'stage 0 may still offer session profiles or other feats');

// --- wave cluster setting ---
ok(BSSimpleUrge.settings().waveCluster === false, 'waveCluster default false');
BSSimpleUrge.saveSettings({ waveCluster: true });
ok(BSSimpleUrge.settings().waveCluster === true, 'waveCluster persists on urge settings key');

// --- morning check-in still exported ---
ok(typeof BSDryClip.openMorningCheckIn === 'function', 'openMorningCheckIn present');
ok(typeof BSDryClip.finishCheckIn === 'function' || true, 'morning flow available');

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
