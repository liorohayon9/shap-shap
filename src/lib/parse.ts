import * as chrono from 'chrono-node';
import type { ParseResult, Repeat } from './types';

/** Speech openers that carry no meaning: "remind me to call Mary" -> "call Mary". */
const OPENERS = [
  /^(?:hey|ok|okay|so|um+|uh+|er+)[,\s]+/i,
  /^(?:please\s+)?(?:can you\s+)?(?:remind me (?:that i need |that i have )?to|remind me|remember to|remember|don'?t let me forget to|don'?t forget to|make sure (?:that )?i|make sure to|i need to|i have to|i've got to|i gotta|i must|note to self[,:]?)\s+/i,
];

/**
 * Repetition markers. `keep` is what's left behind for chrono to read as a date,
 * so "every monday" still anchors to a Monday but "every day" leaves nothing.
 */
const REPEATS: Array<{ re: RegExp; repeat: Repeat; keep: string }> = [
  { re: /\bevery\s+week\s?day\b|\bevery\s+work\s?day\b|\bon\s+week\s?days\b|\bevery\s+weekday\b/i, repeat: 'weekdays', keep: '' },
  { re: /\bevery\s+(mon|tues|wednes|thurs|fri|satur|sun)day\b/i, repeat: 'weekly', keep: '$1day' },
  { re: /\bevery\s+week\b|\bweekly\b|\beach\s+week\b/i, repeat: 'weekly', keep: '' },
  { re: /\bevery\s+day\b|\bevery\s?day\b|\bdaily\b|\beach\s+day\b|\bevery\s+morning\b|\bevery\s+night\b|\bevery\s+evening\b/i, repeat: 'daily', keep: '' },
];

/** Words left dangling once the date phrase is cut out of the middle of a sentence. */
const DANGLING = /\s*\b(?:at|on|by|in|this|next|the|for|around|about)\s*$/i;
const LEADING_JUNK = /^\s*(?:at|on|by|in|and|to|,|\.)\s+/i;

const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const MINUTES: Record<string, number> = {
  'o five': 5, five: 5, ten: 10, fifteen: 15, twenty: 20, 'twenty five': 25, thirty: 30,
  'thirty five': 35, forty: 40, 'forty five': 45, fifty: 50, 'fifty five': 55,
};
const UNIT_RE = Object.keys(UNITS).join('|');
const MIN_RE = Object.keys(MINUTES).sort((a, b) => b.length - a.length).join('|');

/**
 * Speech engines sometimes return spelled-out times ("nine PM", "half past eight").
 * chrono only reads digits, so promote the unambiguous cases before parsing.
 * Only fires in time contexts so "call one of the guys" is left alone.
 */
function normalizeNumbers(text: string): string {
  let t = text;
  // "nine thirty" / "nine forty five" -> "9:30" / "9:45"  (compound first)
  t = t.replace(
    new RegExp(`\\b(${UNIT_RE})[\\s-](${MIN_RE})\\b`, 'gi'),
    (_m, h: string, mi: string) =>
      `${UNITS[h.toLowerCase()]}:${String(MINUTES[mi.toLowerCase()]).padStart(2, '0')}`,
  );
  // "half past eight" -> "8:30",  "quarter past eight" -> "8:15"
  t = t.replace(new RegExp(`\\bhalf past (${UNIT_RE})\\b`, 'gi'), (_m, h: string) => `${UNITS[h.toLowerCase()]}:30`);
  t = t.replace(new RegExp(`\\b(?:a )?quarter past (${UNIT_RE})\\b`, 'gi'), (_m, h: string) => `${UNITS[h.toLowerCase()]}:15`);
  t = t.replace(new RegExp(`\\b(?:a )?quarter to (${UNIT_RE})\\b`, 'gi'), (_m, h: string) => {
    const n = UNITS[h.toLowerCase()];
    return `${n === 1 ? 12 : n - 1}:45`;
  });
  // "nine PM" / "nine o'clock" -> "9 PM"
  t = t.replace(
    new RegExp(`\\b(${UNIT_RE})\\s+(am|pm|a\\.m\\.|p\\.m\\.|o'?clock)\\b`, 'gi'),
    (_m, h: string, suf: string) => `${UNITS[h.toLowerCase()]} ${suf}`,
  );
  // "at nine" -> "at 9"
  t = t.replace(new RegExp(`\\bat\\s+(${UNIT_RE})\\b`, 'gi'), (_m, h: string) => `at ${UNITS[h.toLowerCase()]}`);
  return t;
}

function stripOpeners(text: string): string {
  let out = text.trim();
  let changed = true;
  // Openers stack: "hey, remind me to ..." needs two passes.
  while (changed) {
    changed = false;
    for (const re of OPENERS) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out.trim();
}

function extractRepeat(text: string): { text: string; repeat: Repeat } {
  for (const { re, repeat, keep } of REPEATS) {
    if (re.test(text)) {
      return { text: text.replace(re, keep).replace(/\s{2,}/g, ' ').trim(), repeat };
    }
  }
  return { text, repeat: 'none' };
}

function tidyTitle(raw: string): string {
  let t = raw.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(LEADING_JUNK, '');
  // Cutting "the first of September" out of "pay rent on the first of September"
  // leaves "pay rent on the" — strip dangling words until none are left.
  for (let i = 0; i < 5; i++) {
    const next = t.replace(DANGLING, '');
    if (next === t) break;
    t = next;
  }
  t = t.replace(/[\s,.;]+$/, '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Default when speech contained no time at all: the next 9:00 AM.
 * Flagged as a guess so the confirm screen can make the user look at it.
 */
function nextNineAm(now: Date): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(9, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

export function parseSpeech(input: string, now: Date = new Date()): ParseResult {
  const cleaned = normalizeNumbers(stripOpeners(input));
  const { text, repeat } = extractRepeat(cleaned);

  // forwardDate: "at 9" said at 10pm means tomorrow morning, never a past time.
  const results = chrono.parse(text, now, { forwardDate: true });
  const hit = results[0];

  if (!hit) {
    return {
      title: tidyTitle(text) || 'Reminder',
      at: nextNineAm(now).getTime(),
      repeat,
      timeGuessed: true,
    };
  }

  const title = tidyTitle(text.slice(0, hit.index) + ' ' + text.slice(hit.index + hit.text.length));

  let at = hit.date();
  at.setSeconds(0, 0);

  // "meeting at 3:30" means half past three in the afternoon, but chrono reads a
  // bare hour as AM. Nobody schedules a reminder for 3:30am; 6-11 stay AM because
  // those are real wake-up times.
  if (hit.start.isCertain('hour') && !hit.start.isCertain('meridiem')) {
    const h = at.getHours();
    if (h >= 1 && h <= 5) at.setHours(h + 12);
  }

  // chrono can still land in the past for bare weekday names on the same day.
  if (at.getTime() <= now.getTime()) {
    const bumped = new Date(at);
    bumped.setDate(bumped.getDate() + (repeat === 'weekly' ? 7 : 1));
    at = bumped;
  }

  return {
    title: title || 'Reminder',
    at: at.getTime(),
    repeat,
    timeGuessed: false,
  };
}

/** Where a repeating task lands after it fires. Returns null for one-off tasks. */
export function nextOccurrence(at: number, repeat: Repeat, after: Date = new Date()): number | null {
  if (repeat === 'none') return null;
  const d = new Date(at);
  const guard = 400; // never loop forever on a malformed date
  for (let i = 0; i < guard; i++) {
    if (repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
    else {
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    }
    if (d.getTime() > after.getTime()) return d.getTime();
  }
  return null;
}
