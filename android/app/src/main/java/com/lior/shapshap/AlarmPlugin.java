package com.lior.shapshap;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** The JavaScript-facing surface: arm an alarm, cancel one, and check the four
 *  OS settings that decide whether it will actually be allowed to ring. */
@CapacitorPlugin(
        name = "Alarm",
        permissions = {
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
        })
public class AlarmPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        long at = call.getData().optLong("at", 0L);
        String title = call.getString("title", "Reminder");

        if (id == null || at <= 0) {
            call.reject("schedule needs an id and a time");
            return;
        }
        AlarmScheduler.schedule(getContext(), id, title, at);
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("cancel needs an id");
            return;
        }
        AlarmScheduler.cancel(getContext(), id);
        call.resolve();
    }

    /** Returns how recently-fired alarms ended, and clears the log. */
    @PluginMethod
    public void takeEvents(PluginCall call) {
        JSObject out = new JSObject();
        out.put("json", AlarmStore.takeEvents(getContext()));
        call.resolve(out);
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        JSObject out = new JSObject();
        out.put("exactAlarm", AlarmScheduler.canScheduleExact(ctx));
        out.put("notifications", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        out.put("batteryOptimized", isBatteryOptimized(ctx));
        out.put("fullScreen", canUseFullScreenIntent(ctx));
        call.resolve(out);
    }

    private boolean isBatteryOptimized(Context ctx) {
        PowerManager pm = ctx.getSystemService(PowerManager.class);
        if (pm == null) return false;
        return !pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    private boolean canUseFullScreenIntent(Context ctx) {
        // Android 14 made this revocable; below that it is granted at install.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        return nm != null && nm.canUseFullScreenIntent();
    }

    @PluginMethod
    public void requestExactAlarm(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, true);
        }
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        // Deliberately the direct request dialog rather than the settings list —
        // one tap instead of hunting through a menu.
        openSettings(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, true);
        call.resolve();
    }

    @PluginMethod
    public void requestFullScreenIntent(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            openSettings(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, true);
        }
        call.resolve();
    }

    private void openSettings(String action, boolean withPackage) {
        Context ctx = getContext();
        Intent intent = new Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (withPackage) {
            intent.setData(Uri.fromParts("package", ctx.getPackageName(), null));
        }
        try {
            ctx.startActivity(intent);
        } catch (RuntimeException e) {
            // Some OEM builds hide these screens; fall back to the app info page.
            ctx.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.fromParts("package", ctx.getPackageName(), null))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject out = new JSObject();
            out.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
            call.resolve(out);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsResult");
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", getPermissionState("notifications").toString().equals("granted"));
        call.resolve(out);
    }
}
