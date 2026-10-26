// v34: review, refuse+rollback, ladder prefs, change suggest/leak, tappable goals
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {};
function el() {
  const o = { style: {}, id: '', className: '', innerHTML: '', children: [], dataset: {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector(sel) {
      if (sel && sel[0] === '#') { const id = sel.slice(1); const f = stubById[id] || (stubById[id] = el()); f.id = id; return f; }
      if (sel && sel.startsWith('input')) return el();
      return el();
    },
    querySelectorAll() { return []; }, setAttribute() {}, classList: { add() {}, toggle() {} }, remove() {},
    oninput: null, onchange: null, onclick: null, disabled: false, textContent: '', value: '0'
  };
  return o;
}
const stubById = {};
global.document = {
  addEventListener() {}, getElementById: (id) => stubById[id] || null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => { const e = el(); return e; },
  body: { appendChild() {} }
};
global.confirm = () => true;
['classes', 'hub', 'control', 'campaign', 'potty-path', 'path-play', 'path-features', 'change-roll'].forEach(f => {
  try { require('../js/' + f + '.js'); } catch (e) { console.error('load', f, e.message); }
});
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const fs = require('fs');

ok(typeof BSPathPlay.reviewHtml === 'function', 'reviewHtml exists');
ok(BSPathPlay.reviewHtml('path').includes('ppReview') || BSPathPlay.reviewHtml('path').includes('Review'), 'path review markup');
ok(BSPathPlay.reviewHtml('campaign').includes('Campaign') || BSPathPlay.reviewHtml('campaign').includes('review'), 'campaign review markup');
ok(BSPathPlay.sectionQuizzesHtml('path').includes('longBoard') || BSPathPlay.sectionQuizzesHtml('path').includes('Which Class'), 'path quizzes strip');
ok(BSPathPlay.sectionQuizzesHtml('campaign').includes('longCamp') || BSPathPlay.sectionQuizzesHtml('campaign').includes('Long campaign'), 'campaign quizzes strip');

// Deep start prefs
BSPathPlay.saveStart({ mode: 'caregiver', classId: 'bigkid', experience: 'gentle', ladderMode: 'full', nightFocus: true, stats: { constitution: 2, perception: 1, composure: 1 } });
ok(BSPathPlay.loadStart().ladderMode === 'full', 'ladderMode full saved');
ok(BSPathPlay.loadStart().experience === 'gentle', 'experience gentle saved');
const lo = BSCampaign.optsFromLadder(BSPathPlay.loadStart());
ok(lo.startRank === 0 && lo.target === 6, 'full ladder Big Kid → Little Legend (' + lo.startRank + '→' + lo.target + ')');
ok(lo.restPerWeek === 2, 'gentle → 2 rest days');
BSPathPlay.saveStart({ ladderMode: 'travel', experience: 'intense' });
const lo2 = BSCampaign.optsFromLadder(BSPathPlay.loadStart());
ok(lo2.startRank === 6 && lo2.target === 0, 'intense travel starts padded end');
ok(lo2.prefs.ladderMode === 'travel', 'travel pref on campaign opts');

// Refuse quest
const b = BSPath.newBoard({ seed: 11, classId: 'scout', mode: 'free', dares: false });
const go = BSPath.needToGo(b, 'pee', () => 0.4, {});
ok(!!b.pending, 'pending after needToGo');
b.quest = { id: 'sess_npt', since: Date.now(), stage: b.pending.stage };
BSPath.save(b);
const before = b.pos;
const out = BSPath.refuseQuest(() => 0.99); // die = 6
ok(out && out.notes.some(n => /Refuse|refuse|Refused|🙅/.test(n)), 'refuse notes present');
const after = BSPath.load();
ok(!after.pending, 'pending cleared after refuse');
ok(!after.quest, 'quest cleared after refuse');
ok(after.pos < before || after.history.slice(-1)[0].outcome === 'refuse', 'moved back or refuse logged (pos ' + before + '→' + after.pos + ')');
ok(after.history.slice(-1)[0].outcome === 'refuse', 'history outcome refuse');

// Real urge still no move — fresh board
const b2 = BSPath.newBoard({ seed: 12, classId: 'scout', mode: 'free', dares: false });
BSPath.needToGo(b2, 'pee', () => 0.5, {});
const pos2 = b2.pos;
const r2 = BSPath.resolve(b2, 'real', {});
ok(r2.notes.some(n => /Paused|⏸/.test(n)), 'real urge pause note');
ok(b2.pos === pos2, 'real urge no move');

// Change suggest + leak
const sug = BSChange.suggestWear({ leaked: false });
ok(sug && sug.id && sug.label, 'suggestWear returns id/label');
const sugL = BSChange.suggestWear({ leaked: true });
ok(sugL && sugL.leaked === true, 'suggestWear leaked flag');
BSPathPlay.saveStart({ mode: 'caregiver' });
const roll = BSChange.roll(70, { level: 'okay', rng: () => 0.1, leaked: true, spares: { diapers: 2 } });
ok(roll.leaked === true, 'roll carries leaked');
ok(!!roll.guide || !!roll.suggest, 'caregiver/guide or suggest on roll');
ok(BSPathPlay.line('change_into', { into: 'a diaper', reason: 'test', leaked: true }).length > 10, 'caregiver change_into line');

// Tappable goals
ok(typeof BSCampaign.launchGoal === 'function', 'launchGoal exists');
ok(typeof BSCampaign.goalRowHtml === 'function', 'goalRowHtml exists');
const camp = BSCampaign.start(Object.assign({ playStyle: 'either' }, BSCampaign.optsFromLadder({ ladderMode: 'full', experience: 'standard' })));
ok(camp.startRank === 0 && camp.target === 6, 'started full ladder');
ok(camp.prefs && camp.prefs.ladderMode === 'full', 'prefs.ladderMode on start');
const goals = BSCampaign.goalsFor(camp);
const ci = goals.find(g => g.id === 'checkin');
ok(!!ci, 'checkin goal exists');
const row = BSCampaign.goalRowHtml({ id: 'checkin', label: 'Log a morning check-in', ok: false, val: 0 });
ok(row.includes('data-cgoal="checkin"') && row.includes('button'), 'open checkin goal is a button');
const done = BSCampaign.goalRowHtml({ id: 'checkin', label: 'Log a morning check-in', ok: true, val: 1 });
ok(!done.includes('data-cgoal') || done.includes('✅'), 'done goal not forced button');

// Source markers
const pp = fs.readFileSync(__dirname + '/../js/potty-path.js', 'utf8');
const pl = fs.readFileSync(__dirname + '/../js/path-play.js', 'utf8');
const ch = fs.readFileSync(__dirname + '/../js/change-roll.js', 'utf8');
const ca = fs.readFileSync(__dirname + '/../js/campaign.js', 'utf8');
ok(pp.includes('refuseQuest') && pp.includes('ppRefuseFeat'), 'path refuse UI');
ok(pl.includes('ladderMode') && pl.includes('reviewHtml'), 'path-play review+ladder');
ok(ch.includes('suggestWear') && ch.includes('chgLeak'), 'change leak + suggest');
ok(ca.includes('launchGoal') && ca.includes('data-cgoal'), 'campaign tappable goals');
const wn = fs.readFileSync(__dirname + '/../js/whats-new-data.js', 'utf8');
ok(wn.includes("hash: 'v34'"), 'Whats New v34');

// Keys unchanged
ok(BSPath.KEY === 'bs_path_v1' && BSCampaign.KEY === 'bs_campaign_v1' && BSChange.KEY === 'bs_change_roll_v1', 'storage keys unchanged');

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
