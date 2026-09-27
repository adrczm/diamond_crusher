import { backupAgeDays, backupDue, backupState } from '../../src/domain/backup';
import { checkPreview, pastChecks, type CheckLite } from '../../src/domain/checkins';

describe('backup prompt (07 PRIV-030, UX audit C3)', () => {
  const base = { platform: 'web' as const, sessionsCount: 0, lastExport: null, today: '2026-09-27', reminderDays: 30 };

  it('asks for the first backup after the 3rd session, on the web and on phones', () => {
    expect(backupDue({ ...base, sessionsCount: 2 })).toBe(false);
    expect(backupDue({ ...base, sessionsCount: 3 })).toBe(true);
    expect(backupDue({ ...base, platform: 'native', sessionsCount: 3 })).toBe(true);
  });

  it('asks again weekly on the web, and after export_reminder_days on phones', () => {
    const after = (days: number, platform: 'web' | 'native') =>
      backupDue({ ...base, platform, sessionsCount: 20, lastExport: '2026-09-20', today: `2026-09-${String(20 + days).padStart(2, '0')}` });
    expect(after(6, 'web')).toBe(false);
    expect(after(7, 'web')).toBe(true);
    expect(after(7, 'native')).toBe(false);
    expect(backupDue({ ...base, platform: 'native', sessionsCount: 20, lastExport: '2026-08-28', today: '2026-09-27' })).toBe(true);
  });

  it('stays quiet until a "Not now" runs out', () => {
    expect(backupDue({ ...base, sessionsCount: 5, dismissedUntil: '2026-09-28' })).toBe(false);
    expect(backupDue({ ...base, sessionsCount: 5, dismissedUntil: '2026-09-27' })).toBe(true);
  });

  it('warns about a missing file everywhere, and an old one only on the web', () => {
    expect(backupAgeDays(null, '2026-09-27')).toBeNull();
    expect(backupAgeDays('2026-09-15', '2026-09-27')).toBe(12);
    expect(backupState('native', null, '2026-09-27')).toBe('never');
    expect(backupState('web', '2026-09-13', '2026-09-27')).toBe('ok');
    expect(backupState('web', '2026-09-12', '2026-09-27')).toBe('stale');
    expect(backupState('native', '2026-06-01', '2026-09-27')).toBe('ok');
  });
});

describe('check-ins between checks (UX audit H5)', () => {
  const row = (id: string, status: string, due_on: string, completed_at: string | null = null, kind = 'monthly_check'): CheckLite => ({
    id,
    kind,
    due_on,
    window_open: due_on,
    status,
    completed_at,
  });

  it('counts down to the due date and says when it opens', () => {
    expect(checkPreview({ due_on: '2026-10-25', window_open: '2026-10-22' }, '2026-09-27')).toEqual({ daysToDue: 28, opensOn: '2026-10-22' })
  });

  it('lists past checks newest first, dated by completion, or by due date if not done', () => {
    const rows = [
      row('a', 'completed', '2026-07-01', '2026-07-02T09:00:00.000Z'),
      row('b', 'missed', '2026-07-29'),
      row('c', 'skipped', '2026-08-26', '2026-08-25T09:00:00.000Z', 'quarterly_review'),
      row('d', 'upcoming', '2026-09-23'),
      row('e', 'completed', '2026-06-01', '2026-06-01T09:00:00.000Z', 'export_backup'),
    ];
    const past = pastChecks(rows, (iso) => iso.slice(0, 10));
    expect(past.map((p) => [p.row.id, p.on, p.status])).toEqual([
      ['c', '2026-08-25', 'skipped'],
      ['b', '2026-07-29', 'missed'],
      ['a', '2026-07-02', 'completed'],
    ]);
  });
});
