package dev.simpledl.bladdersim.dryclip

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import dev.simpledl.bladdersim.MainActivity
import dev.simpledl.bladdersim.R
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * v26: foreground service (type connectedDevice) that owns the whole BLE link to the DryClip — no WebView needed.
 * Direct connectGatt(mac, TRANSPORT_LE) like the vendor app; after the expected arm-drop: close, 1.5 s, direct (6 s),
 * then autoConnect=true (Android keeps it pending until the clip shows up) + address/name-filtered scan windows.
 * Wet events are parsed here and queued in SharedPreferences with the real wet time (now - secsSinceWet).
 * All state lives on the main looper (BLE callbacks are posted there), so nothing overlaps.
 */
@SuppressLint("MissingPermission")
class DryClipService : Service() {

    companion object {
        const val CHANNEL = "dryclip_watch"
        const val WET_CHANNEL = "dryclip_wet"
        const val NOTIF_ID = 4260
        const val WET_NOTIF_ID = 4263
        const val ACTION_START = "dev.simpledl.bladdersim.dryclip.START"
        const val ACTION_STOP = "dev.simpledl.bladdersim.dryclip.STOP"
        const val DIRECT_TIMEOUT_MS = 6_000L
        const val RECONNECT_GAP_MS = 1_500L
        const val AUTO_RETRY_MS = 8_000L
        const val AUTO_REFRESH_MS = 180_000L
        const val SCAN_WINDOW_MS = 10_000L
        const val SCAN_EVERY_MS = 30_000L
        const val ARM_DROP_WINDOW_MS = 30_000L
        const val ARM_CHECK_MS = 30_000L
        const val STILL_WET_RETRY_MS = 600_000L
        const val GAP_MIN_MS = 120_000L
        const val OP_TIMEOUT_MS = 4_000L

        @Volatile var instance: DryClipService? = null
        @Volatile var listener: ((String, JSONObject) -> Unit)? = null
        fun emit(type: String, data: JSONObject) { try { listener?.invoke(type, data) } catch (_: Exception) {} }

        fun hasConnectPerm(ctx: Context) = Build.VERSION.SDK_INT < 31 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        fun hasScanPerm(ctx: Context) = if (Build.VERSION.SDK_INT >= 31)
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
        else ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

        /** Status when the service isn't running (from the store only). */
        fun idleStatus(ctx: Context): JSONObject {
            val s = DryClipStore(ctx)
            return JSONObject().put("running", false).put("conn", "off").put("mac", s.mac ?: JSONObject.NULL)
                .put("name", s.name ?: JSONObject.NULL).put("bonded", bondState(ctx, s.mac))
                .put("queued", s.peekEvents().length()).put("eventCount", s.eventCount).put("rearmMin", s.rearmMin)
        }
        fun bondState(ctx: Context, mac: String?): String {
            if (mac == null || !hasConnectPerm(ctx)) return "unknown"
            return try {
                val ad = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter ?: return "unknown"
                when (ad.getRemoteDevice(mac).bondState) {
                    BluetoothDevice.BOND_BONDED -> "bonded"; BluetoothDevice.BOND_BONDING -> "bonding"; else -> "none"
                }
            } catch (e: Exception) { "unknown" }
        }
    }

    private val h = Handler(Looper.getMainLooper())
    private lateinit var store: DryClipStore
    private val hm = SimpleDateFormat("HH:mm:ss", Locale.US)

    // link
    private var gatt: BluetoothGatt? = null
    private var conn = "idle"            // idle | connecting | connected | waiting (autoConnect pending / between tries)
    private var mode = ""                // direct | auto
    private var attempt = 0
    private var directTries = 0
    private var discoverTries = 0
    private var downSince = 0L
    private var scanning = false
    private var lastScanLogAt = 0L
    // clip
    private var last: DryClipProtocol.State? = null
    private var lastStateAt = 0L
    private var lastLoggedHex: String? = null
    private var lastLoggedAt = 0L
    private var battery: Int? = null
    private var lastSeen = 0L
    // arming
    private var armPending = false
    private var armAt = 0L
    private var armedAssumed = false
    private var armSource = "user"
    private var armOnConnect: String? = null
    private var ackOnConnect = false
    private var touchClearDone = false
    private var latchCleared = false      // v39: post-settle touch latch cleared once; no auto re-arm
    private var unpairedLogged = false
    private var stillWetLogged = false
    private var stillWet = false
    private var ignoreLoggedFor = 0L
    private var rearmAt = 0L
    private var clearing = false          // touch-clear ack sent, its arm not out yet
    private var lastError: String? = null
    // GATT op queue (one at a time)
    private class Op(val kind: String, val svc: UUID, val chr: UUID, val value: ByteArray? = null, val noResp: Boolean = false)
    private val ops = ArrayDeque<Op>()
    private var opBusy = false

    private val connectTimeout = Runnable { onDirectTimeout() }
    private val autoRefresh = Runnable { if (conn != "connected" && store.running) { log("conn", "Still waiting for the clip. Refreshing the connection."); connectDirect("refresh") } }
    private val scanTick = Runnable { scanWindow() }
    private val scanStop = Runnable { stopScan() }
    private val assumeArm = Runnable { onArmAssume() }
    private val armCheck = Runnable { onArmCheck() }
    private val rearm = Runnable {
        rearmAt = 0L
        if (store.mommyCheck) {
            log("rearm", "Mommy check — aim the clip at padding that is still dry, then arm")
            store.addEvent(JSONObject().put("kind", "mommy_check").put("detectedAt", now()))
            emit("event", JSONObject().put("kind", "mommy_check"))
            refresh()
        } else arm("auto")
    }
    private val retryDirect = Runnable { connectDirect("retry") }
    private val opTimeout = Runnable { opBusy = false; nextOp() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        store = DryClipStore(this)
        instance = this
        ensureChannel()
        try { registerReceiver(btReceiver, IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)) } catch (_: Exception) {}
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP) { stopWatch("Stopped from the notification"); return START_NOT_STICKY }
        if (!startFg()) { store.running = false; stopSelf(); return START_NOT_STICKY }
        if (action == ACTION_START) {
            intent.getStringExtra("mac")?.let { store.mac = it.uppercase(Locale.US) }
            intent.getStringExtra("name")?.let { store.name = it }
            if (intent.hasExtra("rearmMin")) store.rearmMin = intent.getDoubleExtra("rearmMin", 20.0)
            if (intent.hasExtra("mommyCheck")) store.mommyCheck = intent.getBooleanExtra("mommyCheck", true)
            if (intent.hasExtra("mommySpreadMin")) store.mommySpreadMin = intent.getDoubleExtra("mommySpreadMin", 8.0).coerceIn(2.0, 20.0)
            store.running = true
            log("svc", "Background watch on · clip " + store.mac + " · bond " + bondState(this, store.mac))
            if (conn != "connected") connectDirect("start")
        } else { // null intent: restarted by Android (START_STICKY) or boot
            if (!store.running || store.mac == null) { stopSelf(); return START_NOT_STICKY }
            log("svc", "Background watch restarted by Android")
            if (conn != "connected") connectDirect("restart")
        }
        return START_STICKY
    }

    override fun onDestroy() {
        h.removeCallbacksAndMessages(null)
        stopScan(); closeGatt()
        try { unregisterReceiver(btReceiver) } catch (_: Exception) {}
        if (instance === this) instance = null
        emitStatus()
        super.onDestroy()
    }

    // ---------- public (called from the plugin; posted to the main looper) ----------
    fun post(r: () -> Unit) { h.post(r) }

    fun stopWatch(why: String) {
        log("svc", "Background watch off · $why")
        store.running = false
        unpairedLogged = false
        h.removeCallbacksAndMessages(null)
        stopScan(); closeGatt(); conn = "idle"
        try { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE) } catch (_: Exception) {}
        stopSelf()
        emitStatus()
    }

    fun arm(source: String) {
        // v40: BOND_NONE is normal (Forget bond). Arm queues until GATT connects; it does not require a classic bond.
        if (conn != "connected" || gatt == null) {
            armOnConnect = source
            log("arm", "Arm queued ($source). It goes out as soon as the clip connects.")
            if (conn == "idle") connectDirect("arm")
            refresh(); return
        }
        armOnConnect = null; clearing = false
        // v27: re-arm while already armed (recalibrate the warmth baseline) is allowed: same ARM write, fresh armedSince,
        // fresh post-arm ignore window and wet latch; the usual arm drop + reconnect follows (no gap marker for it).
        val wasArmed = isArmedNow()
        armPending = true; armAt = now(); armedAssumed = false; armSource = source
        // v43: suppress only the 2–3 s arm disconnect. A later armed touch or wet notifies.
        store.armedSince = 0L; store.ignoreUntil = now() + DryClipProtocol.POST_ARM_SUPPRESS_MS
        if (source == "user") { touchClearDone = false; latchCleared = false; stillWetLogged = false; stillWet = false; ignoreLoggedFor = 0L }
        h.removeCallbacks(rearm); rearmAt = 0L
        h.removeCallbacks(assumeArm); h.postDelayed(assumeArm, DryClipProtocol.ARM_ASSUME_MS)
        h.removeCallbacks(armCheck); h.postDelayed(armCheck, ARM_CHECK_MS)
        // Vendor: single 0x01 to DC02, write WITHOUT response. The clip drops the link 2-3 s later on purpose.
        enqueue(Op("write", DryClipProtocol.SVC, DryClipProtocol.ARM, byteArrayOf(1), noResp = true))
        if (wasArmed) log("arm", "Re-arm while armed ($source): taking a fresh warmth baseline")
        log("arm", "Arm sent ($source). Arming takes 10-15 s; the link drops for a few seconds, which is normal.")
        refresh()
    }

    fun ackWet(fromUser: Boolean) {
        if (conn != "connected" || gatt == null) { ackOnConnect = true; log("ack", "Wet ack queued until the clip connects") }
        else enqueue(Op("write", DryClipProtocol.SVC, DryClipProtocol.ACK, byteArrayOf(1)))
        if (fromUser) { log("ack", "Wet acknowledged"); if (rearmAt == 0L) scheduleRearm((store.rearmMin * 60_000L).toLong(), "after ack") }
    }

    fun status(): JSONObject {
        val st = last
        return JSONObject()
            .put("running", store.running).put("conn", conn).put("mode", mode)
            .put("mac", store.mac ?: JSONObject.NULL).put("name", store.name ?: JSONObject.NULL)
            .put("bonded", bondState(this, store.mac))
            .put("armed", (st?.armed == true && !armPending) || armedAssumed).put("armedAssumed", armedAssumed).put("armPending", armPending)
            .put("wet", st?.wet == true).put("charging", st?.charging == true).put("arming", st?.arming == true)
            .put("secs", st?.secs ?: JSONObject.NULL).put("raw", st?.hex ?: JSONObject.NULL)
            .put("battery", battery ?: JSONObject.NULL).put("lastSeen", lastSeen).put("lastStateAt", lastStateAt)
            .put("armedSince", store.armedSince).put("ignoreUntil", store.ignoreUntil).put("rearmAt", rearmAt)
            .put("stillWet", stillWet).put("latchCleared", latchCleared).put("mommyCheck", store.mommyCheck)
            .put("queued", store.peekEvents().length()).put("eventCount", store.eventCount)
            .put("rearmMin", store.rearmMin).put("lastError", lastError ?: JSONObject.NULL).put("downSince", downSince)
            .put("phase", phase()).put("settling", now() < store.ignoreUntil && store.ignoreUntil > 0)
    }

    // ---------- link ----------
    private fun adapter(): BluetoothAdapter? = (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter

    private fun device(): BluetoothDevice? {
        val mac = store.mac ?: return null
        if (!hasConnectPerm(this)) { err("Nearby devices permission missing. Open the app and allow it."); return null }
        val ad = adapter() ?: return null
        if (!ad.isEnabled) { err("Bluetooth is off"); return null }
        return try { ad.getRemoteDevice(mac) } catch (e: Exception) { err("Bad clip address $mac"); null }
    }

    private fun closeGatt() {
        h.removeCallbacks(connectTimeout)
        ops.clear(); opBusy = false; h.removeCallbacks(opTimeout)
        val g = gatt ?: return
        gatt = null
        try { g.disconnect() } catch (_: Exception) {}
        try { g.close() } catch (_: Exception) {}
    }

    private fun bondNow(): String = bondState(this, store.mac)

    /** Diagnostic only. Forget-bond clips stay BOND_NONE and still take a GATT connection. */
    private fun noteOptionalBond() {
        if (bondNow() != "none" || unpairedLogged) return
        unpairedLogged = true
        log("conn", "Bond none — classic pairing is optional. Connecting over BLE.")
    }

    /** Direct connect to the saved MAC, autoConnect=false, 6 s. Bond state does not block. A quiet clip is often not advertising, so this does not wait for a scan. */
    private fun connectDirect(reason: String) {
        if (!store.running) return
        if (reason == "start" || reason == "after arm drop" || reason == "seen in scan" || reason == "refresh" || reason == "arm" || reason == "setup failed") directTries = 1
        else directTries++
        noteOptionalBond()
        h.removeCallbacks(autoRefresh); h.removeCallbacks(retryDirect); stopScan(); closeGatt()
        val dev = device() ?: run { conn = "waiting"; h.removeCallbacks(retryDirect); h.postDelayed(retryDirect, AUTO_RETRY_MS); refresh(); return }
        conn = "connecting"; mode = "direct"; val my = ++attempt
        log("conn", "Connecting directly to " + store.mac + " ($reason). Bond is not required.")
        gatt = connect(dev, false)
        if (gatt == null) { conn = "waiting"; h.postDelayed({ if (attempt == my) connectAuto() }, RECONNECT_GAP_MS) }
        else h.postDelayed(connectTimeout, DIRECT_TIMEOUT_MS)
        refresh()
    }

    private fun onDirectTimeout() {
        if (conn != "connecting" || mode != "direct") return
        log("conn", "Direct connect timed out (6 s)")
        closeGatt(); conn = "waiting"; refresh()
        if (directTries < 3) {
            log("conn", "Trying the last MAC again. A clip that is not advertising will not show up in a scan.")
            h.postDelayed({ if (gatt == null && conn != "connected") connectDirect("last MAC") }, RECONNECT_GAP_MS)
        } else {
            log("conn", "Direct tries failed. Waiting with auto-connect.")
            h.postDelayed({ if (conn == "waiting" && gatt == null) connectAuto() }, RECONNECT_GAP_MS)
        }
    }

    /** autoConnect=true: Android keeps it pending until the clip shows up. Plus scan windows on the address/name. */
    private fun connectAuto() {
        if (!store.running) return
        stopScan(); closeGatt()
        val dev = device() ?: run { h.postDelayed({ connectAuto() }, AUTO_RETRY_MS); return }
        conn = "waiting"; mode = "auto"; ++attempt
        log("conn", "Waiting for the clip (Android auto-connect + scan)")
        gatt = connect(dev, true)
        h.removeCallbacks(scanTick); h.postDelayed(scanTick, 500)
        h.removeCallbacks(autoRefresh); h.postDelayed(autoRefresh, AUTO_REFRESH_MS)
        refresh()
    }

    private fun connect(dev: BluetoothDevice, auto: Boolean): BluetoothGatt? = try {
        if (Build.VERSION.SDK_INT >= 23) dev.connectGatt(this, auto, cb, BluetoothDevice.TRANSPORT_LE) else dev.connectGatt(this, auto, cb)
    } catch (e: Exception) { err("connectGatt: " + e.message); null }

    private val scanCb = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) { h.post { onScanHit(result) } }
        override fun onScanFailed(errorCode: Int) { h.post { scanning = false; log("scan", "Scan failed ($errorCode)") } }
    }

    /** Scan on the clip's address OR name (not the DC00 service UUID — it isn't always in the advert). Filtered, so it keeps working with the screen off. */
    private fun scanWindow() {
        if (!store.running || conn == "connected" || mode != "auto") return
        h.postDelayed(scanTick, SCAN_EVERY_MS)
        if (scanning || !hasScanPerm(this)) return
        val sc = adapter()?.bluetoothLeScanner ?: return
        val mac = store.mac ?: return
        val filters = listOf(
            ScanFilter.Builder().setDeviceAddress(mac).build(),
            ScanFilter.Builder().setDeviceName("DRYCLIP").build(),
            ScanFilter.Builder().setDeviceName("DryClip").build()
        )
        val set = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        try { sc.startScan(filters, set, scanCb); scanning = true } catch (e: Exception) { log("scan", "startScan: " + e.message); return }
        if (now() - lastScanLogAt > 300_000L) { lastScanLogAt = now(); log("scan", "Scanning for the clip (address or name)") }
        h.removeCallbacks(scanStop); h.postDelayed(scanStop, SCAN_WINDOW_MS)
    }

    private fun stopScan() {
        h.removeCallbacks(scanStop)
        if (!scanning) return
        scanning = false
        try { adapter()?.bluetoothLeScanner?.stopScan(scanCb) } catch (_: Exception) {}
    }

    private fun onScanHit(r: ScanResult) {
        if (!scanning || conn == "connected" || mode != "auto") return
        val addr = r.device?.address ?: return
        if (!addr.equals(store.mac, ignoreCase = true)) {
            if (now() - lastScanLogAt > 60_000L) { lastScanLogAt = now(); log("scan", "Saw another clip at $addr (not ours), ignoring") }
            return
        }
        log("scan", "Clip seen (rssi ${r.rssi}). Connecting directly.")
        stopScan(); h.removeCallbacks(scanTick)
        connectDirect("seen in scan")
    }

    private val cb = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) { h.post { onConn(g, status, newState) } }
        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) { h.post { if (g === gatt) onDiscovered(g, status) } }
        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) { h.post { if (g === gatt) opDone("cccd", status) } }
        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) { h.post { if (g === gatt) opDone("write " + short(c.uuid), status) } }
        @Deprecated("Deprecated in Java")
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            @Suppress("DEPRECATION") val v = c.value?.copyOf()
            h.post { if (g === gatt) onRead(c.uuid, v, status) }
        }
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
            val v = value.copyOf(); h.post { if (g === gatt) onRead(c.uuid, v, status) }
        }
        @Deprecated("Deprecated in Java")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION") val v = c.value?.copyOf()
            h.post { if (g === gatt) onValue(c.uuid, v) }
        }
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
            val v = value.copyOf(); h.post { if (g === gatt) onValue(c.uuid, v) }
        }
    }

    private fun onConn(g: BluetoothGatt, status: Int, newState: Int) {
        if (g !== gatt) { try { g.close() } catch (_: Exception) {}; return } // stale GATT: close and ignore
        if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
            h.removeCallbacks(connectTimeout); h.removeCallbacks(autoRefresh); h.removeCallbacks(scanTick); stopScan()
            val bond = bondState(this, store.mac)
            log("conn", "Connected (" + mode + ") · bond " + bond)
            conn = "connected"; lastSeen = now(); lastError = null
            directTries = 0; discoverTries = 0
            // v43: do not open a wet-ignore window on connect. An armed touch or wet notifies.
            if (downSince > 0) {
                val from = downSince; downSince = 0
                val armDrop = armAt > 0 && from >= armAt - 5_000L && from - armAt < ARM_DROP_WINDOW_MS // v27: expected arm/re-arm drop
                if (isArmedNow() && now() - from >= GAP_MIN_MS && !armPending && !armDrop) {
                    store.addEvent(JSONObject().put("kind", "gap").put("from", from).put("to", now()).put("detectedAt", now()))
                    emit("event", JSONObject().put("kind", "gap"))
                }
            }
            mode = ""
            try { g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH) } catch (_: Exception) {}
            if (!g.discoverServices()) { err("discoverServices failed"); dropAndReconnect() }
            refresh(); return
        }
        // disconnected (or a failed connect)
        val wasConnected = conn == "connected"; val wasMode = mode
        closeGatt()
        if (!store.running) { conn = "idle"; refresh(); return }
        if (downSince == 0L) downSince = now()
        conn = "waiting"
        val expected = armPending || now() - armAt < ARM_DROP_WINDOW_MS
        when {
            wasConnected && expected -> log("arm", "Link dropped while arming (expected). Reconnecting in 1.5 s.")
            wasConnected -> log("conn", "Link lost (status $status). Reconnecting in 1.5 s.")
            else -> log("conn", "Connect failed (status $status, $wasMode)")
        }
        if (wasConnected) h.postDelayed({ if (gatt == null && conn != "connected") connectDirect(if (expected) "after arm drop" else "after drop") }, RECONNECT_GAP_MS)
        else if (wasMode == "direct") h.postDelayed({ if (gatt == null && conn != "connected") connectAuto() }, RECONNECT_GAP_MS)
        else h.postDelayed({ if (gatt == null && conn != "connected") connectAuto() }, AUTO_RETRY_MS)
        refresh()
    }

    private fun dropAndReconnect() { closeGatt(); conn = "waiting"; h.postDelayed({ connectDirect("setup failed") }, RECONNECT_GAP_MS) }

    private fun onDiscovered(g: BluetoothGatt, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS || g.getService(DryClipProtocol.SVC) == null) {
            if (discoverTries < 1 && g === gatt) {
                discoverTries++
                log("conn", "Service discovery failed (status $status). Retrying on this link.")
                if (g.discoverServices()) return
            }
            discoverTries = 0
            err("Service discovery failed (status $status)"); dropAndReconnect(); return
        }
        discoverTries = 0
        // Serialized: CCCDs one at a time, then one read of DC01 and battery. No MTU request.
        enqueue(Op("notify", DryClipProtocol.SVC, DryClipProtocol.STATE))
        if (g.getService(DryClipProtocol.BAT_SVC) != null) enqueue(Op("notify", DryClipProtocol.BAT_SVC, DryClipProtocol.BAT))
        enqueue(Op("read", DryClipProtocol.SVC, DryClipProtocol.STATE))
        if (g.getService(DryClipProtocol.BAT_SVC) != null && !armPending) enqueue(Op("read", DryClipProtocol.BAT_SVC, DryClipProtocol.BAT))
        if (ackOnConnect) { ackOnConnect = false; enqueue(Op("write", DryClipProtocol.SVC, DryClipProtocol.ACK, byteArrayOf(1))) }
        armOnConnect?.let { src -> h.postDelayed({ if (conn == "connected" && armOnConnect == src) arm(src) }, 1500) }
    }

    // ---------- GATT op queue ----------
    private fun enqueue(op: Op) { ops.add(op); nextOp() }

    private fun nextOp() {
        if (opBusy) return
        val g = gatt ?: run { ops.clear(); return }
        val op = ops.poll() ?: return
        val c = g.getService(op.svc)?.getCharacteristic(op.chr)
        if (c == null) { log("err", "Characteristic " + short(op.chr) + " missing"); nextOp(); return }
        val started = try {
            when (op.kind) {
                "notify" -> {
                    g.setCharacteristicNotification(c, true)
                    val d = c.getDescriptor(DryClipProtocol.CCCD)
                    if (d == null) false
                    else if (Build.VERSION.SDK_INT >= 33) g.writeDescriptor(d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == 0
                    else @Suppress("DEPRECATION") run { d.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE; g.writeDescriptor(d) }
                }
                "read" -> g.readCharacteristic(c)
                else -> {
                    val type = if (op.noResp) BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE else BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                    if (Build.VERSION.SDK_INT >= 33) g.writeCharacteristic(c, op.value!!, type) == 0
                    else @Suppress("DEPRECATION") run { c.writeType = type; c.value = op.value; g.writeCharacteristic(c) }
                }
            }
        } catch (e: Exception) { log("err", op.kind + " " + short(op.chr) + ": " + e.message); false }
        if (!started) { log("warn", op.kind + " " + short(op.chr) + " not started"); nextOp(); return }
        opBusy = true
        h.removeCallbacks(opTimeout); h.postDelayed(opTimeout, OP_TIMEOUT_MS)
    }

    private fun opDone(what: String, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) log("warn", "$what status $status")
        h.removeCallbacks(opTimeout); opBusy = false; nextOp()
    }

    private fun onRead(u: UUID, v: ByteArray?, status: Int) {
        if (status == BluetoothGatt.GATT_SUCCESS) onValue(u, v) else log("warn", "read " + short(u) + " status $status")
        opDone("read", BluetoothGatt.GATT_SUCCESS)
    }

    private fun onValue(u: UUID, v: ByteArray?) {
        lastSeen = now()
        if (u == DryClipProtocol.BAT) {
            val b = v?.firstOrNull()?.toInt()?.and(0xff) ?: return
            if (b != battery) log("bat", "$b%")
            battery = b; refresh(); return
        }
        if (u == DryClipProtocol.STATE) onState(DryClipProtocol.parse(v))
    }

    // ---------- clip state ----------
    /** v28: coarse UI / notification phase. */
    private fun phase(): String = when {
        !store.running -> "off"
        conn == "connecting" || (conn == "waiting" && store.running) -> if (armPending) "arming" else "reconnecting"
        armPending || (last?.arming == true) -> "arming"
        now() < store.ignoreUntil -> "settling"
        latchCleared -> "latched_touch"
        stillWet -> "still_wet"
        rearmAt > 0 -> "waiting_rearm"
        isArmedNow() -> "listening"
        conn == "connected" -> "connected"
        else -> "idle"
    }

    private fun isArmedNow() = (last?.armed == true) || armedAssumed || store.armedSince > 0

    private fun onState(st: DryClipProtocol.State) {
        val t = now()
        last = st; lastStateAt = t
        if (st.hex != lastLoggedHex || t - lastLoggedAt >= 60_000L) {
            lastLoggedHex = st.hex; lastLoggedAt = t
            log("state", st.hex + " · " + listOfNotNull(if (st.wet) "WET" else "dry", if (st.armed) "ARMED" else "unarmed",
                if (st.arming) "ARMING" else null, if (st.charging) "CHG" else null, st.secs?.let { "secs=$it" }).joinToString(" · "))
        }
        if (st.armed && !st.arming) {
            if (armPending && t - armAt < 3_000L) { /* still the reading from before the arm write */ }
            else if (armPending || (armedAssumed && store.armedSince == 0L)) confirmArmed("confirmed by the clip")
            else if (armedAssumed) { armedAssumed = false; log("arm", "Clip confirms it is armed") }
            else if (store.armedSince == 0L) {
                store.armedSince = t // already armed when we connected
                log("arm", "Clip already armed on connect. A touch or wet notifies.")
            }
        } else if (!st.armed && !st.arming && !armPending && (armedAssumed || store.armedSince > 0) && !st.wet) {
            armedAssumed = false; store.armedSince = 0L
            log("arm", "The clip reads not armed")
        }
        if (st.armed && !st.wet && !armPending && t >= store.ignoreUntil && stillWet) { stillWet = false; stillWetLogged = false; log("arm", "Clip dry and armed again") }
        if (!st.wet && latchCleared && !armPending && t >= store.ignoreUntil) {
            latchCleared = false
            log("arm", "Plate reads dry. Arm when you are ready.")
        }

        when (DryClipProtocol.decide(st, t, armPending, store.ignoreUntil, store.lastWetAt.takeIf { it > 0 })) {
            DryClipProtocol.Decision.NEW ->
                if (rearmAt > 0 || stillWet) { // after a wet, nothing counts until the clip is re-armed
                    if (ignoreLoggedFor != -rearmAt) { ignoreLoggedFor = -rearmAt; log("wet", "Wet reading while waiting to re-arm (not counted)") }
                } else recordWet(st, t)
            DryClipProtocol.Decision.IGNORE_WINDOW -> {
                if (ignoreLoggedFor != armAt) { ignoreLoggedFor = armAt; log("wet", "Wet reading during the arm disconnect (a few seconds). An armed wet after that notifies.") }
            }
            DryClipProtocol.Decision.NOT_ARMED -> {
                if (st.wet && ignoreLoggedFor != -1L) { ignoreLoggedFor = -1L; log("wet", "Wet reading while not armed — no notification.") }
            }
            else -> {}
        }
        refresh()
    }

    private fun confirmArmed(how: String) {
        val t = now()
        armPending = false; armedAssumed = false
        h.removeCallbacks(assumeArm)
        if (store.armedSince == 0L) store.armedSince = t
        log("arm", "Clip armed ($how). A touch or wet on the plate notifies.")
    }

    private fun onArmAssume() {
        if (!armPending) return
        val st = last
        if (conn == "connected" && st != null && lastStateAt > armAt && !st.armed && !st.arming) return // clearly not armed: armCheck decides
        val t = now()
        armPending = false; armedAssumed = true
        store.armedSince = t
        log("arm", "Armed (assumed after 12 s). A touch or wet notifies.")
        refresh()
    }

    private fun onArmCheck() {
        val st = last
        if (st == null || lastStateAt < armAt) { // no reading since the arm yet
            if (now() - armAt < 300_000L) h.postDelayed(armCheck, 15_000L)
            return
        }
        if (st.wet && !st.armed && armSource != "user") { onStillWet(); return }
        if (!st.armed && !st.arming && !st.wet) {
            armPending = false; armedAssumed = false; store.armedSince = 0L
            if (armSource == "user") log("arm", "Arm didn't take. The clip still reads not armed. Tap Arm again.")
            else { log("arm", "Re-arm didn't take. Trying again in 10 min."); scheduleRearm(STILL_WET_RETRY_MS, "retry") }
            refresh()
        } else if (st.wet && !st.armed) {
            armPending = false; armedAssumed = false
            onStillWet()
        }
    }

    /**
     * v39: wet that started inside settle/arm and is still latched after the window.
     * Clear (ack) once. Do not arm again — a re-arm opens another settle and the warm plate latches forever.
     * The next arm is the user's, or it waits until the plate reads dry.
     */
    private fun onLatchedTouch() {
        if (clearing || armPending || latchCleared) return
        latchCleared = true
        clearing = false
        h.removeCallbacks(rearm)
        rearmAt = 0L
        log("wet", "Touch still latched after settle. Ignored once — not re-arming until the plate reads dry or you tap Arm.")
        ackWet(false)
        refresh()
    }

    private fun onStillWet() {
        if (stillWet && rearmAt > 0) return // already handled; retry pending
        stillWet = true
        if (!stillWetLogged) {
            stillWetLogged = true
            log("wet", "still wet, can't re-arm (trying every 10 min)")
            store.addEvent(JSONObject().put("kind", "still_wet").put("detectedAt", now()).put("battery", battery ?: JSONObject.NULL).put("rawHex", last?.hex ?: ""))
            emit("event", JSONObject().put("kind", "still_wet"))
        }
        armPending = false; armedAssumed = false; store.armedSince = 0L
        ackWet(false)
        scheduleRearm(STILL_WET_RETRY_MS, "still wet")
    }

    private fun recordWet(st: DryClipProtocol.State, t: Long) {
        val wetAt = DryClipProtocol.wetAt(t, st.secs)
        store.lastWetAt = wetAt
        val n = store.eventCount + 1; store.eventCount = n
        val ev = JSONObject().put("kind", "wet").put("n", n).put("wetAt", wetAt).put("detectedAt", t)
            .put("secs", st.secs ?: JSONObject.NULL).put("battery", battery ?: JSONObject.NULL).put("rawHex", st.hex)
        store.addEvent(ev)
        log("wet", "WET #$n at " + hm.format(Date(wetAt)) + " (secs=" + st.secs + "). Notification posted. Ack, re-arm in " + fmtMin(store.rearmMin) + ".")
        postWetNotif(wetAt)
        emit("wet", ev)
        armedAssumed = false; store.armedSince = 0L
        ackWet(false)
        scheduleRearm((store.rearmMin * 60_000L).toLong(), "after wet")
    }

    /** Random lead before the nominal re-arm so a padding check can happen while the spot is still dry. */
    private fun mommyDelay(ms: Long): Long {
        val spread = (store.mommySpreadMin.coerceIn(2.0, 20.0) * 60_000.0).toLong()
        val earliest = (ms - spread).coerceAtLeast(60_000L)
        val latest = (ms - 60_000L).coerceAtLeast(earliest)
        if (latest <= earliest) return earliest
        return earliest + (Math.random() * (latest - earliest + 1)).toLong()
    }

    fun postponeMommyCheck(minutes: Double) {
        store.mommyCheck = true
        val ms = (minutes.coerceIn(2.0, 20.0) * 60_000.0).toLong()
        h.removeCallbacks(rearm)
        rearmAt = now() + ms
        h.postDelayed(rearm, ms)
        log("rearm", "Mommy check again at " + hm.format(Date(rearmAt)))
        refresh()
    }

    private fun scheduleRearm(ms: Long, why: String) {
        h.removeCallbacks(rearm)
        val delay = if (store.mommyCheck) mommyDelay(ms) else ms
        rearmAt = now() + delay
        h.postDelayed(rearm, delay)
        if (why != "still wet" || !stillWetLogged) {
            val label = if (store.mommyCheck) "Mommy check at " else "Re-arm at "
            log("rearm", label + hm.format(Date(rearmAt)) + " ($why)")
        }
        refresh()
    }

    // ---------- notification / events ----------
    /** Logs the test and, if the clip is already armed and wet, posts the same alert a live reading would. */
    fun debugTestWet() {
        val st = last
        log("wet", "Test wet: touch or wet the plate. Armed → notification. Not armed → no notification. A wet takes about 30 s.")
        if (st == null) { log("wet", "Test wet: no reading yet. Connect, arm, then touch the plate."); return }
        if (!st.armed && !armedAssumed && store.armedSince == 0L) {
            log("wet", "Test wet: clip is not armed, so this will not notify. Tap Arm first.")
            return
        }
        if (!st.wet) { log("wet", "Test wet: armed and dry. Touch or wet the plate. The alert posts when the reading arrives."); return }
        val at = DryClipProtocol.wetAt(now(), st.secs)
        if (store.lastWetAt > 0 && Math.abs(at - store.lastWetAt) <= DryClipProtocol.DEDUPE_MS) {
            log("wet", "Test wet: this armed wet was already notified."); return
        }
        recordWet(st, now())
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "DryClip background watch", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps the link to your DryClip while the screen is off"; setShowBadge(false)
            })
        }
        if (nm.getNotificationChannel(WET_CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(WET_CHANNEL, "DryClip wet", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Alerts when an armed DryClip reports wet"; enableVibration(true)
            })
        }
    }

    private fun postWetNotif(wetAt: Long) {
        ensureChannel()
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        val open = PendingIntent.getActivity(this, 4264, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), flags)
        val whenTxt = SimpleDateFormat("HH:mm", Locale.US).format(Date(wetAt))
        val n = NotificationCompat.Builder(this, WET_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("DryClip wet")
            .setContentText("Wet at $whenTxt")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try { getSystemService(NotificationManager::class.java)?.notify(WET_NOTIF_ID, n) } catch (_: Exception) {}
    }

    private fun notifText(): String = when {
        conn != "connected" && store.running ->
            if (armPending) "Arming… reconnecting" else "Reconnecting · looking for clip"
        latchCleared -> "Touch latched · not re-arming until the plate is dry"
        stillWet -> "Clip still wet · retrying re-arm every 10 min"
        rearmAt > 0 -> {
            val wetBit = if (store.lastWetAt > 0)
                "Wet at " + SimpleDateFormat("HH:mm", Locale.US).format(Date(store.lastWetAt)) + " · "
            else "Wet logged · "
            wetBit + "re-arming at " + SimpleDateFormat("HH:mm", Locale.US).format(Date(rearmAt))
        }
        armPending || (last?.arming == true) -> "DryClip arming…"
        now() < store.ignoreUntil -> "Settling… (touch ignored)"
        isArmedNow() -> "Armed · listening"
        else -> "DryClip connected · not armed"
    }

    private fun buildNotif(): Notification {
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        val open = PendingIntent.getActivity(this, 4261, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), flags)
        val stop = PendingIntent.getService(this, 4262, Intent(this, DryClipService::class.java).setAction(ACTION_STOP), flags)
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("DryClip background watch").setContentText(notifText())
            .setPriority(NotificationCompat.PRIORITY_LOW).setOngoing(true).setSilent(true).setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE).setContentIntent(open)
            .addAction(0, "Stop", stop).build()
    }

    private fun startFg(): Boolean = try {
        val type = if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotif(), type); true
    } catch (e: Exception) { store.log("err", "startForeground: " + e.message); false }

    private var lastNotif = ""
    private fun refresh() {
        if (store.running) {
            val txt = notifText()
            if (txt != lastNotif) {
                lastNotif = txt
                try { getSystemService(NotificationManager::class.java)?.notify(NOTIF_ID, buildNotif()) } catch (_: Exception) {}
            }
        }
        emitStatus()
    }

    private fun emitStatus() { emit("status", if (instance === this && store.running) status() else idleStatus(this)) }

    private fun log(kind: String, msg: String) { val line = store.log(kind, msg); emit("log", JSONObject().put("line", line).put("kind", kind).put("msg", msg)) }
    private fun err(msg: String) { lastError = msg; log("err", msg) }
    private fun now() = System.currentTimeMillis()
    private fun short(u: UUID) = u.toString().substring(4, 8).uppercase(Locale.US)
    private fun fmtMin(m: Double) = if (m == Math.floor(m)) m.toLong().toString() + " min" else "$m min"

    private val btReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1)) {
                BluetoothAdapter.STATE_OFF -> h.post { stopScan(); closeGatt(); conn = "waiting"; if (downSince == 0L) downSince = now(); log("conn", "Bluetooth turned off"); refresh() }
                BluetoothAdapter.STATE_ON -> h.post { if (store.running) { log("conn", "Bluetooth back on"); h.postDelayed({ connectDirect("bluetooth on") }, RECONNECT_GAP_MS) } }
            }
        }
    }
}
