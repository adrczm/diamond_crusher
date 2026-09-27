// Today and the session summary: level range, next reminder, deferred setup cards and the day-3 baseline offer (C2, H2, H9).
import { addDays, atLocalTime } from '../../src/domain/dates';
import { SessionRunner } from '../../src/domain/session/engine';
import { durationS } from '../../src/domain/session/plan';
import { INITIAL_PRESCRIPTION } from '../../src/domain/progression';
import { savePlan } from '../../src/data/repositories/reminders';
import { getProfile, setGoals, updateProfile } from '../../src/data/repositories/profile';
import { updateSettings } from '../../src/data/repositories/settings';
import { saveSitting, type AttemptRecord } from '../../src/features/learnService';
import { completeScreening } from '../../src/features/safetyService';
import { planToday, saveSession } from '../../src/features/trainingService';
import { baselineOfferOpen, dismissSetup, loadHome, loadSessionSummary, nextReminderAt, stepsAhead } from '../../src/features/homeService';
import { freshDb } from '../helpers/db';

const good: AttemptRecord = {
  startedAt: '2026-03-01T09:00:00.000Z',
  cueKey: 'cue.male.shorten_penis',
  checkMirror: 'yes',
  checkTouch: 'not_done',
  feltRelease: 'yes',
  mistakes: { breathing: true, buttocks: true, thighs: true, tummy: true, lift: 'lift', leak: false },
};

async function setup() {
  const db = await freshDb();
  await updateProfile(db, { anatomy: 'male', onboarding_completed_at: '2026-03-01T08:00:00.000Z' });
  await setGoals(db, ['bladder_control']);
  await completeScreening(db, { kind: 'onboarding', answers: { 'Q-R1': 'no', 'Q-P1': 'no' }, startedAt: '2026-03-01T08:00:00.000Z' });
  await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
  return db;
}

async function runSession(db: Awaited<ReturnType<typeof setup>>, day: string, hour: string) {
  const start = atLocalTime(day, hour);
  const t = await planToday(db, start);
  if (!t.plan) throw new Error(`no plan: ${t.kind}`);
  const r = new SessionRunner(t.plan);
  r.start(0);
  r.tick(durationS(t.plan) * 1000 + 100);
  return saveSession(db, {
    plan: t.plan,
    slotNo: t.slotNo,
    extra: false,
    startedAt: start,
    endedAt: new Date(start.getTime() + durationS(t.plan) * 1000),
    completion: r.completion(),
    activeS: durationS(t.plan),
    results: r.results(),
    position: t.plan.position,
  });
}

describe('level range (H9)', () => {
  it('counts the steps to the top and the good weeks to the next unlock', () => {
    const a = stepsAhead(INITIAL_PRESCRIPTION, 1);
    // Sitting comes after the first good week.
    expect(a.weeksToNext).toBe(1);
    // 3 position steps + endurance on + 5 endurance seconds + 2 reps + 7 hold seconds.
    expect(a.steps).toBe(18);
    // Steady holds unlock at the end of week 3 at the earliest.
    const b = stepsAhead({ ...INITIAL_PRESCRIPTION, tier: 2 }, 1);
    expect(b.weeksToNext).toBe(3);
  });

  it('has nothing ahead at the top', () => {
    const top = { ...INITIAL_PRESCRIPTION, tier: 3, enduranceEnabled: true, enduranceHoldS: 10, holdS: 10, holdReps: 10, holdCeiling: 10 };
    expect(stepsAhead(top, 20)).toEqual({ steps: 0, weeksToNext: null });
  });
});

describe('next reminder', () => {
  const slots = [
    { slotNo: 1, timeLocal: '08:00', weekdays: 127, enabled: true },
    { slotNo: 2, timeLocal: '13:00', weekdays: 127, enabled: true },
    { slotNo: 3, timeLocal: '20:00', weekdays: 127, enabled: false },
  ];
  it('is the next slot today, or the first one tomorrow when the day is done', () => {
    const now = atLocalTime('2026-03-02', '09:00');
    expect(nextReminderAt(slots, now, 1, false)).toEqual(atLocalTime('2026-03-02', '13:00'));
    expect(nextReminderAt(slots, now, 2, false)).toEqual(atLocalTime('2026-03-03', '08:00'));
    expect(nextReminderAt(slots, now, 1, true)).toEqual(atLocalTime('2026-03-03', '08:00'));
    expect(nextReminderAt([], now, 0, false)).toBeNull();
  });
});

describe('baseline offer (C2)', () => {
  it('opens on the 3rd training day, not after Learn', () => {
    expect(baselineOfferOpen([], '2026-03-01')).toBe(false);
    expect(baselineOfferOpen(['2026-03-01', '2026-03-01', '2026-03-02'], '2026-03-02')).toBe(false);
    expect(baselineOfferOpen(['2026-03-01', '2026-03-02', '2026-03-04'], '2026-03-04')).toBe(true);
    expect(baselineOfferOpen(['2026-03-01', '2026-03-02', '2026-03-04'], addDays('2026-03-04', 15))).toBe(false);
  });

  it('Today shows it only from the 3rd training day', async () => {
    const db = await setup();
    expect((await loadHome(db, atLocalTime('2026-03-01', '10:00')))?.baselineOffer).toBe(false);
    for (const day of ['2026-03-01', '2026-03-02']) await runSession(db, day, '10:00');
    expect((await loadHome(db, atLocalTime('2026-03-02', '12:00')))?.baselineOffer).toBe(false);
    await runSession(db, '2026-03-03', '10:00');
    expect((await loadHome(db, atLocalTime('2026-03-03', '12:00')))?.baselineOffer).toBe(true);
  });
});

describe('setup cards on Today (C2)', () => {
  it('appear after the first full session and go away when done or dismissed', async () => {
    const db = await setup();
    const now = atLocalTime('2026-03-01', '12:00');
    expect((await loadHome(db, now))?.setup).toEqual([]);
    await runSession(db, '2026-03-01', '10:00');
    expect((await loadHome(db, now))?.setup).toEqual(['plan', 'expect', 'lock']);

    await dismissSetup(db, 'expect');
    expect((await getProfile(db))?.expectations_ack_at).not.toBeNull();
    await dismissSetup(db, 'lock');
    await savePlan(db, [{ slotNo: 1, anchorKey: 'wake', anchorCustom: null, timeLocal: '08:00', weekdays: 127, enabled: true }]);
    expect((await loadHome(db, now))?.setup).toEqual(['plan']);
    await updateSettings(db, { notification_permission: 'denied' });
    expect((await loadHome(db, now))?.setup).toEqual([]);
  });

  it('the lock card goes once the lock is on', async () => {
    const db = await setup();
    await runSession(db, '2026-03-01', '10:00');
    await updateSettings(db, { lock_enabled: true });
    expect((await loadHome(db, atLocalTime('2026-03-01', '12:00')))?.setup).not.toContain('lock');
  });
});

describe('session summary (H2)', () => {
  it('counts today, the week, the level and the next reminder', async () => {
    const db = await setup();
    await savePlan(db, [
      { slotNo: 1, anchorKey: 'wake', anchorCustom: null, timeLocal: '08:00', weekdays: 127, enabled: true },
      { slotNo: 2, anchorKey: 'lunch', anchorCustom: null, timeLocal: '13:00', weekdays: 127, enabled: true },
      { slotNo: 3, anchorKey: 'bed', anchorCustom: null, timeLocal: '21:00', weekdays: 127, enabled: true },
    ]);
    await updateSettings(db, { notification_permission: 'granted' });
    await runSession(db, '2026-03-02', '08:05');
    const s = await loadSessionSummary(db, atLocalTime('2026-03-02', '08:10'));
    expect(s.slotsDone).toBe(1);
    expect(s.slotsTotal).toBe(3);
    expect(s.week.trainedCount).toBe(1);
    expect(s.level).toBe(1);
    expect(s.levelMax).toBeGreaterThan(1);
    expect(s.next).toBe('sitting');
    expect(s.weeksToNext).toBe(1);
    expect(s.nextReminder).toEqual(atLocalTime('2026-03-02', '13:00'));
  });
});
