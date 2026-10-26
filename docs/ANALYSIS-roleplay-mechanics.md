# Roleplay Mechanics Analysis — symptoms, Control meter, classes & campaigns

*Bladder Sim (branch `android-capacitor`, after v9 `b5504b5`, plus v10 Random #2 timer). Design document only: game mechanics, no sexual content.*

> **Read this first: everything here is in-sim.** Every "symptom" in this document is a **game rule**: a timer, a dice roll, a hidden value, a prompt, or a limit the app puts on *its own* instructions. None of it is a way to change your real body. This document does **not** describe, and the app must never offer, real-world methods for losing continence, shrinking real bladder capacity, muting real bladder signals, causing stress leaks, or "urgency training" your body. "Regression" and "progression" only move an in-game **Control** number up and down; the fantasy lives in the prompts, not in your physiology.
> **Real urges always win.** If you really need to go and it can't wait, go, whatever the game says. Don't strain, and skip any #2 prompt your body isn't ready for. A real need is never a "failure". The game logs it as a neutral "real-life override", and no curse applies to it.

---

## 1. How the sim creates each *feeling* today

| Feeling | Where it comes from (file → function/data) | How it reads in play | What's missing |
|---|---|---|---|
| **Quiet signals / muted urges** | `js/simple-urge.js` → `roll()` (`quietSignals` trait: dribble weight ×1.8, "hold till hard" ×0.6); campaign ranks 6–7 `preChime:false` / "No warning" (`js/campaign.js` `RANKS`); `js/alarm-grace.js` `graceMs()` | You get fewer "it's getting hard" prompts and more "wait for a dribble" rolls. At high ranks the chime has no pre-warning | No **hidden fill state**. The urgency bar in the status bar always shows the truth, so the player is never actually "in the dark" |
| **Dribbles** | `js/tables.js` micro tables (`Stress Dribble`, `Drink Pressure`, `Walking Leak`…), Simple Urge `dribble` outcome | A random micro event shows up with a short guide (push/relax steps) | Dribbles don't feed back into anything. They don't change later rolls, raise in-game pressure or bring the next event forward |
| **Urgency** | `js/engine.js` pressure/urgency UI (`updatePressureUI`), campaign `waves` (1→5 per cycle), `alarm-grace.js` foreground/background grace ranges | Urgency waves before the main chime. The grace window to tap "I made it" gets shorter as rank rises | Windows only shrink with rank changes. There's no *in-session* escalation (each missed window shrinking the next) |
| **Stress leaks** | Table entries tagged `involuntary` (`Laugh Test`, `Sneeze Chain`, `Giggle Leak`, `Heavy Bag Dribble`) | They fire on their own as random events | The player can't log a trigger ("I just sneezed / lifted"), so there's no way to roll a stress-leak *reaction* |
| **Short warning** | Campaign `warn` text + `preChime`; `alarm-grace.js` `classify()` | The pre-chime is skipped at the Padded tiers and above | Warnings are all-or-nothing. A probability ("warning shows 60% of the time") would feel more organic |
| **Fast Fill** | `simple-urge.js` `fastFill` (waits ×0.6, gear ×1.2) | Shorter waits | Not connected to logged in-game drinks (`natural-night.js addDrink` exists, but only at night) |
| **Bedwetting** | `js/natural-night.js` (`roll()`, `doRoll()`, `confirmPee()`, `finish()`), `js/profiles/bedwetting.js`, `isBedwettingSilent()` | A silent night with morning dry/wet logging | Night results don't affect the next day. No "rough night → shaky morning" carry-over |
| **Regression** | `campaign.js` `evaluate()`/`applyRank()` (daily score → rank ±1), `quiz.js` baseline, `calibration.js` | The rank changes after a day's goals, and with it protection, timers and grace | Only 7 coarse steps, updated once a day. No continuous meter, no streaks, no rest-day handling beyond `pause()` |
| **#2 / messy** | `ui.js` `triggerMessyEvent()`, `MESSY_HOLDING_GAUNTLETS_D10` / `MESSY_PUSHING_ACCIDENTS_D10`, **v10 `js/messy-timer.js`** | Manual "Uh-Oh" button, plus the new hidden random timer with per-control-level prompts | Not linked to Control yet (it uses its own level picker or the profile) |

**Overall gap:** there are plenty of good per-event dice, but **no persistent state joins them up**. Section 3's Control meter is meant to be that state.

---

## 2. In-sim simulations for each symptom

Every design below is a rule the app applies to *its own prompts*. The parameters are tuned by Control (C, 0–100, see §3).

### 2.1 Quiet Signals (hidden fill)
- **State:** a hidden `fill` (0–100) that rises over time at `rate = base × (FastFill ? 1.5 : 1)`.
- **Display:** the status bar shows `fill` only with probability `p_show = 0.3 + 0.7·C/100`. Otherwise it shows "—" (**fog**).
- **Warnings:** the pre-warning prompt fires with probability `p_warn = C/100`, and arrives `lead = 2 + 8·C/100` minutes before the event. At C < 20 there are no warnings at all.
- **Feel:** you only learn where you were *after* the event, when the log reveals "fill was 82%".
- **Hook:** `engine.js` status bar render plus a new `js/control.js` `fog()` helper.

### 2.2 Dribble roleplay
- A dribble is a **re-roll trigger**. Each one adds `+8 fill` and brings the next scheduled event forward by `10–25%`.
- **Chain rule:** 3 dribbles inside 30 min force a "big roll" (Simple Urge `roll({urgency: 8})`).
- **Prompt (non-graphic):** "Little dribble — note it and carry on." There's an optional guide (2 steps from the micro tables).
- **Hook:** `simple-urge.js` `press()` already handles the `dribble` outcome. Add a `dribbleCount` to `st()`.

### 2.3 Urgency (shrinking grace and wave bursts)
- **Grace window:** `grace = rankGrace × (0.5 + C/200)`. Every miss in the same session multiplies the next window by 0.8, down to a floor of 5 s. A hit resets it.
- **Wave bursts:** before a main event, `n = campaign.waves + (C < 30 ? 1 : 0)` waves of 20–60 s each. A "tap to hold" button passes each wave with probability `p = 0.4 + 0.5·C/100`.
- **Hook:** `alarm-grace.js` `graceMs()` / `evaluate()`.

### 2.4 Stress leaks (player-logged triggers)
- **New buttons:** 🤧 Sneeze · 😂 Laugh · 🏋️ Lift · 🧍 Stand up. Logging one rolls `d100 < leakChance`, where `leakChance = (100 − C) × 0.6 × triggerMult` (sneeze 1.0, laugh 0.8, lift 1.2, stand 0.5).
- **Hit:** a micro guide from the `involuntary` table plus a log line. **Miss:** "Held it! +1 Control XP."
- The buttons only log an event the player *says* happened. The app never asks you to sneeze, lift or strain.
- **Hook:** `simple-urge.js` render (a "Triggers" row) and `tables.js` tags.

### 2.5 Short warning
- `p_warn` and `lead` from §2.1. A warning that is skipped is logged after the fact ("no warning that time"). That keeps it honest and builds the feeling.

### 2.6 Fast Fill
- `rate` ×1.5, plus every logged in-game drink (new 💧 button) adds a +15 fill bump spread over 30 min. Waits ×0.6 (exists).

### 2.7 Overnight regression (carry-over)
- In `natural-night.js` `finish()`: wet → `C −3` (Control-down mode) or `C −1` (progression mode), with a morning "Shaky Start" modifier of −10% grace until noon. Dry → `+2` C and a "Fresh Start" card.

### 2.8 #2 timer (implemented, v10)
- See §5 and the Task 2 notes. Control level picks the odds of potty permission (Good 100%, Okay 85%, Shaky 50%, Little 15%, None 0%) and the chance of an early heads-up (0/0/15/35/50%). "Not now" is always available and is never penalised.

---

## 3. The long-term Control meter

### 3.1 Definition
`control` is a 0–100 float stored in `bs_control_v1`, with `{ value, mode: 'progress'|'regress'|'hold', history[], streak, paused }`. It has **no effect on anything real**. It just re-tunes the sim.

| C band | Label | Maps to campaign rank | Simple Urge level |
|---|---|---|---|
| 90–100 | Big Kid | 1 | fully_continent |
| 75–89 | Trainee | 2 | mostly_continent |
| 60–74 | Sprout | 3 | mostly_continent |
| 45–59 | Nightie | 4 | somewhat_incontinent |
| 30–44 | Padded | 5 | somewhat/mostly |
| 15–29 | Thick-Padded | 6 | mostly_incontinent |
| 0–14 | Little Legend | 7 | fully_incontinent |

### 3.2 Drift rules (per in-game outcome)

| Outcome (logged in the sim) | Progress mode | Regress mode |
|---|---|---|
| Made it in the grace window | +1.0 | +0.3 |
| Potty with permission | +0.5 | +0.2 |
| In-game accident (gear) | −0.5 | −1.0 |
| Missed wave | −0.3 | −0.6 |
| Stress-leak roll hit | −0.3 | −0.8 |
| Dry night | +2 | +0.5 |
| Wet night | −1 | −3 |
| Daily goal met (campaign) | +3 | −3 (the "goal" is to regress) |
| Real-life override ("I really needed to go") | **0** | **0** |

The **daily cap** is ±8 a day, so one bad day can't wreck a run. Each multi-week campaign has its own **floor/ceiling** (for example a "Weekend Little" run never drops below 30).

### 3.3 Curves
- **Decay toward a set point:** each day without play, C moves 2% of the distance toward `setPoint` (the quiz baseline). That stops idle drift.
- **Recovery (progress):** gains are scaled by `1 + (100 − C)/200`, so it's easier to climb from low values. That's the "rubber band".
- **Regression:** losses are scaled by `C/100 + 0.3`, so it's harder to fall the last few points. That gives a slow, satisfying descent into the final tiers.

### 3.4 Rest days and the safe pause
- **Rest day:** 1 in 7 is free. C is frozen, no curses, streak kept.
- **Pause:** the existing `campaign.pause()`, extended to freeze C, cancel native alarms (`native-notify.js`) and hide the meter. One tap, no penalty, no confirmation guilt-trip.
- **Sick/real-life mode:** pauses everything indefinitely and shows "Take care of yourself."

### 3.5 What C feeds

| Module | Parameter driven by C |
|---|---|
| `campaign.js` | rank = band (replaces the once-a-day ±1 step; daily `evaluate()` becomes "apply drift") |
| `simple-urge.js` | `levelIdx`, hold range ×(0.5 + C/100), dribble weight ×(1 + (100 − C)/100) |
| `alarm-grace.js` | grace multiplier (§2.3) |
| `engine.js` | pre-chime probability, fog |
| `natural-night.js` | wet roll odds = profile odds × (1.5 − C/100) |
| `messy-timer.js` | "From profile" level = C band ÷ 20 |
| `calendar.js` | daily C sparkline, plus a "C" column in exports |
| `potty-report.js` | trend text ("Control drifted −6 this week") |

---

## 4. Classes, perks, curses, modifiers and campaigns

All consequences are **in-game only**: they change gear *for the day's roleplay*, the prompts, the check-ins and the sim's own permission rules. Sensitive-skin rule (from community feedback, §6): a "change now" option is never blocked for more than 2 h.

### 4.1 Classes (pick one per run)

| # | Class | Start C | Passive | Weakness |
|---|---|---|---|---|
| 1 | Trainee | 70 | +20% grace | — |
| 2 | Office Agent | 75 | Office wording, prompts silent | Stress triggers ×1.2 |
| 3 | Sleepyhead | 60 | Dry night +3 C | Wet night −4 C |
| 4 | Fast Filler | 65 | Waits ×0.6, extra re-roll per day | Fill rate ×1.5 |
| 5 | Quiet One | 60 | Dribble rolls give XP | p_warn ×0.5 |
| 6 | Giggler | 65 | Laugh-trigger misses +2 C | Laugh leak ×1.5 |
| 7 | Caregiver's Charge | 50 | Caregiver can grant 2 permissions/day | No self-permission |
| 8 | Little Legend | 20 | Curses last half as long | No pre-chime ever |
| 9 | Rebel | 55 | 1 "veto a curse" token/day | Curses +1 tier |
| 10 | Scout | 70 | Spares +1 of each | Accident −1.5 C |
| 11 | Night Owl | 60 | Natural Night grace +50% | Mornings start Shaky |
| 12 | Roguelike Runner | 50 | Pick 1 of 3 perks per day | C resets per run |

### 4.2 Perks (positive)

| Perk | Effect |
|---|---|
| Iron Hold | First missed window of the day doesn't count |
| Early Bird | Pre-chime always on until 10:00 |
| Second Chance | 1 re-roll of any Simple Urge result per day |
| Hall Pass | 1 guaranteed potty permission |
| Thick Skin | Stress triggers ×0.5 for the day |
| Dry Streak | +1 C per consecutive dry night (max +5) |
| Spare Stash | +2 spares |
| Calm Bladder | Waves −1 |
| Clear Signals | Fog off for the day |
| Lucky Roll | Next d20 counts as max |
| Long Fuse | Wait ranges ×1.3 |
| Gold Star | Next +C gain doubled |

### 4.3 Curses / punishments (in-game consequences)

| Curse | Effect (game-only) | Duration |
|---|---|---|
| Diaper Day | Gear set to diaper for the rest of the day's roleplay | Until midnight |
| Pull-up Probation | Gear downgraded one tier | 4 h |
| Extra Check-ins | +1 check-in prompt per hour | 3 h |
| No-Permission Window | The sim answers "not yet" to potty asks; real need still always allowed | 30–90 min (rolls d4×20 min + 10) |
| Strict Rules | Grace ×0.6 | Rest of session |
| Lines | Type "I will ask before I go" ×10 in-app | Once |
| Chore | Pick a real chore card (tidy desk, water plants) | Once |
| Foggy Day | Fog 100% | 6 h |
| Short Fuse | Wait ranges ×0.5 | 3 h |
| Wave Storm | +2 waves per event | 2 events |
| Silent Treatment | p_warn = 0 | 4 h |
| Spare Tax | −1 spare | Once |
| Double Dribble | Dribble weight ×2 | 3 h |
| Report Card | Must log a mood note at the end of the day | Once |
| Babysitter Watch | Babysitter-profile check-ins switched on | 2 h |
| Early Bedtime | Natural Night suggested 1 h earlier | Tonight |

Curses never stack beyond 3 active. Each one shows its remaining time and a **"Remove (pause)"** link.

### 4.4 Daily modifiers ("day cards", draw 1 at 08:00, or 2 on a weekend)

| Card | Effect |
|---|---|
| Sunny Day | +10% grace |
| Rainy Day | Waves +1 |
| Hydration Day | Fill rate ×1.2 (in-game) |
| Lazy Sunday | Rest day |
| Pop Quiz | 3 random check-ins |
| Big Kid Test | Hit 5 windows → +5 C |
| Little Day | Mode = regress for today |
| Mystery Gear | Gear rolled d6 at start |
| Fog Bank | Fog 60% |
| Clear Skies | No fog |
| Lucky 7 | 7th roll of the day = go |
| Double or Nothing | C changes ×2 today |
| Caregiver's Choice | Partner picks the card |
| Speed Round | Waits ×0.7, gains ×1.5 |
| Quiet Office | Office wording all day |
| Snack Attack | 2 random drink bumps |
| Gentle Day | Curses off |
| Gauntlet | One Messy Holding gauntlet (messy on only) |
| Streak Shield | Streak safe today |
| Reverse Day | Progress↔regress swapped |
| Bonus Spare | +1 spare |
| Chill Pill | Waves −1 |

### 4.5 Streaks, rank-ups/downs, campaigns, events, boss days
- **Streaks:** 3/7/14/30 days in the campaign's direction → perk draw, title, +2/+4/+6/+10 C (or − in regress mode).
- **Rank change:** crossing a band edge plays a ceremony card and changes default gear. Demotions go down **one band at a time** with a 24 h "probation" in which a single good day restores the rank. That follows the community note that over-long demotions felt bad.
- **Multi-week campaigns:** *Potty Bootcamp* (28 d, progress, target C ≥ 85), *Slow Slide* (21 d, regress, floor 30), *Weekend Little* (Fri 18:00 – Sun 20:00, auto-resets to pre-weekend C), *Night Shift* (14 nights, Natural Night only).
- **Events:** random 1-in-10 daily: "Inspection" (log gear state), "Road Trip" (no permission for 1 sim hour, spares +1), "Sleepover" (babysitter voice for the evening).
- **Boss days:** every 7th campaign day. *The Long Meeting* (survive 3 waves with grace ×0.5), *Picnic* (stress triggers ×2), *Bedtime Boss* (dry night = +8 C). Win → perk; lose → one curse.

---

## 5. Playstyles

| Style | How it plays | Key settings / modules |
|---|---|---|
| **Stealth / office** | Neutral wording (type B), sound-only prompts in headphones, silent fog | `office-mode.js`, `prompt-output.js`, the Office Agent class |
| **Weekend regression** | A Weekend Little campaign. C drifts down Fri–Sun, then snaps back | Campaign floor, auto-restore |
| **Caregiver-led** | The partner holds permissions, draws cards and assigns curses (local share code or a second-device QR in future) | Caregiver's Charge, a `caregiver.js` (new) |
| **Roguelike runs** | Class + 1-of-3 perk each morning. A run ends at C = 0 or day 14, with a score of streak × days | Runner class, `ANALYSIS-traits-roguelike.md` |
| **Idle / background** | Simple Urge with one native alarm. Control drifts from logs alone | `simple-urge.js`, `messy-timer.js` |
| **Story mode** | Scripted chapters (Babysitter's Week, Summer Camp) using profile voices, with fixed boss days | `js/profiles/*.js` voices |
| **Co-op** | Two players share a "team C". Each player's accidents cost the team half | Future sync (open question) |

**Random #2 timer usage (v10):** with Settings → Messy content (#2) ON, open the Urge tab → **💩 Random #2 timer**. Pick a control level (or "From my profile"), set a minute range and tap **Start hidden timer**. The time is never shown. One native alarm fires at the hidden time. The prompt is a potty permission or a gear guide, and you then tap **Made it / Done / Not now**. It's blocked during Natural Night.

---

## 6. Research (non-sexual mechanics only)

| Source | Readable? | Mechanics extracted |
|---|---|---|
| faproulette.co/@Sampit7 | The profile page loaded: "Top Creator", 31 roulettes, no collections/posts. The individual roulettes weren't opened | **Skipped** on purpose: this is an adult site and the roulette pages are likely explicit. General roulette mechanics (digit-of-post-ID rolls, durations) are covered by the sources below |
| faproulette diaper / toilet-control categories | Not opened (adult site) | Skipped |
| ADISC "Potty training game/challenge" (2018) | Yes (search excerpt) | Baseline hold → round to an even number. **Checkpoints** at baseline ÷ 2. Pass N checkpoints → next stage, fail → back a stage. **Potty breaks** limited per stage and only usable at a checkpoint. **Penalties** for a missed potty, an unauthorised potty or running out of breaks. Running out of spares ends the stage. **Final rank** ladder (Toddler → Big-kid-adjacent → Big kid → Adult) |
| potty-trainer.tiiny.site ("Potty Training Simulator") | Yes (setup page) | Stages 0–6. Each potty ask = **two d20s** (one for permission, one for success/fail). A tally at each change decides promotion. **Difficulty** (Adult → Baby) scales success odds, time between attempts and punishment frequency. Starting gear level selectable. Achievements as collectibles. Save/load |
| ADISC "A game to play potty training" (nochoice.app) | Yes (thread excerpt) | Step-by-step instruction app. Minimum 2 h between attempts. Stay-in-gear-for-N-uses rules. **User feedback:** leak risk should depend on gear thickness, demotions felt too long (24 h+), faster re-promotion after a demotion, and an asked-for **sensitive-skin mode** (no more than 2 h in a used diaper) |
| nostr "ABDL ranking system G–S" | Yes | Identity tiers, not mechanics. Only the idea of letter-grade tiers is used |
| miniapps.ai "Diaper Dependency Trainer" | Description only | Framed as making the body *permanently* dependent with "no reversal". **Rejected**: it breaks this project's hard rule. The only idea kept is levels with points, which already exists |

**Takeaways adopted:** checkpoints/permissions only at defined moments (No-Permission Window), two-dice permission/success split (Shaky level), difficulty scaling of the punishment rate (class weaknesses), one-band demotion with fast recovery (§4.5), a sensitive-skin cap (§4), and save/load (exists).

---

## 7. Roadmap and open questions

| Pri | Item | Effort | File hooks |
|---|---|---|---|
| ✅ | Random #2 timer (v10) | done | `js/messy-timer.js`, `native-notify.js collectDesired()`, `index.html #messyTimerMount` |
| P1 | Control meter core (state, drift, caps, pause, rest day) | M (1–2 d) | new `js/control.js`, `campaign.js evaluate()/applyRank()`, `calendar.js addEntry` hook |
| P1 | Feed C → Simple Urge, grace, messy timer "From profile" | S | `simple-urge.js autoProfile()`, `alarm-grace.js graceMs()`, `messy-timer.js derived()` |
| P1 | Stress trigger buttons | S | `simple-urge.js render()`, `tables.js` `involuntary` tag |
| P2 | Hidden fill / fog + probabilistic warnings | M | `engine.js updatePressureUI()`, `campaign.js preChime` |
| P2 | Dribble chain + re-roll | S | `simple-urge.js st()/press()` |
| P2 | Night → day carry-over | S | `natural-night.js finish()` |
| P2 | Daily cards + curses/perks engine (data tables) | M | new `js/cards.js` + `tables.js` |
| P3 | Classes and roguelike run screen | M | `quiz.js` (start class), new UI section |
| P3 | Multi-week campaigns, boss days, events | M | `campaign.js` |
| P3 | Caregiver/co-op sharing | L | needs a sync design |
| P3 | e2e for each of the above | S each | `tests/ui-calendar.e2e.js` |

**Open questions for the user**
1. Should Control **replace** the campaign's daily ±1 rank step, or run next to it?
2. Default mode: progress, regress, or ask at the start of each campaign?
3. Daily cap: is ±8 right? Should rest days be automatic (every 7th) or chosen?
4. Should curses be opt-in per curse (a checklist), and which ones are off by default (Lines, Chores)?
5. Should the #2 timer's "From profile" level follow Control once it exists?
6. Caregiver mode: same device (pass the phone) or a second-device share code?
7. Should the sensitive-skin 2 h cap be always on or a setting?
8. Keep `fill` hidden in office mode too, or always show it there for discretion?
