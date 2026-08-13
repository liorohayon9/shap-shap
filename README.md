# Shap Shap

Speak a reminder, get an alarm that won't let you forget it.

Tap the button, say *"call Mary at nine pm"*, confirm what it heard — and at 9pm the
phone wakes up, rings on the alarm channel, and shows a full-screen prompt that only
goes away when you hold a button for three seconds.

## How it works

| Stage | What happens | Where |
| --- | --- | --- |
| Listen | Android's own speech recogniser turns speech into text | on the device, free, no API key |
| Understand | `src/lib/parse.ts` pulls out the task, the time, and any repeat | on the device, offline |
| Confirm | One screen to fix a misheard word or time before it's saved | — |
| Ring | `AlarmManager.setAlarmClock` → foreground service → full-screen activity | native Android |

Nothing leaves the phone. There is no server and no account.

## Two ways to run it

**As a web app (PWA).** Open the GitHub Pages link, *Add to Home Screen*. Works
offline and looks like an app, but the browser can only ring while it's open — good
for trying the flow, not for real reminders.

**As an APK.** Download `shap-shap.apk` from the
[latest release](../../releases/latest) and tap it. This is the real thing: alarms
are registered with the operating system, so they fire with the app closed, the
screen off, and no internet.

## Android settings that matter

The app checks these on launch and offers a one-tap fix for any that are missing:

- **Notifications** — the full-screen alarm is delivered as one.
- **Alarms & reminders** — without it Android is free to delay an alarm by minutes.
- **Full-screen alarms** — Android 14+ can revoke this, which downgrades the alarm to a banner.
- **Battery optimisation** — Samsung and Xiaomi will kill background apps unless told not to.

Alarms are re-armed after a reboot (`BootReceiver`) and re-checked every time the
app is opened.

## Development

```bash
npm install
npm run dev        # browser, with a fake in-page alarm for testing the flow
npm run build      # typecheck + production build
npm run icons      # regenerate every icon from scripts/make-icons.mjs
npm run sync       # build, then copy the web app into the Android project
```

Building the APK locally needs the Android SDK and JDK 21. If you'd rather not
install them, push to `main` — GitHub Actions builds it and attaches the APK to the
`latest` release.

### Layout

```
src/lib/parse.ts     speech text -> { title, time, repeat }
src/lib/alarms.ts    JS side of the native bridge, with a browser fallback
android/app/src/main/java/com/lior/shapshap/
  AlarmScheduler.java   registers the alarm with the OS
  AlarmService.java     rings, vibrates, holds the wake lock
  AlarmActivity.java    the hold-to-dismiss screen
```

### Signing

Android identifies an app by package name **plus signing key**, so the key can
never change or updates stop installing over the existing app. The key lives in
two repo secrets, `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD`, and the
build fails loudly if either is missing rather than shipping an APK nobody can
install.

A backup of the key sits outside the repo, on the Desktop:

```
shap-shap-signing-key-BACKUP.p12
shap-shap-signing-key-BACKUP.password.txt
```

Keep them. Losing both means never being able to update an installed copy again —
the only way back is uninstalling the app on every phone that has it.
