/* ===========================
   native-notify.js — native alarm bridge (Android app only; no-op in a browser).
   Mirrors the in-page JS timers (mainEndAt, microEndAt, hydrationEndAt,
   babysitter scheduled events) as native alarms so prompts arrive while the
   phone is asleep / the app is backgrounded or killed.

   Primary path: our own Capacitor plugin "BladderAlarm" (android/.../alarm/):
     • main events      → AlarmManager.setAlarmClock()  (Doze-exempt, alarm icon,
                           CATEGORY_ALARM, USAGE_ALARM sound, full-screen intent)
     • minor/reminders  → setExactAndAllowWhileIdle() on a normal high-priority channel
   Alarms are persisted natively and re-armed after reboot / time change.
   Fallback (plugin missing): @capacitor/local-notifications, same diffing rules.

   Scheduling is a DIFF, keyed by stable ids per timer kind: an alarm is only
   cancelled/re-armed when its fire time actually changed or the JS timer is gone,
   and never in the last few seconds before / after it is due (old code cancelled
   everything whenever the list changed — including the alarm about to fire).

   Bedwetting mode is fully silent: nothing is ever scheduled and everything
   pending is cancelled.
   =========================== */
(function () {
  const LN_CHANNEL_ID = 'bladder-alarms';
  const ID = { simpleUrge: 1950, dryclipMorning: 1960, main: 1001, micro: 1002, hydration: 1003, babysitterBase: 1100, test: 1999 }; // babysitter: 1100-1899
  const NEAR_MS = 5000;        // never touch an alarm due within ±5 s
  let scheduled = new Map();   // id -> { at, kind, title, body }
  let seeded = false, syncing = false, again = false, permsRequested = false, ready = false;

  function isNative() {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  }
  function P() { return isNative() && window.Capacitor.Plugins ? window.Capacitor.Plugins : {}; }
  function BA() { return P().BladderAlarm || null; }
  function LN() { return P().LocalNotifications || null; }

  // Global silence check used by audio/vibration/notification code paths.
  window.isBedwettingSilent = function () {
    try {
      if (window.BSNight && window.BSNight.active()) return true;   // v7 Natural Night: totally silent
      return typeof profileMode !== 'undefined' && profileMode === 'bedwetting';
    }
    catch (e) { return false; }
  };

  // ---------- backend abstraction ----------
  const backend = {
    async pending() {
      if (BA()) { const r = await BA().getPending(); return (r && r.alarms || []).map(a => ({ id: a.id, at: a.at, kind: a.kind })); }
      if (LN()) { const r = await LN().getPending(); return (r && r.notifications || []).map(n => ({ id: n.id, at: n.schedule && n.schedule.at ? new Date(n.schedule.at).getTime() : 0 })); }
      return [];
    },
    async schedule(id, it) {
      if (BA()) return BA().schedule({ id: Math.floor(id), at: Math.floor(it.at), title: it.title, body: it.body, kind: it.kind, channel: it.channel || '' });
      if (LN()) {
        await LN().cancel({ notifications: [{ id }] }).catch(() => {});
        return LN().schedule({ notifications: [{ id, title: it.title, body: it.body, channelId: LN_CHANNEL_ID,
          schedule: { at: new Date(it.at), allowWhileIdle: true }, extra: { kind: it.kind } }] });
      }
    },
    async cancel(id) {
      if (BA()) return BA().cancel({ id });
      if (LN()) return LN().cancel({ notifications: [{ id }] });
    },
    async cancelAll() {
      if (BA()) { await BA().cancelAll(); }
      if (LN()) {
        const p = await LN().getPending().catch(() => null);
        if (p && p.notifications && p.notifications.length) await LN().cancel({ notifications: p.notifications.map(n => ({ id: n.id })) });
      }
    }
  };

  async function ensurePermissions() {
    if (permsRequested) return; permsRequested = true;
    try {
      if (BA()) {
        const s = await BA().checkPermissions();
        if (s.notifications !== 'granted') await BA().requestNotifications();
        // exact alarms: USE_EXACT_ALARM is auto-granted on Android 13+; on 12/12L ask once.
        if (s.exactAlarm !== 'granted' && !localStorage.getItem('bs_exact_asked')) { localStorage.setItem('bs_exact_asked', '1'); await BA().requestExactAlarm(); }
        return;
      }
      const ln = LN(); if (!ln) return;
      const p = await ln.checkPermissions();
      if (p.display !== 'granted') await ln.requestPermissions();
    } catch (e) { console.warn('notification permission request failed', e); }
  }

  function graceText() {
    try {
      if (window.BSGrace && window.BSGrace.settings().enabled) {
        const m = Math.round(window.BSGrace.graceMs(false) / 60000);
        return ` Open the app within ~${m} min to run to the potty, or it counts as an accident.`;
      }
    } catch (e) {}
    return ' Open the app to see your next event.';
  }

  /** Desired native alarms from current JS state. Map id -> item. */
  function collectDesired() {
    const out = new Map();
    const chan = window.BSPrompt ? window.BSPrompt.channel() : null;
    // v20 DryClip morning check-in — always schedule (even in bedwetting silence; no alert at wet time, only at wake)
    try { const dc = window.BSDryClip && window.BSDryClip.pendingAlarm(); if (dc) out.set(dc.id, { at: dc.at, kind: dc.kind || 'reminder', title: dc.title, body: dc.body, channel: chan }); } catch (e) {}
    // v9 Simple Urge: ONE reminder at the end of a wait (independent of a running session).
    try { const su = window.BSSimpleUrge && window.BSSimpleUrge.pendingAlarm(); if (su && !window.isBedwettingSilent()) out.set(su.id, { at: su.at, kind: su.kind, title: su.title, body: su.body, channel: chan }); } catch (e) {}
    try { const mt = window.BSMessyTimer && window.BSMessyTimer.pendingAlarm(); if (mt && !window.isBedwettingSilent()) out.set(mt.id, { at: Math.floor(mt.at), kind: mt.kind, title: mt.title, body: mt.body, channel: chan }); } catch (e) {}
    try { const me = window.BSMessyTimer && window.BSMessyTimer.pendingEarly && window.BSMessyTimer.pendingEarly(); if (me && !window.isBedwettingSilent()) out.set(me.id, { at: Math.floor(me.at), kind: me.kind, title: me.title, body: me.body, channel: chan }); } catch (e) {}
    try {
      if (!sessionRunning || window.isBedwettingSilent()) return out;
      const now = Date.now();
      // While "Pause Alarm (30m)" is active, suppress anything that would fire during the pause.
      const pauseUntil = (meetingActive && window._meetingPauseUntil) ? window._meetingPauseUntil : 0;
      const add = (id, at, kind, body) => {
        if (!at || at <= now - 60000) return;   // long past: nothing to schedule (recent past kept so we don't cancel it)
        if (meetingActive && (!pauseUntil || at < pauseUntil)) return;
        const n = window.BSOffice ? window.BSOffice.notif('Bladder Sim', body) : { title: 'Bladder Sim', body };
        out.set(id, { at: Math.floor(at), kind, title: n.title, body: n.body, channel: chan });
      };
      const cfg = typeof getProfileConfig === 'function' ? getProfileConfig() : {};
      const chaos = cfg && cfg.scheduler === 'chaos';
      if (!chaos) add(ID.main, mainEndAt, 'alarm', 'Alarm! Main event.' + graceText());
      add(ID.micro, microEndAt, 'reminder', 'Bladder spasm — open the app.');
      if (window.hydrationEnabled !== false) add(ID.hydration, hydrationEndAt, 'reminder', 'Hydration reminder — time to drink.');
      if (typeof babysitterScheduledEvents !== 'undefined' && Array.isArray(babysitterScheduledEvents)) {
        // stable id per babysitter event (its timer id), so one firing doesn't shift/re-arm the others
        babysitterScheduledEvents.slice().sort((a, b) => a.runAt - b.runAt).slice(0, 20).forEach((e, i) =>
          add(ID.babysitterBase + ((+e.id || i) % 800), e.runAt, e.kind === 'macro' ? 'alarm' : 'reminder', 'Your babysitter needs your attention.'));
      }
    } catch (e) { /* state not ready */ }
    return out;
  }

  /** Pure diff (exported for tests): what to (re)arm and what to cancel. */
  function diff(prev, desired, now) {
    const toSchedule = [], toCancel = [];
    desired.forEach((it, id) => {
      const p = prev.get(id);
      if (p && Math.abs(p.at - it.at) < 1000) return;                 // unchanged → leave the armed alarm alone
      if (p && Math.abs(p.at - now) <= NEAR_MS) return;                // old one is firing right now → re-arm on a later pass
      if (it.at <= now + 1000) return;                                  // due now/past: whatever is armed fires; don't re-arm in the past
      toSchedule.push([id, it]);
    });
    prev.forEach((p, id) => {
      if (desired.has(id) || id === ID.test) return;
      if (Math.abs(p.at - now) <= NEAR_MS || p.at < now) return;        // about to fire / fired: let it (JS just consumed the same event)
      toCancel.push(id);
    });
    return { toSchedule, toCancel };
  }

  async function seed() {
    if (seeded) return; seeded = true;
    try { (await backend.pending()).forEach(a => scheduled.set(a.id, { at: a.at, kind: a.kind })); } catch (e) {}
  }

  async function syncNativeNotifications() {
    if (!isNative() || !ready || (!BA() && !LN())) return;
    if (syncing) { again = true; return; }
    syncing = true;
    try {
      await seed();
      if (window.isBedwettingSilent()) {
        // Cancel urge/session alarms but keep DryClip morning check-in
        const now = Date.now();
        const desired = new Map();
        try { const dc = window.BSDryClip && window.BSDryClip.pendingAlarm(); if (dc) desired.set(dc.id, { at: dc.at, kind: dc.kind || 'reminder', title: dc.title, body: dc.body }); } catch (e) {}
        const { toSchedule, toCancel } = diff(scheduled, desired, now);
        for (const id of toCancel) { try { await backend.cancel(id); } catch (e) {} scheduled.delete(id); }
        if (toSchedule.length) await ensurePermissions();
        for (const [id, it] of toSchedule) {
          try { await backend.schedule(id, it); scheduled.set(id, it); } catch (e) { console.warn('native schedule failed', id, e); }
        }
        scheduled.forEach((p, id) => { if (p.at < now - 60000) scheduled.delete(id); });
        return;
      }
      const now = Date.now();
      const desired = collectDesired();
      const { toSchedule, toCancel } = diff(scheduled, desired, now);
      if (toSchedule.length) await ensurePermissions();
      for (const id of toCancel) { try { await backend.cancel(id); } catch (e) {} scheduled.delete(id); }
      for (const [id, it] of toSchedule) {
        try { await backend.schedule(id, it); scheduled.set(id, it); }
        catch (e) { console.warn('native schedule failed', id, e); }
      }
      // forget entries that have fired
      scheduled.forEach((p, id) => { if (p.at < now - 60000) scheduled.delete(id); });
    } finally {
      syncing = false;
      if (again) { again = false; setTimeout(syncNativeNotifications, 0); }
    }
  }

  window.nativeNotifySync = function () { syncNativeNotifications(); };
  window.nativeNotifyCancelAll = async function () { try { await backend.cancelAll(); } catch (e) {} scheduled.clear(); setTimeout(syncNativeNotifications, 0); }; // v13b: re-arm independent timers (Simple Urge, #2 timer) right after a session stop
  window.BSNativeAlarm = { diff, collectDesired, ID, scheduled: () => scheduled, isNative, hasPlugin: () => !!BA() };

  // ---------- Settings → Alarm reliability ----------
  async function status() {
    if (!isNative()) return { native: false };
    if (!BA()) return { native: true, plugin: false };
    try { return Object.assign({ native: true, plugin: true }, await BA().checkPermissions()); } catch (e) { return { native: true, plugin: false, error: String(e) }; }
  }
  async function renderAlarmReliability() {
    const m = document.getElementById('alarmReliabilityMount'); if (!m) return;
    const s = await status();
    const row = (ok, label, btn, act) => `<div class="toggle-row" style="gap:8px;"><span>${ok ? '✅' : '⚠️'} ${label}</span>${ok ? '<span style="color:#55efc4;">OK</span>' : `<button type="button" data-ar="${act}">${btn}</button>`}</div>`;
    let body;
    if (!s.native) body = '<p class="section-desc">Native alarms are only available in the Android app. In a browser, keep this tab open and the screen on.</p>';
    else if (!s.plugin) body = `<p class="section-desc">⚠️ Native alarm plugin not available${s.error ? ' (' + s.error + ')' : ''} — falling back to basic notifications.</p>`;
    else body = row(s.notifications === 'granted', 'Notifications allowed', 'Allow', 'notif') +
      row(s.alarmChannelHigh !== false, 'Alarm channel set to sound/pop up', 'Channel settings', 'channel') +
      row(s.exactAlarm === 'granted', 'Exact alarms (Alarms &amp; reminders)', 'Allow', 'exact') +
      row(!!s.batteryUnrestricted, 'Battery: unrestricted', 'Unrestrict', 'battery') +
      row(!!s.fullScreen, 'Full-screen alarm over lock screen', 'Allow', 'fullscreen') +
      `<div class="cal-row" style="margin-top:6px;"><button type="button" data-ar="test">⏰ Test alarm in 1 min</button><button type="button" data-ar="refresh">↻ Re-check</button></div>
      <div class="cal-legend" id="arMsg">Lock the phone after tapping Test — it should ring within a minute.${window.isBedwettingSilent() ? ' <b>Bedwetting mode is silent: no alarms are scheduled.</b>' : ''}</div>
      <details style="margin-top:6px;"><summary>Phone settings that can still block alarms</summary><div class="section-desc" style="font-size:12px;">
        • <b>Samsung</b>: Settings → Battery → Background usage limits → remove Bladder Sim from "Sleeping"/"Deep sleeping apps" and add it to "Never sleeping apps". Also App info → Battery → <i>Unrestricted</i>.<br>
        • <b>Samsung Modes &amp; Routines → Sleep</b> / <b>Bedtime mode</b> / <b>Do Not Disturb</b>: make sure <i>Alarms</i> are allowed (they are by default), or add Bladder Sim under "Apps that can notify". The main alarm uses the ALARM sound stream, so it follows your <i>alarm volume</i>.<br>
        • <b>Pixel / Digital Wellbeing Bedtime mode</b>: Settings → Digital Wellbeing → Bedtime mode → Do Not Disturb → Apps → add Bladder Sim (or allow alarms).<br>
        • <b>Xiaomi / Oppo / OnePlus / Huawei</b>: enable Autostart and set battery saver to "No restrictions".<br>
        • Don't swipe-"Force stop" the app; that clears all alarms until it is opened again.<br>
        • Notification channel "Sim alarms": keep sound on and "Pop on screen" enabled; optionally "Override Do Not Disturb".</div></details>`;
    m.innerHTML = `<h2 style="margin:0 0 6px;">⏰ Alarm reliability</h2>${body}`;
    const act = {
      notif: () => BA().requestNotifications(), channel: () => BA().openAlarmChannelSettings(), exact: () => BA().requestExactAlarm(),
      battery: () => BA().requestIgnoreBatteryOptimizations(), fullscreen: () => BA().openFullScreenSettings(),
      refresh: () => null,
      test: async () => {
        if (window.isBedwettingSilent()) { const el = m.querySelector('#arMsg'); if (el) el.textContent = 'Bedwetting mode is silent — test alarm not scheduled.'; return; }
        await ensurePermissions();
        const at = Date.now() + 60000;
        await BA().schedule({ id: ID.test, at, title: 'Bladder Sim', body: 'Test alarm — alarms are working.', kind: 'alarm' });
        const el = m.querySelector('#arMsg'); if (el) el.textContent = `Test alarm set for ${new Date(at).toLocaleTimeString()}. Lock the phone now.`;
        return 'keep';
      }
    };
    m.querySelectorAll('[data-ar]').forEach(b => b.onclick = async () => {
      try { const r = await act[b.getAttribute('data-ar')](); if (r !== 'keep') setTimeout(renderAlarmReliability, 600); } catch (e) { console.warn(e); }
    });
  }
  window.renderAlarmReliability = renderAlarmReliability;

  if (!isNative()) return;

  (async function init() {
    if (!BA() && LN()) {
      try { await LN().createChannel({ id: LN_CHANNEL_ID, name: 'Alarms & reminders', description: 'Sim alarms and hydration reminders', importance: 5, visibility: 1, vibration: true }); } catch (e) {}
    }
    // One-time migration: drop alarms the old local-notifications path left behind (ids 1000-1019).
    if (BA() && LN() && !localStorage.getItem('bs_ln_migrated')) {
      try {
        const p = await LN().getPending();
        if (p && p.notifications && p.notifications.length) await LN().cancel({ notifications: p.notifications.map(n => ({ id: n.id })) });
        localStorage.setItem('bs_ln_migrated', '1');
      } catch (e) {}
    }
    try {
      if (LN()) LN().addListener('localNotificationActionPerformed', (ev) => {
        try { if (window.BSDryClip && window.BSDryClip.maybeMorning) setTimeout(() => window.BSDryClip.maybeMorning(), 200); } catch (e) {}
        if (typeof runMobileRecoveryChecks === 'function') setTimeout(() => runMobileRecoveryChecks('notification'), 300);
      });
      const App = P().App;
      if (App && App.addListener) App.addListener('resume', () => { if (typeof runMobileRecoveryChecks === 'function') setTimeout(() => runMobileRecoveryChecks('resume'), 300); });
    } catch (e) {}
  })();

  // Schedule up front: right after any JS scheduler/clearer runs, mirror it natively.
  window.addEventListener('load', () => {
    ['scheduleMainEvent', 'scheduleNextMicro', 'scheduleNextHydration', 'scheduleBabysitterManagedTimeout',
     'scheduleDependentEvent', 'startSession', 'stopAll', 'haveAccident', 'acknowledgeAlarm', 'toggleMeetingMode', 'setProfile']
      .forEach(name => {
        const fn = window[name];
        if (typeof fn !== 'function' || fn._nativeWrapped) return;
        const w = function () { const r = fn.apply(this, arguments); setTimeout(syncNativeNotifications, 0); return r; };
        w._nativeWrapped = true;
        window[name] = w;
      });
    // First sync only after the session has been restored (otherwise a cold start would cancel valid alarms).
    setTimeout(() => { ready = true; syncNativeNotifications(); }, 2000);
  });

  // Safety net: keep native schedule mirrored with JS timers (diff → no-op when nothing changed).
  setInterval(syncNativeNotifications, 3000);
  document.addEventListener('visibilitychange', syncNativeNotifications);
})();
