import type { Task } from './types';

const TASKS_KEY = 'alarm.tasks.v1';
const SEQ_KEY = 'alarm.seq.v1';

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is Task => typeof t?.id === 'number' && typeof t?.title === 'string');
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // Storage full or blocked (private mode) — the scheduled alarm still stands.
  }
}

/**
 * Small sequential ids. Android uses these directly as PendingIntent request
 * codes, which must fit in an int, so wrap well below 2^31.
 */
export function nextId(): number {
  const current = Number(localStorage.getItem(SEQ_KEY) ?? '0');
  const next = Number.isFinite(current) && current > 0 ? (current % 1_000_000) + 1 : 1;
  localStorage.setItem(SEQ_KEY, String(next));
  return next;
}

export function sortByTime(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.at - b.at);
}
