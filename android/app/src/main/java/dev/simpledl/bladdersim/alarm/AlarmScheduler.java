package dev.simpledl.bladdersim.alarm;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import dev.simpledl.bladdersim.MainActivity;

/**
 * Native alarm path. Main events use AlarmManager.setAlarmClock() which is exempt from Doze /
 * App Standby and shows the alarm-clock icon; minor reminders use setExactAndAllowWhileIdle().
 * Falls back to inexact while-idle alarms only if the exact-alarm permission was revoked.
 */
public final class AlarmScheduler {
    static final String TAG = "BSAlarm";
    public static final String CHANNEL_ALARM = "bs_alarm_v2";
    public static final String CHANNEL_REMINDER = "bs_reminder_v2";
    /** v9 Prompt output: sound only (headphones) — sound on, vibration disabled. */
    public static final String CHANNEL_SOUND_NO_VIBRATE = "sound-no-vibrate";
    public static final String CHANNEL_VIBRATE_ONLY = "vibrate-only";
    public static final String CHANNEL_SILENT = "bs-silent";
    public static final String EXTRA_ID = "bs_alarm_id";
    public static final String EXTRA_FROM_ALARM = "bs_from_alarm";
    /** Missed alarms (device off / clock jump) younger than this are posted immediately on reschedule. */
    static final long MISSED_GRACE_MS = 15 * 60 * 1000L;

    private AlarmScheduler() {}

    public static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    static int piFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    }

    static PendingIntent firePi(Context c, int id) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction("dev.simpledl.bladdersim.ALARM_FIRE").putExtra(EXTRA_ID, id);
        return PendingIntent.getBroadcast(c, id, i, piFlags());
    }

    public static PendingIntent openAppPi(Context c, int id) {
        Intent i = new Intent(c, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_FROM_ALARM, true).putExtra(EXTRA_ID, id);
        return PendingIntent.getActivity(c, 100000 + id, i, piFlags());
    }

    /** Persist + arm. Re-arming the same id replaces the previous PendingIntent (no duplicates). */
    public static String schedule(Context c, AlarmStore.Item it) {
        AlarmStore.put(c, it);
        return arm(c, it);
    }

    static String arm(Context c, AlarmStore.Item it) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return "none";
        PendingIntent pi = firePi(c, it.id);
        String mode;
        try {
            if (canExact(c)) {
                if (it.isAlarm()) {
                    am.setAlarmClock(new AlarmManager.AlarmClockInfo(it.at, openAppPi(c, it.id)), pi);
                    mode = "alarmClock";
                } else if (Build.VERSION.SDK_INT >= 23) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, it.at, pi);
                    mode = "exactIdle";
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, it.at, pi);
                    mode = "exact";
                }
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, it.at, pi);
                mode = "inexactIdle";
            } else {
                am.set(AlarmManager.RTC_WAKEUP, it.at, pi);
                mode = "inexact";
            }
        } catch (SecurityException se) {
            Log.w(TAG, "exact alarm refused, falling back", se);
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, it.at, pi);
            else am.set(AlarmManager.RTC_WAKEUP, it.at, pi);
            mode = "inexactIdle";
        }
        return mode;
    }

    public static void cancel(Context c, int id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(firePi(c, id));
        AlarmStore.remove(c, id);
    }

    public static void cancelAll(Context c) {
        for (AlarmStore.Item i : AlarmStore.all(c)) cancel(c, i.id);
        AlarmStore.clear(c);
    }

    /** After boot / app update / clock change / permission change: re-arm everything persisted. */
    public static void rescheduleAll(Context c) {
        long now = System.currentTimeMillis();
        for (AlarmStore.Item i : AlarmStore.all(c)) {
            if (i.at > now) arm(c, i);
            else if (now - i.at <= MISSED_GRACE_MS) { AlarmStore.remove(c, i.id); AlarmReceiver.post(c, i); }
            else AlarmStore.remove(c, i.id);
        }
    }

    static String channelFor(AlarmStore.Item it) {
        String ch = it.channel == null ? "" : it.channel;
        if (CHANNEL_SOUND_NO_VIBRATE.equals(ch) || CHANNEL_VIBRATE_ONLY.equals(ch) || CHANNEL_SILENT.equals(ch)) return ch;
        return it.isAlarm() ? CHANNEL_ALARM : CHANNEL_REMINDER;
    }

    public static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ALARM) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ALARM, "Sim alarms (main events)", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Main event alarms. Plays on the ALARM stream so it can sound in Do Not Disturb / Bedtime when alarms are allowed.");
            Uri snd = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (snd == null) snd = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            ch.setSound(snd, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 600, 300, 600, 300, 600});
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            ch.setBypassDnd(true); // only honoured if the user grants it in channel settings
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CHANNEL_REMINDER) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_REMINDER, "Sim reminders (spasms, hydration)", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Minor events and hydration reminders. Default notification sound; respects silent / DND.");
            ch.enableVibration(true);
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(ch);
        }
            if (nm.getNotificationChannel(CHANNEL_SOUND_NO_VIBRATE) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_SOUND_NO_VIBRATE, "Prompts: sound only (no vibration)", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Short sound, never vibrates. Plays through headphones when connected.");
            Uri snd = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            ch.setSound(snd, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(false);
            ch.setVibrationPattern(null);
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CHANNEL_VIBRATE_ONLY) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_VIBRATE_ONLY, "Prompts: vibrate only", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 400, 200, 400});
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CHANNEL_SILENT) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_SILENT, "Prompts: silent", NotificationManager.IMPORTANCE_LOW);
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(ch);
        }
    }
}
