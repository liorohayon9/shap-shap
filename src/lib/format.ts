import type { Repeat } from './types';

const DAY = 86_400_000;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function formatTime(at: number): string {
  return new Date(at)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');
}

/** "Today", "Tomorrow", "Sat", or "Sat 12 Sep" once it's more than a week out. */
export function formatDay(at: number, now: Date = new Date()): string {
  const days = Math.round((startOfDay(new Date(at)) - startOfDay(now)) / DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  const d = new Date(at);
  if (days > 1 && days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatWhen(at: number, now: Date = new Date()): string {
  return `${formatDay(at, now)} at ${formatTime(at)}`;
}

export function repeatLabel(r: Repeat): string {
  switch (r) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return 'Weekdays';
    case 'weekly':
      return 'Every week';
    default:
      return 'Once';
  }
}

/** "in 3 hours", "in 12 minutes", "now" — the reassurance line under a new task. */
export function formatCountdown(at: number, now: number = Date.now()): string {
  const ms = at - now;
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'in less than a minute';
  if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Local <input type="datetime-local"> value for an epoch ms. */
export function toLocalInput(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
