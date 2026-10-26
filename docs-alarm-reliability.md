# Alarm reliability, grace window & natural-accident detail (v4)

## Why alarms didn't fire while the phone was asleep (root causes)
1. **The safety-net sync cancelled the alarm that was about to fire.** `native-notify.js` rebuilt the
   whole schedule whenever the list of fire times changed: `cancelAllNative()` then re-schedule.
   `collectFireTimes()` dropped anything due within 1 s, so in the last second before an alarm the
   3-second interval (or a visibility/pagehide event) saw a "changed" list and **cancelled the
   pending native alarm**. Native times were also rounded to the nearest second, often 0–500 ms
   *after* the JS timer, so when the WebView was still alive in the background the JS `mainTimer`
   ran first, the wrapped scheduler triggered a sync, and the native alarm was cancelled. The
   in-page chime/WebAudio is inaudible in a backgrounded WebView, so nothing rang.
2. **Every micro/hydration reschedule cancelled the main alarm too** (cancel-all + re-add with
   new ids 1000+idx), repeatedly re-arming it under Doze.
3. **Cold start after the process was killed** (common overnight / Samsung "sleeping apps"):
   `loadState()` only resumed a session whose `mainEndAt` was still in the future, so a missed alarm
   was silently dropped; the first sync then saw "no session" and cancelled all remaining alarms.
   Resume also never re-rolled `pendingMainEvent`, so a resumed alarm revealed a micro and the
   main-event chain stopped.
4. `setExactAndAllowWhileIdle` (local-notifications) is Doze-rate-limited and is not an
   "alarm clock"; the channel used the notification stream (silenced by DND/Bedtime) and no
   full-screen intent; nothing re-armed reliably after reboot for our own state.

## New native path — `android/app/src/main/java/dev/simpledl/bladdersim/alarm/`
- `BladderAlarmPlugin` (JS `Capacitor.Plugins.BladderAlarm`): `schedule({id, at, title, body, kind})`,
  `cancel({id})`, `cancelAll()`, `getPending()`, `checkPermissions()` → `{notifications, exactAlarm,
  batteryUnrestricted, fullScreen, alarmChannelHigh, sdk, manufacturer}`, `requestNotifications()`,
  `requestExactAlarm()`, `requestIgnoreBatteryOptimizations()`, `openFullScreenSettings()`,
  `openNotificationSettings()`, `openAlarmChannelSettings()`, `openAppSettings()`.
- `kind:"alarm"` (main events, babysitter macro, test) → `AlarmManager.setAlarmClock()` (Doze-exempt,
  alarm icon in status bar). `kind:"reminder"` (spasm/micro, hydration, babysitter minor) →
  `setExactAndAllowWhileIdle()`. Falls back to inexact while-idle only if exact alarms are revoked.
- `AlarmReceiver`: 15 s partial wake lock, posts notification. Alarm channel `bs_alarm_v2`
  (IMPORTANCE_HIGH, `USAGE_ALARM` + default alarm sound, vibration, bypass-DND flag honoured if user
  allows) with `CATEGORY_ALARM`, PRIORITY_MAX, full-screen intent opening the app (shows over lock
  screen only when opened from an alarm). Reminder channel `bs_reminder_v2` uses the default
  notification sound. Lock-screen visibility is PRIVATE (public version says only "Bladder Sim — Alarm").
  If the app is in the foreground, no notification is posted (the in-page banner/chime handles it).
- `AlarmStore` persists alarms in SharedPreferences; `AlarmBootReceiver` re-arms on BOOT_COMPLETED,
  QUICKBOOT_POWERON, MY_PACKAGE_REPLACED, TIME_SET, TIMEZONE_CHANGED and exact-alarm permission grant;
  alarms missed by ≤15 min (phone off) are posted immediately.
- JS (`native-notify.js`) now **diffs** by stable id (main 1001, micro 1002, hydration 1003,
  babysitter 1100–1899 by timer id, test 1999): only re-arms when the fire time changes, never touches
  an alarm due within ±5 s, never cancels an alarm whose time has passed, first sync waits until the
  session is restored. Plugin used for everything; local-notifications is fallback only (old LN
  alarms are cancelled once on upgrade). Bedwetting: cancel-all, nothing scheduled, test refused.

## Phone settings to check (also in Settings → Alarm reliability)
- Notifications allowed; channel "Sim alarms (main events)" with sound + pop-up on screen.
- Alarms & reminders (exact alarms) allowed (auto on Android 13+, ask on 12/12L).
- Battery: Unrestricted (button opens the system "ignore battery optimisation" dialog).
- Android 14+: "Full-screen notifications" allowed for the app.
- **Samsung**: Battery → Background usage limits → remove from Sleeping / Deep sleeping apps, add to
  Never sleeping apps. Modes & Routines → Sleep / Bedtime / DND: allow Alarms (default) or add the app
  to allowed apps. The main alarm follows the **alarm volume**.
- Pixel Bedtime mode: DND → Apps → add Bladder Sim, or keep alarms allowed.
- Xiaomi/Oppo/OnePlus/Huawei: Autostart on, battery "No restrictions".
- Never Force-stop the app (clears all alarms until reopened).

## Run-to-potty grace (`js/alarm-grace.js`)
- Starts when a main alarm fires (`alarmMain()`), not for training-choice, dependent, chaos or gauntlet
  flows, and never in bedwetting mode.
- Control = continence level (`currentContinenceLevel`): fully continent 1.0, mostly 0.75,
  somewhat 0.5, mostly incontinent 0.25, fully incontinent 0.0.
- App visible and alarm on time → foreground: lerp(30 s, 90 s, control). Page hidden or the JS timer
  ran >5 s late (asleep) or alarm found overdue on resume/cold start → background, measured from the
  scheduled fire time: lerp(10 min, 15 min, control). All four bounds editable in Settings.
- Banner gets "🏃 Run to potty" + countdown; Run / Reveal / Skip within the window = responded;
  expiry (checked every second and on return) → log "Too late" + `haveAccident()`. Pending window is
  persisted, restored after the app is killed.

## Calendar schema v3
Natural accident/leak entries: `urgencyBefore`, `urgencyAfter` (0–100, shown /10 like app urgency),
`releasedPct` (0–100, "Estimated bladder % released"). Only saved when the slider is touched.
Shown in day detail; trends: avg urgency before (→ after), avg % released. Export `version: 3`;
v1/v2 imports still accepted (fields simply absent); v4+ rejected. Storage key stays `bs_calendar_v2`.
