/* ===========================
   override-next.js — "Test / Override Next Major Event"
   Reschedules ONLY the next major (macro/main) event to a random time inside
   a user-entered min–max range in minutes. Decimals and very low values are
   allowed (e.g. 0.5–1) and the profile's normal range / 5-min floor is NOT
   applied. Micro timers are left alone. Disabled in bedwetting (silent) mode.
   =========================== */
(function () {
  function silent() { return typeof isBedwettingSilent === 'function' && isBedwettingSilent(); }

  function parseRange(text) {
    if (text == null) return null;
    const nums = String(text).replace(',', '.').match(/\d*\.?\d+/g);
    if (!nums || !nums.length) return null;
    let a = parseFloat(nums[0]);
    let b = nums.length > 1 ? parseFloat(nums[1]) : a;
    if (!isFinite(a) || !isFinite(b)) return null;
    if (a > b) [a, b] = [b, a];
    if (b <= 0) return null;
    a = Math.max(0.05, a); // 3s safety floor only (not a profile clamp)
    b = Math.max(a, b);
    return { min: a, max: b };
  }

  // Exposed for tests.
  window.parseOverrideRange = parseRange;

  /** Core reschedule. Returns the chosen delay in ms, or null if not applicable. */
  window.overrideNextMajorEvent = function (minMins, maxMins) {
    if (silent()) { toast('Disabled in Bedwetting mode (silent).'); return null; }
    if (!sessionRunning) { toast('Start a session first.'); return null; }
    const cfg = getProfileConfig();
    const sched = cfg.scheduler;
    if (sched === 'chaos') { toast('Quick/Chaos mode has no timed major event.'); return null; }

    const mins = minMins + Math.random() * (maxMins - minMins);
    const ms = Math.max(3000, Math.round(mins * 60000));
    const runtime = (typeof customProfileRuntime !== 'undefined') ? customProfileRuntime : null;

    if (sched === 'babysitter') {
      cancelBabysitterScheduledKinds(['macro']);
      mainTimer = cancelBabysitterManagedTimeout(mainTimer, babysitterAuxTimerIds);
      mainTimer = scheduleBabysitterManagedTimeout('macro', ms, () => {
        if (!sessionRunning || profileMode !== 'babysitter') return;
        triggerBabysitterMacro();
      });
      mainEndAt = getNextBabysitterScheduledAt('macro');
    } else if (sched === 'dependent') {
      // Queue mode: the "major" event is the full void at the end of the spasm chain.
      // Force the next queued event to be that void (remaining queued spasms are skipped).
      clearTimeout(mainTimer); clearTimeout(preChimeTimer);
      depMicroCount = Math.max(depMicroCount, depMicroTarget);
      mainEndAt = Date.now() + ms;
      mainTimer = setTimeout(() => { if (sessionRunning) triggerDependentMacro(); }, ms);
    } else if (sched === 'gauntlet') {
      clearTimeout(mainTimer); clearTimeout(preChimeTimer);
      mainEndAt = Date.now() + ms;
      if (ms > 30000) preChimeTimer = setTimeout(() => startChime(randInt(600, 900)), ms - 30000);
      mainTimer = setTimeout(() => {
        if (!sessionRunning) return;
        const diff = window.gauntletDifficulty || 'medium';
        const seq = buildRandomGauntlet(diff);
        showBanner('🎯 GAUNTLET INCOMING', 'Prepare yourself...', 'high');
        setTimeout(() => {
          acknowledgeAlarm();
          startVoidGuide(seq, `<b>GAUNTLET (${diff.toUpperCase()}):</b> ${seq.length} steps — hold everything!`, 'gauntlet');
        }, 2000);
      }, ms);
    } else {
      // Regular timed profiles: keep the pre-rolled main event and micro cycle as-is.
      clearTimeout(mainTimer); clearTimeout(preChimeTimer);
      if (!pendingMainEvent && typeof prerollEvent === 'function') pendingMainEvent = prerollEvent('full');
      mainEndAt = Date.now() + ms;
      if (runtime?.preChime !== false && ms > 15000) preChimeTimer = setTimeout(startChime, ms - 15000);
      mainTimer = setTimeout(alarmMain, ms);
    }

    if (typeof setCountdownLabel === 'function') setCountdownLabel();
    if (typeof saveState === 'function') saveState();
    if (typeof nativeNotifySync === 'function') nativeNotifySync();
    const shown = ms < 120000 ? `${Math.round(ms / 1000)}s` : `${(ms / 60000).toFixed(1)} min`;
    logToOutput(`<span style="color:#fdcb6e;">🧪 <b>Override:</b> next major event rescheduled to ~${shown} (range ${minMins}–${maxMins} min). Micro events unchanged.</span>`);
    return ms;
  };

  window.promptOverrideNextMajor = function () {
    if (silent()) { toast('Disabled in Bedwetting mode (silent).'); return; }
    if (!sessionRunning) { toast('Start a session first.'); return; }
    const iMin = document.getElementById('ovNextMin'), iMax = document.getElementById('ovNextMax');
    let r;
    if (iMin && iMax) {
      r = parseRange(`${iMin.value}-${iMax.value || iMin.value}`);
    } else {
      const txt = window.prompt('Reschedule NEXT major event (minutes range, decimals OK, e.g. 0.5-1):', localStorage.getItem('override_next_range') || '1-5');
      if (txt == null) return;
      r = parseRange(txt);
    }
    if (!r) { toast('Enter a range like 1 – 5 (minutes).'); return; }
    localStorage.setItem('override_next_range', `${r.min}-${r.max}`);
    window.overrideNextMajorEvent(r.min, r.max);
  };

  function refreshVisibility() {
    const b = document.getElementById('overrideNextRow');
    if (!b) return;
    const hide = silent() || !sessionRunning || (typeof getProfileConfig === 'function' && getProfileConfig().scheduler === 'chaos');
    b.style.opacity = hide ? '0.55' : '1';
    const h = document.getElementById('ovNextHint'); if (h) h.style.display = hide ? '' : 'none';
    b.querySelectorAll('button,input').forEach(el => { el.disabled = hide; });
  }
  window.refreshOverrideNextButton = refreshVisibility;
  setInterval(() => { try { refreshVisibility(); } catch (e) {} }, 1000);
  window.addEventListener('load', () => {
    try {
      const saved = (localStorage.getItem('override_next_range') || '').split('-');
      if (saved.length === 2) { const a = document.getElementById('ovNextMin'), c = document.getElementById('ovNextMax'); if (a) a.value = saved[0]; if (c) c.value = saved[1]; }
      refreshVisibility();
    } catch (e) {}
  });
})();
