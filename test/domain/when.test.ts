// "When did it happen?" day strip and time-of-day slider (06a EVT-010, EVT-020; 07 DATA-090; round 2 Log).
import { atLocalTime } from '../../src/domain/dates';
import {
  adjustForDay,
  dayInFuture,
  defaultDay,
  hasNow,
  nearestStop,
  periodOf,
  pickable,
  positionOf,
  savedTime,
  stepStop,
  stops,
  stripDays,
  TRACK_END,
} from '../../src/domain/when';

const at = (d: string, t: string) => atLocalTime(d, t);
const SAT = '2026-10-03';
const FRI = '2026-10-02';

describe('period from a clock time', () => {
  it('maps each hour to its part of the day', () => {
    expect(periodOf(at(SAT, '05:00'))).toBe('morning');
    expect(periodOf(at(SAT, '10:59'))).toBe('morning');
    expect(periodOf(at(SAT, '11:00'))).toBe('noon');
    expect(periodOf(at(SAT, '13:59'))).toBe('noon');
    expect(periodOf(at(SAT, '14:37'))).toBe('afternoon');
    expect(periodOf(at(SAT, '17:00'))).toBe('evening');
    expect(periodOf(at(SAT, '20:59'))).toBe('evening');
    expect(periodOf(at(SAT, '21:00'))).toBe('night');
    expect(periodOf(at(SAT, '02:00'))).toBe('night');
    expect(periodOf(at(SAT, '04:59'))).toBe('night');
  });

  it('places Now at the real clock position between evenly spaced stops', () => {
    // 14:37 is about a fifth of the way from Afternoon (2) to Evening (3).
    expect(positionOf(at(SAT, '14:37'))).toBeCloseTo(2 + 37 / 180, 5);
    expect(positionOf(at(SAT, '05:00'))).toBe(0);
    expect(positionOf(at(SAT, '21:00'))).toBe(4);
    expect(positionOf(at(SAT, '04:59'))).toBeLessThan(TRACK_END);
    expect(positionOf(at(SAT, '02:00'))).toBeGreaterThan(4);
  });
});

describe('saved time for a part of the day', () => {
  it('saves the fixed time and the period (DATA-090)', () => {
    const now = at(SAT, '22:15');
    expect(savedTime(FRI, 'morning', now)).toEqual({ at: at(FRI, '08:00'), localDate: FRI, period: 'morning' });
    expect(savedTime(FRI, 'noon', now).at).toEqual(at(FRI, '12:30'));
    expect(savedTime(FRI, 'afternoon', now).at).toEqual(at(FRI, '15:30'));
    expect(savedTime(FRI, 'evening', now).at).toEqual(at(FRI, '19:00'));
    expect(savedTime(FRI, 'night', now).at).toEqual(at(FRI, '23:00'));
  });

  it('saves the exact time with no period for Now', () => {
    const now = at(SAT, '14:37');
    expect(savedTime(SAT, 'now', now)).toEqual({ at: now, localDate: SAT, period: null });
  });

  it('never saves a time still to come ("earlier this afternoon" at 14:37)', () => {
    const now = at(SAT, '14:37');
    expect(savedTime(SAT, 'afternoon', now)).toEqual({ at: now, localDate: SAT, period: 'afternoon' });
  });
});

describe('night rule', () => {
  it('counts 00:00 to 04:59 as the night of the day before', () => {
    const now = at(SAT, '02:00');
    expect(defaultDay(now)).toBe(FRI);
    expect(hasNow(FRI, now)).toBe(true);
    expect(hasNow(SAT, now)).toBe(false);
    expect(dayInFuture(SAT, now)).toBe(true);
    expect(pickable(SAT, now)).toEqual([]);
    expect(pickable(FRI, now)).toEqual(['morning', 'noon', 'afternoon', 'evening', 'night']);
    // A leak at 02:00 on Saturday, logged as Friday night, saves 23:00 on Friday.
    expect(savedTime(FRI, 'night', now)).toEqual({ at: at(FRI, '23:00'), localDate: FRI, period: 'night' });
    expect(savedTime(FRI, 'now', now)).toEqual({ at: now, localDate: FRI, period: null });
  });

  it('opens on today from 05:00', () => {
    expect(defaultDay(at(SAT, '05:00'))).toBe(SAT);
  });
});

describe('day strip and Now marker', () => {
  it('shows today and the 6 days before, oldest first', () => {
    expect(stripDays(at(SAT, '09:00'))).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', FRI, SAT]);
  });

  it('on today, offers the parts up to now plus Now; later parts cannot be picked', () => {
    const now = at(SAT, '14:37');
    expect(stops(SAT, now).map((s) => s.value)).toEqual(['morning', 'noon', 'afternoon', 'now']);
    expect(pickable(SAT, now)).not.toContain('evening');
  });

  it('on another day, offers all five parts and no Now', () => {
    expect(stops(FRI, at(SAT, '14:37')).map((s) => s.value)).toEqual(['morning', 'noon', 'afternoon', 'evening', 'night']);
  });

  it('keeps the choice valid when the day changes', () => {
    const now = at(SAT, '14:37');
    expect(adjustForDay('now', FRI, now)).toBe('afternoon');
    expect(adjustForDay('evening', SAT, now)).toBe('now');
    expect(adjustForDay('morning', SAT, now)).toBe('morning');
    expect(adjustForDay('now', SAT, now)).toBe('now');
  });

  it('moves one stop at a time, and Home and End jump to the ends', () => {
    const now = at(SAT, '14:37');
    expect(stepStop(SAT, now, 'now', -1)).toBe('afternoon');
    expect(stepStop(SAT, now, 'now', 1)).toBe('now');
    expect(stepStop(SAT, now, 'afternoon', 'first')).toBe('morning');
    expect(stepStop(SAT, now, 'morning', 'last')).toBe('now');
  });

  it('snaps a tap or drag on the track to the nearest stop that can be picked', () => {
    const now = at(SAT, '14:37');
    expect(nearestStop(SAT, now, 0.4)).toBe('morning');
    expect(nearestStop(SAT, now, 3.9)).toBe('now');
    expect(nearestStop(FRI, now, 3.9)).toBe('night');
  });
});
