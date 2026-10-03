// "When did it happen?" for the event log (06a EVT-010, EVT-020; 07 DATA-090; round 2 Log decision 2026-10-03).
// A day strip (today and the 6 days before) and five evenly spaced parts of the day. A part of the day is stored as
// `occurred_period` with a fixed clock time, so the app never shows a made-up time. Null = the exact time "now".
import { addDays, atLocalTime, toLocalDate, type LocalDate } from './dates';

export type Period = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

/** Left to right on the slider. */
export const PERIODS: readonly Period[] = ['morning', 'noon', 'afternoon', 'evening', 'night'];

/**
 * Hours each part covers (design choice): morning 05:00-10:59, noon 11:00-13:59, afternoon 14:00-16:59,
 * evening 17:00-20:59, night 21:00-04:59. Night belongs to the day it started, so its hours run to 29 (05:00 next day).
 */
const FROM = [5, 11, 14, 17, 21];
const TO = [11, 14, 17, 21, 29];

/** The time saved for each part of the day (EVT-010). Night is 23:00 on the day it started. */
export const PERIOD_TIME: Record<Period, string> = {
  morning: '08:00',
  noon: '12:30',
  afternoon: '15:30',
  evening: '19:00',
  night: '23:00',
};

/** Night covers 8 hours but takes only this much track after its stop, so the five stops stay evenly spaced. */
export const NIGHT_SPAN = 0.2;
/** The track runs from Morning (0) to the end of the night stretch. */
export const TRACK_END = PERIODS.length - 1 + NIGHT_SPAN;

/** Hours since midnight, with 00:00-04:59 counted as 24-29 of the previous day. */
function hourOfLogicalDay(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  return h < 5 ? h + 24 : h;
}

/** The day a clock time belongs to: before 05:00 it is still the night of the day before. */
export function logicalDay(d: Date): LocalDate {
  const today = toLocalDate(d);
  return d.getHours() < 5 ? addDays(today, -1) : today;
}

/** The part of the day a clock time falls in. */
export function periodOf(d: Date): Period {
  const h = hourOfLogicalDay(d);
  const i = FROM.findIndex((f, j) => h >= f && h < TO[j]);
  return PERIODS[Math.max(0, i)];
}

/** Position of a clock time on the slider (0 = Morning … 4 = Night, up to TRACK_END late at night). */
export function positionOf(d: Date): number {
  const h = hourOfLogicalDay(d);
  const i = Math.max(
    0,
    FROM.findIndex((f, j) => h >= f && h < TO[j])
  );
  const share = (h - FROM[i]) / (TO[i] - FROM[i]);
  return i + share * (i === PERIODS.length - 1 ? NIGHT_SPAN : 1);
}

/** The 7 days of the strip, oldest first, ending with the calendar today. */
export function stripDays(now: Date): LocalDate[] {
  const today = toLocalDate(now);
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

/** The day the strip opens on: today, or yesterday between 00:00 and 04:59 (night rule). */
export function defaultDay(now: Date): LocalDate {
  return logicalDay(now);
}

/** The Now marker shows only on the day "now" belongs to. */
export function hasNow(day: LocalDate, now: Date): boolean {
  return day === logicalDay(now);
}

/** A day that has not started yet: the calendar today between 00:00 and 04:59 (all of it is still to come). */
export function dayInFuture(day: LocalDate, now: Date): boolean {
  return day > logicalDay(now);
}

/** Parts of the day that can be picked on `day`: on the Now day, only up to the current part (the rest is future). */
export function pickable(day: LocalDate, now: Date): Period[] {
  if (dayInFuture(day, now)) return [];
  if (!hasNow(day, now)) return [...PERIODS];
  const cur = PERIODS.indexOf(periodOf(now));
  return PERIODS.slice(0, cur + 1);
}

/** What the slider holds: a part of the day, or the exact time now. */
export type When = Period | 'now';

/** Slider stops in order, each with its track position. "now" sits at the real clock position on the Now day. */
export function stops(day: LocalDate, now: Date): { value: When; pos: number }[] {
  const out: { value: When; pos: number }[] = pickable(day, now).map((p) => ({ value: p, pos: PERIODS.indexOf(p) }));
  if (hasNow(day, now)) out.push({ value: 'now', pos: positionOf(now) });
  return out.sort((a, b) => a.pos - b.pos);
}

/** Keep the choice valid when the day changes: "now" off its day becomes the current part; a future part becomes "now". */
export function adjustForDay(value: When, day: LocalDate, now: Date): When {
  const ok = pickable(day, now);
  if (value === 'now') return hasNow(day, now) ? 'now' : ok.length ? (ok.includes(periodOf(now)) ? periodOf(now) : ok[ok.length - 1]) : 'now';
  if (ok.includes(value)) return value;
  return hasNow(day, now) ? 'now' : ok[ok.length - 1] ?? 'now';
}

/** The stop nearest to a track position (a tap or drag on the track snaps to it). */
export function nearestStop(day: LocalDate, now: Date, pos: number): When | null {
  const list = stops(day, now);
  if (!list.length) return null;
  return list.reduce((best, s) => (Math.abs(s.pos - pos) < Math.abs(best.pos - pos) ? s : best)).value;
}

/** One stop left or right (arrow keys, screen-reader swipes), or the first / last stop (Home / End). */
export function stepStop(day: LocalDate, now: Date, value: When, move: -1 | 1 | 'first' | 'last'): When {
  const list = stops(day, now);
  if (!list.length) return value;
  if (move === 'first') return list[0].value;
  if (move === 'last') return list[list.length - 1].value;
  const i = Math.max(
    0,
    list.findIndex((s) => s.value === value)
  );
  return list[Math.max(0, Math.min(list.length - 1, i + move))].value;
}

/** What is saved (DATA-090): the clock time, its calendar date fields and the part of the day (null = exact "now"). */
export function savedTime(day: LocalDate, value: When, now: Date): { at: Date; localDate: LocalDate; period: Period | null } {
  if (value === 'now') return { at: now, localDate: day, period: null };
  const at = atLocalTime(day, PERIOD_TIME[value]);
  // "Earlier this afternoon" at 14:37 must not save 15:30, a time still to come.
  return { at: at > now ? now : at, localDate: day, period: value };
}
