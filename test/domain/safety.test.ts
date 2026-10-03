import {
  deriveReasons,
  isVisible,
  modeFromReasons,
  painRouteTriggered,
  preSurgeryAdvice,
  questionsFor,
  questionsForChange,
  skippedSafety,
  URGENT,
  type Answers,
  type QuestionKey,
} from '../../src/domain/safety';

describe('safety routing (spec 01)', () => {
  it('orders modes Stop > Wait > Relax-only > Caution > Start (ONB-012)', () => {
    expect(modeFromReasons([])).toBe('normal');
    expect(modeFromReasons(['Q-G1'])).toBe('caution');
    expect(modeFromReasons(['Q-G1', 'Q-P1'])).toBe('relax_only');
    expect(modeFromReasons(['Q-P1', 'Q-S1'])).toBe('blocked_until_cleared');
    expect(modeFromReasons(['Q-S1', 'Q-R2'])).toBe('blocked_urgent');
  });

  it('shows the catheter follow-up only after a yes (Q-S2b)', () => {
    expect(isVisible('Q-S2b', {})).toBe(false);
    expect(isVisible('Q-S2b', { 'Q-S2': 'yes' })).toBe(true);
  });

  it('asks male-only and female-only questions by profile', () => {
    expect(questionsFor('full', 'male')).toContain('Q-G2');
    expect(questionsFor('full', 'male')).not.toContain('Q-F1');
    expect(questionsFor('full', 'female')).toContain('Q-F1');
    expect(questionsFor('short', 'male')).not.toContain('Q-G1');
  });

  it('keeps pain until a professional clears it; a later "no" is not enough (ONB-016)', () => {
    const first = deriveReasons([], { 'Q-P1': 'yes' });
    expect(modeFromReasons(first)).toBe('relax_only');
    const later = deriveReasons(first, { 'Q-P1': 'no' });
    expect(modeFromReasons(later)).toBe('relax_only');
    const cleared = deriveReasons(later, {}, { painCleared: true });
    expect(modeFromReasons(cleared)).toBe('normal');
  });

  it('keeps urgent reasons until "I have been seen" (ONB-017)', () => {
    const r = deriveReasons([], { 'Q-R1': 'yes' });
    expect(modeFromReasons(deriveReasons(r, { 'Q-R1': 'no' }))).toBe('blocked_urgent');
    expect(modeFromReasons(deriveReasons(r, {}, { urgentChecked: true }))).toBe('normal');
  });

  it('unblocks the catheter wait when it is out (ONB-015)', () => {
    const r = deriveReasons([], { 'Q-S2': 'yes', 'Q-S2b': 'no' });
    expect(modeFromReasons(r)).toBe('blocked_until_cleared');
    expect(modeFromReasons(deriveReasons(r, { 'Q-S2': 'no' }))).toBe('normal');
  });

  it('keeps unasked caution reasons on a short screen', () => {
    const r = deriveReasons([], { 'Q-G1': 'yes' });
    expect(deriveReasons(r, { 'Q-R1': 'no' })).toContain('Q-G1');
  });

  it('two "a little" pain answers within 7 days trigger the pain route (ONB-041)', () => {
    expect(painRouteTriggered([{ date: '2026-01-01', level: 'a_little' }], { date: '2026-01-07', level: 'a_little' })).toBe(true);
    expect(painRouteTriggered([{ date: '2026-01-01', level: 'a_little' }], { date: '2026-01-09', level: 'a_little' })).toBe(false);
    expect(painRouteTriggered([], { date: '2026-01-09', level: 'yes' })).toBe(true);
  });

  it('suggests starting before surgery only with 3 weeks or more (ONB-014)', () => {
    expect(preSurgeryAdvice('2026-02-01', '2026-01-01')).toBe('start_now');
    expect(preSurgeryAdvice('2026-01-10', '2026-01-01')).toBe('short_notice');
  });
});

describe('skipped safety questions (UX audit C1)', () => {
  it('lists skipped urgent, surgery and pain questions, not skipped caution ones', () => {
    const { skippedSafety } = require('../../src/domain/safety');
    expect(skippedSafety({ 'Q-R1': 'skipped', 'Q-S1': 'skipped', 'Q-P2': 'skipped', 'Q-G1': 'skipped', 'Q-R2': 'no' })).toEqual(['Q-R1', 'Q-S1', 'Q-P2']);
    expect(skippedSafety({ 'Q-R1': 'no' })).toEqual([]);
  });
});

describe('"Something changed?" asks only about the change (UX audit M10)', () => {
  const allNo = (keys: QuestionKey[]): Answers => Object.fromEntries(keys.map((k) => [k, 'no']));

  it('always asks the urgent questions first, then the questions for the change', () => {
    const pain = questionsForChange(['pain'], 'male');
    expect(pain.slice(0, 5)).toEqual(['Q-R1', 'Q-R2', 'Q-R3', 'Q-R4', 'Q-R5']);
    expect(pain).toEqual(['Q-R1', 'Q-R2', 'Q-R3', 'Q-R4', 'Q-R5', 'Q-P1', 'Q-P2', 'Q-P3']);
    expect(questionsForChange(['pain'], 'female')).toContain('Q-F3');
    expect(questionsForChange(['leaks'], 'male')).toEqual(['Q-R1', 'Q-R2', 'Q-R3', 'Q-R4', 'Q-R5', 'Q-M1', 'Q-G7', 'Q-P3', 'Q-G1', 'Q-G3', 'Q-B1', 'Q-G6']);
    const surgery = questionsForChange(['surgery_health'], 'male');
    expect(surgery).toEqual(expect.arrayContaining(['Q-S1', 'Q-S2', 'Q-S2b', 'Q-S3', 'Q-G2', 'Q-G4']));
    expect(surgery).not.toContain('Q-P1');
  });

  it('joins topics without repeats and runs the full screen for "other" or nothing', () => {
    const both = questionsForChange(['pain', 'leaks'], 'male');
    expect(new Set(both).size).toBe(both.length);
    expect(both.filter((k) => k === 'Q-P3')).toHaveLength(1);
    expect(questionsForChange(['other'], 'male')).toEqual(questionsFor('full', 'male'));
    expect(questionsForChange(['pain', 'other'], 'female')).toEqual(questionsFor('full', 'female'));
    expect(questionsForChange([], 'male')).toEqual(questionsFor('full', 'male'));
  });

  it('keeps earlier reasons for questions it did not ask, and still acts on the ones it did', () => {
    // A catheter wait and a leak caution from before stay after a pain-only check with all "no".
    const noPain = allNo(questionsForChange(['pain'], 'male'));
    const after = deriveReasons(['Q-S1', 'Q-G1'], noPain);
    expect(after).toEqual(['Q-S1', 'Q-G1']);
    expect(modeFromReasons(after)).toBe('blocked_until_cleared');
    // A new pain "yes" in the subset routes to relax-only, as in the full screen.
    expect(modeFromReasons(deriveReasons([], { ...noPain, 'Q-P2': 'yes' }))).toBe('relax_only');
    // An urgent "yes" in the subset still stops training.
    expect(modeFromReasons(deriveReasons([], { ...noPain, 'Q-R3': 'yes' }))).toBe('blocked_urgent');
    // A surgery-only check with "no" clears an old catheter reason, as the full screen does.
    const noSurgery = allNo(questionsForChange(['surgery_health'], 'male'));
    expect(modeFromReasons(deriveReasons(['Q-S1'], noSurgery))).toBe('normal');
  });

  it('does not count questions it did not ask as skipped', () => {
    const answers = allNo(questionsForChange(['leaks'], 'male'));
    expect(skippedSafety(answers)).toEqual([]);
    expect(skippedSafety({ ...answers, 'Q-R2': 'skipped' })).toEqual(['Q-R2']);
  });

  it('asks the catheter follow-up only after a yes, as in the full screen', () => {
    const q = questionsForChange(['surgery_health'], 'male');
    expect(q.filter((k) => isVisible(k, {}))).not.toContain('Q-S2b');
    expect(q.filter((k) => isVisible(k, { 'Q-S2': 'yes' }))).toContain('Q-S2b');
  });
});

describe('women, bowel and history questions (1.5.0, men-and-women research)', () => {
  it('routes the bowel warning signs: see a GP (Q-B1), urgent (Q-R5), for every profile (SX25)', () => {
    for (const a of ['male', 'female', 'other_unspecified'] as const) {
      expect(questionsFor('full', a)).toEqual(expect.arrayContaining(['Q-R5', 'Q-B1']));
      expect(questionsFor('short', a)).toContain('Q-R5');
    }
    expect(modeFromReasons(deriveReasons([], { 'Q-B1': 'yes' }))).toBe('caution');
    expect(modeFromReasons(deriveReasons([], { 'Q-R5': 'yes' }))).toBe('blocked_urgent');
  });

  it('asks Q-G7 only after recorded prostate treatment (G2)', () => {
    expect(isVisible('Q-G7', {})).toBe(false);
    expect(isVisible('Q-G7', { 'Q-M1': 'yes' })).toBe(true);
    expect(isVisible('Q-G7', {}, { prostateTreatment: true })).toBe(true);
    expect(isVisible('Q-G7', { 'Q-M1': 'no' }, { prostateTreatment: true })).toBe(false);
    expect(questionsFor('full', 'female')).not.toContain('Q-G7');
  });

  it('routes straining for women to a get-checked card, not the pain route (SX11)', () => {
    expect(questionsFor('full', 'female')).not.toContain('Q-P3');
    expect(questionsFor('full', 'female')).toContain('Q-F10');
    expect(modeFromReasons(deriveReasons([], { 'Q-F10': 'yes' }))).toBe('caution');
    expect(modeFromReasons(deriveReasons([], { 'Q-P3': 'yes' }))).toBe('relax_only');
  });

  it('pregnancy: warning signs are urgent, "told not to exercise" waits for the OK (SX9)', () => {
    expect(isVisible('Q-F2a2', {})).toBe(false);
    expect(isVisible('Q-F2a2', { 'Q-F2a': 'yes' })).toBe(true);
    expect(modeFromReasons(deriveReasons([], { 'Q-F2a': 'yes', 'Q-F2a2': 'yes' }))).toBe('blocked_urgent');
    const told = deriveReasons([], { 'Q-F2a': 'yes', 'Q-F2a1': 'yes', 'Q-F2a3': 'yes' });
    expect(modeFromReasons(told)).toBe('blocked_until_cleared');
    // A short screen that does not ask about it keeps the wait; the maternity OK clears it.
    expect(modeFromReasons(deriveReasons(told, { 'Q-R1': 'no' }))).toBe('blocked_until_cleared');
    expect(modeFromReasons(deriveReasons(told, { 'Q-F2a1': 'no' }))).toBe('caution');
    // No longer pregnant: the pregnancy reasons end.
    expect(deriveReasons(told, { 'Q-F2a': 'no' })).toEqual([]);
  });

  it('adds the pregnancy and after-birth urgent questions to the short screen only when they apply', () => {
    expect(questionsFor('short', 'female')).not.toContain('Q-F2a2');
    expect(questionsFor('short', 'female', { pregnant: true })).toContain('Q-F2a2');
    expect(questionsFor('short', 'female', { birthWithin6Weeks: true })).toContain('Q-F2b1');
    expect(questionsFor('short', 'female')).toContain('Q-F4');
    expect(questionsFor('short', 'male')).not.toContain('Q-F4');
  });

  it('a caesarean does not block: birth has its own questions, and Q-S2 says "apart from giving birth" (SX-A.8)', () => {
    const { questionText } = require('../../src/content/en/screening');
    expect(questionText('Q-S2', 'female')).toMatch(/^Apart from giving birth/);
    expect(modeFromReasons(deriveReasons([], { 'Q-F2b': 'yes', 'Q-F2b2': 'yes' }))).toBe('caution');
  });

  it('ends bulge follow-up cards when the bulge answer turns to no', () => {
    const r = deriveReasons([], { 'Q-F1': 'yes', 'Q-F1b': 'yes', 'Q-F1c': 'yes' });
    expect(r).toEqual(['Q-F1', 'Q-F1b', 'Q-F1c']);
    expect(deriveReasons(r, { 'Q-F1': 'no' })).toEqual([]);
  });
});
