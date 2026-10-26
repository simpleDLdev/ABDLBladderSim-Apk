# IDEAS catalogue — numbered for item-by-item approval

**258 ideas.** Reply with the numbers to approve, e.g. "approve 1–12, 40, 77".

*Branch `android-capacitor`, v13. Game rules only: every item is an in-app rule (a timer, dice, gate, prompt or limit). Nothing here trains the real body. A real urge always wins, and the skin-safety cap always overrides curses and gates. No sexual content; no laxatives, enemas, suppositories, restraints or chastity; no laugh/cough events; drink prompts stay capped (js/safety.js). Bedwetting mode is silent. Office mode uses neutral wording.*

Sources (mechanics only): Omorashi Curse blessings/curses list, the '1 Day in Diaper' roulette, js/classes.js, docs/DESIGN-classes-perks-campaign.md, the Rank Trainer HTML files. Levers used throughout: **change saturation threshold, timer urgency, chance of staying dry, urgency-threshold accident flags, accident shape (floods ↔ small dribbles).**

## Ways to play / game modes

1. **Natural Urge roulette (current)** — Press 'I need to go' and get go / wait / hold / dribble / gear; v13 adds the post-accident follow-up step.
2. **1 Day in Diaper roulette** — One-shot day-long challenge. At the start, roll for May I pee, May I change, May I mess (messy toggle only) and how many changes you get.
3. **Change-budget day** — Roll 1–6 changes for the day (scaled by level). Every change spends one; when the budget is used up, change only past the skin-safety limit.
4. **Roguelike run** — Multi-day run: Control resets, pick 1 of 3 perks each morning, the run ends at a rank goal or after a bad streak.
5. **Potty Path board** — Daily board-game roll moves you along a path of event squares (see the Potty Path section).
6. **Babysitter afternoon** — A 2–4 h block on the sitter profile with check-ins on the change schedule and scarce potty permission.
7. **Big Kid Test** — A strict day with longer waits. Hit 5 potty windows and get a Control bonus; one miss ends the test, with no penalty.
8. **Little Day** — A regress-flavoured day: lower odds of staying dry, hidden waits, little wording. Ends at bedtime.
9. **Chaos day** — Class re-rolled every 3 rolls; a variety bonus star for each re-roll you finish.
10. **Quiet office day** — Neutral wording all day, silent prompts, shorter grace, 'Reminder / Check in' alarms only.
11. **Silent night mode** — Bedwetting play: nothing sounds or schedules at night; results show only at the Morning Check.
12. **Weekend campaign** — A 2-day mini campaign with one rank goal, one rest card and a summary card on Sunday night.
13. **Seven-day ladder** — Each day unlocks one rule (gate, saturation rule, timer) from the approved catalogue; day 7 runs them all.
14. **Dice-only mode** — No profiles: every decision is a d20 against level DCs (see urgency thresholds).
15. **Caregiver's Choice** — A partner or the app picks today's card, class and gates from the approved list.
16. **Practice mode** — Rolls and timers without logging or Control changes, for trying out new rules.

## Permission gates (May I pee / change / mess)

17. **May I pee? (roll)** — Before a potty trip, roll yes / wait N min / 'use your gear'. Odds come from the level's perm value.
18. **May I pee? ask twice** — The first ask is always 'not yet' (2–5 min); the second ask rolls normally. Ask-Nicely curse.
19. **May I pee? polite token** — Spend a Please token (3 per day) for automatic permission; tokens refill at the Morning Check.
20. **May I change? (current)** — Report saturation; at or past the level threshold roll yes / later / after next wetting; skin-safety limit forces 'now'.
21. **May I change? budget** — Each 'yes' spends one change from the day's rolled budget.
22. **May I change? countdown** — 'Later' sets a visible timer with one native reminder (silent in bedwetting mode).
23. **May I mess? (messy toggle only)** — Manual and opt-in. Roll potty / gear / wait; never automatic, never timed pressure.
24. **Hall pass** — One guaranteed potty permission per day (perk or star-shop item).
25. **Permission streak** — Three granted asks in a row: the next ask is 'wait 5' (a gentle brake).
26. **Gate by time of day** — Morning gates are lenient and evening gates stricter (or the reverse for Night Owl).
27. **Gate by Control band** — Big Kid: no gates; Little Kid: pee gate only; Toddler: pee + change gates; Infant: all gates.
28. **Real-urge override** — Always available: logs 'override' neutrally, with no Control loss and no punishment.

## Change rules and saturation gates

29. **Level saturation threshold** — The change is allowed only when reported saturation ≥ the level's threshold (Big Kid 30 → Infant 75).
30. **Hard skin-safety cap** — After N hours worn (default 3), the change is always allowed, whatever the rules or curses.
31. **Wet-count rule** — A change is allowed after X wettings in the same gear (1 for Big Kid … 3 for Toddler).
32. **Next-wetting rule** — The 'after' outcome: change after your next wetting, then ask again.
33. **Saturation ladder** — Each failed change roll raises your threshold by 5 for the day (cap 90, skin cap still applies).
34. **Leak-through rule** — A leak through the gear always grants a change now and suggests one step thicker next time.
35. **Check-in rule** — Reported saturation is asked at every check-in; at ≥ threshold the change roll fires automatically.
36. **Spare-aware rule** — With no spares left, 'yes' becomes 'change as soon as you restock' (current text).
37. **Upgrade rule** — Two leak-throughs in a day turn the next change into a thicker spare, if you have one.
38. **Morning change** — The Morning Check always allows a change (bedwetting-friendly).
39. **Comfort bump** — The Comfort blessing lowers today's threshold by 15.
40. **Diapered curse rule** — Pull-ups and pads are disallowed as change targets for the curse's duration.

## Urgency thresholds and accident-risk curves

41. **User urgency 0–10 always entered** — The app never guesses; the slider value picks the risk band.
42. **Flag at 7/10** — Urgency ≥ 7 marks the roll 'at risk': dribble odds ×1.5 for that roll.
43. **Flag at 9/10** — Urgency ≥ 9: 'gear' odds ×2 and waits halved; a big flood is possible at low Control.
44. **Linear curve** — Accident chance rises evenly with urgency (gentle, Trainee default).
45. **Cliff curve** — Near-zero risk until a level threshold, then a steep jump (Overconfident Big Kid).
46. **Early-bump curve** — Risk climbs early and then plateaus: frequent small dribbles, rare floods (Dribbler).
47. **Late-spike curve** — Low risk for long, then a flood at high urgency (Flooder).
48. **Chain pressure** — Each consecutive wait or hold roll adds +1 to the effective urgency (current chain counter).
49. **Timer urgency** — Wait ranges scale by level (Big Kid 30–60 min → Infant 1–4 min); Fast Fill ×0.7, Long Fuse ×1.3.
50. **Chance of staying dry** — Per-level 'go' odds (Big Kid 60 … Infant 4); blessings and curses shift it by ±10.
51. **Warning budget** — Seconds between 'it's urgent' and a forced roll (shorter at low Control).
52. **Mercy floor** — Odds of staying dry never drop below 2 out of 100 unless the profile is Infant.

## Accident types and how they're distributed

53. **Dribble** — A few drops; most common at Toddler or Little Kid with Dribbler. Usually followed by 'finish on the potty' at high Control.
54. **Leak (small)** — A damp patch; triggers the change check by saturation rule.
55. **Flood** — The whole tank; triggers the rest timer + change check. Common for Flooder and Overconfident.
56. **Cascade** — A leak that, on a failed d20, chains into a second leak within 10 min (Cascade Prone / Cascade Failure).
57. **Pre-potty dribble** — A small leak right before every potty permission (Dribbler event step).
58. **After-dribble** — A small leak after finishing on the potty (post-void dribble trait).
59. **Quiet leak** — Not announced; revealed at the next check-in (Stealth / Quiet One).
60. **Wet night** — Only resolved at the Morning Check; silent.
61. **Nap wetting** — A daytime rest window resolves like a short night.
62. **Rush leak** — A leak while heading to the potty after a 'go' (Fast Filler).
63. **Distribution: Dribbler** — 70 dribble / 25 leak / 5 flood.
64. **Distribution: Flooder** — 10 dribble / 20 leak / 70 flood.
65. **Distribution: balanced** — 40 / 40 / 20 (default).
66. **Distribution by Control** — High Control skews to dribbles, low Control skews to floods (or the reverse via a curse).
67. **Accident shape picker** — A setting from Quiz B / campaign setup: many small dribbles ↔ rare big floods.

## Day vs night modifiers

68. **Separate day / night level** — Day and night have their own Control ladder positions.
69. **Night = silent** — No sounds, vibrations or notifications at night in bedwetting mode; resolve at morning.
70. **Morning shaky** — The first hour after waking uses one level lower (Night Owl).
71. **Evening fade** — After 20:00, waits ×0.8 (tired bladder).
72. **Nap window** — A daytime rest counts as a mini night (night odds, no alarms).
73. **Dry-night streak** — +1 Control per consecutive dry night (max +5).
74. **Wet-night setback** — −2 Control after a wet night, capped by the daily ±8.
75. **Night protection floor** — Night gear is never lighter than day gear (current wear rule).
76. **Bedtime potty bonus** — A logged potty right before bed shifts night odds by +5 toward dry.
77. **Night wake roll** — Optional, silent: 'May I get up?' only if the user wakes up by themselves.
78. **Day-only campaign** — Nights are excluded from scoring entirely.

## Classes

79. **Dribbler** — A little leak before every potty permission; dribble odds ×2, go ×0.6.
80. **Flooder** — Long dry stretches, then rare big floods; flood share 70.
81. **Ask-Nicely Little** — Always ask twice; the first ask is always 'not yet'.
82. **Absent-Minded** — Hidden waits; 1 in 4 rolls forgets to remind you.
83. **Overconfident Big Kid** — Cliff curve: safe until urgency 8, then flood odds jump.
84. **Leaky Toddler** — Frequent small leaks; change threshold 60.
85. **Stuck Sitter** — Potty permission only at fixed hourly slots.
86. **Night Owl Wetter** — Nights favour wet; mornings start a level lower.
87. **Stealth Mode** — Quiet leaks revealed only at check-ins; stealth bonus stars.
88. **Cascade Prone** — Each leak rolls d20 < 8 to chain a second one.
89. **Trainee** — Friendly safety net; go ×1.1.
90. **Office Agent** — Neutral wording; quiet leaks; shorter grace.
91. **Sleepyhead** — Night matters most; dry mornings boost Control.
92. **Fast Filler** — Short waits, many re-rolls.
93. **Quiet One** — Fewer hard-hold prompts, more 'wait for a dribble'.
94. **Caregiver's Charge** — Scarce potty permission; change on the sitter schedule.
95. **Little Legend** — Fully geared play; curses fade faster.
96. **Scout** — Extra spares; trip-focused mastery.
97. **Night Owl** — Night play friendlier; mornings shaky.
98. **Roguelike Runner** — Perk pick each morning; Control resets per run.
99. **Steady Holder** — +1 potty pass; leaks at high urgency are full, not partial.
100. **Jumpy** — Spikes (urge noise); a Breathe button cancels one per cycle.
101. **Sprinter** — Race timer at high urgency; Hurry lowers the payload once.
102. **Wobbly** — Action-card d20 checks when standing or lifting (user-logged).
103. **Daydreamer** — 30 of every 100 micros unannounced; revealed at the next check.
104. **Unlucky** — Two dice, keep the worse one; double stars on a dry cycle.
105. **Little Sprout** — Not-potty-trained rules: changes always granted, never punished.
106. **Chaos Kid** — Class re-rolled every macro; variety bonus.
107. **Gambler** — Every result can be doubled or nothing once per hour (from the roulette perk).
108. **Puddle Pirate** — Floods give treasure stars; dribbles give none.
109. **Clockwork** — Fixed-interval waits only; no randomness in timers.
110. **Snuggle Bug** — Comfort blessing permanent; thresholds −10; dry odds −10.
111. **Busy Builder** — Absent-Minded light: every 3rd wait is hidden.
112. **Brave Big Kid** — Long waits; the first accident of the day is a flood.
113. **Sneaky Fox** — Stealth bonus doubled; Conspicuous curse can't be drawn.
114. **Good Helper** — Permission rolls +10; star tasks pay +1.
115. **Thirsty Explorer** — Capped drink prompts on (safety.js caps), waits shorter after each.
116. **Night Light** — Night wake roll available; dry-night streak bonus +2.
117. **Pull-up Pal** — Pull-ups only; change threshold 50; leaks count as small.
118. **Padded Professor** — Mastery XP ×1.5; dry odds −5.
119. **Weathervane** — Daily draw always 2 cards; keep one.
120. **Countdown Kid** — Every wait is visible with a big timer; alarm on every wait.
121. **Mystery Box** — Class hidden until the first accident reveals it.
122. **Tidy Tot** — Changes give +1 star; skin-safety cap at 2 h.
123. **Bounce-Back** — After an accident, the next roll gets go ×1.5.

## Symptoms / unpotty traits (with + and − effects)

124. **Ask Nicely** — + Polite token refunds on a granted ask · − the first ask is always 'not yet'.
125. **Low Capacity** — + More frequent small dry trips earn stars · − waits ×0.6.
126. **Absent Minded** — + Hidden waits pay a bonus star when survived · − 1 in 4 reminders is skipped.
127. **Shame (reframed: Blushy)** — + Calm-change task stars ×2 · − accident log asks for a memo (neutral, no teasing).
128. **Torrents** — + Fewer accidents overall · − every accident is a flood.
129. **Bad Wetter** — + Dribbles never count against Control · − change threshold +15.
130. **Overconfident** — + Long waits · − cliff curve at urgency 8.
131. **Leaky** — + Floods are rare · − dribble odds ×1.8.
132. **Noticed (was Bully Magnet)** — + Check-ins give a star · − a random extra check-in each hour (no teasing text).
133. **Conspicuous** — + Bulkier gear allowed as a free upgrade · − Stealth bonuses off.
134. **Stuck** — + Waiting tasks pay double · − potty only in fixed slots.
135. **Diapered** — + Changes always allowed at threshold · − pull-ups/pads not allowed today.
136. **Trigger Word** — + Pick your own safe in-app word · − when the app shows it, roll a d20 wait-or-gear (in-app text only).
137. **Cascade Failure** — + Cascade chains pay stars · − leaks chain on d20 < 10.
138. **Fast Fill** — + More rolls per hour · − shorter waits.
139. **Quiet Signals** — + Stealth play · − fewer hard-hold prompts, more 'wait for dribble'.
140. **Deep Sleeper** — + Nights are fully silent and restful · − night wet odds +15.
141. **Pre-void Dribbler** — + Potty trips still earn stars after a dribble · − dribble on 40 of 100 permissions.
142. **Post-void Dribbler** — + Finishing on the potty earns +1 · − small after-dribble chance.
143. **Urge Racer** — + Race wins pay double · − warning budget 25 s at high urgency.
144. **Spiky** — + Breathe cancels one spike · − random urgency spikes.
145. **Wobbly Knees** — + Brace = advantage on action cards · − action cards appear more often (user-logged movements only).
146. **Nap Wetter** — + Naps silent · − nap wet odds +20.
147. **Morning Rush** — + Morning go odds +10 after the first trip · − the first 30 min after waking is high risk.
148. **Evening Fade** — + Evening tasks pay +1 · − waits ×0.8 after 20:00.
149. **Clock Watcher** — + All waits visible · − no hidden-wait bonuses.
150. **Lucky Streak** — + Every 5th roll is a go · − after a streak, the next roll is gear.
151. **Thick Skin** — + Trigger leak chance ×0.5 · − change threshold +10.
152. **Spare Hoarder** — + +2 spares · − change budget −1.
153. **Sticker Fan** — + Star tasks +1 · − no perk picks.
154. **Mercy Heart** — + Cancel one denial per day · − Control gains ×0.8.
155. **Gold Star** — + Next Control gain doubled · − next loss doubled too.
156. **Long Fuse** — + Waits ×1.3 · − floods more likely when they do happen.
157. **Iron Hold** — + The first missed window is forgiven · − dribble odds ×1.2.
158. **Clear Signals** — + Warnings always on · − Stealth bonuses off.
159. **Fog** — + Hidden-wait stars · − fewer warnings.
160. **Splashy** — + Floods give treasure · − leak-through chance +10 (change now).
161. **Steady Drip** — + Never floods · − dribbles every 2nd wait.
162. **Little Lungs** — + Breathe button available · − spikes +1 per hour.
163. **Homebody** — + Lenient gates at home · − strict gates when 'out' is set.
164. **Adventurer** — + Out-and-about stars ×2 · − fewer potty windows while out.
165. **Night Light Lover** — + Night wake roll allowed · − mornings start shaky.
166. **Comfy Padding** — + Thresholds −10 · − dry odds −5.
167. **Big Kid Pride** — + Dry-window stars ×2 · − every accident is −1 extra Control.

## Blessings, curses and daily draws

168. **Blessing: Magical Cleanup** — One free change ignoring all thresholds (skin cap still applies).
169. **Blessing: Valuable** — Star rewards ×2 for the day.
170. **Blessing: Stealth Mode** — Quiet leaks pay a star when revealed at check-in.
171. **Blessing: Comfort** — Change threshold −15 today.
172. **Blessing: Debt** — Take 5 stars now; repay 7 tomorrow or draw a curse.
173. **Blessing: Prime Time** — One hour of the day with double stars and lenient gates.
174. **Blessing: Shared Burden** — Partner mode: a curse can be passed to the partner's card (in-app only).
175. **Blessing: High Risk High Reward** — Odds of staying dry −15, but every dry window pays triple.
176. **Blessing: Revenge** — After an accident, the next curse draw is re-rolled.
177. **Blessing: Patient Zero** — The first accident of the day is free (no Control loss) and gives a star.
178. **Curse: Ask Nicely** — Ask-twice gate all day.
179. **Curse: Low Capacity** — Waits ×0.6 today.
180. **Curse: Absent Minded** — Every wait hidden; reminders skipped 1 in 4.
181. **Curse: Torrents** — Accidents today are floods.
182. **Curse: Bad Wetter** — Change threshold +15.
183. **Curse: Overconfident** — Cliff curve at 8/10.
184. **Curse: Leaky** — Dribble odds ×1.8.
185. **Curse: Noticed** — An extra neutral check-in each hour.
186. **Curse: Conspicuous** — Stealth bonuses off; thicker gear suggested.
187. **Curse: Stuck** — Potty permission only at the top of the hour.
188. **Curse: Diapered** — Day gear set to diapers (roleplay), with spares as normal.
189. **Curse: Trigger Word** — Your chosen in-app word appears at random; roll on sight.
190. **Curse: Cascade Failure** — Leaks chain on d20 < 10.
191. **Daily draw: one card** — At the Morning Check, draw one blessing or curse (odds by campaign setting).
192. **Daily draw: pick 1 of 3** — Three cards face up; keep one.
193. **Daily draw: blind pair** — One blessing + one curse; cancel a curse for 5 stars.
194. **Curse duration caps** — Every curse has a max duration (24 h at most), and the skin-safety cap always overrides.
195. **Gentle Day card** — All curses off today.

## Star economy and tasks

196. **Star: dry window** — +1 for each potty window made in time.
197. **Star: honest report** — +1 for logging saturation at a check-in.
198. **Star: calm change** — +1 for a change logged with supplies restocked.
199. **Star: follow-up done** — +1 for completing a v13 follow-up step (finish / wait / change check).
200. **Star: morning check** — +1 for logging the Morning Check on time.
201. **Star: pack your bag** — +1 for setting supplies before leaving.
202. **Star: lines task** — +1 for typing a short in-app line N times.
203. **Star: chore card** — +2 for a real chore (tidy room, fold laundry).
204. **Star: stretch break** — +1 for a 5-minute stretch (ordinary movement, no leak triggers).
205. **Star: journal** — +1 for writing a short in-app diary note.
206. **Shop: Hall Pass** — 5 stars: one guaranteed potty permission.
207. **Shop: Re-roll** — 3 stars: re-roll one Simple Urge result.
208. **Shop: Curse cancel** — 6 stars: remove today's curse.
209. **Shop: Extra change** — 4 stars: +1 to the day's change budget.
210. **Shop: Peek** — 2 stars: reveal a hidden wait's length.
211. **Shop: Gambler perk** — 8 stars: once per hour, double-or-nothing on the next star reward.
212. **Shop: Sticker skin** — 10 stars: a new sticker theme for the calendar.
213. **Star cap** — Max 20 stars per day; no stars for drinking (drink prompts stay capped).

## Campaign / Potty Path board events

214. **Square: Sunny Day** — +10 grace today.
215. **Square: Rainy Day** — Waves +1.
216. **Square: Pop Quiz** — 3 random check-ins.
217. **Square: Treasure** — +3 stars.
218. **Square: Shortcut** — Move ahead 2 if you were dry yesterday.
219. **Square: Slide** — Back 2 after a flood day.
220. **Square: Shop** — Buy one shop item at half price.
221. **Square: Class Swap** — Try another class for one day.
222. **Square: Blessing** — Draw a blessing.
223. **Square: Curse** — Draw a curse (duration-capped).
224. **Square: Rest Stop** — A free rest day.
225. **Square: Boss — Big Kid Test** — Hit 5 windows to pass the boss; failing just stays on the square.
226. **Square: Boss — Long Car Ride** — One 2-hour wait (roleplay) with a hall pass available.
227. **Square: Mystery Gear** — Gear rolled for the day.
228. **Square: Sleepover** — One night counts double for the streak (silent).
229. **Square: Mastery Gate** — Pass only with one mastery unlocked.
230. **Finish line** — Rank up and choose a new class or keep yours.

## Office-mode variants

231. **Neutral vocabulary** — Potty → restroom, diaper → protection, accident → event; emojis replaced by dots.
232. **Reminder-only alarms** — Native alarms read only 'Reminder / Check in.'
233. **Colour-light status** — Green / amber / red light instead of text.
234. **Quiet follow-up** — The v13 follow-up shows a neutral 'Next step' with a timer and no specific words.
235. **Meeting mode** — Suppress prompts for a set block; no Control loss for the block.
236. **Desk timer only** — Waits shown as a plain countdown.
237. **Discreet class names** — Tiers 1–6 instead of Infant … Big Kid (current).
238. **Neutral profile report** — Coach voice forced (current).
239. **Commute mode** — Prompts held until the user unlocks the phone.
240. **Office card deck** — Daily draws limited to neutral effects (grace, waits, checks).

## Masteries

241. **Three Dry** — 3 dry nights.
242. **Night Guard** — 5 dry nights.
243. **Patient** — 10 waits survived.
244. **Potty Streak** — 5 go results in a row made in time.
245. **Dribble Diary** — 8 dribbles logged honestly.
246. **Honest Reporter** — 20 saturation reports.
247. **Change Roulette** — 10 change rolls.
248. **Week in Gear** — 7 gear days.
249. **Out & About** — 5 trips out with supplies.
250. **Drip Before Go** — 10 pre-potty dribbles (Dribbler).
251. **Follow-through** — 10 v13 follow-up steps completed.
252. **Card Shark** — Draw 20 daily cards.
253. **Star Saver** — Hold 50 stars at once.
254. **Board Walker** — Finish one Potty Path board.
255. **Class Collector** — Play 10 different classes for a day each.
256. **Quiet Pro** — 7 office days with no override.
257. **Morning Person** — 14 on-time Morning Checks.
258. **Curse Breaker** — Survive 10 curses to the end.
