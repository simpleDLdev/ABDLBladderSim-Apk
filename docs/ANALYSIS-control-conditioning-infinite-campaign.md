# ANALYSIS — Control conditioning (both directions), day/night tracks and the Infinite Campaign

*Branch `cursor/bladdersim-v43-ccdd` @ `4475725` (v44 merged). Design document. Revision 2 (2026-11-11): day/night tracks, check-ins, gear ladder, advisor, Potty Pass, night scoring, behaviour/symptom tracking. Revision 3 (2026-11-11, owner): a partial release is one weighted "I need to go" outcome (the percent scales with direction, target gap, and debt; the daily cap is a setting, default 4). A Potty Pass is a request for better odds, not a guarantee — denied, granted, or granted with a compromise. "Empty fully on the toilet after a partial" is a setting, default on, with one settings line that emptying fully helps avoid retention and UTIs. It is not a forced rule. Drink logging is a first-class input (quick-add, repeat last, missed days left out of the estimate). Sleep stages come from a pluggable source (Health Connect, then manual import). Recommended gear is computed from the calibration baseline; pads/liners are their own ladder step. v44 implements phase 1 plus these data structures. Revision 4 (2026-11-12): conditioning starts from the intake quiz in §13.1. Methods are the catalogue in §6.6. The saved profile is "My Conditioning" in the existing session and Natural Urge pickers.*

**Framing.** BladderSim is for consenting adults. This design lets a player choose, on purpose and with clear information, to practise habits that move their real control **down** (toward bedwetting and protection-first habits) or **up** (toward dryness), on the day track, the night track, or both, for as long as they like. Weeks or months of consistent practice can change real habits; the app says so plainly at onboarding and the player decides. Physical-safety guardrails are built in as features (caps, pauses, a reverse button, a no-cost override), not as warnings the player has to read every day.

This replaces the older stance in `docs/IDEAS-catalogue.md` L5 / `docs/REVIEW-v2-mechanics.md` L6 ("nothing here trains the real body") **only for players who opt in** through the consent screen. Everyone else keeps the current game-only behaviour.

**Contents**
1. Summary
2. Current control modelling and the merge plan
3. Day and night tracks
4. Calibration and check-ins (real metrics → estimate)
5. Behaviour and symptom tracking
6. Conditioning model (cues, routines, Direction A / B, caregiver)
7. Gear ladder and generalisation across protection
8. The "I need to go" advisor
9. Potty Pass economy and debt
10. Night scoring with DryClip timing
11. Infinite Campaign (per track)
12. Data model (all keys)
13. UI flows (screens)
14. Safety and consent design (+ existing strings to fix)
15. Implementation roadmap
16. Open questions

---

## 1. Summary

- **Two tracks, one engine.** Control is tracked separately for **day** and **night**, each 0–100 with its own target. The player trains night-only, day-only, or both. `js/control.js` is the single source; Campaign rank, Path zone, alarm grace and night rolls read from it.
- **Measured, not guessed.** A calibration quiz plus an optional 3-day baseline diary sets the start. Then a short **check-in every 2–3 days** logs real metrics — voided volume, frequency, interval, urgency, warning time, leaks, night wets (DryClip), wake-ups, wet size — re-estimates each track, shows trends, and tunes campaign difficulty.
- **Gear-aware.** A gear ladder (thick diaper → diaper → thin diaper → pull-up → training pants → underwear, plus bed protection) tracks success *per gear*. Graduated exposure and cue fading move the trained behaviour — letting go (A) or staying dry (B) — from the "safe" gear onto any gear, with practical bed and clothing protection at the thin end.
- **Always-with-you advisor.** Tap **I need to go** → the app weighs gear and how much it can still hold, context (home / office / out / car / bed, discreet mode), track, target vs estimate, time since last void, recent drinks and urgency, then answers: toilet now, use your protection, wait N minutes, or offer a Potty Pass with a condition.
- **Partial release is a roll outcome.** "Let about N% go into what you're wearing" sits in the same weighted roll as go, wait, and use protection. N scales with direction, how far the target is from the estimate, and debt. The daily cap is a setting (default 4). This is the "didn't quite make it" habit: lighter gear, without relying on a full wet, and a bit of urgency practice.
- **Potty Pass is a request, not a guarantee.** Spending a pass asks for better odds of a toilet trip. The answer is denied (protection or a short wait), granted, or granted with a compromise (a partial into current gear, or the walk may not fully make it). Weights use direction, target vs estimate, debt, gear, and context. Whether a partial is followed by emptying on the toilet is a setting (default on). The settings screen has one line: emptying fully helps avoid retention and UTIs. The app does not force it.
- **Potty Pass economy.** A limited weekly supply of those requests. In Direction A, overusing them builds **debt** that backfires later — heavier night rules, one capped afternoon drink prompt, lower odds next time — with hard caps. In Direction B, debt comes from skipping scheduled trips. A **real emergency / health** override is always free and is not a pass.
- **Drinks are logged, not guessed.** One-tap sizes, repeat last drink, and a drink reminder that opens the log. Intake vs output shows up on the check-in. A day with no drink log is left out of the intake adjustment. It is not treated as zero.
- **Gear from the baseline.** Calibration (volume, interval, urgency, leaks, nights) maps to a ladder step. Pads/liners are a step: someone who manages with a pad is in the pad stage; pull-ups at work are a heavier step and not fully dry. Check-ins update the recommendation. The advisor and pass requests assume that gear, and say so if you're wearing lighter or heavier.
- **Night scoring from DryClip timing.** Each night wet is classified from the clip's wet time vs phone/wake activity. Direction A scores sleeping through a wet highest (above waking, changing and going back to sleep). Direction B scores waking to the alarm and finishing in the toilet highest.
- **Behaviours and red flags.** Urgency, warning time, awareness of wetting, wake-on-urge and wake-on-wet feed the estimate. Hesitancy and straining are treated as possible warning signs, **never** as progress. Pain, burning, blood, fever or retention signs pause everything and say "see a doctor".
- **Built-in safety.** Consent onboarding that plainly says long-term practice may change real control, a "real progress" switch that is off by default, `safety.js` drink caps on every prompt including debt backfires, no hold-to-failure, no straining, correct pelvic-floor technique, one-tap reverse, and a re-consent check-in every 4 weeks.

---

## 2. Current control modelling and the merge plan

### 2.1 What exists today (brief)
| System | Where | What it holds | Problem |
|---|---|---|---|
| Control meter | `js/control.js` (`bs_control_v1`) | value 0–100, direction progress/regress/hold, ±8/day cap, drift table `DRIFT` (L74-77), 6-band `LADDER` | Closest to a real model, but it only moves on a few game events |
| Campaign rank | `js/campaign.js` (`bs_campaign_v1`) | 7 ranks (L13-21), daily goals, promote after 3 passing days / demote after 2 failed days | Separate ladder with its own goals; maps to Control only loosely (`levelToRank`, L23) |
| Path board zone | `js/board.js`, `js/path-play.js` (`bs_board_v1`, `bs_path_v1`) | 5 zones by fraction | A third progress view |
| Session continence level | `currentContinenceLevel` (`js/ui.js` L769/L1631, `js/quiz.js` L396), read by `js/alarm-grace.js` | 5 text levels | Grace windows ignore the Control meter |
| Quiz baseline/target | `js/quiz.js` (`bs_quiz_v1`), `docs/CALIBRATION-QUIZ-CAMPAIGN.md` §2 | baseline control %, target level | Seeds Control once (`control.js` `defaults()`), then never again |
| Classes | `js/classes.js` (`bs_class_v1`) | odds modifiers, base band | Fine as modifiers |
| Real data | `js/calendar.js` (`bs_calendar_v2`), `js/dryclip.js` (`bs_dryclip_v1`), `js/accident.js` | natural potty / accident / night entries, clip wet times | Mostly unused for estimating control |

Control moves today on: go (+1 / +0.3), alert made, gear outcome, dry/wet morning, campaign goal pass/promotion, and a failed wait (−2 in **both** directions, `control.js` L76). `countWaitAccidents` defaults to ON (L83), so a real accident during a wait moves the meter — and in regress mode that counts as progress.

### 2.2 Merge plan — `control.js` as the single source (with tracks)
1. **Split `bs_control_v1` into two tracks.** `tracks.day` and `tracks.night`, each with `value`, `target`, `estimate`, `confidence`, `cap`, `dayDelta`, `history`. The old top-level `value` is migrated into both tracks (night gets `min(value, quiz night value)` when available). Day/night ladder overrides already exist in `DESIGN-classes-perks-campaign.md` §1.1.
2. **Read helpers** (other modules stop keeping their own state):
   - `BSControl.band(track)` → ladder key for `'day'` or `'night'` (default: `trackFor(now, context)`; see §3.3).
   - `BSControl.continenceLevel(track)` → maps the band onto the old 5 text levels, so `alarm-grace.js` `controlValue()` and `natural-night.js` `levelIdx()` read it.
   - `BSControl.rankIndex(track)` → campaign rank 0–6, replacing `campaign.js` `levelToRank` (L23).
   - `BSControl.zone(track)` → Path board zone.
   - `BSControl.trainingBand(track)` → the band one step past the estimate toward the target (§8.3), used by the advisor and rolls.
3. **Event bus in, not writes.** Campaign, Path, Simple Urge, Natural Night, DryClip, Accident, Advisor and Pass emit `bs:outcome` events `{kind, track, source:'sim'|'real', ts, gear, context, meta}`. Only `control.js` turns them into drift, so weighting rules live in one place (§11.3).
4. **Campaign becomes a view.** The classic Campaign stays as a mode, but its rank is derived from the day track (or night track for the bedwetting goal). "Promote" becomes "+3 on that track".
5. **Migration.** First load after update: tracks from the existing value → campaign rank midpoint → quiz baseline. Old keys stay read-only for one version.
6. **Tests.** Pure-function tests for `estimateTrack()`, `applyDelta()`, the advisor decision, debt decay, night classification, the generator and band mappings (existing `tests/` harness).

---

## 3. Day and night tracks

### 3.1 Why two tracks
Day and night control behave differently. A player can be dry all day and still wet every night, or the other way round. The user also wants to train night-only, day-only, or both. Each track has its own estimate, target, campaign objectives, gear ladder position and pass rules.

### 3.2 Track setup
| Choice | Day track | Night track | Typical player |
|---|---|---|---|
| **Night only** | frozen (shown, not trained; advisor uses Natural Urge level) | trained | bedwetting focus (A) or dry nights (B) |
| **Day only** | trained | frozen | daytime protection habits (A) or daytime dryness (B) |
| **Both** | trained | trained | full lifestyle; directions can differ per track |

- **Direction per track:** each track has its own target, so direction can differ (e.g. day B "stay mostly dry at work", night A "wet the bed"). Direction = `sign(target − estimate)`, or `hold` within ±5.
- **Pace per track:** gentle / steady / fast = planned change of 2 / 4 / 6 points per week (§11.4).
- **Frozen track:** keeps its last estimate, shows trends from check-ins, generates no objectives, and the advisor uses its band without nudging it.

### 3.3 Which track an event belongs to
```
function trackFor(ts, context):
  if context === 'bed' or NaturalNight.active(): return 'night'
  if sleepWindow(ts) (between player's lights-out and rise time, default 23:00–07:00): return 'night'
  if nap logged: return 'night'          // nap = mini night (catalogue #72)
  return 'day'
```
Every calendar entry gets a `track` field. DryClip wets during Natural Night or the sleep window are night; daytime clip wets are day.

### 3.4 Track band ladder (shared)
Both tracks use the existing six-band `LADDER` in `control.js` (Big Kid 92–100 … Infant 0–19). Night uses the same numbers but its own odds column for "may get up", stay-in-bed and change thresholds (already `allow` per band).

---

## 4. Calibration and check-ins (real metrics → estimate)

### 4.1 Initial calibration
1. **Quiz A — where you are now** (`js/quiz.js`, existing 8 steps) plus new questions per track:
   - Day: usual trips per waking day, usual warning time, day leaks in the last 30 days, how often you notice a leak *while* it happens.
   - Night: wet nights in the last 30 days, usual wake-ups to pee, whether you wake when wet, usual wet size, gear worn at night.
   - Gear: what you own (§7.2) and which gear you wet / stay dry in most.
2. **Quiz B — where you want to go**, per track: band picker + fine slider (0–100), pace, direction confirmation, real progress on/off, caregiver none / same phone / partner, rest days.
3. **Optional baseline diary — 3 days** (`bs_diary_v1`): every drink, every void (volume measured or estimated), urgency at void, leaks, wakes, wets, gear. Stars for logging, not for numbers. Detailed or simple mode.
4. **Optional void calibration** (existing `js/calibration.js`) for duration and measured volume.
5. **Result:** a starting estimate per track with a confidence value. Quiz-only start = confidence 0.3; quiz + diary = 0.7; quiz + diary + 3 DryClip nights = 0.9 for night.

### 4.2 Check-ins every 2–3 days
A **check-in** is a short (2–4 minute) look back over the last 24 h, prompted every 2–3 days (player picks 2 or 3; one gentle notification at their chosen time, silent during Natural Night).

| Step | What's asked | Notes |
|---|---|---|
| 1 | **Voids in the last 24 h** — count, and volume for at least 2 of them | Measuring cup (ml/oz), or estimate: small ≈150 ml, medium ≈300 ml, large ≈450 ml. Measured values are flagged `measured:true` and weigh more. |
| 2 | **Longest and typical gap** between daytime voids | Auto-filled from logged voids if the player used the advisor; editable. |
| 3 | **Urgency** — typical urgency at void (0–10), number of "had to rush" moments | |
| 4 | **Warning time** — typical minutes from first noticing to needing to go now | |
| 5 | **Leaks / accidents** — day count and sizes (drops / small / medium / full) | Prefilled from accident logs as a hint only; the player confirms. |
| 6 | **Awareness** — for any wet: noticed before / during / only after / not until checking | |
| 7 | **Nights since last check-in** — wets (DryClip list to confirm), wake-ups, woke to pee (dry), woke when wet, wet size, gear | DryClip events are listed for one-tap confirm (existing confirm flow). |
| 8 | **Behaviour and body** — hesitancy, dribbling, straining, and the red-flag chips (§5) | Any red flag → symptom pause. |
| 9 | **Drinks** — the log, not a guess | Prefilled from `bs_drinks_v1` when that day was logged. A day with no log is skipped (it is not stored as 0 ml). The player can still type a total. Used for intake vs output and for the frequency adjustment below. Never a target, and no stars for drinking. |

Check-ins can also be done any time. A missed check-in never costs anything; the next one simply covers more days (the player picks which day to describe).

### 4.3 Metric definitions
All metrics come from the last **14 days** of check-ins, diary days and logged events, newest days weighted more (half-life 7 days). Missing metrics are dropped and the weights renormalised.

| Metric | Symbol | Definition | Track |
|---|---|---|---|
| Typical voided volume | `V` | Median volume per daytime void (ml); measured values weight 1.0, estimates 0.5 | day (also capacity input for the advisor) |
| Max voided volume | `Vmax` | 90th percentile of measured voids | day / advisor |
| Daytime frequency | `F` | Voids per waking day (toilet + full accidents) | day |
| Interval | `I` | Median minutes between daytime voids | day |
| Urgency at void | `U` | Mean urgency 0–10 when voiding | day |
| Rush rate | `R` | "Had to rush" moments per day | day |
| Warning time | `W` | Median minutes from first notice to "must go now" | day |
| Day leak rate | `Ld` | Leaks per day, weighted by size (drops 0.25, small 0.5, medium 0.75, full 1) | day |
| Awareness | `Aw` | Share of wets noticed before or during (vs after / not at all) | day + night |
| Dry-night rate | `Dn` | Share of nights with no wet | night |
| Wets per night | `Wn` | Mean wets per night | night |
| Night wet size | `Sn` | Mean size of night wets (0.25–1) | night |
| Wake-to-pee rate | `Wp` | Share of nights where the player woke with an urge and peed in the toilet before any wet | night |
| Wake-on-wet rate | `Ww` | Share of wet events where the player woke during or within 30 min (§10) | night |
| Nocturia | `Nc` | Toilet trips per night | night (context only) |

### 4.4 Metric → score (0–100, higher = more control)
```
clamp01(x) = max(0, min(1, x))
sV  = 100 · clamp01((V − 100) / (400 − 100))       // 100 ml or less → 0, 400 ml+ → 100
sF  = 100 · clamp01((12 − F) / (12 − 5))           // 12+/day → 0, 5/day → 100 (intake-adjusted, below)
sI  = 100 · clamp01((I − 45) / (180 − 45))         // 45 min → 0, 3 h → 100
sU  = 100 · (1 − U / 10)
sR  = 100 · clamp01(1 − R / 4)
sW  = 100 · clamp01(W / 30)                        // 30 min warning → 100
sLd = 100 · clamp01(1 − Ld / 4)
sAw = 100 · Aw
sDn = 100 · Dn
sWn = 100 · clamp01(1 − Wn / 3)
sSn = 100 · (1 − Sn)                               // dry nights count as size 0
sWp = 100 · Wp
sWw = 100 · Ww
```
**Intake adjustment for frequency:** only when that day has a drink log. If logged intake was above 2.5 L, `F_adj = F × 2.0 / intakeL` (multiplier clamped to 0.7–1.0) so a high-drink day doesn't read as lost control. A missing log does not adjust `F` and does not count as 0 L. An explicit "I drank nothing" log is a real zero.

**Output.** Void volumes from the check-in and any measured diary voids are the output side. The result card shows intake, output, and the difference when both exist. If either side is missing, that side says "not logged" and the balance is not invented.

**Sleep term (optional).** When a sleep source has stages for a night, each confirmed wet gets `sSl` from the stage at `wetAt` (higher = more control): woke, or awake, scores high; a wet in deep or REM sleep with no wake within 30 min scores low. `sSl` is added to `nightMeasured` at weight 0.10 and the mean is renormalised. No sleep data → the term is dropped, and the other night weights are unchanged. Deep-sleep minutes are shown as their own trend (the player may want deeper sleep). They do not move the bladder estimate except through wets that happened during sleep.

### 4.5 Track estimates
```
dayMeasured   = wmean([ sI 0.20, sF 0.10, sV 0.10, sW 0.15, sU 0.10, sR 0.05, sLd 0.20, sAw 0.10 ])
nightMeasured = wmean([ sDn 0.35, sWn 0.15, sSn 0.15, sWp 0.20, sWw 0.10, sAw 0.05, sSl 0.10 ])
              // sSl omitted when there is no sleep-linked wet; wmean renormalises
confidence    = min(1, weightedDaysWithData / 10) · (0.6 + 0.4 · shareMeasuredVolumes)   // day
              = min(1, nightsWithData / 7) · (clipNights > 0 ? 1 : 0.8)                   // night
```
**Update rule at each check-in:**
```
k             = 0.5 · confidence                    // how far one check-in can move the estimate
estimate_new  = estimate_old + k · (measured − estimate_old)
estimate_new  = clamp(estimate_new, estimate_old − 10, estimate_old + 10)   // no wild swings from one check-in
```
Sim outcomes do not enter `measured`; they feed the playable meter (§11.4) when `realProgress` is off.

### 4.6 Trends
- **Trend line per metric and per track:** last 10 check-ins as a sparkline, with the target as a dashed line.
- **Slope:** least-squares slope over the last 6 check-ins, in points per week. Compared with the planned pace (2 / 4 / 6).
- **Status badges:** *on pace* (slope within ±40% of plan, toward target), *ahead*, *slow*, *drifting away*, *flat*.
- **Highlights:** "Typical gap up from 85 to 110 min", "3 of the last 4 nights slept through a wet", "Thin pull-up let-go rate now 60% of thick" (§7).
- **Recap card** in the check-in result: the two biggest changes and one suggestion.

### 4.7 How check-ins adjust difficulty
```
function adjustAfterCheckIn(track):
  plan  = paceWeekly(track.pace) · sign(track.target − track.estimate)
  slope = trendSlope(track, last 6)
  if abs(track.target − track.estimate) <= 5: track.phase = 'maintain'; return
  if sign(slope) !== sign(plan) and abs(slope) > 1:   // drifting away
      track.difficulty −= 0.5; suggestRestDay(track)
  else if abs(slope) < 0.5 · abs(plan):                // slow
      track.difficulty += 0.25
  else if abs(slope) > 1.5 · abs(plan):                // much faster than planned
      track.difficulty −= 0.25                         // don't overshoot; keep it sustainable
  track.difficulty = clamp(track.difficulty, 1, 5)
  regenerateRemainingObjectives(track)                 // §11.5 — this week's unfinished objectives re-scaled
```

---

## 5. Behaviour and symptom tracking

### 5.1 Behaviours logged
| Behaviour | How it's logged | Feeds | Direction meaning |
|---|---|---|---|
| **Urgency** | 0–10 at every advisor tap and void | `U`, `R`, advisor | A: lower day estimate when urgency comes fast; B: falling urgency = progress |
| **Warning time** | minutes from notice to must-go (advisor tap → void / accident timestamps, or asked) | `W` | A: shorter warning = toward target; B: longer = toward target |
| **Awareness of wetting** | before / during / after / not noticed, per wet | `Aw` | A: "not noticed / after" moves toward target; B: noticing earlier is progress |
| **Wake-on-urge** | woke needing to pee (dry), from Natural Night wake log | `Wp` | A: fewer wake-ups to pee is toward target; B: more is progress |
| **Wake-on-wet** | woke during / soon after a wet (§10 classification) | `Ww` | A: sleeping through is toward target; B: waking is progress |
| **Wet size** | drops / small / medium / full | `Ld`, `Sn` | A: fuller lets-go; B: smaller, stopped early |
| **Let-go readiness (A)** | "could you let go when the advisor said so?" yes / partly / no | gear generalisation stats (§7) | A only; a "no" is just data, never punished |
| **Dribbling** | pre-void / post-void dribbles | `Ld` (as drops) | small effect only |
| **Hesitancy** | trouble starting the stream (none / a little / a lot) | **red-flag watch only** | never counts toward either target |
| **Straining** | had to push to start or finish | **red-flag watch only** | never counts toward either target |

**Why hesitancy and straining never count as progress:** they are signs of retention (the bladder not emptying), which is the main physical risk for anyone practising holding or stop-start voiding. Direction A is about letting go easily, not about trouble emptying.

### 5.2 Red flags → symptom pause
| Red flag | Trigger | Action |
|---|---|---|
| Pain or burning when peeing | any | **Pause** + "see a doctor (possible infection)" |
| Blood in urine (pink, red, brown) | any | **Pause** + "see a doctor" |
| Fever, chills, or back/side pain | any | **Pause** + "seek care today" |
| Can't pee, or very little comes out with a strong urge | any | **Pause** + "seek care now" |
| Feeling of not emptying + weak stream / straining | 2 check-ins in a row, or 3 days | **Pause** + "see a doctor" |
| Hesitancy "a lot" | 2 check-ins in a row | **Pause** + "see a doctor" |
| Cloudy / strong-smelling urine with any other symptom | any | **Pause** + "see a doctor" |
| Skin soreness or rash from gear | any | Skin cap tightened (max hours worn −1 h), change advised now; pause gear-wearing objectives for 2 days |
| Real override used 4+ times in a day | auto | Gentle "anything feel off?" chip (no pause unless a flag is ticked) |

**Pause behaviour (`bs_symptom_v1.paused = true`):** chapters stop, debt freezes, A rules switch off, the advisor answers "toilet when you need to" for everything, drink prompts stop, night scoring stops. The player resumes with a manual tap ("I've been checked / feeling fine"). Nothing is lost while paused; streaks are frozen, not broken.

### 5.3 How behaviours feed the estimate
Behaviours enter through the metrics in §4.3 (`U`, `R`, `W`, `Aw`, `Wp`, `Ww`, sizes). They also add small **instant drift** between check-ins, through the per-event table (§11.4), so the playable meter responds the same day:

| Event (real, counted only if `realProgress` on) | Track | Counts for | Size (points toward target) |
|---|---|---|---|
| Let go when advised, noticed only after | day | A | 0.5 |
| Toilet on schedule, urgency ≤ 4 | day | B | 0.5 |
| Urge surf succeeded | day | B | 0.5 |
| Woke to pee, stayed dry | night | B | 1.0 |
| Slept through a wet (§10, case S1) | night | A | 1.0 |
| Stayed in bed and let go when awake (S4) | night | A | 0.5 |

Drift sign is always **toward the track's target** for behaviours matching the direction, and 0 for behaviours that don't match. Nothing ever moves a track *away* from its target as a punishment.

---

## 6. Conditioning model

### 6.1 The building blocks (both directions)
Habits form from **cue → behaviour → reward**, repeated on a **schedule**, then kept going with **streaks** and occasional **surprise rewards**. The app already has most of the parts.

| Block | What it means here | Existing hook |
|---|---|---|
| **Cue** | Something consistent that starts the behaviour: a time of day, a notification sound, the app skin, a bedtime song or phrase, putting on gear, the DryClip "armed" chime | `native-notify.js`, `bs_play_prefs_v1.theme`, `dryclip.js` arm |
| **Behaviour** | The one thing practised (Direction A: use gear first; Direction B: a timed toilet trip) | `simple-urge.js`, `natural-night.js`, `accident.js` |
| **Reward** | Stars, a stamp on the calendar, caregiver praise copy, a streak tick | new `bs_stars_v1`, `calendar.js`, `path-play.js` caregiver lines |
| **Schedule** | Fixed at first (every trip / every night), then variable (some trips, random bonus) to make the habit stick | new objective generator (§11.4) |
| **Streak** | Days in a row of doing the routine — not of being dry or wet | `calendar.js` |
| **Variable reward** | A surprise "golden star" on about 1 in 5 completed routines; a mystery card on a streak day | new `cards.js` |
| **Reflection** | A short daily journal line and a weekly recap card | new `journal.js`, `potty-report.js` |

**Scoring rule:** about 70% of stars come from *follow-through* (did the routine, logged honestly), and about 30% from *outcomes* that match the chosen direction. Outcomes move the **estimate** (§4.5); follow-through moves the **stars**. This keeps it motivating without punishing the player for what their body does.

### 6.2 Direction A — less control / bedwetting habits
Goal: the habits of someone who relies on protection. Gear is the default response to an urge, nights are relaxed and stay in bed, awareness is low-key, and there is a strong little headspace. No holding, no straining, no fluid loading.

| # | Mechanic | How it plays | Hooks into | Effort |
|---|---|---|---|---|
| A1 | **Gear-first habit** | During an "A session" window (player-set, e.g. evenings at home), the first response to an urge is "use your gear" at a chosen rate (starts at 1 in 3, rises with the chapter). Pressing "I need to go" during the window rolls from the A-tuned `LADDER` odds. A real "I need the toilet" button always exists, costs nothing, and is logged neutrally. | `simple-urge.js` roll, `control.js` LADDER | S |
| A2 | **Let it happen early** | Replaces "hold till hard" in A mode: "when you first notice it, let your gear do the work". This is the opposite of holding, so there is no retention risk. | `simple-urge.js` L257 copy, `urge-matrix.js` | S |
| A3 | **Relaxed night routine** | A bedtime checklist: gear on, bed-drinks suggestion (capped by `bed-drinks.js` / `safety.js`), *pee before bed* (kept — it lowers UTI risk and isn't needed for wetting), a calm cue (song, story, skin), lights out. Each finished step earns a stamp. | `natural-night.js` bedtime card, `bed-drinks.js` | S |
| A4 | **Stay-in-bed night practice** | When the player wakes needing to go, Natural Night offers "stay cozy — let your gear handle it" (already the `stay` roll, `natural-night.js` L46-54). In A mode the stay chance follows the night band. Pain, discomfort or a strong urge that won't settle → "get up, that's fine" (always shown). | `natural-night.js` roll / panel L237 | S |
| A5 | **DryClip silent nights** | The clip logs wet times silently (night mode already does). In the morning the player gets a "night story" card: wet time, hours after bedtime, hours since the last pee. A wet morning that the player confirms counts for A — but only if "real progress" is on (§11.3). | `dryclip.js`, `clip-bridge.js`, `calendar.js` | M |
| A6 | **Headspace cues** | One consistent cue set per player (skin, a phrase, a soothing sound) used at the start of every A session and bedtime. It builds the association "this cue = little time = gear is fine". A cue editor lives in Settings. | `bs_play_prefs_v1.theme`, `native-notify.js` | S |
| A7 | **Little Days / Little Weekends** | A bounded block (a day or Fri–Sun) with A rules on: hidden waits, little wording, a change budget, a caregiver card. It ends automatically at bedtime or Sunday night with a recap. Objectives can ask for 1 Little Day per week at higher chapters. | `campaign.js` / new `infinite.js`, `change-roll.js` | M |
| A8 | **Awareness softening (light)** | Fewer warning prompts and hidden waits at lower bands (already `hidden` in LADDER, Quiet Signals). In A mode the app stops asking "do you need to go?" on a timer and only reacts when the player presses. No tricks or distractions meant to block signals the player wants to notice. | `control.js` LADDER `hidden`, `simple-urge.js` | S |
| A9 | **Change rhythm** | Changes on the caregiver schedule or a threshold (existing "May I change?"), with a hard skin-safety cap (max hours worn) that always overrides. | `change-roll.js` | S |

### 6.3 Direction B — more control / dryness
Goal: longer, calmer intervals, good urge handling, dry nights. These are standard approaches (bladder diary, timed voiding, urge suppression, pelvic floor training, alarm therapy), turned into a game.

| # | Mechanic | How it plays | Hooks into | Effort |
|---|---|---|---|---|
| B1 | **Bladder diary** | 3-day log (simple or detailed): drinks, toilet trips, urgency 0–10, leaks, night wets. Produces a baseline: median daytime interval, trips per day, leaks per day, night wet rate. Stars for logging, not for the numbers. | `calendar.js`, new `diary.js`, `potty-report.js` | M |
| B2 | **Timed voiding ladder** | Scheduled toilet prompts at the baseline interval (e.g. 90 min). After 5 of 7 days on schedule with few leaks, the interval grows by 15 min. Hard ceiling of 4 h awake; the floor never goes below baseline. Going early is allowed and logged without penalty. | `native-notify.js`, `control.js` (new `scheduled_void` drift) | M |
| B3 | **Urge surf** | When an urge hits before the scheduled time: stop, sit or stand still, breathe slowly, do 5 quick pelvic floor squeezes, wait for the wave to ease (about 1 min), then walk calmly to the toilet *or* wait to the schedule if it's close. If it doesn't ease, go — no hold-to-failure. Replaces "hold till hard" in B mode. | `simple-urge.js`, `guide.js` | S |
| B4 | **Pelvic floor coach** | Correct technique: squeeze and lift for 3–5 s, fully relax for the same time, 10 reps, 3 sets a day. Plus 10 quick flicks. Progress to 8–10 s holds over weeks. Don't do it while peeing, and don't hold your breath. Streak calendar. Replaces the "MAX / CLENCH EVERYTHING" guides (§14.4). | `tables.js` kegel set, `guide.js` | S |
| B5 | **Dry-night alarm program** | DryClip as a bedwetting alarm: alarm mode wakes the player at the first wet so they can finish on the toilet. Evening routine: taper fluids over the last 2 h (bed-drinks low tiers), pee twice before bed (once at routine start, once at lights out). The dry-night streak ladder (catalogue #73) uses "reward the attempt" scoring: getting up when the alarm fires earns stars even on a wet night. | `dryclip.js`, `natural-night.js`, `bed-drinks.js` | M |
| B6 | **Big Kid Test (weekly boss)** | One day per week: hit every scheduled trip with no leaks. A pass gives +3 Control and a badge; a fail costs nothing. | `campaign.js` / `infinite.js`, `board.js` | S |
| B7 | **Out-and-about confidence** | Trips out on schedule with lighter gear as the band rises; spares are still suggested. | `REVIEW-v2` §5 kit, `simple-urge.js` inventory | M |

### 6.4 Caregiver / partner role (both directions)
- **Caregiver mode** already exists as copy (`path-play.js` `caregiverOn()` L57, `change-roll.js` L116/170, `clip-bridge.js` L24). Extend it into a role:
  - **Sets the weekly card** (picks 1 of 3 generated objectives, or swaps one).
  - **Grants changes and "May I?"** from a partner screen (same phone first; later a shared code / QR export of today's log).
  - **Praise lines** tied to follow-through ("you did your whole bedtime routine").
  - **Can't override safety:** the player's reverse button, symptom pause and real-urge button always win, and the caregiver can't turn off drink caps.
- **Consent for two:** if caregiver mode is on, the consent screen asks the player to confirm the partner knows the direction and the reverse button.
- Effort: same-phone role is M; shared/remote is L.

---

### 6.5 Track-specific notes
- **Night-only players** get A3/A4/A5 (A) or B5 (B) as their core, plus check-ins focused on night metrics. Day objectives are limited to logging.
- **Day-only players** get A1/A2/A6/A8 (A) or B1–B4/B7 (B). Nights are logged in check-ins for context but generate no objectives.
- **Both:** the generator balances objectives across tracks in proportion to each track's gap (§11.5).

### 6.6 Training-methods catalogue (v45)

Each method is an opt-in on the intake quiz, with a one-line explanation. Defaults are checked from the goals in §13.1. The player can turn any of them off. A method plays as a short daily task and as a session prompt. Logging it is the score. It does not move the track level. The level moves one step only after two check-ins in a row sit in the next band toward the goal.

**Relaxed release** is passive. No holding back and no pushing. The player relaxes and lets it happen when it happens. It is not overflow and it is not stretching.

| Id | Track | Dir | How it plays | How it scores |
| --- | --- | --- | --- | --- |
| `first_urge` | Day | A | Go at the first urge. Do not wait it out. | A logged trip is practice. One trip does not move the level. |
| `relaxed` | Day | A | When it starts, soften and let it happen. Do not push and do not hold it back. | Logged as a passive release. |
| `positions` | Day | A | Let a release happen while sitting, standing, or lying down. | The position is stored with the log. |
| `cue` | Day | A | The same phrase or breath, then release. | The cue counts when it is logged with the release. |
| `no_toilet` | Day | A | A block of time with no toilet, in the gear chosen for that place. A real need ends the block. | Finishing the block is the log. Leaving for a real need is not a miss. |
| `reverse_kegel` | Day | A | Breathe out and let the pelvic floor drop for a few seconds, then rest. No clench. | A set is logged. A maximal hold is not the exercise. |
| `stay_bed` | Night | A | On a wake, stay in bed. Getting up for a real need is fine. | Staying is logged. A real-need get-up does not count against the streak. |
| `before_awake` | Night | A | Let a release happen before fully sitting up. | A wet with no full wake scores higher for Night A than waking to change. |
| `lying` | Night | A | A release while lying down. No pushing. | Logged as a lying-down drill. |
| `bedtime_cue` | Night | A | The same short routine at the same time: gear, cue, lights out. | Doing the routine counts, even if the night is dry. |
| `deeper_sleep` | Night | A | Same bedtime, dark room, no late screen. | A deep-sleep wet with no wake (DryClip, no wake) scores higher for Night A than a wake-and-change. `sSl` ≤ 20 is 3 points; a wake (`sSl` ≥ 70) is 1. |
| `timed_void` | Day, night | B | Go at the planned time, even if the urge is small. | A planned trip is logged. |
| `urge_surf` | Day, night | B | Notice the wave, let the peak ease, then go. Stop if it gets strong. | Finishing a surf is logged. Stopping because it got strong still counts. |
| `kegels` | Day, night | B | Gentle 3–5 second squeeze, then a full relax. | A set with a full relax is logged. |
| `double_void` | Day | B | Go, wait a few breaths, go again. | Logged when the second void happens. |
| `alarm` | Night | B | DryClip alarm mode. A wet is meant to wake you. | A wake-and-change is the result this mode is for. |
| `front_load` | Day | B | More of the day's drinks earlier. Late prompts stay a sip, and only if thirsty. | Still goes through `BSSafety.capDrink` (≤ 250 ml, ≤ 1 L/day). A missed drink day stays blank. |

Habit shape around the catalogue:

- Cues stay at the same times (morning 08:00, midday 13:00 on steady/intense, bedtime 22:00).
- Intensity picks how many tasks show: gentle 1, steady 2, intense 3 per track, and how many successful days raise the task one stage (5 / 4 / 3). A stage has three lines, and it only gets harder after that streak.
- Logging a task gives an immediate line ("Logged… Streak N").
- One missed day keeps the streak (a single shield). A second miss starts the streak again.
- The weekly review is written at the check-in.

---

## 7. Gear ladder and generalisation across protection

### 7.1 The problem
Habits are tied to the situation they were learned in. Thick protection is a strong cue ("it's safe to let go"), so a player may wet the bed easily in a thick diaper but stay dry in a thin pull-up or underwear. The user wants the trained behaviour to work in **any** gear. The same applies in reverse for Direction B: staying dry in a diaper (where an accident doesn't matter) is easier than in underwear (where it does), or the opposite for some people.

The fix is standard habit-transfer design: **keep the cue and routine the same while the gear changes, step through the gear gradually, mix gear levels during the transition, and measure success per gear.**

### 7.2 The gear ladder
| Step | Gear | Rough holding capacity (game reference) | Day use | Night use | Bed / clothing protection advised |
|---|---|---|---|---|---|
| G0 | Thick diaper (+ booster optional) | 1500+ ml | home | yes | mattress protector |
| G1 | Diaper | ~1000 ml | home / out (discreet if fits) | yes | mattress protector |
| G2 | Thin diaper / overnight pull-up | ~600 ml | home / office | yes | mattress protector + washable bed pad |
| G3 | Pull-up | ~400 ml (one medium wet) | home / office / out | yes | mattress protector + washable bed pad. Baseline: not fully dry (for example pull-ups at work). Heavier than a pad. |
| G4 | Pad / liner | ~80–200 ml (a leak, not a full void) | home / office / out | light nights | backup for someone who mostly manages. This is the pad stage. |
| G5 | Training pants (padded cotton) | ~50–100 ml (drops, small leak) | home | yes, with bed protection | waterproof mattress protector + washable underpad / disposable bed mat; waterproof seat pad for chairs |
| G6 | Underwear | ~0 ml | home only for A wetting | yes, with bed protection | as G5, plus spare sheets, towel layer, a second protector so the bed can be re-made at night |

Ids G0–G3 are unchanged from revision 2. G4 is the new pad/liner step. Training pants and underwear move to G5 and G6. Older sentences in this doc that say "G4 training pants" or "G5 underwear" mean G5 and G6 after this revision.

**Recommended gear (from the baseline, not from a guess).** `BSGear.recommend(baseline)` reads the calibration profile: typical and max voided volume, daytime interval and frequency, urgency, warning, leak rate and size, and night dry-rate / wets / wet size. It returns a day step and a night step.

| What the baseline looks like | Day step | Night step |
|---|---|---|
| Rare or no leaks, long warning, comfortable interval | G6 underwear | G6 if nights are dry, else from the night row |
| Leaks a pad can handle, warning still usable | G4 pad / liner | pad or underwear with bed protection if nights are nearly dry |
| Not fully dry: short warning, leaks most days, or pull-ups are what actually work (including at work) | G3 pull-up | overnight step if nights are wet |
| Regular full wets, very short warning | G1 diaper | G1 or G0 |
| Wet most nights, large wets | (day from the day row) | G0 thick diaper |
| Some wet nights, not every night | (day from the day row) | G2 thin diaper / overnight pull-up |

Check-ins replace quiz-only numbers as soon as they exist. What the player said they usually wear (`protDay` / `protNight`) is only the fallback when a metric is missing. The advisor and pass requests use the recommended step as the assumed gear. If inventory says they are wearing a lighter or heavier step, the card says so in one line and the pass weights shift (lighter than recommended: fewer plain grants; heavier: the warning only).

- Capacities are **rough game references** (brands differ a lot). The player can set their own per item in `bs_gear_v1` and the advisor uses the player's number.
- **Bed protection items** (separate from worn gear): waterproof mattress protector (always advised from G2 down), washable bed pad / underpad, disposable chux mats, waterproof duvet cover. Logged as `bedProtection` on night entries.
- **Clothing for G4/G5 day practice (A):** home only; dark, loose clothing; a waterproof seat pad on the chair or sofa; towel nearby; a change of clothes set out. The advisor never advises letting go in G4/G5 outside the home (§8.4).

### 7.3 Per-gear stats
For each track and gear step `g`, the app keeps (rolling 30 days):

| Stat | Direction A meaning | Direction B meaning |
|---|---|---|
| `opp[g]` — opportunities (urges / nights in that gear) | | |
| `letGo[g]` — let-go rate: lets-go ÷ opportunities | main A success stat | (accident rate) |
| `dry[g]` — dry rate: on-time toilet ÷ opportunities (day), dry nights ÷ nights (night) | | main B success stat |
| `sleepThrough[g]` — night wets slept through ÷ night wets | A night quality | |
| `size[g]` — mean wet size | | |
| `ready[g]` — "could you let go when told" yes rate | A readiness | |

**Generalisation ratio (A):** `GR[g] = letGo[g] / letGo[G_home]`, where `G_home` is the gear the player lets go in most easily (usually G0). `GR = 1` means the behaviour works as well in that gear as in the "safe" one.

**Generalisation ratio (B):** `GRb[g] = dry[g] / dry[G_best]`.

### 7.4 Graduated exposure
The player has a **gear position** per track (`pos.day`, `pos.night`) = the thinnest gear currently being trained. The gear plan for a week mixes the current position with the next-thicker one:

| Stage | Mix (nights or day-blocks per week) | Move on when |
|---|---|---|
| 1 — Anchor | 100% `G_home` (e.g. thick) | let-go rate ≥ 60% over ≥ 5 opportunities |
| 2 — Introduce | 1 in 4 at next step thinner, rest `G_home` | `GR` at the new step ≥ 0.5 over ≥ 3 opportunities |
| 3 — Mix | 1 in 2 thinner | `GR` ≥ 0.7 over ≥ 5 |
| 4 — Mostly | 3 in 4 thinner, 1 in 4 anchor | `GR` ≥ 0.8 over ≥ 5 |
| 5 — Transferred | 100% thinner; anchor gear only on request | → start stage 2 at the next step |

- **Step back** if `GR` falls below 0.4 over 5 opportunities: return one stage. No penalty, and stars for "honest log" still count.
- **Night-first or day-first:** the player picks which track runs the ladder first; the other track stays at its current gear.
- **Direction B** runs the same ladder: stages move to thinner gear when `dry[g]` holds up (e.g. ≥ 80% dry nights in pull-ups for 2 weeks → introduce training pants nights). This matches the existing wear recommendations (`potty-report.js`).

```
function gearPlanForWeek(track):
  g = track.pos; next = thinner(g); st = track.stage
  share = {1: 0, 2: 0.25, 3: 0.5, 4: 0.75, 5: 1}[st]
  slots = track === 'night' ? nightsThisWeek() : dayBlocksThisWeek()     // day block = an A/B session window
  plan = slots.map((s, i) => ({ slot: s, gear: spread(i, slots.length, share) ? next : g }))
  return enforceSupplies(plan, bs_inventory_v1)     // never plans gear the player doesn't own
```

### 7.5 Fading the "thick gear" cue
The thick-gear feeling is a cue. To move the behaviour to thinner gear, other cues take over:
1. **Keep the routine identical across gear.** Same bedtime checklist (A3), same headspace cue (A6: skin, phrase, sound), same lights-out time, same pillow or plushie. Only the gear changes.
2. **Add a portable cue** that doesn't depend on gear: a short audio cue or phrase at the start of an A session / bedtime, and the DryClip "armed" chime at night. These are present in every gear.
3. **Bulk-feel bridge (optional):** for the first transition nights, a thin gear plus a booster pad, then without the booster. Stage 2 → 3.
4. **Bed protection as the new "safe" signal:** from G3 down, making the bed with the protector + pad becomes part of the bedtime routine, so "the bed is ready" replaces "I'm in thick gear".
5. **Fade the anchor:** stage 4 keeps one anchor night per week as a confidence night; stage 5 drops it.

### 7.6 Gear-specific objectives (examples)
| id | Track | Dir | Text |
|---|---|---|---|
| `gear_night_mix_n` | night | A/B | Sleep N nights in your training gear (this week's plan) |
| `gear_letgo_thin_n` | day | A | Let go N times in your training gear (home or allowed contexts) |
| `gear_sleepthrough_thin` | night | A | Sleep through one wet in your training gear |
| `bed_ready_n` | night | any | Make the bed ready (protector + pad) on N nights in G3 or thinner |
| `gear_dry_thin_n` | day | B | Stay dry N waking blocks in your training gear |
| `gear_dry_nights_thin_n` | night | B | N dry nights in your training gear |
| `cue_same_n` | any | any | Use your cue routine on N nights / sessions in your training gear |

### 7.7 Practical protection checklist (shown when moving to G3–G5)
- Waterproof mattress protector (fitted, not just a sheet).
- Washable bed pad / underpad on top, or disposable chux; a second set for night changes.
- Spare sheets and pyjamas next to the bed; laundry bag.
- Skin: change wet underwear or training pants promptly when awake; rinse and dry skin; barrier cream if skin gets sore. The skin cap (max hours worn) applies to every gear, including underwear in a wet bed — the morning check-in prompts a shower/rinse.
- Day (A, home): waterproof seat pad, towel, dark loose clothes, change of clothes ready.

---

## 8. The "I need to go" advisor

### 8.1 What it is
One big button, available all the time (Urge tab, home screen widget later, and a quick-tile). The player taps **I need to go**, answers one slider (urgency 0–10), and gets one clear answer in under 2 seconds. Office/discreet mode shows neutral wording and colours only.

### 8.2 Inputs
| Input | Source | Notes |
|---|---|---|
| `u` urgency 0–10 | asked every tap (required) | the app never guesses |
| `track` | `trackFor(now, context)` | |
| `gear` and `sat` | `bs_inventory_v1.wearing` + last reported saturation | one tap to change gear if it's wrong |
| `capRem` | `cap(gear) × (1 − sat/100)` | ml, from `bs_gear_v1` |
| `context` | chip: home / office / out / car / bed | remembered until changed; quick-switch chips |
| `discreet` | auto on for office / out / car; manual toggle | neutral wording |
| `T`, `E` | track target and estimate | `dir = sign(T − E)` |
| `trainBand` | `BSControl.trainingBand(track)` | band one step past `E` toward `T` |
| `tsv` | minutes since last logged void | |
| `intake2h` | ml logged in the last 2 h | context only |
| `Vexp` | expected volume now (below) | capacity check |
| `passes`, `debt` | `bs_passes_v1` | §9 |
| `sched` | next scheduled trip (B timed voiding) | |
| `paused` | `bs_symptom_v1.paused` | |
| `bedProt` | bed protection in place (night) | |

**Expected volume now** (only for the capacity check; shown as "rough"):
```
Vexp = clamp( V · (tsv / I) + 0.5 · intake2h · min(1, tsv/90), 50, Vmax )    // V, I, Vmax from §4.3; defaults 300 ml, 120 min, 500 ml
```

### 8.3 Decision algorithm
```
function advise(inp):
  // 0. Hard overrides
  if inp.realEmergency:                 return GO('Real need — go now.', log='real_override', cost=0)
  if inp.paused:                        return GO('Toilet whenever you need (paused).')
  if inp.u >= 9 and dirOf(inp) === 'B': return GO('Go now.')
  if inp.tsv >= 300:                    return GO('It has been 5 h — go now.')        // no long holds in any direction

  // 1. Base weights from the training band (existing LADDER odds, go/wait/hard/dribble/gear)
  w = { go, wait, gear, pass } from LADDER[inp.trainBand].odds  // 'hard' folded into wait; 'dribble' into gear(partial)
  w.pass = 0                                                   // passes are offered, not rolled (step 5)

  // 2. Direction & schedule
  if dir === 'B':
     if sched and |now − sched| <= 10 min:      w.go ×= 3
     if sched and now < sched − 10 min:         w.wait ×= 1.5          // urge surf, then wait to schedule
     w.gear ×= 0.2                                                     // B rarely says "use protection"
  if dir === 'A':
     w.gear ×= 1 + (inp.E − inp.T) / 50                                // bigger gap → more gear answers
     w.go   ×= max(0.5, 1 − 0.05 · inp.debt)                          // debt lowers go odds (cap 0.5×)

  // 3. Urgency
  if inp.u >= 8:  w.wait = 0                                          // never "wait" at 8+
  else if inp.u >= 6: w.wait ×= 0.5
  if inp.u <= 3:  w.go ×= 0.7; w.wait ×= 1.3

  // 4. Gear capacity & context
  fits = inp.capRem >= inp.Vexp
  part = inp.capRem >= 0.15 · inp.Vexp
  allowedGear = gearAllowed(inp.gear, inp.context, inp.track, inp.bedProt)   // table §8.4
  if not allowedGear:           w.gear = 0
  else if not fits:             w.gear = part ? w.gear · 0.6 : 0            // partial possible → handled as a pass-style condition
  if inp.context === 'car':     maxWait = 15
  if inp.track === 'night' and dir === 'A' and allowedGear:  w.gear ×= 1.5   // stay in bed (§6.2 A4)

  // 4b. Partial release — its own outcome, same roll (revision 3)
  // Weight is 0 when conditioning is off, urgency is 9+, the symptom pause is on,
  // or today's count has reached the player's cap (setting, default 4).
  w.partial = partialWeight(inp)   // scales up with gap toward less control, and with debt
  // pct = partialPct(inp): about 6% (direction B) .. 12–30% (direction A, gap, debt). Cap 30%.

  // 5. Roll
  outcome = weightedPick(w)
  if outcome === 'gear' and not fits:  outcome = 'partial'                 // capacity can't take a full release
  if outcome === 'partial':
     plan = { pct: partialPct(inp), finishOnToilet: settings.finishOnToilet }  // default true; never forced
     return PARTIAL(plan)   // copy mentions the toilet only when the setting is on
  if outcome === 'wait':
     n = clamp(round(rand(LADDER[trainBand].wait) · (1 − inp.u/12)), 2, maxWait ?? 20)
     return WAIT(n, then='ask again', surf = dir === 'B')
  if outcome === 'go':     return GO()
  if outcome === 'gear':   return GEAR(fullRelease = true)
  if outcome === 'partial':return GEAR(fraction = partialFraction(inp), then='toilet')

  // 6. Pass offer (shown under every non-GO answer when the player has passes)
  attach PASS_OFFER(condition = passCondition(inp)) if inp.passes > 0     // §9.3
```

**Weights at a glance** (multipliers applied on top of the band odds):
| Factor | go | wait | gear |
|---|---|---|---|
| B, near scheduled time (±10 min) | ×3 | | ×0.2 |
| B, well before schedule | | ×1.5 | ×0.2 |
| A, gap `E − T` (e.g. 30 points) | ×(1 − 0.05·debt), floor 0.5 | | ×1.6 |
| Urgency ≥ 8 | | 0 | |
| Urgency 6–7 | | ×0.5 | |
| Urgency ≤ 3 | ×0.7 | ×1.3 | |
| Gear not allowed in context | | | 0 |
| Gear can't hold expected volume | | | ×0.6 (→ partial) or 0 |
| Night, A, gear allowed | | | ×1.5 |
| Car | | max 15 min | diapers or thicker only |

### 8.4 Context and gear rules (`gearAllowed`)
| Context | Discreet | G0–G1 | G2–G3 | G4 training pants | G5 underwear |
|---|---|---|---|---|---|
| Home | off | full | full | full (seat pad advised) | full if home prep is set up (seat pad / towel), else no |
| Bed | off | full | full | full if bed protection on | full if bed protection on |
| Office | on | full if fits | full if fits, else partial ≤ 50% of capRem | drops only, or no | **no** |
| Out (shops, walk) | on | full if fits | partial ≤ 50% of capRem | no | no |
| Car | on | full if fits, waits ≤ 15 min | partial ≤ 50% of capRem | no | no |

"No" means the advisor answers toilet or wait (≤ 20 min, never at urgency 8+) or offers a pass — never "let go". This keeps public situations contained and discreet.

### 8.5 Answer cards (copy, normal / discreet)
| Outcome | Normal copy (little voice optional) | Discreet copy |
|---|---|---|
| GO | "Potty time — go now." | "Go ahead." |
| GEAR (full) | "Use your pull-up this time — let it all go." | "Use your protection." |
| PARTIAL | "Let about 15% go into your pull-up." If the toilet setting is on, add "Then empty on the toilet." The percent is the scaled one, not always 15. | "Partial." |
| WAIT n | "Wait 8 minutes, then ask again." (B: "Surf the urge, then wait 8 min.") | "Check again in 8 min." |
| PASS offer | "Want a Potty Pass? (2 left) — condition: …" | "Pass available." |
| Real need | "Real need — go now. No cost." | "Go ahead." |

Every card also shows: **[I'm going anyway — real need]** (free), **[Done]**, and after the action **[Log result]** (made it / let go / partial / leaked / couldn't let go).

---

## 9. Potty Pass economy and debt

### 9.1 What a pass is
A **Potty Pass** is a request for better odds of a toilet trip when the roll said wait, use protection, or partial. It does **not** guarantee the toilet. `requestPass(inp)` weights three answers:

| Answer | What it means |
|---|---|
| **Denied** | The request doesn't land. Use your protection, or a short wait (never a wait at urgency 8+). |
| **Granted** | Better odds paid off: go to the toilet. |
| **Compromise** | Granted with a catch. Either let about N% go into current gear first (`partial_first`), or head to the toilet knowing the walk may not fully make it (`walk_risk`). |

N and the three weights come from direction, target vs estimate, debt, gear vs the recommended step, and context. Lighter than recommended shifts weight toward denied and compromise. Heavier than recommended only adds the one-line gear warning.

`finishOnToilet` (default **on**, `bs_partial_v1`) changes the compromise copy: when on, `partial_first` includes "then empty on the toilet". When off, that sentence is left out. The settings screen says, once: "Emptying fully helps avoid retention and UTIs." The player can turn it off. Nothing in the roll checks whether they did it. Logging "emptied" or "didn't" is data, not a penalty.

In Direction B, going is already the common roll, so passes mostly matter for skipping a wait. Debt in B still comes from skipping scheduled trips.

Separate from passes, the **Real need / health** button is always free, never adds debt, never breaks a streak, and logs `real_override`.

### 9.2 Earning and cost
| | Direction A track | Direction B track |
|---|---|---|
| **Weekly allowance** (refills Monday) | `round(1 + E/25)` → E 80 ≈ 4, E 40 ≈ 3, E 10 ≈ 1 | unlimited "go" (no pass needed when advisor says go); 5 "skip the wait" passes |
| **Extra passes** | +1 per 10 stars (shop), +1 for a 7-day routine streak, +1 caregiver gift | +1 per 7-day schedule streak |
| **Max held** | 6 | 8 |
| **Cost** | 1 pass + the condition | 1 pass |
| **Free pass** | the first pass after a symptom pause ends; the first pass on a rest day | — |

### 9.3 Pass conditions (Direction A)
When the player spends a pass, the app draws one condition, scaled to gear, context and band. Partial release is the main one.

```
function passCondition(inp):
  if not gearAllowed(inp.gear, inp.context, inp.track) or inp.u >= 9:
     return NONE                                            // just go
  base  = { okay: 0.10, shaky: 0.15, little: 0.20, none: 0.25, good: 0.05, full: 0 }[inp.trainBand]
  gearF = { G0: 1.2, G1: 1.0, G2: 0.9, G3: 0.8, G4: 0.3, G5: 0.1 }[inp.gear]     // G4/G5: a few drops at most
  ctxF  = { home: 1.0, bed: 1.0, office: 0.6, out: 0.5, car: 0.5 }[inp.context]
  debtF = 1 + 0.1 · max(0, inp.debt − 2)                                       // stricter when in debt (§9.5)
  p     = min(0.30, base · gearF · ctxF · debtF)
  ml    = min(p · inp.Vexp, 0.5 · inp.capRem)                                   // never more than half what the gear can still hold
  if ml < 20: return pickOther(['wait_short', 'sit_first', 'none'])
  return PARTIAL(p = ml / inp.Vexp, ml)                                        // "Let about 15% go, then the toilet"
```

| Condition | When | Copy (normal / discreet) |
|---|---|---|
| **Partial first** | most passes | "Let about 15% go into your pull-up, then go to the toilet." / "Partial, then go." |
| **Short wait first** | gear can't take a partial | "Wait 5 minutes, then go." (never at urgency 8+) |
| **Sit-first** | home, B or low gap | "Sit on the toilet a minute before you start." |
| **Change after** | A, gear already wet | "Go, but stay in your wet pull-up until the next check-in (skin cap applies)." |
| **Star fee** | debt ≤ 1, any context | "Costs 2 stars instead." |
| **None** | urgency 9+, gear not allowed, pause | "Go now." |

**Partial-release guardrails** (built in, shown once in the onboarding tips):
- One stop-start per void at most. Finishing on the toilet is the `finishOnToilet` setting (default on), not a rule the app enforces.
- If stopping is hard, painful, or the stream won't restart easily, just finish in the gear or the toilet; log "couldn't stop" (no penalty).
- Partial releases stop being offered after the player's daily cap (default **4**, a setting). Later rolls that day use the other outcomes.
- Frequent stop-start voiding can lead to poor emptying for some people; if hesitancy or a "not empty" feeling appears, the symptom watch (§5.2) takes over.

### 9.4 Debt (Direction A)
**What adds debt**
| Event | Debt |
|---|---|
| Any pass spent while debt is already ≥ 3 | +0.5 |
| Pass used within 60 min of the previous pass | +1.0 |
| Pass used while advisor said GEAR and gear could hold it | +0.5 |
| 3rd+ pass in one day | +1.0 each |
| Condition declined after spending the pass ("I just went") | +0.5 |
| Debt-drink prompt skipped (§9.5) | +0.5 (max once per day) |

**What removes debt**
| Event | Debt |
|---|---|
| Daily decay | `D ×= 0.85` at day roll-over |
| A routine completed (night routine, cue session) | −0.5 |
| Followed a GEAR answer without a pass | −0.25 (max −1/day) |
| Night case S1 slept through (§10) | −1.0 |
| Rest day | frozen (no decay, no growth) |
| Symptom pause | frozen |
| Direction reversed or conditioning stopped | reset to 0 |

`D` is capped at **10**.

### 9.5 Backfires (Direction A) and their caps
Backfires kick in at debt thresholds and are applied at most once per type per day.

| Debt | Backfire | Exact rule | Hard cap |
|---|---|---|---|
| ≥ 2 | **Lower odds next ask** | advisor `w.go ×= 1 − 0.05·D` | floor 0.5× |
| ≥ 3 | **Stricter next pass** | partial `p` +10% per point above 2 (via `debtF`) | `p` ≤ 30%, ≤ 50% of capRem |
| ≥ 4 | **Afternoon drink prompt** | one prompt of 150–250 ml between 13:00 and 17:00, sent through `BSSafety.capDrink(ml, {commit:true, src:'debt'})` | **≤ 250 ml per prompt, ≤ 1 L/day from all prompts, ≥ 2 h apart** (safety.js); max 1 debt drink per day and 3 per week; never within 3 h of bedtime; skipped if the cap check fails, if paused, or if the player has logged ≥ 2.5 L that day; "not thirsty / skip" always available |
| ≥ 5 | **Heavier night rules (night track)** | tonight: stay-in-bed odds +10%, change threshold +10 (May I change?), night gear plan uses the thinner slot | skin cap and leak-through change always override; one night per backfire |
| ≥ 7 | **Pass lockout (short)** | passes cost 2 for the next 24 h | real need button unaffected |

**Never touched by debt:** real need override, symptom pause, skin cap, drink caps, toilet at urgency 9+ in any direction, the 5-hour max hold.

### 9.6 Debt (Direction B)
| Adds debt | Debt | Removes debt | Debt |
|---|---|---|---|
| Skipped a scheduled trip (no void within 20 min of the time) | +1.0 | Daily decay | `×0.8` |
| Late > 20 min | +0.5 | On-time trip | −0.25 |
| Ignored the night alarm (S7) | +0.5 | Urge surf done | −0.25 |

| Debt | Backfire (B) | Cap |
|---|---|---|
| ≥ 2 | interval ladder step held back this week | — |
| ≥ 3 | one extra urge-surf or pelvic-floor objective tomorrow | max 1/day |
| ≥ 5 | stars ×0.8 for 2 days | — |

No drink backfires in Direction B (an "even sips" tip may show instead: spread drinks across the day).

### 9.7 Pass log and display
- **Pass chip** on the Urge tab: "🎟 3 passes · debt 1.4".
- **Debt meter** (A): green < 2, amber 2–4, orange 4–7, red ≥ 7, with the active backfires listed and when they wear off ("debt halves in about 4 days").
- Every pass, condition and backfire is a calendar entry (`type:'pass'` / `'backfire'`) so the player can see the story.

---

## 10. Night scoring with DryClip timing

### 10.1 Signals
| Signal | Source | Notes |
|---|---|---|
| `wetAt` | DryClip event: `now − secsSinceWet` (native queue, `dryclip.js` header) | ±60 s dedupe already exists |
| Phone activity | new `bs_phone_wake_v1`: app resume / screen-on timestamps (Capacitor `App` `appStateChange` + a native screen-on broadcast in the BladderAlarm/DryClip service) | only while Natural Night or night track session is active |
| Wake log | Natural Night `wake()` / `sleep()` / `rise()` timeline (`natural-night.js`) | explicit taps |
| Change log | `BSChange` / inventory change entries | |
| Toilet log | Natural Night `confirmPee()` / advisor GO logged at night | |
| Alarm | DryClip alarm-mode fire time (B) | new |
| Clip disarm / re-arm | DryClip state changes | a disarm soon after `wetAt` = awake |
| Morning answers | check-in: "Did you wake when it happened?" yes / no / not sure | fallback when no phone signal |

### 10.2 Classification
For each confirmed night wet (and each night without wets):
```
function classifyNightEvent(wet, tl):   // tl = merged timeline of phone, wake, change, toilet, alarm, disarm
  A0 = wet.wetAt
  awakeBefore = any(tl, t in [A0 − 10m, A0 − 1m] of kind wake|phone)
  awakeAfter  = first(tl, t in [A0, A0 + 30m] of kind wake|phone|disarm)
  changed     = any(tl, t in [A0, A0 + 60m] of kind change)
  toilet      = any(tl, t in [A0 − 2m, A0 + 15m] of kind pee)
  alarm       = any(tl, t in [A0, A0 + 2m] of kind alarm)
  if alarm and awakeAfter and awakeAfter − A0 <= 5m and toilet:  return 'S6'  // alarm wake, finished in toilet
  if alarm and not awakeAfter:                                     return 'S7'  // slept through alarm
  if awakeBefore and not toilet:                                   return 'S4'  // awake in bed, let go
  if not awakeAfter:                                               return 'S1'  // slept through
  if changed:                                                      return 'S2'  // woke, changed, back to sleep
  return 'S3'                                                                    // woke, no change, back to sleep
// nights with no wet:
//   S5 = woke with urge, toilet, dry;  S8 = dry, no wakes;  S9 = dry, woke and got up to pee (same as S5, logged at wake)
```
**Uncertain cases:** if there are no phone/wake signals at all (phone off, no clip), the morning answer decides: "No, I slept through" → S1; "Yes, and changed" → S2; "Yes, didn't change" → S3; "Not sure" → S1 at half points. The night story card shows which signals were used.

### 10.3 Point tables
**Direction A (night target below estimate)**
| Case | Meaning | Points |
|---|---|---|
| **S1** | Wet and slept through | **+5** |
| **S4** | Awake in bed, let go without getting up | +3 |
| **S3** | Woke after, stayed in gear, back to sleep | +3 |
| **S2** | Woke after, changed, back to sleep | +2 |
| S5 / S9 | Woke and used the toilet (dry) | 0 (no penalty) |
| S8 | Dry, no wakes | 0 (+1 routine star if routine done) |
| Multiple wets | each wet scored, night max **+10** | |

Multipliers (A): wet size full ×1.2 / medium ×1.0 / small ×0.8 / drops ×0.5 · **gear step** ×(1 + 0.15 × steps thinner than `G_home`) — e.g. a slept-through wet in a pull-up (G3, 3 steps thinner than G0) = 5 × 1.45 ≈ 7.3 · bed protection in place required for G4/G5 points.

**Direction B (night target above estimate)**
| Case | Meaning | Points |
|---|---|---|
| **S8** | Dry, no wakes | **+5** |
| **S5 / S9** | Woke with urge, toilet, dry | **+5** |
| **S6** | Alarm woke you, finished in the toilet | **+4** |
| S2 | Woke after wet, changed | +1 (attempt) |
| S3 / S4 | Woke, didn't get up | 0 |
| S1 / S7 | Slept through wet / alarm | 0 (no penalty) |

Multipliers (B): wet size small/drops ×1.2 for S6 (stopped early) · gear step thinner ×(1 + 0.1 × steps).

### 10.4 Points → night track
```
nightPoints = Σ casePoints · multipliers                 // capped +10 per night
bonus       = min(3, nightPoints / 3)                     // feeds daily drift (§11.4) toward the night target
stars      += floor(nightPoints / 2)
```
Night points count toward drift **only** if `nightCountsReal` is on (consent). Otherwise they still give stars and appear in trends, but the night meter follows sim nights.

### 10.5 Night story card (morning)
"🌙 Tuesday night — in pull-up (G3), bed pad on. Wet at 03:12 (3 h 40 m after bedtime, 4 h after last pee). No phone activity until 07:05 → **slept through** (+5 × 1.45 = 7). Gear stage: Mix (1 in 2 nights in pull-ups). Thin-gear let-go ratio now 0.72." Buttons: **Looks right** / **I actually woke up** / **Not a wet**.

---

## 11. Infinite Campaign (per track)

### 11.1 Overview
1. **Onboarding:** consent (§14.1) → track choice (night / day / both) → calibration quiz per track (§4.1) → optional 3-day baseline diary → gear inventory and bed protection (§7.2) → targets and pace per track.
2. **Weekly chapters per active track:** each week the generator builds objectives for each trained track, sized to that track's gap and last week's results.
3. **Check-ins every 2–3 days** re-estimate each track (§4.5) and re-scale the unfinished objectives (§4.7).
4. **Adaptive difficulty** per track, aiming for ~70% objective completion and a slope near the planned pace.
5. **Gear ladder** runs inside the chapters (§7.4).
6. **Maintenance** per track once within ±5 of target for 2 chapters.
7. **Seasons** of 12 weeks with prestige; re-quiz each season and a short re-quiz every 6 weeks; targets can change any time.

### 11.2 Two meters per track: estimate vs playable value
- **Estimate** (`tracks[t].estimate`) — what the real metrics say (§4.5). Moves only at check-ins.
- **Playable value** (`tracks[t].value`) — what drives rolls, the advisor's training band and the campaign rank. It follows the estimate and gets small objective bonuses, so play feels responsive between check-ins.

### 11.3 Real vs sim weighting
| Setting (in consent screen + Settings) | Default | Effect |
|---|---|---|
| `realProgress` | **off** | Off: real (natural / DryClip) entries never move the estimate or the meter toward the target. They can still count as follow-through (logging stars) and against Direction B accident caps (current campaign rule). On: real entries count with weight `wReal`. |
| `wReal` | 1.0 | Weight of a real event (0.5–2). |
| `wSim` | 0.5 (0.0 if real progress on and confidence ≥ 0.5) | Weight of a sim roll outcome. Sim-only players keep `wSim = 1`. |
| `nightCountsReal` | follows `realProgress` | Separate switch for DryClip / morning check-in wets. |
| `confirmClip` | on | A DryClip wet only counts after the player confirms it (existing confirm flow). |

```
eventWeight(e) = e.source === 'real' ? (consent.realProgress ? s.wReal : 0)
                                     : s.wSim
```

| `perTrack` | — | Each switch above can be set per track (e.g. real progress on for night, off for day). |

```
eventWeight(e) = e.source === 'real'
  ? (consent.realProgress[e.track] ? s.wReal : 0)
  : s.wSim[e.track]
```

### 11.4 Drift — how each track's playable value moves
```
// once per day per active track (on roll-over or resume; rest/idle days skipped)
pull   = α · (estimate − value)                         // α: gentle 0.10, steady 0.15, fast 0.20
bonus  = Σ objectiveBonus(done today) · sign(target − value)      // +1..+3 each, toward target only
       + nightBonus (§10.4, night track) · sign(target − value)
       + Σ behaviourDrift (§5.3, real events only if counted)
delta  = clamp(pull + bonus, −cap, +cap)                // cap 4–12 (default 8) per track per day
value  = clamp(value + delta, 0, 100)
```
- The existing per-event `DRIFT` table in `control.js` (L74-77) stays for instant sim feedback, tagged with the track and sharing the same daily cap. `failed_wait` becomes direction-aware and real-only-when-consented (§14.4).
- **Planned pace** (points per week toward target): gentle 2, steady 4, fast 6. Used by §4.7 and the generator.
- **Sim-only players** (`realProgress` off): `estimate` is replaced by a **sim estimate** — the same formulas fed by sim outcomes — so the campaign still works without real data.

### 11.5 Objective generator (per track)
**Objective schema**
```jsonc
{ "id": "gear_sleepthrough_thin", "track": "night", "dir": "A", "tier": 3,
  "kind": "routine" | "outcome" | "log" | "boss" | "gear",
  "base": 1, "perTier": 0.5,         // target count = round(base + perTier · tier)
  "bonus": 2, "stars": 4,
  "requires": { "gearStage": ">=2", "bedProtection": true, "context": ["home","bed"] },
  "test": "fn(entries, week) → { progress, done }" }
```

**Pool (additions to rev. 1)** — see §6.2/6.3 for the base mechanics and §7.6 for gear objectives:
| id | Track | Dir | Kind | Text |
|---|---|---|---|---|
| `checkin_n` | any | any | log | Do N check-ins this week (2–3) |
| `measure_voids_n` | day | any | log | Measure N voids with a cup |
| `advisor_follow_n` | day | A/B | routine | Follow the advisor N times without a pass |
| `pass_light` | day | A | routine | Use ≤ N passes this week |
| `partial_ok_n` | day | A | routine | Complete N partial-release conditions |
| `letgo_context_n` | day | A | gear | Let go N times in an allowed office/out context (discreet) |
| `stay_bed_n` | night | A | routine | Stay in bed on N night wakes (only if comfortable) |
| `sleep_through_n` | night | A | outcome | N slept-through wets (S1) |
| `interval_hit_n` | day | B | routine | Hit N scheduled trips within ±10 min |
| `interval_step` | day | B | boss | Reach the next interval step |
| `wake_to_pee_n` | night | B | outcome | N nights woke to pee, dry (S5/S9) |
| `alarm_finish_n` | night | B | routine | Finish in the toilet after N alarm wakes (S6) |
| `pf_sets_n` | day | B | routine | N pelvic-floor sets (correct technique) |
| `debt_clear` | any | A | routine | Bring debt below 2 |

**Algorithm**
```
function generateWeek(state, now):
  chapters = {}
  active = tracksBeingTrained(state)                          // ['night'] | ['day'] | ['day','night']
  totalGap = Σ |T_t − value_t| over active (min 1)
  for t in active:
    tr   = state.tracks[t]
    gap  = tr.target − tr.value
    dir  = |gap| <= 5 ? 'maintain' : (gap > 0 ? 'B' : 'A')
    last = tr.chapters.at(-1)
    rate = last ? last.completed / last.of : 0.7
    tr.difficulty = clamp(tr.difficulty + (rate > 0.85 ? +0.5 : rate < 0.5 ? −0.5 : 0), 1, 5)
    // share of the week's objective budget, proportional to the gap
    budget = dir === 'maintain' ? 3 : clamp(round(4 + 6 · |gap| / totalGap), 3, 7)
    tier   = round(tr.difficulty)

    pool = OBJECTIVES.filter(o => (o.track === t || o.track === 'any')
                               && (o.dir === dir || o.dir === 'any' || (dir === 'maintain' && o.kind !== 'boss'))
                               && o.tier <= tier + 1
                               && meetsRequires(o, tr, state)          // gear stage, bed protection, contexts enabled
                               && !blockedBySafety(o, state))          // §14.2
    picks  = [pickOne(pool, 'log'), pickOne(pool, 'routine')]
    if tr.gear.stage >= 2:            picks.push(pickOne(pool, 'gear'))
    if tier >= 3 and weekNo % 2 == 0: picks.push(pickOne(pool, 'boss'))
    if dir === 'A' and state.passes.debt >= 3: picks.push(OBJ('debt_clear'))
    while picks.length < budget:
      picks.push(weightedPick(pool − picks,
                 w = o => KIND_W[o.kind] · freshness(o, tr.history) · gearFit(o, tr.gear)))
    for o in picks:
      o.target = scaleTarget(o, tier)                                    // round(base + perTier · tier)
      o.bonus  = min(3, 1 + floor(tier / 2))
    surprise = rng() < 0.2 ? pickSlot(picks) : null                      // golden star (variable reward)
    chapters[t] = { id: isoWeek(now) + ':' + t, track: t, dir, tier, objectives: picks, surprise,
                    gearPlan: gearPlanForWeek(t) }
  return chapters

KIND_W = { routine: 3, gear: 2.5, log: 2, outcome: 1, boss: 0 }   // bosses only via the explicit slot
```

**Weekly settle (per track)**
```
function settleWeek(t):
  ch = current chapter for t
  for o in ch.objectives: o.done = o.test(entries(t, week)).done
  stars += Σ done.stars (+3 if surprise slot done)
  tr.chapters.push({ id, dir, tier, completed, of, estStart, estEnd: tr.estimate, gearStage: tr.gear.stage })
  updateGearStage(t)                                       // §7.4 move-on / step-back rules
  if tr.phase === 'active' and |tr.target − tr.estimate| <= 5 for 2 settles: tr.phase = 'maintain'
  if weekNo % 6 === 0: queue('short_requiz')
  if weekNo % 12 === 0: seasonEnd()
  if consent.nextRecheckAt <= now: queue('reconsent')      // §14.3
```

### 11.6 Maintenance, seasons and prestige
- **Maintenance:** `|gap| ≤ 5` for 2 settled chapters → `phase = 'maintain'`. 2–3 light objectives (routines and logging), stars ×1.5 to reward consistency. Drifting outside ±8 → back to `active`.
- **Season (12 weeks):** season badge, a prestige star count (`prestige += floor(seasonStars/50)`), one cosmetic unlock (skin, board token, sticker set), and a season recap card (start vs end estimate, streaks, favourite routine). An optional **season modifier** is drawn at start (e.g. "Night season", "Out-and-about season") — enabled cards only.
- **Changing the target:** any time. The current chapter is kept but re-tagged at the next settle; no penalty. Reversing direction is the one-tap button in §14.2.

### 11.7 Star economy tie-ins
Shared wallet `bs_stars_v1` (catalogue #196–213):
- **Earn:** routine done (+1), honest log (+1), objective (+2–5), boss (+5), golden star (+3), streak milestones (7/14/30 days: +3/+5/+10). Daily cap 20. **No stars for drinking.**
- **Spend:** Potty Pass (10 stars, §9.2), re-roll an objective (3), skip a curse/card (6), rest-day token (5), cosmetics (10+), caregiver "treat" cards (custom, partner-defined).

- **Per track:** maintenance, seasons and prestige are tracked per track; a "both tracks" player can be in maintenance on one track and active on the other.
- **Season-end re-quiz** includes a full check-in and resets gear-ladder stage checks (not position).

---

## 12. Data model (all keys)

New keys use the existing `bs_*_v1` naming. All are local-only (`localStorage`), included in export / import and in "wipe all".

```jsonc
// bs_consent_v1 — consent and switches
{ "v": 2, "acceptedAt": 0, "textVersion": "2026-11-r2", "adult": true,
  "tracks": { "day": "A" | "B" | "off", "night": "A" | "B" | "off" },     // off = frozen / game-only
  "realProgress": { "day": false, "night": false },
  "nightCountsReal": false,
  "caregiver": "none" | "same_phone" | "partner", "partnerInformed": false,
  "nextRecheckAt": 0, "rechecks": [{ "ts": 0, "answer": "continue" | "pause" | "reverse" | "stop" }] }

// bs_control_v1 — single source, two tracks (old top-level fields migrated)
{ "v": 2, "mode": "conditioning" | "game",
  "tracks": {
    "day":   { "value": 58, "target": 30, "estimate": 61, "confidence": 0.7, "sim": 55,
               "pace": "steady", "cap": 8, "dayDelta": 0, "lastDay": "2026-11-11",
               "difficulty": 2.5, "phase": "active" | "maintain" | "frozen",
               "gear": { "home": "G0", "pos": "G3", "stage": 3 },
               "history": [{ "ts": 0, "kind": "checkin", "d": -2, "v": 58 }] },
    "night": { "value": 40, "target": 15, "estimate": 42, "confidence": 0.9, "sim": 38,
               "pace": "fast", "cap": 8, "dayDelta": 0, "lastDay": "2026-11-11",
               "difficulty": 3, "phase": "active",
               "gear": { "home": "G0", "pos": "G2", "stage": 2 }, "history": [] } },
  "countWaitAccidents": false }

// bs_checkins_v1 — every 2–3 days
{ "every": 2 | 3, "time": "20:30", "nextAt": 0,
  "items": [{ "ts": 0, "covers": ["2026-11-10"],
    "day":   { "voids": 7, "volumes": [{ "ml": 320, "measured": true }, { "ml": 300, "measured": false }],
               "gapTypical": 110, "gapLongest": 170, "urgency": 5, "rush": 1, "warnMin": 8,
               "leaks": [{ "size": "small", "aware": "after", "gear": "G3", "context": "office" }], "drinksGlasses": 7 },
    "night": [{ "date": "2026-11-10", "wets": 1, "size": "medium", "wakes": 0, "wokeToPee": false,
                "wokeOnWet": false, "gear": "G2", "bedProtection": ["protector", "pad"], "clipConfirmed": true }],
    "body":  { "hesitancy": "none" | "little" | "lot", "straining": false, "dribble": "none" | "pre" | "post",
               "flags": [] },                            // red-flag ids (§5.2)
    "metrics": { "V": 310, "F": 7, "I": 112, "U": 5, "W": 8, "Ld": 0.5, "Aw": 0.3, "Dn": 0.4, "Wn": 0.7, "Sn": 0.6, "Wp": 0.1, "Ww": 0.2 },
    "estimates": { "day": { "measured": 63, "before": 61, "after": 62 }, "night": { "measured": 40, "before": 42, "after": 41 } } }] }

// bs_diary_v1 — baseline / any-time diary
{ "active": false, "mode": "simple" | "detailed", "start": "2026-11-09", "days": 3,
  "entries": [{ "ts": 0, "k": "drink" | "void" | "leak" | "urge" | "wake" | "wet", "ml": 300, "measured": true, "urg": 6, "gear": "G3" }],
  "baseline": { "V": 300, "Vmax": 480, "F": 8, "I": 95, "Ld": 0.3, "Dn": 0.6 } }

// bs_gear_v1 — gear ladder, recommendation from the baseline, per-gear stats
{ "items": { "G0": { "label": "Thick diaper", "capMl": 1500, "owned": 20 }, "G3": { "label": "Pull-up", "capMl": 400, "owned": 12 },
             "G4": { "label": "Pad / liner", "capMl": 150, "owned": 10 },
             "G6": { "label": "Underwear", "capMl": 0 } },
  "recommended": { "day": "G4", "night": "G2", "at": 0, "why": { "day": "Leaks fit a pad.", "night": "Some wet nights." } },
  "bed": { "protector": true, "pad": 2, "chux": 10, "spareSheets": 1 },
  "homePrep": { "seatPad": true, "towel": true },
  "stats": { "night": { "G0": { "opp": 14, "letGo": 12, "sleepThrough": 9, "dry": 2, "size": 0.8, "ready": 0.9 },
                        "G3": { "opp": 6, "letGo": 3, "sleepThrough": 1, "dry": 3, "size": 0.5, "ready": 0.5 } },
             "day": { } },
  "skinCapHours": { "default": 4, "G6": 1 } }

// bs_partial_v1 — partial-release outcome settings (not a forced toilet rule)
{ "v": 1, "dailyCap": 4, "finishOnToilet": true, "day": "2026-11-11", "count": 1,
  "log": [{ "ts": 0, "pct": 0.15, "track": "day", "finishOnToilet": true, "emptied": null }] }

// bs_drinks_v1 — full drink log. A missing day is absent, not 0 ml.
{ "v": 1,
  "presets": [{ "id": "sip", "label": "Sip", "ml": 50 }, { "id": "cup", "label": "Cup", "ml": 250 }, { "id": "glass", "label": "Glass", "ml": 350 }],
  "last": { "id": "cup", "label": "Cup", "ml": 250, "ts": 0 },
  "nudge": false,
  "days": { "2026-11-11": { "logged": true, "ml": 1750, "items": [{ "ts": 0, "ml": 250, "label": "Cup", "id": "cup" }] } } }

// bs_sleep_v1 — pluggable sleep source. Health Connect adapter, else manual import.
// LuckRing (Play com.kewo.coolring) has no public API in its listing or privacy policy.
// If that app later writes SleepSessionRecord, the Health Connect adapter picks it up.
{ "v": 1, "source": "none", "nights": [{ "date": "2026-11-10", "source": "manual",
  "stages": [{ "stage": "deep", "start": 0, "end": 0 }], "wakes": [], "deepMin": 80 }] }

// bs_passes_v1 — Potty Pass requests (denied / granted / compromise). Not a guarantee.
{ "v": 1, "debt": { "day": 0, "night": 0 },
  "requests": [{ "ts": 0, "outcome": "compromise", "kind": "partial_first", "pct": 0.15, "gear": "G3", "recommended": "G3" }],
  "week": "2026-W46",
  "day":   { "held": 3, "allowance": 3, "bought": 0, "debt": 1.4, "partialToday": 1, "lastPassAt": 0 },
  "night": { "held": 2, "allowance": 2, "debt": 0 },
  "backfires": [{ "ts": 0, "kind": "drink" | "odds" | "stricter" | "night_rules" | "lockout", "track": "day", "until": 0, "ml": 200, "skipped": false }],
  "drinkBackfiresThisWeek": 1 }

// bs_night_score_v1
{ "nights": [{ "date": "2026-11-10", "track": "night", "dir": "A", "gear": "G3", "bedProtection": true,
               "events": [{ "wetAt": 0, "case": "S1", "size": "medium", "points": 7.3, "signals": ["clip", "no_phone"] }],
               "total": 7.3, "bonus": 2.4, "stars": 3, "userEdited": false }] }

// bs_phone_wake_v1 — night only, rolling 14 days
{ "events": [{ "ts": 0, "k": "resume" | "screen_on" | "disarm" | "alarm" }] }

// bs_symptom_v1
{ "paused": false, "pausedAt": null, "reason": null,
  "watch": { "hesitancyLotCount": 0, "notEmptyCount": 0 },
  "history": [{ "ts": 0, "flags": ["burning"], "action": "pause" }] }

// bs_infinite_v1 — campaign state (chapters per track)
{ "v": 2, "startedAt": 0, "season": 1, "week": 3, "prestige": 0, "restDays": 1,
  "chapters": { "day": { /* §11.5 chapter */ }, "night": { } },
  "history": { "day": [], "night": [] }, "requizDueWeek": 6, "seasonModifier": null }

// bs_stars_v1, bs_routines_v1 — as rev. 1 (stars wallet; night routine, cue, timed-void ladder, pelvic routine, streaks)
```

**Calendar entries** gain: `track`, `gear` (G0–G5), `context`, `advisor` (`{u, outcome, passUsed, condition}`), `nightCase` (S1–S9), `measured` (volume). Existing `source: 'sim' | 'natural'` stays.

---

## 13. UI flows (screens)

### 13.1 Onboarding (v47 quiz — this is how conditioning starts)

Settings → Conditioning opens the intake on the same one-question quiz screen as Quiz A / Quiz B (option cards, progress bar, result card). Consent is the step after the result. There is no separate form and no repeated "you are wearing X, what happens" scene list. At most two picture questions sit in an optional flavour section.

Each question asks something different. Day now covers hold after the first urge, warning, suddenness, trips, void amount (or the calibration estimate), leaks, dribbles, cough/laugh leaks, fullness, noticing wetness, putting off going, and whether thick gear makes wetting easier. Night now covers wet nights, getting up, waking when wet, when a wet happens, sleep depth (a LuckRing or JSON import can prefill), how hard you are to wake, sleep length, evening drinks, bedtime pee, and night gear.

Want questions are goals, not a second copy of the same scene. Each one can be "keep this as it is". The profile stores a now value and a want value per dimension, plus an overall ladder level per track.

Goals, where it applies, and sim-only versus real habits are asked per track. Urgency training picks a style (first-urge release, urge surfing, partials, timed voids), how often prompts appear, and how strict passes are. Sleep conditioning picks depth, a bedtime cue, staying in bed, release before fully awake, DryClip alarm versus none, and the evening drink pattern.

Pacing is per track:

- **Instant** — the urge sim and the session sim use the goal now. Real results are still only recorded.
- **Gradual** — about six agreeing check-ins to go from now to the goal. Calendar time alone does not move it.
- **Slow burn** — about sixteen agreeing check-ins. Small steps over months.
- **Hybrid** — the sim uses the goal now; real-habit practice stays on the gradual curve.

The Natural Urge profile reads the effective values: hold window, warning, suddenness, notice chance, and go/wait/dribble/partial/gear weights. A full session's timers, sip reminders, and prompt text follow the urgency style and the sleep answers, still inside the drink cap. The profile card shows each dimension as now → where the sim is → goal, in words, plus the pacing.

A v44 consent is kept and mapped onto the nearest ladder name. A v45 or v46 profile still loads. Retaking overwrites dimensions and levels and keeps the habit log.

`bs_conditioning_v1` still holds starting level, target, direction, goals, intensity, timeframe, methods, gear, calibration, diary, cues, and streaks. v47 adds `dimensions`, `pacing`, `urgency`, `sleep`, and `scope` on that same profile.

### 13.2 Urge tab (main daily screen)
- Top: two **track chips** (☀ Day 58 → 30 · 🌙 Night 40 → 15), each with a tiny trend arrow.
- **Context chips:** 🏠 Home · 💼 Office · 🛍 Out · 🚗 Car · 🛏 Bed (discreet auto-on away from home).
- **Gear chip:** "Wearing: pull-up (G3) · 20% used" — tap to change / report saturation.
- **Big button: I need to go** → urgency slider → **Answer card** (§8.5) → **Log result** sheet.
- **Pass chip / debt meter** (A) or **next scheduled trip** (B).
- Footer: **Real need (free)** · **Had an accident** (existing `accident.js`) · **Check-in due** badge.

### 13.3 Pass sheet
"Spend 1 pass? (3 left)" → shows the drawn condition and what debt it would add → **Spend** / **Cancel** / **Real need instead (free)**. After: a short timer for partial conditions ("Let a little go… then head to the toilet") with **Done** / **Couldn't stop — finished in gear** / **Couldn't start**.

### 13.4 Check-in flow (every 2–3 days)
9 short cards (§4.2), each skippable → **Result card**: per-track measured vs previous estimate, trend sparkline, status badge (on pace / slow / drifting), top 2 changes, difficulty change ("Night chapter eased a little"), any red-flag pause.

### 13.5 Trends screen
Per track: estimate line + target line (12 weeks), metric small multiples (gap, volume, frequency, urgency, warning, leaks; dry nights, wets/night, slept-through rate, wake-to-pee), gear generalisation bars (`GR` per gear), night case mix (stacked S1–S9), debt history.

### 13.6 Gear ladder screen
Ladder G0 → G5 with current position and stage per track; per-gear stats; this week's gear plan (calendar strip with gear icons); move-on criteria progress ("Pull-up nights: GR 0.62 / 0.70 to reach Mostly"); protection checklist (§7.7).

### 13.7 Night flows
- **Bedtime routine** (Natural Night bedtime card): gear for tonight (from gear plan), bed ready, bed-drinks suggestion (capped), pee before bed, cue, DryClip arm (silent for A, alarm for B), lights out.
- **Night wake** (existing wake button): A → "Stay cozy / Need to get up anyway (fine)"; B → "Toilet now".
- **Morning night story** (§10.5) with confirm/edit → feeds the check-in.

### 13.8 Campaign screen
Per-track chapter cards (objectives with progress bars, golden-star slot, gear-plan strip), season banner, maintenance badge, **Change target**, **↩ Reverse direction**, **⏸ Pause**, **Stop conditioning**.

### 13.9 Symptom pause screen
Full-screen, calm: which flag, what to do ("see a doctor / seek care today"), what's paused, **Resume (I've been checked / feel fine)**. Optional "export my last 14 days" for a clinician (diary-style PDF/text).

### 13.10 Caregiver screen (same phone)
PIN-switched view: this week's cards (pick 1 of 3 per track), grant passes or changes, praise buttons, read-only trends. Cannot change consent, caps, the real-need button or pause.

---

## 14. Safety and consent design

### 14.1 Informed-consent onboarding (plain words)
Shown before conditioning mode starts, when a track's direction is reversed, when the consent text version changes, and at each re-consent check-in.
- "This mode is meant to change your real habits. Practised for weeks or months, it **may change your real bladder control**, day, night or both, in the direction you pick. Changes may take time to undo."
- "Direction A (less control) can mean more wet nights, wetting in thinner protection or underwear, and needing protection more often, in real life."
- "Direction B (more control) uses scheduled trips, urge control and pelvic-floor exercises."
- "You can reverse a track or stop at any time with one tap. A 'Real need' button is always free."
- "If you notice pain, burning, blood, fever or trouble emptying, the app pauses and asks you to see a doctor."
- Checkboxes: *I'm an adult · I understand this may change my real control · Count my real day results toward progress (optional) · Count my real night results (optional) · My partner knows the direction and the reverse button (if caregiver on)*.

### 14.2 Built-in guardrails (features, not lectures)
| Guardrail | Behaviour | Where |
|---|---|---|
| **Drink caps** | Every drink prompt — hydration, bed drinks and **debt backfires** — goes through `BSSafety.capDrink` (≤ 250 ml/prompt, ≤ 1 L/day from prompts, ≥ 2 h apart). Debt drinks: max 1/day, 3/week, not within 3 h of bed, skipped above 2.5 L logged intake. No stars for drinking. | `safety.js`, `bed-drinks.js`, new `passes.js` |
| **No hold-to-failure / retention** | Advisor never says wait at urgency 8+; waits ≤ 20 min (car ≤ 15); 5-hour max since last void → go. B intervals cap at 4 h. Urge surf ends with "if it doesn't ease, go". No objective or card asks for holding until you can't. | `advisor.js`, generator `blockedBySafety` |
| **Partial release limits** | ≤ 30% of expected volume, ≤ 50% of what the gear can still hold, daily cap is a setting (default 4), one stop-start per void. Toilet-after is a setting (default on) plus one settings line about retention and UTIs. "Couldn't stop" is free. A pass is a weighted request, not a guaranteed toilet trip. | `partial.js`, `passes.js` |
| **No straining** | Guides say relax / let go, never push. Straining is a red-flag watch item, not progress. | `tables.js`, `guide.js`, §5 |
| **Correct pelvic-floor technique** | 3–5 s squeeze, equal relax, 10 reps, 3 sets/day, not while peeing, breathe normally; no max-clench holds. | `tables.js`, B4 |
| **Symptom pause** | Red flags (§5.2) pause chapters, debt, A rules, drink prompts and night scoring; resume is manual. | new `symptoms-check.js` |
| **Public / context safety** | No let-go advice in training pants or underwear outside home; office/out/car only when the gear can hold it; discreet wording. | `advisor.js` §8.4 |
| **Skin cap** | Max hours worn per gear (default 4 h; underwear in a wet bed: change/rinse prompt on waking) always overrides change rules and backfires. | `change-roll.js`, `bs_gear_v1` |
| **Debt caps** | Go-odds floor 0.5×, partial ≤ 30%, one backfire per type per day, debt ≤ 10, frozen while paused, reset on reverse. | `passes.js` |
| **Real need button** | Always present, free, no debt, no streak break, logs neutrally. 4+ uses/day → gentle "anything feel off?" chip. | advisor, `natural-night.js` |
| **One-tap reverse / stop** | Per track: swaps target to the mirror band (or chosen value), A rules off immediately, debt reset. Stop → game-only mode. | `infinite.js`, `control.js` |
| **Pee before bed** | Kept in both directions. | `bed-drinks.js` L44 |
| **Bed protection prompt** | Night objectives in G4/G5 require bed protection ticked. | `gear.js` |
| **Privacy** | Neutral notifications by default; office mode; caregiver PIN. | `native-notify.js`, `office-mode.js` |

### 14.3 Re-consent check-ins
- Every **4 weeks**, and whenever a Direction A track crosses **2 bands** since the last check: "Still want to continue? Continue · Pause · Reverse · Stop". No answer within 7 days → pause.
- At each **season end** the consent screen is shown in full.
- If caregiver mode is on, the re-consent is answered on the player's view (not the caregiver PIN view).

### 14.4 Existing strings / features to fix
| File:line | Current | Fix |
|---|---|---|
| `js/event-builder.js:303` | Omorashi preset: "Optional: hold until you physically can't" | Remove that sentence; end holds at a set time or a strong urge |
| `js/simple-urge.js:16`, `:257` | "Hold till hard" / "Hold until it gets hard, then roll again." | A mode: "Let it happen early". B mode: "Urge surf, then go or wait to schedule". Game mode: "Hold a little longer (stop if it gets strong)" |
| `js/urge-matrix.js:99` | "hold until I say." / "Let's see how long you last." | "Short hold — I'll tell you soon." with a max of 10 min |
| `js/tables.js:1129-1133` | "Kegel Strength": HOLD MAXIMUM 8 s | 3–5 s squeeze / equal relax ×10 |
| `js/tables.js:1294-1300` | "The Kegel Crusher": MAX contract, 15 s "no relaxing" | Replace with the correct routine or remove |
| `js/tables.js:2020`, `:2100`, `:2138` | "CLENCH EVERYTHING" 15–20 s | "Gentle squeeze 3–5 s, then relax" |
| `js/tables.js:2328-2331` | kegel category: "MAX CONTRACT", "HOLD (no relaxing)" 15–30 s, "CLENCH EVERYTHING BELOW WAIST" 20–35 s | Correct-technique set |
| `js/guide.js:377` | holdTexts "KEGEL HARD", "CLAMP DOWN" | "GENTLE SQUEEZE", "BREATHE" |
| `js/tables.js` (303 `type: "push"` steps) | push / bearing-down guide steps | Change to "relax / let go"; no straining copy |
| `js/ui.js:643`, `:645`, `:648` | "No excuses", "Forced Hydration", "Keep the pressure rising" | Neutral: "Sip time: N sips if you're thirsty" (caps unchanged) |
| `js/tables.js:431` | "Sip Too Many": made to drink extra water | Rewrite without forced fluid |
| `js/tables.js:605` | "Hydration Penalty": "Drink, then leak to make room" | Remove or make the drink optional and capped |
| `js/natural-night.js:237` | "🛌 Stay in bed — try to sleep." with no visible way out | Add "Need to get up anyway? That's fine." (real-urge button) |
| `js/control.js:76` | `failed_wait: [-2, -2]` — a real accident counts as progress in regress | Direction-aware; real events only count when `realProgress` is on (§4.5) |
| `js/control.js:83` | `countWaitAccidents: true` by default | Default off; fold into the consent toggle |
| `js/campaign.js:76` | `simleaks` counts real failed-wait accidents and DryClip wets toward the "less continent" goal | Count real events only when `realProgress` is on |
| `js/alarm-grace.js` (header + `controlValue()`) | Auto-declares an accident when grace runs out; reads its own continence level | Read `BSControl.continenceLevel()`; copy says "the sim counts it" (never a real hold prompt) |
| `docs/IDEAS-catalogue.md:5`, `docs/REVIEW-v2-mechanics.md:6`, `js/board.js:1-5` | "Nothing here trains the real body" | Add: "…unless you opt in to conditioning mode (see this doc)" |
| `js/natural-night.js:46-54` | `roll()` "may get up" uses the session continence level | Read `BSControl.band('night')`; A/B night rules from the track |
| `js/simple-urge.js` roll / `js/control.js` LADDER | one odds table for day and night | odds per track via `trainingBand(track)`; advisor (§8) wraps the roll |

---

## 15. Implementation roadmap

| Phase | Scope | Effort | Files |
|---|---|---|---|
| **P0 — Safety fixes** | All §14.4 strings and tables; `failed_wait` direction-aware; `countWaitAccidents` default off; stay-in-bed escape; drink-cap tests | S (1–2 days) | `tables.js`, `guide.js`, `ui.js`, `simple-urge.js`, `urge-matrix.js`, `event-builder.js`, `natural-night.js`, `control.js`, `campaign.js` |
| **P1 — Single source, two tracks** | `bs_control_v1` v2 with `tracks.day/night`; `band(track)`, `continenceLevel(track)`, `trainingBand(track)`, `trackFor()`; `bs:outcome` bus; migrate campaign, board, alarm-grace, natural-night, bed-drinks; unit tests. Also the revision-3 structures that later phases call: partial as a roll weight (`partial.js`), pass request weights (`passes.js`), drink log (`drinks.js`), sleep-source interface (`sleep-source.js`), gear recommend with pads (`gear.js`). | M–L | `control.js`, `campaign.js`, `board.js`, `alarm-grace.js`, `natural-night.js`, `bed-drinks.js`, `calendar.js`, `gear.js`, `partial.js`, `passes.js`, `drinks.js`, `sleep-source.js`, `tests/` |
| **P2 — Consent and symptom pause** | Consent v2 (per track), real-progress switches, red-flag chips, pause screen, reverse/stop, re-consent timer | M (3–4 days) | new `consent.js`, new `symptoms-check.js`, `calendar.js`, `accident.js`, `index.html`, `native-notify.js` |
| **P3 — Calibration and check-ins** | Quiz A/B per track; 3-day diary; check-in flow every 2–3 days; metric and estimate functions (§4.3–4.5); trends screen; difficulty adjust | L (1.5 weeks) | `quiz.js`, new `diary.js`, new `checkins.js`, new `trends.js`, `control.js`, `calibration.js`, `styles.css` |
| **P4 — Gear ladder** | Weekly gear plan, per-gear stats, bed protection, home prep, cue fading, gear screen. Recommendation itself starts in P1 (`BSGear.recommend`, pads as G4, check-ins refresh it). | M | `gear.js`, `simple-urge.js`, `natural-night.js`, `potty-report.js`, `change-roll.js` |
| **P5 — Advisor** | `advise()` with weights (§8.3), including the partial outcome and the gear-mismatch warning. Context chips, discreet mode, answer cards, log-result sheet; quick tile later. | M | new `advisor.js`, `simple-urge.js`, `partial.js`, `gear.js`, `office-mode.js`, `index.html` |
| **P6 — Potty Pass and debt** | Allowance, earning, debt add/decay, backfires with caps, debt meter; B schedule debt. The request itself (denied / granted / compromise, not a guarantee) is in P1 `passes.js`. | M | `passes.js`, `safety.js`, `advisor.js`, `natural-night.js`, `change-roll.js`, `calendar.js` |
| **P7 — Night scoring** | `bs_phone_wake_v1`, classification S1–S9, point tables, night story card, DryClip alarm mode for B. Sleep stages come from `sleep-source.js` (Health Connect when a plugin exists; manual import until then). A wet in deep or REM sleep with no wake scores higher for Direction A and lowers the night control estimate via `sSl`. Deeper-sleep minutes stay a separate trend. | M–L | `dryclip.js`, `clip-bridge.js`, `sleep-source.js`, Android Health Connect plugin (not in v44), `natural-night.js`, new `night-score.js` |
| **P8 — Routines, stars, Direction mechanics** | Stars wallet and shop (incl. passes); night routine; cue editor; pelvic coach; timed-void ladder; urge surf; A1/A2/A4/A8 copy and odds | M–L (1–1.5 weeks) | new `stars.js`, new `routines.js`, `simple-urge.js`, `guide.js`, `tables.js`, `native-notify.js` |
| **P9 — Infinite Campaign core** | Per-track generator, weekly settle, chapter cards, maintenance, re-quiz queue | L (1.5–2 weeks) | new `infinite.js`, `control.js`, `campaign.js` (classic mode kept), `index.html`, `tests/` |
| **P10 — Caregiver and seasons** | Same-phone caregiver view; seasons, prestige, cosmetics, Little Days, Big Kid Test; remote partner later | M (same phone) / L (remote) | new `caregiver.js`, `path-play.js`, `infinite.js`, `board.js`, `whats-new-data.js` |

**Order:** P0 → P1 → P2 first (no conditioning features before consent and symptom pause exist). P3 (check-ins) before P9 (the campaign needs estimates). P4 → P5 → P6 in that order (the advisor needs gear capacity; passes need the advisor). P7 can run alongside P5/P6. Rough total: **10–14 weeks** of focused work.

**Testing focus:** pure tests for `estimateTrack`, `adjustAfterCheckIn`, `advise` (every hard override fires; no "wait" at urgency 8+; no let-go in G4/G5 outside home), `passCondition` caps, debt decay and backfire caps (drink backfire never exceeds `capDrink`), `classifyNightEvent` on synthetic timelines, `gearPlanForWeek`, `generateWeek` across tracks.

---

## 16. Open questions — v44 defaults

These were open. v44 picks a default so the build can ship. Change any of them in settings or a later pass.

1. Check-in default: **every 3 days** (the player can switch to 2).
2. Office pull-up: **full release stays allowed when the pull-up can hold the expected volume.** Partial is an extra roll outcome, not a replacement. Office in a pad stays a partial or a toilet trip.
3. Debt drink backfire: **keep 150–250 ml**, still through `BSSafety.capDrink` (≤ 250 ml).
4. Night case S4: **+3**, same band as S3. Not higher.
5. Underwear at home: **partial only**, even with home prep, until the player turns on full let-go for G6 at home. Pull-ups and thicker can still be a full release at home.
6. Phone-activity signal: **app resume only** in v44. A native screen-on listener waits. Sleep stages use the sleep source, not the screen.
7. Re-consent every **4 weeks**, and again if a track moves **two bands**. Kept.
8. `finishOnToilet`: **on**. One settings line about retention and UTIs. Not enforced.
9. Partial daily cap: **4**. A setting.
10. Luck Ring: **no vendor SDK.** Health Connect is the adapter; manual JSON import works now. See §10 note below.

### Sleep source note (Luck Ring)

The Play listing for LuckRing (`com.kewo.coolring`) describes sleep monitoring (deep, light, awake) plus heart rate, SpO₂, and steps. The public privacy policy describes sync with the vendor's own service. It does not document a developer API or Health Connect writes. v44 therefore does not bind to that package. `js/sleep-source.js` defines one normalised night (stages, wakes, deep minutes) and two adapters: Health Connect `SleepSessionRecord` (returns "plugin missing" until a native plugin is added) and manual JSON import. If LuckRing, or any other ring app, writes sleep into Health Connect later, the same adapter reads it.
