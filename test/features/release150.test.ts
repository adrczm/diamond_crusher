// Release 1.5.0: the one next-check line (W2), Today's hover count, typing sessions a day, editing a logged entry, and
// time to ejaculation by activity type (Q3; 06a SC-002, EVT-031; 06c PFB-016).
import { HOME, PROGRESS } from '../../src/content/en/strings';
import { listContextFlags, listEvents, insertContextFlag, insertEvent, updateEvent, type EventRow } from '../../src/data/repositories/events';
import { setGoals, updateProfile } from '../../src/data/repositories/profile';
import { nextCheckWindow } from '../../src/domain/checkins';
import { addDays, formatShort } from '../../src/domain/dates';
import { ejacBlocks, ejacRank } from '../../src/domain/progress';
import { checkLine } from '../../src/features/checkService';
import { answersChanged, eventPatch, flagPatch, valuesOf } from '../../src/features/logEdit';
import { buildProgress, ejacRangeText, loadProgress } from '../../src/features/progressService';
import { parseCount, stepKey } from '../../src/ui/stepper';
import { freshDb } from '../helpers/db';

/** A scheduled check that opens 3 days before it is due (WINDOW_BEFORE). */
const check = (id: string, status: string, due_on: string, kind = 'monthly_check') => ({ id, kind, due_on, window_open: addDays(due_on, -3), status });

describe('next check line (W2)', () => {
  it('says "First check" before any check is done, with the day it opens and the day it is due', () => {
    const w = nextCheckWindow([check('a', 'upcoming', '2026-10-27')]);
    expect(w).toEqual({ opensOn: '2026-10-24', dueOn: '2026-10-27', first: true });
    expect(checkLine(w!)).toBe('First check: opens Sat 24 Oct, due Tue 27 Oct');
  });

  it('says "Next check" after a check is done, skipped or missed, and picks the earliest open one', () => {
    for (const past of ['completed', 'skipped', 'missed']) {
      const w = nextCheckWindow([check('a', past, '2026-09-29'), check('c', 'upcoming', '2026-11-24'), check('b', 'open', '2026-10-27', 'quarterly_review')]);
      expect(checkLine(w!)).toBe('Next check: opens Sat 24 Oct, due Tue 27 Oct');
    }
  });

  it('ignores other scheduled items and is null when no check is planned', () => {
    expect(nextCheckWindow([check('x', 'upcoming', '2026-10-27', 'export_backup')])).toBeNull();
    expect(nextCheckWindow([])).toBeNull();
  });
});

describe('Today hover count (Q3)', () => {
  it('names the day and the sessions done of the plan', () => {
    expect(HOME.dayHover(formatShort('2026-10-07'), 2, 3)).toBe('Wed 7 Oct: 2 of 3 sessions');
    expect(HOME.dayHover(formatShort('2026-10-08'), 0, 1)).toBe('Thu 8 Oct: 0 of 1 session');
  });
});

describe('sessions a day as a spinbutton (Q3)', () => {
  it('takes a typed whole number, at least the minimum, with no upper limit', () => {
    expect(parseCount('4', 1, Infinity)).toBe(4);
    expect(parseCount(' 12 ', 1, Infinity)).toBe(12);
    expect(parseCount('0', 1, Infinity)).toBe(1);
    expect(parseCount('5', 1, 1)).toBe(1);
  });

  it('keeps the old value for text that is not a whole number', () => {
    for (const t of ['', ' ', 'two', '2.5', '-3', '1e3']) expect(parseCount(t, 1, Infinity)).toBeNull();
  });

  it('moves by 1 with the arrow keys and stops at the minimum', () => {
    expect(stepKey('ArrowUp', 3, 1, Infinity)).toBe(4);
    expect(stepKey('ArrowDown', 3, 1, Infinity)).toBe(2);
    expect(stepKey('ArrowDown', 1, 1, Infinity)).toBe(1);
    expect(stepKey('Home', 7, 1, Infinity)).toBe(1);
    expect(stepKey('End', 3, 1, Infinity)).toBeNull();
    expect(stepKey('End', 3, 3, 7)).toBe(7);
    expect(stepKey('a', 3, 1, Infinity)).toBeNull();
  });
});

const sex = (d: string, activity: EventRow['activity_type'], band: EventRow['ejac_time_band'], min: number | null = null) => ({
  type: 'sexual_activity' as const,
  occurred_at: `${d}T21:00:00.000Z`,
  local_date: d,
  tz_offset_min: 0,
  entered_at: `${d}T21:05:00.000Z`,
  occurred_period: 'night' as const,
  leak_situation: null,
  leak_amount: null,
  activity_type: activity,
  hardness: null,
  ejac_time_band: band,
  ejac_time_min: min,
  control_0_10: 6,
  bother_0_10: 2,
  item_set_version: 1,
});

describe('editing a logged entry (Q3)', () => {
  it('opens an entry with its answers, and an exact-time entry at its part of the day', async () => {
    const db = await freshDb();
    await insertEvent(db, { ...sex('2026-10-01', 'solo', '3to5'), occurred_period: null, occurred_at: new Date(2026, 9, 1, 15, 10).toISOString() });
    const [row] = await listEvents(db);
    const v = valuesOf({ type: 'event', row });
    expect(v).toMatchObject({ kind: 'sex', day: '2026-10-01', when: 'afternoon', activity: 'solo', band: '3to5', control: 6, bother: 2 });
    // Cancel asks before throwing changes away, but not for the slider moving on its own.
    expect(answersChanged({ ...v, when: 'evening' }, v)).toBe(false);
    expect(answersChanged({ ...v, control: 8 }, v)).toBe(true);
  });

  it('updates the same row, keeps its time unless it was changed, and gives it a new sync clock', async () => {
    const db = await freshDb();
    await insertEvent(db, sex('2026-10-01', 'solo', '3to5', 4));
    const [before] = await listEvents(db);
    const hlc = (await db.get<{ hlc: string }>('SELECT hlc FROM event WHERE id = ?', [before.id]))!.hlc;
    const v = { ...valuesOf({ type: 'event', row: before }), activity: 'penetrative_vaginal' as const, band: '5to10' as const, control: 7 };
    const patch = eventPatch(before, v, false, new Date(2026, 9, 3, 12));
    expect(patch).not.toHaveProperty('occurred_at');
    await updateEvent(db, before.id, patch);
    const after = await listEvents(db);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: before.id, occurred_at: before.occurred_at, activity_type: 'penetrative_vaginal', ejac_time_band: '5to10', ejac_time_min: null, control_0_10: 7 });
    const row = await db.get<{ hlc: string; updated_at: string | null }>('SELECT hlc, updated_at FROM event WHERE id = ?', [before.id]);
    expect(row!.updated_at).not.toBeNull();
    expect(row!.hlc > hlc).toBe(true);
  });

  it('keeps a typed time when the range is not changed, and moves the time when the day was changed', () => {
    const row = { id: 'e', ...sex('2026-10-01', 'solo', '3to5', 4) } as EventRow;
    const same = eventPatch(row, valuesOf({ type: 'event', row }), false, new Date(2026, 9, 3, 12));
    expect(same).not.toHaveProperty('ejac_time_min');
    const moved = eventPatch(row, { ...valuesOf({ type: 'event', row }), day: '2026-09-30', when: 'evening' }, true, new Date(2026, 9, 3, 12));
    expect(moved).toMatchObject({ local_date: '2026-09-30', occurred_period: 'evening' });
  });

  it('changes a day note in place, and moves a note over several days as a whole', async () => {
    const db = await freshDb();
    await insertContextFlag(db, { kind: 'other', from_date: '2026-10-01', to_date: null, note: 'Bad cold' });
    const [f] = await listContextFlags(db);
    const v = { ...valuesOf({ type: 'flag', row: f }), note: '  Bad cold, better now ' };
    expect(flagPatch(f, v)).toEqual({ note: 'Bad cold, better now' });
    expect(flagPatch({ ...f, to_date: '2026-10-03' }, { ...v, day: '2026-09-29' })).toMatchObject({ from_date: '2026-09-29', to_date: '2026-10-01' });
  });
});

describe('time to ejaculation by activity type (PFB-016, EVT-031)', () => {
  it('places ranges and typed minutes on one scale, and leaves out "did not" and "not sure"', () => {
    expect(ejacRank('lt1', null)).toBe(0);
    expect(ejacRank('gt30', null)).toBe(7);
    expect(ejacRank(null, 0.5)).toBe(0);
    expect(ejacRank(null, 4)).toBe(3);
    expect(ejacRank(null, 30)).toBe(6);
    expect(ejacRank(null, 45)).toBe(7);
    expect(ejacRank('no_ejaculation', null)).toBeNull();
    expect(ejacRank('not_sure', null)).toBeNull();
  });

  it('keeps each activity type apart and needs 3 entries in 4 weeks', () => {
    const e = (date: string, activity: string, rank: number) => ({ date, activity, rank });
    const blocks = ejacBlocks(
      [e('2026-10-01', 'solo', 1), e('2026-10-02', 'solo', 5), e('2026-10-03', 'solo', 2), e('2026-10-03', 'solo', 6), e('2026-10-01', 'penetrative_vaginal', 3)],
      ['penetrative_vaginal', 'solo'],
      '2026-10-03',
      3
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[2]).toMatchObject({ from: '2026-09-06', to: '2026-10-03' });
    // Ranks 1, 2, 5, 6: the lower middle (2) is "2 to 3 minutes".
    expect(blocks[2].byActivity.solo).toEqual({ range: '2to3', count: 4 });
    expect(blocks[2].byActivity.penetrative_vaginal).toEqual({ range: null, count: 1 });
    expect(blocks[0].byActivity.solo).toEqual({ range: null, count: 0 });
  });

  it('shows on Progress for the male profile only, with the log form labels', async () => {
    const db = await freshDb();
    await updateProfile(db, { anatomy: 'male' });
    await setGoals(db, ['ejaculatory_control']);
    for (const d of ['2026-09-20', '2026-09-25', '2026-10-01']) await insertEvent(db, sex(d, 'solo', '3to5'));
    await insertEvent(db, sex('2026-10-02', 'penetrative_vaginal', '1to2'));
    await insertEvent(db, sex('2026-10-02', null, '1to2'));
    const m = buildProgress(await loadProgress(db), '2026-10-03');
    expect(m.ejac?.activities.map((a) => a.label)).toEqual(['Sex with penetration (vaginal)', 'Solo']);
    const now = m.ejac!.blocks[2];
    expect(ejacRangeText(now.byActivity.solo.range)).toBe('3 to 5 minutes');
    expect(now.byActivity.penetrative_vaginal).toEqual({ range: null, count: 1 });
    expect(PROGRESS.ejacFrom(3)).toBe('From 3 entries in the last 4 weeks');

    await updateProfile(db, { anatomy: 'female' });
    expect(buildProgress(await loadProgress(db), '2026-10-03').ejac).toBeNull();
  });
});
