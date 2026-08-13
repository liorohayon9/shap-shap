package com.lior.remindme;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

final class AlarmScheduler {

    static final String EXTRA_ID = "alarm_id";
    static final String EXTRA_TITLE = "alarm_title";
    static final String EXTRA_AT = "alarm_at";

    private AlarmScheduler() {}

    private static PendingIntent firePendingIntent(Context ctx, int id, String title, long at) {
        Intent intent = new Intent(ctx, AlarmReceiver.class)
                // Unique action per id: otherwise Intent.filterEquals() treats every
                // alarm as the same one and they overwrite each other.
                .setAction("com.lior.remindme.FIRE." + id)
                .putExtra(EXTRA_ID, id)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_AT, at);
        return PendingIntent.getBroadcast(
                ctx, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean canScheduleExact(Context ctx) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return am.canScheduleExactAlarms();
        return true;
    }

    static void schedule(Context ctx, int id, String title, long at) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return;

        PendingIntent fire = firePendingIntent(ctx, id, title, at);
        // Tapping the status-bar alarm chip opens the app.
        PendingIntent show = PendingIntent.getActivity(
                ctx, id, new Intent(ctx, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        try {
            // setAlarmClock is the only API that survives Doze and battery saver
            // untouched — it is what the stock Clock app uses.
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
        } catch (SecurityException e) {
            // Exact-alarm permission revoked. Something inexact still beats silence.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
        AlarmStore.put(ctx, id, title, at);
    }

    static void cancel(Context ctx, int id) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am != null) {
            am.cancel(firePendingIntent(ctx, id, "", 0));
        }
        AlarmStore.remove(ctx, id);
    }
}
