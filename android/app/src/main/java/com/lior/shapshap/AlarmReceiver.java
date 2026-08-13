package com.lior.shapshap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

/**
 * Fired by AlarmManager at the scheduled minute. Hands straight over to the
 * foreground service — a receiver only gets ~10 seconds of life.
 */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra(AlarmScheduler.EXTRA_ID, 0);
        String title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE);
        long at = intent.getLongExtra(AlarmScheduler.EXTRA_AT, System.currentTimeMillis());

        // It has fired; the JS side owns any repeat and will re-arm on next open.
        AlarmStore.remove(context, id);

        Intent service = new Intent(context, AlarmService.class)
                .setAction(AlarmService.ACTION_RING)
                .putExtra(AlarmScheduler.EXTRA_ID, id)
                .putExtra(AlarmScheduler.EXTRA_TITLE, title == null ? "Reminder" : title)
                .putExtra(AlarmScheduler.EXTRA_AT, at);

        // Starting a foreground service from the background is normally blocked,
        // but delivery from setAlarmClock is an explicit exemption.
        ContextCompat.startForegroundService(context, service);
    }
}
