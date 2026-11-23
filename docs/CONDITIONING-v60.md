# Conditioning v60 — night conditioning runs like a Natural Night

v59 started night conditioning with the bedtime routine but kept the full-session event timer running underneath. v60 removes it. After the routine, night conditioning *is* a Natural Night (the same silent screen, wake flow, morning check-in, and DryClip morning check-in) with a conditioning layer on top.

## What happens overnight

There is no event timer, no countdown, no "next event in", no prerolled or timed events, no sip prompts, no scheduled alarms, and no tank ETA. The session-screen countdown reads **🌙 Night conditioning — no event timer**.

Something happens only when you ask for it:

- **I woke up** asks what woke you: *I have an urge*, *Already wet*, or *Dry*. Each one draws a night-deck event (less control: let-go / stay in bed / dry wake; more control: get up). The guide opens through the v54 one-at-a-time queue, and the event is logged on the night.
- **I need to pee** (on the night screen, or the session-screen button while the night is quiet) gives a potty pass or a night-deck event. It never draws from the day deck.
- **DryClip sleep mode** is opt-in and is the only thing that reacts on its own. *Quiet* logs the wet time with no alert. *Gentle* shows a soft guide (stay asleep for less control, get up for more control). *Alarm* vibrates and shows the full wake guide.

Natural Night's own *Log check*, *Log a drink*, *Back to sleep* and *Getting up for the day* buttons are still there.

## Bedtime routine

The v59 steps are unchanged (drinks, last potty or a deliberate skip, what to wear and why, gear check-in, wind-down, affirmation, wake time, DryClip opt-in). On *Done* for the last step:

- The drink (if not skipped), last potty (if not skipped), and gear go into the Natural Night log.
- Any running day session is stopped and every day timer is cleared.
- DryClip is armed for the night only if you opted in and a clip has been paired.
- The silent night screen opens.

At the **Wake time** step the app checks notification permission, and exact-alarm permission on Android 12 and up. If either is missing it asks for it. If it is still denied, a red warning on the routine says the morning check-in can't ring while the app is closed.

## Notifications

A quiet night schedules exactly one thing: the **morning check-in** at the routine's wake time. If you opted into DryClip and it is armed, DryClip's own morning check-in takes that job instead, so you never get two.

- It goes through the native BladderAlarm plugin as an exact, allow-while-idle alarm (`setExactAndAllowWhileIdle`), so it fires with the app closed or killed and the phone in Doze.
- It posts on a new high-importance channel, **Morning check-in** (`bs_morning_v1`).
- The quiet-night sync keeps it and cancels everything else.
- The existing boot receiver re-arms it after a reboot, app update, or clock change.
- Tapping it opens the app. Once the wake time has passed, the night screen opens straight to the morning check-in.

Natural Night has the same reminder now: an optional **Morning check-in reminder** time on the bedtime screen (default 07:00). The DryClip morning check-in uses the same channel.

## Night quiet only lasts for the night

In v59 the night's mute could outlive the night. If the morning check-in was never saved, the quiet flag and the night track stayed on, so a day session started at noon had no native notifications until the app was opened. In v60 the quiet is worked out from the saved night every time it is checked. Nothing is kept as a loose flag. The quiet ends:

- **at the wake time**, by itself
- **when any day session starts** (Full Session, day conditioning, or Quick). The quiet ends first, the session's alarms are armed right away, and the night stays in Nights for its check-in.
- when the morning check-in is saved, or the night is discarded

On app start the app also heals any leftovers:

- It drops v59's leftover "quiet" routine state.
- It drops a routine left open for more than 12 hours.
- It closes a night whose wake time passed more than 3 hours ago. That night is saved to the calendar with a "Closed automatically" memo, so nothing is lost.

Resuming the app *during* a real quiet night still never brings the day timer back.

## Morning check-in

This is Natural Night's check-in, plus:

- **Wets tonight** and **How do you feel?**
- a summary of the night events
- the DryClip mode and its wet times
- the gear you wore

It saves one calendar night entry tagged `night-conditioning`, titled **🌙 Night conditioning**, with the event list, clip wet times, wets, and feeling. The night timeline shows night events and clip wets.

## About text

The night section of a conditioning profile's About text now says the night runs like a Natural Night: no event timer, countdown, sips, or alarms. Events only come from *I woke up* or *I need to pee*, and the only reminder is the morning check-in at your wake time.

## Day conditioning

This is unchanged: same timer, same day deck, same sips.

## Tests

- `tests/v60-night-natural.test.js`
  - no timer, pending event, sips, or notifications during the routine or the night
  - wake and pee events come from the night deck
  - DryClip quiet, gentle, and alarm modes, and opt-out
  - resume keeps the night quiet
  - the morning save
  - the day timer is unchanged before and after the night
- `tests/v60-day-after-night.test.js` runs the real native sync against a fake BladderAlarm plugin:
  - the morning alarm is armed at routine end with allow-while-idle on the morning channel
  - a day session after the night arms its main and sip alarms right away
  - quiet ends at the wake time
  - stale v59 and old-night state is healed on load
  - the Natural Night reminder is armed
  - the Android channel, manifest, and boot-receiver support are in place

## Needs a real phone

These can only be checked on a device:

- that the alarm actually fires with the app killed and the phone in Doze
- OEM battery killers (Samsung "sleeping apps", Xiaomi autostart)
- that the permission prompts appear on Android 13 and up
