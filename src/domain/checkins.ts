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
