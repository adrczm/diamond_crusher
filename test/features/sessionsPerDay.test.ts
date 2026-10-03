// Sessions a day with no upper limit, and reminders that keep in step with Undo (round 2; 08 REM-001; 04 PRG-040).
import { listPlan, savePlan } from '../../src/data/repositories/reminders';
import { getSettings, updateSettings } from '../../src/data/repositories/settings';
import { setSessionsPerDay, undoSessionsChange } from '../../src/features/reminderService';
import { freshDb } from '../helpers/db';

const slot = (slotNo: number, anchorKey: string, timeLocal: string) => ({ slotNo, anchorKey, anchorCustom: null, timeLocal, weekdays: 127, enabled: true });

async function withThree() {
  const db = await freshDb();
  await updateSettings(db, { sessions_per_day_target: 3 });
  await savePlan(db, [slot(1, 'teeth', '07:45'), slot(2, 'lunch', '12:30'), slot(3, 'bed', '22:30')]);
  return db;
}

describe('sessions a day and reminders in step', () => {
  it('turns off the middle reminder going down and brings it back going up', async () => {
    const db = await withThree();
    const down = await setSessionsPerDay(db, 2);
    expect(down?.result.kind).toBe('updated');
    expect((await getSettings(db)).sessions_per_day_target).toBe(2);
    let plan = await listPlan(db);
    expect(plan.map((p) => [p.slotNo, p.enabled])).toEqual([
      [1, true],
      [2, false],
      [3, true],
    ]);
    await setSessionsPerDay(db, 3);
    plan = await listPlan(db);
    expect(plan.every((p) => p.enabled)).toBe(true);
    expect(plan.find((p) => p.slotNo === 2)?.timeLocal).toBe('12:30');
  });

  it('allows more than 3 a day and more than 3 reminder slots', async () => {
    const db = await withThree();
    await setSessionsPerDay(db, 4);
    const change = await setSessionsPerDay(db, 5);
    expect((await getSettings(db)).sessions_per_day_target).toBe(5);
    const plan = await listPlan(db);
    expect(plan.filter((p) => p.enabled)).toHaveLength(5);
    expect(plan.map((p) => p.slotNo)).toEqual([1, 2, 3, 4, 5]);
    expect(change?.result.kind === 'updated' && change.result.added.map((s) => s.timeLocal)).toEqual(['20:00']);
  });

  it('Undo puts back the number and the reminders exactly', async () => {
    const db = await withThree();
    const before = await listPlan(db);
    const change = await setSessionsPerDay(db, 4);
    expect((await listPlan(db)).length).toBe(4);
    await undoSessionsChange(db, change!);
    expect((await getSettings(db)).sessions_per_day_target).toBe(3);
    expect(await listPlan(db)).toEqual(before);
  });

  it('leaves reminders alone when they did not match, but still changes the plan', async () => {
    const db = await withThree();
    await updateSettings(db, { sessions_per_day_target: 2 });
    const change = await setSessionsPerDay(db, 1);
    expect(change?.result).toEqual({ kind: 'mismatch', reminders: 3 });
    expect((await getSettings(db)).sessions_per_day_target).toBe(1);
    expect((await listPlan(db)).every((p) => p.enabled)).toBe(true);
  });

  it('never goes below 1 a day', async () => {
    const db = await withThree();
    await setSessionsPerDay(db, 1);
    expect(await setSessionsPerDay(db, 0)).toBeNull();
    expect((await getSettings(db)).sessions_per_day_target).toBe(1);
  });

  it('saving the Reminders screen turns off slots it does not show, and keeps them', async () => {
    const db = await withThree();
    await savePlan(db, [slot(1, 'teeth', '07:45'), slot(3, 'bed', '22:30')]);
    const plan = await listPlan(db);
    expect(plan).toHaveLength(3);
    expect(plan.find((p) => p.slotNo === 2)).toMatchObject({ enabled: false, timeLocal: '12:30', anchorKey: 'lunch' });
  });
});
