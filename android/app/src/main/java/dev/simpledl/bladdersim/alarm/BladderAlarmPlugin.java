package dev.simpledl.bladdersim.alarm;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** JS: Capacitor.Plugins.BladderAlarm */
@CapacitorPlugin(name = "BladderAlarm", permissions = {
    @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
})
public class BladderAlarmPlugin extends Plugin {

    @Override
    public void load() { AlarmScheduler.ensureChannels(getContext()); }

    private Context ctx() { return getContext(); }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        Long at = call.getLong("at");
        // v13b: JS numbers with a fractional part arrive as Double and getLong() returns null → accept them.
        if (at == null) { Double d = call.getDouble("at"); if (d != null) at = (long) Math.floor(d); }
        if (id == null || at == null) { call.reject("id and at are required"); return; }
        AlarmStore.Item it = new AlarmStore.Item();
        it.id = id; it.at = at;
        it.title = call.getString("title", "Bladder Sim");
        it.body = call.getString("body", "");
        it.kind = call.getString("kind", "alarm");
        it.channel = call.getString("channel", "");
        String mode = AlarmScheduler.schedule(ctx(), it);
        JSObject r = new JSObject(); r.put("id", id); r.put("at", at); r.put("mode", mode);
        call.resolve(r);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) { call.reject("id required"); return; }
        AlarmScheduler.cancel(ctx(), id);
        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) { AlarmScheduler.cancelAll(ctx()); call.resolve(); }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSArray arr = new JSArray();
        for (AlarmStore.Item i : AlarmStore.all(ctx())) {
            JSObject o = new JSObject(); o.put("id", i.id); o.put("at", i.at); o.put("kind", i.kind); arr.put(o);
        }
        JSObject r = new JSObject(); r.put("alarms", arr); call.resolve(r);
    }

    private boolean batteryUnrestricted() {
        if (Build.VERSION.SDK_INT < 23) return true;
        PowerManager pm = (PowerManager) ctx().getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx().getPackageName());
    }

    private boolean fullScreenAllowed() {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = (NotificationManager) ctx().getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.canUseFullScreenIntent();
    }

    private boolean alarmChannelOk() {
        if (Build.VERSION.SDK_INT < 26) return true;
        NotificationManager nm = (NotificationManager) ctx().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        android.app.NotificationChannel ch = nm.getNotificationChannel(AlarmScheduler.CHANNEL_ALARM);
        return ch == null || ch.getImportance() >= NotificationManager.IMPORTANCE_HIGH;
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject r = new JSObject();
        r.put("notifications", NotificationManagerCompat.from(ctx()).areNotificationsEnabled() ? "granted" : "denied");
        r.put("exactAlarm", AlarmScheduler.canExact(ctx()) ? "granted" : "denied");
        r.put("batteryUnrestricted", batteryUnrestricted());
        r.put("fullScreen", fullScreenAllowed());
        r.put("alarmChannelHigh", alarmChannelOk());
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("manufacturer", Build.MANUFACTURER);
        call.resolve(r);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notifPermCallback");
            return;
        }
        if (!NotificationManagerCompat.from(ctx()).areNotificationsEnabled()) openAppNotificationSettings();
        checkPermissions(call);
    }

    @PermissionCallback
    private void notifPermCallback(PluginCall call) { checkPermissions(call); }

    private void start(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { ctx().startActivity(i); }
        catch (Exception e) {
            Intent f = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx().getPackageName()));
            f.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(f);
        }
    }

    private void openAppNotificationSettings() {
        if (Build.VERSION.SDK_INT >= 26) start(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx().getPackageName()));
        else start(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx().getPackageName())));
    }

    @PluginMethod
    public void requestExactAlarm(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31 && !AlarmScheduler.canExact(ctx())) {
            start(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23 && !batteryUnrestricted()) {
            start(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) start(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx().getPackageName())));
        else openAppNotificationSettings();
        call.resolve();
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) { openAppNotificationSettings(); call.resolve(); }

    @PluginMethod
    public void openAlarmChannelSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            start(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, ctx().getPackageName())
                .putExtra(Settings.EXTRA_CHANNEL_ID, AlarmScheduler.CHANNEL_ALARM));
        } else openAppNotificationSettings();
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        start(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx().getPackageName())));
        call.resolve();
    }

    // ---- v20 DryClip night: keep the process / screen awake while JS holds the BLE link ----
    private PowerManager.WakeLock nightWake;
    private boolean keepScreen;

    @PluginMethod
    public void setKeepAwake(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        boolean screen = call.getBoolean("screenOn", true);
        getActivity().runOnUiThread(() -> {
            try {
                android.view.Window w = getActivity().getWindow();
                if (on && screen) {
                    w.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    keepScreen = true;
                } else if (keepScreen) {
                    w.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    keepScreen = false;
                }
            } catch (Exception e) { /* activity may be gone */ }
        });
        try {
            if (on) {
                if (nightWake == null) {
                    PowerManager pm = (PowerManager) ctx().getSystemService(Context.POWER_SERVICE);
                    if (pm != null) {
                        nightWake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BladderSim:dryclipNight");
                        nightWake.setReferenceCounted(false);
                    }
                }
                if (nightWake != null && !nightWake.isHeld()) nightWake.acquire(12L * 60 * 60 * 1000); // max 12 h
            } else if (nightWake != null && nightWake.isHeld()) {
                nightWake.release();
            }
        } catch (Exception e) {
            call.reject("setKeepAwake failed: " + e.getMessage());
            return;
        }
        JSObject r = new JSObject();
        r.put("on", on);
        r.put("screenOn", screen && on);
        call.resolve(r);
    }

    @PluginMethod
    public void isKeepAwake(PluginCall call) {
        JSObject r = new JSObject();
        r.put("on", nightWake != null && nightWake.isHeld());
        r.put("screenOn", keepScreen);
        call.resolve(r);
    }
}
