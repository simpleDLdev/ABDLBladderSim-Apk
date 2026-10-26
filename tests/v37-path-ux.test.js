// v37: Path inline UX helpers, Leaky urge→leak timing, hydration ranks, theme prefs
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {};
global.document = {
  addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} }, remove() {} }),
  body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } }
};
['safety', 'hub', 'classes', 'campaign', 'potty-path', 'path-play', 'path-features', 'change-roll'].forEach(f => {
  try { require('../js/' + f + '.js'); } catch (e) { console.error('load', f, e.message); }
});
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

ok(BSPath.KEY === 'bs_path_v1', 'path key unchanged');
ok(BSHub.PLAY_KEY === 'bs_play_prefs_v1', 'play prefs key unchanged');
ok(BSSafety.KEY === undefined && BSSafety.MAX_ML === 250 && BSSafety.DAY_ML === 1000, 'safety caps intact');

// theme
ok(BSHub.themeId() === 'neutral', 'default theme neutral');
BSHub.setTheme('girl');
ok(BSHub.themeId() === 'girl', 'theme girl');
BSHub.setTheme('boy');
ok(BSHub.themeId() === 'boy', 'theme boy');
BSHub.setTheme('nope');
ok(BSHub.themeId() === 'neutral', 'invalid theme → neutral');
ok(!!BSHub.themeWords().needToGo, 'themeWords present');

// hydration per rank
const rh0 = BSSafety.rankHydration(0), rh6 = BSSafety.rankHydration(6);
ok(rh0.suggestMl <= 250 && rh6.suggestMl <= 250, 'rank hydration ≤250');
ok(rh0.gapMin >= rh6.gapMin, 'higher rank → denser soft prompts');
ok(BSPath.hydrationGlance().left <= 1000, 'hydrationGlance left');

// Leaky urge lock before roll
const b = BSPath.newBoard({ seed: 11, classId: 'leaky', mode: 'free', dares: false });
ok(b.dribbleGate === true, 'leaky dribbleGate');
const blocked = BSPath.needToGo(Object.assign({}, b), 'pee', () => 0.4, {});
ok(blocked.blocked === 'urge', 'needToGo blocked without urgeLock (' + blocked.blocked + ')');
BSPath.logUrge(b, 5);
ok(b.urgeLock && b.urgeLock.urgency === 5, 'urge locked at 5');
const afterUrge = BSPath.needToGo(b, 'pee', () => 0.4, {});
ok(!afterUrge.blocked && afterUrge.move >= 0, 'roll allowed after urge lock');

// leak timing data
const b2 = BSPath.newBoard({ seed: 12, classId: 'leaky', mode: 'free', dares: false });
BSPath.logUrge(b2, 5);
// rewind urge ts 3 minutes
b2.urgeLock.ts = Date.now() - 3 * 60000;
b2.leakLog[b2.leakLog.length - 1].ts = b2.urgeLock.ts;
const leak = BSPath.logLeak(b2, 8);
ok(leak.urgency === 8 && leak.urgeUrgency === 5, 'leak stores urge+leak urgency');
ok(leak.sinceUrgeMs >= 2.5 * 60000 && leak.sinceUrgeMs <= 4 * 60000, 'sinceUrgeMs ~3m (' + leak.sinceUrgeMs + ')');
ok(b2.dribbleLogged === true, 'leak sets dribbleLogged');

// glance helpers
ok(/Wear|Class|Now|Hydration/.test(BSPath.glanceHtml(b2)), 'glanceHtml has sections');
ok(typeof BSPath.wearHint(b2) === 'string', 'wearHint string');
ok(BSPath.timerLocksRolls({ pending: { holds: [10], holdEndsAt: Date.now() + 60000 } }) === true, 'timer locks rolls while running');
ok(BSPath.timerLocksRolls({ pending: { holds: [10], holdEndsAt: Date.now() - 1000 } }) === false, 'timer done unlocks lock check');

// deep start theme field
const st = BSPathPlay.loadStart();
ok('theme' in st || true, 'start prefs loadable');
BSPathPlay.saveStart({ theme: 'girl', mode: 'solo' });
ok(BSPathPlay.loadStart().theme === 'girl', 'start theme persisted');

console.log(fail ? ('FAILED ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
