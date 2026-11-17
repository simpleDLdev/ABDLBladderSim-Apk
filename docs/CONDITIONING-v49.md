# Conditioning, as it actually works (v49)

This note matches the code in v49. It is a map of the feature, not a promise of later roadmap items.

## End to end

1. **Quiz.** Settings, the Profiles tab, or the picker at the top of Full Session and Natural Urge can start the intake. `BSQuiz.runFlow` shows one question at a time (the same screen as Quiz A / Quiz B). The questions live in `js/intake.js`. There are 56 of them. Two are optional pictures. The rest each ask a different thing.

2. **Stored now and want.** `BSIntake.scoreIntake` turns answers into `profile.dimensions`. Every scored dimension has a now value, a want value, and the words you picked (`nowText`, `wantText`). "Keep this as it is" copies now into want. The same pass also stores a ladder level per track (`levelKey`, `targetKey`), direction A / B / off, goals, methods, pacing, urgency style, and sleep choices. Numbers stay behind the words. The ladder names come from `js/control.js`.

3. **Profiles.** `js/cond-profiles.js` keeps several of those profiles in `bs_conditioning_v1.profiles`. One is active. The active one is copied onto `.profile` so older code still reads a single profile. A save from v44–v48 with one profile and no `profiles` array becomes slot 1, named "My Conditioning". Each slot has its own habits (streak and practice log), check-in list, and event log. Switching profiles swaps the check-in list in `bs_checkins_v1`.

4. **Pacing.** `BSIntake.mix` moves a value from now toward want. Check-in count is the only gate. Days passing do nothing by themselves.
   - **Instant** — the sim uses the want value immediately. Real results are still only recorded.
   - **Gradual** — six agreeing check-ins cover the whole gap.
   - **Slow burn** — sixteen agreeing check-ins.
   - **Hybrid** — the sim uses want now. The real-habit layer stays on the gradual curve.
   An agreeing check-in is one whose estimate moved toward that track's target (`BSCondProfiles` does not invent this; `BSIntake.agreeingCount` reads `bs_checkins_v1`).

5. **Effective values.** `BSIntake.urgeModel(track)` is what play uses. It returns a 0–100 control number, a ladder key, a hold window in minutes, a warning estimate, a suddenness amount, a "didn't notice" amount, and multipliers for go / wait / hard / dribble / gear / partial. Natural Urge (`js/simple-urge.js`) uses that hold and those multipliers when the selected urge profile is `conditioning`. The level on the roll is the effective level, not the raw starting level.

6. **Full session.** If the session profile is `conditioning`, `BSOnboard.sessionPlan` sets sip timing and prompt text from the urgency style and the sleep answers. Sips still go through `BSSafety.capDrink` (at most 250 ml a prompt, 1 L a day, 2 hours apart). The plan also pulls one conditioning event when consent is on.

7. **Check-ins and promotion.** A check-in is `BSCheckins.record`. It moves a track estimate by at most 10 points. The displayed ladder step for the older "two check-ins agree" rule still lives in `BSOnboard.considerPromotion`. Pacing uses the agreeing count above, which is separate from that one-step promotion.

8. **Body check-in.** `js/symptoms-check.js` is a button, in Calibration and under Safety. It does not open on its own. Reminders default to gentle, which does not block a session. "Required before sessions" blocks `startSession` until a check is saved today. Red-flag answers can still pause conditioning. A real need is never a pass and is never charged.

Consent is the last step of the quiz (`BSConsent.accept`). Until that is on, conditioning events do not fire.

## What each quiz section changes

| Section | Questions | What the answers change |
| --- | --- | --- |
| Current control · Day | 12 | Day now: hold, warning, suddenness, trips, void amount (or the calibration estimate), leaks, dribbles, cough/laugh leaks, fullness, noticing wetness, putting off, thick-gear difference. These set the day starting level. |
| Current control · Night | 10 | Night now: wet nights, getting up, waking when wet, when a wet happens, sleep depth, how hard you are to wake. Sleep length, evening drinks, bedtime pee, and night gear are stored and shown, and they do not move the night score. |
| Desired control · Day | 8 | Day want for warning, hold, making it vs not quite, suddenness, void amount, dribbles, noticing, and the lightest day gear you want. "Keep this as it is" leaves that dimension alone. |
| Desired control · Night | 5 | Night want for wet nights, waking when wet, getting up, when a wet happens, and night gear. |
| Goals and why | 4 | Goal tags, where it applies, and sim-only vs real habits for day and for night. Tags fill in direction when the numeric gap is small, and they pre-check methods. |
| Urgency training | 3 | `profile.urgency`: style (first-urge, surfing, partial, timed voids), how often prompts show, how generous passes are. |
| Sleep conditioning | 6 | `profile.sleep`: deeper sleep, bedtime cue, stay in bed, release before fully awake, DryClip alarm vs none, evening drink pattern. |
| Pacing | 4 | Day pacing, night pacing, intensity, timeframe. Intensity only changes how many practice tasks show. |
| Practice to opt into | 2 | Explicit day and night methods. Blank means the defaults from the goals. A tick replaces the defaults for that track. |
| A couple of pictures | 2 | Optional. Not scored. Stored on `profile.flavour` only if you answer them. |

The two picture questions are the only scenes. They are not repeated for other clothes or rooms.

## Reused mechanics, and what is actually new

v44 through v48 did **not** add a new event table. They retuned things that were already in the app:

- Urge rolls still start from `js/urge-matrix.js`. Conditioning multiplies those weights (`BSIntake.urgeModel` and `BSOnboard.rollMods`).
- Hold length still uses the ladder wait range, then replaces it with the paced hold when a conditioning profile is selected.
- Partials still use `js/partial.js`. Pass requests still use `js/passes.js`, with a small nudge from the pass answer (generous or strict).
- Full-session timers and sip prompts still use the existing session scheduler and `js/safety.js`.
- Check-ins, the control meters, gear recommendations, consent, and the body-check flags are the v44–v48 modules.
- The quiz screen is `BSQuiz.runFlow`, the same renderer as Quiz A and Quiz B.
- DryClip is not given a new protocol. The "sleep through it" and "wake on urge" events are prompts. Alarm vs quiet is a stored choice the prompt repeats.

**New in v49** (`js/cond-events.js`), shown in the event builder when the profile filter is Conditioning:

| Id | Direction | When it is allowed | What it asks |
| --- | --- | --- | --- |
| `c_spike` | A, day | Direction A | Surprise urge, shorter warning. Stop if it gets strong. |
| `c_noticed` | A, day | Direction A | You may already be a little wet. No pushing. |
| `c_relax` | A, day | Method `relaxed` | Passive release. No holding back and no pushing. Not overflow. |
| `c_partial` | A, day | Direction A | Let a little go, then the toilet only if that reminder is on. |
| `c_pass` | A, day | Direction A | A pass can be no, or a compromise. Not a guaranteed trip. |
| `c_sleep` | A, night | `stay_bed` or `deeper_sleep` | DryClip stays quiet. Staying in bed is the practice if you wake. |
| `c_wind` | A, night | `deeper_sleep` | Same bedtime, dark, no late screen. Sip earlier only if thirsty. |
| `c_hold` | B, day | Direction B | A short extra wait, then go. Not a max clench. |
| `c_surf` | B, day | Method `urge_surf` | Notice the wave, let the peak ease, then go. |
| `c_void` | B, day | Method `timed_void` | Go at the planned time. |
| `c_kegel` | B, day or night | Method `kegels` | Gentle 3–5 second squeeze, then a full relax. |
| `c_wake` | B, night | Direction B | If you stir, get up and finish in the toilet. |

Every one of those ends with a real-need line: stop and go. Weight is `1 + gap/40`, then ×1.4 for instant or hybrid, ×0.8 for gradual, ×0.45 for slow burn. They are logged on the active profile's `eventLog`. Full session and Natural Urge call `BSCondEvents.pick` only when consent is on and that profile is active.

## Export format

`BSCondProfiles.exportProfile` returns JSON:

```json
{
  "app": "BladderSim",
  "kind": "conditioning-profile",
  "version": "49",
  "exportedAt": "ISO time",
  "name": "My Conditioning",
  "quiz": null,
  "nowWant": null,
  "pacing": { "day": "slow", "night": "instant" },
  "methods": { "day": ["relaxed"], "night": ["kegels"] },
  "goals": [],
  "direction": { "day": "A", "night": "B" },
  "starting": { "day": 70, "night": 40 },
  "target": { "day": 30, "night": 80 },
  "levelKey": { "day": "okay", "night": "shaky" },
  "targetKey": { "day": "little", "night": "good" },
  "urgency": null,
  "sleep": null,
  "checkins": [],
  "habits": { "log": [], "streak": { "day": 0, "night": 0 } },
  "eventLog": [],
  "effective": { "day": null, "night": null }
}
```

`quiz` is the raw intake answers when the quiz was finished in this version. `nowWant` is `profile.dimensions`. `effective` is `BSIntake.urgeModel` for day and night (hold, odds, notice, wet chance). `exportAll` uses `"kind": "conditioning-library"` and a `profiles` array of the same objects.

The share path copies that JSON, plus `summaryText`, to the clipboard. If a Capacitor Share plugin is present it also opens the share sheet. Otherwise it downloads `conditioning-profile.json`. The text summary starts with `Conditioning profile:` and `App version 49` so it can be pasted into chat.

Import accepts one profile or a library. It checks `kind` and that now/want, starting levels, or ladder keys exist. A bad file is rejected. A good file is added as a new profile and does not replace the active one unless nothing was active.

## Where to tap

- **Full Session** and **Urge:** the picker is the first block (`#condPickSession`, `#condPickUrge`). New, Retake, Edit pacing, Duplicate, Rename, Delete (second tap confirms), Export, Import, Export all.
- **Profiles tab:** the same manager (`#condProfileManager`).
- **Settings → Calibration & Conditioning:** bladder calibration, and a link to the Profiles manager. The quiz and pacing editors are not a second copy. The section starts closed. How to move or hide collapses is in `docs/UI-REVIEW-v49.md`.

## Known gaps

- Cue times are still labels on the practice list. They are not phone notifications. There is no drink quick-add on a notification.
- Health Connect sleep still needs a native plugin. The sleep-depth question can use a night already stored from JSON.
- The advisor screen, weekly pass refill, night story cards (S1–S9), gear-week plan, and infinite campaign generator are not built.
- Flavour scenes do not change scores.
- Conditioning events are prompts with short guide steps. They do not replace the urge-matrix roll, and they do not talk to DryClip hardware.
- Delete confirms with a second tap on the button, not a system dialog, when `prompt`/`confirm` is missing.

## Playtest fixes

Two reports from a conditioning session with a thick diaper.

**Change check waits when the diaper still has room.** A let-go used to open May I change? as soon as the guide finished, even at about 10% saturation. It now looks at the gear you have on (`js/gear.js` capacities: thick diaper 1500 ml, diaper 1000, overnight pull-up 600, pull-up 400, pad 150, training pants 80, underwear 0). Underwear, a pad, training pants, or a pull-up still asks immediately, and so does a thick diaper once saturation is near full (about 65%, or 80% on an untraining profile, 55% on a more-control profile). Under that, a major accident schedules a body / diaper check-in inside the profile's window, default 10–30 minutes. A bigger accident sits toward the early end of the window. A small one sits toward the late end, and a dribble or a small wet under 20% skips the check. The check-in offers **Still fine**, **Change now**, and **Remind me later**. Untraining (direction A) leans later inside that window. The two numbers are on the conditioning profile picker: "Change check after a wet". Natural Urge uses the same rule when you have entered a saturation.

**A relax lasts about as long as your calibrated void.** Guide steps such as "SLOW STREAM" were written as 30 seconds and then multiplied by the leak scale, so a 12–15 second calibration could show a 33 second relax. A release step now uses the calibration median (the timed full-empty trials). If there is no timed trial, it uses volume ÷ flow, then the 14 second reference. A partial release is that time times the fraction of the fill. Each one gets a few seconds of grace (about 4 for a full void, 3 for a partial) and is capped at 1.5× the full-void time unless you set the leak scale higher than 1.5 on purpose. A 12–15 second calibration stays at about 16–19 seconds. Short relax cues under 8 seconds (a breath, a "let the muscle drop") stay as written so they are not turned into a full empty. The guide shows **I'm done** during a relax so you can end it when you are empty.

## Playtest checklist

Look for these, and paste an export summary with what you saw.

1. Update, open the app, and look at the top of **Session** and **Urge** before opening Settings. The picker should be there. On a fresh install the list is empty until New.
2. **New** should open the quiz in place, one question per screen, and save a second profile without deleting the first.
3. **Retake** should overwrite only the selected profile.
4. Change day pacing to Instant, then to Slow burn, without retaking. Natural Urge's hold should jump toward the goal on Instant and stay near the start on Slow burn with no check-ins.
5. Run a few "I need to go" rolls with a less-control profile and with a more-control profile. Note whether a conditioning line appeared, and whether it matched the direction (surprise / relax vs surfing / scheduled void).
6. Start a full session on My Conditioning. Note the first prompt and whether a sip was offered. Late sips should stay small when evening drinks are set to earlier in the day.
7. Log two check-ins on profile A, switch to profile B, and confirm B does not show A's check-ins. Switch back.
8. **Export**, paste the text summary here, and say which profile name and version line you got. Then **Import** that JSON and confirm a new profile appeared.
9. Open Event Builder, choose Conditioning, and confirm the list is the twelve events above, not the babysitter table.
10. Press the real-need control during any of this. It should let you go, with no pass cost and no lecture.

Report the profile name, the pacing you had set, the event name if one showed, and whether the real-need button was still there. The export summary is enough for the numbers.
