/* ===========================
   layout.js — v49 reorder, pin, and hide for collapsible sections.
   Up and down buttons are the control that works on a phone. Order, hidden,
   pin, and open state are stored per group. The bottom tabs can be reordered
   from Settings; the tab bar itself stays icon-only because seven labels
   already fill the width.
   =========================== */
(function () {
  const KEY = 'bs_layout_v1';
  const TABS = ['session', 'path', 'log', 'urge', 'calendar', 'profiles', 'settings'];
  function blank() { return { v: 1, tabs: TABS.slice(), groups: {} }; }
  function load() {
    let s = blank();
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.v === 1) s = Object.assign(blank(), v); } catch (e) {}
    s.groups = s.groups || {};
    s.tabs = Array.isArray(s.tabs) && s.tabs.length ? s.tabs : TABS.slice();
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} return s; }
  function groupOf(s, key) {
    s.groups[key] = s.groups[key] || { order: [], hidden: [], pinned: [], open: {} };
    const g = s.groups[key];
    g.order = g.order || []; g.hidden = g.hidden || []; g.pinned = g.pinned || []; g.open = g.open || {};
    return g;
  }
  /** ids currently in the parent, in saved order: pinned, then the rest, minus hidden. Unknown ids append. */
  function visibleOrder(ids, group) {
    const g = group || { order: [], hidden: [], pinned: [] };
    const hidden = new Set(g.hidden || []);
    const have = new Set(ids);
    const pinned = (g.pinned || []).filter(id => have.has(id) && !hidden.has(id));
    const pin = new Set(pinned);
    const rest = (g.order || []).filter(id => have.has(id) && !hidden.has(id) && !pin.has(id));
    const known = new Set(pinned.concat(rest).concat(g.hidden || []));
    ids.forEach(id => { if (!known.has(id) && !hidden.has(id)) rest.push(id); });
    return pinned.concat(rest);
  }
  function reorderList(ids, id, toIndex) {
    const list = ids.filter(x => x !== id);
    const at = Math.max(0, Math.min(list.length, toIndex | 0));
    list.splice(at, 0, id);
    return list;
  }
  function move(ids, id, dir) {
    const list = ids.slice();
    const i = list.indexOf(id);
    if (i < 0) return list;
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return list;
    const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    return list;
  }
  function hideId(group, id) {
    if (group.hidden.indexOf(id) < 0) group.hidden.push(id);
    group.pinned = group.pinned.filter(x => x !== id);
    return group;
  }
  function showId(group, id) {
    group.hidden = group.hidden.filter(x => x !== id);
    if (group.order.indexOf(id) < 0) group.order.push(id);
    return group;
  }
  function togglePin(group, id) {
    if (group.pinned.indexOf(id) >= 0) group.pinned = group.pinned.filter(x => x !== id);
    else group.pinned.unshift(id);
    return group;
  }
  let original = null;
  function groupKey(parent) {
    if (!parent) return 'root';
    if (parent.id) return parent.id;
    if (parent.dataset && parent.dataset.tab) return 'tab-' + parent.dataset.tab;
    return 'p-' + (parent.className || 'x').toString().slice(0, 24);
  }
  function ensureId(d, n) {
    if (d.id) return d.id;
    const sum = d.querySelector('summary');
    const text = (sum ? sum.textContent : 'section').replace(/\s+/g, ' ').trim().slice(0, 40);
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) >>> 0;
    d.id = 'lay' + h.toString(36) + (n || 0);
    return d.id;
  }
  function capture(doc) {
    doc = doc || document;
    if (!doc.querySelectorAll) return original;
    if (original) return original;
    const tabs = [...doc.querySelectorAll('#tabBar [data-go]')].map(b => b.dataset.go);
    const groups = {};
    doc.querySelectorAll('.tab-page').forEach(page => {
      page.querySelectorAll('details').forEach((d, i) => ensureId(d, i));
    });
    const parents = new Set();
    doc.querySelectorAll('.tab-page details').forEach(d => parents.add(d.parentElement));
    parents.forEach(p => {
      if (!p) return;
      groups[groupKey(p)] = [...p.children].filter(n => n.tagName === 'DETAILS').map(d => d.id);
    });
    original = { tabs: tabs.length ? tabs : TABS.slice(), groups: groups };
    return original;
  }
  function injectBar(d) {
    const sum = d.querySelector('summary');
    if (!sum || sum.querySelector('.lay-grip')) return;
    const grip = document.createElement('span');
    grip.className = 'lay-grip';
    grip.textContent = '≡';
    grip.setAttribute('role', 'button');
    grip.setAttribute('aria-label', 'Drag to reorder');
    const menu = document.createElement('span');
    menu.className = 'lay-menu';
    menu.innerHTML = '<button type="button" class="lay-more" aria-label="Section menu">⋮</button><span class="lay-pop" hidden><button type="button" data-lay="pin">Pin</button><button type="button" data-lay="hide">Hide</button></span>';
    sum.insertBefore(grip, sum.firstChild);
    sum.appendChild(menu);
    const more = menu.querySelector('.lay-more');
    const pop = menu.querySelector('.lay-pop');
    more.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); pop.hidden = !pop.hidden; });
    menu.addEventListener('click', ev => ev.stopPropagation());
    grip.addEventListener('pointerdown', ev => startDrag(ev, d));
  }
  let drag = null;
  function startDrag(ev, details) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.pointerId != null && ev.target.setPointerCapture) { try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {} }
    drag = { id: details.id, group: groupKey(details.parentElement), y: ev.clientY, el: details };
  }
  function onPointerMove(ev) {
    if (!drag) return;
    const under = document.elementFromPoint && document.elementFromPoint(ev.clientX, ev.clientY);
    const hit = under && under.closest && under.closest('details');
    if (!hit || hit.id === drag.id || groupKey(hit.parentElement) !== drag.group) return;
    const parent = hit.parentElement;
    const ids = [...parent.children].filter(n => n.tagName === 'DETAILS' && !n.classList.contains('lay-hidden')).map(n => n.id);
    const to = ids.indexOf(hit.id);
    if (to < 0) return;
    place(drag.group, drag.id, ev.clientY < drag.y ? to : to + 1);
    drag.y = ev.clientY;
  }
  function onPointerUp() { drag = null; }
  function apply(doc) {
    doc = doc || document;
    if (!doc.querySelectorAll) return load();
    capture(doc);
    const s = load();
    const parents = new Set();
    doc.querySelectorAll('.tab-page details').forEach((d, i) => { ensureId(d, i); parents.add(d.parentElement); injectBar(d); });
    parents.forEach(p => {
      if (!p) return;
      const key = groupKey(p);
      const nodes = [...p.children].filter(n => n.tagName === 'DETAILS');
      const ids = nodes.map(n => n.id);
      const g = groupOf(s, key);
      if (!g.order.length) g.order = (original.groups[key] || ids).slice();
      const vis = visibleOrder(ids, g);
      const hidden = new Set(g.hidden);
      vis.forEach(id => { const n = nodes.find(d => d.id === id); if (n) p.appendChild(n); });
      nodes.forEach(n => {
        const off = hidden.has(n.id);
        n.classList.toggle('lay-hidden', off);
        if (Object.prototype.hasOwnProperty.call(g.open, n.id)) n.open = !!g.open[n.id];
      });
      let bin = p.querySelector(':scope > .lay-hidden-list');
      if (!bin) {
        bin = doc.createElement('div');
        bin.className = 'lay-hidden-list';
        p.appendChild(bin);
      }
      const names = g.hidden.filter(id => ids.indexOf(id) >= 0);
      bin.innerHTML = names.length ? '<div class="cal-legend">Hidden sections</div>' + names.map(id => {
        const n = nodes.find(d => d.id === id);
        const label = n && n.querySelector('summary') ? n.querySelector('summary').textContent.replace(/\s+/g, ' ').trim().slice(0, 48) : id;
        return '<button type="button" data-lay-show="' + id + '" data-lay-group="' + key + '">Show ' + label.replace(/[&<>]/g, '') + '</button>';
      }).join(' ') : '';
    });
    const bar = doc.getElementById('tabBar');
    if (bar && s.tabs && s.tabs.length) {
      s.tabs.forEach(name => {
        const b = bar.querySelector('[data-go="' + name + '"]');
        if (b) bar.appendChild(b);
      });
    }
    const host = doc.getElementById('layoutTabOrder');
    if (host) {
      const order = (s.tabs && s.tabs.length ? s.tabs : original.tabs).slice();
      host.innerHTML = '<div class="urge-note"><b>Tab order</b><div class="cal-legend">The tab bar stays icon-only. Move a tab here.</div>' +
        order.map(name => '<div class="lay-tab-row"><span>' + name + '</span> <button type="button" data-lay-tab="up" data-tab="' + name + '">↑</button> <button type="button" data-lay-tab="down" data-tab="' + name + '">↓</button></div>').join('') +
        '<button type="button" id="layoutReset">Reset layout</button></div>';
    }
    save(s);
    return s;
  }
  function act(groupKeyName, id, kind) {
    const s = load();
    const g = groupOf(s, groupKeyName);
    const base = (original && original.groups[groupKeyName]) || g.order;
    if (!g.order.length) g.order = base.slice();
    if (kind === 'up' || kind === 'down') g.order = move(visibleOrder(g.order.length ? g.order : base, g), id, kind);
    else if (kind === 'pin') togglePin(g, id);
    else if (kind === 'hide') hideId(g, id);
    else if (kind === 'show') showId(g, id);
    save(s);
    apply(document);
    return s;
  }
  function place(groupKeyName, id, index) {
    const s = load();
    const g = groupOf(s, groupKeyName);
    const base = (original && original.groups[groupKeyName]) || g.order;
    if (!g.order.length) g.order = base.slice();
    const vis = visibleOrder(g.order.length ? g.order : base, g);
    g.order = reorderList(vis, id, index);
    save(s);
    apply(document);
    return g.order;
  }
  function moveTab(name, dir) {
    const s = load();
    const cur = (s.tabs && s.tabs.length ? s.tabs : TABS).slice();
    s.tabs = move(cur, name, dir);
    save(s);
    apply(document);
    return s.tabs;
  }
  function setOpen(groupKeyName, id, open) {
    const s = load();
    groupOf(s, groupKeyName).open[id] = !!open;
    return save(s);
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    const s = blank();
    if (original) {
      Object.keys(original.groups).forEach(k => { s.groups[k] = { order: original.groups[k].slice(), hidden: [], pinned: [], open: {} }; });
      s.tabs = original.tabs.slice();
    }
    save(s);
    apply(document);
    return load();
  }
  function onClick(ev) {
    const t = ev.target;
    if (!t || !t.closest) return;
    const show = t.closest('[data-lay-show]');
    if (show) { ev.preventDefault(); act(show.getAttribute('data-lay-group'), show.getAttribute('data-lay-show'), 'show'); return; }
    const tabBtn = t.closest('[data-lay-tab]');
    if (tabBtn) { ev.preventDefault(); moveTab(tabBtn.getAttribute('data-tab'), tabBtn.getAttribute('data-lay-tab')); return; }
    if (t.id === 'layoutReset' || (t.closest && t.closest('#layoutReset'))) { ev.preventDefault(); reset(); return; }
    const btn = t.closest('.lay-pop [data-lay]');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const details = btn.closest('details');
    if (!details) return;
    act(groupKey(details.parentElement), details.id, btn.getAttribute('data-lay'));
  }
  function onToggle(ev) {
    const d = ev.target;
    if (!d || d.tagName !== 'DETAILS' || !d.closest || !d.closest('.tab-page')) return;
    setOpen(groupKey(d.parentElement), d.id, d.open);
  }
  window.BSLayout = {
    KEY, TABS, blank, load, save, visibleOrder, move, reorderList, place, hideId, showId, togglePin, moveTab, setOpen, reset, apply, act
  };
  const css = '.lay-grip{display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;margin-right:6px;border-radius:8px;border:1px solid #2b3348;background:#0f1115;color:#e7edf5;touch-action:none;cursor:grab}.lay-menu{float:right}.lay-more,.lay-pop button,.lay-hidden-list button,.lay-tab-row button,#layoutReset{min-height:36px;min-width:36px;padding:4px 8px;border-radius:8px;border:1px solid #2b3348;background:#0f1115;color:#e7edf5}.lay-pop{display:flex;gap:4px;margin-left:6px}.lay-pop[hidden]{display:none}.lay-hidden{display:none !important}.lay-tab-row{display:flex;gap:6px;align-items:center;margin:4px 0}.lay-hidden-list{margin:8px 0}';
  try {
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    document.addEventListener('click', onClick);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('toggle', onToggle, true);
    window.addEventListener('load', () => { try { apply(document); } catch (e) {} });
  } catch (e) {}
})();
