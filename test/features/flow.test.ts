// End-to-end rules over a real database: onboarding → learn → sessions → weekly step-up → pain route.
import { addDays, atLocalTime, toLocalDate } from '../../src/domain/dates';
import { SessionRunner } from '../../src/domain/session/engine';
import { durationS } from '../../src/domain/session/plan';
import { getProgramme, listLevelChanges } from '../../src/data/repositories/programme';
import { getSafetyState } from '../../src/data/repositories/safety';
import { saveSessionLog } from '../../src/data/repositories/sessions';
import { setGoals, updateProfile } from '../../src/data/repositories/profile';
import { saveSitting, type AttemptRecord } from '../../src/features/learnService';
import { clear, completeScreening, reportPain } from '../../src/features/safetyService';
import { planToday, saveSession, pendingGap, applyGapChoice } from '../../src/features/trainingService';
import { ensureSchedule, currentCheck, saveSelfCheck } from '../../src/features/checkService';
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
  await setGoals(db, ['bladder_control', 'erection']);
  await completeScreening(db, { kind: 'onboarding', answers: { 'Q-R1': 'no', 'Q-P1': 'no' }, startedAt: '2026-03-01T08:00:00.000Z' });
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

describe('training flow', () => {
  it('locks sessions until the squeeze is learned (LRN-001), then plans 3 lying sessions', async () => {
    const db = await setup();
    expect((await planToday(db, atLocalTime('2026-03-01', '10:00'))).kind).toBe('learn');
    const res = await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    expect(res.result).toBe('pass');
    const prog = await getProgramme(db);
    expect(prog.phase).toBe('build');
    expect(prog.build_started_on).toBe('2026-03-01');
    const t = await planToday(db, atLocalTime('2026-03-01', '10:00'));
    expect(t.kind).toBe('strength');
    expect(t.slotsTotal).toBe(3);
    expect(t.plan?.position).toBe('lying');
  });

  it('steps up once after a qualifying week (PRG-004 to PRG-006) and the day plan closes after the dose', async () => {
    const db = await setup();
    await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    for (let d = 0; d < 7; d++) {
      const day = addDays('2026-03-01', d);
      await runSession(db, day, '10:00');
      await runSession(db, day, '15:00');
      await runSession(db, day, '20:00');
      if (d === 0) expect((await planToday(db, atLocalTime(day, '21:00'))).kind).toBe('day_done');
    }
    const prog = await getProgramme(db);
    expect(prog.active_days).toBe(7);
    expect(prog.position_tier).toBe(1);
    const changes = (await listLevelChanges(db)).filter((c) => c.reason === 'progression');
    expect(changes).toHaveLength(1);
    // Week 2 day 1 now includes sitting.
    const next = await planToday(db, atLocalTime('2026-03-08', '09:00'));
    expect(next.plan?.position).toBe('lying');
  });

  it('no step-up in a week with pain (PRG-012)', async () => {
    const db = await setup();
    await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    for (let d = 0; d < 7; d++) {
      const day = addDays('2026-03-01', d);
      const s = await runSession(db, day, '10:00');
      await runSession(db, day, '15:00');
      if (d === 2) await saveSessionLog(db, { session_id: s.id, feel: 3, pain: 'a_little', off_ticks: null, item_set_version: 1 });
    }
    expect((await getProgramme(db)).position_tier).toBe(0);
  });

  it('pain switches to relaxation only until cleared (ONB-041, ONB-042)', async () => {
    const db = await setup();
    await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    expect(await reportPain(db, 'yes', 'session:x', '2026-03-02')).toBe(true);
    expect((await getSafetyState(db)).mode).toBe('relax_only');
    expect((await planToday(db, atLocalTime('2026-03-02', '10:00'))).kind).toBe('relax');
    await clear(db, 'pain');
    expect((await getSafetyState(db)).mode).toBe('normal');
  });

  it('offers a gentler restart after a break (PRG-032)', async () => {
    const db = await setup();
    await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    await runSession(db, '2026-03-01', '10:00');
    expect(await pendingGap(db, '2026-03-05')).toBeNull();
    const gap = await pendingGap(db, '2026-03-13');
    expect(gap?.band).toBe('short');
    await applyGapChoice(db, '2026-03-13', false);
    expect(await pendingGap(db, '2026-03-13')).toBeNull();
  });

  it('a baseline self-check before the first session sets the starting load (PRG-002)', async () => {
    const db = await setup();
    await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    const out = await saveSelfCheck(db, {
      kind: 'baseline',
      position: 'lying',
      anatomy_at_check: 'male',
      bladder_empty: true,
      not_after_session: true,
      same_position: true,
      time_of_day_shifted: false,
      sign_method: 'mirror',
      sign_result: 'yes',
      bulge: 'no',
      longest_hold_s: 6,
      longest_hold_retry_s: null,
      repeated_hold_len_s: 6,
      repeated_holds: 5,
      quick_flicks: 10,
      breathing_ok: 'yes',
      glutes_belly_relaxed: 'yes',
      full_release: 'yes',
      pain: 'no',
      technique_flag: false,
      technique_unsure_at_baseline: false,
      aborted_at_step: null,
      status: 'complete',
      scheduled_check_id: null,
    });
    expect(out.relaxOnly).toBe(false);
    // UX audit M5: nothing to call a "best" on the first check.
    expect(out.best).toEqual({ longest_hold: null, repeated_holds: null, quick_flicks: null });
    const prog = await getProgramme(db);
    expect(prog.hold_s).toBe(6);
    expect(prog.hold_reps).toBe(5);
    expect(prog.hold_ceiling).toBe(8);
  });

  it('schedules the first monthly check 4 weeks after training starts', async () => {
    const db = await setup();
    await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    await ensureSchedule(db, '2026-03-02');
    const c = await currentCheck(db, '2026-03-02');
    expect(c?.row.due_on).toBe('2026-03-29');
    expect(c?.open).toBe(false);
    expect(c?.parts).toEqual(['safety', 'sexual_flag', 'questionnaires', 'self_check']);
    expect(toLocalDate(new Date())).toBeTruthy();
  });
});
