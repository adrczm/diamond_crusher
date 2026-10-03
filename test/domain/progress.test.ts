import { addDays } from '../../src/domain/dates';
import {
  bestIndex,
  compareWithPrevious,
  firstTargetWeek,
  firstWords,
  lastWeekStarts,
  leakBlocks,
  lineSegments,
  mcidBand,
  median,
  monthlyAverages,
  newBestsAt,
  plateauMessage,
  rollingMedian,
  rollingSeries,
  sameBelowFor,
  symptomStatus,
  timeFraction,
  weekCounts,
  weekStartsFrom,
  weeksOnTarget,
  withGaps,
} from '../../src/domain/progress';
import type { CheckForTrend } from '../../src/domain/selfcheck';

const days = (from: string, n: number, every = 1) => Array.from({ length: n }, (_, i) => addDays(from, i * every));

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('weeks on target (PFB-010, MOT-005: no streak)', () => {
  const thisWeek = '2026-09-28'; // a Monday
  it('counts days per week and leaves weeks before training as gaps, not zeros (PFB-002)', () => {
    const trained = new Set([...days('2026-09-14', 5), ...days('2026-09-21', 2), '2026-09-28']);
    const c = weekCounts(trained, lastWeekStarts(thisWeek, 4), thisWeek, 5, '2026-09-14');
    expect(c.map((w) => w.days)).toEqual([null, 5, 2, 1]);
    expect(c.map((w) => w.onTarget)).toEqual([false, true, false, false]);
    expect(c[3].current).toBe(true);
  });

  it('counts only full weeks, up to the last 12', () => {
    const trained = new Set<string>();
    const starts = lastWeekStarts(thisWeek, 15);
    starts.forEach((w, i) => days(w, i % 3 === 0 ? 3 : 5).forEach((d) => trained.add(d)));
    const c = weekCounts(trained, starts, thisWeek, 5, starts[0]);
    const r = weeksOnTarget(c, 12);
    expect(r.of).toBe(12);
    expect(r.on).toBe(8);
  });

  it('says how many full weeks exist when fewer than 12', () => {
    const trained = new Set(days('2026-09-14', 5));
    const c = weekCounts(trained, lastWeekStarts(thisWeek, 13), thisWeek, 5, '2026-09-14');
    expect(weeksOnTarget(c, 12)).toEqual({ on: 1, of: 2 });
  });

  it('finds the first full week at target', () => {
    const trained = new Set([...days('2026-09-14', 3), ...days('2026-09-21', 5)]);
    const c = weekCounts(trained, weekStartsFrom('2026-09-14', thisWeek), thisWeek, 5, '2026-09-14');
    expect(firstTargetWeek(c)).toBe('2026-09-27');
  });
});

describe('12 months by month (round 2 Progress §1)', () => {
  it('averages days a week per month, counts the current month so far, and leaves months before the start empty', () => {
    const trained = new Set([...days('2026-08-01', 31).filter((_, i) => i % 7 < 4), ...days('2026-09-01', 30), ...days('2026-10-01', 2)]);
    const m = monthlyAverages(trained, '2026-08-01', '2026-10-07', 5, 4);
    expect(m.map((x) => x.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(m[0].avg).toBeNull();
    expect(m[1].avg).toBe(4.3); // 19 days in 31
    expect(m[2].avg).toBe(7);
    expect(m[2].onTarget).toBe(true);
    expect(m[3].current).toBe(true);
    expect(m[3].avg).toBe(2);
  });
});

describe('rolling medians (PFB-014, PFB-016, LOG-025)', () => {
  const entries = [
    { date: '2026-09-01', value: 2 },
    { date: '2026-09-10', value: 4 },
    { date: '2026-09-20', value: 4 },
    { date: '2026-09-28', value: 5 },
  ];
  it('uses a 28-day window and needs the minimum count', () => {
    expect(rollingMedian(entries, '2026-09-28', 3)).toEqual({ value: 4, count: 4 });
    expect(rollingMedian(entries, '2026-09-28', 6).value).toBeNull();
    expect(rollingMedian(entries, '2026-10-20', 1)).toEqual({ value: 5, count: 1 });
  });

  it('gives no point for a 4-week window with 2 events (AC-PFB-7)', () => {
    expect(rollingSeries(entries, ['2026-09-10', '2026-09-28'], 3).map((p) => p.value)).toEqual([null, 4]);
  });

  it('compares the last 4 weeks with the 8 weeks before (PFB-024)', () => {
    const e = [
      ...days('2026-07-10', 6, 7).map((date) => ({ date, value: 3 })),
      ...days('2026-09-10', 6, 3).map((date) => ({ date, value: 4 })),
    ];
    const r = compareWithPrevious(e, '2026-10-01', 3, sameBelowFor(5));
    expect(r.current).toBe(4);
    expect(r.previous).toBe(3);
    expect(r.direction).toBe('higher');
    expect(compareWithPrevious(e, '2026-10-01', 3, sameBelowFor(10)).direction).toBe('same');
    expect(compareWithPrevious(e.slice(-2), '2026-10-01', 3, 1).direction).toBeNull();
  });
});

describe('line segments (PFB-002, AC-PFB-6, PFB-011)', () => {
  it('breaks the line at missing values and reports the gap', () => {
    expect(lineSegments([1, 2, null, 4, 5])).toEqual({ runs: [[0, 1], [3, 4]], gaps: [[1, 3]] });
  });

  it('ignores leading and trailing gaps', () => {
    expect(lineSegments([null, 1, 2, null])).toEqual({ runs: [[1, 2]], gaps: [] });
  });

  it('starts a new segment when the hold length changes by more than 1 s', () => {
    expect(lineSegments([6, 7, 8, 8], [5, 6, 8, 8])).toEqual({ runs: [[0, 1], [2, 3]], gaps: [] });
  });
});

describe('personal best and gaps', () => {
  it('marks the first time the highest valid value was reached', () => {
    expect(bestIndex([9, 13, 13, 15], [false, false, false, true])).toBe(1);
    expect(bestIndex([null, null])).toBe(-1);
  });

  it('inserts a gap for a missed check and for a long silence (AC-PFB-6)', () => {
    const pts = [{ date: '2026-06-01' }, { date: '2026-07-01' }, { date: '2026-09-28' }];
    const out = withGaps(pts, ['2026-07-29']);
    expect(out.map((p) => ('gap' in p ? `gap ${p.date}` : p.date))).toEqual(['2026-06-01', '2026-07-01', 'gap 2026-07-29', '2026-09-28']);
    expect(withGaps(pts.slice(1), []).filter((p) => 'gap' in p)).toHaveLength(1);
  });

  const chk = (id: string, longest: number, ok = true, position: 'lying' | 'standing' = 'lying'): CheckForTrend => ({
    id,
    performedAt: id,
    position,
    conditionsMet: ok,
    techniqueFlag: false,
    longestHoldS: longest,
    repeatedHolds: 5,
    repeatedHoldLenS: 5,
    quickFlicks: 8,
  });

  it('names the measures in which a check set a new best (SC-031)', () => {
    const checks = [chk('a', 8), chk('b', 12, false), chk('c', 10), chk('d', 9, true, 'standing')];
    expect(newBestsAt(checks, 'c')).toEqual([{ measure: 'longest_hold', value: 10 }]);
    expect(newBestsAt(checks, 'a')).toEqual([]);
    expect(newBestsAt(checks, 'b')).toEqual([]);
  });

  it('shows a plateau message only from week 12 with all measures steady (PFB-033, PFB-034)', () => {
    const steady = [chk('1', 8), chk('2', 9), chk('3', 8), chk('4', 8), chk('5', 9)];
    expect(plateauMessage(steady, 13, { on: 10, of: 12 })).toBe('PFB-033');
    expect(plateauMessage(steady, 13, { on: 4, of: 12 })).toBe('PFB-034');
    expect(plateauMessage(steady, 13, { on: 7, of: 12 })).toBeNull();
    expect(plateauMessage(steady, 10, { on: 10, of: 12 })).toBeNull();
    expect(plateauMessage([...steady, chk('6', 12), chk('7', 12)], 13, { on: 10, of: 12 })).toBeNull();
  });
});

describe('leaks per 4-week block by situation (PFB-015)', () => {
  it('counts each block and leaves blocks before the start empty', () => {
    const leaks = [
      { date: '2026-09-30', situation: 'cough_sneeze' },
      { date: '2026-09-20', situation: 'cough_sneeze' },
      { date: '2026-09-01', situation: 'lifting' },
      { date: '2026-08-10', situation: null },
    ];
    const b = leakBlocks(leaks, '2026-10-01', 3, '2026-08-07');
    expect(b.map((x) => x.total)).toEqual([null, 2, 2]);
    expect(b[2].bySituation).toEqual({ cough_sneeze: 2 });
    expect(b[1].bySituation).toEqual({ lifting: 1, other: 1 });
    expect(b[2].to).toBe('2026-10-01');
    expect(b[2].from).toBe('2026-09-04');
  });
});

describe('questionnaires and overview (PFB-013, PFB-017)', () => {
  it('draws the MCID band only for a fixed MCID and a baseline at or above its minimum', () => {
    expect(mcidBand({ type: 'fixed', values: [2, 6] }, 8)).toEqual({ low: 6, high: 10 });
    expect(mcidBand({ type: 'fixed', values: [2, 6] }, 4)).toBeNull();
    expect(mcidBand(undefined, 8)).toBeNull();
    expect(mcidBand({ type: 'baselineBands', values: [2, 5, 7] }, 8)).toBeNull();
  });

  it('says no change, something changed or no check-up yet', () => {
    const r = [{ date: '2026-09-12', complete: true }];
    expect(symptomStatus([], [], '2026-10-01')).toEqual({ status: 'none', last: null });
    expect(symptomStatus(r, [], '2026-10-01')).toEqual({ status: 'no_change', last: '2026-09-12' });
    expect(symptomStatus(r, [{ key: 'new_leaks', date: '2026-09-20', open: false }], '2026-10-01').status).toBe('changed');
    expect(symptomStatus(r, [{ key: 'new_leaks', date: '2026-07-01', open: false }], '2026-10-01').status).toBe('no_change');
    expect(symptomStatus(r, [{ key: 'pain_route', date: '2026-09-30', open: true }], '2026-10-01').status).toBe('no_change');
  });
});

describe('small helpers', () => {
  it('places dates on a time axis and shortens notes', () => {
    expect(timeFraction('2026-09-15', '2026-09-01', '2026-09-29')).toBe(0.5);
    expect(timeFraction('2026-09-15', '2026-09-15', '2026-09-15')).toBe(0.5);
    expect(firstWords('Had a cold all week long')).toBe('Had a cold all…');
    expect(firstWords('Busy')).toBe('Busy');
  });
});
