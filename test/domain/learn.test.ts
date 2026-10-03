import {
  applySitting,
  classifyAttempt,
  insideCheckAllowed,
  mirrorCheckRequired,
  sittingResult,
  sittingShouldEnd,
  type AttemptInput,
} from '../../src/domain/learn';

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

describe('learn the squeeze, female profile (SX-C.8 to SX-C.12)', () => {
  const base: AttemptInput = {
    anatomy: 'female',
    checkMirror: 'unsure',
    checkTouch: 'not_done',
    checkInside: 'not_done',
    feltRelease: 'yes',
    mistakes: { breathing: true, buttocks: true, thighs: true, tummy: true, lift: 'lift', leak: false },
  };

  it('passes on one clear lift from the mirror, the outside touch or the inside check', () => {
    expect(classifyAttempt({ ...base, checkMirror: 'yes' }).good).toBe(true);
    expect(classifyAttempt({ ...base, checkTouch: 'lifted' }).good).toBe(true);
    expect(classifyAttempt({ ...base, checkInside: 'lifted' }).good).toBe(true);
    expect(classifyAttempt(base).good).toBe(false);
    expect(classifyAttempt({ ...base, checkInside: 'nothing' }).good).toBe(false);
  });

  it('treats "Widened or bulged" and "Felt a push out" as push-down signs', () => {
    expect(classifyAttempt({ ...base, checkMirror: 'no' })).toEqual({ good: false, pushDownSign: true });
    expect(classifyAttempt({ ...base, checkInside: 'pushed', checkMirror: 'yes' })).toEqual({ good: false, pushDownSign: true });
    expect(classifyAttempt({ ...base, checkTouch: 'bulged', checkMirror: 'yes' }).pushDownSign).toBe(true);
  });

  it('keeps a male mirror "No" as no lift, not a push down', () => {
    expect(classifyAttempt({ ...base, anatomy: 'male', checkMirror: 'no' }).pushDownSign).toBe(false);
  });

  it('a push-down sign in the sitting stops a pass', () => {
    const lift = { ...base, checkMirror: 'yes' as const };
    expect(sittingResult([lift, lift, { ...lift, checkInside: 'pushed' as const }].map(classifyAttempt))).toBe('not_sure');
    expect(sittingResult([lift, { ...lift, checkMirror: 'no' as const }, { ...lift, checkMirror: 'no' as const }].map(classifyAttempt))).toBe('push_down');
    expect(sittingResult([base, base, lift].map(classifyAttempt))).toBe('pass');
  });

  it('repeated unsure sittings raise the physiotherapist prompt (same rule as A2.5)', () => {
    let p = { status: 'not_started' as const, unsureSittings: 0, firstSittingAt: null, passedAt: null } as Parameters<typeof applySitting>[0];
    const at = new Date('2026-01-01T10:00:00Z');
    const r = sittingResult([base, base, base, base, base].map(classifyAttempt));
    expect(r).toBe('not_sure');
    for (let i = 0; i < 2; i++) p = applySitting(p, r, at, false).progress;
    expect(applySitting(p, r, at, false).raiseQG5).toBe(true);
  });

  it('hides the inside check with pain with sex or tampons, in the 6 weeks after birth, and for other profiles', () => {
    const ok = { painWithInsertion: false, birthWithin6Weeks: false };
    expect(insideCheckAllowed('female', ok)).toBe(true);
    expect(insideCheckAllowed('female', { ...ok, painWithInsertion: true })).toBe(false);
    expect(insideCheckAllowed('female', { ...ok, birthWithin6Weeks: true })).toBe(false);
    expect(insideCheckAllowed('female', null)).toBe(false);
    expect(insideCheckAllowed('male', ok)).toBe(false);
    expect(insideCheckAllowed('other_unspecified', ok)).toBe(false);
  });

  it('requires the mirror check for the female profile only', () => {
    expect(mirrorCheckRequired('female')).toBe(true);
    expect(mirrorCheckRequired('male')).toBe(false);
  });
});
