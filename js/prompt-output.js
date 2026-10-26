/* ===========================
   prompt-output.js — v9 "Prompt output" setting: sound only (headphones) / vibrate / both / silent.
   In-app prompts: BSPrompt.ping() plays a short tone and/or vibrates. Native alarms get a channel id:
   sound → 'sound-no-vibrate' (sound on, vibration disabled), vibrate → 'vibrate-only', silent → 'bs-silent',
   both → default channels. Bedwetting / Natural Night stays fully silent regardless.
   =========================== */
(function () {
  const KEY = 'bs_prompt_output';
  const MODES = { sound: 'Sound only (no vibration)', vibrate: 'Vibrate only', both: 'Sound + vibrate', silent: 'Silent' };
  const CH = { sound: 'sound-no-vibrate', vibrate: 'vibrate-only', silent: 'bs-silent', both: null };
  const mode = () => { const m = localStorage.getItem(KEY); return MODES[m] ? m : 'both'; };
  const silentNow = () => typeof window.isBedwettingSilent === 'function' && window.isBedwettingSilent();
  const soundOn = () => !silentNow() && (mode() === 'sound' || mode() === 'both');
  const vibrateOn = () => !silentNow() && (mode() === 'vibrate' || mode() === 'both');
  let ctx = null;
  function tone(freq) {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
      ctx = ctx || (typeof audioCtx !== 'undefined' && audioCtx) || new C(); if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.5); return true;
    } catch (e) { return false; }
  }
  /** One discreet prompt. Returns what was done (for tests). */
  function ping(freq) {
    const did = { sound: false, vibrate: false };
    if (soundOn()) did.sound = tone(freq);
    if (vibrateOn() && typeof navigator.vibrate === 'function') { navigator.vibrate([180, 90, 180]); did.vibrate = true; }
    return did;
  }
  const channel = () => CH[mode()];
  function set(m) { if (MODES[m]) localStorage.setItem(KEY, m); render(); try { window.nativeNotifySync && window.nativeNotifySync(); } catch (e) {} }
  function render() {
    const m = document.getElementById('promptOutputMount'); if (!m) return;
    const opt = (o, cur) => Object.keys(o).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${o[k]}</option>`).join('');
    const V = window.BSReport ? window.BSReport.VOICES : { caregiver: 'Caregiver', babysitter: 'Babysitter', coach: 'Neutral coach' };
    m.innerHTML = `<h2 style="margin:0 0 6px;">🎧 Prompts &amp; voice</h2>
      <label class="urge-lbl">Prompt output <select id="poMode">${opt(MODES, mode())}</select></label>
      <div class="cal-legend">Sound only = short tone through headphones/speaker, never vibrates (native alarms use the "sound-no-vibrate" channel). Night / bedwetting stays silent.</div>
      <label class="urge-lbl">Check-up voice <select id="poVoice">${opt(V, window.BSReport ? window.BSReport.getVoice() : 'caregiver')}</select></label>
      <div class="cal-legend">Office mode always uses the neutral coach voice.</div>
      <div class="cal-row"><button type="button" id="poTest">🔔 Test prompt</button></div>`;
    m.querySelector('#poMode').onchange = e => set(e.target.value);
    m.querySelector('#poVoice').onchange = e => { if (window.BSReport) window.BSReport.setVoice(e.target.value); };
    m.querySelector('#poTest').onclick = () => ping();
  }
  window.BSPrompt = { MODES, CH, mode, set, soundOn, vibrateOn, ping, tone, channel, render };
  window.addEventListener('load', () => setTimeout(render, 60));
})();
