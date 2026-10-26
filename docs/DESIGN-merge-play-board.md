# DESIGN — Play merge, #2 button, Potty Path board campaign & Day session

*Branch `android-capacitor`, 2026-10-15 — **revised with the user's answers (12:35 ET + fold-ins 12:41 ET; further revised with 13:04 ET answers; **t59u fold-ins 13:10 ET**: symptoms on/off, handoff, awareness fade, May I change on board, voice, quiz pack — D32–D37; **t61u fold-ins 13:53 ET**: habit-pattern → game symptom map — D38); see Appendix A.** The v14 debug APK ships the S4/S5/S6/S7/S8/S9 slice; board, classes and Day mode are still design only. Builds on `docs/DESIGN-classes-perks-campaign.md`, `docs/REVIEW-v2-mechanics.md §6`, and `docs/IDEAS-catalogue.md` (idea numbers cited as #N). Class/perk/mastery/symptom mechanics also draw (safely) from the user's Rank Trainer HTML and potty-roulette reference images under the agent attachments folder — mechanics and structure only; no sexual content and no real-body training.*

**Hard rules (apply to every section).** These are in-game rules only. No sexual content. No real-body untraining instructions. A real urge always wins. The skin-safety cap always wins. Drink prompts must stay within `js/safety.js`. Bedwetting nights stay silent. Office mode uses neutral wording. Urgency and saturation are always user-entered.

---

## 1. Current state and overlap

**Recommendation:** keep one input path ("I need to go") on one control ladder, and remove the three-way duplication.

| Flow | Where | How it works today |
|---|---|---|
| **Natural Urge (Simple Urge)** | Urge tab, `js/simple-urge.js` | `press()` (`:253`) → `roll()` (`:96`): go / wait / hold-till-hard / wait-for-dribble / gear plus custom events. Odds come from the BSControl ladder, urgency (`:102`), traits (`:104`) and chain lean (`:106`). Hidden waits use one native alarm (`:275`). The armed "💦 Had an accident" button (`:271`, `:347`) leads to the follow-up rule `followUpFor` (`:195`). Inventory/changes are at `:147-169`. **No #2.** |
| **Quick natural session** | Urge tab button, `js/natural-session.js` | It wraps Simple Urge rolls in a clock + summary (`:25-42`), with out/home + kit. It has **no drink prompts** (`:73`) and a **duplicate** accident button (`:47`). |
| **Quick Session** | Session tab card, `js/ui.js:1012`, `quickModeRoll` `:1437` | `profileMode 'chaos_manual'` picks a random event from the selected tables (FULL_D20, MACRO, MESSY/OMORASHI gauntlets). It uses its **own** `quickControlLevel` + `QUICK_CONTINENCE_MAP` and pressure/saturation modifiers (`:1460-1490`). It keeps session timer/state via `abdlSimState` (`js/session.js`). |
| **Full Session** | Session tab, `startSession` `ui.js:672` | Timed main/micro events, pre-chime, hydration (`ui.js:627`, capped at `:637`), forced checks, Change / "I can't hold it" / manual #2 (`triggerMessyEvent` `ui.js:2678`). It resumes after the app is killed (`session.js:56-66`). |
| **Random #2 timer** | Urge tab (Messy only), `js/messy-timer.js` | It is a hidden countdown that fires one prompt by level (`:11-17`, `outcome` `:45`), with an optional early heads-up (`:52`) and "Not now" (`:69`). It is **timer-driven only**. |

**Duplicated:** the "need to go" press (×3), the control level (two ladders that can disagree), accident logging (×2 buttons), and the "quick session" wrapper (×2).
**Unique to Natural Urge:** follow-up rules, hidden waits, custom profiles/events, chain lean, and Control/campaign feed.
**Unique to Quick Session:** guided event tables, pressure/saturation modifiers, gauntlets, and the status bar.
**Missing everywhere:** a user-initiated "I need to go #2" button.

Supporting systems:
- `js/campaign.js` is a 7-rank ladder (`:12-20`) that scores daily goals from the calendar (`:31-62`, `evaluate` `:72`). Its setup quiz stores `prefs` (`MORE_Q` `:217-235`), but **nothing reads them yet**.
- `js/classes.js` is data only (`:10-72`), and no roll uses it.
- **Potty Path has no code.** It exists only as a spec (REVIEW §6) plus quiz answers (`quiz.js:88`, `campaign.js:231`).

---

## 2. Proposed Play merge

**Recommendation:** make the Urge tab the single **Play** screen, running the Simple Urge engine with five mode chips. Full Session and Bedwetting stay on the Session tab.

**Handoff (t59u, D33):** once a session starts, the user never picks the next outcome. They press **"I need to go"** and follow the result (§6.10). Urgency/saturation stay user-entered; low control prefers hidden waits (D34).

**Modes**

| Mode | What it is | Comes from |
|---|---|---|
| **Free** | Roll whenever, no clock | today's Simple Urge |
| **Outing** | Clock + kit carried + summary | natural-session `out` |
| **Home** | Same, home rules (Homebody #163 optional) | natural-session `home` |
| **Quick** | **Same Natural Urge table as Free** (DECIDED Q1). Every press asks for urgency; 8–10 means bigger accidents and shorter waits | Quick Session folded in |
| **Day** | A campaign day with time blocks (§7) | new |

**What stays:** `roll()`, follow-up rules, hidden waits, custom profiles/events, inventory, "May I change?", the accident sheet, calendar logging, and Full Session + Bedwetting.
**What goes:**
- `QUICK_CONTINENCE_MAP` / `quickControlLevel` are retired, so BSControl becomes the only ladder.
- The separate natural-session start sheet becomes a mode chip.
- The duplicate accident button in `natural-session.js:47` is removed.
- The Session-tab Quick buttons (the Quick Session card + `btnQuickGo`) **stay but redirect** to Urge → Play → Quick (DECIDED Q1).
- `quickModeRoll`'s separate table roll is retired. Quick **forces rolls on the Natural Urge table** (`roll()`, `simple-urge.js:96`); the old tables are used only as guide flavour through `pickGear` (`:129`).
- **Urgency is always prompted in Quick.** Today high urgency (8 and up) already shifts the odds (`:102`: go ×1.3, gear ×1.5, wait/hard ×0.5). Two additions: at 8–10, gear severity skews toward *major* (bigger accidents), and waits get an extra ×0.7 (shorter waits).

**Kept from Quick:** the optional pressure/saturation slider modifiers, as an **"Advanced modifiers" toggle (DECIDED Q2)**. Off by default, it adds a small extra odds shift from the user-entered saturation. The UI needs a plain-language explainer later (see §2.1).

### 2.1 UX fixes (later)
- The top status bar (`index.html:45-49`: timer / urgency / saturation / next) is too small and squashed to the right. The user usually hides timers anyway. Make it collapsible, with larger touch targets, and hide the timer by default when hidden waits are on.
- The Advanced modifiers toggle needs a one-line explanation ("nudges the dice a little using the saturation you enter").

**UI sketch (Play screen, top → bottom)**
```
[Control chip]  [Free | Outing | Home | Quick | Day]
(mode card: clock · kit · block / board square, if any)
(follow-up card, if active)
[        I need to go        ]      ← big, red
[     💩 I need to go #2     ]      ← Messy only (§3)
Urgency slider (unset by default)
(result card + timer / ▶ Guide)
[💦 Had an accident ✕] [💩 Had a messy accident ✕]   ← only when armed
🎒 Wearing / spares · Change buttons · 🎲 May I change?
▸ More: profiles, events, traits, tables, surprise #2 timer, export
```

---

## 3. #2 button design

**Recommendation:** add a Messy-only "💩 I need to go #2" button whose outcome is **opaque**: the user doesn't know what they rolled until it plays out. Keep the Surprise #2 timer.

- **Visibility:** shown only when `isMessyEnabled()` is true, never during Natural Night (same rule as `messy-timer.js:33`).
- **Not training-style (DECIDED Q3):** in Campaign, Quick and Natural (Free/Outing/Home), the result card does **not** show the outcome category. It shows only the next thing to do.
- **Opaque outcome pool** (weights by level; base = `BSMessyTimer.LEVELS`, `messy-timer.js:11-17`, tuned so lower levels lean toward the later rows):

| Outcome | What the user sees |
|---|---|
| Hidden timer | "✋ Wait." No length shown, one alarm, then the real instruction is revealed |
| Immediate accident | The gear guide starts (from `MESSY_PUSHING_ACCIDENTS_D10`) |
| Push guide | A ▶ Guide with push/relax/wait steps (the existing guide player) |
| Hold challenge | An "uh-oh"-style hold: hold for a hidden time. The "💩 Had a messy accident" button stays armed. If you hold, you get potty permission |
| Potty | "You may go now". Rare at low levels |

- **"Not now — body not ready, never strain"** is on every step (`resolve(false)`, `messy-timer.js:69`), plus "Real need wins — just go".
- **Pairing:** "💩 Had a messy accident" is armed during any hidden timer or hold challenge and opens the accident sheet with `messy:true` (as `mtAcc`, `messy-timer.js:116`). It shares the ✕ dismiss behaviour (`simple-urge.js:272`).
- **Surprise #2 timer stays (DECIDED Q4)** under "More". It uses the same opaque pool.
- **Logging:** calendar `mode:'messy_button'`, counted by campaign play style `natural` (add to `NATM`, `campaign.js:34`). It follows the skip-log rules in §10.
- **Board:** when the board is on, a #2 press also moves the token (§4).

---

## 4. Potty Path board as the saved campaign

**Recommendation:** the board is a **long-term opt-in session** inside the campaign. Its length comes from a quiz or goal, the token moves on **every urge roll**, and each landing square gives a concrete action. All state lives in one resumable localStorage record.

### 4.1 Opt-in, leaving, resuming (DECIDED Q13)
- Opting in starts board tracking. The user can freely leave to play Free / Outing / Quick / Full Session; the board just waits.
- Resume continues from the saved record, whether it was last touched yesterday or last week. **Export/import as JSON** for backup and moving devices (same style as `simple-urge.js:57-63`).
- While the board is active, the square zone sets "Match my profile". A level the user has locked themselves still wins.
- Enabled from the campaign quiz (`prefs.board`, `campaign.js:231`) or Settings.

### 4.2 Modular length (DECIDED Q5)
- **No fixed 60.** Length N comes from the campaign quiz goal (pace, days, direction), like campaign length (`campaign.js:139-141`). It can also be set directly in Settings (e.g. 20–200).
- Progress is shown as a **numbered list of boxes 1…N** (scrollable strip, current box highlighted).
- Zones scale as percentages of N: Baby 0–20 %, Toddler 20–45 %, Preschool 45–70 %, Big Kid 70–90 %, Grown-up 90–100 % (from REVIEW §6.2 ratios).
- Ladders and snakes are generated proportionally, seeded per board, and saved in the record.
- **More setup quizzes for custom profiles:** answers turn into timer ranges and odds (wait ranges, hidden-wait share, accident shape), so the user gets the excitement of not knowing the exact numbers.

### 4.3 Movement: a roll on every urge (DECIDED Q6)
- **No daily roll.** Every *logged* "I need to go" / #2 press also rolls the board die (1d6 by default; Fast Fill etc. can change the die).
- **Night:** rolls follow the square's instructions but **do not move the token** (§7.1).
- Skipped / not-logged rolls (§10) never move the token.
- **Real natural accidents and failed waits impact the board (DECIDED Q8):** they trigger a **punishment roll** (§6.9). They never give progress or stars, and in Little Slide they never count as moving toward the goal.
- Real override / Not now: no move and no punishment.
- **Intentionally skipping a board path / landing action is a punishment (DECIDED Q28):** dismissing or "Skip" on a square that still needs resolving (timer, guide, May I?, change roll, let-go, hold challenge, …) triggers one **punishment roll** (§6.9) and does **not** move the token. This is distinct from an **automatic rest** when a square expires while the app was away (DECIDED Q7, §4.6).

- **The board is not only a linear rank climb (DECIDED, 13:04):** live results reshape the day even when the token hasn't changed zone. A run of "I can't hold it" presses or natural accidents at a mid band can shorten timers, hide waits, tighten change gates or raise protection for the rest of the day. The token position is the long arc; live results set today's handling.
- **May I change on the board (t59u, D35):** whenever a change is needed (a landing, follow-up, leak or check-in), roll **🎲 May I change?**. Ask the user for their **saturation** and **whether they leaked**. A leak before full saturation is valid and counts. Skin-safety cap still wins.
- **Leak-through levels down off-board (DECIDED, 13:04):** if the profile/class says Big Kid (pants or pads) and the user logs a leak-through or wet pants, the game may **rank/class down regardless of board position** (e.g. Big Kid → Pad Girl / Leaky Toddler kit for the day). Leak events during those sessions expose **May I change?** so the change gate is always reachable. Skin-safety cap still wins.

### 4.4 Landing actions (event guides)
Each box has an action type. The control level reshapes it (§5). Landings are **event guides** that tell the user what to do; the "let go" and "pull-up potty" rows below are examples of guide flavour, not special locked square kinds (DECIDED Q27).

| Square | Example action |
|---|---|
| ⏱ Timer | A hidden wait; one alarm when it ends |
| ▶ Guide | Play a push/relax/wait guide |
| 🌊 Let go | "Let go fully in your gear, then **no change until your next roll**". The skin-safety cap still forces a change past max hours |
| 🚽 Pull-up potty | "Sit on the toilet still wearing your pull-up and wait N min" (home only; skippable) |
| 🙋 May I? | The next 3 urges use the permission table |
| 🔄 Change roll | `BSChange` with your entered saturation |
| 💪 Hold challenge | An uh-oh-style hold with the accident button armed |
| ❓ Mystery / ⭐ Shop / 🛋 Rest | As in REVIEW §6.5 (Shop/Mystery only if those systems are on) |
| ⚖️ Punishment | A punishment roll (§6.9) |
| 📋 Check-in | Asks urgency, saturation and "are your pants wet?" (all user-entered). Results can move the token forward or back and adjust handling (gear, change gate, waits) |

Home-only squares turn into a neutral Timer when Outing or Office is active.

### 4.5 Storage `bs_board_v1`
```json
{
  "v": 2,
  "campaignId": "<bs_campaign_v1.startedAt>",
  "length": 45,
  "seed": 81723,
  "dir": "grow | slide | free",
  "pos": 1,
  "zone": "toddler",
  "snakes": [[17, 6]],
  "ladders": [[8, 19]],
  "squares": { "12": "let_go", "13": "timer" },
  "stars": 0,
  "pending": { "square": 23, "kind": "timer", "startedAt": 0, "until": 0, "step": 0, "level": "shaky" },
  "effects": [ { "id": "may_i", "left": 3 }, { "id": "no_change_until_roll" } ],
  "punish": [ { "id": "extra_wait", "until": 0 } ],
  "nightLog": [ { "ts": 0, "kind": "instructed | natural", "square": 23 } ],
  "lastSettled": 0,
  "history": [ { "ts": 0, "from": 18, "to": 21, "why": "urge_roll" } ]
}
```

### 4.6 Resume rules
1. All timers are absolute epoch ms (as `waitUntil` / `dueAt`).
2. On load or `visibilitychange`, `settle(now)` runs: expired effects end, and a pending square that expired while away becomes an **automatic rest (DECIDED Q7)** — no punishment. An active, on-screen Skip of a still-pending square is **not** this path; it is the intentional skip → punishment rule in §4.3.
3. Time away is never a fail. There is one native alarm per pending square, silent at night and in Bedwetting mode.
4. The morning settle applies the night log (§7.1).

### 4.7 Finish
Reaching box N (or box 1 in Little Slide) gives a campaign rank up plus the option to choose or keep a class (#230), and the Board Walker mastery (#254). The "Diaper Fortress" safety net from REVIEW §6.4 still applies.

---

## 5. How control level reshapes each square

**Recommendation:** every square has one event and five level-banded scripts. The levers are **accident shape, change gates, permission rolls, event steps, and hidden vs shown information**. High Control means warnings and choices; low Control means fewer warnings and fewer choices.

**Levers per band** (bands = Control ladder keys; numbers are starting values to tune)

| Lever | Good / Full | Okay | Shaky | Little | None |
|---|---|---|---|---|---|
| Accident shape (dribble/leak/flood) (#63-67, `prefs.accShape`) | 80/18/2 | 60/30/10 | 40/40/20 | 25/35/40 | 10/30/60 |
| Change gate (#29, #31) | change freely | threshold 30 | threshold 45 | threshold 60 or 2 wettings | threshold 75; next-wetting rule (#32) |
| Permission (#27, `prefs.pottyPerm`) | no gate | May I pee? roll (#17) | roll | ask twice (#18) | all gates; potty is a rare "lucky" outcome |
| Event steps | long warning (#51), choice to go now | short warning | pre-potty dribble chance (#57) | quiet leak revealed at check-in (#59) | no warning; straight to follow-up |
| Waits | shown, alarm | shown | hidden 50% | hidden | hidden; no length reveal until end |

The skin-safety cap (#30), the real-urge override (#28) and Not now always sit above all of these.

**Worked examples (the same square, five experiences)**

**⏱ Potty Alert** (REVIEW §6.5: 90 s race)
- *Good:* "Heads-up, you have 90 s. Walk, don't run." Making it gives +2. Missing it is a dribble (mostly dry).
- *Okay:* 60 s, with a May I pee? roll at the door; "wait 2 min" is possible.
- *Shaky:* 45 s hidden timer. A pre-potty dribble step comes first, then the roll.
- *Little:* "It's already starting." A small leak is logged, then the follow-up says "stay in protection 10–20 min" (`followUpFor` stay).
- *None:* No race. Gear guide (flood share high), then the rest timer and change check.

**🔄 Change roll**
- *Good:* "Change whenever you like" (+1 star for a calm change, #198).
- *Okay/Shaky:* report saturation; at ≥ threshold, `BSChange` rolls yes / later (#22 countdown) / after next wetting.
- *Little/None:* threshold is high, and each failed roll raises it +5 (#33, cap 90). The skin-safety cap still forces "change now".

**🙋 May I?** (DESIGN §6)
- *Good:* auto-yes but logged (a "streak" brake after 3, #25).
- *Okay:* the next 3 urges roll the May-I-pee table.
- *Little:* ask twice (#18). A Please token (#19) skips the gate.
- *None:* the next 3 urges are gear unless a Hall Pass (#24) is used.

**🔔 Hidden alarm** (60–90 min)
- *High bands:* when it sounds, "go now where you are" gives +1.
- *Low bands:* when it sounds, "use your gear (guide)". Not now is always available.

**❓ Mystery / 🌙 Night routine / 🏁 Zone gate:**
- *Mystery:* draws are filtered by band; low bands draw more curses only if `prefs.cards` allows.
- *Night routine:* sets night gear (≥ day, #75) and an optional bedtime drink **through `BSSafety.capDrink`**.
- *Zone gate:* needs N dry check-ins (high bands) **or** a class mastery (low bands).

### 5.1 Event style: phone-simple (DECIDED, 13:04)
More events, but each stays simple: look at the phone, stand / sit / squat, and *how* you let go matters. **No** "walk somewhere / go do that" logistics.

| Example event | Shape |
|---|---|
| Hold standing vs sitting | "Hold while standing (standing desk) for N min" vs "sit and hold" — different odds per band |
| Short hold + hands | Short hidden hold, then "wash your hands while holding" |
| How you let go | "Let go slowly / all at once / in pulses" in protection, per band |
| Skip | Skipping is a punishment roll (Q28) **or** a capped drink prompt via `BSSafety.capDrink` |

Real urge and Not now always sit above every event.

---

## 6. Classes, perks, masteries & symptoms — board identity (highest priority)

**Recommendation:** classes, perks, masteries and unlockable symptoms are **fundamental to how the board feels**, not a garnish on top of squares. The same Potty Path board should play completely differently as Toddler vs Scout vs Baby vs Pad Girl. Wire them into `roll()`, landing scripts (§5), Day blocks (§7), kit defaults (§8) and the star shop from day one of the board MVP — do not ship a "plain" board and bolt identity on later.

**Hard rules for this section (repeat):** in-game dice, timers, gates and wording only. No sexual content. No real-body untraining, no forced fluid loading, no laxatives/enemas/restraints. Board "chores/play" are ordinary home tasks and roleplay prompts — they never instruct IRL continence training. A real urge always wins. Skin-safety always wins. Urgency and saturation stay user-entered.

**Reference (mechanics only):** Rank Trainer class cards + dice modes (`a779…html` / `da6d…html`); potty-rank / age-level roulette structure (Grown Up → Teen → Big Kid → Little → Baby → Permanent-Baby *safety net*, not lock-in); "1 Day in Diaper" roulette economy (stars, star shop, perks, punishments, may-I tables). Map structure and levers — do not port graphic or unsafe lines.

### 6.1 Why identity is the board

| Layer | What it is | How it reshapes the board |
|---|---|---|
| **Class** | Full-day (or multi-day) archetype | Permanent odds mods, behaviour toggles, protection floors, which squares appear / how they script, chore/play task pool |
| **Symptom** | Unlockable game flag from play | Tweaks natural-roll weights and injects/filters certain squares (e.g. Overactive Bladder → more Potty Alert / Hidden Alarm squares) |
| **Mastery** | Progress track toward a named unlock | Gates zone finishes, shop stock, new square types, class T2/T3 perks — *roulette-style progress toward new experiences* |
| **Perk** | Optional lasting boost (tiered) | Re-rolls, hall passes, fuse length, spare bias |
| **Daily card** | Optional one-day modifier | Blessing/curse flavour without rewriting the class |

Classes must change **gameplay math**, not only copy: e.g. board step-back die D4 → D2 on accident, permanent odds modifiers, and which events fire (DECIDED Q32).

Replay loop: **same board length N × different class × different active symptoms × different mastery unlocks × optional perk/daily** = many distinct campaigns on one snakes-and-ladders path.

### 6.2 Classes as full archetypes (not one-liners)

Every class must touch **at least four** of: `oddsMod`, `accidentTypes`, `eventSteps`, `change`, `urge` traits, `denyTable`, `protection` floor/bump rules, `behaviour` toggles, `boardTasks` (chore/play pool), `campaign` goal weights. Data stays on `BSClasses.CLASSES` (`classes.js`).

**Archetype pattern (example: Toddler)** — inspired by Rank Trainer "Toddler" + "no hold" toggle, reframed as safe game rules:

1. **Behaviour modifiers (permanent while class is active):** "Can't hold yourself" = potty-dance / no hand-holding prompts on wait cards (flavour + skippable pose cues like heel-to-toe / door bounce — **no required squats or strain**). Hold-challenge squares lean toward short hidden timers + armed accident button.
2. **Roll shape:** higher squat/wiggle % is expressed as *more "wait-for-dribble" and gear weight*, not as exercise instructions. `oddsMod` example: `{ dribble: 1.6, hard: 0.7, go: 0.85 }`.
3. **Protection rules:** daytime pad / trainers **always bumps night protection up one step** (night ≥ day clamp already in §9 / REVIEW B1). Toddler may also set a soft day floor of pad or pull-up while the class is on ("Match my profile" still respects a user lock).
4. **Board tasks:** chores and play only — tidy one surface, dishes, watch one kids' show block, pack the outing kit, colour for N minutes. **Never** "practice holding", "hold longer each day", or fluid-loading tasks.
5. **Incontinent-system effects = game flags only:** e.g. flag `no_self_hold` changes wait-card copy and disables Iron Hold perk while active; it does not claim anything about the user's body.

**Girly / little archetypes** (from Rank Trainer Pad Girl / Plastic Girl / Leaky Girl / Hypno + roulette "little" aesthetic — mechanics only):

- Emphasise *wear presentation*, layering, soft scoring for intended product use, kinder or meaner dice modes (`low` / `high`), contained-through rules — not body modification.
- Optional cosmetic/voice flavour (Caregiver voice, stickers) stays opt-in and Office-safe.

**Baby class:** **always in diapers.** If a potty-shaped outcome would land, it **does not land as a potty trip**: it becomes "you're allowed to let go" in protection. The kit stays diaper; no temporary pull-up switch for that trip (DECIDED Q31). The change floor stays diaper; May-I-change leans "stay / layer / booster" more than "strip to panties". Night gear = thick diaper. This is a **protection + square-script rule**, not an incontinence claim.

**High-control classes that still force protection:** e.g. Scout or Trainee can sit on Good/Okay Control for potty odds, yet force "carry ≥1 spare" or "day ≥ pad when Outing". Control band and protection floor are independent levers (Rank Trainer kept *allowed* rank separate from *actually wearing* — keep that split).

### 6.3 V1 starter classes (7) with signature modifiers

**V1 ships a smaller starter set (DECIDED Q32).** Workplace archetypes (Office Agent) are dropped from V1; Office mode stays a wording/mode toggle, not a class. Each class must change **gameplay math** (dice, permanent modifiers, events), not only behaviour copy. Classes offered must also match the stash (§6.5).

| Class | Base band | Signatures (math + behaviour) |
|---|---|---|
| **Trainee** | Good | Mild go bias; ask-freely changes; board step-back on accident D4; Early Bird perk tree; big-kid checklist chores |
| **Scout** | Good | Spare bias (+2 on leave); carry-a-spare floor even at high Control; outing/trip masteries; Out-and-about accident type |
| **Pad Girl** | Okay | Soft scoring for pad/trainers as intended; day pad **bumps night ≥ pull-up**; leak-through → class down for the day (§4.3); requires pads in stash |
| **Dribbler** | Shaky | Dribble weight ×2; micro-leak step before go/May I?; waits ×0.85; "Drip Before Go" mastery |
| **Leaky Toddler** | Little | Frequent small leaks; change threshold ~60; step-back die D4 → D2 on accident (smaller, more frequent slides); potty-dance flavour (no required squats); night bumped up |
| **Baby** | None | Always in diapers; potty outcomes become "allowed to let go" (Q31); high change threshold; layer/booster stays; Permanent-Baby badge is a *safety net*, never a lock-in |
| **Cascade Prone** | Shaky–Little | Each major leak rolls a second leak within 10 min (#88); "I can't hold it" biases cascade scripts; Cascade Failure synergy |

*Optional later (unlock via mastery):* Fast Filler, Caregiver's Charge, Sleepyhead, Night Owl, Plastic Girl, Hypno Girl (2d20 keep lower), Unlucky Draw (2d20 keep higher), Chaos Kid, Little Sprout, Roguelike Runner. Office Agent is demoted out of V1.

### 6.4 Day-to-day class switching

**Intent:** today Toddler, tomorrow Scout — identity is a **daily (or session) costume**, not a permanent lock.

| Mode | Behaviour |
|---|---|
| **Morning briefing** | The briefing can assign/tell today's class, **or** offer 3–4 suggested classes to pick from. Default = yesterday's class |
| **Board square 🔄 Class Swap** (#221) | Try another class for the rest of the day; optional |
| **Chaos / Runner** | Class re-rolls on a schedule the user opted into |
| **Campaign finish** | Rank-up offers choose-or-keep (#230) |

Active symptoms and masteries **persist across switches**; only the class modifiers swap. Switching mid-pending-square applies after the square resolves. Switching is **open** (DECIDED Q29): briefing, Class Swap square, choose-among-suggestions, plus off-board class-down on leak-through (§4.3).

### 6.5 Short quiz vs long quiz (niche the feeling)

Quizzes do **not** reveal exact timer ranges. They drive **custom profiles, board length N, zone feel, and starting class/symptom suggestions** — excitement of not knowing exact numbers (§4.2, M7).

| Quiz | Length | What it sets |
|---|---|---|
| **Short** | 10 Q | Intent, direction (Grow/Slide/Free), pace, play style, rough starting band, board length band (Short/Normal/Marathon → N), optional class pick from 3 suggestions |
| **Long** | 30–40 Q | Everything in Short + day block times (Q10), accident shape, after-small-accident, potty/change permission prefs, enabled punishment subset, symptom suggestions (checkboxes, never silent — REVIEW B15), chore-list seed, voice/kit defaults, short vs deep class niche questions ("chores & play" vs "quiet office" vs "always padded") |

Both can be re-run or deepened later (Short → Long) from Settings without wiping masteries or resetting the board (DECIDED Q30).

**Intent first (DECIDED, 13:04).** The quiz opens with *"where do you want to go?"*: have fun at one level · climb ranks · slide down · free play from the current level and move around. Intent shapes outcomes, events, board reactions and how hard / surprising days are (there is no separate morning difficulty dial).

**Stash gate (DECIDED, 13:04).** Before the quiz or board start, ask what is **currently available**: pads, pull-ups, diapers, or unlimited. Classes and protection floors offered must match the stash — no pad class without pads; kit suggestions never exceed what's on hand. Editable later in Settings / Profiles (§8).

**Future quiz pack (t59u, D37).** Add more open, personality-style quizzes (nerdtests / gotoquiz style) alongside the existing giant quiz. Each result **reshapes the experience** (class suggestions, voice, event mix, timer feel), always behind the intent-first opener and the stash gate above. Original questions only; nothing is scraped from nerdtests or similar sites. Not in v14.

### 6.6 Unlockable symptoms (game flags)

*t59u (D32): symptoms can stick from play patterns (e.g. OAB-like after short-wait fails), and every symptom has a manual **off** in the profile, always available.*

Symptoms are **earned or picked**, never inferred from the body (REVIEW §3.4; ANALYSIS-symptoms-classes). They adjust **natural rolls and which board squares lean in**.

| Symptom | Unlock (examples) | Roll effect | Board effect |
|---|---|---|---|
| 💢 Overactive bladder | 3 short-wait fails **or** pick | Waits ×0.85; more "hold-till-hard" | + Potty Alert / Hidden Alarm weight |
| ⚡ Urge waves | 2 missed alerts / 3 alerts made | Alarm grace ×0.8 | More 90 s race squares |
| 💧 Pre-void dribbler | Class Dribbler mastery **or** pick | Wait-for-dribble before go | Inserts micro step on May I? landings |
| 😴 Sleepy bladder | 2 wet sim nights / 3 dry | Night "may get up" −15% | 🌙 squares lean thicker night gear |
| 🔇 Quiet Signals | 3 gear days / 5 dry | Fewer warnings; dribble ×1.8 | Fewer pre-chime scripts at high bands |
| 🌊 Cascade Failure (curse-like) | Opt-in curse pool | Leaks chain on d20 | ⚖️ / mystery lean cascade punishments |

Symptoms **can stick** beyond one roll — for the day or until cleared. Clearing a symptom is always available (Remove/Pause), same as punishments. Habit-pattern → symptom map: §6.11.

### 6.7 Mastery system (roulette-style progress)

Masteries (`BSClasses.MASTERIES` + new board ones) unlock from **user-logged counters only** (`BSClasses.note`). Pattern mirrors the reference roulettes: accumulate toward a named track → unlock a **new experience** (perk tier, square type, class variant, shop stock) — not a body outcome.

Examples:

| Mastery | Need (logged) | Unlocks |
|---|---|---|
| Three Dry / Night Guard | dry nights 3 / 5 | Sleepyhead T2; gentler Natural Night card |
| Patient / Potty Streak | waits survived / potty streak | Long Fuse; Grow-Up ladder ticket once |
| Dribble Diary / Drip Before Go | dribbles / pre-potty micros | Dribbler T2; May I? micro-step cosmetic |
| Change Roulette | change rolls 10 | Star-shop "change now" half-price once/day |
| Out & About | trips 5 | Scout outing square pack |
| Week in Gear | gear days 7 | Baby/Little Legend T2; Diaper Day curse optional unlock |
| **Board Walker** (#254) | finish one board | Title + choose-or-keep class |
| **Class Collector** (#255) | play 10 classes a day each | Chaos Kid unlock / cosmetic |
| **Follow-through** (#251) | logged rolls followed N days | Skip-log default "remember last" unlock |

Zone gates (§5) may demand either N dry check-ins **or** a mastery the current class cares about.

### 6.8 Perks & daily modifiers (optional identity layers)

- **Perks** (`PERKS`): Tier 1 at class pick; T2 after 1 mastery; T3 after 3 or a board gate. Acquisition: Pick · Earn · Random · Mixed (REVIEW §3.4). Always skippable; never blocks a real bathroom trip.
- **Daily cards (DECIDED Q9):** off unless enabled; user picks the pool. Draw styles still OPEN (Q23). Class pool can filter the draw.
- Stars: honesty/logging only (#196–205); **no stars for drinking**; spend in shop or ⭐ square.

### 6.9 V1 punishment list

**Triggers:**
- a real natural accident (accident sheet / "I can't hold it")
- a failed in-game wait
- a ⚖️ board square
- a curse
- **intentionally skipping a board path / landing action (DECIDED Q28)**

**Rules:**
- Roll on the user's enabled list. Max 3 active, each with a duration cap (`PUNISH[].maxH`, `classes.js:51-64`).
- The real-urge override and skin-safety cap always win. Every punishment has Remove/Pause.
- No medical items, ever: no suppositories, laxatives or enemas, no restraints, no forced fluid loading (DESIGN hard rules).

| # | Punishment | Effect | Max |
|---|---|---|---|
| P1 | 💧 Capped drink | One drink prompt **through `BSSafety.capDrink`** (≤250 ml, ≤1 L/day extra, ≥2 h apart). If capped, it is swapped for another punishment | 1 prompt |
| P2 | ⏳ Extra wait | The next "go" becomes "wait 10–20 min first" | next roll |
| P3 | ✋ Hidden waits | All waits hidden | 3 h |
| P4 | 🔥 Short Fuse | Wait ranges ×0.5 (`short_fuse`) | 3 h |
| P5 | 🚫 No-permission window | Potty permission is "not yet" (`no_perm`); real need is always allowed | 1.5 h |
| P6 | 🙋 Ask Nicely | The first ask is always "not yet" (#18) | 5 rolls |
| P7 | 🕐 Stuck | Potty only at the top of the hour (#187) | 3 h |
| P8 | 🧷 Pull-up Probation | Gear one step thicker (`pullup_probation`) | 4 h |
| P9 | 🩲 Diaper Day | Day gear set to diapers for the roleplay (`diaper_day`) | rest of day |
| P10 | 🔄 Change delay | Change threshold +15 (#33); skin cap still applies | 3 h |
| P11 | 🔕 Silent Treatment | No pre-warnings (`silent`) | 4 h |
| P12 | 👀 Extra check-ins | +1 neutral check-in/hour (`extra_checkins`) | 3 h |
| P13 | 🧸 Babysitter Watch | Sitter-profile check-ins on (`babysitter`) | 2 h |
| P14 | 🎟 Privilege loss | Lose a Hall Pass / Please token / a star-shop purchase | instant |
| P15 | ⭐ Star fine | −2 to −5 stars | instant |
| P16 | ↩ Board step back | −1 to −3 boxes (never past the start) | instant |
| P17 | 📝 Lines | Type a short line 5–20× in the app (`lines`) | instant |
| P18 | 🧹 Chore | A real chore card from the user's list (`chore`) | instant |
| P19 | 🎒 Spare Tax | −1 spare (only if spares > 1) | instant |
| P20 | 🌊 Let-go rule | Next accident: "no change until next roll" (skin cap applies) | next accident |

### 6.10 Collaboration & control handoff (DECIDED, 13:04)

In-game simulation of handing control to the app only. No real-body untraining advice here.

- **Why they "need them more":** both the identity/ritual side (not being in control, asking permission, caregiver voice) **and** natural-accident play ("wait until recess" style school waits).
- **Day hardness / surprise vs choose:** driven by quiz intent (§6.5), not a separate morning dial.
- **Harder-than-profile days:** if live play is lower-control than the current profile, it can trigger punishment rolls **or rank down early**, before the board says so.
- **Symptoms can stick** (§6.6); Remove/Pause always available.
- **Symptoms: stick + manual off (t59u, D32).** Symptoms can stick from play patterns (e.g. an OAB-like flag after repeated short-wait fails) **and** the user can always turn any symptom off in the profile. Manual off is always available and never penalised.
- **Handoff once a session starts (t59u, D33).** The user does **not** pick the next outcome. They press **"I need to go"** and follow the result. Choices (intent, class, level, stash) happen before the session; during play the dice decide. This applies to every Play mode (Free, Quick, Outing, Home, Day, board). A real urge always wins.
- **Awareness fade (t59u, D34).** Urgency and saturation stay body-entered — never app-chosen; the app never invents urgency. At lower control prefer **silent / hidden waits** (the length is not revealed until it ends); higher control may show timers. Fade changes only what is *shown*, never what the user reports.
- **Voice (t59u, D36).** Guides use a caregiver / Hive-style ABDL fiction voice (non-sexual). Office mode stays neutral. A full copy rewrite pass is future work; v14 does not rewrite all copy.

### 6.11 Habit-pattern → game symptom map (in-game only)

*t61u (D38): ABDL behavioural patterns map to **game flags and board/urge levers only**. No IRL practice instructions, body-change timelines, or “how to untrain.”*

Earn from quiz packs (§6.5) or logged play patterns. Stick until the user clears in profile. **Remove/Pause always.** Never infer from the body (§6.6).

| Pattern (game label) | Symptom id | What the sim does |
|---|---|---|
| First-urge flood | `frequent_go` / short buffer (OAB-adjacent) | More **go** outcomes; shorter waits; copy leans lower capacity-feel |
| Passive ignore-until-it-happens | 🔇 Quiet Signals | Silent / hidden waits; more “it just happened” gear outcomes; fewer pre-warnings |
| Overflow dribbles | 💧 Pre-void dribbler | Micro-leak steps before go; constant low-sat flavour on May I? / check-ins |
| Night padding stay-in-bed | 😴 Sleepy bladder | Natural Night “stay in gear” lean; morning wet handling (instructed vs slept-through still §7.1) |
| Stand-up / movement trigger | `movement_leak` | Phone-simple stand/sit cues: movement-linked micro leak on check-in or hold-challenge fail flavour |
| Delayed voiding | `delayed_void` (Grow Up lean) | Longer shown waits; higher make-it-to-potty chance (opposite of `frequent_go`) |
| Hydration + ignore combo | Fast Fill + 🔇 Quiet Signals (stack) | Capped drink nudges still only through `safety.js`; fill-feel + quiet stack on rolls |
| Protection-only days | 🩲 Diaper Day / protection floor | Protection floor forced; potty-shaped outcomes become “let go in gear” (Baby-style, §6.2) |

Clear any row in profile (Remove/Pause). Stacks are capped by hard rules (real urge wins; skin-safety; `safety.js`).

---

## 7. Day-session campaign

**Recommendation:** Day mode is one card that walks through the day in blocks and ends by handing off to Natural Night. Hydration is a skippable nudge that can never exceed `safety.js`.

**Blocks** (default times are editable; each block can be skipped or rested)

| Block | Default | Rules | Ideas |
|---|---|---|---|
| ☀️ Morning | wake → +1.5 h | Morning Check, daily draw, kit set (+1 star #201); first 30 min may be "morning shaky" for Night Owl | #38, #70, #147, #191 |
| 💼 Work | 9–17 | Office wording + reminder-only alarms; shorter grace; Meeting mode suppresses prompts | #10, #231-236, #240 |
| 🚌 Commute | 30–60 min | Outing rules; spares count; "Long car ride" style wait optional | #226, #239, #249 |
| 🏠 Home | 17–20 | Home rules; board square resolves here if pending | #163 |
| 🌙 Evening | 20 → bed | Evening fade waits ×0.8; bedtime potty bonus; night gear ≥ day | #71, #75, #76 |
| → Natural Night | bed | Silent; results at Morning Check (see §7.1) | #11, #69 |

**Block times are set in the campaign quiz (DECIDED Q10)** and can be edited later in Settings.

**Hydration nudges**
- At most **one nudge per block**, wording: "Had a drink recently?"
  - **[I'm already hydrated]** skips it, with no penalty and no streak loss.
  - **[Take N sips]** accepts it.
  - **[Not now]** dismisses it.
- Every nudge calls `BSSafety.capSips` / `capDrink` (`safety.js:16-27`): **≤250 ml per prompt, ≤1 L extra per day, ≥2 h apart**. If it is capped, it is **silently skipped** (logged neutrally).
- No stars or progress for drinking (#213). Accepting a nudge only tweaks in-game waits (Thirsty Explorer #115 / Hydration Day card).
- The current "Refuse" label and stern templates in `ui.js:637-655` should be reworded to the neutral version above when built.
- **Default (DECIDED Q11):** soft either way. Proposed: **on in Day mode**, off elsewhere, and one tap turns it off. Always off in Natural Night and Bedwetting. Office mode shows "Reminder: water?".

### 7.1 Bedtime routine and night rules (decision 12)
- **Bedtime** is set in the quiz or Settings (e.g. 22:30).
- **Gear warning (level-based, DECIDED Q26):** "Change into your night pull-up / diaper" (night gear ≥ day, #75). The window scales with Control/class band: lower control is diapered / warned earlier (e.g. ~2 h for Little/None), higher bands later.
- **Last bathroom window (level-based):** one alarm before bedtime, scaled by band — e.g. Big Kid ~30 min before bed; lower bands earlier or folded into the gear warning. A logged potty earns the bedtime bonus (#76). Both windows stay editable in the quiz / Settings.
- **At bedtime:** hand off to **silent Natural Night** (#11, #69). No sounds and no prompts.
- **Night rolls:** if the user wakes and rolls (optional, #77), the result follows the current square's instruction but **the token does not move**. Each event is recorded in `nightLog` as *instructed* or *natural*.
- **Morning settle:** the night log affects the next day differently:
  - **instructed** nights (woke, rolled, told to use it) are a different thing from slept-through nights: they get a **meaningful morning moment** (briefing line, kit note, small handling change), not a blanket punishment
  - **slept-through natural** wet nights never give progress; with Bedwetting mode on, prefer a **moment / handling change** (e.g. thicker night gear tonight) over an automatic punishment roll *(slightly soft — tune in play)*
  - **bad leak-through at night** is a big deal: stronger morning consequence — thicker gear, a morning check-in, and/or an optional rank nudge down
  - a dry night gives the dry check-in move (+2 in Grow Up)

**Day summary** extends `natural-session.summarize` (`:25-42`) with per-block counts, then saves to the calendar and scores campaign goals.

---

## 8. Profiles / potty-report integration

**Recommendation:** reuse `potty-report.js` as the "what to wear / what a day looks like" source for Play and Day mode, and have the report read board and campaign state.

- **Kit default:** `recommendWear` (`potty-report.js:142`) already seeds Simple Urge's daily kit (`simple-urge.js:148`). The same default is used for Outing/Day kit.
- **Day text:** the "Typical day / night" sections (`longSections` `:195-213`) can provide the default flavour text for the Day blocks, by tone tier (`toneFor` `:47`).
- **Report data:** `gather()` (`:27`) already loads the campaign. Add the board position/zone and class to the note ("You're on the Toddler path this week…"), keeping the rule of no meta words in body text (`:164`).
- **Profiles tab:**
  - Campaign card shows rank + board mini-strip + today's card.
  - The Profiles tab adds a class picker.
  - Custom urge profiles stay uncapped (DESIGN §1.2).
- **Office mode** forces coach voice, as now (`:48`, `:67`).

### 8.1 "After a small accident" setting

**Recommendation:** add an explicit per-profile setting, with a per-level default, that decides what happens after a dribble or small accident. Wire it into `followUpFor` and the unused `prefs.afterAcc`.

- **Gap today:**
  - `followUpFor` (`simple-urge.js:195-218`) picks "finish on the potty" vs wait/stay **only from the level index**:
    - dribble: finish at li ≤ 1, a coin flip at li 2, stay below that (`:202`)
    - leak: finish at li ≤ 1, wait at li 2, stay below that (`:203`)
  - Custom profiles (`upsertProfile`, `:36-42`) have no field for this.
  - The campaign quiz asks `afterAcc` (finish / wait / stay / dice, `campaign.js:227`), but nothing reads it.
- **New field:** `afterSmall: 'finish' | 'stay' | 'wait' | 'ask' | 'dice' | 'level'`.
  - **finish:** "Go finish on the potty now" (then check your gear for a leak).
  - **stay:** "Stay in your protection" with the level's stay timer.
  - **wait:** wait N min (level range), then roll again.
  - **ask:** shows two buttons, "✅ Finish on potty" / "🧷 Stay in it", and the user chooses each time.
  - **dice:** a weighted roll between finish, wait and stay by level.
  - **level (default, DECIDED Q21):** today's level-based behaviour, unchanged — **plus** a clear **"you're not done"** instruction on the follow-up card. The instruction offers the band-appropriate next step among: **finish on the potty** / **ask again in 5–10 min** / **roll again immediately**. (Exact which of the three is offered still follows the level table; the card must never feel like the event is over after a dribble.)
- **Where it's set:**
  1. Custom urge profile editor (stored on the profile).
  2. Per-level default in the Level tables sheet (`openLevelTables`, `:491`), in the same `bs_urge_level_odds_v1` override style.
  3. Campaign `prefs.afterAcc`, which applies while a campaign is active unless the profile sets its own.
- **Precedence:** custom profile → campaign `prefs.afterAcc` → class (e.g. Little Sprout #105 = finish; Caregiver's Charge = stay) → level default.
- **Scope:** applies only to `severity` **dribble** and **leak**. A **full** accident (including "I can't hold it", §10.5) always resolves as rest + change check.
- **Safety:** the change check and skin-safety cap still apply, and "real urge always wins" stays on every card. Office wording: "Next step: restroom" / "Next step: stay put".

---

## 9. Safety constraints

**Recommendation:** treat these as invariants that every new path must check; violating one is a release blocker.

1. **Drinks:** every app-initiated drink prompt passes `BSSafety` (≤250 ml each, ≤1 L/day extra, ≥2 h apart, `safety.js:11`). User-logged drinks are never blocked.
   - Known gap: the assessment in `index.html:587-591` ("Drink **500ml** quickly", hold to 85%) bypasses this and reads like a real-body instruction. **Cap and reword it.**
2. **No real-body untraining:** all rules are dice, timers, gates and wording. No instructions to change real continence, no fluid loading, no laxatives/enemas/restraints (DESIGN hard rules).
3. **Real-urge override:** it is available on every gate and square and logs neutrally (#28). There is no Control loss, star loss or board penalty.
4. **Skin safety:** the max-hours-worn cap forces "change now" over any gate, curse or punishment (#30, DESIGN §7). With no spares, the instruction becomes "change when you can restock" (#36).
5. **#2:** Messy-only, opt-in, never timed pressure, "never strain / Not now" on every card (§3).
6. **Bedwetting / Natural Night silence:** no sounds, alarms, hydration or board timers at night; results go to the Morning Check (#11, #69).
7. **Office mode:** neutral vocabulary, "Reminder / Check in" alarms, coach voice (#231-238).
8. **No sexual content**, and playable triggers only (no laugh/cough events, DESIGN §2).
9. **Real accidents never count as progress or stars** (`campaign.js:5`). They can trigger a punishment roll (DECIDED Q8, §6.9), and every punishment stays within these rules.
10. **User-entered only:** urgency and saturation are never inferred.

## 10. Roll logging control and "I can't hold it"

**Recommendation:** make roll logging optional (per roll, or for the whole session), so only rolls the user actually followed count toward progress. Add an "I can't hold it" action that plays out a major accident immediately, instead of asking for another roll.

### 10.1 Why

- Today every press writes to the calendar. `press()` → `record()` (`simple-urge.js:176-189`, `:259`) adds a potty, accident or event entry for every roll. It also feeds `BSNatSession.note` and `BSControl.event`.
- When the user rolls, doesn't follow the result and rolls again, that produces about 50 entries a day. Those inflate campaign goals (`campaign.js:31-62`), and will inflate board moves and stars too.

### 10.2 Skip-log controls

1. **Per-roll "Don't log this" check** on the result card. It is available from the moment the result appears until the step ends: wait or timer finished, ✅ Done, or the next press.
   - Ticking it **retracts** that roll's calendar entry, session note and Control event, using the roll id (`res.id`, `link.roll`).
   - The result card shows "Not logged".
2. **"Reroll, no log" button** next to the result. It marks the current roll as not logged and rolls again in one tap.
   - Chain lean (`:106`) still uses the chain counter, so a reroll can't be used to fish for a better result. **(DECIDED Q16: keep chain lean.)**
3. **Mid-event toggle.** During a wait, a hidden wait or a guide, a small "Don't log" link does the same thing.
   - If an accident is logged through "Had an accident", the roll that led to it is **re-logged automatically**, so the failed-wait link stays honest.
4. **Practice / dry-run mode** for the whole Play session (#16). It is a mode flag on any of Free, Outing, Home, Quick or Day.
   - Nothing is written to the calendar, campaign, board, stars or Control by default.
   - A banner reads "🧪 Practice: not logged".
   - Each result card gets a **"Log this one"** opt-in.
   - Ending the session shows a summary with "Save to calendar?" (default No).
5. **Implementation note (design only):** the roll is held as *pending* until the step ends or the user opts out, and is only then committed. Retracting an entry that was already committed uses the existing calendar entry id stored on the roll.

### 10.3 What counts

- **Only logged outcomes** count toward campaign goals, board moves, stars, masteries, Control changes, privilege loss (punishments, curses), the change budget and permission streaks.
- A skipped roll never earns and never costs anything.
- Rerolls and skipped rolls are **completely forgiven and invisible (DECIDED Q20):** no private "rolls today" counter, no calendar ghost, no score. Only the logged subset exists.

### 10.4 What is always logged

| Event | Logged? |
|---|---|
| 💦 Had an accident / 💩 Had a messy accident (real, accident sheet `js/accident.js`) | **Always**, even in Practice mode, as a *natural* entry. Real accidents never count as progress (`campaign.js:5`). When the board is on, they trigger a punishment roll (§6.9), and the "Count accidents during waits" rule still applies |
| ⚠️ I can't hold it (§10.5) | **Always** (DECIDED Q17), even in Practice mode — feeds the board punishment roll |
| Changes (spare used) | Always, to keep the supply count accurate (`simple-urge.js:161-169`) |
| Morning Check / Natural Night | Always (as now) |
| Simple Urge / #2 / Quick rolls | **Optional**: on by default, per-roll skip, or off in Practice mode |
| Real-urge override | Logged neutrally (#28), no penalty |

### 10.5 "I can't hold it" (bursting between timers)

- **Where:** a permanent button on the Play screen, in Free, Outing, Home, Quick and Day modes, **including during waits, hidden waits, follow-up timers and board squares**. It sits next to (not instead of) "I need to go", and uses the same label as the Session tab button (`index.html:274`).
- **What it does:** no roll. It plays out a **major accident event straight away**:
  - **Shape by band:** high bands get a full flood. Low bands, or the Cascade Prone class / Cascade Failure curse, can cascade: a flood plus a second leak roll within 10 min (#55, #56, #88, #190). **Cascades are offered at all levels (DECIDED Q19)**; Cascade Prone / Cascade Failure bias toward cascade scripts. Natural accidents / "I can't hold it" while on the Path are a *sign* that can modify the day's timers and handling (§4.3).
  - **Guide:** a flood guide from `FULL_D20` via `pickGear(8)` (`simple-urge.js:129`) plays with ▶ Guide. The user can skip the guide.
  - **Accident sheet:** it then opens with severity pre-filled as *Major* and `ctx:'cant_hold'`. Urgency and saturation stay user-entered.
- **Active timers:** any active wait (`waitUntil`) is ended via `endByAccident()` (`simple-urge.js:273`), with no further alarm. Board `pending` squares resolve as "accident". The #2 surprise timer is generally left alone (DECIDED Q18).
- **Follow-up still applies:** `followUp({severity:'full'})` gives the **rest 15–20 min + change check** (`followUpFor`, `:204`). The skin-safety cap and "May I change?" work as normal.
- **Scoring:** counts as a *natural* accident (never progress). If it happens during an in-game wait, it counts as a failed wait (when the setting is on). On the board it triggers a punishment roll (§6.9), and it never moves the token toward the goal.
- **Safety:** it is purely a logging and roleplay shortcut for something that is already happening. It never instructs the user to cause or force an accident. Office mode wording: "Unplanned event".

---

## 11. Build order

**Recommendation:** ship the small items first, because they fix the felt problems now (noisy logging, the missing #2 and burst buttons, Quick redundancy). Then do the medium items for the merge, punishments and night routine, and finally the modular board.

**Small**
- **S1** — Opaque #2 button in Play (Messy only): hidden timer / immediate accident / push guide / hold challenge / potty, with Not now + messy-accident pairing (§3). Ideas #23, #28.
- **S2** — Read campaign `prefs` (`accShape`, `pottyPerm`, `changePerm`, `satRule`, `afterAcc`) into `roll()` / `followUpFor`. Ideas #20, #29, #67.
- **S3** — Apply class `oddsMod` / traits / `eventSteps` / protection floors in `roll()`, plus a class picker with the §6.3 roster. Ideas #79-98, #84-121. **Classes are required for board identity, not optional flavour.**
- **S4** — Remove the duplicate accident button (`natural-session.js:47`).
- **S5** — Hydration wording: "Refuse" becomes "Already hydrated"; neutral templates; fix the 500 ml assessment text (§9.1).
- **S6** — Per-roll "Don't log this" + "Reroll, no log" + pending-commit (§10.2-10.3). Idea #16.
- **S7** — "I can't hold it" on the Play screen → major accident + follow-up (§10.5). Ideas #55, #56.
- **S8** — "After a small accident" setting → `followUpFor` (§8.1). Ideas #53, #105.
- **S9** — Session-tab Quick buttons redirect to Play → Quick. Urgency 8–10 skews to major accidents and waits ×0.7 (§2). Ideas #41-43.

**Medium**
- **M1** — Play merge: mode chips; Quick = Natural Urge table; retire `quickModeRoll` / `QUICK_CONTINENCE_MAP`; Advanced modifiers toggle (§2). Ideas #1, #16.
- **M2** — Punishment roll engine + V1 list P1–P20 with caps and Remove (§6.9). Optional daily-card pool (§6.8). Star economy. Ideas #191-195, #196-213.
- **M3** — Permission gates by band + change budget. Ideas #17, #18, #19, #21, #22, #24, #27.
- **M4** — Day mode with quiz-set block times + soft hydration nudges (§7). Ideas #2, #10, #71, #76, #115.
- **M5** — Practice / dry-run mode with opt-in save (§10.2.4). Idea #16.
- **M6** — Bedtime routine: gear warning, last-bathroom alarm, Natural Night hand-off, night log + morning settle (§7.1). Ideas #11, #69, #75-77.
- **M7** — More custom-profile setup quizzes that turn answers into hidden timer ranges / odds (§4.2).
- **M8** — UX: collapsible, larger status bar; hide timers by default with hidden waits; explain Advanced modifiers (§2.1).

**Large**
- **L1** — Potty Path board: `js/board.js`, `bs_board_v1` v2, modular length 1…N, roll-on-every-urge, landing actions, punishment hooks, settle-on-resume, JSON export/import (§4), **class × symptom × mastery filters on square scripts (§6)**. Ideas #5, #214-230, #254-255; REVIEW P1 (`REVIEW-v2-mechanics.md:301`).
- **L2** — Level-shaped square scripts (§5). Ideas #45-47, #51, #56-59, #63-67.
- **L3** — Separate day/night levels (#68, #75; DESIGN §1.1).

Each item ships with e2e tests in `tests/`.

---

## 12. Open questions

Answered questions are marked **DECIDED** with a one-line summary; the full notes are in Appendix A.

1. **DECIDED** — Quick stays as Play → Quick and rolls the Natural Urge table. Session-tab Quick buttons stay but redirect.
2. **DECIDED** — Keep the pressure/saturation modifiers as an Advanced toggle; improve the UI and explanation later.
3. **DECIDED** — #2 outcomes are opaque (hidden timer, immediate accident, push guide, hold challenge, rare potty), not training-style.
4. **DECIDED** — Keep the Surprise #2 timer.
5. **DECIDED** — Board length is modular (1…N from quiz or Settings), not a fixed 60.
6. **DECIDED** — Roll on every urge; no daily roll, and no catch-up rolls needed.
7. **DECIDED** — Squares that expire while away become an automatic rest.
8. **DECIDED** (accidents) — Real accidents and failed waits trigger a punishment roll on the board. **OPEN (see 22):** should real *potty trips* move the token?
9. **DECIDED** — Daily cards are optional, user-picked modifiers. **OPEN (see 23):** the draw style.
10. **DECIDED** — Day-mode block times are set in the campaign quiz. *(Clarified: "what time does your morning / work / commute / home / evening start?")*
11. **DECIDED** — Hydration nudges are soft; proposed on in Day mode, off elsewhere, one tap to turn them off.
12. **DECIDED** — Punishments are in V1; the list is in §6.9.
13. **DECIDED** — The board is a long-term opt-in session: leave and resume freely from the saved JSON. The zone drives "Match my profile" only.
14. **OPEN** — Skip-log default: off every time, or remember my last choice?
15. **OPEN** — Practice mode: should it remember being on between app launches, or reset to "logged" each new day?
16. **DECIDED** — "Reroll, no log" **keeps chain lean** (no fishing).
17. **DECIDED** — "I can't hold it" **always logs**, even in Practice mode.
18. **DECIDED** — "I can't hold it" cancels an active wait / board square timer; the #2 surprise timer is generally left alone.
19. **DECIDED** — Cascades are offered at all levels; Cascade Prone / Cascade Failure still bias toward cascades; accidents on the Path can modify timers/handling.
20. **DECIDED** — Skipped rolls are **completely forgiven / invisible** (no private counter).
21. **DECIDED** — "After a small accident" default = **level behaviour** plus a **"you're not done"** instruction (finish / ask again 5–10 / roll again immediately, per band).
22. **OPEN** — Should a real potty trip (not an accident) move the token forward? (Proposed: +1 in Grow Up, 0 in Little Slide.)
23. **OPEN** — Daily-card draw style when cards are on. *(Clarified: one card picked for you each morning, or three shown and you keep one, or one blessing + one curse?)*
24. **OPEN** — Which punishments should be on by default? Should real-chore cards (P18) and Diaper Day (P9) need an extra opt-in?
25. **DECIDED (with nuance)** — Instructed nights get a morning moment, not blanket punishment; bad leak-through = stronger morning consequence; slept-through natural nights prefer a moment/handling change in Bedwetting mode *(slightly soft)*.
26. **DECIDED** — Bedtime gear warning / last-bathroom windows are level-based (e.g. Big Kid ~30 min last check; lower control diapered earlier); editable.
27. **DECIDED** — "Let go" / "Pull-up potty" aren't special square kinds; landings are event guides and those were flavour examples.
28. **DECIDED** — Intentionally skipping a board path / landing action = **punishment roll** (auto-rest while away stays no-punishment).
29. **DECIDED** — Class switching is open: briefing assigns/tells, optional Class Swap square, or pick among 3–4 suggestions.
30. **DECIDED** — Short quiz = 10 Q, Long = 30–40 Q; re-run/deepen later without resetting.
31. **DECIDED** — Baby: a potty-shaped outcome becomes "allowed to let go" in protection; kit stays diaper, no pull-up switch.
32. **DECIDED** — Smaller V1 starter set (7); Office Agent dropped; classes must change gameplay math (e.g. step-back D4→D2).

---

## Appendix A — Decisions log (2026-10-15; 12:35 ET voice note + 12:41 ET fold-ins + 13:04 ET answers; t59u 13:10 ET; t61u 13:53 ET)

| # | Decision | Applied in |
|---|---|---|
| D1 | Quick = Play → Quick; it forces rolls on the Natural Urge table; Session-tab buttons redirect; urgency is always prompted, and 8–10 means bigger accidents and shorter waits | §2, S9, M1 |
| D2 | Top status bar is too small and squashed; timers are usually hidden. UX fix later | §2.1, M8 |
| D3 | #2 is opaque (timer / immediate accident / push guide / hold challenge); not training-style | §3, S1 |
| D4 | Surprise #2 timer stays | §3 |
| D5 | Board length is modular from the quiz/goal, shown as boxes 1…N; more setup quizzes feed hidden timer ranges | §4.2, M7 |
| D6 | Roll on every urge; landing gives an action (timer, guide, let go / no change until next roll, pull-up potty, …) | §4.3-4.4 |
| D7 | Real natural accidents and failed waits impact the board through a punishment roll; varied punishments within safety rules; no medical items | §4.3, §6.9, §9 |
| D8 | Auto rests are fine; daily cards are optional user modifiers | §4.6, §6 |
| D9 | Day block times are set in the campaign quiz | §7 |
| D10 | Hydration nudges are soft (on by default or opt-in, either is fine) | §7 |
| D11 | V1 punishments are listed clearly | §6.9 |
| D12 | The board is a long-term opt-in session; leave and resume from the saved JSON; modular from quiz or Settings | §4.1 |
| D13 | Night: bedtime, gear warning, last-bathroom alarm → silent Natural Night; night rolls follow the square but don't move the token; natural vs instructed nights differ the next morning | §7.1, M6 |
| D14 | Advanced saturation modifiers: keep the toggle, improve the UI later | §2, §2.1 |
| D15 | Reroll keeps chain lean (no fishing) | §10.2, Q16 |
| D16 | "I can't hold it" always logs (incl. Practice) | §10.4-10.5, Q17 |
| D17 | Skipped rolls completely forgiven / invisible | §10.3, Q20 |
| D18 | After-small-accident = level behaviour + "you're not done" (finish / ask again 5–10 / roll again immediately) | §8.1, Q21 |
| D19 | Intentionally skipping a board path = punishment roll; auto-rest while away ≠ skip | §4.3, §4.6, §6.9, Q28 |
| D20 | Classes / perks / masteries / symptoms are fundamental board identity (expanded §6); cascades offered at all levels (see D22) | §6, Q19 |
| D21 | "I can't hold it" cancels active wait / board timer; #2 surprise timer left alone | §10.5, Q18 |
| D22 | Cascades at all levels; Cascade Prone / Failure bias; Path accidents modify timers/handling | §10.5, Q19 |
| D23 | Night: instructed ≠ slept-through; morning moments over blanket punishment; leak-through = stronger consequence (slept-through slightly soft) | §7.1, Q25 |
| D24 | Bedtime windows level-based, editable | §7.1, Q26 |
| D25 | Landings are event guides; let-go / pull-up potty are flavour, not square kinds; new 📋 Check-in square | §4.4, Q27 |
| D26 | Class switching open (briefing / Class Swap / 3–4 suggestions) | §6.4, Q29 |
| D27 | Quiz: Short 10 Q, Long 30–40 Q; intent-first opener; stash gate before quiz/board | §6.5, Q30 |
| D28 | Baby: potty outcome → "allowed to let go"; kit stays diaper | §6.2, §6.3, Q31 |
| D29 | 7-class V1 starter set; Office Agent dropped; classes change gameplay math | §6.1, §6.3, Q32 |
| D30 | Board not only linear; leak-through levels down off-board with May I change?; phone-simple events | §4.3, §5.1 |
| D31 | Collab/control handoff: need = ritual + natural accidents; hardness from intent; harder days → punish or early rank-down; symptoms can stick | §6.6, §6.10 |
| D32 | (t59u) Symptoms can stick from play patterns AND always have a manual off in the profile | §6.6, §6.10 |
| D33 | (t59u) Once a session starts the user doesn't pick outcomes: press "I need to go", follow the result | §2, §6.10 |
| D34 | (t59u) Awareness fade: urgency/sat body-entered only; low control → silent/hidden waits, high control may show timers; never invent urgency | §6.10 |
| D35 | (t59u) May I change on the board: roll when a change is needed; ask saturation + leaked (leak before full sat is valid) | §4.3 |
| D36 | (t59u) Caregiver / Hive-style ABDL fiction voice for guides (non-sexual); Office neutral; full rewrite pass later | §6.10 |
| D37 | (t59u) Future quiz pack: open nerdtests/gotoquiz-style quizzes that reshape play; intent-first + stash gate; no scraping | §6.5 |
| D38 | (t61u) Habit-pattern → game symptom map: 8 patterns as in-game flags/levers only (odds, wait opacity, square weight, night rules, clear); earn via quiz/play; Remove/Pause; never infer from body | §6.11 |

---

Approve by section number, or send notes.


---

## Changelog notes (v14b, 2026-10-15)

- **Wet-nights potty report:** uses last **5** calendar days of natural night logs (fallback **14** if none in the 5-day window), via `nightsInLastDays` in `js/potty-report.js` — not all-time night logs.
- **Board Test Mode:** Profiles › Potty Path demo — **Run test pass** auto-resolves every square with randomized outcomes (no real waits) for fast path review; also step-one + export text/JSON. Storage `bs_board_v1` v2.
- **Quiz packs:** optional Voice & caretaker vibe · Board/day intent · Symptom roleplay picks near Quiz A/B (`bs_quiz_packs_v1`). Original questions only; nothing scraped from nerdtests/gotoquiz.
- **Voice:** light busy-Mommy deny/permission line bank (`BSReport.denyFlavour`) for board May I? / wait flavour; Office stays coach-neutral.

## § UI regroup v15

**Session = Play hub.** Four cards at the top: ▶ Full Session (`#btnStartSession`), ⚡ Quick (sheet: Natural Urge · Quick Session · Short quiz → play), 🎲 Potty Path (opens `#sessBoard`, which now holds `#boardMount`), 🌙 Nights (`#hubNights`, collapsed; auto-opens only 19:00–04:00 or while a Natural Night runs, unless the user toggled it) → Natural Night, Bedwetting sim, board-night note. The evening banner keeps its v8 rule (evening or running only). "✨ New in v15" callout card. The duplicate "Natural Urge — roll to go" and the separate Natural Night button were removed from the button stack. How-to-start, Bio-logger and Maintenance are collapsed.

**Urge tab.** Natural Urge: control picker → big *I need to go* → *I can't hold it* → result/follow-up → armed accident row → kit + *May I change?* → a single **More** drawer (spare changes, log a past accident, profiles, events, traits, supplies, export, #2 timer, classic roll). `#urgeExtras` is moved into `#suMore` after each render.

**Profiles.** The Quiz hub (`#myProfileMount`) comes first. One card per quiz: purpose, last result or "Not taken", **Impacts**, Take/Retake, Go to. Quizzes: A, B, C, the Campaign quiz (opens setup), voice/board/symptom packs, and the v15 packs protection / maturity / nightrisk / readiness / recap, plus Short quiz → play. The board card on Profiles is now just a link.

**Settings.** Collapsible `details.set-sec`: Play & content · Alarms & grace · Calibration · Calendar & logging · Safety & drinks · Data/about/what's new (including export-all JSON and Advanced/Testing).

**Quick-from-quiz.** 7 skippable questions build a temporary Simple Urge profile `cp_quickquiz` (wait range, outcome odds, hidden waits, quiet signals) and set the voice. The state goes in `bs_quick_quiz_session_v1` `{active, ans, result, prevProfileId, prevVoice, expiresAt}`. *End* restores the previous profile and voice.

**Day-end recap → campaign.** Pack `recap` scores honest-logging, following waits, re-rolls, gear rules and goals. **Apply to campaign** writes `s.recaps[day]`, and `scoreDay` adds it as one extra goal next to the log-based goals. It never replaces them, and a rest answer marks a rest day.

**Event tables (tables.js tail).** 40 new phone-simple events (STD micro +8, diaper micro +8, FULL_D20 +8, four continence micro tables +4 each) and 10 rewrites of the vaguest flows. Picks are length-based, so the dice still work. No sexual content.

**Deferred to v16.** Rank milestones with conditions (CYOA-style), daily gear-setup roll table, protection-pack "apply gear" button, a recap reminder at day end, and a Settings "what moved" tour.

## § v16 — Potty Path board view, V1 classes, quiz types, pre-bed drinks (2026-10-15)

**Where:** `js/potty-path.js` (board, classes, events, adaptive play; key `bs_path_v1`), `js/quiz-plus.js` (9 quiz types, campaign feeds; key `bs_quiz_plus_v1`; feeds stored on `bs_campaign_v1.feeds`), `js/bed-drinks.js` (Natural Night check-in; key `bs_bed_drinks_v1`). New 🎲 **Path** tab (`#tab-path`, full-screen toggle). The v14b demo (`board.js`, `bs_board_v1`) stays as "Classic board (legacy demo)" under Session; no keys renamed.

**Board.** ~60 squares (30–100) on a winding SVG serpentine; square kinds 🏁 start · 📋 check-in · 🎲 event · 🛋 rest · 🏫 class · 🏆 finish; 🪜 ladders / 🛝 slides; 🎯 re-tune ring on every 10th square in free play. Token animates square by square. Die: tap or shake (devicemotion > 22 m/s², 1.5 s debounce), tumbling pip face; class sets the dice.

**Events (replace v14b landings).** Seven groups — Check-in, Hold, Fun, Rest, Gear, Chance, Class (+ Dare, Calibration). Each = title, one-line "Do:", ✅ result and (optionally) ✖ result. Holds are short game timers scaled by class × difficulty × control × Self-Rating; max 20 min. Every sheet has 🚽 *Real need — go (no penalty)*. Urgency/saturation are sliders the user sets; ≥60 % saturation always shows the change-now (skin first) note.

**V1 classes (§6.3 mapped to phone names).**

| Class | Needs (stash) | Day / night | Dice | Step-back | Signature |
|---|---|---|---|---|---|
| 🎓 Big Kid (Trainee) | — | undies / undies | d6+1 | d4 | More/longer holds ×1.2, checklist & class-test squares |
| 🧭 Scout | — | undies + 1 spare / pad | d6, re-roll 1s once | d4 | Spare floor at any control; outing/spare squares; gear ×1.2 |
| 🎀 Pad Girl | pads | pad / ≥ pull-up | d6 | d3 | Leak-through → optional class-down to Pull-up; leak shield |
| 💧 Pull-up Dribbler | pull-ups | pull-up / pull-up+booster or diaper | d6, 1→2 | d3 | Drip-first note, May I? square, waits ×0.85 |
| 🧸 Leaky Toddler (Little) | pull-ups or diapers | pull-up or diaper / diaper | d4+1 | d2 | Small steps = more squares; fun ×1.5; holds ×0.7 |
| 🍼 Baby | diapers | diaper / thick diaper | d4 | none | Potty-shaped results = "allowed to let go"; change checks; leave any time (safety net) |
| 🌊 Cascade Prone | pull-ups or diapers | pull-up or diaper / diaper | d6, 6 explodes | d3 | Leak arms an aftershock (50 % second small leak note); chance ×1.5 |

Switching: pick at start (stash-gated, suggestion highlighted) · 🔄 Class Swap (20 % of class squares) · Pad Girl leak-through class-down · ⚙ off-board switch (applies after the pending square, −2 ⭐ if you have them; leaving Baby free). Symptoms, stars and dares carry over.

**Adaptive free play.** First 3 rolls land on calibration squares (urge now · 2-min hold · gear + urge). `observe()` = 100 − 8·urgency − 0.25·sat ± hold (+15/−20); estimate blends prior (Self-Rating slider or 50) then EMA 0.6/0.4 at every 10th-square re-tune. Difficulty = 1 + est/25. Each re-tune regenerates ladders/slides and square mix *ahead of the token*, reweights events (higher control → more holds; lower → more rest/gear) and refreshes the class suggestion.

**Quiz types → mechanic.** Scenario (branching) → direction + difficulty · This-or-That (5 s rapid pairs) → event weights + length · Self-Rating sliders → control prior + hold scale + hidden waits · Which Class (% match, stash-gated) → class suggestion · Symptom Unlock → flags (≥2 points; user ticks each; ⚙ switch off) · Stash & Gear → stash gate + day/night floors, spares, change rule · Dare Deck → dares become 🎯 Dare squares · Long board (36 Q, mixed) → full board config · Long campaign (32 Q, mixed) → campaign day prefs. Campaign "Quiz feeds" toggles (A/B/C, packs, 9 new) feed `campaignDay()` → "Today's shape" card and the 🏅 Campaign board mode.

**Pre-bed drinks.** Profile level 0–4 → 45 ml (3 sips, ~15 min before) · 90 ml (~30 min) · 150 ml (last hour) · 200 ml · 250 ml (spread over last 2 h). Already-logged drinks within 2 h of bedtime are subtracted from a 250 ml budget; "not thirsty" caps at 3 sips; then `BSSafety.capDrink` preview (≤250 ml, ≤1 L/day, ≥2 h spacing); committed only on "Add". Every text ends "Pee before bed." Never suggests wake-up or wetting amounts.

**Deferred:** perks/masteries on the Path board, star shop, punishments roll on ⚖️ (not on the new board), board night squares (legacy board keeps night pause), Office-mode copy pass for the Path tab.


## § v17 — Potty Path rebuilt: stages, rule tables, STOP/regress, mastery (2026-10-16)

*Feedback: v16 squares were "mid" (5 rolls before anything about going). v17 adapts the mechanics of a user-supplied reference board (rules only; all text original, adult-framed, non-sexual; exposure/"privacy" rules and laxative items dropped).*

**Core loop (`js/potty-path.js`, key `bs_path_v1`, board shape v2).** Movement happens only on a real need: **🚽 I need to go** (or **💩 #2**) → 2d6 → move ⌊roll/2⌋ (class can change) → the landed square's number(s) pick rule(s) from the current stage's 1–12 table → user follows it → ✅ *Followed* = stay, +1 ⭐ · 💦 *In-game accident* = back by the class die (d6 default) · **two in a row → start of the previous stage** · 🚽 *Real need* = no move, no penalty. Doubles also draw the stage's 2d6 event (2/4/6/8/10/12). v1 boards are retired with a notice (key unchanged).

**Board.** 60 squares = 4 stages × 15. Square 1 of each stage = 📜 stage rules; square 15 = 🛑 STOP (can't be passed); a second STOP mid-stage (square 8). Each stage also has 📋 check-in (urgency/saturation entered by the user), ⏱ hold, 🧷 protection, ↻ roll-again (+2 head start), ❓ mystery (d12 rule) and, from stage 2, 🙋 May I?. All other squares are 1–2 rule numbers. So **every square is a toileting instruction**.

**Stage tables (summary).**

| Stage | Gear (game) | Table leans | STOP | Doubles |
|---|---|---|---|---|
| 1 Diaper Days | diaper / thickest | 1–8 use your protection in different ways; 7 wait 5; 9 tummy-trouble flag; 10–11 no-change rules; 12 choice | use it where you are + change check | tummy, change check, mercy, cosy, +⭐, +3 |
| 2 Potty Practice | diaper or pull-up | 1/4/5 protection; 2/6/7 potty; 3 mixed; 8 roll on stage 1; 9 hold; 10 wait 10; 11 1-min race; 12 choice | wait 10 then potty (protection if it can't wait, no penalty) | potty busy, +⭐, practice sit, change check, mercy, +3 |
| 3 Trainer Pants | pull-up/pad day, diaper night | 1/3/4 potty; 2 allowed in trainers; 5/9 waits; 6 hold; 7 urge ≥ 6/10; 8 mixed; 10 May I?; 11 2-min race; 12 choice | potty + trainers rest of day | trainer check, race card, mercy, May-I token, +⭐, +3 |
| 4 Big-Kid Undies | undies, spare nearby | potty with waits 5/10/15, hold, urge 7/10, May I?, race 1 min | potty once more | slip-up (double next), hall pass, +⭐, check-in, mercy, +4 |

Stage 3–4: two in-game accidents in one day → one step thicker gear for the rest of the day (note). All holds/waits ≤ 20 min, scaled by class/estimate/Self-Rating. "Tummy trouble" = in-game flag (#2 waits skipped); never a real substance.

**Mastery tracks (12 steps each, user-logged once per day; board events add automatically).**
- 🛏 Bed: dry night +1 (+1 per night in a row, max +3); wet −3. Reward: lighter night gear; potty after bedtime in stages 2–3.
- 💧 Accident: each in-game accident +1; accident-free day +2. Reward: change right away, no change limits.
- 💩 #2: #2 in the potty +1; #2-accident-free day +1 (streak, max +3); #2 accident −2. Reward: ignore one backward move per stage; tummy trouble off.

**Class mapping (reference → BladderSim, stash gating kept).**

| BladderSim class | From | Perks | Drawbacks |
|---|---|---|---|
| 🎓 Big Kid | Big Girl | full roll forward; may use the rule ahead/behind | accident in stage 3–4 → previous STOP; no Accident Mastery |
| 🧭 Scout | (v16) | spare kit: 1 free accident per stage; round up to reach a STOP | check-in every go; 2 in a row loses the spare |
| 🎀 Pad Girl | Lazy Gal | Bed/#2 progress → Accident Mastery; 1 free pad go/day | 1 change/day (game; skin first overrides) until Accident Mastery; failed STOP → square 2 |
| 💧 Pull-up Dribbler | Desperate Goer | round up; holds ×0.8 | missed hold = accident (Real need still free); potty busy 1/6 |
| 🧸 Leaky Toddler | Bedwetter | dry nights ×2; potty after bedtime in stages 2–3 | wet night −6; after Bed Mastery accidents always −3 |
| 🍼 Baby | Forced Into Diapers | unlimited changes; no move back for diaper accidents | potty rules become diaper rules; no #2 Mastery |
| 🌊 Cascade Prone | Panty Pooper | #2 may always use an allowed potty; #2 potty +3 | daily tummy-trouble flag (game only); #2 accidents back ×2 |
| 🙈 Shy Goer (new) | Ashamed Pooper | may move 1 and use rule 1 instead | landing on "1" → back 1; #2 waits 5 min |

**Adaptive free play.** Start stage and class come from the control estimate (≥75 → stage 4 … <25 → stage 1). The first 3 goes add a check-in; every 10th square re-checks.

**Test Mode.** *Run test pass* starts at stage 1 and auto-plays to the finish (random ok/accident/real, #2 20%, periodic mastery logs). It logs every rule and also runs a **sweep**: 8 classes × 4 stages × (12 rules + STOP) × 3 outcomes = 1,248 resolve cases, checking that Real need never moves the token and that ✅ never moves back. Export .txt/.json.

**Dropped from the reference:** exposure/"no privacy"/pants-down rules, hand-holding, "move back for a real laxative" and similar items. Dares (v16) now appear as an optional bonus on check-in, protection and roll-again squares.

---
## v18: Feature squares, low-control balance, calibration, quiz audit

### Bug: urgency slider reset to 5
- **Cause:** with *Ask urgency each time* on (the default), the slider value lived only in the DOM.
  - `oninput` saved `lastUrgency` only when askUrgency was **off**.
  - `press()` saved `lastUrgency: null`.
  - The Urge tab re-renders every second during waits, on tab switches and during natural sessions. Each re-render rebuilt the slider at 5 with `data-set=''`, so the next press read `null`, which the app treats as unset.
- **Fix:**
  - The value is saved on every input or change (`lastUrgency`, `lastUrgencyTs`).
  - `press()` keeps the value it used.
  - The askUrgency toggle no longer clears it.
  - `sliderValue()` shows the kept value, and 0 is treated as a real value.
- **Tests:** `tests/v18-urge.test.js` and `tests/v18.e2e.js` (survives a re-render; press uses 8 and keeps 8).

### Feature squares (`js/path-features.js`)
- About 25 of the 60 squares can launch a flow:
  - 3 new `feat` squares per stage;
  - check-in squares launch a status check-in;
  - protection squares launch May I change?;
  - hold squares launch a holding guide or a temporary wait.
- Each go records `b.pending.feature`. **▶ Launch** stores `b.quest`. A 2 s watcher then detects completion:
  - `applyEvent` kind `full` for session cycles;
  - `startVoidGuide` followed by `closeVoidGuide` for guides;
  - a calendar `change_roll`, `nat_session` or `night` entry dated after the start;
  - a new `BSSimpleUrge.state().last` for the Urge roll;
  - the timer ending for a temporary wait.
- `finishQuest()` resolves the go and adds the reward: ⭐, a move, Bed Mastery for nights, Accident Mastery for May I change. Manual ✅ / 💦 / 🚽 buttons are always shown.

| id | Flow | Stages | Min access | Reward |
|---|---|---|---|---|
| sess_dependent | 1 cycle, Constant Incontinence | 1–2 | 0 | +3⭐, move 2 |
| sess_npt | 1 cycle, Not Potty Trained | 1–3 | 0 | +3⭐, move 2 |
| sess_rookie | 1 cycle, Struggle to Control | 2–3 | 0.2 | +3⭐, move 2 |
| sess_babysitter | 1 cycle, Babysitter | 2–4 | 0 | +3⭐, move 2 |
| sess_pro | 1 cycle, Retaining Control | 3–4 | 0.5 | +3⭐, move 2 |
| guide_event | Event guide (light/moderate) | 1–3 | 0 | +1⭐, move 1 |
| guide_hold | Holding guide (gauntlet easy/medium) | 3–4 | 0.5 | +2⭐, move 1 |
| temp_wait | Temporary wait, 3–10 min (≤20) | 2–4 | 0.3 | +1⭐ |
| su_roll | Natural Urge roll | all | 0 | +1⭐ |
| may_change | May I change? | all | 0 | +1⭐, Acc +1 |
| checkin_app | Status check-in (synced to the app bar) | all | 0 | +1⭐ |
| nat_session | Natural session | all | 0 | +2⭐, move 1 |
| night_nn | Natural Night + morning check-in (evening only) | all | 0 | +2⭐, Bed Mastery |
| bedwet_sim | Bedwetting sim (evening only) | 1–3 | 0 | +2⭐ |

### Low-control rules
- **Urge tab:** `POTTY_ACCESS` by level is full 1, good 1, okay 1, shaky 0.7, little 0.25, none 0.
  - The go, wait and hard weights are multiplied by access, after the chain lean.
  - The removed weight moves to gear (60%) and dribble (40%).
  - At None, the roll never offers potty or wait-for-potty, and the text adds a protection-rules note.
- **Board:** `pottyAccess(b, stage)` = clamp((est − 20) / 55) + a class modifier, capped by stage at 0 / 0.6 / 0.85 / 1.
  - Class modifiers: Big Kid +0.15, Scout +0.1, Little −0.1, Cascade −0.05; Baby is always 0.
  - An estimate below 15 gives 0.
  - Each potty-type rule (potty, race, mayi, hold, mixed, wait→potty) is kept with probability equal to access. Otherwise it is swapped for one of the `LOW_RULES`: guidance (event guide), natural accident, or protection rule.
  - Below 0.15 access, these rules are always swapped.

### Campaign quiz
- One question per screen with a progress bar, in this order:
  1. Experience
  2. Level
  3. Direction
  4. Pace
  5. Length (open, 7, 14, 30 or custom)
  6. Play style
  7. "Answer 17 more?" Each extra question has its own skip.
- A review screen ends the quiz. "Skip quiz — use defaults" is on every screen.
- `setupSteps()` and `setupResult()` are exported.

### Symptoms & curses (`js/symptoms-dict.js`)
- There are 25 definitions: 9 symptoms and 16 curses. Each one says what it is in-game, what it changes, and how to turn it off.
- The picker asks one question per symptom: Yes, Maybe or No, with the definition inline.
  - Maybe is on when hash(day:id) < 0.4, so it stays stable for the whole day.
- Today's set is written to the existing `bs_quiz_plus_v1.flags` and `activeSymptoms` keys (no keys renamed). New key: `bs_symptoms_v1`.

### Calibration (`js/calib-plus.js`, key `bs_calib_plus_v1`)

| Method | Score 0–100 | Full weight at |
|---|---|---|
| Comfortable-hold test (≤ 20 min, Real need stops it) | median ÷ 20 | 3 tests |
| Interval log (natural gap between goes) | (median − 30) ÷ 120, flat above 150 min | 6 gaps |
| Volume diary (optional) | (avg − 100) ÷ 300 | 5 entries (× 0.6) |
| Check-in accuracy | 100 − 15 × average error | 4 checks (× 0.6) |
| Accidents and near-misses (14 days) | 100 − 40 × rate per logged day | 7 days |
| Night dryness (30 days) | % dry | 5 nights (× 0.8) |

- The estimate is the weighted mean of the method scores. Confidence is the total weight ÷ 5.0.
- The shown band is ±30 × (1 − confidence).
- At 30% confidence or more, the estimate is the Potty Path starting estimate.
- Nothing scores longer holds beyond the cap. This is play calibration, not medical advice.

### Quiz audit
| Quiz | Finding | Action |
|---|---|---|
| Symptoms pack (multi-select) + Symptom Unlock | Duplicates | Merged into the Symptom picker |
| Board pack | Overlaps Long board quiz | Merged into Long board |
| Protection pack | Overlaps Stash & Gear | Merged into Stash & Gear |
| Long board Q32 | Only 1 option ("Real-urge button always on") | Removed; that button is always on anyway |
| Which Class? | 7 options, 7-class text, no Shy Goer | Shy option added to 8 questions; text now says 8 classes |
| Sliders / long-quiz sliders | Labels have no question mark | Kept: labels are fine for sliders |
| Option counts | Choice questions have 2–5 options, except Which Class? (one per class) | OK |
| Result screens | All show a summary + Impacts + Go-to link | OK |

- **Hub sections:**
  - Start here
  - Personality
  - Gear & body
  - Board & campaign
  - Voice & tone
  - Nights
  - 🗂 Merged (collapsed; old results kept)

---
## v19: Urge matrix, one ladder, copy pass, DryClip lab

### Natural Urge matrix (single source of truth)
Stored in `js/urge-matrix.js` as `BSUrgeMatrix.MATRIX[level][band] = [gear, dribble, hard, go, wait]` (%).

Calibrated to Quick Session `holdChance` at urgency 5–6 (go+wait+hard ≈ holdChance):
fully 78 / mostly 55 / somewhat 35 / mostly-inc 18 / fully-inc 8.

Hard caps at urgency 9–10: Early Trainer potty 3 %, Toddler & Infant 0 %.
Dribble ≤ 15 % in every cell. Accident rises with urgency and down the ranks; potty falls down the ranks.

Content: gear → session macro (urgency-banded thirds), dribble → micro, hard → holding guide.
Chain: wait/hard/dribble → re-check urgency → re-roll, max 3; final roll drops wait/hard.

### Rank mapping (storage keys unchanged)

| Rank key | Control band | Babysitter / Quick tier | Session profile | Path stage | Campaign ranks |
|---|---|---|---|---|---|
| full | 92–100 | fully_continent | train_pro (Retaining) | 3 | big_kid |
| good | 80–91 | fully_continent | train_pro | 3 | trainee |
| okay | 60–79 | mostly_continent | train_rookie (Struggle) | 2 | sprout |
| shaky | 40–59 | somewhat_incontinent | train_rookie → NPT | 1 | nightie |
| little | 20–39 | mostly_incontinent | npt | 0 | padded |
| none | 0–19 | fully_incontinent | dependent | 0 | thick, legend |

### Copy pass
Player-facing strings no longer say in-game / real need / no penalty / roleplay / play calibration / medical advice.
Pause control: small `⏸ I'm going now` (same no-move behaviour). Disclaimers: Settings › About only.
Safety caps (20 min, drink caps) stay in logic, silent.

### DryClip lab (`js/dryclip.js`)
- Plugin: `@capacitor-community/bluetooth-le@6`, Android 12+ SCAN (neverForLocation) + CONNECT.
- Service DC00; STATE DC01 notify; Arm DC02; Ack DC07; read-only DC03 & DC05 (never write DC05).
- Lab: live raw + parsed STATE, battery, Arm / Ack / re-arm delay, Export log, Mock clip.
- dry→wet → offers accident sheet with severity `unknown`, time prefilled; never auto-saves.
- Foreground only (no native night service yet).

### Sim extras shipped
1. Voice packs (`BSVoice`) for Urge outcomes (caregiver / babysitter / coach).
2. One rank ladder (`BSRanks`) wired into Path class/stage and Campaign tier.
3. Urge chain UI ("check urgency" after wait/hold/dribble).
