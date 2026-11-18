/* Night conditioning events. track is always night. nightKind selects the wake path. */
(function () {
  const REAL = ' A real need still means stop and go.';
  function g(text, time, type, text2, time2, type2) {
    const steps = [{ text: text, time: time, type: type }];
    if (text2) steps.push({ text: text2, time: time2, type: type2 });
    return steps;
  }
  function add(kind, dir, size, goals, rows) {
    rows.forEach(function (row, i) {
      const id = 'nw_' + kind + '_' + (i + 1);
      const guide = size === 'full' ? g('LET GO', 14, 'relax')
        : size === 'none' ? g(row[2] || 'SETTLE', 4, 'stop', row[3] || 'STAY WITH IT', 4, 'relax')
        : size === 'small' ? g(row[2] || 'SOFTEN', 5, 'relax')
        : g(row[2] || 'QUIET RELEASE', 3, 'relax');
      window.BSCondEvents.addEvents([{
        id: id, dir: dir, track: 'night', family: kind, nightKind: kind, size: size,
        goals: goals, label: row[0],
        text: row[1] + REAL,
        guide: guide,
        kind: size === 'none' ? 'dry' : kind
      }]);
    });
  }
  if (!window.BSCondEvents || !window.BSCondEvents.addEvents) return;
  add('asleep', 'A', 'small', ['bedwetting', 'relaxed'], [
    ['Drift release', 'As sleep takes the edges off, a small release can start. Stay lying down.', 'AS SLEEP COMES'],
    ['Pillow heavy', 'Your head is heavy on the pillow. Let a little go without rolling over to deal with it.', 'HEAD STAYS'],
    ['Last blink', 'The last blinks are long. A short release belongs in that blur, not in a trip down the hall.', 'LONG BLINKS'],
    ['Warm sheet', 'The sheet is already warm. Add a little more warmth and let sleep finish the job.', 'ADD A LITTLE'],
    ['Story fades', 'The story you were telling yourself fades. The release can fade in with it.', 'LET THE STORY GO'],
    ['Side settle', 'You settle on your side. Soften as the hip sinks, and leave it there.', 'SINK IN'],
    ['Breath slows', 'Breathing has slowed. Match a small release to that slower breath.', 'SLOWER BREATH'],
    ['Lamp off', 'The lamp is off. There is nothing left to do except let a little go and drop.', 'NOTHING LEFT TO DO'],
    ['Cover up', 'Pull the cover to your shoulder. Under it, a small release, then still.', 'UNDER THE COVER'],
    ['No plan', 'You do not need a plan for this one. Falling asleep is the plan.', 'NO PLAN'],
    ['Jaw loose', 'Let the jaw go loose. The same drop, lower down, while you are still in bed.', 'JAW FIRST'],
    ['Almost gone', 'You are almost gone. A few seconds of release, then you are gone.', 'ALMOST GONE']
  ]);
  add('through', 'A', 'full', ['bedwetting', 'deeper', 'full'], [
    ['Sleep through', 'This release does not need you awake. If you surface, stay down and let it finish.', 'STAY DOWN'],
    ['Dream keeps it', 'The dream can keep going. The release happens inside it.', 'STAY IN THE DREAM'],
    ['No sit-up', 'Do not sit up for this. One full let-go while you stay flat.', 'STAY FLAT'],
    ['Through the deep', 'Deep sleep is the point. A full release can pass without a real waking.', 'LET IT PASS'],
    ['Cover stays', 'The cover stays where it is. You do not get up to check.', 'DO NOT CHECK'],
    ['Same side', 'Stay on the same side. The release does not need a new position.', 'SAME SIDE'],
    ['Hall stays dark', 'The hall stays dark. There is no reason to turn a light on.', 'DARK HALL'],
    ['Back under', 'If you do notice, the next move is back under, not up.', 'BACK UNDER'],
    ['Quiet bladder', 'It can be quiet and still be a full night release.', 'QUIET AND FULL'],
    ['No name for it', 'You do not have to name it until morning. Let it finish.', 'NAME IT LATER'],
    ['Heavy sleep', 'Sleep is heavy. Use that heaviness. Do not climb out of it.', 'USE THE HEAVINESS'],
    ['Morning will know', 'Morning can sort out what happened. Tonight you stay asleep.', 'MORNING CAN SORT IT']
  ]);
  add('deeper', 'A', 'none', ['deeper'], [
    ['Same bedtime', 'Same time as last night. The clock is the cue, then you stop deciding things.', 'SAME TIME', 'QUIET'],
    ['Screen away', 'The screen is face down or in another room. Dark is the rest of the cue.', 'SCREEN AWAY', 'DARK'],
    ['One phrase', 'Say the one bedtime phrase you picked, then stop talking.', 'THE PHRASE', 'STOP TALKING'],
    ['Cool room', 'Cool room, warm covers. Get into the setup you actually sleep in.', 'COOL ROOM', 'WARM COVERS'],
    ['No second alarm', 'Do not add a backup alarm. One wake time is enough, or none.', 'NO EXTRA ALARM', 'ONE WAKE'],
    ['Heavy cover', 'If you use a heavy cover, this is when it goes on.', 'WEIGHT ON', 'STAY UNDER'],
    ['Door done', 'The door is how you like it. Decisions wait until morning.', 'DOOR DONE', 'NO MORE DECISIONS'],
    ['Slow blinks', 'Slow blinks until they stick. If a release comes, it can.', 'SLOW BLINKS', 'LET THEM STICK'],
    ['Same pillow', 'Same pillow, same side of the bed. Repetition is the practice.', 'SAME PILLOW', 'SAME SIDE'],
    ['Breath count', 'Count a few breaths and then stop counting.', 'A FEW BREATHS', 'STOP COUNTING'],
    ['Jaw and hands', 'Unclench the jaw and open the hands. Sleep likes both loose.', 'JAW LOOSE', 'HANDS OPEN'],
    ['Morning is the wake', 'You do not owe the night a toilet trip. Morning is the planned wake.', 'MORNING IS THE WAKE', 'STAY']
  ]);
  add('full', 'A', 'full', ['bedwetting', 'full'], [
    ['Whole night release', 'One full let-go in bed, about as long as your calibration. No push, no dash after.', 'LET GO'],
    ['Before dawn full', 'Before dawn is a full-release window. Stay lying down for it.', 'STAY LYING'],
    ['Thick gear full', 'The night gear can take a full release. Let it, then settle.', 'THEN SETTLE'],
    ['No hallway', 'The full release happens here. The hallway is not part of it.', 'NOT THE HALL'],
    ['Flat on your back', 'On your back or your side, one continuous let-go.', 'ONE CONTINUOUS'],
    ['After the small one', 'A small one may have started it. This step is the rest of it.', 'THE REST'],
    ['Lights already out', 'Lights are out. A full release, then back toward sleep.', 'THEN SLEEP'],
    ['Pillow stays', 'You do not lift your head for this. The pillow stays.', 'HEAD STAYS'],
    ['Warm and done', 'Let it get warm and then be done. No second effort.', 'NO SECOND EFFORT'],
    ['Sleep-heavy full', 'You are sleep-heavy. A full release can finish without a full waking.', 'SLEEP HEAVY'],
    ['Same blanket', 'Do not throw the blanket off to manage it. Stay covered.', 'STAY COVERED'],
    ['One and settle', 'One let-go. Then settle. That is the whole night practice.', 'THEN SETTLE']
  ]);
  add('multi', 'A', 'small', ['bedwetting'], [
    ['Second wave', 'A later wave in the same night. It can be smaller. Stay in bed for it too.', 'SECOND WAVE'],
    ['After the first', 'The first wet already happened. Another small one does not mean get up.', 'STAY FOR THIS ONE'],
    ['Warm again', 'The gear is warm again. That can be a second release, still lying down.', 'WARM AGAIN'],
    ['Turn and release', 'You turned over and another bit left. Leave the turn as the cue, not a trip.', 'THE TURN IS THE CUE'],
    ['Dream changed', 'The dream changed and so did the bladder. Stay with both.', 'STAY WITH BOTH'],
    ['Not a new night', 'This is the same night. You do not restart it by getting up.', 'SAME NIGHT'],
    ['Quiet second', 'The second one can be quiet. No announcement, no light.', 'NO LIGHT'],
    ['Hip to hip', 'Rolling from one hip to the other. A small release on the roll.', 'ON THE ROLL'],
    ['Still dark', 'It is still dark. Darkness means stay, even for another wet.', 'STILL DARK'],
    ['Gear has room', 'If the gear still has room, use it. A change can wait for morning.', 'CHANGE CAN WAIT'],
    ['Third if it comes', 'If a third comes, it is the same rule. Bed, not hallway.', 'SAME RULE'],
    ['Settle between', 'Between waves, settle. Do not patrol for the next one.', 'SETTLE BETWEEN']
  ]);
  add('early', 'A', 'full', ['bedwetting', 'full'], [
    ['Toward morning', 'It is toward morning and still night. A full release can belong here. Stay down.', 'STILL NIGHT'],
    ['Grey light', 'There is a little grey light. That is not the get-up signal.', 'NOT THE SIGNAL'],
    ['Before the alarm', 'The alarm is not yet. If a release comes, let it finish in bed.', 'BEFORE THE ALARM'],
    ['Early full', 'An early-morning wet can be a full one. You do not have to sit up for it.', 'NO SIT UP'],
    ['Birds, not bathroom', 'You heard something outside. That is not a reason to get up.', 'STAY'],
    ['Last sleep cycle', 'This is the last sleep cycle. A release can ride it.', 'RIDE THE CYCLE'],
    ['Clock unchecked', 'Do not check the clock. Checking wakes you the rest of the way.', 'DO NOT CHECK'],
    ['Warm morning', 'The bed is warm and it is early. Stay in the warmth.', 'STAY WARM'],
    ['One more hour', 'There is still sleep left. Use it after the release, not the hallway.', 'MORE SLEEP'],
    ['Pre-dawn full', 'Pre-dawn, one let-go, then back under.', 'BACK UNDER'],
    ['Eyes stay shut', 'Keep your eyes shut for this one if you can.', 'EYES SHUT'],
    ['Morning comes later', 'Morning is the time you set. This is earlier than that.', 'NOT YET']
  ]);
  add('half', 'A', 'small', ['bedwetting', 'relaxed'], [
    ['Half awake', 'You are only half awake. A small let-go, then let the other half of sleep come back.', 'HALF AWAKE'],
    ['Not a decision', 'Do not make this a decision. Soften and let a little go.', 'NO DECISION'],
    ['Name the room later', 'You do not need to name the room. Naming it wakes you up.', 'DO NOT NAME IT'],
    ['Float back', 'After a few seconds, float back. The release can already be done.', 'FLOAT BACK'],
    ['Heavy eyelids', 'Eyelids are heavy. Keep them heavy while a little leaves.', 'EYELIDS HEAVY'],
    ['Mumble', 'If you mumble, that is enough waking. Stay horizontal.', 'STAY HORIZONTAL'],
    ['Hand stays', 'Your hand does not go exploring. Leave the gear alone.', 'HANDS STILL'],
    ['Between dreams', 'This is the gap between dreams. A small release fits the gap.', 'IN THE GAP'],
    ['Roll without rising', 'Roll if you need to. Do not rise.', 'ROLL ONLY'],
    ['Soft belly', 'Belly soft, jaw soft, a few seconds, then sleep.', 'BELLY SOFT'],
    ['No sentence', 'Do not form a sentence about it. Sentences wake you.', 'NO SENTENCE'],
    ['Back to the dream', 'Pick the dream back up. The release does not get a chapter.', 'BACK TO THE DREAM']
  ]);
  add('stay', 'A', 'small', ['bedwetting'], [
    ['Woke wet, stay', 'You woke and you are wet. Staying in bed is the practice. Settle.', 'SETTLE'],
    ['No dash', 'The dash to the toilet is the old habit. Tonight you settle where you are.', 'NO DASH'],
    ['Note it', 'Note that you are wet, then put your head back down.', 'NOTE IT', 'HEAD DOWN'],
    ['Cover back', 'Pull the cover back up. You are not getting up to manage this.', 'COVER UP'],
    ['Warm and known', 'It is warm and you already know. Nothing else is required until morning.', 'NOTHING ELSE'],
    ['Stay on the pillow', 'The pillow stays under your head. That is how you know you stayed.', 'PILLOW STAYS'],
    ['Breathe out', 'Breathe out longer than in. Let the rest of any release finish.', 'LONG OUT'],
    ['Lights stay off', 'Do not turn a light on to inspect it. Morning is for that.', 'LIGHTS OFF'],
    ['Same bed', 'Same bed, same night. A change of bed is not the plan.', 'SAME BED'],
    ['If more comes', 'If more comes while you are awake, let it. You are already here.', 'LET MORE'],
    ['Hands off the gear', 'Checking with your hands wakes you further. Skip the check.', 'NO HAND CHECK'],
    ['Back to sleep wet', 'You can go back to sleep wet. That is allowed in this setup.', 'BACK TO SLEEP']
  ]);
  add('urgeA', 'A', 'small', ['bedwetting', 'first_urge', 'urgency'], [
    ['Woke with urge, stay', 'You woke with an urge. Stay in bed and let it go. Do not get up.', 'STAY AND LET GO'],
    ['Urge is the cue', 'The urge is the cue to soften, not the cue to stand.', 'SOFTEN'],
    ['Feet stay under', 'Feet stay under the cover. Standing is a different practice.', 'FEET UNDER'],
    ['First surge', 'The first surge can leave here. You do not have to walk it anywhere.', 'LET THE SURGE'],
    ['Don\'t negotiate', 'Do not negotiate a trip. The trip is the thing you are not practicing.', 'NO TRIP'],
    ['Lie back', 'If you sat up, lie back down before you decide.', 'LIE BACK'],
    ['Soft, then sleep', 'Let a little or a lot go, then aim at sleep again.', 'THEN SLEEP'],
    ['Room stays dark', 'You can let go in the dark. You do not need to see the bathroom.', 'DARK IS ENOUGH'],
    ['No hallway story', 'Skip the story about how close the bathroom is.', 'SKIP THE STORY'],
    ['Urge without standing', 'An urge does not require your feet on the floor.', 'NO FEET ON THE FLOOR'],
    ['Let it be the wet', 'If it becomes a wet, that is this practice working.', 'THAT IS THE PRACTICE'],
    ['Head down again', 'When it eases, head down. The night is not over.', 'HEAD DOWN']
  ]);
  add('urgeB', 'B', 'none', ['control'], [
    ['Woke with urge, get up', 'You woke with an urge. Sit up, feet on the floor, and finish in the toilet.', 'SIT UP', 'TOILET'],
    ['Name the room', 'Name the room so you are actually awake, then get up and go.', 'NAME THE ROOM', 'GET UP'],
    ['Light you can find', 'Turn on the light you planned. The path is the practice.', 'LIGHT ON', 'WALK THE PATH'],
    ['Empty on purpose', 'This is a planned wake. Empty, then back to bed if you want sleep.', 'EMPTY', 'THEN BED'],
    ['No hovering', 'Do not hover half-awake. Either sleep or get up. Tonight the urge means get up.', 'GET UP', 'FINISH'],
    ['Feet on the floor', 'Feet on the floor is the line between dreaming and going.', 'FEET DOWN', 'GO'],
    ['Short walk', 'The walk is short. You set it up that way. Use it.', 'SHORT WALK', 'TOILET'],
    ['Then back', 'Finish, then back to bed. You do not have to start the day.', 'FINISH', 'BACK TO BED'],
    ['Alarm did its job', 'If something woke you, use the waking. Do not talk yourself back down while you still need to go.', 'USE THE WAKING', 'GO'],
    ['Clear path', 'The path is clear because you made it clear. Walk it.', 'PATH IS CLEAR', 'WALK'],
    ['Sit before you stand', 'Sit on the edge first so you are steady, then go.', 'SIT ON THE EDGE', 'THEN GO'],
    ['Wake-on-urge', 'This is wake-on-urge. The urge is information. The toilet is the response.', 'URGE IS INFO', 'TOILET']
  ]);
  add('wetB', 'B', 'none', ['control'], [
    ['Woke wet, get up', 'You woke wet. Get up, finish in the toilet if there is more, then deal with the gear.', 'GET UP', 'THEN GEAR'],
    ['Change is allowed', 'A change is allowed when you are awake and wet. That is this setup.', 'CHANGE', 'DRY GEAR'],
    ['Do not stay soaked', 'Staying soaked is a different goal. Yours is to wake and change.', 'WAKE', 'CHANGE'],
    ['Toilet first', 'Toilet first if anything is left, then a dry layer.', 'TOILET FIRST', 'DRY LAYER'],
    ['Light on, look', 'Turn a light on and look. Knowing is part of waking up.', 'LIGHT ON', 'LOOK'],
    ['Fresh gear', 'Fresh gear is ready because you planned it. Use it.', 'FRESH GEAR', 'ON'],
    ['Note the time', 'Note the time roughly. Morning will want it.', 'NOTE THE TIME', 'THEN SLEEP OR STAY UP'],
    ['No shame spiral', 'Change, settle, and go back to sleep if the night is not over.', 'CHANGE', 'BACK TO BED'],
    ['Edge of the bed', 'Sit on the edge, then stand. Rushing while half asleep is how people fall.', 'SIT', 'THEN STAND'],
    ['Finish what is left', 'If more wants to leave, the toilet is the place.', 'TOILET', 'EMPTY'],
    ['Dry sheet if you can', 'If the sheet is wet and you have a spare, swap it. If not, a towel is enough.', 'SWAP OR TOWEL', 'THEN BED'],
    ['Morning still counts', 'You will still do the morning check. This wake is just the change.', 'CHANGE NOW', 'CHECK LATER']
  ]);
  add('dry', 'both', 'none', ['reward', 'control', 'bedwetting'], [
    ['Woke dry', 'You woke dry. Name that, then take the reward you picked or go back to sleep.', 'NAME IT', 'REWARD OR SLEEP'],
    ['Dry check', 'A hand check or a glance says dry. That is data, not a demand to get up.', 'CHECK', 'STAY OR GO'],
    ['Try again', 'If you still want sleep, lie back down. Dry does not end the night.', 'LIE BACK', 'MORE SLEEP'],
    ['Reward token', 'Touch the token or say the line you chose for a dry wake.', 'THE LINE', 'THE REWARD'],
    ['No extra drink', 'You do not need a drink just because you woke dry.', 'NO EXTRA DRINK', 'BACK TO BED'],
    ['Clock once', 'You may look at the clock once. Then decide sleep or morning.', 'ONE LOOK', 'DECIDE'],
    ['Gear still good', 'The gear is still good. You can leave it on.', 'LEAVE IT ON', 'SLEEP'],
    ['Small win', 'A dry wake is a small win for a more-control night, and useful information either way.', 'NOTE THE WIN', 'CARRY ON'],
    ['Stay curious', 'Notice how you woke. Urge, noise, or the alarm. Then you are done noticing.', 'NOTICE HOW', 'DONE'],
    ['Back under dry', 'If it is still night, back under the cover, still dry.', 'BACK UNDER', 'STILL DRY'],
    ['Morning will like this', 'The morning check will want this. You can log it then.', 'REMEMBER IT', 'LOG AT MORNING'],
    ['Optional get-up', 'Getting up is optional when you are dry, unless your goal is the toilet every wake.', 'OPTIONAL', 'YOUR GOAL']
  ]);
})();
