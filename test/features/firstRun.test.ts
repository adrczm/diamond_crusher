// First run after the UX audit (C2, H1, H6, M9): onboarding resume point, per-attempt position, stop test as info only,
// and a baseline offer window that reaches past the 3rd training day.
import { addDays, atLocalTime } from '../../src/domain/dates';
import { listAttempts } from '../../src/data/repositories/learn';
import { getProgramme } from '../../src/data/repositories/programme';
import { updateProfile } from '../../src/data/repositories/profile';
import { BASELINE_OFFER_DAYS, markStopTestShown, saveSitting, type AttemptRecord } from '../../src/features/learnService';
import { COUNTED_STEPS, ONBOARDING_ORDER, resumeAt, resumeStep, stepIndex } from '../../src/features/onboardingSteps';
import { freshDb } from '../helpers/db';

const all = { disclaimer: true, adult: true, anatomy: true, goals: true, screened: true };

describe('onboarding resume point (H1)', () => {
  it('opens a fresh profile at welcome', () => {
    expect(resumeStep(0)).toBe('welcome');
    expect(resumeAt(0, { disclaimer: false, adult: false, anatomy: false, goals: false, screened: false })).toBe('welcome');
  });

  it('resumes at the saved step', () => {
    for (const s of ONBOARDING_ORDER) expect(resumeAt(stepIndex(s), all)).toBe(s);
  });

  it('treats values past the end (older builds) as finish', () => {
    expect(resumeStep(9)).toBe('finish');
    expect(resumeStep(99)).toBe('finish');
  });

  it('goes back to the first step whose answer is missing', () => {
    expect(resumeAt(stepIndex('age'), { ...all, anatomy: false })).toBe('anatomy');
    expect(resumeAt(stepIndex('outcome'), { ...all, screened: false })).toBe('screening');
    expect(resumeAt(stepIndex('goals'), { ...all, adult: false })).toBe('adult');
  });

  it('keeps only the safety steps (C2): no plan, lock, reminder or "what to expect" step', () => {
    expect(ONBOARDING_ORDER).toEqual(['welcome', 'disclaimer', 'adult', 'anatomy', 'goals', 'age', 'screening', 'outcome', 'finish']);
    expect(COUNTED_STEPS).toHaveLength(7);
  });
});

const good: AttemptRecord = {
  startedAt: '2026-03-01T09:00:00.000Z',
  cueKey: 'cue.male.shorten_penis',
  checkMirror: 'not_done',
  checkTouch: 'lifted',
  feltRelease: 'yes',
  mistakes: { breathing: true, buttocks: true, thighs: true, tummy: true, lift: 'lift', leak: false },
};

describe('Learn the squeeze (H6, M9, C2)', () => {
  it('stores a mirror-checked attempt as standing and the others as lying (LRN-020)', async () => {
    const db = await freshDb();
    await updateProfile(db, { anatomy: 'male' });
    const mirror: AttemptRecord = { ...good, checkMirror: 'yes', checkTouch: 'not_done', position: 'standing' };
    await saveSitting(db, [good, mirror, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    const rows = (await listAttempts(db)).sort((a, b) => a.attempt_no - b.attempt_no);
    expect(rows.map((r) => r.position)).toEqual(['lying', 'standing', 'lying']);
  });

  it('keeps the baseline on offer long enough for a 3rd-day start', async () => {
    const db = await freshDb();
    await updateProfile(db, { anatomy: 'male' });
    await saveSitting(db, [good, good, good], 'sitting', 'lying', atLocalTime('2026-03-01', '09:00'));
    const prog = await getProgramme(db);
    expect(BASELINE_OFFER_DAYS).toBeGreaterThanOrEqual(14);
    expect(prog.baseline_offer_until).toBe(addDays('2026-03-01', BASELINE_OFFER_DAYS));
  });

  it('records the stop test as shown, with no result (M9)', async () => {
    const db = await freshDb();
    await markStopTestShown(db);
    const prog = await getProgramme(db);
    expect(prog.stop_test_shown_at).not.toBeNull();
    expect(prog.stop_test_result).toBeNull();
  });
});
