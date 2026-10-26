/* ===========================
   potty-report.js — v9 (in-character check-up note; was v8 "My Potty Profile" (Profiles tab). A long, warm, playful report built from
   Quiz A/B answers, calibration results and calendar NATURAL data. Roleplay / game only: it never
   tells anyone to physically train their real body toward incontinence; training plans are.
   Tone scales with the 'bladder age' GAME stat + continence %: coach (neutral) → playful → little.
   Office mode → always neutral coach wording (plus the global terminology swap). Messy toggle respected.
   Sources: docs/SOURCES-bedwetting-prevalence.md
   =========================== */
(function () {
  const KEY = 'bs_potty_report_v1';
  const PROT = ['none', 'pad', 'pullups', 'diapers', 'thick_diapers'];
  const officeOn = () => !!(window.BSOffice && window.BSOffice.on());
  const messyOn = () => typeof window.isMessyEnabled === 'function' && window.isMessyEnabled();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SOURCES_LINE = 'Sources: AAFP 2022 (Am Fam Physician, enuresis Q&A); EAU Paediatric Urology Guidelines (nocturnal enuresis); Jain & Bhatt 2016, Pediatr Nephrol PMC4936340; Approach to NE in children 2024 PMC11132618 — see docs/SOURCES-bedwetting-prevalence.md.';
  const FACTS = [
    'About 15–20% of 5-year-olds still wet the bed sometimes (AAFP 2022).',
    'Around 5–10% of 7-year-olds and 7–10% of 8-year-olds do too (EAU guidelines; Jain & Bhatt 2016).',
    'By the late teens it is roughly 1–2%, and in adults about 0.5–1% (some studies up to 2–3%) still have night-time wetting (AAFP 2022; PMC11132618; PMC4936340).',
    'Without any treatment, roughly 14–15% of bedwetting kids become dry each year — that is the "spontaneous resolution" rate (EAU; AAFP 2022).',
    'It runs in families: about 15% chance with no family history, ~44% if one parent wet the bed, ~77% if both did (Bakwin, cited by AAFP 2022 & EAU).',
    'It is about twice as common in boys as in girls at most ages (EAU guidelines).',
    'Fewer than 3% of kids seen at enuresis clinics have an identifiable organic cause — it is mostly about sleep arousal, night-time urine production and bladder capacity (PMC11132618).'
  ];

  // ---------------- data gathering ----------------
  function gather(over) {
    over = over || {};
    const Q = window.BSQuiz, Cb = window.BSCalib, C = window.BSCalendar, Cp = window.BSCampaign;
    const qd = over.quiz || (Q ? Q.load() : {});
    let base = qd.baseline, tgt = qd.target;
    if (!base && qd.a && Q) base = Q.scoreA(qd.a);
    if (!tgt && qd.b && Q) tgt = Q.scoreB(qd.b, base);
    const trials = over.trials || (Cb ? Cb.load().trials : []);
    const cal = trials.length && Cb ? Cb.summarize(trials) : null;
    const last = trials[trials.length - 1] || {};
    const ba = cal && Cb ? Cb.bladderAge(cal, { age: last.age, sex: last.sex }) : null;
    const entries = over.entries || (C ? C.load().entries : []);
    const nat = entries.filter(e => e.source === 'natural');
    const nights = nat.filter(e => e.type === 'night' && e.night);
    const nn = C && C.nnStats ? C.nnStats(entries) : null;
    const camp = over.campaign !== undefined ? over.campaign : (Cp ? Cp.load() : null);
    return { a: qd.a || {}, b: qd.b || {}, base, tgt, cal, ba, nat, nights, nn, camp, office: over.office != null ? over.office : officeOn(), messy: over.messy != null ? over.messy : messyOn() };
  }

  /** Natural night entries whose day falls in the last `days` calendar days (inclusive of today). */
  function nightsInLastDays(nights, days) {
    days = days == null ? 5 : days;
    const C = window.BSCalendar;
    if (!C || !C.dayKey) {
      const cut = Date.now() - days * 864e5;
      return (nights || []).filter(e => e.ts >= cut);
    }
    const today = C.dayKey(Date.now());
    const want = {};
    for (let i = 0; i < days; i++) {
      const d0 = new Date(today + 'T12:00:00');
      d0.setDate(d0.getDate() - i);
      want[C.dayKey(d0.getTime())] = true;
    }
    return (nights || []).filter(e => want[C.dayKey(e.ts)]);
  }

  /** Tone tier 0 coach · 1 playful · 2 little. Driven by continence % and the bladder-age game stat. */
  function toneFor(d) {
    if (d.office) return { score: d.base ? d.base.control : null, tier: 0 };
    let c = d.base ? d.base.control : 70;
    const toneNights = nightsInLastDays(d.nights, 14);
    if (toneNights.length >= 3) { const wr = toneNights.filter(e => e.night.wet).length / toneNights.length; c = c * 0.7 + (100 - wr * 100) * 0.3; }
    if (d.ba && d.ba.capacityAge != null && d.ba.capacityAge < 12) c -= (12 - d.ba.capacityAge) * 3;
    return { score: Math.round(c), tier: c >= 65 ? 0 : c >= 38 ? 1 : 2 };
  }

  // v11 (B3): paraphrase quiz answers instead of quoting (was a null stub → printed "—")
  const ANS = { nights: ['no wet nights lately', 'a wet night now and then', 'a few wet nights a month', 'wet most nights'] };
  const ans = (a, id) => { const l = ANS[id]; if (!l || !a || a[id] == null) return null; return l[Math.max(0, Math.min(l.length - 1, +a[id] || 0))]; };
  const lvlName = l => String(l || '').replace(/_/g, ' ');
  const protName = v => { const o = window.BSCalendar ? window.BSCalendar.protectionOptions().find(x => x.value === v) : null; return o ? o.label : lvlName(v || 'none'); };

  // ---------------- v9: in-character check-up note ----------------
  const VKEY = 'bs_report_voice';
  const VOICES = { caregiver: 'Caregiver', babysitter: 'Babysitter', coach: 'Neutral coach' };
  const FOOTER = '— written with love, just for you. 💛';
  function getVoice() { const v = localStorage.getItem(VKEY); return VOICES[v] ? v : 'caregiver'; }
  function setVoice(v) { if (VOICES[v]) localStorage.setItem(VKEY, v); try { render(true); } catch (e) {} }
  function voice(tier, office, which) {
    const k = office ? 'coach' : (which || getVoice());
    const day = Math.floor(Date.now() / 864e5);
    const nick = k === 'caregiver' ? ['sweetie', 'little one', 'sweet pea'][day % 3] : k === 'babysitter' ? ['kiddo', 'little buddy', 'sport'][day % 3] : '';
    const me = k === 'caregiver' ? 'Mommy' : k === 'babysitter' ? 'your sitter' : 'I';
    // w(warm, neutral): caregiver/babysitter use warm text with {nick}/{me}/{Me}; coach uses neutral.
    const w = (warm, neutral) => k === 'coach' ? neutral : warm.replace(/\{nick\}/g, nick).replace(/\{me\}/g, me).replace(/\{Me\}/g, me[0].toUpperCase() + me.slice(1));
    return { k, tier, nick, me, w, potty: office ? 'restroom' : 'potty' };
  }
  const n3 = x => +(x || 0);
  function noteParas(d, v) {
    const a = d.a, P = [], hasA = !!d.base;
    const little = d.ba && d.ba.capacityAge != null && d.ba.capacityAge < 12 ? d.ba.capacityAge : null;
    const low = d.base ? d.base.control < 55 : false;
    P.push(v.w(v.k === 'caregiver' ? 'Okay {nick}, {me} had a good, gentle look at you today. Here is what I found.' : 'Alright {nick}, {me} wrote down everything from today\'s check-up. Here\'s the scoop.',
      'Here is your check-up note.'));
    // daytime
    if (hasA) {
      const s = [];
      if (little != null) s.push(v.w(`For your little bladder age — about a ${little}-year-old's — your tank fills up quickly and doesn't hold very much.`, `Your bladder behaves like a smaller one (roughly a ${little}-year-old's), so it fills quickly.`));
      else if (low) s.push(v.w('For your little bladder age, your tank fills up fast and likes to make its own decisions.', 'Your bladder fills fairly quickly and sometimes decides on its own.'));
      else s.push(v.w('You have a pretty steady big-kid bladder most of the time, {nick}.', 'Day to day, your bladder is fairly steady.'));
      if (n3(a.holdTime) >= 2) s.push(v.w('Sometimes little ones like you just can\'t hold it for long — when your tummy says "' + v.potty + '!", it means now.', 'Your warning window is short: when you feel it, it is time to go soon.'));
      else if (n3(a.holdTime) === 1) s.push(v.w('You can usually wait a little while, but not forever.', 'You can usually wait a while, though not for long stretches.'));
      else s.push(v.w('You can usually wait quite a while before it gets serious.', 'You usually get a comfortable warning before it gets urgent.'));
      if (n3(a.urgency) >= 2) s.push(v.w('Big sudden "uh-oh" feelings sneak up on you a lot.', 'Sudden strong urges are common for you.'));
      if (n3(a.leaks) >= 2) s.push(v.w('You have lots of little dribbles during the day, and that\'s very common for you — nothing to be shy about.', 'Small daytime leaks are a regular thing for you.'));
      else if (n3(a.leaks) === 1) s.push(v.w('Every now and then a little dribble slips out — that happens.', 'An occasional small leak happens.'));
      else s.push(v.w('Daytime oopsies are rare for you — {me} is proud of you.', 'Daytime accidents are rare.'));
      if (n3(a.awareness) >= 2) s.push(v.w('Sometimes the wet sneaks in and you don\'t even notice, so {me} likes to do little checks.', 'Some leaks go unnoticed, so regular checks help.'));
      const trig = (a.triggers || []).filter(x => x !== 'none');
      if (trig.includes('giggle_incontinence')) s.push(v.w('And big giggles make you leak a little!', 'Laughing can cause a small leak.'));
      P.push(s.join(' '));
    }
    // night — count nights in a recent calendar window, not all-time logs
    let wr = null;
    const recent5 = nightsInLastDays(d.nights, 5);
    const recent14 = nightsInLastDays(d.nights, 14);
    const pool = recent5.length ? recent5 : (recent14.length ? recent14 : []);
    const poolDays = recent5.length ? 5 : 14;
    if (pool.length) wr = Math.round(100 * pool.filter(e => e.night.wet).length / pool.length);
    else if (hasA) wr = [0, 10, 35, 75][n3(a.nights)];
    if (wr != null) {
      const wetN = pool.filter(e => e.night.wet).length;
      const many = pool.length ? `${wetN} of ${pool.length} nights logged in the last ${poolDays} days` : null;
      if (wr >= 45) P.push(v.w(`It's very common for you to wet the bed, {nick}${many ? ` — ${many} were wet` : ''}. Your sleepy bladder lets go while you dream, and that's okay.`, `Wet nights are common for you${many ? ` (${many})` : ''}.`));
      else if (wr >= 15) P.push(v.w(`Some nights you wake up dry and some nights you wake up soggy${many ? ` (${many} were wet)` : ''} — a real mix.`, `Nights are mixed${many ? ` (${many} were wet)` : ''}.`));
      else P.push(v.w('Most mornings you wake up nice and dry — good job, {nick}.', 'Most nights are dry.'));
      if (d.nn && d.nn.avgFluidWet != null && d.nn.avgFluidDry != null && d.nn.avgFluidWet > d.nn.avgFluidDry) P.push(v.w('{Me} noticed the wet nights come after bigger bedtime drinks.', 'Wet nights tend to follow bigger evening drinks.'));
      if (hasA && n3(a.nightWake) >= 3) P.push(v.w('You sleep so deeply that your body doesn\'t always wake you up in time.', 'You sleep deeply and don\'t always wake to go.'));
    }
    // tank / flow (calibration, in-character)
    if (d.cal && d.cal.medianMl != null) P.push(v.w(`Your little tank holds about ${d.cal.medianMl} ml before it says "${v.potty} time!", and a full emptying takes you about ${Math.round(d.cal.medianSec)} seconds.`, `You hold about ${d.cal.medianMl} ml, and emptying takes about ${Math.round(d.cal.medianSec)} seconds.`));
    else if (d.cal && d.cal.medianSec) P.push(v.w(`When you do go, it takes you about ${Math.round(d.cal.medianSec)} seconds to empty all the way.`, `Emptying takes you about ${Math.round(d.cal.medianSec)} seconds.`));
    // recent calendar (natural day accidents)
    const recent = d.nat.filter(e => e.ts > Date.now() - 14 * 864e5 && (e.type === 'accident' || e.type === 'leak')).length;
    if (recent) P.push(v.w(`You had ${recent} little accident${recent === 1 ? '' : 's'} in the last two weeks, and that's alright.`, `${recent} accident${recent === 1 ? '' : 's'} in the last two weeks.`));
    return P;
  }
  function wearParas(d, v) {
    const r = recommendWear(d); if (!r) return { paras: [], rec: null };
    const P = [];
    const lbl = r.label.toLowerCase();
    P.push(v.w(`So here's {me}'s plan: at night you'll wear ${/diaper/.test(lbl) ? '' : 'your '}${lbl}${r.booster ? ' with a booster pad tucked inside on heavy nights' : ''}, so you can sleep cosy and wake up to dry sheets.`, `Recommended night protection: ${lbl}${r.booster ? ' with a booster pad on heavy nights' : ''}.`));
    const leaky = r.stats.filter(x => x.n >= 2 && x.leakRate >= 20);
    if (leaky.length) P.push(v.w(`Your ${leaky.map(x => protName(x.p).toLowerCase()).join(' and ')} leaked a few times, so we're going one step thicker.`, `Your ${leaky.map(x => protName(x.p).toLowerCase()).join(' and ')} leaked a few times, so go one step up.`));
    if (r.day && r.day !== 'none') { const dl = r.dayLabel.toLowerCase(), same = r.day === r.night;
      P.push(v.w(`During the day, keep wearing your ${dl} and bring a spare, just in case${PROT.indexOf(r.day) >= 2 ? ` — at night the same or thicker${same ? '' : ` (${lbl})`}` : ''}.`, `Daytime: ${dl}, plus a spare. Night: ${same ? 'the same' : lbl} (never less than daytime).`)); }
    return { paras: P, rec: r };
  }

  /** Night protection stats by type from the calendar (natural + manual nights). */
  function wearStats(d) {
    const by = {};
    d.nights.forEach(e => { const p = e.night.protection || (e.night.protected ? 'diapers' : 'none'); const x = by[p] = by[p] || { n: 0, wet: 0, leaked: 0, sat: [] };
      x.n++; if (e.night.wet) { x.wet++; if (e.night.saturation != null) x.sat.push(+e.night.saturation); } if (e.night.leaked) x.leaked++; });
    return Object.keys(by).map(p => { const x = by[p]; return { p, n: x.n, wetRate: Math.round(100 * x.wet / x.n), leakRate: Math.round(100 * x.leaked / x.n), avgSat: x.sat.length ? Math.round(x.sat.reduce((a, b) => a + b, 0) / x.sat.length) : null }; })
      .sort((a, b) => PROT.indexOf(a.p) - PROT.indexOf(b.p));
  }
  /** v11 (B1/B2): one rec object {day, night}; night tier is never below the day tier. */
  function recommendWear(d) {
    const st = wearStats(d);
    let wr = null, why = [];
    if (d.nights.length) { wr = Math.round(100 * d.nights.filter(e => e.night.wet).length / d.nights.length); why.push(`your logged nights are ${wr}% wet`); }
    else if (d.base) { wr = [0, 10, 35, 75][+d.a.nights || 0]; const p = ans(d.a, 'nights'); why.push(p ? `your quiz says ${p}` : 'based on your quiz'); }
    if (wr == null) return null;
    let t = wr < 8 ? 0 : wr < 20 ? 1 : wr < 45 ? 2 : wr < 75 ? 3 : 4;
    const sats = st.filter(x => x.avgSat != null), avgSat = sats.length ? Math.round(sats.reduce((a, x) => a + x.avgSat * x.n, 0) / sats.reduce((a, x) => a + x.n, 0)) : null;
    if (avgSat != null && avgSat >= 80 && t < 4) { t++; why.push(`wet nights average ${avgSat}% saturation, so one step more absorbency`); }
    const leaky = st.filter(x => x.n >= 2 && x.leakRate >= 20);
    leaky.forEach(x => { const i = PROT.indexOf(x.p); if (i >= t && i < 4) { t = i + 1; why.push(`${protName(x.p)} leaked on ${x.leakRate}% of nights`); } });
    if (d.base && d.base.protFeel === 'avoid' && t > 1 && wr < 45) { t--; why.push('you prefer minimal protection, so we stayed one step lighter'); }
    const dayI = d.base ? Math.max(0, PROT.indexOf(d.base.protDay || 'none')) : 0;
    const qNight = d.base ? PROT.indexOf(d.base.protNight || '') : -1;
    if (qNight > t && d.nights.length < 3) { t = qNight; why.push(`your quiz says you wear ${protName(PROT[qNight]).toLowerCase()} at night`); }
    if (dayI > t) { t = dayI; why.push(`night is at least as much as your daytime ${protName(PROT[dayI]).toLowerCase()}`); }
    const booster = t >= 3 && ((avgSat != null && avgSat >= 70) || leaky.length);
    const day = PROT[dayI], night = PROT[t];
    return { tier: night, label: protName(night), day, dayLabel: protName(day), night, nightLabel: protName(night), why, stats: st, avgSat, booster, wr };
  }

  // ---------------- v13: long-form sections (likely / unlikely / typical day & night / watch for / tips / fun fact) ----------------
  // NOTE: body text must avoid meta words (quiz, calibration, score, %, sim, in-game, campaign). Pretend roleplay only.
  const FUN = [
    'About 15 to 20 out of every 100 five-year-olds still wet the bed sometimes.',
    'Each year, about 1 in 7 bedwetting kids becomes dry all on their own.',
    'Bedwetting runs in families: if both parents did it, the chance is roughly 3 in 4.',
    'A grown-up bladder usually holds about as much as a big mug and a half; a toddler\'s holds about a small cup.',
    'Most people empty their bladder in about 21 seconds, give or take, no matter their size.',
    'Deep sleepers are more likely to sleep right through a full-bladder signal.',
    'The body makes less urine at night thanks to a sleepy-time hormone, and some people make a bit less of it.'
  ];
  function longSections(d, v, tier) {
    const a = d.a || {}, S = [], T = (t0, t1, t2) => [t0, t1, t2][tier];
    const W = (warm, neutral) => v.w(warm, neutral);
    const hold = n3(a.holdTime), urg = n3(a.urgency), aw = n3(a.awareness), leaks = n3(a.leaks), nightsA = n3(a.nights), deep = n3(a.nightWake) >= 2;
    const shape = d.tgt && d.b ? d.b.accShape : null;
    let wr = d.nights.length ? Math.round(100 * d.nights.filter(e => e.night.wet).length / d.nights.length) : [0, 10, 35, 75][nightsA];
    // Likely / unlikely
    const likely = [], unlikely = [];
    if (tier === 2) likely.push(W('Little dribbles sneaking out while you play, {nick}.', 'Small leaks during busy moments.'), W('Waking up snug and soggy more mornings than not.', 'Wet mornings are fairly common.'), W('Needing a change before lunch and again before nap.', 'Needing more than one change by midday.'));
    else if (tier === 1) likely.push(W('A last-second dash to the ' + v.potty + ' a couple of times a day.', 'A few rushed trips a day.'), W('A damp spot now and then when you get busy.', 'An occasional damp spot on busy days.'), W('A mix of dry and soggy mornings.', 'A mix of dry and wet mornings.'));
    else likely.push(W('Making it to the ' + v.potty + ' nearly every time, big kid.', 'Reaching the restroom in time almost always.'), W('Waking up dry most mornings.', 'Dry mornings most days.'), W('Going before you leave the house, because you planned ahead.', 'Planning trips before leaving.'));
    if (urg >= 2) likely.push(W('Sudden "gotta go NOW" moments that make you wiggle.', 'Sudden strong urges.'));
    if (aw >= 2) likely.push(W('Finding out you\'re wet only when someone checks.', 'Not noticing small leaks right away.'));
    if (shape === 'flood') likely.push(W('Long dry stretches, then one big flood all at once.', 'Long dry stretches followed by one large accident.'));
    if (shape === 'dribble') likely.push(W('Lots of tiny dribbles instead of one big oops.', 'Many small leaks rather than one large one.'));
    if (tier === 0) unlikely.push(W('Needing thick protection during the day.', 'Needing heavy daytime protection.'), W('Sleeping through a full bladder.', 'Sleeping through a full bladder.'));
    else if (tier === 1) unlikely.push(W('A whole day without a single close call.', 'A day with no close calls at all.'), W('Holding it through a long movie without wiggling.', 'Holding comfortably through long stretches.'));
    else unlikely.push(W('Staying dry from breakfast all the way to lunch.', 'Staying dry for a full morning.'), W('Waking up and making it to the ' + v.potty + ' at night.', 'Waking at night in time to use the restroom.'), W('Spotting the "uh-oh" feeling early enough to plan.', 'Getting enough warning to plan ahead.'));
    if (hold === 0 && tier > 0) unlikely.push(W('Panicking — you usually get a little warning first.', 'Having no warning at all; there is usually some.'));
    S.push({ title: W('✅ Likely for you', '✅ Likely'), paras: likely.map(x => '• ' + x) });
    S.push({ title: W('🚫 Unlikely for you', '🚫 Unlikely'), paras: unlikely.map(x => '• ' + x) });
    // Typical day
    const day = [];
    day.push(T(W('Morning: up, ' + v.potty + ', breakfast, and off you go with a spare in your bag just in case.', 'Morning: restroom, breakfast, and a spare packed just in case.'),
      W('Morning: a quick check, a fresh change if you need it, then breakfast. {Me} reminds you to go before leaving.', 'Morning: a quick check, change if needed, restroom before leaving.'),
      W('Morning: {me} checks your diaper first thing — it\'s usually soggy — then a fresh one, breakfast, and a cuddle.', 'Morning: check and change first thing, then breakfast.')));
    day.push(T(W('Daytime: you go when you feel it, about every two to three hours.', 'Daytime: restroom roughly every two to three hours.'),
      W('Daytime: checks every hour or two, a reminder before outings, and the odd damp surprise.', 'Daytime: checks every hour or two and reminders before outings.'),
      W('Daytime: lots of little wettings you barely notice; {me} does diaper checks before snack, nap and dinner.', 'Daytime: frequent small leaks; checks before meals and rest.')));
    day.push(T(W('Evening: calm, dry, and a bathroom stop before bed.', 'Evening: one last restroom stop before bed.'),
      W('Evening: a slower wind-down, a ' + v.potty + ' try before pyjamas, and night protection on.', 'Evening: restroom before bed, night protection on.'),
      W('Evening: bath, a thick night diaper, a story and lights out — no need to try the ' + v.potty + ' first unless you want to.', 'Evening: night protection on, then lights out.')));
    S.push({ title: W('☀️ A typical day', '☀️ Typical day'), paras: day });
    // Typical night
    const night = [];
    if (wr >= 45) night.push(W('Most nights your sleepy bladder lets go while you dream, and you wake up warm and soggy. ' + (deep ? 'You sleep so deeply you won\'t even remember.' : 'Sometimes you stir a little, then drift back off.'), 'Most nights are wet. ' + (deep ? 'You tend to sleep through it.' : 'You may stir briefly.')));
    else if (wr >= 15) night.push(W('Some nights are dry, some are damp. A bigger drink at bedtime makes a soggy morning more likely.', 'Nights are mixed; larger evening drinks make wet nights more likely.'));
    else night.push(W('You usually sleep right through and wake up dry, maybe with a morning dash to the ' + v.potty + '.', 'Nights are usually dry, with a restroom trip on waking.'));
    night.push(T(W('If you wake up needing to go, you get up and go — nice and easy.', 'If you wake needing to go, you get up.'), W('If you do wake up, {me} says it\'s fine to get up — or snuggle back in if you\'re padded.', 'If you wake, get up or stay put if protected.'), W('Nights stay quiet and cozy: no alarms, just a morning check.', 'Nights stay quiet: no alarms, just a morning check.')));
    S.push({ title: W('🌙 A typical night', '🌙 Typical night'), paras: night });
    // What to watch for
    const watch = [];
    if (aw >= 2 || tier === 2) watch.push(W('Quiet dribbles you don\'t notice — a quick peek every hour keeps your skin happy.', 'Unnoticed leaks — check regularly so skin stays comfortable.'));
    if (urg >= 2) watch.push(W('Sudden waves: when one hits, head for the ' + v.potty + ' right away.', 'Sudden urges: go promptly when one hits.'));
    watch.push(W('Sitting too long in a wet diaper — change before it gets sore.', 'Staying in wet protection too long — change before skin gets irritated.'));
    if (wr >= 15) watch.push(W('Leaks out the sides at night: if it happens twice, go one step thicker.', 'Night leaks: if they repeat, step up absorbency.'));
    watch.push(W('Anything that feels truly different or uncomfortable in real life — tell a real doctor, {nick}.', 'Real changes or discomfort — mention them to a doctor.'));
    S.push({ title: W('👀 What to watch for', '👀 Watch for'), paras: watch.map(x => '• ' + x) });
    // Tips
    const tips = [T(W('Keep one spare in your bag — big kids plan ahead.', 'Keep a spare in your bag.'), W('Keep two spares and a little changing kit handy.', 'Keep two spares and a small kit handy.'), W('Keep a full changing bag ready, with wipes and cream.', 'Keep a full changing kit ready.')),
      W('Drink normally through the day, a little less right before bed.', 'Drink normally; slightly less right before bed.'),
      W('When you really have to go, go — nobody minds a pause.', 'When you need to go, go.'),
      T(W('Gold star idea: a dry morning earns a sticker.', 'Track dry mornings for a small reward.'), W('Gold star idea: a sticker for every honest check.', 'Reward honest check-ins.'), W('Gold star idea: a sticker for every happy change.', 'Reward calm, quick changes.'))];
    if (d.office) tips.push('Discreet wording is on, so prompts stay neutral at work.');
    S.push({ title: W('💡 Tips from ' + (v.k === 'caregiver' ? 'Mommy' : 'your sitter'), '💡 Tips'), paras: tips.map(x => '• ' + x) });
    const fi = Math.floor(Date.now() / 864e5) % FUN.length;
    S.push({ title: W('🌟 Fun fact', '🌟 Fun fact'), paras: [FUN[fi], FUN[(fi + 3) % FUN.length]] });
    return S;
  }
  // ---------------- build / output ----------------
  function build(over) {
    over = over || {};
    const d = gather(over);
    const tn = toneFor(d), v = voice(tn.tier, d.office, over.voice);
    const missing = !d.base && !d.cal && !d.nights.length;
    const sections = [];
    if (!missing) {
      sections.push({ title: d.office ? 'Check-up note' : v.w(v.k === 'caregiver' ? '🩺 Mommy\'s check-up note' : '🩺 Babysitter\'s check-up note', '🩺 Check-up note'), paras: noteParas(d, v) });
      const wr = wearParas(d, v);
      if (wr.paras.length) sections.push({ title: v.w('🧷 What you\'ll wear', '🧷 What to wear'), paras: wr.paras, rec: wr.rec });
      longSections(d, v, tn.tier).forEach(x => sections.push(x));
      sections.push({ title: '', paras: [v.w(v.k === 'caregiver' ? 'That\'s all for today, {nick}. Mommy loves you just the way you are. 💕' : 'That\'s it for today, {nick}. You did great.', 'That\'s all for today.')] });
    }
    const r = { generatedAt: Date.now(), tone: tn.tier, toneScore: tn.score, voice: v.k, office: d.office, missing, title: d.office ? 'My Routine Profile' : '🧷 My Potty Profile', sections, footer: FOOTER,
      prompts: [!d.base && 'Take Quiz A (Where you are now)', !d.cal && 'Run Settings › Calibration', !d.nights.length && 'Log a Natural Night'].filter(Boolean) };
    if (d.office) { const sw = s => window.BSOffice ? window.BSOffice.swap(s) : s; r.sections.forEach(s => { s.title = sw(s.title); s.paras = s.paras.map(sw); }); }
    return r;
  }
  function toText(r) {
    const head = `# ${r.title}\n`;
    if (r.missing) return head + '\nNot enough data yet. To generate your profile:\n' + r.prompts.map(p => '- ' + p).join('\n') + '\n';
    return head + r.sections.map(s => (s.title ? `\n## ${s.title}\n\n` : '\n') + s.paras.join('\n\n')).join('\n') + `\n\n---\n_${r.footer || FOOTER}_\n`;
  }
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<i>$2</i>');
  function save(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} }
  function loadSaved() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }

  function render(regen) {
    const m = document.getElementById('pottyReportMount'); if (!m) return;
    let r = !regen && loadSaved();
    const qd = window.BSQuiz ? window.BSQuiz.load() : {};
    if (!r || r.office !== officeOn() || r.voice !== (officeOn() ? 'coach' : getVoice()) || !r.footer || (qd.completedAt && qd.completedAt > r.generatedAt)) { r = build(); save(r); }
    const body = r.missing
      ? `<div class="pr-missing" id="prMissing"><p>Your profile needs a little info first! It's built from your quizzes, calibration and calendar.</p><ul>${r.prompts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
         <div class="quiz-nav"><button type="button" id="prQuizA">▶ Take Quiz A</button><button type="button" id="prCalib">🎯 Calibration</button></div></div>`
      : r.sections.map(s => `<div class="pr-sec">${s.title ? `<h3>${esc(s.title)}</h3>` : ''}${s.paras.map(p => `<p>${md(p)}</p>`).join('')}</div>`).join('');
    const vs = Object.keys(VOICES).map(k => `<option value="${k}" ${k === getVoice() ? 'selected' : ''}>${VOICES[k]}</option>`).join('');
    m.innerHTML = `<div class="pr-card pr-tone-${r.tone}" id="prCard"><h2 style="margin:0 0 4px;">${esc(r.title)}</h2>
      <label class="urge-lbl">Voice: <select id="prVoice" ${officeOn() ? 'disabled' : ''}>${vs}</select>${officeOn() ? ' <i>(office mode: neutral)</i>' : ''}</label>
      <div class="quiz-nav"><button type="button" id="prRegen">↻ Regenerate</button><button type="button" id="prShare">📤 Export / share</button></div>
      <div id="prBody">${body}</div>
      ${r.missing ? '' : `<div class="cal-legend pr-sources" id="prFooter">${esc(r.footer || FOOTER)}</div>`}</div>`;
    m.querySelector('#prVoice').onchange = e => setVoice(e.target.value);
    m.querySelector('#prRegen').onclick = () => { render(true); if (typeof toast === 'function') toast('Profile regenerated'); };
    m.querySelector('#prShare').onclick = () => share(r);
    const qa = m.querySelector('#prQuizA'); if (qa) qa.onclick = () => { if (window.BSQuiz) { window.BSQuiz.begin('a'); document.getElementById('myProfileMount').scrollIntoView({ block: 'start' }); } };
    const cb = m.querySelector('#prCalib'); if (cb) cb.onclick = () => { if (window.BSHub) return window.BSHub.openCalibration(); if (typeof switchTab === 'function') switchTab('settings'); };
    try { if (officeOn()) window.BSOffice.apply(); } catch (e) {}
  }
  async function share(r) {
    const text = toText(r);
    try { const S = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share; if (S) { await S.share({ title: r.title, text, dialogTitle: 'Share profile' }); return 'native'; } } catch (e) {}
    try { if (navigator.share) { await navigator.share({ title: r.title, text }); return 'web'; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); if (typeof toast === 'function') toast('Profile copied to clipboard'); return 'clipboard'; } catch (e) {}
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = 'my-potty-profile.md'; a.click(); return 'download'; } catch (e) {}
    return null;
  }


  /** Light caregiver deny / permission lines for board May I? and urge wait cards.
   *  kind: wait | diaper | little | yes | change_now | change_later | skin
   *  Office mode / coach voice → neutral. Mommy/caregiver → busy-mommy flavour. */
  function denyFlavour(band, kind, over) {
    over = over || {};
    const office = over.office != null ? over.office : officeOn();
    const k = office ? 'coach' : (over.voice || getVoice());
    const day = Math.floor(Date.now() / 864e5);
    if (k === 'coach') {
      const N = {
        wait: 'Please wait a bit longer.',
        diaper: 'Use your protection for now.',
        little: 'Only a little is okay right now.',
        yes: 'You may go.',
        change_now: 'You may change now.',
        change_later: 'Change later when saturation is higher.',
        skin: 'Skin-safety: change if you have been wet too long.'
      };
      return N[kind] || N.wait;
    }
    if (k === 'babysitter') {
      const nick = ['kiddo', 'little buddy', 'sport'][day % 3];
      const B = {
        wait: `Hang on, ${nick} — sitter says wait a bit.`,
        diaper: `Use your diaper for now, ${nick}.`,
        little: `Only a little, ${nick} — then wait.`,
        yes: `Okay ${nick}, you may go potty.`,
        change_now: `Yes, you can change now, ${nick}.`,
        change_later: `Not yet, ${nick} — a bit soggy first.`,
        skin: 'Skin-safety wins: change if you have been wet too long.'
      };
      return B[kind] || B.wait;
    }
    // caregiver / Mommy (default) — busy-mommy deny intensity scales lightly with lower bands
    const nick = ['sweetie', 'little one', 'sweet pea'][day % 3];
    const low = band === 'little' || band === 'none' || band === 'shaky';
    const C = {
      wait: low
        ? `Mommy's busy — wait in your diaper, ${nick}.`
        : `Mommy's busy — wait a little longer, ${nick}.`,
      diaper: `Mommy's busy — use your diaper, ${nick}.`,
      little: `Mommy's busy — only a little, ${nick}, then hold the rest.`,
      yes: `Okay ${nick}, Mommy says you may use the potty.`,
      change_now: `Yes, ${nick}, you may change now.`,
      change_later: low
        ? `Not yet, ${nick} — Mommy says stay padded a while.`
        : `Not yet — wait until you're soggy, or ask after another wetting.`,
      skin: 'Skin-safety wins: change if you have been wet too long.'
    };
    return C[kind] || C.wait;
  }

  window.BSReport = { FUN, longSections, VOICES, FOOTER, getVoice, setVoice, build, toText, render, share, gather, toneFor, recommendWear, wearStats, FACTS, SOURCES_LINE, nightsInLastDays, denyFlavour };
  window.renderPottyReport = render;
  window.addEventListener('load', () => setTimeout(() => render(false), 50));
})();
