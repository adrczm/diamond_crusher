import {
  applyCeiling,
  applyGap,
  chooseChange,
  countTier2Week,
  enforceCaps,
  extraSessionAllowed,
  gapBand,
  holdCeiling,
  INITIAL_PRESCRIPTION,
  level,
  startingLoad,
  weekQualifies,
  type Prescription,
} from '../../src/domain/progression';

describe('progression (spec 04)', () => {
  it('sets the starting load from a baseline (PRG-002)', () => {
    expect(startingLoad({ longestHoldS: 3, repeatedHolds: 10 })).toMatchObject({ holdS: 3, holdReps: 8, tier: 0 });
    expect(startingLoad({ longestHoldS: 14.7, repeatedHolds: 2 })).toMatchObject({ holdS: 10, holdReps: 3 });
    expect(startingLoad(null)).toMatchObject({ holdS: 3, holdReps: 8 });
  });

  it('follows the PRG-006 golden sequence for an ideal user', () => {
    let p: Prescription = { ...INITIAL_PRESCRIPTION, ...startingLoad({ longestHoldS: 3, repeatedHolds: 10 }), holdCeiling: holdCeiling([3]) };
    const seen: string[] = [];
    for (let w = 1; w <= 8; w++) {
      p = countTier2Week(p);
      const r = chooseChange(p, w);
      if (!r) throw new Error(`no change in week ${w}`);
      p = enforceCaps(r.next);
      seen.push(`${r.change.variable}:${String(r.change.after)}`);
    }
    expect(seen).toEqual(['position:1', 'position:2', 'endurance:true', 'hold_s:4', 'endurance_hold_s:6', 'hold_reps:9', 'position:3', 'hold_s:5']);
  });

  it('a week qualifies only with 2 full sessions on 5 days and no pain (PRG-004)', () => {
    const days = (n: number) => Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-0${i + 1}`, completeSessions: i < n ? 2 : 0 }));
    const base = { painReported: false, couldNotRelease: false, regressionHold: false };
    expect(weekQualifies({ ...base, days: days(5) }).qualifies).toBe(true);
    expect(weekQualifies({ ...base, days: days(4) })).toEqual({ qualifies: false, failedOnlyOnSessions: true });
    expect(weekQualifies({ ...base, painReported: true, days: days(7) }).qualifies).toBe(false);
  });

  it('a full day needs min(2, sessions a day) full sessions, for 1, 4 and 5 a day too (PRG-004, round 2)', () => {
    const days = (per: number) => Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-0${i + 1}`, completeSessions: per }));
    const base = { painReported: false, couldNotRelease: false, regressionHold: false };
    const min = (n: number) => Math.min(2, n);
    // 1 a day: one full session is a full day.
    expect(weekQualifies({ ...base, days: days(1) }, min(1)).qualifies).toBe(true);
    // 4 or 5 a day: 2 full sessions still count (more is not needed to progress).
    expect(weekQualifies({ ...base, days: days(2) }, min(4)).qualifies).toBe(true);
    expect(weekQualifies({ ...base, days: days(2) }, min(5)).qualifies).toBe(true);
    expect(weekQualifies({ ...base, days: days(1) }, min(5)).qualifies).toBe(false);
    // Pain still blocks the change at any number a day (PRG-042).
    expect(weekQualifies({ ...base, painReported: true, days: days(5) }, min(5)).qualifies).toBe(false);
  });

  it('an extra session after the plan may always start, stored as extra (PRG-041, round 2: no 30 a day cap)', () => {
    expect(extraSessionAllowed()).toBe(true);
  });

  it('keeps the per-session caps whatever the sessions a day (PRG-040)', () => {
    const p = enforceCaps({ ...INITIAL_PRESCRIPTION, holdS: 15, holdReps: 14, flickReps: 30, enduranceHoldS: 20, holdCeiling: 12 });
    expect(p).toMatchObject({ holdS: 10, holdReps: 10, flickReps: 10, enduranceHoldS: 10 });
  });

  it('no longer lowers the hold to the ceiling, and never raises it (PRG-013 as changed 2026-10-03, PRG-014, PRG-034)', () => {
    const p = { ...INITIAL_PRESCRIPTION, holdS: 8 };
    const r = applyCeiling(p, holdCeiling([4, 3]));
    expect(r.next.holdS).toBe(8);
    expect(r.next.holdCeiling).toBe(6);
    expect(r.change).toBeNull();
    expect(applyCeiling({ ...p, holdS: 3 }, 10).next.holdS).toBe(3);
    expect(holdCeiling([])).toBe(5);
    expect(holdCeiling([20, 25])).toBe(10);
  });

  it('eases back after breaks (PRG-032)', () => {
    expect(gapBand(7)).toBe('none');
    const p = { ...INITIAL_PRESCRIPTION, holdS: 6, holdReps: 9, tier: 2 };
    expect(applyGap(p, 10, false, false).next.holdS).toBe(5);
    const medium = applyGap(p, 20, false, false).next;
    expect(medium).toMatchObject({ holdS: 4, holdReps: 7, tier: 1 });
    const long = applyGap(p, 40, true, false);
    expect(long.needsSelfCheck && long.returnToBuild).toBe(true);
    expect(applyGap(p, 20, false, true).changes).toEqual([]);
  });

  it('counts the level from increases (PRG-050)', () => {
    expect(
      level([
        { reason: 'initial', variable: 'none', before: null, after: null },
        { reason: 'progression', variable: 'position', before: 0, after: 1 },
        { reason: 'progression', variable: 'hold_s', before: 3, after: 4 },
        { reason: 'restart_after_gap', variable: 'hold_s', before: 4, after: 3 },
      ])
    ).toBe(2);
  });
});
