# Changelog

## v47 — 2026-11-13

Version name **47**, version code **47**.

- The conditioning quiz no longer repeats the same "you are wearing X, what happens" scene. Each question asks a different thing, in the style of Quiz A and Quiz B.
- Day and night each have a now and a want for hold, warning, suddenness, leaks, nights, sleep, and gear. "Keep this as it is" is on the want questions. The profile stores every dimension, not one number.
- Urgency training and sleep conditioning are their own sections. Pacing is instant, gradual, slow burn, or hybrid, separately for day and night.
- Natural Urge and a full session use the paced values: hold, warning, odds, sip timing, and the night routine. Gradual and slow burn move only when check-ins agree.
- A v45 or v46 profile still loads. Retaking overwrites the quiz result and keeps the habit log.

## v46 — 2026-11-12

Version name **46**, version code **46**.

- The conditioning intake uses the same quiz screen as the other quizzes: one question, option cards, a progress bar, and a result card. It is no longer a separate form.
- About 57 questions. The same scenes are asked twice — where you are now, then where you want that scene to land — across gear, place, and urge. The gap sets each track's level, target, and practice.
- Wetting in thick gear counts less toward low control than the same ending in underwear. You can save and resume, and skip the optional feelings section.
- The result card names the day and night result, the gear it points to, and the practice, then consent, then the diary-or-skip baseline. A v45 profile still loads. Retaking overwrites it.
- The intake is also on the quiz hub.

## v45 — 2026-11-12

Version name **45**, version code **45**.

- Conditioning starts from an intake quiz in Settings → Conditioning. The bare target number is gone. Consent is the last step of the quiz.
- The quiz asks where you are (day and night, plus gear at home, work, out, and night), where you want to go as a named level, what you want out of it, and which practice to opt into. Quiz A questions are reused where they match.
- After the quiz: a 2–3 day baseline diary, or skip and use a saved bladder-capacity estimate. Check-ins stay every 3 days. A level changes only after two check-ins in a row agree.
- The summary card uses level names and a bar. Numbers sit under Advanced. Retake and Edit are on the card.
- My Conditioning is a profile in the full session setup and in Natural Urge. Session sips and prompts follow the methods you picked, and sips stay inside the drink cap.
- Today's practice uses the same cue times, short tasks that get harder only after a streak, an immediate log line, and a streak that survives one missed day.
- A v44 consent is kept. The old target is shown as the nearest level, and the card asks you to take the quiz.
- Relaxed release is passive: no holding back and no pushing. It is not overflow and not stretching. A deep-sleep wet with no wake still scores higher for Night A than waking to change.

## v44 — 2026-11-11

Version name **44**, version code **44**.

- Conditioning is opt-in. Day and night each have a control meter and a target. An old save is migrated; the previous numbers stay on `legacy`. Real accidents move a meter only after you turn that on.
- Consent, a body check that can pause the mode, and one-tap reverse or stop.
- A partial release can come up on "I need to go" once conditioning is on. The percent follows direction, target, and debt. The daily cap defaults to 4. Emptying on the toilet afterwards is a setting (on by default) with one line about retention and UTIs. It is not enforced.
- A potty pass is a request. The answer can be no, yes, or yes with a compromise. It is not a guaranteed toilet trip.
- Drink log: one-tap sizes, same again, and a missed day stays blank instead of counting as zero.
- Gear recommendation comes from the quiz and check-ins. Pads are their own step. The pass card says if you're wearing lighter or heavier gear than that.
- Sleep import is ready (JSON now, Health Connect when a plugin exists). LuckRing has no public API in its store listing.
- Safety copy: no "hold until you can't", no max-clench kegel holds, drink prompts say sip if you're thirsty, and a night "stay in bed" result has a way to get up.

## v43 — 2026-10-29

Version name **43**, version code **43**.

- DryClip connect does not need a classic bond. It connects straight to the last MAC, and it tries that address again when a scan cannot see the clip (a connected clip stops advertising). After Arm, the clip drops the link on purpose and the app connects again.
- An armed wet, including a touch on the plate, posts a wet notification and is logged. The old settle latch was treating that late reading (about 30 seconds) as “still settling,” so it never alerted. A disarmed clip does not notify. The quiet background-watch notification stays up and does not replace the wet alert.

## v42 — 2026-10-27

Version name **42**, version code **42**.

- Path: a #2 roll uses tummy copy and the existing #2 guide tables (hold, or use protection / the potty). A #1 roll keeps the pee guides. With Messy content off, the #2 button and #2 guides stay hidden. A let-go guide in protection still chains into May I change?.
- Urge: #1 and #2 sit on the Natural Urge play surface, including while a natural session is running. The roll and its guide follow the type you picked. Classic Natural Urge keeps its own #1 / #2 pair.
- Campaign: a tummy-rumbling flag on the play card (“your next #2 can't wait”). It skips #2 waits, same idea as Path, and is stored on the existing campaign save.

## v41 — 2026-10-26

Version name **41**, version code **41**.

- Looks reach the big cards. Calendar day detail, Settings sections (including the navy rows that were painted inline), and the Path board use each skin’s panel, type, and accent. Baby, Toddler, Teen bedwetter, Girl, and Boy no longer leave a dark navy slab on a themed frame.
- Light skins: helper text and the urgency / saturation tracks stay readable on the peach and yellow headers. App look swatches show a small scene plus card, still stored on `bs_play_prefs_v1.theme`.

## v40 — 2026-10-26

Version name **40**, version code **40**.

- DryClip connect: `BOND_NONE` is logged and does not block connect, arm, re-arm, or the background watch. Forget bond is a supported workflow. Find a clip scans advertising names (and the remembered MAC). Classic pairing is optional.
- Export log copies the full text (JS log plus the native background section) to the clipboard, with a toast. A file download remains if the clipboard is unavailable.
- Natural / office play is a new key, `bs_natural_play_v1`. It is separate from Office Mode (`bs_office_mode`). Protection prompts in Urge, Path, and follow-ups become a restroom trip or a hold of at most 20 minutes. Real urge still wins. DryClip logging stays available.
- Looks: Baby, Toddler, and Teen bedwetter are deeper skins (wallpaper or playroom or dusk diary: background, cards, type, and chrome). Girl and Boy are full skins too — rose dusk with soft cards, slate with a sky stripe — still stored on `bs_play_prefs_v1.theme`.

## v39 — 2026-10-26

Version name **39**, version code **39**.

- DryClip settle latch: a wet bit that started during the settle window and is still latched afterward is cleared once and does not re-arm. The next arm waits until the plate reads dry, or you tap Arm. Unpaired clips (`bond none`) back off instead of reconnecting into another settle loop.
- Clip assists Path: a pending go counts before Start timer, and the hold marker stays after the timer hits 0 until the go is resolved. Soft play stays a flag. The interrupt still needs a tap.
- Padding check before re-arm: random timer inside the existing re-arm window (tunable spread, works with Match protection) so the clip can be aimed at padding that is still dry. Caregiver copy when caregiver mode is on; plainer copy otherwise.
- Path classes: Pull-up Soft (full-length holds, not Leaky Girl), Pad Girl clarified, Night Little for nights. Old picker aliases are gone. Storage ids are unchanged (`pullup`, `leaky`, `little`, …). Every Path and Campaign class has a small #2 modifier. Campaign `dribbler` and Path Leaky Girl are one identity.
- Looks: Baby, Toddler, and Teen bedwetter change background, cards, and type. Girl and Boy accents remain. Stored on `bs_play_prefs_v1.theme`.
