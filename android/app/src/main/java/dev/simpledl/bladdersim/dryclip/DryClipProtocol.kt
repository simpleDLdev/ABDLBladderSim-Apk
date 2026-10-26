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

    const val IGNORE_AFTER_ARM_MS = 20_000L
    /** v28: plate-touch wake / connect / pairing — ignore WET this long after a fresh link. */
    const val SETTLE_ON_CONNECT_MS = 20_000L
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

    enum class Decision { NOT_WET, ARMING, NOT_ARMED, IGNORE_WINDOW, LATCHED_TOUCH, DUPLICATE, NEW }

    /**
     * Is this reading a NEW wet event?
     * - wet bit set, clip armed (bit 0x02), not arming and no arm pending
     * - outside the post-arm ignore window: now >= ignoreUntil AND the wet did not start inside it (wetAt >= ignoreUntil)
     *   (the plate reads warmth: a finger touch while arming latches WET)
     * - a wet that started inside the window and is still latched after it is LATCHED_TOUCH:
     *   ignore it once, do not treat it as a new wet, and do not re-arm (that settle-loops)
     * - not the same event as the last one (computed wet time within ±60 s)
     */
    fun decide(st: State, now: Long, armPending: Boolean, ignoreUntil: Long, lastWetAt: Long?): Decision {
        if (!st.wet) return Decision.NOT_WET
        if (armPending || st.arming) return Decision.ARMING
        if (!st.armed) return Decision.NOT_ARMED
        val at = wetAt(now, st.secs)
        if (ignoreUntil > 0 && now < ignoreUntil) return Decision.IGNORE_WINDOW
        if (ignoreUntil > 0 && at < ignoreUntil) return Decision.LATCHED_TOUCH
        if (lastWetAt != null && lastWetAt > 0 && Math.abs(at - lastWetAt) <= DEDUPE_MS) return Decision.DUPLICATE
        return Decision.NEW
    }
}
