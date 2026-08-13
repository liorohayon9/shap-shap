export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface Task {
  /** Small positive integer — doubles as the Android PendingIntent request code. */
  id: number;
  title: string;
  /** Epoch ms of the next time this should fire. */
  at: number;
  repeat: Repeat;
  /** True once the user has acknowledged it (non-repeating tasks only). */
  done: boolean;
  createdAt: number;
  /** What the speech engine actually heard, kept so a bad parse can be re-read. */
  transcript?: string;
}

export interface ParseResult {
  title: string;
  at: number;
  repeat: Repeat;
  /** True when no time was found in the speech and `at` is a fallback guess. */
  timeGuessed: boolean;
}
