# REVIEW v2 — Mechanics review and v11 design (Board Game centerpiece)

Branch `android-capacitor` @ `765fa3c`. Read-only review. The only change in this commit is this document.
Files read: `docs/ANALYSIS-roleplay-mechanics.md`, `docs/ANALYSIS-symptoms-classes.md`, `js/potty-report.js`, `js/simple-urge.js`, `js/campaign.js`, `js/messy-timer.js`, `js/natural-night.js`, `js/calendar.js`, `js/quiz.js`.

**Hard rules for every design below.** These are game rules only, and nothing here is real-body training. No sexual content. No laxatives, suppositories, enemas, restraints or chastity, and no forced large fluid intake. A drink prompt is at most **250 ml**, extra drink prompts total at most **1 L a day**, and they are never chained hourly (at least 2 h apart). Every public-place rule can be skipped. **A real urge always wins.** The app never infers fill or urgency. It always asks the user.

---

## 1. Review of current symptoms and mechanics

### 1.1 What works
| Area | Why it works | File |
|---|---|---|
| Simple Urge one-button flow | Urgency comes from the user (slider), there's one native reminder, chains lean toward "go", and "real urge wins" is printed | `js/simple-urge.js` `roll()`, `press()`, `pendingAlarm()` |
| Natural Night roll | Takes the urgency the user enters. Sips are capped at 5 and are *sips*, not volumes. Always silent | `js/natural-night.js` L45-53, `SIPS_CAP` |
| Campaign safety | Real accidents never count toward progress, and the "down" goals are sim-only | `js/campaign.js` `goalsFor()` (`simleaks`) |
| Campaign demotion bounds | It never demotes past the start/target band | `campaign.js` `evaluate()` L593-595 |
| #2 timer | Messy-gated, hidden, one alarm, "Not now" is never penalised, blocked during Natural Night | `js/messy-timer.js` |
| Report tone/voice | Office mode forces neutral wording, answers are paraphrased and never quoted, footer disclaimer | `js/potty-report.js` `voice()`, `FOOTER` |
| Calendar schema | Versioned (`SCHEMA = 4`), natural vs sim source split, protection leak stats | `js/calendar.js` L15, L339-351 |

### 1.2 Broken or inconsistent (bugs), with fixes
| # | Issue | Where | Fix |
|---|---|---|---|
| B1 | **Day vs night wear can contradict.** `recommendWear()` builds the night tier only from wet-night rate, saturation and leaks. `wearParas()` then separately says "During the day, keep wearing your {protDay}". Quiz A protDay = pull-ups with a low wet-night rate gives a "night: pad/none" plan beside "day: pull-ups". `protFeel === 'avoid'` can also step the night tier *down* below the day tier. | `potty-report.js` L116-124, L134-147 | After all adjustments, `t = Math.max(t, PROT.indexOf(base.protDay))`, and apply the same clamp after the `avoid` decrement. Add a `why` line: "night is at least as much as your daytime {x}". Rewrite the text so day and night come from one rec object `{day, night}`. If day ≥ pull-ups, say "night: the same or thicker". |
| B2 | Quiz `protNight` is ignored. `scoreA()` returns `protNight`, but `recommendWear()` never reads it. | `quiz.js` L94, `potty-report.js` | Use `protNight` as a lower bound when there are fewer than 3 logged nights, under the same rule (night ≥ day). |
| B3 | Broken "why" string. `ans()` is stubbed to `null`, so the reason prints *your quiz says wet nights: "—"*. | `potty-report.js` L53, L138 | Map the answer index to a paraphrase ("a few wet nights a month"), or drop the quote. |
| B4 | **App infers night wetness from sim saturation.** The bedwetting morning wrapper marks `wet` if `sat > satBefore \|\| sat >= 20`, and `leaked` if `sat >= 100`, then prefills the check-in. | `calendar.js` L948-958 | Open the check-in with **no prefill**: show wet/dry as unselected buttons, with the sim's guess shown only as a hint ("the sim rolled: wet"). Under the user decision, the user taps the answer. |
| B5 | **Night check-in pre-fills urgency/saturation from the sim sliders** ("On waking (prefilled from the sliders)"). | `calendar.js` L785-808 (`curUrg()`, `curSat()`) | Start the sliders unset ("—") and require a touch or "skip". Remove the "prefilled" label. |
| B6 | Simple Urge auto-profile *shrinks holds from calibration ml* (`medianMl < 250`). That's an inferred capacity, not a prompt. | `simple-urge.js` L246 | Keep it as an opt-in "Use calibration" checkbox that's off by default and labelled. Control (§3) drives hold instead. |
| B7 | Analysis docs specify a hidden `fill` meter, dribbles adding `+8 fill`, drinks adding fill bumps, and "fog" status. | `ANALYSIS-roleplay-mechanics.md` §2.1, §2.2, §2.6 | **Dropped** under the user decision. Replacements: Quiet Signals = fewer *warning prompts* and more "wait for dribble" rolls. Fast Fill = shorter waits. Dribble chain = count *user-pressed* dribbles (3 in 30 min → suggest a big roll). Nothing is ever estimated. |
| B8 | §3.5 "natural-night wet roll odds = profile × (1.5 − C/100)". Natural Night has no wet roll, and must never predict a real night. | analysis doc §3.5 | Strike it. Control only changes the *permission-to-get-up* chance (`ALLOW`). |
| B9 | Inventory vocabulary mismatch. Simple Urge has `pullup/diaper/none`, but the calendar, quiz and report use `none/pad/pullups/diapers/thick_diapers`. `change('diaper')` logs `diapers`, and `useGear` logs `pullups` for anything else, so pads and thick diapers can't be carried. | `simple-urge.js` L225-226, L303, L318 | Use one `PROTECTION_HIERARCHY` everywhere (via `BSCalendar.protectionOptions()`). Spares become a map keyed by those values (§5). |
| B10 | `DEF_INV()` always starts "wearing: pull-up, 2 spares + 1", whatever the profile or recommendation. The `day` field is stored but never used for a daily reset. | `simple-urge.js` L226, L294 | Default from the report rec (day tier) and prompt "New day: what are you wearing / carrying?" when `day !== today`. |
| B11 | #2 timer "From profile" (`auto`) maps the continence *level index* to a level, not Control. Permission denied always uses the same gear table. | `messy-timer.js` `derived()` L429, `outcome()` L447-453 | `derived()` reads `BSControl.band()`. Denial rolls from the new event table (§2.3). |
| B12 | Campaign "rest" = any day with **zero entries**, so missing days are unlimited free rests. `evaluate()` only runs when the tab renders. | `campaign.js` `scoreDay()` L575, `render()` L646 | Rest days are an explicit setting (§3.3). Unlogged days count as "idle" (no drift, no streak). Run `evaluate()` on app resume too. |
| B13 | Campaign runtime injects `hydrationMin 20/Max 50` and `sipMin/Max`. Make sure no engine path turns these into an ml prompt above the caps. | `campaign.js` L618 | Add a global `BSSafety.capDrink(ml)` (≤250 per prompt, ≤1000/day, ≥120 min apart) that all drink prompts must pass through. |
| B14 | Natural Night uses the global `currentContinenceLevel`, which may be the sim session's level, not the user's. | `natural-night.js` `levelIdx()` | Read the Natural Urge control setting (§2), falling back to the profile. |
| B15 | Quiz "triggers" add symptoms automatically (`overactive_bladder` if urgency ≥ 2). That's fine, since the user answered, but it's silent. | `quiz.js` L90 | Show "Suggested symptoms" with checkboxes (pick mode, §3.4). |

### 1.3 Places that must become prompts (no inference)
1. The morning check-in wet/dry, urgency and saturation (B4, B5).
2. Calibration capacity → hold length (B6, opt-in only).
3. Any "fill %" display or log reveal (B7, removed).
4. Report tone `toneFor()` uses the logged wet-night ratio. That's acceptable (user-logged data), but label it "based on your logs".
5. Simple Urge: urgency stays a required slider touch per press. Add a setting "Ask urgency every press" (default ON) instead of reusing `lastUrgency` silently.

---

## 2. Natural Urge control levels

### 2.1 The ladder
One selector on the Natural Urge tab: **Control: [Match my profile ▾]**, with options Good · Okay · Shaky · Little · None · Match my profile. "Match my profile" = the Control meter band (§3), else the Quiz A level.

| Level | Control band | Simple Urge base odds go/wait/hard/dribble/gear | Wait range (min) | Natural Night "may get up" | #2 permission | #2 early heads-up |
|---|---|---|---|---|---|---|
| Good | 80–100 | 45/30/15/5/5 | 20–45 | 80% | 100% | 0% |
| Okay | 60–79 | 35/30/15/10/10 | 10–30 | 65% | 85% | 0% |
| Shaky | 40–59 | 25/25/15/15/20 | 5–15 | 50% | 50% | 15% |
| Little | 20–39 | 15/20/10/25/30 | 2–8 | 36% | 15% | 35% |
| None | 0–19 | 8/12/5/30/45 | 1–4 (wait rarely shown) | 22% | 0% | 50% |

These reuse `BASE_W`, `HOLD` and `ALLOW` and the existing `LEVELS`, so they're a single source table (`js/control-levels.js`). The urgency the user enters still modifies them (×1.3 go and ×1.5 gear at ≥8, and so on). "Match my profile" re-reads each press, so a Control change mid-day takes effect immediately.

### 2.2 #2 timer per level
| Level | Default hidden range | Prompts |
|---|---|---|
| Good | 60–240 min | Permission. "Go when ready." |
| Okay | 45–180 | Permission, "head there now". 15% denial event |
| Shaky | 30–120 | Coin flip, then a denial event |
| Little | 20–90 | Mostly denial events, 1 heads-up |
| None | 20–60 | Denial event, 1 heads-up |

### 2.3 Push/permission event tables (non-graphic; "only if your body is ready, never strain")
**Pee: "May I go?" denial events (d8)**
| d8 | Event |
|---|---|
| 1 | "Not yet. Wait 10 min, then ask again." |
| 2 | "Finish what you're doing first (max 15 min)." |
| 3 | "Potty alert: you have 90 s to get there, or use your gear." |
| 4 | "Hold until it gets hard, then ask again." |
| 5 | "Wait for the first dribble, then you may go." |
| 6 | "Use your gear this time." |
| 7 | "Ask nicely: roll again with +15% permission." |
| 8 | "Mercy: go now, +1 star." |

**#2 denial events (d10, messy only). Replace the single gear outcome**
| d10 | Event (wording only, no detail) |
|---|---|
| 1 | "Not now. The timer re-arms for 15–30 min." |
| 2 | "Potty alert: 90 s countdown to reach the potty, else gear." |
| 3 | "Stay where you are. Gear if it happens; if not, that's fine." |
| 4 | "Finish your task first; ask again after." |
| 5 | "Sit-down rule: if you can, sit for a few minutes before deciding (no straining)." |
| 6 | "Gear this time (guide from `MESSY_PUSHING_ACCIDENTS_D10`)." |
| 7 | "Change roll afterwards: change now / in 30 min / at next check-in." |
| 8 | "Star gamble: wait it out for +2 stars, or go now for 0." |
| 9 | "Lucky: permission granted." |
| 10 | "Re-roll with your level one step better." |

"Not now" / "My body isn't ready" is always present and costs nothing. A real need overrides the result and is logged as "real override" (0 Control drift).

---

## 3. Control meter v2

### 3.1 Model
`bs_control_v1 = { value 0-100, direction: 'progress'|'regress'|'hold', dayDelta, lastDay, restDaysPerWeek, history[90], acquired[] }`. It runs **alongside** the campaign rank, and neither replaces the other. Campaign keeps its daily goal ladder. Control is a continuous meter that feeds §2 "Match my profile". The campaign shows Control as a sub-bar, and a campaign promotion gives a +3 Control bump.

### 3.2 Drift (day and night both count)
| Event (user-logged or sim roll) | Progress | Regress |
|---|---|---|
| Potty with permission / in grace | +1.0 | +0.3 |
| Potty alert 90 s made | +1.5 | +0.5 |
| Sim gear outcome used | −0.5 | −1.0 |
| Dry morning check-in (user answered) | +2 | +0.5 |
| Wet morning (sim or user's choice to count) | −1 | −3 |
| Daily goal / board day passed | +3 | −3 |
| Real override, "Not now", skipped public rule | 0 | 0 |

The cap is **±8 per day**, configurable 4–12. Natural (real) entries count only if the user turns on "count my real logs" (default OFF, carried over from the campaign safety rule).

### 3.3 Rest days
The **default is 1 rest day per 7**, auto-applied to the first unplayed day of the week, plus a manual "Rest today" button. Settings: 0/1/2 per week, or "unlimited (idle days never count)". On a rest day Control is frozen, the streak is kept and no curses fire. Unlogged non-rest days are **idle**: no drift and no streak increment, which avoids guilt.

### 3.4 Symptom/curse acquisition modes
Setting **Acquire: Pick · Earn · Random · Mixed** (default Pick + Earn).
- **Pick:** choose at start, add or remove any time in Settings.
- **Earn:** a streak or result unlocks a card. In regress mode it gets added; in progress mode it gets removed (cleansed).
- **Random:** a weekly draw from the enabled pool (the user disables anything they dislike).

| Card | Type | Effect (sim only) | Earn trigger (regress) / cleanse (progress) |
|---|---|---|---|
| Quiet Signals | symptom | fewer warnings, dribble weight ×1.8 | 3 sim gear days / 5 dry days |
| Fast Fill | symptom | waits ×0.6 | 3 short-wait fails / 4-day pass streak |
| Urge Waves | symptom | +1 "hold-till-hard" weight, alarm grace ×0.8 | 2 missed alerts / 3 alerts made |
| Giggle/Sneeze Leaks | symptom | logged trigger buttons roll a micro | user logs 3 triggers / never auto |
| Sleepy Bladder | symptom | night "may get up" −15% | 2 wet sim nights / 3 dry |
| Pre-void Dribbler | symptom | "wait for dribble" before any go | — |
| Lines | curse (chore) | write N lines in the in-app box (N 5–20) | missed goal |
| Chores | curse | pick 1 from the user's chore list | missed goal |
| Thicker Tonight | curse | night protection one step up (sim/RP) | wet sim night |
| No Spares | curse | the carried-spares count drops by 1 for the trip (RP only, skippable) | supply used |
| Ask Twice | curse | every May-I-go needs 2 permissions | 2 denials ignored |
| Star Tax | curse | −2 stars | — |
| Golden Ticket | perk | one guaranteed "go" | 3-day streak |
| Mercy Charm | perk | cancel one denial | 5 stars |

The Lines/Chores lists and N are editable. Every curse has "skip (counts as rest)".

---

## 4. Messy quiz outline (only when Messy is ON)
A separate "Quiz M", 8 questions, shown only when `isMessyEnabled()`. It feeds `BSMessyTimer` defaults and the §2.2 table.
| # | Question | Use |
|---|---|---|
| 1 | Usual #2 frequency in real life (per day/week) | hidden-range default (user-stated, not inferred) |
| 2 | Typical time of day | timer window preference (morning/after meals/any) |
| 3 | How much warning you get | heads-up chance |
| 4 | In-game control level you want | ladder level / "match profile" |
| 5 | Which gear you'd use in-game | links to the protection list |
| 6 | Allowed outside home? (default No) | public-place rules off |
| 7 | Change-roll preference (immediate / delayed / random) | change table |
| 8 | Event intensity: gentle / standard / spicy-but-non-graphic | which denial rows are enabled |

All answers can be edited later. The app never derives #2 timing from any other data.

---

## 5. Out-and-about kit
Reuse `BSCalendar.protectionOptions()` (none/pad/pullups/diapers/thick_diapers) as the only list (fixes B9).

**State** `bs_outabout_v1 = { active, startedAt, place?: 'home'|'out', wearing, wearUses, carried: {pad, pullups, diapers, thick_diapers, wipes, bag}, lowAt: 1 }`.
| Feature | Behaviour |
|---|---|
| Leave home | A sheet asks what you're wearing plus steppers for what you're carrying, defaulting to the last trip or the report's day rec. |
| Status chip | "🎒 Out: pull-up (used 1×) · spares 2 PU / 1 D" on the Urge tab and the board. |
| Gear outcome | `wearUses++`. If uses ≥ the setting (default pads 1, pull-ups 1, diapers 2, thick 3), show the **change prompt**: "Change when convenient / at next restroom / now". Always skippable and never mandatory in public. |
| Change | Pick from the carried types (disabled if 0), decrement, log a calendar `event` with protection. |
| Low supply | ≤ `lowAt` spares: amber warning. 0: red, "Head home or restock (tap when restocked)". The game rule switches to "May I go?" leaning permissive (no gear-forcing without spares). |
| Return home | Summary: used, changed, remaining. Restocks the home stash (optional `home` counts). |
| Sensitive skin | Setting "max uses before change" and "max hours worn" (user-set; the app just reminds). |

---

## 6. BOARD GAME MODE (centerpiece)

### 6.1 Concept
"**Potty Path**". A 60-square snakes-and-ladders board played over days. Its position is a third progress view next to Campaign rank and Control. The default is 60 squares; 40 (Long Weekend) and 100 (Marathon) are optional.

**Direction choice at start:**
- **Grow Up** (progress): start at square 1 (Baby) and race to 60 (Big Kid / Grown-up).
- **Little Slide** (regress): start at 60 and race down to 1. Ladders and snakes swap meaning, so "good" means moving toward your chosen goal.
- **Free play**: no goal, only stars.

### 6.2 Level zones
| Squares | Zone | In-game rules applied (via §2 ladder) | Night routine |
|---|---|---|---|
| 1–12 | 👶 Baby | Control "None/Little", gear default diapers | thick + "may get up" low |
| 13–27 | 🧸 Toddler | Little | diapers/pull-up |
| 28–42 | 🎒 Preschool | Shaky | pull-ups |
| 43–54 | 🩲 Big Kid | Okay | pull-up/pad (≥ day) |
| 55–60 | 🎓 Grown-up | Good | user choice |

Zones only set the defaults of "Match my profile" while the board is active. The user can lock their own level instead.

### 6.3 Moving
| Source | Move |
|---|---|
| Daily roll (one per day, morning) | 1d6 |
| Dry/clean morning check-in (user-answered) | +2 |
| Potty success with permission | +1 (max +4/day) |
| Potty alert made | +2 |
| In-game gear outcome | −1 (Grow Up) / +1 toward goal (Little Slide) |
| Two successes in a row (Long Weekend rule) | bonus +1 |
| Real override / Not now | 0 |
| Daily cap | ±12 squares (setting), consistent with the Control cap |

Moves animate one square at a time. Landing resolves the square.

### 6.4 Ladders and snakes
- **Ladders (toward goal):** 3-day streak, perk use, star shop "ladder ticket", campaign rank up, a whole dry day. Example: 8→19, 21→33, 36→47, 50→58.
- **Snakes (away from goal):** a sim accident on the alert square, a curse card, ignoring Ask Twice. Example: 17→6, 31→24, 44→29, 57→41.
- **"Permanent Baby" safety net:** falling back to square 1 three times in a week unlocks the "Diaper Fortress" badge, never a lock-in. The user can always reset or flip direction.

### 6.5 Special squares
| Icon | Square | Effect |
|---|---|---|
| ⭐ | Star shop | spend stars: perk, re-roll, ladder ticket, skip curse, cosmetic tokens |
| 🌙 | Nighttime routine | sets tonight's routine: protection (≥ day), "may get up" odds, optional ≤250 ml bedtime drink (capped) |
| ⏱ | Potty alert | an instant 90 s countdown: reach the potty → +2; else gear. Can be skipped if public or busy (counts as rest) |
| ❓ | Mystery card | draw from the §2.3/§3.4 pools (enabled cards only) |
| 🛋 | Rest | Control is frozen today, and no curses fire |
| 🔔 | Hidden alarm | starts a 60–90 min hidden timer. When it sounds, "go where you are or lose the chance" (game rule; gear or potty per level; skippable) |
| 🙋 | May I? | the next 3 urges use the May-I-pee table |
| 🔄 | Change roll | change now / 30 min / next check-in |
| 📝 | Task | a chore or lines from the user's list |
| 🏁 | Zone gate | needs N dry check-ins (e.g. 2) to pass; otherwise stay |

### 6.6 Sample board (60)
| Sq | Type | Sq | Type | Sq | Type |
|---|---|---|---|---|---|
| 3 | ⭐ | 23 | 🔔 | 43 | 🏁 Big Kid gate |
| 5 | ⏱ | 24 | 🛋 | 44 | snake → 29 |
| 8 | ladder → 19 | 27 | 🏁 Preschool gate | 46 | ⏱ |
| 10 | 🌙 | 30 | ⭐ | 48 | 🌙 |
| 12 | 🏁 Toddler gate | 31 | snake → 24 | 50 | ladder → 58 |
| 14 | ❓ | 33 | 🙋 | 52 | 📝 |
| 17 | snake → 6 | 36 | ladder → 47 | 54 | 🏁 Grown-up gate |
| 19 | 🔄 | 38 | ❓ | 57 | snake → 41 |
| 21 | ladder → 33 | 40 | ⏱ | 60 | 🏆 finish |

### 6.7 Phone UI concept
- The board is a vertical serpentine path of 6 × 10 tiles (scrolls to the current zone), colour-banded by zone, with ladders as green ribbons and snakes as purple ones.
- The token is an emoji avatar you choose (🐻🦖🚀). Zone mascot on top.
- The sticky footer has **[🎲 Daily roll] [✅ Check-in] [🙋 I need to go]**.
- The progress chart under the board is a 14-day strip of day icons (☀️ dry, 💧 sim wet, 🛋 rest, ⭐ stars earned), like the Long Weekend chart.
- The 90 s potty alert is a full-screen ring countdown with a big "Made it" / "Didn't" / "Skip".
- Office mode shows neutral tiles ("Step 23") and hides zone names.

### 6.8 Integration
| System | Integration |
|---|---|
| Calendar | each move = `event` entry `{mode:'board', from, to, reason}`. Day icons are derived from existing entries |
| Control | board moves and Control drift come from the same events. Zone sets the "Match profile" default |
| Campaign | optional link: a zone gate = a campaign rank goal. Rank up = a ladder |
| Simple Urge / #2 timer | outcomes report back to the board (`bs:outcome` event bus) |
| Natural Night | the 🌙 square pre-sets the routine. Night results count only on user check-in |
| Stars | shared wallet `bs_stars_v1` (1-day-in-diaper star shop) |
New file `js/board.js` (state `bs_board_v1 = {dir, size, pos, stars, history, lastRollDay}`, pure `move()` and `resolve()` for tests).

---

## 7. Ideas you may not have considered, and remaining concerns
| Idea | Why |
|---|---|
| Privacy lock (PIN/biometric via Capacitor) plus a neutral icon/name option | shared phones |
| Notification text always neutral by default | lock-screen exposure (some alarm bodies say "#2 timer") |
| Data separation: export/import, "wipe all", and a separate real-log vault vs game data | keeps real health logs clean |
| Panic / "hide now" gesture | switches to office mode instantly |
| Accessibility: large tap targets, haptic-only alerts, screen-reader labels on the board, colour-blind-safe zone patterns | — |
| Quiet hours (no alerts at work or school) and a location-free "I'm out" toggle | public-place skippability |
| A global safety module enforcing drink caps and alert spacing | one audited place (B13) |
| Unit tests for `move()`, the drift cap and the wear clamp (B1) | regressions |
| Health nudge: if real logs show a sudden change, the report suggests seeing a doctor (exists in the footer, so surface it) | — |

**Remaining concerns:** the "count real logs" toggle must stay off by default. Hidden alarms must respect quiet hours and Natural Night silence. Make sure regress mode never frames real incontinence as a goal (copy review). Stars and curses shouldn't create pressure to skip real bathroom trips. Every denial row keeps "real urge wins".

---

## 8. Proposed v11 scope (prioritized)
| P | Item | Effort | Files |
|---|---|---|---|
| P0 | Wear logic: night ≥ day clamp, protNight lower bound, fix "why" string (B1-B3) plus tests | S | `js/potty-report.js` |
| P0 | Remove inference: blank check-in prefill, sliders unset, calibration opt-in, ask urgency each press (B4-B6) | S | `js/calendar.js`, `js/simple-urge.js` |
| P0 | `BSSafety.capDrink` and alert spacing (B13) | S | new `js/safety.js`, `campaign.js`, `natural-night.js` |
| P1 | Unified protection list and inventory, daily reset, Out-and-about kit (B9, B10, §5) | M | `simple-urge.js`, new `js/outabout.js` |
| P1 | Control meter v2 (alongside rank, ±8 cap, rest default 1/7) (§3) | M | new `js/control.js`, `campaign.js` (B12) |
| P1 | Natural Urge ladder plus "Match my profile"; #2 "From profile" → Control; denial tables (§2, B11, B14) | M | new `js/control-levels.js`, `messy-timer.js`, `natural-night.js`, `tables.js` |
| P1 | **Board Game Mode** MVP: 60 squares, both directions, daily roll, ladders/snakes, 6 special squares, day chart | L | new `js/board.js`, `css`, `index.html` tab |
| P2 | Symptom/curse acquisition (pick/earn/random), Lines/Chores editor, star shop | M | `control.js`, new `js/cards.js` |
| P2 | Messy quiz (Quiz M) | S | `js/quiz.js` |
| P2 | Privacy lock, neutral notifications, wipe/export split | M | `native-notify.js`, settings |
| P3 | 40/100-square boards, hidden-alarm square, accessibility pass | M | `board.js` |

Update the analysis docs to strike the hidden-fill sections (B7, B8) when P0 lands.

---

## Appendix A — v11 implementation notes (board game NOT in this build)
- **A / P0:** B1-B3 wear rec `{day, night}` with night ≥ day clamp, quiz `protNight` floor (<3 logged nights), paraphrased "why". B4-B5 check-in opens blank (sim roll shown as hint only, answer required, sliders unset). B6 calibration → wait link is opt-in (off). B9-B10 one protection list (`none/pad/pullups/diapers/thick_diapers`) for supplies, old `pullup/diaper` migrated, daily "New day: what are you wearing / carrying?" prompt, default from report day rec. B11/B14 #2 timer "From my profile" and Natural Night read the Natural Urge control level. B12 rest days 1/7 default (0/1/2/unlimited), idle days pause the streak, `evaluate()` on resume. B13 `js/safety.js` (`capDrink` ≤250 ml/prompt, ≤1 L/day, ≥2 h apart; `capSips`, `capText`) wired into engine drink prompts, hydration alarm and bedwetting refill/bedtime text.
- **B:** Control ladder Full/Good/Okay/Shaky/Little/None + Match my profile (`js/control.js` LADDER) + custom profiles (name, wait range, odds, hidden-wait, traits). Little/None hide wait times by default.
- **C:** `js/accident.js` natural accident sheet (from Simple Urge waits, #2 timer, quick session, running sim session, and an always-visible button). "Count accidents during waits toward progress/regress" default ON (user-confirmed) → Control `failed_wait` (−2) and campaign cap / regress-leak goals.
- **D:** `js/natural-session.js` quick natural session.
- **E:** custom Simple Urge events + per-level outcome tables, export/import JSON.
- **F:** Control meter 0-100, daily cap ±8 (4-12), direction per campaign.
- **Campaign:** setup reachable from the Session start modal (🏅 Campaign) with optional short quiz (experience, starting level, direction, pace, play style) or "skip — defaults"; play style Natural rolls / Sessions required / Either; optional fixed length (7/14/30/custom days) or open-ended.

## Appendix B — DryDawn research (for UX ideas only)
Sources: App Store listing, Apptitude portfolio page, Belgian flyer (drogenachten.be). DryDawn is a **paediatric bedwetting diary** (ICCS steering committee, Ferring-funded), not a potty-training game. Its own site was not opened; listing/flyer text only.
Observed mechanics: (1) setup asks "diary for N days" and lets you create it today and start tomorrow; (2) two modes — *simple* wet/dry night diary and *detailed* drinks + output diary; (3) a mascot (Ingolf) earns clothing via medals/stars **for logging an entry, not for being dry**; (4) reminder notifications to log; (5) tips of the day; (6) PDF report for a clinician (wet/dry nights, intake, nocturnal output, expected capacity), 12+ languages.
Borrow (non-explicit, fits this build): rewards for *logging* rather than outcomes (avoids pressure, matches "real urges always win"); "start tomorrow" option + fixed diary length (done: campaign length toggle); simple vs detailed check-in mode; one gentle daily "log your morning" reminder (respecting quiet hours / Natural Night silence); a short tip line on the Urge tab; mascot/avatar personalisation later with the board game. Not borrowed: weighing diapers / volume measurement (conflicts with no-inference rule unless user-entered).
