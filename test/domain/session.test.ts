import { SessionRunner } from '../../src/domain/session/engine';
import { DEFAULT_LOAD, dayPlan, durationS, relaxPlan, slotPositions, strengthPlan, strongHolds } from '../../src/domain/session/plan';

describe('session plans (spec 03)', () => {
  it('matches the ENG-014 reference durations within 5 s', () => {
    const at = (holdS: number, holdReps: number, e: number | null) =>
      durationS(strengthPlan({ ...DEFAULT_LOAD, holdS, holdReps, enduranceEnabled: e != null, enduranceHoldS: e ?? 5 }, e != null, 'lying'));
    expect(Math.abs(at(3, 8, null) - 170)).toBeLessThanOrEqual(5);
    expect(Math.abs(at(10, 10, null) - 305)).toBeLessThanOrEqual(5);
    expect(Math.abs(at(10, 10, 5) - at(10, 10, null) - 105)).toBeLessThanOrEqual(5);
    expect(Math.abs(at(10, 10, 10) - 460)).toBeLessThanOrEqual(5);
  });

  it('endurance sits only in the last session of the day (PRG-011)', () => {
    const slots = dayPlan({ ...DEFAULT_LOAD, enduranceEnabled: true, tier: 2 }, 3, false);
    expect(slots.map((s) => s.endurance)).toEqual([false, false, true]);
    expect(slots.map((s) => s.position)).toEqual(['lying', 'sitting', 'standing']);
  });

  it('keeps the PRG-010 tables for 2 and 3 sessions a day', () => {
    expect([0, 1, 2, 3].map((t) => slotPositions(t, 3))).toEqual([
      ['lying', 'lying', 'lying'],
      ['lying', 'sitting', 'sitting'],
      ['lying', 'sitting', 'standing'],
      ['sitting', 'standing', 'standing'],
    ]);
    expect([0, 1, 2, 3].map((t) => slotPositions(t, 2))).toEqual([
      ['lying', 'lying'],
      ['lying', 'sitting'],
      ['sitting', 'standing'],
      ['standing', 'standing'],
    ]);
  });

  it('1 a day uses the most advanced unlocked position, as maintenance does (round 2, ENG-030)', () => {
    expect([0, 1, 2, 3].map((t) => slotPositions(t, 1))).toEqual([['lying'], ['sitting'], ['standing'], ['standing']]);
    const load = { ...DEFAULT_LOAD, enduranceEnabled: true, tier: 2 };
    expect(dayPlan(load, 1, false)).toEqual(dayPlan(load, 3, true));
    expect(dayPlan(load, 1, false)).toEqual([{ slotNo: 1, position: 'standing', endurance: true }]);
  });

  it('4 and 5 a day repeat the last 3-a-day position, endurance still last (round 2, no upper limit)', () => {
    expect(slotPositions(0, 4)).toEqual(['lying', 'lying', 'lying', 'lying']);
    expect(slotPositions(2, 4)).toEqual(['lying', 'sitting', 'standing', 'standing']);
    expect(slotPositions(1, 5)).toEqual(['lying', 'sitting', 'sitting', 'sitting', 'sitting']);
    expect(slotPositions(3, 5)).toEqual(['sitting', 'standing', 'standing', 'standing', 'standing']);
    const five = dayPlan({ ...DEFAULT_LOAD, enduranceEnabled: true, tier: 2 }, 5, false);
    expect(five.map((s) => s.slotNo)).toEqual([1, 2, 3, 4, 5]);
    expect(five.map((s) => s.endurance)).toEqual([false, false, false, false, true]);
    expect(dayPlan({ ...DEFAULT_LOAD, tier: 2 }, 4, false).every((s) => !s.endurance)).toBe(true);
    expect(slotPositions(2, 12)).toHaveLength(12);
  });

  it('maintenance stays 1 a day whatever the setting (ENG-031)', () => {
    expect(dayPlan({ ...DEFAULT_LOAD, tier: 1 }, 5, true)).toEqual([{ slotNo: 1, position: 'sitting', endurance: false }]);
  });

  it('the longest session stays within about 7.5 minutes', () => {
    const top = { holdS: 10, holdReps: 10, flickReps: 10, enduranceEnabled: true, enduranceHoldS: 10, tier: 3 };
    expect(durationS(strengthPlan(top, true, 'standing'))).toBeLessThanOrEqual(8.5 * 60);
    expect(strongHolds(strengthPlan(top, true, 'standing'))).toBe(10);
  });

  it('relax-only practice is about 4 minutes (ENG-060)', () => {
    expect(durationS(relaxPlan())).toBe(240);
  });
});

describe('session runner (ARCH-030, ENG-020, ENG-021)', () => {
  const plan = strengthPlan(DEFAULT_LOAD, false, 'lying');

  it('runs to completion and counts every rep', () => {
    const r = new SessionRunner(plan);
    r.start(0);
    const ev = r.tick(durationS(plan) * 1000 + 10);
    expect(ev.some((e) => e.type === 'finished')).toBe(true);
    expect(r.completion()).toBe('complete');
    const holds = r.results().find((b) => b.block === 'hold');
    expect(holds?.completedReps).toBe(DEFAULT_LOAD.holdReps);
  });

  it('excludes paused time', () => {
    const r = new SessionRunner(plan);
    r.start(0);
    r.tick(10_000);
    r.pause(10_000);
    r.resume(70_000);
    expect(r.elapsedMs(71_000)).toBe(11_000);
  });

  it('"Getting weak" ends the block, does not count the cut rep, and makes the session partial', () => {
    const r = new SessionRunner(plan);
    r.start(0);
    // relax-in 30 s + transition 5 s, then first hold 3 s: press during hold 1
    r.tick(36_000);
    r.gettingWeak(36_000);
    r.tick(durationS(plan) * 1000 + 60_000);
    expect(r.getState()).toBe('finished');
    expect(r.completion()).toBe('partial');
    const holds = r.results().find((b) => b.block === 'hold');
    expect(holds?.completedReps).toBe(0);
    expect(holds?.endReason).toBe('quality_drop');
  });

  it('pain stops the contractions, plays the relax-out and marks stopped_pain', () => {
    const r = new SessionRunner(plan);
    r.start(0);
    r.tick(40_000);
    r.stopEarly(40_000, 'user_stop');
    r.markPain();
    expect(r.currentPhase()?.relaxStep).toBe('relax_out');
    r.tick(80_000);
    expect(r.completion()).toBe('stopped_pain');
  });

  it('a confirmed End session finishes at once, with no relax-out (ENG-012a)', () => {
    const r = new SessionRunner(plan);
    r.start(0);
    r.tick(40_000);
    r.pause(40_000);
    const events = r.endNow(45_000);
    expect(r.getState()).toBe('finished');
    expect(events.some((e) => e.type === 'finished')).toBe(true);
    expect(r.completion()).toBe('partial');
  });
});
