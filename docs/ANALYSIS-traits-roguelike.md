# Analysis: Classes / Traits, Roguelike Multi-Day Mode, Timer Mechanics & Progression Arcs

Scope: design notes only. **Nothing from the attached "Rank Trainer" project has been ported into the code.** This doc is about mechanics: what happens, when, and how likely. It keeps descriptions non-graphic. Everything here is meant for consenting adult self-play. Bedwetting mode must stay **totally silent**. Any new timer, roll or reminder below must check `isBedwettingSilent()` before it makes a sound, vibrates, schedules a notification or sends a hydration prompt. The best place to enforce that is one shared helper (see Roadmap P0).

---

## 1. The attached project ("Rank Trainer" v16 / v19, "May I Pee?")

### 1.1 How its class system works
- **One active class at a time.** `state.classId` holds it, the header shows it as a chip (`#classChip`), and you can pick it or roll it at random (`rollClass()`, which also has a "chaos" re-roll).
- **A class is data, not code.** It is a small record: `{id, name, dice, card}` plus a `CLASS_MOD[id]` rules sentence.
  - `dice`: `single` rolls 1d20. `low` rolls 2d20 and keeps the lower result (Hypno, the kinder class). `high` rolls 2d20 and keeps the higher result (Unlucky Draw, which also has longer waits). This changes the odds a lot without new tables. It is advantage/disadvantage from tabletop games.
  - `card`: a short rules text shown to the player, like a trait card.
- **Tables are keyed twice, by class and then by wear rank:** `PEE_CLASS[class][rank]`, `ACCIDENT[class][rank]`, plus `CHANGE/DRINK/TASKS/PUNISH[rank]`. A roll looks up `tableFor(klass, worn)`, so each class has its own flavour at each protection level.
- **Ranks are a points ladder** (`RANKS`: panties 0–5, pad 6–20, goodnite 21–48, diaper 49+). Accidents and extra wetness add points (`addPts`). The rank sets the *allowed* protection tier. What you are actually *wearing* is a separate value (`state.wear.kind`), and the UI keeps the two apart ("Allowed rank now X, you are still wearing Y").
- **Some class rules change the flow itself**, not just the text:
  - *Leaky*: every roll starts "as if a leak already started". Its main mechanic is the wait until the next dribble.
  - *Toddler*: restricts which movement cues can appear.
  - *Plastic*: a contained leak doesn't count as wet clothes.
  - *Lazy*: lets you finish your current activity during long waits.
- **v19 "leak mode" starts from an event that is already happening.** The home card says "this is not a permission roll, you already started." Once a natural dribble begins, you open Leak and roll. The result is one of three kinds:
  - `natural`: let it finish or stop on its own
  - `visible`: a hold timer shown on screen, then release when it ends
  - `hidden`: a timer you can't see, then release
  
  Results can chain, e.g. "short visible hold, then a surprise second wave". It also has a separate posture table (`POS`) and timed "push" steps.

### 1.2 UI ideas worth borrowing (look only, not code)
- **Sticky header with chips** (class · wearing · wet % · mods/allowed). Each chip shows one value you can read at a glance. In this app, the session panel could show chips for Profile · Protection · Continence · Active traits · Run day.
- **A dashed "instruct" box** at the top that always says what to do next (`nextInstruct()`). This app's log is long, so one pinned "Next:" line would help on mobile.
- **Cards with a soft drop shadow, pill buttons, screens instead of one long scroll** (`go('leak')`), and a 480px max-width column. This app already has panels. A tab bar (Session / Log / Calendar / Run) would suit Android better.
- **A thin progress bar** for wetness (`#wetBar`). Reuse it for the hidden-bladder "feel" meter and for run progress.
- Their palette is a light pastel pink. Ours is dark navy. A **"Pastel" theme toggle** (CSS variables only) would capture that look without forking styles.

---

## 2. Integrating classes / traits / perks / trait cards into this app

### 2.1 Where the hooks already exist
| Concept | Existing hook |
|---|---|
| Event odds | `prerollEvent()`, `rollMicroForMode()`, `microTableForMode()` (engine.js) |
| Timing windows | `scheduleMainEvent(windowOverride)` (engine.js); `getProfileConfig()` (profile-config.js); custom `customProfileRuntime.mainMin/mainMax/microsPerCycle/pressureAcceleration` |
| Babysitter odds | `hasSymptom()`, `hasCurse()`, continence levels, `pottyPasses` (babysitter.js / omorashi.js) |
| Outcomes | `trackSessionStat()` (profile-logic.js) → `trackDayEvent()`; calendar auto-log (calendar.js) |
| Guides | `startVoidGuide(seq, text, type, trackingOutcome)` (guide.js) |

`hasSymptom`/`hasCurse` are already a trait system for Babysitter only. Generalise that.

### 2.2 Proposed data model (`js/traits.js`, new)
```js
TRAITS = {
  leaky_start: { name:'Already Leaky', kind:'class', card:'Sessions begin mid-dribble; first micro fires in 1–3 min.',
                 mods:{ firstMicroWindow:[1,3], microWeight:+0.15 } },
  iron_hold:   { name:'Iron Hold', kind:'perk',  mods:{ dice:'low', holdChallengeBonus:+10 } },
  unlucky:     { name:'Unlucky Draw', kind:'curse', mods:{ dice:'high', mainWindowMult:1.15 } },
  giggle:      { name:'Giggly', kind:'quirk', triggers:['onLaugh'], mods:{ microChanceOnTrigger:0.3 } },
  ...
}
```
- **Kinds**:
  - **Class**: one per run or session. Sets the dice mode and the table flavour.
  - **Perks**: positive, picked up during play.
  - **Curses**: negative. They come attached to rewards, or are added by difficulty.
  - **Quirks**: neutral flavour plus an occasional trigger.
- **One resolver, `applyTraitMods(ctx)`**, called from:
  - `scheduleMainEvent`, to multiply the window
  - `prerollEvent`, to reweight tables and apply dice mode
  - guide completion
  - `requestRestroomPermission`

  Use the Balatro idea: every trait effect is one of a few verbs: `window×`, `weight+`, `dice`, `pass±`, `sat+`. Effects then stay readable and stack in a predictable way.
- **Trait cards (UI)**: show each active trait as a small card in the session panel, with icon, name and one-line rule text, colour-coded by kind (perk green, curse red, quirk lilac). Tap a card to see its modifiers. **Draft moment:** at session start or each run day, offer 3 cards and the user picks 1 (Slay the Spire card reward). A curse can be the "cost" of taking a strong perk.
- Persist active traits in the session state (`session.js` save/restore), so native-notification catch-up and resume keep working.

### 2.3 Earlier liked ideas, mapped onto traits
- **Weighted waits**: trait `mainWindowMult` and skewed distributions, e.g. `min + (max-min)*u^k`. With k>1 more events land early, with k<1 more land late. Put this in `scheduleMainEvent` in place of `randInt`. The new override button (`js/override-next.js`) already uses fractional minutes, so the plumbing is proven.
- **Unreliable pre-chime / urgency waves**: today `startChime` fires a fixed 15s before the event. Add a trait `preChimeReliability` (0–1). With probability 1−r the chime is skipped or fires falsely, and it can come as 1–3 "waves" at random offsets before the event. **Never in bedwetting mode.**
- **Hidden bladder state**: see §4.1. Traits change the fill rate and capacity.
- **Hold challenges**: a timed "hold for N seconds" guide (gauntlet steps already exist), offered when urgency is high. Success gives a perk point or potty pass. Failure turns into a normal micro.
- **Trait cards**: as above.

---

## 3. Roguelike mode playable over several days

### 3.1 Structure
- **Run**: 3–14 "days". A day is a real calendar day with one or more sessions, plus a night if the user does a night check-in.
- **Daily roll** at the first session of a day (or on the morning check-in):
  - roll the day's **Omen** (modifier, e.g. "Humid: +20% micro weight")
  - offer a **trait draft** (pick 1 of 3)
  - set the **daily objective** (e.g. "3 potty successes", "no partials before noon", "dry night")
- **Persistent hidden state** across days (localStorage `bs_run_v1`). The user doesn't see the exact numbers, only hints and meters:
  - `continence` (0–100, drifts)
  - `hiddenFill` (the §4.1 bladder model)
  - `fatigue` (rises with long sessions)
  - `luck` (pity timer: after N bad rolls, the next one is guaranteed kinder)
- **Escalating difficulty**: a small heat bump each day (e.g. main window ×0.97, micro weight +3%). The user can also take extra **Heat/Ascension rungs** for a bigger reward (Hades Heat, StS Ascension). Rungs are stacking rule changes, never hidden stat inflation.
- **Run-ending conditions** (choose a direction at run start; see §5):
  - *Continence-direction*: run ends at K accidents in one day, or 2 wet nights in a row. You "win" by finishing D days.
  - *Dependence-direction*: the run's goal is reaching a continence or protection threshold. It "ends" at the goal or at D days.
  - Always: a manual "End run" button, with no penalty beyond losing the run's rewards.
- **Rewards / unlocks**:
  - Day clear: a perk draft or a potty pass.
  - Objective met: score.
  - Boss day (every 3rd or the final day): a hard objective, e.g. a long hold challenge or a fixed hard Omen.
- **Meta-progression** (between runs): only **unlocks and options**, never raw power (lesson from StS):
  - new trait cards enter the pool
  - new Omens
  - cosmetic themes (e.g. the pastel look)
  - higher heat rungs
  - "codex" entries
  
  Even a failed run gives a small guaranteed payout (Hades).

### 3.2 Using calendar data (`bs_calendar_v1`)
The calendar is the run's history and the input to its scoring:
- Night entries (`type:'night'`, `night.wet/leaked/protection/urgency/saturation`) resolve **night objectives** and feed `continence` drift.
- Auto-logged `accident/partial/potty/major/micro` entries count toward daily objectives. They already have timestamps, so "before noon"-style objectives are easy.
- Streaks (`calendarStats().dryStreak`) can unlock perks such as "5 dry nights → Steady Sleeper" (cf. DrySky's trophy every 5 dry nights).
- Tag calendar entries with `runId`/`day` so a run summary can be rendered on the month view (e.g. a coloured underline for run days).

---

## 4. More timer-based approaches

### 4.1 Hidden bladder model (continuous)
- `fill += rate(t) * dt`. `rate` comes from hydration logs, a time-of-day curve and traits.
- Urgency is a noisy function of fill (`urgency = f(fill) + wave(t)`), so the user feels **urgency waves** rather than a linear bar.
- Event chance per tick is a hazard function, e.g. `h = base * exp(k*(fill-cap))`, instead of a fixed timer. Events cluster when the bladder is full and are rare after a potty success.
- Implement it as a 30–60s tick in the existing `tickInterval`, and keep `mainEndAt` as a *forecast*. That way `native-notify.js` can still schedule exact notifications (it reads `mainEndAt`). Re-forecast after each tick and call `nativeNotifySync()`.

### 4.2 Continence decay / dribble states
- A small state machine: `dry → urge → dribbling → (stopped | flowing) → empty`.
  - During `dribbling`, a **re-roll every 20–60s** decides between stop, keep going and escalate. This mirrors the attached project's "roll once a natural dribble has started".
  - Each re-roll is a short guide step. The `hidden`/`visible` timer split maps to showing the guide countdown or hiding it (`hideCountdown` already exists).
- **Continence decay**: each accident lowers `continence` a little. Each potty success or completed hold challenge raises it. Decay pressure is stronger at night or with fatigue.

### 4.3 "Already incontinent" start
A class or Omen that starts the session in the `dribbling` state. The first event is a dribble roll within 1–3 min instead of a full wait. This works with the override control from this commit (`overrideNextMajorEvent`) and a matching micro override.

### 4.4 Time-of-day curves
- A multiplier table by hour, e.g. morning ×1.3 (first-void urgency), after meals ×1.15, late evening ×1.1, plus a user-set "quiet hours" ×0.
- Read in `scheduleMainEvent` and in the micro scheduler. Show the current multiplier as a header chip.

### 4.5 Rolling during an in-progress leak
- While a guide of type `micro`/`full` is running, the void overlay can show a **"Roll"** button. It draws from a short "in-progress" table (stop now / small extra / continue to empty / brief hold, then a second wave). The result is appended to `currentGuideSeq`.
- Tracking still goes through `trackGuideCompletionOutcome`, with the final severity winning.

---

## 5. Long-term progression arcs (consenting adult self-play, both directions)

Both arcs are opt-in, can be paused or reversed at any time, and stay purely game-mechanical. Each arc is a ladder of **stages**. Moving up a stage depends on calendar data over a rolling window (e.g. 7 days), never on a single day.

### 5.1 "Potty training" arc (toward more continence)
- Each stage sets: main windows (longer), micro weight (lower), potty permission rate (higher), suggested protection one tier down (`PROTECTION_HIERARCHY`), and a night goal.
- Advance when the rolling 7-day window meets the targets (≥X potty successes per day, ≤Y accidents/week, ≥Z dry nights in 7). Calendar stats already compute accidents/week and dry streak.
- Rewards: perk unlocks such as "Steady" (dice low) and a "big kid" badge per stage (the DryTracker / DrySky streak-celebration pattern).
- Relapse rule: missing targets for 2 windows in a row drops one stage, softly. No streak shaming, in line with tracker-app tone.

### 5.2 "Diaper training" arc (toward less continence)
- The mirror image: shorter windows, more micros, permission rarer, protection one tier up, more frequent "already leaky" starts, and nightly wet chance up (simulated only).
- Advance when protection use and acceptance targets are met (e.g. logged changes, completed release guides).
- A safety valve is always shown: "Pause arc", "Step back a stage" and a **Mercy** toggle (already exists as `toggleMercy`).

### 5.3 Shared
- Arc state lives in `bs_arc_v1`: `{direction, stage, history[]}`.
- Arc stage feeds `getProfileConfig()` overrides, so every profile benefits.
- Bedwetting nights only *read* the arc (adjust the wet chance in `bedwettingMorningCheck`'s overnight roll). They never add alarms.

---

## 6. Research notes

**Roguelikes / deckbuilders**
- *Slay the Spire*:
  - Run power is temporary. Meta-progression is unlocks plus Ascension, a ladder of stacking handicaps. Nothing raw carries between runs.
  - Relics are passive hooks that fire on every trigger.
  - Curses are the price attached to big rewards. Insurance relics exist to counter them.
  - What to copy: trait cards as hooks, curses bundled with perks, an Ascension-style heat ladder for the run.
- *Balatro*:
  - Every effect is one of four verbs (+chips, +mult, ×mult, $), colour-coded.
  - Escalating "blind" targets race a compounding engine.
  - What to copy: a small verb set for trait effects and escalating daily objectives.
- *Hades*:
  - Player-chosen Heat (opt-in difficulty for better rewards).
  - A guaranteed payout even on failed runs.
  - What to copy: opt-in heat, and failure that still progresses meta unlocks.
- Pity timers / bad-luck protection (common in gacha and roguelikes) suit the hidden `luck` stat.

**Habit / bladder-diary / bedwetting tracker apps**
- *DryTracker*:
  - Colour-coded monthly calendar (green dry / red wet / not recorded).
  - Best streak, 30-day dry %, 7-day rolling trend.
  - On-device only, no account.
  - The new calendar follows this pattern. The 30-day dry % and a trend chart are good next additions.
- *DrySky*:
  - Logs dry / damp / wet, wake-up patterns, fluids and toilet trips, with correlation.
  - Trophies every 5 dry nights.
  - PDF reports.
  - Ideas: "damp" as a third night state, logging fluid intake per entry, trophies as meta unlocks.
- *DryGuardians*:
  - Bladder diary (intake, void times and volumes).
  - Recommends **28 dry nights in a row** as the "lasting" goal.
  - Progress predictions after 4 weeks.
  - Idea: use 28-night streak milestones for the potty-training arc.
- *DreamDry*:
  - Daily check-ins, calendar, achievements for completing check-ins, exportable data.
  - Idea: reward the check-in itself, not just dry outcomes, to avoid discouragement.
- Bladder diaries in general (e.g. iUFlow / Bladder Journal) log an **urgency scale per void**, plus volume and intake. Ideas: attach an urgency value to each potty entry, and a "voids per day" stat.

---

## 7. Prioritized roadmap (with file hooks)

| P | Item | Files / hooks |
|---|---|---|
| P0 | Central `silentGuard(kind)` helper wrapping `startChime`, `navigator.vibrate`, `scheduleNextHydration`, native schedule. All new features call it. | `native-notify.js` (owns `isBedwettingSilent`), `engine.js` `startChime`, `ui.js` hydration |
| P0 | Calendar polish: "damp" night state, 30-day dry %, 7-day trend, `runId` tag on entries | `js/calendar.js` |
| P1 | Weighted waits (`u^k` skew) + trait `mainWindowMult` | `engine.js` `scheduleMainEvent`, `profiles/dependent.js` |
| P1 | Trait registry + resolver + trait-card UI + draft at session start | new `js/traits.js`; `profile-logic.js`; `session.js` save/restore; `index.html` session panel |
| P1 | Unreliable pre-chime / urgency waves | `engine.js` (`preChimeTimer` sites), guarded by P0 |
| P2 | Hidden bladder model as forecast → `mainEndAt` | `engine.js` tick, `ui.js` tick loop, `native-notify.js` (no change needed if `mainEndAt` stays authoritative) |
| P2 | Dribble state machine + in-guide "Roll" button | `guide.js` (`runGuideStep`, `closeVoidGuide`), `tables.js` new in-progress table |
| P2 | Hold challenges as rewards | `guide.js` gauntlet steps, `tables.js` |
| P3 | Roguelike run (`bs_run_v1`): daily roll, Omens, objectives, heat ladder, end conditions, run summary | new `js/run.js`; calendar integration; morning check hook (already wrapped in calendar.js) |
| P3 | Progression arcs (`bs_arc_v1`) feeding `getProfileConfig()` | `profile-config.js`, new `js/arcs.js`, calendar stats |
| P4 | Meta unlocks / codex, pastel theme, chips header + "Next:" instruct line, tab navigation | `styles.css` (CSS vars), `index.html`, `ui.js` |

Testing note: each P-item should extend the headless puppeteer smoke test used for this commit (load `index.html`, assert no `pageerror`, call the new globals directly).
