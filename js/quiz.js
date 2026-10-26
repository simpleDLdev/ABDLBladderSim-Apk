/* ===========================
   quiz.js — Profiles › My Profile: Quiz A "Where you are now" + Quiz B "Where you want to go".
   Outputs a baseline profile, a playful personality card, recommended modes, and an auto-generated
   custom program (saved through the existing custom-profile system). Sim/roleplay only.
   =========================== */
(function () {
  const KEY = 'bs_quiz_v1';
  const LEVELS = ['fully_continent', 'mostly_continent', 'somewhat_incontinent', 'mostly_incontinent', 'fully_incontinent'];
  const SYMPTOMS = [
    ['overactive_bladder', '💢 Overactive bladder (sudden waves)'], ['urge_incontinence', '⚡ Urge (can’t-wait races)'],
    ['stress_incontinence', '🤧 Stress (sneeze / cough / move)'], ['nocturnal_wetter', '🌙 Relaxation / night wetter'],
    ['giggle_incontinence', '😂 Giggle'], ['pre_void_dribble', '💧 Dribbler (on the way / after)']
  ];
  const PROT = [['none', 'Undies'], ['pad', 'Pad'], ['pullups', 'Pull-ups'], ['diapers', 'Diapers'], ['thick_diapers', 'Thick diapers']];
  const o = (v, l) => ({ v, l });
  // ----- Quiz A: real-life "where you are now" (informational baseline; never a goal) -----
  // v6: expanded (~22 Qs) — style inspired by "starting rank" roulette quizzes; playful, non-graphic.
  // score:true → 0..3 counts toward the continence level. messy:true → only shown with Messy content (#2) on.
  const QA = [
    { step: 'Habits', id: 'urgency', score: true, q: 'How often do strong, sudden urges sneak up on you?', opts: [o(0, 'Almost never'), o(1, 'Sometimes'), o(2, 'Often'), o(3, 'Most days')] },
    { step: 'Habits', id: 'frequency', score: true, q: 'Potty trips on a typical day?', opts: [o(0, '≤ 6'), o(1, '7–9'), o(2, '10–12'), o(3, '13+')] },
    { step: 'Habits', id: 'holdTime', score: true, q: 'After the first “hmm, I should go”, how long can you comfortably wait?', opts: [o(0, 'An hour or more'), o(1, '30–60 min'), o(2, '10–30 min'), o(3, 'Barely at all')] },
    { step: 'Habits', id: 'putOff', score: true, q: 'Be honest: do you put off potty breaks until the last second?', opts: [o(0, 'Never, I go early'), o(1, 'Now and then'), o(2, 'Usually'), o(3, 'Always — one more episode!')] },
    { step: 'Habits', id: 'drinks', q: 'How many drinks do you get through in a day?', opts: [o(1, 'A few'), o(2, 'Normal amount'), o(3, 'I’m always sipping')] },
    { step: 'Accidents', id: 'leaks', score: true, q: 'Day-time leaks or accidents in the last 30 days (real life)?', opts: [o(0, 'None'), o(1, '1–3'), o(2, '4–10'), o(3, '11+')], prefill: 'leaks' },
    { step: 'Accidents', id: 'lastAccident', score: true, q: 'When was your last real oops?', opts: [o(0, 'Can’t even remember'), o(1, 'Months ago'), o(2, 'This month'), o(3, 'This week')] },
    { step: 'Accidents', id: 'accidentSize', score: true, q: 'When an oops happens, it’s usually…', opts: [o(0, 'A few drops'), o(1, 'A damp patch'), o(2, 'Properly wet'), o(3, 'The whole tank')] },
    { step: 'Accidents', id: 'closeCalls', score: true, q: 'Potty dances and close calls per week?', opts: [o(0, 'Zero'), o(1, 'One or two'), o(2, 'A handful'), o(3, 'I’ve lost count')] },
    { step: 'Accidents', id: 'messyAcc', score: true, messy: true, q: '#2 close calls lately (real life)?', opts: [o(0, 'Never'), o(1, 'Rarely'), o(2, 'Sometimes'), o(3, 'Often')] },
    { step: 'Awareness', id: 'awareness', score: true, q: 'When a little leak happens, do you notice?', opts: [o(0, 'Always'), o(1, 'Usually'), o(2, 'Sometimes'), o(3, 'Rarely')] },
    { step: 'Awareness', id: 'warning', score: true, q: 'How much warning do you get before it’s urgent?', opts: [o(0, 'Plenty'), o(1, 'Some'), o(2, 'A little'), o(3, 'Basically none')] },
    { step: 'Awareness', id: 'checkDry', q: 'How often do you double-check you’re still dry?', opts: [o(0, 'Never need to'), o(1, 'Once in a while'), o(2, 'Often'), o(3, 'Constantly')] },
    { step: 'Triggers', id: 'triggers', multi: true, q: 'Any of these feel familiar? (pick any)', opts: [o('stress_incontinence', 'Cough / sneeze / lifting'), o('giggle_incontinence', 'Big laughs'), o('urge_incontinence', 'Key-in-the-door rush'), o('overactive_bladder', 'Running water / cold'), o('pre_void_dribble', 'Drips before/after'), o('none', 'None of these')] },
    { step: 'Triggers', id: 'nerves', q: 'Do excitement or nerves make things trickier?', opts: [o(0, 'Not at all'), o(1, 'A little'), o(2, 'Definitely'), o(3, 'Every time!')] },
    { step: 'Nights', id: 'nights', score: true, q: 'Wet nights in the last 30 days (real life)?', opts: [o(0, 'None'), o(1, '1–3'), o(2, '4–10'), o(3, 'Most nights')], prefill: 'nights' },
    { step: 'Nights', id: 'nightWake', score: true, q: 'If you need to go at night…', opts: [o(0, 'I wake up and go'), o(1, 'I wake up, eventually'), o(2, 'I wake up too late sometimes'), o(3, 'I sleep right through')] },
    { step: 'Nights', id: 'morning', q: 'First thing in the morning you feel…', opts: [o(0, 'Fine, no rush'), o(1, 'Ready to go'), o(2, 'Bursting'), o(3, 'It’s already happened')] },
    { step: 'Protection', id: 'protDay', q: 'What do you usually wear by day?', opts: PROT.map(([v, l]) => o(v, l)) },
    { step: 'Protection', id: 'protNight', q: '…and at night?', opts: PROT.map(([v, l]) => o(v, l)) },
    { step: 'Protection', id: 'protFeel', q: 'How do you feel about wearing protection?', opts: [o('avoid', 'Rather not'), o('backup', 'Nice as a backup'), o('comfy', 'Comfy & cozy'), o('love', 'Love it')] },
    { step: 'Structure', id: 'structure', q: 'Rules and schedules are…', opts: [o('free', 'Not for me — freestyle'), o('loose', 'Fine if they’re loose'), o('like', 'Helpful, I like routine'), o('strict', 'The stricter the better')] },
    // v13: longer Quiz A (+14)
    { step: 'Habits', id: 'pottyStyle', q: 'When you finally go potty, it’s usually…', opts: [o(0, 'Calm and planned'), o(1, 'A bit of a hurry'), o(2, 'A wiggly dash'), o(3, 'A full-speed potty sprint')] },
    { step: 'Habits', id: 'beforeLeaving', score: true, q: 'Do you go potty before leaving the house?', opts: [o(0, 'Always, like a big kid'), o(1, 'Usually'), o(2, 'Only if someone reminds me'), o(3, 'Oops, I always forget')] },
    { step: 'Habits', id: 'distracted', score: true, q: 'When you’re busy playing or focused, do you forget you need to go?', opts: [o(0, 'Never'), o(1, 'Sometimes'), o(2, 'Often'), o(3, 'Until it’s an emergency')] },
    { step: 'Habits', id: 'doubleTrip', q: 'Ever go, then need to go again ten minutes later?', opts: [o(0, 'Nope'), o(1, 'Once in a while'), o(2, 'Fairly often'), o(3, 'All the time')] },
    { step: 'Habits', id: 'waitLine', score: true, q: 'Stuck in a long line for the potty, you…', opts: [o(0, 'Wait patiently'), o(1, 'Get a bit fidgety'), o(2, 'Do the potty dance'), o(3, 'Might not make it')] },
    { step: 'Accidents', id: 'almostThere', score: true, q: 'Leaks right as you get to the potty (key-in-door, undoing clothes)?', opts: [o(0, 'Never'), o(1, 'Rarely'), o(2, 'Sometimes'), o(3, 'Most times it’s close')] },
    { step: 'Accidents', id: 'afterDribble', q: 'A little dribble after you’ve finished and pulled up?', opts: [o(0, 'Never'), o(1, 'Sometimes'), o(2, 'Often'), o(3, 'Nearly always')] },
    { step: 'Accidents', id: 'oopsFeel', q: 'After a little oops you feel…', opts: [o('shy', 'Shy and pink-cheeked'), o('shrug', 'Shrug, it happens'), o('cozy', 'Cozy, honestly'), o('giggly', 'Giggly')] },
    { step: 'Awareness', id: 'fullFeel', score: true, q: 'Can you tell how full your bladder is?', opts: [o(0, 'Like a fuel gauge'), o(1, 'Roughly'), o(2, 'Only when it’s nearly full'), o(3, 'Not really — surprise!')] },
    { step: 'Awareness', id: 'wetNotice', q: 'How fast do you notice when your gear is wet?', opts: [o(0, 'Right away'), o(1, 'In a few minutes'), o(2, 'When I check'), o(3, 'Someone else notices first')] },
    { step: 'Nights', id: 'bedtimeRoutine', q: 'Do you have a bedtime potty routine?', opts: [o(0, 'Always potty before bed'), o(1, 'Most nights'), o(2, 'When I remember'), o(3, 'Straight to bed!')] },
    { step: 'Nights', id: 'napWet', score: true, q: 'Naps: wake up dry?', opts: [o(0, 'Always dry'), o(1, 'Mostly'), o(2, 'Sometimes damp'), o(3, 'Usually wet')] },
    { step: 'Protection', id: 'changeHabit', q: 'When your gear is wet, you usually change…', opts: [o('asap', 'Right away'), o('soon', 'When convenient'), o('full', 'When it’s really full'), o('told', 'When someone tells me')] },
    { step: 'Structure', id: 'reminders', q: 'Potty reminders from a grown-up or app are…', opts: [o('no', 'Annoying'), o('ok', 'Fine sometimes'), o('yes', 'Helpful'), o('need', 'I’d forget without them')] }
  ];
  // ----- Quiz B: "where you want to go" in the sim (~14 Qs) -----
  const QB = [
    { step: 'Traits', id: 'symptoms', multi: true, q: 'Which traits does your little body have?', opts: SYMPTOMS.map(([v, l]) => o(v, l)) },
    { step: 'Traits', id: 'intensity', q: 'How spicy should they feel?', opts: [o(1, '🌱 Gentle'), o(2, '🌶️ Medium'), o(3, '🔥 Spicy')] },
    { step: 'Style', id: 'styles', multi: true, q: 'Favourite session styles?', opts: [o('babysitter', '🍼 Babysitter'), o('training', '🎓 Potty training'), o('omorashi', '💦 Holding challenges'), o('dependent', '🧸 Dependent / padded'), o('bedwetting', '🌙 Bedwetting nights (silent)')] },
    { step: 'Goals', id: 'goal', q: 'Where are you headed?', opts: [o('more', '🏆 More continent'), o('stay', '⚖️ Stay about here'), o('less', '🫧 Less continent'), o('bedwetting', '🌙 Bedwetting sim focus')] },
    { step: 'Goals', id: 'time', q: 'How much play time per week?', opts: [o(1, 'A session or two'), o(2, 'Most days'), o(3, 'Every day, I’m committed!')] },
    { step: 'Goals', id: 'startPref', q: 'Campaign starting rank?', opts: [o(0, '🎲 Let the quiz decide'), o(-1, '🌱 One rank easier'), o(1, '🔥 One rank harder')] },
    { step: 'Discipline', id: 'discipline', q: 'What kind of caretaker vibe?', opts: [o('gentle', '🤗 Gentle encouragement'), o('firm', '📋 Firm but fair'), o('strict', '⏱️ Strict rules'), o('chaos', '🎰 Pure roulette chaos')] },
    { step: 'Discipline', id: 'permission', q: 'Should you have to ask before using the potty?', opts: [o(0, 'Never'), o(1, 'Sometimes'), o(2, 'Always')] },
    { step: 'Discipline', id: 'consequences', q: 'After an oops…', opts: [o(0, 'No big deal, carry on'), o(1, 'A mild setback'), o(2, 'Back down a rank, strictly')] },
    { step: 'Discipline', id: 'rewards', q: 'Favourite reward?', opts: [o('praise', '⭐ Praise & stickers'), o('passes', '🎟️ Potty passes'), o('stats', '📈 Streaks & stats')] },
    { step: 'Preferences', id: 'protPref', q: 'Favourite gear?', opts: [o('auto', 'Match my level'), ...PROT.map(([v, l]) => o(v, l))] },
    { step: 'Preferences', id: 'checks', q: 'How often should check-ins / surprises pop up?', opts: [o(0, 'Rarely'), o(1, 'Regularly'), o(2, 'All the time')] },
    { step: 'Preferences', id: 'nightFocus', q: 'Night-time sessions?', opts: [o(0, 'Days only'), o(1, 'Now and then'), o(2, 'Most nights (silent)')] },
    { step: 'Preferences', id: 'messyPref', messy: true, q: '#2 in the sim?', opts: [o(0, 'Never'), o(1, 'Rare, manual only'), o(2, 'Sometimes')] },
    { step: 'Preferences', id: 'officeFriendly', q: 'Do you need a discreet mode for work / public?', opts: [o(false, 'No'), o(true, 'Yes — keep it discreet')] },
    // v13: longer Quiz B (+13)
    { step: 'Traits', id: 'accShape', q: 'When an accident happens, you’d like it to be…', opts: [o('dribble', '💧 Lots of small dribbles'), o('mixed', '🌊 A mix'), o('flood', '🌊🌊 Rare but big floods')] },
    { step: 'Traits', id: 'warningPref', q: 'How much warning should urges give?', opts: [o(2, 'Plenty — I like to plan'), o(1, 'Some'), o(0, 'Surprise me!')] },
    { step: 'Traits', id: 'dryChance', q: 'Chance of making it to the potty?', opts: [o('high', '🏆 Usually make it'), o('mid', '⚖️ Coin-flip'), o('low', '🧸 Rarely make it')] },
    { step: 'Style', id: 'littleSpace', q: 'How little should the wording feel?', opts: [o(0, 'Grown-up and neutral'), o(1, 'A little playful'), o(2, 'Big-kid cute'), o(3, 'Totally tiny-tot')] },
    { step: 'Style', id: 'classPref', q: 'Which class sounds fun?', opts: [o('dribbler', '💧 Dribbler'), o('flooder', '🌊 Flooder'), o('ask_nicely', '🙏 Ask-Nicely Little'), o('stealth', '🥷 Stealth Mode'), o('cascade', '🌀 Cascade Prone')] },
    { step: 'Goals', id: 'campaignLen', q: 'How long should a campaign run?', opts: [o(7, 'A week'), o(14, 'Two weeks'), o(30, 'A month'), o(0, 'Open-ended')] },
    { step: 'Goals', id: 'stars', q: 'Do you like earning ⭐ stars for tasks?', opts: [o(0, 'Not really'), o(1, 'Sure'), o(2, 'Gimme all the stars!')] },
    { step: 'Discipline', id: 'changePerm', q: 'Should you have to ask before changing?', opts: [o(0, 'Never'), o(1, 'Sometimes ("May I change?")'), o(2, 'Always, and wait for the roll')] },
    { step: 'Discipline', id: 'afterAccident', q: 'After a little leak, what should happen next?', opts: [o('finish', 'Go finish on the potty'), o('wait', 'Wait a bit, then roll'), o('stay', 'Stay in my gear'), o('random', 'Let the dice decide')] },
    { step: 'Discipline', id: 'curses', q: 'Blessings & curses (daily cards)?', opts: [o(0, 'No thanks'), o(1, 'Blessings only'), o(2, 'Both, gently'), o(3, 'Bring on the curses')] },
    { step: 'Preferences', id: 'satRule', q: 'When is a change allowed?', opts: [o(30, 'Barely damp'), o(50, 'About half full'), o(75, 'Properly soggy'), o(90, 'Only when nearly full')] },
    { step: 'Preferences', id: 'sounds', q: 'Alarms and chimes?', opts: [o(0, 'Silent please'), o(1, 'Gentle'), o(2, 'Loud & clear')] },
    { step: 'Preferences', id: 'boardGame', q: 'Want the Potty Path board game?', opts: [o(0, 'No'), o(1, 'Sometimes'), o(2, 'Yes, every day!')] }
  ];
  // ----- v13 Quiz C: "What kind of little are you?" (personality only; no effect on rules) -----
  const QC = [
    { step: 'Play', id: 'c1', q: 'Favourite way to spend a lazy afternoon?', opts: [o('cozy', 'Blanket fort & cartoons'), o('busy', 'Building blocks / crafts'), o('brave', 'Climbing & running around'), o('sneaky', 'Hide-and-seek'), o('helper', 'Helping a grown-up')] },
    { step: 'Play', id: 'c2', q: 'Pick a snack-time treat:', opts: [o('cozy', 'Warm cocoa (small cup!)'), o('busy', 'Crackers shaped like animals'), o('brave', 'Big crunchy apple'), o('sneaky', 'Cookie from the top shelf'), o('helper', 'Whatever everyone else has')] },
    { step: 'Play', id: 'c3', q: 'Your favourite stuffie is…', opts: [o('cozy', 'A squishy bear'), o('busy', 'A robot'), o('brave', 'A dinosaur'), o('sneaky', 'A fox'), o('helper', 'A puppy')] },
    { step: 'Potty', id: 'c4', q: 'Someone says “potty time!” You…', opts: [o('helper', 'Go right away'), o('busy', 'Just five more minutes…'), o('brave', 'I don’t need to!'), o('sneaky', 'Pretend I didn’t hear'), o('cozy', 'Ask for help')] },
    { step: 'Potty', id: 'c5', q: 'Halfway through a movie you need to go. You…', opts: [o('helper', 'Pause it and go'), o('brave', 'Hold it to the end'), o('busy', 'Wiggle and keep watching'), o('sneaky', 'Hope nobody notices'), o('cozy', 'Snuggle in and let it be')] },
    { step: 'Potty', id: 'c6', q: 'Your gear is a bit damp. You…', opts: [o('helper', 'Tell a grown-up straight away'), o('sneaky', 'Keep it a secret'), o('cozy', 'Barely mind'), o('busy', 'Forget about it'), o('brave', 'Insist it’s totally dry')] },
    { step: 'Potty', id: 'c7', q: 'Favourite sticker on a potty chart?', opts: [o('brave', 'Gold trophy'), o('cozy', 'Sleepy moon'), o('busy', 'Rocket ship'), o('sneaky', 'Ninja'), o('helper', 'Big smiley')] },
    { step: 'Bedtime', id: 'c8', q: 'Bedtime story pick:', opts: [o('cozy', 'Sleepy bunny'), o('brave', 'Dragon knight'), o('busy', 'How trains work'), o('sneaky', 'The midnight snack thief'), o('helper', 'The kind little bear')] },
    { step: 'Bedtime', id: 'c9', q: 'You wake up in the night. You…', opts: [o('helper', 'Go potty like a big kid'), o('cozy', 'Roll over and snooze'), o('brave', 'Say you’re not tired'), o('sneaky', 'Tiptoe for a glass of water'), o('busy', 'Start thinking about tomorrow')] },
    { step: 'Bedtime', id: 'c10', q: 'In the morning your bed is…', opts: [o('helper', 'Neat and dry'), o('cozy', 'A cozy nest'), o('busy', 'Covered in toys'), o('sneaky', 'Hiding a secret'), o('brave', 'Already empty — up early!')] },
    { step: 'Friends', id: 'c11', q: 'At a playdate you are the one who…', opts: [o('brave', 'Leads the adventure'), o('helper', 'Shares the toys'), o('busy', 'Builds the best tower'), o('sneaky', 'Plans the prank'), o('cozy', 'Naps on the couch')] },
    { step: 'Friends', id: 'c12', q: 'A grown-up asks “do you need the potty?” You say…', opts: [o('helper', '“Yes please!”'), o('brave', '“Nope!” (maybe…)'), o('busy', '“Later!”'), o('sneaky', '“…what potty?”'), o('cozy', '“Carry me?”')] },
    { step: 'Friends', id: 'c13', q: 'Your superpower would be…', opts: [o('brave', 'Super-strength'), o('sneaky', 'Invisibility'), o('busy', 'Super-speed'), o('cozy', 'Making anywhere comfy'), o('helper', 'Healing hugs')] },
    { step: 'Feelings', id: 'c14', q: 'When you get excited you…', opts: [o('busy', 'Bounce everywhere'), o('brave', 'Shout hooray'), o('cozy', 'Get a big squishy smile'), o('sneaky', 'Plot something'), o('helper', 'Tell everyone')] },
    { step: 'Feelings', id: 'c15', q: 'When you’re sleepy you…', opts: [o('cozy', 'Want your blankie'), o('brave', 'Refuse to admit it'), o('busy', 'Keep playing anyway'), o('sneaky', 'Hide under the covers'), o('helper', 'Go to bed nicely')] },
    { step: 'Feelings', id: 'c16', q: 'Best reward for a good day?', opts: [o('helper', 'A big hug'), o('brave', 'A medal'), o('cozy', 'Extra story time'), o('busy', 'A new toy'), o('sneaky', 'Staying up late')] }
  ];
  const C_TYPES = {
    cozy: ['🧸 The Snuggle Bug', 'Soft, sleepy and happiest wrapped in a blanket. You like gentle rules, padded comfort and slow, cozy days. Little floods don’t bother you much — comfort comes first.', 'Comfort blessing, Stealth Mode, Night Owl Wetter'],
    busy: ['🚀 The Busy Builder', 'Always in the middle of something, so potty breaks get forgotten. Expect Absent-Minded rolls, last-second sprints and lots of “just five more minutes!”.', 'Absent-Minded, Fast Filler, Dribbler'],
    brave: ['🦖 The Brave Big Kid', 'You insist you don’t need to go… until you really do. Overconfident streaks, big holds and a dramatic flood now and then.', 'Overconfident Big Kid, Flooder, High Risk High Reward'],
    sneaky: ['🦊 The Sneaky Fox', 'Masters of the secret damp patch. You love hidden waits, surprise checks and keeping a straight face.', 'Stealth Mode, Quiet One, Conspicuous (as a curse)'],
    helper: ['🐶 The Good Helper', 'Polite, eager and always asking first. Permission gates and gold stars are your favourite things.', 'Ask-Nicely Little, Trainee, Valuable blessing']
  };

  // ----- v14b optional quiz packs (do not replace A/B/C) -----
  const PACK_KEY = 'bs_quiz_packs_v1';
  const PACKS = {
    voice: {
      id: 'voice',
      title: '🎙️ Voice & caretaker vibe',
      blurb: 'Mommy / caregiver vs babysitter vs medical coach — and how busy-deny feels.',
      qs: [
        { step: 'Voice', id: 'vibe', q: 'Whose voice should the sim mostly use?', opts: [o('caregiver', '🤗 Mommy / caregiver'), o('babysitter', '🍼 Babysitter'), o('coach', '📋 Medical / coach (neutral)')] },
        { step: 'Voice', id: 'busyDeny', q: 'When permission is “not yet”, how busy should Mommy feel?', opts: [o(0, 'Soft — just “wait a bit”'), o(1, 'Medium — “Mommy’s busy, use your diaper”'), o(2, 'Strong — short, firm denies')] },
        { step: 'Voice', id: 'praise', q: 'Praise style?', opts: [o('warm', 'Warm hugs & stickers'), o('matter', 'Matter-of-fact'), o('cheeky', 'Cheeky / teasing (non-sexual)')] },
        { step: 'Voice', id: 'askWord', q: 'Favourite way to ask?', opts: [o('may_i', '“May I…?”'), o('please', '“Please can I…?”'), o('need', '“I need to go!”')] },
        { step: 'Voice', id: 'officeVoice', q: 'At work / in public the voice should…', opts: [o('coach', 'Always stay coach-neutral'), o('soft', 'Soft caregiver but discreet'), o('same', 'Same as home')] },
        { step: 'Voice', id: 'nick', q: 'Nickname vibe?', opts: [o('sweetie', 'Sweetie / little one'), o('kiddo', 'Kiddo / sport'), o('none', 'No nicknames')] }
      ]
    },
    board: {
      id: 'board',
      title: '🎲 Board / day intent',
      blurb: 'Fun-at-level, climb, slide, or free play — shapes Potty Path direction and pace.',
      qs: [
        { step: 'Intent', id: 'intent', q: 'Where do you want to go on the board?', opts: [o('fun', '🎉 Have fun at one level'), o('climb', '🏆 Climb ranks (Grow Up)'), o('slide', '🫧 Slide down (Little Slide)'), o('free', '🎲 Free play — move around')] },
        { step: 'Intent', id: 'pace', q: 'Board length feel?', opts: [o('short', 'Short path (~20–30)'), o('normal', 'Normal (~45–60)'), o('marathon', 'Marathon (100+)')] },
        { step: 'Intent', id: 'surprise', q: 'How surprising should landings feel?', opts: [o(0, 'Predictable & gentle'), o(1, 'A mix'), o(2, 'Dice chaos')] },
        { step: 'Intent', id: 'hardDays', q: 'Harder-than-profile days?', opts: [o(0, 'Rare'), o(1, 'Sometimes'), o(2, 'Often — keep me guessing')] },
        { step: 'Intent', id: 'checkins', q: 'Check-in squares?', opts: [o(0, 'Few'), o(1, 'Regular'), o(2, 'Lots')] },
        { step: 'Intent', id: 'nightBoard', q: 'Night landings (token stays put)?', opts: [o(0, 'Skip nights'), o(1, 'Soft night flavour'), o(2, 'Full silent night cards')] }
      ]
    },
    symptoms: {
      id: 'symptoms',
      title: '💧 Your symptoms',
      blurb: 'Pick the traits your body has. Switch any off later.',
      qs: [
        { step: 'Flags', id: 'flags', multi: true, q: 'Which symptoms do you have?', opts: [
          o('overactive_bladder', '💢 Overactive bladder'), o('urge_waves', '⚡ Urge waves'),
          o('pre_void_dribble', '💧 Pre-void dribbler'), o('sleepy_bladder', '😴 Sleepy bladder'),
          o('quiet_signals', '🔇 Quiet signals'), o('cascade', '🌊 Cascade Failure (opt-in)'), o('none', 'None right now')
        ] },
        { step: 'Flags', id: 'stick', q: 'Should symptoms stick from play patterns?', opts: [o(0, 'No — only what I pick'), o(1, 'Yes, but easy to clear'), o(2, 'Yes, until I turn them off')] },
        { step: 'Flags', id: 'intensity', q: 'How strong should active flags feel in rolls?', opts: [o(1, '🌱 Gentle nudge'), o(2, '🌶️ Noticeable'), o(3, '🔥 Spicy (still skippable)')] },
        { step: 'Flags', id: 'boardLean', q: 'Should flags lean board squares (more alerts etc.)?', opts: [o(false, 'No — rolls only'), o(true, 'Yes — reshape landings a bit')] },
        { step: 'Flags', id: 'manualOff', q: 'Confirm: every symptom has a manual off?', opts: [o(true, 'Yes — I understand, always available')] }
      ]
    }
  };

  // ----- v15 packs (original questions; mechanics inspired by roulette-style CYOA: gear setup, maturity/protection self-assessment, day-end log) -----
  Object.assign(PACKS, {
    protection: { id: 'protection', title: '🧷 Protection fit', blurb: 'Which gear suits your days and nights.', qs: [
      { step: 'Gear', id: 'dayLeaks', q: 'How leaky do you want daytime to be?', opts: [o(0, 'Dry days'), o(1, 'A few drips'), o(2, 'Regular small leaks'), o(3, 'Big ones happen')] },
      { step: 'Gear', id: 'nightLeaks', q: 'And nights?', opts: [o(0, 'Dry nights'), o(1, 'Occasional damp'), o(2, 'Often wet'), o(3, 'Every night')] },
      { step: 'Gear', id: 'discreet', q: 'How discreet does daytime gear need to be?', opts: [o(2, 'Very — under work clothes'), o(1, 'Somewhat'), o(0, 'Doesn\u2019t matter')] },
      { step: 'Gear', id: 'comfort', q: 'Comfort or security?', opts: [o(0, 'Light & comfy'), o(1, 'Balanced'), o(2, 'Max security')] },
      { step: 'Gear', id: 'stash', q: 'How big is your real stash right now?', opts: [o(0, 'Tiny / none'), o(1, 'A few'), o(2, 'Plenty')] }
    ] },
    maturity: { id: 'maturity', title: '🧸 Little-space maturity', blurb: 'Sets how grown-up or little the wording and difficulty start.', qs: [
      { step: 'Feel', id: 'words', q: 'Which words feel right?', opts: [o(0, 'Grown-up / neutral'), o(1, 'Playful'), o(2, 'Big-kid'), o(3, 'Tiny-tot')] },
      { step: 'Feel', id: 'help', q: 'How much help should the caretaker give?', opts: [o(0, 'None — I manage'), o(1, 'Reminders'), o(2, 'Lots of check-ins'), o(3, 'Does it all for me')] },
      { step: 'Feel', id: 'rules', q: 'Rules you like?', opts: [o(0, 'Few'), o(1, 'Some'), o(2, 'Many, clear ones')] },
      { step: 'Feel', id: 'rewards', q: 'Favourite reward?', opts: [o(0, 'Stats & streaks'), o(1, 'Praise'), o(2, 'Stickers & stars')] },
      { step: 'Feel', id: 'start', q: 'Starting difficulty?', opts: [o(0, 'Easy'), o(1, 'Medium'), o(2, 'Hard')] }
    ] },
    nightrisk: { id: 'nightrisk', title: '🌙 Night-time risk', blurb: 'How the sim treats nights — Natural Night stays silent either way.', qs: [
      { step: 'Night', id: 'freq', q: 'How often are your nights wet?', opts: [o(0, 'Never'), o(1, 'Now and then'), o(2, 'Most nights'), o(3, 'Every night')] },
      { step: 'Night', id: 'deep', q: 'Sleeper type?', opts: [o(0, 'Light sleeper'), o(1, 'Normal'), o(2, 'Deep sleeper')] },
      { step: 'Night', id: 'morning', q: 'Morning check style?', opts: [o(0, 'Skip'), o(1, 'Quick check'), o(2, 'Full morning report')] },
      { step: 'Night', id: 'board', q: 'Board night squares?', opts: [o(0, 'Off'), o(1, 'Some'), o(2, 'Every board night')] }
    ] },
    readiness: { id: 'readiness', title: '🏅 Campaign readiness', blurb: 'Are you set for a long campaign? Suggests length and rest days.', qs: [
      { step: 'Ready', id: 'time', q: 'How many days a week can you play?', opts: [o(0, '1–2'), o(1, '3–5'), o(2, 'Every day')] },
      { step: 'Ready', id: 'logging', q: 'How reliable is your logging?', opts: [o(0, 'Patchy'), o(1, 'Mostly'), o(2, 'Every event')] },
      { step: 'Ready', id: 'reroll', q: 'Do you re-roll a lot?', opts: [o(2, 'Rarely'), o(1, 'Sometimes'), o(0, 'Often')] },
      { step: 'Ready', id: 'length', q: 'Campaign length you want?', opts: [o(0, 'A week'), o(1, 'Two weeks'), o(2, 'A month+')] },
      { step: 'Ready', id: 'recap', q: 'Will you do a 1-minute day-end recap?', opts: [o(2, 'Yes, daily'), o(1, 'Sometimes'), o(0, 'No')] }
    ] },
    recap: { id: 'recap', title: '📝 Day-end recap', blurb: 'What you actually did today — can feed Campaign rank alongside your logs.', qs: [
      { step: 'Today', id: 'logged', q: 'Did you log today\u2019s events honestly (or mark them don\u2019t-log)?', opts: [o(2, 'Yes, all of them'), o(1, 'Most'), o(0, 'Not really')] },
      { step: 'Today', id: 'waits', q: 'Did you follow the wait / hold results you rolled?', opts: [o(2, 'Yes'), o(1, 'Mostly'), o(0, 'Mostly skipped')] },
      { step: 'Today', id: 'rerolls', q: 'How much did you re-roll?', opts: [o(2, 'Not at all'), o(1, 'A little'), o(0, 'A lot')] },
      { step: 'Today', id: 'gear', q: 'Did you follow the change / gear rules?', opts: [o(2, 'Yes'), o(1, 'Partly'), o(0, 'No')] },
      { step: 'Today', id: 'goals', q: 'Campaign goals today?', opts: [o(2, 'Met them'), o(1, 'Some'), o(0, 'Missed them'), o('rest', 'Rest day')] },
      { step: 'Today', id: 'safe', q: 'Did you always go when you couldn\u2019t wait?', opts: [o(true, 'Yes, always'), o(false, 'Not always')] }
    ] }
  });
  function loadPacks() { try { return JSON.parse(localStorage.getItem(PACK_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function savePacks(d) { localStorage.setItem(PACK_KEY, JSON.stringify(d)); }

  function scorePack(id, ans) {
    ans = ans || {};
    if (id === 'voice') {
      const vibe = ans.vibe || 'caregiver';
      try { if (window.BSReport && window.BSReport.setVoice && vibe) window.BSReport.setVoice(vibe === 'coach' ? 'coach' : vibe); } catch (e) {}
      return { vibe, busyDeny: +(ans.busyDeny || 1), praise: ans.praise || 'warm', askWord: ans.askWord || 'may_i', officeVoice: ans.officeVoice || 'coach', nick: ans.nick || 'sweetie', summary: `Voice: ${vibe} · busy-deny ${+(ans.busyDeny || 1)}/2` };
    }
    if (id === 'board') {
      const intent = ans.intent || 'fun';
      const dir = intent === 'climb' ? 'grow' : intent === 'slide' ? 'slide' : intent === 'free' ? 'free' : 'grow';
      const pace = ans.pace || 'normal';
      const length = pace === 'short' ? 24 : pace === 'marathon' ? 120 : 60;
      return { intent, dir, pace, length, surprise: +(ans.surprise || 1), hardDays: +(ans.hardDays || 1), checkins: +(ans.checkins || 1), nightBoard: +(ans.nightBoard || 1), summary: `Intent: ${intent} · N≈${length} · dir ${dir}` };
    }
    if (id === 'symptoms') {
      let flags = (ans.flags || []).filter(x => x !== 'none');
      if ((ans.flags || []).includes('none')) flags = [];
      return { flags, stick: +(ans.stick || 1), intensity: +(ans.intensity || 2), boardLean: ans.boardLean === true, manualOff: true, summary: `Flags: ${flags.join(', ') || 'none'} · intensity ${+(ans.intensity || 2)}/3` };
    }
    if (id === 'protection') {
      const d = +(ans.dayLeaks || 0) + +(ans.comfort || 0) - +(ans.discreet || 0), n = +(ans.nightLeaks || 0) + +(ans.comfort || 0);
      const P = ['none', 'pad', 'pullups', 'diapers', 'thick_diapers'], day = P[Math.max(0, Math.min(4, d))], night = P[Math.max(0, Math.min(4, n + 1))];
      return { day, night, lowStash: +(ans.stash || 0) === 0, summary: `Day: ${day.replace('_', ' ')} · Night: ${night.replace('_', ' ')}${+(ans.stash || 0) === 0 ? ' · stash low' : ''}` };
    }
    if (id === 'maturity') {
      const t = +(ans.words || 0) + +(ans.help || 0) + +(ans.rewards || 0);
      const tone = ['neutral', 'playful', 'cute', 'tiny'][Math.min(3, Math.round(t / 2))], diff = ['easy', 'medium', 'hard'][+(ans.start || 0)];
      return { tone, difficulty: diff, rules: +(ans.rules || 0), summary: `Tone: ${tone} · start ${diff}` };
    }
    if (id === 'nightrisk') {
      const risk = Math.min(3, Math.round((+(ans.freq || 0) * 2 + +(ans.deep || 0)) / 2));
      return { risk, morning: +(ans.morning || 1), board: +(ans.board || 0), summary: `Night risk ${risk}/3 · morning ${['skip', 'quick', 'full'][+(ans.morning || 1)]} · silent always` };
    }
    if (id === 'readiness') {
      const t = ['time', 'logging', 'reroll', 'length', 'recap'].reduce((a, k) => a + +(ans[k] || 0), 0);
      const len = t >= 8 ? 30 : t >= 5 ? 14 : 7, rest = t >= 8 ? 1 : 2;
      return { score: t, lengthDays: len, restPerWeek: rest, useRecap: +(ans.recap || 0) > 0, summary: `Ready ${t}/10 · suggest ${len} days, ${rest} rest/wk${+(ans.recap || 0) ? ' + day-end recap' : ''}` };
    }
    if (id === 'recap') {
      const rest = ans.goals === 'rest';
      const pts = ['logged', 'waits', 'rerolls', 'gear'].reduce((a, k) => a + +(ans[k] || 0), 0) + (rest ? 0 : +(ans.goals || 0));
      const max = rest ? 8 : 10, pass = !rest && pts >= Math.ceil(max * 0.6);
      return { day: dayKeyLocal(), points: pts, max, pass, rest, safe: ans.safe !== false, summary: rest ? 'Rest day' : `${pts}/${max} · ${pass ? 'counts as a good day' : 'not a passing day'}` };
    }
    return { summary: 'Saved' };
  }
  function dayKeyLocal(ts) { const d = ts ? new Date(ts) : new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  /** v15: push today's recap into the active campaign (blended with logs in scoreDay, never replacing them). */
  function applyRecap() {
    const r = (loadPacks().recap || {}).result, C = window.BSCampaign;
    if (!r || !C || !C.load) return { ok: false, why: 'no recap or campaign' };
    const s = C.load(); if (!s || !s.active) return { ok: false, why: 'no active campaign' };
    s.recaps = s.recaps || {}; s.recaps[r.day] = { pass: r.pass, rest: r.rest, points: r.points, max: r.max, at: Date.now() };
    if (r.rest) { s.restDays = s.restDays || []; if (!s.restDays.includes(r.day)) s.restDays.push(r.day); }
    C.save(s); if (typeof window.renderCampaign === 'function') window.renderCampaign();
    return { ok: true, day: r.day };
  }

  function scoreC(c) {
    const t = { cozy: 0, busy: 0, brave: 0, sneaky: 0, helper: 0 };
    Object.values(c || {}).forEach(v => { if (t[v] != null) t[v]++; });
    const order = Object.keys(t).sort((x, y) => t[y] - t[x]);
    const [title, blurb, fits] = C_TYPES[order[0]];
    return { type: order[0], second: order[1], tally: t, title, blurb, fits, secondTitle: C_TYPES[order[1]][0] };
  }
  const messyOn = () => (typeof window.isMessyEnabled === 'function' ? window.isMessyEnabled() : false);
  /** Questions currently visible (messy questions hidden unless Messy content (#2) is on). */
  function questions(which) {
    if (which === 'a') return QA.filter(q => !q.messy || messyOn());
    if (which === 'c') return QC.filter(q => !q.messy || messyOn());
    if (PACKS[which]) return (PACKS[which].qs || []).filter(q => !q.messy || messyOn());
    return QB.filter(q => !q.messy || messyOn());
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

  /** Prefill from calendar natural stats (last 30 days). */
  function prefillFromCalendar() {
    try {
      const C = window.BSCalendar; if (!C) return {};
      const now = Date.now(), cut = now - 30 * 864e5;
      const nat = C.load().entries.filter(e => e.source === 'natural' && e.ts >= cut);
      const leaks = nat.filter(e => e.type === 'accident' || e.type === 'leak').length;
      const nights = nat.filter(e => e.type === 'night' && e.night && e.night.wet).length;
      const band = n => n === 0 ? 0 : n <= 3 ? 1 : n <= 10 ? 2 : 3;
      return { leaks: band(leaks), nights: band(nights), _raw: { leaks, nights } };
    } catch (e) { return {}; }
  }
  /** Quiz A → baseline. Each scored question 0..3; triggers add up to 2. Normalised over the questions shown. */
  function scoreA(a) {
    const n = k => +(a[k] || 0);
    const trig = (a.triggers || []).filter(x => x !== 'none');
    const scored = QA.filter(q => q.score && (!q.messy || messyOn()));
    const max = scored.length * 3 + 2;
    const score = scored.reduce((t, q) => t + n(q.id), 0) + Math.min(2, trig.length * 0.5);
    const levelIdx = Math.max(0, Math.min(4, Math.round(score / max * 4)));
    const symptoms = [...trig];
    if ((n('nights') >= 1 || n('nightWake') >= 3) && !symptoms.includes('nocturnal_wetter')) symptoms.push('nocturnal_wetter');
    if (n('urgency') >= 2 && !symptoms.includes('overactive_bladder')) symptoms.push('overactive_bladder');
    return { score: Math.round(score * 10) / 10, max, levelIdx, level: LEVELS[levelIdx], symptoms, protDay: a.protDay || 'none', protNight: a.protNight || a.protDay || 'none',
      control: Math.round(100 - score / max * 100), structure: a.structure || 'loose', protFeel: a.protFeel || 'backup' };
  }
  /** Quiz B → target. */
  function scoreB(b, base) {
    const bi = base ? base.levelIdx : 1, goal = b.goal || 'stay';
    let t = bi;
    if (goal === 'more') t = Math.max(0, bi - 2);
    if (goal === 'less') t = Math.min(4, bi + 2);
    if (goal === 'bedwetting') t = Math.max(bi, 2);
    return { targetIdx: t, target: LEVELS[t], goal, intensity: +(b.intensity || 2), symptoms: b.symptoms || [], styles: b.styles || ['babysitter'], time: +(b.time || 2),
      rankShift: +(b.startPref || 0), discipline: b.discipline || 'firm', permission: +(b.permission || 0), consequences: b.consequences != null ? +b.consequences : 1,
      rewards: b.rewards || 'praise', protPref: b.protPref || 'auto', checks: b.checks != null ? +b.checks : 1, nightFocus: +(b.nightFocus || 0),
      messyPref: messyOn() ? +(b.messyPref || 0) : 0, officeFriendly: b.officeFriendly === true };
  }
  function personality(base, tgt) {
    const s = tgt.symptoms;
    if (tgt.goal === 'bedwetting' || tgt.styles.includes('bedwetting')) return ['🌙 The Snuggly Night Owl', 'Cozy nights, quiet mornings, and a check-in with a smile. Your sim keeps the night totally silent.'];
    if (s.includes('giggle_incontinence')) return ['😂 The Giggly Gremlin', 'Every joke is a gamble — and you love the suspense.'];
    if (tgt.goal === 'more') return ['🏆 The Brave Big Kid', 'You like a challenge: longer windows, fewer surprises, gold stars for every dry stretch.'];
    if (tgt.goal === 'less') return ['🧸 The Cozy Padded Sprout', 'Soft, squishy and carefree — your sim leans into the little-one life.'];
    if (s.includes('urge_incontinence') || s.includes('overactive_bladder')) return ['⚡ The Potty Sprinter', 'Ready, set… run! Races to the potty are your favourite minigame.'];
    return ['🎲 The Curious Explorer', 'A bit of everything — you like to keep the sim surprising.'];
  }
  function recommend(base, tgt) {
    const r = [];
    const st = tgt.styles;
    if (st.includes('babysitter') || !st.length) r.push('🍼 Babysitter (' + tgt.target.replace(/_/g, ' ') + ')');
    if (st.includes('training') || tgt.goal === 'more') r.push('🎓 Training (Rookie → Pro) for hold practice');
    if (st.includes('omorashi')) r.push('💦 Omorashi holding challenges');
    if (st.includes('dependent') || tgt.goal === 'less') r.push('🧸 Dependent / NPT profile');
    if (st.includes('bedwetting') || tgt.goal === 'bedwetting') r.push('🌙 Bedwetting mode (silent nights) + Morning check-in');
    if (tgt.nightFocus >= 2 && !r.some(x => x.startsWith('🌙'))) r.push('🌙 Bedwetting mode (silent nights) + Morning check-in');
    if (tgt.discipline === 'strict') r.push('⏱️ Strict structure: Training (Pro) + Alarm grace window');
    if (tgt.discipline === 'chaos') r.push('🎰 Quick session roulette (Free-Form Challenges)');
    if (tgt.permission >= 1) r.push('🙋 Use the Natural Urge tab to ask permission before going');
    if (tgt.officeFriendly) r.push('🟢 Office mode (Settings) — colour light + discreet wording');
    if (tgt.messyPref >= 1) r.push('💩 Messy (#2) stays manual: Uh-Oh button / Natural Urge #2');
    r.push('🏅 Campaign mode (Profiles › Campaign)' + (tgt.rankShift ? (tgt.rankShift > 0 ? ' — starting one rank harder' : ' — starting one rank easier') : ''));
    return r;
  }
  /** Build a custom profile (existing schema) from both quizzes + calibration scalar. */
  function buildProgram(base, tgt, scalar) {
    const lv = tgt.targetIdx, it = tgt.intensity;
    const st = tgt.styles;
    const baseProfile = st.includes('dependent') ? 'dependent' : st.includes('training') && tgt.goal === 'more' ? 'train_rookie' : 'babysitter';
    const mainMin = [60, 45, 30, 20, 12][lv], mainMax = [120, 90, 75, 50, 35][lv];
    const prot = PROT.map(p => p[0]); const startProtection = (tgt.protPref && tgt.protPref !== 'auto') ? tgt.protPref : prot[Math.min(4, Math.max(1, lv))];
    const chk = tgt.checks != null ? tgt.checks - 1 : 0;
    const symptoms = Array.from(new Set(tgt.symptoms));
    return {
      id: 'quiz-' + Date.now().toString(36),
      name: '✨ My Program — ' + personality(base, tgt)[0].replace(/^\S+\s/, ''),
      description: `Auto-generated from My Profile quizzes. Target: ${tgt.target.replace(/_/g, ' ')} · intensity ${it}/3 · traits: ${symptoms.join(', ') || 'none'}.`,
      createdAt: new Date().toISOString(), source: 'quiz',
      runtime: {
        baseProfile, mainMin, mainMax, microMin: Math.max(3, 12 - lv * 2 - it), microMax: Math.max(6, 25 - lv * 3 - it * 2),
        pottySuccessRate: [80, 65, 50, 35, 20][lv], microsPerCycle: Math.max(1, Math.min(6, 1 + lv + (it - 1) + chk)),
        leakScalar: Math.round((0.7 + it * 0.2 + lv * 0.1) * 10) / 10, pressureAcceleration: Math.round((0.9 + it * 0.1) * 10) / 10,
        sipMin: 2, sipMax: 5, hydrationMin: 20, hydrationMax: 50, startProtection,
        progressionEnabled: true, successThreshold: tgt.discipline === 'strict' ? 4 : 3, failureThreshold: [3, 2, 1][tgt.consequences != null ? tgt.consequences : 1], pushToLeak: 'optional', mercyMode: 'optional', preChime: it < 3,
        customMicroEvents: [], customFullEvents: [],
        // v5 extras (read by the applyCustomProfile hook below)
        leakTimeScale: scalar || null, symptoms, continenceLevel: tgt.target
      }
    };
  }
  function saveProgram(p) {
    if (typeof getSavedCustomProfiles !== 'function') return p;
    const list = getSavedCustomProfiles().filter(x => x.source !== 'quiz'); // one quiz program at a time (retake replaces)
    list.push(p); saveCustomProfiles(list);
    if (typeof renderSavedProfilesList === 'function') try { renderSavedProfilesList(); } catch (e) {}
    return p;
  }
  function finish() {
    const d = load();
    d.baseline = scoreA(d.a || {}); d.target = scoreB(d.b || {}, d.baseline);
    const cal = window.BSCalib ? window.BSCalib.summarize(window.BSCalib.load().trials) : null;
    const scalar = cal && cal.n ? cal.scalar : null;
    d.program = saveProgram(buildProgram(d.baseline, d.target, scalar));
    d.completedAt = Date.now(); save(d); return d;
  }

  // ----- hook: custom profiles carrying v5 extras -----
  function hookApply() {
    const orig = window.applyCustomProfile; if (typeof orig !== 'function' || orig._v5) return;
    const w = function (id) {
      try {
        const p = getSavedCustomProfiles().find(x => x.id === id), r = p && p.runtime;
        if (r) {
          if (Array.isArray(r.symptoms)) { activeSymptoms = r.symptoms.slice(); localStorage.setItem('activeSymptoms', JSON.stringify(activeSymptoms)); }
          if (r.continenceLevel && LEVELS.includes(r.continenceLevel)) { currentContinenceLevel = r.continenceLevel; localStorage.setItem('currentContinenceLevel', r.continenceLevel); }
          if (r.leakTimeScale && typeof updateLeakTimeScale === 'function') updateLeakTimeScale(r.leakTimeScale);
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    w._v5 = true; window.applyCustomProfile = w;
  }

  // ----- UI -----
  let ui = { quiz: null, i: 0 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function render() {
    const m = document.getElementById('myProfileMount'); if (!m) return;
    hookApply();
    const d = load();
    if (ui.quiz) return renderQuestion(m, d);
    const done = d.baseline && d.target;
    const _packs = loadPacks();
    const camp = window.BSCampaign && window.BSCampaign.load ? window.BSCampaign.load() : null;
    const qq = window.BSHub && window.BSHub.qqLoad ? window.BSHub.qqLoad() : null;
    const pk = id => (_packs[id] && _packs[id].result) ? _packs[id].result.summary : '';
    // v15 Quiz hub: one card per quiz — purpose, last result, what it impacts, Take/Retake + deep link.
    const cards = [
      { id: 'qzA', take: () => begin('a'), title: '🧭 Quiz A · Where you are now', purpose: `Your real-life starting point (${questions('a').length} Q, informational only).`, last: d.baseline ? `${d.baseline.level.replace(/_/g, ' ')} · control ${d.baseline.control}%` : '', impacts: 'Control baseline · program starting level', goL: '🙋 Urge', go: () => switchTab('urge'), done: !!d.a },
      { id: 'qzB', take: () => begin('b'), title: '🗺️ Quiz B · Where you want to go', purpose: `Where you’re headed (${questions('b').length} Q).`, last: d.target ? `${d.target.target.replace(/_/g, ' ')} · intensity ${d.target.intensity}/3` : '', impacts: 'Program target · traits · Campaign suggestions', goL: '🏅 Campaign', go: () => { const c = document.getElementById('campaignMount'); if (c) c.scrollIntoView({ block: 'start' }); }, done: !!d.b },
      { id: 'qzC', take: () => begin('c'), title: '🧸 Quiz C · What kind of little are you?', purpose: `Playful personality card (${questions('c').length} Q).`, last: d.cResult ? d.cResult.title : '', impacts: 'Suggested classes & cards (flavour)', goL: '🧷 Profiles', go: () => { const c = document.getElementById('pottyReportMount'); if (c) c.scrollIntoView({ block: 'start' }); }, done: !!d.c },
      { id: 'qzCamp', take: () => window.openCampaignSetup && window.openCampaignSetup(), title: '🏅 Campaign quiz', purpose: 'Direction, pace + optional extra questions (lives in Campaign setup).', last: camp ? `Campaign ${camp.status || 'active'}${camp.prefs ? ' · ' + Object.keys(camp.prefs).length + ' extra answers' : ''}` : '', impacts: 'Campaign prefs · gates · rank direction', goL: '🏅 Campaign', go: () => { const c = document.getElementById('campaignMount'); if (c) c.scrollIntoView({ block: 'start' }); }, done: !!camp, takeL: camp ? '↺ New campaign' : '▶ Take' }
    ].concat(Object.keys(PACKS).map(id => ({ pack: id, take: () => begin(id), title: PACKS[id].title, purpose: PACKS[id].blurb, last: pk(id), done: !!pk(id),
      impacts: { voice: 'Voice (check-ups, permission denies)', board: 'Board intent (N / direction / pace)', symptoms: 'Symptom flags · roll intensity', protection: 'Gear suggestion (day / night) · stash warning', maturity: 'Tone & starting difficulty (suggestion)', nightrisk: 'Night flavour · morning check · board nights', readiness: 'Campaign length & rest-day suggestion', recap: 'Campaign rank (with your logs) · rest days' }[id] || 'Pack settings',
      goL: { voice: '🎧 Voice', board: '🎲 Board', symptoms: '🙋 Urge', protection: '🧷 Gear', maturity: '🏅 Campaign', nightrisk: '🌙 Nights', readiness: '🏅 Campaign', recap: '🏅 Campaign' }[id] || '',
      extra: id === 'recap' && pk(id) ? '<button type="button" data-qrecap="1">✅ Apply to campaign</button>' : '',
      go: Object.assign({ voice: () => window.BSHub && window.BSHub.openSettings('setPlay', 'promptOutputMount'), board: () => window.BSHub && window.BSHub.openBoard(), symptoms: () => switchTab('urge'), nightrisk: () => { switchTab('session'); const n = document.getElementById('hubNights'); if (n) n.open = true; } }, ['maturity', 'readiness', 'recap'].reduce((a, k) => (a[k] = () => { const c = document.getElementById('campaignMount'); if (c) c.scrollIntoView({ block: 'start' }); }, a), {}), { protection: () => { const c = document.getElementById('protectionContent'); if (c) c.scrollIntoView({ block: 'start' }); } })[id] || null })))
      .concat([{ id: 'qzQuick', take: () => window.BSHub && window.BSHub.quickQuiz(), title: '⚡ Short quiz → play', purpose: '7 quick questions build a temporary Urge profile for one session.', last: qq ? (qq.active ? '🟢 Active · ' : 'Last: ') + qq.result.summary : '', impacts: 'Urge wait bias · accident shape · voice · session symptom flags', goL: '🙋 Urge', go: () => switchTab('urge'), done: !!qq, extra: qq && qq.active ? '<button type="button" data-qend="1">⏹ End session</button>' : '' }]);
    let html = `<h2 style="margin:0 0 6px;">🧩 Quizzes</h2>
      <p class="section-desc">Every quiz in one place. Each card shows your last result, what it changes, and a shortcut there. All.</p>
      <div class="quiz-hub-list">${cards.map((c, k) => `<div class="quiz-hub-card" data-qcard="${c.pack || c.id}">
        <div class="qh-title">${esc(c.title)}</div><div class="cal-legend">${esc(c.purpose)}</div>
        <div class="qh-last">${c.last ? '✓ ' + esc(c.last) : '<span class="muted">Not taken</span>'}</div>
        <div class="qh-imp"><b>Impacts:</b> ${esc(c.impacts)}</div>
        <div class="quiz-nav"><button type="button" ${c.pack ? `data-pack="${c.pack}"` : `id="${c.id}"`} data-take="${k}">${c.takeL || (c.done ? '↺ Retake' : '▶ Take')}</button>${c.go ? `<button type="button" data-qgo="${k}">Go to ${esc(c.goL)}</button>` : ''}${c.extra || ''}</div></div>`).join('')}</div>`;
    if (d.cResult) html += `<div class="quiz-card" id="qzCCard"><div class="calib-big">${esc(d.cResult.title)}</div><div class="cal-legend">${esc(d.cResult.blurb)}</div>
        <div class="camp-goal"><b>Runner-up:</b> ${esc(d.cResult.secondTitle)}</div><div class="camp-goal"><b>Classes &amp; cards that suit you:</b> ${esc(d.cResult.fits)}</div></div>`;
    if (done) {
      const [title, blurb] = personality(d.baseline, d.target);
      html += `<div class="quiz-card"><div class="calib-big">${esc(title)}</div><div class="cal-legend">${esc(blurb)}</div>
        <div class="calib-grid"><div><b>${esc(d.baseline.level.replace(/_/g, ' '))}</b><span>starting point</span></div>
        <div><b>${esc(d.target.target.replace(/_/g, ' '))}</b><span>target</span></div>
        <div><b>${d.baseline.control}%</b><span>baseline control stat</span></div>
        <div><b>${d.target.intensity}/3</b><span>trait intensity</span></div></div>
        <div class="camp-goal"><b>Traits:</b> ${esc((d.target.symptoms || []).join(', ') || 'none picked')}</div>
        <div class="camp-goal"><b>Recommended:</b><br>${recommend(d.baseline, d.target).map(esc).join('<br>')}</div>
        ${d.program ? `<div class="camp-goal"><b>Your program:</b> ${esc(d.program.name)} ${d.program.runtime.leakTimeScale ? `(calibrated leak scalar ${d.program.runtime.leakTimeScale}×)` : '(open Settings › Calibration to personalise leak timing)'}</div>` : ''}
        <div class="quiz-nav"><button type="button" id="qzPlay" style="background:#a29bfe;color:#000;font-weight:bold;">▶ Play my program</button><button type="button" id="qzRegen">↻ Regenerate</button></div></div>`;
    } else if (d.a || d.b) html += `<div class="cal-legend">Finish ${d.a ? 'Quiz B' : 'Quiz A'} to unlock your summary card and program.</div>`;
    m.innerHTML = html;
    m.querySelectorAll('[data-take]').forEach(btn => { btn.onclick = () => cards[+btn.dataset.take].take(); });
    m.querySelectorAll('[data-qgo]').forEach(btn => { btn.onclick = () => cards[+btn.dataset.qgo].go(); });
    m.querySelectorAll('[data-qrecap]').forEach(btn => { btn.onclick = () => { const r = applyRecap(); if (typeof toast === 'function') toast(r.ok ? 'Recap applied to campaign (' + r.day + ')' : 'Start a campaign first'); }; });
    m.querySelectorAll('[data-qend]').forEach(btn => { btn.onclick = () => window.BSHub && window.BSHub.qqEnd(); });
    const pl = m.querySelector('#qzPlay'); if (pl) pl.onclick = () => { const p = load().program; if (p && typeof window.applyCustomProfile === 'function') window.applyCustomProfile(p.id); };
    const rg = m.querySelector('#qzRegen'); if (rg) rg.onclick = () => { finish(); render(); if (typeof toast === 'function') toast('Program regenerated'); };
  }
  function begin(which) {
    const d = load();
    let prev = {};
    if (PACKS[which]) {
      const pk = loadPacks()[which] || {};
      prev = pk.ans || {};
    } else {
      prev = d[which] || {};
      if (which === 'a') { const pf = prefillFromCalendar(); ['leaks', 'nights'].forEach(k => { if (prev[k] == null && pf[k] != null && pf._raw && (pf._raw.leaks || pf._raw.nights)) prev[k] = pf[k]; }); ui.prefill = pf._raw; }
    }
    ui = Object.assign(ui, { quiz: which, i: 0, ans: JSON.parse(JSON.stringify(prev)) }); render();
  }
  function renderQuestion(m, d) {
    const Q = questions(ui.quiz), q = Q[ui.i], ans = ui.ans;
    const cur = ans[q.id];
    const on = v => q.multi ? (cur || []).includes(v) : cur === v;
    const pf = q.prefill && ui.prefill ? `<div class="cal-legend">📅 Prefilled from your calendar (natural, last 30 days: ${ui.prefill[q.prefill]}). Change it if it’s off.</div>` : '';
    const packTitle = PACKS[ui.quiz] ? PACKS[ui.quiz].title : null;
    m.innerHTML = `<h2 style="margin:0 0 6px;">${ui.quiz === 'a' ? '🧭 Where you are now' : ui.quiz === 'c' ? '🧸 What kind of little are you?' : packTitle ? esc(packTitle) : '🗺️ Where you want to go'}</h2>
      <div class="cal-legend">${esc(q.step)} · ${ui.i + 1} / ${Q.length}</div><div class="quiz-progress"><i style="width:${Math.round((ui.i + 1) / Q.length * 100)}%"></i></div>
      <div class="quiz-q">${esc(q.q)}</div>${pf}
      <div class="quiz-opts">${q.opts.map((x, k) => `<button type="button" data-k="${k}" class="${on(x.v) ? 'on' : ''}">${esc(x.l)}</button>`).join('')}</div>
      <div class="quiz-nav"><button type="button" id="qzBack">${ui.i ? '← Back' : '✕ Cancel'}</button><button type="button" id="qzNext" style="background:#55efc4;color:#000;font-weight:bold;">${ui.i === Q.length - 1 ? '✓ Finish' : 'Next →'}</button></div>`;
    m.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => {
      const v = q.opts[+b.dataset.k].v;
      if (q.multi) { let a = ans[q.id] || []; if (v === 'none') a = ['none']; else { a = a.filter(x => x !== 'none'); a = a.includes(v) ? a.filter(x => x !== v) : a.concat(v); } ans[q.id] = a; }
      else ans[q.id] = v;
      renderQuestion(m, d);
    }; });
    m.querySelector('#qzBack').onclick = () => { if (ui.i) { ui.i--; renderQuestion(m, d); } else { ui.quiz = null; render(); } };
    m.querySelector('#qzNext').onclick = () => {
      if (!q.multi && ans[q.id] == null) { if (typeof toast === 'function') toast('Pick one to continue'); return; }
      if (ui.i < Q.length - 1) { ui.i++; renderQuestion(m, d); return; }
      if (PACKS[ui.quiz]) {
        const all = loadPacks();
        const result = scorePack(ui.quiz, ans);
        all[ui.quiz] = { ans, result, completedAt: Date.now() };
        savePacks(all);
        // board pack can pre-fill a board length hint without starting
        if (ui.quiz === 'board' && result && window.BSBoard) {
          try { /* hint only — user still starts board manually */ } catch (e) {}
        }
        ui.quiz = null;
        render();
        if (typeof toast === 'function') toast('Pack saved · ' + (result.summary || ''));
        return;
      }
      const dd = load(); dd[ui.quiz] = ans; if (ui.quiz === 'c') dd.cResult = scoreC(ans); save(dd); ui.quiz = null;
      if (dd.a && dd.b) finish();
      render(); if (typeof window.renderCampaign === 'function') window.renderCampaign();
    };
  }

  window.BSQuiz = { applyRecap, dayKeyLocal, QA, QB, QC, PACKS, PACK_KEY, scoreC, scorePack, C_TYPES, questions, LEVELS, SYMPTOMS, load, save, loadPacks, savePacks, scoreA, scoreB, buildProgram, personality, recommend, finish, prefillFromCalendar, render, begin };
  window.renderMyProfile = render;
})();
