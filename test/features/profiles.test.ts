// 1.5.0: the gentle squeeze in relaxation-only mode, and life-stage facts from the safety answers.
import { relaxPlan, timeline } from '../../src/domain/session/plan';
import { getProgramme } from '../../src/data/repositories/programme';
import { updateProfile } from '../../src/data/repositories/profile';
import { confirmLetGo, gentleState, loadGentleState, painGone } from '../../src/features/gentleService';
import { clear, completeScreening, factsFrom, profileFacts, reportPain } from '../../src/features/safetyService';
import { planToday } from '../../src/features/trainingService';
import { freshDb } from '../helpers/db';

async function relaxOnlyDb() {
  const db = await freshDb();
  await updateProfile(db, { anatomy: 'male', onboarding_completed_at: '2026-03-01T08:00:00.000Z' });
  await completeScreening(db, { kind: 'onboarding', answers: { 'Q-P1': 'yes' }, startedAt: '2026-03-01T08:00:00.000Z' });
  return db;
}

describe('gentle squeeze in relaxation-only mode (ENG-061)', () => {
  it('adds 8 half-strength squeezes, up to 10 s, with a 4 s let-go, before the quiet end', () => {
    const plan = relaxPlan('lying', true);
    const g = plan.blocks.find((b) => b.gentle)!;
    expect(g).toMatchObject({ type: 'endurance', reps: 8, onS: 10, releaseS: 4, restS: 0 });
    expect(plan.blocks[plan.blocks.length - 1].relaxStep).toBe('quiet');
    expect(timeline(plan).filter((p) => p.gentle && p.kind === 'squeeze')).toHaveLength(8);
    expect(relaxPlan('lying').blocks.some((b) => b.gentle)).toBe(false);
  });

  it('asks first, unlocks after a full let-go, and only in relaxation-only mode', async () => {
    expect(gentleState('normal', '2026-03-01', false)).toBe('off');
    const db = await relaxOnlyDb();
    expect(await loadGentleState(db)).toBe('ask');
    let t = await planToday(db, new Date('2026-03-02T09:00:00'));
    expect(t.plan!.blocks.some((b) => b.gentle)).toBe(false);
    await confirmLetGo(db);
    expect(await loadGentleState(db)).toBe('on');
    t = await planToday(db, new Date('2026-03-02T09:00:00'));
    expect(t.plan!.blocks.some((b) => b.gentle)).toBe(true);
  });

  it('locks after pain from the exercises until the person says it has gone (SX22)', async () => {
    const db = await relaxOnlyDb();
    await confirmLetGo(db);
    expect(await reportPain(db, 'yes', 'session:x', '2026-03-02')).toBe(true);
    expect(await loadGentleState(db)).toBe('pain_locked');
    const t = await planToday(db, new Date('2026-03-02T09:00:00'));
    expect(t.plan!.blocks.some((b) => b.gentle)).toBe(false);
    await painGone(db);
    expect(await loadGentleState(db)).toBe('on');
    await reportPain(db, 'yes', 'session:y', '2026-03-03');
    await clear(db, 'pain');
    expect((await getProgramme(db)).gentle_pain_lock).toBe(false);
  });
});

describe('life-stage facts from the safety answers', () => {
  const yes = (on: string, valueDate: string | null = null) => ({ answer: 'yes' as const, valueDate, on });

  it('sets pregnancy, and an after-birth flag that ends 12 weeks after the birth', () => {
    const f = factsFrom({ 'Q-F2a': yes('2026-03-01', '2026-08-01') }, [], 'female', '2026-03-02');
    expect(f).toMatchObject({ pregnant: true, dueDate: '2026-08-01', postnatal: false });
    const birth = { 'Q-F2b': yes('2026-03-01', '2026-02-20') };
    expect(factsFrom(birth, [], 'female', '2026-03-10')).toMatchObject({ postnatal: true, birthWithin6Weeks: true });
    expect(factsFrom(birth, [], 'female', '2026-04-10')).toMatchObject({ postnatal: true, birthWithin6Weeks: false });
    expect(factsFrom(birth, [], 'female', '2026-05-15')).toMatchObject({ postnatal: false, birthDate: null });
    // Facts follow the profile: a male profile is never pregnant.
    expect(factsFrom({ 'Q-F2a': yes('2026-03-01') }, [], 'male', '2026-03-02').pregnant).toBe(false);
  });

  it('reads the latest answers from the database', async () => {
    const db = await freshDb();
    await updateProfile(db, { anatomy: 'male' });
    await completeScreening(db, { kind: 'onboarding', answers: { 'Q-M1': 'yes', 'Q-G7': 'yes' }, startedAt: '2026-03-01T08:00:00.000Z' });
    let f = await profileFacts(db, '2026-03-02');
    expect(f.prostateTreatment).toBe(true);
    await completeScreening(db, { kind: 'something_changed', answers: { 'Q-M1': 'no' }, startedAt: '2026-03-03T08:00:00.000Z' });
    f = await profileFacts(db, '2026-03-04');
    expect(f.prostateTreatment).toBe(false);
  });

  it('stores the birth date given with the answer', async () => {
    const db = await freshDb();
    await updateProfile(db, { anatomy: 'female' });
    await completeScreening(db, { kind: 'onboarding', answers: { 'Q-F2b': 'yes' }, dates: { 'Q-F2b': '2026-02-25' }, startedAt: '2026-03-01T08:00:00.000Z' });
    expect(await profileFacts(db, '2026-03-02')).toMatchObject({ postnatal: true, birthDate: '2026-02-25', birthWithin6Weeks: true });
  });
});

describe('after prostate treatment (SX16)', () => {
  it('unlocks standing after the first lying pass', async () => {
    const { saveSitting } = require('../../src/features/learnService');
    const good = {
      startedAt: '2026-03-01T09:00:00.000Z',
      cueKey: 'cue.male.hold_wind',
      checkMirror: 'yes',
      checkTouch: 'not_done',
      feltRelease: 'yes',
      mistakes: { breathing: true, buttocks: true, thighs: true, tummy: true, lift: 'lift', leak: false },
    };
    for (const treated of [true, false]) {
      const db = await freshDb();
      await updateProfile(db, { anatomy: 'male' });
      await completeScreening(db, { kind: 'onboarding', answers: { 'Q-M1': treated ? 'yes' : 'no' }, startedAt: '2026-03-01T08:00:00.000Z' });
      await saveSitting(db, [good, good, good], 'sitting', 'lying', new Date('2026-03-01T09:10:00.000Z'));
      const p = await getProgramme(db);
      expect(p.learn_status).toBe('passed');
      expect(p.position_tier).toBe(treated ? 2 : 0);
    }
  });
});

describe('16-week build with a heaviness or bulge answer (SX4)', () => {
  it('offers the lighter routine from week 17 instead of week 13', () => {
    const { maintenanceDue } = require('../../src/domain/progression');
    const base = { phase: 'build', reviewDoneOrSkipped: true, keepBuildingUntilActiveDay: null };
    const { programmeWeek } = require('../../src/domain/progression');
    let d13 = 0;
    while (programmeWeek(d13) < 13) d13++;
    let d17 = 0;
    while (programmeWeek(d17) < 17) d17++;
    expect(maintenanceDue({ ...base, activeDays: d13 })).toBe(true);
    expect(maintenanceDue({ ...base, activeDays: d13, buildWeeks: 16 })).toBe(false);
    expect(maintenanceDue({ ...base, activeDays: d17, buildWeeks: 16 })).toBe(true);
  });
});

describe('questionnaires by profile (SX2, SX-D.5.1, SX28)', () => {
  const { mcidFor, mcidWithheld } = require('../../src/domain/questionnaire');
  const { bundleIds } = require('../../src/content/en/questionnaires');
  const m = { mcid: { type: 'fixed', values: [2, 6], source: 'women', population: 'women' } };

  it('uses a threshold found in women only for the female profile', () => {
    expect(mcidFor(m, 'female')).toBe(m.mcid);
    expect(mcidFor(m, 'male')).toBeUndefined();
    expect(mcidWithheld(m, 'male')).toBe(true);
    expect(mcidWithheld({}, 'male')).toBe(false);
  });

  it('maps the women goals and the bowel goal for everyone', () => {
    expect(bundleIds('female', ['bladder_control'], 'quarterly')).toEqual(['iciq_ui_sf', 'app_global_change', 'iciq_fluts']);
    expect(bundleIds('female', ['sexual_function'], 'monthly')).toEqual(['iciq_ui_sf', 'iciq_flutssex', 'app_female_sexual']);
    expect(bundleIds('male', ['bowel_control'], 'quarterly')).toContain('iciq_b');
    expect(bundleIds('other_unspecified', ['bowel_control'], 'quarterly')).toContain('iciq_b');
    expect(bundleIds('female', [], 'quarterly', { bulge: true })).toContain('iciq_vs');
    expect(bundleIds('female', [], 'quarterly')).not.toContain('pfdi_20');
  });
});
