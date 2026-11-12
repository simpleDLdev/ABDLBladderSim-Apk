package dev.simpledl.bladdersim.dryclip

import java.util.UUID

/**
 * v26: pure DryClip protocol helpers (no Android types) — mirrored in js/dryclip.js (BSDryClip.decideWet) and unit-tested there.
 * DC01 STATE: byte0 flags (0x01 wet, 0x02 armed, 0x08 charging, 0x10 arming), bytes 1-4 = seconds since wet (uint32 LE).
 */
object DryClipProtocol {
    private fun u(short: String) = UUID.fromString("0000$short-0000-1000-8000-00805f9b34fb")
    val SVC: UUID = u("dc00")
    val STATE: UUID = u("dc01")
    val ARM: UUID = u("dc02")
    val ACK: UUID = u("dc07")
    val BAT_SVC: UUID = u("180f")
    val BAT: UUID = u("2a19")
    val CCCD: UUID = u("2902")

    /**
     * v43: only the clip's own arm disconnect (it drops the link 2–3 s after 01 is written to DC02).
     * A wet takes about 30 s to report, so this window must not use the backdated wet time.
     * Once it has passed and the clip is armed, a touch or a wet notifies.
     */
    const val POST_ARM_SUPPRESS_MS = 4_000L
    const val IGNORE_AFTER_ARM_MS = POST_ARM_SUPPRESS_MS
    /** v43: a fresh link does not open a wet-ignore window. Bond is not required to connect. */
    const val SETTLE_ON_CONNECT_MS = 0L
    const val DEDUPE_MS = 60_000L
    const val ARM_ASSUME_MS = 12_000L

    data class State(
        val flags: Int, val wet: Boolean, val armed: Boolean, val charging: Boolean, val arming: Boolean,
        val secs: Long?, val hex: String
    )

    fun hex(b: ByteArray?): String = b?.joinToString("-") { String.format("%02X", it.toInt() and 0xff) } ?: ""

    fun parse(b: ByteArray?): State {
        if (b == null || b.isEmpty()) return State(0, false, false, false, false, null, "")
        val f = b[0].toInt() and 0xff
        val secs = if (b.size >= 5)
            ((b[1].toLong() and 0xff) or ((b[2].toLong() and 0xff) shl 8) or ((b[3].toLong() and 0xff) shl 16) or ((b[4].toLong() and 0xff) shl 24))
        else null
        return State(f, f and 0x01 != 0, f and 0x02 != 0, f and 0x08 != 0, f and 0x10 != 0, secs, hex(b))
    }

    fun wetAt(now: Long, secs: Long?): Long = if (secs == null) now else now - secs * 1000L

    enum class Decision { NOT_WET, ARMING, NOT_ARMED, IGNORE_WINDOW, DUPLICATE, NEW }

    /**
     * Is this reading a NEW wet event?
     * - not armed → NOT_ARMED (no notification)
     * - arm write still in flight, or the few seconds of the clip's own disconnect → ARMING / IGNORE_WINDOW
     * - armed and wet after that → NEW, including a touch. secsSinceWet is not used to hide it
     *   (the plate reports about 30 s late, so a backdated start used to look like "settling")
     * - same wet time within ±60 s → DUPLICATE
     */
    fun decide(st: State, now: Long, armPending: Boolean, ignoreUntil: Long, lastWetAt: Long?): Decision {
        if (!st.wet) return Decision.NOT_WET
        if (armPending || st.arming) return Decision.ARMING
        if (!st.armed) return Decision.NOT_ARMED
        if (ignoreUntil > 0 && now < ignoreUntil) return Decision.IGNORE_WINDOW
        val at = wetAt(now, st.secs)
        if (lastWetAt != null && lastWetAt > 0 && Math.abs(at - lastWetAt) <= DEDUPE_MS) return Decision.DUPLICATE
        return Decision.NEW
    }
}
