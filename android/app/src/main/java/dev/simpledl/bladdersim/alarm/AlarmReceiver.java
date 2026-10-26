package dev.simpledl.bladdersim.alarm;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import dev.simpledl.bladdersim.MainActivity;
import dev.simpledl.bladdersim.R;

/** Fires when an AlarmManager alarm goes off: holds a wake lock and posts the alarm notification. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm != null ? pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BladderSim:alarm") : null;
        if (wl != null) wl.acquire(15000);
        try {
            int id = intent.getIntExtra(AlarmScheduler.EXTRA_ID, -1);
            AlarmStore.Item it = AlarmStore.get(c, id);
            AlarmStore.remove(c, id);
            if (it == null) return; // cancelled after arming
            post(c, it);
        } finally {
            // wake lock is released by its timeout so the sound/vibration and full-screen launch can complete
        }
    }

    static void post(Context c, AlarmStore.Item it) {
        if (MainActivity.isInForeground()) return; // app open + visible: the in-page banner, chime and grace countdown handle it
        AlarmScheduler.ensureChannels(c);
        boolean alarm = it.isAlarm();
        PendingIntent open = AlarmScheduler.openAppPi(c, it.id);
        String chan = AlarmScheduler.channelFor(it);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, chan)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(it.title)
            .setContentText(it.body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(it.body))
            .setPriority(alarm ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
            .setCategory(alarm ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(new NotificationCompat.Builder(c, chan)
                .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Reminder").setContentText("Tap to open").build())
            .setContentIntent(open)
            .setAutoCancel(true)
            .setWhen(it.at).setShowWhen(true);
        if (Build.VERSION.SDK_INT < 26) {
            // pre-O: sound/vibration live on the notification itself
            Uri snd = RingtoneManager.getDefaultUri(alarm ? RingtoneManager.TYPE_ALARM : RingtoneManager.TYPE_NOTIFICATION);
            if (alarm) b.setSound(snd, android.media.AudioManager.STREAM_ALARM); else b.setSound(snd);
            if (!AlarmScheduler.CHANNEL_SOUND_NO_VIBRATE.equals(chan) && !AlarmScheduler.CHANNEL_SILENT.equals(chan)) b.setVibrate(new long[]{0, 600, 300, 600});
            if (AlarmScheduler.CHANNEL_VIBRATE_ONLY.equals(chan) || AlarmScheduler.CHANNEL_SILENT.equals(chan)) b.setSound(null);
        }
        if (alarm) {
            b.setFullScreenIntent(open, true); // ignored (→ heads-up) when the full-screen permission is not granted
            b.setOngoing(false);
        }
        Notification n = b.build();
        if (alarm && Build.VERSION.SDK_INT < 26) n.flags |= Notification.FLAG_INSISTENT;
        try {
            NotificationManagerCompat.from(c).notify(it.id, n);
        } catch (SecurityException ignored) { /* POST_NOTIFICATIONS revoked */ }
    }
}
