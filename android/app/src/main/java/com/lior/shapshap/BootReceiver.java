package com.lior.shapshap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.util.List;

/**
 * AlarmManager drops every alarm on reboot (and on app update). Put them back
 * before the user notices, rather than waiting for them to open the app.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        if (!action.equals(Intent.ACTION_BOOT_COMPLETED)
                && !action.equals(Intent.ACTION_MY_PACKAGE_REPLACED)
                && !action.equals("android.intent.action.QUICKBOOT_POWERON")) {
            return;
        }

        long now = System.currentTimeMillis();
        List<AlarmStore.Entry> entries = AlarmStore.all(context);
        for (AlarmStore.Entry e : entries) {
            if (e.at > now) {
                AlarmScheduler.schedule(context, e.id, e.title, e.at);
            } else {
                // Missed while powered off — the app surfaces it as "Missed" on open.
                AlarmStore.remove(context, e.id);
            }
        }
    }
}
