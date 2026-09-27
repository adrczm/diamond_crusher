import {
  applyCeiling,
  applyGap,
  chooseChange,
  countTier2Week,
  enforceCaps,
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

  it('lowers the hold to the ceiling but never raises it (PRG-013, PRG-014)', () => {
    const p = { ...INITIAL_PRESCRIPTION, holdS: 8 };
    expect(applyCeiling(p, holdCeiling([4, 3])).next.holdS).toBe(6);
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
