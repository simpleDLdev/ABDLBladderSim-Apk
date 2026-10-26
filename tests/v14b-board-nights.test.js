// v14b: nightsInLastDays + board simulatePass (node, jsdom-free via stubs)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fails = 0;
function check(name, ok, info) {
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : ''));
}

const root = path.join(__dirname, '..');
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

function dayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const sandbox = {
  localStorage,
  Date,
  Math,
  JSON,
  console,
  document: {
    getElementById: () => null,
    addEventListener: () => {},
    visibilityState: 'visible'
  },
  setTimeout,
  addEventListener: () => {},
};
sandbox.window = sandbox;
sandbox.window.BSCalendar = { dayKey, load: () => ({ entries: [] }) };
sandbox.window.BSOffice = { on: () => false };

function loadScript(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: rel });
}

loadScript('js/potty-report.js');
loadScript('js/board.js');

const R = sandbox.window.BSReport;
const B = sandbox.window.BSBoard;

// --- nightsInLastDays ---
const now = Date.now();
const nights = [];
for (let i = 0; i < 20; i++) {
  const ts = now - i * 864e5;
  nights.push({ ts, type: 'night', night: { wet: i % 2 === 0 } });
}
// also one very old
nights.push({ ts: now - 60 * 864e5, type: 'night', night: { wet: true } });

const last5 = R.nightsInLastDays(nights, 5);
check('nightsInLastDays: 5 days count', last5.length === 5, 'got ' + last5.length);
check('nightsInLastDays: excludes old', !last5.some(e => e.ts < now - 6 * 864e5));
const last14 = R.nightsInLastDays(nights, 14);
check('nightsInLastDays: 14 days', last14.length === 14, 'got ' + last14.length);

// denyFlavour
const line = R.denyFlavour('little', 'diaper', { voice: 'caregiver', office: false });
check('denyFlavour caregiver diaper', /Mommy|diaper/i.test(line), line);
const coach = R.denyFlavour('little', 'diaper', { office: true });
check('denyFlavour office neutral', /protection|wait|Use/i.test(coach) && !/Mommy/i.test(coach), coach);

// --- board simulate ---
const board = B.blankBoard({ length: 60, seed: 42, dir: 'grow', band: 'shaky' });
check('board blank length', board.length === 60 && board.pos === 1);
check('board has snakes/ladders', board.snakes.length >= 2 && board.ladders.length >= 2);
check('board squares assigned', Object.keys(board.squares).length >= 8);

const t0 = Date.now();
const done = B.simulatePass(board, { band: 'shaky' });
const ms = Date.now() - t0;
check('simulate finishes', !!done.finished && done.pos >= done.length, JSON.stringify({ pos: done.pos, finished: done.finished, steps: done.testSteps }));
check('simulate under 10s', ms < 10000, ms + 'ms');
check('simulate log has square/kind/outcome', done.testLog.length > 0 && done.testLog.every(e => e.square && e.kind && e.outcome));
check('simulate log readable fields', done.testLog.some(e => e.zone && e.band));

const stepBoard = B.blankBoard({ length: 20, seed: 7, dir: 'grow', band: 'okay' });
B.save(stepBoard);
const r1 = B.advanceOne(B.load(), { band: 'okay', die: 3 });
check('step advances', r1.to > 1 && r1.entry && r1.entry.kind, JSON.stringify({ to: r1.to, kind: r1.entry && r1.entry.kind }));

const text = B.formatLogText(done);
check('export text non-empty', text.includes('Potty Path test log') && text.includes('outcome:'));

process.exit(fails ? 1 : 0);
