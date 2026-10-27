// v41: themed surfaces replace leftover navy cards. Theme ids and storage key stay.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let fail = 0;
function ok(c, m) { if (!c) { console.error('FAIL', m); fail++; } else console.log('PASS', m); }

const css = read('mobile.css');
const pp = read('js/potty-path.js');
const hub = read('js/hub.js');
ok(css.includes('details.set-sec') && css.includes('.cal-entry') && css.includes('background: var(--panel-2)'), 'settings and calendar cards use panel tokens');
ok(css.includes('[style*="background:#1b2030"]') && css.includes('background-color: var(--panel-2) !important'), 'inline navy rows follow the skin');
ok(css.includes('.sb-bar { background: #c96b7c') && css.includes('.sb-bar { background: #7ec8ff'), 'light-skin status tracks are visible');
ok(pp.includes('var(--board, #1e2a3a)') && pp.includes('var(--track, #3d5a80)') && pp.includes('class="pp-board-bg"'), 'path board fill comes from the skin');
ok(hub.includes("PLAY_KEY = 'bs_play_prefs_v1'") || hub.includes('bs_play_prefs_v1'), 'theme key unchanged');
['neutral', 'girl', 'boy', 'baby', 'toddler', 'teen'].forEach(id => ok(hub.includes(id + ':'), 'theme id ' + id));
ok(/versionName "\d+"/.test(read('android/app/build.gradle')) && /versionCode \d+/.test(read('android/app/build.gradle')), 'gradle version present');
ok(read('js/whats-new-data.js').includes("hash: 'v41'"), "What's New v41");
console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
