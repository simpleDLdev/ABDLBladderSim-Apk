# Analysis: Babysitter symptoms → in-sim mechanics, and a class/archetype system

*Status: design document only. Nothing in this file is implemented yet (no classes/traits have been added to the code).*
*Branch `android-capacitor`, written against the v3 tabbed UI + calendar v2 schema.*

## 0. Scope and safety

Everything below is about how a symptom or condition can be **represented inside the game**: timers, hidden
state, dice rolls, prompts, UI effects and log text. It is a fiction layer for a consenting adult's self-paced
routine game.

Out of scope on purpose:

- No advice or mechanic that aims to **train the real body** toward incontinence, weaken the pelvic floor, suppress
  real urges, "un-learn" bladder signals, or keep a real bladder over-full. Those practices can cause real harm
  (urinary retention, infections, pelvic-floor dysfunction, kidney stress). In-sim "continence decay" is **game
  state only**. It changes rolls, not your body.
- No forced-drinking quotas. Hydration prompts stay at the current gentle "N sips" level, with a hard cap. Normal,
  thirst-led hydration is the only real-world guidance here.
- The game must always let the player use a real toilet when they need to. The 🚽 *I Need to Go* / *Can I Go* paths
  and the **Stop** button stay unconditional. A class or curse may cost **points**, but it never blocks a real
  bathroom trip.
- Bedwetting mode stays **totally silent** (`isBedwettingSilent()`): no class may add sound, vibration or
  notifications to it.

---

## 1. Inventory: what the Babysitter profile has today

| Area | Data | Logic (file → function) |
|---|---|---|
| Continence levels (5) | `CONTINENCE_PROFILE_META` (js/tables.js:125) | `getContinenceLeakScalar()` (babysitter.js:27): 0.6 / 0.85 / 1.0 / 1.25 / 1.55. `getBabysitterPottyChance()` (babysitter.js:554): base 90/75/55/30/10 % |
| Symptoms (6) | `BABYSITTER_SYMPTOMS` (tables.js:~204) | `hasSymptom()` (babysitter.js:6). Used in leak scalar, payload size, micro table swap, micro count (engine.js:529-541), overactive check (engine.js:559), dribble on potty permission (babysitter.js:680) |
| Curses (4) | `BABYSITTER_CURSES` (tables.js:197) | strict_sitter (−10 potty, −10 pass save), no_free_passes, slippery_focus (×1.2 leak), hydration_debt (55 % vs 30 % sip prompt per cycle, engine.js:569) |
| Not-Potty-Trained mode | `babysitterNPTMode` (state.js:141) | Mostly/fully incontinent → every macro is an auto-void (`MACRO_NPT_*`) |
| Protection | `PROTECTION_HIERARCHY`, `PROTECTION_CAPACITY` (tables.js:256) | Capacity 5/25/50/80/…, check-in interval by protection (`BABYSITTER_CHECK_INTERVALS`, babysitter.js:201) |
| Progression | `protectionSuccesses/Failures`, thresholds 3 up / 2 down | `checkBabysitterProgression()` (babysitter.js:899), with stash-aware skip |
| Potty passes | 0–4 | `getStartingPottyPasses()`, `maybeAwardPottyPass()`, `getPottyPassInterventionChance()` |
| Leak payloads | micro 3–7, spasm 5–12, partial 12–20, full 25–45, dribble 2–6 (× scalar) | `createBabysitterLeakPayload()` (babysitter.js:83) |
| Accident classification | regex → Giggle Cascade / Stress Burst / Urgency Collapse / Relaxation Slip | `classifyBabysitterAccident()` (babysitter.js:138) |
| Day tracker | per-day counters | `trackDayEvent()` (babysitter.js:353). Since v3 the calendar wraps it and logs **sim** entries |

**Finding: declared but unused modifiers.** Every symptom in `BABYSITTER_SYMPTOMS` carries a `modifiers` object
(`microSeverity`, `lowPressureSpasms`, `physicalTriggerBoost`, `microFrequency`, `urgencyEscalation`,
`pottyChancePenalty`, `accidentSeverity`, `relaxationLeaks`, `stealthMicros`, `giggleSeverity`,
`extraGiggleMicros`, `pottyDribbleChance`). **None of these keys is read anywhere** (grep: 0 uses outside
tables.js). The behaviour is hard-coded through `hasSymptom()` with different numbers: for example, giggle is 1.5×
in code but `giggleSeverity: 2.0` in data, and dribble is 0.4 in code, which only matches by coincidence. Curses
are the same apart from `leakScalar`. **Step one of any class system is to make these numbers data-driven**
(§5, roadmap P0).

---

## 2. Symptom by symptom: how it can be *experienced in the sim*

Notation: **Now** = current behaviour. **Feel** = the experience we want the game to create. **Mechanics** =
proposed sim-only levers.

### 2.1 💢 Overactive bladder
- **Now:** micro count +1/+1. One mid-cycle "Overactive Check" (Bio-Check prompt), with a spasm roll of 15–55 % by
  pressure band. Leak scalar ×1.2.
- **Feel:** "the urge shows up early and loud, out of proportion to how full you are".
- **Mechanics:**
  - **Urgency spikes (hidden state):** add a sim-only `urgeNoise` value that randomly adds +1…+3 to the *displayed*
    urgency band for 2–5 min (status bar pulses amber). It decays on its own and never changes the user's slider.
  - **False-alarm rolls:** when a spike is active, a *Can I Go?* request has a 25 % "false alarm" chance. The
    sitter says "you just went". Turn it into a prompt ("Wait 3 min, then ask again") instead of a denial.
  - **Frequency timer:** shorten the floor of `scheduleMainEvent()` by 15 % while the spike is active.
  - **UI:** the status-bar urgency bar gets a jitter animation (no sound) and the log shows "💢 spike".

### 2.2 🤧 Stress incontinence
- **Now:** micro max +1. Movement-labelled micros are swapped in 40 % of the time and are ×1.25. Leak scalar ×1.1.
- **Feel:** "leaks are tied to *actions*, not to time".
- **Mechanics:**
  - **Action prompts as triggers:** a new micro sub-type, "Action card" (stand up / reach a high shelf / pretend
    sneeze button). The player taps **Did it** and the sim rolls d20 against `stressDC` (lower DC = leakier).
    The roll is entirely in-sim. The action is an everyday movement, not an exercise or strain.
  - **"Brace" counter-play:** an optional 2 s *Brace* button inside the guide window gives advantage on the roll
    once per cycle (a perk slot for classes).
  - **Saturation step:** a failed roll adds a small fixed payload (`stress` 4–9) and logs the source as an action.
  - **Calendar:** sim leak entries tagged `#stress` (tags field already exists).

### 2.3 ⚡ Urge incontinence
- **Now:** potty chance −10/−20 by pressure. Leak scalar ×1.2.
- **Feel:** "fine, fine, then suddenly NOW, with very little warning time".
- **Mechanics:**
  - **Reduced warning time:** an urge onset starts a visible **race timer** (status bar "Next: 0:45 ⚡") that is
    shorter than normal. If the player has not completed the *Go* flow before it hits zero, a partial accident
    roll fires. The timer length depends on the class and continence level (e.g. 90 s → 30 s).
  - **Escalation ladder:** a failed hold escalates the next payload tier (micro → partial → full), as described in
    the unused `urgencyEscalation` and `accidentSeverity` modifiers.
  - **Doorway roll:** a potty-permission event gets an extra "almost made it" roll on arrival (a 10–30 % small
    payload). This is distinct from pre-void dribble because it happens *on arrival*.

### 2.4 🌙 Relaxation wetter (`nocturnal_wetter`)
- **Now:** relax-labelled micros are favoured, with payload ×1.2 and micro max +1.
- **Feel:** "you don't notice until later".
- **Mechanics:**
  - **Stealth leaks (hidden state):** some micros are **not announced**. The sim silently queues a payload and
    tracks `unnoticedSat`. It is revealed at the next sitter check-in or Bio-Check ("you're damper than you
    thought"). This maps directly to the calendar's `awareness: 'unaware'` field.
  - **Idle detector:** if no UI interaction happens for N minutes (document visibility or last-input timestamp),
    raise the stealth chance. This is a sim-only roll. Do not use it in bedwetting mode beyond logging.
  - **UI:** the saturation bar shows a dotted "?" segment for unrevealed wetness.

### 2.5 😂 Giggle incontinence
- **Now:** laugh-labelled micros are favoured and ×1.5.
- **Feel:** "laughing is the trigger, and it cascades".
- **Mechanics:**
  - **Joke cards:** the sitter "tells a joke" (text card). The player answers *Laughed / Didn't*. *Laughed* rolls a
    cascade of 1–3 linked guide segments, each with a diminishing leak chance (60/35/15 %).
  - **Cascade lock:** while a cascade is running, the next micro is pulled from the giggle table (finally using
    `extraGiggleMicros`).
  - **Honesty is the input:** the sim never claims to know whether the player laughed. It only rolls once told.

### 2.6 💧 Pre-void dribbler
- **Now:** 40 % chance of a dribble payload when potty permission is granted.
- **Feel:** "the moment you're allowed, the dam starts to give".
- **Mechanics:**
  - **Permission → dribble race:** permission starts a short "walk" timer. A dribble roll fires at a random point
    inside it, and a *Hurry* tap lowers the payload tier.
  - **Post-void variant** (legacy key `post_void_dribble`): a "few minutes after" roll during the potty check, as
    a separate symptom toggle.

### 2.7 Continence levels, NPT and curses (for completeness)
- **Continence levels** are already the master dial. A class should **offset** this dial (±1 step), not replace it.
- **NPT mode** works as an *archetype rule*: "macros are always auto-voids". This is a natural class drawback.
- **Curses** are drawbacks in the class sense: strict sitter, no passes, slippery focus, hydration debt.
  - **Hydration debt:** keep the same sip sizes and only change how often the reminder appears. Cap at the
    existing `depSipMax`, and never escalate quantities.

---

## 3. A shared hidden-state model (sim only)

Most of §2 needs a few new **in-memory** variables. They are reset per session and optionally summarised per
day in the calendar:

| Var | Meaning | Visible? |
|---|---|---|
| `urgeNoise` 0–30 | temporary urgency spike (overactive) | status bar pulse only |
| `warningBudgetSec` | seconds between urge onset and a forced roll (urge) | countdown in status bar |
| `unnoticedSat` 0–100 | stealth wetness not yet revealed (relaxation) | dotted "?" segment |
| `cascade` {left, chance} | giggle chain state | guide header |
| `stressDC` | d20 target for action cards | class card |

Rules: the player's own sliders (`manualPressure`, `manualSaturation`) are never overwritten silently. The sim
proposes, the player confirms, which is the same contract the Bio-Check uses today.

---

## 4. The other project's class system ("Rank Trainer" v16/v19), mechanically

From the two attached HTML files:

- **Classes** (`CLASSES`, 8 of them: Leaky, Toddler, Pad Girl, Hypno, Plastic, Busy Hands, Unlucky, Once Per
  Block). Each class has a short **card** (one rule) and a **dice mode**: `single`, `low` (2d20 keep lower =
  kinder) or `high` (2d20 keep higher = meaner).
- **Class-specific roll tables per wear level** (`PEE_CLASS[class][wear]`, d20 lines), plus `CLASS_MOD`
  explanations.
- **Points → rank** (`RANKS`: panties 0–5, pad 6–20, Goodnites 21–48, diaper 49+). Rank gates what is
  *allowed*, kept separate from what you are *wearing*.
- **Chaos mode:** reroll the class before every roll. **Forced roll at a wetness threshold** (`thresh: 70`).
- **Class defaults toggle behaviours** (Leaky → "change only if through", Pad Girl → layering, Plastic → plastic
  on).
- Separate **change / drink / task / punish** tables per wear.

What carries over well: **one-rule class cards, dice modes, chaos reroll, points-to-rank gating,
threshold-forced rolls, class-default toggles**.

What we deliberately **do not** port: drink-quantity tables and "punish" lines that prescribe extra drinking,
longer real holds, squats or strain. Those touch the real body. Any "punishment" becomes **in-game** only (points,
pass loss, stricter in-sim timers).

---

## 5. Proposal: classes as symptom bundles + perk + drawback

### 5.1 Data model (future `js/classes.js`; not implemented)

```js
// sketch only
const SIM_CLASSES = {
  giggler: {
    name: 'Giggler', icon: '😂',
    symptoms: ['giggle_incontinence'],          // bundle → feeds hasSymptom()
    continenceOffset: 0,                        // ±1 step on the 5-level dial
    dice: 'single',                             // 'single' | 'low' | 'high'
    perk:     { id: 'straight_face', text: 'Once per cycle, reroll a joke card.' },
    drawback: { id: 'cascade',       text: 'Giggle cascades last one extra step.' },
    modifiers: { giggleSeverity: 1.8, extraGiggleMicros: true },   // finally consumed
    calendarTag: 'giggler'
  }
};
```

`hasSymptom(key)` becomes `activeSymptoms ∪ class.symptoms`, and **every number moves into `modifiers`** read by
one helper, `simMod(key, default)`. That also fixes the unused-modifier finding from §1.

### 5.2 Archetypes

| Class | Symptom bundle | Dice | Perk | Drawback | Distinct mechanic |
|---|---|---|---|---|---|
| 🌱 **Steady Holder** | none | low | +1 potty pass at start | Leaks at ≥85 % pressure are full, not partial | Baseline "training wheels" class |
| 💢 **Jumpy** | overactive | single | *Breathe* button cancels one spike per cycle | Main-event floor −15 % | urgeNoise spikes |
| ⚡ **Sprinter** | urge | single | *Hurry* lowers the payload tier once per cycle | Warning budget 45 s → 25 s at high pressure | race timer |
| 🤧 **Wobbly** | stress | single | *Brace* = advantage on action cards | Action cards appear 1.4× as often | d20 vs stressDC |
| 😴 **Daydreamer** | relaxation | low | Stealth wetness is revealed at the next check-in, not later | 30 % of micros are unannounced | unnoticedSat |
| 😂 **Giggler** | giggle | single | Reroll one joke card | Cascades +1 step | cascade chain |
| 💧 **Dribbler** | pre-void (+ post-void) | single | Potty trips earn +1 point even if a dribble happens | Dribble on 40 % of permissions | walk timer |
| 🎲 **Unlucky** | random 2 | high | Double points on a dry cycle | All rolls keep the higher die | Rank Trainer "Unlucky" |
| 🧸 **Little Sprout (NPT)** | none (NPT rules) | — | Changes always granted, never punished | Macros are auto-voids | existing NPT tables |
| 🌙 **Night Owl** (bedwetting) | relaxation | — | Morning check-in gives bonus points | — | **Silent**: logic only, no prompts at night; results show at the Morning Check |
| 🌀 **Chaos** | reroll class each macro | per class | Variety bonus +1 point per reroll | Unpredictable | Rank Trainer chaos |

Each class card is a **single sentence** shown in the session setup and the Profiles tab, as in Rank Trainer.

### 5.3 New mechanics

1. **Dice modes.** Replace the raw `Math.random()*100 < pottyChance` in `triggerBabysitterMacro()` with
   `rollD20(mode)` mapped onto the same percentage. `low` = kinder, `high` = meaner. The log shows both dice.
2. **Sim points & rank (multi-day progression, in-sim only).**
   - Gain points for a dry cycle (+2), a potty success (+1) and a dry sim night (+3). Lose them for an accident
     (−2) or a leak (−1). This mirrors Rank Trainer.
   - Rank thresholds unlock **cosmetic and rule perks** (an extra pass slot, a class reroll) and change the sitter's
     tone table.
   - Rank is computed **only from `source:'sim'` calendar entries**. Natural entries never move the game's rank,
     so real-life logging stays neutral and judgement-free.
3. **Daily modifier card.** At the first session of each calendar day, draw one modifier ("Busy day: fewer
   check-ins", "Lazy Sunday: relaxation +1"). Store it on the day so the calendar shows it (`tags: ['mod:lazy']`).
4. **Threshold-forced roll.** When `manualSaturation` crosses a class threshold (default 70 %), force a sitter
   check-in roll. This uses the existing `triggerBabysitterAccidentCheck`.
5. **Class-default toggles.** For example, Plastic → contained through-leaks count as `leaked:false` in the
   calendar, and Daydreamer → new sim entries default `awareness:'unaware'`.
6. **Arc goals (in-sim).** "Hold a 5-cycle dry streak as Sprinter" moves the in-sim continence level **up** one
   step. Repeated sim accidents move it **down**. This is the existing `checkBabysitterProgression` idea extended
   to continence. It is presented as a game dial, with no real-world framing.

### 5.4 Calendar integration (uses v2 schema, no breaking change)

- Add optional fields to **sim** entries: `class`, `dice`, `points`. Natural entries never get them.
- The calendar trend card gains a "Sim rank" sparkline (sim entries only, hidden when *Show sim* is off).
- Per-class stats include accidents per cycle, dry streak and pass usage. These are computed from `mode` +
  `class` on sim entries.
- The day detail shows the daily modifier tag and class chip.
- Export/import already round-trips unknown-but-valid fields, but `normalize()` currently **drops unknown keys**.
  **Bump the schema to v3 when adding `class`, `dice` and `points`**, and add them to `normalize()`.

---

## 6. Prioritized roadmap (with file hooks)

| P | Item | Files / hooks | Effort |
|---|---|---|---|
| **P0** | Make symptom/curse numbers data-driven (`simMod()`), consume the dead `modifiers` | tables.js `BABYSITTER_SYMPTOMS/CURSES`; babysitter.js `getContinenceLeakScalar`, `createBabysitterLeakPayload`, `getBabysitterPottyChance`; engine.js 529-569 | S |
| **P0** | `rollD20(mode)` helper + log both dice | babysitter.js `triggerBabysitterMacro` (roll at ~654), `getPottyPassInterventionChance` | S |
| **P1** | `js/classes.js` with `SIM_CLASSES` + class picker in session setup + class card on Profiles tab | index.html session setup (symptom checkboxes ~859-894), ui.js `showSessionSetupModal` / start handler (~1636), new tab content `#tab-profiles` | M |
| **P1** | Hidden-state vars + status-bar effects (spike pulse, race timer, "?" saturation) | js/tabs.js `updateStatus()`; mobile.css `.sb-*`; state.js | M |
| **P1** | Urge race timer and stealth leaks | babysitter.js `triggerBabysitterMicro`, `triggerBabysitterCheckIn` (reveal) | M |
| **P2** | Action cards (stress) + joke cards (giggle) as new micro sub-types | tables.js new `ACTION_CARDS_D20`, `JOKE_CARDS_D20`; guide.js `startVoidGuide` | M |
| **P2** | Sim points/rank from sim calendar entries; schema v3 (`class`, `dice`, `points`) | calendar.js `normalize`, `computeStats`, `autoLogOutcome`; export `SCHEMA` | M |
| **P2** | Daily modifier card + calendar tags | calendar.js tags; engine.js session start | S |
| **P3** | Chaos mode and per-class trend cards | classes.js; calendar.js trends | S |
| **P3** | In-sim continence arc goals | babysitter.js `checkBabysitterProgression` | M |

Guardrails to keep in every phase:
- `isBedwettingSilent()` short-circuits any new timer that would ring.
- Real toilet access is always available.
- No real-world drink quotas or body "training".
- Natural calendar data never feeds game scoring.
