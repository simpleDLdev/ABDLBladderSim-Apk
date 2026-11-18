/* ===========================
   pee-tap.js — every "I need to pee" tap paints a banner or a guide.
   A stuck queue with nothing on screen is cleared. An open guide is not
   replaced; the tap waits behind it.
   =========================== */
(function () {
  function openEl(el) {
    return !!(el && (el.style.display === 'flex' || el.style.display === 'block'));
  }
  function surface(doc) {
    doc = doc || document;
    const banner = doc.getElementById('alarmBanner');
    const guide = doc.getElementById('voidOverlay');
    return { banner: banner, guide: guide, bannerOpen: openEl(banner), guideOpen: openEl(guide) };
  }
  function copy(roll) {
    if (!roll || roll.kind === 'low') {
      return { action: 'banner', title: '🫧 <b>Not enough in the tank yet</b>', hint: 'Potty pass, or try a sip. A real need still means stop and go.' };
    }
    if (roll.kind === 'pass' || !roll.event || !roll.event.guide || !roll.event.guide.length) {
      return { action: 'banner', title: '🚽 <b>Potty pass</b>', hint: 'You can go. A real need still means stop and go.' };
    }
    return { action: 'guide', title: roll.event.label || 'I need to pee', text: roll.event.desc || roll.event.label || 'I need to pee', guide: roll.event.guide, kind: roll.event.kind || 'micro' };
  }
  function paintBanner(view, html) {
    const b = view.banner;
    if (!b) return;
    const text = b.querySelector ? b.querySelector('#alarmText') : null;
    if (text) text.innerHTML = html;
    else b.innerHTML = html;
    b.style.display = 'flex';
  }
  function show(doc, roll, opts) {
    opts = opts || {};
    const queue = opts.queue;
    let view = surface(doc);
    if (queue && queue.current && queue.current() && !view.bannerOpen && !view.guideOpen && queue.clear) queue.clear();
    view = surface(doc);
    const plan = copy(roll);
    if (!opts.force && (view.bannerOpen || view.guideOpen)) {
      if (queue && queue.offer) {
        queue.offer({
          key: 'pee:' + Date.now(),
          kind: plan.action === 'guide' ? 'guide' : 'banner',
          show: function () { show(doc, roll, { queue: queue, startGuide: opts.startGuide, force: true }); }
        });
      }
      return { shown: 'queued', plan: plan };
    }
    if (plan.action === 'banner') {
      paintBanner(view, plan.title + '<div class="small">' + plan.hint + '</div>');
      if (queue && queue.offer && !(queue.current && queue.current())) queue.offer({ key: 'pee-banner:' + Date.now(), kind: 'banner' });
      return { shown: 'banner', plan: plan, text: plan.title + ' ' + plan.hint };
    }
    if (typeof opts.startGuide === 'function') opts.startGuide(plan.guide, plan.text, plan.kind === 'full' ? 'full' : 'micro', null, true);
    else if (view.guide) {
      view.guide.style.display = 'flex';
      const inst = doc.getElementById('voidInstruction');
      if (inst) inst.textContent = plan.text;
    }
    if (queue && queue.offer && !(queue.current && queue.current())) queue.offer({ key: 'pee-guide:' + Date.now(), kind: 'guide' });
    return { shown: 'guide', plan: plan, text: plan.text };
  }
  window.BSPee = { surface: surface, copy: copy, show: show };
})();
