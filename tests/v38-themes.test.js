/**
 * v38 CSS look themes — catalog, persistence key, DOM apply, CSS tokens.
 * Run: node tests/v38-themes.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let fails = 0;
function ok(cond, msg) { if (!cond) { console.error('FAIL', msg); fails++; } else console.log('ok', msg); }

const hub = read('js/hub.js');
const css = read('mobile.css');
const idx = read('index.html');
const wn = read('js/whats-new-data.js');
const pp = read('js/path-play.js');
const pathJs = read('js/potty-path.js');

const IDS = ['neutral','girl','boy','softpink','sky','lavender','midnight'];
ok(IDS.every(id => hub.includes("id: '" + id + "'") || hub.includes('id: "' + id + '"') || hub.includes(id + ':')), 'hub THEMES catalog has all ids');
ok(hub.includes('PLAY_KEY = \'bs_play_prefs_v1\'') || hub.includes('bs_play_prefs_v1'), 'storage key bs_play_prefs_v1 unchanged');
ok(hub.includes('function setTheme') && hub.includes('applyThemeDom') && hub.includes('themePickerHtml'), 'hub theme APIs');
ok(hub.includes('data-bs-theme'), 'sets data-bs-theme');
ok(IDS.every(id => css.includes('bs-theme-' + id) && css.includes('data-bs-theme="' + id + '"')), 'CSS skins for every theme');
ok(['--bg','--panel','--accent','--accent2','--nav','--btn'].every(v => css.includes(v)), 'CSS theme tokens present');
ok(css.includes('.bs-theme-picker') && css.includes('.bs-sw-chip'), 'theme picker swatches');
ok(idx.includes('id="themeSeg"') && idx.includes('App look'), 'Settings App look host');
ok(idx.includes('themePickerHtml') || idx.includes('BSHub.themePickerHtml'), 'Settings paints picker');
ok(pp.includes('themePickerHtml') && pp.includes('App look'), 'Deep start uses look picker');
ok(pathJs.includes('applyThemeDom') || pathJs.includes('THEME_IDS'), 'Path applyThemeClass uses hub');
ok(wn.includes("hash: 'v38'") || wn.includes('hash: "v38"'), 'Whats New v38');
ok(!hub.includes("t === 'girl' || t === 'boy') ? t : 'neutral'") || hub.includes('THEMES[t]'), 'themeId accepts new ids');

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('All v38 theme checks passed.');
