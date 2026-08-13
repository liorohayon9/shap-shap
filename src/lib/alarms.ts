import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Task } from './types';

export interface AlarmPermissions {
  /** Android 12+ "Alarms & reminders" — without it, alarms fire late or not at all. */
  exactAlarm: boolean;
  /** Android 13+ POST_NOTIFICATIONS — the full-screen alarm rides on a notification. */
  notifications: boolean;
  /** True when the OS battery optimiser may kill us (Samsung/Xiaomi are aggressive). */
  batteryOptimized: boolean;
  /** Android 14+ can revoke full-screen intents, which downgrades the alarm to a banner. */
  fullScreen: boolean;
}

export interface AlarmPlugin {
  schedule(o: { id: number; title: string; at: number }): Promise<void>;
  cancel(o: { id: number }): Promise<void>;
  /** Named `status` rather than `checkPermissions` so it doesn't shadow Capacitor's own. */
  status(): Promise<AlarmPermissions>;
  requestExactAlarm(): Promise<void>;
  requestNotifications(): Promise<{ granted: boolean }>;
  requestIgnoreBatteryOptimization(): Promise<void>;
  requestFullScreenIntent(): Promise<void>;
}

const Native = registerPlugin<AlarmPlugin>('Alarm');

export const isNativeAlarm = (): boolean => Capacitor.isNativePlatform();

// -- Browser fallback --------------------------------------------------------
// Only fires while the tab is open. It exists so the flow can be tested in a
// browser; the real alarm is the native one inside the APK.

type WebFire = (task: Task) => void;
const webTimers = new Map<number, ReturnType<typeof setTimeout>>();
let webFire: WebFire | null = null;

export function onWebAlarm(fn: WebFire): void {
  webFire = fn;
}

function scheduleWeb(task: Task): void {
  cancelWeb(task.id);
  const delay = task.at - Date.now();
  // setTimeout saturates past ~24.8 days; those get picked up on next app open.
  if (delay < 0 || delay > 2_000_000_000) return;
  webTimers.set(
    task.id,
    setTimeout(() => {
      webTimers.delete(task.id);
      webFire?.(task);
    }, delay),
  );
}

function cancelWeb(id: number): void {
  const t = webTimers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    webTimers.delete(id);
  }
}

// -- Public API --------------------------------------------------------------

export async function scheduleAlarm(task: Task): Promise<void> {
  if (!isNativeAlarm()) {
    scheduleWeb(task);
    return;
  }
  await Native.schedule({ id: task.id, title: task.title, at: task.at });
}

export async function cancelAlarm(id: number): Promise<void> {
  if (!isNativeAlarm()) {
    cancelWeb(id);
    return;
  }
  await Native.cancel({ id });
}

/** Re-arms everything still in the future. Cheap, and self-heals a missed reboot. */
export async function resyncAlarms(tasks: Task[]): Promise<void> {
  const now = Date.now();
  await Promise.all(
    tasks.filter((t) => !t.done && t.at > now).map((t) => scheduleAlarm(t).catch(() => {})),
  );
}

const ALL_CLEAR: AlarmPermissions = {
  exactAlarm: true,
  notifications: true,
  batteryOptimized: false,
  fullScreen: true,
};

export async function checkPermissions(): Promise<AlarmPermissions> {
  if (!isNativeAlarm()) return ALL_CLEAR;
  try {
    return await Native.status();
  } catch {
    // Never let a plugin error turn into a permanent nag banner.
    return ALL_CLEAR;
  }
}

export const requestExactAlarm = () => Native.requestExactAlarm();
export const requestNotifications = () => Native.requestNotifications();
export const requestIgnoreBatteryOptimization = () => Native.requestIgnoreBatteryOptimization();
export const requestFullScreenIntent = () => Native.requestFullScreenIntent();
