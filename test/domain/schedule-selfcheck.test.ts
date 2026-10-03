import { kindForDue, nextDue, occurrence, statusOn } from '../../src/domain/schedule';
import { confirmedDrop, repeatedHoldLength, techniqueFlag, trend, type CheckForTrend } from '../../src/domain/selfcheck';

describe('check schedule (06b §3.3)', () => {
  it('opens 3 days early and is missed 14 days late (QST-052)', () => {
    const o = occurrence('monthly_check', '2026-03-10');
    expect(statusOn(o, '2026-03-06', false)).toBe('upcoming');
    expect(statusOn(o, '2026-03-07', false)).toBe('open');
    expect(statusOn(o, '2026-03-24', true)).toBe('partial');
    expect(statusOn(o, '2026-03-25', false)).toBe('missed');
  });

  it('skips the next occurrence when done very late (QST-053)', () => {
    expect(nextDue('2026-03-10', '2026-03-12')).toBe('2026-04-07');
    expect(nextDue('2026-03-10', '2026-03-24')).toBe('2026-05-05');
  });

  it('replaces the monthly check with the 12-week review (QST-051)', () => {
    expect(kindForDue(11, 0)).toBe('monthly_check');
    expect(kindForDue(12, 0)).toBe('quarterly_review');
    expect(kindForDue(16, 1)).toBe('monthly_check');
    expect(kindForDue(12, 0, 16)).toBe('monthly_check');
    expect(kindForDue(16, 0, 16)).toBe('quarterly_review');
    expect(kindForDue(28, 1, 16)).toBe('quarterly_review');
  });
});

const check = (i: number, longest: number, extra: Partial<CheckForTrend> = {}): CheckForTrend => ({
  id: String(i),
  performedAt: `2026-0${i}-01`,
  position: 'lying',
  conditionsMet: true,
  techniqueFlag: false,
  longestHoldS: longest,
  repeatedHolds: 5,
  repeatedHoldLenS: 5,
  quickFlicks: 8,
  ...extra,
});

describe('self-check (06a, 06c PFB-020)', () => {
  it('paces repeated holds from the longest hold (SC-012)', () => {
    expect(repeatedHoldLength(1)).toBe(2);
    expect(repeatedHoldLength(7.9)).toBe(7);
    expect(repeatedHoldLength(25)).toBe(10);
  });

  it('flags technique on a "no" sign or a bulge (SC-022)', () => {
    expect(techniqueFlag({ signResult: 'no', bulge: 'no', breathingOk: 'yes', glutesBellyRelaxed: 'yes', fullRelease: 'yes' })).toBe(true);
    expect(techniqueFlag({ signResult: 'yes', bulge: 'no', breathingOk: 'no', glutesBellyRelaxed: 'yes', fullRelease: 'yes' })).toBe(false);
  });

  it('needs two checks beyond the step to call a change (AC-PFB-1)', () => {
    expect(trend([check(1, 5), check(2, 5)], 'longest_hold').trend).toBe('too_early');
    expect(trend([check(1, 5), check(2, 7), check(3, 7)], 'longest_hold').trend).toBe('improvement');
    expect(trend([check(1, 5), check(2, 7), check(3, 5)], 'longest_hold').trend).toBe('steady');
    expect(trend([check(1, 8), check(2, 6), check(3, 6)], 'longest_hold').trend).toBe('decline');
    expect(confirmedDrop([check(1, 8), check(2, 6), check(3, 6)])).toBe(true);
  });

  it('ignores invalid checks', () => {
    expect(trend([check(1, 8), check(2, 6), check(3, 6, { techniqueFlag: true })], 'longest_hold').trend).toBe('too_early');
  });
});
