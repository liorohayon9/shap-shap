package com.lior.remindme;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * The alarm screen. Shows over the lock screen, turns the display on, and
 * refuses to go away until the button is held down for a full three seconds.
 */
public class AlarmActivity extends Activity {

    private static final long HOLD_MS = 3000L;

    private View fill;
    private TextView label;
    private ValueAnimator animator;
    private int alarmId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOverLockScreen();
        setContentView(R.layout.activity_alarm);

        alarmId = getIntent().getIntExtra(AlarmScheduler.EXTRA_ID, 0);
        String title = getIntent().getStringExtra(AlarmScheduler.EXTRA_TITLE);
        long at = getIntent().getLongExtra(AlarmScheduler.EXTRA_AT, System.currentTimeMillis());

        ((TextView) findViewById(R.id.alarm_title)).setText(title == null ? "Reminder" : title);
        ((TextView) findViewById(R.id.alarm_time))
                .setText(new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date(at)));

        fill = findViewById(R.id.hold_fill);
        label = findViewById(R.id.hold_label);
        View hold = findViewById(R.id.hold_button);
        hold.setOnTouchListener(this::onHoldTouch);
    }

    private void showOverLockScreen() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = getSystemService(KeyguardManager.class);
            // Wakes the display without unlocking — he still has to hold the button.
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
    }

    private boolean onHoldTouch(View view, MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                view.performClick();
                startHold(view.getWidth());
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                cancelHold();
                return true;
            default:
                return false;
        }
    }

    private void startHold(int width) {
        cancelHold();
        label.setText(R.string.hold_keep_going);
        animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(HOLD_MS);
        animator.addUpdateListener(a -> {
            float p = (float) a.getAnimatedValue();
            fill.getLayoutParams().width = (int) (width * p);
            fill.requestLayout();
            if (p >= 1f) dismiss();
        });
        animator.start();
    }

    private void cancelHold() {
        if (animator != null) {
            animator.cancel();
            animator = null;
        }
        if (fill != null) {
            fill.getLayoutParams().width = 0;
            fill.requestLayout();
        }
        if (label != null) label.setText(R.string.hold_to_dismiss);
    }

    private void dismiss() {
        if (animator != null) {
            animator.cancel();
            animator = null;
        }
        startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACTION_DISMISS));
        finish();
    }

    /** No escape by back button — holding the button is the only way out. */
    @Override
    public void onBackPressed() {
        // Intentionally empty.
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    protected void onDestroy() {
        if (animator != null) animator.cancel();
        super.onDestroy();
    }
}
