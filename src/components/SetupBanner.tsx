import type { AlarmPermissions } from '../lib/alarms';
import {
  requestExactAlarm,
  requestFullScreenIntent,
  requestIgnoreBatteryOptimization,
  requestNotifications,
} from '../lib/alarms';

interface Props {
  permissions: AlarmPermissions;
  onRecheck: () => void;
}

/**
 * The three OS settings that decide whether an alarm actually fires.
 * Worth nagging about once, up front, rather than debugging "it didn't ring" later.
 */
export function SetupBanner({ permissions, onRecheck }: Props) {
  const items: Array<{ key: string; text: string; action: () => Promise<unknown> }> = [];

  if (!permissions.notifications) {
    items.push({
      key: 'notif',
      text: 'Allow notifications',
      action: () => requestNotifications(),
    });
  }
  if (!permissions.exactAlarm) {
    items.push({
      key: 'exact',
      text: 'Allow alarms & reminders',
      action: () => requestExactAlarm(),
    });
  }
  if (!permissions.fullScreen) {
    items.push({
      key: 'fullscreen',
      text: 'Allow full-screen alarms',
      action: () => requestFullScreenIntent(),
    });
  }
  if (permissions.batteryOptimized) {
    items.push({
      key: 'battery',
      text: 'Stop battery optimisation',
      action: () => requestIgnoreBatteryOptimization(),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="setup">
      <p className="setup__title">Finish setup so alarms can ring</p>
      <ul className="setup__list">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              className="setup__btn"
              onClick={() => {
                void it.action().finally(() => setTimeout(onRecheck, 500));
              }}
            >
              {it.text}
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
