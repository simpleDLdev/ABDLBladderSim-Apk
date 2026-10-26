package dev.simpledl.bladdersim;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import dev.simpledl.bladdersim.alarm.AlarmScheduler;
import dev.simpledl.bladdersim.alarm.BladderAlarmPlugin;

public class MainActivity extends BridgeActivity {
    private static volatile boolean foreground = false;

    public static boolean isInForeground() { return foreground; }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BladderAlarmPlugin.class);
        registerPlugin(dev.simpledl.bladdersim.dryclip.DryClipPlugin.class); // v26
        super.onCreate(savedInstanceState);
        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAlarmIntent(intent);
    }

    /** Only when opened from an alarm (full-screen intent) do we show over the lock screen / turn the screen on. */
    private void handleAlarmIntent(Intent intent) {
        boolean fromAlarm = intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_FROM_ALARM, false);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(fromAlarm);
            setTurnScreenOn(fromAlarm);
        }
    }

    @Override
    public void onResume() { super.onResume(); foreground = true; }

    @Override
    public void onPause() { foreground = false; super.onPause(); }
}
