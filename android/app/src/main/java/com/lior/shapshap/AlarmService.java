package com.lior.shapshap;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Holds the ring: sound on the alarm stream, vibration, a wake lock, and the
 * full-screen notification that puts AlarmActivity over the lock screen.
 */
public class AlarmService extends Service {

    static final String ACTION_RING = "com.lior.shapshap.RING";
    static final String ACTION_DISMISS = "com.lior.shapshap.DISMISS";

    private static final String CHANNEL_ALARM = "alarm";
    private static final String CHANNEL_MISSED = "missed";
    private static final int NOTIFICATION_ID = 42;

    /** Ring for this long, then fall back to a silent notification so the phone survives the day. */
    private static final long RING_TIMEOUT_MS = 15 * 60 * 1000L;
    private static final long[] VIBRATE_PATTERN = {0, 700, 500};

    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable timeout;

    private int alarmId;
    private String alarmTitle = "Reminder";
    private long alarmAt;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_DISMISS.equals(intent.getAction())) {
            stopEverything(true);
            return START_NOT_STICKY;
        }

        if (intent != null) {
            alarmId = intent.getIntExtra(AlarmScheduler.EXTRA_ID, 0);
            String title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE);
            if (title != null && !title.isEmpty()) alarmTitle = title;
            alarmAt = intent.getLongExtra(AlarmScheduler.EXTRA_AT, System.currentTimeMillis());
        }

        createChannels();
        startForegroundRinging();
        acquireWakeLock();
        startSound();
        startVibration();
        launchAlarmScreen();

        timeout = () -> stopEverything(false);
        handler.postDelayed(timeout, RING_TIMEOUT_MS);

        // Redelivering a half-finished alarm on restart would ring at the wrong time.
        return START_NOT_STICKY;
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel alarm = new NotificationChannel(
                CHANNEL_ALARM, "Alarms", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("The reminder alarm ringing");
        // The service owns sound and vibration so it can loop them.
        alarm.setSound(null, null);
        alarm.enableVibration(false);
        alarm.setBypassDnd(true);
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(alarm);

        NotificationChannel missed = new NotificationChannel(
                CHANNEL_MISSED, "Missed reminders", NotificationManager.IMPORTANCE_DEFAULT);
        missed.setDescription("Left behind when an alarm rang out unanswered");
        nm.createNotificationChannel(missed);
    }

    private PendingIntent alarmScreenIntent() {
        Intent intent = new Intent(this, AlarmActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
                .putExtra(AlarmScheduler.EXTRA_ID, alarmId)
                .putExtra(AlarmScheduler.EXTRA_TITLE, alarmTitle)
                .putExtra(AlarmScheduler.EXTRA_AT, alarmAt);
        return PendingIntent.getActivity(
                this, alarmId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void startForegroundRinging() {
        PendingIntent screen = alarmScreenIntent();

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ALARM)
                .setSmallIcon(R.drawable.ic_alarm)
                .setContentTitle(alarmTitle)
                .setContentText("Reminder — tap to open")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(screen)
                // The part that wakes the screen on a locked phone.
                .setFullScreenIntent(screen, true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                    this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    /**
     * The notification alone is enough on a locked phone. On an unlocked one a
     * full-screen intent only shows a heads-up, so ask for the screen directly.
     */
    private void launchAlarmScreen() {
        try {
            startActivity(new Intent(this, AlarmActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    .putExtra(AlarmScheduler.EXTRA_ID, alarmId)
                    .putExtra(AlarmScheduler.EXTRA_TITLE, alarmTitle)
                    .putExtra(AlarmScheduler.EXTRA_AT, alarmAt));
        } catch (RuntimeException ignored) {
            // Background activity start refused — the full-screen intent covers us.
        }
    }

    private void acquireWakeLock() {
        PowerManager pm = getSystemService(PowerManager.class);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "shapshap:alarm");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(RING_TIMEOUT_MS + 60_000L);
    }

    private void startSound() {
        Uri tone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (tone == null) tone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (tone == null) return;
        try {
            player = new MediaPlayer();
            player.setDataSource(this, tone);
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception e) {
            player = null; // Silent is survivable; vibration and the screen still fire.
        }
    }

    private void startVibration() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = getSystemService(VibratorManager.class);
            vibrator = vm == null ? null : vm.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        }
        if (vibrator == null || !vibrator.hasVibrator()) return;

        VibrationEffect effect = VibrationEffect.createWaveform(VIBRATE_PATTERN, 0);
        vibrator.vibrate(effect, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build());
    }

    /** @param dismissed true when the user answered it, false when it simply rang out. */
    private void stopEverything(boolean dismissed) {
        if (timeout != null) handler.removeCallbacks(timeout);

        if (player != null) {
            try {
                player.stop();
            } catch (IllegalStateException ignored) {
            }
            player.release();
            player = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;

        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);

        if (!dismissed) {
            postMissed();
        }
        stopSelf();
    }

    private void postMissed() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        Notification missed = new NotificationCompat.Builder(this, CHANNEL_MISSED)
                .setSmallIcon(R.drawable.ic_alarm)
                .setContentTitle("Missed: " + alarmTitle)
                .setContentText("The alarm rang out. Tap to open.")
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(
                        this, alarmId, new Intent(this, MainActivity.class),
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .build();
        nm.notify(NOTIFICATION_ID + alarmId, missed);
    }

    @Override
    public void onDestroy() {
        stopEverything(true);
        super.onDestroy();
    }
}
