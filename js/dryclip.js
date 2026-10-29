/* ===========================
   dryclip.js — v26 background watch: on Android a native foreground service (Capacitor plugin DryClipService) owns the
   BLE link with the screen off, parses DC01 and queues wet events with the real wet time (now − secsSinceWet); the app drains
   the queue on start/resume and logs each event at wetAt. Ignore WET while arming, while pairing/connecting/settling after a
   fresh link, and for 20 s after the armed confirmation (the plate reads warmth/touch). Dedupe ±60 s. v28: default auto
   re-arm 20 min, tunable / protection-linked. The Capacitor BLE plugin path below stays as fallback / mock.
   v25 link like the vendor app: plugin patched (no MTU request, priority HIGH before discovery, clean GATT close), calm reconnect (close, wait 8 s, 6 s connect, else 12 s scan; one attempt per 12 s, never overlapping), 'Armed (assumed)' 12 s after Arm if the clip stays away. v24 arm like the vendor app: ARM write-without-response, 10–15 s arming phase, expected link drop after Arm → close, wait, backoff reconnect (2/5/10/15 s, rescan if direct connect fails), read DC01 to confirm armed. No automatic IDENTIFY/POWER_FLAGS reads. v23 connection status card, state-aware buttons, reconnect, test panel. v21: DryClip BLE + overnight flags (night-total sat), wake check-in, daytime unnoticed, wear-time, battery low.
   Protocol from DryClip-interop-notes.md (vendor app v7.0 static analysis).
   Service 0xDC00 · STATE DC01 · ARM DC02 · IDENTIFY DC03 (unused, vendor never touches it) · SENSITIVITY DC04 ·
   POWER_FLAGS DC05 (unused) · RETRY_MODE DC06 · WET_ACK DC07 · Battery 0x180F/0x2A19.
   Night mode: silent calendar flags (no alert at wet time). Morning check-in after wake time.
   Background: JS may pause with screen off — keep-awake (PARTIAL_WAKE_LOCK + FLAG_KEEP_SCREEN_ON)
   via BladderAlarm when available — only on the fallback path. v26: the native service needs neither.
   =========================== */
(function () {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const KEY = 'bs_dryclip_v1', LOG_MAX = 400;
  const ALARM_ID = 1960; // morning check-in (native-notify / BladderAlarm)
  const SVC = '0000dc00-0000-1000-8000-00805f9b34fb';
  const C = { STATE: '0000dc01-0000-1000-8000-00805f9b34fb', ARM: '0000dc02-0000-1000-8000-00805f9b34fb',
    IDENTIFY: '0000dc03-0000-1000-8000-00805f9b34fb', SENS: '0000dc04-0000-1000-8000-00805f9b34fb',
    POWER: '0000dc05-0000-1000-8000-00805f9b34fb', RETRY: '0000dc06-0000-1000-8000-00805f9b34fb',
    ACK: '0000dc07-0000-1000-8000-00805f9b34fb', BAT_SVC: '0000180f-0000-1000-8000-00805f9b34fb', BAT: '00002a19-0000-1000-8000-00805f9b34fb' };
  const J = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => (n < 16 ? '0' : '') + n.toString(16);
  const toHex = bytes => Array.from(bytes).map(pad).join(' ');
  const pad2 = n => String(n).padStart(2, '0');
  const fmtHM = ts => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

  function defaults() {
    return {
      mock: false, rearmMin: 20, rearmByProt: false, log: [], lastId: null,
      wakeHour: 7, wakeMin: 0, keepAwake: true, wearingTonight: false,
      daytimeWatch: false, // unnoticed daytime events → silent flags
      batLowPct: 20, batLowNotified: false,
      wearStartedAt: null, // last Arm = new wear
      cloudyNight: false, // v30 one-tap: night watch + Match-protection re-arm
      settleIgnored: 0, // v30: count of touch/settle wets ignored (export telemetry)
      mommyCheck: true, // v39: padding check before auto-arm (new field on bs_dryclip_v1)
      mommySpreadMin: 8, // random minutes before the nominal re-arm to aim at dry padding
      night: null // { id, startedAt, wakeAt, eventIdx, lastSecs, gapFrom, gaps:[], saturatedAt, awaitingRearm, pendingCheckIn, totalSat }
    };
  }
  function load() {
    const d = Object.assign(defaults(), J(KEY, {}));
    // v28 one-shot: old default was 5; bump to 20 unless the user already picked another value or Match protection
    if (!d.rearmV28) {
      d.rearmV28 = true;
      if (!d.rearmByProt && (+d.rearmMin === 5 || d.rearmMin == null)) d.rearmMin = 20;
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    }
    return d;
  }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function log(kind, msg, extra) {
    const d = load(); const e = Object.assign({ t: Date.now(), kind, msg }, extra || {});
    d.log = (d.log || []).concat(e).slice(-LOG_MAX); save(d); return e;
  }

  /** Pure: decode STATE bytes → { wet, armed, charging, arming, secs, raw, flags }. */
  function parseState(bytes) {
    if (!bytes || !bytes.length) return { wet: false, armed: false, charging: false, arming: false, secs: null, raw: '', flags: 0 };
    const flags = bytes[0] & 0xff;
    let secs = null;
    if (bytes.length >= 5) secs = (bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0;
    return { wet: !!(flags & 0x01), armed: !!(flags & 0x02), charging: !!(flags & 0x08), arming: !!(flags & 0x10), secs, raw: toHex(bytes), flags };
  }

  // ---------- v26/v28 pure wet logic (mirror of DryClipProtocol.decide in the native service) ----------
  /** v43: only the clip's 2–3 s arm disconnect. A wet reports ~30 s late, so the backdated start is not used to hide it. */
  const POST_ARM_SUPPRESS_MS = 4000, IGNORE_AFTER_ARM_MS = POST_ARM_SUPPRESS_MS, SETTLE_ON_CONNECT_MS = 0, DEDUPE_MS = 60000;
  /** wet time from a reading: now − secsSinceWet (secs unknown → now). */
  function wetAtFromSecs(now, secs) { return secs == null || !isFinite(+secs) ? now : now - (+secs) * 1000; }
  /** 'not_wet' | 'arming' | 'not_armed' | 'ignore_window' | 'duplicate' | 'new'
   *  Armed + wet, after the few seconds of the arm disconnect, is always 'new' (a touch counts).
   *  Not armed is 'not_armed' and must not notify. */
  function decideWet(st, now, o) {
    o = o || {};
    if (!st || !st.wet) return 'not_wet';
    if (o.armPending || st.arming) return 'arming';
    if (!st.armed) return 'not_armed';
    const ig = +o.ignoreUntil || 0;
    if (ig && now < ig) return 'ignore_window';
    const at = wetAtFromSecs(now, st.secs);
    if (o.lastWetAt && Math.abs(at - o.lastWetAt) <= DEDUPE_MS) return 'duplicate';
    return 'new';
  }
  /** v28: auto re-arm minutes from current protection (thin / standard / thick overnight). */
  const REARM_BY_PROT = { none: 15, pad: 20, pullups: 25, diapers: 30, thick_diapers: 40 };
  function currentProtection() {
    try {
      const v = (typeof localStorage !== 'undefined' && localStorage.getItem('currentProtectionLevel')) || 'pad';
      return v === 'guards' ? 'pad' : v;
    } catch (e) { return 'pad'; }
  }
  function rearmMinutesFor(d) {
    d = d || load();
    if (d.rearmByProt) {
      const prot = currentProtection();
      return REARM_BY_PROT[prot] != null ? REARM_BY_PROT[prot] : 20;
    }
    const m = +d.rearmMin;
    return isFinite(m) && m >= 0 ? m : 20;
  }

  // ---------- v26 native background watch (Android) ----------
  let nst = null, nativeBound = false, draining = null, batUnrestricted = null;
  function nativePlugin() {
    try {
      const C0 = W.Capacitor; const P = C0 && C0.Plugins && C0.Plugins.DryClipService;
      if (!P) return null;
      if (typeof C0.isNativePlatform === 'function' && !C0.isNativePlatform()) return null;
      return P;
    } catch (e) { return null; }
  }
  function useNative() { return !mock.on && !load().mock && !!nativePlugin(); }
  function bgOn() { return !!(useNative() && nst && nst.running); }
  async function nativeBind() {
    const P = nativePlugin(); if (!P || nativeBound) return; nativeBound = true;
    try { await P.addListener('status', s => { nst = s; renderLab(); }); } catch (e) {}
    try { await P.addListener('wet', () => { drainNative(); }); } catch (e) {}
    try { await P.addListener('event', () => { drainNative(); }); } catch (e) {}
    try { await P.addListener('log', e => {
      if (!e || !/^(wet|arm|err|conn|svc|rearm)$/.test(e.kind)) return;
      log('bg', e.kind + ': ' + e.msg);
      if (e.kind === 'wet' && /ignored|Settling/i.test(e.msg || '')) {
        const d = load(); d.settleIgnored = (+d.settleIgnored || 0) + 1; save(d);
      }
    }); } catch (e) {}
    await nativeRefresh();
  }
  async function nativeRefresh() {
    const P = nativePlugin(); if (!P) return null;
    try { nst = await P.getStatus(); } catch (e) {}
    try {
      const BA = W.Capacitor.Plugins.BladderAlarm;
      if (BA && BA.checkPermissions) { const r = await BA.checkPermissions(); batUnrestricted = r ? r.batteryUnrestricted !== false : null; }
    } catch (e) {}
    renderLab(); return nst;
  }
  /** Which night (if any) a wet time belongs to — works even after the morning ended "wearing tonight". */
  function nightFor(ts, d) {
    const n = d.night; if (!n) return null;
    if (ts < (n.startedAt || 0) - 60000) return null;
    if (n.endedAt && ts > n.endedAt) return null;
    return (d.wearingTonight || n.pendingCheckIn || n.endedAt) ? n : null;
  }
  /** Map one queued native event into the app: calendar flag / saturated marker / gap marker. Returns what it did. */
  function applyNativeEvent(ev) {
    ev = ev || {}; const kind = ev.kind || 'wet';
    const d = load();
    if (ev.battery != null) { battery = +ev.battery; checkBatteryLow(battery); }
    if (kind === 'wet') {
      const wetAt = +ev.wetAt || +ev.detectedAt || Date.now();
      const st = { wet: true, armed: true, secs: ev.secs != null ? +ev.secs : null, raw: ev.rawHex || '' };
      log('wet', 'Wet at ' + fmtHM(wetAt) + ' (background watch' + (ev.detectedAt ? ', seen ' + fmtHM(+ev.detectedAt) : '') + ')', { wet: true, secs: st.secs });
      const night = nightFor(wetAt, d);
      if (night) return handleNightWet(st, { wetAt, native: true, night }) ? 'night' : 'dupe';
      if (d.daytimeWatch) { handleDaytimeUnnoticed(st, { wetAt, native: true }); return 'day'; }
      offerAccident(st, { wetAt }); return 'offer';
    }
    if (kind === 'mommy_check') {
      log('rearm', 'Mommy check — aim at dry padding before arming');
      try { openMommyCheck(); } catch (e) {}
      return 'mommy';
    }
    if (kind === 'still_wet') {
      const at = +ev.detectedAt || Date.now();
      const night = nightFor(at, d);
      log('sat', "Clip still wet, can't re-arm (background watch keeps trying every 10 min)");
      if (night && !night.saturatedAt) { night.saturatedAt = at; save(d); addSaturatedMarker(night); return 'saturated'; }
      return 'noted';
    }
    if (kind === 'gap') {
      const night = nightFor(+ev.from || 0, d);
      if (night) { night.gaps = (night.gaps || []).concat([{ from: +ev.from, to: +ev.to }]); save(d); addGapMarker(night, +ev.from, +ev.to); return 'gap'; }
      return 'noted';
    }
    return 'unknown';
  }
  /** Pull queued wet events from the native service and log each at its real wet time. */
  function drainNative() {
    const P = nativePlugin(); if (!P) return Promise.resolve(0);
    if (draining) return draining;
    draining = (async () => {
      let n = 0;
      try {
        const r = await P.drainEvents(); const evs = (r && r.events) || [];
        evs.sort((a, b) => (+a.wetAt || +a.detectedAt || 0) - (+b.wetAt || +b.detectedAt || 0));
        evs.forEach(ev => { try { applyNativeEvent(ev); n++; } catch (e) { log('err', 'background event: ' + (e.message || e)); } });
      } catch (e) { log('warn', 'drainEvents: ' + (e.message || e)); }
      finally { draining = null; }
      if (n) { refreshBadge(); renderLab(); }
      return n;
    })();
    return draining;
  }
  async function nativeStart(mac, name) {
    const P = nativePlugin(); if (!P) throw new Error('Background watch not available');
    try {
      const perm = await P.ensurePermissions();
      if (perm && perm.bluetooth === false) throw new Error('Allow "Nearby devices" so the app can reach the clip');
      if (perm && perm.notifications === false) log('warn', 'Notifications are off. The background watch still runs, but its notification is hidden.');
    } catch (e) { if (/Nearby/.test(e.message || '')) throw e; }
    const d = load();
    mac = mac || d.lastId;
    if (!mac || !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac)) {
      let hit = null;
      try {
        const r = await P.scanForClips({ mac: '' });
        hit = (r && r.clips && r.clips[0]) || null;
      } catch (e) { log('scan', e.message || String(e)); }
      if (!hit) {
        try {
          const r = await P.findClip();
          const b = ((r && r.bonded) || []).find(x => x.isDryClip);
          if (b) hit = { address: b.address, name: b.name };
        } catch (e) {}
      }
      if (!hit) throw new Error('No DryClip in range. Turn it on, close the other clip app, and use Find a clip. A classic Bluetooth bond is not required.');
      mac = hit.address; name = name || hit.name;
    }
    d.lastId = String(mac).toUpperCase(); if (name) d.lastName = name; save(d);
    await P.start({ mac: d.lastId, name: d.lastName || 'DryClip', rearmMin: rearmMinutesFor(d), mommyCheck: mommyCheckOn(d), mommySpreadMin: mommySpread(d) });
    log('conn', 'Background watch on · ' + d.lastId);
    await sleep(300); await nativeRefresh();
  }

  // ---------- mock ----------
  const mock = { on: false, state: new Uint8Array([0x00]), bat: 84, timer: null, listeners: { state: null, bat: null } };
  function mockEnable(on) {
    mock.on = !!on; const d = load(); d.mock = mock.on; save(d);
    if (!mock.on) { clearInterval(mock.timer); mock.timer = null; return; }
    mock.state = new Uint8Array([0x00]); mock.bat = 84;
    log('mock', 'Mock clip on — use Wet / Dry / Arming buttons');
  }
  function mockSetFlags(bits) {
    const b = new Uint8Array(mock.state.length >= 5 ? mock.state : [0, 0, 0, 0, 0]);
    b[0] = bits & 0xff;
    if (bits & 0x01) {
      if (!(mock.state[0] & 0x01)) { b[1] = 0; b[2] = 0; b[3] = 0; b[4] = 0; }
      else { b[1] = mock.state[1]; b[2] = mock.state[2]; b[3] = mock.state[3]; b[4] = mock.state[4]; }
    }
    mock.state = b; if (mock.listeners.state) mock.listeners.state(b);
  }
  function mockTick() {
    if (!(mock.state[0] & 0x01) || mock.state.length < 5) return;
    let secs = (mock.state[1] | (mock.state[2] << 8) | (mock.state[3] << 16) | (mock.state[4] << 24)) >>> 0;
    secs++; const b = new Uint8Array(mock.state); b[1] = secs & 0xff; b[2] = (secs >> 8) & 0xff; b[3] = (secs >> 16) & 0xff; b[4] = (secs >> 24) & 0xff;
    mock.state = b; if (mock.listeners.state) mock.listeners.state(b);
  }

  // ---------- BLE ----------
  let ble = null, deviceId = null, lastState = null, battery = null, scanning = false, rearmTimer = null, hbTimer = null;
  // v23: connection status for the status card
  // connState: 'idle' | 'searching' | 'connecting' | 'connected' | 'lost'
  let scanHits = [];
  let connState = 'idle', lastSeenAt = null, lastRaw = null, connHint = false, manualDisc = false, retryTimer = null, connecting = false;
  // v25 timings from the vendor app: 6 s per connect, ≥ 8 s after a close, rescan every 12 s, armed after 12 s as a fallback
  const CFG = { connectTimeoutMs: 6000, retryMs: 12000, backoffMs: [], closeDelayMs: 8000, armDropWindowMs: 30000, armBusyMs: 20000, armConfirmMs: 30000, armAssumeMs: 12000, batEveryMs: 600000, scanMs: 12000 };
  // v24: arming (vendor DryClipBleManager: ARM write no-response, FIRMWARE_ARM_HANDLER_MS 5 s, ARM_FINALIZATION_MS 12 s)
  // v25: gen = id of the current link (a drop bumps it so a half-done setup stops); reconnBusy = one attempt at a time
  let gen = 0, reconnBusy = false, cycleAt = 0, lastConnEndAt = 0, lastReconnLogAt = 0, armAssumed = false, assumeTimer = null, lastStateAt = 0;
  let ignoreUntil = 0; // v26 fallback path: post-arm ignore window
  let latchCleared = false; // v39: post-settle touch cleared once; no auto re-arm until dry or user Arm
  let armFromArmed = false; // v27: re-arm (recalibrate) while already armed
  let armPending = false, armAt = 0, armTimer = null, reconnTimer = null, reconnStep = 0, batTimer = null, lastBatLogged = null, lastStateLog = { raw: null, t: 0 };
  function keepLink() { return watching() || armPending || armAssumed || !!(lastState && lastState.armed); }
  function armBusy() { return armPending && Date.now() - armAt < CFG.armBusyMs; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const HINT = "Can't reach the clip. Close or force-stop the DryClip app (or turn its Bluetooth off), then try again — the clip talks to one app at a time.";
  function setConn(s) { connState = s; if (s === 'connected') connHint = false; renderLab(); }
  function withTimeout(p, ms) {
    let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('Connection timed out')), ms); })]).finally(() => clearTimeout(t));
  }
  function watching() { const d = load(); return !!((d.night && d.wearingTonight) || d.daytimeWatch); }
  function hexToBytes(hex) {
    const bin = []; let i, c, empty = 1, buf = 0;
    hex = String(hex || '');
    for (i = 0; i < hex.length; i++) { c = hex.charCodeAt(i); if ((c > 47 && c < 58) || (c > 64 && c < 71) || (c > 96 && c < 103)) { buf = (buf << 4) ^ ((c > 64 ? c + 9 : c) & 15); if ((empty ^= 1)) bin.push(buf & 0xff); } }
    return new Uint8Array(bin);
  }
  function bytesToHex(bytes) { return Array.from(bytes || []).map(n => (n < 16 ? '0' : '') + n.toString(16)).join(''); }
  function rawPlugin() {
    try { return W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.BluetoothLe; } catch (e) { return null; }
  }
  async function getBle() {
    if (ble) return ble;
    if (W.BleClient) { ble = W.BleClient; return ble; }
    if (W.capacitorCommunityBluetoothLe && W.capacitorCommunityBluetoothLe.BleClient) { ble = W.capacitorCommunityBluetoothLe.BleClient; return ble; }
    const P = rawPlugin(); if (!P) return null;
    const listeners = {};
    ble = {
      async initialize(opts) { return P.initialize(opts || {}); },
      async requestLEScan(opts, cb) {
        listeners.scan = await P.addListener('onScanResult', r => cb(r));
        await P.requestLEScan(opts || {});
      },
      async stopLEScan() { try { listeners.scan && listeners.scan.remove(); } catch (e) {} listeners.scan = null; await P.stopLEScan(); },
      async connect(id, onDisc) {
        // v23: drop any listener left from an earlier connect (they used to pile up → double callbacks)
        try { listeners['disc|' + id] && listeners['disc|' + id].remove(); } catch (e) {}
        if (onDisc) { listeners['disc|' + id] = await P.addListener('disconnected|' + id, () => onDisc(id)); }
        await P.connect({ deviceId: id, timeout: CFG.connectTimeoutMs });
      },
      async disconnect(id) { await P.disconnect({ deviceId: id }); },
      async requestConnectionPriority(id, p) { if (P.requestConnectionPriority) await P.requestConnectionPriority({ deviceId: id, connectionPriority: p }); },
      async read(id, service, characteristic) {
        const r = await P.read({ deviceId: id, service, characteristic });
        const b = hexToBytes(r.value); return new DataView(b.buffer, b.byteOffset, b.byteLength);
      },
      async write(id, service, characteristic, value) {
        const bytes = value instanceof DataView ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value);
        await P.write({ deviceId: id, service, characteristic, value: bytesToHex(bytes) });
      },
      async writeWithoutResponse(id, service, characteristic, value) {
        const bytes = value instanceof DataView ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value);
        await P.writeWithoutResponse({ deviceId: id, service, characteristic, value: bytesToHex(bytes) });
      },
      async startNotifications(id, service, characteristic, cb) {
        const key = 'notification|' + id + '|' + service + '|' + characteristic;
        try { listeners[key] && listeners[key].remove(); } catch (e) {}
        listeners[key] = await P.addListener(key, ev => { const b = hexToBytes(ev && ev.value); cb(new DataView(b.buffer, b.byteOffset, b.byteLength)); });
        await P.startNotifications({ deviceId: id, service, characteristic });
      },
      async stopNotifications(id, service, characteristic) {
        const key = 'notification|' + id + '|' + service + '|' + characteristic;
        try { listeners[key] && listeners[key].remove(); } catch (e) {}
        await P.stopNotifications({ deviceId: id, service, characteristic });
      }
    };
    return ble;
  }
  function numbersToDataView(arr) { return new DataView(Uint8Array.from(arr).buffer); }

  async function init() {
    if (load().mock || mock.on) { mock.on = true; return { ok: true, mock: true }; }
    const B = await getBle(); if (!B) return { ok: false, err: 'BLE not available (use Mock Clip)' };
    try { await B.initialize({ androidNeverForLocation: true }); log('init', 'BLE ready'); return { ok: true }; }
    catch (e) { log('err', 'initialize: ' + e.message); return { ok: false, err: e.message }; }
  }

  async function scan(onHit, ms) {
    if (mock.on) { onHit && onHit({ deviceId: 'MOCK', name: 'DryClip Mock', rssi: -40 }); return; }
    const B = await getBle(); if (!B) throw new Error('No BLE');
    scanning = true; log('scan', 'Scanning for DryClip…');
    const hits = {};
    // v40: do not filter on DC00. The clip often omits that UUID from the advert (DryPing matches the name). Bond is irrelevant.
    const remembered = (load().lastId || '').toUpperCase();
    await B.requestLEScan({ allowDuplicates: true }, r => {
      const name = (r.localName || r.device?.name || '').toString();
      const id = r.device?.deviceId || r.deviceId;
      const svcs = (r.uuids || r.serviceUUIDs || []).map(u => String(u).toLowerCase());
      const ok = /dryclip/i.test(name) || svcs.some(u => u.indexOf('dc00') >= 0) || (remembered && String(id || '').toUpperCase() === remembered);
      if (!ok || !id || hits[id]) return; hits[id] = 1;
      log('scan', 'Found ' + (name || id), { id }); onHit && onHit({ deviceId: id, name: name || ('DryClip • ' + id.slice(-5)), rssi: r.rssi });
    });
    setTimeout(async () => { try { await B.stopLEScan(); } catch (e) {} scanning = false; log('scan', 'Scan stopped'); }, ms || 8000);
  }
  async function stopScan() { if (mock.on) return; const B = await getBle(); try { await B.stopLEScan(); } catch (e) {} scanning = false; }

  async function connect(id, name, opts) {
    opts = opts || {};
    if (mock.on) {
      deviceId = 'MOCK'; lastState = parseState(mock.state); battery = mock.bat; checkBatteryLow(battery);
      mock.listeners.state = bytes => onState(bytes); mock.listeners.bat = () => {};
      clearInterval(mock.timer); mock.timer = setInterval(mockTick, 1000);
      const dm = load(); dm.lastName = 'DryClip Mock'; save(dm);
      lastSeenAt = Date.now(); manualDisc = false; connState = 'connected'; connHint = false;
      log('conn', 'Connected to mock'); onConnected(); return lastState;
    }
    if (connecting) throw new Error('Already connecting');
    const B = await getBle(); if (!B) throw new Error('No BLE');
    await stopScan();
    connecting = true; manualDisc = false; setConn('connecting');
    const my = ++gen;
    try {
      // v25: the patched plugin resolves connect only after service discovery (HIGH priority already requested, no MTU)
      await withTimeout(B.connect(id, () => onDisconnected()), CFG.connectTimeoutMs + 1000);
    } catch (e) {
      connecting = false; lastConnEndAt = Date.now();
      try { await B.disconnect(id); } catch (x) {} // close the GATT fully before anything else
      if (opts.fromRetry) { log('info', 'Connect attempt failed: ' + (e.message || e)); throw e; }
      connHint = true; log('err', 'Connect failed: ' + (e.message || e));
      connState = keepLink() ? 'lost' : 'idle'; if (keepLink()) startRetry();
      renderLab(); throw e;
    }
    lastConnEndAt = Date.now();
    if (gen !== my) { connecting = false; return lastState; } // dropped before connect even returned
    deviceId = id; const d = load(); d.lastId = id; if (name) d.lastName = name; save(d); log('conn', 'Connected ' + id);
    lastSeenAt = Date.now();
    // v25: if the link drops mid-setup, stop: never notify/read on a dead link ('Not connected to device').
    const alive = () => gen === my && deviceId === id;
    const bail = () => { connecting = false; return lastState; };
    // Vendor calls requestConnectionPriority(HIGH) right after connect. The patched plugin already did it before discovery; this repeat is harmless.
    try { if (B.requestConnectionPriority) await B.requestConnectionPriority(id, 1); } catch (e) {}
    if (!alive()) return bail();
    try { await B.startNotifications(id, SVC, C.STATE, v => onState(dvBytes(v))); } catch (e) { if (!alive()) return bail(); log('warn', 'STATE notify: ' + e.message); }
    if (!alive()) return bail();
    try { await B.startNotifications(id, C.BAT_SVC, C.BAT, v => onBattery(dvBytes(v)[0])); } catch (e) { if (!alive()) return bail(); log('warn', 'Battery notify: ' + e.message); }
    if (!alive()) return bail();
    // v24: same as the vendor app — read DC01 then battery once. No IDENTIFY / POWER_FLAGS reads, no polling.
    try { const st = await B.read(id, SVC, C.STATE); onState(dvBytes(st)); } catch (e) { if (!alive()) return bail(); log('warn', 'STATE read: ' + e.message); }
    if (!alive()) return bail();
    if (!armBusy()) { try { const b = await B.read(id, C.BAT_SVC, C.BAT); onBattery(dvBytes(b)[0]); } catch (e) {} }
    startBatteryTimer();
    connecting = false;
    if (!alive()) return lastState; // dropped during setup — disconnect callback already handled it
    connState = 'connected'; connHint = false; stopRetry();
    log('conn', 'Link up. An armed touch or wet notifies. Not armed stays quiet.');
    onConnected();
    return lastState;
  }
  /** v23 Connect button: last known clip directly, otherwise search and take the first clip found. */
  async function connectAuto() {
    if (mock.on) return connect('MOCK');
    if (useNative()) return nativeStart();
    const r = await init(); if (!r.ok) throw new Error(r.err || 'BLE unavailable');
    const d = load();
    if (d.lastId) return connect(d.lastId, d.lastName);
    setConn('searching');
    return new Promise((resolve, reject) => {
      let done = false;
      scan(hit => { if (done) return; done = true; connect(hit.deviceId, hit.name).then(resolve, reject); }, 8000)
        .catch(e => { if (!done) { done = true; setConn('idle'); reject(e); } });
      setTimeout(() => { if (!done) { done = true; connHint = true; setConn('idle'); log('conn', 'No clip found'); resolve(null); } }, 8500);
    });
  }
  // v25: calm reconnect like the vendor app. After a drop: close fully, wait 8 s, one 6 s direct connect;
  // if that fails, scan 12 s and connect only to an advertisement seen in that scan. One cycle at a time,
  // cycles start at least 12 s apart, so Android's GATT never gets the rapid connect/close storm (status 133).
  function nextDelay() { return Math.max(0, cycleAt + CFG.retryMs - Date.now()); }
  function scheduleReconnect(reset) {
    if (mock.on) return; if (reset) reconnStep = 0;
    clearTimeout(reconnTimer); reconnTimer = setTimeout(reconnectOnce, reset ? 0 : nextDelay());
  }
  function startRetry() { if (reconnTimer || mock.on) return; scheduleReconnect(true); }
  function stopRetry() { clearTimeout(reconnTimer); reconnTimer = null; reconnStep = 0; }
  function findClip(prefId, ms) {
    return new Promise(res => {
      let done = false, other = null;
      const fin = h => { if (done) return; done = true; stopScan().catch(() => {}); res(h); };
      scan(h => { if (!prefId || h.deviceId === prefId) fin(h); else other = other || h; }, ms).catch(() => fin(null));
      setTimeout(() => fin(other), ms + 200);
    });
  }
  const stillWanted = () => !deviceId && !connecting && !manualDisc && keepLink();
  async function waitAfterClose() { const w = Math.min(CFG.closeDelayMs, CFG.retryMs) - (Date.now() - lastConnEndAt); if (w > 0) await sleep(w); }
  async function reconnectOnce() {
    reconnTimer = null;
    if (deviceId || connecting || reconnBusy) return;
    if (manualDisc || !keepLink()) { stopRetry(); if (!deviceId) setConn('idle'); return; }
    const d = load(); if (!d.lastId) return;
    const B = await getBle(); if (!B) return;
    reconnBusy = true; cycleAt = Date.now();
    try {
      if (reconnStep === 0 || Date.now() - lastReconnLogAt >= 60000) {
        lastReconnLogAt = Date.now();
        log('conn', armPending ? 'Reconnecting to check the arm…' : (armAssumed || (lastState && lastState.armed)) ? 'Looking for the clip (it sleeps between checks)…' : 'Reconnecting…');
      }
      if (reconnStep === 0) {
        try { await B.disconnect(d.lastId); } catch (e) {} // make sure the old GATT is closed
        lastConnEndAt = Date.now();
        await waitAfterClose();
        if (stillWanted()) {
          try { await init(); await connect(d.lastId, d.lastName, { fromRetry: true }); } catch (e) {}
        }
      }
      reconnStep++;
      if (stillWanted()) {
        const hit = await findClip(d.lastId, Math.min(CFG.scanMs, CFG.retryMs * 4));
        if (hit && stillWanted()) {
          await waitAfterClose();
          if (stillWanted()) { try { await connect(hit.deviceId, hit.name || d.lastName, { fromRetry: true }); } catch (e2) {} }
        }
      }
    } finally { reconnBusy = false; }
    if (!deviceId && !connecting && !manualDisc && keepLink()) {
      connState = armPending && Date.now() - armAt < 2 * CFG.armDropWindowMs ? 'rearming' : 'lost';
      renderLab(); scheduleReconnect(false);
    }
  }
  function onBattery(pct) {
    if (pct == null) return;
    battery = pct; lastSeenAt = Date.now();
    if (pct !== lastBatLogged) { log('bat', pct + '%'); lastBatLogged = pct; }
    checkBatteryLow(pct); renderLab();
  }
  // Battery: notifications when the clip sends them, plus one read every 10 min at most.
  function startBatteryTimer() {
    clearInterval(batTimer);
    batTimer = setInterval(async () => {
      // No reads while arming or once armed: the armed clip sleeps between checks; DC01 notify wakes us.
      if (!deviceId || mock.on || armPending || (lastState && lastState.armed)) return;
      try { const B = await getBle(); const b = await B.read(deviceId, C.BAT_SVC, C.BAT); onBattery(dvBytes(b)[0]); } catch (e) {}
    }, CFG.batEveryMs);
  }
  function dvBytes(v) {
    if (!v) return new Uint8Array(0);
    if (v instanceof DataView) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    if (v.buffer) return new Uint8Array(v.buffer, v.byteOffset || 0, v.byteLength || v.length);
    return new Uint8Array(v);
  }
  function onState(bytes) {
    const prev = lastState; const cur = parseState(bytes);
    // v24: like the vendor app, ignore a WET bit while an arm is pending (old event still latched)
    if (armPending && cur.wet) { cur.wet = false; cur.staleWet = true; }
    lastState = cur; lastStateAt = Date.now();
    if (armAssumed && !cur.arming) {
      armAssumed = false;
      if (!cur.armed && !cur.wet) log('arm', 'The clip reads not armed. Tap Arm again when ready.');
    }
    lastSeenAt = Date.now(); lastRaw = { hex: cur.raw || '(empty)', t: lastSeenAt };
    // v24: only log a reading when it changes (or once a minute) — the clip repeats itself every few seconds
    if (cur.raw !== lastStateLog.raw || lastSeenAt - lastStateLog.t >= 60000) {
      lastStateLog = { raw: cur.raw, t: lastSeenAt };
      log('state', cur.raw + ' · ' + flagsTxt(cur), { wet: cur.wet, armed: cur.armed, secs: cur.secs });
    }
    // v27: on a re-arm from armed, the first reading is still the old 'armed' one; wait 3 s (like the native watch)
    if (armPending && cur.armed && !cur.arming && !cur.staleWet && !(armFromArmed && Date.now() - armAt < 3000)) {
      armPending = false; clearTimeout(armTimer); clearTimeout(assumeTimer);
      log('arm', 'Clip armed. A touch or wet notifies.');
    }
    const d0 = load();
    const nightOn = !!(d0.night && d0.wearingTonight);
    const dayWatch = !!(d0.daytimeWatch && !nightOn);
    const dec = decideWet(cur, Date.now(), { armPending: armPending, ignoreUntil: ignoreUntil, lastWetAt: d0.lastWetAt });
    if (!cur.wet && latchCleared) { latchCleared = false; log('arm', 'Plate reads dry. Arm when you are ready.'); }
    if (dec === 'not_armed' && cur.wet && !(prev && prev.wet)) log('wet', 'Wet reading while not armed — no notification.');
    else if ((dec === 'arming' || dec === 'ignore_window') && cur.wet && !(prev && prev.wet)) {
      noteSettleIgnored('Wet during the arm disconnect (a few seconds). An armed wet after that notifies.');
    } else if (dec === 'new') {
      const at = wetAtFromSecs(Date.now(), cur.secs);
      d0.lastWetAt = at; save(d0);
      log('wet', 'Wet detected' + (cur.secs != null ? ' · secs=' + cur.secs : ''));
      try { if (typeof toast === 'function') toast('💧 DryClip wet'); } catch (e) {}
      if (nightOn) handleNightWet(cur);
      else if (dayWatch) handleDaytimeUnnoticed(cur);
      else offerAccident(cur);
    }
    renderLab();
  }
  function flagsTxt(s) { return [s.wet ? 'WET' : 'dry', s.armed ? 'ARMED' : 'unarmed', s.arming ? 'ARMING' : '', s.charging ? 'CHG' : ''].filter(Boolean).join(' · '); }

  /** v27: Arm button. Armed → re-arm (fresh warmth baseline); wet → WET_ACK then ARM; else plain arm. */
  function armMode() {
    if (useNative()) { const s = nst || {}; return s.wet ? 'wet' : ((s.armed && !s.armPending) || s.armedAssumed) ? 'armed' : 'arm'; }
    const st = lastState; return st && st.wet ? 'wet' : ((st && st.armed) || armAssumed) ? 'armed' : 'arm';
  }
  async function arm() {
    if (!useNative() && !mock.on && armBusy()) throw new Error('Arming in progress — give the clip a few seconds');
    const mode = armMode();
    latchCleared = false; // user arm is the way out of a touch latch
    log('arm', mode === 'armed' ? 'Re-arm (recalibrate)…' : mode === 'wet' ? 'Re-arm (ack wet first)…' : 'Arm…');
    const d = load(); if (mode !== 'armed' || !d.wearStartedAt) d.wearStartedAt = Date.now(); d.batLowNotified = false; save(d); // re-arm while armed: same wear
    if (mock.on) { mockSetFlags(0x10); setTimeout(() => mockSetFlags(0x02), 1200); return; }
    if (mode === 'wet') { try { await ack(); } catch (e) { log('err', 'ack before arm: ' + e.message); } }
    if (useNative()) {
      if (!(nst && nst.running)) await nativeStart();
      await nativePlugin().arm();
      log('arm', 'Arm sent. The link drops for a few seconds, which is normal. After that, a touch or wet notifies.');
      setTimeout(nativeRefresh, 500); return;
    }
    const B = await getBle(); if (!B || !deviceId) throw new Error('Not connected');
    if (armBusy()) throw new Error('Arming in progress — give the clip a few seconds');
    // Vendor: single 0x01 to DC02, write WITHOUT response, nothing before or after it.
    armFromArmed = mode === 'armed';
    armPending = true; armAt = Date.now(); ignoreUntil = armAt + POST_ARM_SUPPRESS_MS;
    armAssumed = false;
    clearTimeout(armTimer); armTimer = setTimeout(armCheck, CFG.armConfirmMs);
    clearTimeout(assumeTimer); assumeTimer = setTimeout(armAssume, CFG.armAssumeMs);
    renderLab();
    try { await B.writeWithoutResponse(deviceId, SVC, C.ARM, numbersToDataView([0x01])); }
    catch (e) { armPending = false; clearTimeout(armTimer); clearTimeout(assumeTimer); throw e; }
    log('arm', 'Arm sent. Arming takes 10–15 s; the clip may drop the link and come back.');
  }
  // v25: vendor fallback. 12 s after the arm write, if the clip hasn't confirmed (usually because it went to sleep
  // and dropped the link), treat it as armed. We keep looking for it every 12 s so a wet reading still arrives.
  function armAssume() {
    if (!armPending) return;
    const st = lastState;
    if (deviceId && st && lastStateAt > armAt && !st.armed && !st.arming) return; // connected and clearly not armed: armCheck decides
    armPending = false; armAssumed = true; clearTimeout(armTimer);
    log('arm', 'Armed (assumed). A touch or wet notifies. The app keeps looking for the clip every 12 s.');
    if (!deviceId && !manualDisc) { if (connState === 'rearming') connState = 'lost'; startRetry(); }
    renderLab();
  }
  function armCheck() {
    if (!armPending) return;
    const st = lastState;
    if (deviceId && st && !st.arming && !st.armed) {
      armPending = false; log('warn', "Arm didn't take. The clip still reads not armed. Tap Arm again.");
      try { if (typeof toast === 'function') toast("Arm didn't take. Tap Arm again."); } catch (e) {}
      renderLab(); return;
    }
    armTimer = setTimeout(armCheck, 10000); // still arming or not reconnected yet: keep waiting
  }
  function wearMinutes(at) {
    const d = load(); if (!d.wearStartedAt) return null;
    return Math.max(0, Math.round(((at || Date.now()) - d.wearStartedAt) / 60000));
  }
  function checkBatteryLow(pct) {
    if (pct == null || !isFinite(+pct)) return;
    const d = load(); const thr = d.batLowPct != null ? +d.batLowPct : 20;
    if (+pct > thr) { if (d.batLowNotified) { d.batLowNotified = false; save(d); } return; }
    if (d.batLowNotified) return;
    d.batLowNotified = true; save(d);
    log('bat', 'Battery low · ' + pct + '%');
    try { if (typeof toast === 'function') toast('🔋 Clip battery low · ' + pct + '% — charge soon'); } catch (e) {}
    try {
      const BA = W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.BladderAlarm;
      if (BA && BA.schedule) {
        BA.schedule({ id: 1961, at: Date.now() + 1500, title: 'DryClip', body: 'Clip battery at ' + pct + '%. Charge soon to keep watching.', kind: 'reminder' });
      }
    } catch (e) {}
  }
  async function ack() {
    if (armBusy()) { log('ack', 'Ack skipped while arming'); return; }
    log('ack', 'Ack wet…');
    if (mock.on) { return; }
    if (useNative()) { await nativePlugin().ackWet(); setTimeout(nativeRefresh, 500); return; }
    const B = await getBle(); if (!B || !deviceId) throw new Error('Not connected');
    await B.write(deviceId, SVC, C.ACK, numbersToDataView([0x01]));
  }
  function mommyCheckOn(d) { d = d || load(); return d.mommyCheck !== false; }
  function mommySpread(d) {
    d = d || load();
    const n = +d.mommySpreadMin;
    return isFinite(n) ? Math.max(2, Math.min(20, n)) : 8;
  }
  /** Pure: when to ask for a dry-padding check, before the nominal re-arm. rng returns 0..1. */
  function planMommyCheck(now, baseMin, spreadMin, rng) {
    rng = rng || Math.random;
    const base = Math.max(1, +baseMin || 20);
    const spread = Math.max(2, Math.min(20, +spreadMin || 8));
    const armAt = now + base * 60000;
    const earliest = now + Math.max(60000, (base - spread) * 60000);
    const latest = Math.max(earliest, armAt - 60000);
    const span = Math.max(0, latest - earliest);
    const checkAt = earliest + Math.floor((rng() || 0) * (span + 1));
    return { checkAt: Math.min(checkAt, latest), armAt, baseMin: base, spreadMin: spread };
  }
  function mommyCheckCopy(caregiver) {
    if (caregiver) return {
      title: 'Mommy check',
      body: 'Aim the clip at padding that still feels dry — not a warm or wet spot — then tap ready. It arms after that, not before.'
    };
    return {
      title: 'Padding check',
      body: 'Aim the clip at a dry spot on the padding (skip warm or wet areas), then arm.'
    };
  }
  function caregiverVoice() {
    try { return !!(W.BSPathPlay && W.BSPathPlay.caregiverOn && W.BSPathPlay.caregiverOn()); } catch (e) { return false; }
  }
  function pushMommyConfig(min) {
    const d = load();
    if (!useNative()) return;
    try {
      nativePlugin().setConfig({ rearmMin: min, mommyCheck: mommyCheckOn(d), mommySpreadMin: mommySpread(d) });
    } catch (e) {}
  }
  function openMommyCheck() {
    if (typeof document === 'undefined' || !document.body || !document.createElement) return { shown: false };
    try { if (document.querySelector && document.querySelector('.dc-mommy')) return { shown: true, dupe: true }; } catch (e) {}
    const care = caregiverVoice();
    const copy = mommyCheckCopy(care);
    const w = document.createElement('div');
    w.className = 'cal-sheet-wrap dc-mommy';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">
      <h3>${care ? '🤗 ' : ''}${esc(copy.title)}</h3>
      <p class="section-desc">${esc(copy.body)}</p>
      <div class="cal-legend">The clip stays unarmed until you say the spot is dry. ⏸ I'm going now still wins if you need the bathroom.</div>
      <div class="actions">
        <button type="button" class="ok" data-arm>Dry spot ready — arm</button>
        <button type="button" data-later>Not yet</button>
        <button type="button" data-x>Close</button>
      </div>
    </div>`;
    document.body.appendChild(w);
    const close = () => { try { w.remove(); } catch (e) {} };
    const laterBtn = w.querySelector('[data-later]');
    const armBtn = w.querySelector('[data-arm]');
    const xBtn = w.querySelector('[data-x]');
    if (xBtn) xBtn.onclick = close;
    if (laterBtn) laterBtn.onclick = () => { close(); postponeMommyCheck(); };
    if (armBtn) armBtn.onclick = () => { close(); confirmMommyArm(); };
    return { shown: true, caregiver: care };
  }
  function postponeMommyCheck() {
    const d = load();
    const spread = mommySpread(d);
    const mins = 2 + Math.floor(Math.random() * Math.max(1, spread - 1));
    const plan = planMommyCheck(Date.now(), mins + 1, spread, Math.random);
    plan.postponed = true;
    d.mommyPlan = plan; save(d);
    log('rearm', 'Padding check again around ' + fmtHM(plan.checkAt));
    clearTimeout(rearmTimer);
    if (useNative()) {
      try { nativePlugin().postponeMommy({ minutes: mins }); } catch (e) {}
      return;
    }
    rearmTimer = setTimeout(() => { try { openMommyCheck(); } catch (e) {} }, Math.max(500, plan.checkAt - Date.now()));
  }
  function confirmMommyArm() {
    const d = load(); d.mommyPlan = null; save(d);
    clearTimeout(rearmTimer);
    return arm();
  }
  function scheduleRearm(min) {
    const d0 = load();
    clearTimeout(rearmTimer);
    min = (min != null && min !== '' && isFinite(+min)) ? Math.max(0, +min) : rearmMinutesFor(d0);
    const d = load(); if (!d.rearmByProt) d.rearmMin = min; save(d);
    if (useNative()) { // v26: the background watch owns ack + the re-arm clock
      pushMommyConfig(min);
      log('rearm', mommyCheckOn()
        ? 'Background watch asks for a padding check before it arms (' + min + ' min window)'
        : 'Background watch re-arms ' + min + ' min after a wet reading');
      return;
    }
    if (mommyCheckOn()) {
      const plan = planMommyCheck(Date.now(), min, mommySpread());
      const d2 = load(); d2.mommyPlan = plan; save(d2);
      log('rearm', 'Padding check around ' + fmtHM(plan.checkAt) + ' — arm only after a dry spot (' + min + ' min window)');
      rearmTimer = setTimeout(() => { try { openMommyCheck(); } catch (e) {} }, Math.max(500, plan.checkAt - Date.now()));
      return;
    }
    log('rearm', 'Re-arm scheduled in ' + min + ' min');
    rearmTimer = setTimeout(async () => {
      try {
        await arm();
        const n = load();
        if (n.night && n.wearingTonight) {
          n.night.awaitingRearm = true; save(n);
          // Check shortly after arm completes whether still wet
          setTimeout(() => checkSaturatedAfterRearm(), 2000);
        }
      } catch (e) { log('err', 're-arm: ' + e.message); }
    }, min * 60000);
  }
  function checkSaturatedAfterRearm() {
    const d = load(); if (!d.night || !d.wearingTonight) return;
    const st = lastState;
    if (st && st.wet) {
      if (!d.night.saturatedAt) {
        d.night.saturatedAt = Date.now();
        save(d);
        addSaturatedMarker(d.night);
        log('sat', 'Clip still wet after re-arm — saturated marker');
      }
    }
    d.night.awaitingRearm = false; save(d);
  }
  async function disconnect() {
    clearTimeout(rearmTimer); clearInterval(mock.timer); stopRetry(); clearInterval(batTimer);
    armPending = false; clearTimeout(armTimer); clearTimeout(assumeTimer); armAssumed = false;
    manualDisc = true; // user asked: no auto-reconnect, no double "Disconnected"
    if (useNative()) { try { await nativePlugin().stop(); } catch (e) {} log('conn', 'Background watch off'); await sleep(200); await nativeRefresh(); return; }
    if (mock.on) { deviceId = null; mock.listeners.state = null; log('conn', 'Mock disconnected'); onDisconnected(); return; }
    const B = await getBle(); const id = deviceId;
    deviceId = null; onDisconnected();
    if (B && id) { try { await B.disconnect(id); } catch (e) {} }
  }

  async function testWet() {
    log('wet', 'Test wet: touch or wet the plate. Armed → a notification. Not armed → no notification. A wet takes about 30 s.');
    if (mock.on || load().mock) { mockSetFlags(mock.state[0] | 0x01); return; }
    const P = nativePlugin();
    if (P && P.testWet) { try { await P.testWet(); } catch (e) { log('wet', e.message || String(e)); } return; }
    if (lastState && !lastState.armed) log('wet', 'Test wet: clip is not armed, so a wet will not notify. Tap Arm first.');
    else log('wet', 'Test wet: armed. Touch or wet the plate. The alert posts when the reading arrives.');
  }
  function offerAccident(st, o) {
    const wetAt = o && o.wetAt ? o.wetAt : wetAtFromSecs(Date.now(), st.secs);
    try {
      let bridged = null;
      try {
        if (window.BSClipBridge && window.BSClipBridge.onClipWet) {
          bridged = window.BSClipBridge.onClipWet({ wetAt: wetAt, source: 'offer', st: st, secs: st && st.secs });
        }
      } catch (e) {}
      if (bridged && bridged.handled && bridged.actions && bridged.actions.length) {
        return;
      }
      if (typeof toast === 'function') toast('💧 Clip went wet — open the log?');
      if (window.BSAccident && typeof window.BSAccident.open === 'function') {
        setTimeout(() => window.BSAccident.open({ ctx: 'dryclip', severity: 'unknown', ts: wetAt, instruction: 'Detected by DryClip', alwaysLog: false, clip: { secs: st.secs, bat: battery, raw: st.raw } }), 200);
      }
    } catch (e) { log('err', 'offerAccident: ' + e.message); }
  }

  // ---------- Night mode ----------
  function nextWakeAt(hour, min, from) {
    from = from || Date.now();
    const d = new Date(from);
    d.setSeconds(0, 0);
    d.setHours(+hour || 0, +min || 0, 0, 0);
    if (d.getTime() <= from + 60000) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function nightId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  async function setKeepAwake(on) {
    const d = load();
    try {
      const BA = W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.BladderAlarm;
      if (BA && BA.setKeepAwake) {
        await BA.setKeepAwake({ on: !!on, screenOn: !!(d.keepAwake && on) });
        log('awake', on ? 'Keep-awake on (screen + CPU)' : 'Keep-awake off');
        return true;
      }
    } catch (e) { log('warn', 'keep-awake: ' + (e.message || e)); }
    // Browser / missing plugin: try Wake Lock API
    try {
      if (on && navigator.wakeLock && navigator.wakeLock.request) {
        W._dcWake = await navigator.wakeLock.request('screen');
        log('awake', 'Screen wake lock (browser)');
        return true;
      }
      if (!on && W._dcWake) { try { await W._dcWake.release(); } catch (e) {} W._dcWake = null; }
    } catch (e) {}
    return false;
  }

  function startHeartbeat() {
    stopHeartbeat();
    hbTimer = setInterval(() => {
      if (useNative()) return; // v26: the background watch reports gaps itself
      const d = load();
      if (!d.night || !d.wearingTonight) return;
      if (!deviceId) {
        if (armPending || Date.now() - armAt < CFG.armDropWindowMs) return; // v27: expected arm/re-arm drop, no gap marker
        if (!d.night.gapFrom) { d.night.gapFrom = Date.now(); save(d); log('gap', 'Connection lost'); }
      } else if (d.night.gapFrom) {
        closeGap(d);
      }
    }, 30000);
  }
  function stopHeartbeat() { clearInterval(hbTimer); hbTimer = null; }
  function closeGap(d) {
    d = d || load();
    if (!d.night || !d.night.gapFrom) return;
    const from = d.night.gapFrom, to = Date.now();
    d.night.gaps = (d.night.gaps || []).concat([{ from, to }]);
    d.night.gapFrom = null; save(d);
    log('gap', 'Connection restored · gap ' + fmtHM(from) + '–' + fmtHM(to));
    addGapMarker(d.night, from, to);
  }
  function addGapMarker(night, from, to) {
    // Calendar gap marker for morning check-in
    const d = { night };
    try {
      if (window.BSCalendar) {
        window.BSCalendar.addEntry({
          type: 'clip_flag', source: 'natural', mode: 'dryclip_night', ts: from,
          severity: 'unknown', confirmed: false,
          clip: { kind: 'gap', from, to, nightId: d.night.id },
          tags: ['clip-gap'], memo: 'no data ' + fmtHM(from) + '–' + fmtHM(to)
        });
      }
    } catch (e) {}
  }
  function onConnected() {
    const d = load();
    if (d.night && d.wearingTonight && d.night.gapFrom) closeGap(d);
    startHeartbeat();
    renderLab(); refreshBadge();
  }
  function onDisconnected() {
    const was = deviceId; deviceId = null; gen++; lastConnEndAt = Date.now();
    if (manualDisc) { if (connState !== 'idle') log('conn', 'Disconnected'); connState = 'idle'; renderLab(); return; }
    if (!was && connState !== 'connected' && !connecting) { renderLab(); return; } // duplicate callback
    connecting = false; clearInterval(batTimer);
    if (armPending && Date.now() - armAt < CFG.armDropWindowMs) {
      // Expected: the clip restarts its link while arming. Not an error; no gap marker.
      log('arm', 'Arming… the clip restarts its link, reconnecting');
      connState = 'rearming'; if (!reconnBusy) { stopRetry(); scheduleReconnect(true); } renderLab(); return;
    }
    if (armAssumed || (lastState && lastState.armed)) log('conn', 'Link dropped. The clip sleeps between checks; looking for it every 12 s');
    else log('conn', 'Connection lost');
    if (keepLink()) { connState = 'lost'; if (!reconnBusy) { stopRetry(); scheduleReconnect(true); } } else connState = 'idle';
    const d = load();
    if (d.night && d.wearingTonight && !d.night.gapFrom) {
      d.night.gapFrom = Date.now(); save(d); log('gap', 'Connection lost');
    }
    renderLab();
  }

  /** Dedupe: same wet event if secs-since-wet is close to a prior flag's expected age. */
  function isDupe(st, night, wetAt) {
    if (wetAt == null) { if (st.secs == null) return false; wetAt = Date.now() - st.secs * 1000; }
    try {
      const flags = (window.BSCalendar && window.BSCalendar.load().entries || [])
        .filter(e => e.type === 'clip_flag' && e.clip && e.clip.nightId === night.id && e.clip.kind !== 'gap');
      return flags.some(e => Math.abs(e.ts - wetAt) < 90000); // within 90s of same wet time
    } catch (e) { return false; }
  }

  function handleNightWet(st, o) {
    o = o || {};
    const d = load(); if (!d.night || (!d.wearingTonight && !o.native)) return false;
    // Silent: no toast, no accident sheet, no notification. v26: the native watch acks + re-arms by itself.
    if (!o.native) { try { ack(); } catch (e) {} }
    const wetAt = o.wetAt || wetAtFromSecs(Date.now(), st.secs);
    if (isDupe(st, d.night, wetAt)) {
      log('dedupe', 'Same wet event (secs=' + st.secs + ') — skipped');
      if (!o.native) scheduleRearm(rearmMinutesFor(d));
      return false;
    }
    d.night.eventIdx = (d.night.eventIdx || 0) + 1;
    d.night.lastSecs = st.secs;
    const idx = d.night.eventIdx;
    save(d);
    try {
      if (window.BSCalendar) {
        const wearMin = wearMinutes(wetAt);
        window.BSCalendar.addEntry({
          type: 'clip_flag', source: 'natural', mode: 'dryclip_night', ts: wetAt,
          severity: 'unknown', confirmed: false,
          clip: Object.assign({ kind: 'wet', idx, secs: st.secs, bat: battery, nightId: d.night.id }, wearMin != null ? { wearMin } : {}),
          tags: ['needs-review', 'clip-flagged']
        });
      }
    } catch (e) { log('err', 'flag write: ' + (e.message || e)); }
    log('flag', 'Silent flag #' + idx + ' @ ' + fmtHM(wetAt));
    refreshBadge();
    try {
      if (window.BSClipBridge && window.BSClipBridge.onClipWet) {
        window.BSClipBridge.onClipWet({ wetAt: wetAt, source: 'night', st: st, secs: st && st.secs });
      }
    } catch (e) {}
    if (!o.native) scheduleRearm(rearmMinutesFor(d));
    return true;
  }

  function addSaturatedMarker(night) {
    const at = night.saturatedAt || Date.now();
    try {
      if (window.BSCalendar) {
        window.BSCalendar.addEntry({
          type: 'clip_flag', source: 'natural', mode: 'dryclip_night', ts: at,
          severity: 'unknown', confirmed: false,
          clip: { kind: 'saturated', saturated: true, nightId: night.id, bat: battery },
          tags: ['needs-review'], memo: 'clip saturated after ' + fmtHM(at)
        });
      }
    } catch (e) {}
    refreshBadge();
  }

  async function startNight(opts) {
    opts = opts || {};
    const d = load();
    const hour = opts.wakeHour != null ? +opts.wakeHour : (d.wakeHour != null ? d.wakeHour : 7);
    const min = opts.wakeMin != null ? +opts.wakeMin : (d.wakeMin != null ? d.wakeMin : 0);
    d.wakeHour = hour; d.wakeMin = min;
    d.wearingTonight = true;
    d.keepAwake = opts.keepAwake != null ? !!opts.keepAwake : (d.keepAwake !== false);
    const wakeAt = opts.wakeAt || nextWakeAt(hour, min);
    d.night = {
      id: nightId(), startedAt: Date.now(), wakeAt,
      eventIdx: 0, lastSecs: null, gapFrom: null, gaps: [], saturatedAt: null,
      awaitingRearm: false, pendingCheckIn: false
    };
    save(d);
    log('night', 'Wearing DryClip tonight · wake ' + fmtHM(wakeAt));
    if (useNative()) {
      log('night', 'Background watch listens with the screen off. Keep-awake not needed.');
      if (!(nst && nst.running) && d.lastId) { try { await nativeStart(); } catch (e) { log('warn', 'background watch: ' + (e.message || e)); } }
    } else {
      if (!deviceId && d.lastId) startRetry();
      await setKeepAwake(!!d.keepAwake);
    }
    startHeartbeat();
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    // Direct schedule as belt-and-suspenders
    try {
      const BA = W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.BladderAlarm;
      const n = pendingAlarm();
      if (BA && n) await BA.schedule({ id: n.id, at: n.at, title: n.title, body: n.body, kind: n.kind });
    } catch (e) { log('warn', 'morning schedule: ' + (e.message || e)); }
    renderLab(); refreshBadge();
    return d.night;
  }

  async function stopNight(opts) {
    opts = opts || {};
    const d = load();
    if (d.night && d.night.gapFrom) closeGap(d);
    const had = d.night;
    d.wearingTonight = false;
    if (had) {
      const flags = unconfirmedForNight(had.id);
      if (flags.length && !opts.skipCheckIn) {
        d.night = Object.assign({}, had, { pendingCheckIn: true, endedAt: Date.now() });
      } else {
        d.night = null;
      }
    }
    save(d);
    clearTimeout(rearmTimer); stopHeartbeat();
    await setKeepAwake(false);
    try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    log('night', 'Night mode off');
    renderLab(); refreshBadge();
    if (had && (opts.openCheckIn || (d.night && d.night.pendingCheckIn))) openMorningCheckIn();
    return had;
  }

  function unconfirmedForNight(nid) {
    try {
      return (window.BSCalendar && window.BSCalendar.load().entries || [])
        .filter(e => e.type === 'clip_flag' && !e.confirmed && !e.dismissed && e.clip && e.clip.nightId === nid && e.clip.kind !== 'gap');
    } catch (e) { return []; }
  }
  function allUnconfirmed() {
    try { return window.BSCalendar ? window.BSCalendar.unconfirmedClipFlags() : []; } catch (e) { return []; }
  }

  function pendingAlarm(now) {
    now = now || Date.now();
    const d = load();
    if (!d.night || !d.wearingTonight) return null;
    const at = d.night.wakeAt;
    if (!at || at < now - 60000) return null; // already past (check-in handled on resume)
    const n = allUnconfirmed().length; // may be 0 still overnight — body updates on sync
    const body = n > 0
      ? ('Morning check-in: DryClip flagged ' + n + ' event' + (n === 1 ? '' : 's') + ' overnight')
      : 'Morning check-in: review DryClip overnight flags';
    return { id: ALARM_ID, at: Math.floor(at), kind: 'reminder', title: 'DryClip', body };
  }

  /** Call on app resume / wake — open check-in if past wake with pending flags. */
  function maybeMorning(o) {
    if (useNative() && !(o && o.drained)) { drainNative().then(() => { try { maybeMorning({ drained: true }); } catch (e) {} }); return false; }
    const d = load();
    if (!d.night) return false;
    const now = Date.now();
    const pastWake = d.night.wakeAt && now >= d.night.wakeAt;
    const pending = d.night.pendingCheckIn || pastWake;
    if (!pending) return false;
    if (d.wearingTonight && pastWake) {
      // End wearing but keep night record for check-in
      d.wearingTonight = false;
      d.night.pendingCheckIn = true;
      d.night.endedAt = now;
      if (d.night.gapFrom) { /* leave open until close */ }
      save(d);
      setKeepAwake(false);
      stopHeartbeat();
    }
    const flags = allUnconfirmed();
    const gaps = (d.night.gaps || []).length;
    if (!flags.length && !gaps && !(d.night.gaps && d.night.gapFrom)) {
      // Nothing to review — clear
      if (!d.wearingTonight) { d.night = null; save(d); }
      return false;
    }
    openMorningCheckIn();
    return true;
  }

  function openMorningCheckIn() {
    const d = load();
    const flags = allUnconfirmed().sort((a, b) => a.ts - b.ts);
    const gaps = [];
    if (d.night) {
      (d.night.gaps || []).forEach(g => gaps.push(g));
      if (d.night.gapFrom) gaps.push({ from: d.night.gapFrom, to: Date.now(), open: true });
    }
    try {
      const nid = d.night && d.night.id;
      (window.BSCalendar.load().entries || []).filter(e => e.type === 'clip_flag' && e.clip && e.clip.kind === 'gap' && (!nid || e.clip.nightId === nid))
        .forEach(e => { if (!gaps.some(g => g.from === e.clip.from)) gaps.push({ from: e.clip.from, to: e.clip.to }); });
    } catch (e) {}
    const satMark = d.night && d.night.saturatedAt;
    const n = flags.length;
    const priorTotal = (d.night && d.night.totalSat != null) ? d.night.totalSat : '';
    // v31 a3: wet-time summary line (times already on each flag row; this is the headline)
    const wetTimes = flags.map(e => fmtHM(e.ts)).filter(Boolean);
    const cloudyOn = !!(d.cloudyNight || (d.night && d.night.cloudy));
    let html = `<h3>☀️ Morning check-in</h3>
      <p class="section-desc">${n ? ('DryClip flagged <b>' + n + '</b> event' + (n === 1 ? '' : 's') + ' overnight.') : 'No wet events flagged.'}
      Set one total saturation for the night, then confirm or dismiss each flag. Per-event saturation stays blank unless you filled it in at a wake.</p>`;
    if (wetTimes.length) html += `<div class="urge-note" style="margin:6px 0;"><b>Wet around:</b> ${wetTimes.map(esc).join(', ')}</div>`;
    if (cloudyOn) html += `<div class="urge-note" style="border-left:3px solid #74b9ff;padding-left:8px;margin:6px 0;">Cloudy night was on — saturation may have built while the clip was quiet.</div>`;
    html += `<div class="muted" style="font-size:12px;margin:6px 0 10px;">Tip: change before you re-arm for a fresh start — optional, never required.</div>`;
    if (n || gaps.length || satMark) {
      html += `<label class="fld"><span>Total saturation for the night</span>
        <input type="number" id="dcNightSat" min="0" max="100" value="${priorTotal}" placeholder="e.g. 60" style="width:72px"> %</label>`;
    }
    if (gaps.length) {
      html += `<div class="cal-legend">Connection gaps</div><ul style="margin:4px 0 10px 18px;font-size:13px;">` +
        gaps.map(g => `<li>no data ${fmtHM(g.from)}–${fmtHM(g.to || Date.now())}${g.open ? ' (still open)' : ''}</li>`).join('') + `</ul>`;
    }
    if (satMark) html += `<div class="camp-goal" style="border-color:#fdcb6e;">Clip stayed wet after re-arm · saturated after ${fmtHM(satMark)}</div>`;
    if (!flags.length && !gaps.length && !satMark) {
      html += `<p class="muted">Nothing to review.</p><div class="actions"><button type="button" data-x>Close</button></div>`;
    } else {
      html += flags.map(e => {
        const c = e.clip || {};
        const wakeBit = c.wakeReviewed ? ` · wake: ${e.saturation != null ? e.saturation + '%' : '—'}${c.pantsWet != null ? (c.pantsWet ? ' · pants wet' : ' · pants dry') : ''}` : '';
        return `<div class="camp-goal clip-flag-row" data-id="${esc(e.id)}" style="border-style:dotted;border-color:#74b9ff;">
          <b>${fmtHM(e.ts)}</b> · event #${c.idx != null ? c.idx : '?'}${c.bat != null ? ' · ' + c.bat + '% bat' : ''}${c.wearMin != null ? ' · wear ' + c.wearMin + ' min' : ''}${wakeBit}
          ${c.kind === 'saturated' ? ' · <i>saturated</i>' : ''}
          <label class="fld" style="margin-top:6px;"><span>Severity</span>
            <select data-sev>
              <option value="unknown">Unknown</option>
              <option value="damp">Damp</option>
              <option value="wet" selected>Wet</option>
              <option value="soaked">Soaked</option>
            </select>
          </label>
          <div class="quiz-nav" style="margin-top:6px;">
            <button type="button" data-confirm>Confirm</button>
            <button type="button" data-dismiss>Dismiss</button>
          </div>
        </div>`;
      }).join('');
      html += `<div class="actions" style="margin-top:10px;">
        <button type="button" data-cal>Open Calendar</button>
        <button type="button" data-done>Done</button>
      </div>`;
    }
    document.querySelectorAll('.cal-sheet-wrap.dc-morning').forEach(n => n.remove());
    const w = document.createElement('div');
    w.className = 'cal-sheet-wrap dc-morning';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">${html}</div>`;
    w.addEventListener('click', ev => { if (ev.target === w) finishCheckIn(w); });
    document.body.appendChild(w);
    function readNightSat() {
      const el = w.querySelector('#dcNightSat'); if (!el || el.value === '') return null;
      const v = +el.value; return isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
    }
    function persistNightSat() {
      const sat = readNightSat(); if (sat == null) return;
      const dd = load();
      if (dd.night) { dd.night.totalSat = sat; save(dd); }
      try { if (dd.night && window.BSCalendar) window.BSCalendar.setClipNightTotalSat(dd.night.id, sat); } catch (e) {}
    }
    w.querySelectorAll('[data-confirm]').forEach(btn => {
      btn.onclick = () => {
        persistNightSat();
        const row = btn.closest('[data-id]'); if (!row) return;
        const id = row.getAttribute('data-id');
        const sev = (row.querySelector('[data-sev]') || {}).value || 'wet';
        // Keep any wake-check-in saturation already on the flag; do not invent one
        let patch = { severity: sev };
        try {
          const cur = window.BSCalendar.load().entries.find(x => x.id === id);
          if (cur && cur.saturation != null) patch.saturation = cur.saturation;
        } catch (e) {}
        try { window.BSCalendar.confirmClipFlag(id, patch); } catch (e) {}
        try {
          if (window.BSHub && window.BSHub.pathClipBridgeOn && window.BSHub.pathClipBridgeOn()) {
            const P = window.BSPath; const b = P && P.load && P.load();
            if (b && P.logMastery) { const r = P.logMastery(b, 'wet', Date.now()); if (r && r.ok) P.save(b); }
          }
        } catch (e) {}
        row.remove();
        refreshBadge();
        if (!w.querySelector('[data-id]')) finishCheckIn(w);
      };
    });
    w.querySelectorAll('[data-dismiss]').forEach(btn => {
      btn.onclick = () => {
        persistNightSat();
        const row = btn.closest('[data-id]'); if (!row) return;
        try { window.BSCalendar.dismissClipFlag(row.getAttribute('data-id')); } catch (e) {}
        row.remove();
        refreshBadge();
        if (!w.querySelector('[data-id]')) finishCheckIn(w);
      };
    });
    function maybePathBridge(confirmedWet) {
      try {
        if (!(window.BSHub && window.BSHub.pathClipBridgeOn && window.BSHub.pathClipBridgeOn())) return;
        const P = window.BSPath; if (!P || !P.load || !P.logMastery) return;
        const b = P.load(); if (!b) return;
        const kind = confirmedWet ? 'wet' : 'dry';
        const r = P.logMastery(b, kind, Date.now());
        if (r && r.ok) { P.save(b); /* quiet — no toast */ }
      } catch (e) {}
    }
    const done = () => {
      persistNightSat();
      // v31 a5: if any flags were confirmed this session, feed Bed Mastery when bridge on
      const left = w.querySelectorAll('[data-id]').length;
      const started = n;
      const confirmedWet = started > 0 && left < started; // at least one row removed via confirm path is ambiguous; use night sat
      const sat = readNightSat();
      const wetish = (sat != null && sat > 0) || (flags.length > 0 && left < started);
      if (window.BSHub && window.BSHub.pathClipBridgeOn && window.BSHub.pathClipBridgeOn()) maybePathBridge(!!wetish);
      finishCheckIn(w);
    };
    const dx = w.querySelector('[data-x]'); if (dx) dx.onclick = done;
    const dd = w.querySelector('[data-done]'); if (dd) dd.onclick = done;
    const cal = w.querySelector('[data-cal]'); if (cal) cal.onclick = () => { done(); try { if (window.switchTab) window.switchTab('calendar'); } catch (e) {} };
    try { if (typeof toast === 'function' && flags.length) toast('Morning check-in: ' + flags.length + ' flagged'); } catch (e) {}
  }

  /** Short wake check-in: saturation, pants wet?, severity → attach to recent unreviewed flags. */
  function openWakeCheckIn(opts) {
    opts = opts || {};
    const flags = allUnconfirmed().filter(e => !e.clip || e.clip.kind === 'wet' || !e.clip.kind).sort((a, b) => b.ts - a.ts);
    if (!flags.length) return false;
    document.querySelectorAll('.cal-sheet-wrap.dc-wake').forEach(n => n.remove());
    const recent = flags[0];
    const c = recent.clip || {};
    const html = `<h3>👀 Wake check-in</h3>
      <p class="section-desc">Clip flagged an event at <b>${fmtHM(recent.ts)}</b>${c.idx != null ? ' (#' + c.idx + ')' : ''}. Quick notes while you\'re up — this attaches to that flag. Morning still asks for a total saturation for the night.</p>
      <label class="fld"><span>Saturation now</span><input type="number" id="dcWakeSat" min="0" max="100" value="40" style="width:72px"> %</label>
      <label class="fld"><span>Are your pants wet?</span>
        <select id="dcWakePants"><option value="1">Yes</option><option value="0">No</option><option value="">Not sure</option></select>
      </label>
      <label class="fld"><span>Severity</span>
        <select id="dcWakeSev"><option value="damp">Damp</option><option value="wet" selected>Wet</option><option value="soaked">Soaked</option><option value="unknown">Unknown</option></select>
      </label>
      <div class="actions"><button type="button" data-save>Save</button><button type="button" data-skip>Skip</button></div>`;
    const w = document.createElement('div');
    w.className = 'cal-sheet-wrap dc-wake';
    w.innerHTML = `<div class="cal-sheet" role="dialog" aria-modal="true">${html}</div>`;
    w.addEventListener('click', ev => { if (ev.target === w) w.remove(); });
    document.body.appendChild(w);
    w.querySelector('[data-skip]').onclick = () => w.remove();
    w.querySelector('[data-save]').onclick = () => {
      const sat = +w.querySelector('#dcWakeSat').value;
      const pants = w.querySelector('#dcWakePants').value;
      const sev = w.querySelector('#dcWakeSev').value || 'wet';
      try {
        window.BSCalendar.attachWakeToFlags({
          severity: sev,
          saturation: isFinite(sat) ? sat : undefined,
          pantsWet: pants === '' ? null : pants === '1',
          count: 1
        });
      } catch (e) {}
      refreshBadge();
      w.remove();
      try { if (typeof toast === 'function') toast('Wake notes saved on the clip flag'); } catch (e) {}
    };
    return true;
  }

  function handleDaytimeUnnoticed(st, o) {
    o = o || {};
    // Silent daytime flag (same shape, mode dryclip_day)
    if (!o.native) { try { ack(); } catch (e) {} }
    const wetAt = o.wetAt || wetAtFromSecs(Date.now(), st.secs);
    const d = load();
    d._dayIdx = (d._dayIdx || 0) + 1; save(d);
    const wearMin = wearMinutes(wetAt);
    try {
      if (window.BSCalendar) {
        window.BSCalendar.addEntry({
          type: 'clip_flag', source: 'natural', mode: 'dryclip_day', ts: wetAt,
          severity: 'unknown', confirmed: false,
          clip: Object.assign({ kind: 'wet', idx: d._dayIdx, secs: st.secs, bat: battery, nightId: 'day-' + new Date(wetAt).toISOString().slice(0, 10) },
            wearMin != null ? { wearMin } : {}),
          tags: ['needs-review', 'clip-flagged', 'daytime']
        });
      }
    } catch (e) { log('err', 'day flag: ' + (e.message || e)); }
    log('flag', 'Daytime unnoticed flag @ ' + fmtHM(wetAt));
    refreshBadge();
    try {
      if (window.BSClipBridge && window.BSClipBridge.onClipWet) {
        window.BSClipBridge.onClipWet({ wetAt: wetAt, source: 'day', st: st, secs: st && st.secs });
      }
    } catch (e) {}
    if (!o.native) scheduleRearm(rearmMinutesFor(d));
  }

  function finishCheckIn(w) {
    if (w && w.remove) w.remove();
    const d = load();
    if (d.night && !d.wearingTonight) { d.night = null; save(d); }
    else if (d.night) { d.night.pendingCheckIn = false; save(d); }
    refreshBadge();
    try { if (window.BSCalendar && window.renderCalendarInline) window.renderCalendarInline(); } catch (e) {}
  }

  /** Mock: plant 2 events + a gap overnight, then open morning check-in. */
  async function simulateNight() {
    mockEnable(true);
    if (!deviceId) await connect('MOCK');
    const d = load();
    // Build a "last night" ending at wake (default 7:00) with events at 2:04 and 4:40 and gap 3:10–4:00
    const wake = new Date(); wake.setHours(d.wakeHour != null ? d.wakeHour : 7, d.wakeMin != null ? d.wakeMin : 0, 0, 0);
    if (wake.getTime() > Date.now()) wake.setDate(wake.getDate() - 0); // wake today; events earlier this morning / last night
    // If it's afternoon, use last night's timeline relative to today's wake
    let wakeAt = wake.getTime();
    if (Date.now() < wakeAt) wakeAt -= 86400000; // if before wake today, use yesterday's wake as "already happened"
    const base = new Date(wakeAt);
    const at = (h, m) => { const x = new Date(base); x.setHours(h, m, 0, 0); if (x.getTime() > wakeAt) x.setDate(x.getDate() - 1); return x.getTime(); };
    const t1 = at(2, 4), t2 = at(4, 40), gFrom = at(3, 10), gTo = at(4, 0);
    d.wearingTonight = false;
    d.night = {
      id: nightId(), startedAt: at(22, 30), wakeAt: wakeAt,
      eventIdx: 2, lastSecs: 0, gapFrom: null,
      gaps: [{ from: gFrom, to: gTo }], saturatedAt: null,
      awaitingRearm: false, pendingCheckIn: true, endedAt: Date.now()
    };
    save(d);
    // Clear prior sim flags for clean test? No — just add
    try {
      window.BSCalendar.addEntry({
        type: 'clip_flag', source: 'natural', mode: 'dryclip_night', ts: t1,
        severity: 'unknown', confirmed: false,
        clip: { kind: 'wet', idx: 1, secs: 0, bat: 82, nightId: d.night.id },
        tags: ['needs-review', 'clip-flagged']
      });
      window.BSCalendar.addEntry({
        type: 'clip_flag', source: 'natural', mode: 'dryclip_night', ts: t2,
        severity: 'unknown', confirmed: false,
        clip: { kind: 'wet', idx: 2, secs: 12, bat: 79, nightId: d.night.id },
        tags: ['needs-review', 'clip-flagged']
      });
      window.BSCalendar.addEntry({
        type: 'clip_flag', source: 'natural', mode: 'dryclip_night', ts: gFrom,
        severity: 'unknown', confirmed: false,
        clip: { kind: 'gap', from: gFrom, to: gTo, nightId: d.night.id },
        tags: ['clip-gap'], memo: 'no data ' + fmtHM(gFrom) + '–' + fmtHM(gTo)
      });
    } catch (e) { log('err', 'simulate: ' + (e.message || e)); }
    log('sim', 'Simulated night: 2:04, 4:40 + gap 3:10–4:00');
    refreshBadge();
    openMorningCheckIn();
    renderLab();
    return { t1, t2, gFrom, gTo, wakeAt, nightId: d.night.id };
  }

  function refreshBadge() {
    try {
      const n = window.BSCalendar ? window.BSCalendar.unconfirmedClipCount() : 0;
      let dot = document.getElementById('calDot');
      if (!dot) {
        const btn = document.querySelector('#tabBar [data-go="calendar"]');
        if (btn) { dot = document.createElement('i'); dot.className = 'tab-dot'; dot.id = 'calDot'; btn.appendChild(dot); }
      }
      if (dot) dot.classList.toggle('on', n > 0);
      if (dot && n > 0) dot.setAttribute('data-n', String(n));
    } catch (e) {}
  }


  /** v30: count a settle/touch wet that was ignored (no calendar flag). */
  function noteSettleIgnored(msg) {
    const d = load(); d.settleIgnored = (+d.settleIgnored || 0) + 1; save(d);
    log('wet', msg || 'Wet reading ignored during settle (the plate reads a touch)', { settle: 1 });
    return d.settleIgnored;
  }
  /** Pure-ish: is the cloudy-night preset currently on? */
  function cloudyNightActive(d) {
    d = d || load();
    return !!(d.cloudyNight && d.wearingTonight && d.night && d.rearmByProt);
  }
  /** v30 one-tap: night watch + Match-protection re-arm. Wires existing settings only. */
  async function applyCloudyNight(on, opts) {
    opts = opts || {};
    const d = load();
    if (on) {
      d.cloudyNight = true;
      d.rearmByProt = true;
      save(d);
      const mins = rearmMinutesFor(d);
      pushMommyConfig(mins);
      if (!(d.wearingTonight && d.night)) await startNight(opts);
      else { save(d); renderLab(); }
      log('night', 'Cloudy night on · night watch + Match-protection re-arm (' + mins + ' min)');
      if (typeof toast === 'function') toast('Cloudy night on');
    } else {
      d.cloudyNight = false; save(d);
      if (d.wearingTonight) await stopNight({ openCheckIn: opts.openCheckIn !== false });
      else renderLab();
      log('night', 'Cloudy night off');
      if (typeof toast === 'function') toast('Cloudy night off');
    }
    return load();
  }

  /** Full export: JS event log plus the native background-watch section. */
  function buildExportText(d, nativeText) {
    d = d || load();
    nativeText = nativeText || '';
    const lineRe = /ignored.*(touch|arming)|Settling.*ignor|touch.*ignored|during arming ignored/i;
    const jsLines = (d.log || []).filter(e => lineRe.test(String(e.msg || '') + ' ' + String(e.kind || ''))).length;
    const nativeLines = nativeText ? String(nativeText).split(/\n/).filter(l => lineRe.test(l)).length : 0;
    const stored = +d.settleIgnored || 0;
    const summary = 'Settle telemetry: ' + stored + ' ignored touch wet(s) counted'
      + ' · log lines ' + jsLines + (nativeText ? ' · native lines ' + nativeLines : '');
    let text = summary + '\n\n' + (d.log || []).map(e => new Date(e.t).toISOString() + '\t' + e.kind + '\t' + e.msg + (e.wet != null ? '\twet=' + e.wet : '') + (e.settle ? '\tsettle=1' : '')).join('\n');
    if (nativeText) text += '\n\n--- background watch (native, local time) ---\n' + nativeText;
    return text;
  }
  /** Copy export text. Returns 'clipboard' | 'capacitor' | 'exec' | ''. */
  async function copyExportText(text) {
    const clip = W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.Clipboard;
    if (clip && clip.write) { try { await clip.write({ string: text }); return 'capacitor'; } catch (e) {} }
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text); return 'clipboard'; } catch (e) {}
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      if (ok) return 'exec';
    } catch (e) {}
    return '';
  }
  async function exportLog() {
    const d = load();
    let nativeText = '';
    const P = nativePlugin();
    if (P && P.getLog) { try { const r = await P.getLog(); nativeText = (r && r.text) || ''; } catch (e) {} }
    const text = buildExportText(d, nativeText);
    const how = await copyExportText(text);
    if (how && typeof toast === 'function') toast('Log copied to clipboard');
    let downloaded = false;
    try {
      const blob = new Blob([text], { type: 'text/plain' }); const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'dryclip-log.txt'; a.click();
      downloaded = true;
    } catch (e) {}
    if (!how && !downloaded) {
      const w = document.createElement('div'); w.className = 'cal-sheet-wrap';
      w.innerHTML = `<div class="cal-sheet"><h3>DryClip log</h3><textarea id="dcLogTa" style="width:100%;height:240px"></textarea><div class="actions"><button type="button" id="dcCopy">Copy</button><button type="button" id="dcX">Close</button></div></div>`;
      document.body.appendChild(w);
      const ta = w.querySelector('#dcLogTa'); if (ta) ta.value = text;
      const c = w.querySelector('#dcCopy'); if (c) c.onclick = async () => { const h2 = await copyExportText(text); if (typeof toast === 'function') toast(h2 ? 'Log copied to clipboard' : 'Could not copy'); };
      w.querySelector('#dcX').onclick = () => w.remove();
    } else if (!how && typeof toast === 'function') toast('Clipboard unavailable — saved dryclip-log.txt');
  }

  // ---------- v23 status card ----------
  const CONN_TXT = { idle: 'Not connected', searching: 'Searching…', connecting: 'Connecting…', connected: 'Connected', lost: 'Lost connection, reconnecting…', rearming: 'Arming… the clip restarts its link, reconnecting' };
  const CALM_TXT = 'Armed. The clip is asleep between checks. Looking for it every 12 s';
  const CONN_DOT = { idle: '#8a93a6', searching: '#74b9ff', connecting: '#fdcb6e', connected: '#00b894', lost: '#e17055', rearming: '#fdcb6e' };
  /** Pure: clip state label from a parsed STATE. */
  function clipLabel(st) {
    if (!st) return '—';
    if (st.wet) return 'Wet';
    if (st.arming) return 'Arming…';
    if (st.armed) return 'Dry & armed';
    if (st.charging) return 'Charging';
    return 'Not armed';
  }
  /** Pure-ish: what the status card and buttons should show right now. */
  /** v26: status card from the native background watch (getStatus / 'status' events). */
  function nativeUiState(s, now) {
    s = s || {}; now = now || Date.now();
    const run = !!s.running, conn = run && s.conn === 'connected';
    const armed = !!s.armed;
    const settling = !!(s.settling || (s.phase === 'settling') || (now < (+s.ignoreUntil || 0)));
    const touchIgnored = !!(s.wet && settling);
    const key = !run ? 'idle' : conn ? 'connected' : s.conn === 'connecting' ? 'connecting' : s.armPending ? 'rearming' : 'lost';
    const calm = run && !conn && armed && !s.armPending && !s.wet && !settling;
    const connText = !run ? 'Not connected' : conn ? (settling && !s.armPending ? 'Pairing / settling…' : 'Connected')
      : s.armPending ? CONN_TXT.rearming
      : calm ? 'Armed. The clip sleeps between checks; the background watch reconnects by itself' : 'Disconnected · looking for clip';
    let clip = '—';
    if (run || s.raw) {
      if (s.armPending) clip = 'Arming…';
      else if (settling && !s.stillWet) clip = touchIgnored ? 'Pairing / settling…' : 'Settling…';
      else if (s.latchCleared) clip = 'Touch latched — not re-arming';
      else if (s.stillWet) clip = "Still wet (can't re-arm yet)";
      else if (armed && !s.wet) clip = 'Armed, listening';
      else if (s.armedAssumed && !s.wet) clip = 'Armed, listening';
      else clip = s.raw || armed ? clipLabel({ wet: !!s.wet, armed, arming: !!s.arming, charging: !!s.charging }) : '—';
    }
    const off = run ? null : 'Tap Connect first';
    const b = {
      connect: { on: !conn, why: conn ? 'Already connected' : '' },
      disconnect: { on: run, why: run ? '' : 'Not running' },
      arm: { on: run && !s.armPending, why: off || (s.armPending ? 'Arming…' : '') },
      ack: { on: run && !!s.wet && !s.armPending, why: off || 'Only when the clip reads Wet' }
    };
    Object.keys(b).forEach(k => { if (b[k].on) b[k].why = ''; });
    armLabelInto(b);
    const d = load();
    return { conn: key, connText, dot: calm ? '#74b9ff' : (CONN_DOT[key] || '#8a93a6'), name: s.name || d.lastName || s.mac || d.lastId || '—',
      lastSeenAt: s.lastSeen || null, battery: s.battery != null ? s.battery : battery, clip,
      raw: s.raw ? { hex: s.raw, t: s.lastStateAt || s.lastSeen || now } : null,
      hint: (s.lastError && !conn ? String(s.lastError) : ''),
      buttons: b, arming: !!s.armPending, armAssumed: !!s.armedAssumed,
      native: true, bg: run, bonded: s.bonded || 'unknown', rearmAt: +s.rearmAt || 0, queued: +s.queued || 0, armedSince: +s.armedSince || 0, stillWet: !!s.stillWet,
      settling: settling, phase: s.phase || (settling ? 'settling' : (armed ? 'listening' : key)) };
  }
  function uiState() {
    if (useNative()) return nativeUiState(nst);
    const conn = connState === 'connected' && !!deviceId;
    const st = lastState;
    const off = conn ? null : 'Connect the clip first';
    const b = {
      connect: { on: connState === 'idle', why: connState === 'connected' ? 'Already connected' : (connState === 'idle' ? '' : 'Working on it…') },
      disconnect: { on: conn, why: conn ? '' : 'Not connected' },
      arm: { on: (conn && !!st || armAssumed) && !(st && st.arming) && !armBusy(), why: (armAssumed ? null : off) || (!st && !armAssumed ? 'Waiting for the clip' : 'Arming…') },
      ack: { on: conn && !!(st && st.wet) && !armBusy(), why: off || (armBusy() ? 'Arming in progress' : 'Only when the clip reads Wet') }
    };
    Object.keys(b).forEach(k => { if (b[k].on) b[k].why = ''; });
    armLabelInto(b);
    const calm = (connState === 'lost' || (reconnBusy && (connState === 'connecting' || connState === 'searching'))) && !deviceId && (armAssumed || !!(st && st.armed && !st.wet));
    return { conn: connState, connText: calm ? CALM_TXT : (CONN_TXT[connState] || connState), dot: calm ? '#74b9ff' : (CONN_DOT[connState] || '#8a93a6'),
      name: load().lastName || (deviceId || load().lastId || '—'), lastSeenAt, battery, clip: armPending && !(st && st.armed && !st.arming) ? 'Arming…' : (ignoreUntil && Date.now() < ignoreUntil) ? ((st && st.wet) ? 'Pairing / settling…' : 'Settling…') : latchCleared ? 'Touch latched — not re-arming' : armAssumed ? 'Armed, listening' : (conn || st ? (st && st.armed && !st.wet ? 'Armed, listening' : clipLabel(st)) : '—'),
      raw: lastRaw, hint: connHint ? HINT : '', buttons: b, arming: armPending, armAssumed };
  }
  const REARM_HINT = 'Takes a fresh warmth baseline. Keep your hand off the plate.';
  /** v27: Arm label/hint by mode (also when armed or wet). */
  function armLabelInto(b) {
    const m = armMode(); b.arm.mode = m;
    b.arm.label = m === 'armed' ? '🔄 Re-arm (recalibrate)' : m === 'wet' ? '🛡 Re-arm' : '🛡 Arm';
    if (b.arm.on && m === 'armed') b.arm.why = REARM_HINT;
  }
  function agoTxt(ts) {
    if (!ts) return '—'; const s = Math.round((Date.now() - ts) / 1000);
    return s < 5 ? 'just now' : s < 60 ? s + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : fmtHM(ts);
  }
  function statusCardHtml() {
    const u = uiState(), B = u.buttons;
    const btn = (id, k, label) => `<div class="dc-btn"><button type="button" id="${id}" ${B[k].on ? '' : 'disabled'}>${label}</button>${B[k].why ? `<div class="muted" style="font-size:11px;">${esc(B[k].why)}</div>` : ''}</div>`;
    return `<div class="camp-goal dc-status" id="dcStatus" style="border-color:${u.dot};">
      <div style="display:flex;align-items:center;gap:8px;font-size:16px;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${u.dot};"></span><b id="dcConnTxt">${esc(u.connText)}</b></div>
      <div style="margin-top:6px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:13px;">
        <span class="muted">Clip</span><span>${esc(u.name)}</span>
        <span class="muted">Last seen</span><span>${esc(agoTxt(u.lastSeenAt))}</span>
        <span class="muted">Battery</span><span>${u.battery == null ? '—' : u.battery + '%'}</span>
        <span class="muted">State</span><b id="dcClipTxt">${esc(u.clip)}</b>
        ${u.native ? `<span class="muted">Background</span><b id="dcBgTxt">Background watch: ${u.bg ? 'on' : 'off'}</b>
        <span class="muted">Bond</span><span>${esc(u.bonded === 'bonded' ? 'Yes' : u.bonded === 'none' ? 'None · BLE is enough' : u.bonded)}</span>
        ${u.armedSince ? `<span class="muted">Armed since</span><span>${fmtHM(u.armedSince)}</span>` : ''}
        ${u.rearmAt ? `<span class="muted">Re-arm at</span><span>${fmtHM(u.rearmAt)}</span>` : ''}` : ''}
      </div>
      ${u.clip === 'Arming…' ? '<div class="muted" style="margin-top:6px;font-size:12px;">Arming takes 10–15 s. Keep the clip near the phone.</div>' : ''}
      ${u.clip === 'Armed (assumed)' ? '<div class="muted" style="margin-top:6px;font-size:12px;">The clip went quiet after arming, like it does in the DryClip app. The app keeps looking for it, and a wet reading shows up when it checks in (about 30 s).</div>' : ''}
      ${u.clip === 'Dry & armed' ? '<div class="muted" style="margin-top:6px;font-size:12px;">Clip armed. It sleeps between checks, so quiet is normal. A wet reading can take about 30 s to arrive.</div>' : ''}
      ${u.hint ? `<div class="camp-goal" style="border-color:#fdcb6e;margin-top:8px;font-size:13px;">${esc(u.hint)}</div>` : ''}
      ${u.native && u.bg && batUnrestricted === false ? `<div class="camp-goal" style="border-color:#fdcb6e;margin-top:8px;font-size:13px;">Android may pause the watch to save battery. <button type="button" id="dcBattery">Let it run in the background</button></div>` : ''}
      ${(u.clip === 'Pairing / settling…' || u.clip === 'Settling…') ? '<div class="muted" style="margin-top:6px;font-size:12px;">The clip is finishing its arm disconnect (a few seconds). After it is armed, a touch or wet notifies.</div>' : ''}
      ${u.clip === 'Armed, listening' ? '<div class="muted" style="margin-top:6px;font-size:12px;">Clip armed and listening. It sleeps between checks; a wet reading can take about 30 s.</div>' : ''}
      <div class="quiz-nav dc-btns" style="margin-top:8px;flex-wrap:wrap;align-items:flex-start;">
        ${btn('dcConnect', 'connect', '🔗 Connect')}${btn('dcDisc', 'disconnect', u.native ? '⏹ Stop watch' : '⏏ Disconnect')}${btn('dcArm', 'arm', B.arm.label || '🛡 Arm')}${btn('dcAck', 'ack', '✓ Acknowledge wet')}
      </div>
    </div>`;
  }
  function testPanelHtml() {
    const r = lastRaw;
    return `<details class="camp-goal dc-test"><summary><b>🧪 Test the clip</b></summary>
      <ol style="margin:6px 0 6px 18px;font-size:13px;line-height:1.5;">
        <li>Turn the clip on and close the other clip app. A classic Bluetooth bond is not required — Forget bond is fine. Connect uses BLE, the same way DryPing does.</li>
        <li>The clip talks to one app at a time. If Connect cannot see it, force-stop the other app first.</li>
        <li>Tap <b>Connect</b>. Allow Nearby devices and notifications. A quiet "DryClip background watch" notification stays up while it listens.</li>
        <li>Clip it on, and keep your fingers off the plate. The plate reads warmth, so a touch counts like wet.</li>
        <li>Tap <b>Arm</b>. The link drops for a few seconds while it arms. That's normal; it comes back by itself.</li>
        <li>The first few seconds after Arm are the clip dropping its link. After it is armed, a touch or a wet notifies. If it is not armed, nothing notifies.</li>
        <li>Tap <b>Test wet</b>, then touch or wet the plate. The reading takes about 30 seconds. The log says whether it will notify.</li>
        <li>Check the Calendar for the wet time (with Night or Daytime watch on). The clip is acknowledged and re-armed after the re-arm delay.</li>
      </ol>
      <div class="quiz-nav"><button type="button" id="dcTestWet">🧪 Test wet</button></div>
      <div style="font-family:monospace;font-size:12px;">DC01 raw: <span id="dcRawLine">${r ? esc(r.hex) + ' · ' + esc(new Date(r.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })) : 'nothing received yet'}</span></div>
    </details>`;
  }

  // ---------- Lab UI ----------
  function ensureMount() {
    let m = document.getElementById('dryclipMount'); if (m) return m;
    const host = document.querySelector('#tab-settings') || document.getElementById('setData');
    if (!host) return null;
    const details = document.createElement('details'); details.className = 'set-sec'; details.id = 'setDryClip';
    details.innerHTML = `<summary>📎 DryClip <small>overnight flags · BLE · re-arm</small></summary><div id="dryclipMount"></div>`;
    // v28: higher in Settings — right after Play & content
    const play = document.getElementById('setPlay');
    if (play && play.parentNode) play.parentNode.insertBefore(details, play.nextSibling);
    else {
      const alarms = document.getElementById('setAlarms');
      if (alarms && alarms.parentNode) alarms.parentNode.insertBefore(details, alarms);
      else host.appendChild(details);
    }
    return document.getElementById('dryclipMount');
  }
  function renderLab() {
    const m = ensureMount(); if (!m) return;
    const d = load();
    const st = (useNative() && nst && nst.raw) ? { wet: !!nst.wet, armed: !!nst.armed, charging: !!nst.charging, arming: !!nst.arming, secs: nst.secs, raw: nst.raw }
      : (lastState || { wet: false, armed: false, charging: false, arming: false, secs: null, raw: '—' });
    if (useNative() && nst && nst.battery != null) battery = nst.battery;
    const conn = useNative() ? !!(nst && nst.running && nst.conn === 'connected') : !!deviceId;
    const nightOn = !!(d.wearingTonight && d.night);
    const unconf = (() => { try { return window.BSCalendar ? window.BSCalendar.unconfirmedClipCount() : 0; } catch (e) { return 0; } })();
    m.innerHTML = statusCardHtml() + testPanelHtml() + `
      <div class="cal-legend">Overnight: silent flags in the calendar (no alert at wet time). One morning ping after your wake time. ${useNative() ? 'The background watch keeps listening with the screen off and logs each wet reading at the time it happened.' : 'Keep the screen on while wearing the clip — the app pauses if the phone sleeps.'}</div>
      <label class="qp-flag"><input type="checkbox" id="dcMock" ${d.mock || mock.on ? 'checked' : ''}> Mock clip (no hardware)</label>
      <div class="camp-goal" style="border-color:${nightOn ? '#74b9ff' : '#2b3348'};">
        <label class="qp-flag"><input type="checkbox" id="dcCloudy" ${d.cloudyNight && nightOn && d.rearmByProt ? 'checked' : ''}> Cloudy night <span class="muted" style="font-weight:normal;">(night watch + Match-protection re-arm)</span></label>
        <label class="qp-flag"><input type="checkbox" id="dcNight" ${nightOn ? 'checked' : ''}> Wearing DryClip tonight</label>
        <label class="qp-flag"><input type="checkbox" id="dcDay" ${d.daytimeWatch && !nightOn ? 'checked' : ''} ${nightOn ? 'disabled' : ''}> Watch for unnoticed daytime events</label>
        <div class="quiz-nav" style="margin-top:6px; flex-wrap:wrap;">
          <label>Wake <input id="dcWakeH" type="number" min="0" max="23" value="${d.wakeHour != null ? d.wakeHour : 7}" style="width:48px">:<input id="dcWakeM" type="number" min="0" max="59" value="${d.wakeMin != null ? d.wakeMin : 0}" style="width:48px"></label>
          ${useNative() ? '' : `<label class="qp-flag"><input type="checkbox" id="dcKeep" ${d.keepAwake !== false ? 'checked' : ''}> Keep screen on</label>`}
          <label>Re-arm delay
            <select id="dcRearmMode" style="max-width:160px;">
              <option value="prot" ${d.rearmByProt ? 'selected' : ''}>Match protection</option>
              <option value="15" ${!d.rearmByProt && +d.rearmMin === 15 ? 'selected' : ''}>15 min (thin)</option>
              <option value="20" ${!d.rearmByProt && (+d.rearmMin === 20 || d.rearmMin == null) ? 'selected' : ''}>20 min</option>
              <option value="25" ${!d.rearmByProt && +d.rearmMin === 25 ? 'selected' : ''}>25 min (standard)</option>
              <option value="30" ${!d.rearmByProt && +d.rearmMin === 30 ? 'selected' : ''}>30 min</option>
              <option value="40" ${!d.rearmByProt && +d.rearmMin === 40 ? 'selected' : ''}>40 min (thick overnight)</option>
              <option value="custom" ${!d.rearmByProt && ![15,20,25,30,40].includes(+d.rearmMin) ? 'selected' : ''}>Custom…</option>
            </select>
          </label>
          <label id="dcRearmCustomWrap" style="${d.rearmByProt || [15,20,25,30,40].includes(+d.rearmMin) || d.rearmMin == null ? 'display:none' : ''}">Custom <input id="dcRearmMin" type="number" min="0" max="120" value="${rearmMinutesFor(d)}" style="width:48px"> min</label>
          <span class="muted" style="font-size:11px;">Auto re-arm ${rearmMinutesFor(d)} min after wet${d.rearmByProt ? ' · ' + currentProtection().replace('_', ' ') : ''}. Manual Re-arm still works right away.</span>
          <label class="qp-flag"><input type="checkbox" id="dcMommy" ${mommyCheckOn(d) ? 'checked' : ''}> ${caregiverVoice() ? 'Mommy check' : 'Padding check'} before re-arm <span class="muted" style="font-weight:normal;">(random, aim at dry padding)</span></label>
          <label>Check spread <input id="dcMommySpread" type="number" min="2" max="20" value="${mommySpread(d)}" style="width:48px"> min</label>
          <label>Bat low ≤ <input id="dcBatLow" type="number" min="5" max="50" value="${d.batLowPct != null ? d.batLowPct : 20}" style="width:48px"> %</label>
        </div>
        <div class="muted" style="margin-top:4px;">${d.wearStartedAt ? ('Wear since ' + fmtHM(d.wearStartedAt) + ' · ' + (wearMinutes() != null ? wearMinutes() + ' min' : '—')) : 'Arm to start wear timer'}</div>
        ${nightOn ? `<div class="muted" style="margin-top:4px;">Night on · wake ${fmtHM(d.night.wakeAt)} · flagged #${d.night.eventIdx || 0}${d.night.saturatedAt ? ' · saturated' : ''}${d.night.gapFrom ? ' · no link' : ''}${d.night.totalSat != null ? ' · night sat ' + d.night.totalSat + '%' : ''}</div>` : ''}
        ${unconf ? `<div style="margin-top:6px;"><button type="button" id="dcCheckIn">☀️ Morning check-in (${unconf})</button></div>` : ''}
      </div>
      <div class="quiz-nav">
        <button type="button" id="dcScan" ${(useNative() ? !bgOn() : connState === 'idle') ? '' : 'disabled'}>🔍 Find a clip</button>
        <button type="button" id="dcSimNight">🌙 Simulate a night</button>
      </div>
      <div id="dcHits" class="cf-grid">${(useNative() ? bgOn() : connState === 'connected') ? '' : scanHits.map((h, i) => `<button type="button" class="hub-sub" data-hit="${i}">${esc(h.name + (h.rssi != null ? ' · ' + h.rssi + ' dBm' : ''))}</button>`).join('')}</div>
      <div class="camp-goal"><b>STATE</b> <code id="dcRaw">${esc(st.raw)}</code><br>
        ${st.wet ? '💧 WET' : '✨ dry'} · ${st.armed ? '🛡 ARMED' : '—'} · ${st.arming ? '⏳ arming' : ''} · ${st.charging ? '🔌 charging' : ''}<br>
        secs since wet: <b>${st.secs == null ? '—' : st.secs}</b> · battery: <b>${battery == null ? '—' : battery + '%'}</b> · ${conn ? 'connected' : 'idle'}</div>
      <div class="quiz-nav">
        <button type="button" id="dcRearm" ${conn || bgOn() ? '' : 'disabled'}>↻ Re-arm after ack</button>
        <button type="button" id="dcExport">📋 Copy log</button>
      </div>
      ${d.mock || mock.on ? `<div class="quiz-nav"><button type="button" id="dcWet">💧 Wet</button><button type="button" id="dcDry">✨ Dry</button><button type="button" id="dcArming">⏳ Arming→Armed</button></div>` : ''}
      <div class="cal-legend">Event log (newest last)</div>
      <div id="dcLog" style="max-height:180px;overflow:auto;font-family:monospace;font-size:11px;background:#151923;border-radius:8px;padding:6px;">${(d.log || []).slice(-60).map(e => `<div><span class="muted">${esc(new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}</span> <b>${esc(e.kind)}</b> ${esc(e.msg)}</div>`).join('') || '<div class="muted">empty</div>'}</div>`;
    bindLab(m);
  }
  function bindLab(m) {
    const on = (id, f) => { const e = m.querySelector('#' + id); if (e) e.onclick = async () => { try { await f(); renderLab(); } catch (err) { log('err', err.message || String(err)); renderLab(); if (typeof toast === 'function') toast(err.message || String(err)); } }; };
    const mockEl = m.querySelector('#dcMock');
    if (mockEl) mockEl.onchange = e => { mockEnable(e.target.checked); if (e.target.checked) connect('MOCK'); else disconnect(); renderLab(); };
    const cloudyEl = m.querySelector('#dcCloudy');
    if (cloudyEl) cloudyEl.onchange = async e => {
      const d = load();
      d.wakeHour = +m.querySelector('#dcWakeH').value; d.wakeMin = +m.querySelector('#dcWakeM').value;
      d.keepAwake = !!(m.querySelector('#dcKeep') || {}).checked; save(d);
      await applyCloudyNight(!!e.target.checked, {});
      renderLab();
    };
    const nightEl = m.querySelector('#dcNight');
    if (nightEl) nightEl.onchange = async e => {
      const d = load();
      d.wakeHour = +m.querySelector('#dcWakeH').value; d.wakeMin = +m.querySelector('#dcWakeM').value;
      applyRearmFromUi(m, d); d.keepAwake = !!(m.querySelector('#dcKeep') || {}).checked;
      if (!e.target.checked) d.cloudyNight = false;
      save(d);
      if (e.target.checked) await startNight({});
      else await stopNight({ openCheckIn: true });
      renderLab();
    };
    on('dcScan', async () => {
      const d0 = load();
      const seen = {};
      scanHits = [];
      const addHit = (id, name) => {
        const key = String(id || '').toUpperCase(); if (!key || seen[key]) return; seen[key] = 1;
        scanHits.push({ deviceId: key, name: name || ('DryClip · ' + key) });
      };
      if (d0.lastId) addHit(d0.lastId, (d0.lastName || 'DryClip') + ' · ' + String(d0.lastId).toUpperCase() + ' (last clip)');
      renderLab();
      if (typeof toast === 'function') toast('Scanning for a DryClip…');
      if (useNative()) {
        try {
          const r = await nativePlugin().scanForClips({ mac: d0.lastId || '' });
          ((r && r.clips) || []).forEach(c => addHit(c.address, (c.name || 'DryClip') + ' · ' + c.address + (c.rssi != null ? ' · ' + c.rssi + ' dBm' : '')));
        } catch (e) { log('scan', e.message || String(e)); }
        renderLab();
        if (!scanHits.length) throw new Error('No DryClip advertising nearby. Turn the clip on and close the other clip app. A classic Bluetooth bond is not required.');
        return;
      }
      const r = await init(); if (!r.ok && !mock.on) throw new Error(r.err || 'BLE unavailable');
      setConn('searching'); setTimeout(() => { if (connState === 'searching') setConn('idle'); }, 8500);
      await scan(hit => { addHit(hit.deviceId, hit.name + (hit.rssi != null ? ' · ' + hit.rssi + ' dBm' : '')); renderLab(); }, 8000);
      if (!scanHits.length) throw new Error('No DryClip advertising nearby. Turn the clip on and close the other clip app.');
    });
    on('dcConnect', connectAuto);
    m.querySelectorAll('[data-hit]').forEach(b => { b.onclick = async () => {
      const h = scanHits[+b.getAttribute('data-hit')]; if (!h) return;
      try { if (useNative()) await nativeStart(h.deviceId, String(h.name).split(' · ')[0]); else await connect(h.deviceId, h.name); } catch (e) { log('err', e.message); if (typeof toast === 'function') toast(e.message); }
      renderLab();
    }; });
    on('dcDisc', disconnect); on('dcArm', arm); on('dcAck', async () => { await ack(); scheduleRearm(rearmMinutesFor()); });
    on('dcRearm', () => scheduleRearm(rearmMinutesFor())); on('dcExport', exportLog); on('dcTestWet', testWet);
    on('dcWet', () => mockSetFlags((mock.state[0] | 0x01) & ~0x10)); on('dcDry', () => mockSetFlags(mock.state[0] & ~0x01 & ~0x10));
    on('dcArming', () => { mockSetFlags(0x10); setTimeout(() => mockSetFlags(0x02), 1000); });
    on('dcSimNight', simulateNight);
    on('dcBattery', async () => { const BA = W.Capacitor.Plugins.BladderAlarm; if (BA && BA.requestIgnoreBatteryOptimizations) await BA.requestIgnoreBatteryOptimizations(); setTimeout(nativeRefresh, 3000); });
    on('dcCheckIn', () => openMorningCheckIn());
    const dayEl = m.querySelector('#dcDay');
    if (dayEl) dayEl.onchange = e => {
      const d = load(); d.daytimeWatch = !!e.target.checked && !d.wearingTonight; save(d);
      log('day', d.daytimeWatch ? 'Daytime unnoticed watch on' : 'Daytime watch off');
      if (d.daytimeWatch && !deviceId && d.lastId) startRetry();
      renderLab();
    };
    function syncRearmUi() {
      const d = load();
      applyRearmFromUi(m, d); save(d);
      const mins = rearmMinutesFor(d);
      pushMommyConfig(mins);
      const wrap = m.querySelector('#dcRearmCustomWrap');
      const mode = (m.querySelector('#dcRearmMode') || {}).value;
      if (wrap) wrap.style.display = mode === 'custom' ? '' : 'none';
      renderLab();
      try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
    }
    const mommyEl = m.querySelector('#dcMommy');
    if (mommyEl) mommyEl.onchange = () => {
      const d = load(); d.mommyCheck = !!mommyEl.checked; save(d);
      pushMommyConfig(rearmMinutesFor(d));
      log('rearm', d.mommyCheck ? 'Padding check before re-arm is on' : 'Padding check off — re-arm is a fixed delay');
      renderLab();
    };
    const spreadEl = m.querySelector('#dcMommySpread');
    if (spreadEl) spreadEl.onchange = () => {
      const d = load(); d.mommySpreadMin = Math.max(2, Math.min(20, +spreadEl.value || 8)); save(d);
      pushMommyConfig(rearmMinutesFor(d));
    };
    ['dcWakeH', 'dcWakeM', 'dcRearmMin', 'dcRearmMode', 'dcKeep', 'dcBatLow'].forEach(id => {
      const el = m.querySelector('#' + id); if (!el) return;
      el.onchange = () => {
        if (id === 'dcRearmMode' || id === 'dcRearmMin') { syncRearmUi(); return; }
        const d = load();
        d.wakeHour = +m.querySelector('#dcWakeH').value;
        d.wakeMin = +m.querySelector('#dcWakeM').value;
        d.keepAwake = !!(m.querySelector('#dcKeep') || {}).checked;
        const bl = m.querySelector('#dcBatLow'); if (bl) d.batLowPct = Math.max(5, Math.min(50, +bl.value || 20));
        if (d.night && d.wearingTonight) d.night.wakeAt = nextWakeAt(d.wakeHour, d.wakeMin);
        save(d);
        try { if (typeof window.nativeNotifySync === 'function') window.nativeNotifySync(); } catch (e) {}
      };
    });
  }
  /** Read re-arm controls into d (mutates). */
  function applyRearmFromUi(m, d) {
    const modeEl = m.querySelector('#dcRearmMode');
    const mode = modeEl ? modeEl.value : '20';
    if (mode === 'prot') { d.rearmByProt = true; d.rearmMin = rearmMinutesFor({ rearmByProt: true, rearmMin: d.rearmMin }); }
    else if (mode === 'custom') {
      d.rearmByProt = false;
      const inp = m.querySelector('#dcRearmMin');
      d.rearmMin = Math.max(0, Math.min(120, +(inp && inp.value) || 20));
    } else { d.rearmByProt = false; d.rearmMin = +mode || 20; }
  }

  function boot() {
    try {
      const d0 = load(); // v28: migrates legacy rearmMin 5 → 20
      if (d0.mock) mock.on = true;
      ensureMount(); renderLab(); refreshBadge();
      if (useNative()) {
        nativeBind().then(() => {
          try { pushMommyConfig(rearmMinutesFor(load())); } catch (e) {}
        }).catch(() => {});
      }
      // Resume: pull background wet events first (maybeMorning drains in native mode), then check-in if past wake
      setTimeout(() => { try { maybeMorning(); } catch (e) {} }, 800);
    } catch (e) { console.warn('DryClip', e); }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('load', () => setTimeout(boot, 400));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        try { maybeMorning(); refreshBadge(); } catch (e) {}
        if (useNative()) { nativeRefresh(); return; }
        // Re-assert wake lock if night still on
        const d = load();
        if (d.wearingTonight && d.keepAwake) setKeepAwake(true);
      }
    });
  }
  W.BSDryClip = {
    KEY, SVC, C, ALARM_ID, parseState, load, save, log, init, scan, stopScan, connect, disconnect,
    arm, ack, scheduleRearm, connectAuto, clipLabel, uiState, HINT, _cfg: CFG, _setBle: b => { ble = b; },
    // v26 background watch
    wetAtFromSecs, decideWet, POST_ARM_SUPPRESS_MS, IGNORE_AFTER_ARM_MS, SETTLE_ON_CONNECT_MS, DEDUPE_MS, REARM_BY_PROT, rearmMinutesFor, currentProtection, testWet,
    planMommyCheck, mommyCheckCopy, mommyCheckOn, mommySpread, openMommyCheck,
    applyNativeEvent, drainNative, nativeStart, nativeRefresh, nativeUiState, useNative, nightFor,
    get nativeStatus() { return nst; }, _setNativeStatus: s => { nst = s; },
    get connState() { return connState; }, exportLog, buildExportText, copyExportText, renderLab, mockEnable, offerAccident,
    noteSettleIgnored, applyCloudyNight, cloudyNightActive,
    startNight, stopNight, pendingAlarm, maybeMorning, openMorningCheckIn, openWakeCheckIn, simulateNight, refreshBadge, setKeepAwake, wearMinutes, checkBatteryLow,
    get armPending() { return armPending; }, get armAssumed() { return armAssumed; }, get state() { return lastState; }, get battery() { return battery; }, get deviceId() { return deviceId; }
  };
})();
