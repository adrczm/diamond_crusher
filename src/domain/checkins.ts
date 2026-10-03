// What the Check-ins page shows between checks: a countdown to the next one and the history of past ones
// (06b §3.3; UX audit H5).
import { diffDays, type LocalDate } from './dates';

/** The fields of a scheduled check that the page needs (a subset of ScheduledCheckRow). */
export interface CheckLite {
  id: string;
  kind: string;
  due_on: LocalDate;
  window_open: LocalDate;
  status: string;
  completed_at: string | null;
}

const BUNDLES = ['monthly_check', 'quarterly_review'];
const PAST = ['completed', 'skipped', 'missed'];

export interface CheckPreview {
  /** Days from today to the due date (0 on the day). */
  daysToDue: number;
  /** The first day the check can be done. */
  opensOn: LocalDate;
}

export function checkPreview(c: Pick<CheckLite, 'due_on' | 'window_open'>, today: LocalDate): CheckPreview {
  return { daysToDue: Math.max(0, diffDays(today, c.due_on)), opensOn: c.window_open };
}

export interface CheckWindow {
  /** The first day the check can be done (up to 3 days early, 06a SC-002, 06b QST-052). */
  opensOn: LocalDate;
  /** The day it is scheduled for. It stays open up to 14 days after this. */
  dueOn: LocalDate;
  /** No monthly check or 12-week review is done, skipped or missed yet. */
  first: boolean;
}

/** The next unfinished monthly check or 12-week review, for the one "opens …, due …" line (W2), or null when none is planned. */
export function nextCheckWindow(rows: readonly Pick<CheckLite, 'kind' | 'due_on' | 'window_open' | 'status'>[]): CheckWindow | null {
  const bundles = rows.filter((r) => BUNDLES.includes(r.kind));
  const next = bundles.filter((r) => !PAST.includes(r.status)).sort((a, b) => (a.due_on < b.due_on ? -1 : a.due_on > b.due_on ? 1 : 0))[0];
  if (!next) return null;
  return { opensOn: next.window_open, dueOn: next.due_on, first: !bundles.some((r) => PAST.includes(r.status)) };
}

export interface PastCheck<T extends CheckLite = CheckLite> {
  row: T;
  /** The day it was completed or skipped, or its due date if it was missed. */
  on: LocalDate;
  status: 'completed' | 'skipped' | 'missed';
}

/** Finished, skipped and missed monthly checks and 12-week reviews, newest first. */
export function pastChecks<T extends CheckLite>(rows: readonly T[], toLocal: (iso: string) => LocalDate): PastCheck<T>[] {
  return rows
    .filter((r) => BUNDLES.includes(r.kind) && PAST.includes(r.status))
    .map((r) => ({
      row: r,
      on: r.completed_at && r.status !== 'missed' ? toLocal(r.completed_at) : r.due_on,
      status: r.status as PastCheck['status'],
    }))
    .sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));
}
