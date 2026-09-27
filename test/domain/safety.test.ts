import { deriveReasons, isVisible, modeFromReasons, painRouteTriggered, preSurgeryAdvice, questionsFor } from '../../src/domain/safety';

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
