# DESIGN — Classes, perks, mastery trees & campaign hooks (v12+)

*Branch `android-capacitor`. Design + data scaffold (`js/classes.js`). Full UI is later.*

**Hard rules.** In-game only. No sexual content. No laxatives, enemas, restraints or forced large fluid intake. Urgency and saturation are always user-entered (never inferred). A real urge always wins — every permission denial, change restriction and potty time-out keeps an override that logs neutrally and never punishes.

Inspired by the user’s board-game / Potty Training roulette **level structure and tone only** (Grown Up → Teen → Big Boy → Little Guy → Baby → Permanent Baby). We map that ladder onto the Natural Urge Control levels and the Potty Path board zones — not onto any explicit items from the reference sheet.

**Feedback folded in (2026-10-14):** separate day and night levels; uncapped custom profiles; classes must reach into rolls, accident types, change rules and event steps; no laugh / cough style events in class design (they can’t be faked).

---

## 1. Control ladder ↔ class base (shipping)

| Control key | ABDL label | Office | Typical class base |
|---|---|---|---|
| `full` | Big Kid / Grown-up | Tier 6 | Trainee, Scout |
| `good` | Little Kid | Tier 5 | Trainee, Night Owl |
| `okay` | Advanced Trainer | Tier 4 | Office Agent, Sleepyhead, Runner |
| `shaky` | Early Trainer | Tier 3 | Fast Filler, Quiet One, Dribbler |
| `little` | Toddler | Tier 2 | Caregiver’s Charge |
| `none` | Infant | Tier 1 | Little Legend |
| `off` | Not participating | Off | — |

Each level’s expected-behaviour numbers (warning time, wait/hold prompt %, potty %, mostly-dry / small / major %, change threshold, day/night gear) are computed in `BSControl.stats()` from the same odds tables Simple Urge rolls. Descriptions are generated from those numbers (`BSControl.describe()`).

### 1.1 Day vs night levels (new)

Natural Urge / Control can pick **two** ladder keys: `dayLevel` and `nightLevel`.

- Defaults: night is the same as day, or one step thicker / lower Control when the wear rec already wants night ≥ day.
- Day drives Simple Urge, #2 timer (day), campaign daytime goals, and change rolls while awake.
- Night drives Natural Night permission, morning check-in feel, and overnight wear suggestions.
- “Match my profile” can still map both from Quiz A / Control meter, with the night ≥ day clamp kept.
- UI: two selectors on the Urge tab (Day / Night). Office mode shows Tier numbers only.

### 1.2 Custom profiles (uncapped)

Custom Natural Urge profiles (`bs_urge_profiles_v1`) have **no hard cap**. Users can save as many named profiles as they want (wait range, odds, hidden-wait, traits). Built-in ladder entries stay the shared base; customs override per profile. Export / import JSON already carries the full list.

---

## 2. Classes must feel important (systems matrix)

Every class touches **at least three** of these systems. Data lives on each class object in `BSClasses.CLASSES`.

| Hook | What it changes | Example |
|---|---|---|
| `oddsMod` | Relative weights on Simple Urge outcomes (go / wait / hard / dribble / gear) | Dribbler: dribble ×2, go ×0.6 |
| `accidentTypes` | Extra natural / sim accident flavours offered on the accident sheet | Dribbler adds “pre-potty dribble”; Quiet One adds “no-warning leak” |
| `eventSteps` | Forced micro step(s) before a permission / go outcome | Dribbler: micro “small leak” step, then May I? / go |
| `change` | Ask freely / threshold / sitter cadence | Caregiver’s Charge = threshold (sitter) |
| `urge` | Traits (Quiet Signals, Fast Fill, …) | Fast Filler |
| `denyTable` | Optional override rows for May-I-pee denials | Caregiver’s Charge uses stricter table |
| `campaign` | Which goals / masteries count double | Sleepyhead nights; Scout trips |

**Playable triggers only.** Class design does **not** use laugh, cough, sneeze, giggle or other events the player cannot actually perform. Prefer dribbles the user logs, timed waits, saturation reports, change rolls, hidden waits, and gear outcomes. Existing laugh / cough table rows stay behind the involuntary filter; the next code pass turns that filter on by default.

### 2.1 Class list (11)

| Class | Base | Change | Systems impact (summary) |
|---|---|---|---|
| Trainee | Little Kid | Ask | Mild go bias; standard accident types |
| Office Agent | Advanced Trainer | Ask | Quiet Signals; office wording; shorter grace (no laugh/cough) |
| Sleepyhead | Advanced Trainer | Threshold | Night Control; wet night −4 Control; morning Shaky feel |
| Fast Filler | Early Trainer | Ask | Fast Fill; shorter waits; fill-feel accident type |
| Quiet One | Early Trainer | Threshold | Quiet Signals; “no-warning” accident type; fewer hard prompts |
| **Dribbler** | Early Trainer | Ask | Dribble weight up; **forced micro leak before go / May I?**; pre-potty dribble accident type |
| Caregiver’s Charge | Toddler | Threshold (sitter) | Deny table; no self-permission by default |
| Little Legend | Infant | Threshold high | Gear-default; no pre-chime; high sat threshold |
| Scout | Little Kid | Ask | Spare bias; trip masteries; out-and-about kit hooks |
| Night Owl | Advanced Trainer | Ask | Friendlier Natural Night; mornings start Shaky |
| Roguelike Runner | Advanced Trainer | Ask | Daily perk pick; Control resets per run |

### 2.2 Dribbler (worked example)

1. Player taps “I need to go” and rolls a go / May I? result.
2. Before the permission text, the app inserts one micro step: “Small leak into gear — note it” (user confirms or uses real-urge override).
3. Only then does the go / denial / potty instruction show.
4. Accident sheet offers “pre-potty dribble” as a type when logging from that chain.
5. Three user-logged dribbles in 30 minutes still suggest a big roll (existing chain idea), counted toward Dribbler mastery.

---

## 3. Perk trees (3 tiers)

Data: `BSClasses.PERKS`. Tier 1 opens at class pick; Tier 2 after 1 mastery; Tier 3 after 3 masteries (or a board gate).

Examples: Iron Hold, Early Bird (T1) → Second Chance, Hall Pass, Long Fuse (T2) → Lucky Roll, Gold Star, Mercy Charm (T3).

Acquisition modes (from REVIEW §3.4): Pick · Earn · Random · Mixed. Every perk is skippable and never blocks a real bathroom trip.

Thick Skin and similar perks buff **playable** pressure (standing after a long sit the user logged, walking, bag lift if they tap a trigger) — not laugh / cough rows.

---

## 4. Mastery & symptom acquisition from experiences

Masteries (`BSClasses.MASTERIES`) unlock when user-logged counters cross a threshold: dry nights, alerts made, waits survived, potty streaks, dribbles logged, saturation reports, change rolls, gear days, trips out, pre-potty micros completed.

Symptoms / daily modifiers / curses are **earned or picked**, never inferred from body state:

- Symptoms (Quiet Signals, Fast Fill, Urge Waves, Sleepy Bladder, …) tweak dice and timers only.
- Daily modifiers: 22 cards in `BSClasses.DAILY`. Draw 1 at start-of-day (2 on weekends).
- Punishments / consequences ladder (`BSClasses.PUNISH`): gear rules, extra check-ins, change restrictions **within skin-safety** (user max-hours → always “Change now”), lines, chores, time-out from potty *permission* (sim only; real urge wins). Cap 3 active; each has Remove (pause).

---

## 5. Randomness vs specificity (campaign quiz)

Campaign setup quiz (`BSCampaign.openSetup`) already asks experience, starting level, direction, pace, play style, optional length. Classes extend that:

| Quiz answer | Effect on randomness |
|---|---|
| Experience = new | Fewer curses enabled, 2 rest days/week, Pick mode default |
| Experience = lots | Full curse pool, 0 rest, Mixed/Earn |
| Direction = progress | Masteries lean dry streaks / alerts made |
| Direction = regress | Masteries lean gear days / sat reports / change rolls |
| Play style = natural | Simple Urge + change rolls count as play XP |
| Play style = sessions | Sim sessions required for class XP |

Specificity: if the user picks a class, daily cards and denial rows are filtered to that class’s pool. If they skip, the full pool stays (more random).

---

## 6. Potty Path (board) hooks

Board zones (REVIEW §6.2) set the default Control level while the board is active. Day / night levels can still diverge (night zone vs day zone later). Squares that touch classes/perks:

| Square | Hook |
|---|---|
| ⭐ Star shop | Spend stars → perk, re-roll, ladder ticket, skip curse |
| ❓ Mystery card | Draw from enabled symptom/curse/perk pool (class-filtered) |
| 🔄 Change roll | Calls `BSChange.ask` with user-reported saturation |
| 🙋 May I? | Next 3 urges use the May-I-pee denial table at class base level |
| 📝 Task | Lines / chore from the user’s list (punishment ladder) |
| 🏁 Zone gate | Needs N dry check-ins **or** a mastery the class cares about |
| Snakes / ladders | Campaign rank / Control band crossing can mirror a class promotion |

Falling to square 1 three times unlocks a badge, never a lock-in (“Permanent Baby” safety net from REVIEW §6.4).

---

## 7. Skin-safety & supplies

- Change restrictions never block past the user-set **max hours worn** (`BSChange` skin-safety field); past that the roll is always “Change now”.
- No spares → wording becomes “change when you can restock”; the game never forces gear use without supplies.
- Public-place rules stay skippable.

---

## 8. Scaffold status

| Piece | Status |
|---|---|
| `js/classes.js` data + `pick` / `note` / `active` | ✅ v12 |
| Control ladder rename + descriptions + change rules | ✅ PART 1 |
| `BSChange` May I change? roll | ✅ PART 1 |
| Feedback: day/night design, uncapped profiles, systems matrix, Dribbler, no laugh/cough | ✅ this update (doc + scaffold) |
| Day/night level pickers in UI | ❌ next code pass |
| Class picker UI, perk tree UI, daily draw UI | ❌ after your doc notes |
| Board square → class/perk wiring | ❌ with Potty Path MVP |
| e2e for class pick / mastery counters | ❌ when UI lands |


---

## 9. Shipped in v32 (Path | Campaign update)

- Deep start sheet: Solo | Caregiver, class cards (± perks, mommy/solo voice, stat lean), Constitution / Perception / Composure allocator (`bs_play_start_v1`).
- Path tab Path | Campaign toggle; Campaign remains independent (Profiles mount + Urge/nights/calendar).
- **Leaky Girl**: Path class `leaky` + BSClasses `dribbler` alias; dribble gate, holdScale 0.65, changeSatBump +25, padsWithUndies; Urge `oddsMod` / `eventSteps` wired.
- Caregiver mommy lines on start / resolve / May I? / change (original copy).
- Perception ≤1 soft-fogs Path hold timers; Constitution scales holds (≤20).
- Campaign **Night focus** opt-in: dry-morning goal alongside existing morning check-in.
- Protection pressure: campaign rank thicker than current wear → May I change? threshold bump.
- Failed Path hold can slip a star; repeated slips nudge campaign fail streak lightly.

### Deferred
- Full babysitter mode logger, Hive shipping, sexual content, real conditioning claims.
- Rich night chapter quest chains; Path night sim beyond Bed Mastery + DryClip bridge.
- Full perk-tree / daily-draw UI; e2e mastery counters UI.
