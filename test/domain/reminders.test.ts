import { addDays, atLocalTime } from '../../src/domain/dates';
import { keepInStep, nextFreeTime, nextReminderAt, planNotifications, type PlanInput, type StepSlot } from '../../src/domain/reminders';

const today = '2026-03-02'; // a Monday
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  now: atLocalTime(today, '06:00'),
  today,
  mode: 'normal',
  slots: [
    { reminderId: 'r1', slotNo: 1, timeLocal: '07:45', weekdays: 127, enabled: true, title: null, body: null },
    { reminderId: 'r2', slotNo: 2, timeLocal: '12:30', weekdays: 127, enabled: true, title: null, body: null },
    { reminderId: 'r3', slotNo: 3, timeLocal: '22:30', weekdays: 127, enabled: true, title: null, body: null },
  ],
  lastActiveDate: addDays(today, -1),
  todaySessionEnds: [],
  dailyDose: 3,
  paused: false,
  pausedUntil: null,
  bundles: [],
  weeklySummary: { enabled: false, weekStartDay: 1, reminderId: null },
  knack: { enabled: false, time: null, reminderId: null },
  comebackReminderId: 'c',
  ...over,
});

describe('reminder plan (08)', () => {
  it('schedules 7 days ahead, already backed off for days that would be idle (REM-012)', () => {
    // Active yesterday: days 0 to 2 get all 3 slots, days 3 to 6 only the first slot unless the app is opened again.
    expect(planNotifications(base()).filter((n) => n.kind === 'session')).toHaveLength(3 * 3 + 4);
  });

  it('sends nothing while exercises are paused for safety (REM-017)', () => {
    expect(planNotifications(base({ mode: 'blocked_urgent' }))).toEqual([]);
  });

  it('uses calm wording in relax-only mode', () => {
    expect(planNotifications(base({ mode: 'relax_only' }))[0].body).toBe('Time for a few calm minutes.');
  });

  it('skips a slot within 90 minutes after a session, and all slots once the dose is done (REM-016)', () => {
    const one = planNotifications(base({ now: atLocalTime(today, '11:30'), todaySessionEnds: [atLocalTime(today, '11:15')] }));
    expect(one.some((n) => n.key === `session:2:${today}`)).toBe(false);
    expect(one.some((n) => n.key === `session:3:${today}`)).toBe(true);
    const done = planNotifications(base({ todaySessionEnds: [1, 2, 3].map(() => atLocalTime(today, '05:00')) }));
    expect(done.some((n) => n.key.endsWith(today))).toBe(false);
  });

  it('backs off after 3 idle days, then one note at 14 and silence (AC-MOT-3)', () => {
    const idle3 = planNotifications(base({ lastActiveDate: addDays(today, -4) })).filter((n) => n.key.endsWith(today));
    expect(idle3.map((n) => n.slotNo)).toEqual([1]);
    const plan = planNotifications(base({ lastActiveDate: addDays(today, -13) }));
    expect(plan.filter((n) => n.kind === 'comeback_note')).toHaveLength(1);
    const after = plan.filter((n) => n.at > plan.find((x) => x.kind === 'comeback_note')!.at);
    expect(after).toEqual([]);
  });

  it('respects a pause', () => {
    expect(planNotifications(base({ paused: true }))).toEqual([]);
  });
});

describe('next reminder (UX audit M11)', () => {
  const plan = [
    { timeLocal: '07:45', weekdays: 127, enabled: true },
    { timeLocal: '12:30', weekdays: 127, enabled: true },
    { timeLocal: '22:30', weekdays: 1, enabled: true }, // Mondays only
  ];
  it('gives the next slot later today', () => {
    expect(nextReminderAt(plan, atLocalTime(today, '09:00'))).toEqual(atLocalTime(today, '12:30'));
    expect(nextReminderAt(plan, atLocalTime(today, '12:31'))).toEqual(atLocalTime(today, '22:30'));
  });
  it('moves to the first slot tomorrow after the last one today, and skips days not in the plan', () => {
    expect(nextReminderAt(plan, atLocalTime(today, '23:00'))).toEqual(atLocalTime(addDays(today, 1), '07:45'));
    const mondays = [{ timeLocal: '22:30', weekdays: 1, enabled: true }];
    expect(nextReminderAt(mondays, atLocalTime(today, '23:00'))).toEqual(atLocalTime(addDays(today, 7), '22:30'));
  });
  it('ignores switched-off slots and returns null with nothing to remind', () => {
    expect(nextReminderAt([{ ...plan[1], enabled: false }], atLocalTime(today, '09:00'))).toBeNull();
    expect(nextReminderAt([{ ...plan[1], weekdays: 0 }], atLocalTime(today, '09:00'))).toBeNull();
    expect(nextReminderAt([], atLocalTime(today, '09:00'))).toBeNull();
  });
  it('follows a pause and a blocked safety mode (REM-017)', () => {
    const now = atLocalTime(today, '09:00');
    expect(nextReminderAt(plan, now, { paused: true, pausedUntil: null })).toBeNull();
    const until = atLocalTime(addDays(today, 2), '10:00');
    expect(nextReminderAt(plan, now, { paused: true, pausedUntil: until })).toEqual(atLocalTime(addDays(today, 2), '12:30'));
    expect(nextReminderAt(plan, now, { mode: 'blocked_urgent' })).toBeNull();
    expect(nextReminderAt(plan, now, { mode: 'relax_only' })).toEqual(atLocalTime(today, '12:30'));
  });
});

describe('reminders keep in step with sessions a day (REM-001, round 2: update automatically, with Undo)', () => {
  const slot = (slotNo: number, timeLocal: string, enabled = true, anchorKey: string | null = null): StepSlot => ({ slotNo, timeLocal, enabled, anchorKey });
  const three = [slot(1, '07:45', true, 'teeth'), slot(2, '12:30', true, 'lunch'), slot(3, '22:30', true, 'bed')];
  const on = (r: ReturnType<typeof keepInStep>) => (r.kind === 'updated' ? r.slots.filter((s) => s.enabled).map((s) => s.timeLocal).sort() : []);

  it('changes nothing when reminders and sessions did not match before', () => {
    expect(keepInStep(three, 2, 3)).toEqual({ kind: 'mismatch', reminders: 3 });
    expect(keepInStep([], 3, 4)).toEqual({ kind: 'mismatch', reminders: 0 });
    expect(keepInStep([slot(1, '07:45'), slot(2, '22:30', false)], 2, 1)).toEqual({ kind: 'mismatch', reminders: 1 });
  });

  it('removing a session turns off the middle reminder, not deletes it', () => {
    const r = keepInStep(three, 3, 2);
    if (r.kind !== 'updated') throw new Error('expected an update');
    expect(r.turnedOff.map((s) => s.timeLocal)).toEqual(['12:30']);
    expect(r.added).toEqual([]);
    expect(r.slots).toHaveLength(3);
    expect(on(r)).toEqual(['07:45', '22:30']);
  });

  it('going back brings back the same time', () => {
    const down = keepInStep(three, 3, 2);
    if (down.kind !== 'updated') throw new Error('expected an update');
    const custom = down.slots.map((s) => (s.slotNo === 2 ? { ...s, timeLocal: '13:15' } : s));
    const up = keepInStep(custom, 2, 3);
    if (up.kind !== 'updated') throw new Error('expected an update');
    expect(up.added.map((s) => [s.slotNo, s.timeLocal])).toEqual([[2, '13:15']]);
    expect(up.slots).toHaveLength(3);
  });

  it('adding a session adds lunch 12:30 for the middle slot', () => {
    const r = keepInStep([slot(1, '07:45', true, 'teeth'), slot(2, '22:30', true, 'bed')], 2, 3);
    if (r.kind !== 'updated') throw new Error('expected an update');
    expect(r.added).toEqual([{ slotNo: 3, timeLocal: '12:30', enabled: true, anchorKey: 'lunch' }]);
  });

  it('beyond 3, a new reminder goes in the middle of the longest gap', () => {
    const four = keepInStep(three, 3, 4);
    if (four.kind !== 'updated') throw new Error('expected an update');
    expect(four.added.map((s) => [s.slotNo, s.timeLocal, s.anchorKey])).toEqual([[4, '17:30', null]]);
    const five = keepInStep(four.slots, 4, 5);
    expect(on(five)).toEqual(['07:45', '12:30', '17:30', '20:00', '22:30']);
    expect(nextFreeTime(['07:45', '12:30', '17:30', '20:00', '22:30'])).toBe('15:00');
  });

  it('removing after an add undoes the last add first, and keeps morning and evening', () => {
    const four = keepInStep(three, 3, 4);
    if (four.kind !== 'updated') throw new Error('expected an update');
    const back = keepInStep(four.slots, 4, 3);
    if (back.kind !== 'updated') throw new Error('expected an update');
    expect(back.turnedOff.map((s) => s.slotNo)).toEqual([4]);
    expect(on(back)).toEqual(['07:45', '12:30', '22:30']);
  });

  it('from 2 to 1 keeps the first reminder of the day, from 1 to 2 adds the evening', () => {
    expect(on(keepInStep([slot(1, '07:45'), slot(2, '22:30')], 2, 1))).toEqual(['07:45']);
    expect(on(keepInStep([slot(1, '07:45')], 1, 2))).toEqual(['07:45', '22:30']);
  });

  it('works in several steps at once and for any number of slots', () => {
    const r = keepInStep(three, 3, 8);
    if (r.kind !== 'updated') throw new Error('expected an update');
    expect(r.slots.filter((s) => s.enabled)).toHaveLength(8);
    expect(new Set(r.slots.map((s) => s.slotNo)).size).toBe(8);
    expect(new Set(r.slots.map((s) => s.timeLocal)).size).toBe(8);
  });
});
