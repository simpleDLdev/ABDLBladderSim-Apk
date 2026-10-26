/* ===========================
   profile-logic.js -- shared profile runtime + tracking helpers
   =========================== */

let pendingGuideTrackingOutcome = null;

function isCustomTrackingSession() {
  return !!(activeCustomProfile && customProfileRuntime);
}

function isQueueProfile(mode = profileMode) {
  return mode === 'dependent';
}

function isRegularTimedProfile(mode = profileMode) {
  return mode !== 'dependent' && mode !== 'babysitter' && mode !== 'gauntlet_only' && mode !== 'chaos_manual' && mode !== 'omorashi_hold';
}

function shouldTrackSessionStats() {
  if (profileMode === 'gauntlet_only') return false;
  if (profileMode === 'omorashi_hold' && !sessionRunning) return false;
  return true;
}

function trackSessionStat(eventType, details) {
  if (!shouldTrackSessionStats()) return;
  if (typeof trackDayEvent === 'function') {
    trackDayEvent(eventType, details);
  }
}

function syncDayTrackerPanelVisibility() {
  const panel = $('dayTrackerPanel');
  if (!panel) return;
  const visible = sessionRunning && shouldTrackSessionStats();
  panel.style.display = visible ? 'block' : 'none';
  if (visible && typeof renderDayTracker === 'function') {
    renderDayTracker();
  }
}

function normalizeGuideOutcomeType(type) {
  if (type === 'full_light' || type === 'full_heavy') return 'full';
  return type;
}

// --- Log/guide-only potty prompts -------------------------------------------
// Some table events (e.g. "Permission Granted: Go use the toilet", babysitter
// "GO TO POTTY" guides, Matron "Mercy Rule") tell the user to go to the potty
// but are run as an ordinary 'full'/'micro' guide (or log text only). Nothing
// set isRestroomTrip / a tracking outcome for them, so completing them used to
// be counted as an ACCIDENT (full) or partial accident (micro) and the
// "Potty Successes" stat never moved. We now detect these prompts and ask.
const POTTY_STEP_RE = /\b(POTTY|TOILET|RESTROOM|BATHROOM|LOO)\b/i;
const POTTY_FLOW_RE = /\b(go|head|hurry|run|use|empty|pee|void|try|permission|authori[sz]ed|allowed|granted)\b[^.<]{0,60}\b(potty|toilet|restroom|bathroom|loo)\b/i;

function isPottyPromptEvent(evt, seq) {
  const steps = Array.isArray(seq) ? seq : (evt && Array.isArray(evt.guide) ? evt.guide : []);
  const stepText = steps.map(st => st && st.text ? st.text : '').join(' | ');
  if (/ACCIDENT|LEAK|FLOOD|WET\b/i.test(stepText)) return false;
  if (POTTY_STEP_RE.test(stepText)) return true;
  const flow = evt ? [evt.flow, evt.desc, evt.label].filter(Boolean).join(' ') : '';
  if (!flow) return false;
  if (POTTY_FLOW_RE.test(flow) && !/\b(accident|before you make it)\b/i.test(flow)) return true;
  return false;
}

let _pottyAskOpen = false;
function askPottyOutcome(onDone) {
  if (_pottyAskOpen) return;
  _pottyAskOpen = true;
  const wrap = document.createElement('div');
  wrap.id = 'pottyAskModal';
  wrap.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:21000; backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center;';
  wrap.innerHTML = `<div style="width:min(320px,92vw); background:#151923; padding:20px; border:2px solid #55efc4; border-radius:15px; text-align:center;">
      <div style="font-size:1.6em;">🚽</div>
      <div style="color:#55efc4; font-weight:bold; margin:6px 0 4px;">Did you make it to the potty?</div>
      <div style="color:#8ea0b6; font-size:0.85em; margin-bottom:14px;">This counts toward your potty stats.</div>
      <div style="display:flex; gap:8px;">
        <button data-r="yes" class="pill" style="flex:1; margin:0; border-color:#55efc4; color:#55efc4;">✅ Made it</button>
        <button data-r="no" class="pill" style="flex:1; margin:0; border-color:#ff7675; color:#ff7675;">💦 Didn't</button>
      </div>
      <button data-r="skip" class="muted" style="margin-top:10px; width:100%; font-size:0.8em; padding:6px;">Skip (don't count)</button>
    </div>`;
  wrap.addEventListener('click', (e) => {
    const r = e.target && e.target.getAttribute && e.target.getAttribute('data-r');
    if (!r) return;
    wrap.remove();
    _pottyAskOpen = false;
    try { onDone(r); } catch (err) { console.warn(err); }
  });
  document.body.appendChild(wrap);
}

function resolvePottyPrompt(evt) {
  askPottyOutcome((r) => {
    if (r === 'yes') {
      trackSessionStat('potty_success', { source: 'prompt', label: evt && evt.label });
      logToOutput(`<span style="color:#55efc4;">🚽 <b>Potty success logged.</b></span>`);
    } else if (r === 'no') {
      trackSessionStat('accident', { source: 'prompt', label: evt && evt.label });
      logToOutput(`<span style="color:#ff7675;">💦 Didn't make it — accident logged.</span>`);
    }
  });
}

function trackGuideCompletionOutcome(currentType, restroomTrip) {
  if (profileMode === 'babysitter') return;

  if (pendingGuideTrackingOutcome) {
    trackSessionStat(pendingGuideTrackingOutcome);
    return;
  }

  if (restroomTrip) {
    trackSessionStat('potty_success');
    return;
  }

  // Log/guide potty prompt without a formal restroom event → ask the user.
  const lastEvt = window._lastRevealedEvent || null;
  if (isPottyPromptEvent(lastEvt && lastEvt.guide === currentGuideSeq ? lastEvt : null, currentGuideSeq)) {
    resolvePottyPrompt(lastEvt);
    return;
  }

  const outcomeType = normalizeGuideOutcomeType(currentType);
  if (outcomeType === 'micro') {
    trackSessionStat('partial_accident');
  } else if (outcomeType === 'full') {
    trackSessionStat('accident');
  }
}

function initializeQueueProfileSession() {
  clearTimeout(microTimer);
  pendingAmbientEvent = null;

  const setupStr = localStorage.getItem('dependent_setup');
  if (setupStr) {
    const setup = JSON.parse(setupStr);
    depQueueMin = setup.queueMin || 1;
    depQueueMax = setup.queueMax || 6;
    depSpasmMin = setup.spasmsMin || 8;
    depSpasmMax = setup.spasmsMax || 15;
    depSipMin = setup.sipMin || 2;
    depSipMax = setup.sipMax || 5;
    depUseDiuretics = setup.useDiuretics !== false;

    depMicroCount = 0;
    depMicroTarget = randInt(depQueueMin, depQueueMax);
    logToOutput(`<span style="color:#fab1a0"><b>👶 Dependent Mode Started</b><br>Queue target: <b>${depMicroTarget}</b> spasms before void<br>Spasm interval: ${depSpasmMin}-${depSpasmMax} mins</span>`);
  } else {
    depMicroCount = 0;
    depMicroTarget = randInt(depQueueMin, depQueueMax);
  }

  scheduleDependentEvent();
  scheduleNextHydration();
}

function initializeRegularTimedProfileSession() {
  if (profileMode === 'train_rookie') {
    const setupStr = localStorage.getItem('train_rookie_setup');
    if (setupStr) {
      const setup = JSON.parse(setupStr);
      rookieVoidMin = setup.voidMin || 25;
      rookieVoidMax = setup.voidMax || 50;
      rookieSuccessRate = setup.successRate || 60;
      rookieMercy = setup.mercy !== false;
      logToOutput(`<span style="color:#74b9ff"><b>💪 Rookie Mode Started</b><br>Void window: ${rookieVoidMin}-${rookieVoidMax} mins<br>Success rate: ${rookieSuccessRate}%</span>`);
    } else {
      rookieVoidMin = 25;
      rookieVoidMax = 50;
      rookieSuccessRate = 60;
      rookieMercy = true;
    }

    let firstMin = 15;
    let firstMax = 30;
    if (manualPressure > 70) {
      firstMin = 5;
      firstMax = 15;
    }
    scheduleMainEvent({ min: firstMin, max: firstMax });
    schedulePreSoak();
    scheduleNextHydration();
    return;
  }

  if (profileMode === 'train_pro') {
    const setupStr = localStorage.getItem('train_pro_setup');
    if (setupStr) {
      const setup = JSON.parse(setupStr);
      proVoidMin = setup.voidMin || 50;
      proVoidMax = setup.voidMax || 90;
      proSuccessRate = setup.successRate || 35;
      proMercy = setup.mercy !== false;
      logToOutput(`<span style="color:#ffeaa7"><b>💪 Pro Mode Started</b><br>Void window: ${proVoidMin}-${proVoidMax} mins<br>Success rate: ${proSuccessRate}%</span>`);
    } else {
      proVoidMin = 50;
      proVoidMax = 90;
      proSuccessRate = 35;
      proMercy = true;
    }

    let firstMin = 30;
    let firstMax = 50;
    if (manualPressure > 70) {
      firstMin = 15;
      firstMax = 30;
    }
    scheduleMainEvent({ min: firstMin, max: firstMax });
    schedulePreSoak();
    scheduleNextHydration();
    return;
  }

  if (profileMode === 'npt') {
    const isCustomNpt = !!(customProfileRuntime && customProfileRuntime.baseProfile === 'npt');
    const setupStr = localStorage.getItem('npt_setup');
    const setup = setupStr ? JSON.parse(setupStr) : null;

    nptVoidMin = isCustomNpt
      ? (customProfileRuntime.mainMin || 45)
      : (setup?.voidMin || 45);
    nptVoidMax = isCustomNpt
      ? (customProfileRuntime.mainMax || nptVoidMin)
      : (setup?.voidMax || 90);
    nptSatThreshold = setup?.satThreshold || 85;

    if (isCustomNpt) {
      if (customProfileRuntime.mercyMode === 'disabled') nptMercy = false;
      else if (customProfileRuntime.mercyMode === 'forced') nptMercy = true;
      else nptMercy = setup ? setup.mercy !== false : true;
    } else {
      nptMercy = setup ? setup.mercy !== false : true;
    }

    nptSipMin = isCustomNpt
      ? (customProfileRuntime.sipMin || 2)
      : (setup?.sipMin || 2);
    nptSipMax = isCustomNpt
      ? (customProfileRuntime.sipMax || nptSipMin)
      : (setup?.sipMax || 5);

    nptVoidMin = Math.max(1, nptVoidMin);
    nptVoidMax = Math.max(nptVoidMin, nptVoidMax);
    nptSipMin = Math.max(1, nptSipMin);
    nptSipMax = Math.max(nptSipMin, nptSipMax);

    const modeLabel = isCustomNpt
      ? `🧪 ${activeCustomProfile?.name || 'Custom Profile'} Started`
      : '🌙 Not Potty Trained Mode Started';
    logToOutput(`<span style="color:#a29bfe"><b>${modeLabel}</b><br>Void window: ${nptVoidMin}-${nptVoidMax} mins<br>Saturation threshold: ${nptSatThreshold}%</span>`);

    let firstMin = 15;
    let firstMax = 40;
    if (manualPressure > 70) {
      firstMin = 5;
      firstMax = 15;
    }
    scheduleMainEvent({ min: firstMin, max: firstMax });
    scheduleNextHydration();
    return;
  }

  let firstMin = 15;
  let firstMax = 40;
  if (manualPressure > 70) {
    firstMin = 5;
    firstMax = 15;
  } else if (manualPressure > 40) {
    firstMin = 10;
    firstMax = 25;
  }

  scheduleMainEvent({ min: firstMin, max: firstMax });
  if (profileMode.startsWith('train_')) schedulePreSoak();
  scheduleNextHydration();
}

Object.assign(window, {
  isCustomTrackingSession,
  isQueueProfile,
  isRegularTimedProfile,
  shouldTrackSessionStats,
  trackSessionStat,
  syncDayTrackerPanelVisibility,
  normalizeGuideOutcomeType,
  trackGuideCompletionOutcome,
  isPottyPromptEvent,
  askPottyOutcome,
  resolvePottyPrompt,
  initializeQueueProfileSession,
  initializeRegularTimedProfileSession
});
