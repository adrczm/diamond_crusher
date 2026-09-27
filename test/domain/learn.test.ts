import { applySitting, classifyAttempt, sittingResult, sittingShouldEnd, type AttemptInput } from '../../src/domain/learn';

const good: AttemptInput = {
  checkMirror: 'yes',
  checkTouch: 'not_done',
  feltRelease: 'yes',
  mistakes: { breathing: true, buttocks: true, thighs: true, tummy: true, lift: 'lift', leak: false },
};
const unsure: AttemptInput = { ...good, checkMirror: 'unsure' };
const push: AttemptInput = { ...good, checkTouch: 'bulged' };

describe('learn the squeeze (spec 02)', () => {
  it('classifies attempts (LRN-023)', () => {
    expect(classifyAttempt(good)).toEqual({ good: true, pushDownSign: false });
    expect(classifyAttempt(unsure).good).toBe(false);
    expect(classifyAttempt(push).pushDownSign).toBe(true);
  });

  it('passes after 3 attempts with one good and no push-down (LRN-030)', () => {
    const a = [unsure, unsure, good].map(classifyAttempt);
    expect(sittingResult(a)).toBe('pass');
    expect(sittingShouldEnd(a)).toBe(true);
    expect(sittingShouldEnd(a.slice(0, 2))).toBe(false);
  });

  it('push-down wins with 2 signs', () => {
    expect(sittingResult([good, push, push].map(classifyAttempt))).toBe('push_down');
  });

  it('raises Q-G5 after 3 unsure sittings and offers "start anyway" (LRN-031, LRN-032)', () => {
    let p = { status: 'not_started' as const, unsureSittings: 0, firstSittingAt: null, passedAt: null } as Parameters<typeof applySitting>[0];
    const at = new Date('2026-01-01T10:00:00Z');
    for (let i = 0; i < 2; i++) p = applySitting(p, 'not_sure', at, false).progress;
    const third = applySitting(p, 'not_sure', at, false);
    expect(third.raiseQG5).toBe(true);
    expect(third.canStartAnyway).toBe(true);
    expect(applySitting(p, 'push_down', at, true).progress.status).toBe('locked_push_down');
  });
});
