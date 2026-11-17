# Event analysis for conditioning (v54)

Analysis only. No behavior change. Base is `cursor/bladdersim-v43-ccdd` after v53 (`ba75c18`).

A conditioning full session does not roll the twelve conditioning events as its repeating guides. `profile-config.js` sets My Conditioning to `MICRO_STD_D6` (6 micros) and `FULL_D20` (11 macros). Those two tables are what showed up as start-stop spurts and the same shape three or four times. The conditioning group in `js/cond-events.js` is a separate, small, gated list. It is unshifted onto the session plan as one prompt. It is not the deck the timer keeps drawing from.

Guide step types, and what they train if you actually follow them:

| Step | What the body does | Fits |
| --- | --- | --- |
| `stop` | Clamp, pause, or "hold tight" | More control. Works against let-go-at-first-urge and relaxed release. |
| `push` | Bear down or force a spurt | Active voiding. Not passive release. A one-second push can be a dribble. A long push is straining, which relaxed release is not. |
| `relax` | Soften and let it happen | Untraining, when the event does not then say stop or clench. |

A full let-go in the ideas below is one `relax` step of 12–15 seconds (the calibration band). A partial is about 4–6 seconds. A dribble is 2–3 seconds. No `stop` after a let-go on an untraining event. A real need still ends the event.

## 1. Inventory

### What a conditioning full session actually rolls

**`MICRO_STD_D6` (6).** Every one except Pinprick Blink ends in a clench.

| Event | Steps | Trains in practice |
| --- | --- | --- |
| Pinprick Blink | 1s push | A tiny forced spurt. Neutral-to-helpful as a surprise dribble. |
| Double Blink | push, 2s stop, push | Start-stop. Sphincter on/off. |
| Thin Dribble | 3s relax, then "clench tight" | Starts as a seep, then trains stopping it. Hurts relaxed release. |
| Peppery Patter | three pushes, then "clench hard" | Spurts plus a hard hold. |
| Mini Stream | push, relax, then "clamp down" | A stream that you are told to cut off. |
| Sticky Linger | seep, squeeze, seep | Start-stop seep. |

**`FULL_D20` (11).** Four of the eleven are explicit start-stop. The log's "Zoned Out 8s stream" is Daydream. "Spurts" is Spasm Series, Walking Leak, The Sprinkler, or a micro.

| Event | Steps | Trains in practice |
| --- | --- | --- |
| Spasm Series | push 2, stop 2, push 2, stop 2, push 2 | Start-stop. Holding between spurts. |
| Walking Leak | step-and-squirt, hold, repeat | Start-stop while walking. |
| Failed Hold | 5s gush, clamp 2s, 5s gush | Start-stop. The clamp is the skill. |
| The Sprinkler | five pairs of 1s push / 1s stop | The densest start-stop in the table. |
| Daydream | one 8s relax | A short continuous let-go. Helpful, but 8s is shorter than a 12–15s void, and it is one of only a few non-stop macros. |
| The Squat | squat (stop), 10s relax, stand (stop) | A partial let-go bracketed by posture holds. |
| Lazy Release | 20s relax | A slow seep. Helpful for passive release. 20s is longer than the 12–15s calibration. |
| Capacity Check | 15s push | A timed forced stream. Not passive. |
| Total Failure | 25s relax, "do not push" | A full let-go. The best match for relaxed release. Duration is long versus calibration. |
| The Gush | 15s push, "push hard" | Straining. Hurts relaxed release. |
| Submission | 30s relax, empty fully | A full let-go, too long versus a 12–15s calibration. |

The dedupe is one retry if the next macro's text matches the last macro. Micros have no cooldown. Six micros and eleven macros, and most of them are the same family (spurt, stop, spurt), so the session feels like one event on repeat even when the label changes.

### Conditioning-only group (`js/cond-events.js`, 13)

These are gated by direction, method, and consent. They are not the repeating full-session deck.

| Id | Direction | Trains in practice |
| --- | --- | --- |
| Surprise urge | A, day | Two `stop` steps ("notice", "stop if strong"). Names a short warning, then tells you to stop. Hurts first-urge let-go. |
| Just noticed | A, day | Check, then no push. Fits unnoticed wetting if the check is after the fact. The first step is still a stop. |
| Relax drill | A, needs relaxed | Two short relax steps. Fits passive release. Too short to be a void (4s + 5s). |
| Partial moment | A | Two relax steps. Fits a small let-go. Good. |
| Same cue | both, day | Cue, then a small relax. Fits cue pairing. The cue step is a stop. |
| Pass request | A | Ask, then take the answer. Both stops. A social rule, not a release. Neutral for wetting goals. |
| Sleep through it | A night, stay-in-bed or deeper sleep | Quiet, then settle. Fits bedwetting. Short. |
| Deeper-sleep wind-down | A night, deeper sleep | Lights and the same cue. A habit cue, not a void. Helpful and not a hold. |
| Hold a bit longer | B, or A only with `hold_longer` | A short wait, then go. This is the hold drill. Correct for more control. Wrong for untraining. |
| Urge surfing | B, needs urge surfing | Notice, let the peak ease. Both stops. Correct for more control. |
| Scheduled void | B, needs timed void | Two short relax steps. Correct for a planned toilet trip. Too short to be a full empty. |
| Pelvic-floor set | B, needs kegels | Gentle squeeze, then relax. Correct kegels. A stop step. Not for untraining. |
| Wake on urge | B night | Wake and get up. Correct for more control at night. Opposite of sleep-through. |

### Other tables (not the conditioning deck, but they exist)

Each line is the training effect, then the labels.

**Continent micros, `MICRO_CONTINENT_D20` (20), all `stop`.** Practice ignoring a twinge. Helps more control. Hurts every untraining goal. Tiny Twinge, Sudden Awareness, Stretch Twinge, Cough Hold, Deep Breath, Position Shift, Mild Wave, Water Sound, Cold Shiver, Laugh Clench, Morning Stretch, Yawn Reflex, Staircase Bounce, Belt Pressure, Drink Sip Awareness, Sitting Down Nudge, Phone Vibration Startle, Leaning Forward, Temperature Change, Background Thought.

**Somewhat-incontinent micros (20).** Mostly a leak then a push or a relax, some stops. Mixed: good raw material for dribbles and stress leaks, often framed as an accident you didn't want. Stress Dribble, Urgency Spike, Relaxation Leak, Standing Spurt, Focus Slip, Giggle Leak, Cold Trigger, Drink Pressure, Yawn Release, Walking Leak, Bending Over Spurt, Heavy Bag Dribble, Sneeze Chain, Key-in-Lock Urge, Nervous Spurt, Post-Sip Leak, Running Spurts, Doorbell Startle, Full Belly Push, Ticklish Leak.

**Mostly-incontinent micros (20).** Longer leaks, still some "squeeze is futile" stops. Constant Dribble, Spasm Flood, Position Failure, Laugh Flood, Relax Failure, Sneeze Release, Warmth Spreading, Gravity Stream, Squeeze Futile, Trickling Away, Cough Cascade, Sitting Leak, Hiccup Burst, Stretch Stream, Walking Gush, Deep Breath Leak, Surprise Spasm, Bending Flood, Yawn Chain Leak, Double Spasm.

**Fully incontinent micros (20).** Almost all relax. Unaware wetting, steady stream, passive release. The best existing pool for "it already happened." Unaware Wetting, Steady Stream, Movement Flood, Complete Relax, Babysitter Finds Out, Passive Release, Laugh Gush, Sitting Puddle, Screen Drift, Ghost Leak, Breathing Leak, Sleeping Drip, Sneeze Torrent, Comfort Flood, Fidget Flow, Delayed Awareness, Eating Release, Yawn Flood, Phone Distraction, Background Emptying.

**Babysitter accidents (three tables, 20 each).** A mix of flood, start-stop, and "you tried to hold." Useful as flavor for surprise and stress leaks. The permission table (10) is "you may go now," which is a toilet pass, not gear wetting.

**NPT macros (two tables, 20 each).** Mostly relax, including No Signal Void, Zero Warning Void, Automatic Release, Passive Stream. Good donors for signal fade and full let-go, once the babysitter voice is optional.

**Dependent micros (20) and macros (20).** Many are clench, pat, stutter-soak, pulse-check. The Floodgate, The Mush, Let-go, and The Lazy River are continuous. The Stutter-Soak and Double Clutch are start-stop. This is the "dependent" profile's event style, not its sip count.

**Diaper micros, `MICRO_DIAPER_D8` (8).** Pressure Check (a pulse), Double Tap (push-stop-push), plus shiver, cough, position, seep, stand-up squirt. Mixed.

**Training micros (31) and full failures (31).** Built to practice holding and then failing. Titles include Stutter-Stop, Scissor Squeeze, Clutch, Stuttering Soak, Broken Promise, False Finish. Right for a training profile. Wrong as the default untraining deck.

**Omorashi holds (20) and messy holding gauntlets.** Long `stop` sequences (wall sit, plank, kegel strength, jumping jacks). These are hold challenges. Out of scope for untraining.

**Ward micros (10) and macros (20).** Inspections, permission, denial, capacity tests. Institutional control play. Neutral as fiction, not a conditioning drill.

**Protection transitions (six tables, 6 each).** A change of gear with a line of caregiver tone. Not a void. Useful only as a rare gear-step cue, and only if the tone stays optional.

**Bedwetting tables.** Mercy-during (6 micro, 6 macro) is "catch it and clench." During, after, and sleep-through are dribbles and floods with little or no stop. Sleep-through macros (Slept Through It, Completely Wet, Deep Sleep Flood, Night Flood) match bedwetting and deeper sleep. Mercy variants match more control at night.

**Movement challenges (4).** Labeled "Check Challenge." Not a wetting guide.

**Restroom dispatch.** One zero-time stop: go to the restroom.

**Gauntlet step pool and messy pushing accidents.** Holds and pushes. Not for untraining.

## 2. Goals against current events

"Helps" means the event's steps match the goal if you follow them. "Hurts" means the steps train the opposite. The conditioning full-session deck is called out because that is what repeats.

| Goal | Helps today | Hurts today | Neutral |
| --- | --- | --- | --- |
| Shorter hold (want: let go sooner) | Daydream, Lazy Release, Total Failure, Submission, Partial moment, Relax drill | Every `stop` step: Spasm Series, Sprinkler, Failed Hold, Walking Leak, all six standard micros that clench, continent micros, omorashi holds, Hold a bit longer | Pass request |
| Shorter warning / signal fade | NPT "No Signal Void", "Zero Warning Void" (not in the conditioning deck). Surprise urge names it, then says stop | Surprise urge's two stop steps. Anything that says "notice, then hold" | Gear changes |
| Sudden urges | Urgency Spike, Surprise Spasm, Out-of-Nowhere Spasm (training table, not in the deck) | Follow-up clench after the spurt | — |
| Notice less / unnoticed leak | Just noticed, Unaware Wetting, Ghost Leak, Delayed Awareness, bedwetting after-wake and sleep-through | Events that say "feel it and clench" (Thin Dribble, Mini Stream) | — |
| Dribbles | Pinprick Blink, diaper Seepage, bedwetting sleep-through dribbles, somewhat-incontinent stress dribbles | Turning the dribble into a clamp (Thin Dribble, Peppery Patter) | — |
| Full feeling / full let-go | Total Failure, Submission, dependent Floodgate and Mush, bedwetting sleep floods | Start-stop macros. The Gush (push hard). Capacity Check (forced 15s push) | — |
| Bedwetting | Sleep through it, sleep-through macros and micros, before-awake methods have no matching long event | Mercy bedwetting tables (Fight The Flood, Sleepy Clench). Wake on urge | Wind-down, which is a cue and not a void |
| Deeper sleep | Wind-down, sleep-through floods that do not wake you | Any guide that says wake, clench, or get up | — |
| Relaxed release | Relax drill, Partial moment, Total Failure, Lazy Release, fully-incontinent passive items | Start-stop, push-hard, kegels, omorashi holds | Same cue, if the second step is a real let-go |
| First-urge release | Nothing in the live deck says "go now and don't stop" | The whole standard micro table and the four start-stop macros | — |
| Thin gear / underwear | No event is about less padding. The goal is only a gear field | Thick-diaper caregiver transitions if they play as "more padding" | Transitions toward a pad, if tone stays light |
| More control | Urge surfing, scheduled void, pelvic-floor set, wake on urge, continent micros, training holds, mercy bedwetting | Full let-go and sleep-through, if they are mixed in | — |
| Timed voiding | Scheduled void (too short) | Random floods between planned trips | — |
| Urge surfing | Urge surfing | Being told to push a spurt on purpose | — |
| Kegels | Pelvic-floor set (gentle, then relax) | Max-clench wording in training micros | — |
| Double voiding | No event | — | A toilet trip with no second sit |
| Bedwetting alarm (more control) | Wake on urge | Sleep through it | — |
| Front-load drinks | No event. v53 sips are separate | A late-night flood prompt if evening drinks were set earlier | — |

## 3. New events

Times below use a 12–15 second full void. Partials and dribbles are slices of that, not a second hold. Untraining events have no `stop` after the release.

### First urge / urgency (let go when it starts)

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| First ping | The first urge is the cue. Let it go. Don't wait for a stronger one. | GO, relax 12–15s | Day, method first-urge, tank can take a void | The practice is the timing, not a clench. |
| Don't upgrade it | It is still small. Going now is the win. | START, relax 6s | First urge of a block, or urgency just crossed the profile threshold | A partial at the first signal, not at the peak. |
| Doorway | You stood up to go and it started. Let it finish in the gear. | STAND, relax 4s; THEN THE REST, relax 10s | Transition: leaving a chair | Position plus first urge. |
| Wave, no hold | The urge rose and you did not argue with it. | LET IT, relax 12–15s | Surprise family, full | A full void with no stop inserted. |
| Two urges | A second ping showed up. Go again. Don't save it. | AGAIN, relax 8s | After a recent small void, tank still above the minimum | Repeats the cue without start-stop. |
| Arrived home | The habit used to be "wait until the bathroom." The new one is "it can happen here." | CUE, relax 3s; LET GO, relax 12s | Transition: arriving home | Replaces the old hold-until-the-door pattern. |

### Relaxed / passive release

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| Soften | No push. Let the muscle drop and stay dropped. | BREATHE OUT, relax 4s; RELEASE, relax 12–15s | Method relaxed | The whole void is one relax. |
| Already going | You noticed because it had started. Don't catch it. | NOTICE, relax 3s; KEEP GOING, relax 10s | Mid-session, tank mid | Interrupts the grab-and-stop reflex. |
| Heavy sit | Sitting made it easy. Stay heavy. | SIT, relax 14s | Position: sitting | Passive, one posture. |
| No finish squeeze | It is tapering. Let the taper finish. Don't cut it off. | TAPER, relax 6s | End of a void | Removes the closing clench. |
| Sigh | One sigh, and it goes with the breath. | SIGH, relax 12s | Low urgency, surprise | Pairs release with an easy body cue. |

### Signal fade (shorter warning)

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| No preview | There wasn't a warning this time. It is already happening. | LET GO, relax 12–15s | Surprise family, weight up when warning-want is short | The missing signal is the lesson. |
| Late notice | You got the signal as it started, not before. | WITH THE START, relax 12s | Warning dimension moving down | Warning shrinks to zero lead time. |
| Wrong guess | You thought you had time. You didn't. Let this one go. | NOW, relax 14s | After a period with no event | Breaks the "I can wait" prediction. |
| Quiet bladder | Nothing nagged. Check, and it may already be wet. | CHECK AFTER, relax 4s | Notice-want is low, small tank ok for a dribble | A signal that never came. |

### Notice less / unnoticed

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| Found it later | The wet spot is from a minute ago. You don't rewind it. | FOUND IT, relax 3s | After any small release, delayed | The check is after, not a stop. |
| Screen | You were looking at something else. A little happened. | DRIBBLE, relax 3s | Distraction context | Unnoticed because attention was elsewhere. |
| Warmth only | The clue is temperature, not a urge. | WARM, relax 4s | Dribble family | Sensation after the fact. |
| Morning news | You slept or dozed. The result is already there. | ALREADY WET, relax 5s | Night, or a nap | Same shape as sleep-through, by day. |

### Dribbles, spurts, seep (surprise mix, small end)

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| One drop | A single drop. Leave it. | DROP, relax 2s | Surprise roll, small | Tiny, no clench after. |
| Three taps | Three little spurts, and then it rests. No catch. | SPURT, relax 2s, three times | Surprise, spurt family | Spurts without a stop between them. |
| Slow seep | A seep that takes its time. | SEEP, relax 8s | Tank low-to-mid | Between a dribble and a void. |
| Cough | The cough did it. Don't correct it. | COUGH, relax 2s | Stress dimension | A stress dribble with no recovery hold. |
| Laugh | The laugh opened it for a second. | LAUGH, relax 3s | Stress or sudden | Same, for a laugh. |
| After the sip | The sip you just took moved something. | AFTER SIP, relax 3s | Shortly after a sip prompt | Ties the drink to a small result. |

### Full let-go and fullness

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| All of it | Empty. No push, no pause. | EMPTY, relax 12–15s | Surprise full, tank near a normal void | Matches calibration, not a 25–30s guide. |
| Halfway on purpose | Let about half, then you are done because it stopped, not because you stopped it. | HALF, relax 6s | Partial family, tank above minimum | A partial that does not say "clamp." |
| Overfull story | It felt like a lot. The gear has it. | FULL, relax 14s | Fullness dimension moving toward "less reserve" | The feeling of fullness is allowed to finish. |
| Second wave | A bit more came after you thought it was over. Let that too. | MORE, relax 5s | Soon after a full, if tank model still has a remainder | An aftershock without a clutch. |

### Bedwetting

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| Before you sit up | You stirred. Stay down and let it happen before you are awake. | STAY HEAVY, relax 12–15s | Night, method before-awake | The existing method has no event this long. |
| Stay put | You woke. Staying in bed is the practice. A real need can still get up. | STAY, relax 8s | Night, stay-in-bed | Clearer than the 4s+6s sleep-through cue. |
| Slept through | It finished while you slept. Morning is when you know. | MORNING, relax 5s | Night, depth want is deep | No wake step. |
| Side | On your side, a slow night leak. | SIDE, relax 12s | Night, lying-down method | Posture for night, not a new skill of holding. |
| Dream wet | The dream had water in it. So did the bed. | DREAM, relax 12s | Night, surprise full | A full with no warning and no wake. |

### Deeper sleep

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| Same bedtime | Lights, cue, down. The void is not a decision. | CUE, relax 4s; SLEEP, relax 12s | Night, deeper-sleep or bedtime cue | Cue, then the release happens off-stage. |
| No second wake | If you surface, you sink again. You don't get up to check. | SINK, relax 8s | After a night micro | Removes the checking habit. |
| Dark room | The room stays dark. You don't turn a light on to see. | DARK, relax 6s | Night routine | Protects the sleep, not the hold. |
| Heavy body | Limbs stay heavy. The pelvic floor stays dropped. | HEAVY, relax 12s | Night, relaxed or deeper | Passive night release. |

### Thin protection

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| Less between you | What you are wearing holds less. A small one is enough to notice. | SMALL, relax 4s | Gear want is lighter than now | The event matches the thinner goal. Size stays small so it is survivable. |
| Underwear day | A dribble with nothing thick under you. | DRIBBLE, relax 3s | Thin or underwear goal, day | Practice in the goal gear, not a flood. |
| Liner only | The liner took a seep. That was the plan. | SEEP, relax 6s | Pad/liner goal | Mid size for a pad, not a diaper flood. |
| Change later | It is wet and you are not rushing to fix it. | LEAVE IT, relax 3s | No-toilet block | Staying in a light wet, without a hold drill. |

### Surprise mix (the family the quiz should be able to shuffle)

Use these as tags, not as one table. A profile with surprise or signal-fade in the goal draws from several tags in one session.

| Family | Size | Example draw |
| --- | --- | --- |
| Tiny dribble | 2–3s relax | One drop, cough, laugh |
| Spurts | 2s relax, repeated, no stop | Three taps |
| Unnoticed | 3–5s, check after | Found it later, warmth only |
| Slow seep | ~8s relax | Slow seep, liner only |
| Full, no warning | 12–15s relax | No preview, All of it |
| Position | the release plus stand, sit, or lie | Doorway, Heavy sit, Side |
| Cue-paired | a named cue, then the release | Same bedtime, Arrived home |
| Transition | standing up, getting home, sitting down | Doorway, Arrived home |
| Post-drink | soon after a sip | After the sip |

### More control (only when that method is on)

| Name | Text | Guide | When | Why |
| --- | --- | --- | --- | --- |
| On the clock | The planned time is now. Go, even if the urge is small. | TOILET, relax 12–15s | Timed void | A real empty, not a 4s sketch. |
| Let the wave drop | Notice it. If it eases, then you go. If it gets strong, you go anyway. | NOTICE, stop 5s; THEN GO, relax 12s | Urge surfing | The stop is the surf, and it has an end. |
| Gentle set | Squeeze for 4 seconds, then a full relax. Three times. Not a max clench. | SQUEEZE, stop 4s; RELAX, relax 4s; repeat | Kegels | Matches the method text. |
| Second sit | You went. Sit once more and let the rest finish. | AGAIN, relax 6s | Double voiding | The missing event for that method. |
| Alarm wake | The alarm is the cue to get up and finish in the toilet. | WAKE, stop 3s; TOILET, relax 12s | Night alarm | More control at night. |
| Earlier drinks | The sip belongs earlier. Tonight's void is not a late glass. | NOTE, relax 3s | Front-load, evening | A reminder, not a flood. |
| Hold a little | A short wait, then you go. Stop if it gets strong. | WAIT, stop 8s; GO, relax 12s | Hold method only | The hold has a door at the end. |

## 4. Selection

Weight by the profile, not by a fixed accident table.

- Build the deck from events whose direction matches the track (A or B) and whose method list is empty or overlaps the methods the quiz turned on. Goals add weight: first-urge, relaxed, signal fade, notice, dribble, fullness, bedwetting, deeper sleep, thin gear, and the more-control methods above.
- Pacing scales how fast the mix moves toward the goal. Instant and hybrid can use the goal weights now. Gradual and slow burn keep more of the current-level events until check-ins agree. That is the same pacing idea the urge model already uses.
- Surprise mode, when signal fade, sudden urges, or "you don't always know" is in the goal: each draw rolls a family first. A suggested mix for a strong surprise goal is about 40% tiny or spurt, 25% seep or partial, 25% full with no warning, 10% unnoticed-after. A low surprise goal inverts that (mostly signaled, smaller).
- Anti-repeat. Do not play the same id twice in a row. Do not play the same family more than twice in a window of four. Shuffle a deck of the eligible ids and deal it, then rebuild. The current one-retry-if-same-text check is not enough, because Spasm Series and The Sprinkler are different labels and the same exercise.
- Tank from v53. If the estimate is under the void minimum, do not deal a full or a partial. Deal a sip, or a tiny dribble only if the minimum allows a dribble. A full let-go waits until the estimate can hold one. Size the guide to the tank: a 12–15s step is a full estimated void, a shorter relax is a fraction of it.
- More-control events stay out of an untraining deck unless that method was opted in. Hold, surf, kegels, alarm wake, and timed toilet trips are opt-in.

## 5. What to build later

1. Point My Conditioning's micro and macro tables at a goal deck. Stop using `MICRO_STD_D6` and `FULL_D20` for that profile. That is the start-stop loop.
2. Add the anti-repeat deck (no same id twice, family cap, shuffle) before writing a lot of new copy.
3. Add surprise-family weights from the quiz's warning, sudden, notice, and dribble wants.
4. Add the new events in section 3, starting with first-urge, relaxed full let-go, unnoticed, and sleep-through. Reuse NPT "no signal" and bedwetting sleep-through texts where the tone fits, with the babysitter voice optional.
5. Keep v53's tank as the size and the "drink first" gate. Scale the 12–15s step down when the void is partial.
6. Leave omorashi holds, training stutter events, and ward denial events off the untraining deck.
