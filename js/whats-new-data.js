// whats-new-data.js
// List of recent updates for the What's New modal. Update this file with each release/commit.

window.WHATS_NEW_COMMITS = [
  {
    hash: 'v39',
    date: '2026-10-26',
    title: 'v39 — settle latch, clip assist, classes, maturity looks',
    bullets: [
      '✋ DryClip: a touch that stays latched after settle is cleared once and does not re-arm. Arm again when the plate reads dry, or tap Arm. Unpaired clips (bond none) wait instead of looping.',
      '📎 Clip assists Path covers a pending go before Start timer, and stays on after the timer hits 0 until you resolve the go. Soft play stays a flag. Interrupt still asks you.',
      '🤗 Padding check before re-arm: a random timer (tunable spread) so you can aim the clip at padding that is still dry. Caregiver voice when caregiver mode is on. Works with Match protection.',
      '🏫 Pull-up Soft (not Leaky Girl, full-length holds). Pad Girl clarified. Night Little is the night class. Leaky Girl stays one identity with Campaign. Every class has a small #2 modifier.',
      '🎨 Baby, Toddler, and Teen bedwetter looks change the background, cards, and type. Girl / Boy accents stay.',
      'Version 39.'
    ]
  },
  {
    hash: 'v38',
    date: '2026-10-25',
    title: 'Look themes (real CSS)',
    notes: [
      'App look themes change backgrounds, accents, buttons, cards, and nav — not just wording.',
      'Themes: Neutral, Girl, Boy, Soft pink, Sky blue, Lavender, Midnight.',
      'Switch live in Settings → App look, or during Path Deep start. Choice saves in play prefs.',
      'Adult-safe colors with accessible contrast on dark panels.'
    ]
  },
  {
    hash: 'v37',
    date: '2026-10-25',
    title: 'v37 — Path stays on the board (less face-blocking)',
    bullets: [
      '🎲 Path go / STOP / timers stay on the main board as an inline panel — board stays visible; roll buttons lock while a go or timer is active',
      '👀 At-a-glance strip: what to wear, class behaviors, what is happening now, plus light hydration rules per campaign rank (still ≤250 ml/prompt, ≤1 L/day)',
      '💧 Leaky Girl: Step 1 “I have to go” locks urgency before the roll; Step 2 “I already leaked / dribbled” logs urgency and time since urge',
      '🤗 Caregiver + saturation checks as small inline panels (not full-screen sheets); May I change? and ⏸ I\'m going now stay available',
      '🎨 Optional Girl / Boy wording themes (Settings or Deep start) — light accent only; Neutral default; adult-safe',
      '✨ Urge + Session: compact status glance, less clutter — Path UX is the priority',
    ]
  },
  {
    hash: 'v36',
    date: '2026-10-25',
    title: 'v36 — Clearer “stay in your protection” rules',
    bullets: [
      '🧷 Path rules that mean “go in your gear” now say so: e.g. Stage 1 rule 5 → “Stay in your pull-ups (or diaper) and let go — no bathroom.”',
      '🩲 Low-control swaps, STOP squares, Stage 2/3 gear rules and board Let-go / Guide squares name your current protection explicitly',
      '🙋 After a void / let-go event guide, May I change? opens automatically so the guide always ends with a change check',
    ]
  },
  {
    hash: 'v35',
    date: '2026-10-25',
    title: 'v35 — DryClip assists Path & Campaign',
    bullets: [
      '📎 Clip assists Path (opt-in): during hold timers, an armed settled wet stamps the true wet time and offers accident / still holding — one event per wet',
      '▶ Event guides: clip wet stamps the step and can complete as “natural accident during guide”',
      '🏅 Clip assists Campaign (opt-in): natural clip accidents count toward leak / accident goals',
      '🛏 Path night bridge stays available (Bed Mastery / morning check-in) — toggles also on Path/Campaign Review',
      '🧸 Soft play keeps clip consequences light; settle/touch wets stay ignored; caregiver can comment briefly',
    ]
  },
  {
    hash: 'v34',
    date: '2026-10-25',
    title: 'v34 — Review, wider Deep start, refuse+rollback, ladder travel',
    bullets: [
      '📊 Path + Campaign Review panel: class, CON/PER/CMP, stage/rank, protection goal, recent rolls, night focus — not buried in Profiles',
      '📚 Path/Campaign quizzes in-section (Which Class, Long board, Long campaign, Stash, Readiness, …)',
      '🎛 Wider Deep start: experience intensity, Full 7-rank climb / Rank travel (up & down), roomier class cards with mechanics',
      '🙅 Feature refuse → confirm → 1d6 rollback (⏸ I\'m going now still free)',
      '🧷 Caregiver May I change? guides what to change into; mark leaked yes/no; Solo stays plain',
      '🎯 Campaign goals are tappable — morning check-in, Urge, nights, May I change? open the real flow',
    ]
  },
  {
    hash: 'v33',
    date: '2026-10-25',
    title: 'v33 — May I change? back on Path + Campaign',
    bullets: [
      '🧷 Standing May I change? on the Path board next to I need to go (available even mid-go)',
      '🧷 Every Path go / resolve sheet always offers May I change? — not only protection squares',
      '🧷 Campaign panel and Path › Campaign toggle both expose May I change? (same change-roll flow)',
      '⏸ I\'m going now unchanged',
    ]
  },
  {
    hash: 'v32',
    date: '2026-10-25',
    title: 'v32 — Path | Campaign deep start + classes that play different',
    bullets: [
      '🎲 One Path tab with a Path | Campaign toggle — board and campaign share chrome; Campaign still runs on its own with Urge, calendar, and nights',
      '🎛 Deep start sheet: Solo or Caregiver (mommy), class cards with ± perks and stat mods, Constitution / Perception / Composure allocator',
      '💧 Leaky Girl class (Path + Dribbler/Urge): dribble gate before need-to-go, shorter holds, higher change saturation, pads with undies',
      '🧠 Classes nudge real systems: Urge oddsMod, hold length, May I change? thresholds, Path access / busy potty / mastery — not just flavor text',
      '🤗 Caregiver mode: warmer mommy lines on class start, resolve, May I?, and change; Solo stays plain; ⏸ I\'m going now always wins',
      '🌙 Campaign Night focus: dry-morning goal opt-in (works with DryClip / Natural Night / sim nights). Path keeps Bed Mastery + optional DryClip bridge',
      '↩ Light pressure: failed holds can slip a Path star; thicker campaign protection vs current wear raises in-sim change gates',
    ]
  },
  {
    hash: 'v31',
    date: '2026-10-25',
    title: 'v31 — Morning DryClip summary + Soft play',
    bullets: [
      '☀️ Morning check-in shows wet times overnight, cloudy-night note when relevant, and a soft tip to change before re-arm',
      '🧸 Soft play toggle on the Hub and in Settings — shorter holds (still under 20 min), Path prefers early stages, Dare Deck stays off',
      '🛏 Optional Path night bridge: confirmed DryClip overnight flags can quietly update Potty Path Bed Mastery (off by default)',
      '🌊 Clustered waves option in Natural Urge — a few staggered second-wave checks after a big accident (in-app timing)',
      '🎲 Potty Path mid-board feature squares lean less on full session profiles',
    ]
  },
  {
    hash: 'v30',
    date: '2026-10-25',
    title: 'v30 — Quiz short list + Cloudy night',
    bullets: [
      '⭐ Quiz hub shows Essentials first (Symptom picker, Which Class, Self-Rating, Stash & Gear, Long board, Long campaign). A/B/C packs, This-or-That, Scenario and the rest sit under Advanced quizzes',
      '☁ Cloudy night one-tap in DryClip: turns on night watch and Match-protection re-arm',
      '📊 DryClip export log now starts with settle telemetry (how many touch wets were ignored while pairing / settling)',
    ]
  },
  {
    hash: 'v29',
    date: '2026-10-25',
    title: 'v29 — Potty Path Event guide button',
    bullets: [
      '▶ When Path guidance says to follow an Event guide (or May I change?), the matching button now appears on the go sheet — including low-control Trainer Pants swaps that used to show the text with no control',
    ]
  },
  {
    hash: 'v28',
    date: '2026-10-25',
    title: 'v28 — DryClip settle + longer re-arm',
    bullets: [
      '✋ Touching the plate to wake, pair or clip on no longer logs a wet. Pairing / settling… ignores wet until the clip is armed and settled',
      '⏱ Auto re-arm default is now 20 minutes (was 5). Pick 15 / 20 / 25 / 30 / 40 min, or Match protection (thin → thick overnight)',
      '🔄 Manual Re-arm still recalibrates right away when the clip is connected',
      '🔔 Background notification text follows the real state: Settling, Reconnecting, Armed · listening, Wet at time',
      '📎 DryClip section sits higher in Settings (right under Play & content)',
    ]
  },
  {
    hash: 'v27',
    date: '2026-10-22',
    title: 'v27 — Re-arm the DryClip any time',
    bullets: [
      '🔄 The Arm button now works even when the clip is already armed. It shows "Re-arm (recalibrate)" and takes a fresh warmth baseline. Keep your hand off the plate while it arms',
    ]
  },
  {
    hash: 'v26',
    date: '2026-10-22',
    title: 'v26 — DryClip background watch',
    bullets: [
      '🌙 New background watch on Android: a quiet "DryClip armed · listening" notification keeps the link to the clip with the screen off and the app closed. Tap Stop on the notification to end it',
      '🕒 Wet readings are now logged at the time they happened, not when you next open the app',
      '🔁 After the clip drops the link while arming, the app reconnects straight to your paired clip in a second or two, and keeps waiting for it if it\'s out of range',
      '✋ The plate reads warmth, so a touch while arming no longer counts as wet. Readings are ignored while arming and for 20 seconds after',
      '🔄 After a wet reading the clip is acknowledged and re-armed by itself after your re-arm delay. If it still reads wet, it tries again every 10 minutes',
      '🧪 Updated test steps: pair first, keep the DryClip app closed, hands off the plate when arming, test with a warm damp cloth',
    ]
  },
  {
    hash: 'v25',
    date: '2026-10-21',
    title: 'v25 — DryClip stays with you after arming',
    bullets: [
      '📶 The app now connects to the clip the same way the DryClip app does, so the link holds up better while the clip sleeps',
      '🛡 If the clip goes quiet after you tap Arm, the app shows "Armed (assumed)" after 12 seconds and keeps looking for the clip every 12 seconds. A wet reading still comes through when it checks in',
      '🔁 Reconnecting is slower and steadier: one try at a time, with a pause in between, so the phone\'s Bluetooth doesn\'t get stuck',
    ]
  },
  {
    hash: 'v24',
    date: '2026-10-21',
    title: 'v24 — DryClip arming fixed',
    bullets: [
      '🛡 Arm now works like the DryClip app: one quiet command, then the clip takes 10–15 seconds to arm. The app waits and only says "Dry & armed" once the clip confirms it',
      '🔁 If the clip drops the link while it arms, that\'s normal. You\'ll see "Arming… the clip restarts its link, reconnecting" and the app reconnects by itself (after 2, 5, 10 s, then every 15 s, searching again if needed)',
      '🤫 Once armed, the clip sleeps between checks. Quiet is normal, and a wet reading can take about 30 seconds to arrive. The app no longer pokes the clip with extra reads',
    ]
  },
  {
    hash: 'v23',
    date: '2026-10-21',
    title: 'v23 — DryClip status at a glance',
    bullets: [
      '📎 The DryClip screen opens with a status card: a coloured dot for Not connected, Searching, Connecting, Connected or Lost connection, plus the clip name, last seen, battery and what the clip reads now (Dry & armed, Arming…, Not armed, Wet, Charging)',
      '🔘 Buttons follow the clip. Connect, Disconnect, Arm and Acknowledge wet only light up when they make sense, and a short line says why when they don\'t',
      '📵 If the clip can\'t be reached you get a tip: close or force-stop the DryClip app first. The clip talks to one app at a time',
      '🔁 While Night or Daytime watch is on, a dropped clip is retried every 15 seconds',
      '🧪 New "Test the clip" steps walk you through arm → damp cloth → Wet → acknowledge → re-arm, with a live line showing each reading as it arrives',
      '🐞 Fixed: reconnecting no longer sends each reading twice, and tapping Disconnect no longer logs it twice',
    ]
  },
  {
    hash: 'v22',
    date: '2026-10-19',
    title: 'v22 — Easier date and time when you edit an entry',
    bullets: [
      '🕒 Edit entry now has its own date and time boxes, plus Today, Yesterday and Now buttons and −1h / −15m / +15m / +1h steps. Logged it on the wrong day? Tap Today and Save',
      '📅 After saving, the calendar jumps to the entry\'s new day, and it leaves the old day. Streaks and stats update straight away',
      '🌙 The morning check-in and clip flags use the same date and time controls',
      '🐞 Fixed: editing a Natural Night in the calendar dropped its bedtime, wakes and drinks. They are kept now and move with the night',
      '🐞 Fixed: editing a clip flag reset its severity and filled in 0% saturation. It now keeps its severity, stays blank and still needs review',
      '🐞 Fixed: saving with an empty date quietly changed the time to now. You now get asked to pick a date and a time',
      '💦 Log accident at the top of the Calendar starts on today. "Add entry here" still uses the day you picked',
    ]
  },
  {
    hash: 'v21',
    date: '2026-10-18',
    title: 'v21 — Night-total saturation, wake check-in, DryClip extras',
    bullets: [
      '☀️ Morning DryClip check-in asks for one total saturation for the night — not per event. Confirm or dismiss each flag by time and index',
      '👀 During Natural Night, "Woke up" can open a short wake check-in (saturation, pants wet?, severity) that attaches to the latest unreviewed clip flag',
      '📎 Per-event saturation stays blank unless it came from a wake check-in; calendar and stats show night totals',
      '👁️ Watch for unnoticed daytime events: silent flags while you are up, same review path',
      '🔋 Battery-low reminder (threshold in DryClip settings) and wear-time from Arm → wet',
      '📋 Feature map from the vendor DryClip app → BladderSim ideas (see DryClip-feature-ideas.md)',
    ]
  },
  {
    hash: 'v20',
    date: '2026-10-18',
    title: 'v20 — DryClip overnight: silent flags + morning check-in',
    bullets: [
      '📎 Wearing DryClip tonight: overnight wets are flagged silently in the calendar — no alert, no accident sheet at the time',
      '☀️ After your wake time (default 7:00, set in DryClip settings) one morning ping opens a check-in to confirm, edit severity/saturation, or dismiss each flag',
      '📅 Clip-flagged entries look dotted / needs-review, show a badge on the Calendar tab, and do not count toward stats or rank until you confirm',
      '↻ Auto re-arm after ack (lab delay, default 5 min) with dedupe by seconds-since-wet; if the clip is still wet after re-arm you get a saturated marker',
      '📡 Connection gaps are logged so the check-in can say “no data 3:10–4:00”',
      '🌙 Mock “Simulate a night” plants two events and a gap so you can try the morning check-in end to end',
      '💡 Keep screen on while wearing the clip overnight (this build). A native BLE service that runs with the screen off is not included yet',
    ]
  },
  {
    hash: 'v19',
    date: '2026-10-18',
    title: 'v19 — Natural Urge overhaul, one rank ladder, DryClip lab',
    bullets: [
      '🎲 Natural Urge now uses one urgency × rank matrix (aligned with Quick Session odds). At 9–10, an Early Trainer almost never makes the potty; Toddler and Infant never do',
      '📖 Outcomes pull their text and step guides from the matching session profile\'s micro and macro tables — no more five-word replies',
      '🔗 "I need to go" is a short chain: roll → wait or hold → re-check urgency → re-roll (max 3)',
      '🪜 One rank ladder maps Control, Babysitter/Quick tiers, session profiles, Path stages and Campaign ranks',
      '✍ Copy pass: player-facing screens dropped meta phrasing. The big "Real need" button is now a small ⏸ I\'m going now. Notes live in Settings › About',
      '📎 DryClip lab in Settings: scan, connect, live STATE, Arm / Ack / re-arm, mock clip, local event log. A dry→wet change offers the accident sheet (severity Unknown) — never auto-saves',
    ]
  },
  {
    hash: 'v18',
    date: '2026-10-17',
    title: 'v18 — Feature squares, low-control balance, new calibration',
    bullets: [
      '✨ Feature squares on the Path: they launch real app flows (a session-profile cycle, event or holding guide, a short wait, a Natural Urge roll, May I change?, a status check-in, a natural session, Natural Night or the Bedwetting sim). When the app sees it done, the board gets the result: move, ⭐ and mastery',
      '🧷 Low control: at very low or no control an urge no longer offers potty or wait-for-potty. You get a guide, a natural accident or a protection rule instead. Potty options come back gradually with control, class and stage (board and Urge tab)',
      '🐞 Fixed: the urgency slider kept snapping back to 5 and your value was ignored. It now keeps and uses what you set',
      '🏅 Campaign quiz: one question per screen with a progress bar. "Skip quiz — use defaults" is on every screen',
      '🩺 Symptom picker: one question per symptom (Yes / Maybe, random some days / No) with the definition shown. A new 📖 page explains every symptom and curse and how to turn it off',
      '🎯 Settings › Calibration: comfortable-hold test (20 min max, Real need stops it), interval log, optional volume diary, check-in accuracy, accident/near-miss history and night dryness, blended into one estimate with a confidence %',
      '🧩 The Quiz hub is grouped into sections. Duplicate quizzes are merged (old results kept) and option counts and wording are tidied up',
    ]
  },
  {
    hash: 'v17',
    date: '2026-10-16',
    title: 'v17 — Potty Path rebuilt around “I need to go”',
    bullets: [
      '🚽 The board now moves when you need to go: press I need to go (or 💩 #2), roll 2d6, move half, and the square’s number tells you how to go',
      '🗺 Four stages around the path: Diaper Days → Potty Practice → Trainer Pants → Big-Kid Undies, each with its own rules box, a 1–12 rule table and a doubles event table',
      '🛑 STOP squares at every stage end (and mid-stage). Follow the rule → stay; accident → roll back; two in a row → back to the previous stage',
      '📋 Check-in, ⏱ hold, 🧷 protection, 🙋 May I?, ❓ mystery and ↻ roll-again squares, all about going',
      '🏅 Mastery tracks: Bed, Accident and #2, with finish rewards. Log dry nights and clean days in the Path tab',
      '🎭 8 classes with perks and drawbacks (new: 🙈 Shy Goer), still gated by your stash',
      '🧪 Test Mode now plays every stage table and sweeps all 1,248 class × stage × rule × outcome cases',
      '🛡 Real need always wins; timers max 20 min; “tummy trouble” is only an flag',
    ]
  },
  {
    hash: 'v16',
    date: '2026-10-15',
    title: 'v16 — Potty Path board view, classes, new quiz types, pre-bed drinks',
    bullets: [
      '🎲 New 🎲 Path tab: a winding ~60-square board with an animated token, ladders & slides, and a full-screen mode',
      '🎲 Tap the die or shake your phone to roll; your class decides the dice (d6+1, d4+1, re-roll 1s, 6s roll again…)',
      '🏫 7 board classes (Big Kid, Scout, Pad Girl, Pull-up Dribbler, Leaky Toddler, Baby, Cascade Prone), gated by your stash, each with its own protection rules, dice, step-back die and class squares',
      '📋 New board events: grouped by type (Check-in, Hold, Fun, Rest, Gear, Chance, Class), each with one line to do and a clear ✅/✖ result. Every square has a no-penalty 🚽 Real need button',
      '🎯 Adaptive free play: 3 calibration squares, then the path re-tunes every 10 squares from your check-ins',
      '🧪 Path Test Mode: Run test pass auto-plays a full board with random outcomes (no real waits) and exports a review log',
      '🧩 9 new quizzes: Scenario story, This-or-That, Self-Rating sliders, Which Class, Symptom Unlock, Stash & Gear, Dare Deck, Long board (36 Q), Long campaign (32 Q)',
      '🏅 Campaign: pick which quiz results shape your days, plus a “today’s shape” card',
      '🥤 Natural Night: optional pre-bed drinks check-in (small, safe amounts, within the drink limits). Always ends with “pee before bed.”',
    ]
  },
  {
    hash: 'v15',
    date: '2026-10-15',
    title: 'v15 — UI regroup: Play hub, Quiz hub, Settings sections',
    bullets: [
      '🎮 Session is now a Play hub: ▶ Full Session · ⚡ Quick · 🎲 Potty Path · 🌙 Nights (collapsed unless evening / night running)',
      '🌙 Nights offers Natural Night (silent), Bedwetting sim, and a board-night note when a Potty Path board is active',
      '🧩 Quiz hub on top of Profiles: every quiz with last result, what it impacts, Take/Retake + “Go to” buttons',
      '⚡ Short quiz → play: 7 skippable questions build a temporary Natural Urge profile (end it any time)',
      '🙋 Urge tab cleaned up: one big button, I can\'t hold it, result, then a single “More” drawer (changes, #2 timer, classic roll, export)',
      '⚙️ Settings in collapsible sections; 🎯 Calibration lives in Settings › Calibration; 💾 export all data',
      '🎲 More events: 40 new phone-simple micro/macro events + 10 clearer rewrites',
    ]
  },
  {
    hash: 'v14b',
    date: '2026-10-15',
    title: 'v14b — Potty Path board demo, quiz packs, wet-nights fix',
    bullets: [
      '🎲 Potty Path board demo on Profiles (under Campaign): modular N boxes, snakes/ladders, event-guide landings',
      '🧪 Test Mode: "Run test pass" auto-resolves every square with random outcomes (no real waits) + step-one + export log',
      '🪪 Optional quiz packs: Voice & caretaker vibe, Board/day intent, Your symptoms (near Quiz A/B)',
      '🎙️ Busy-Mommy deny/permission lines for May I? / waits (caregiver voice); Office stays coach-neutral',
      '🌙 Potty report wet-nights: last 5 calendar days (fallback 14), not all-time night logs',
    ]
  },
  {
    hash: 'v14',
    date: '2026-10-15',
    title: 'v14 — I can\'t hold it, after-small-accident setting, Quick on Natural Urge',
    bullets: [
      '😣 "I can\'t hold it" button on the Urge screen: ends the current wait, logs a major accident, then a second-wave check',
      '💦 After a small accident: finish / stay / wait / ask / dice / level (+ "you\'re not done"); reads your campaign answer',
      '🚽 Session-tab Quick now rolls on the Natural Urge table (urgency 8–10 = bigger accidents, shorter waits)',
      '🎲 Per-roll "Don\'t log this" and "Reroll, no log"',
      '💧 Drink prompt "Refuse" is now "Already hydrated"; assessment no longer asks for 500 ml',
      'Natural session: removed the duplicate accident button',
    ]
  },
  {
    hash: '4ed28c0',
    date: '2026-04-06',
    title: 'Fixed Session Timer on short session',
    bullets: [
      'Session Timer should work on short sessions',
    ]
  },
  {
    hash: 'f5002d0',
    date: '2026-03-28',
    title: 'Centralized/refactored profile/session logic',
    bullets: [
      'All session/queue/tracking logic moved to profile-logic.js',
      'UI and guide modules now use shared helpers',
      'Hydration/timer logic improved',
      'UI/UX tweaks and bug fixes',
    ]
  },
  {
    hash: '778dc18',
    date: '2026-03-27',
    title: 'Major fixes for custom profiles and hydration',
    bullets: [
      'Custom profile support fixed and improved',
      'Hydration event logic more robust',
      'Timer and event handling fixes',
    ]
  },
  {
    hash: '4a62dba',
    date: '2026-03-27',
    title: 'Custom profile bugfixes',
    bullets: [
      'Fixed bugs in custom profile loading',
      'Improved error handling for custom data',
    ]
  },
  {
    hash: 'ee8a3bc',
    date: '2026-03-27',
    title: 'Support up to 10x scaling',
    bullets: [
      'Scaling timer for larger bladders',
      'UI reflects new scaling options',
    ]
  },
  {
    hash: '9e9ec62',
    date: '2026-03-27',
    title: 'Scaling timer for bigger bladders',
    bullets: [
      'Timer logic now supports larger bladder profiles',
      'Guide and state modules updated',
    ]
  }
];
