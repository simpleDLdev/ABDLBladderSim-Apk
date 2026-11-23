// v49: section order, hide/show, and layout reset.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const store = {};
const ctx = {
  console, Date, Math, Object, Array, JSON,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: {
    addEventListener() {},
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
    head: { appendChild() {} },
    querySelectorAll: () => [],
    getElementById: () => null
  },
  addEventListener() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'layout.js'), 'utf8'), ctx, { filename: 'layout.js' });
const L = ctx.BSLayout;
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const ids = ['setPlay', 'setAlarms', 'setCalib'];
ok(L.move(ids, 'setCalib', 'up').join() === 'setPlay,setCalib,setAlarms', 'move up swaps with the neighbour');
ok(L.move(ids, 'setPlay', 'up').join() === ids.join(), 'move up at the top stays put');

const g = { order: ids.slice(), hidden: [], pinned: [], open: {} };
L.hideId(g, 'setAlarms');
ok(L.visibleOrder(ids, g).indexOf('setAlarms') < 0 && g.hidden.indexOf('setAlarms') >= 0, 'hide drops the section from the visible order');
L.showId(g, 'setAlarms');
ok(g.hidden.indexOf('setAlarms') < 0 && L.visibleOrder(ids, g).indexOf('setAlarms') >= 0, 'show puts the section back');
L.togglePin(g, 'setCalib');
ok(L.visibleOrder(ids, g)[0] === 'setCalib', 'pin moves the section to the front');

let s = L.blank();
s.groups.settings = g;
s.tabs = L.move(L.TABS, 'settings', 'up');
L.save(s);
const back = L.load();
ok(back.groups.settings.pinned[0] === 'setCalib' && back.tabs[back.tabs.length - 2] === 'settings', 'order and pin persist');
const cleared = L.reset();
ok(cleared.groups.settings == null || !(cleared.groups.settings.hidden || []).length, 'reset clears hidden sections');
ok(cleared.tabs.join() === L.TABS.join(), 'reset restores the default tab order');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('js/layout.js') >= 0 && html.indexOf('id="layoutTabOrder"') >= 0, 'layout script and tab-order host are on the page');
ok(!/id="setCalib" open/.test(html) && !/id="setPlay" open/.test(html), 'settings sections start collapsed');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('v49 layout tests passed');
