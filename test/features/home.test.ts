// Today and the session summary: level range, next reminder, deferred setup cards and the day-3 baseline offer (C2, H2, H9).
import { addDays, atLocalTime } from '../../src/domain/dates';
import { SessionRunner } from '../../src/domain/session/engine';
import { durationS } from '../../src/domain/session/plan';
import { INITIAL_PRESCRIPTION } from '../../src/domain/progression';
import { savePlan } from '../../src/data/repositories/reminders';
import { getProfile, setGoals, updateProfile } from '../../src/data/repositories/profile';
import { getSettings, setTodayHero, setTodayHeroSync, updateSettings } from '../../src/data/repositories/settings';
import { listFlags, raiseFlag } from '../../src/data/repositories/safety';
import { reachMilestone } from '../../src/data/repositories/misc';
import type { LevelChangeRecord } from '../../src/domain/progression';
import type { Answers } from '../../src/domain/safety';
import { saveSitting, type AttemptRecord } from '../../src/features/learnService';
import { answerHealthNote, CAUTION_FLAG, completeScreening, healthNoteState } from '../../src/features/safetyService';
import { planToday, saveSession } from '../../src/features/trainingService';
import {
  baselineOfferOpen,
  bestTiles,
  dismissSetup,
  levelPath,
  loadHome,
  loadSessionSummary,
  nextReminderAt,
  seeLevelUp,
  STATIONS,
  stepsAhead,
  SUGGESTION_CAP,
  suggestionLater,
  suggestionQueue,
  todayTimeline,
  type SuggestionKey,
} from '../../src/features/homeService';
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

// ---------- Round 2 Today (2026-10-03) ----------

describe('today timeline (A3)', () => {
  it('puts each session at its reminder time, with done, next and later, and the now line between', async () => {
    const db = await setup();
    await savePlan(db, [
      { slotNo: 1, anchorKey: 'wake', anchorCustom: null, timeLocal: '08:00', weekdays: 127, enabled: true },
      { slotNo: 2, anchorKey: 'lunch', anchorCustom: null, timeLocal: '13:00', weekdays: 127, enabled: true },
      { slotNo: 3, anchorKey: 'bed', anchorCustom: null, timeLocal: '21:00', weekdays: 127, enabled: true },
    ]);
    await runSession(db, '2026-03-02', '08:05');
    const m = await loadHome(db, atLocalTime('2026-03-02', '12:40'));
    expect(m?.timeline.map((s) => [s.n, s.time, s.state])).toEqual([
      [1, '08:00', 'done'],
      [2, '13:00', 'next'],
      [3, '21:00', 'later'],
    ]);
    expect(m?.nowAt).toBe(1);
    expect(m?.daySessions.filter((n) => n > 0)).toEqual([1]);
    expect(m?.dayDose).toBe(3);
  });

  it('has no times and no now line without reminders', async () => {
    const db = await setup();
    const m = await loadHome(db, atLocalTime('2026-03-02', '12:40'));
    expect(m?.timeline.map((s) => s.time)).toEqual([null, null, null]);
    expect(m?.nowAt).toBeNull();
    const pure = todayTimeline(['lying', 'sitting'], 2, true, [], '2026-03-02', atLocalTime('2026-03-02', '12:00'));
    expect(pure.slots.map((s) => s.state)).toEqual(['done', 'done']);
  });
});

describe('one suggestion queue (critique priority 2, decision 6)', () => {
  const base = { safety: false, check: null, technique: false, baseline: false, summary: false, setup: [], backup: false, later: new Set<SuggestionKey>() };
  it('puts the safety re-check first, then prompts, setup and the backup', () => {
    const q = suggestionQueue({ ...base, safety: true, check: 'check', summary: true, setup: ['plan', 'expect'], backup: true });
    expect(q).toEqual(['safety', 'check', 'summary', 'plan', 'expect', 'backup']);
    expect(q.slice(0, SUGGESTION_CAP)).toEqual(['safety', 'check']);
  });

  it('leaves out what was put off today, but never the safety re-check', () => {
    const q = suggestionQueue({ ...base, safety: true, technique: true, baseline: true, later: new Set<SuggestionKey>(['safety', 'technique']) });
    expect(q).toEqual(['safety', 'baseline']);
  });

  it('Today counts setup cards in the same queue, and Not now takes one out', async () => {
    const db = await setup();
    await runSession(db, '2026-03-01', '10:00');
    const now = atLocalTime('2026-03-01', '12:00');
    expect((await loadHome(db, now))!.suggestions).toEqual(expect.arrayContaining(['plan', 'expect']));
    await suggestionLater(db, 'plan', '2026-03-01');
    expect((await loadHome(db, now))!.suggestions).not.toContain('plan');
  });
});

describe('health note (ONB-023, ONB-032 as changed by A2)', () => {
  async function cautionSetup() {
    const db = await freshDb();
    await updateProfile(db, { anatomy: 'male', onboarding_completed_at: '2026-03-01T08:00:00.000Z' });
    await setGoals(db, ['bladder_control']);
    await completeScreening(db, { kind: 'onboarding', answers: { 'Q-R1': 'no', 'Q-P1': 'no', 'Q-G1': 'yes' }, startedAt: '2026-03-01T08:00:00.000Z' });
    return db;
  }
  const recheck = (db: Awaited<ReturnType<typeof freshDb>>, answers: Answers) =>
    completeScreening(db, { kind: 'something_changed', answers, startedAt: '2026-03-10T08:00:00.000Z' });

  it('shows until answered, and stores the answer on the flag', async () => {
    const db = await cautionSetup();
    expect((await loadHome(db))!.healthNote).toMatchObject({ keys: ['Q-G1'], show: true, hidden: false });
    await answerHealthNote(db, 'will_book');
    expect((await loadHome(db))!.healthNote).toMatchObject({ keys: ['Q-G1'], show: false, hidden: true });
    const flags = (await listFlags(db)).filter((f) => f.flag_key === CAUTION_FLAG);
    expect(flags.map((f) => [f.signal_key, f.response])).toEqual([['Q-G1', 'will_book']]);
    expect(flags[0].dismissed_at).not.toBeNull();
  });

  it('stays hidden after a re-check with the same yes answers', async () => {
    const db = await cautionSetup();
    await answerHealthNote(db, 'dismissed');
    await recheck(db, { 'Q-R1': 'no', 'Q-G1': 'yes', 'Q-G3': 'no' });
    expect((await loadHome(db))!.healthNote).toMatchObject({ show: false, hidden: true });
  });

  it('comes back only when a caution answer turns from no to yes', async () => {
    const db = await cautionSetup();
    await answerHealthNote(db, 'already_seen');
    await recheck(db, { 'Q-R1': 'no', 'Q-G1': 'yes', 'Q-G3': 'yes' });
    expect((await loadHome(db))!.healthNote).toMatchObject({ keys: ['Q-G1', 'Q-G3'], show: true });
    await answerHealthNote(db, 'dismissed');
    expect((await loadHome(db))!.healthNote.show).toBe(false);
    // Q-G1 goes away, then comes back: that is a change, so the note shows again.
    await recheck(db, { 'Q-R1': 'no', 'Q-G1': 'no', 'Q-G3': 'yes' });
    expect((await loadHome(db))!.healthNote).toMatchObject({ keys: ['Q-G3'], show: false, hidden: true });
    await recheck(db, { 'Q-R1': 'no', 'Q-G1': 'yes', 'Q-G3': 'yes' });
    expect((await loadHome(db))!.healthNote.show).toBe(true);
  });

  it('gives an older caution its flag on load, and a logged-result signal brings the note back', async () => {
    const db = await cautionSetup();
    await db.run('DELETE FROM safety_flag');
    expect((await loadHome(db))!.healthNote.show).toBe(true);
    expect((await listFlags(db)).filter((f) => f.flag_key === CAUTION_FLAG)).toHaveLength(1);
    await answerHealthNote(db, 'dismissed');
    expect((await loadHome(db))!.healthNote.show).toBe(false);
    await raiseFlag(db, 'new_leaks', { signalKey: 'leaks:4w' });
    expect((await loadHome(db))!.healthNote).toMatchObject({ keys: ['Q-G1'], show: true });
  });

  it('is not shown outside caution mode, and a signal flag uses its caution text', () => {
    const flag = { id: 'f', flag_key: 'erection_change', signal_key: null, raised_at: '', source_ref: null, dismissed_at: null, response: null };
    expect(healthNoteState('relax_only', ['Q-P1', 'Q-G1'], []).keys).toEqual([]);
    expect(healthNoteState('normal', [], [flag])).toMatchObject({ keys: ['Q-G2'], show: true, openIds: ['f'] });
    expect(healthNoteState('normal', [], [{ ...flag, dismissed_at: 'x', response: 'dismissed' as const }])).toMatchObject({
      keys: [],
      show: false,
      hidden: false,
    });
  });
});

describe('level path, personal bests and the level-up card (A1, MOT-031, MOT-032)', () => {
  it('places the person on the path and counts good weeks since the last station', () => {
    const rec = (variable: string, reason = 'progression') => ({ reason, variable, before: 0, after: 1 }) as LevelChangeRecord;
    expect(levelPath('sitting', 1, [])).toEqual({ current: 0, goodWeeksDone: 0, goodWeeksLeft: 1 });
    expect(levelPath('standing', 2, [rec('position'), rec('hold_s')])).toEqual({ current: 1, goodWeeksDone: 1, goodWeeksLeft: 2 });
    expect(levelPath('top', null, []).current).toBe(STATIONS.length);
  });

  it('shows the best of each measure, and only a rise', () => {
    const check = (at: string, hold: number, row: number, ok = true) => ({
      id: at,
      performedAt: at,
      position: 'lying' as const,
      conditionsMet: ok,
      techniqueFlag: false,
      longestHoldS: hold,
      repeatedHolds: row,
      repeatedHoldLenS: 5,
      quickFlicks: 10,
    });
    expect(bestTiles([]).hold).toEqual({ best: null, series: [], rise: 0 });
    const t = bestTiles([check('2026-03-01', 8, 6), check('2026-04-01', 12, 6), check('2026-05-01', 10, 5), check('2026-05-02', 20, 9, false)]);
    expect(t.hold).toEqual({ best: 12, series: [8, 12, 10], rise: 4 });
    expect(t.inRow).toEqual({ best: 6, series: [6, 6, 5], rise: 0 });
  });

  it('shows a new level once, until it is seen', async () => {
    const db = await setup();
    expect((await loadHome(db))!.levelUp).toBeNull();
    await reachMilestone(db, 'level:1', null);
    expect((await loadHome(db))!.levelUp).toBe('level:1');
    await seeLevelUp(db);
    expect((await loadHome(db))!.levelUp).toBeNull();
  });

  it('keeps the Today card choice per device unless it is synced', async () => {
    const db = await setup();
    expect((await loadHome(db))!.hero).toBe('path');
    await setTodayHero(db, await getSettings(db), 'rings');
    expect((await loadHome(db))!.hero).toBe('rings');
    await setTodayHeroSync(db, await getSettings(db), true);
    expect((await getSettings(db)).today_hero_shared).toBe('rings');
  });
});
