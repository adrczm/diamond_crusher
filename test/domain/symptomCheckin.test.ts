// Symptom check-in triggers, cooldown and the progression hold (06c PFB-041, PFB-042, PFB-047, PFB-048; 04 PRG-004,
// PRG-013, PRG-034, PRG-035; 01 ONB-034).
import { addDays } from '../../src/domain/dates';
import { applyCeiling, enforceCaps, INITIAL_PRESCRIPTION, maintenanceQualifies, weekQualifies } from '../../src/domain/progression';
import { symptomStatus } from '../../src/domain/progress';
import {
  checkinRecords,
  cooldownAllows,
  erectionSignal,
  escalationKeys,
  feelSignal,
  followUpDue,
  holdState,
  leakSignal,
  LIGHTER_KEY,
  lighterLoad,
  lighterWeekUntil,
  severityOf,
  signalKey,
  type CheckinRecord,
} from '../../src/domain/symptomCheckin';

const T = '2026-06-30';
const SINCE = '2026-01-01';

describe('PFB-041 leaks', () => {
  it('fires on a leak with none in the 8 weeks before it', () => {
    expect(leakSignal(['2026-06-28'], T, SINCE)).toEqual({ reason: 'leaks', severity: 1, detail: 'new' });
    // One leak 50 days earlier: not new.
    expect(leakSignal([addDays('2026-06-28', -50), '2026-06-28'], T, SINCE)).toBeNull();
  });

  it('does not call a leak new before the app has 8 weeks of records', () => {
    expect(leakSignal(['2026-06-28'], T, '2026-06-01')).toBeNull();
    expect(leakSignal(['2026-06-28'], T, null)).toBeNull();
  });

  it('fires when the last 4-week block has at least double the block before, and 3 or more', () => {
    const prev = [addDays(T, -40), addDays(T, -35)];
    const cur4 = [addDays(T, -20), addDays(T, -10), addDays(T, -5), addDays(T, -1)];
    expect(leakSignal([...prev, ...cur4], T, SINCE)).toEqual({ reason: 'leaks', severity: 4, detail: 'doubled' });
    // 3 against 2: not doubled.
    expect(leakSignal([...prev, ...cur4.slice(1)], T, SINCE)).toBeNull();
    // 2 against 1: doubled but fewer than 3.
    expect(leakSignal([addDays(T, -40), addDays(T, -5), addDays(T, -1)], T, SINCE)).toBeNull();
  });
});

describe('PFB-042 erections', () => {
  const ev = (daysAgo: number[], value: number) => daysAgo.map((d) => ({ date: addDays(T, -d), value }));
  it('fires when the 4-week firmness median is 1 point or more below the 8 weeks before (3 or more events each)', () => {
    const s = erectionSignal([...ev([40, 45, 50], 4), ...ev([2, 5, 9], 3)], [], T);
    expect(s).toEqual({ reason: 'erections', severity: 1, detail: 'firmness' });
  });

  it('needs 3 events in each window', () => {
    expect(erectionSignal([...ev([40, 45], 4), ...ev([2, 5, 9], 2)], [], T)).toBeNull();
    expect(erectionSignal([...ev([40, 45, 50], 4), ...ev([2, 5], 2)], [], T)).toBeNull();
  });

  it('fires when the monthly S1 answer is two levels below the first one', () => {
    expect(erectionSignal([], [4, 3, 2], T)).toEqual({ reason: 'erections', severity: 2, detail: 'monthly' });
    expect(erectionSignal([], [4, 3], T)).toBeNull();
  });
});

describe('PFB-048 session feel lower 2 weeks running', () => {
  // 8 weeks of "Strong" (4), then "OK" (3) from `fromDaysAgo`, one session a day.
  const feel = (fromDaysAgo: number) =>
    Array.from({ length: 84 }, (_, i) => ({ date: addDays(T, -83 + i), value: 83 - i <= fromDaysAgo ? 3 : 4 }));

  it('fires when the 4-week median was lower today and 7 days ago', () => {
    expect(feelSignal(feel(27), T)).toEqual({ reason: 'feel', severity: 1, detail: 'feel' });
  });

  it('does not fire on one lower week', () => {
    expect(feelSignal(feel(17), T)).toBeNull();
  });

  it('needs 6 sessions in the window (PFB-014)', () => {
    const few = feel(27).filter((_, i) => i % 6 === 0);
    expect(feelSignal(few, T)).toBeNull();
  });
});

describe('PFB-047 cooldown: once per 28 days per reason, unless worse again', () => {
  it('holds the same level back for 28 days', () => {
    const past = [{ severity: 1, date: '2026-06-10' }];
    expect(cooldownAllows(past, 1, '2026-06-20')).toBe(false);
    expect(cooldownAllows(past, 1, '2026-07-07')).toBe(false);
    expect(cooldownAllows(past, 1, '2026-07-08')).toBe(true);
  });

  it('lets a stronger signal through at once', () => {
    expect(cooldownAllows([{ severity: 3, date: '2026-06-10' }], 4, '2026-06-11')).toBe(true);
    expect(cooldownAllows([{ severity: 3, date: '2026-06-10' }, { severity: 5, date: '2026-06-12' }], 4, '2026-06-13')).toBe(false);
  });

  it('stores the level in the signal key', () => {
    expect(signalKey({ detail: 'doubled', severity: 6 })).toBe('doubled:6');
    expect(severityOf('leaks:doubled:6')).toBe(6);
    expect(severityOf('checkin:4f0e2c1a-0000-4000-8000-000000000001')).toBeNull();
  });
});

describe('PRG-035 hold and ONB-034 escalation', () => {
  const rec = (id: string, date: string, overall: number | null): CheckinRecord => ({ id, date, at: `${date}T10:00:00.000Z`, overall });

  it('a "worse" answer starts the hold; a later "same" or "better" ends it; a skipped answer changes nothing', () => {
    expect(holdState([]).active).toBe(false);
    const worse = [rec('a', '2026-05-01', 2), rec('b', '2026-06-01', 3)];
    expect(holdState(worse)).toMatchObject({ active: true, startId: 'b', since: '2026-06-01' });
    expect(holdState([...worse, rec('c', '2026-06-20', null)]).active).toBe(true);
    expect(holdState([...worse, rec('c', '2026-06-29', 2)]).active).toBe(false);
    expect(holdState([...worse, rec('c', '2026-06-29', 1)]).active).toBe(false);
    // The hold at an earlier date (for a past programme week).
    expect(holdState(worse, '2026-05-15').active).toBe(false);
  });

  it('shows the firmer card when the next check-in still says "worse"', () => {
    const h = holdState([rec('a', '2026-05-01', 3), rec('b', '2026-06-01', 3)]);
    expect(h.startId).toBe('a');
    expect(escalationKeys(h, 6)).toEqual(['repeat:b']);
    expect(escalationKeys(holdState([rec('a', '2026-05-01', 3)]), 6)).toEqual([]);
  });

  it('shows the firmer card when a hold reaches programme week 12', () => {
    const h = holdState([rec('a', '2026-05-01', 3)]);
    expect(escalationKeys(h, 11)).toEqual([]);
    expect(escalationKeys(h, 12)).toEqual(['week12:a']);
    expect(escalationKeys(holdState([rec('a', '2026-05-01', 2)]), 14)).toEqual([]);
  });

  it('offers the next check-in 28 days after the last one during a hold', () => {
    const h = holdState([rec('a', '2026-06-01', 3)]);
    expect(followUpDue(h, '2026-06-28')).toBe(false);
    expect(followUpDue(h, '2026-06-29')).toBe(true);
    expect(followUpDue(holdState([rec('a', '2026-05-01', 2)]), T)).toBe(false);
  });

  it('reads check-ins from questionnaire responses (the overall answer is the scored item)', () => {
    const rows = [
      { id: 'x', instrument_key: 'app_global_change', started_at: '2026-06-01T10:00:00Z', completed_at: '2026-06-01T10:01:00Z', total_score: null },
      { id: 'b', instrument_key: 'app_symptom_checkin', started_at: '2026-06-02T10:00:00Z', completed_at: '2026-06-02T10:01:00Z', total_score: 3 },
    ];
    expect(checkinRecords(rows, 'app_symptom_checkin')).toEqual([{ id: 'b', at: '2026-06-02T10:01:00Z', date: '2026-06-02', overall: 3 }]);
  });

  it('PRG-004 condition 5: an open "worse" check-in fails the week; nothing else does', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-0${i + 1}`, completeSessions: 2 }));
    const base = { days, painReported: false, couldNotRelease: false, regressionHold: false };
    expect(weekQualifies(base).qualifies).toBe(true);
    expect(weekQualifies({ ...base, checkinWorse: false }).qualifies).toBe(true);
    expect(weekQualifies({ ...base, checkinWorse: true })).toEqual({ qualifies: false, failedOnlyOnSessions: false });
    expect(maintenanceQualifies({ weeksTargetMet: [true, true, true, true], painReported: false, daysSinceLastChange: null, checkinWorse: true })).toBe(false);
    expect(maintenanceQualifies({ weeksTargetMet: [true, true, true, true], painReported: false, daysSinceLastChange: null })).toBe(true);
  });

  it('a lighter week covers 7 days from its start and only lowers the plan, within the floors', () => {
    const keys = [`${LIGHTER_KEY}2026-06-25`, 'today:plan'];
    expect(lighterWeekUntil(keys, '2026-06-24')).toBeNull();
    expect(lighterWeekUntil(keys, '2026-06-25')).toBe('2026-07-01');
    expect(lighterWeekUntil(keys, '2026-07-01')).toBe('2026-07-01');
    expect(lighterWeekUntil(keys, '2026-07-02')).toBeNull();
    expect(lighterLoad({ holdS: 6, holdReps: 9, enduranceHoldS: 7, tier: 2 })).toEqual({ holdS: 5, holdReps: 7, enduranceHoldS: 6, tier: 2 });
    expect(lighterLoad({ holdS: 3, holdReps: 4, enduranceHoldS: 5 })).toEqual({ holdS: 3, holdReps: 3, enduranceHoldS: 5 });
  });

  it('a "worse" check-in and its firmer card feed "Something changed" (PFB-048, PFB-017)', () => {
    const flags = (key: string) => [{ key, date: '2026-06-20', open: false }];
    expect(symptomStatus([{ date: '2026-06-20', complete: true }], flags('symptom_worsening'), T).status).toBe('changed');
    expect(symptomStatus([{ date: '2026-06-20', complete: true }], flags('checkin_escalation'), T).status).toBe('changed');
    expect(symptomStatus([{ date: '2026-06-20', complete: true }], flags('checkin_offer'), T).status).toBe('no_change');
  });
});

describe('PRG-013 and PRG-034: the level never drops automatically', () => {
  it('a lower ceiling keeps H and stops it rising', () => {
    const p = { ...INITIAL_PRESCRIPTION, holdS: 9, holdReps: 10, tier: 3, enduranceEnabled: true, enduranceHoldS: 10, lastStrengthVariable: 'hold_reps' as const };
    const r = applyCeiling(p, 5);
    expect(r.change).toBeNull();
    expect(enforceCaps(r.next).holdS).toBe(9);
    expect(enforceCaps(r.next).holdCeiling).toBe(5);
  });

  it('the hard caps still apply (PRG-040)', () => {
    expect(enforceCaps({ ...INITIAL_PRESCRIPTION, holdS: 14, holdCeiling: 4 }).holdS).toBe(10);
    expect(enforceCaps({ ...INITIAL_PRESCRIPTION, holdS: 1, holdCeiling: 4 }).holdS).toBe(3);
  });
});
