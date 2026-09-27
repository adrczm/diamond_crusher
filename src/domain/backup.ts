// When to ask for a backup file, and how old the last one is (07 PRIV-030; UX audit C3). On the web (Safari on a
// Mac) all records live in the browser's storage, which Safari can clear, so the web asks early and often.
import { diffDays, type LocalDate } from './dates';

/** The first backup prompt comes after this many sessions, on every platform. */
export const FIRST_BACKUP_AFTER_SESSIONS = 3;
/** On the web, the prompt comes back this many days after the last backup. Phones use settings.export_reminder_days. */
export const WEB_BACKUP_EVERY_DAYS = 7;
/** On the web, a backup older than this shows as a warning on the Data page and in the sidebar. */
export const WEB_BACKUP_STALE_DAYS = 14;

export type BackupPlatform = 'web' | 'native';

export interface BackupDueInput {
  platform: BackupPlatform;
  /** Sessions saved so far (any kind). */
  sessionsCount: number;
  /** Local date of the last backup file, or null if there is none. */
  lastExport: LocalDate | null;
  today: LocalDate;
  /** settings.export_reminder_days (phones only). */
  reminderDays: number;
  /** The prompt stays hidden until this date (after "Not now"), if set. */
  dismissedUntil?: LocalDate | null;
}

/** True when the home screen should ask for a backup file. */
export function backupDue(i: BackupDueInput): boolean {
  if (i.dismissedUntil && i.today < i.dismissedUntil) return false;
  if (i.lastExport == null) return i.sessionsCount >= FIRST_BACKUP_AFTER_SESSIONS;
  const every = i.platform === 'web' ? WEB_BACKUP_EVERY_DAYS : i.reminderDays;
  return diffDays(i.lastExport, i.today) >= every;
}

/** Whole days since the last backup, or null if there is none. */
export function backupAgeDays(lastExport: LocalDate | null, today: LocalDate): number | null {
  return lastExport == null ? null : Math.max(0, diffDays(lastExport, today));
}

export type BackupState = 'never' | 'stale' | 'ok';

/** 'never' on every platform when there is no file. 'stale' only on the web, where the browser can lose the data. */
export function backupState(platform: BackupPlatform, lastExport: LocalDate | null, today: LocalDate): BackupState {
  const age = backupAgeDays(lastExport, today);
  if (age == null) return 'never';
  return platform === 'web' && age > WEB_BACKUP_STALE_DAYS ? 'stale' : 'ok';
}
