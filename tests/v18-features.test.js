// v18: feature squares, board low-control, symptoms Yes/Maybe/No, calibration blend (Node, no DOM)
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.addEventListener = () => {}; global.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
['potty-path', 'path-features', 'symptoms-dict', 'calib-plus'].forEach(f => require('../js/' + f + '.js'));
const P = BSPath, F = BSPathFeatures, S = BSSymptoms, C = BSCalibPlus; let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
let s = 1; const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
// feature squares
const b0 = P.newBoard({ seed: 5, classId: 'bigkid', control: 80 }); const featN = b0.squares.filter(q => q && ['feat', 'checkin', 'prot', 'hold'].includes(q.tag)).length;
ok(featN >= 24, `feature-capable squares mixed in heavily: ${featN}/60`);
ok(F.FEATURES.length >= 12 && F.FEATURES.every(f => f.do && f.fx), `${F.FEATURES.length} features, each with a task and a reward`);
const seen = new Set(); for (let st = 0; st < 4; st++) for (let i = 0; i < 300; i++) seen.add(F.pick(b0, st, 'feat', rng, 1, new Date(2026, 9, 15, 21).getTime()));
ok(['sess_npt', 'sess_babysitter', 'guide_event', 'guide_hold', 'temp_wait', 'su_roll', 'nat_session', 'night_nn'].every(x => seen.has(x)), 'pick covers sessions, guides, waits, urge, nights: ' + [...seen].join(','));
const day = new Set(); for (let i = 0; i < 300; i++) day.add(F.pick(b0, 1, 'feat', rng, 1, new Date(2026, 9, 15, 11).getTime()));
ok(!day.has('night_nn') && !day.has('bedwet_sim'), 'night features only offered in the evening');
const lowSeen = new Set(); for (let i = 0; i < 300; i++) lowSeen.add(F.pick(b0, 3, 'feat', rng, 0, Date.now()));
ok(!lowSeen.has('guide_hold') && !lowSeen.has('sess_pro') && !lowSeen.has('temp_wait'), 'no holding / wait features at no control');
ok(F.pick(b0, 2, 'checkin', rng) === 'checkin_app' && F.pick(b0, 2, 'prot', rng) === 'may_change', 'check-in → status check-in, protection → May I change?');
ok(JSON.stringify(F.detect({ id: 'temp_wait', until: 1000, since: 0 }, 2000)) === JSON.stringify({ outcome: 'ok', info: 'Wait over' }) && F.detect({ id: 'temp_wait', until: 3000, since: 0 }, 2000) === null, 'temp wait detects completion');
// finishQuest feeds the board
let b = P.newBoard({ seed: 9, classId: 'bigkid', control: 80 }); let guard = 0; while (!(b.pending && b.pending.feature) && guard++ < 200) { if (b.pending) P.resolve(b, 'ok', { urgency: 3 }); if (b.finished) b = P.newBoard({ seed: guard, classId: 'bigkid', control: 80 }); P.needToGo(b, 'pee', rng); }
ok(!!(b.pending && b.pending.feature), 'landing on a feature square sets pending.feature = ' + (b.pending && b.pending.feature));
const fid = b.pending.feature; b.quest = { id: fid, since: Date.now(), stage: b.pending.stage }; P.save(b);
const stars0 = b.stars, r = P.finishQuest({ outcome: 'ok', info: 'test' }); const b2 = P.load();
ok(r && !b2.pending && !b2.quest && b2.stars > stars0 && b2.history[b2.history.length - 1].feature === fid, `finishQuest resolves the go and adds the reward (+${b2.stars - stars0} ⭐)`);
// board low control
const acc = (cls, est, st) => P.pottyAccess({ classId: cls, est, pos: 1 }, st);
ok(acc('baby', 90, 3) === 0 && acc('little', 10, 3) === 0, 'no potty access for Baby or very low control');
ok(acc('bigkid', 40, 3) < acc('bigkid', 70, 3) && acc('bigkid', 90, 1) <= 0.6, 'access phases in with control, capped by stage');
let potty = 0, low = 0; for (let i = 0; i < 400; i++) { const bb = P.newBoard({ seed: i, classId: 'pullup', control: 8, startStage: 3 }); P.needToGo(bb, 'pee', rng); bb.pending.rules.forEach(x => { if (['potty', 'race', 'mayi', 'hold', 'mixed'].includes(x.k) || (x.k === 'wait' && x.then === 'potty')) potty++; if (x.low) low++; }); }
ok(potty === 0 && low > 0, `very low control on stage 4: no potty/wait-for-potty rules (${low} swapped for guidance/protection)`);
const sw = P.sweep(); ok(sw.bad.length === 0, `Test Mode sweep still clean (${sw.cases} cases)`);
// symptoms
ok(S.DEFS.every(d => d.what && d.changes.length && d.off), `${S.DEFS.length} definitions (symptoms + curses), each with what / changes / off`);
const prefs = { overactive_bladder: 'yes', cascade: 'maybe', quiet_signals: 'no' }; let maybeDays = 0;
for (let k = 0; k < 200; k++) { const on = S.activeToday(prefs, Date.UTC(2026, 0, 1) + k * 864e5); if (!on.includes('overactive_bladder') || on.includes('quiet_signals')) fail++; if (on.includes('cascade')) maybeDays++; }
ok(maybeDays > 40 && maybeDays < 120, `Yes always on, No never, Maybe on some days (${maybeDays}/200)`);
ok(JSON.stringify(S.activeToday(prefs, new Date(2026, 3, 3, 1).getTime())) === JSON.stringify(S.activeToday(prefs, new Date(2026, 3, 3, 23).getTime())), 'Maybe is stable within a day');
// calibration
const now = Date.now(); const empty = C.compute(C.load(), [], now); ok(empty.estimate === null && empty.confidence === 0, 'no data → no estimate, 0% confidence');
const d = C.load(); d.holds = [{ min: 10 }, { min: 12 }, { min: 30 }]; d.urges = [0, 1, 2, 3, 4, 5, 6].map(k => ({ went: now - 3600e3 * (2 * k + 1) }));
d.predictions = [1, 2, 3, 4].map(() => ({ pred: 5, actual: 6 })); const ent = [0, 1, 2, 3, 4].map(k => ({ type: 'night', source: 'natural', ts: now - k * 864e5, night: { wet: k === 0 } }));
const c = C.compute(d, ent, now); ok(c.estimate > 0 && c.confidence > 40, `blend: ${c.estimate} ± ${c.band}, confidence ${c.confidence}%`);
ok(c.methods.hold.score <= 100 && C.HOLD_CAP === 20, 'hold test is capped at 20 min');
C.holdStart(3); const rr = C.holdStop('real', Date.now() + 99 * 60000); ok(rr.min === 20 && rr.reason === 'real', 'real-need stop recorded; time capped');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
