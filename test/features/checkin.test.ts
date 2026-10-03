// Symptom check-in end to end on a real database (06c PFB-041, PFB-042, PFB-047, PFB-048; 01 ONB-034; 04 PRG-004,
// PRG-013, PRG-034, PRG-035).
import { atLocalTime } from '../../src/domain/dates';
import { SessionRunner } from '../../src/domain/session/engine';
import { durationS } from '../../src/domain/session/plan';
import { insertEvent } from '../../src/data/repositories/events';
import { setGoals, updateProfile } from '../../src/data/repositories/profile';
import { getProgramme, listLevelChanges, updateProgramme } from '../../src/data/repositories/programme';
import { getSafetyState, listFlags, listScreeningRuns } from '../../src/data/repositories/safety';
import { updateSettings } from '../../src/data/repositories/settings';
import type { AnswerValue } from '../../src/domain/questionnaire';
import { saveSelfCheck } from '../../src/features/checkService';
import {
  answerEscalation,
  CHECKIN_FLAGS,
  checkinHome,
  checkinItems,
  refreshCheckin,
  saveCheckin,
  startLighterWeek,
} from '../../src/features/checkinService';
import { loadHome } from '../../src/features/homeService';
import { saveSitting, type AttemptRecord } from '../../src/features/learnService';
import { completeScreening } from '../../src/features/safetyService';
import { planToday, saveSession } from '../../src/features/trainingService';
import { freshDb } from '../helpers/db';

const good: AttemptRecord = {
  startedAt: '2026-03-01T09:00:00.000Z',
  cueKey: 'cue.male.shorten_penis',
  checkMirror: 'yes',
  checkTouch: 'not_done',
  feltRelease: 'yes',
  mistakes: { breathing: true, buttocks: true, thighs: true, tummy: true, lift: 'lift', leak: false },
};

type Db = Awaited<ReturnType<typeof freshDb>>;

async function setup(): Promise<Db> {
  const db = await freshDb();
  await updateProfile(db, { anatomy: 'male', onboarding_completed_at: '2026-03-01T08:00:00.000Z' });
  await setGoals(db, ['bladder_control', 'erection']);
  await updateSettings(db, { sessions_per_day_target: 2 });
  await completeScreening(db, { kind: 'onboarding', answers: { 'Q-R1': 'no', 'Q-P1': 'no' }, startedAt: '2026-03-01T08:00:00.000Z' });
  await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '07:00'));
  return db;
}

async function runSession(db: Db, day: string, hour: string) {
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

/** Two full sessions on each of the 7 days from `first`; returns the changes the week made. */
async function trainWeek(db: Db, first: string) {
  const changes = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(Date.parse(`${first}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    changes.push(...(await runSession(db, day, '08:00')).changes, ...(await runSession(db, day, '18:00')).changes);
  }
  return changes;
}

const checkin = (db: Db, day: string, answers: Record<string, AnswerValue>) =>
  saveCheckin(db, answers, { startedAt: atLocalTime(day, '07:00'), now: atLocalTime(day, '07:02') });

const leak = (db: Db, day: string) =>
  insertEvent(db, {
    type: 'leak',
    occurred_at: atLocalTime(day, '12:00').toISOString(),
    local_date: day,
    tz_offset_min: 0,
    entered_at: atLocalTime(day, '12:00').toISOString(),
    leak_situation: 'cough_sneeze',
    leak_amount: 'drops',
    activity_type: null,
    hardness: null,
    ejac_time_band: null,
    ejac_time_min: null,
    control_0_10: null,
    bother_0_10: null,
    item_set_version: 1,
  });

const sex = (db: Db, day: string, hardness: number) =>
  insertEvent(db, {
    type: 'sexual_activity',
    occurred_at: atLocalTime(day, '22:00').toISOString(),
    local_date: day,
    tz_offset_min: 0,
    entered_at: atLocalTime(day, '22:00').toISOString(),
    leak_situation: null,
    leak_amount: null,
    activity_type: 'solo',
    hardness,
    ejac_time_band: null,
    ejac_time_min: null,
    control_0_10: null,
    bother_0_10: null,
    item_set_version: 1,
  });

const count = async (db: Db, key: string) => (await listFlags(db)).filter((f) => f.flag_key === key).length;

describe('check-in offers (PFB-041, PFB-042, PFB-047, PFB-048)', () => {
  it('new then doubled leaks offer the check-in, at most once per 28 days per reason unless worse again', async () => {
    const db = await setup();
    await leak(db, '2026-05-10');
    await refreshCheckin(db, atLocalTime('2026-05-10', '20:00'));
    expect(await count(db, CHECKIN_FLAGS.offer)).toBe(1);
    expect(await count(db, CHECKIN_FLAGS.newLeaks)).toBe(1);
    expect((await checkinHome(db, atLocalTime('2026-05-10', '20:00'))).offers).toEqual(['leaks']);
    expect((await loadHome(db, atLocalTime('2026-05-10', '20:00')))?.suggestions[0]).toBe('checkin');

    // The same signal 2 days later: held back by the cooldown.
    await refreshCheckin(db, atLocalTime('2026-05-12', '20:00'));
    expect(await count(db, CHECKIN_FLAGS.offer)).toBe(1);
    expect(await count(db, CHECKIN_FLAGS.newLeaks)).toBe(1);

    // Worse again: 3 leaks in the block (doubled) come through within the 28 days.
    await leak(db, '2026-05-13');
    await leak(db, '2026-05-14');
    await refreshCheckin(db, atLocalTime('2026-05-14', '20:00'));
    expect(await count(db, CHECKIN_FLAGS.offer)).toBe(2);
    expect(await count(db, CHECKIN_FLAGS.newLeaks)).toBe(2);

    // A check-in closes the offers; the same level does not bring a new one.
    await checkin(db, '2026-05-15', { T1: 'no', L1: 2, U1: 2, E1: 2, G1: 2 });
    expect((await checkinHome(db, atLocalTime('2026-05-15', '20:00'))).offers).toEqual([]);
    await refreshCheckin(db, atLocalTime('2026-05-16', '20:00'));
    expect((await checkinHome(db, atLocalTime('2026-05-16', '20:00'))).offers).toEqual([]);

    // Another reason has its own cooldown: an erection change (male) is offered on the same day.
    for (const d of ['2026-03-25', '2026-04-01', '2026-04-08']) await sex(db, d, 4);
    for (const d of ['2026-05-01', '2026-05-05', '2026-05-12']) await sex(db, d, 2);
    await refreshCheckin(db, atLocalTime('2026-05-16', '21:00'));
    expect((await checkinHome(db, atLocalTime('2026-05-16', '21:00'))).offers).toEqual(['erections']);
    expect(await count(db, CHECKIN_FLAGS.erectionChange)).toBe(1);
    // The new signal cards bring the health note back on Today (ONB-032).
    const home = await loadHome(db, atLocalTime('2026-05-16', '21:00'));
    expect(home?.healthNote.keys).toEqual(expect.arrayContaining(['Q-G1', 'Q-G2']));
  });

  it('does not ask about erections outside the male profile', () => {
    expect(checkinItems('male').map((i) => i.itemId)).toEqual(['T1', 'L1', 'U1', 'E1', 'G1']);
    expect(checkinItems('female').map((i) => i.itemId)).toEqual(['T1', 'L1', 'U1', 'G1']);
  });
});

describe('check-in safety (ONB-034)', () => {
  it('the urgent and pain answers go through the safety service with kind something_changed', async () => {
    const db = await setup();
    const r = await completeScreening(db, { kind: 'something_changed', answers: { 'Q-R1': 'yes' }, startedAt: '2026-05-01T07:00:00Z', sourceRef: 'symptom_checkin' });
    expect(r.mode).toBe('blocked_urgent');
    const run = (await listScreeningRuns(db)).pop();
    expect(run).toMatchObject({ kind: 'something_changed', source_ref: 'symptom_checkin' });
  });

  it('a training-pain answer follows the pain route, not just a hold', async () => {
    const db = await setup();
    const out = await checkin(db, '2026-05-01', { T1: 'yes', L1: 2, U1: 2, E1: 2, G1: 3 });
    expect(out.relaxOnly).toBe(true);
    expect((await getSafetyState(db)).mode).toBe('relax_only');
    expect(out.holdActive).toBe(true);
  });
});

describe('progression hold (PRG-004 condition 5, PRG-035)', () => {
  it('a "worse" check-in holds the week; a later "same" releases it', async () => {
    const db = await setup();
    const worse = await checkin(db, '2026-03-01', { T1: 'no', L1: 3, U1: 2, E1: 2, G1: 3 });
    expect(worse).toMatchObject({ holdActive: true, holdStarted: true, escalated: false, cautionKeys: ['Q-G1'] });
    // LRN-050: the technique re-check is offered.
    expect((await getProgramme(db)).technique_prompt_at).not.toBeNull();
    expect(await count(db, CHECKIN_FLAGS.worsening)).toBe(1);

    expect(await trainWeek(db, '2026-03-01')).toEqual([]);
    expect((await getProgramme(db)).position_tier).toBe(0);

    const same = await checkin(db, '2026-03-08', { T1: 'no', L1: 2, U1: 2, E1: 2, G1: 2 });
    expect(same).toMatchObject({ holdActive: false, holdReleased: true });
    const changes = await trainWeek(db, '2026-03-08');
    expect(changes).toHaveLength(1);
    expect((await getProgramme(db)).position_tier).toBe(1);
  });

  it('the same week without a check-in qualifies (control)', async () => {
    const db = await setup();
    expect(await trainWeek(db, '2026-03-01')).toHaveLength(1);
  });

  it('a skipped "compared with a month ago" answer neither starts nor ends a hold', async () => {
    const db = await setup();
    await checkin(db, '2026-03-01', { G1: 3 });
    const skipped = await checkin(db, '2026-03-02', { T1: 'no' });
    expect(skipped).toMatchObject({ overall: null, holdActive: true, holdReleased: false });
  });

  it('"worse" again shows the firmer card; an answer hides it; training continues', async () => {
    const db = await setup();
    await checkin(db, '2026-04-01', { G1: 3, E1: 3 });
    const again = await checkin(db, '2026-04-29', { G1: 3 });
    expect(again.escalated).toBe(true);
    const home = await checkinHome(db, atLocalTime('2026-04-29', '08:00'));
    expect(home.escalation.why).toEqual(['repeat']);
    expect(home.hold.active).toBe(true);
    expect((await planToday(db, atLocalTime('2026-04-29', '08:00'))).kind).toBe('strength');
    await answerEscalation(db, 'will_book');
    expect((await checkinHome(db, atLocalTime('2026-04-29', '08:00'))).escalation.ids).toEqual([]);
    const better = await checkin(db, '2026-05-27', { G1: 1 });
    expect(better).toMatchObject({ holdActive: false, holdReleased: true, escalated: false });
  });

  it('a hold that reaches programme week 12 shows the firmer card, and the follow-up check-in is offered', async () => {
    const db = await setup();
    await runSession(db, '2026-03-01', '08:00');
    await checkin(db, '2026-03-02', { G1: 3 });
    // One session a week keeps every day active (gaps of 6 days), so 2026-05-17 is programme week 12.
    for (let w = 1; w <= 10; w++) await runSession(db, new Date(Date.parse('2026-03-01T12:00:00Z') + w * 7 * 86400000).toISOString().slice(0, 10), '08:00');
    await refreshCheckin(db, atLocalTime('2026-05-10', '20:00'));
    let home = await checkinHome(db, atLocalTime('2026-05-10', '20:00'));
    expect(home.escalation.ids).toEqual([]);
    expect(home.offers).toEqual(['follow_up']);
    await runSession(db, '2026-05-17', '08:00');
    await refreshCheckin(db, atLocalTime('2026-05-17', '20:00'));
    home = await checkinHome(db, atLocalTime('2026-05-17', '20:00'));
    expect(home.escalation.why).toEqual(['week12']);
    // Raised once per hold.
    await refreshCheckin(db, atLocalTime('2026-05-18', '20:00'));
    expect(await count(db, CHECKIN_FLAGS.escalation)).toBe(1);
  });

  it('the optional lighter week eases only the plan; the stored level does not change (PRG-034)', async () => {
    const db = await setup();
    await updateProgramme(db, { hold_s: 6, hold_reps: 9 });
    await checkin(db, '2026-03-01', { G1: 3 });
    const before = await listLevelChanges(db);
    await startLighterWeek(db, '2026-03-02');
    const t = await planToday(db, atLocalTime('2026-03-02', '08:00'));
    expect(t.lighter).toBe(true);
    expect(t.plan?.load).toMatchObject({ H: 5, N: 7 });
    expect(await getProgramme(db)).toMatchObject({ hold_s: 6, hold_reps: 9 });
    expect(await listLevelChanges(db)).toEqual(before);
    expect((await checkinHome(db, atLocalTime('2026-03-02', '08:00'))).hold.lighterUntil).toBe('2026-03-08');
    expect((await planToday(db, atLocalTime('2026-03-09', '08:00'))).plan?.load).toMatchObject({ H: 6, N: 9 });
  });
});

describe('no automatic level drop (PRG-013, PRG-034)', () => {
  it('a lower self-check keeps H and records no level change', async () => {
    const db = await setup();
    await runSession(db, '2026-03-01', '08:00');
    await updateProgramme(db, { hold_s: 8, hold_ceiling: 10 });
    const before = (await listLevelChanges(db)).length;
    const out = await saveSelfCheck(
      db,
      {
        kind: 'monthly',
        position: 'lying',
        anatomy_at_check: 'male',
        bladder_empty: true,
        not_after_session: true,
        same_position: true,
        time_of_day_shifted: false,
        sign_method: 'mirror',
        sign_result: 'yes',
        bulge: 'no',
        longest_hold_s: 3,
        longest_hold_retry_s: null,
        repeated_hold_len_s: 3,
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
      },
      atLocalTime('2026-03-29', '09:00')
    );
    expect(out.changes).toEqual([]);
    const prog = await getProgramme(db);
    expect(prog.hold_s).toBe(8);
    expect(prog.hold_ceiling).toBe(5);
    expect((await listLevelChanges(db)).length).toBe(before);
  });
});
