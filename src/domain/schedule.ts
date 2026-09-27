// Monthly / quarterly bundle schedule, windows, late and missed handling (06b §3.3).
import { addDays, diffDays, isoWeekday, type LocalDate } from './dates';

export type BundleKind = 'baseline' | 'monthly_check' | 'quarterly_review';
export type BundleStatus = 'upcoming' | 'open' | 'partial' | 'completed' | 'missed' | 'skipped';

export const WINDOW_BEFORE = 3;
export const WINDOW_AFTER = 14;
export const INTERVAL = 28;

export interface Occurrence {
  kind: BundleKind;
  dueOn: LocalDate;
  windowOpen: LocalDate;
  windowClose: LocalDate;
}

export function occurrence(kind: BundleKind, dueOn: LocalDate): Occurrence {
  return { kind, dueOn, windowOpen: addDays(dueOn, -WINDOW_BEFORE), windowClose: addDays(dueOn, WINDOW_AFTER) };
}

/** QST-052: status of an unfinished occurrence on a given day. */
export function statusOn(o: Occurrence, today: LocalDate, started: boolean): BundleStatus {
  if (today < o.windowOpen) return 'upcoming';
  if (today > o.windowClose) return 'missed';
  return started ? 'partial' : 'open';
}

/**
 * Next due date on the anchor schedule after an occurrence (QST-051, QST-053).
 * If the occurrence was completed late with 14 days or fewer left to the next due date, that one is skipped.
 */
export function nextDue(prevDue: LocalDate, completedOn: LocalDate | null): LocalDate {
  let next = addDays(prevDue, INTERVAL);
  if (completedOn && diffDays(completedOn, next) <= 14) next = addDays(next, INTERVAL);
  return next;
}

/**
 * QST-051: the 12-week review replaces the monthly bundle on the first due date on or after the start of
 * programme week 12, 24, 36 …  `reviewsDone` counts reviews already held.
 */
export function kindForDue(programmeWeekAtDue: number, reviewsDone: number): BundleKind {
  const nextReviewWeek = 12 * (reviewsDone + 1);
  return programmeWeekAtDue >= nextReviewWeek ? 'quarterly_review' : 'monthly_check';
}

/** QST-056: after moving the anchor weekday, the next due date is the first such weekday at least 21 days after the last completed bundle. */
export function dueAfterAnchorChange(lastCompleted: LocalDate, weekday: number): LocalDate {
  let d = addDays(lastCompleted, 21);
  while (isoWeekday(d) !== weekday) d = addDays(d, 1);
  return d;
}

/** ONB-030: short safety screen due every 4 weeks (bundled with the monthly check). */
export function shortScreenDue(lastScreenDate: LocalDate | null, today: LocalDate): boolean {
  if (!lastScreenDate) return false;
  return diffDays(lastScreenDate, today) >= 28;
}
