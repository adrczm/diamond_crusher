// Progress tab model (06c, round 2 Progress): built from stored rows, every card and range draws without errors.
import { addDays, atLocalTime } from '../../src/domain/dates';
import { SessionRunner } from '../../src/domain/session/engine';
import { durationS } from '../../src/domain/session/plan';
import { insertSelfCheck, type SelfCheckRow } from '../../src/data/repositories/checks';
import { insertContextFlag, insertEvent } from '../../src/data/repositories/events';
import { reachMilestone } from '../../src/data/repositories/misc';
import { setGoals, updateProfile } from '../../src/data/repositories/profile';
import { saveSitting, type AttemptRecord } from '../../src/features/learnService';
import { buildProgress, loadProgress } from '../../src/features/progressService';
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

function check(date: string, longest: number, extra: Partial<SelfCheckRow> = {}): Omit<SelfCheckRow, 'id'> {
  return {
    kind: 'monthly',
    performed_at: `${date}T09:00:00.000Z`,
    local_date: date,
    tz_offset_min: 0,
    completed_at: `${date}T09:10:00.000Z`,
    position: 'lying',
    anatomy_at_check: 'male',
    bladder_empty: true,
    not_after_session: true,
    same_position: true,
    time_of_day_shifted: false,
    sign_method: 'mirror',
    sign_result: 'yes',
    bulge: 'no',
    longest_hold_s: longest,
    longest_hold_retry_s: null,
    repeated_hold_len_s: 5,
    repeated_holds: 6,
    quick_flicks: 8,
    breathing_ok: 'yes',
    glutes_belly_relaxed: 'yes',
    full_release: 'yes',
    pain: 'no',
    technique_flag: false,
    technique_unsure_at_baseline: false,
    aborted_at_step: null,
    status: 'complete',
    item_set_version: 1,
    scheduled_check_id: null,
    ...extra,
  };
}

async function setup() {
  const db = await freshDb();
  await updateProfile(db, { anatomy: 'male', onboarding_completed_at: '2026-03-01T08:00:00.000Z' });
  await setGoals(db, ['bladder_control', 'erection']);
  await completeScreening(db, { kind: 'onboarding', answers: { 'Q-R1': 'no', 'Q-P1': 'no' }, startedAt: '2026-03-01T08:00:00.000Z' });
  await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
  for (let i = 0; i < 10; i++) {
    const start = atLocalTime(addDays('2026-03-02', i), '09:00');
    const t = await planToday(db, start);
    if (!t.plan) throw new Error(`no plan: ${t.kind}`);
    const r = new SessionRunner(t.plan);
    r.start(0);
    r.tick(durationS(t.plan) * 1000 + 100);
    await saveSession(db, {
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
  await insertSelfCheck(db, check('2026-03-01', 8));
  await insertSelfCheck(db, check('2026-03-29', 9, { bladder_empty: false }));
  const pb = await insertSelfCheck(db, check('2026-05-24', 12));
  await reachMilestone(db, `pr:${pb}`, pb);
  await insertContextFlag(db, { kind: 'other', from_date: '2026-03-05', to_date: null, note: 'Had a cold for most of the week' });
  for (const d of ['2026-05-01', '2026-05-10', '2026-05-20']) {
    await insertEvent(db, {
      type: 'sexual_activity',
      occurred_at: `${d}T21:00:00.000Z`,
      local_date: d,
      tz_offset_min: 0,
      entered_at: `${d}T21:05:00.000Z`,
      leak_situation: null,
      leak_amount: null,
      activity_type: 'solo',
      hardness: 3,
      ejac_time_band: null,
      ejac_time_min: null,
      control_0_10: null,
      bother_0_10: null,
      item_set_version: 1,
    });
  }
  await insertEvent(db, {
    type: 'leak',
    occurred_at: '2026-05-15T10:00:00.000Z',
    local_date: '2026-05-15',
    tz_offset_min: 0,
    entered_at: '2026-05-15T10:00:00.000Z',
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
  return db;
}

describe('Progress model', () => {
  it('builds every card for every range', async () => {
    const db = await setup();
    const m = buildProgress(await loadProgress(db), '2026-05-27');
    expect(m.earlyDays).toBe(false);
    for (const r of ['12w', '12m', 'all'] as const) {
      for (const monthly of [true, false]) {
        const s = m.consistency(r, monthly);
        expect(s.points.length).toBeGreaterThan(0);
        expect(s.table.rows).toHaveLength(s.points.length);
        expect(s.summary.length).toBeGreaterThan(10);
      }
      m.feelSeries(r);
      for (const item of m.sexual) m.sexualSeries(item, r);
    }
    expect(m.consistency('12w', false).points).toHaveLength(12);
    expect(m.consistency('12m', true).points).toHaveLength(12);
    expect(m.consistency('12m', false).points).toHaveLength(52);
    // The day note shows as a marker on the week it falls in (PFB-005), with its first words in the table.
    const all = m.consistency('all', false);
    expect(all.markers.length).toBe(1);
    expect(all.table.rows.some((r) => r[2].includes('Had a cold for…'))).toBe(true);
  });

  it('shows the record with a gap, a hollow check and the best marked (PFB-011, AC-PFB-6)', async () => {
    const db = await setup();
    const m = buildProgress(await loadProgress(db), '2026-05-27');
    const lying = m.records[0];
    expect(lying.position).toBe('lying');
    expect(lying.best.longest_hold).toBe(12);
    const s = m.recordSeries(lying, 'longest_hold', 'all');
    // 29 Mar to 24 May is 56 days: a gap goes between them.
    expect(s.points.map((p) => p.value)).toEqual([8, 9, null, 12]);
    expect(s.points[1].hollow).toBe(true);
    expect(s.best).toBe(3);
    expect(s.table.rows[1][4]).toContain('condition');
    expect(m.milestones.some((x) => x.kind === 'best' && x.text.includes('12 s longest strong hold'))).toBe(true);
  });

  it('lists sexual items for the goals only and the leaks of the last 12 weeks', async () => {
    const db = await setup();
    const m = buildProgress(await loadProgress(db), '2026-05-27');
    expect(m.sexual.map((x) => x.key)).toEqual(['hardness']);
    expect(m.sexual[0].comparison.current).toBe(3);
    expect(m.sexual[0].comparison.direction).toBeNull();
    expect(m.leaks12).toBe(1);
    expect(m.blocks[m.blocks.length - 1].bySituation).toEqual({ cough_sneeze: 1 });
    expect(m.symptoms.status).toBe('none');
    expect(m.feel.countCurrent).toBe(0);
  });
});
