package dev.simpledl.bladdersim.dryclip

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** v26: bring the background watch back after a reboot / app update if it was on. */
class DryClipBootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val s = DryClipStore(ctx)
        if (!s.running || s.mac == null || !DryClipService.hasConnectPerm(ctx)) return
        try { ContextCompat.startForegroundService(ctx, Intent(ctx, DryClipService::class.java)) } catch (e: Exception) { s.log("err", "boot start: " + e.message) }
    }
}
