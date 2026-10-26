package dev.simpledl.bladdersim.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-arms persisted alarms after reboot, app update, clock/timezone change or exact-alarm permission grant. */
public class AlarmBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        AlarmScheduler.ensureChannels(c);
        AlarmScheduler.rescheduleAll(c);
    }
}
