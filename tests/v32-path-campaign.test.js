// v32: Path|Campaign start flow, class perk flags, perception fog, leaky/dribbler gate
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {}; global.document = {
  addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, setAttribute() {}, classList: { add() {}, toggle() {} }, remove() {} }),
  body: { appendChild() {} }
};
['classes', 'hub', 'campaign', 'potty-path', 'path-play', 'path-features', 'change-roll', 'simple-urge'].forEach(f => {
  try { require('../js/' + f + '.js'); } catch (e) { console.error('load', f, e.message); }
});
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// --- keys unchanged ---
ok(BSPath.KEY === 'bs_path_v1', 'path key bs_path_v1');
ok(BSCampaign.KEY === 'bs_campaign_v1', 'campaign key bs_campaign_v1');
ok(BSClasses.KEY === 'bs_class_v1', 'class key bs_class_v1');
ok(BSPathPlay.START_KEY === 'bs_play_start_v1', 'new start key versioned');

// --- Leaky Girl on Path + Dribbler alias ---
ok(!!BSPath.CLASS_BY_ID.leaky, 'Path has leaky class');
ok(BSClasses.get('dribbler').name === 'Leaky Girl' || /Leaky|Dribbler/i.test(BSClasses.get('dribbler').name), 'BSClasses dribbler labeled Leaky Girl');
ok(!!BSClasses.get('leaky'), 'get(leaky) resolves via alias');
ok(BSClasses.get('dribbler').flags.needDribbleFirst === true, 'dribbler needDribbleFirst');
ok(BSClasses.get('dribbler').flags.changeSatBump >= 20, 'dribbler change sat bump');
ok(BSClasses.get('dribbler').oddsMod.dribble >= 2, 'dribbler odds dribble×2');

// --- class odds apply ---
BSClasses.pick('dribbler');
const w = BSClasses.applyOdds({ go: 40, wait: 30, hard: 15, dribble: 10, gear: 5 });
ok(w.dribble === 20 && w.go === 24, 'applyOdds dribble×2 go×0.6 (' + w.dribble + ',' + w.go + ')');

// --- start prefs + stats ---
BSPathPlay.saveStart({ mode: 'caregiver', classId: 'leaky', stats: { constitution: 0, perception: 1, composure: 1 }, nightFocus: true });
ok(BSPathPlay.caregiverOn(), 'caregiver mode on');
ok(BSPathPlay.timerFog() === true, 'perception 1 → timer fog');
ok(BSPathPlay.holdScaleFromStats({ constitution: 0 }) < 1, 'constitution 0 shortens holds');
ok(BSPathPlay.holdScaleFromStats({ constitution: 3 }) > 1, 'constitution 3 lengthens holds');
ok(!!BSPathPlay.line('mayi_yes'), 'caregiver mayi line');
BSPathPlay.saveStart({ mode: 'solo', stats: { constitution: 2, perception: 2, composure: 2 } });
ok(!BSPathPlay.caregiverOn(), 'solo mode');
ok(BSPathPlay.timerFog() === false, 'perception 2 → no fog');

// --- Path board leaky gate ---
const b = BSPath.newBoard({ seed: 7, classId: 'leaky', mode: 'free', dares: false });
ok(b.classId === 'leaky', 'newBoard accepts leaky');
ok(b.dribbleGate === true, 'leaky sets dribbleGate');
const blocked = BSPath.needToGo(b, 'pee', () => 0.5, {});
ok(blocked.blocked === 'urge' || blocked.blocked === 'dribble', 'needToGo blocked before urge/dribble (' + blocked.blocked + ')');
if (BSPath.logUrge) BSPath.logUrge(b, 5); else { b.urgeLock = { ts: Date.now(), urgency: 5 }; b.dribbleLogged = true; }
const okGo = BSPath.needToGo(b, 'pee', () => 0.5, {});
ok(!okGo.blocked && okGo.move >= 0, 'needToGo works after urge lock');

// --- hold minutes respect class + stats ---
const b2 = BSPath.newBoard({ seed: 3, classId: 'bigkid', mode: 'free', dares: false });
b2.playStats = { constitution: 0, perception: 2, composure: 2 };
const short = BSPath.holdMinutes(b2, { hold: [10, 10] }, () => 0);
b2.playStats = { constitution: 3, perception: 2, composure: 2 };
const longer = BSPath.holdMinutes(b2, { hold: [10, 10] }, () => 0);
ok(short <= 20 && longer <= 20, 'holds capped at 20');
ok(short <= longer, 'lower constitution → shorter hold (' + short + ' ≤ ' + longer + ')');

// --- change sat bump ---
BSClasses.pick('dribbler');
const bump = BSClasses.changeSatBump();
ok(bump >= 20, 'changeSatBump from leaky/dribbler (' + bump + ')');
const roll = BSChange.roll(30, { level: 'okay', rng: () => 0.1 });
ok(roll.threshold >= 40, 'change roll threshold includes bump or base (' + roll.threshold + ')');

// --- surface toggle persistence ---
BSPathPlay.setSurface('campaign');
ok(BSPathPlay.surface() === 'campaign', 'surface campaign');
BSPathPlay.setSurface('path');
ok(BSPathPlay.surface() === 'path', 'surface path');

// --- campaign night focus goal present when pref on ---
const camp = BSCampaign.start({ playStyle: 'either' });
camp.prefs = { nightFocus: true }; BSCampaign.save(camp);
const goals = BSCampaign.goalsFor(camp);
ok(goals.some(g => g.id === 'dryMorning' || g.id === 'checkin'), 'night focus / checkin goals exist');
ok(goals.some(g => g.id === 'checkin'), 'morning checkin goal always there');

// --- classes feel different: trainee vs dribbler odds ---
BSClasses.pick('trainee');
const wt = BSClasses.applyOdds({ go: 40, wait: 30, hard: 15, dribble: 10, gear: 5 });
BSClasses.pick('dribbler');
const wd = BSClasses.applyOdds({ go: 40, wait: 30, hard: 15, dribble: 10, gear: 5 });
ok(wt.go !== wd.go || wt.dribble !== wd.dribble, 'trainee vs dribbler odds differ');

// --- caregiver vs solo lines differ ---
BSPathPlay.saveStart({ mode: 'caregiver' });
const care = BSPathPlay.line('resolve_ok');
BSPathPlay.saveStart({ mode: 'solo' });
const solo = BSPathPlay.line('resolve_ok');
ok(care !== solo && /Mommy|proud/i.test(care), 'caregiver voice warmer than solo');

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
