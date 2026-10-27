// v42: #2 Path guides, Urge type on the play surface, Campaign tummy flag.
const fs = require('fs'), path = require('path');
const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global;
global.addEventListener = () => {};
global.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], readyState: 'complete', visibilityState: 'visible' };
global.MESSY_PUSHING_ACCIDENTS_D10 = [{ name: 'Seated Push', desc: 'Tummy push in protection.', guide: [{ text: 'BEAR DOWN — STEADY PUSH', time: 8, type: 'push' }, { text: 'RELAX 3 SECONDS', time: 3, type: 'relax' }] }];
global.MESSY_HOLDING_GAUNTLETS_D10 = [{ name: 'The Seated Clench', guide: [{ text: 'CLENCH TIGHT', time: 15, type: 'stop' }, { text: 'HOLD POSITION', time: 20, type: 'stop' }] }];
global.generateRandomGuideSteps = () => [{ text: 'STREAM', time: 5, type: 'relax' }];
global.buildRandomGauntlet = () => [{ text: 'HOLD THE PEE', time: 5, type: 'stop' }];
let launched = null;
global.startVoidGuide = (seq, title, type) => { launched = { seq, title, type }; };
['potty-path', 'path-features', 'campaign', 'control', 'urge-matrix', 'simple-urge', 'urge'].forEach(f => {
  try { require('../js/' + f + '.js'); } catch (e) { console.error('load', f, e); process.exit(1); }
});
let fail = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++; } else console.log('PASS', m); };
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

localStorage.setItem('messyModeEnabled', 'true');
const pee = BSPathFeatures.guideFor('pee', 'event', 1, () => 0);
ok(pee.poo === false && pee.seq[0].text === 'STREAM' && /Potty Path:/.test(pee.title) && !/Potty Path #2/.test(pee.title), 'pee event guide stays the pee generator');
const poo = BSPathFeatures.guideFor('poo', 'event', 1, () => 0);
ok(poo.poo === true && poo.blocked == null && /Potty Path #2/.test(poo.title) && poo.seq.some(s => /BEAR DOWN|PUSH/.test(s.text)) && !poo.seq.some(s => s.text === 'STREAM'), 'poo event guide uses the #2 pushing table');
const hold = BSPathFeatures.guideFor('poo', 'hold', 2, () => 0);
ok(hold.type === 'gauntlet' && hold.seq.some(s => /CLENCH/.test(s.text)) && /Tummy only/i.test(hold.title), '#2 hold guide uses the holding table');
localStorage.setItem('messyModeEnabled', 'false');
const gated = BSPathFeatures.guideFor('poo', 'event', 1, () => 0);
ok(gated.blocked === 'messy' && !gated.seq, 'messy off blocks #2 guides');
ok(read('js/potty-path.js').includes('pp-need2 messy-only') && read('js/potty-path.js').includes('id="ppPooSheet"'), 'Path #2 button is messy-only and the sheet has #2 copy');
ok(read('js/path-play.js').includes("t !== 'gauntlet'") && read('js/path-play.js').includes('after_guide'), 'May I change? chain after a let-go guide is still hooked');

const su = read('js/simple-urge.js');
const typeAt = su.indexOf('id="suType"'), moreAt = su.indexOf('id="suMore"'), chipAt = su.indexOf('NS.chip()');
ok(typeAt > chipAt && typeAt < moreAt && su.includes('id="suT1"') && su.includes('id="suT2"'), '#1/#2 sit on the Urge play surface, after the session chip and outside More');
ok(read('js/urge.js').includes('id="urgeT1"') && read('js/urge.js').includes('id="urgeT2"'), 'classic Urge still has #1/#2');
localStorage.setItem('messyModeEnabled', 'true');
BSSimpleUrge.saveSettings({ type: 2 });
ok(BSSimpleUrge.urgeType() === 2, 'saved type 2 sticks while messy is on');
const gear = BSSimpleUrge.roll({ type: 2, urgency: 8, rng: () => 0.99, profile: Object.assign({}, BSSimpleUrge.profile(), { levelKey: 'full', hiddenWait: false }), events: [] });
ok(gear.type === 2 && /#2|tummy/i.test(gear.text || ''), 'type 2 roll is labeled #2 (' + (gear && gear.outcome) + ' / ' + (gear && gear.text) + ')');
const guided = gear.pooGuide || (gear.content && gear.content.guide) || (gear.gear && gear.gear.guide) || [];
ok(!guided.length || guided.some(s => /BEAR DOWN|CLENCH|TUMMY|PUSH/.test(s.text)) && !guided.some(s => s.text === 'STREAM'), 'type 2 guide steps are tummy steps');

BSCampaign.start({ source: 'sim', startRank: 2, target: 1 });
ok(BSCampaign.KEY === 'bs_campaign_v1', 'campaign key unchanged');
const saved = JSON.parse(localStorage.getItem('bs_campaign_v1'));
ok(saved.flags && saved.flags.tummy === false, 'tummy lives on the existing campaign flags bag');
BSCampaign.setTummy(true, { user: true });
ok(BSCampaign.tummyOn() === true && BSCampaign.pooWaitMin(12) === 0, 'tummy flag skips a #2 wait');
ok(read('js/campaign.js').includes("Tummy trouble: your next #2 can't wait") && read('js/campaign.js').includes('id="cpTummy"'), 'campaign play surface has the tummy banner and toggle');
const skipped = BSUrge.roll({ type: 2, urgency: 3, rng: () => 0.99, level: 0 });
ok(skipped.tummy === true && skipped.outcome === 'allowed' && skipped.waitMin === 0, 'classic #2 wait becomes can\'t-wait while tummy is on');
BSCampaign.setTummy(false, { user: true });
ok(BSCampaign.pooWaitMin(8) === 8, 'clearing tummy restores the wait');

ok(read('android/app/build.gradle').includes('versionName "42"') && read('android/app/build.gradle').includes('versionCode 42'), 'version 42');
ok(read('js/whats-new-data.js').includes("hash: 'v42'"), "What's New v42");
ok(!/bs_campaign_tummy|bs_path_tummy|bs_urge_type/.test(read('js/campaign.js') + read('js/simple-urge.js') + read('js/potty-path.js')), 'no new top-level storage key for these flags');

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
