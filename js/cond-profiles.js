/* ===========================
   cond-profiles.js — v49 several conditioning profiles.
   The active slot is mirrored onto bs_conditioning_v1.profile so older
   readers keep working. Each slot keeps its own habits, check-ins, and
   event log. Session, Urge, and Profiles render the same manager.
   =========================== */
(function () {
  const O = window.BSOnboard;
  if (!O || !O.load || !O.save) return;
  let seq = 1;
  function uid() { seq += 1; return 'cp' + seq.toString(36) + Date.now().toString(36); }
  function snapshotCheckins() {
    try { return window.BSCheckins && window.BSCheckins.load ? (window.BSCheckins.load().items || []).slice() : []; } catch (e) { return []; }
  }
  function restoreCheckins(items) {
    try {
      if (!window.BSCheckins || !window.BSCheckins.load || !window.BSCheckins.save) return;
      const s = window.BSCheckins.load();
      s.items = Array.isArray(items) ? items : [];
      window.BSCheckins.save(s);
    } catch (e) {}
  }
  function emptySlot(id, name) {
    return { id: id, name: name || 'My Conditioning', createdAt: Date.now(), completedAt: 0, profile: null, habits: null, diary: [], calibration: null, intakeAnswers: null, checkins: [], eventLog: [] };
  }
  function fillSlot(slot, s) {
    slot.profile = s.profile;
    slot.habits = s.habits;
    slot.completedAt = s.completedAt || 0;
    slot.diary = s.diary || [];
    slot.calibration = s.calibration || null;
    slot.intakeAnswers = s.intakeAnswers || null;
    slot.eventLog = s.eventLog || slot.eventLog || [];
    slot.checkins = snapshotCheckins();
    if (s.profile) s.profile.name = slot.name;
  }
  function mirror(s, slot) {
    if (!slot) {
      s.profile = null;
      s.completedAt = 0;
      return s;
    }
    s.profile = slot.profile;
    s.habits = slot.habits || s.habits;
    s.completedAt = slot.completedAt || (slot.profile ? s.completedAt : 0);
    s.diary = slot.diary || [];
    s.calibration = slot.calibration || null;
    s.intakeAnswers = slot.intakeAnswers || null;
    s.eventLog = slot.eventLog || [];
    if (s.profile) s.profile.name = slot.name;
    return s;
  }
  function ensureLibrary(s) {
    const had = Array.isArray(s.profiles);
    if (!had) {
      s.profiles = [];
      if (s.profile) {
        const slot = emptySlot(uid(), 'My Conditioning');
        fillSlot(slot, s);
        slot.checkins = snapshotCheckins();
        s.profiles.push(slot);
        s.activeId = slot.id;
        s._libraryMigrated = true;
      }
    }
    if (!s.activeId || !s.profiles.some(p => p.id === s.activeId)) s.activeId = s.profiles[0] ? s.profiles[0].id : null;
    if (had) mirror(s, s.profiles.find(p => p.id === s.activeId));
    return s;
  }
  function writeBack(s) {
    if (!s) return s;
    if (!Array.isArray(s.profiles)) s.profiles = [];
    if (s.creatingId && s.quizStep === 'flow') return s;
    if (s.creatingId && s.profile && s.completedAt && s.quizStep !== 'flow') {
      let slot = s.profiles.find(p => p.id === s.creatingId);
      if (!slot) {
        slot = emptySlot(s.creatingId, s.draftName || ('Conditioning ' + (s.profiles.length + 1)));
        s.profiles.push(slot);
      }
      fillSlot(slot, s);
      s.activeId = slot.id;
      s.creatingId = null;
      s.draftName = '';
      return s;
    }
    if (s.profile && !s.activeId) {
      const slot = emptySlot(uid(), 'My Conditioning');
      fillSlot(slot, s);
      s.profiles.push(slot);
      s.activeId = slot.id;
      return s;
    }
    const slot = s.profiles.find(p => p.id === s.activeId);
    if (slot && s.profile) fillSlot(slot, s);
    return s;
  }
  function list() { return (O.load().profiles || []).map(p => ({ id: p.id, name: p.name, active: p.id === O.load().activeId, completedAt: p.completedAt })); }
  function active() {
    const s = O.load();
    return (s.profiles || []).find(p => p.id === s.activeId) || null;
  }
  function setActive(id) {
    const s = O.load();
    writeBack(s);
    const slot = (s.profiles || []).find(p => p.id === id);
    if (!slot) return { ok: false, reason: 'missing' };
    s.activeId = id;
    mirror(s, slot);
    restoreCheckins(slot.checkins || []);
    O.save(s);
    return { ok: true, id: id };
  }
  function beginNew() {
    const s = O.load();
    writeBack(s);
    s.creatingId = uid();
    s.draftName = 'Conditioning ' + ((s.profiles || []).length + 1);
    s.quizStep = 'flow';
    O.save(s);
    try { if (O.startIntake) O.startIntake(null); } catch (e) {}
    return { ok: true, id: s.creatingId };
  }
  function retake() {
    const s = O.load();
    s.creatingId = null;
    O.save(s);
    try { if (O.startIntake) O.startIntake(null); } catch (e) {}
    return { ok: true, id: s.activeId };
  }
  function duplicate(id) {
    const s = O.load();
    writeBack(s);
    const slot = (s.profiles || []).find(p => p.id === id) || active();
    if (!slot) return { ok: false, reason: 'missing' };
    const copy = JSON.parse(JSON.stringify(slot));
    copy.id = uid();
    copy.name = 'Copy of ' + slot.name;
    copy.createdAt = Date.now();
    s.profiles.push(copy);
    O.save(s);
    return { ok: true, id: copy.id, name: copy.name };
  }
  function rename(id, name) {
    const s = O.load();
    const slot = (s.profiles || []).find(p => p.id === id);
    if (!slot) return { ok: false, reason: 'missing' };
    slot.name = String(name || '').trim() || slot.name;
    if (slot.profile) slot.profile.name = slot.name;
    if (s.activeId === slot.id && s.profile) s.profile.name = slot.name;
    O.save(s);
    return { ok: true, name: slot.name };
  }
  function remove(id, confirm) {
    if (confirm !== true) return { ok: false, reason: 'confirm' };
    const s = O.load();
    writeBack(s);
    const before = (s.profiles || []).length;
    s.profiles = (s.profiles || []).filter(p => p.id !== id);
    if (s.profiles.length === before) return { ok: false, reason: 'missing' };
    if (s.activeId === id) {
      s.activeId = s.profiles[0] ? s.profiles[0].id : null;
      mirror(s, s.profiles[0] || null);
      restoreCheckins(s.profiles[0] ? s.profiles[0].checkins : []);
    }
    O.save(s);
    return { ok: true };
  }
  function effectiveSnapshot(profile) {
    const out = {};
    try {
      if (window.BSIntake && window.BSIntake.urgeModel) {
        out.day = window.BSIntake.urgeModel('day', { profile: profile });
        out.night = window.BSIntake.urgeModel('night', { profile: profile });
      }
    } catch (e) {}
    return out;
  }
  function pack(slot) {
    const profile = slot.profile || {};
    return {
      app: 'BladderSim',
      kind: 'conditioning-profile',
      version: '49',
      exportedAt: new Date().toISOString(),
      id: slot.id,
      name: slot.name,
      quiz: slot.intakeAnswers || null,
      nowWant: profile.dimensions || null,
      pacing: profile.pacing || null,
      methods: profile.methods || null,
      goals: profile.goals || [],
      direction: profile.direction || null,
      starting: profile.starting || null,
      target: profile.target || null,
      levelKey: profile.levelKey || null,
      targetKey: profile.targetKey || null,
      urgency: profile.urgency || null,
      sleep: profile.sleep || null,
      checkins: slot.checkins || [],
      habits: slot.habits || null,
      eventLog: slot.eventLog || [],
      effective: effectiveSnapshot(profile)
    };
  }
  function exportProfile(id) {
    const s = O.load();
    writeBack(s);
    const slot = (s.profiles || []).find(p => p.id === id) || active();
    if (!slot || !slot.profile) return { ok: false, reason: 'missing' };
    return { ok: true, data: pack(slot), json: JSON.stringify(pack(slot), null, 1) };
  }
  function exportAll() {
    const s = O.load();
    writeBack(s);
    const data = { app: 'BladderSim', kind: 'conditioning-library', version: '49', exportedAt: new Date().toISOString(), profiles: (s.profiles || []).filter(p => p.profile).map(pack) };
    return { ok: true, data: data, json: JSON.stringify(data, null, 1) };
  }
  function summaryText(id) {
    const exp = exportProfile(id);
    if (!exp.ok) return '';
    const d = exp.data;
    const line = (track) => {
      const lv = d.levelKey && d.levelKey[track];
      const tv = d.targetKey && d.targetKey[track];
      const pace = d.pacing && d.pacing[track];
      return (track === 'day' ? 'Day' : 'Night') + ': ' + (lv || '—') + ' → ' + (tv || '—') + (pace ? ' (' + pace + ')' : '');
    };
    const dims = [];
    ['day', 'night'].forEach(track => {
      const bag = d.nowWant && d.nowWant[track];
      if (!bag) return;
      Object.keys(bag).forEach(k => {
        const row = bag[k];
        if (!row || row.nowText == null) return;
        dims.push((track === 'day' ? 'Day' : 'Night') + ' ' + (row.name || k) + ': ' + row.nowText + ' → ' + (row.wantText || '—'));
      });
    });
    const methods = (d.methods && (d.methods.day || []).concat(d.methods.night || [])) || [];
    return [
      'Conditioning profile: ' + d.name,
      'App version ' + d.version,
      line('day'),
      line('night'),
      dims.slice(0, 12).join('\n') || 'No per-dimension answers stored.',
      'Methods: ' + (methods.join(', ') || 'none'),
      'Check-ins stored: ' + (d.checkins || []).length,
      'Events logged: ' + (d.eventLog || []).length
    ].filter(Boolean).join('\n');
  }
  function validPack(d) {
    if (!d || typeof d !== 'object') return false;
    if (d.kind === 'conditioning-profile') return !!(d.nowWant || d.starting || d.levelKey);
    return false;
  }
  function slotFromPack(d) {
    const slot = emptySlot(uid(), d.name || 'Imported conditioning');
    slot.completedAt = Date.now();
    slot.intakeAnswers = d.quiz || null;
    slot.checkins = Array.isArray(d.checkins) ? d.checkins : [];
    slot.habits = d.habits || null;
    slot.eventLog = Array.isArray(d.eventLog) ? d.eventLog : [];
    slot.profile = {
      name: slot.name,
      starting: d.starting || { day: 60, night: 60 },
      target: d.target || d.starting || { day: 60, night: 60 },
      levelKey: d.levelKey || { day: 'okay', night: 'okay' },
      targetKey: d.targetKey || d.levelKey || { day: 'okay', night: 'okay' },
      direction: d.direction || { day: 'off', night: 'off' },
      goals: d.goals || [],
      methods: d.methods || { day: [], night: [] },
      dimensions: d.nowWant || null,
      pacing: d.pacing || { day: 'gradual', night: 'gradual' },
      urgency: d.urgency || null,
      sleep: d.sleep || null,
      intensity: 'steady',
      timeframe: 'open'
    };
    return slot;
  }
  function importJson(text) {
    let data;
    try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, reason: 'json' }; }
    const packs = data && data.kind === 'conditioning-library' ? data.profiles : (validPack(data) ? [data] : null);
    if (!packs) return { ok: false, reason: 'kind' };
    const s = O.load();
    const ids = [];
    packs.forEach(d => {
      if (!validPack(d)) return;
      const slot = slotFromPack(d);
      s.profiles.push(slot);
      ids.push(slot.id);
    });
    if (!ids.length) return { ok: false, reason: 'empty' };
    if (!s.activeId) {
      s.activeId = ids[0];
      mirror(s, s.profiles.find(p => p.id === ids[0]));
    }
    O.save(s);
    return { ok: true, ids: ids };
  }
  function managerHtml() {
    const s = O.load();
    const options = (s.profiles || []).map(p => `<option value="${p.id}" ${p.id === s.activeId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const pace = (track) => {
      const v = (s.profile && s.profile.pacing && s.profile.pacing[track]) || 'gradual';
      return `<label class="urge-lbl condPace">${track === 'day' ? 'Day' : 'Night'} pacing <select data-cpace="${track}">
        ${['instant', 'gradual', 'slow', 'hybrid'].map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></label>`;
    };
    return `<div class="cond-manager urge-note">
      <b>Conditioning profiles</b>
      <label class="urge-lbl">Profile <select class="condProfileSelect">${options || '<option value="">No profile yet</option>'}</select></label>
      <div class="quiz-nav">
        <button type="button" data-cact="new">New</button>
        <button type="button" data-cact="retake">Retake</button>
        <button type="button" data-cact="pace">Edit pacing</button>
        <button type="button" data-cact="dup">Duplicate</button>
        <button type="button" data-cact="rename">Rename</button>
        <button type="button" data-cact="delete">Delete</button>
        <button type="button" data-cact="export">Export</button>
        <button type="button" data-cact="import">Import</button>
        <button type="button" data-cact="export-all">Export all</button>
      </div>
      <div class="condPaceBlock">${pace('day')}${pace('night')}</div>
      <div class="cal-legend">New keeps your other profiles. Retake overwrites this one. Export is JSON plus a text summary.</div>
    </div>`;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function selectedId(root) {
    const sel = root && root.querySelector && root.querySelector('.condProfileSelect');
    return (sel && sel.value) || (active() && active().id) || null;
  }
  function copyText(text) {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return { ok: true, method: 'clipboard' };
      }
    } catch (e) {}
    return { ok: false, method: 'none', text: text };
  }
  function download(filename, text) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) { return false; }
  }
  function share(text, title) {
    const copied = copyText(text);
    try {
      const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
      if (cap && cap.share) cap.share({ title: title, text: text, dialogTitle: title });
    } catch (e) {}
    if (!copied.ok) download('conditioning-profile.json', text);
    return copied;
  }
  function onAct(act, root) {
    const id = selectedId(root);
    if (act === 'new') { beginNew(); return; }
    if (act === 'retake') { if (id) setActive(id); retake(); return; }
    if (act === 'pace') {
      const block = root && root.querySelector && root.querySelector('.condPaceBlock');
      if (block && block.scrollIntoView) block.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (act === 'dup') { duplicate(id); renderAll(); return; }
    if (act === 'rename') {
      const slot = (O.load().profiles || []).find(p => p.id === id);
      const name = (typeof prompt === 'function') ? prompt('Profile name', slot ? slot.name : '') : null;
      if (name) rename(id, name);
      renderAll();
      return;
    }
    if (act === 'delete') {
      const pending = root && root.getAttribute('data-del') === id;
      if (!pending) { if (root) root.setAttribute('data-del', id || ''); return; }
      remove(id, true);
      if (root) root.removeAttribute('data-del');
      renderAll();
      return;
    }
    if (act === 'export' || act === 'export-all') {
      const exp = act === 'export-all' ? exportAll() : exportProfile(id);
      if (!exp.ok) return;
      const text = exp.json + '\n\n' + (act === 'export-all' ? '' : summaryText(id));
      share(text, 'Conditioning profile');
      return;
    }
    if (act === 'import') {
      const raw = (typeof prompt === 'function') ? prompt('Paste conditioning JSON') : null;
      if (raw) importJson(raw);
      renderAll();
    }
  }
  function renderInto(id) {
    const m = document.getElementById(id); if (!m) return;
    m.innerHTML = managerHtml();
    const sel = m.querySelector('.condProfileSelect');
    if (sel) sel.onchange = () => { if (sel.value) { setActive(sel.value); renderAll(); } };
    m.querySelectorAll('[data-cact]').forEach(b => { b.onclick = () => onAct(b.getAttribute('data-cact'), m); });
    m.querySelectorAll('[data-cpace]').forEach(sel => {
      sel.onchange = () => { try { if (O.setPacing) O.setPacing(sel.getAttribute('data-cpace'), sel.value); } catch (e) {} };
    });
  }
  function renderAll() {
    ['condPickSession', 'condPickUrge', 'condProfileManager'].forEach(renderInto);
    const top = document.getElementById('condHubTop');
    const rest = document.getElementById('condHubRest');
    if (top) top.innerHTML = `<div class="urge-note"><b>Conditioning profiles</b><div class="cal-legend">Pick, create, and export them at the top of Session, Urge, and Profiles. This section keeps bladder calibration.</div><button type="button" id="condGoProfiles" class="pill">Open conditioning profiles</button></div>`;
    if (rest) rest.innerHTML = '';
    const go = document.getElementById('condGoProfiles');
    if (go) go.onclick = () => {
      try { if (typeof switchTab === 'function') switchTab('profiles'); } catch (e) {}
      const el = document.getElementById('condProfileManager');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
    };
  }
  const origRender = O.render;
  O.render = function () {
    if (origRender) origRender();
    try { renderAll(); } catch (e) {}
  };
  window.BSCondProfiles = {
    list, active, setActive, beginNew, retake, duplicate, rename, remove,
    exportProfile, exportAll, summaryText, importJson, managerHtml, renderAll, pack,
    ensure: ensureLibrary, writeBack
  };
  try { window.addEventListener('load', () => { try { renderAll(); } catch (e) {} }); } catch (e) {}
})();
