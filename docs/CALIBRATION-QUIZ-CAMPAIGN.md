# v5 — Void calibration, My Profile quizzes, Campaign mode

**Framing.** Everything here is in-game simulation for consenting adults. Nothing in the app tells you to train your real body toward less control. Every number that comes from real life is labelled **"🎮 GAME STAT — not a medical measure"**. Bedwetting mode stays totally silent: none of the v5 modules (`js/calibration.js`, `js/quiz.js`, `js/campaign.js`) plays a sound, vibrates, schedules a notification or prompts you. The e2e test checks this.

## 1. Void calibration (Settings › 🎯 Calibration) — `js/calibration.js`

**Existing logic it drives.** The app already had a **duration** scalar, `leakTimeScale` (state.js, Settings › Session options "⏱️ Leak/Push Duration", range 0.5–10×), and **Push-to-Leak** (`pushToLeakEnabled`, hold `#pushToLeakBtn` while a leak step runs). In `guide.js`, every `push`/`relax` step lasts `round(step.time × leakTimeScale)` s. The separate *amount* scalar (`getContinenceLeakScalar()`, custom profile `leakScalar`) controls volume, not time, so calibration leaves it alone. Calibration writes `leakTimeScale` for you through `updateLeakTimeScale()`, and the slider moves with it. You never have to edit it by hand.

**Flow.**
1. Fill in the pre-test form: sex (male / female / prefer not to say), age, urgency right before (0–10), and the *Use press-to-leak style* toggle.
2. Run the test. In hold style you hold the big button while flowing, release when the stream pauses and press again when it restarts. Every held segment is added up. With the toggle off, you tap to start and tap to pause.
3. Tap **Done**. You can enter a measured volume (ml or oz, oz × 29.5735).
4. Trials are stored in `localStorage.bs_calibration_v1` and listed with 🗑 delete buttons. Each new or deleted trial recomputes the summary and re-applies the scalar.

**Leak-scalar math.**
- `FULL_REF_SEC = 14 s`: the nominal push+relax time of a full accident at 1.0×. This is the median of the push+relax totals in the macro/accident tables (BABYSITTER_ACCIDENT_* 8–11 s, MACRO_NPT/DEPENDENT/BEDWETTING 12–17 s, FULL_TRAINING_FAILURES 18 s), measured from `js/tables.js`.
- `T` = **median** held duration across trials. The median resists one bad trial; the mean is shown too.
- `leakTimeScale = clamp(round1(T / 14), 0.5, 10)`. So a full 100% accident lasts about 14 × scale ≈ T seconds.
- Partial leaks scale by the same factor, because each step is multiplied. A leak that is fraction *f* of a full one lasts ≈ 14·f·scale (`leakSecondsFor(f, scale)`). Example: T = 21 s → 1.5× → a full accident ≈ 21 s, a half leak ≈ 11 s.
- Average flow = volume ÷ duration, taken as the median across trials that have a volume.

**"Bladder age" (game stat).**
- Capacity age: below 390 ml, `age = round(V/30 − 1)`, which inverts ICCS 30×(age+1). At 390 ml or more it reads "typical of an adult (12+ reference)".
- Duration is compared with the 21 ± 13 s urination "law".
- Flow is compared with a game reference for your age and sex: males ≈ 13 ml/s at 30, dropping 1.39 ml/s per decade; females ≈ 15 ml/s, flat until 60.
- **Gentle note** appears if average flow is under 10 ml/s or median volume is under 150 ml or over 800 ml. It says home timing is imprecise, that this is not a diagnosis, and that a *persistent* change is worth mentioning to a doctor.

### Reference data & sources
| Item | Value used | Source |
|---|---|---|
| Urination time | 21 ± 13 s for mammals > 3 kg | Yang, Pham, Choo, Hu. *Duration of urination does not change with body size.* PNAS 2014;111(33):11932–7. https://www.pnas.org/doi/10.1073/pnas.1402289111 |
| Child expected capacity | 30 × (age + 1) ml (ICCS / Hjälmås), level at 390 ml from age 12; Koff alt. (age + 2) × 30 ml | ICCS standardisation (Austin et al., Neurourol Urodyn 2016 / J Urol 2014); Koff SA, *Urology* 1983;21:248; Hjälmås K 1976 — https://www.ics.org/folder/committees/children-public-documents/d/7-iccs-standardization-report-on-urodynamic-studies/download ; BAPS normal values |
| Adult voided volume | ~300–500 ml typical; mean VV 440 ± 215 ml, Qmax 22.5, Qavg 13.05 ml/s (median age 31) | Kumar V et al. *Indian J Urol* 2009;25(4):461 — https://pmc.ncbi.nlm.nih.gov/articles/PMC2808647/ |
| Male flow decline | Qavg −1.39 ml/s, Qmax −2.62 ml/s per decade; women flat < 60 | *Reassessing Normal Voiding Standards*, J Clin Med 2024;13(10):2857 — https://www.mdpi.com/2077-0383/13/10/2857 |
| Qmax norms | men > 22 (< 40 y), > 18 (40–60), > 13 (> 60) ml/s; women > 25 (< 50), > 18 (> 50) | Investig Clin Urol 2025 (review of norms) — https://www.micurology.org/DOIx.php?id=10.4111%2Ficu.20250360 ; Haylen et al., Liverpool nomograms, *BJU* 1989;64:30 |
| Female pooled | Qmax ≈ 29 ml/s, Qavg ≈ 15 ml/s | systematic review cited in J Clin Med 2024 above |

## 2. My Profile quizzes (Profiles › 🪪 My Profile) — `js/quiz.js`
- **Quiz A, "Where you are now"** (8 steps): urgency, daytime frequency, day leaks in the last 30 days, awareness, triggers (multi-select, mapped to babysitter symptoms), wet nights in the last 30 days, day protection, night protection. The leaks and nights answers are **prefilled from calendar *natural* entries** for the last 30 days. Score = urgency + frequency + leaks + awareness + nights (each 0–3) + min(2, 0.5 × triggers), out of 17. That maps to continence level `round(score/17×4)` (fully_continent…fully_incontinent) plus a "control %" stat. This is an informational baseline only, never a goal.
- **Quiz B, "Where you want to go"** (5 steps): traits to roleplay (6 symptoms), intensity (gentle / medium / spicy), session styles, in-game goal (more continent / stay / less continent / bedwetting sim), time per week. Target level: *more* → baseline − 2, *less* → + 2, *bedwetting* → at least "somewhat".
- **Output.** You get a personality card (e.g. "🌙 The Snuggly Night Owl", "🏆 The Brave Big Kid", "🧸 The Cozy Padded Sprout"), baseline/target/control/intensity tiles, recommended modes, and an **auto-generated custom profile** saved with the existing custom profile system (`source:'quiz'`; a retake replaces it). Its runtime carries main/micro windows, potty rate, micros per cycle, amount `leakScalar` and start protection, all derived from the target and intensity. It also carries three v5 extras: `leakTimeScale` (from calibration), `symptoms` and `continenceLevel`. A wrapper around `applyCustomProfile` applies these before the session starts. Retake A or B at any time, or press ↻ Regenerate.

## 3. Campaign (Profiles › 🏅 Campaign) — `js/campaign.js`
**Ladder.** The rank ladder is inspired by Rank Trainer's points → rank (panties → pad → Goodnites → diaper). Index 0 is the most continent *in-game*:

| # | Rank | Prot. | Main min | Micro min | Urgency waves | Hold odds | Warning | Grace app-open (s) / closed (min) |
|---|---|---|---|---|---|---|---|---|
|1|🩲 Big Kid|none|60–120|15–30|1|85%|long pre-chime|90–240 / 20–45|
|2|🎓 Trainee|pad|50–100|12–25|1|72%|pre-chime|60–180 / 15–35|
|3|🌱 Sprout|pull-ups|40–80|10–20|2|58%|pre-chime|45–120 / 10–25|
|4|🌙 Nightie|pull-ups|30–70|8–16|2|45%|short|30–90 / 8–20|
|5|🧷 Padded|diapers|25–55|6–14|3|32%|short|20–60 / 5–15|
|6|🧸 Thick-Padded|thick|18–45|5–12|4|20%|none|12–40 / 3–10|
|7|👑 Little Legend|thick|12–35|4–10|5|10%|none|8–25 / 2–6|

**Start and target.** Quiz continence levels 0–4 map to ranks 0, 2, 3, 5, 6. The start rank comes from Quiz A and the target from Quiz B. Without the quizzes, the defaults are Trainee/Trainee.

**Applying a rank.** It writes the alarm-grace settings (`BSGrace.saveSettings`; your old settings are restored if you abandon) and upserts a custom profile `id:'campaign'`. Press **▶ Play this rank** to start it.

**Daily goals** are checked against calendar entries for each day. You choose the source: *sim only* (default) or *sim + real check-ins/potty trips*.
- Always: log a morning check-in.
- Heading more continent: N potty trips, and in-game accidents kept at or under a cap.
- Heading less continent, or holding at a higher rank: play one sim session, and roll N **sim-only** leaks.
- Bedwetting goal: play a silent sim night.

**Real-life accidents and wet nights never count toward progress.** They can only count *against* the accident cap.

**Promotion and demotion.**
- A day passes when at least ⌈2/3⌉ of its goals are met.
- Days with no entries are "rest" days and count as neither pass nor fail.
- Promotion: 3 passing days in a row (2 if you chose "every day"), one rank toward the target.
- Demotion: 2 failed days in a row, one rank back, never past the start rank.
- Days are settled whenever the Profiles tab renders (up to yesterday).
- **Pause** freezes evaluation and skips the paused days. **Abandon** clears the campaign and restores grace.
- Reaching the target shows 🎉.

## Tests
`tests/ui-calendar.e2e.js` (headless Chrome, 360×800 and 412×915) now also covers:
- calibration median/mean/flow, scalar clamp, proportional partials, bladder age and gentle-note thresholds, the reference formulas, the real UI hold/release/re-press/Done flow, and delete-trial recompute;
- Quiz A/B click-through, target maths, a program carrying the calibrated scalar and symptoms, and no duplicate programs;
- campaign promotion, natural accidents ignored, the demotion floor, pause, and the grace update;
- a static check that v5 modules never vibrate, chime or schedule;
- layout (no overflow, touch targets ≥ 44 px).

Screenshots: `/workspace/screens/v5-*.png`.

## Limitations
- Timing a void by holding a button is approximate: reaction lag is about ±0.5 s per stream segment. Volume is optional and self-reported.
- Reference tables are coarse, population-level game references. "Bladder age" is a toy stat, not a clinical estimate.
- Campaign goals use calendar entry types (`night`, `potty`, `accident`/`leak`). Sim entries only exist if calendar auto-logging is on.
- The campaign profile only takes effect when you press Play; it does not hot-swap a running session.
