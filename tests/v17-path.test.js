// v17 Potty Path: stages, 1–12 tables, movement, STOP, regress, mastery, classes, Test Mode. node tests/v17-path.test.js
const path = require('path');
let fails = 0; const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
const store = {}; global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
['safety', 'quiz-plus', 'potty-path'].forEach(f => require(path.join(__dirname, '..', 'js', f + '.js')));
const P = window.BSPath;
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; }; // die face f → (f-0.5)/6
const F = f => (f - 0.5) / 6;
check('4 stages × 12 rules + STOP + 6 doubles events', P.STAGES.length === 4 && P.STAGES.every(s => s.table.length === 13 && s.table.slice(1).every(r => r.t && r.k) && s.stop.t && Object.keys(s.events).length === 6 && s.box.length >= 3));
check('no laxative/real-substance or sexual wording; tummy trouble is a game flag', P.STAGES.every(s => !/laxative|medic|pill|naked|strip/i.test(JSON.stringify(s))) && /tummy trouble/i.test(P.STAGES[0].table[9].t));
check('every hold/wait ≤ 20 min', P.STAGES.every(s => s.table.slice(1).every(r => (r.min || 0) <= 20 && (!r.hold || r.hold[1] <= 20))));
const b0 = P.newBoard({ seed: 1, startStage: 0, mode: 'quiz', classId: 'scout' });
check('board 60 squares, 15 per stage, stage-rules square 1, STOP at 15', b0.squares.length === 61 && [1, 16, 31, 46].every(p => b0.squares[p].tag === 'stage') && [15, 30, 45, 60].every(p => b0.squares[p].rules === 'stop'));
const nonRule = b0.squares.slice(1).filter(s => s.rules !== 'stop' && s.rules !== 'rand' && !Array.isArray(s.rules)).length;
check('every square is a toileting rule (numbers / ? / STOP)', nonRule === 0);
check('each stage has check-in, hold, protection, roll-again, mystery squares; May I? from stage 2', [0, 1, 2, 3].every(s => ['checkin', 'hold', 'prot', 'again', 'rand'].every(t => b0.squares.slice(s * 15 + 1, s * 15 + 16).some(q => q.tag === t))) && [1, 2, 3].every(s => b0.squares.slice(s * 15 + 1, s * 15 + 16).some(q => q.tag === 'mayi')));
// movement: half the roll, round down
let b = P.newBoard({ seed: 2, startStage: 0, mode: 'quiz', classId: 'scout' });
let r = P.needToGo(b, 'pee', seq([F(3), F(4), 0.9, 0.9, 0.9]));
check('first go is already a toileting rule: 3+4 → move 3, pending rule', r.move === 3 && b.pos === 4 && b.pending.rules.length >= 1 && b.pending.rules[0].t, JSON.stringify(b.pending.rules[0]));
P.resolve(b, 'ok', { urgency: 3 }); check('followed → stay (or +2 on a roll-again square), +1 star, streak reset', (b.pos === 4 || (b.pos === 6 && b.squares[4].tag === 'again')) && b.stars >= 1 && b.accStreak === 0);
const bk = P.newBoard({ seed: 2, startStage: 0, mode: 'quiz', classId: 'bigkid' }); P.needToGo(bk, 'pee', seq([F(3), F(4), 0.9]));
check('Big Kid moves the full roll', bk.pos === 8 || bk.pending.pos === 8 || bk.pos === 7, bk.pos);
const pu = P.newBoard({ seed: 2, startStage: 0, mode: 'quiz', classId: 'pullup' }); check('Pull-up rounds up', P.moveFor(pu, { total: 7 }) === 4 && P.moveFor(b, { total: 7 }) === 3);
// STOP blocks passing
b = P.newBoard({ seed: 3, startStage: 0, mode: 'quiz', classId: 'shy' }); b.pos = 13; P.needToGo(b, 'pee', seq([F(6), F(5), 0.9]));
check('STOP square halts movement at end of stage', b.pending.pos === 15 && b.pending.tag === 'stop', b.pending.pos);
// accidents
b = P.newBoard({ seed: 4, startStage: 2, mode: 'quiz', classId: 'pullup' }); b.pos = 38; b.pending = { pos: 38, stage: 2, kind: 'pee', rules: [P.rule(2, 1)], holds: [], check: false };
P.resolve(b, 'acc', {}, seq([F(4)])); check('accident → back by die', b.pos === 34, b.pos);
b.pending = { pos: b.pos, stage: 2, kind: 'pee', rules: [P.rule(2, 1)], holds: [], check: false }; P.resolve(b, 'acc', {}, seq([F(2)]));
check('two accidents in a row → start of the previous stage', b.pos === 16, b.pos);
b.pos = 40; b.pending = { pos: 40, stage: 2, kind: 'pee', rules: [P.rule(2, 1)], holds: [], check: false }; P.resolve(b, 'real', {});
check('Real need: no penalty, no move', b.pos === 40);
const bb = P.newBoard({ seed: 4, startStage: 1, mode: 'quiz', classId: 'baby' }); bb.pos = 20; bb.pending = { pos: 20, stage: 1, kind: 'pee', rules: [P.rule(1, 2, 'baby')], holds: [], check: false };
check('Baby: potty rules become diaper rules', /diaper/.test(P.rule(1, 2, 'baby').t) && P.rule(1, 2, 'baby').k === 'gear');
P.resolve(bb, 'acc', {}); check('Baby never moved back for diaper accident', bb.pos === 20);
const bg = P.newBoard({ seed: 4, startStage: 3, mode: 'quiz', classId: 'bigkid' }); bg.pos = 50; bg.pending = { pos: 50, stage: 3, kind: 'pee', rules: [P.rule(3, 1)], holds: [], check: false }; P.resolve(bg, 'acc', {});
check('Big Kid: accident in stage 4 → previous STOP (45)', bg.pos === 45, bg.pos);
const sc = P.newBoard({ seed: 4, startStage: 2, mode: 'quiz', classId: 'scout' }); sc.pos = 38; sc.pending = { pos: 38, stage: 2, kind: 'pee', rules: [P.rule(2, 1)], holds: [], check: false }; P.resolve(sc, 'acc', {});
check('Scout spare kit: first accident in stage no move back', sc.pos === 38);
const cs = P.newBoard({ seed: 4, startStage: 2, mode: 'quiz', classId: 'cascade' }); check('Cascade starts with tummy trouble flag', cs.flags.tummy === true);
cs.pos = 40; cs.pending = { pos: 40, stage: 2, kind: 'poo', rules: [P.rule(2, 1)], holds: [], check: false }; P.resolve(cs, 'acc', {}, seq([F(3)]));
check('Cascade: #2 accident back double', cs.pos === 34, cs.pos);
// mastery
const ml = P.newBoard({ seed: 5, classId: 'little', mode: 'quiz' }); const d = i => new Date(2026, 9, 1 + i).getTime();
P.logMastery(ml, 'dry', d(0)); P.logMastery(ml, 'dry', d(1)); check('Bed Mastery: Leaky Toddler doubles dry nights, streak bonus', ml.mastery.bed === 6, ml.mastery.bed);
P.logMastery(ml, 'wet', d(2)); check('Leaky Toddler wet night −6', ml.mastery.bed === 0);
check('mastery logs once per day', P.logMastery(ml, 'wet', d(2)).ok === false);
const ms = P.newBoard({ seed: 5, classId: 'scout', mode: 'quiz' }); for (let i = 0; i < 6; i++) P.logMastery(ms, 'clean', d(10 + i));
check('Accident Mastery completes with reward', ms.mastery.done.acc === true);
const mb = P.newBoard({ seed: 5, classId: 'bigkid', mode: 'quiz' }); P.logMastery(mb, 'clean', d(30)); check('Big Kid: no Accident Mastery progress', mb.mastery.acc === 0);
const mp = P.newBoard({ seed: 5, classId: 'padgirl', mode: 'quiz' }); P.logMastery(mp, 'dry', d(40)); check('Pad Girl (Lazy Gal): bed progress redirects to Accident Mastery', mp.mastery.acc === 1 && mp.mastery.bed === 0);
// classes
check('classes with perks + drawbacks, mapped from reference classes', P.CLASSES.length >= 8 && P.CLASSES.every(c => c.plus.length === 2 && c.minus.length === 2 && c.from));
check('stash gating kept', !P.classAllowed('baby', { pads: true }) && !P.classAllowed('padgirl', { diapers: true }) && P.classAllowed('shy', { pads: false }));
// doubles event + hold cap
b = P.newBoard({ seed: 6, startStage: 1, mode: 'quiz', classId: 'scout', holdScale: 5 }); P.needToGo(b, 'pee', seq([F(3), F(3), 0.5, 0.5, 0.5]));
check('doubles → stage 2d6 event', b.pending.ev === 6);
check('hold minutes always ≤ 20', [0, 1, 2, 3].every(s => P.STAGES[s].table.slice(1).every(r => !(r.hold || r.min) || P.holdMinutes(Object.assign({}, b, { holdScale: 9, est: 100 }), r, () => 0.99) <= 20)));
// adaptive free play
const fb = P.newBoard({ seed: 7, mode: 'free', control: 50 });
for (let i = 0; i < 3; i++) { P.needToGo(fb, 'pee', seq([F(2), F(3), 0.9])); if (!fb.pending.check) { fails++; console.log('FAIL calibration check missing'); } P.resolve(fb, 'ok', { urgency: 1, sat: 0 }); }
check('free play: first 3 goes include check-ins, estimate rises', fb.calib.done === 3 && fb.est > 70, fb.est);
// Test Mode
const runs = P.CLASSES.map(c => P.simulate({ classId: c.id, seed: 11 }));
check('Test Mode: every class finishes a board', runs.every(x => x.board.finished), runs.map(x => x.rolls).join(','));
check('Test Mode sweep: classes×4×13×3 cases, no problems', runs[0].sweep.cases === P.CLASSES.length * 4 * 13 * 3 && runs[0].sweep.bad.length === 0, JSON.stringify(runs[0].sweep.bad.slice(0, 3)));
check('Test Mode starts at stage 1 and logs rules', runs[0].board.startStage === 0 && /Rule /.test(P.formatLogText(runs[0].board)) && /Table sweep/.test(P.formatLogText(runs[0].board)));
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
