/* ===========================
   tabs.js — v3 mobile-first shell: tab switching, sticky status bar,
   unread-log dot. Pure UI; never plays sound or vibrates.
   =========================== */
(function () {
  const TABS = ['session', 'path', 'log', 'urge', 'calendar', 'profiles', 'settings'];
  const KEY = 'bs_active_tab';
  let current = 'session';

  function isWide() { return window.matchMedia && window.matchMedia('(min-width: 1000px)').matches; }

  function switchTab(name) {
    if (!TABS.includes(name)) name = 'session';
    if (name === 'log' && isWide()) name = 'session';
    current = name;
    document.querySelectorAll('.tab-page').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
    document.querySelectorAll('#tabBar [data-go]').forEach(b => b.setAttribute('aria-selected', b.dataset.go === name ? 'true' : 'false'));
    document.body.dataset.tab = name;
    try { localStorage.setItem(KEY, name); } catch (e) {}
    if (name === 'log') { const d = document.getElementById('logDot'); if (d) d.classList.remove('on'); }
    if (name === 'urge' && typeof window.renderUrge === 'function') window.renderUrge();
    if (name === 'path' && typeof window.renderPath === 'function') window.renderPath();
    if (name === 'calendar' && typeof window.renderCalendarInline === 'function') window.renderCalendarInline();
    if (window.BSDryClip && window.BSDryClip.refreshBadge) try { window.BSDryClip.refreshBadge(); } catch (e) {}
    if (name === 'settings' && typeof window.renderCalendarSettings === 'function') window.renderCalendarSettings();
    if (name === 'profiles' && typeof window.renderMyProfile === 'function') window.renderMyProfile();
    if (name === 'profiles' && typeof window.renderPottyReport === 'function') window.renderPottyReport(false);
    if (name === 'session' && window.BSNight && window.BSNight.updateEveningCard) window.BSNight.updateEveningCard();
    if (name === 'profiles' && typeof window.renderCampaign === 'function') window.renderCampaign();
    if (name === 'profiles' && typeof window.renderBoard === 'function') window.renderBoard();
    if (name === 'settings' && window.BSGrace) window.BSGrace.renderSettings();
    if (name === 'settings' && typeof window.renderCalibration === 'function') window.renderCalibration();
    if (name === 'settings' && window.BSDryClip) try { window.BSDryClip.renderLab(); } catch (e) {}
    if (name === 'settings' && typeof window.renderAlarmReliability === 'function') window.renderAlarmReliability();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  window.switchTab = switchTab;
  window.currentTab = () => current;

  function txt(id) { const el = document.getElementById(id); return el ? el.textContent.trim() : ''; }
  function updateStatus() {
    try {
      const urg = Math.max(0, Math.min(100, +(typeof manualPressure !== 'undefined' ? manualPressure : 0) || 0));
      const sat = Math.max(0, Math.min(100, +(typeof manualSaturation !== 'undefined' ? manualSaturation : 0) || 0));
      const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
      set('sbUrgV', Math.round(urg / 10) + '/10');
      set('sbSatV', Math.round(sat) + '%');
      const u = document.getElementById('sbUrg'); if (u) u.style.width = urg + '%';
      const s = document.getElementById('sbSat'); if (s) s.style.width = sat + '%';
      set('sbTimer', txt('sessionTimerDisplay') || '00:00');
      set('sbState', txt('sessionTimerState') || '');
      const running = typeof sessionRunning !== 'undefined' && sessionRunning;
      document.body.classList.toggle('session-off', !running);
      const hide = document.getElementById('hideCountdown');
      let next = running ? (txt('countdown') || '—') : '—';
      if (running && hide && hide.checked) next = 'hidden';
      set('sbNext', next.length > 22 ? next.slice(0, 21) + '…' : next);
    } catch (e) {}
  }

  window.addEventListener('load', () => {
    document.querySelectorAll('#tabBar [data-go]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.go)));
    let start = 'session';
    try { start = localStorage.getItem(KEY) || 'session'; } catch (e) {}
    switchTab(start);
    // Calendar lives in its own tab now.
    window.openCalendar = function () { switchTab('calendar'); };
    // Unread dot for the log when it changes off-screen.
    const out = document.getElementById('output');
    if (out && window.MutationObserver) {
      new MutationObserver(() => {
        if (current !== 'log' && !isWide()) { const d = document.getElementById('logDot'); if (d) d.classList.add('on'); }
      }).observe(out, { childList: true, subtree: true, characterData: true });
    }
    updateStatus();
    setInterval(updateStatus, 1000);
  });
})();
