package dev.simpledl.bladdersim.dryclip

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** v26: persistent native state — wet-event queue, rolling raw log (~300 lines), config. SharedPreferences "bs_dryclip_native". */
class DryClipStore(ctx: Context) {
    private val p: SharedPreferences = ctx.applicationContext.getSharedPreferences("bs_dryclip_native", Context.MODE_PRIVATE)
    private val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

    var running: Boolean get() = p.getBoolean("running", false); set(v) { p.edit().putBoolean("running", v).apply() }
    var mac: String? get() = p.getString("mac", null); set(v) { p.edit().putString("mac", v).apply() }
    var name: String? get() = p.getString("name", null); set(v) { p.edit().putString("name", v).apply() }
    var rearmMin: Double get() = p.getFloat("rearmMin", 20f).toDouble(); set(v) { p.edit().putFloat("rearmMin", v.toFloat()).apply() }
    var lastWetAt: Long get() = p.getLong("lastWetAt", 0L); set(v) { p.edit().putLong("lastWetAt", v).apply() }
    var armedSince: Long get() = p.getLong("armedSince", 0L); set(v) { p.edit().putLong("armedSince", v).apply() }
    var ignoreUntil: Long get() = p.getLong("ignoreUntil", 0L); set(v) { p.edit().putLong("ignoreUntil", v).apply() }
    var eventCount: Int get() = p.getInt("eventCount", 0); set(v) { p.edit().putInt("eventCount", v).apply() }

    @Synchronized fun addEvent(ev: JSONObject) {
        val a = arr("events"); a.put(ev)
        // keep at most 200 undrained events
        val out = if (a.length() > 200) JSONArray().also { n -> for (i in a.length() - 200 until a.length()) n.put(a.get(i)) } else a
        p.edit().putString("events", out.toString()).apply()
    }
    @Synchronized fun peekEvents(): JSONArray = arr("events")
    @Synchronized fun drainEvents(): JSONArray { val a = arr("events"); p.edit().putString("events", "[]").commit(); return a }

    @Synchronized fun log(kind: String, msg: String): String {
        val line = fmt.format(Date()) + "  " + kind + "  " + msg
        val a = arr("log"); a.put(line)
        val out = if (a.length() > 300) JSONArray().also { n -> for (i in a.length() - 300 until a.length()) n.put(a.get(i)) } else a
        p.edit().putString("log", out.toString()).apply()
        return line
    }
    @Synchronized fun getLog(): JSONArray = arr("log")
    @Synchronized fun clearLog() { p.edit().putString("log", "[]").apply() }

    private fun arr(k: String): JSONArray = try { JSONArray(p.getString(k, "[]")) } catch (e: Exception) { JSONArray() }
}
