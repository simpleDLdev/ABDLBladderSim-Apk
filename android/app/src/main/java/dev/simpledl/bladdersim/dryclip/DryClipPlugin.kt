package dev.simpledl.bladdersim.dryclip

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import java.util.Locale

/** v26 — JS: Capacitor.Plugins.DryClipService. Native background watch for the DryClip (see DryClipService). */
@CapacitorPlugin(
    name = "DryClipService",
    permissions = [
        Permission(strings = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT], alias = "bluetooth"),
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")
    ]
)
class DryClipPlugin : Plugin() {

    override fun load() {
        DryClipService.listener = { type, data -> notifyListeners(type, JSObject.fromJSONObject(data)) }
    }

    override fun handleOnDestroy() {
        DryClipService.listener = null
        super.handleOnDestroy()
    }

    private fun js(o: JSONObject): JSObject = JSObject.fromJSONObject(o)

    private fun neededAliases(): Array<String> {
        val a = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED) a.add("bluetooth")
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) a.add("notifications")
        return a.toTypedArray()
    }

    private fun permResult(): JSObject {
        val r = JSObject()
        r.put("bluetooth", DryClipService.hasConnectPerm(context) && (Build.VERSION.SDK_INT < 31 || getPermissionState("bluetooth") == PermissionState.GRANTED))
        r.put("notifications", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED)
        r.put("sdk", Build.VERSION.SDK_INT)
        return r
    }

    @PluginMethod
    fun ensurePermissions(call: PluginCall) {
        val need = neededAliases()
        if (need.isEmpty()) { call.resolve(permResult()); return }
        requestPermissionForAliases(need, call, "permsDone")
    }

    @PermissionCallback
    private fun permsDone(call: PluginCall) { call.resolve(permResult()) }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val r = JSObject(); r.put("available", true); r.put("sdk", Build.VERSION.SDK_INT); call.resolve(r)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val store = DryClipStore(context)
        val mac = (call.getString("mac") ?: store.mac)?.uppercase(Locale.US)
        if (mac.isNullOrBlank() || !Regex("^[0-9A-F]{2}(:[0-9A-F]{2}){5}$").matches(mac)) { call.reject("A clip address like E9:DE:61:89:8D:D2 is needed"); return }
        if (!DryClipService.hasConnectPerm(context)) { call.reject("Allow Nearby devices first", "PERMISSION"); return }
        val i = Intent(context, DryClipService::class.java).setAction(DryClipService.ACTION_START).putExtra("mac", mac)
        call.getString("name")?.let { i.putExtra("name", it) }
        call.getDouble("rearmMin")?.let { i.putExtra("rearmMin", it) }
        try { ContextCompat.startForegroundService(context, i) } catch (e: Exception) { call.reject("Couldn't start the background watch: " + e.message); return }
        val r = js(DryClipService.idleStatus(context)); r.put("running", true); r.put("mac", mac); call.resolve(r)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val s = DryClipService.instance
        if (s != null) s.post { s.stopWatch("Stopped in the app") } else DryClipStore(context).running = false
        call.resolve()
    }

    @PluginMethod
    fun arm(call: PluginCall) {
        val s = DryClipService.instance ?: run { call.reject("Background watch is off"); return }
        s.post { s.arm("user") }; call.resolve()
    }

    @PluginMethod
    fun ackWet(call: PluginCall) {
        val s = DryClipService.instance ?: run { call.reject("Background watch is off"); return }
        s.post { s.ackWet(true) }; call.resolve()
    }

    @PluginMethod
    fun setConfig(call: PluginCall) {
        call.getDouble("rearmMin")?.let { DryClipStore(context).rearmMin = Math.max(0.0, it) }
        call.resolve()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val s = DryClipService.instance
        call.resolve(js(if (s != null && DryClipStore(context).running) s.status() else DryClipService.idleStatus(context)))
    }

    @PluginMethod
    fun drainEvents(call: PluginCall) {
        val a = DryClipStore(context).drainEvents()
        val r = JSObject(); r.put("events", JSArray.from(Array(a.length()) { a.get(it) })); call.resolve(r)
    }

    @PluginMethod
    fun getLog(call: PluginCall) {
        val store = DryClipStore(context)
        val a = store.getLog()
        val lines = Array(a.length()) { a.getString(it) }
        val r = JSObject(); r.put("lines", JSArray.from(lines)); r.put("text", lines.joinToString("\n"))
        if (call.getBoolean("clear", false) == true) store.clearLog()
        call.resolve(r)
    }

    /** Bonded devices (Android settings / nRF Connect bond). The clip doesn't advertise while bonded+connected, so we pick it from here. */
    @PluginMethod
    fun findClip(call: PluginCall) {
        if (!DryClipService.hasConnectPerm(context)) { call.reject("Allow Nearby devices first", "PERMISSION"); return }
        val out = JSArray()
        try {
            val ad = (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
            @Suppress("MissingPermission")
            ad?.bondedDevices?.forEach { d ->
                @Suppress("MissingPermission") val n = d.name ?: ""
                val o = JSObject(); o.put("address", d.address); o.put("name", n); o.put("isDryClip", n.lowercase(Locale.US).contains("dryclip"))
                out.put(o)
            }
        } catch (e: Exception) { call.reject("findClip: " + e.message); return }
        val r = JSObject(); r.put("bonded", out); call.resolve(r)
    }
}
